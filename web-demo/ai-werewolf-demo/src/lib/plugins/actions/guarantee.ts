/**
 * Guarantee Plugin (担保清白)
 * Simple check: affinity/insight + alignment modifier
 * Strong guarantee with larger stress/relation impact
 */

import type { ActionProvider, ActionDefinition, ActionContext, ActionExecutionParams, ActionResult, DecisionContext, } from '@/lib/plugins/types';
import type { Player, CheckLog, DecisionCandidate } from '@/types';
import { calculateModifierBreakdown, performCheck, CHECK_DIFFICULTY_GUARANTEE, BELIEF_VERY_LOW_SUSPICION_THRESHOLD } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import { SCORE_SELF_GUARANTEE, SCORE_DEFAULT_GUARANTEE } from '@/types';
import { CONFIDENCE_LOW_MEDIUM, CONFIDENCE_MEDIUM_HIGH } from '@/lib/constants/mind';

export class GuaranteePlugin implements ActionProvider {
  id = 'guarantee';
  type = 'action' as const;

  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    if (!player.alive || context.phase !== 'day') return [];
    return [{
      type: ACTION.GUARANTEE,
      label: '担保清白',
      description: '以自身信誉担保一名玩家是好人',
      requiresTarget: true,
      targetFilter: (p, t) => t.alive && t.id !== p.id,
    }];
  }

  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    if (!target) return { success: false, logs: [], stateChanges: [], events: [] };

    const actorAttr = actor.attributes.affinity >= actor.attributes.insight ? 'affinity' : 'insight';
    const mod = calculateModifierBreakdown(actor.attributes[actorAttr], actor.alignment, actor.stress, 'affinity', true);
    const result = performCheck(mod.total, CHECK_DIFFICULTY_GUARANTEE);
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
      difficulty: CHECK_DIFFICULTY_GUARANTEE,
      margin: result.margin,
      success: result.success,
      successLevel,
    };

    return {
      success: true,
      logs: [createGameLog(context, 'action', `${actor.name} 担保 ${target.name} 是好人！（${successLevel}）`, { actorId: actor.id, action: ACTION.GUARANTEE, targetId: target.id })],
      checks: [checkLog],
      stateChanges: [
        { type: 'stress_change', targetId: target.id, payload: { delta: -(1 + Math.floor(Math.random() * 1)) } },
        { type: 'relation_change', targetId: target.id, payload: { fromId: target.id, toId: actor.id, trustDelta: 2, friendlyDelta: 5 } },
      ],
      events: [],
    };
  }

  evaluate(context: DecisionContext): DecisionCandidate[] {
        if (context.phase !== 'day') return [];
    const { self, allPlayers, belief } = context;
    const result: DecisionCandidate[] = [];

    // 狼人策略：被攻击时自保
    if (self.team === 'werewolf') {
      const attacksOnMe = (context.publicActions || []).filter(a => a.targetId === self.id && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE));
      if (attacksOnMe.length > 0) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.GUARANTEE);
        result.push({
          action: ACTION.GUARANTEE,
          target: self.id,
          score: SCORE_SELF_GUARANTEE + scoreDelta,
          confidence: CONFIDENCE_LOW_MEDIUM,
          reason: `自保：需要证明清白${reason}`,
          strategy: 'GuaranteePlugin',
          rule: 'self_guarantee',
          trigger: '被攻击，需自保',
        });
      }
    }

    // 村民策略：担保被怀疑的好人
    if (self.team === 'villager') {
      const suspects = (context.publicActions || []).filter(a => a.type === ACTION.SUSPECT && a.targetId);
      suspects.forEach(suspectAction => {
        const target = allPlayers.find(p => p.id === suspectAction.targetId);
        if (target?.alive && belief.getWerewolfProbability(target.id) < BELIEF_VERY_LOW_SUSPICION_THRESHOLD) {
          const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.GUARANTEE);
          result.push({
            action: ACTION.GUARANTEE,
            target: target.id,
            score: SCORE_DEFAULT_GUARANTEE + scoreDelta,
            confidence: CONFIDENCE_MEDIUM_HIGH,
            reason: `担保${target.name}，狼概率低${reason}`,
            strategy: 'GuaranteePlugin',
            rule: 'villager_guarantee',
            trigger: '被怀疑的玩家狼概率低',
          });
        }
      });
    }

    return result.sort((a, b) => b.score - a.score);
  }
}
