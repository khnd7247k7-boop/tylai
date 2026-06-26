/**
 * User_Milestones — persisted per user via AsyncStorage (`userMilestones` key).
 * Mirrors a logical "table" for streaks, aggregates, and gamification state.
 */

export type SmallWinBadgeId = 'show_up' | 'level_up' | 'volume_king' | 'recovery_pro';

export interface UserMilestones {
  /** Current consecutive calendar days user opened the workout logger */
  workout_logger_open_streak: number;
  /** Local date key (YYYY-MM-DD) of last logger open */
  last_workout_logger_open_day: string | null;
  /** Workout completion streak (completed sessions on consecutive calendar days) */
  streak_count: number;
  /** Last local day key a completed workout was logged */
  last_session_day: string | null;
  /** Running sum of weight × reps for all completed sets (lbs·reps) */
  total_weight_lifted: number;
  /** Count of completed workout sessions */
  sessions_completed: number;
  /** 0–100 heuristic: blend of recent session frequency + logger streak */
  consistency_score: number;
  /** Badge ids already awarded (show_up once; volume_king per muscle; recovery_pro logged separately) */
  earned_badges: string[];
  /** Muscles that have already triggered Volume King */
  volume_king_muscles: string[];
  /** ISO timestamps of Recovery Pro awards (limit frequency) */
  recovery_pro_awarded_at: string[];
  /** Last time any small win modal was shown (for drought nudge) */
  last_small_win_at: string | null;
  /** Default weekly set targets per muscle key (editable later / profile) */
  weekly_set_goals: Record<string, number>;
  /** Prevents double-counting when a session is saved twice (e.g. post-workout questions) */
  last_processed_session_id: string | null;
}

export const DEFAULT_WEEKLY_SET_GOALS: Record<string, number> = {
  chest: 10,
  back: 10,
  shoulders: 8,
  biceps: 8,
  triceps: 8,
  quadriceps: 12,
  hamstrings: 10,
  glutes: 10,
  calves: 6,
  legs: 10,
  arms: 8,
};

export const DEFAULT_USER_MILESTONES: UserMilestones = {
  workout_logger_open_streak: 0,
  last_workout_logger_open_day: null,
  streak_count: 0,
  last_session_day: null,
  total_weight_lifted: 0,
  sessions_completed: 0,
  consistency_score: 0,
  earned_badges: [],
  volume_king_muscles: [],
  recovery_pro_awarded_at: [],
  last_small_win_at: null,
  weekly_set_goals: { ...DEFAULT_WEEKLY_SET_GOALS },
  last_processed_session_id: null,
};

export interface SmallWinPayload {
  badgeId: SmallWinBadgeId;
  /** Sub-key for volume king muscle label */
  detail?: string;
  headline: string;
  actionLine: string;
  whyItMatters: string;
  emoji: string;
}
