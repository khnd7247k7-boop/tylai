/**
 * Simulates random onboarding questionnaire inputs and reports parse results / friction.
 * Run: npx tsx scripts/testOnboardingParsing.ts
 */

import {
  parseGoalFromText,
  parseLevelFromText,
  parseDaysPerWeekFromText,
  parseWorkoutLengthMinutes,
  injuriesMentionBack,
} from '../src/utils/workoutQuestionnaireParse';

const RANDOM_SAMPLES = [
  { goals: 'Lose 30 pounds and feel healthier', experience: 'Complete beginner, never lifted', frequency: '3 days per week' },
  { goals: 'Build muscle and get stronger', experience: '2 years in the gym', frequency: '5-6 days per week' },
  { goals: 'Weekends only when kids are with ex', experience: 'Used to run marathons', frequency: 'Weekends only' },
  { goals: 'Getting back into fitness after injury', experience: 'Intermediate lifter', frequency: 'Twice a week' },
  { goals: 'First pull-up and better abs', experience: 'Beginner calisthenics', frequency: '4 days' },
  { goals: 'Powerlifting meet in 6 months', experience: 'Advanced, 5 years', frequency: '6 days per week' },
  { goals: 'Improve mobility and posture', experience: 'Desk job, sedentary', frequency: 'Every morning before work' },
  { goals: 'Train for a 5k', experience: 'Some running background', frequency: '3x weekly' },
];

const FREQUENCY_EDGE_CASES: Array<{ input: string; expected: number; label: string }> = [
  { input: 'Weekends only', expected: 2, label: 'weekends' },
  { input: 'Twice a week', expected: 2, label: 'twice' },
  { input: 'Every day', expected: 7, label: 'daily' },
  { input: 'Every morning before work', expected: 5, label: 'weekday 9-5' },
  { input: 'Monday through Friday', expected: 5, label: 'mon-fri spelled out' },
  { input: 'Mon-Fri before 9am', expected: 5, label: 'mon-fri shorthand' },
  { input: '5-6 days per week', expected: 6, label: 'range (first number)' },
  { input: 'Random schedule', expected: 3, label: 'unclear → default 3' },
];

const INJURY_EDGE_CASES: Array<{ input: string; shouldFlagBack: boolean }> = [
  { input: 'Getting back into fitness', shouldFlagBack: false },
  { input: 'Lower back pain', shouldFlagBack: true },
  { input: 'None', shouldFlagBack: false },
  { input: 'Recovering from shoulder surgery', shouldFlagBack: false },
];

let failures = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error('FAIL:', msg);
    failures += 1;
  }
}

console.log('=== Random onboarding samples ===\n');
for (const s of RANDOM_SAMPLES) {
  const goal = parseGoalFromText(s.goals);
  const level = parseLevelFromText(s.experience);
  const days = parseDaysPerWeekFromText(s.frequency);
  console.log(`Goals: "${s.goals.slice(0, 40)}..." → ${goal}`);
  console.log(`  Experience: ${level} | Frequency: "${s.frequency}" → ${days} days/week\n`);
}

console.log('=== Frequency edge cases ===\n');
for (const c of FREQUENCY_EDGE_CASES) {
  const got = parseDaysPerWeekFromText(c.input);
  const ok = got === c.expected;
  console.log(`${ok ? 'OK' : 'WARN'} "${c.input}" → ${got} (expected ${c.expected}, ${c.label})`);
  assert(ok, `${c.input}: got ${got}, expected ${c.expected}`);
}

console.log('\n=== Injury "back" false-positive check ===\n');
for (const c of INJURY_EDGE_CASES) {
  const got = injuriesMentionBack(c.input);
  const ok = got === c.shouldFlagBack;
  console.log(`${ok ? 'OK' : 'FAIL'} "${c.input}" → back injury: ${got}`);
  assert(ok, `${c.input}: back flag ${got}, expected ${c.shouldFlagBack}`);
}

console.log('\n=== Workout length ===\n');
assert(parseWorkoutLengthMinutes('45') === 45, '45 min');
assert(parseWorkoutLengthMinutes('about 60 minutes') === 60, '60 min embedded');
assert(parseWorkoutLengthMinutes('') === undefined, 'empty');

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
process.exit(failures > 0 ? 1 : 0);
