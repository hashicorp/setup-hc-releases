# setup-hc-releases

GitHub Action to install `hc-releases`.

## Usage

```yaml
jobs:
  Release:
    runs-on: ubuntu-latest
    steps:
      # ... potentially other steps ...
      - uses: hashicorp/setup-hc-releases@v1
        with:
          github-token: ${{ secrets.HC_RELEASES_GITHUB_TOKEN }}
      # ... steps that require hc-releases ...
```

### Inputs

| Input              | Description                                               | Default                |
| ------------------ | --------------------------------------------------------- | ---------------------- |
| `github-token`     | GitHub token with release asset access to `hc-releases`.  |                        |
| `version`          | Version of `hc-releases` to install.                      | `0.11.3`               |
| `version-checksum` | Platform and version checksum of `hc-releases` to verify. | Automatic for `0.11.3` |

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

### Packaging for Distribution

Packaging assembles the code into one file (`dist/index.js`) that can be checked in to Git, enabling fast and reliable execution and preventing the need to check in `node_modules`.

Run prepare

```bash
npm run prepare
```
