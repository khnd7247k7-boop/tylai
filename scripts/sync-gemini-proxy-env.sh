#!/usr/bin/env bash
# Syncs API keys from root .env / .env.local into gemini-proxy/.env and sets the app proxy URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

read_env() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  local line
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  local val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  printf '%s' "$val"
}

pick_env() {
  local key="$1"
  local v=""
  v="$(read_env "$key" "$ROOT/.env.local" || true)"
  if [[ -n "$v" ]]; then printf '%s' "$v"; return 0; fi
  v="$(read_env "$key" "$ROOT/.env" || true)"
  if [[ -n "$v" ]]; then printf '%s' "$v"; return 0; fi
  return 0
}

upsert_env_local() {
  local key="$1"
  local val="$2"
  local file="$ROOT/.env.local"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$val" >> "$file"
  fi
}

GEMINI_KEY="$(pick_env GEMINI_KEY)"
if [[ -z "$GEMINI_KEY" ]]; then
  GEMINI_KEY="$(pick_env EXPO_PUBLIC_GEMINI_API_KEY)"
fi

FIREBASE_PROJECT_ID="$(pick_env FIREBASE_PROJECT_ID)"
if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
  FIREBASE_PROJECT_ID="$(pick_env EXPO_PUBLIC_FIREBASE_PROJECT_ID)"
fi

USDA_FDC_API_KEY="$(pick_env USDA_FDC_API_KEY)"
NUTRITIONIX_APP_ID="$(pick_env NUTRITIONIX_APP_ID)"
NUTRITIONIX_API_KEY="$(pick_env NUTRITIONIX_API_KEY)"
PROXY_PORT="$(pick_env PORT)"
PROXY_PORT="${PROXY_PORT:-8080}"

LAN_IP=""
if command -v ipconfig >/dev/null 2>&1; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [[ -z "$LAN_IP" ]]; then
  LAN_IP="$(python3 - <<'PY' 2>/dev/null || true
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(("8.8.8.8", 80))
    print(s.getsockname()[0])
finally:
    s.close()
PY
)"
fi
if [[ -z "$LAN_IP" ]]; then
  EXISTING_PROXY="$(read_env EXPO_PUBLIC_GEMINI_PROXY_URL "$ROOT/.env.local" || true)"
  if [[ "$EXISTING_PROXY" =~ http://([0-9.]+): ]]; then
    LAN_IP="${BASH_REMATCH[1]}"
  fi
fi
if [[ -n "$LAN_IP" ]]; then
  PROXY_URL="http://${LAN_IP}:${PROXY_PORT}"
  METRO_HOST="$LAN_IP"
else
  PROXY_URL="http://localhost:${PROXY_PORT}"
  METRO_HOST="127.0.0.1"
fi

INFO_PLIST="$ROOT/ios/TYLAI/Info.plist"
if [[ -f "$INFO_PLIST" ]] && [[ -n "$METRO_HOST" ]]; then
  /usr/libexec/PlistBuddy -c "Delete :MetroPackagerHost" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :MetroPackagerHost string ${METRO_HOST}" "$INFO_PLIST"
fi

mkdir -p "$ROOT/gemini-proxy"
{
  echo "GEMINI_KEY=${GEMINI_KEY}"
  echo "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
  echo "PORT=${PROXY_PORT}"
  [[ -n "$USDA_FDC_API_KEY" ]] && echo "USDA_FDC_API_KEY=${USDA_FDC_API_KEY}"
  [[ -n "$NUTRITIONIX_APP_ID" ]] && echo "NUTRITIONIX_APP_ID=${NUTRITIONIX_APP_ID}"
  [[ -n "$NUTRITIONIX_API_KEY" ]] && echo "NUTRITIONIX_API_KEY=${NUTRITIONIX_API_KEY}"
} > "$ROOT/gemini-proxy/.env"

upsert_env_local "EXPO_PUBLIC_GEMINI_PROXY_URL" "$PROXY_URL"
if ! grep -q "^EXPO_PUBLIC_GRANT_PREMIUM=" "$ROOT/.env.local" 2>/dev/null; then
  upsert_env_local "EXPO_PUBLIC_GRANT_PREMIUM" "true"
fi

echo "[sync-gemini-proxy-env] Wrote gemini-proxy/.env"
echo "[sync-gemini-proxy-env] EXPO_PUBLIC_GEMINI_PROXY_URL=${PROXY_URL}"
if [[ -n "${METRO_HOST:-}" ]]; then
  echo "[sync-gemini-proxy-env] MetroPackagerHost=${METRO_HOST} (iPhone loads JS from this Mac IP)"
fi

if [[ -z "$GEMINI_KEY" ]]; then
  echo "[sync-gemini-proxy-env] WARNING: GEMINI_KEY is empty. Set GEMINI_KEY or EXPO_PUBLIC_GEMINI_API_KEY in .env.local"
fi
if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
  echo "[sync-gemini-proxy-env] WARNING: FIREBASE_PROJECT_ID is empty. Proxy auth will fail."
fi
if [[ -z "$USDA_FDC_API_KEY" ]]; then
  echo "[sync-gemini-proxy-env] NOTE: USDA_FDC_API_KEY not set — proxy uses DEMO_KEY (strict rate limits). Get a free key at https://fdc.nal.usda.gov/api-key-signup.html"
else
  echo "[sync-gemini-proxy-env] USDA_FDC_API_KEY synced. Restart gemini-proxy if it is already running."
fi
