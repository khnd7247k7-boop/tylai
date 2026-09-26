import { getExerciseData } from '../data/exerciseDatabase';
import { formatRestDuration, REST_DURATION_PRESETS } from './exerciseRestTimer';
import type { CoachingProfile, ExperienceLevel, RecoveryLevel } from '../types/coachingProfile';

export type MovementLoadClass = 'heavy_compound' | 'compound' | 'isolation' | 'other';

export type SmartRestContext = {
  goal?: string | null;
  level?: string | null;
  /** 0–100 from sleep/stress (and optional live signals). Higher = better recovered. */
  recoveryScore?: number | null;
  restAdjustSec?: number | null;
  challengeDial?: string | null;
  dailyActivityLevel?: string | null;
  /** Last session 1–5, if logged. */
  sorenessLevel?: number | null;
  energyLevel?: number | null;
};

export type MovementShape = {
  name?: string;
  phase?: string;
  category?: string;
  movementPattern?: string;
  muscleGroups?: string[];
  secondaryMuscleGroups?: string[];
  difficulty?: string;
  equipment?: string[];
};

const HEAVY_COMPOUND_NAME =
  /bench|squat|deadlift|overhead press|military press|shoulder press|barbell row|bent[- ]over row|pull-?up|chin-?up|hip thrust|romanian deadlift|\brdl\b|lunge|leg press|clean|snatch|thruster|front squat|trap bar|pendlay|good morning|dip/i;

const COMPOUND_PATTERNS = new Set(['squat', 'hinge', 'lunge', 'push', 'pull', 'carry']);

const REST_BLEND = {
  load: 0.28,
  level: 0.46,
  recovery: 0.2,
  goal: 0.06,
} as const;

function secondaryCount(ex: MovementShape): number {
  if (Array.isArray(ex.secondaryMuscleGroups)) return ex.secondaryMuscleGroups.length;
  const groups = ex.muscleGroups ?? [];
  return Math.max(0, groups.length - 1);
}

export function classifyMovementLoad(ex: MovementShape): MovementLoadClass {
  const category = (ex.category ?? '').toLowerCase();
  if (
    category === 'cardio' ||
    category === 'flexibility' ||
    category === 'balance' ||
    category === 'stability'
  ) {
    return 'other';
  }

  const phase = (ex.phase ?? '').toLowerCase();
  const name = ex.name ?? '';
  const namedHeavy = HEAVY_COMPOUND_NAME.test(name);
  const extras = secondaryCount(ex);
  const pattern = (ex.movementPattern ?? '').toLowerCase();
  const compoundPattern = COMPOUND_PATTERNS.has(pattern);
  const usesBarbell = (ex.equipment ?? []).some((item) => /barbell/i.test(item));

  if (phase.includes('main lift')) {
    return 'heavy_compound';
  }
  if (phase.includes('accessory') || phase.includes('finisher')) {
    return extras >= 2 ? 'compound' : 'isolation';
  }
  if (namedHeavy || (usesBarbell && extras >= 2 && compoundPattern)) {
    return 'heavy_compound';
  }
  if (extras >= 1 || compoundPattern) return 'compound';
  return 'isolation';
}

export function snapRestToPreset(seconds: number): number {
  const target = Math.max(0, Math.round(seconds));
  let best: number = REST_DURATION_PRESETS[0].seconds;
  let bestDiff = Math.abs(target - best);
  for (const preset of REST_DURATION_PRESETS) {
    const diff = Math.abs(target - preset.seconds);
    if (diff < bestDiff || (diff === bestDiff && preset.seconds > best)) {
      best = preset.seconds;
      bestDiff = diff;
    }
  }
  return best;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function loadRestNeed(loadClass: MovementLoadClass): number {
  switch (loadClass) {
    case 'heavy_compound':
      return 1;
    case 'compound':
      return 0.52;
    case 'isolation':
      return 0.18;
    default:
      return 0.05;
  }
}

function levelRestNeed(level?: string | null): number {
  const value = (level ?? '').toLowerCase();
  if (value === 'beginner') return 0;
  if (value === 'intermediate') return 0.42;
  if (value === 'advanced') return 0.85;
  if (value === 'competitive') return 1;
  return 0.36;
}

function goalRestNeed(goal?: string | null): number {
  const value = (goal ?? '').toLowerCase();
  if (value.includes('strength') || value.includes('power')) return 1;
  if (value.includes('muscle')) return 0.62;
  if (value.includes('athletic') || value.includes('performance')) return 0.55;
  if (value.includes('weight_loss') || value.includes('fat')) return 0.22;
  if (value.includes('endurance') || value.includes('cardio')) return 0.18;
  return 0.42;
}

function recoveryRestNeed(ctx: SmartRestContext): number {
  const score =
    typeof ctx.recoveryScore === 'number' && Number.isFinite(ctx.recoveryScore)
      ? Math.min(100, Math.max(0, ctx.recoveryScore))
      : 62;
  let need = 1 - score / 100;
  const activity = (ctx.dailyActivityLevel ?? '').toLowerCase();
  if (activity === 'sedentary') need += 0.06;
  else if (activity === 'light') need += 0.02;
  else if (activity === 'active') need -= 0.04;

  const soreness = Number(ctx.sorenessLevel);
  if (Number.isFinite(soreness) && soreness > 0) {
    need += ((Math.min(5, Math.max(1, soreness)) - 3) / 2) * 0.12;
  }
  const energy = Number(ctx.energyLevel);
  if (Number.isFinite(energy) && energy > 0) {
    need += ((3 - Math.min(5, Math.max(1, energy))) / 2) * 0.08;
  }

  const dial = (ctx.challengeDial ?? '').toLowerCase();
  if (dial === 'easy') need += 0.04;
  else if (dial === 'maximum') need -= 0.04;

  return clamp01(need);
}

function mapExperienceLevel(level?: ExperienceLevel | string | null): string | null {
  if (!level) return null;
  if (level === 'competitive') return 'competitive';
  if (level === 'advanced' || level === 'intermediate' || level === 'beginner') return level;
  return String(level);
}

function recoveryLevelScore(level?: RecoveryLevel | string | null, invert = false): number {
  const raw = level === 'high' ? 85 : level === 'medium' ? 65 : level === 'low' ? 40 : 60;
  return invert ? 100 - raw + 40 : raw;
}

/** 0–100 from onboarding sleep/stress. Matches GoalDrivenCoaching scoring. */
export function recoveryScoreFromProfile(profile: CoachingProfile): number {
  const sleep = recoveryLevelScore(profile.recoveryProfile?.sleepQuality);
  const stress = recoveryLevelScore(profile.recoveryProfile?.stressLevel, true);
  return Math.round(Math.min(100, Math.max(0, sleep * 0.55 + stress * 0.45)));
}

export function recoverySignalsFromSessions(
  sessions: Array<{ sorenessLevel?: number | null; energyLevel?: number | null }> | null | undefined,
  lookback = 3
): Pick<SmartRestContext, 'sorenessLevel' | 'energyLevel'> {
  const recent = (sessions ?? [])
    .filter((session) => session && (session.sorenessLevel != null || session.energyLevel != null))
    .slice(-lookback);
  if (recent.length === 0) return {};
  const avg = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
  const soreness = avg(
    recent
      .map((session) => Number(session.sorenessLevel))
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  const energy = avg(
    recent
      .map((session) => Number(session.energyLevel))
      .filter((value) => Number.isFinite(value) && value > 0)
  );
  return {
    ...(soreness != null ? { sorenessLevel: soreness } : {}),
    ...(energy != null ? { energyLevel: energy } : {}),
  };
}

function compactRestContext(ctx: SmartRestContext): SmartRestContext {
  return Object.fromEntries(
    Object.entries(ctx).filter(([, value]) => value != null && value !== '')
  ) as SmartRestContext;
}

export function restContextFromCoachingProfile(
  profile: CoachingProfile | null | undefined
): SmartRestContext {
  if (!profile) return {};
  const recoveryScore = recoveryScoreFromProfile(profile);
  const challengeDial = profile.adherenceProfile?.challengeDial ?? null;
  let restAdjustSec = 0;
  if (challengeDial === 'easy') restAdjustSec = 15;
  else if (challengeDial === 'maximum') restAdjustSec = -15;
  if (recoveryScore < 45) restAdjustSec += 20;
  return compactRestContext({
    goal: profile.goalProfile?.primaryGoal ?? null,
    level: mapExperienceLevel(profile.experienceProfile?.level),
    recoveryScore,
    restAdjustSec,
    challengeDial,
    dailyActivityLevel: profile.recoveryProfile?.dailyActivityLevel ?? null,
  });
}

export function suggestedRestSeconds(ex: MovementShape, ctx: SmartRestContext = {}): number {
  const loadClass = classifyMovementLoad(ex);
  const restNeed = clamp01(
    REST_BLEND.load * loadRestNeed(loadClass) +
      REST_BLEND.level * levelRestNeed(ctx.level) +
      REST_BLEND.recovery * recoveryRestNeed(ctx) +
      REST_BLEND.goal * goalRestNeed(ctx.goal)
  );
  const pickerMin = REST_DURATION_PRESETS[0].seconds;
  const pickerMax = REST_DURATION_PRESETS[REST_DURATION_PRESETS.length - 1].seconds;
  const scaled = pickerMin + restNeed * (pickerMax - pickerMin);
  const adjusted = scaled + (Number(ctx.restAdjustSec) || 0);
  return snapRestToPreset(Math.min(pickerMax, Math.max(pickerMin, adjusted)));
}

export function suggestedRestForExerciseName(
  name: string,
  ctx: SmartRestContext = {},
  extra: MovementShape = {}
): number {
  const data = getExerciseData(name);
  return suggestedRestSeconds(
    {
      name,
      phase: extra.phase,
      category: extra.category ?? data?.category,
      movementPattern: extra.movementPattern ?? data?.movementPattern,
      muscleGroups: extra.muscleGroups ?? data?.muscleGroups,
      secondaryMuscleGroups: extra.secondaryMuscleGroups ?? data?.secondaryMuscleGroups,
      difficulty: extra.difficulty ?? data?.difficulty,
      equipment: extra.equipment ?? data?.equipment ?? data?.equipmentRequired,
    },
    ctx
  );
}

export function movementRestHint(
  ex: MovementShape,
  suggestedSeconds: number,
  ctx: SmartRestContext = {}
): string {
  const loadClass = classifyMovementLoad(ex);
  const duration = formatRestDuration(suggestedSeconds);
  const level = (ctx.level ?? '').toLowerCase();
  const recovery = ctx.recoveryScore;

  if (loadClass === 'heavy_compound' && level === 'beginner') {
    return `Suggested ${duration} for this lift at your level. Take more if the sets feel heavy.`;
  }
  if (loadClass === 'heavy_compound' && (level === 'advanced' || level === 'competitive')) {
    return `Suggested ${duration} so you can recover between heavier sets. Shorten it if you feel ready.`;
  }
  if (typeof recovery === 'number' && recovery < 50 && loadClass !== 'other') {
    return `Suggested ${duration} — recovery looks a bit taxed, so extra rest is built in. Change it if you want.`;
  }
  if (loadClass === 'isolation') {
    return `Suggested ${duration} for this accessory. Adjust if you need more.`;
  }
  return `Suggested ${duration} from your level and recovery. Change it anytime.`;
}
