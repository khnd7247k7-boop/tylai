/**
 * Movement Intelligence metadata for the exercise catalog.
 *
 * Extends ExerciseData with:
 * - movement qualities (hip strength/stability, knee control, scapular control, …)
 * - demand profile (strength, stability, mobility, coordination, balance, control, technical)
 * - laterality, joint demands, MI movement pattern
 * - regression → progression relationships and resolved alternatives
 *
 * Assignments are derived from each exercise's pattern, muscles, laterality,
 * category, and difficulty — plus curated overrides/edges for key lifts.
 * Does NOT change workout generation in this phase.
 */

import type {
  Difficulty,
  Equipment,
  ExerciseData,
  MovementPattern,
} from './exerciseDatabase';

/** Qualities an exercise meaningfully develops or challenges. */
export type ExerciseMovementQuality =
  | 'hipStrength'
  | 'hipStability'
  | 'hipMobility'
  | 'kneeControl'
  | 'kneeStrength'
  | 'ankleMobility'
  | 'ankleStability'
  | 'coreStability'
  | 'trunkStability'
  | 'antiRotation'
  | 'antiExtension'
  | 'singleLegControl'
  | 'shoulderStability'
  | 'shoulderStrength'
  | 'scapularControl'
  | 'rotatorCuffStrength'
  | 'thoracicMobility'
  | 'thoracicExtension'
  | 'gripStrength'
  | 'posteriorChainStrength'
  | 'horizontalPush'
  | 'horizontalPull'
  | 'verticalPush'
  | 'verticalPull'
  | 'explosivePower'
  | 'balance'
  | 'cardiorespiratory'
  | 'mobilityGeneral'
  | 'calfStrength'
  | 'elbowExtensorStrength'
  | 'elbowFlexorStrength';

export type DemandLevel = 'low' | 'moderate' | 'high';

export type JointKey =
  | 'ankle'
  | 'knee'
  | 'hip'
  | 'lumbar'
  | 'thoracic'
  | 'cervical'
  | 'shoulder'
  | 'scapula'
  | 'elbow'
  | 'wrist';

export type JointDemand = {
  joint: JointKey;
  demand: DemandLevel;
};

export type ExerciseLaterality = 'unilateral' | 'bilateral' | 'alternating';

/**
 * MI-facing movement pattern (aligns with movementIntelligence.MovementPattern).
 * Catalog keeps its own MovementPattern (includes stretch/isometric/cardio).
 */
export type MiMovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'rotate'
  | 'gait'
  | 'overhead'
  | 'isolation'
  | 'other';

export type ExerciseRelationshipKind =
  | 'regression'
  | 'progression'
  | 'alternative'
  | 'variation'
  | 'same_pattern'
  | 'same_quality';

export type ExerciseRelationship = {
  fromId: string;
  toId: string;
  kind: ExerciseRelationshipKind;
  /** Soft weight 0–1 for future ranking. */
  strength?: number;
};

/** Optional MI fields merged onto ExerciseData. */
export type ExerciseMiFields = {
  /** Normalized primary muscle labels (usually length 1). */
  primaryMuscles: string[];
  /** Normalized secondary muscle labels. */
  secondaryMuscles: string[];
  jointDemands: JointDemand[];
  mobilityDemand: DemandLevel;
  stabilityDemand: DemandLevel;
  strengthDemand: DemandLevel;
  coordinationDemand: DemandLevel;
  balanceDemand: DemandLevel;
  /** Precision / motor-control demand (distinct from whole-body coordination). */
  movementControlDemand: DemandLevel;
  technicalComplexity: DemandLevel;
  movementQualities: ExerciseMovementQuality[];
  laterality: ExerciseLaterality;
  /** Easier variants (exercise names in catalog when possible). */
  regressions: string[];
  /** Harder variants (exercise names in catalog when possible). */
  progressions: string[];
  /** Peer variations (often overlaps alternatives). */
  variations: string[];
  /** Pattern for MI engine (may differ from catalog stretch/isometric). */
  miMovementPattern: MiMovementPattern;
};

export type ExerciseDataWithMi = ExerciseData & ExerciseMiFields;

// ---------------------------------------------------------------------------
// Catalog pattern → MI pattern
// ---------------------------------------------------------------------------

export function toMiMovementPattern(
  pattern: MovementPattern,
  opts?: { name?: string; primaryMuscle?: string }
): MiMovementPattern {
  const name = (opts?.name ?? '').toLowerCase();
  const primary = (opts?.primaryMuscle ?? '').toLowerCase();

  // Single-joint / accessory work — only when the name clearly isolates.
  if (
    /curl|extension|raise|fly|flye|pullover|shrug|calf raise|wrist|external rotation|internal rotation|face.?pull|pull.?apart/.test(
      name
    ) &&
    !/clean|snatch|thruster|get-?up|push.?press|bench press|overhead press|row|deadlift|squat|lunge|pull-?up|chin-?up|dip|swing/.test(
      name
    )
  ) {
    return 'isolation';
  }

  if (
    /overhead|military press|push press|handstand|pike push|snatch|jerk|overhead carry|overhead squat/.test(
      name
    ) ||
    (pattern === 'push' && /press/.test(name) && /overhead|shoulder|military|arnold|seated/.test(name))
  ) {
    return 'overhead';
  }

  switch (pattern) {
    case 'squat':
      return 'squat';
    case 'hinge':
      return 'hinge';
    case 'lunge':
      return 'lunge';
    case 'push':
      return 'push';
    case 'pull':
      return 'pull';
    case 'carry':
      return 'carry';
    case 'rotation':
      return 'rotate';
    case 'gait':
      return 'gait';
    case 'stretch':
    case 'isometric':
    case 'cardio':
      return 'other';
    default:
      // Rare catalog gaps — treat pure arm/calf accessories by muscle if needed.
      if (/biceps|triceps|calves|forearm/.test(primary)) return 'isolation';
      return 'other';
  }
}

// ---------------------------------------------------------------------------
// Laterality
// ---------------------------------------------------------------------------

export function inferLaterality(name: string, pattern: MovementPattern): ExerciseLaterality {
  const n = name.toLowerCase();
  if (
    /alternating|walking lunge|farmer.?s? walk|march|high knees|butt kick/.test(n)
  ) {
    return 'alternating';
  }
  if (
    /single[- ]?leg|single[- ]?arm|one[- ]?leg|one[- ]?arm|unilateral|bulgarian|pistol|split squat|archer|cossack|side plank|single[- ]?leg glute|skater/.test(
      n
    )
  ) {
    return 'unilateral';
  }
  if (pattern === 'lunge' && !/jump/.test(n)) {
    // Most lunges are alternating or unilateral stance; treat as unilateral demand.
    return 'unilateral';
  }
  return 'bilateral';
}

// ---------------------------------------------------------------------------
// Demand helpers
// ---------------------------------------------------------------------------

function maxDemand(a: DemandLevel, b: DemandLevel): DemandLevel {
  const rank = { low: 0, moderate: 1, high: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function difficultyStrengthDemand(d: Difficulty, category: ExerciseData['category']): DemandLevel {
  if (category === 'flexibility' || category === 'balance') {
    return d === 'advanced' ? 'moderate' : 'low';
  }
  if (category === 'cardio') {
    return d === 'advanced' ? 'moderate' : 'low';
  }
  if (d === 'advanced') return 'high';
  if (d === 'intermediate') return 'moderate';
  return 'low';
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function pushJoint(out: JointDemand[], joint: JointKey, demand: DemandLevel) {
  const existing = out.find((j) => j.joint === joint);
  if (existing) {
    existing.demand = maxDemand(existing.demand, demand);
  } else {
    out.push({ joint, demand });
  }
}

// ---------------------------------------------------------------------------
// Characteristic-based quality / demand derivation
// ---------------------------------------------------------------------------

function qualitiesForExercise(ex: ExerciseData, laterality: ExerciseLaterality): ExerciseMovementQuality[] {
  const q: ExerciseMovementQuality[] = [];
  const n = ex.name.toLowerCase();
  const primary = ex.primaryMuscleGroup.toLowerCase();
  const secondary = ex.secondaryMuscleGroups.map((s) => s.toLowerCase());
  const has = (m: string) => primary.includes(m) || secondary.some((s) => s.includes(m));

  switch (ex.movementPattern) {
    case 'squat':
      q.push('hipStrength', 'kneeControl', 'kneeStrength', 'ankleMobility', 'trunkStability');
      if (laterality === 'unilateral') q.push('singleLegControl', 'hipStability');
      break;
    case 'hinge':
      q.push('posteriorChainStrength', 'hipStrength', 'trunkStability');
      if (laterality === 'unilateral') q.push('singleLegControl', 'hipStability', 'balance');
      if (/rdl|romanian|good morning|back extension/.test(n)) q.push('hipMobility');
      break;
    case 'lunge':
      q.push('hipStrength', 'kneeControl', 'singleLegControl', 'ankleStability', 'trunkStability');
      if (/lateral|cossack/.test(n)) q.push('hipMobility', 'hipStability');
      break;
    case 'push':
      if (/overhead|military|push press|handstand|pike/.test(n)) {
        q.push('verticalPush', 'shoulderStability', 'shoulderStrength', 'scapularControl', 'coreStability');
      } else {
        q.push('horizontalPush', 'shoulderStrength', 'scapularControl');
      }
      if (has('triceps') || /dip|skull|extension|close.?grip/.test(n)) q.push('elbowExtensorStrength');
      if (has('core') || /push-?up|plank/.test(n)) q.push('antiExtension', 'coreStability');
      break;
    case 'pull':
      if (/pulldown|pull-?up|chin-?up|lat/.test(n)) {
        q.push('verticalPull', 'scapularControl', 'shoulderStability');
      } else {
        q.push('horizontalPull', 'scapularControl');
      }
      if (has('biceps') || /curl|chin/.test(n)) q.push('elbowFlexorStrength');
      if (/face pull|external|rotator|rear delt/.test(n) || primary.includes('rotator')) {
        q.push('rotatorCuffStrength', 'shoulderStability');
      }
      break;
    case 'carry':
      q.push('gripStrength', 'coreStability', 'trunkStability', 'shoulderStability');
      if (/suitcase|single/.test(n)) q.push('antiRotation');
      break;
    case 'rotation':
      q.push('antiRotation', 'coreStability', 'thoracicMobility');
      if (has('hip') || /woodchop|med ball|landmine/.test(n)) q.push('hipStability');
      break;
    case 'gait':
      q.push('ankleStability', 'hipStability', 'singleLegControl', 'balance');
      if (ex.category === 'cardio') q.push('cardiorespiratory');
      break;
    case 'isometric':
      q.push('coreStability', 'trunkStability');
      if (/side plank|pallof/.test(n)) q.push('antiRotation');
      if (/plank|dead bug|hollow/.test(n)) q.push('antiExtension');
      if (laterality === 'unilateral') q.push('hipStability', 'singleLegControl');
      break;
    case 'stretch':
      q.push('mobilityGeneral');
      if (/hip|pigeon|couch|90.?90|frog/.test(n) || primary.includes('hip')) q.push('hipMobility');
      if (/ankle|calf|soleus/.test(n) || primary.includes('ankle') || primary.includes('calf')) {
        q.push('ankleMobility');
      }
      if (/thoracic|t-?spine|open book|rotation|cat.?cow|spinal/.test(n)) {
        q.push('thoracicMobility', 'thoracicExtension');
      }
      if (/shoulder|pec|doorway/.test(n) || primary.includes('shoulder') || primary.includes('chest')) {
        q.push('shoulderStability'); // soft tissue length with control emphasis — keep mild
      }
      break;
    case 'cardio':
      q.push('cardiorespiratory');
      break;
    default:
      break;
  }

  // Muscle-driven additives (only when characteristic matches)
  if (primary.includes('glute') || has('glutes')) q.push('hipStrength');
  if (primary.includes('calf') || primary.includes('calves')) q.push('calfStrength', 'ankleStability');
  if (primary.includes('rotator') || /external rotation|internal rotation|face.?pull|band pull.?apart/.test(n)) {
    q.push('rotatorCuffStrength', 'shoulderStability', 'scapularControl');
  }
  if (/thoracic|t-?spine|open.?book/.test(n)) q.push('thoracicMobility', 'thoracicExtension');
  if (ex.category === 'balance') q.push('balance', 'ankleStability');
  if (ex.category === 'stability') q.push('coreStability', 'hipStability');
  if (
    /jump|hop|bound|plyo|slam|throw|snatch|clean|swing|box jump|depth jump|pogos|skater/.test(n)
  ) {
    q.push('explosivePower');
  }
  if (/turkish get|get-?up/.test(n)) {
    q.push('shoulderStability', 'coreStability', 'hipMobility', 'trunkStability', 'balance');
  }

  return uniq(q);
}

function jointDemandsForExercise(
  ex: ExerciseData,
  laterality: ExerciseLaterality
): JointDemand[] {
  const out: JointDemand[] = [];
  const n = ex.name.toLowerCase();
  const str = difficultyStrengthDemand(ex.difficulty, ex.category);

  switch (ex.movementPattern) {
    case 'squat':
      pushJoint(out, 'ankle', 'high');
      pushJoint(out, 'knee', 'high');
      pushJoint(out, 'hip', 'high');
      pushJoint(out, 'lumbar', ex.difficulty === 'beginner' ? 'moderate' : 'high');
      break;
    case 'hinge':
      pushJoint(out, 'hip', 'high');
      pushJoint(out, 'lumbar', 'high');
      pushJoint(out, 'knee', 'low');
      if (laterality === 'unilateral') pushJoint(out, 'ankle', 'moderate');
      break;
    case 'lunge':
      pushJoint(out, 'knee', 'high');
      pushJoint(out, 'hip', 'high');
      pushJoint(out, 'ankle', 'moderate');
      pushJoint(out, 'lumbar', 'moderate');
      break;
    case 'push':
      pushJoint(out, 'shoulder', 'high');
      pushJoint(out, 'scapula', 'moderate');
      pushJoint(out, 'elbow', 'moderate');
      if (/overhead|handstand|pike|military/.test(n)) {
        pushJoint(out, 'shoulder', 'high');
        pushJoint(out, 'thoracic', 'moderate');
        pushJoint(out, 'lumbar', 'moderate');
      }
      break;
    case 'pull':
      pushJoint(out, 'shoulder', 'moderate');
      pushJoint(out, 'scapula', 'high');
      pushJoint(out, 'elbow', 'moderate');
      break;
    case 'carry':
      pushJoint(out, 'shoulder', 'moderate');
      pushJoint(out, 'lumbar', 'moderate');
      pushJoint(out, 'wrist', str === 'high' ? 'moderate' : 'low');
      break;
    case 'rotation':
      pushJoint(out, 'thoracic', 'high');
      pushJoint(out, 'lumbar', 'moderate');
      pushJoint(out, 'hip', 'moderate');
      break;
    case 'gait':
      pushJoint(out, 'ankle', 'moderate');
      pushJoint(out, 'hip', 'moderate');
      pushJoint(out, 'knee', 'moderate');
      break;
    case 'isometric':
      pushJoint(out, 'lumbar', 'moderate');
      pushJoint(out, 'shoulder', /plank|push/.test(n) ? 'moderate' : 'low');
      if (laterality === 'unilateral') pushJoint(out, 'hip', 'moderate');
      break;
    case 'stretch':
      if (/hip|pigeon|hamstring|glute|quad|couch|90/.test(n) || /hip|glute|hamstring|quad/.test(ex.primaryMuscleGroup.toLowerCase())) {
        pushJoint(out, 'hip', 'moderate');
        if (/quad|hamstring/.test(n) || /quad|hamstring/.test(ex.primaryMuscleGroup.toLowerCase())) {
          pushJoint(out, 'knee', 'low');
        }
      }
      if (/ankle|calf/.test(n) || /ankle|calf/.test(ex.primaryMuscleGroup.toLowerCase())) {
        pushJoint(out, 'ankle', 'moderate');
      }
      if (/shoulder|chest|pec|arm/.test(n) || /shoulder|chest/.test(ex.primaryMuscleGroup.toLowerCase())) {
        pushJoint(out, 'shoulder', 'moderate');
      }
      if (/thoracic|spine|twist|fold|dog|child/.test(n) || /back|spine/.test(ex.primaryMuscleGroup.toLowerCase())) {
        pushJoint(out, 'thoracic', 'moderate');
        pushJoint(out, 'lumbar', 'low');
      }
      if (/neck|cervical/.test(n)) pushJoint(out, 'cervical', 'moderate');
      if (!out.length) {
        // Generic mobility drill — light multi-joint demand rather than inventing a diagnosis.
        pushJoint(out, 'hip', 'low');
        pushJoint(out, 'thoracic', 'low');
      }
      break;
    case 'cardio':
      pushJoint(out, 'knee', /run|jump|sprint|burpee/.test(n) ? 'moderate' : 'low');
      pushJoint(out, 'ankle', /run|jump|rope|sprint/.test(n) ? 'moderate' : 'low');
      break;
    default:
      break;
  }

  return out;
}

function demandProfile(
  ex: ExerciseData,
  qualities: ExerciseMovementQuality[],
  laterality: ExerciseLaterality
): Pick<
  ExerciseMiFields,
  | 'mobilityDemand'
  | 'stabilityDemand'
  | 'strengthDemand'
  | 'coordinationDemand'
  | 'balanceDemand'
  | 'movementControlDemand'
  | 'technicalComplexity'
> {
  const n = ex.name.toLowerCase();
  let mobility: DemandLevel = 'low';
  let stability: DemandLevel = 'low';
  let strength = difficultyStrengthDemand(ex.difficulty, ex.category);
  let control: DemandLevel = 'low';
  let coordination: DemandLevel = 'low';
  let balance: DemandLevel = 'low';
  let technical: DemandLevel = 'low';

  if (ex.category === 'flexibility' || ex.movementPattern === 'stretch') {
    mobility = ex.difficulty === 'advanced' ? 'high' : 'moderate';
    strength = 'low';
  }
  if (
    qualities.includes('ankleMobility') ||
    qualities.includes('hipMobility') ||
    qualities.includes('thoracicMobility')
  ) {
    mobility = maxDemand(mobility, 'moderate');
  }
  if (ex.movementPattern === 'squat' || /overhead|snatch|pistol|cossack/.test(n)) {
    mobility = maxDemand(mobility, ex.difficulty === 'beginner' ? 'moderate' : 'high');
  }

  if (
    laterality === 'unilateral' ||
    ex.category === 'balance' ||
    ex.category === 'stability' ||
    qualities.includes('singleLegControl') ||
    qualities.includes('shoulderStability') ||
    qualities.includes('coreStability')
  ) {
    stability = maxDemand(stability, 'moderate');
  }
  if (
    laterality === 'unilateral' &&
    (ex.movementPattern === 'squat' ||
      ex.movementPattern === 'hinge' ||
      ex.movementPattern === 'lunge')
  ) {
    stability = 'high';
    control = 'high';
    balance = 'high';
  }
  if (qualities.includes('kneeControl') || qualities.includes('scapularControl')) {
    control = maxDemand(control, 'moderate');
  }
  if (/pistol|handstand|turkish|archer|muscle-?up|snatch|clean.?and.?jerk/.test(n)) {
    control = 'high';
    stability = 'high';
    coordination = 'high';
    technical = 'high';
  }
  if (ex.movementPattern === 'isometric') {
    stability = maxDemand(stability, 'moderate');
    control = maxDemand(control, 'moderate');
    strength = maxDemand(strength, 'low');
  }
  if (ex.category === 'cardio' && !/sled|farmer|swing/.test(n)) {
    strength = maxDemand(strength, 'low');
  }

  // Balance demand from stance / category / qualities
  if (ex.category === 'balance' || qualities.includes('balance')) {
    balance = maxDemand(balance, ex.difficulty === 'beginner' ? 'moderate' : 'high');
  }
  if (laterality === 'unilateral' || laterality === 'alternating') {
    balance = maxDemand(balance, 'moderate');
  }
  if (/seated|machine|pec.?deck|leg press|smith/.test(n)) {
    balance = 'low';
  }

  // Coordination: whole-body sequencing / multi-task movements
  if (
    /clean|snatch|thruster|burpee|get-?up|complex|woodchop|mountain.?climber|jump.?rope|battle.?rope/.test(
      n
    ) ||
    ex.movementPattern === 'gait' ||
    (ex.movementPattern === 'rotation' && ex.difficulty !== 'beginner')
  ) {
    coordination = maxDemand(coordination, 'moderate');
  }
  if (
    /turkish|clean.?and.?press|power.?clean|thruster|burpee|snatch|muscle-?up|handstand/.test(n)
  ) {
    coordination = 'high';
  }
  if (
    /curl|raise|fly|extension|calf|pulldown|machine|pec.?deck|seated calf/.test(n) &&
    !/clean|thruster|burpee/.test(n)
  ) {
    coordination = maxDemand(coordination, 'low');
  }
  if (laterality === 'alternating') {
    coordination = maxDemand(coordination, 'moderate');
  }
  if (ex.difficulty === 'advanced' && ex.category === 'strength') {
    coordination = maxDemand(coordination, 'moderate');
  }

  // Technical complexity: skill / cue density (not the same as load)
  if (ex.difficulty === 'beginner') technical = maxDemand(technical, 'low');
  if (ex.difficulty === 'intermediate') technical = maxDemand(technical, 'moderate');
  if (ex.difficulty === 'advanced') technical = maxDemand(technical, 'high');
  if (
    /smith|machine|leg press|pec.?deck|seated|assisted|knee push|incline push/.test(n) &&
    !/overhead squat|turkish|clean|snatch/.test(n)
  ) {
    technical = maxDemand(technical, ex.difficulty === 'advanced' ? 'moderate' : 'low');
  }
  if (
    /overhead squat|turkish|clean|snatch|muscle-?up|handstand|pistol|cossack|good morning|front squat|rdl|romanian/.test(
      n
    )
  ) {
    technical = maxDemand(technical, 'high');
  }
  if (ex.movementPattern === 'stretch' || ex.category === 'flexibility') {
    technical = maxDemand(technical, ex.difficulty === 'advanced' ? 'moderate' : 'low');
  }

  // Control stays precision-focused; bump with high technical skill where relevant
  if (technical === 'high') control = maxDemand(control, 'moderate');

  return {
    mobilityDemand: mobility,
    stabilityDemand: stability,
    strengthDemand: strength,
    coordinationDemand: coordination,
    balanceDemand: balance,
    movementControlDemand: control,
    technicalComplexity: technical,
  };
}

// ---------------------------------------------------------------------------
// Curated overrides (only where generic rules under-specify)
// ---------------------------------------------------------------------------

const QUALITY_OVERRIDES: Record<string, ExerciseMovementQuality[]> = {
  squat: ['hipStrength', 'kneeStrength', 'kneeControl', 'ankleMobility', 'trunkStability'],
  'bodyweight-squats': [
    'hipStrength',
    'kneeStrength',
    'kneeControl',
    'ankleMobility',
    'trunkStability',
  ],
  'goblet-squats': [
    'hipStrength',
    'kneeControl',
    'kneeStrength',
    'ankleMobility',
    'trunkStability',
    'coreStability',
  ],
  'front-squats-barbell': [
    'hipStrength',
    'kneeStrength',
    'kneeControl',
    'ankleMobility',
    'trunkStability',
    'thoracicMobility',
  ],
  'overhead-squats': [
    'hipStrength',
    'kneeControl',
    'ankleMobility',
    'shoulderStability',
    'thoracicMobility',
    'thoracicExtension',
    'trunkStability',
    'coreStability',
  ],
  deadlift: ['posteriorChainStrength', 'hipStrength', 'trunkStability', 'gripStrength'],
  'romanian-deadlift': ['posteriorChainStrength', 'hipStrength', 'hipMobility', 'trunkStability'],
  'bench-press': ['horizontalPush', 'shoulderStrength', 'scapularControl', 'elbowExtensorStrength'],
  'overhead-press': [
    'verticalPush',
    'shoulderStrength',
    'shoulderStability',
    'scapularControl',
    'coreStability',
  ],
  'pull-ups': [
    'verticalPull',
    'scapularControl',
    'shoulderStability',
    'elbowFlexorStrength',
    'gripStrength',
  ],
  'bulgarian-split-squats': [
    'hipStrength',
    'kneeControl',
    'singleLegControl',
    'ankleStability',
    'trunkStability',
  ],
  plank: ['coreStability', 'antiExtension', 'trunkStability', 'shoulderStability'],
  'side-plank': ['coreStability', 'antiRotation', 'hipStability', 'shoulderStability'],
  'band-pull-aparts': ['scapularControl', 'rotatorCuffStrength', 'shoulderStability'],
  'shoulder-external-rotations': ['rotatorCuffStrength', 'shoulderStability', 'scapularControl'],
  'thoracic-rotations': ['thoracicMobility', 'thoracicExtension', 'trunkStability'],
  'cat-cow': ['thoracicMobility', 'thoracicExtension', 'mobilityGeneral'],
  'one-legged-deadlift': [
    'posteriorChainStrength',
    'hipStability',
    'singleLegControl',
    'balance',
    'trunkStability',
  ],
  'single-leg-deadlift-dumbbells': [
    'posteriorChainStrength',
    'hipStability',
    'singleLegControl',
    'balance',
    'trunkStability',
  ],
  'turkish-get-ups': [
    'shoulderStability',
    'coreStability',
    'hipMobility',
    'trunkStability',
    'balance',
    'singleLegControl',
  ],
  'farmers-walk': ['gripStrength', 'coreStability', 'trunkStability', 'shoulderStability'],
  'suitcase-carry-dumbbells': [
    'gripStrength',
    'antiRotation',
    'coreStability',
    'trunkStability',
    'shoulderStability',
  ],
};

/**
 * Explicit easier → harder edges (by exercise id).
 * Only catalog ids; forms A → B → C chains for adaptive selection later.
 */
const PROGRESSION_EDGES: Array<[string, string]> = [
  // Horizontal push
  ['knee-push-ups', 'incline-push-ups'],
  ['incline-push-ups', 'push-ups'],
  ['scapular-push-ups', 'push-ups'],
  ['push-ups', 'wide-push-ups'],
  ['push-ups', 'diamond-push-ups'],
  ['diamond-push-ups', 'close-grip-push-ups'],
  ['close-grip-push-ups', 'decline-push-ups'],
  ['decline-push-ups', 'plyo-push-ups'],
  ['push-ups', 'dumbbell-push-ups'],
  ['resistance-band-push-ups', 'push-ups'],
  ['dumbbell-bench-press', 'bench-press'],
  ['incline-dumbbell-press', 'smith-machine-incline-bench-press'],
  ['resistance-band-chest-press', 'cable-chest-press'],
  ['cable-chest-press', 'dumbbell-bench-press'],
  ['chest-fly', 'cable-chest-fly'],
  ['resistance-band-chest-fly', 'cable-chest-fly'],
  ['cable-chest-fly', 'pec-deck-machine'],
  ['assisted-dips', 'dips'],

  // Vertical / overhead push
  ['pike-push-ups', 'dumbbell-shoulder-press'],
  ['resistance-band-shoulder-press', 'dumbbell-shoulder-press'],
  ['seated-dumbbell-press', 'dumbbell-shoulder-press'],
  ['dumbbell-shoulder-press', 'overhead-press'],
  ['kettlebell-press', 'overhead-press'],
  ['smith-machine-shoulder-press', 'overhead-press'],
  ['shoulder-press', 'overhead-press'],
  ['arnold-press', 'overhead-press'],
  ['landmine-press', 'dumbbell-shoulder-press'],

  // Pull / vertical pull
  ['scapular-pull-ups', 'assisted-pull-ups'],
  ['assisted-pull-ups', 'resistance-band-pull-ups'],
  ['resistance-band-pull-ups', 'pull-ups'],
  ['lat-pulldowns', 'assisted-pull-ups'],
  ['pull-ups', 'chin-ups'],
  ['chin-ups', 'close-grip-pull-ups'],
  ['pull-ups', 'wide-grip-pull-ups'],
  ['inverted-rows', 'resistance-band-rows'],
  ['resistance-band-rows', 'dumbbell-row'],
  ['dumbbell-row', 'barbell-row'],
  ['cable-rows', 'barbell-row'],
  ['kettlebell-row', 'dumbbell-row'],
  ['smith-machine-row', 'barbell-row'],
  ['t-bar-row', 'barbell-row'],

  // Squat family
  ['bodyweight-squats', 'resistance-band-squats'],
  ['resistance-band-squats', 'goblet-squats'],
  ['goblet-squats-dumbbells', 'goblet-squats'],
  ['goblet-squats-kettlebell', 'goblet-squats'],
  ['goblet-squats', 'dumbbell-squats'],
  ['goblet-squats', 'front-squats-dumbbells'],
  // Learn → Control → Load ladder (Goblet → Front → Back)
  ['goblet-squats', 'front-squats-barbell'],
  ['dumbbell-squats', 'front-squats-dumbbells'],
  ['front-squats-dumbbells', 'front-squats-barbell'],
  ['front-squats-barbell', 'squat'],
  ['front-squats-barbell', 'overhead-squats'],
  ['smith-machine-squat', 'squat'],
  ['leg-press', 'smith-machine-squat'],
  // Split squat family: supported → split → Bulgarian
  ['lunges', 'reverse-lunges'],
  ['reverse-lunges', 'bulgarian-split-squats-bodyweight'],
  ['bodyweight-squats', 'bulgarian-split-squats-bodyweight'],
  ['lunges', 'bulgarian-split-squats-bodyweight'],
  ['bulgarian-split-squats-bodyweight', 'bulgarian-split-squats-dumbbells'],
  ['bulgarian-split-squats-dumbbells', 'bulgarian-split-squats'],

  // Hinge / posterior chain
  ['glute-bridge-bodyweight', 'glute-bridge-dumbbells'],
  ['glute-bridge-dumbbells', 'hip-thrusts-dumbbells'],
  ['hip-thrusts-dumbbells', 'hip-thrusts-barbell'],
  ['banded-glute-bridges', 'hip-thrusts-resistance-bands'],
  ['glute-bridge-bodyweight', 'single-leg-glute-bridge'],
  ['good-mornings-bodyweight', 'good-mornings-dumbbells'],
  ['good-mornings-dumbbells', 'good-mornings-barbell'],
  ['resistance-band-deadlift', 'dumbbell-deadlift'],
  ['dumbbell-deadlift', 'kettlebell-deadlift'],
  ['kettlebell-deadlift', 'deadlift'],
  ['romanian-deadlift-dumbbells', 'romanian-deadlift-kettlebell'],
  ['romanian-deadlift-kettlebell', 'romanian-deadlift'],
  ['romanian-deadlift', 'deadlift'],
  ['smith-machine-romanian-deadlift', 'romanian-deadlift'],
  // Bilateral → kickstand/assisted unilateral → full single-leg RDL
  ['romanian-deadlift-dumbbells', 'one-legged-deadlift'],
  ['single-leg-stand', 'one-legged-deadlift'],
  ['one-legged-deadlift', 'single-leg-deadlift-dumbbells'],

  // Lunge / single-leg
  ['lunges', 'dumbbell-lunges'],
  ['dumbbell-lunges', 'kettlebell-lunges'],
  ['lunges', 'reverse-lunges'],
  ['reverse-lunges', 'walking-lunges'],
  ['walking-lunges', 'bulgarian-split-squats'],
  ['resistance-band-lunges', 'dumbbell-lunges'],
  ['lateral-lunges', 'cossack-squat-hops'],

  // Carry
  ['farmers-walk-kettlebells', 'farmers-walk'],
  ['suitcase-carry-dumbbells', 'suitcase-carry-kettlebells'],
  ['overhead-carry-dumbbells', 'overhead-carry-kettlebells'],

  // Core / isometric
  ['forearm-plank', 'plank'],
  ['plank', 'side-plank'],
  ['plank', 'resistance-band-plank'],
  ['plank', 'plank-shoulder-taps'],
  ['plank-shoulder-taps', 'plank-leg-lifts'],
  ['dead-bug', 'resistance-band-dead-bug'],
  ['resistance-band-dead-bug', 'weighted-dead-bug'],
  ['bird-dog', 'resistance-band-bird-dog'],
  ['resistance-band-bird-dog', 'weighted-bird-dog'],
  ['crunches', 'sit-ups'],
  ['sit-ups', 'cable-crunches'],
  ['hollow-body-hold', 'ab-wheel-rollouts'],
  ['hanging-knee-raises', 'ab-wheel-rollouts'],
  ['russian-twists-bodyweight', 'russian-twists-dumbbells'],
  ['russian-twists-dumbbells', 'russian-twists-kettlebell'],
  ['resistance-band-twists', 'cable-twists'],
  ['cable-woodchoppers', 'cable-twists'],

  // Arms / isolation
  ['resistance-band-curls', 'bicep-curls'],
  ['bicep-curls', 'barbell-curls'],
  ['hammer-curls-resistance-bands', 'hammer-curls'],
  ['hammer-curls', 'cable-hammer-curls'],
  ['concentration-curls', 'preacher-curls'],
  ['resistance-band-tricep-extensions', 'tricep-extensions'],
  ['tricep-extensions', 'cable-tricep-extensions'],
  ['overhead-tricep-extension-resistance-bands', 'overhead-tricep-extension-dumbbells'],
  ['resistance-band-lateral-raises', 'lateral-raises'],
  ['lateral-raises', 'cable-lateral-raises'],
  ['cable-lateral-raises', 'leaning-lateral-raises'],
  ['front-raises-resistance-bands', 'front-raises-dumbbells'],
  ['calf-raises', 'dumbbell-calf-raises'],
  ['dumbbell-calf-raises', 'standing-calf-raises-barbell'],
  ['calf-raises', 'single-leg-calf-raises'],
  ['seated-calf-raises-dumbbells', 'standing-calf-raises-barbell'],

  // Swings / olympic-ish
  ['resistance-band-swings', 'dumbbell-swings'],
  ['dumbbell-swings', 'kettlebell-swings'],
  ['kettlebell-swings', 'single-arm-swings'],
  ['modified-turkish-get-ups', 'turkish-get-ups-dumbbells'],
  ['turkish-get-ups-dumbbells', 'turkish-get-ups'],
  ['clean-and-press-dumbbells', 'clean-and-press-kettlebells'],
  ['clean-and-press-kettlebells', 'clean-and-press'],
  ['power-cleans-dumbbells', 'power-cleans-barbell'],
  ['thrusters-dumbbells', 'thrusters-kettlebells'],
  ['thrusters-kettlebells', 'thrusters'],
  ['squat-to-press-dumbbells', 'thrusters-dumbbells'],

  // Cardio / plyo progressions (same movement family)
  ['walking', 'jogging'],
  ['jogging', 'running'],
  ['running', 'treadmill'],
  ['stationary-bike', 'cycling'],
  ['modified-burpees', 'burpees'],
  ['burpees', 'dumbbell-burpees'],
  ['mountain-climbers', 'cross-body-mountain-climbers'],
  ['high-knees', 'weighted-high-knees'],
  ['box-jumps', 'box-jump-ups'],
  ['box-jump-ups', 'depth-jumps'],
  ['single-leg-linear-hops', 'single-leg-drop-landings'],
  ['lateral-pogos', 'skater-jumps'],
  ['frog-jumps', 'tuck-jumps'],
  ['split-squat-jumps', 'depth-jumps'],

  // Mobility / prep (easier → more integrated)
  ['arm-circles', 'scapular-push-ups'],
  ['scapular-push-ups', 'band-pull-aparts'],
  ['cat-cow', 'thoracic-rotations'],
  ['thoracic-rotations', 'worlds-greatest-stretch'],
  ['childs-pose', 'downward-dog'],
  ['forward-fold', 'downward-dog'],
  ['hamstring-stretch', 'forward-fold'],
  ['hip-flexor-stretch', 'worlds-greatest-stretch'],
  ['calf-stretch', 'ankle-rolls-bottom-squat-transfer'],
  ['doorway-chest-stretch', 'chest-opener'],
  ['jumping-jacks', 'high-knees'],
  ['inchworms', 'worlds-greatest-stretch'],
  ['superman', 'bird-dog'],
  ['wall-sit', 'bodyweight-squats'],
  ['snap-downs', 'box-jumps'],
  ['spinal-twist', 'thoracic-rotations'],
  ['shoulder-stretch', 'doorway-chest-stretch'],
  ['quad-stretch', 'hip-flexor-stretch'],
  ['neck-stretch', 'shoulder-stretch'],
  ['shoulder-external-rotations', 'band-pull-aparts'],
  ['butt-kicks', 'high-knees'],
  ['elliptical', 'stationary-bike'],
  ['leg-swings', 'worlds-greatest-stretch'],
  ['plank', 'plank-jacks'],
];

/**
 * Map authored alternative labels → catalog display names when wording differs.
 * Only aliases that map to a real catalog exercise.
 */
const ALTERNATIVE_NAME_ALIASES: Record<string, string> = {
  'hip thrusts': 'Hip Thrusts (Barbell)',
  'russian twists': 'Russian Twists (Bodyweight)',
  'good mornings': 'Good Mornings (Bodyweight)',
  'front raises': 'Front Raises (Dumbbells)',
  'overhead carry': 'Overhead Carry (Dumbbells)',
  'front squats': 'Front Squats (Barbell)',
  'glute bridge': 'Glute Bridge (Bodyweight)',
  'suitcase carry': 'Suitcase Carry (Dumbbells)',
  'power cleans': 'Power Cleans (Barbell)',
  'overhead tricep extension': 'Overhead Tricep Extension (Dumbbells)',
  'seated calf raises': 'Seated Calf Raises (Dumbbells)',
  'squat to press': 'Squat to Press (Dumbbells)',
  'single leg deadlift': 'One-Legged Deadlift',
  'military press': 'Overhead Press',
  'dumbbell chest press': 'Dumbbell Bench Press',
  'seated cable row': 'Cable Rows',
  'pec deck': 'Pec Deck Machine',
  'stiff-leg deadlift': 'Romanian Deadlift',
  'barbell squats': 'Squat',
  'squats': 'Bodyweight Squats',
  'tricep dips': 'Dips',
  'face pulls': 'Band Pull-Aparts',
  'doorway stretch': 'Doorway Chest Stretch',
  'standing forward fold': 'Forward Fold',
  'seated forward fold': 'Forward Fold',
  'rowing machine': 'Rowing',
  'treadmill running': 'Treadmill',
  'treadmill walking': 'Walking',
  'treadmill jogging': 'Jogging',
  'spin bike': 'Stationary Bike',
  'star jumps': 'Jumping Jacks',
  'walkouts': 'Inchworms',
};
// ---------------------------------------------------------------------------
// Derive MI fields for one exercise (relationships filled in second pass)
// ---------------------------------------------------------------------------

export function deriveExerciseMiBase(ex: ExerciseData): Omit<
  ExerciseMiFields,
  'regressions' | 'progressions' | 'variations'
> {
  const laterality = inferLaterality(ex.name, ex.movementPattern);
  const override = QUALITY_OVERRIDES[ex.id];
  const movementQualities = override ?? qualitiesForExercise(ex, laterality);
  const demands = demandProfile(ex, movementQualities, laterality);

  return {
    primaryMuscles: [ex.primaryMuscleGroup],
    secondaryMuscles: [...ex.secondaryMuscleGroups],
    jointDemands: jointDemandsForExercise(ex, laterality),
    ...demands,
    movementQualities,
    laterality,
    miMovementPattern: toMiMovementPattern(ex.movementPattern, {
      name: ex.name,
      primaryMuscle: ex.primaryMuscleGroup,
    }),
  };
}

const DIFF_RANK: Record<Difficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

function equipmentLoadRank(ex: ExerciseData): number {
  const eq = ex.equipmentRequired ?? ex.equipment ?? [];
  if (eq.includes('barbell') || eq.includes('smith machine') || eq.includes('landmine')) return 4;
  if (eq.includes('cable machine') || eq.includes('sled')) return 3;
  if (eq.includes('dumbbells') || eq.includes('kettlebell') || eq.includes('medicine ball')) return 2;
  if (eq.includes('resistance bands')) return 1;
  return 0;
}

/** Shared movement stem so family chains stay within true variants (not just same muscle). */
function movementFamilyStem(name: string): string {
  const n = name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(
      /\b(dumbbells?|barbell|kettlebells?|resistance bands?|band|cable|smith machine|machine|bodyweight|seated|standing|weighted|modified|assisted|incline|decline|wide|close|grip|single[- ]?leg|single[- ]?arm|one[- ]?legged|alternating|walking|reverse|lateral|front|overhead|arnold|landmine|t-?bar|pec deck)\b/g,
      ' '
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const m = n.match(
    /\b(squat|deadlift|row|press|lunge|curl|plank|raise|fly|flye|bridge|thrust|carry|twist|burpee|pull ?ups?|chin ?ups?|push ?ups?|dip|swing|clean|thruster|get ?ups?|hop|jump|stretch|fold|pose|climber|crunch|sit ?ups?|rollout|woodchop|rotation|extension|pulldown|pullover|shrug|walk|jog|run|bike|row(?:ing)?|rope|sled|box jump|pogos?|skater|slam|throw)\b/
  );
  if (m) return m[1].replace(/\s+/g, '');
  const parts = n.split(/\s+/).filter(Boolean);
  return parts.slice(-2).join(' ') || n;
}

function resolveCatalogName(
  label: string,
  byName: Map<string, ExerciseData>
): ExerciseData | undefined {
  const key = label.toLowerCase().trim();
  const direct = byName.get(key);
  if (direct) return direct;
  const aliased = ALTERNATIVE_NAME_ALIASES[key];
  if (aliased) return byName.get(aliased.toLowerCase());
  return undefined;
}

/** Resolve an authored / alias label to a catalog exercise when possible. */
export function resolveExerciseNameInCatalog(
  label: string,
  catalog: ExerciseData[]
): ExerciseData | undefined {
  const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));
  return resolveCatalogName(label, byName);
}

/**
 * Second pass: attach regressions / progressions / variations using
 * curated edges, difficulty among alternatives, aliases, and same-family chains.
 */
export function attachExerciseRelationships(
  exercises: ExerciseData[]
): Map<string, Pick<ExerciseMiFields, 'regressions' | 'progressions' | 'variations'>> {
  // Prefer first occurrence when duplicate ids exist (catalog hygiene).
  const byId = new Map<string, ExerciseData>();
  for (const e of exercises) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]));

  const progressions = new Map<string, Set<string>>();
  const regressions = new Map<string, Set<string>>();
  const ensure = (m: Map<string, Set<string>>, id: string) => {
    if (!m.has(id)) m.set(id, new Set());
    return m.get(id)!;
  };

  const addEdge = (fromId: string, toId: string) => {
    if (!byId.has(fromId) || !byId.has(toId) || fromId === toId) return;
    ensure(progressions, fromId).add(byId.get(toId)!.name);
    ensure(regressions, toId).add(byId.get(fromId)!.name);
  };

  for (const [from, to] of PROGRESSION_EDGES) {
    addEdge(from, to);
  }

  // Difficulty-directed alternatives (with alias resolution)
  for (const ex of exercises) {
    for (const altName of ex.alternatives) {
      const alt = resolveCatalogName(altName, byName);
      if (!alt || alt.id === ex.id) continue;
      const dr = DIFF_RANK[alt.difficulty] - DIFF_RANK[ex.difficulty];
      if (dr > 0) ensure(progressions, ex.id).add(alt.name);
      else if (dr < 0) ensure(regressions, ex.id).add(alt.name);
    }
  }

  // Same-family nearest-neighbor chains: pattern + primary muscle + movement stem
  const families = new Map<string, ExerciseData[]>();
  for (const ex of byId.values()) {
    const key = `${ex.movementPattern}::${ex.primaryMuscleGroup.toLowerCase()}::${movementFamilyStem(ex.name)}`;
    if (!families.has(key)) families.set(key, []);
    families.get(key)!.push(ex);
  }
  for (const group of families.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const d = DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty];
      if (d !== 0) return d;
      return equipmentLoadRank(a) - equipmentLoadRank(b);
    });
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const harder =
        DIFF_RANK[b.difficulty] > DIFF_RANK[a.difficulty] ||
        (DIFF_RANK[b.difficulty] === DIFF_RANK[a.difficulty] &&
          equipmentLoadRank(b) > equipmentLoadRank(a));
      if (harder) addEdge(a.id, b.id);
    }
  }

  const out = new Map<string, Pick<ExerciseMiFields, 'regressions' | 'progressions' | 'variations'>>();
  for (const ex of exercises) {
    const variationNames = uniq(
      ex.alternatives
        .map((n) => resolveCatalogName(n, byName)?.name)
        .filter((n): n is string => typeof n === 'string' && n.toLowerCase() !== ex.name.toLowerCase())
    );
    out.set(ex.id, {
      regressions: [...(regressions.get(ex.id) ?? [])],
      progressions: [...(progressions.get(ex.id) ?? [])],
      variations: variationNames,
    });
  }
  return out;
}

/** Full MI enrichment for a single exercise (relationships require catalog context). */
export function enrichExerciseWithMovementIntelligence(
  ex: ExerciseData,
  relationships?: Pick<ExerciseMiFields, 'regressions' | 'progressions' | 'variations'>
): ExerciseDataWithMi {
  const base = deriveExerciseMiBase(ex);
  return {
    ...ex,
    ...base,
    regressions: relationships?.regressions ?? ex.regressions ?? [],
    progressions: relationships?.progressions ?? ex.progressions ?? [],
    variations: relationships?.variations ?? ex.variations ?? ex.alternatives ?? [],
  };
}

/**
 * Enrich an entire catalog in place (mutates array elements).
 * Returns count of exercises updated.
 */
export function applyMovementIntelligenceToCatalog(exercises: ExerciseData[]): number {
  const rel = attachExerciseRelationships(exercises);
  let updated = 0;
  for (let i = 0; i < exercises.length; i += 1) {
    const ex = exercises[i];
    const enriched = enrichExerciseWithMovementIntelligence(ex, rel.get(ex.id));
    exercises[i] = enriched;
    updated += 1;
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Relationship / query helpers for the future MI engine
// ---------------------------------------------------------------------------

export function getExercisesByMovementQuality(
  exercises: ExerciseData[],
  quality: ExerciseMovementQuality
): ExerciseData[] {
  return exercises.filter((e) => e.movementQualities?.includes(quality));
}

export function getExerciseRelationships(
  exercise: ExerciseData,
  catalog: ExerciseData[]
): ExerciseRelationship[] {
  const byName = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));
  const edges: ExerciseRelationship[] = [];
  const push = (names: string[] | undefined, kind: ExerciseRelationshipKind, strength: number) => {
    for (const name of names ?? []) {
      const to = resolveCatalogName(name, byName);
      if (!to) continue;
      edges.push({ fromId: exercise.id, toId: to.id, kind, strength });
    }
  };
  push(exercise.regressions, 'regression', 0.9);
  push(exercise.progressions, 'progression', 0.9);
  push(exercise.alternatives, 'alternative', 0.7);
  push(exercise.variations, 'variation', 0.6);
  return edges;
}

export function findSubstitutesByQuality(
  exercise: ExerciseData,
  catalog: ExerciseData[],
  opts?: { preferEasier?: boolean; limit?: number }
): ExerciseData[] {
  const qualities = new Set(exercise.movementQualities ?? []);
  const pattern = exercise.movementPattern;
  const scored = catalog
    .filter((e) => e.id !== exercise.id)
    .map((e) => {
      const shared = (e.movementQualities ?? []).filter((q) => qualities.has(q)).length;
      const samePattern = e.movementPattern === pattern ? 2 : 0;
      const diffDelta = DIFF_RANK[e.difficulty] - DIFF_RANK[exercise.difficulty];
      const easeBonus = opts?.preferEasier ? -diffDelta : 0;
      return { e, score: shared * 3 + samePattern + easeBonus };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, opts?.limit ?? 8).map((x) => x.e);
}

/** Equipment accessor that prefers equipmentRequired. */
export function getExerciseEquipment(ex: ExerciseData): Equipment[] {
  return ex.equipmentRequired?.length ? ex.equipmentRequired : ex.equipment ?? [];
}
