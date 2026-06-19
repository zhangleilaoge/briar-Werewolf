/**
 * BlockVote Plugin (阻止投票)
 * Simple check: leadership/affinity
 * Protects a targeted player from being voted out
 */

import type { ActionProvider, ActionDefinition, ActionContext, ActionExecutionParams, ActionResult, DecisionContext, StateChange } from '../types';
import type { Player, CheckLog, DecisionCandidate } from '@/types';
import { calculateModifierBreakdown, performCheck, CHECK_DIFFICULTY_BLOCK_VOTE } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import { SCORE_DEFAULT_BLOCK_VOTE } from '@/types';

export class BlockVotePlugin implements ActionProvider {
  id = 'block_vote';
  type = 'action' as const;

  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    if (!player.alive || context.phase !== 'day') return [];
    return [{
      type: ACTION.BLOCK_VOTE,
      label: '阻止投票',
      description: '阻止大家投票放逐一名玩家',
      requiresTarget: true,
      targetFilter: (p, t) => t.alive && t.id !== p.id,
    }];
  }

  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    if (!target) return { success: false, logs: [], stateChanges: [], events: [] };

    const actorAttr = actor.attributes.leadership >= actor.attributes.affinity ? 'leadership' : 'affinity';
    const mod = calculateModifierBreakdown(actor.attributes[actorAttr], actor.alignment, actor.stress, 'leadership');
    const result = performCheck(mod.total, CHECK_DIFFICULTY_BLOCK_VOTE);
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
      difficulty: CHECK_DIFFICULTY_BLOCK_VOTE,
      margin: result.margin,
      success: result.success,
      successLevel,
    };

    return {
      success: true,
      logs: [createGameLog(context, 'action', `${actor.name} 阻止投票给 ${target.name}：「今天不要投 ${target.name}」（${successLevel}）`, { actorId: actor.id, action: ACTION.BLOCK_VOTE, targetId: target.id })],
      checks: [checkLog],
      stateChanges: [
        { type: 'stress_change', targetId: target.id, payload: { delta: -(1 + Math.floor(Math.random() * 1)) } },
        { type: 'relation_change', targetId: target.id, payload: { fromId: target.id, toId: actor.id, trustDelta: 0, friendlyDelta: 1 } },
      ],
      events: [],
    };
  }

  evaluate(context: DecisionContext): DecisionCandidate[] {
    const { belief, self, allPlayers } = context;
    const result: DecisionCandidate[] = [];

    // 村民策略：阻止投票给低狼概率目标
    if (self.team === 'villager') {
      const lowSuspects = allPlayers.filter(p => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) < 0.3);
      lowSuspects.forEach(target => {
        const wolfProb = belief.getWerewolfProbability(target.id);
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.BLOCK_VOTE, target.id);
        result.push({
          action: ACTION.BLOCK_VOTE,
          target: target.id,
          score: SCORE_DEFAULT_BLOCK_VOTE + scoreDelta,
          confidence: 1 - wolfProb,
          reason: `阻止投票给${target.name}，狼概率低${reason}`,
          strategy: 'BlockVotePlugin',
          rule: 'villager_block_vote',
          trigger: `wolfProb=${wolfProb.toFixed(2)} < 0.3`,
        });
      });
    }

    // 狼人策略：阻止投票给狼队友
    if (self.team === 'werewolf') {
      const wolfTeammates = allPlayers.filter(p => p.id !== self.id && p.alive && p.team === 'werewolf');
      wolfTeammates.forEach(target => {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.BLOCK_VOTE, target.id);
        result.push({
          action: ACTION.BLOCK_VOTE,
          target: target.id,
          score: SCORE_DEFAULT_BLOCK_VOTE + 50 + scoreDelta,
          confidence: 0.9,
          reason: `保护狼队友${target.name}${reason}`,
          strategy: 'BlockVotePlugin',
          rule: 'werewolf_protect_teammate',
          trigger: '保护狼队友',
        });
      });
    }

    return result.sort((a, b) => b.score - a.score);
  }
}
