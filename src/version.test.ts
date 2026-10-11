import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { releaseVersionFromServer, stripV, withV } from "./version";

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
