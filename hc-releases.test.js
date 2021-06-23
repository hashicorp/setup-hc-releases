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
            name: "hc-releases_v1.0.0_linux_amd64.zip",
        };

        fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
            if (err) throw err;

            const expectedPath = path.resolve(directory, releaseAsset.name);

            nock('https://api.github.com')
                .get('/repos/hashicorp/hc-releases/releases/assets/1')
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
            name: "hc-releases_v1.0.0_linux_amd64.zip",
        };
        fs.mkdtemp(path.join(os.tmpdir(), 'setup-hc-releases-'), async (err, directory) => {
            if (err) throw err;

            nock('https://api.github.com')
                .get(`/repos/hashicorp/hc-releases/releases/assets/1`)
                .reply(404, 'Not Found');

            const hcReleases = require('./hc-releases')

            await expect(hcReleases.downloadReleaseAsset(client, releaseAsset, directory)).rejects.toThrow('Not Found');
        });
    });
});

describe('ensure supported go platform', () => {
    test.each([
        ['darwin', 'amd64'],
        ['linux', 'amd64'],
        ['windows', 'amd64'],
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
        ['darwin', 'amd64'],
        ['linux', 'amd64'],
        ['windows', 'amd64'],
    ])('%s/%s', async (goOperatingSystem, goArchitecture) => {
        const mockRelease = {
            assets: [
                {
                    id: 1,
                    name: "hc-releases_v1.0.0_darwin_amd64.zip"
                },
                {
                    id: 2,
                    name: "hc-releases_v1.0.0_linux_amd64.zip"
                },
                {
                    id: 3,
                    name: "hc-releases_v1.0.0_windows_amd64.zip"
                },
            ],
            id: "1",
            name: "v1.0.0",
        };

        nock('https://api.github.com')
            .get(`/repos/hashicorp/hc-releases/releases/tags/v1.0.0`)
            .reply(200, mockRelease);

        const releaseAsset = await hcReleases.getReleaseAsset(client, '1.0.0', goOperatingSystem, goArchitecture);

        await expect(releaseAsset).toEqual(mockRelease.assets.find((asset) => asset.name.includes(goOperatingSystem) && asset.name.includes(goArchitecture)));
    })

    test('throws release asset not found error', async () => {
        const mockRelease = {
            assets: [
                {
                    id: 1,
                    name: "hc-releases_v1.0.0_darwin_amd64.zip"
                },
                {
                    id: 2,
                    name: "hc-releases_v1.0.0_linux_amd64.zip"
                },
                {
                    id: 3,
                    name: "hc-releases_v1.0.0_windows_amd64.zip"
                },
            ],
            id: "1",
            name: "v1.0.0",
        };

        nock('https://api.github.com')
            .get(`/repos/hashicorp/hc-releases/releases/tags/v1.0.0`)
            .reply(200, mockRelease);

        await expect(hcReleases.getReleaseAsset(client, '1.0.0', 'darwin', '386')).rejects.toThrow('Release asset not found in release');
    });

    test('throws release not found error', async () => {
        nock('https://api.github.com')
            .get(`/repos/hashicorp/hc-releases/releases/tags/v1.0.0`)
            .reply(404, 'Not Found');

        await expect(hcReleases.getReleaseAsset(client, '1.0.0', 'linux', 'amd64')).rejects.toThrow('Not Found');
    });
});

describe('release asset checksum', () => {
    test.each([
        ['0.0.0', 'darwin', 'amd64', undefined],
        ['0.11.3', 'unknown', 'amd64', undefined],
        ['0.11.3', 'darwin', '386', undefined],
        ['0.11.3', 'darwin', 'amd64', '9c5785b79790efdc665a90b84d8d3c8c5569748f1313d7508fd737fe3db1df89'],
        ['0.11.3', 'linux', 'amd64', '9016ea5f12f267cb5109454e411bb5795d42224463e8e702f3ad0afb8d9b1f0f'],
        ['0.11.3', 'windows', 'amd64', '9c90ea397bf6fe5a89b0f2f3334bdc0e8058e8d90e735e8e8266f209ddf994cd'],
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
                digest: function () { return 'abc123' },
                setEncoding: function () { },
                read: function () { },
                update: function () { },
            };
        });
        const spyCreateReadStream = jest.spyOn(fs, 'createReadStream');
        spyCreateReadStream.mockImplementation(() => {
            return {
                on: jest.fn().mockImplementation(function (event, handler) {
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
                digest: function () { return 'abc123' },
                setEncoding: function () { },
                read: function () { },
                update: function () { },
            };
        });
        const spyCreateReadStream = jest.spyOn(fs, 'createReadStream');
        spyCreateReadStream.mockImplementation(() => {
            return {
                on: jest.fn().mockImplementation(function (event, handler) {
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
            options.listeners.stdout('hc-releases v0.11.3 ()');
            Promise.resolve();
        });

        const result = await hcReleases.version();

        await expect(spy).toHaveBeenCalled();
        await expect(result).toEqual({ stderr: '', stdout: 'hc-releases v0.11.3 ()' });
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
            options.listeners.stdout('hc-releases v0.11.3 ()');
            Promise.resolve();
        });

        const result = await hcReleases.versionNumber();

        await expect(spy).toHaveBeenCalled();
        await expect(result).toEqual('0.11.3');
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
            options.listeners.stdout('v1.0.0');
            Promise.resolve();
        });

        await expect(hcReleases.versionNumber()).rejects.toThrow('unexpected hc-releases version output');
        await expect(spy).toHaveBeenCalled();
    });
});
