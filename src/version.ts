export function stripV(version: string): string {
  return version.replace(/^v/i, "");
}

export function withV(version: string): string {
  const normalized = stripV(version);
  return normalized ? `v${normalized}` : version;
}

/**
 * Map a server-reported version to a release version. Servers built from git
 * report `git describe` output (e.g. "v1.14.2-9-g47d18eadd"); the matching
 * release is the base tag.
 */
export function releaseVersionFromServer(reported: string): string {
  return stripV(reported.trim()).replace(/-\d+-g[0-9a-f]+(-dirty)?$/i, "");
}
