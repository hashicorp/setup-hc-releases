const fs = require('fs');
const nock = require('nock');
const path = require('path');
const os = require('os');

const exec = require("@actions/exec");

const { latestVersion } = require('./hc-releases');
const configuredVersion = '0.1.2';

const mockDataChecksum = '5663389ef1a8ec48af6ca622e66bf0f54ba8f22c127f14cb8a3f429e40868582';
const mockReleaseVersion = {
  assets: [
    { id: 1, name: "hc-releases_"+configuredVersion+"_linux_amd64.zip" },
    { id: 2, name: "hc-releases_"+configuredVersion+"_darwin_amd64.zip" },
    { id: 3, name: "hc-releases_"+configuredVersion+"_darwin_arm64.zip" },
  ],
  id: "1",
  name: configuredVersion,
};
const mockRelease = {
  assets: [
    { id: 1, name: "hc-releases_"+latestVersion+"_linux_amd64.zip" },
    { id: 2, name: "hc-releases_"+latestVersion+"_darwin_amd64.zip" },
    { id: 3, name: "hc-releases_"+latestVersion+"_darwin_arm64.zip" },
  ],
  id: "1",
  name: latestVersion,
};
const token = 'testtoken'

beforeAll(() => {
  nock.disableNetConnect();
});

describe('action', () => {
  beforeEach(() => {
    process.env['INPUT_GITHUB-TOKEN'] = token;
    delete process.env['INPUT_VERSION'];
    process.env['INPUT_VERSION-CHECKSUM'] = mockDataChecksum;
    //process.env['RUNNER_DEBUG'] = true;

    const spyExecExec = jest.spyOn(exec, 'exec');
    spyExecExec.mockImplementation((commandLine, args, options) => {
      if (commandLine === 'hc-releases' && args.length === 1 && args[0] === 'version' && options !== undefined && options.listeners !== undefined) {
        options.listeners.stdout(latestVersion);
      }

      Promise.resolve();
    });
    const spyOsArch = jest.spyOn(os, 'arch');
    spyOsArch.mockReturnValue('x64');
    const spyOsPlatform = jest.spyOn(os, 'platform');
    spyOsPlatform.mockReturnValue('linux');
  });

  test('installs default version', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v'+latestVersion)
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/1')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: latestVersion });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });

  test('retries transient errors', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v'+latestVersion)
      .reply(500, 'expected transient error')
      .get('/repos/hashicorp/releases-api/releases/tags/v'+latestVersion)
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/1')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: latestVersion });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });

  test('retries secondary rate limit errors', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v'+latestVersion)
      .reply(403, {
        message: "You have exceeded a secondary rate limit and have been temporarily blocked from content creation. Please retry your request again later.",
        documentation_url: "https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits"
      })
      .get('/repos/hashicorp/releases-api/releases/tags/v'+latestVersion)
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/1')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: latestVersion });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });

  test('retries rate limit errors', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v'+latestVersion)
      .reply(429, 'expected rate limit error')
      .get('/repos/hashicorp/releases-api/releases/tags/v'+latestVersion)
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/1')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: latestVersion });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });
});

describe('action with configured version', () => {
  beforeEach(() => {
    process.env['INPUT_GITHUB-TOKEN'] = token;
    delete process.env['INPUT_VERSION'];
    process.env['INPUT_VERSION-CHECKSUM'] = mockDataChecksum;

    const spyExecExec = jest.spyOn(exec, 'exec');
    spyExecExec.mockImplementation((commandLine, args, options) => {
      if (commandLine === 'hc-releases' && args.length === 1 && args[0] === 'version' && options !== undefined && options.listeners !== undefined) {
        options.listeners.stdout(configuredVersion);
      }

      Promise.resolve();
    });
    const spyOsArch = jest.spyOn(os, 'arch');
    spyOsArch.mockReturnValue('x64');
    const spyOsPlatform = jest.spyOn(os, 'platform');
    spyOsPlatform.mockReturnValue('linux');
  });

  test('installs configured version', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v'+configuredVersion)
      .reply(200, mockReleaseVersion)
      .get('/repos/hashicorp/releases-api/releases/assets/1')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['INPUT_VERSION'] = configuredVersion;
      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: configuredVersion });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });
});
