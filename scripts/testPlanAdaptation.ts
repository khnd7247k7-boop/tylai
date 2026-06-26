/**
 * Quick checks for PlanAdaptationService smart progression rules.
 * Run: npx tsx scripts/testPlanAdaptation.ts
 */
import { applyAdaptiveActionToWeeklyPlan, SET_CAPS } from '../src/services/planAdaptationLogic';
import { MAX_WORKING_SETS } from '../src/utils/progressionLimits';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const basePlan = {
  weekDays: [
    {
      dayName: 'Day 1',
      exercises: [
        {
          id: 'bench',
          name: 'Bench Press',
          sets: 4,
          reps: 8,
          weight: 135,
          category: 'strength' as const,
          phase: 'Main Lift',
          muscleGroups: ['chest', 'triceps'],
        },
      ],
    },
  ],
};

const history = [
  {
    id: '1',
    programId: 'p1',
    programName: 'Test',
    date: new Date().toISOString(),
    duration: 45,
    notes: '',
    completed: true,
    exercises: [
      {
        exerciseId: 'bench',
        name: 'Bench Press',
        sets: [
          { setNumber: 1, reps: 8, weight: 135, restTime: 90, completed: true },
          { setNumber: 2, reps: 8, weight: 135, restTime: 90, completed: true },
          { setNumber: 3, reps: 8, weight: 135, restTime: 90, completed: true },
          { setNumber: 4, reps: 8, weight: 135, restTime: 90, completed: true },
        ],
      },
    ],
  },
];

// At 4 sets with good completion → hypertrophy: rep progress below cap; at cap → load
const progress = applyAdaptiveActionToWeeklyPlan(basePlan, history as any, {
  adaptiveRecommendation: 'progress',
  progressionAllowed: true,
  challengeDial: 'balanced',
  progressionLever: 'volume',
});
const ex = progress.plan.weekDays[0].exercises[0];
assert(ex.sets === MAX_WORKING_SETS, `Expected ${MAX_WORKING_SETS} sets at cap, got ${ex.sets}`);
const setChange = progress.changes.find((c) => c.field === 'sets');
assert(!setChange, `Should not add a ${MAX_WORKING_SETS + 1}th working set`);
assert(
  progress.changes.some((c) => c.field === 'weight' || c.field === 'reps'),
  'Should progress via weight or reps at set cap'
);
assert(ex.reps <= 12, 'Hypertrophy compounds capped at 12 reps');

const hypertrophyCapPlan = {
  weekDays: [
    {
      exercises: [
        {
          id: 'bench',
          name: 'Bench Press',
          sets: 4,
          reps: 12,
          weight: 135,
          category: 'strength' as const,
          phase: 'Main Lift',
          muscleGroups: ['chest', 'triceps'],
        },
      ],
    },
  ],
};

const hypertrophyHistory = [
  {
    id: 'h1',
    programId: 'p1',
    programName: 'Hypertrophy',
    date: new Date().toISOString(),
    duration: 50,
    notes: '',
    completed: true,
    exercises: [
      {
        name: 'Bench Press',
        sets: Array.from({ length: 4 }, (_, i) => ({
          setNumber: i + 1,
          reps: 12,
          weight: 135,
          restTime: 90,
          completed: true,
        })),
      },
    ],
  },
];

const atCap = applyAdaptiveActionToWeeklyPlan(hypertrophyCapPlan, hypertrophyHistory as any, {
  adaptiveRecommendation: 'progress',
  progressionAllowed: true,
  challengeDial: 'balanced',
  progressionLever: 'volume',
});
const capEx = atCap.plan.weekDays[0].exercises[0];
assert(
  atCap.changes.some((c) => c.field === 'weight'),
  'At 12 rep cap should progress via load, not more reps'
);
assert(!atCap.changes.some((c) => c.field === 'reps' && c.newValue > 12), 'Must not exceed 12 reps on bench');
assert(capEx.reps <= 12, 'Plan reps stay at or below hypertrophy compound cap');
assert(capEx.weight === 140, `At 12-rep cap should add 5 lb minimum (135 → 140), got ${capEx.weight}`);

const pushupPlan = {
  weekDays: [
    {
      exercises: [
        {
          name: 'Push-ups',
          sets: 3,
          reps: 12,
          weight: 0,
          category: 'strength' as const,
          phase: 'Main Lift',
        },
      ],
    },
  ],
};

const pushHistory = [
  {
    id: '2',
    programId: 'p2',
    programName: 'Cali',
    date: new Date().toISOString(),
    duration: 30,
    notes: '',
    completed: true,
    exercises: [
      {
        exerciseId: 'push-ups',
        name: 'Push-ups',
        sets: Array.from({ length: 3 }, (_, i) => ({
          setNumber: i + 1,
          reps: 12,
          weight: 0,
          restTime: 60,
          completed: true,
        })),
      },
    ],
  },
];

const caliProgress = applyAdaptiveActionToWeeklyPlan(pushupPlan, pushHistory as any, {
  adaptiveRecommendation: 'progress',
  progressionAllowed: true,
  challengeDial: 'balanced',
  progressionLever: 'exercise_difficulty',
});
assert(
  caliProgress.plan.weekDays[0].exercises[0].name === 'Diamond Push-ups',
  'Calisthenics should progress to harder exercise'
);

// Simplify should reduce accessory volume
const accessoryPlan = {
  weekDays: [
    {
      exercises: [
        {
          name: 'Curls',
          sets: 3,
          reps: 12,
          weight: 25,
          category: 'strength' as const,
          phase: 'Accessory Lifts',
          muscleGroups: ['biceps'],
        },
      ],
    },
  ],
};
const simplify = applyAdaptiveActionToWeeklyPlan(accessoryPlan, history as any, {
  adaptiveRecommendation: 'simplify',
  progressionAllowed: false,
});
assert(
  simplify.plan.weekDays[0].exercises[0].sets < 3,
  'Simplify should drop accessory sets'
);

console.log('PlanAdaptationService tests passed.');
console.log('SET_CAPS.mainLift =', SET_CAPS.mainLift);
