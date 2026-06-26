/**
 * Mirrors WorkoutScreen generateWorkoutPlan: systemic volume, split adjustment,
 * exercise pool filter, and getExerciseDetails — no React / AsyncStorage.
 * Run: npx tsx scripts/demoWorkoutCriteria.ts
 */

import { exerciseDatabase, ExerciseData } from '../src/data/exerciseDatabase';
import {
  computeSystemicVolumeContext,
  adjustSplitFocusesForSystemicTax,
  type SystemicVolumeContext,
} from '../src/utils/systemicVolume';

type Level = 'beginner' | 'intermediate' | 'advanced';
type Goal = 'strength' | 'muscle_gain' | 'weight_loss' | 'endurance' | 'flexibility';

function getStrengthSplitVariants(trainingDays: number): string[][] {
  if (trainingDays <= 3) {
    return [
      ['Full Body', 'Full Body', 'Full Body'],
      ['Upper Body', 'Lower Body', 'Full Body'],
      ['Chest & Back', 'Quads & Calves', 'Glutes & Hamstrings'],
    ];
  }
  if (trainingDays === 4) {
    return [
      ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'],
      ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings'],
      ['Push', 'Pull', 'Legs', 'Full Body'],
    ];
  }
  if (trainingDays === 5) {
    return [
      ['Push', 'Pull', 'Legs', 'Push', 'Pull'],
      ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings', 'Full Body'],
      ['Upper Body', 'Lower Body', 'Push', 'Pull', 'Legs'],
    ];
  }
  if (trainingDays === 6) {
    return [
      ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
      ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings', 'Upper Body', 'Lower Body'],
      ['Upper Body', 'Lower Body', 'Full Body', 'Push', 'Pull', 'Legs'],
    ];
  }
  return [
    ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Active Recovery'],
    ['Chest & Back', 'Arms & Shoulders', 'Quads & Calves', 'Glutes & Hamstrings', 'Upper Body', 'Lower Body', 'Active Recovery'],
    ['Upper Body', 'Lower Body', 'Full Body', 'Push', 'Pull', 'Legs', 'Active Recovery'],
  ];
}

function rawSplitFocuses(goal: Goal, days: number, variationIndex: number): string[] {
  if (goal === 'strength' || goal === 'muscle_gain' || goal === 'weight_loss') {
    const splitVariants = getStrengthSplitVariants(days);
    return splitVariants[variationIndex % splitVariants.length];
  }
  if (goal === 'endurance') return Array(days).fill('Cardio & Endurance');
  if (goal === 'flexibility') return Array(days).fill('Flexibility & Mobility');
  return Array(days).fill('Full Body');
}

function filterPool(
  level: Level,
  userEquipment: string,
  excludedExercises: string[]
): ExerciseData[] {
  let pool: ExerciseData[] = exerciseDatabase.filter((ex) => ex.category === 'strength');
  const eqLower = userEquipment.toLowerCase();
  if (eqLower && !eqLower.includes('full gym') && !eqLower.includes('all')) {
    const getEquipment = (ex: ExerciseData) => ex.equipmentRequired || ex.equipment || [];
    if (eqLower.includes('bodyweight') || eqLower.includes('no equipment')) {
      pool = pool.filter((ex) => {
        const eq = getEquipment(ex);
        return eq.includes('bodyweight') || eq.includes('none');
      });
    } else if (eqLower.includes('dumbbell')) {
      pool = pool.filter((ex) => {
        const eq = getEquipment(ex);
        return eq.includes('bodyweight') || eq.includes('dumbbells') || eq.includes('none');
      });
    }
  }
  pool = pool.filter((ex) => {
    if (level === 'beginner') return ex.difficulty === 'beginner' || ex.difficulty === 'intermediate';
    if (level === 'intermediate')
      return ex.difficulty === 'beginner' || ex.difficulty === 'intermediate' || ex.difficulty === 'advanced';
    return ex.difficulty === 'intermediate' || ex.difficulty === 'advanced';
  });
  return pool.filter((ex) => !excludedExercises.includes(ex.name));
}

function getExerciseDetails(
  exerciseData: ExerciseData,
  resolvedGoal: Goal,
  level: Level,
  systemicVolumeContext: SystemicVolumeContext
): { name: string; sets: number; reps: number; restTime?: number; compound: boolean } {
  const rawCategory = exerciseData.category;
  const exerciseCategory: 'strength' | 'cardio' | 'flexibility' | 'balance' =
    rawCategory === 'stability' ? 'balance' : rawCategory;
  let sets = 3;
  let reps = 10;
  let restTime: number | undefined;
  if (exerciseCategory === 'strength') {
    if (resolvedGoal === 'strength') {
      sets = level === 'beginner' ? 3 : 4;
      reps = level === 'beginner' ? 8 : level === 'intermediate' ? 6 : 5;
      restTime = level === 'beginner' ? 90 : level === 'intermediate' ? 120 : 150;
    } else if (resolvedGoal === 'muscle_gain') {
      sets = level === 'beginner' ? 3 : 4;
      reps = level === 'beginner' ? 10 : level === 'intermediate' ? 10 : 8;
      restTime = 60;
    } else if (resolvedGoal === 'weight_loss') {
      sets = 3;
      reps = level === 'beginner' ? 12 : 15;
      restTime = 45;
    } else {
      sets = level === 'beginner' ? 3 : 4;
      reps = level === 'beginner' ? 10 : level === 'intermediate' ? 8 : 6;
      restTime = 90;
    }
  }
  const isCompound = (exerciseData.secondaryMuscleGroups?.length ?? 0) >= 1;
  if (exerciseCategory === 'strength') {
    const maxReps = isCompound ? 10 : 20;
    reps = Math.min(reps, maxReps);
    if (systemicVolumeContext.strengthRepIntensityBias > 0) {
      reps = Math.max(isCompound ? 4 : 6, reps - systemicVolumeContext.strengthRepIntensityBias);
    }
    const { bracket, activityTier } = systemicVolumeContext;
    if (bracket === 'senior' || (activityTier === 'sedentary' && bracket === 'mid')) {
      sets = Math.max(2, sets - 1);
    }
  }
  return { name: exerciseData.name, sets, reps, restTime, compound: isCompound };
}

type Scenario = {
  label: string;
  age: string;
  activity: string;
  goal: Goal;
  level: Level;
  days: number;
  variationIndex: number;
  equipment?: string;
};

const scenarios: Scenario[] = [
  {
    label: 'A — Young + very active + muscle gain (5 days)',
    age: '24',
    activity: 'I lift 5x a week and play competitive basketball',
    goal: 'muscle_gain',
    level: 'intermediate',
    days: 5,
    variationIndex: 0,
  },
  {
    label: 'B — Mid-life + sedentary desk + strength (3 days)',
    age: '44',
    activity: 'Desk job, I sit most of the day, little other activity',
    goal: 'strength',
    level: 'beginner',
    days: 3,
    variationIndex: 0,
  },
  {
    label: 'C — Senior + active + weight loss (4 days)',
    age: '64',
    activity: 'I hike and swim twice a week, otherwise fairly active',
    goal: 'weight_loss',
    level: 'intermediate',
    days: 4,
    variationIndex: 0,
  },
  {
    label: 'D — Young + sedentary + muscle gain (3 days) — contrast with A',
    age: '22',
    activity: 'College student, mostly studying and gaming, walk to class',
    goal: 'muscle_gain',
    level: 'beginner',
    days: 3,
    variationIndex: 0,
  },
];

function run() {
  console.log('\n=== Demo: same generator rules as WorkoutScreen (sample day-1 lifts only) ===\n');
  for (const s of scenarios) {
    const ctx = computeSystemicVolumeContext({
      ageStr: s.age,
      activityDescription: s.activity,
    });
    const raw = rawSplitFocuses(s.goal, s.days, s.variationIndex);
    const focuses = adjustSplitFocusesForSystemicTax(raw, s.days, ctx);
    const exercisesPerDayBase = s.level === 'beginner' ? 4 : s.level === 'intermediate' ? 5 : 6;
    let exercisesPerDay = Math.max(3, exercisesPerDayBase - ctx.sessionExercisePenalty);

    const pool = filterPool(s.level, s.equipment || 'full gym', []);
    const picks = pool.slice(0, exercisesPerDay).map((ex) => getExerciseDetails(ex, s.goal, s.level, ctx));

    console.log(`--- ${s.label} ---`);
    console.log(`  Questions → age: ${s.age} | activity: "${s.activity.slice(0, 60)}..."`);
    console.log(`  Goal: ${s.goal} | Level: ${s.level} | Days/week: ${s.days}`);
    console.log(
      `  Systemic: bracket=${ctx.bracket} tier=${ctx.activityTier} | weekly sets/muscle: ${ctx.weeklySetsPerMuscleMin}–${ctx.weeklySetsPerMuscleMax} | MRV×${ctx.mrvMultiplier.toFixed(3)} | deload week=${ctx.deloadActive}`
    );
    console.log(`  Split (raw → adjusted): ${JSON.stringify(raw)} → ${JSON.stringify(focuses)}`);
    console.log(
      `  Session: ~${exercisesPerDay} strength slots/day (after systemic penalty ${ctx.sessionExercisePenalty}) | rep intensity bias: ${ctx.strengthRepIntensityBias}`
    );
    console.log('  Sample main lifts (first picks from filtered DB, order not full generator):');
    picks.forEach((p, i) => {
      console.log(
        `    ${i + 1}. ${p.name} — ${p.sets}×${p.reps}${p.restTime != null ? `, rest ${p.restTime}s` : ''}${p.compound ? ' (compound)' : ''}`
      );
    });
    console.log('');
  }
  console.log(
    'Note: Full app also adds warm-up blocks, optimal-peak phases, weekly set balancing across days, and exercise variety rules.\n'
  );
}

run();
