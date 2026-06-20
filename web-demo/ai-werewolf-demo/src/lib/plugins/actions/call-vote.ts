/**
 * CallVote Plugin (号召投票)
 * Simple check: leadership/logic
 * Influences others' voting behavior
 */

import type { ActionProvider, ActionDefinition, ActionContext, ActionExecutionParams, ActionResult, DecisionContext, } from '@/lib/plugins/types';
import type { Player, CheckLog, DecisionCandidate } from '@/types';
import { calculateModifierBreakdown, performCheck, CHECK_DIFFICULTY_CALL_VOTE, WEREWOLF_PROBABILITY_HIGH, BELIEF_HIGH_SUSPICION_THRESHOLD } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import { SCORE_HIGH_SUSPECT_CALL_VOTE, SCORE_DEFAULT_CALL_VOTE } from '@/types';

export class CallVotePlugin implements ActionProvider {
  id = 'call_vote';
  type = 'action' as const;

  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    if (!player.alive || context.phase !== 'day') return [];
    return [{
      type: ACTION.CALL_VOTE,
      label: '号召投票',
      description: '号召大家投票放逐一名玩家',
      requiresTarget: true,
      targetFilter: (p, t) => t.alive && t.id !== p.id,
    }];
  }

  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    if (!target) return { success: false, logs: [], stateChanges: [], events: [] };

    const actorAttr = actor.attributes.leadership >= actor.attributes.logic ? 'leadership' : 'logic';
    const mod = calculateModifierBreakdown(actor.attributes[actorAttr], actor.alignment, actor.stress, 'leadership');
    const result = performCheck(mod.total, CHECK_DIFFICULTY_CALL_VOTE);
    const successLevel = result.success ? (result.criticalSuccess ? '大成功' : '成功') : '失败';

    const checkLog: CheckLog = {
      type: 'check',
      actorName: actor.name,
      actorAttribute: actorAttr,
      actorBaseValue: actor.attributes[actorAttr],
      actorAlignmentMod: mod.alignmentMod,
      actorStressMod: mod.stressMod,
      actorTotalModifier: mod.total - actor.attributes[actorAttr],
      actorRoll: result.roll,
      actorTotal: result.total,
      difficulty: CHECK_DIFFICULTY_CALL_VOTE,
      margin: result.margin,
      success: result.success,
      successLevel,
    };

    return {
      success: true,
      logs: [createGameLog(context, 'action', `${actor.name} 号召投票给 ${target.name}：「大家今天投 ${target.name}！」（${successLevel}）`, { actorId: actor.id, action: ACTION.CALL_VOTE, targetId: target.id })],
      checks: [checkLog],
      stateChanges: [
        { type: 'stress_change', targetId: target.id, payload: { delta: 1 + Math.floor(Math.random() * 1) } },
        { type: 'relation_change', targetId: target.id, payload: { fromId: target.id, toId: actor.id, trustDelta: -1, friendlyDelta: -1 } },
      ],
      events: [],
    };
  }

  evaluate(context: DecisionContext): DecisionCandidate[] {
        if (context.phase !== 'day') return [];
    const { belief, self, allPlayers } = context;
    const result: DecisionCandidate[] = [];

    // 狼人策略：号召投票给高狼概率目标（伪装）
    if (self.team === 'werewolf') {
      const topSuspect = allPlayers
        .filter(p => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) > WEREWOLF_PROBABILITY_HIGH)
        .sort((a, b) => belief.getWerewolfProbability(b.id) - belief.getWerewolfProbability(a.id))[0];

      if (topSuspect) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.CALL_VOTE);
        result.push({
          action: ACTION.CALL_VOTE,
          target: topSuspect.id,
          score: SCORE_HIGH_SUSPECT_CALL_VOTE + scoreDelta,
          confidence: belief.getWerewolfProbability(topSuspect.id),
          reason: `${topSuspect.name}嫌疑很高，号召投票${reason}`,
          strategy: 'CallVotePlugin',
          rule: 'high_suspect_call_vote',
          trigger: `wolfProb=${belief.getWerewolfProbability(topSuspect.id).toFixed(2)} > ${WEREWOLF_PROBABILITY_HIGH}`,
        });
      }
    }

    // 村民策略：号召投票给高狼概率目标
    if (self.team === 'villager') {
      const topSuspect = allPlayers
        .filter(p => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) > BELIEF_HIGH_SUSPICION_THRESHOLD)
        .sort((a, b) => belief.getWerewolfProbability(b.id) - belief.getWerewolfProbability(a.id))[0];

      if (topSuspect) {
        const wolfProb = belief.getWerewolfProbability(topSuspect.id);
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.CALL_VOTE);
        result.push({
          action: ACTION.CALL_VOTE,
          target: topSuspect.id,
          score: SCORE_DEFAULT_CALL_VOTE + scoreDelta,
          confidence: wolfProb,
          reason: `${topSuspect.name}嫌疑高，号召投票${reason}`,
          strategy: 'CallVotePlugin',
          rule: 'villager_call_vote',
          trigger: `wolfProb=${wolfProb.toFixed(2)} > ${BELIEF_HIGH_SUSPICION_THRESHOLD}`,
        });
      }
    }

    return result.sort((a, b) => b.score - a.score);
  }
}
