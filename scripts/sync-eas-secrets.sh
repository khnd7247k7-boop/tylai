#!/usr/bin/env bash
# Push EXPO_PUBLIC_* vars from .env.local into EAS production environment.
# Run from project root: bash scripts/sync-eas-secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE=".env"
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.local or .env"
  exit 1
fi

KEYS=(
  EXPO_PUBLIC_FIREBASE_API_KEY
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  EXPO_PUBLIC_FIREBASE_PROJECT_ID
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  EXPO_PUBLIC_FIREBASE_APP_ID
  EXPO_PUBLIC_GEMINI_API_KEY
  EXPO_PUBLIC_BETA_PAYMENT_URL
  EXPO_PUBLIC_BETA_ACCESS_API_URL
  EXPO_PUBLIC_DEVELOPER_PREMIUM_EMAILS
)

# Optional — only set when you have a public HTTPS proxy (not LAN IP).
if grep -q '^EXPO_PUBLIC_GEMINI_PROXY_URL=https://' "$ENV_FILE" 2>/dev/null; then
  KEYS+=(EXPO_PUBLIC_GEMINI_PROXY_URL)
fi

echo "Using $ENV_FILE → EAS production environment"
for key in "${KEYS[@]}"; do
  val="$(grep "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "$val" ]]; then
    echo "Skip $key (empty)"
    continue
  fi
  if [[ "$key" == "EXPO_PUBLIC_GEMINI_PROXY_URL" && "$val" == http://192.168.* ]]; then
    echo "Skip $key (LAN URL — not valid for TestFlight)"
    continue
  fi
  if [[ "$key" == "EXPO_PUBLIC_GEMINI_PROXY_URL" && "$val" == http://* ]]; then
    echo "Skip $key (use https public URL for TestFlight, or rely on EXPO_PUBLIC_GEMINI_API_KEY for beta)"
    continue
  fi
  echo "→ $key"
  npx eas-cli env:create --environment production --name "$key" --value "$val" --visibility plaintext --force --non-interactive
done

echo "Done. Run: npm run eas:build:ios"
