// ============================================================
// Hard Constraints — 硬约束过滤
// ============================================================

import { ACTION } from '@/lib/constants/action-constants';
import { IntentionSource } from './types';
import type { IntentionContext } from './types';

export interface HardConstraint {
  id: string;
  description: string;
  violated: (candidate: { action: string; target: string | null }, context: IntentionContext) => boolean;
  active: (context: IntentionContext) => boolean;
  source: 'team_duty' | 'role_duty' | 'survival' | 'bus';
}

export const WolfNoAttackTeammateConstraint: HardConstraint = {
  id: 'wolf_no_attack_teammate',
  description: '狼人白天不得主动号召投票/强烈指认/怀疑队友（除非进入切割模式）',
  active(context) {
    if (context.self.team !== 'werewolf' || !context.self.alive) return false;
    return true;
  },
  violated(candidate, context) {
    if (!candidate.target) return false;
    const target = context.allPlayers.find((p) => p.id === candidate.target);
    if (target?.team !== 'werewolf') return false;
    const attackActions: string[] = [ACTION.CALL_VOTE, ACTION.ACCUSE, ACTION.SUSPECT, ACTION.VOTE];
    return attackActions.includes(candidate.action);
  },
  source: IntentionSource.TEAM_DUTY,
};

export function filterByHardConstraints<T extends { action: string; target: string | null; score?: number; confidence?: number; reason?: string; strategy?: string; rule?: string }>(
  candidates: T[],
  context: IntentionContext,
  constraints: HardConstraint[] = [WolfNoAttackTeammateConstraint]
): { allowed: T[]; blocked: { candidate: T; reason: string; constraintId: string; description: string }[] } {
  const allowed: T[] = [];
  const blocked: { candidate: T; reason: string; constraintId: string; description: string }[] = [];

  for (const candidate of candidates) {
    let violated = false;
    let violatedConstraint: HardConstraint | null = null;

    for (const constraint of constraints) {
      if (!constraint.active(context)) continue;
      if (constraint.violated(candidate, context)) {
        violated = true;
        violatedConstraint = constraint;
        break;
      }
    }

    if (violated && violatedConstraint) {
      blocked.push({ candidate, reason: '违反硬约束', constraintId: violatedConstraint.id, description: violatedConstraint.description });
    } else {
      allowed.push(candidate);
    }
  }

  return { allowed, blocked };
}
