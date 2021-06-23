const process = require('process');

const core = require('@actions/core');

const hcReleases = require('./hc-releases');
const jsToGo = require('./js-to-go');
const octokit = require('./octokit');

async function run() {
    try {
        const githubToken = core.getInput('github-token', { required: true });
        const configuredVersion = core.getInput('version');
        const configuredVersionChecksum = core.getInput('version-checksum');

        const client = await octokit(githubToken);
        const architecture = jsToGo.architecture();
        const operatingSystem = jsToGo.operatingSystem();
        const tempDirectory = process.env['RUNNER_TEMP'] || '';

        hcReleases.ensureSupportedGoPlatform(operatingSystem, architecture);

        let version = hcReleases.latestVersion;

        if (configuredVersion !== undefined && configuredVersion.length > 0) {
            version = configuredVersion;
        }

        const releaseAsset = await hcReleases.getReleaseAsset(client, version, operatingSystem, architecture);
        const downloadPath = await hcReleases.downloadReleaseAsset(client, releaseAsset, tempDirectory);

        let checksum = hcReleases.releaseAssetChecksum(version, operatingSystem, architecture);

        if (configuredVersionChecksum !== undefined && configuredVersionChecksum.length > 0) {
            checksum = configuredVersionChecksum;
        }

        await hcReleases.verifyReleaseAsset(client, downloadPath, checksum);

        const extractedPath = await hcReleases.extractReleaseAsset(client, downloadPath);
        core.addPath(extractedPath);
        const installedVersion = await hcReleases.versionNumber();

        const outputs = {
            version: installedVersion,
        };

        core.setOutput('version', outputs.version);

        return outputs;
    } catch (err) {
        core.setFailed(err.message);
        throw err;
    }
}

module.exports = run;
