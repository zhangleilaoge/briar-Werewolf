// ============================================================
// Plan Library — 预定义计划模板
// ============================================================

import { ACTION } from '@/lib/constants/action-constants';
import type { Player } from '@/types';

import { IntentionType, type PlanStep } from './types';

function _attackPlan(targetId: string | null, self: Player, _allPlayers: Player[]): PlanStep[] {
  if (!targetId) return [];
  const steps: PlanStep[] = [];
  if (self.team === 'werewolf') {
    // 狼人攻击：伪装怀疑 → 号召投票 → 投票
    steps.push(
      { phase: 'day', action: ACTION.SUSPECT, targetRequired: true },
      { phase: 'day', action: ACTION.CALL_VOTE, targetRequired: true },
      { phase: 'vote', action: ACTION.VOTE, targetRequired: true }
    );
  } else {
    // 村民攻击：指认 → 号召投票 → 投票
    steps.push(
      { phase: 'day', action: ACTION.ACCUSE, targetRequired: true },
      { phase: 'day', action: ACTION.CALL_VOTE, targetRequired: true },
      { phase: 'vote', action: ACTION.VOTE, targetRequired: true }
    );
  }
  return steps;
}

function _defendPlan(targetId: string | null, _self: Player): PlanStep[] {
  if (!targetId) return [];
  return [
    { phase: 'day', action: ACTION.DEFEND, targetRequired: true },
    { phase: 'day', action: ACTION.GUARANTEE, targetRequired: true },
    { phase: 'appendix', action: ACTION.JOIN_DEFEND, targetRequired: true },
  ];
}

function _concealPlan(self: Player): PlanStep[] {
  if (self.team === 'werewolf') {
    return [
      { phase: 'day', action: ACTION.SILENCE, targetRequired: false },
      { phase: 'day', action: ACTION.SUSPECT, targetRequired: true },
      { phase: 'vote', action: ACTION.VOTE, targetRequired: true },
    ];
  }
  return [
    { phase: 'day', action: ACTION.OBSERVE, targetRequired: true },
    { phase: 'day', action: ACTION.SILENCE, targetRequired: false },
  ];
}

function _revealPlan(targetId: string | null, self: Player): PlanStep[] {
  if (self.role === 'prophet' && targetId) {
    return [
      { phase: 'day', action: ACTION.CLAIM_IDENTITY, targetRequired: true },
      { phase: 'day', action: ACTION.CALL_VOTE, targetRequired: true },
      { phase: 'vote', action: ACTION.VOTE, targetRequired: true },
    ];
  }
  return [{ phase: 'day', action: ACTION.REVEAL_INFO, targetRequired: false }];
}

function _investigatePlan(targetId: string | null): PlanStep[] {
  if (!targetId) return [];
  return [{ phase: 'night', action: ACTION.CHECK, targetRequired: true }];
}

function _survivePlan(self: Player, allPlayers: Player[]): PlanStep[] {
  if (self.team === 'werewolf') {
    // 狼人自保：攻击低嫌疑目标洗白
    const lowSuspect = allPlayers
      .filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf')
      .sort((a, b) => a.stress - b.stress)[0];
    if (lowSuspect) {
      return [
        { phase: 'day', action: ACTION.SUSPECT, targetRequired: true },
        { phase: 'vote', action: ACTION.VOTE, targetRequired: true },
      ];
    }
  }
  return [
    { phase: 'day', action: ACTION.GUARANTEE, targetRequired: true },
    { phase: 'day', action: ACTION.DEFEND, targetRequired: true },
    { phase: 'appendix', action: ACTION.REBUT, targetRequired: true },
  ];
}

function _recruitPlan(self: Player, allPlayers: Player[]): PlanStep[] {
  const highTrust = allPlayers
    .filter((p) => p.id !== self.id && p.alive)
    .sort((a, b) => (self.relations[b.id]?.trust ?? 0) - (self.relations[a.id]?.trust ?? 0))[0];
  if (highTrust) {
    return [
      { phase: 'day', action: ACTION.SILENCE, targetRequired: false },
      { phase: 'day', action: ACTION.DEFEND, targetRequired: true },
    ];
  }
  return [{ phase: 'day', action: ACTION.SILENCE, targetRequired: false }];
}

function _cutLossPlan(targetId: string | null, _self: Player): PlanStep[] {
  if (!targetId) return [];
  return [
    { phase: 'day', action: ACTION.SUSPECT, targetRequired: true },
    { phase: 'day', action: ACTION.CALL_VOTE, targetRequired: true },
    { phase: 'vote', action: ACTION.VOTE, targetRequired: true },
  ];
}

function _followPlan(targetId: string | null): PlanStep[] {
  if (!targetId) return [];
  return [
    { phase: 'day', action: ACTION.JOIN_SUSPECT, targetRequired: true },
    { phase: 'vote', action: ACTION.VOTE, targetRequired: true },
  ];
}

function _silencePlan(): PlanStep[] {
  return [
    { phase: 'day', action: ACTION.SILENCE, targetRequired: false },
    { phase: 'day', action: ACTION.OBSERVE, targetRequired: true },
  ];
}

export const PlanLibrary = {
  getPlan(intentionType: IntentionType, targetId: string | null, self: Player, allPlayers: Player[]): PlanStep[] {
    switch (intentionType) {
      case IntentionType.ATTACK:
        return _attackPlan(targetId, self, allPlayers);
      case IntentionType.DEFEND:
        return _defendPlan(targetId, self);
      case IntentionType.CONCEAL:
        return _concealPlan(self);
      case IntentionType.REVEAL:
        return _revealPlan(targetId, self);
      case IntentionType.INVESTIGATE:
        return _investigatePlan(targetId);
      case IntentionType.SURVIVE:
        return _survivePlan(self, allPlayers);
      case IntentionType.RECRUIT:
        return _recruitPlan(self, allPlayers);
      case IntentionType.CUT_LOSS:
        return _cutLossPlan(targetId, self);
      case IntentionType.FOLLOW:
        return _followPlan(targetId);
      case IntentionType.SILENCE:
        return _silencePlan();
      default:
        return [];
    }
  },

  /** 获取当前阶段对应的计划步骤 */
  getStepForPhase(plan: PlanStep[], phase: string): PlanStep | null {
    return plan.find((s) => s.phase === phase) || null;
  },
};
