/**
 * Priority scoring, cooldowns, fatigue, daily selection.
 */
import type {
  NotificationCandidate,
  NotificationCategory,
  NotificationPrefs,
  SmartNotificationState,
  UserDailyState,
} from './types';
import { maxDailyForIntensity } from './types';
import { combineRelatedCandidates, generateCandidates } from './candidates';

const CATEGORY_COOLDOWN_MS: Record<NotificationCategory, number> = {
  coaching: 12 * 60 * 60 * 1000,
  nutrition: 8 * 60 * 60 * 1000,
  accountability: 48 * 60 * 60 * 1000,
  celebration: 7 * 24 * 60 * 60 * 1000,
  progress: 48 * 60 * 60 * 1000,
  recovery: 24 * 60 * 60 * 1000,
};

const MIN_PRIORITY = 55;

function hoursInQuiet(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function applyScoresAndPenalties(
  candidates: NotificationCandidate[],
  state: UserDailyState,
  engineState: SmartNotificationState,
  prefs: NotificationPrefs
): NotificationCandidate[] {
  const now = Date.now();
  const ignored = new Set(state.notificationHistory.ignoredCategories);
  const recentMilestones = new Set(engineState.recentMilestoneIds ?? []);

  return candidates
    .map((c) => {
      let fatigue = 0;
      let cooldown = 0;

      if (ignored.has(c.type)) fatigue += 25;
      const ignoreCount = engineState.categoryIgnoreCounts?.[c.type] ?? 0;
      if (ignoreCount >= 2) fatigue += 15 * Math.min(ignoreCount, 4);

      const lastTs = engineState.recentCategoryTimestamps[c.type];
      if (lastTs) {
        const elapsed = now - Date.parse(lastTs);
        const need = CATEGORY_COOLDOWN_MS[c.type];
        if (Number.isFinite(elapsed) && elapsed < need) {
          cooldown += 80;
        }
      }

      if (c.milestoneId && recentMilestones.has(c.milestoneId)) {
        cooldown += 100;
      }

      // Already completed the suggested action
      if (c.action === 'start_workout' && state.training.completedToday) {
        cooldown += 100;
      }
      if (
        c.type === 'nutrition' &&
        state.nutrition.proteinRemaining < 25
      ) {
        cooldown += 100;
      }

      // Minimal intensity: prefer celebration + accountability only mildly
      if (prefs.intensity === 'minimal' && c.type === 'coaching') {
        fatigue += 10;
      }

      const priority =
        c.relevanceScore * 0.3 +
        c.goalAlignmentScore * 0.2 +
        c.potentialImpactScore * 0.2 +
        c.urgencyScore * 0.2 +
        (c.combined ? 8 : 0) -
        fatigue -
        cooldown;

      return { ...c, fatiguePenalty: fatigue, cooldownPenalty: cooldown, priority };
    })
    .filter((c) => c.priority >= MIN_PRIORITY && c.cooldownPenalty < 80)
    .sort((a, b) => b.priority - a.priority);
}

export function selectWinners(
  scored: NotificationCandidate[],
  prefs: NotificationPrefs,
  sentToday: number
): NotificationCandidate[] {
  const max = maxDailyForIntensity(prefs.intensity);
  const remaining = Math.max(0, max - sentToday);
  if (remaining === 0) return [];

  const winners: NotificationCandidate[] = [];
  const usedTypes = new Set<NotificationCategory>();

  for (const c of scored) {
    if (winners.length >= remaining) break;
    // Avoid two of the same category in one batch
    if (usedTypes.has(c.type)) continue;
    // Avoid duplicate topics (e.g. combined already covers nutrition)
    if (c.combined) {
      usedTypes.add('coaching');
      usedTypes.add('nutrition');
    } else {
      usedTypes.add(c.type);
    }
    winners.push(c);
  }

  return winners;
}

export function runCandidatePipeline(
  state: UserDailyState,
  prefs: NotificationPrefs,
  engineState: SmartNotificationState
): NotificationCandidate[] {
  if (!prefs.enabled) return [];
  if (hoursInQuiet(state.localHour, prefs.quietHoursStart, prefs.quietHoursEnd)) {
    return [];
  }

  // only_if_ask: celebrations / analytical progress-like only
  let raw = generateCandidates(state, prefs);
  if (state.proactiveCoaching === 'only_if_ask') {
    raw = raw.filter(
      (c) => c.type === 'celebration' || c.type === 'progress' || c.combined
    );
  }

  raw = combineRelatedCandidates(raw, state);
  const scored = applyScoresAndPenalties(raw, state, engineState, prefs);
  const sentToday =
    engineState.sentTodayDateKey === state.localDateKey
      ? engineState.sentTodayCount
      : 0;
  return selectWinners(scored, prefs, sentToday);
}
