/**
 * Short in-app compliance copy for gates, summaries, and Settings → Legal previews.
 * Full policies: src/constants/legalPolicies.ts and legal.html on the website.
 */

import { LEGAL_CONTACT_EMAIL } from './legalMeta';

export const MEDICAL_DISCLAIMER_SHORT =
  'TYLAI is for general fitness and wellness only—not medical advice, diagnosis, or treatment. ' +
  'Consult a qualified healthcare professional before starting or changing any exercise program, ' +
  'especially if you have a medical condition. Stop exercising and seek medical attention if you ' +
  'experience pain, dizziness, faintness, or other concerning symptoms.';

export const APPLE_HEALTH_PRIVACY_SUMMARY =
  'Data read from Apple Health and similar connected sources is used only to personalize your ' +
  'experience inside this app—for example workout summaries, trends, and coaching context. ' +
  'Transform Your Life LLC does not sell personal information or health data. We do not use ' +
  'Apple Health, HealthKit, or connected health data for advertising or advertising profiling. ' +
  'You can revoke access in your device Health settings and in Settings → Health & Trends within the app.';

export const WORKOUT_LIABILITY_WAIVER_SHORT =
  'Physical activity involves inherent risk. You are solely responsible for how you use workouts ' +
  'and plans in this app. To the fullest extent permitted by law, Transform Your Life LLC is not ' +
  'liable for injury, loss, or damages arising from your use of fitness features. See the full ' +
  'Fitness Disclaimer in Settings → Legal for complete terms.';

export const AI_DISCLAIMER_SHORT =
  'AI-generated workouts, nutrition suggestions, and coaching may contain errors. Do not rely on ' +
  'AI output for medical, clinical, or emergency decisions. You are responsible for evaluating ' +
  'recommendations and consulting qualified professionals when appropriate. See the full AI ' +
  'Disclaimer in Settings → Legal.';

export const PRIVACY_SUMMARY_SHORT =
  'We collect account, profile, fitness, nutrition, and wellness data to operate and personalize ' +
  'TYL. Transform Your Life LLC does not sell your personal information. Contact ' +
  `${LEGAL_CONTACT_EMAIL} to request access, correction, export, or deletion.`;

export const LOCAL_DATA_DELETION_FOOTNOTE =
  'This removes wellness data stored on this device for your signed-in account. It does not delete your ' +
  'Firebase authentication account by itself. To remove your account entirely, contact ' +
  `${LEGAL_CONTACT_EMAIL} or use account-deletion options described in our Privacy Policy.`;
