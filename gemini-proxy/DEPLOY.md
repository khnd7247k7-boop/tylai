# Deploy gemini-proxy (TestFlight)

TestFlight needs a **public HTTPS URL** for food search, restaurant search, and Gemini. Your Mac/LAN proxy will not work for testers.

**Firebase project:** `tyl-ai-coach`  
**Target URL:** `https://api.tyl-ai.com`

---

## Option A — Render (no CLI) **recommended if `gcloud` is missing**

### 1. Push code to GitHub (if not already)

Your `gemini-proxy/` folder lives in `~/Code/tyl-ai-app-local`. Render deploys from a Git repo.

### 2. Create the service on Render

1. Go to [render.com](https://render.com) → sign up / log in (GitHub login is fine).
2. **New +** → **Web Service**.
3. Connect the `tyl-ai-app-local` repo (or a repo that contains `gemini-proxy/`).
4. Settings:
   - **Name:** `tylai-gemini-proxy`
   - **Root directory:** `gemini-proxy`
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Starter ($7/mo) — free tier sleeps and TestFlight will feel broken

### 3. Environment variables (Render → Environment)

Add these in the dashboard (copy values from `~/Code/tyl-ai-app-local/gemini-proxy/.env`):

| Key | Value |
|-----|--------|
| `GEMINI_KEY` | From `gemini-proxy/.env` |
| `FIREBASE_PROJECT_ID` | `tyl-ai-coach` |
| `USDA_FDC_API_KEY` | From `gemini-proxy/.env` |
| `NUTRITIONIX_APP_ID` | Optional — restaurant menus |
| `NUTRITIONIX_API_KEY` | Optional — restaurant menus |
| `PORT` | `8080` (Render sets this automatically; safe to omit) |

Click **Deploy**. Wait until status is **Live**.

### 4. Custom domain

1. Render → your service → **Settings** → **Custom Domains** → add `api.tyl-ai.com`.
2. Render shows a CNAME target (e.g. `tylai-gemini-proxy.onrender.com`).
3. **Cloudflare** (tyl-ai.com) → DNS → add:
   - Type: **CNAME**
   - Name: `api`
   - Target: Render’s hostname
   - Proxy: **DNS only** (grey cloud) for first deploy; can turn orange later

### 5. Verify

```bash
curl https://api.tyl-ai.com/health
```

Expected: `{"ok":true,"service":"gemini-proxy"}`

---

## Option B — Google Cloud Run (needs `gcloud`)

Install the CLI once:

```bash
brew install --cask google-cloud-sdk
```

Then **open a new terminal** (so `gcloud` is on your PATH) and run:

```bash
gcloud auth login
gcloud config set project tyl-ai-coach

cd ~/Code/tyl-ai-app-local/gemini-proxy

gcloud run deploy tylai-gemini-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 1 \
  --set-env-vars "GEMINI_KEY=YOUR_KEY,FIREBASE_PROJECT_ID=tyl-ai-coach,USDA_FDC_API_KEY=YOUR_USDA_KEY"
```

Replace `YOUR_KEY` / `YOUR_USDA_KEY` with values from `gemini-proxy/.env`.

Map `api.tyl-ai.com` in Cloud Run → **Manage custom domains**, then add the CNAME in Cloudflare.

---

## After deploy — wire TestFlight

In `~/Code/tyl-ai-app-local/.env.local`:

```env
EXPO_PUBLIC_GEMINI_PROXY_URL=https://api.tyl-ai.com
```

Then:

```bash
cd ~/Code/tyl-ai-app-local
bash scripts/sync-eas-secrets.sh
npm run eas:build:ios
npm run eas:submit:ios
```

Run checks:

```bash
npm run preflight:testflight
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `gcloud: command not found` | Use **Option A (Render)** or run `brew install --cask google-cloud-sdk` and open a new terminal |
| `curl` to `/health` fails | Wait for Render deploy; check DNS CNAME for `api` |
| Food search rate limited | Confirm `USDA_FDC_API_KEY` is set on Render (not `DEMO_KEY`) |
| Restaurant menus empty | Add Nutritionix keys on Render, or rely on Gemini-only fallback |
| Gemini quota errors | Enable billing in [Google AI Studio](https://aistudio.google.com) |
