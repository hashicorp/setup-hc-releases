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
| `version`          | Version of `hc-releases` to install.                      | Latest release         |

### Outputs

| Output    | Description                         |
| --------- | ----------------------------------- |
| `version` | Version of `hc-releases` installed. |

## Token expiry alerts

The [Token Expiry Alerts workflow](.github/workflows/token-expiry-alert.yml)
checks `TOKEN_DOWNLOAD_RELAPI` daily at 02:30 UTC / 08:00 IST. It also supports
manual runs via `workflow_dispatch` once merged into the default branch.
The existing release-download behavior is unchanged.

Both credentials come directly from GitHub Actions secrets; no Vault access is
used. Ensure these repository or repository-accessible organization secrets exist:

- `TOKEN_DOWNLOAD_RELAPI`: the GitHub personal access token to monitor, already
  used by the testing workflow to download releases.
- `slack_token`: a Slack bot token with `chat:write` permission. Invite the bot to
  both destination channels.

Alert routing matches [hashicorp/github-release-sync#72](https://github.com/hashicorp/github-release-sync/pull/72):

- At 30 days or less remaining: notify `#feed-selfmanaged-releng-alerts`.
- At 7 days or less remaining: also notify `#team-selfmanaged-releng`, mentioning
  Gokul (`U09DES9DUGH`) and `@selfmanaged-releng-oncall` (`S09KC1UH2QL`).
- Expired tokens alert both channels. HTTP 401 alerts both channels as expired,
  revoked, or invalid, and fails the workflow.

The check authenticates to `https://api.github.com/user` and reads the
`GitHub-Authentication-Token-Expiration` response header. GitHub's secrets API
cannot retrieve stored secret values or their expiry; credentials are injected
using the Actions `secrets` context instead. If GitHub omits the expiry header,
the workflow emits a warning without guessing an expiry or sending an alert.
Confirm the token's expiry policy in GitHub in this case.

Each qualifying run sends new messages identifying the repository, secret, expiry,
and workflow run, never credential values. Missing configuration, malformed expiry
dates, API/network errors, and Slack delivery failures fail the workflow; monitor
failed runs as well as Slack. Requests time out after 30 seconds. Urgent delivery
is still attempted if feed delivery fails. Failed requests are not automatically
retried; investigate and rerun.

Dependency-free tests run in CI without credentials or live API calls. To run them
locally with Node.js 24:

```sh
node --test .github/scripts/github-token-expiry-alert.test.mjs
```

## Development

Test locally with [act](https://github.com/nektos/act).  You'll need a GitHub
token authorized to download release assets from the
[releases-api](https://github.com/hashicorp/releases-api) repository.

```bash
act --container-architecture=linux/amd64 --input github-token=$(gh auth token) workflow_dispatch
```

The default version is set to avoid failed workflows if a broken `hc-releases` is published
but can be passed explicitly for testing.

### Creating a Release

After your PR is merged to the default branch, `main`:
1. Update locally: `git checkout main && git pull`
1. Create a new tag for the release, e.g. `v2.0.1` with `git tag v2.0.1 && git push origin v2.0.1`.
1. Update the major version tag locally, e.g. `git tag -d v2 && git tag v2`
1. Update the tag upstream, e.g. `git push origin :refs/tags/v2 && git push origin v2`
