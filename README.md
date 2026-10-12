# setup-epinio-action

GitHub Action that installs the [Epinio](https://epinio.io) CLI, caches it, adds it to `PATH`, and optionally logs in.

## Usage

```yaml
name: Deploy with Epinio
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Setup Epinio
        id: epinio
        uses: epinio/setup-epinio-action@v1
        with:
          version: latest
          url: ${{ secrets.EPINIO_URL }}
          # Prefer token auth in CI (password is not passed on the CLI)
          token: ${{ secrets.EPINIO_TOKEN }}
          namespace: workspace
          # github-token defaults to ${{ github.token }} (needed for version: latest)

      - run: epinio app list
```

### Pin a CLI version

Pinned semver installs **without** a GitHub API call (download URL is built directly):

```yaml
- uses: epinio/setup-epinio-action@v1
  with:
    version: "1.14.2"
```

### Match the server version

```yaml
- uses: epinio/setup-epinio-action@v1
  with:
    version: server
    url: ${{ secrets.EPINIO_URL }}
```

### User / password login

Token auth is recommended in CI. If you must use user/password:

```yaml
- uses: epinio/setup-epinio-action@v1
  with:
    url: ${{ secrets.EPINIO_URL }}
    user: ${{ secrets.EPINIO_USER }}
    password: ${{ secrets.EPINIO_PASSWORD }}
    namespace: workspace
    # Required for self-signed / private CA (user/password login only)
    trust-ca: true
```

## Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `version` | no | `latest` | `latest`, pinned semver (`1.14.2` / `v1.14.2`), or `server` |
| `url` | no | | Epinio API URL (login and/or `version: server`) |
| `token` | no | | Bearer access token (**preferred** over user/password in CI) |
| `user` | no | | Username (requires `password` + `url`) |
| `password` | no | | Password (requires `user` + `url`) |
| `namespace` | no | | Namespace to target after authentication |
| `trust-ca` | no | `false` | Pass `--trust-ca` on **user/password** login only |
| `github-token` | no | `${{ github.token }}` | Used when resolving `version: latest` via the GitHub API |

## Outputs

| Name | Description |
| --- | --- |
| `version` | Resolved CLI version installed (no leading `v`) |

## Authentication notes

- **Prefer `token`** in CI. Epinio login only accepts a password via `--password`, so user/password auth puts the secret on the process command line. Token auth writes settings and avoids that.
- **`trust-ca` applies only to user/password login** (`epinio login --trust-ca`). Token auth writes `settings.yaml` directly and does not use that flag.
- Token settings are written to a file and `EPINIO_SETTINGS` is exported so the Epinio CLI finds them on Linux, macOS, and Windows.

## Versioning

```yaml
uses: epinio/setup-epinio-action@v1
```

Maintainers: after publishing a release tag such as `v1.0.0`, move `v1` to that commit.
