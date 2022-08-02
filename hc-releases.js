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
      'amd64': 'f13698cbd41e6654f66f34e8ebda6f6c25e9111753fb5d4b265cb96408344c87',
      'arm64': '49514b124e31e33d6486744a1bc4db6b07a1e1548db4255ab53c45eda1ef4654',
    },
    'linux': {
      'amd64': 'cac17910788aea9451fd6f9d093217f97c1f8c1fbe9607d7953bcebb70763d10'
    },
  },
  '0.1.2': {
    'darwin': {
      'amd64': '8a68b234f6e737397ef08ad7836f07df194406049c35b649d7f34ac09e5996f5',
      'arm64': 'f3cb3f9a34f8bf8218240bb88d28b4ae3d2a0b58161fcece9e13d0af976fdb75',
    },
    'linux': {
      'amd64': '47a86cd0280a862c0025bad921a39e72c90e22923d1eae1f3bfca29ca989cc4e'
    },
  },
  '0.1.3': {
    'darwin': {
      'amd64': 'f2e0a367c35f0c0002e7d1053419fff43a15fd757e2e2c5ef6f30822f12c9da7',
      'arm64': '6d9e975036a760171f19f23123e69bda3f51994986073f4aac88b9c49c7c1a51',
    },
    'linux': {
      'amd64': '7cdb6cccffa9026363c285a3f0bc05741da4a7e14e5f00aca2a0eab2f9057120'
    },
  },
  '0.1.4': {
    'darwin': {
      'amd64': '423445e61b03fa40c32d7e0dc5b441fc42a9e1bf0974f4a8d0240f3cfa9c515e',
      'arm64': '87ef72eb569c5864048e18bf92a30f4c7ad5cbda4190590689a6d80f61c9d582',
    },
    'linux': {
      'amd64': '3a89ddbef3bf035ccc0ef86528d92de8e6b4f1cec4665c75de005d7b356fe0e3'
    },
  },
  '0.1.5': {
    'darwin': {
      'amd64': '9d509ec2d7e9c6725b48c580fd1ef76723e45dbf0d46f8a7c4cc51b0d6e0f75f',
      'arm64': 'bdd9a5aac7ec83f3453bf47b253ac5322a78d2c52ebe5b26dfa5c90874c39ead',
    },
    'linux': {
      'amd64': '93d454d6d1242ea246646a3a6ee3a17290c289f70cc9d2b5d5b184672a91541e'
    },
  },
  '0.1.6': {
    'darwin': {
      'amd64': '6d6f15957672e15748556c35a2691b9ec1d4334f1a165536ae8e07eba8df3484',
      'arm64': 'a6599649034b0b0df678e4438d4b9e15c3a13560a9ad27a16533d2b6c8a301ed',
    },
    'linux': {
      'amd64': 'f1fba489b110fc2ff4c9809bc5737744b844be8a6e7f08bc1f33e9117bec3d77'
    },
  },
  '0.1.8': {
    'darwin': {
      'amd64': '35237eb76b595927f0d46fb68397a1b77585f0d351643f7eb0795de33d0ce54f',
      'arm64': '8e2a9b9b58b19b65f0a6eacc853beba0935f3581c118558938f4e5afad0fc141',
    },
    'linux': {
      'amd64': '3813b972634a8e63965db68ffcade9061bc15d5c21731445b1be29b73faaef8d'
    },
  },
};
const executableName = 'hc-releases';
const gitHubRepositoryOwner = 'hashicorp';
const gitHubRepositoryRepo = 'releases-api';
// This should be set to the version of hc-releases
// we want to test with `npm run test`. Real API calls are made w/this version.
const latestVersion = '0.1.2';
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
