// ============================================================
// Intention System (BDI Extension) — Barrel Export (Legacy)
// ============================================================
// This file is kept for backward compatibility.
// All exports are re-exported from the intention/ directory.
// ============================================================

export {
  IntentionType,
  IntentionSource,
  CommitmentLevel,
} from './intention';
export type {
  PlanStep,
  Intention,
  IntentionExecutionContext,
  Desire,
  IntentionContext,
} from './intention';

export { DesireEngine } from './intention';
export { PlanLibrary } from './intention';
export { IntentionManager } from './intention';

export type { HardConstraint } from './intention';
export {
  WolfNoAttackTeammateConstraint,
  filterByHardConstraints,
} from './intention';

export {
  generateDesireProfile,
  explainIntention,
  isBusMode,
} from './intention';
