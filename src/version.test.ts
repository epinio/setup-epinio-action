import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertValidVersionInput,
  isPinnedSemver,
  releaseVersionFromServer,
  stripV,
  withV,
} from "./version";

describe("releaseVersionFromServer", () => {
  it("keeps a plain release version", () => {
    assert.equal(releaseVersionFromServer("v1.14.2"), "1.14.2");
  });

  it("drops the git describe suffix of dev builds", () => {
    assert.equal(releaseVersionFromServer("v1.14.2-9-g47d18eadd"), "1.14.2");
    assert.equal(releaseVersionFromServer("v1.14.2-9-g47d18eadd-dirty"), "1.14.2");
  });

  it("keeps pre-release tags", () => {
    assert.equal(releaseVersionFromServer("v1.15.0-rc1"), "1.15.0-rc1");
  });
});

describe("stripV / withV", () => {
  it("normalizes the v prefix", () => {
    assert.equal(stripV("v1.2.3"), "1.2.3");
    assert.equal(withV("1.2.3"), "v1.2.3");
    assert.equal(withV("v1.2.3"), "v1.2.3");
  });
});

describe("isPinnedSemver / assertValidVersionInput", () => {
  it("accepts latest, server, and pinned semver", () => {
    assert.equal(isPinnedSemver("1.14.2"), true);
    assert.equal(isPinnedSemver("v1.14.2"), true);
    assert.equal(isPinnedSemver("1.15.0-rc1"), true);
    assertValidVersionInput("latest");
    assertValidVersionInput("server");
    assertValidVersionInput("1.14.2");
    assertValidVersionInput("v1.14.2");
  });

  it("rejects unsafe or unknown values", () => {
    assert.equal(isPinnedSemver("latest"), false);
    assert.equal(isPinnedSemver("foo/../bar"), false);
    assert.equal(isPinnedSemver("1.14.2-9-g47d18eadd"), false);
    assert.throws(() => assertValidVersionInput("foo/../bar"), /Invalid version/);
    assert.throws(() => assertValidVersionInput("main"), /Invalid version/);
    assert.throws(() => assertValidVersionInput("1.14.2-9-g47d18eadd"), /Invalid version/);
    assert.throws(() => assertValidVersionInput(""), /version is empty/);
  });
});
