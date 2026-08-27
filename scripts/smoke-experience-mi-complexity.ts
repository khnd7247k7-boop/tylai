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

  const strength = exerciseDatabase.filter((e) => e.category === 'strength').slice(0, 200);

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

  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
