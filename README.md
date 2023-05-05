# setup-hc-releases

GitHub Action to install `hc-releases`. Note that `v1` of this action is now deprecated, and `v2` must be used.

## Usage

```yaml
jobs:
  Release:
    runs-on: ubuntu-latest
    steps:
      # ... potentially other steps ...
      - uses: hashicorp/setup-hc-releases@v2
        with:
          github-token: ${{ secrets.HC_RELEASES_GITHUB_TOKEN }}
      # ... steps that require hc-releases ...
```

### Inputs

| Input              | Description                                               | Default                |
| ------------------ | --------------------------------------------------------- | ---------------------- |
| `github-token`     | GitHub token with release asset access to `hc-releases`.  |                        |
| `version`          | Version of `hc-releases` to install.                      | `v0.1.15`              |

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

The default version is set to avoid failed workflows if a broken `hc-releases` is published
but can be passed explicitly for testing.

### Supporting a new version of hc-releases

1. Clone this repo
1. Update the default release version of `hc-releases`
   * [README](https://github.com/hashicorp/setup-hc-releases/blob/main/README.md) chart
   * Input `version` in [action.yml](https://github.com/hashicorp/setup-hc-releases/blob/main/action.yml#L18)
1. Commit your changes, open a PR, get it reviewed, and merge to `main`.
1. Checkout the `main` branch and pull the latest changes.
1. Create a new tag for the release, e.g. `v2.0.1` with `git tag v2.0.1 && git push origin v2.0.1`.
1. Delete the major version tag, e.g. `git tag -d v2 && git push origin :refs/tags/v2`
1. Create a new major version tag, e.g. `git tag v2 && git push origin v2`
