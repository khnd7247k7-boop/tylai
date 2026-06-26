#!/usr/bin/env bash
# Quick checks before inviting TestFlight beta testers.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
[[ -f "$ENV_FILE" ]] || ENV_FILE=".env"
[[ -f "$ENV_FILE" ]] || { echo "Missing .env.local"; exit 1; }

read_env() {
  grep "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true
}

PROXY_URL="$(read_env EXPO_PUBLIC_GEMINI_PROXY_URL)"
BETA_API="$(read_env EXPO_PUBLIC_BETA_ACCESS_API_URL)"
BETA_PAY="$(read_env EXPO_PUBLIC_BETA_PAYMENT_URL)"

echo "=== TestFlight preflight ==="
echo ""

fail=0

if [[ -z "$PROXY_URL" ]]; then
  echo "✗ EXPO_PUBLIC_GEMINI_PROXY_URL not set in $ENV_FILE"
  echo "  Set to https://api.tyl-ai.com (or your Cloud Run / Render URL)"
  fail=1
elif [[ "$PROXY_URL" == http://* ]]; then
  echo "✗ EXPO_PUBLIC_GEMINI_PROXY_URL is HTTP/LAN — TestFlight cannot use this"
  echo "  Current: $PROXY_URL"
  fail=1
elif [[ "$PROXY_URL" != https://* ]]; then
  echo "✗ EXPO_PUBLIC_GEMINI_PROXY_URL must start with https://"
  fail=1
else
  echo "→ Proxy URL: $PROXY_URL"
  if curl -sf --max-time 10 "${PROXY_URL%/}/health" >/dev/null 2>&1; then
    echo "✓ Proxy /health reachable"
  else
    echo "✗ Cannot reach ${PROXY_URL%/}/health — deploy gemini-proxy first (see gemini-proxy/DEPLOY.md)"
    fail=1
  fi
fi

echo ""
if [[ -n "$BETA_API" ]]; then
  echo "→ Beta access API: $BETA_API"
else
  echo "→ Beta access API: (default) https://tyl-ai.com/api/beta-access"
fi
if [[ -n "$BETA_PAY" ]]; then
  echo "→ Payment page: $BETA_PAY"
else
  echo "→ Payment page: (default) https://tyl-ai.com/join.html#pricing"
fi

echo ""
echo "→ EAS production env (requires eas login):"
if npx eas-cli env:list --environment production --non-interactive 2>/dev/null | grep -q EXPO_PUBLIC_GEMINI_PROXY_URL; then
  echo "✓ EXPO_PUBLIC_GEMINI_PROXY_URL in EAS production"
else
  echo "✗ EXPO_PUBLIC_GEMINI_PROXY_URL missing from EAS production"
  echo "  Run: bash scripts/sync-eas-secrets.sh"
  fail=1
fi

if npx eas-cli env:list --environment production --non-interactive 2>/dev/null | grep -q EXPO_PUBLIC_FIREBASE; then
  echo "✓ Firebase vars present in EAS production"
else
  echo "✗ Firebase vars missing from EAS — run bash scripts/sync-eas-secrets.sh"
  fail=1
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "Preflight passed. Next: npm run eas:build:ios && npm run eas:submit:ios"
  echo "Then self-test: pay on join.html → sign in on TestFlight → try food + restaurant search."
else
  echo "Fix the items above, then rebuild TestFlight."
  exit 1
fi
