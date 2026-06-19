// ============================================================
// Intention System Barrel Export
// ============================================================
// Re-exports all intention system modules for clean imports.
// Backward-compatible entry: import { ... } from '@/lib/ai/intention-system'
// Modern entry: import { ... } from '@/lib/ai/intention'
// ============================================================

export {
  IntentionType,
  IntentionSource,
  CommitmentLevel,
} from './types';
export type {
  PlanStep,
  Intention,
  IntentionExecutionContext,
  Desire,
  IntentionContext,
} from './types';

export { DesireEngine } from './desire-engine';
export { PlanLibrary } from './plan-library';
export { IntentionManager } from './intention-manager';

export type { HardConstraint } from './hard-constraints';
export {
  WolfNoAttackTeammateConstraint,
  filterByHardConstraints,
} from './hard-constraints';

export {
  generateDesireProfile,
  explainIntention,
  isBusMode,
} from './legacy';
