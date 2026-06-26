#!/usr/bin/env bash
# Print how to connect iPhone to Metro (direct load — no dev launcher).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run gemini-proxy:sync >/dev/null

HOST="$(/usr/libexec/PlistBuddy -c "Print :MetroPackagerHost" ios/TYLAI/Info.plist 2>/dev/null || echo "127.0.0.1")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  iPhone dev setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Mac:     npm run dev          (keep running)"
echo "  iPhone:  same Wi‑Fi, open TYLAI app"
echo "  Metro:   http://${HOST}:8081"
echo ""
echo "  First time or after IP change:"
echo "           npm run ios:device   (phone unlocked + USB)"
echo ""
echo "  If Wi‑Fi blocked: npm run dev:tunnel"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
