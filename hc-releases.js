/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

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
  '0.1.9': {
    'darwin': {
      'amd64': '46fba8de62fb62900e8f2ad3090fbb381c31a9d5864836d27d0317e6909cd191',
      'arm64': '752b73c8ac1a869741820a3e24c93640725bbc939c17e8c4717a8fca24947f3f',
    },
    'linux': {
      'amd64': '27afd6ef30fec98f99758295a033b6b2de1aba5f01732b164616ab12472633cc'
    },
  },
  '0.1.10': {
    'darwin': {
      'amd64': '5788ed5c1233164d319bfc4933308a9f081bd3ad38634486318ba42b08f778f0',
      'arm64': '4c352ba355623657312ec0f3febf90c529d74a4c05d043f7191bf8c5e9fe6fe2',
    },
    'linux': {
      'amd64': 'f02d79005b879c24fbd7608e0dbc0fa242f30a0f29c803d92405c6854557973e'
    },
  },
  '0.1.11': {
    'darwin': {
      'amd64': 'cb87a906481db4985e8fefe326303f53940aac9d1e900afd856d6e8e59e1ae7f',
      'arm64': '5af0d7bdc6683e1ac2dedf1a52d56d002d47b1c878652cd7a9f8c316f9d56b4e',
    },
    'linux': {
      'amd64': '90c90fa752d81fcdc96e06fb4101ed035a1bc5bad9eef04dda02d0084e5d19b5',
    },
  },
  '0.1.12': {
    'darwin': {
      'amd64': '1392739989f8a1d3246e062e784621c2ff10f92e5c8f3236289b6df785f1ee7a',
      'arm64': '6a452b2b0f10a70783b2bf8979aa73667df660949fb8179dbc981ec7a56fc599',
    },
    'linux': {
      'amd64': '594f7c943ea7241a29c6de33c98acac7e243dcee5aa68ca98a5bbaf80573760c',
    },
  },
  '0.1.13': {
    'darwin': {
      'amd64': '3a5ec41278282c98280269cfb197d95a5d3ae5e40af9ffe61f2337ca1b8b8e59',
      'arm64': '9f1005a219a3a17a97f7885419788c77fc5d0b867fc920b71877418a779d07bf',
    },
    'linux': {
      'amd64': '74c08e8181c3524ce13aabdaddf6503dd478cf54fb4d0e988ca22c6d94804951',
    },
  },
  '0.1.14': {
    'darwin': {
      'amd64': '7d07d3c9fd1f4c7cf30cf033ac3971beffb6a15c4edbfaedf2d0e8e87c911534',
      'arm64': 'd1304ca8bc6c40a69f4ebc1fcfbdc102ab8b57448123fb2b03585e681c092452',
    },
    'linux': {
      'amd64': 'dc786c5dcf985139a5bd325f6af633d617f4c74787ed215e2d9c590ab200c951',
    },
  },
  '0.1.15': {
    'darwin': {
      'amd64': 'c4ed0fcfc4e9eec4a1980b117a28bc9a5d44072789ffd16a34c3e67b4c1a26cd',
      'arm64': '9ac3237ef98000bfe6a606e883c28975b5cf059ac8a7074f6edf6a4bb363feb9',
    },
    'linux': {
      'amd64': '1fb1f421263447dc64947bccb6bfc741e3b58f920471417ad5d5a56472b935c0',
    },

  },
};

const executableName = 'hc-releases';
const gitHubRepositoryOwner = 'hashicorp';
const gitHubRepositoryRepo = 'releases-api';
// This should be set to the version of hc-releases
// we want to test with `npm run test`. Real API calls are made w/this version.
const latestVersion = '0.1.15';
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
exports.checksums = checksums;
