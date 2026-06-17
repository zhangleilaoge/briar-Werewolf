import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
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

    // @ts-ignore
    const originalTargetId = joinAction.originalTargetId as string;
    const target = allPlayers.find((p) => p.id === originalTargetId);
    if (!target || !target.alive) return result;

    const wolfProb = belief.getWerewolfProbability(target.id);
    if (wolfProb > 0.5 || (self.team === 'werewolf' && target.team !== 'werewolf')) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'join_suspect', originalTargetId);
      result.push({
        action: 'join_suspect',
        target: originalTargetId,
        score: wolfProb * 80 + (self.team === 'werewolf' ? 30 : 0) + scoreDelta,
        confidence: 0.6,
        reason: `附和怀疑${target.name}，狼嫌疑${(wolfProb * 100).toFixed(0)}%${reason}`,
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

    // @ts-ignore
    const originalTargetId = joinAction.originalTargetId as string;
    const target = allPlayers.find((p) => p.id === originalTargetId);
    if (!target || !target.alive) return result;

    const relation = belief.getRelation(target.id);
    if (relation.friendly > 3 || (self.team === 'werewolf' && target.team === 'werewolf')) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'join_defend', originalTargetId);
      result.push({
        action: 'join_defend',
        target: originalTargetId,
        score: relation.friendly * 10 + (self.team === 'werewolf' && target.team === 'werewolf' ? 40 : 0) + scoreDelta,
        confidence: 0.6,
        reason: `联合辩护${target.name}，友好度${relation.friendly.toFixed(1)}${reason}`,
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

    // @ts-ignore
    const originalActorId = rebutAction.originalActorId as string;
    const actor = allPlayers.find((p) => p.id === originalActorId);
    if (!actor) return result;

    // Always rebut if accused, but with varying confidence
    const myWolfProb = belief.getWerewolfProbability(self.id);
    const score = self.team === 'werewolf' ? 70 : 90; // villagers rebut harder
    const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'rebut', originalActorId);
    result.push({
      action: 'rebut',
      target: originalActorId,
      score: score + scoreDelta,
      confidence: 0.8,
      reason: `反驳${actor.name}的怀疑，为自己辩护${reason}`,
    });

    return result;
  },
};
