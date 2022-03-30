const crypto = require('crypto');
const fs = require('fs');
// const stream = require('stream');
// const util = require('util');

// const pipeline = util.promisify(stream.pipeline);

const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');

const githubRelease = require('./github-release');

const checksums = {
  '0.1.0': {
    'darwin': {
      'amd64': 'c5f8f63c90547831e80a487b8004cdf6b781591e513a6337c9ca3d029ddc80fc',
      'arm64': '71c453fc263d906200a13dd478c4efa7ba7c254f906f7707c5f14988b709ef18',
    },
    'linux': {
      'amd64': 'e0c903383f084b77bf4ce923d343464307fcce75fc73de01e0f75b4f963f2add'
    },
  },
};
const executableName = 'hc-releases';
const gitHubRepositoryOwner = 'hashicorp';
const gitHubRepositoryRepo = 'releases-api';
const latestVersion = '0.1.0';
const supportedGoPlatforms = {
  'darwin': ['amd64', 'arm64'],
  'linux': ['amd64']
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

  // v1 Expected output: hc-releases v#.#.# ()
  // v2 Expected output: #.#.#
  if (stdout.length === 0 || stdout.split('.').length !== 3) {
    throw new Error(`unexpected ${executableName} version output: ${stdout}`);
  }

  return stdout.toString();
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
