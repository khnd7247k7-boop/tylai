/**
 * Conservative Safety & Escalation Layer for Movement Intelligence.
 *
 * NOT a medical diagnosis system.
 * Identifies when TYL should stop auto-modifying training and recommend
 * evaluation by a qualified healthcare professional.
 *
 * Does not name injuries or claim medical causes.
 */

import type {
  DiscomfortReport,
  DiscomfortSafetySignals,
  MovementSafetyAssessmentResult,
  MovementSafetyFactor,
  MovementSafetyLevel,
  MovementSafetyStatus,
} from '../types/movementIntelligence';

export const SAFETY_USER_MESSAGES = {
  continue:
    "You're good to keep training with normal awareness. Check in again if anything changes.",
  modify: "Let's adjust this movement and see how your body responds.",
  monitor: "Let's reduce the demand on this movement and keep an eye on how it responds.",
  professional_evaluation:
    'Your responses suggest this may be something you should have evaluated by a qualified healthcare professional. TYL can help modify your training, but it cannot diagnose or treat injuries.',
} as const;

export type EvaluateDiscomfortSafetyInput = {
  report: Pick<
    DiscomfortReport,
    | 'id'
    | 'severity'
    | 'sensation'
    | 'trend'
    | 'frequency'
    | 'modificationResponse'
    | 'modificationsAttempted'
  >;
  /** Explicit optional flags when known (not inferred from free text). */
  signals?: DiscomfortSafetySignals;
  /** ISO timestamp override (tests). */
  now?: string;
};

function clampSeverity(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(10, Math.round(raw)));
}

function hasAttemptedModification(report: EvaluateDiscomfortSafetyInput['report']): boolean {
  const attempted = (report.modificationsAttempted ?? []).filter((m) => {
    const t = m.trim().toLowerCase();
    return t.length > 0 && t !== "haven't tried" && t !== 'havent tried' && t !== "haven't tried";
  });
  return attempted.length > 0;
}

/**
 * Evaluate a single DiscomfortReport (+ optional explicit safety signals).
 * Conservative: escalate on clear combinations; prefer monitor/modify otherwise.
 */
export function evaluateDiscomfortSafety(
  input: EvaluateDiscomfortSafetyInput
): MovementSafetyAssessmentResult {
  const { report, signals = {} } = input;
  const severity = clampSeverity(Number(report.severity));
  const factors: MovementSafetyFactor[] = [];

  let escalate = false;
  let monitor = false;
  let modify = false;

  // --- Explicit high-concern signals (when provided) ---
  if (signals.recentTrauma) {
    escalate = true;
    factors.push({
      code: 'recent_trauma',
      detail: 'Recent significant trauma was indicated.',
    });
  }
  if (signals.significantSwelling) {
    escalate = true;
    factors.push({
      code: 'significant_swelling',
      detail: 'Significant swelling was indicated.',
    });
  }
  if (signals.limitedWeightBearingOrUse) {
    escalate = true;
    factors.push({
      code: 'limited_weight_bearing_or_use',
      detail: 'Limited normal use or weight-bearing was indicated.',
    });
  }
  if (signals.suddenMajorStrengthLoss) {
    escalate = true;
    factors.push({
      code: 'sudden_major_strength_loss',
      detail: 'Sudden major strength loss was indicated.',
    });
  }

  // --- Sensation-based (structured fields only) ---
  if (report.sensation === 'numbness' || report.sensation === 'tingling') {
    escalate = true;
    factors.push({
      code: 'numbness_or_tingling',
      detail: 'Numbness or tingling was reported.',
    });
  }
  if (report.sensation === 'weakness' && severity >= 7) {
    escalate = true;
    factors.push({
      code: 'high_severity_weakness',
      detail: 'Marked weakness with high discomfort was reported.',
    });
  } else if (report.sensation === 'weakness' && severity >= 4) {
    monitor = true;
    factors.push({
      code: 'high_severity_weakness',
      detail: 'Weakness was reported with elevated discomfort.',
    });
  }
  if (report.sensation === 'instability' && severity >= 7) {
    escalate = true;
    factors.push({
      code: 'high_severity_instability',
      detail: 'Instability with high discomfort was reported.',
    });
  } else if (report.sensation === 'instability' && severity >= 4) {
    monitor = true;
    factors.push({
      code: 'high_severity_instability',
      detail: 'Instability was reported with elevated discomfort.',
    });
  }
  if (report.sensation === 'sharp' && severity >= 6 && severity < 8) {
    monitor = true;
    factors.push({
      code: 'sharp_with_elevated_severity',
      detail: 'Sharp sensation with elevated discomfort.',
    });
  }

  // --- Severity ---
  if (severity >= 8) {
    escalate = true;
    factors.push({
      code: 'severe_discomfort',
      detail: 'Discomfort intensity is in the severe range.',
    });
  } else if (severity >= 5) {
    monitor = true;
    factors.push({
      code: 'moderate_discomfort',
      detail: 'Discomfort intensity suggests reducing demand.',
    });
  } else if (severity >= 3) {
    modify = true;
    factors.push({
      code: 'mild_signal',
      detail: 'Mild–moderate discomfort suggests a movement adjustment.',
    });
  }

  // --- Trend ---
  if (report.trend === 'worsening') {
    if (severity >= 6) {
      escalate = true;
      factors.push({
        code: 'rapidly_worsening',
        detail: 'Symptoms are worsening with elevated discomfort.',
      });
    } else {
      monitor = true;
      factors.push({
        code: 'rapidly_worsening',
        detail: 'Symptoms are reported as getting worse.',
      });
    }
  }

  // --- Worse / unchanged despite modifying training ---
  const triedMods = hasAttemptedModification(report);
  if (
    triedMods &&
    (report.modificationResponse === 'worsened' || report.modificationResponse === 'unchanged') &&
    report.trend === 'worsening' &&
    severity >= 4
  ) {
    escalate = true;
    factors.push({
      code: 'worsening_despite_modification',
      detail: 'Getting worse despite reducing or modifying training.',
    });
  } else if (
    triedMods &&
    report.modificationResponse === 'worsened' &&
    severity >= 5
  ) {
    escalate = true;
    factors.push({
      code: 'worsening_despite_modification',
      detail: 'Felt worse after changing the movement.',
    });
  } else if (
    triedMods &&
    report.modificationResponse === 'unchanged' &&
    severity >= 4
  ) {
    monitor = true;
    factors.push({
      code: 'modification_not_helping',
      detail: 'Changing the movement has not helped yet.',
    });
  }

  // --- Frequency ---
  if (
    (report.frequency === 'every_session' || report.frequency === 'constant') &&
    severity >= 7 &&
    report.trend === 'worsening'
  ) {
    escalate = true;
    factors.push({
      code: 'frequent_high_load',
      detail: 'Frequent high discomfort that is getting worse.',
    });
  } else if (
    (report.frequency === 'every_session' || report.frequency === 'constant') &&
    severity >= 4
  ) {
    monitor = true;
    factors.push({
      code: 'regular_recurrence',
      detail: 'This shows up regularly during training.',
    });
  } else if (report.frequency === 'frequent' && severity >= 3) {
    modify = true;
    factors.push({
      code: 'regular_recurrence',
      detail: 'This comes up often enough to adjust training.',
    });
  }

  // Deduplicate factors by code (keep first detail)
  const seen = new Set<string>();
  const uniqueFactors = factors.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });

  let status: MovementSafetyStatus;
  let safetyLevel: MovementSafetyLevel;

  if (escalate) {
    status = 'professional_evaluation';
    safetyLevel = 'high';
  } else if (monitor) {
    // Elevated caution: reduce demand and watch — engine may still modify lightly.
    status = 'monitor';
    safetyLevel = 'monitor';
    // Allow status/safetyLevel pairing like { status: 'modify', safetyLevel: 'monitor' }
    // when severity is moderate but not yet a hard monitor-only case.
    if (severity >= 3 && severity < 5 && report.trend !== 'worsening') {
      status = 'modify';
      safetyLevel = 'monitor';
    }
  } else if (modify || severity >= 3) {
    status = 'modify';
    safetyLevel = severity >= 4 ? 'moderate' : 'low';
  } else {
    status = 'continue';
    safetyLevel = 'low';
    if (!uniqueFactors.length) {
      uniqueFactors.push({
        code: 'mild_signal',
        detail: 'Low discomfort without escalation factors.',
      });
    }
  }

  return {
    status,
    safetyLevel,
    userMessage: SAFETY_USER_MESSAGES[status],
    factors: uniqueFactors,
    pauseAutomaticTrainingModification: status === 'professional_evaluation',
    sourceReportId: report.id,
    evaluatedAt: input.now ?? new Date().toISOString(),
  };
}

/**
 * Prefer the highest-concern result across multiple reports
 * (e.g. recent history for the same exercise/area).
 */
export function evaluateDiscomfortSafetyBatch(
  reports: EvaluateDiscomfortSafetyInput[]
): MovementSafetyAssessmentResult | null {
  if (!reports.length) return null;
  const rank: Record<MovementSafetyStatus, number> = {
    continue: 0,
    modify: 1,
    monitor: 2,
    professional_evaluation: 3,
  };
  let best: MovementSafetyAssessmentResult | null = null;
  for (const item of reports) {
    const next = evaluateDiscomfortSafety(item);
    if (!best || rank[next.status] > rank[best.status]) {
      best = next;
    } else if (
      best &&
      rank[next.status] === rank[best.status] &&
      next.factors.length > best.factors.length
    ) {
      best = next;
    }
  }
  return best;
}
