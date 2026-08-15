/**
 * Smoke test: earned progression + temporary regression.
 * Run: npx tsx scripts/smoke-progression-engine.ts
 */

import Module from 'module';
import type { WorkoutSession } from '../data/workoutPrograms';
import type { ExerciseCompetencyRecord } from '../src/types/exerciseCompetency';

// Stub RN / Expo modules pulled in via competency storage (not needed for pure decisions).
const originalLoad = (Module as any)._load;
const stubs: Record<string, unknown> = {
  'react-native': {
    Platform: { OS: 'ios', select: (o: any) => o.ios },
    NativeModules: {},
    StyleSheet: { create: (s: any) => s },
  },
  '@react-native-async-storage/async-storage': {
    default: {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    },
  },
  expo: {},
  'expo-secure-store': {
    getItemAsync: async () => null,
    setItemAsync: async () => undefined,
  },
};

(Module as any)._load = function (request: string, parent: unknown, isMain: boolean) {
  if (stubs[request]) return stubs[request];
  return originalLoad(request, parent, isMain);
};

function session(
  date: string,
  exerciseId: string,
  name: string,
  opts: { reps: number; weight: number; rpe?: number; rir?: number; completedSets?: number }
): WorkoutSession {
  const n = opts.completedSets ?? 3;
  return {
    id: `s-${date}-${exerciseId}`,
    programId: 'p',
    programName: 'test',
    date,
    duration: 40,
    notes: '',
    completed: true,
    exercises: [
      {
        exerciseId,
        name,
        sets: Array.from({ length: n }, (_, i) => ({
          setNumber: i + 1,
          reps: opts.reps,
          weight: opts.weight,
          restTime: 90,
          completed: true,
          rpe: opts.rpe,
          rir: opts.rir,
        })),
      },
    ],
  };
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  const { decideExerciseProgression, applyEarnedProgressionToWeeklyPlanSync } = await import(
    '../src/services/ProgressionEngine'
  );
  const { createEmptyCompetencyRecord } = await import('../src/types/exerciseCompetency');

  function competent(
    id: string,
    name: string,
    level: ExerciseCompetencyRecord['competencyLevel']
  ): ExerciseCompetencyRecord {
    const base = createEmptyCompetencyRecord(id, name);
    return {
      ...base,
      competencyLevel: level,
      sessionsCompleted: 8,
      performanceTrend: 'improving',
      movementQuality: 'adequate',
      movementTolerance: 'tolerated',
      progressionReady: level === 'proficient' || level === 'advanced',
      progressionBlockedReasons: [],
    };
  }

  // --- Hold: not earned (too few sessions) ---
  {
    const ex = {
      id: 'goblet-squats',
      name: 'Goblet Squats',
      sets: 3,
      reps: 10,
      weight: 40,
      category: 'strength',
      phase: 'Main Lift',
    };
    const d = decideExerciseProgression({
      exercise: ex,
      history: [session('2026-08-01', 'goblet-squats', 'Goblet Squats', { reps: 10, weight: 40 })],
      competency: competent('goblet-squats', 'Goblet Squats', 'learning'),
      level: 'beginner',
      recoveryScore: 70,
    });
    assert(d.method === 'hold', `few sessions → hold (got ${d.method})`);
    assert(
      d.reasons.some((r) => r.includes('not_earned') || r.includes('need_')),
      'hold reasons explain gate'
    );
  }

  // --- Progress reps: earned streak ---
  {
    const ex = {
      id: 'goblet-squats',
      name: 'Goblet Squats',
      sets: 3,
      reps: 8,
      weight: 45,
      category: 'strength',
      phase: 'Main Lift',
      muscleGroups: ['quadriceps', 'glutes'],
    };
    const history = [
      session('2026-08-10', 'goblet-squats', 'Goblet Squats', { reps: 8, weight: 45, rpe: 7, rir: 2 }),
      session('2026-08-07', 'goblet-squats', 'Goblet Squats', { reps: 8, weight: 45, rpe: 7, rir: 2 }),
      session('2026-08-03', 'goblet-squats', 'Goblet Squats', { reps: 8, weight: 45, rpe: 7, rir: 3 }),
    ];
    const d = decideExerciseProgression({
      exercise: ex,
      history,
      competency: competent('goblet-squats', 'Goblet Squats', 'competent'),
      level: 'beginner',
      recoveryScore: 70,
    });
    assert(
      d.method === 'increase_reps' ||
        d.method === 'increase_load' ||
        d.method === 'progress_exercise',
      `earned performance progresses (got ${d.method})`
    );
    assert(d.temporary === true, 'decisions are temporary (no permanent bad label)');
  }

  // --- Progress exercise: Goblet → harder squat when proficient ---
  {
    const ex = {
      id: 'goblet-squats',
      name: 'Goblet Squats',
      sets: 3,
      reps: 12,
      weight: 55,
      category: 'strength',
      phase: 'Main Lift',
      muscleGroups: ['quadriceps', 'glutes'],
    };
    const history = [
      session('2026-08-12', 'goblet-squats', 'Goblet Squats', { reps: 12, weight: 55, rpe: 7, rir: 2 }),
      session('2026-08-09', 'goblet-squats', 'Goblet Squats', { reps: 12, weight: 55, rpe: 7, rir: 2 }),
      session('2026-08-06', 'goblet-squats', 'Goblet Squats', { reps: 12, weight: 55, rpe: 7, rir: 2 }),
      session('2026-08-03', 'goblet-squats', 'Goblet Squats', { reps: 12, weight: 55, rpe: 7, rir: 2 }),
    ];
    const d = decideExerciseProgression({
      exercise: ex,
      history,
      competency: {
        ...competent('goblet-squats', 'Goblet Squats', 'proficient'),
        progressionReady: true,
      },
      level: 'intermediate',
      recoveryScore: 75,
    });
    assert(
      d.method === 'progress_exercise' ||
        d.method === 'increase_complexity' ||
        d.method === 'increase_load',
      `proficient path progresses (got ${d.method} → ${d.nextExerciseName ?? 'n/a'})`
    );
    if (d.nextExerciseName) {
      assert(
        /front squat|dumbbell squat|squat/i.test(d.nextExerciseName),
        `Goblet progresses toward squat family (${d.nextExerciseName})`
      );
    }
  }

  // --- Regress exercise: struggle on Back Squat ---
  {
    const ex = {
      id: 'squat',
      name: 'Squat',
      sets: 3,
      reps: 8,
      weight: 135,
      category: 'strength',
      phase: 'Main Lift',
    };
    const history = [
      session('2026-08-12', 'squat', 'Squat', { reps: 4, weight: 135, rpe: 10, rir: 0 }),
      session('2026-08-09', 'squat', 'Squat', { reps: 5, weight: 135, rpe: 9.5, rir: 0 }),
      session('2026-08-06', 'squat', 'Squat', { reps: 8, weight: 135, rpe: 8, rir: 1 }),
    ];
    const d = decideExerciseProgression({
      exercise: ex,
      history,
      competency: {
        ...competent('squat', 'Squat', 'learning'),
        performanceTrend: 'declining',
        movementQuality: 'poor',
        progressionReady: false,
      },
      level: 'intermediate',
      recoveryScore: 50,
    });
    assert(
      d.method === 'regress_exercise' ||
        d.method === 'regress_reps' ||
        d.method === 'regress_load',
      `struggle triggers temporary regression (got ${d.method})`
    );
    assert(d.temporary === true, 'regression is temporary');
    if (d.nextExerciseName) {
      console.log(`   regress Squat → ${d.nextExerciseName}`);
    }
  }

  // --- Bulgarian regresses toward split / lunge family ---
  {
    const ex = {
      id: 'bulgarian-split-squats',
      name: 'Bulgarian Split Squats',
      sets: 3,
      reps: 8,
      weight: 40,
      category: 'strength',
      phase: 'Secondary Lifts',
    };
    const history = [
      session('2026-08-12', 'bulgarian-split-squats', 'Bulgarian Split Squats', {
        reps: 3,
        weight: 40,
        rpe: 10,
      }),
      session('2026-08-09', 'bulgarian-split-squats', 'Bulgarian Split Squats', {
        reps: 4,
        weight: 40,
        rpe: 9,
      }),
    ];
    const d = decideExerciseProgression({
      exercise: ex,
      history,
      competency: {
        ...competent('bulgarian-split-squats', 'Bulgarian Split Squats', 'learning'),
        movementTolerance: 'limited',
        progressionReady: false,
      },
      level: 'beginner',
      recoveryScore: 55,
    });
    assert(d.method === 'regress_exercise', `Bulgarian regress_exercise (got ${d.method})`);
    assert(!!d.nextExerciseName, 'has regression target');
    console.log(`   regress Bulgarian → ${d.nextExerciseName}`);
  }

  // --- Plan apply: mixed week ---
  {
    const plan = {
      weekDays: [
        {
          dayName: 'Day 1',
          focus: 'Lower',
          duration: 45,
          exercises: [
            {
              id: 'goblet-squats',
              name: 'Goblet Squats',
              sets: 3,
              reps: 10,
              weight: 40,
              category: 'strength',
              phase: 'Main Lift',
            },
            {
              id: 'squat',
              name: 'Squat',
              sets: 3,
              reps: 5,
              weight: 185,
              category: 'strength',
              phase: 'Main Lift',
            },
          ],
        },
      ],
    };
    const history = [
      session('2026-08-12', 'goblet-squats', 'Goblet Squats', { reps: 10, weight: 40, rpe: 7, rir: 2 }),
      session('2026-08-09', 'goblet-squats', 'Goblet Squats', { reps: 10, weight: 40, rpe: 7, rir: 2 }),
      session('2026-08-06', 'goblet-squats', 'Goblet Squats', { reps: 10, weight: 40, rpe: 7, rir: 2 }),
      session('2026-08-12', 'squat', 'Squat', { reps: 2, weight: 185, rpe: 10 }),
      session('2026-08-09', 'squat', 'Squat', { reps: 2, weight: 185, rpe: 10 }),
    ];
    const { plan: out, decisions } = applyEarnedProgressionToWeeklyPlanSync({
      plan,
      history,
      level: 'intermediate',
      recoveryScore: 70,
      competencyById: {
        'goblet-squats': competent('goblet-squats', 'Goblet Squats', 'competent'),
        squat: {
          ...competent('squat', 'Squat', 'learning'),
          performanceTrend: 'declining',
          movementTolerance: 'limited',
        },
      },
    });
    const methods = decisions.map((d) => `${d.exerciseName}:${d.method}`).join(', ');
    console.log('   plan decisions:', methods);
    assert(decisions.length === 2, 'one decision per exercise');
    assert(
      decisions.some((d) => d.method.startsWith('regress')),
      'struggling squat regresses in plan'
    );
    assert(
      out.weekDays[0].exercises.every((e) => e.name.length > 0),
      'plan exercises remain valid'
    );
  }

  console.log('\nAll progression engine smoke checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
