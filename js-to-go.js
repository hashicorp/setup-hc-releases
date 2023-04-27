/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

const os = require('os');

function architecture() {
    const jsArchitecture = os.arch();

    switch (jsArchitecture) {
        case 'arm':
        case 'arm64':
        case 'mips':
        case 'ppc64':
        case 's390x':
            return jsArchitecture;
        case 'x32':
            return '386';
        case 'x64':
            return 'amd64';
    }

    throw new Error(`unknown JavaScript architecture: ${jsArchitecture}`);
}

function operatingSystem() {
    const jsPlatform = os.platform();

    switch (jsPlatform) {
        case 'aix':
        case 'darwin':
        case 'freebsd':
        case 'linux':
        case 'openbsd':
            return jsPlatform;
        case 'sunos':
            return 'solaris';
        case 'win32':
            return 'windows';
    }

    throw new Error(`unknown JavaScript platform: ${jsPlatform}`);
}

exports.architecture = architecture;
exports.operatingSystem = operatingSystem;
