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
| `version`          | Version of `hc-releases` to install.                      | `0.1.0`               |
| `version-checksum` | Platform and version checksum of `hc-releases` to verify. | Automatic for `0.1.0` |

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
