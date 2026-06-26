/**
 * Workout coach simulator — prints suggested plan changes per scenario.
 * Run: npx tsx scripts/simulateWorkoutCoach.ts
 */
import { createEmptyCoachingProfile } from '../src/types/coachingProfile';
import { PRIMARY_GOAL_LABELS } from '../src/types/coachingProfile';
import {
  buildWorkoutGenerationModifiers,
  buildGoalAdaptationSummary,
  resolveEffectiveTrainingDays,
  resolveProgressionLever,
} from '../src/services/GoalDrivenCoaching';
import { applyAdaptiveActionToWeeklyPlan } from '../src/services/planAdaptationLogic';
import type { AdaptiveAction } from '../src/services/planAdaptationLogic';

type Scenario = {
  title: string;
  action: AdaptiveAction;
  progressionAllowed: boolean;
  challengeDial: 'easy' | 'balanced' | 'maximum';
  progressionLever: ReturnType<typeof resolveProgressionLever>;
  plan: {
    weekDays: Array<{
      dayName?: string;
      exercises: Array<{
        name: string;
        sets: number;
        reps: number;
        weight: number;
        category: 'strength';
        phase?: string;
        muscleGroups?: string[];
      }>;
    }>;
  };
  history: Array<{
    id: string;
    programId: string;
    programName: string;
    date: string;
    duration: number;
    notes: string;
    completed: boolean;
    exercises: Array<{
      exerciseId?: string;
      name: string;
      sets: Array<{ setNumber: number; reps: number; weight: number; restTime: number; completed: boolean }>;
    }>;
  }>;
};

function profileForGoal(
  goal: keyof typeof PRIMARY_GOAL_LABELS,
  dial: 'easy' | 'balanced' | 'maximum' = 'balanced'
) {
  const p = createEmptyCoachingProfile();
  p.goalProfile.primaryGoal = goal;
  p.scheduleProfile.daysPerWeek = 4;
  p.scheduleProfile.sessionLengthMinutes = 45;
  p.experienceProfile.level = 'intermediate';
  p.adherenceProfile.challengeDial = dial;
  p.recoveryProfile.sleepQuality = dial === 'easy' ? 'low' : 'high';
  p.recoveryProfile.stressLevel = dial === 'maximum' ? 'low' : 'medium';
  return p;
}

function completedSets(
  name: string,
  sets: number,
  reps: number,
  weight: number,
  completionPct = 1
) {
  const done = Math.max(1, Math.round(sets * completionPct));
  return Array.from({ length: sets }, (_, i) => ({
    setNumber: i + 1,
    reps,
    weight,
    restTime: 90,
    completed: i < done,
  }));
}

function printChanges(scenario: string, result: ReturnType<typeof applyAdaptiveActionToWeeklyPlan>) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`SCENARIO: ${scenario}`);
  console.log(`Coach action: ${result.action} | Applied: ${result.applied}`);
  if (!result.changes.length) {
    console.log('  (no plan changes suggested)');
    return;
  }
  console.log('Suggested changes:');
  for (const c of result.changes) {
    if (c.field === 'reps' && c.oldValue === c.newValue && c.reason.includes('→')) {
      console.log(`  • ${c.exerciseName}: ${c.reason}`);
    } else {
      console.log(
        `  • ${c.exerciseName}: ${c.field} ${c.oldValue} → ${c.newValue} — ${c.reason}`
      );
    }
  }
  const after = result.plan.weekDays.flatMap((d) => d.exercises);
  console.log('Plan after:');
  for (const ex of after) {
    console.log(`  ${ex.name}: ${ex.sets}×${ex.reps}${ex.weight ? ` @ ${ex.weight} lb` : ' (bodyweight)'}`);
  }
}

function printProfileCoach(goal: keyof typeof PRIMARY_GOAL_LABELS, dial: 'easy' | 'balanced' | 'maximum') {
  const p = profileForGoal(goal, dial);
  const mods = buildWorkoutGenerationModifiers(p);
  const summary = buildGoalAdaptationSummary(p, mods);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`PROFILE: ${PRIMARY_GOAL_LABELS[goal]} | Challenge: ${dial} | ${mods.recoveryScore}/100 recovery`);
  console.log(`Training days/week: ${resolveEffectiveTrainingDays(p)} (user chose ${p.scheduleProfile.daysPerWeek})`);
  console.log(`Progression lever: ${summary.progressionLever}`);
  console.log(`Primary focus: ${summary.primaryFocus}`);
  console.log(`Generation modifiers: intensity ×${mods.intensityMultiplier.toFixed(2)}, ` +
    `set bonus +${mods.setBonus}, rep adj ${mods.repAdjust >= 0 ? '+' : ''}${mods.repAdjust}, ` +
    `rest ${mods.restAdjustSec >= 0 ? '+' : ''}${mods.restAdjustSec}s`);
  console.log(`Coach note: ${summary.coachingNote}`);
}

const scenarios: Scenario[] = [
  {
    title: 'Strength — 4×8 bench at cap, crushing sessions → progress via load',
    action: 'progress',
    progressionAllowed: true,
    challengeDial: 'balanced',
    progressionLever: 'load',
    plan: {
      weekDays: [{
        dayName: 'Upper',
        exercises: [{
          name: 'Bench Press',
          sets: 4,
          reps: 8,
          weight: 135,
          category: 'strength',
          phase: 'Main Lift',
          muscleGroups: ['chest', 'triceps'],
        }],
      }],
    },
    history: [{
      id: '1', programId: 'p1', programName: 'Strength', date: new Date().toISOString(),
      duration: 50, notes: '', completed: true,
      exercises: [{
        name: 'Bench Press',
        sets: completedSets('Bench Press', 4, 8, 135),
      }],
    }],
  },
  {
    title: 'Strength — struggling (<70% sets done) → regress load',
    action: 'regress',
    progressionAllowed: false,
    challengeDial: 'balanced',
    progressionLever: 'load',
    plan: {
      weekDays: [{
        exercises: [{
          name: 'Squat',
          sets: 4,
          reps: 5,
          weight: 225,
          category: 'strength',
          phase: 'Main Lift',
          muscleGroups: ['quads', 'glutes'],
        }],
      }],
    },
    history: [{
      id: '2', programId: 'p1', programName: 'Strength', date: new Date().toISOString(),
      duration: 45, notes: '', completed: true,
      exercises: [{
        name: 'Squat',
        sets: completedSets('Squat', 4, 5, 225, 0.5),
      }],
    }],
  },
  {
    title: 'Calisthenics — push-ups mastered → harder exercise',
    action: 'progress',
    progressionAllowed: true,
    challengeDial: 'maximum',
    progressionLever: 'exercise_difficulty',
    plan: {
      weekDays: [{
        exercises: [{
          name: 'Push-ups',
          sets: 3,
          reps: 15,
          weight: 0,
          category: 'strength',
          phase: 'Main Lift',
        }],
      }],
    },
    history: [{
      id: '3', programId: 'p2', programName: 'Cali', date: new Date().toISOString(),
      duration: 35, notes: '', completed: true,
      exercises: [{
        name: 'Push-ups',
        sets: completedSets('Push-ups', 3, 15, 0),
      }],
    }],
  },
  {
    title: 'High adherence risk → simplify accessories',
    action: 'simplify',
    progressionAllowed: false,
    challengeDial: 'easy',
    progressionLever: 'volume',
    plan: {
      weekDays: [{
        exercises: [{
          name: 'Tricep Extensions',
          sets: 3,
          reps: 12,
          weight: 30,
          category: 'strength',
          phase: 'Accessory Lifts',
          muscleGroups: ['triceps'],
        }],
      }],
    },
    history: [{
      id: '4', programId: 'p3', programName: 'Hypertrophy', date: new Date().toISOString(),
      duration: 40, notes: '', completed: true,
      exercises: [{
        name: 'Tricep Extensions',
        sets: completedSets('Tricep Extensions', 3, 12, 30, 0.6),
      }],
    }],
  },
  {
    title: 'Poor recovery week → deload main lift',
    action: 'deload',
    progressionAllowed: false,
    challengeDial: 'balanced',
    progressionLever: 'load',
    plan: {
      weekDays: [{
        exercises: [{
          name: 'Deadlift',
          sets: 4,
          reps: 5,
          weight: 315,
          category: 'strength',
          phase: 'Main Lift',
          muscleGroups: ['back', 'hamstrings'],
        }],
      }],
    },
    history: [{
      id: '5', programId: 'p1', programName: 'Strength', date: new Date().toISOString(),
      duration: 55, notes: '', completed: true,
      exercises: [{
        name: 'Deadlift',
        sets: completedSets('Deadlift', 4, 5, 315, 0.65),
      }],
    }],
  },
  {
    title: 'Crushing it → intensify (bigger load bump at cap)',
    action: 'intensify',
    progressionAllowed: true,
    challengeDial: 'maximum',
    progressionLever: 'load',
    plan: {
      weekDays: [{
        exercises: [{
          name: 'Overhead Press',
          sets: 4,
          reps: 6,
          weight: 95,
          category: 'strength',
          phase: 'Main Lift',
          muscleGroups: ['shoulders', 'triceps'],
        }],
      }],
    },
    history: [{
      id: '6', programId: 'p1', programName: 'Strength', date: new Date().toISOString(),
      duration: 45, notes: '', completed: true,
      exercises: [{
        name: 'Overhead Press',
        sets: completedSets('Overhead Press', 4, 6, 95),
      }],
    }],
  },
];

console.log('TYL AI — Workout Coach Simulator');
console.log('Shows what the coach would suggest after analyzing performance.\n');

console.log('── GOAL PROFILES (generation + adaptation strategy) ──');
for (const goal of ['strength_powerlifting', 'calisthenics', 'muscle_gain', 'fat_loss', 'general_fitness'] as const) {
  printProfileCoach(goal, 'balanced');
}
printProfileCoach('calisthenics', 'maximum');
printProfileCoach('fat_loss', 'easy');

console.log('\n── POST-WORKOUT PLAN ADAPTATIONS ──');
for (const s of scenarios) {
  const result = applyAdaptiveActionToWeeklyPlan(s.plan, s.history as any, {
    adaptiveRecommendation: s.action,
    progressionAllowed: s.progressionAllowed,
    challengeDial: s.challengeDial,
    progressionLever: s.progressionLever,
  });
  printChanges(s.title, result);
}

console.log(`\n${'═'.repeat(60)}`);
console.log('Done. In the app, these apply automatically after you finish a workout on an active plan.');
