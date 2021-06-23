const fs = require('fs');
const path = require('path');
// const stream = require('stream');
// const util = require('util');

// const pipeline = util.promisify(stream.pipeline);

async function downloadAsset(client, owner, repo, releaseAsset, directory) {
    client.log.info(`Downloading release asset: ${releaseAsset.name}`);

    try {
        const downloadPath = path.resolve(directory, releaseAsset.name);
        const file = fs.createWriteStream(downloadPath);
        const response = await client.rest.repos.getReleaseAsset({
            headers: {
                Accept: 'application/octet-stream',
            },
            owner: owner,
            repo: repo,
            asset_id: releaseAsset.id,
        });

        file.write(Buffer.from(response.data));
        file.end();

        return downloadPath;
    } catch (err) {
        client.log.error(`Unable to download release asset (${releaseAsset.name}): ${err}`);
        throw err;
    }
}

async function getByTag(client, owner, repo, tag) {
    client.log.info(`Getting release for tag: ${tag}`);

    try {
        const release = await client.rest.repos.getReleaseByTag({
            owner: owner,
            repo: repo,
            tag: tag
        });

        client.log.debug(`Found release: ${JSON.stringify(release)}`);

        return release.data;
    } catch (err) {
        client.log.error(`Unable to get release for tag (${tag}): ${err}`);
        throw err;
    }
}

exports.downloadAsset = downloadAsset;
exports.getByTag = getByTag;
