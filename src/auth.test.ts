import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  buildLoginArgs,
  shouldAuthenticate,
  writeTokenSettings,
  type AuthInputs,
} from "./auth";

function base(overrides: Partial<AuthInputs> = {}): AuthInputs {
  return {
    url: "",
    token: "",
    user: "",
    password: "",
    namespace: "",
    trustCA: false,
    ...overrides,
  };
}

describe("shouldAuthenticate", () => {
  it("skips when no credentials are provided", () => {
    assert.equal(shouldAuthenticate(base()), false);
  });

  it("requires auth when namespace is set without credentials", () => {
    assert.throws(
      () => shouldAuthenticate(base({ namespace: "workspace" })),
      /namespace requires authentication/,
    );
  });

  it("requires url when credentials are set", () => {
    assert.throws(
      () => shouldAuthenticate(base({ token: "t" })),
      /url is required/,
    );
  });

  it("rejects token combined with user/password", () => {
    assert.throws(
      () =>
        shouldAuthenticate(
          base({
            url: "https://epinio.example.com",
            token: "t",
            user: "u",
            password: "p",
          }),
        ),
      /either token or user\/password/,
    );
  });

  it("requires both user and password", () => {
    assert.throws(
      () =>
        shouldAuthenticate(
          base({ url: "https://epinio.example.com", user: "u" }),
        ),
      /user and password must both be set/,
    );
  });

  it("accepts token auth", () => {
    assert.equal(
      shouldAuthenticate(
        base({ url: "https://epinio.example.com", token: "t" }),
      ),
      true,
    );
  });

  it("accepts user/password auth", () => {
    assert.equal(
      shouldAuthenticate(
        base({
          url: "https://epinio.example.com",
          user: "u",
          password: "p",
        }),
      ),
      true,
    );
  });
});

describe("buildLoginArgs", () => {
  it("omits --trust-ca by default", () => {
    assert.deepEqual(
      buildLoginArgs("https://epinio.example.com", "u", "p", false),
      ["login", "https://epinio.example.com", "--user", "u", "--password", "p"],
    );
  });

  it("includes --trust-ca when enabled", () => {
    assert.deepEqual(
      buildLoginArgs("https://epinio.example.com", "u", "p", true),
      [
        "login",
        "https://epinio.example.com",
        "--user",
        "u",
        "--password",
        "p",
        "--trust-ca",
      ],
    );
  });
});

describe("writeTokenSettings", () => {
  const previous = process.env.EPINIO_SETTINGS;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.EPINIO_SETTINGS;
    } else {
      process.env.EPINIO_SETTINGS = previous;
    }
  });

  it("writes api, wss, token, and namespace", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-epinio-"));
    const file = path.join(dir, "settings.yaml");
    process.env.EPINIO_SETTINGS = file;

    const written = writeTokenSettings(
      "https://epinio.example.com/",
      "secret-token",
      "workspace",
    );
    const body = fs.readFileSync(written, "utf8");

    assert.match(body, /api: "https:\/\/epinio\.example\.com"/);
    assert.match(body, /wss: "wss:\/\/epinio\.example\.com"/);
    assert.match(body, /accesstoken: "secret-token"/);
    assert.match(body, /namespace: "workspace"/);
  });
});
