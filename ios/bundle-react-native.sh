#!/bin/bash
# Xcode "Bundle React Native code and images" — keep logic out of project.pbxproj for easier debugging.
set -euo pipefail

if [[ -f "${PODS_ROOT}/../.xcode.env" ]]; then
  # shellcheck source=/dev/null
  source "${PODS_ROOT}/../.xcode.env"
fi
if [[ -f "${PODS_ROOT}/../.xcode.env.local" ]]; then
  # shellcheck source=/dev/null
  source "${PODS_ROOT}/../.xcode.env.local"
fi

export PROJECT_ROOT="${PROJECT_DIR}/.."

if [[ -z "${ENTRY_FILE:-}" ]]; then
  export ENTRY_FILE="$("${NODE_BINARY}" -e "require('expo/scripts/resolveAppEntry')" "${PROJECT_ROOT}" ios absolute | tail -n 1)"
fi

if [[ -z "${CLI_PATH:-}" ]]; then
  export CLI_PATH="$("${NODE_BINARY}" --print "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })")"
fi

if [[ -z "${BUNDLE_COMMAND:-}" ]]; then
  export BUNDLE_COMMAND="export:embed"
fi

if [[ -f "${PODS_ROOT}/../.xcode.env.updates" ]]; then
  # shellcheck source=/dev/null
  source "${PODS_ROOT}/../.xcode.env.updates"
fi
if [[ -f "${PODS_ROOT}/../.xcode.env.local" ]]; then
  # shellcheck source=/dev/null
  source "${PODS_ROOT}/../.xcode.env.local"
fi

RN_XCODE_SCRIPT="$("${NODE_BINARY}" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'")"

# Debug + physical device: embed JS with --dev false so __DEV__ is off (Metro-less installs).
# Native Debug still enables Fusebox; use scheme "TYLAI-Device" (Release) on a real phone to avoid that.
if [[ "${CONFIGURATION}" == *Debug* ]] && [[ "${PLATFORM_NAME}" != *simulator* ]]; then
  RN_DIR="$(dirname "${RN_XCODE_SCRIPT}")"
  RN_PATCHED="${RN_DIR}/.rn-xcode-embed-nodev-$$.sh"
  sed 's/^    DEV=true$/    DEV=false/' "${RN_XCODE_SCRIPT}" > "${RN_PATCHED}"
  chmod +x "${RN_PATCHED}"
  /bin/bash "${RN_PATCHED}"
  rm -f "${RN_PATCHED}"
else
  /bin/bash "${RN_XCODE_SCRIPT}"
fi
