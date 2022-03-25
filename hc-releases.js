const crypto = require('crypto');
const fs = require('fs');
// const stream = require('stream');
// const util = require('util');

// const pipeline = util.promisify(stream.pipeline);

const exec = require('@actions/exec');
const tc = require('@actions/tool-cache');

const githubRelease = require('./github-release');

const checksums = {
  '0.0.8': {
    'darwin': {
      'amd64': '45013e04fa430f67390a746ec3492842127a719510f382e2fbe658899c94e93a'
    },
    'darwin': {
      'arm64': '1a9682d27f691f45fc2261c66758ef60e4726e2297df19f483ca632db46f1af6'
    },
    'linux': {
      'amd64': '77337ad7ac48ea71252e5205eab208342731ff596ce8f8b8029c0202c4186feb'
    },
    // 'windows': {
    //   'amd64': '3e7f3e12bb7fc0fadb62e75187eff70c36dfb70b50e29e8b78dbdd78a2ad90ce'
    // }
  },
};
const executableName = 'hc-releases';
const gitHubRepositoryOwner = 'hashicorp';
const gitHubRepositoryRepo = 'releases-api';
const latestVersion = '0.0.8';
const supportedGoPlatforms = {
  'darwin': ['amd64'],
  'darwin': ['arm64'],
  'linux': ['amd64'],
  // 'windows': ['amd64']
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
