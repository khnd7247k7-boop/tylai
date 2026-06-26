#!/usr/bin/env bash
# One-time interactive setup + TestFlight build/submit via EAS.
# Run in Terminal (not Cursor agent) — Apple credential prompts require stdin.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ EAS login (skip if already logged in)"
npx eas-cli whoami || npx eas-cli login

echo "→ Configure iOS credentials (first time only — follow prompts)"
npx eas-cli credentials:configure-build --platform ios --profile production

echo "→ Production iOS build (cloud, ~15–25 min)"
npx eas-cli build --platform ios --profile production

echo "→ Submit latest build to App Store Connect / TestFlight"
npx eas-cli submit --platform ios --profile production --latest

echo "Done. Check App Store Connect → TestFlight for processing status."
