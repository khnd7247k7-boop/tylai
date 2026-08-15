/**
 * Persistence layer for TYL Movement Intelligence.
 *
 * Dual-write via userStorage → AsyncStorage + Firestore
 * `users/{uid}/appData/{key}` for durable keys.
 *
 * Does not alter workout generation. Later phases consume these loaders.
 */

import { auth } from '../../firebaseConfig';
import { loadUserData, saveUserData } from '../utils/userStorage';
import {
  createEmptyMovementProfile,
  createEmptyMovementIntelligenceSnapshot,
  emptyMovementQualityMetric,
  MOBILITY_QUALITY_KEYS,
  MOVEMENT_CONTROL_QUALITY_KEYS,
  STABILITY_QUALITY_KEYS,
  STRENGTH_QUALITY_KEYS,
  type DiscomfortReport,
  type DiscomfortSafetySignals,
  type MobilityQualityKey,
  type MovementAdaptationPlan,
  type MovementAssessment,
  type MovementControlQualityKey,
  type MovementDataSource,
  type MovementIntelligenceSnapshot,
  type MovementMetricStatus,
  type MovementPattern,
  type MovementProfile,
  type MovementQualityKey,
  type MovementQualityMetric,
  type MovementSafetyAssessmentResult,
  type MovementToleranceEntry,
  type PostWorkoutMovementFeedback,
  type StabilityQualityKey,
  type StrengthQualityKey,
  type TrainingConstraint,
  type TrainingConstraintStatus,
} from '../types/movementIntelligence';
import { evaluateDiscomfortSafety } from '../utils/movementSafetyEvaluation';
import { buildAdaptiveTrainingPlan } from './AdaptiveTrainingEngine';

export {
  evaluateDiscomfortSafety,
  evaluateDiscomfortSafetyBatch,
  SAFETY_USER_MESSAGES,
} from '../utils/movementSafetyEvaluation';
export type { EvaluateDiscomfortSafetyInput } from '../utils/movementSafetyEvaluation';

export {
  buildAdaptiveTrainingPlan,
  mergeAdaptationPlans,
  proposedConstraintsFromPlan,
} from './AdaptiveTrainingEngine';
export type { BuildAdaptiveTrainingPlanInput } from './AdaptiveTrainingEngine';

export {
  buildMovementIntelligenceAiContext,
  buildMovementIntelligenceAiContextFromData,
  findAiConstraintConflicts,
  MOVEMENT_INTELLIGENCE_AI_RULES,
} from './MovementIntelligenceAiContext';
export type { MovementIntelligenceAiContext } from './MovementIntelligenceAiContext';

export const MOVEMENT_PROFILE_KEY = 'movementProfile';
export const DISCOMFORT_REPORTS_KEY = 'discomfortReports';
export const TRAINING_CONSTRAINTS_KEY = 'trainingConstraints';
export const MOVEMENT_ASSESSMENTS_KEY = 'movementAssessments';
export const POST_WORKOUT_MOVEMENT_FEEDBACK_KEY = 'postWorkoutMovementFeedback';
export const LATEST_ADAPTATION_PLAN_KEY = 'latestMovementAdaptationPlan';

const MAX_HISTORY = 100;
const MAX_LIST = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function currentUserId(): string | undefined {
  try {
    return auth?.currentUser?.uid || undefined;
  } catch {
    return undefined;
  }
}

function clampList<T>(items: T[]): T[] {
  if (items.length <= MAX_LIST) return items;
  return items.slice(0, MAX_LIST);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

const KNOWN_DATA_SOURCES: readonly MovementDataSource[] = [
  'user_input',
  'workout_performance',
  'movement_assessment',
  'video_analysis',
  'exercise_feedback',
  'user_report',
  'workout_feedback',
];

/** Map legacy source labels onto the current vocabulary. */
export function normalizeMovementDataSource(raw: unknown): MovementDataSource | undefined {
  if (typeof raw !== 'string') return undefined;
  if (raw === 'user_report') return 'user_input';
  if (raw === 'workout_feedback') return 'exercise_feedback';
  if ((KNOWN_DATA_SOURCES as readonly string[]).includes(raw)) {
    return raw as MovementDataSource;
  }
  return undefined;
}

function normalizeDataSources(raw: unknown): MovementDataSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: MovementDataSource[] = [];
  for (const item of raw) {
    const s = normalizeMovementDataSource(item);
    if (s && !out.includes(s)) out.push(s);
  }
  return out.length ? out : undefined;
}

/**
 * Normalize a quality metric.
 * Never invents a score — missing/invalid scores stay `unknown` or `needs_assessment`.
 */
export function normalizeQualityMetric(raw: unknown): MovementQualityMetric {
  if (!isObject(raw)) return emptyMovementQualityMetric('unknown');

  const dataSource =
    normalizeMovementDataSource(raw.dataSource) ??
    normalizeMovementDataSource(Array.isArray(raw.dataSources) ? raw.dataSources[0] : undefined);
  const dataSources = normalizeDataSources(raw.dataSources);
  const mergedSources =
    dataSource || dataSources
      ? Array.from(new Set([...(dataSources ?? []), ...(dataSource ? [dataSource] : [])]))
      : undefined;

  let confidence: number | undefined;
  if (typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)) {
    confidence = Math.max(0, Math.min(1, raw.confidence));
  }

  const lastUpdated =
    typeof raw.lastUpdated === 'string' && raw.lastUpdated.trim()
      ? raw.lastUpdated
      : undefined;

  const explicitStatus =
    raw.status === 'unknown' || raw.status === 'needs_assessment' || raw.status === 'scored'
      ? (raw.status as MovementMetricStatus)
      : undefined;

  const hasScore = typeof raw.score === 'number' && Number.isFinite(raw.score);
  if (hasScore && (explicitStatus === 'scored' || explicitStatus == null)) {
    return {
      status: 'scored',
      score: Math.max(0, Math.min(100, raw.score as number)),
      confidence,
      lastUpdated,
      dataSource: dataSource ?? mergedSources?.[0],
      dataSources: mergedSources,
    };
  }

  // Provenance without a score → needs assessment (evidence exists, score does not).
  if (explicitStatus === 'needs_assessment' || lastUpdated || mergedSources?.length) {
    return {
      status: 'needs_assessment',
      confidence,
      lastUpdated,
      dataSource: dataSource ?? mergedSources?.[0],
      dataSources: mergedSources,
    };
  }

  if (explicitStatus === 'unknown') {
    return emptyMovementQualityMetric('unknown');
  }

  return emptyMovementQualityMetric('unknown');
}

function normalizeQualityRecord<K extends string>(
  raw: unknown,
  keys: readonly K[]
): Record<K, MovementQualityMetric> {
  const base = {} as Record<K, MovementQualityMetric>;
  for (const key of keys) {
    base[key] = emptyMovementQualityMetric('unknown');
  }
  if (!isObject(raw)) return base;

  // v1 shape: a single aggregate metric object (has score/confidence/status keys, not quality keys)
  const looksLikeMetric =
    'score' in raw ||
    'confidence' in raw ||
    'status' in raw ||
    'dataSources' in raw ||
    'dataSource' in raw ||
    'lastUpdated' in raw;
  const hasAnyQualityKey = keys.some((k) => k in raw);
  if (looksLikeMetric && !hasAnyQualityKey) {
    // Do not invent granular scores from a coarse aggregate — leave unknown.
    return base;
  }

  for (const key of keys) {
    if (key in raw) {
      base[key] = normalizeQualityMetric(raw[key]);
    }
  }
  return base;
}

function normalizeToleranceEntry(raw: unknown): MovementToleranceEntry | null {
  if (!isObject(raw)) return null;
  const metric = normalizeQualityMetric(raw);
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : newId('mtol');
  const entry: MovementToleranceEntry = {
    id,
    status: metric.status,
  };
  if (typeof raw.exercise === 'string' && raw.exercise.trim()) {
    entry.exercise = raw.exercise.trim();
  }
  if (typeof raw.movementPattern === 'string' && raw.movementPattern.trim()) {
    entry.movementPattern = raw.movementPattern as MovementPattern;
  }
  if (typeof metric.score === 'number') entry.score = metric.score;
  if (typeof metric.confidence === 'number') entry.confidence = metric.confidence;
  if (metric.lastUpdated) entry.lastUpdated = metric.lastUpdated;
  if (metric.dataSource) entry.dataSource = metric.dataSource;
  if (metric.dataSources) entry.dataSources = metric.dataSources;
  if (typeof raw.notes === 'string' && raw.notes.trim()) entry.notes = raw.notes.trim();
  return entry;
}

function normalizeMovementTolerance(raw: unknown): MovementProfile['movementTolerance'] {
  if (Array.isArray(raw)) {
    return {
      entries: raw
        .map(normalizeToleranceEntry)
        .filter((e): e is MovementToleranceEntry => Boolean(e)),
    };
  }
  if (!isObject(raw)) return { entries: [] };

  // v2: { entries: [...] }
  if (Array.isArray(raw.entries)) {
    return {
      entries: raw.entries
        .map(normalizeToleranceEntry)
        .filter((e): e is MovementToleranceEntry => Boolean(e)),
    };
  }

  // v1 aggregate metric — provenance only; no invented per-exercise scores.
  // Entries stay empty until exercise-scoped feedback arrives.
  return { entries: [] };
}

/** Normalize / migrate persisted profile payloads to schema v2. */
export function normalizeMovementProfile(raw: unknown, userId?: string): MovementProfile {
  const base = createEmptyMovementProfile({ userId, now: nowIso() });
  if (!isObject(raw)) return base;

  const history = Array.isArray(raw.history)
    ? raw.history.filter((h) => isObject(h) && typeof h.id === 'string').slice(0, MAX_HISTORY)
    : [];

  return {
    version: 2,
    userId: typeof raw.userId === 'string' ? raw.userId : userId,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
    stability: normalizeQualityRecord(raw.stability, STABILITY_QUALITY_KEYS),
    mobility: normalizeQualityRecord(raw.mobility, MOBILITY_QUALITY_KEYS),
    strength: normalizeQualityRecord(raw.strength, STRENGTH_QUALITY_KEYS),
    movementControl: normalizeQualityRecord(raw.movementControl, MOVEMENT_CONTROL_QUALITY_KEYS),
    movementTolerance: normalizeMovementTolerance(raw.movementTolerance),
    currentFocusAreas: Array.isArray(raw.currentFocusAreas)
      ? raw.currentFocusAreas.map(String).filter(Boolean)
      : [],
    affectedAreas: Array.isArray(raw.affectedAreas)
      ? (raw.affectedAreas as MovementProfile['affectedAreas'])
      : [],
    exerciseLimitations: Array.isArray(raw.exerciseLimitations)
      ? raw.exerciseLimitations.map(String).filter(Boolean)
      : [],
    trainingModifications: Array.isArray(raw.trainingModifications)
      ? raw.trainingModifications.map(String).filter(Boolean)
      : [],
    reassessmentDates: Array.isArray(raw.reassessmentDates)
      ? raw.reassessmentDates.map(String).filter(Boolean)
      : [],
    history: history as MovementProfile['history'],
  };
}

function normalizeProfile(raw: unknown, userId?: string): MovementProfile {
  return normalizeMovementProfile(raw, userId);
}

/**
 * Upsert a movement-tolerance entry without inventing a numeric score.
 * Used by discomfort / session feedback to record provenance + needs_assessment.
 */
export function upsertToleranceEntryOnProfile(
  profile: MovementProfile,
  input: {
    exercise?: string;
    movementPattern?: MovementPattern;
    dataSource: MovementDataSource;
    now?: string;
    notes?: string;
    /** Only set when evidence supports a real score — never invent. */
    score?: number;
    confidence?: number;
    markNeedsAssessment?: boolean;
  }
): MovementProfile {
  const now = input.now ?? nowIso();
  const entries = [...(profile.movementTolerance?.entries ?? [])];
  const exerciseKey = input.exercise?.trim().toLowerCase();
  const idx = entries.findIndex((e) => {
    if (exerciseKey && e.exercise?.toLowerCase() === exerciseKey) return true;
    if (
      !exerciseKey &&
      input.movementPattern &&
      !e.exercise &&
      e.movementPattern === input.movementPattern
    ) {
      return true;
    }
    return false;
  });

  const prior = idx >= 0 ? entries[idx] : undefined;
  const sources = Array.from(
    new Set([...(prior?.dataSources ?? []), input.dataSource].filter(Boolean))
  ) as MovementDataSource[];

  const hasScore = typeof input.score === 'number' && Number.isFinite(input.score);
  const status: MovementMetricStatus = hasScore
    ? 'scored'
    : input.markNeedsAssessment !== false
      ? 'needs_assessment'
      : prior?.status === 'scored'
        ? 'scored'
        : 'needs_assessment';

  const next: MovementToleranceEntry = {
    id: prior?.id ?? newId('mtol'),
    exercise: input.exercise?.trim() || prior?.exercise,
    movementPattern: input.movementPattern ?? prior?.movementPattern,
    status,
    lastUpdated: now,
    dataSource: input.dataSource,
    dataSources: sources,
    notes: input.notes ?? prior?.notes,
  };
  if (hasScore) {
    next.score = Math.max(0, Math.min(100, input.score as number));
  } else if (prior?.status === 'scored' && typeof prior.score === 'number') {
    // Keep prior score only if we aren't clearing it; still no invention.
    next.status = 'scored';
    next.score = prior.score;
  }
  if (typeof input.confidence === 'number') {
    next.confidence = Math.max(0, Math.min(1, input.confidence));
  } else if (typeof prior?.confidence === 'number') {
    next.confidence = prior.confidence;
  }

  if (idx >= 0) entries[idx] = next;
  else entries.unshift(next);

  profile.movementTolerance = { entries: entries.slice(0, MAX_LIST) };
  return profile;
}

/**
 * Update a single granular quality. Omitting `score` marks needs_assessment / unknown
 * rather than inventing a value.
 */
export function setMovementQualityOnProfile(
  profile: MovementProfile,
  domain: 'stability' | 'mobility' | 'strength' | 'movementControl',
  key: string,
  patch: Partial<MovementQualityMetric> & { dataSource?: MovementDataSource }
): MovementProfile {
  const record = profile[domain] as Record<string, MovementQualityMetric>;
  if (!(key in record)) return profile;
  const prior = record[key] ?? emptyMovementQualityMetric('unknown');
  const merged = normalizeQualityMetric({
    ...prior,
    ...patch,
    dataSources: Array.from(
      new Set([
        ...(prior.dataSources ?? []),
        ...(patch.dataSources ?? []),
        ...(patch.dataSource ? [patch.dataSource] : []),
      ])
    ),
  });
  record[key] = merged;
  return profile;
}

export function getMovementQuality(
  profile: MovementProfile,
  domain: 'stability' | 'mobility' | 'strength' | 'movementControl',
  key: string
): MovementQualityMetric {
  const record = profile[domain] as Record<string, MovementQualityMetric>;
  return record[key] ?? emptyMovementQualityMetric('unknown');
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function loadMovementProfile(): Promise<MovementProfile> {
  const raw = await loadUserData<unknown>(MOVEMENT_PROFILE_KEY);
  return normalizeProfile(raw, currentUserId());
}

export async function saveMovementProfile(profile: MovementProfile): Promise<MovementProfile> {
  const next: MovementProfile = {
    ...normalizeProfile(profile, currentUserId() ?? profile.userId),
    updatedAt: nowIso(),
    userId: profile.userId ?? currentUserId(),
  };
  if (next.history.length > MAX_HISTORY) {
    next.history = next.history.slice(0, MAX_HISTORY);
  }
  await saveUserData(MOVEMENT_PROFILE_KEY, next);
  return next;
}

/** Ensure a profile doc exists without inventing quality scores. */
export async function ensureMovementProfile(): Promise<MovementProfile> {
  const existing = await loadUserData<unknown>(MOVEMENT_PROFILE_KEY);
  if (existing) return normalizeProfile(existing, currentUserId());
  const created = createEmptyMovementProfile({ userId: currentUserId() });
  await saveUserData(MOVEMENT_PROFILE_KEY, created);
  return created;
}

export async function appendMovementProfileHistory(
  entry: Omit<MovementProfile['history'][number], 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: string;
  }
): Promise<MovementProfile> {
  const profile = await loadMovementProfile();
  const row = {
    id: entry.id ?? newId('mph'),
    timestamp: entry.timestamp ?? nowIso(),
    event: entry.event,
    summary: entry.summary,
    changedQualities: entry.changedQualities,
  };
  profile.history = [row, ...profile.history].slice(0, MAX_HISTORY);
  profile.updatedAt = nowIso();
  return saveMovementProfile(profile);
}

export async function patchMovementProfile(
  patch: Partial<
    Pick<
      MovementProfile,
      | 'currentFocusAreas'
      | 'affectedAreas'
      | 'exerciseLimitations'
      | 'trainingModifications'
      | 'reassessmentDates'
      | 'mobility'
      | 'stability'
      | 'strength'
      | 'movementControl'
      | 'movementTolerance'
    >
  >,
  historyEvent?: string
): Promise<MovementProfile> {
  const profile = await loadMovementProfile();
  const changedQualities: MovementQualityKey[] = [];

  if (patch.stability) {
    profile.stability = normalizeQualityRecord(
      { ...profile.stability, ...patch.stability },
      STABILITY_QUALITY_KEYS
    );
    changedQualities.push('stability');
  }
  if (patch.mobility) {
    profile.mobility = normalizeQualityRecord(
      { ...profile.mobility, ...patch.mobility },
      MOBILITY_QUALITY_KEYS
    );
    changedQualities.push('mobility');
  }
  if (patch.strength) {
    profile.strength = normalizeQualityRecord(
      { ...profile.strength, ...patch.strength },
      STRENGTH_QUALITY_KEYS
    );
    changedQualities.push('strength');
  }
  if (patch.movementControl) {
    profile.movementControl = normalizeQualityRecord(
      { ...profile.movementControl, ...patch.movementControl },
      MOVEMENT_CONTROL_QUALITY_KEYS
    );
    changedQualities.push('movementControl');
  }
  if (patch.movementTolerance) {
    profile.movementTolerance = normalizeMovementTolerance({
      entries: [
        ...(patch.movementTolerance.entries ?? []),
        ...(profile.movementTolerance.entries ?? []),
      ],
    });
    // Dedupe by id / exercise after merge
    const seen = new Set<string>();
    profile.movementTolerance.entries = profile.movementTolerance.entries.filter((e) => {
      const key = e.id || e.exercise?.toLowerCase() || e.movementPattern || '';
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    changedQualities.push('movementTolerance');
  }

  if (patch.currentFocusAreas) profile.currentFocusAreas = patch.currentFocusAreas.map(String);
  if (patch.affectedAreas) profile.affectedAreas = patch.affectedAreas;
  if (patch.exerciseLimitations) profile.exerciseLimitations = patch.exerciseLimitations.map(String);
  if (patch.trainingModifications) {
    profile.trainingModifications = patch.trainingModifications.map(String);
  }
  if (patch.reassessmentDates) profile.reassessmentDates = patch.reassessmentDates.map(String);

  if (historyEvent) {
    profile.history = [
      {
        id: newId('mph'),
        timestamp: nowIso(),
        event: historyEvent,
        changedQualities: changedQualities.length ? changedQualities : undefined,
      },
      ...profile.history,
    ].slice(0, MAX_HISTORY);
  }

  return saveMovementProfile(profile);
}

// ---------------------------------------------------------------------------
// Discomfort reports
// ---------------------------------------------------------------------------

export async function loadDiscomfortReports(): Promise<DiscomfortReport[]> {
  const raw = await loadUserData<DiscomfortReport[]>(DISCOMFORT_REPORTS_KEY);
  return Array.isArray(raw) ? clampList(raw.filter((r) => r && typeof r.id === 'string')) : [];
}

export async function saveDiscomfortReports(reports: DiscomfortReport[]): Promise<void> {
  await saveUserData(DISCOMFORT_REPORTS_KEY, clampList(reports));
}

export async function appendDiscomfortReport(
  input: Omit<DiscomfortReport, 'id' | 'timestamp' | 'status'> & {
    id?: string;
    timestamp?: string;
    status?: DiscomfortReport['status'];
  }
): Promise<DiscomfortReport> {
  const report: DiscomfortReport = {
    ...input,
    id: input.id ?? newId('dr'),
    timestamp: input.timestamp ?? nowIso(),
    status: input.status ?? 'active',
    severity: Math.max(0, Math.min(10, Number(input.severity) || 0)),
  };
  const existing = await loadDiscomfortReports();
  await saveDiscomfortReports([report, ...existing]);
  return report;
}

export async function updateDiscomfortReport(
  id: string,
  patch: Partial<DiscomfortReport>
): Promise<DiscomfortReport | null> {
  const existing = await loadDiscomfortReports();
  const idx = existing.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const next = { ...existing[idx], ...patch, id };
  existing[idx] = next;
  await saveDiscomfortReports(existing);
  return next;
}

export type DiscomfortAssessmentInput = {
  bodyArea: DiscomfortReport['bodyArea'];
  bodyAreaOther?: string;
  side: DiscomfortReport['side'];
  sensation: DiscomfortReport['sensation'];
  sensationOther?: string;
  severity: number;
  movementPhase?: DiscomfortReport['movementPhase'];
  onset?: DiscomfortReport['onset'];
  frequency?: DiscomfortReport['frequency'];
  modificationsAttempted?: string[];
  modificationResponse?: DiscomfortReport['modificationResponse'];
  trend?: DiscomfortReport['trend'];
  exercise?: string;
  movementPattern?: DiscomfortReport['movementPattern'];
  notes?: string;
  /** Optional explicit escalation flags when known. */
  safetySignals?: DiscomfortSafetySignals;
  /** Optional primary goal label — preserved as programming priority. */
  primaryGoalLabel?: string | null;
};

/**
 * Persist a completed conversational assessment:
 * 1) DiscomfortReport
 * 2) MovementProfile fields (affected areas, limitations, tolerance signal metadata — no invented score)
 * 3) Conservative safety evaluation
 * 4) Adaptive Training Engine plan → TrainingConstraints (does not change workouts yet)
 */
export async function submitDiscomfortAssessment(
  input: DiscomfortAssessmentInput
): Promise<{
  report: DiscomfortReport;
  profile: MovementProfile;
  safety: MovementSafetyAssessmentResult;
  adaptation: MovementAdaptationPlan;
}> {
  const report = await appendDiscomfortReport({
    bodyArea: input.bodyArea,
    bodyAreaOther: input.bodyAreaOther,
    side: input.side,
    sensation: input.sensation,
    sensationOther: input.sensationOther,
    severity: input.severity,
    exercise: input.exercise?.trim() || undefined,
    movementPattern: input.movementPattern,
    movementPhase: input.movementPhase,
    frequency: input.frequency,
    onset: input.onset,
    modificationsAttempted: input.modificationsAttempted,
    modificationResponse: input.modificationResponse,
    trend: input.trend,
    status: 'monitoring',
    notes: input.notes,
  });

  const profile = await loadMovementProfile();
  const now = nowIso();

  if (!profile.affectedAreas.includes(input.bodyArea) && input.bodyArea !== 'other') {
    profile.affectedAreas = [...profile.affectedAreas, input.bodyArea];
  }

  const exerciseName = input.exercise?.trim();
  if (exerciseName) {
    const exists = profile.exerciseLimitations.some(
      (e) => e.toLowerCase() === exerciseName.toLowerCase()
    );
    if (!exists) {
      profile.exerciseLimitations = [...profile.exerciseLimitations, exerciseName];
    }
  }

  const focusLabel =
    input.bodyArea === 'other' && input.bodyAreaOther?.trim()
      ? input.bodyAreaOther.trim()
      : input.bodyArea.replace(/_/g, ' ');
  if (!profile.currentFocusAreas.some((f) => f.toLowerCase() === focusLabel.toLowerCase())) {
    profile.currentFocusAreas = [...profile.currentFocusAreas, focusLabel].slice(0, 12);
  }

  // Soft signal only — mark exercise tolerance as needs_assessment; never invent a score.
  upsertToleranceEntryOnProfile(profile, {
    exercise: exerciseName,
    movementPattern: input.movementPattern,
    dataSource: 'user_input',
    now,
    markNeedsAssessment: true,
    confidence: 0.35,
    notes: `Discomfort reported (${focusLabel})`,
  });

  const historyEntry: MovementProfile['history'][number] = {
    id: newId('mph'),
    timestamp: now,
    event: 'discomfort_assessment',
    summary: exerciseName
      ? `Discomfort reported on ${exerciseName} (${focusLabel})`
      : `Discomfort reported (${focusLabel})`,
    changedQualities: ['movementTolerance'],
  };
  profile.history = [historyEntry, ...profile.history].slice(0, MAX_HISTORY);

  const savedProfile = await saveMovementProfile(profile);
  const safety = evaluateDiscomfortSafety({
    report,
    signals: input.safetySignals,
    now,
  });
  const adaptation = buildAdaptiveTrainingPlan({
    report,
    safety,
    profile: savedProfile,
    primaryGoalLabel: input.primaryGoalLabel,
    now,
  });
  await persistAdaptationPlan(adaptation);
  return { report, profile: savedProfile, safety, adaptation };
}

/** Persist adaptation plan + upsert proposed TrainingConstraint rows. */
export async function persistAdaptationPlan(
  plan: MovementAdaptationPlan
): Promise<TrainingConstraint[]> {
  await saveUserData(LATEST_ADAPTATION_PLAN_KEY, plan);
  const saved: TrainingConstraint[] = [];
  for (const proposed of plan.proposedConstraints) {
    const row = await upsertTrainingConstraint(proposed);
    saved.push(row);
  }

  if (plan.movementConstraints.reassessmentDate) {
    const profile = await loadMovementProfile();
    const dates = new Set(profile.reassessmentDates ?? []);
    dates.add(plan.movementConstraints.reassessmentDate);
    profile.reassessmentDates = [...dates].sort().slice(-20);
    if (plan.trainingPriorities[0]) {
      const note = plan.trainingPriorities[0];
      if (!profile.trainingModifications.includes(note)) {
        profile.trainingModifications = [note, ...profile.trainingModifications].slice(0, 20);
      }
    }
    await saveMovementProfile(profile);
  }

  return saved;
}

export async function loadLatestAdaptationPlan(): Promise<MovementAdaptationPlan | null> {
  const raw = await loadUserData<MovementAdaptationPlan>(LATEST_ADAPTATION_PLAN_KEY);
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return null;
  return raw;
}

// ---------------------------------------------------------------------------
// Training constraints
// ---------------------------------------------------------------------------

export async function loadTrainingConstraints(): Promise<TrainingConstraint[]> {
  const raw = await loadUserData<TrainingConstraint[]>(TRAINING_CONSTRAINTS_KEY);
  return Array.isArray(raw) ? clampList(raw.filter((c) => c && typeof c.id === 'string')) : [];
}

export async function saveTrainingConstraints(constraints: TrainingConstraint[]): Promise<void> {
  await saveUserData(TRAINING_CONSTRAINTS_KEY, clampList(constraints));
}

export async function upsertTrainingConstraint(
  input: Omit<TrainingConstraint, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<TrainingConstraint> {
  const existing = await loadTrainingConstraints();
  const now = nowIso();
  if (input.id) {
    const idx = existing.findIndex((c) => c.id === input.id);
    if (idx >= 0) {
      const next: TrainingConstraint = {
        ...existing[idx],
        ...input,
        id: input.id,
        updatedAt: now,
      };
      existing[idx] = next;
      await saveTrainingConstraints(existing);
      return next;
    }
  }
  const created: TrainingConstraint = {
    ...input,
    id: input.id ?? newId('tc'),
    status: input.status ?? 'monitor',
    reason: input.reason || 'unspecified',
    startDate: input.startDate || now.slice(0, 10),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  await saveTrainingConstraints([created, ...existing]);
  return created;
}

/** Active constraints future programming may consult (excludes archived). */
export async function loadActiveTrainingConstraints(
  statuses?: TrainingConstraintStatus[]
): Promise<TrainingConstraint[]> {
  const all = await loadTrainingConstraints();
  const allow = new Set(
    statuses ?? (['monitor', 'modify', 'temporarilyAvoid'] as TrainingConstraintStatus[])
  );
  return all.filter((c) => !c.archivedAt && allow.has(c.status));
}

export async function archiveTrainingConstraint(id: string): Promise<TrainingConstraint | null> {
  const existing = await loadTrainingConstraints();
  const idx = existing.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const next: TrainingConstraint = {
    ...existing[idx],
    status: 'normal',
    archivedAt: nowIso(),
    updatedAt: nowIso(),
  };
  existing[idx] = next;
  await saveTrainingConstraints(existing);
  return next;
}

// ---------------------------------------------------------------------------
// Movement assessments
// ---------------------------------------------------------------------------

export async function loadMovementAssessments(): Promise<MovementAssessment[]> {
  const raw = await loadUserData<MovementAssessment[]>(MOVEMENT_ASSESSMENTS_KEY);
  return Array.isArray(raw) ? clampList(raw.filter((a) => a && typeof a.id === 'string')) : [];
}

export async function saveMovementAssessments(assessments: MovementAssessment[]): Promise<void> {
  await saveUserData(MOVEMENT_ASSESSMENTS_KEY, clampList(assessments));
}

export async function appendMovementAssessment(
  input: Omit<MovementAssessment, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: string;
  }
): Promise<MovementAssessment> {
  const assessment: MovementAssessment = {
    ...input,
    id: input.id ?? newId('ma'),
    timestamp: input.timestamp ?? nowIso(),
    findings: Array.isArray(input.findings) ? input.findings : [],
  };
  const existing = await loadMovementAssessments();
  await saveMovementAssessments([assessment, ...existing]);
  return assessment;
}

// ---------------------------------------------------------------------------
// Post-workout movement feedback
// ---------------------------------------------------------------------------

export async function loadPostWorkoutMovementFeedback(): Promise<PostWorkoutMovementFeedback[]> {
  const raw = await loadUserData<PostWorkoutMovementFeedback[]>(POST_WORKOUT_MOVEMENT_FEEDBACK_KEY);
  return Array.isArray(raw) ? clampList(raw.filter((f) => f && typeof f.id === 'string')) : [];
}

export async function savePostWorkoutMovementFeedback(
  rows: PostWorkoutMovementFeedback[]
): Promise<void> {
  await saveUserData(POST_WORKOUT_MOVEMENT_FEEDBACK_KEY, clampList(rows));
}

export async function appendPostWorkoutMovementFeedback(
  input: Omit<PostWorkoutMovementFeedback, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: string;
  }
): Promise<PostWorkoutMovementFeedback> {
  const row: PostWorkoutMovementFeedback = {
    ...input,
    id: input.id ?? newId('pwf'),
    timestamp: input.timestamp ?? nowIso(),
    discomfortSeverity:
      input.discomfortSeverity == null
        ? undefined
        : Math.max(0, Math.min(10, Number(input.discomfortSeverity) || 0)),
  };
  const existing = await loadPostWorkoutMovementFeedback();
  await savePostWorkoutMovementFeedback([row, ...existing]);
  return row;
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export async function loadMovementIntelligenceSnapshot(): Promise<MovementIntelligenceSnapshot> {
  const [
    profile,
    discomfortReports,
    trainingConstraints,
    movementAssessments,
    postWorkoutFeedback,
    latestAdaptationPlan,
  ] = await Promise.all([
    loadMovementProfile(),
    loadDiscomfortReports(),
    loadTrainingConstraints(),
    loadMovementAssessments(),
    loadPostWorkoutMovementFeedback(),
    loadLatestAdaptationPlan(),
  ]);
  return {
    profile,
    discomfortReports,
    trainingConstraints,
    movementAssessments,
    postWorkoutFeedback,
    latestAdaptationPlan,
  };
}

/** Reset helpers for tests / account wipe flows — does not touch coaching profile. */
export async function clearMovementIntelligenceData(): Promise<void> {
  const empty = createEmptyMovementIntelligenceSnapshot({ userId: currentUserId() });
  await Promise.all([
    saveUserData(MOVEMENT_PROFILE_KEY, empty.profile),
    saveUserData(DISCOMFORT_REPORTS_KEY, []),
    saveUserData(TRAINING_CONSTRAINTS_KEY, []),
    saveUserData(MOVEMENT_ASSESSMENTS_KEY, []),
    saveUserData(POST_WORKOUT_MOVEMENT_FEEDBACK_KEY, []),
    saveUserData(LATEST_ADAPTATION_PLAN_KEY, null),
  ]);
}
