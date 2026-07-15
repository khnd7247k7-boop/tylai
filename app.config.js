const fs = require('fs');
const path = require('path');

/** Load KEY=VALUE lines into process.env (does not override existing). */
function loadEnvFile(relativePath) {
  const filePath = path.join(__dirname, relativePath);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const appJson = require('./app.json');

const isProductionBuild =
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.APP_ENV === 'production';

const isDevBuild =
  !isProductionBuild &&
  (process.env.EAS_BUILD_PROFILE === 'development' ||
    process.env.APP_ENV === 'development' ||
    process.env.NODE_ENV === 'development');

/** Values the app reads via process.env and Constants.expoConfig.extra */
const publicEnv = {
  EXPO_PUBLIC_GEMINI_PROXY_URL: process.env.EXPO_PUBLIC_GEMINI_PROXY_URL ?? '',
  EXPO_PUBLIC_GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
  EXPO_PUBLIC_GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL ?? '',
  EXPO_PUBLIC_GRANT_PREMIUM: process.env.EXPO_PUBLIC_GRANT_PREMIUM ?? '',
  EXPO_PUBLIC_DEVELOPER_PREMIUM_EMAILS: process.env.EXPO_PUBLIC_DEVELOPER_PREMIUM_EMAILS ?? '',
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  EXPO_PUBLIC_BETA_PAYMENT_URL: process.env.EXPO_PUBLIC_BETA_PAYMENT_URL ?? '',
  EXPO_PUBLIC_BETA_ACCESS_API_URL: process.env.EXPO_PUBLIC_BETA_ACCESS_API_URL ?? '',
};

const iosConfig = { ...appJson.expo.ios };
if (isDevBuild) {
  iosConfig.infoPlist = {
    ...(iosConfig.infoPlist ?? {}),
    NSLocalNetworkUsageDescription:
      'TYLAI connects to the development server on your Mac to load app updates during development.',
    NSBonjourServices: ['_expo._tcp', '_react-native._tcp'],
  };
}

module.exports = () => ({
  ...appJson.expo,
  ios: iosConfig,
  extra: {
    ...(appJson.expo.extra ?? {}),
    ...publicEnv,
  },
});
