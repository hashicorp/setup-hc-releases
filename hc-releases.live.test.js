/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { Octokit } = require("@octokit/rest");
const core = require('@actions/core');

const jsToGo = require('./js-to-go');
const hcReleases = require('./hc-releases');

describe('install live tool', () => {
  removeTempdir = false;
  directory = "";

  beforeAll(() => { // setup tempdir
    removeTempdir = false;
    if (typeof process.env['RUNNER_TEMP'] === 'undefined') {
      // RUNNER_TEMP is usually unset for local test runs.
      // But the extractor assumes it's set.
      process.env['RUNNER_TEMP'] = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-hc-releases-'));
      removeTempdir = true; // made our own tempdir, so remove it when we're done
    }

    directory = process.env['RUNNER_TEMP']
  });

  afterAll(() => { // cleanup tempdir
    if (removeTempdir) {
      console.log(`Removing tempdir we created: ${directory}`);
      fs.rmSync(directory, { recursive: true });
    }
  });

  test.each([
    ['darwin', 'amd64'],
    ['darwin', 'arm64'],
    ['linux', 'amd64']
  ])('%s/%s', async (goOperatingSystem, goArchitecture) => {
    try {
      // Support core.getInput for CI runs
      // Also GITHUB_TOKEN which is simpler for local runs and overrides the input-format variable.
      if (typeof process.env['GITHUB_TOKEN'] !== 'undefined') {
        process.env['INPUT_GITHUB-TOKEN'] = process.env['GITHUB_TOKEN'];
      }
      const githubToken = core.getInput('github-token');
      if (githubToken == '') {
        throw 'No auth token set; consider setting GITHUB_TOKEN.';
      }

      const version = hcReleases.latestVersion;

      // Ensure an expected checksum is defined before fetching the metadata or asset.
      const checksum = hcReleases.releaseAssetChecksum(version, goOperatingSystem, goArchitecture);
      if (typeof checksum === 'undefined') {
        throw `No checksum known for v${version} on ${goOperatingSystem} / ${goArchitecture}`;
      }

      const client = new Octokit({
        auth: githubToken,
        log: console,
      });

      const releaseAsset = await hcReleases.getReleaseAsset(client, version, goOperatingSystem, goArchitecture);

      const downloadPath = await hcReleases.downloadReleaseAsset(client, releaseAsset, directory);
      await hcReleases.verifyReleaseAsset(client, downloadPath, checksum);
      const binPath = await hcReleases.extractReleaseAsset(client, downloadPath);

      // If the current os/arch matches the runner, go ahead and verify that the
      // binary runs and reports the version we expect.
      if (jsToGo.architecture() == goArchitecture && jsToGo.operatingSystem() == goOperatingSystem) {
        core.addPath(binPath);
        const installedVersion = await hcReleases.versionNumber();
        client.log.debug(`installed version ${installedVersion}`);
      }
    } catch (err) {
      // Retain tempdir for inspection after failures
      removeTempdir = false;
      throw err;
    }
  });
});
