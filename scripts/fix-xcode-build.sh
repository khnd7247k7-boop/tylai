#!/usr/bin/env bash
# Clean Xcode caches and reinstall pods — fixes RCTDeprecation module-cache fatals and stale builds.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Removing DerivedData + module cache…"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/TYLAI-"*
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/ModuleCache.noindex"
# Stale precompiled bridging headers reference old RCTDeprecation .pcm files.
find "$HOME/Library/Developer/Xcode/DerivedData" -name '*Bridging-Header*.pch' -delete 2>/dev/null || true

echo "→ pod install…"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
cd ios
pod install
cd ..

echo "Done. Open ios/TYLAI.xcworkspace, select scheme TYLAI + an iPhone Simulator, then Product → Clean Build Folder → Run."
echo "For a physical device: Signing & Capabilities → enable Automatically manage signing and pick your Team."
