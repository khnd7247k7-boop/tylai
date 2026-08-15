/**
 * Thin service façade for Movement Intelligence safety evaluation.
 * Pure rules live in `movementSafetyEvaluation` for easy independent testing.
 */

export {
  evaluateDiscomfortSafety,
  evaluateDiscomfortSafetyBatch,
  SAFETY_USER_MESSAGES,
  type EvaluateDiscomfortSafetyInput,
} from '../utils/movementSafetyEvaluation';

export type {
  DiscomfortSafetySignals,
  MovementSafetyAssessmentResult,
  MovementSafetyFactor,
  MovementSafetyFactorCode,
  MovementSafetyLevel,
  MovementSafetyStatus,
} from '../types/movementIntelligence';
