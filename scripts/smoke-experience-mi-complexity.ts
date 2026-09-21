/**
 * Smoke: beginner vs advanced experience toggle uses MI complexity (not catalog labels alone).
 * Run: npx tsx scripts/smoke-experience-mi-complexity.ts
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

async function main() {
  const { exerciseDatabase } = await import('../src/data/exerciseDatabase');
  const {
    exerciseFitsExperienceComplexity,
    orderPoolForExperience,
    snapshotExerciseDemands,
  } = await import('../src/services/exerciseSelectionRanking');
  const { emptyWorkoutBuilderMiContext, enrichExercisePoolWithMi } = await import(
    '../src/services/WorkoutBuilderMiIntegration'
  );

  const {
    applyMiDemandToPrescription,
    biasSplitFocusesForExperience,
    designSessionShape,
    orderPlanExercisesForExperience,
  } = await import('../src/services/experienceMiPlanDesign');

  const byId = (id: string) => {
    const ex = exerciseDatabase.find((e) => e.id === id);
    if (!ex) throw new Error(`Missing catalog exercise ${id}`);
    return ex;
  };

  const strength = exerciseDatabase.filter((e) => e.category === 'strength');

  const beginnerCtx = emptyWorkoutBuilderMiContext('beginner', 'muscle_gain', 0);
  const advancedCtx = emptyWorkoutBuilderMiContext('advanced', 'muscle_gain', 0);

  const beginnerPool = enrichExercisePoolWithMi(strength, beginnerCtx);
  const advancedPool = enrichExercisePoolWithMi(strength, advancedCtx);

  const beginnerRejected = strength.filter(
    (ex) => !exerciseFitsExperienceComplexity(ex, 'beginner', { difficultyBias: 0 })
  );
  const advancedRejected = strength.filter(
    (ex) => !exerciseFitsExperienceComplexity(ex, 'advanced', { difficultyBias: 0 })
  );

  const begTop = orderPoolForExperience(beginnerPool.slice(0, 40), 'beginner').slice(0, 8);
  const advTop = orderPoolForExperience(advancedPool.slice(0, 40), 'advanced').slice(0, 8);

  const avg = (pool: typeof strength) => {
    if (!pool.length) return 0;
    return (
      pool.reduce((s, ex) => s + snapshotExerciseDemands(ex).compositeDifficulty, 0) / pool.length
    );
  };

  console.log('--- Experience MI complexity smoke ---');
  console.log(`strength sample: ${strength.length}`);
  console.log(
    `beginner gate keeps ${beginnerPool.length}/${strength.length} (rejected ${beginnerRejected.length})`
  );
  console.log(
    `advanced gate keeps ${advancedPool.length}/${strength.length} (rejected ${advancedRejected.length})`
  );
  console.log(`beginner pool avg composite: ${avg(beginnerPool).toFixed(3)}`);
  console.log(`advanced pool avg composite: ${avg(advancedPool).toFixed(3)}`);
  console.log('beginner top picks:', begTop.map((e) => e.name).join(' | '));
  console.log('advanced top picks:', advTop.map((e) => e.name).join(' | '));

  if (beginnerPool.length >= advancedPool.length) {
    throw new Error('Expected beginner MI gate to keep fewer (or equal only if sparse) than advanced');
  }
  if (beginnerRejected.length < 5) {
    throw new Error('Expected beginner to reject several high-complexity lifts');
  }
  if (avg(beginnerPool) >= avg(advancedPool)) {
    throw new Error('Expected beginner pool avg composite < advanced pool avg');
  }
  if (advancedRejected.length !== 0) {
    throw new Error('Advanced gate should allow full spectrum');
  }

  const goblet = byId('goblet-squats');
  const powerClean = byId('power-cleans-barbell');
  const bodyweightSquat = byId('bodyweight-squats');
  const pecDeck = byId('pec-deck-machine');

  if (exerciseFitsExperienceComplexity(powerClean, 'beginner', { difficultyBias: 0 })) {
    throw new Error('Expected beginner MI gate to reject Power Cleans');
  }

  const beginnerMain = applyMiDemandToPrescription(
    { sets: 3, reps: 8, restTime: 90 },
    goblet,
    'beginner',
    { goal: 'strength', role: 'main' }
  );
  const advancedMain = applyMiDemandToPrescription(
    { sets: 4, reps: 5, restTime: 150 },
    powerClean,
    'advanced',
    { goal: 'strength', role: 'main' }
  );
  const advancedIsolation = applyMiDemandToPrescription(
    { sets: 4, reps: 5, restTime: 150 },
    pecDeck,
    'advanced',
    { goal: 'strength', role: 'accessory' }
  );

  console.log('--- Experience MI plan design ---');
  console.log(
    `beginner goblet: ${beginnerMain.sets}x${beginnerMain.reps} rest ${beginnerMain.restTime}`
  );
  console.log(
    `advanced power clean: ${advancedMain.sets}x${advancedMain.reps} rest ${advancedMain.restTime}`
  );
  console.log(
    `advanced pec deck accessory: ${advancedIsolation.sets}x${advancedIsolation.reps} rest ${advancedIsolation.restTime}`
  );

  if (beginnerMain.reps < 8) {
    throw new Error('Beginner main lift should keep technique-volume reps (>=8)');
  }
  if (beginnerMain.sets > 3) {
    throw new Error('Beginner main lift should not exceed 3 working sets');
  }
  if ((advancedMain.restTime ?? 0) < (beginnerMain.restTime ?? 0)) {
    throw new Error('Advanced high-complexity main lift should rest at least as long as beginner');
  }
  if (advancedIsolation.reps <= advancedMain.reps) {
    throw new Error('Advanced isolation accessory should use higher reps than a high-demand main lift');
  }

  const begOrdered = orderPlanExercisesForExperience(
    [powerClean, goblet, bodyweightSquat],
    (ex) => ex,
    'beginner'
  );
  const advOrdered = orderPlanExercisesForExperience(
    [bodyweightSquat, goblet, powerClean],
    (ex) => ex,
    'advanced'
  );
  if (begOrdered[0].id === 'power-cleans-barbell') {
    throw new Error('Beginner main-lift order should not lead with Power Cleans');
  }
  if (advOrdered[0].id === 'bodyweight-squats') {
    throw new Error('Advanced main-lift order should not lead with Bodyweight Squats');
  }

  const beginnerSplit = biasSplitFocusesForExperience(
    ['Push', 'Pull', 'Legs', 'Push', 'Pull'],
    'beginner',
    5
  );
  const advancedSplit = biasSplitFocusesForExperience(
    ['Push', 'Pull', 'Legs', 'Push', 'Pull'],
    'advanced',
    5
  );
  if (beginnerSplit.some((f) => /^(Push|Pull|Legs)$/.test(f))) {
    throw new Error('Beginner PPL should remap to upper/lower/full-body frequency');
  }
  if (advancedSplit.join('|') !== 'Push|Pull|Legs|Push|Pull') {
    throw new Error('Advanced PPL split should stay intact');
  }
  if (designSessionShape('beginner').exercisesPerDay >= designSessionShape('advanced').exercisesPerDay) {
    throw new Error('Advanced sessions should include more exercises than beginner');
  }

  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
