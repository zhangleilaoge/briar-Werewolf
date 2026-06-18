import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
import { SCORE_JOIN_SUSPECT_BASE, SCORE_JOIN_SUSPECT_WOLF_BONUS, SCORE_JOIN_DEFEND_BASE, SCORE_JOIN_DEFEND_WOLF_BONUS, SCORE_REBUT_WEREWOLF, SCORE_REBUT_VILLAGER } from '../constants';
import type { Strategy, StrategyContext } from './engine';

// ---------- Join Suspect (appendix) ----------
export const JoinSuspectStrategy: Strategy = {
  name: 'join_suspect',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['appendix'],
  evaluate(context) {
    const { belief, self, allPlayers, availableActions } = context;
    const result: import('../types').DecisionCandidate[] = [];

    const joinAction = availableActions.find((a) => a.type === 'join_suspect');
    if (!joinAction) return result;

    const originalTargetId = (joinAction as Record<string, unknown>).originalTargetId as string;
    const target = allPlayers.find((p) => p.id === originalTargetId);
    if (!target || !target.alive) return result;

    const wolfProb = belief.getWerewolfProbability(target.id);
    if (wolfProb > 0.5 || (self.team === 'werewolf' && target.team !== 'werewolf')) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'join_suspect', originalTargetId);
      result.push({
        action: 'join_suspect',
        target: originalTargetId,
        score: wolfProb * SCORE_JOIN_SUSPECT_BASE + (self.team === 'werewolf' ? SCORE_JOIN_SUSPECT_WOLF_BONUS : 0) + scoreDelta,
        confidence: 0.6,
        reason: `附和怀疑${target.name}，狼嫌疑${(wolfProb * 100).toFixed(0)}%${reason}`,
        strategy: 'JoinSuspectStrategy',
        rule: 'join_suspect',
        trigger: `wolfProb=${wolfProb.toFixed(2)} > 0.5 或 (self.team=werewolf 且 target.team!=werewolf)`,
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
    const result: import('../types').DecisionCandidate[] = [];

    const joinAction = availableActions.find((a) => a.type === 'join_defend');
    if (!joinAction) return result;

    const originalTargetId = (joinAction as Record<string, unknown>).originalTargetId as string;
    const target = allPlayers.find((p) => p.id === originalTargetId);
    if (!target || !target.alive) return result;

    const relation = belief.getRelation(target.id);
    if (relation.friendly > 3 || (self.team === 'werewolf' && target.team === 'werewolf')) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'join_defend', originalTargetId);
      result.push({
        action: 'join_defend',
        target: originalTargetId,
        score: relation.friendly * SCORE_JOIN_DEFEND_BASE + (self.team === 'werewolf' && target.team === 'werewolf' ? SCORE_JOIN_DEFEND_WOLF_BONUS : 0) + scoreDelta,
        confidence: 0.6,
        reason: `联合辩护${target.name}，友好度${relation.friendly.toFixed(1)}${reason}`,
        strategy: 'JoinDefendStrategy',
        rule: 'join_defend',
        trigger: `friendly=${relation.friendly.toFixed(1)} > 3 或 (self.team=werewolf 且 target.team=werewolf)`,
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
    const result: import('../types').DecisionCandidate[] = [];

    const rebutAction = availableActions.find((a) => a.type === 'rebut');
    if (!rebutAction) return result;

    const originalActorId = (rebutAction as Record<string, unknown>).originalActorId as string;
    const actor = allPlayers.find((p) => p.id === originalActorId);
    if (!actor) return result;

    // Always rebut if accused, but with varying confidence
    const myWolfProb = belief.getWerewolfProbability(self.id);
    const score = self.team === 'werewolf' ? SCORE_REBUT_WEREWOLF : SCORE_REBUT_VILLAGER; // villagers rebut harder
    const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'rebut', originalActorId);
    result.push({
      action: 'rebut',
      target: originalActorId,
      score: score + scoreDelta,
      confidence: 0.8,
      reason: `反驳${actor.name}的怀疑，为自己辩护${reason}`,
      strategy: 'RebutStrategy',
      rule: 'rebut',
      trigger: `被怀疑/被攻击，team=${self.team} 基础分=${score}`,
    });

    return result;
  },
};
