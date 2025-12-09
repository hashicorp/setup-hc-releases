#!/usr/bin/env bash
#
# Copyright IBM Corp. 2021, 2025
# SPDX-License-Identifier: MPL-2.0

set -euo pipefail

run_quiet() {
    local logfile="${RUNNER_TEMP}/command.log"
    mkdir -p "$RUNNER_TEMP"
    "$@" > "$logfile" 2>&1 || {
        cat "$logfile"
        exit 1
    }
}

# overrides and defaults for testing
: "${DEST_DIR:=${HOME}/bin}"
: "${RUNNER_TEMP:=/tmp/setup-hc-releases}"
: "${GITHUB_PATH:=${RUNNER_TEMP}/GITHUB_PATH}"
: "${GITHUB_OUTPUT:=${RUNNER_TEMP}/GITHUB_OUTPUT}"

readonly TAG="${1:-}"

host_os="$(uname -s)"
case "${host_os,,}" in
    linux)  os=linux ;;
    darwin) os=darwin ;;
    *)
        echo "$host_os: unsupported OS" 1>&2
        exit 1
        ;;
esac

host_arch="$(uname -m)"
case "${host_arch,,}" in
    x86_64) arch=amd64 ;;
    arm64) arch=arm64 ;;
    *) echo "$host_arch: unsupported architecture" 1>&2 ; exit 1 ;;
esac

if [ -n "$TAG" ]; then
    tag="$TAG"
    tag="v${tag#v}"
else
    echo "Identifying latest release..."
    # fetch tag of latest release (according to GH releases)
    tag="$(gh release list --repo=hashicorp/releases-api | awk '$2 == "Latest" { print $3 }')"
fi

# Note: this pattern is used with gh as a glob and with grep as a regular expression
pattern="${os}_${arch}.zip"
version="${tag#v}"
sums_name="hc-releases_${version}_SHA256SUMS"
echo "Installing release $version"

# download
/bin/rm -vf "$sums_name" "hc-releases_${version}_${pattern}" # remove in case they already exist from previous invocation
gh release download --repo=hashicorp/releases-api "$tag" --pattern "$sums_name"
gh release download --repo=hashicorp/releases-api "$tag" --pattern "*$pattern"
# verify checksum
sha256sum --quiet --strict --check <( grep "$pattern" "$sums_name" )

# install
mkdir -p "$DEST_DIR"
run_quiet unzip -o -d "$DEST_DIR" "hc-releases_${version}_$pattern"
chmod 755 "${DEST_DIR}/hc-releases"
echo "$DEST_DIR" >> "$GITHUB_PATH"

# clean up downloads
/bin/rm -vf "$sums_name" "hc-releases_${version}_${pattern}"

# report version installed
V="$("${DEST_DIR}/hc-releases" version)"
echo "version=$V" >> "$GITHUB_OUTPUT"
echo "Installed hc-releases $V"
