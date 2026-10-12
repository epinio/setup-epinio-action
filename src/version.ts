export function stripV(version: string): string {
  return version.replace(/^v/i, "");
}

export function withV(version: string): string {
  const normalized = stripV(version);
  return normalized ? `v${normalized}` : version;
}

/** True for a concrete release like 1.14.2 / v1.14.2 (optional pre-release suffix). */
export function isPinnedSemver(version: string): boolean {
  const v = version.trim();
  // Reject git-describe strings (e.g. 1.14.2-9-g47d18eadd); those are not release tags.
  if (/-\d+-g[0-9a-f]+/i.test(stripV(v))) {
    return false;
  }
  return /^v?\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/i.test(v);
}

/**
 * Accept only latest, server, or a pinned semver. Rejects path traversal and
 * other unsafe values that could be interpolated into download URLs.
 */
export function assertValidVersionInput(version: string): void {
  const requested = version.trim();
  if (!requested) {
    throw new Error('version is empty; use "latest", "server", or a semver like 1.14.2');
  }
  if (requested === "latest" || requested === "server") {
    return;
  }
  if (isPinnedSemver(requested)) {
    return;
  }
  throw new Error(
    `Invalid version "${version}". Use "latest", "server", or a semver like 1.14.2 / v1.14.2`,
  );
}

/**
 * Map a server-reported version to a release version. Servers built from git
 * report `git describe` output (e.g. "v1.14.2-9-g47d18eadd"); the matching
 * release is the base tag.
 */
export function releaseVersionFromServer(reported: string): string {
  return stripV(reported.trim()).replace(/-\d+-g[0-9a-f]+(-dirty)?$/i, "");
}
