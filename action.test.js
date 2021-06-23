const fs = require('fs');
const nock = require('nock');
const path = require('path');
const os = require('os');

const exec = require("@actions/exec");

const mockDataChecksum = '5663389ef1a8ec48af6ca622e66bf0f54ba8f22c127f14cb8a3f429e40868582';
const mockRelease = {
    assets: [
        {
            id: 1,
            name: "hc-releases_0.11.3_darwin_amd64.zip"
        },
        {
            id: 2,
            name: "hc-releases_0.11.3_linux_amd64.zip"
        },
        {
            id: 3,
            name: "hc-releases_0.11.3_windows_amd64.zip"
        },
    ],
    id: "1",
    name: "v0.11.3",
};
const token = 'testtoken'

beforeAll(() => {
    nock.disableNetConnect();
});

beforeEach(() => {
    process.env['INPUT_GITHUB-TOKEN'] = token;
    delete process.env['INPUT_VERSION'];
    process.env['INPUT_VERSION-CHECKSUM'] = mockDataChecksum;
    //process.env['RUNNER_DEBUG'] = true;

    const spyExecExec = jest.spyOn(exec, 'exec');
    spyExecExec.mockImplementation((commandLine, args, options) => {
        if (commandLine === 'hc-releases' && args.length === 1 && args[0] === 'version' && options !== undefined && options.listeners !== undefined) {
            options.listeners.stdout('hc-releases v0.11.3 ()');
        }

        Promise.resolve();
    });
    const spyOsArch = jest.spyOn(os, 'arch');
    spyOsArch.mockReturnValue('x64');
    const spyOsPlatform = jest.spyOn(os, 'platform');
    spyOsPlatform.mockReturnValue('linux');
});

describe('action', () => {
    test('installs default version', (done) => {
        const scope = nock('https://api.github.com')
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(200, mockRelease)
            .get('/repos/hashicorp/hc-releases/releases/assets/2')
            .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

        fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
            if (err) throw err;

            process.env['RUNNER_TEMP'] = directory;

            const action = require('./action');
            await expect(await action()).toEqual({ version: '0.11.3' });
            await expect(scope.isDone()).toBeTruthy();
            done()
        });
    });

    test('installs configured version', (done) => {
        const scope = nock('https://api.github.com')
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(200, mockRelease)
            .get('/repos/hashicorp/hc-releases/releases/assets/2')
            .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

        fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
            if (err) throw err;

            process.env['INPUT_VERSION'] = '0.11.3';
            process.env['RUNNER_TEMP'] = directory;

            const action = require('./action');
            await expect(await action()).toEqual({ version: '0.11.3' });
            await expect(scope.isDone()).toBeTruthy();
            done()
        });
    });

    test('retries transient errors', (done) => {
        const scope = nock('https://api.github.com')
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(500, 'expected transient error')
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(200, mockRelease)
            .get('/repos/hashicorp/hc-releases/releases/assets/2')
            .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

        fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
            if (err) throw err;

            process.env['RUNNER_TEMP'] = directory;

            const action = require('./action');
            await expect(await action()).toEqual({ version: '0.11.3' });
            await expect(scope.isDone()).toBeTruthy();
            done()
        });
    });

    test('retries abuse limit errors', (done) => {
        const scope = nock('https://api.github.com')
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(403, {
                message: "You have triggered an abuse detection mechanism and have been temporarily blocked from content creation. Please retry your request again later.",
                documentation_url: "https://docs.github.com/rest/overview/resources-in-the-rest-api#abuse-rate-limits"
            })
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(200, mockRelease)
            .get('/repos/hashicorp/hc-releases/releases/assets/2')
            .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

        fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
            if (err) throw err;

            process.env['RUNNER_TEMP'] = directory;

            const action = require('./action');
            await expect(await action()).toEqual({ version: '0.11.3' });
            await expect(scope.isDone()).toBeTruthy();
            done()
        });
    });

    test('retries rate limit errors', (done) => {
        const scope = nock('https://api.github.com')
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(429, 'expected rate limit error')
            .get('/repos/hashicorp/hc-releases/releases/tags/v0.11.3')
            .reply(200, mockRelease)
            .get('/repos/hashicorp/hc-releases/releases/assets/2')
            .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

        fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
            if (err) throw err;

            process.env['RUNNER_TEMP'] = directory;

            const action = require('./action');
            await expect(await action()).toEqual({ version: '0.11.3' });
            await expect(scope.isDone()).toBeTruthy();
            done()
        });
    });
});
