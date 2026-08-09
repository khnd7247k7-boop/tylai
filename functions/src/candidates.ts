/**
 * Deterministic candidate generators — no LLM.
 */
import type { NotificationCandidate, NotificationPrefs, UserDailyState } from './types';

function base(
  partial: Omit<
    NotificationCandidate,
    | 'priority'
    | 'fatiguePenalty'
    | 'cooldownPenalty'
    | 'relevanceScore'
    | 'goalAlignmentScore'
    | 'potentialImpactScore'
    | 'urgencyScore'
  > &
    Partial<
      Pick<
        NotificationCandidate,
        | 'relevanceScore'
        | 'goalAlignmentScore'
        | 'potentialImpactScore'
        | 'urgencyScore'
      >
    >
): NotificationCandidate {
  return {
    relevanceScore: partial.relevanceScore ?? 50,
    goalAlignmentScore: partial.goalAlignmentScore ?? 50,
    potentialImpactScore: partial.potentialImpactScore ?? 50,
    urgencyScore: partial.urgencyScore ?? 40,
    fatiguePenalty: 0,
    cooldownPenalty: 0,
    priority: 0,
    ...partial,
  };
}

export function generateCandidates(
  state: UserDailyState,
  prefs: NotificationPrefs
): NotificationCandidate[] {
  const out: NotificationCandidate[] = [];
  const { training, nutrition, coachingTone } = state;
  const cats = prefs.categories;

  // --- Coaching: workout today ---
  if (
    cats.coaching &&
    training.scheduledToday &&
    !training.completedToday &&
    state.localHour >= 7 &&
    state.localHour < 20
  ) {
    const facts = [
      `Workout planned today${training.todayLabel ? ` (${training.todayLabel})` : ''}.`,
      `Weekly sessions so far: ${training.weeklyCompleted}/${training.weeklyTarget}.`,
      training.currentStreak > 0 ? `Current streak: ${training.currentStreak} day(s).` : null,
    ].filter(Boolean) as string[];

    let title = 'Training today';
    let message = `You've got a workout scheduled today. You're ${training.weeklyCompleted}/${training.weeklyTarget} this week.`;
    if (coachingTone === 'coach_me') {
      message = `You've got your workout today. You're ${training.weeklyCompleted}/${training.weeklyTarget} this week — keep the momentum going.`;
    } else if (coachingTone === 'analyze_me') {
      title = 'Scheduled session';
      message = `A training session is scheduled today. Weekly completion is ${training.weeklyCompleted}/${training.weeklyTarget}.`;
    } else {
      message = `You've got training on the plan today (${training.weeklyCompleted}/${training.weeklyTarget} this week). Want to start when you're ready?`;
    }

    out.push(
      base({
        id: `coaching_workout_${state.localDateKey}`,
        type: 'coaching',
        title,
        message,
        reason: 'scheduled_workout_today',
        verifiedFacts: facts,
        action: 'start_workout',
        relevanceScore: 72,
        goalAlignmentScore: 70,
        potentialImpactScore: 68,
        urgencyScore: state.localHour >= 16 ? 75 : 55,
      })
    );
  }

  // --- Nutrition: protein gap (afternoon/evening) ---
  if (
    cats.nutrition &&
    nutrition.proteinGapSignificant &&
    state.localHour >= 12 &&
    state.localHour < 21
  ) {
    const gap = Math.round(nutrition.proteinRemaining);
    const calLeft = Math.round(nutrition.caloriesRemaining);
    const facts = [
      `Protein logged ${Math.round(nutrition.proteinLogged)}g of ${nutrition.proteinTarget}g (${gap}g remaining).`,
      `Calories remaining today: ~${calLeft}.`,
    ];
    let title = 'Protein opportunity';
    let message = `You're ${gap}g short on protein with ~${calLeft} calories remaining. Want a quick high-protein option?`;
    if (coachingTone === 'analyze_me') {
      title = 'Macro gap';
      message = `Protein is ${gap}g below target with ~${calLeft} calories still available.`;
    } else if (coachingTone === 'work_with_me') {
      message = `You're ${gap}g short on protein and still have ~${calLeft} calories left. Want help picking something that fits?`;
    }

    out.push(
      base({
        id: `nutrition_protein_${state.localDateKey}`,
        type: 'nutrition',
        title,
        message,
        reason: 'protein_gap',
        verifiedFacts: facts,
        action: 'log_food',
        relevanceScore: 78,
        goalAlignmentScore: 80,
        potentialImpactScore: 74,
        urgencyScore: state.localHour >= 17 ? 80 : 60,
      })
    );
  }

  // --- Accountability: missed sessions ---
  if (cats.accountability && training.recentMissedWorkouts >= 2 && !training.completedToday) {
    const facts = [
      `Estimated missed sessions vs plan this week: ${training.recentMissedWorkouts}.`,
      `Completed this week: ${training.weeklyCompleted}/${training.weeklyTarget}.`,
    ];
    let title = 'Adjust this week?';
    let message =
      "You've missed a couple of planned sessions. Want help adjusting this week's schedule so you can get back on track?";
    if (coachingTone === 'analyze_me') {
      title = 'Adherence note';
      message = `Training adherence is below plan (${training.weeklyCompleted}/${training.weeklyTarget} this week).`;
    } else if (coachingTone === 'coach_me') {
      message =
        "You've missed a couple of sessions. Let's reset the week — I can help you pick the next best workout.";
    }

    out.push(
      base({
        id: `accountability_missed_${state.localDateKey}`,
        type: 'accountability',
        title,
        message,
        reason: 'missed_workouts',
        verifiedFacts: facts,
        action: 'adjust_schedule',
        relevanceScore: 70,
        goalAlignmentScore: 75,
        potentialImpactScore: 72,
        urgencyScore: 65,
      })
    );
  }

  // --- Celebration: streak / milestones ---
  if (cats.celebration) {
    if (training.currentStreak >= 7 && training.currentStreak % 7 === 0) {
      const mid = `streak_${training.currentStreak}`;
      out.push(
        base({
          id: `celebration_${mid}_${state.localDateKey}`,
          type: 'celebration',
          title: 'Consistency milestone',
          message:
            coachingTone === 'analyze_me'
              ? `Training streak reached ${training.currentStreak} consecutive days.`
              : `You've been consistent for ${training.currentStreak} days straight. That's worth recognizing.`,
          reason: 'streak_milestone',
          verifiedFacts: [`Current workout streak: ${training.currentStreak} days.`],
          action: 'view_progress',
          milestoneId: mid,
          relevanceScore: 65,
          goalAlignmentScore: 60,
          potentialImpactScore: 55,
          urgencyScore: 30,
        })
      );
    }

    if (
      training.totalCompletedSessions > 0 &&
      training.totalCompletedSessions % 25 === 0
    ) {
      const mid = `workouts_${training.totalCompletedSessions}`;
      out.push(
        base({
          id: `celebration_${mid}`,
          type: 'celebration',
          title: 'Workout milestone',
          message:
            coachingTone === 'analyze_me'
              ? `Lifetime completed sessions: ${training.totalCompletedSessions}.`
              : `${training.totalCompletedSessions} workouts completed. That's a milestone worth recognizing.`,
          reason: 'workout_count_milestone',
          verifiedFacts: [`Lifetime completed sessions: ${training.totalCompletedSessions}.`],
          action: 'view_progress',
          milestoneId: mid,
          relevanceScore: 68,
          goalAlignmentScore: 58,
          potentialImpactScore: 52,
          urgencyScore: 25,
        })
      );
    }

    // Strong week celebration (evening)
    if (
      training.weeklyCompleted >= training.weeklyTarget &&
      training.weeklyTarget >= 3 &&
      state.localHour >= 17 &&
      training.completedToday
    ) {
      out.push(
        base({
          id: `celebration_strong_week_${state.localDateKey}`,
          type: 'celebration',
          title: 'Strong week',
          message:
            coachingTone === 'analyze_me'
              ? `Weekly training target met (${training.weeklyCompleted}/${training.weeklyTarget}).`
              : `You're having a strong week — ${training.weeklyCompleted}/${training.weeklyTarget} workouts done. Keep doing what you're doing.`,
          reason: 'strong_week',
          verifiedFacts: [
            `Weekly sessions: ${training.weeklyCompleted}/${training.weeklyTarget}.`,
          ],
          action: 'view_progress',
          milestoneId: `strong_week_${state.localDateKey}`,
          relevanceScore: 60,
          goalAlignmentScore: 62,
          potentialImpactScore: 48,
          urgencyScore: 20,
        })
      );
    }
  }

  return out;
}

/** Merge coaching + nutrition into one richer candidate when both present. */
export function combineRelatedCandidates(
  candidates: NotificationCandidate[],
  state: UserDailyState
): NotificationCandidate[] {
  const coaching = candidates.find((c) => c.type === 'coaching');
  const nutrition = candidates.find((c) => c.type === 'nutrition');
  if (!coaching || !nutrition) return candidates;

  const gap = Math.round(state.nutrition.proteinRemaining);
  const facts = [...coaching.verifiedFacts, ...nutrition.verifiedFacts];
  const combined = base({
    id: `combined_train_protein_${state.localDateKey}`,
    type: 'coaching',
    title: 'Today\'s focus',
    message:
      state.coachingTone === 'analyze_me'
        ? `Training is scheduled today. Protein is ${gap}g below target with calories remaining.`
        : state.coachingTone === 'work_with_me'
          ? `You've got training today and you're ${gap}g short on protein. Want a quick meal idea that fits your remaining macros?`
          : `You're having a solid setup today — workout still on the plan, and you're ${gap}g short on protein. Want a quick post-workout meal suggestion?`,
    reason: 'combined_workout_protein',
    verifiedFacts: facts,
    action: state.training.completedToday ? 'log_food' : 'start_workout',
    combined: true,
    relevanceScore: Math.max(coaching.relevanceScore, nutrition.relevanceScore) + 8,
    goalAlignmentScore: Math.max(coaching.goalAlignmentScore, nutrition.goalAlignmentScore),
    potentialImpactScore:
      Math.max(coaching.potentialImpactScore, nutrition.potentialImpactScore) + 5,
    urgencyScore: Math.max(coaching.urgencyScore, nutrition.urgencyScore),
  });

  return [
    combined,
    ...candidates.filter((c) => c.id !== coaching.id && c.id !== nutrition.id),
  ];
}
