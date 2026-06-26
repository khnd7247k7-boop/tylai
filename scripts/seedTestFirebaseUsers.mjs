#!/usr/bin/env node
/**
 * Creates multiple Firebase Auth email/password users (Identity Toolkit signUp API).
 *
 * This does NOT use Apple Health, HealthKit, Watch sync, or expo-health — only Firebase Auth.
 *
 *   export FIREBASE_WEB_API_KEY="AIza..."   # Firebase Console → Project settings → Web API key
 *   node scripts/seedTestFirebaseUsers.mjs
 *
 * Optional:
 *   TYLAI_TEST_EMAIL_PREFIX   (default: tylaiqa)
 *   TYLAI_TEST_EMAIL_DOMAIN   (default: example.com — fine for sign-in tests; use your domain if needed)
 *   TYLAI_TEST_PASSWORD       (strong password; random one printed if omitted)
 *   TYLAI_TEST_COUNT          (default: 10, max 50)
 *
 * After seeding, sign in in the app. Per-user data uses user_${uid}_ keys in AsyncStorage — no health
 * sync required to verify that accounts work and data stays separate between users.
 */

const apiKey = process.env.FIREBASE_WEB_API_KEY;
const prefix = process.env.TYLAI_TEST_EMAIL_PREFIX || 'tylaiqa';
const domain = process.env.TYLAI_TEST_EMAIL_DOMAIN || 'example.com';
const count = Math.min(50, Math.max(1, parseInt(process.env.TYLAI_TEST_COUNT || '10', 10)));
const fixedPassword = process.env.TYLAI_TEST_PASSWORD;

if (!apiKey) {
  console.error('Set FIREBASE_WEB_API_KEY (Firebase Console → Project settings → Web app API key).');
  process.exit(1);
}

const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
const stamp = Date.now();
const password =
  fixedPassword || `TyL!qa_${stamp}_9xK`;

async function signUp(email) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      returnSecureToken: true,
    }),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log(`Creating ${count} users @${domain} (prefix=${prefix}, stamp=${stamp})...\n`);

  let okN = 0;
  for (let i = 1; i <= count; i++) {
    const email = `${prefix}_${stamp}_${i}@${domain}`;
    const { ok, status, data } = await signUp(email);
    if (ok) {
      okN++;
      console.log(`OK   ${email}  uid=${data.localId}`);
    } else {
      const err = data.error?.message || JSON.stringify(data);
      console.log(`FAIL ${email}  ${status}  ${err}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nCreated ${okN}/${count}. Password for all new accounts: ${password}`);
  if (domain === 'example.com') {
    console.log(
      '(Using example.com — OK for auth-only smoke tests. Set TYLAI_TEST_EMAIL_DOMAIN for real inboxes.)'
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
