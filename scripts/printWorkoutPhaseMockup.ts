/**
 * Print a grouped workout mockup (warm-up reps + phase blocks).
 * Run: npx tsx scripts/printWorkoutPhaseMockup.ts
 */

import { getExerciseData } from '../src/data/exerciseDatabase';
import { buildPlanPhaseBlocks, formatWarmupRepNote, getOptimalWarmupReps, WARMUP_REP_GUIDANCE } from '../src/utils/workoutPhaseDisplay';
import { buildTrackingExercises } from '../src/utils/workoutWarmupLogging';

const DYNAMIC_WARMUP = ['Leg Swings', 'Cat-Cow', 'Bird Dog', "World's Greatest Stretch", 'Inchworms'];
const PUSH_PREP = ['Scapular Push-ups', 'Band Pull-Aparts'];
const COOLDOWN = ['Hamstring Stretch', "Child's Pose", 'Shoulder Stretch', 'Hip Flexor Stretch'];

function buildWarmup(name: string, phase: 'Warm-Up' | 'Cooldown', durationSeconds = 75) {
  const data = getExerciseData(name);
  if (!data) return null;
  const reps = getOptimalWarmupReps(name);
  return {
    id: data.id || name.toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    sets: 1,
    reps: reps ?? 0,
    weight: 0,
    completed: false,
    category: 'flexibility' as const,
    durationSeconds,
    phase,
  };
}

function buildLift(name: string, sets: number, reps: number, phase: 'Main Lift' | 'Secondary Lifts' | 'Accessory Lifts' | 'Finisher') {
  const data = getExerciseData(name);
  if (!data) return null;
  return {
    id: data.id || name.toLowerCase().replace(/\s+/g, '-'),
    name: data.name,
    sets,
    reps,
    weight: 0,
    completed: false,
    category: 'strength' as const,
    restTime: phase === 'Main Lift' ? 120 : 60,
    phase,
  };
}

const raw = [
  ...DYNAMIC_WARMUP.map((n) => buildWarmup(n, 'Warm-Up', 90)).filter(Boolean),
  ...PUSH_PREP.map((n) => buildWarmup(n, 'Warm-Up', 75)).filter(Boolean),
  buildLift('Bench Press', 4, 6, 'Main Lift'),
  buildLift('Overhead Press', 4, 6, 'Secondary Lifts'),
  buildLift('Incline Dumbbell Press', 3, 8, 'Secondary Lifts'),
  buildLift('Lateral Raises', 3, 12, 'Accessory Lifts'),
  buildLift('Tricep Pushdowns', 3, 12, 'Accessory Lifts'),
  buildLift('Skater Jumps', 4, 4, 'Finisher'),
  ...COOLDOWN.map((n) => buildWarmup(n, 'Cooldown', 75)).filter(Boolean),
].filter(Boolean) as any[];

const tracking = buildTrackingExercises(raw);
const blocks = buildPlanPhaseBlocks(tracking);

console.log('\n=== Warm-up rep guidance (built into generator) ===');
console.log(JSON.stringify(WARMUP_REP_GUIDANCE, null, 2));
console.log('\nExample targets:');
for (const name of [...DYNAMIC_WARMUP.slice(0, 2), ...COOLDOWN.slice(0, 1)]) {
  console.log(`  ${name}: ${formatWarmupRepNote(name)}`);
}

console.log('\n=== Generated workout mockup — Push Day (intermediate strength) ===\n');

for (const block of blocks) {
  console.log(`${block.title.toUpperCase()}`);
  if (block.compact) {
    console.log(`  ${block.items.map((i) => i.name).join(' · ')}`);
    console.log(`  (${block.items.length} movements — rep targets shown during workout, not in this list)`);
  } else {
    for (const line of block.items) {
      if (line.sets && line.reps) console.log(`  ${line.name} — ${line.sets}×${line.reps}`);
      else console.log(`  ${line.name}`);
    }
  }
  console.log('');
}

console.log('During workout execution, warm-up / cool-down expand to show per-movement rep notes:');
const warmupBlock = tracking.find((ex) => ex.isWarmupBlock);
if (warmupBlock?.warmupItems) {
  for (const item of warmupBlock.warmupItems) {
    console.log(`  • ${item.name} — ${item.repNote ?? 'as listed'}`);
  }
}
