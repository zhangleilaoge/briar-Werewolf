/**
 * Suspect Plugin (怀疑)
 * Opposed check: insight/logic vs target stealth
 * Success increases target stress, decreases relation
 */

import type { ActionProvider, ActionDefinition, ActionContext, ActionExecutionParams, ActionResult, DecisionContext, StateChange } from '../types';
import type { Player, CheckLog, DecisionCandidate } from '@/types';
import { calculateModifierBreakdown, performOpposedCheck } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import { SCORE_HIGH_SUSPECT_SUSPECT, SCORE_DEFAULT_SUSPECT } from '@/types';

export class SuspectPlugin implements ActionProvider {
  id = 'suspect';
  type = 'action' as const;

  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    if (!player.alive || context.phase !== 'day') return [];
    return [{
      type: ACTION.SUSPECT,
      label: '怀疑',
      description: '对一名玩家表示怀疑',
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

    // Build check log
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

    const logs = [createGameLog(context, 'action', `${actor.name} 怀疑 ${target.name}：「我觉得 ${target.name} 可能是狼人」（${successLevel}）`, { actorId: actor.id, action: ACTION.SUSPECT, targetId: target.id })];

    const stateChanges: StateChange[] = [
      { type: 'stress_change', targetId: target.id, payload: { delta: 1 + Math.floor(Math.random() * 1) } },
      { type: 'relation_change', targetId: target.id, payload: { fromId: target.id, toId: actor.id, trustDelta: -1, friendlyDelta: -1 } },
    ];

    return { success: true, logs, checks: [checkLog], stateChanges, events: [] };
  }

  evaluate(context: DecisionContext): DecisionCandidate[] {
    const { belief, self, allPlayers } = context;
    const result: DecisionCandidate[] = [];

    // 狼人策略：伪装怀疑好人
    if (self.team === 'werewolf') {
      const potentialTargets = allPlayers.filter(p => p.id !== self.id && p.alive && p.team !== self.team);
      potentialTargets.forEach(target => {
        const wolfProb = belief.getWerewolfProbability(target.id);
        if (wolfProb < 0.5) {
          const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.SUSPECT, target.id);
          result.push({
            action: ACTION.SUSPECT,
            target: target.id,
            score: SCORE_HIGH_SUSPECT_SUSPECT + scoreDelta,
            confidence: 0.6,
            reason: `伪装怀疑${target.name}，狼嫌疑${(wolfProb * 100).toFixed(0)}%${reason}`,
            strategy: 'SuspectPlugin',
            rule: 'camouflage_suspect',
            trigger: `wolfProb=${wolfProb.toFixed(2)} < 0.5`,
          });
        }
      });
    }

    // 村民策略：怀疑高狼概率目标
    if (self.team === 'villager') {
      const suspects = allPlayers.filter(p => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) > 0.5);
      suspects.forEach(target => {
        const wolfProb = belief.getWerewolfProbability(target.id);
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.SUSPECT, target.id);
        result.push({
          action: ACTION.SUSPECT,
          target: target.id,
          score: SCORE_DEFAULT_SUSPECT + scoreDelta,
          confidence: wolfProb,
          reason: `怀疑${target.name}，狼概率${(wolfProb * 100).toFixed(0)}%${reason}`,
          strategy: 'SuspectPlugin',
          rule: 'villager_suspect',
          trigger: `wolfProb=${wolfProb.toFixed(2)} > 0.5`,
        });
      });
    }

    return result.sort((a, b) => b.score - a.score);
  }
}
