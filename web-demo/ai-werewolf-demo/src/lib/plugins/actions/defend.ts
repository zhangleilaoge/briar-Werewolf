/**
 * Defend Plugin (袒护)
 * Simple check: affinity + alignment modifier
 * Success decreases target stress, increases relation
 */

import type { ActionProvider, ActionDefinition, ActionContext, ActionExecutionParams, ActionResult, DecisionContext, StateChange } from '../types';
import type { Player, CheckLog, DecisionCandidate } from '@/types';
import { calculateModifierBreakdown, performCheck, CHECK_DIFFICULTY_DEFEND } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import { SCORE_DEFEND_ATTACKED, SCORE_DEFAULT_DEFEND } from '@/types';

export class DefendPlugin implements ActionProvider {
  id = 'defend';
  type = 'action' as const;

  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    if (!player.alive || context.phase !== 'day') return [];
    return [{
      type: ACTION.DEFEND,
      label: '袒护',
      description: '为一名玩家辩护',
      requiresTarget: true,
      targetFilter: (p, t) => t.alive && t.id !== p.id,
    }];
  }

  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    if (!target) return { success: false, logs: [], stateChanges: [], events: [] };

    const mod = calculateModifierBreakdown(actor.attributes.affinity, actor.alignment, actor.stress, 'affinity', true);
    const result = performCheck(mod.total, CHECK_DIFFICULTY_DEFEND);
    const successLevel = result.success ? (result.criticalSuccess ? '大成功' : '成功') : '失败';

    const checkLog: CheckLog = {
      type: 'check',
      actorName: actor.name,
      actorAttribute: 'affinity',
      actorBaseValue: actor.attributes.affinity,
      actorAlignmentMod: mod.alignmentMod,
      actorStressMod: mod.stressMod,
      actorTotalModifier: mod.total - actor.attributes.affinity,
      actorRoll: result.roll,
      actorTotal: result.total,
      difficulty: CHECK_DIFFICULTY_DEFEND,
      margin: result.margin,
      success: result.success,
      successLevel,
    };

    const logs = [createGameLog(context, 'action', `${actor.name} 袒护 ${target.name}：「我相信 ${target.name} 是好人」（${successLevel}）`, { actorId: actor.id, action: ACTION.DEFEND, targetId: target.id })];

    const stateChanges: StateChange[] = [
      { type: 'stress_change', targetId: target.id, payload: { delta: -1 } },
      { type: 'relation_change', targetId: target.id, payload: { fromId: target.id, toId: actor.id, trustDelta: 0, friendlyDelta: 2 } },
    ];

    return { success: true, logs, checks: [checkLog], stateChanges, events: [] };
  }

  evaluate(context: DecisionContext): DecisionCandidate[] {
    const { self, allPlayers, belief } = context;
    const result: DecisionCandidate[] = [];

    // 狼人策略：被攻击时自保
    if (self.team === 'werewolf') {
      const attacksOnMe = (context.publicActions || []).filter(a => a.targetId === self.id && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE));
      if (attacksOnMe.length > 0) {
        const attacker = allPlayers.find(p => p.id === attacksOnMe[0].actorId);
        if (attacker) {
          const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.DEFEND, self.id);
          result.push({
            action: ACTION.DEFEND,
            target: self.id,
            score: SCORE_DEFEND_ATTACKED + scoreDelta,
            confidence: 0.5,
            reason: `自保：需要证明清白${reason}`,
            strategy: 'DefendPlugin',
            rule: 'self_guarantee',
            trigger: '被攻击，需自保',
          });
        }
      }
    }

    // 村民策略：袒护被怀疑的好人
    if (self.team === 'villager') {
      const suspects = (context.publicActions || []).filter(a => a.type === ACTION.SUSPECT && a.targetId);
      suspects.forEach(suspectAction => {
        const target = allPlayers.find(p => p.id === suspectAction.targetId);
        if (target && target.alive && belief.getWerewolfProbability(target.id) < 0.3) {
          const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.DEFEND, target.id);
          result.push({
            action: ACTION.DEFEND,
            target: target.id,
            score: SCORE_DEFAULT_DEFEND + scoreDelta,
            confidence: 0.6,
            reason: `袒护${target.name}，狼概率低${reason}`,
            strategy: 'DefendPlugin',
            rule: 'villager_defend',
            trigger: '被怀疑的玩家狼概率低',
          });
        }
      });
    }

    return result.sort((a, b) => b.score - a.score);
  }
}
