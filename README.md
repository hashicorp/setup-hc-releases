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
| `version`          | Version of `hc-releases` to install.                      | `0.1.15`               |
| `version-checksum` | Platform and version checksum of `hc-releases` to verify. | Automatic for `0.1.15` |

### Outputs

| Output    | Description                         |
| --------- | ----------------------------------- |
| `version` | Version of `hc-releases` installed. |

## Development

Install the dependencies

```bash
npm install
```

Run the tests :heavy_check_mark:

```bash
npm run test
```

For local debugging, you can also run a single test suite, e.g.:

```bash
npm test hc-releases.test.js
```

### Packaging for Distribution

Packaging assembles the code into one file (`dist/index.js`) that can be checked in to Git, enabling fast and reliable execution and preventing the need to check in `node_modules`.

Run prepare

```bash
npm run prepare
```

### Supporting a new version of hc-releases

1. Clone this repo
2. Run `npm install`
3. Update the [README](https://github.com/hashicorp/setup-hc-releases/blob/main/README.md) to reflect the new default of `hc-releases` version to install.
4. Update [the version](https://github.com/hashicorp/setup-hc-releases/blob/main/action.yml#L16) in `action.yml` to reflect the new default version of `hc-releases` to install.
5. Update [latestVersion](https://github.com/hashicorp/setup-hc-releases/blob/main/hc-releases.js#L137) in `hc-releases.js` to reflect the new version.
6. Download the [SHASUMS file](https://github.com/hashicorp/releases-api/releases) from the new version of `hc-releases`
7. Add a new object under `const checksums = {` in `hc-releases.js` with the checksums for the new version, e.g.

```
  '0.1.2': {
    'darwin': {
      'amd64': '8a68b234f6e737397ef08ad7836f07df194406049c35b649d7f34ac09e5996f5',
      'arm64': 'f3cb3f9a34f8bf8218240bb88d28b4ae3d2a0b58161fcece9e13d0af976fdb75',
    },
    'linux': {
      'amd64': '47a86cd0280a862c0025bad921a39e72c90e22923d1eae1f3bfca29ca989cc4e'
    },
  },
```

8. Run `npm run prepare`. This will update `dist/index.js` and `dist/index.js.map` with the new version's checksums.
9. Run tests locally to verify they are passing with `npm run test`. If they're failing, fix the tests.  **Note:** the live tests require a valid GITHUB_TOKEN set in your environment.
10. Commit your changes, open a PR, get it reviewed, and merge to `main`.
11. Checkout the `main` branch and pull down latest changes.
12. Create a new tag for the release, e.g. `v2.0.1` with `git tag v2.0.1 && git push origin v2.0.1`.
13. Delete the major version tag, e.g. `git tag -d v2 && git push origin :refs/tags/v2`
14. Create a new major version tag, e.g. `git tag v2 && git push origin v2`
