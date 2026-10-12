import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type AuthInputs = {
  url: string;
  token: string;
  user: string;
  password: string;
  namespace: string;
  trustCA: boolean;
};

/**
 * Path used for hand-written token settings. Prefer an existing EPINIO_SETTINGS
 * override; otherwise default to ~/.config/epinio/settings.yaml. Callers must
 * export this path via EPINIO_SETTINGS so the Epinio CLI finds it on
 * macOS/Windows too (those platforms use different defaults than Linux).
 */
export function settingsPath(): string {
  const override = process.env.EPINIO_SETTINGS;
  if (override) {
    return override;
  }
  return path.join(os.homedir(), ".config", "epinio", "settings.yaml");
}

/** Validate auth-related inputs. Returns whether authentication should run. */
export function shouldAuthenticate(input: AuthInputs): boolean {
  const hasToken = input.token.length > 0;
  const hasUserPass = input.user.length > 0 || input.password.length > 0;

  if (!hasToken && !hasUserPass) {
    if (input.namespace) {
      throw new Error("namespace requires authentication (token or user/password)");
    }
    return false;
  }

  if (!input.url) {
    throw new Error("url is required when authenticating");
  }
  if (hasToken && hasUserPass) {
    throw new Error("provide either token or user/password, not both");
  }
  if (hasUserPass && (!input.user || !input.password)) {
    throw new Error("user and password must both be set");
  }

  return true;
}

export function writeTokenSettings(url: string, token: string, namespace: string): string {
  const api = url.replace(/\/$/, "");
  const wss = api.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const lines = [
    `api: ${JSON.stringify(api)}`,
    `wss: ${JSON.stringify(wss)}`,
    `user: ""`,
    `pass: ""`,
    `colors: true`,
    `token:`,
    `  accesstoken: ${JSON.stringify(token)}`,
  ];
  if (namespace) {
    lines.push(`namespace: ${JSON.stringify(namespace)}`);
  }

  fs.writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
  return file;
}

export function buildLoginArgs(
  url: string,
  user: string,
  password: string,
  trustCA: boolean,
): string[] {
  const args = ["login", url, "--user", user, "--password", password];
  if (trustCA) {
    args.push("--trust-ca");
  }
  return args;
}
