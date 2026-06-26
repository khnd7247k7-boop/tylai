/** Storage key (via saveUserData / loadUserData) for AI Coach health overrides. */
export const COACH_MOCK_HEALTH_KEY = 'coachMockHealth';

export type CoachMockHealthSettings = {
  enabled: boolean;
  /** Simulated mindful minutes for the dashboard AI section only. */
  mindfulMinutesMock: 0 | 20;
};

export const DEFAULT_COACH_MOCK_HEALTH: CoachMockHealthSettings = {
  enabled: false,
  mindfulMinutesMock: 0,
};
