const crypto = require('crypto');
const fs = require('fs');
// const stream = require('stream');
// const util = require('util');

// const pipeline = util.promisify(stream.pipeline);

const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');

const githubRelease = require('./github-release');

const checksums = {
  '0.11.3': {
    'darwin': {
      'amd64': '9c5785b79790efdc665a90b84d8d3c8c5569748f1313d7508fd737fe3db1df89'
    },
    'linux': {
      'amd64': '9016ea5f12f267cb5109454e411bb5795d42224463e8e702f3ad0afb8d9b1f0f'
    },
    'windows': {
      'amd64': '9c90ea397bf6fe5a89b0f2f3334bdc0e8058e8d90e735e8e8266f209ddf994cd'
    }
  },
  '0.11.4': {
    'darwin': {
      'amd64': 'c8678408e8d5a2ac1c7e24fab29f74fd6e42d545b94fb7f2ed89e39cffbef15b'
    },
    'linux': {
      'amd64': '093fc7848fd8ae673a6359d7851fda991744d51e4b5ee317b327eb03c89df5c4'
    },
    'windows': {
      'amd64': '9f1a6292c431100966105b24fe411906fffe11207af3fd7ae4322231cce891f0'
    },
  },
    '0.11.5': {
      'darwin': {
        'amd64': '370536657975e4416da813a1ba5848d39648ddebfdc0b3bb05857d3cf4993015'
      },
      'linux': {
        'amd64': 'aef0b8590c861b08a637737af3bdf27b40fb687657c21ee489832994af834aef'
      },
      'windows': {
        'amd64': '6f754b8dec1433742f1769202283793c4057cfc60c04f2a03fc32bbb68291f69'
      }
  },
};
const executableName = 'hc-releases';
const gitHubRepositoryOwner = 'hashicorp';
const gitHubRepositoryRepo = 'hc-releases';
const latestVersion = '0.11.4';
const supportedGoPlatforms = {
  'darwin': ['amd64'],
  'linux': ['amd64'],
  'windows': ['amd64']
};

function ensureSupportedGoPlatform(goOperatingSystem, goArchitecture) {
  const supportedGoOperatingSystem = supportedGoPlatforms[goOperatingSystem];

  if (supportedGoOperatingSystem === undefined) {
    throw new Error(`unsupported OS: ${goOperatingSystem}`);
  }

  if (!supportedGoOperatingSystem.includes(goArchitecture)) {
    throw new Error(`unsupported OS (${goOperatingSystem}) architecture: ${goArchitecture}`);
  }
}

function releaseAssetChecksum(version, goOperatingSystem, goArchitecture) {
  if (checksums[version] === undefined || checksums[version][goOperatingSystem] === undefined) {
    return undefined;
  }

  return checksums[version][goOperatingSystem][goArchitecture];
}

async function downloadReleaseAsset(client, releaseAsset, directory) {
  return await githubRelease.downloadAsset(client, gitHubRepositoryOwner, gitHubRepositoryRepo, releaseAsset, directory);
}

async function extractReleaseAsset(client, downloadPath) {
  client.log.info(`Extracting release asset: ${downloadPath}`);

  try {
    return await tc.extractZip(downloadPath);
  } catch (err) {
    client.log.error(`Unable to extract release asset (${downloadPath}): ${err}`);
    throw err;
  }
}

async function fileSHA256(path) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const file = fs.createReadStream(path);
    file.on('error', err => reject(err));
    file.on('data', (data) => hash.update(data));
    file.on('end', () => resolve(hash.digest('hex')));
  })
}

async function getReleaseAsset(client, version, goOperatingSystem, goArchitecture) {
  const release = await githubRelease.getByTag(client, gitHubRepositoryOwner, gitHubRepositoryRepo, `v${version}`);
  const assetName = `${executableName}_${version}_${goOperatingSystem}_${goArchitecture}.zip`;
  const asset = release.assets.find((asset) => asset.name === assetName);

  if (asset === undefined) {
    throw new Error(`Release asset not found in release: ${assetName}`);
  }

  return asset;
}

async function verifyReleaseAsset(client, downloadPath, checksum) {
  if (checksum === undefined) {
    client.log.warn(`Automatic checksum unknown and not configured in workflow, skipping checksum verification`);
    return Promise.resolve();
  }

  client.log.info(`Verifying release asset (${downloadPath}) with checksum: ${checksum}`);

  try {
    const downloadChecksum = await fileSHA256(downloadPath);

    client.log.debug(`Calculated checksum: ${downloadChecksum}`);

    if (downloadChecksum !== checksum) {
      throw new Error(`checksum mismatch (got: ${downloadChecksum}, expected: ${checksum})`);
    }
  } catch (err) {
    client.log.error(`Unable to verify release asset (${downloadPath}): ${err}`);
    throw err;
  }
}

async function version() {
  let stderr = '';
  let stdout = '';

  const execOptions = {
    listeners: {
      stderr: (data) => {
        stderr += data.toString();
      },
      stdout: (data) => {
        stdout += data.toString();
      }
    }
  };

  try {
    await exec.exec(executableName, ['version'], execOptions);
  } catch (err) {
    throw new Error(`error executing ${executableName}: ${err}`);
  }

  return {
    stderr: stderr,
    stdout: stdout
  };
}

async function versionNumber() {
  const { stderr, stdout } = await version();

  if (stderr.length > 0) {
    throw new Error(`error executing ${executableName} version: ${stderr}`);
  }

  // Expected output: hc-releases v#.#.# ()
  if (stdout.length === 0 || stdout.split(' ').length !== 3) {
    throw new Error(`unexpected ${executableName} version output: ${stdout}`);
  }

  return stdout.split(' ')[1].substring(1)
}

exports.ensureSupportedGoPlatform = ensureSupportedGoPlatform;
exports.downloadReleaseAsset = downloadReleaseAsset;
exports.extractReleaseAsset = extractReleaseAsset;
exports.getReleaseAsset = getReleaseAsset;
exports.latestVersion = latestVersion;
exports.releaseAssetChecksum = releaseAssetChecksum;
exports.verifyReleaseAsset = verifyReleaseAsset;
exports.version = version;
exports.versionNumber = versionNumber;
