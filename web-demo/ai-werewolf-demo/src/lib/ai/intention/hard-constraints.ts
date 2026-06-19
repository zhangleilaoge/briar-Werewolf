// ============================================================
// Hard Constraints — 硬约束过滤
// ============================================================

import { ACTION, INTENTION_SOURCE } from '@/lib/constants/action-constants';
import type { Player } from '@/types';

import type { BeliefSystem } from '../belief-system';
import { type IntentionContext } from './types';

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
    if (!target || target.team !== 'werewolf') return false;
    const attackActions: string[] = [ACTION.CALL_VOTE, ACTION.ACCUSE, ACTION.SUSPECT, ACTION.VOTE];
    return attackActions.includes(candidate.action);
  },
  source: INTENTION_SOURCE.TEAM_DUTY,
};

export function filterByHardConstraints(
  candidates: { action: string; target: string | null; score?: number; confidence?: number; reason?: string; strategy?: string; rule?: string }[],
  context: IntentionContext,
  constraints: HardConstraint[] = [WolfNoAttackTeammateConstraint]
): { allowed: typeof candidates; blocked: { candidate: typeof candidates[0]; reason: string }[] } {
  const allowed: typeof candidates = [];
  const blocked: { candidate: typeof candidates[0]; reason: string }[] = [];

  for (const candidate of candidates) {
    let violated = false;
    let violationReason = '';

    for (const constraint of constraints) {
      if (!constraint.active(context)) continue;
      if (constraint.violated(candidate, context)) {
        violated = true;
        const sourceNames: Record<string, string> = { team_duty: '阵营职责', role_duty: '职业职责', survival: '生存', bus: '背锅' };
        violationReason = `违反硬约束[${constraint.id}]: ${constraint.description} (来源: ${sourceNames[constraint.source] || constraint.source})`;
        break;
      }
    }

    if (violated) {
      blocked.push({ candidate, reason: violationReason });
    } else {
      allowed.push(candidate);
    }
  }

  return { allowed, blocked };
}
