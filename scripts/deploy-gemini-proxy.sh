#!/usr/bin/env bash
# Deploy gemini-proxy to Google Cloud Run (TestFlight production API).
# Prereqs: brew install --cask google-cloud-sdk  (then open a NEW terminal)
#          gcloud auth login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROXY_DIR="$ROOT/gemini-proxy"
ENV_FILE="$PROXY_DIR/.env"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found."
  echo "Install: brew install --cask google-cloud-sdk"
  echo "Then open a NEW terminal and run this script again."
  echo ""
  echo "No CLI? Use Render instead — see gemini-proxy/DEPLOY.md (Option A)."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — run: npm run gemini-proxy:sync"
  exit 1
fi

read_env() {
  grep "^$1=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true
}

GEMINI_KEY="$(read_env GEMINI_KEY)"
FIREBASE_PROJECT_ID="$(read_env FIREBASE_PROJECT_ID)"
USDA_FDC_API_KEY="$(read_env USDA_FDC_API_KEY)"
NUTRITIONIX_APP_ID="$(read_env NUTRITIONIX_APP_ID)"
NUTRITIONIX_API_KEY="$(read_env NUTRITIONIX_API_KEY)"
FATSECRET_CLIENT_ID="$(read_env FATSECRET_CLIENT_ID)"
FATSECRET_CLIENT_SECRET="$(read_env FATSECRET_CLIENT_SECRET)"
FATSECRET_SCOPE="$(read_env FATSECRET_SCOPE)"

if [[ -z "$GEMINI_KEY" ]]; then
  echo "GEMINI_KEY missing in $ENV_FILE"
  exit 1
fi
if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
  echo "FIREBASE_PROJECT_ID missing in $ENV_FILE"
  exit 1
fi

SERVICE_NAME="${CLOUD_RUN_SERVICE:-tylai-gemini-proxy}"
REGION="${CLOUD_RUN_REGION:-us-central1}"

echo "→ Google Cloud project: $FIREBASE_PROJECT_ID"
echo "→ Service: $SERVICE_NAME ($REGION)"
echo ""

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
  echo "Not logged in. Run in your terminal:"
  echo "  gcloud auth login"
  exit 1
fi

gcloud config set project "$FIREBASE_PROJECT_ID"

ENV_VARS="GEMINI_KEY=${GEMINI_KEY},FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
[[ -n "$USDA_FDC_API_KEY" ]] && ENV_VARS+=",USDA_FDC_API_KEY=${USDA_FDC_API_KEY}"
[[ -n "$NUTRITIONIX_APP_ID" ]] && ENV_VARS+=",NUTRITIONIX_APP_ID=${NUTRITIONIX_APP_ID}"
[[ -n "$NUTRITIONIX_API_KEY" ]] && ENV_VARS+=",NUTRITIONIX_API_KEY=${NUTRITIONIX_API_KEY}"
[[ -n "$FATSECRET_CLIENT_ID" ]] && ENV_VARS+=",FATSECRET_CLIENT_ID=${FATSECRET_CLIENT_ID}"
[[ -n "$FATSECRET_CLIENT_SECRET" ]] && ENV_VARS+=",FATSECRET_CLIENT_SECRET=${FATSECRET_CLIENT_SECRET}"
[[ -n "$FATSECRET_SCOPE" ]] && ENV_VARS+=",FATSECRET_SCOPE=${FATSECRET_SCOPE}"

echo "→ Deploying from $PROXY_DIR ..."
gcloud run deploy "$SERVICE_NAME" \
  --source "$PROXY_DIR" \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --set-env-vars "$ENV_VARS"

URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')"
echo ""
echo "✓ Deployed: $URL"
echo "  Health: ${URL}/health"
echo ""
echo "Next:"
echo "  1. Map api.tyl-ai.com → Cloud Run custom domain (or use this URL for now)"
echo "  2. Add to .env.local: EXPO_PUBLIC_GEMINI_PROXY_URL=${URL}"
echo "  3. bash scripts/sync-eas-secrets.sh && npm run eas:build:ios"
