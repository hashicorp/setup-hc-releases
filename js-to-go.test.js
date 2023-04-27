/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

const os = require('os');

const jsToGo = require('./js-to-go');

describe('architecture', () => {
    test.each([
        ['arm', 'arm'],
        ['arm64', 'arm64'],
        ['mips', 'mips'],
        ['ppc64', 'ppc64'],
        ['s390x', 's390x'],
        ['x32', '386'],
        ['x64', 'amd64'],
    ])('%s', (jsArchitecture, expected) => {
        const spy = jest.spyOn(os, 'arch');
        spy.mockReturnValue(jsArchitecture);

        const result = jsToGo.architecture();

        expect(spy).toHaveBeenCalled();
        expect(result).toEqual(expected);
    })

    test('throws error', () => {
        const spy = jest.spyOn(os, 'arch');
        spy.mockReturnValue('unknown');

        expect(jsToGo.architecture).toThrow('unknown JavaScript architecture');
        expect(spy).toHaveBeenCalled();
    });
});

describe('operating system', () => {
    test.each([
        ['aix', 'aix'],
        ['darwin', 'darwin'],
        ['freebsd', 'freebsd'],
        ['linux', 'linux'],
        ['openbsd', 'openbsd'],
        ['sunos', 'solaris'],
        ['win32', 'windows'],
    ])('%s', (jsPlatform, expected) => {
        const spy = jest.spyOn(os, 'platform');
        spy.mockReturnValue(jsPlatform);

        const result = jsToGo.operatingSystem();

        expect(spy).toHaveBeenCalled();
        expect(result).toEqual(expected);
    })

    test('throws error', () => {
        const spy = jest.spyOn(os, 'platform');
        spy.mockReturnValue('unknown');

        expect(jsToGo.operatingSystem).toThrow('unknown JavaScript platform');
        expect(spy).toHaveBeenCalled();
    });
});
