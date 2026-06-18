/**
 * Crystal Ball Plugin (水晶球)
 * 
 * Provides the check action for prophets at night
 * Allows prophets to verify if a player is a werewolf
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
} from '../types';
import type { Player } from '@/types';
import { hasItem } from '@/types';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import {
  SCORE_PROPHET_CHECK_BASE,
  SCORE_MAX_INFO_VOTE,
} from '@/types';

export class CrystalBallPlugin implements ActionProvider {
  id = 'crystal_ball';
  type = 'item' as const;
  
  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    // Anyone with crystal ball can check
    if (!hasItem(player, 'crystal_ball')) {
      return [];
    }
    
    return [{
      type: 'check',
      label: '查验',
      description: '使用水晶球查验一名玩家的身份',
      requiresTarget: true,
      targetFilter: (player, target) => target.alive && target.id !== player.id,
    }];
  }
  
  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    const logs: any[] = [];
    const stateChanges: StateChange[] = [];
    const events: PluginEvent[] = [];
    
    if (!target) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试查验但缺少目标`));
      return { success: false, logs, stateChanges, events };
    }
    
    if (!hasItem(actor, 'crystal_ball')) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试查验但缺少水晶球`));
      return { success: false, logs, stateChanges, events };
    }
    
    const isWerewolf = target.team === 'werewolf';
    const result = isWerewolf ? 'werewolf' : 'villager';
    
    logs.push(createGameLog(
      context,
      'action',
      `${actor.name} 查验 ${target.name} → ${isWerewolf ? '狼人' : '村民'}`,
      { actorId: actor.id, action: 'check', targetId: target.id }
    ));
    
    // Crystal ball breaks if checking a werewolf
    if (isWerewolf) {
      stateChanges.push({
        type: 'item_damage',
        targetId: actor.id,
        payload: { itemId: 'crystal_ball' },
      });
      
      logs.push(createGameLog(context, 'item', `${actor.name} 的水晶球在查验狼人时碎裂！`));
    }
    
    // Emit check result event for AI to record
    events.push({
      type: 'check_result',
      source: actor.id,
      payload: { targetId: target.id, result },
    });
    
    return { success: true, logs, stateChanges, events };
  }
  
  evaluate(context: DecisionContext): import('@/types').DecisionCandidate[] {
    const { belief, self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    
    // Anyone with crystal ball can check
    if (!hasItem(self, 'crystal_ball')) {
      return result;
    }
    
    const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);
    
    alivePlayers.forEach((target) => {
      // Skip already checked players
      if (belief.l0Facts.checks[target.id] !== undefined) return;
      
      const wolfProb = belief.getWerewolfProbability(target.id);
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'check', target.id);
      
      result.push({
        action: 'check',
        target: target.id,
        score: wolfProb * SCORE_MAX_INFO_VOTE + SCORE_PROPHET_CHECK_BASE + scoreDelta,
        confidence: 0.7,
        reason: `优先查验${target.name}，L1推理狼嫌疑${(wolfProb * SCORE_MAX_INFO_VOTE).toFixed(0)}%${reason}`,
        strategy: 'CrystalBallPlugin',
        rule: 'check_high_suspect',
        trigger: `wolfProb=${wolfProb.toFixed(2)}，未查验过`,
      });
    });
    
    // If no high-suspect targets, pick random unchecked player
    if (result.length === 0) {
      const unchecked = alivePlayers.filter((p) => belief.l0Facts.checks[p.id] === undefined);
      if (unchecked.length > 0) {
        const random = unchecked[Math.floor(Math.random() * unchecked.length)];
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'check', random.id);
        
        result.push({
          action: 'check',
          target: random.id,
          score: SCORE_PROPHET_CHECK_BASE - 20 + scoreDelta,
          confidence: 0.5,
          reason: `无明确嫌疑，随机查验${random.name}${reason}`,
          strategy: 'CrystalBallPlugin',
          rule: 'check_random',
          trigger: '无明确嫌疑目标，从未查验中随机选择',
          random: true,
        });
      }
    }
    
    return result.sort((a, b) => b.score - a.score);
  }
}
