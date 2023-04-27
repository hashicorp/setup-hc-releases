# setup-hc-releases

GitHub Action to install `hc-releases`. Note that `v1` and `v2` are deprecated.
As of `hc-releases` version `0.1.15`, `v3` of this action must be used.

## Usage

```yaml
jobs:
  Release:
    runs-on: ubuntu-latest
    steps:
      # ... potentially other steps ...
      - uses: hashicorp/setup-hc-releases@v3
        with:
          github-token: ${{ secrets.HC_RELEASES_GITHUB_TOKEN }}
      # ... steps that require hc-releases ...
```

### Inputs

| Input           | Description                                               | Default                |
| --------------- | --------------------------------------------------------- | ---------------------- |
| `github-token`  | GitHub token with release asset access to `hc-releases`.  |                        |
| `tag`           | Version of `hc-releases` to install.                      | `v0.1.15`              |

### Outputs

| Output    | Description                         |
| --------- | ----------------------------------- |
| `version` | Version of `hc-releases` installed. |

## Development

Test locally with [act](https://github.com/nektos/act).  You'll need a GitHub
token authorized to download release assets from the
[releases-api](https://github.com/hashicorp/releases-api) repository.

```bash
act --container-architecture=linux/amd64 --input github-token=$(gh auth token) workflow_dispatch
```

Removing the default tag value or explicitly passing an empty string lets the
action select the latest release automatically.  The default is set to avoid
failed workflows if a broken `hc-releases` is published.

```bash
act --container-architecture=linux/amd64 --input github-token=$(gh auth token) --input tag= workflow_dispatch
```

### Supporting a new version of hc-releases

1. Clone this repo
1. Update the default release tag of `hc-releases`
   * [README](https://github.com/hashicorp/setup-hc-releases/blob/main/README.md) chart
   * Input `tag` in [action.yml](https://github.com/hashicorp/setup-hc-releases/blob/main/action.yml#L18)
1. Commit your changes, open a PR, get it reviewed, and merge to `main`.
1. Checkout the `main` branch and pull down latest changes.
1. Create a new tag for the release, e.g. `v3.0.1` with `git tag v3.0.1 && git push origin v3.0.1`.
1. Delete the major version tag, e.g. `git tag -d v3 && git push origin :refs/tags/v3`
1. Create a new major version tag, e.g. `git tag v3 && git push origin v3`
