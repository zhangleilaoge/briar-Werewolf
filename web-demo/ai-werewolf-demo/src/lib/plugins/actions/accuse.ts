/**
 * Accuse Plugin (强烈指认)
 * Opposed check: insight/logic vs target stealth
 * Stronger version of suspect with more stress/relation impact
 */

import type { ActionProvider, ActionDefinition, ActionContext, ActionExecutionParams, ActionResult, DecisionContext, StateChange } from '@/lib/plugins/types';
import type { Player, CheckLog, DecisionCandidate } from '@/types';
import { calculateModifierBreakdown, performOpposedCheck } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import { SCORE_HIGH_SUSPECT_ACCUSE, SCORE_DEFAULT_ACCUSE } from '@/types';

export class AccusePlugin implements ActionProvider {
  id = 'accuse';
  type = 'action' as const;

  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    if (!player.alive || context.phase !== 'day') return [];
    return [{
      type: ACTION.ACCUSE,
      label: '强烈指认',
      description: '强烈指控一名玩家是狼人',
      requiresTarget: true,
      targetFilter: (p, t) => t.alive && t.id !== p.id,
    }];
  }

  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    if (!target) return { success: false, logs: [], stateChanges: [], events: [] };

    const actorAttr = actor.attributes.insight >= actor.attributes.logic ? 'insight' : 'logic';
    const actorMod = calculateModifierBreakdown(actor.attributes[actorAttr], actor.alignment, actor.stress, 'other');
    const targetMod = calculateModifierBreakdown(target.attributes.stealth, target.alignment, target.stress, 'stealth');
    const result = performOpposedCheck(actorMod.total, targetMod.total);
    const successLevel = result.success ? (result.criticalSuccess ? '大成功' : '成功') : '失败';

    const checkLog: CheckLog = {
      type: 'opposed',
      actorName: actor.name,
      actorAttribute: actorAttr,
      actorBaseValue: actor.attributes[actorAttr],
      actorAlignmentMod: actorMod.alignmentMod,
      actorStressMod: actorMod.stressMod,
      actorTotalModifier: actorMod.total - actor.attributes[actorAttr],
      actorRoll: result.actorRoll,
      actorTotal: result.actorTotal,
      targetName: target.name,
      targetAttribute: 'stealth',
      targetBaseValue: target.attributes.stealth,
      targetAlignmentMod: targetMod.alignmentMod,
      targetStressMod: targetMod.stressMod,
      targetTotalModifier: targetMod.total - target.attributes.stealth,
      targetRoll: result.targetRoll,
      targetTotal: result.targetTotal,
      margin: result.margin,
      success: result.success,
      successLevel,
    };

    return {
      success: true,
      logs: [createGameLog(context, 'action', `${actor.name} 强烈指认 ${target.name} 是狼人！（${successLevel}）`, { actorId: actor.id, action: ACTION.ACCUSE, targetId: target.id })],
      checks: [checkLog],
      stateChanges: [
        { type: 'stress_change', targetId: target.id, payload: { delta: 2 + Math.floor(Math.random() * 2) } },
        { type: 'relation_change', targetId: target.id, payload: { fromId: target.id, toId: actor.id, trustDelta: -5, friendlyDelta: -5 } },
      ],
      events: [],
    };
  }

  evaluate(context: DecisionContext): DecisionCandidate[] {
        if (context.phase !== 'day') return [];
    const { belief, self, allPlayers } = context;
    const result: DecisionCandidate[] = [];

    // 狼人策略：强烈指认高狼概率目标
    if (self.team === 'werewolf') {
      const suspects = allPlayers.filter(p => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) > 0.7);
      suspects.forEach(target => {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.ACCUSE, target.id);
        result.push({
          action: ACTION.ACCUSE,
          target: target.id,
          score: SCORE_HIGH_SUSPECT_ACCUSE + scoreDelta,
          confidence: belief.getWerewolfProbability(target.id),
          reason: `强烈怀疑${target.name}是狼人，狼概率${(belief.getWerewolfProbability(target.id) * 100).toFixed(0)}%${reason}`,
          strategy: 'AccusePlugin',
          rule: 'high_suspect_accuse',
          trigger: `wolfProb=${belief.getWerewolfProbability(target.id).toFixed(2)} > 0.7`,
        });
      });
    }

    // 村民策略：强烈指认高狼概率目标
    if (self.team === 'villager') {
      const suspects = allPlayers.filter(p => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) > 0.6);
      suspects.forEach(target => {
        const wolfProb = belief.getWerewolfProbability(target.id);
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.ACCUSE, target.id);
        result.push({
          action: ACTION.ACCUSE,
          target: target.id,
          score: SCORE_DEFAULT_ACCUSE + scoreDelta,
          confidence: wolfProb,
          reason: `强烈指认${target.name}，狼概率${(wolfProb * 100).toFixed(0)}%${reason}`,
          strategy: 'AccusePlugin',
          rule: 'villager_accuse',
          trigger: `wolfProb=${wolfProb.toFixed(2)} > 0.6`,
        });
      });
    }

    return result.sort((a, b) => b.score - a.score);
  }
}
