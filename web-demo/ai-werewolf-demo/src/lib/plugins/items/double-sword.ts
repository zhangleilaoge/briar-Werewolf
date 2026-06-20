/**
 * Double Sword Plugin (双刃剑)
 * 
 * Special item for berserkers
 * Allows berserker to kill themselves and another player during day
 * Triggers a peaceful night after use
 */

import type {
  ActionProvider,
  ActionDefinition,
  ActionContext,
  ActionExecutionParams,
  ActionResult,
  DecisionContext,
  PluginEvent,
  StateChange,
} from '@/lib/plugins/types';
import type { Player, GameLogItem } from '@/types';
import { hasItem } from '@/types';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import {
  SCORE_BERSERKER_SUICIDE,
} from '@/types';
import { ACTION } from '@/lib/constants/action-constants';

export class DoubleSwordPlugin implements ActionProvider {
  id = 'double_sword';
  type = 'item' as const;
  
  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    // Only berserkers with double sword can use it during day
    if (player.role !== 'berserker' || player.team !== 'werewolf' || !hasItem(player, 'double_sword')) {
      return [];
    }
    
    // Only available during day phase
    if (context.phase !== 'day') {
      return [];
    }
    
    return [{
      type: ACTION.BERSERKER_KILL,
      label: '同归于尽',
      description: '使用双刃剑与一名玩家同归于尽，触发平安夜',
      requiresTarget: true,
      targetFilter: (player, target) => target.alive && target.id !== player.id,
      maxUsesPerGame: 1,
    }];
  }
  
  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    const logs: GameLogItem[] = [];
    const stateChanges: StateChange[] = [];
    const events: PluginEvent[] = [];
    
    if (!target) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试使用双刃剑但缺少目标`));
      return { success: false, logs, stateChanges, events };
    }
    
    if (!hasItem(actor, 'double_sword')) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试使用双刃剑但没有道具`));
      return { success: false, logs, stateChanges, events };
    }
    
    // Damage the double sword
    stateChanges.push({
      type: 'item_damage',
      targetId: actor.id,
      payload: { itemId: 'double_sword' },
    });
    
    // Kill both players
    stateChanges.push({
      type: 'custom',
      targetId: actor.id,
      payload: { action: 'die' },
    });
    
    stateChanges.push({
      type: 'custom',
      targetId: target.id,
      payload: { action: 'die' },
    });
    
    // Set peaceful night flag
    stateChanges.push({
      type: 'custom',
      targetId: 'system',
      payload: { action: 'set_peaceful_night' },
    });
    
    logs.push(createGameLog(
      context,
      'death',
      `${actor.name} 使用双刃剑与 ${target.name} 同归于尽！`,
      { playerId: actor.id }
    ));
    
    logs.push(createGameLog(
      context,
      'death',
      `${target.name} 被 ${actor.name} 的双刃剑杀死！`,
      { playerId: target.id }
    ));
    
    logs.push(createGameLog(
      context,
      'phase',
      '狂狼使用双刃剑，本夜为平安夜！'
    ));
    
    // Emit events for AI
    events.push({
      type: 'death',
      source: actor.id,
      payload: { playerId: actor.id },
    });
    
    events.push({
      type: 'death',
      source: actor.id,
      payload: { playerId: target.id },
    });
    
    return { success: true, logs, stateChanges, events };
  }
  
  evaluate(context: DecisionContext): import('@/types').DecisionCandidate[] {
    const { belief, self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    
    // Only berserkers with double sword can use it
    if (self.role !== 'berserker' || self.team !== 'werewolf' || !hasItem(self, 'double_sword')) {
      return result;
    }
    
    const aliveTargets = allPlayers.filter((p) => p.id !== self.id && p.alive);
    
    aliveTargets.forEach((target) => {
      // Prefer killing high-threat targets
      const wolfProb = belief.getWerewolfProbability(target.id);
      const isLikelyVillager = wolfProb < 0.3;
      const isHighThreat = target.attributes.insight >= 6 || target.attributes.leadership >= 6;
      
      let score = SCORE_BERSERKER_SUICIDE;
      if (isHighThreat) score += 20;
      if (isLikelyVillager) score += 10;
      
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.BERSERKER_KILL);
      
      result.push({
        action: ACTION.BERSERKER_KILL,
        target: target.id,
        score: score + scoreDelta,
        confidence: 0.6,
        reason: `与${target.name}同归于尽${isHighThreat ? '（高威胁目标）' : ''}${reason}`,
        strategy: 'DoubleSwordPlugin',
        rule: isHighThreat ? 'kill_high_threat' : 'kill_any',
        trigger: isHighThreat
          ? `target.attributes.insight=${target.attributes.insight} >= 6 或 leadership=${target.attributes.leadership} >= 6`
          : `常规同归于尽目标`,
      });
    });
    
    return result.sort((a, b) => b.score - a.score);
  }
}
