import { ACTION } from '@/lib/constants/action-constants';
import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
import {
  SCORE_JOIN_SUSPECT_BASE, SCORE_JOIN_SUSPECT_WOLF_BONUS,
  SCORE_JOIN_DEFEND_BASE, SCORE_JOIN_DEFEND_WOLF_BONUS,
  SCORE_REBUT_WEREWOLF, SCORE_REBUT_VILLAGER,
  WEREWOLF_PROBABILITY_MEDIUM,
  CONFIDENCE_JOIN_SUSPECT, CONFIDENCE_JOIN_DEFEND,
  RELATION_FRIENDLY_JOIN_DEFEND,
} from '@/types';
import type { Strategy } from './engine';
import type { JoinAction, RebutAction } from '@/lib/plugins/types';

// ---------- Join Suspect (appendix) ----------
export const JoinSuspectStrategy: Strategy = {
  name: 'join_suspect',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['appendix'],
  evaluate(context) {
    const { belief, self, allPlayers, availableActions } = context;
    const result: import('@/types').DecisionCandidate[] = [];

    const joinAction = availableActions.find((a) => a.type === ACTION.JOIN_SUSPECT);
    if (!joinAction) return result;

    const originalTargetId = (joinAction as JoinAction).originalTargetId;
    const target = allPlayers.find((p) => p.id === originalTargetId);
    if (!target?.alive) return result;

    const wolfProb = belief.getWerewolfProbability(target.id);
    if (wolfProb > WEREWOLF_PROBABILITY_MEDIUM || (self.team === 'werewolf' && target.team !== 'werewolf')) {
      const { scoreDelta, reason: _reason } = calculateBehaviorScoreDelta(self, ACTION.JOIN_SUSPECT);
      const baseScore = Math.floor(wolfProb * SCORE_JOIN_SUSPECT_BASE);
      const wolfBonus = self.team === 'werewolf' ? SCORE_JOIN_SUSPECT_WOLF_BONUS : 0;
      const notJoinPenalty = -15; // 不做会失去与怀疑者的同盟关系

      result.push({
        action: ACTION.JOIN_SUSPECT,
        target: originalTargetId,
        score: baseScore + wolfBonus + scoreDelta,
        confidence: CONFIDENCE_JOIN_SUSPECT,
        reason: `做: +${baseScore}(狼嫌疑${(wolfProb * 100).toFixed(0)}%×基础)${wolfBonus > 0 ? ` +${wolfBonus}(狼人)` : ''}${scoreDelta > 0 ? ` +${scoreDelta}(修正)` : ''} vs 不做: ${notJoinPenalty}(失去同盟)`,
        strategy: 'JoinSuspectStrategy',
        rule: 'join_suspect',
        trigger: `wolfProb=${wolfProb.toFixed(2)} > ${WEREWOLF_PROBABILITY_MEDIUM} 或 (self.team=werewolf 且 target.team!=werewolf)`,
      });
    }

    return result;
  },
};

// ---------- Join Defend (appendix) ----------
export const JoinDefendStrategy: Strategy = {
  name: 'join_defend',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['appendix'],
  evaluate(context) {
    const { belief, self, allPlayers, availableActions } = context;
    const result: import('@/types').DecisionCandidate[] = [];

    const joinAction = availableActions.find((a) => a.type === ACTION.JOIN_DEFEND);
    if (!joinAction) return result;

    const originalTargetId = (joinAction as JoinAction).originalTargetId;
    const target = allPlayers.find((p) => p.id === originalTargetId);
    if (!target?.alive) return result;

    const relation = belief.getRelation(target.id);
    if (relation.favor > RELATION_FRIENDLY_JOIN_DEFEND || (self.team === 'werewolf' && target.team === 'werewolf')) {
      const { scoreDelta, reason: _reason } = calculateBehaviorScoreDelta(self, ACTION.JOIN_DEFEND);
      const baseScore = Math.floor(relation.favor * SCORE_JOIN_DEFEND_BASE);
      const wolfBonus = self.team === 'werewolf' && target.team === 'werewolf' ? SCORE_JOIN_DEFEND_WOLF_BONUS : 0;
      const notJoinPenalty = -10; // 不做会降低与被保护者的关系

      result.push({
        action: ACTION.JOIN_DEFEND,
        target: originalTargetId,
        score: baseScore + wolfBonus + scoreDelta,
        confidence: CONFIDENCE_JOIN_DEFEND,
        reason: `做: +${baseScore}(好感度${relation.favor.toFixed(1)}×基础)${wolfBonus > 0 ? ` +${wolfBonus}(狼队友)` : ''}${scoreDelta > 0 ? ` +${scoreDelta}(修正)` : ''} vs 不做: ${notJoinPenalty}(关系下降)`,
        strategy: 'JoinDefendStrategy',
        rule: 'join_defend',
        trigger: `favor=${relation.favor.toFixed(1)} > ${RELATION_FRIENDLY_JOIN_DEFEND} 或 (self.team=werewolf 且 target.team=werewolf)`,
      });
    }

    return result;
  },
};

// ---------- Rebut (appendix) ----------
export const RebutStrategy: Strategy = {
  name: 'rebut',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['appendix'],
  evaluate(context) {
    const { belief, self, allPlayers, availableActions } = context;
    const result: import('@/types').DecisionCandidate[] = [];

    const rebutAction = availableActions.find((a) => a.type === ACTION.REBUT);
    if (!rebutAction) return result;

    const originalActorId = (rebutAction as RebutAction).originalActorId;
    const actor = allPlayers.find((p) => p.id === originalActorId);
    if (!actor) return result;

    // 计算反驳收益 vs 不反驳损失
    const baseScore = self.team === 'werewolf' ? SCORE_REBUT_WEREWOLF : SCORE_REBUT_VILLAGER;
    const { scoreDelta, reason: _reason } = calculateBehaviorScoreDelta(self, ACTION.REBUT);
    const myIdentityCrisis = belief.getIdentityCrisis();
    const notRebutPenalty = self.team === 'werewolf'
      ? (myIdentityCrisis > 0.5 ? -30 : -10)  // 狼人：不反驳损失较小（本来就要藏）
      : (myIdentityCrisis > 0.5 ? -50 : -20); // 村民：不反驳损失更大（被误投）

    result.push({
      action: ACTION.REBUT,
      target: originalActorId,
      score: baseScore + scoreDelta,
      confidence: 0.8,
      reason: `做: +${baseScore}(基础${self.team === 'werewolf' ? '狼人' : '村民'})${scoreDelta > 0 ? ` +${scoreDelta}(修正)` : ''} vs 不做: ${notRebutPenalty}(被怀疑扣信任)`,
      strategy: 'RebutStrategy',
      rule: 'rebut',
      trigger: `被怀疑，反驳收益(${baseScore}) > 不反驳损失(${notRebutPenalty})`,
    });

    return result;
  },
};
