import Constants from 'expo-constants';
import { auth } from '../../firebaseConfig';

function readEnvList(key: string): string[] {
  const raw =
    (typeof process !== 'undefined' ? process.env?.[key] : undefined) ??
    (() => {
      const extra = (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? null) as
        | Record<string, unknown>
        | null;
      const fromExtra = extra?.[key];
      return typeof fromExtra === 'string' ? fromExtra : '';
    })();

  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function getDeveloperPremiumEmails(): string[] {
  return readEnvList('EXPO_PUBLIC_DEVELOPER_PREMIUM_EMAILS');
}

export function isDeveloperPremiumEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? '';
  if (!normalized) return false;
  return getDeveloperPremiumEmails().includes(normalized);
}

/** True when the signed-in Firebase account is on the developer premium allowlist. */
export function currentUserHasDeveloperPremiumAccess(): boolean {
  const email = auth?.currentUser?.email ?? null;
  return isDeveloperPremiumEmail(email);
}
