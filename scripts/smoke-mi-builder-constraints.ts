/**
 * Smoke: MI constraints → Workout Builder swaps / limits (no hard-coded knee→X).
 * Run: npx tsx scripts/smoke-mi-builder-constraints.ts
 */

import Module from 'module';

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  const {
    applyMiConstraintsToWeeklyPlan,
    emptyWorkoutBuilderMiContext,
    pickConstraintSafeVariation,
  } = await import('../src/services/WorkoutBuilderMiIntegration');
  const { createEmptyMovementProfile } = await import('../src/types/movementIntelligence');

  const now = new Date().toISOString();
  const ctx = emptyWorkoutBuilderMiContext('intermediate', 'muscle_gain');
  ctx.primaryGoal = 'muscle_gain';
  ctx.profile = createEmptyMovementProfile();
  ctx.constraints = [
    {
      id: 'c1',
      exercise: 'Squat',
      status: 'modify',
      intensityLimit: 0.7,
      volumeLimit: 0.75,
      romLimit: 'pain_free_rom',
      preferredVariations: ['Goblet Squats', 'Leg Press', 'Front Squats (Barbell)'],
      reason: 'Discomfort during squats — modify demand, keep lower-body stimulus',
      startDate: now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    },
  ];
  ctx.modifyExerciseNames = ['Squat'];
  ctx.preferredVariations = ['Goblet Squats', 'Leg Press', 'Front Squats (Barbell)'];
  ctx.hardAvoidNames = [];

  const safer = pickConstraintSafeVariation(
    {
      id: 'squat',
      name: 'Squat',
      sets: 4,
      reps: 8,
      weight: 185,
      category: 'strength',
      phase: 'Main Lift',
    },
    ctx.constraints[0],
    ctx
  );
  assert(!!safer, 'metadata-driven safer variation exists');
  assert(safer!.name.toLowerCase() !== 'squat', `swapped away from Squat (got ${safer!.name})`);
  assert(
    /goblet|leg press|front squat|hack|smith/i.test(safer!.name),
    `keeps squat-pattern stimulus (${safer!.name})`
  );

  const plan = {
    weekDays: [
      {
        dayName: 'Day 1',
        focus: 'Legs',
        duration: 45,
        exercises: [
          {
            id: 'squat',
            name: 'Squat',
            sets: 4,
            reps: 8,
            weight: 185,
            category: 'strength',
            phase: 'Main Lift',
          },
          {
            id: 'bench-press',
            name: 'Bench Press',
            sets: 3,
            reps: 8,
            weight: 135,
            category: 'strength',
            phase: 'Main Lift',
          },
        ],
      },
    ],
  };

  const { plan: out, appliedCount, notes } = applyMiConstraintsToWeeklyPlan(plan, ctx);
  console.log('   notes:', notes.join(' | '));
  assert(appliedCount > 0, 'constraint applied to plan');
  const lower = out.weekDays[0].exercises[0];
  assert(lower.name.toLowerCase() !== 'squat', `main lift modified (${lower.name})`);
  assert(
    (lower.weight ?? 0) < 185,
    `intensity reduced (${lower.weight} < 185)`
  );
  assert(out.weekDays[0].exercises[1].name === 'Bench Press', 'unrelated training preserved');

  // temporarilyAvoid must not keep the banned lift
  ctx.constraints = [
    {
      id: 'c2',
      exercise: 'Squat',
      status: 'temporarilyAvoid',
      preferredVariations: ['Goblet Squats'],
      reason: 'Acute discomfort — temporarily avoid',
      startDate: now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    },
  ];
  ctx.hardAvoidNames = ['Squat'];
  const avoided = applyMiConstraintsToWeeklyPlan(plan, ctx);
  assert(
    avoided.plan.weekDays[0].exercises[0].name.toLowerCase() !== 'squat',
    `temporarilyAvoid swaps Squat → ${avoided.plan.weekDays[0].exercises[0].name}`
  );

  console.log('\nAll MI → Workout Builder constraint smoke checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
