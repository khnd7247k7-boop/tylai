/**
 * View-model helpers for the Movement Intelligence Premium screen.
 * Coach language only — never diagnoses.
 */

import type {
  MovementAdaptationPlan,
  MovementProfile,
  PostWorkoutMovementFeedback,
  ProgressiveReturnStage,
  TrainingConstraint,
  DiscomfortReport,
} from '../types/movementIntelligence';

export type MiFocusChip = {
  id: string;
  label: string;
};

export type MiAdjustmentRow = {
  id: string;
  title: string;
  detail: string;
};

export type MiTrendRow = {
  id: string;
  label: string;
  status: string;
};

export type MovementIntelligenceDashboardModel = {
  focusAreas: MiFocusChip[];
  adjustments: MiAdjustmentRow[];
  trends: MiTrendRow[];
  whyExplanation: string | null;
  hasAnySignal: boolean;
  upcomingHubItems: Array<{ id: string; label: string; locked?: boolean }>;
};

function humanizeFocus(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  // camelCase qualities → words; normalize hyphens
  const spaced = t
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function stageDetail(stage?: ProgressiveReturnStage): string {
  switch (stage) {
    case 'modified':
      return 'Demand reduced while building control';
    case 'regression':
      return 'Easier related variation selected';
    case 'normal_variation':
      return 'Returning toward a normal variation';
    case 'progressive_loading':
      return 'Gradually restoring load and complexity';
    case 'cleared':
      return 'Responding well — treating more normally';
    default:
      return 'Training adjustment in place';
  }
}

function romPhrase(rom?: string): string | null {
  if (!rom) return null;
  if (rom.includes('shortened')) return 'Reduced depth / range while building control';
  if (rom.includes('pain_free')) return 'Staying in a comfortable range';
  if (rom.includes('avoid')) return 'Avoiding provocative ranges for now';
  return rom.replace(/_/g, ' ');
}

export function buildAdjustmentRows(
  constraints: TrainingConstraint[],
  plan: MovementAdaptationPlan | null
): MiAdjustmentRow[] {
  const rows: MiAdjustmentRow[] = [];
  const active = constraints.filter((c) => !c.archivedAt && c.status !== 'normal');

  for (const c of active) {
    if (!c.exercise?.trim()) continue;
    const bits: string[] = [];
    const rom = romPhrase(c.romLimit);
    if (rom) bits.push(rom);
    else bits.push(stageDetail(c.progressiveReturnStage));
    if (c.preferredVariations?.[0] && c.preferredVariations[0] !== c.exercise) {
      bits.push(`Using ${c.preferredVariations[0]}`);
    }
    if (typeof c.intensityLimit === 'number' && c.intensityLimit < 0.95) {
      bits.push(`About ${Math.round(c.intensityLimit * 100)}% load`);
    }
    rows.push({
      id: c.id,
      title: c.exercise,
      detail: bits[0] ?? 'Adjusted for your response',
    });
  }

  // Supportive add-ons from latest plan
  const mods = plan?.movementConstraints.exercisesToModify ?? [];
  const stability = mods.find((m) => m.action === 'add_stability');
  if (stability) {
    const focus =
      plan?.movementConstraints.stabilityPriorities?.[0]?.replace(/([a-z])([A-Z])/g, '$1 $2') ??
      'stability';
    rows.push({
      id: 'add-stability',
      title: 'Additional work',
      detail: `${humanizeFocus(focus)} emphasis added`,
    });
  }
  const mobility = mods.find((m) => m.action === 'add_mobility');
  if (mobility && !rows.some((r) => r.id === 'add-mobility')) {
    const focus =
      plan?.movementConstraints.mobilityPriorities?.[0]?.replace(/([a-z])([A-Z])/g, '$1 $2') ??
      'mobility';
    rows.push({
      id: 'add-mobility',
      title: 'Mobility',
      detail: `${humanizeFocus(focus)} work available when it feels good`,
    });
  }

  // Dedupe by title
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Trends only when enough feedback/report history exists.
 * Never invent improving/decreasing from a single data point.
 */
export function buildTrendRows(
  feedback: PostWorkoutMovementFeedback[],
  reports: DiscomfortReport[],
  constraints: TrainingConstraint[]
): MiTrendRow[] {
  const trends: MiTrendRow[] = [];
  const byExercise = new Map<string, PostWorkoutMovementFeedback[]>();
  for (const f of feedback) {
    const key = f.exercise?.trim().toLowerCase();
    if (!key) continue;
    const list = byExercise.get(key) ?? [];
    list.push(f);
    byExercise.set(key, list);
  }

  for (const [key, list] of byExercise) {
    // Chronological oldest → newest (feedback stored newest-first)
    const ordered = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (ordered.length < 2) continue;

    const recent = ordered.slice(-3);
    const better = recent.filter((f) => f.outcome === 'better').length;
    const worse = recent.filter((f) => f.outcome === 'worse').length;
    const labelBase = ordered[ordered.length - 1]?.exercise ?? key;

    if (better >= 2 && better > worse) {
      trends.push({
        id: `tol-${key}`,
        label: `${labelBase} tolerance`,
        status: 'Improving',
      });
    } else if (worse >= 2 && worse > better) {
      trends.push({
        id: `tol-${key}`,
        label: `${labelBase} tolerance`,
        status: 'Needs more ease',
      });
    }

    const withSev = ordered.filter((f) => typeof f.discomfortSeverity === 'number');
    if (withSev.length >= 3) {
      const first = withSev[0].discomfortSeverity!;
      const last = withSev[withSev.length - 1].discomfortSeverity!;
      if (last <= first - 2) {
        trends.push({
          id: `disc-${key}`,
          label: 'Session discomfort',
          status: 'Decreasing',
        });
      } else if (last >= first + 2) {
        trends.push({
          id: `disc-${key}`,
          label: 'Session discomfort',
          status: 'Increasing',
        });
      }
    }
  }

  // Body-area discomfort from reports (need ≥2)
  const byArea = new Map<string, DiscomfortReport[]>();
  for (const r of reports) {
    if (r.bodyArea === 'other') continue;
    const list = byArea.get(r.bodyArea) ?? [];
    list.push(r);
    byArea.set(r.bodyArea, list);
  }
  for (const [area, list] of byArea) {
    const ordered = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    if (ordered.length < 2) continue;
    const first = ordered[0].severity;
    const last = ordered[ordered.length - 1].severity;
    const label = `${area.replace(/_/g, ' ')} discomfort`.replace(/\b\w/g, (c) => c.toUpperCase());
    if (last <= first - 2) {
      trends.push({ id: `area-${area}`, label, status: 'Decreasing' });
    } else if (last >= first + 2) {
      trends.push({ id: `area-${area}`, label, status: 'Increasing' });
    }
  }

  // Qualities in focus with enough better feedback → "Developing"
  const activeFocus = constraints.filter((c) => !c.archivedAt && (c.consecutiveBetter ?? 0) >= 2);
  if (activeFocus.length && feedback.filter((f) => f.outcome === 'better').length >= 2) {
    trends.push({
      id: 'control-developing',
      label: 'Stability & control',
      status: 'Developing',
    });
  }

  // Cap for a clean screen
  return trends.slice(0, 5);
}

export function buildWhyExplanation(
  plan: MovementAdaptationPlan | null,
  reports: DiscomfortReport[],
  constraints: TrainingConstraint[]
): string | null {
  if (plan?.trainingPriorities?.[0]) {
    // Prefer a coach-facing why paragraph
    const exercise = plan.movementConstraints.exercisesToModify.find(
      (m) => m.exerciseName && !m.exerciseName.startsWith('__')
    )?.exerciseName;
    const area = reports[0]?.bodyArea?.replace(/_/g, ' ');
    const stab = plan.movementConstraints.stabilityPriorities?.[0];
    const stabLabel = stab
      ? humanizeFocus(stab).toLowerCase()
      : 'stability and control';

    if (exercise && area) {
      return `Because you reported discomfort during ${exercise.toLowerCase().includes(area) ? exercise : `${exercise}`}, TYL temporarily reduced the demand on that movement and added work focused on ${stabLabel}. Unrelated training stays on track.`;
    }
    if (exercise) {
      return `Because you flagged ${exercise}, TYL reduced demand on that movement and is biasing supportive ${stabLabel} work while monitoring how you respond.`;
    }
  }

  const active = constraints.find((c) => c.exercise && !c.archivedAt && c.status !== 'normal');
  if (active?.exercise) {
    return `TYL is adjusting ${active.exercise} based on your movement check-ins — smaller demand where needed, with supportive control work, not a one-size workout.`;
  }

  const latest = reports[0];
  if (latest?.exercise) {
    return `Because you reported discomfort during ${latest.exercise}, TYL can reduce demand on that movement and prioritize stability and control while your primary goal stays front and center.`;
  }

  return null;
}

export function buildMovementIntelligenceDashboard(input: {
  profile: MovementProfile;
  constraints: TrainingConstraint[];
  feedback: PostWorkoutMovementFeedback[];
  reports: DiscomfortReport[];
  plan: MovementAdaptationPlan | null;
}): MovementIntelligenceDashboardModel {
  const focusFromProfile = (input.profile.currentFocusAreas ?? []).map((label, i) => ({
    id: `focus-${i}-${label}`,
    label: humanizeFocus(label),
  }));

  const fromPlan = [
    ...(input.plan?.movementConstraints.stabilityPriorities ?? []),
    ...(input.plan?.movementConstraints.mobilityPriorities ?? []),
    ...(input.plan?.movementConstraints.movementQualitiesToBuild ?? []),
  ].map((q, i) => ({ id: `pq-${i}-${q}`, label: humanizeFocus(q) }));

  const focusSeen = new Set<string>();
  const focusAreas: MiFocusChip[] = [];
  for (const f of [...focusFromProfile, ...fromPlan]) {
    const key = f.label.toLowerCase();
    if (focusSeen.has(key)) continue;
    focusSeen.add(key);
    focusAreas.push(f);
    if (focusAreas.length >= 6) break;
  }

  const adjustments = buildAdjustmentRows(input.constraints, input.plan);
  const trends = buildTrendRows(input.feedback, input.reports, input.constraints);
  const whyExplanation = buildWhyExplanation(input.plan, input.reports, input.constraints);

  return {
    focusAreas,
    adjustments,
    trends,
    whyExplanation,
    hasAnySignal:
      focusAreas.length > 0 ||
      adjustments.length > 0 ||
      trends.length > 0 ||
      Boolean(whyExplanation) ||
      input.reports.length > 0,
    upcomingHubItems: [
      { id: 'profile', label: 'Movement Profile' },
      { id: 'assessments', label: 'Movement Assessments', locked: true },
      { id: 'form', label: 'Form Analysis', locked: true },
      { id: 'history', label: 'Discomfort History' },
      { id: 'adaptations', label: 'Training Adaptations' },
      { id: 'progress', label: 'Progress' },
    ],
  };
}
