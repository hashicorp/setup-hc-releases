const fs = require('fs');
const nock = require('nock');
const path = require('path');
const os = require('os');

const exec = require("@actions/exec");

const mockDataChecksum = '7c4196db1ef6c9fd6e4f6a019f9fc023f668c94d29219db6ad8eff0e2bd8c045';
const mockRelease = {
  assets: [
    {
      id: 1,
      name: "hc-releases_0.0.8_linux_amd64.zip"
    },
    {
      id: 2,
      name: "hc-releases_0.0.8_darwin_amd64.zip"
    },
    {
      id: 3,
      name: "hc-releases_0.0.8_darwin_arm64.zip"
    },
    // {
    //   id: 3,
    //   name: "hc-releases_0.11.4_windows_amd64.zip"
    // },
  ],
  id: "1",
  name: "v0.0.8",
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
      options.listeners.stdout('hc-releases v0.0.8 ()');
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
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/2')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: '0.0.8' });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });

  test('installs configured version', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/2')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['INPUT_VERSION'] = '0.0.8';
      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: '0.0.8' });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });

  test('retries transient errors', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(500, 'expected transient error')
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/2')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: '0.0.8' });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });

  test('retries secondary rate limit errors', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(403, {
        message: "You have exceeded a secondary rate limit and have been temporarily blocked from content creation. Please retry your request again later.",
        documentation_url: "https://docs.github.com/rest/overview/resources-in-the-rest-api#secondary-rate-limits"
      })
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/2')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: '0.0.8' });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });

  test('retries rate limit errors', (done) => {
    const scope = nock('https://api.github.com')
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(429, 'expected rate limit error')
      .get('/repos/hashicorp/releases-api/releases/tags/v0.0.8')
      .reply(200, mockRelease)
      .get('/repos/hashicorp/releases-api/releases/assets/2')
      .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      process.env['RUNNER_TEMP'] = directory;

      const action = require('./action');
      await expect(await action()).toEqual({ version: '0.0.8' });
      await expect(scope.isDone()).toBeTruthy();
      done()
    });
  });
});
