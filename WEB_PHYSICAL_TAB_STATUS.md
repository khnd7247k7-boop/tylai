# Web / Physical Tab – Status & Next Steps

## Where we are

- **Live site:** https://app.tyl-ai.com (Cloudflare Pages, from GitHub `tylai`).
- **Issue:** Clicking the **Physical** tab (Fitness screen) on web causes a crash.
  - **Error (production):** `Uncaught ReferenceError: Cannot access 'ie' before initialization` in minified `AppEntry-...js`.
  - **Error (local dev):** React reports "An error occurred in the \<FitnessScreen> component" — we still need the **exact error line + stack** from the browser console to fix it.

## What’s already been changed (for web)

1. **BarcodeScanner.tsx** – On web, `expo-camera` is not loaded; shows “Barcode scanning isn’t supported on web” instead.
2. **SwipeNavigation.tsx** – `expo-haptics` loaded only on native; no-op on web.
3. **TabSwipeNavigation.tsx** – Same haptics guard for web.

These are committed and pushed so Cloudflare builds use them. The Physical tab still crashes, so something else in the FitnessScreen tree is breaking on web.

## How to test locally

1. **Start the web server**
   ```bash
   cd /Users/travispixton/Desktop/tyl-ai-app
   npx expo start --web
   ```
2. **Open in browser:** http://localhost:8081 (or the URL Metro prints).
3. **Open DevTools:** `Cmd+Option+J` (Mac) or `Ctrl+Shift+J` (Windows) → **Console** tab.
4. **Reproduce:** Log in → Dashboard → click **Physical**.
5. **Capture for debugging:** In the console, copy the **first red error line** and the stack lines that mention `.tsx` files, then share them so we can fix the exact line.

## Next step to fix Physical on web

Once you have the **detailed error + stack from localhost** (step 5 above), paste it here and we can patch the specific file/line causing the crash.

---
*Last updated: session when user asked to “save where we are” and start server for testing.*
