import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as http from "@actions/http-client";
import * as tc from "@actions/tool-cache";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  buildLoginArgs,
  shouldAuthenticate,
  writeTokenSettings,
  type AuthInputs,
} from "./auth";
import {
  assertValidVersionInput,
  isPinnedSemver,
  releaseVersionFromServer,
  stripV,
  withV,
} from "./version";

const TOOL_NAME = "epinio";
const RELEASES_API = "https://api.github.com/repos/epinio/epinio/releases";

type Platform = "linux" | "darwin" | "windows";
type Arch = "x86_64" | "arm64" | "armv7" | "s390x";

function platform(): Platform {
  switch (process.platform) {
    case "linux":
      return "linux";
    case "darwin":
      return "darwin";
    case "win32":
      return "windows";
    default:
      throw new Error(`Unsupported runner OS: ${process.platform}`);
  }
}

function arch(): Arch {
  switch (process.arch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "arm64";
    case "arm":
      return "armv7";
    case "s390x":
      return "s390x";
    default:
      throw new Error(`Unsupported runner arch: ${process.arch}`);
  }
}

function assetName(osName: Platform, cpu: Arch): string {
  if (osName === "windows") {
    if (cpu !== "x86_64") {
      throw new Error(`Epinio Windows releases only provide x86_64 (got ${cpu})`);
    }
    return "epinio-windows-x86_64.zip";
  }
  return `epinio-${osName}-${cpu}`;
}

function githubHeaders(githubToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "setup-epinio-action",
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }
  return headers;
}

async function resolveLatestFromGitHub(githubToken: string): Promise<string> {
  const client = new http.HttpClient("setup-epinio-action");
  const url = `${RELEASES_API}/latest`;

  const res = await client.getJson<{ tag_name: string }>(
    url,
    githubHeaders(githubToken),
  );
  if (res.statusCode !== 200 || !res.result?.tag_name) {
    throw new Error(
      `Failed to resolve the latest Epinio release (HTTP ${res.statusCode})`,
    );
  }
  return stripV(res.result.tag_name);
}

async function resolveFromServer(url: string, trustCA: boolean): Promise<string> {
  const client = new http.HttpClient("setup-epinio-action", undefined, {
    ignoreSslError: trustCA,
  });
  const infoUrl = `${url.replace(/\/$/, "")}/api/v1/info`;
  const res = await client.getJson<{ version?: string }>(infoUrl);
  if (res.statusCode !== 200 || !res.result?.version) {
    throw new Error(
      `Failed to read Epinio server version from ${infoUrl} (HTTP ${res.statusCode})`,
    );
  }
  const resolved = releaseVersionFromServer(res.result.version);
  if (stripV(res.result.version) !== resolved) {
    core.warning(
      `Epinio server reports ${res.result.version}; installing the matching release ${resolved}`,
    );
  }
  return resolved;
}

async function resolveVersion(
  versionInput: string,
  url: string,
  trustCA: boolean,
  githubToken: string,
): Promise<string> {
  const requested = versionInput.trim() || "latest";
  assertValidVersionInput(requested);

  if (requested === "server") {
    if (!url) {
      throw new Error('version "server" requires the url input');
    }
    return resolveFromServer(url, trustCA);
  }

  // Pinned semver: build the download URL directly (no GitHub API call).
  if (isPinnedSemver(requested)) {
    return stripV(requested);
  }

  return resolveLatestFromGitHub(githubToken);
}

async function installEpinio(resolvedVersion: string): Promise<string> {
  const cached = tc.find(TOOL_NAME, resolvedVersion, arch());
  if (cached) {
    core.info(`Using cached Epinio ${resolvedVersion} from ${cached}`);
    return cached;
  }

  const osName = platform();
  const cpu = arch();
  const name = assetName(osName, cpu);
  const downloadUrl = `https://github.com/epinio/epinio/releases/download/${withV(resolvedVersion)}/${name}`;
  core.info(`Downloading ${downloadUrl}`);

  let binDir: string;

  if (osName === "windows") {
    // PowerShell Expand-Archive (used by tool-cache on Windows) requires a
    // .zip extension; downloadTool's default dest is an extensionless UUID.
    const zipPath = path.join(
      process.env.RUNNER_TEMP || os.tmpdir(),
      `epinio-${resolvedVersion}-${crypto.randomUUID()}.zip`,
    );
    const downloaded = await tc.downloadTool(downloadUrl, zipPath);
    binDir = await tc.extractZip(downloaded);
  } else {
    const downloaded = await tc.downloadTool(downloadUrl);
    binDir = path.join(path.dirname(downloaded), `epinio-${resolvedVersion}`);
    fs.mkdirSync(binDir, { recursive: true });
    const dest = path.join(binDir, "epinio");
    fs.copyFileSync(downloaded, dest);
    fs.chmodSync(dest, 0o755);
  }

  const cachedPath = await tc.cacheDir(binDir, TOOL_NAME, resolvedVersion, cpu);
  core.info(`Cached Epinio ${resolvedVersion} to ${cachedPath}`);
  return cachedPath;
}

async function authenticate(input: AuthInputs): Promise<void> {
  if (!shouldAuthenticate(input)) {
    return;
  }

  if (input.token) {
    const file = writeTokenSettings(input.url, input.token, input.namespace);
    // Epinio on macOS/Windows does not use ~/.config by default; export so the
    // CLI (and later workflow steps) read the file we wrote.
    core.exportVariable("EPINIO_SETTINGS", file);
    core.info(`Wrote Epinio settings with token auth to ${file}`);
    return;
  }

  const args = buildLoginArgs(input.url, input.user, input.password, input.trustCA);
  // Closed stdin makes epinio fail fast instead of waiting on its interactive
  // "trust this certificate?" prompt, which nobody can answer in CI.
  const code = await exec.exec("epinio", args, {
    ignoreReturnCode: true,
    input: Buffer.alloc(0),
  });
  if (code !== 0) {
    const hint = input.trustCA
      ? ""
      : " (if the server uses a self-signed certificate, set trust-ca: true)";
    throw new Error(`epinio login failed with exit code ${code}${hint}`);
  }

  if (input.namespace) {
    const targetCode = await exec.exec("epinio", ["target", input.namespace], {
      ignoreReturnCode: true,
    });
    if (targetCode !== 0) {
      throw new Error(`epinio target failed with exit code ${targetCode}`);
    }
  }
}

async function run(): Promise<void> {
  const versionInput = core.getInput("version") || "latest";
  const githubToken = core.getInput("github-token");
  const auth: AuthInputs = {
    url: core.getInput("url"),
    token: core.getInput("token"),
    user: core.getInput("user"),
    password: core.getInput("password"),
    namespace: core.getInput("namespace"),
    trustCA: core.getBooleanInput("trust-ca"),
  };

  if (auth.token) {
    core.setSecret(auth.token);
  }
  if (auth.password) {
    core.setSecret(auth.password);
  }

  const resolvedVersion = await resolveVersion(
    versionInput,
    auth.url,
    auth.trustCA,
    githubToken,
  );
  const toolPath = await installEpinio(resolvedVersion);
  core.addPath(toolPath);
  core.setOutput("version", resolvedVersion);
  core.info(`Epinio ${resolvedVersion} is available on PATH`);

  await authenticate(auth);
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
