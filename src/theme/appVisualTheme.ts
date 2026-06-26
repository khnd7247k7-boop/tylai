/**
 * Shared dark UI tokens aligned with the Nutrition tab (cards, contrast, accent).
 * Import into StyleSheet.create({ ... }) for consistency across screens.
 */
export const AppTheme = {
  bgScreen: '#0f0f0f',
  bgElevated: '#141414',
  card: '#1c1c1c',
  cardHover: '#252525',
  inputBg: '#2a2a2a',
  inputBorder: '#3a3a3a',
  border: '#2e2e2e',
  borderMuted: '#333333',
  textPrimary: '#ffffff',
  textSecondary: '#e5e5e5',
  textMuted: '#9ca3af',
  textFaint: '#6b7280',
  textDisabled: '#888888',
  accent: '#00ff88',
  accentDark: '#0a0a0a',
  overlay: 'rgba(0,0,0,0.55)',
  radiusCard: 16,
  radiusRow: 14,
  radiusPill: 20,
  radiusButton: 12,
} as const;

export type AppThemeType = typeof AppTheme;
