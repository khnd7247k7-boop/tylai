#!/usr/bin/env bash
# Dev server via tunnel — use when iPhone can't find Metro on LAN (different Wi‑Fi / router isolation).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[dev:tunnel] Syncing env…"
npm run gemini-proxy:sync

echo "[dev:tunnel] Starting proxy + Expo TUNNEL (scan QR on iPhone dev launcher)"
exec npx concurrently \
  --names "proxy,expo" \
  --prefix-colors "blue,magenta" \
  --kill-others-on-fail \
  "npm run gemini-proxy:serve" \
  "npx expo start --clear --tunnel"
