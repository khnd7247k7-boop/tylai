#!/usr/bin/env bash
# One command: sync env → gemini-proxy + Expo in a single terminal.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[dev] Syncing keys from .env.local → gemini-proxy/.env …"
npm run gemini-proxy:sync

echo "[dev] Starting gemini-proxy + Expo (Ctrl+C stops both)"
echo "[dev] Project: $ROOT"
bash "$ROOT/scripts/print-phone-url.sh"

exec npx concurrently \
  --names "proxy,expo" \
  --prefix-colors "blue,magenta" \
  --kill-others-on-fail \
  "npm run gemini-proxy:serve" \
  "npx expo start --clear --host lan"
