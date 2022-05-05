const crypto = require('crypto');
const fs = require('fs');
const nock = require('nock');
const os = require('os');
const path = require('path');

const exec = require("@actions/exec");
const tc = require("@actions/tool-cache");
const { Octokit } = require("@octokit/rest");

const hcReleases = require('./hc-releases');

const client = new Octokit({
  auth: 'testtoken',
  log: console,
});

beforeAll(() => {
  nock.disableNetConnect();
});

describe('download release asset', () => {
  test('downloads successfully', async () => {
    const releaseAsset = {
      id: 1,
      name: "hc-releases_0.1.0_linux_amd64.zip",
    };

    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      const expectedPath = path.resolve(directory, releaseAsset.name);

      nock('https://api.github.com')
        .get('/repos/hashicorp/releases-api/releases/assets/1')
        .replyWithFile(200, path.resolve(__dirname, 'test.zip'), { 'content-type': 'application/octet-stream' });

      const downloadPath = await hcReleases.downloadReleaseAsset(client, releaseAsset, directory);

      await expect(downloadPath).toEqual(expectedPath);

      fs.readFile(downloadPath, null, async (err, data) => {
        if (err) throw err;

        await expect(data).toEqual(fs.readFileSync(path.resolve(__dirname, 'test.zip')));
      });
    });
  });

  test('throws error', async () => {
    const releaseAsset = {
      id: 1,
      name: "hc-releases_0.1.0_linux_amd64.zip",
    };
    fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
      if (err) throw err;

      nock('https://api.github.com')
        .get(`/repos/hashicorp/releases-api/releases/assets/1`)
        .reply(404, 'Not Found');

      const hcReleases = require('./hc-releases')

      await expect(hcReleases.downloadReleaseAsset(client, releaseAsset, directory)).rejects.toThrow('Not Found');
    });
  });
});

describe('ensure supported go platform', () => {
  test.each([
    ['darwin', 'amd64'],
    ['darwin', 'arm64'],
    ['linux', 'amd64']
  ])('%s/%s', (goOperatingSystem, goArchitecture) => {
    expect(hcReleases.ensureSupportedGoPlatform(goOperatingSystem, goArchitecture)).resolves;
  })

  test('throws operating system error', () => {
    expect(() => hcReleases.ensureSupportedGoPlatform('unknown', 'amd64')).toThrow('unsupported OS: unknown');
  });

  test('throws architecture system error', () => {
    expect(() => hcReleases.ensureSupportedGoPlatform('darwin', '386')).toThrow('unsupported OS (darwin) architecture: 386');
  });
});

describe('extract release asset', () => {
  test('successful', async () => {
    const spy = jest.spyOn(tc, 'extractZip');
    spy.mockReturnValue('/tmp/test');

    const result = await hcReleases.extractReleaseAsset(client, '/tmp/test/test_v1.0.0_linux_amd64.zip');

    await expect(spy).toHaveBeenCalled();
    await expect(result).toEqual('/tmp/test');
  });

  test('throws error', async () => {
    const spy = jest.spyOn(tc, 'extractZip');
    spy.mockRejectedValue(new Error('executable not found: zip'))

    await expect(hcReleases.extractReleaseAsset(client, '/tmp/test/test_v1.0.0_linux_amd64.zip')).rejects.toThrow('executable not found');
    await expect(spy).toHaveBeenCalled();
  });
});

describe('get release asset', () => {
  test.each([
    ['linux', 'amd64'],
    ['darwin', 'amd64'],
    ['darwin', 'arm64']
  ])('%s/%s', async (goOperatingSystem, goArchitecture) => {
    const mockRelease = {
      assets: [
        {
          id: 1,
          name: "hc-releases_0.1.0_linux_amd64.zip"
        },
        {
          id: 2,
          name: "hc-releases_0.1.0_darwin_amd64.zip"
        },
        {
          id: 3,
          name: "hc-releases_0.1.0_darwin_arm64.zip"
        },
      ],
      id: "1",
      name: "v0.1.0",
    };

    nock('https://api.github.com')
      .get(`/repos/hashicorp/releases-api/releases/tags/v0.1.0`)
      .reply(200, mockRelease);

    const releaseAsset = await hcReleases.getReleaseAsset(client, '0.1.0', goOperatingSystem, goArchitecture);

    await expect(releaseAsset).toEqual(mockRelease.assets.find((asset) => asset.name.includes(goOperatingSystem) && asset.name.includes(goArchitecture)));
  })

  test('throws release asset not found error', async () => {
    const mockRelease = {
      assets: [
        {
          id: 1,
          name: "hc-releases_0.1.0_linux_amd64.zip"
        },
        {
          id: 2,
          name: "hc-releases_0.1.0_darwin_amd64.zip"
        },
        {
          id: 3,
          name: "hc-releases_0.1.0_darwin_arm64.zip"
        },
      ],
      id: "1",
      name: "v0.1.0",
    };

    nock('https://api.github.com')
      .get(`/repos/hashicorp/releases-api/releases/tags/v0.1.0`)
      .reply(200, mockRelease);

    await expect(hcReleases.getReleaseAsset(client, '0.1.0', 'darwin', '386')).rejects.toThrow('Release asset not found in release');
  });

  test('throws release not found error', async () => {
    nock('https://api.github.com')
      .get(`/repos/hashicorp/releases-api/releases/tags/v0.1.0`)
      .reply(404, 'Not Found');

    await expect(hcReleases.getReleaseAsset(client, '0.1.0', 'linux', 'amd64')).rejects.toThrow('Not Found');
  });
});

describe('release asset checksum', () => {
  test.each([
    ['0.1.0', 'unknown', 'amd64', undefined],
    ['0.1.0', 'darwin', '386', undefined],
    ['0.1.0', 'darwin', 'arm64', '49514b124e31e33d6486744a1bc4db6b07a1e1548db4255ab53c45eda1ef4654'],
    ['0.1.0', 'darwin', 'amd64', 'f13698cbd41e6654f66f34e8ebda6f6c25e9111753fb5d4b265cb96408344c87'],
    ['0.1.0', 'linux', 'amd64', 'cac17910788aea9451fd6f9d093217f97c1f8c1fbe9607d7953bcebb70763d10'],
    ['0.1.0', 'windows', 'amd64', undefined],
  ])('%s %s/%s', (version, goOperatingSystem, goArchitecture, expected) => {
    const result = hcReleases.releaseAssetChecksum(version, goOperatingSystem, goArchitecture)
    expect(result).toEqual(expected);
  })
});

describe('verify release asset', () => {
  test('successful', async () => {
    const spyCreateHash = jest.spyOn(crypto, 'createHash');
    spyCreateHash.mockImplementation(() => {
      return {
        digest: function() { return 'abc123' },
        setEncoding: function() { },
        read: function() { },
        update: function() { },
      };
    });
    const spyCreateReadStream = jest.spyOn(fs, 'createReadStream');
    spyCreateReadStream.mockImplementation(() => {
      return {
        on: jest.fn().mockImplementation(function(event, handler) {
          if (event === 'end') {
            handler();
          }
          return;
        }),
      }
    });

    await expect(hcReleases.verifyReleaseAsset(client, '/tmp/test/test_v1.0.0_linux_amd64.zip', 'abc123')).resolve;
    await expect(spyCreateHash).toHaveBeenCalled();
    await expect(spyCreateReadStream).toHaveBeenCalled();
  });

  test('no checksum', async () => {
    await expect(hcReleases.verifyReleaseAsset(client, '/tmp/test/test_v1.0.0_linux_amd64.zip', undefined)).resolve;
  });

  test('throws checksum mismatch error', async () => {
    const spyCreateHash = jest.spyOn(crypto, 'createHash');
    spyCreateHash.mockImplementation(() => {
      return {
        digest: function() { return 'abc123' },
        setEncoding: function() { },
        read: function() { },
        update: function() { },
      };
    });
    const spyCreateReadStream = jest.spyOn(fs, 'createReadStream');
    spyCreateReadStream.mockImplementation(() => {
      return {
        on: jest.fn().mockImplementation(function(event, handler) {
          if (event === 'end') {
            handler();
          }
          return;
        }),
      };
    });

    await expect(hcReleases.verifyReleaseAsset(client, '/tmp/test/test_v1.0.0_linux_amd64.zip', 'zyx987')).rejects.toThrow('checksum mismatch');
    await expect(spyCreateHash).toHaveBeenCalled();
    await expect(spyCreateReadStream).toHaveBeenCalled();
  });
});

describe('version', () => {
  test('stdout', async () => {
    const spy = jest.spyOn(exec, 'exec');
    spy.mockImplementation((commandLine, args, options) => {
      options.listeners.stdout('0.1.0');
      Promise.resolve();
    });

    const result = await hcReleases.version();

    await expect(spy).toHaveBeenCalled();
    await expect(result).toEqual({ stderr: '', stdout: '0.1.0' });
  });

  test('stderr', async () => {
    const spy = jest.spyOn(exec, 'exec');
    spy.mockImplementation((commandLine, args, options) => {
      options.listeners.stderr('executable not found: hc-releases');
      Promise.resolve();
    });

    const result = await hcReleases.version();

    await expect(spy).toHaveBeenCalled();
    await expect(result).toEqual({ stderr: 'executable not found: hc-releases', stdout: '' });
  });

  test('throws exec error', async () => {
    const spy = jest.spyOn(exec, 'exec');
    spy.mockImplementation(() => Promise.resolve());
    spy.mockRejectedValue(new Error('child process missing stdin'))

    await expect(hcReleases.version()).rejects.toThrow('error executing');
    await expect(spy).toHaveBeenCalled();
  });
});

describe('version number', () => {
  test('successful', async () => {
    const spy = jest.spyOn(exec, 'exec');
    spy.mockImplementation((commandLine, args, options) => {
      options.listeners.stdout('0.1.0');
      Promise.resolve();
    });

    const result = await hcReleases.versionNumber();

    await expect(spy).toHaveBeenCalled();
    await expect(result).toEqual('0.1.0');
  });

  test('throws stderr error', async () => {
    const spy = jest.spyOn(exec, 'exec');
    spy.mockImplementation((commandLine, args, options) => {
      options.listeners.stderr('executable not found: hc-releases');
      Promise.resolve();
    });

    await expect(hcReleases.versionNumber()).rejects.toThrow('error executing');
    await expect(spy).toHaveBeenCalled();
  });

  test('throws stdout error', async () => {
    const spy = jest.spyOn(exec, 'exec');
    spy.mockImplementation((commandLine, args, options) => {
      options.listeners.stdout('v0.1.0.10.1');
      Promise.resolve();
    });

    await expect(hcReleases.versionNumber()).rejects.toThrow('unexpected hc-releases version output');
    await expect(spy).toHaveBeenCalled();
  });
});