/**
 * Thief Gloves Plugin (小偷手套)
 * 
 * Provides the steal action for thieves at night
 * Allows thieves to steal items from other players
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
import { hasItem, addItem, ITEM_DEFINITIONS } from '@/types';
import { createGameLog } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import {
  SCORE_THIEF_STEAL_BASE,
} from '@/types';

export class ThiefGlovesPlugin implements ActionProvider {
  id = 'thief_gloves';
  type = 'item' as const;
  
  // Track usage per player
  private usedBy: Map<string, boolean> = new Map();
  
  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    // Anyone with gloves can steal, but only once per game
    if (!hasItem(player, 'thief_gloves')) {
      return [];
    }
    
    // Check if already used
    if (this.usedBy.get(player.id)) {
      return [];
    }
    
    return [{
      type: 'steal',
      label: '偷窃',
      description: '使用小偷手套偷取一名玩家的道具',
      requiresTarget: true,
      targetFilter: (player, target) => target.alive && target.id !== player.id && target.items.length > 0,
      maxUsesPerGame: 1,
    }];
  }
  
  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    const logs: any[] = [];
    const stateChanges: StateChange[] = [];
    const events: PluginEvent[] = [];
    
    // Check if already used
    if (this.usedBy.get(actor.id)) {
      logs.push(createGameLog(context, 'action', `${actor.name} 已使用过偷窃能力`));
      return { success: false, logs, stateChanges, events };
    }
    
    if (!target || !target.alive) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试偷窃但目标无效`));
      return { success: false, logs, stateChanges, events };
    }
    
    if (!hasItem(actor, 'thief_gloves')) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试偷窃但缺少小偷手套`));
      return { success: false, logs, stateChanges, events };
    }
    
    // Mark as used
    this.usedBy.set(actor.id, true);
    
    if (target.items.length > 0) {
      // Randomly select an item to steal
      const stolenIdx = Math.floor(Math.random() * target.items.length);
      const stolen = target.items[stolenIdx];
      const stolenDef = ITEM_DEFINITIONS[stolen.definitionId];
      
      // Try to add to thief's inventory
      if (addItem(actor, stolen.definitionId)) {
        // Remove from target
        stateChanges.push({
          type: 'item_remove',
          targetId: target.id,
          payload: { itemId: stolen.definitionId, index: stolenIdx },
        });
        
        // Damage thief gloves
        stateChanges.push({
          type: 'item_damage',
          targetId: actor.id,
          payload: { itemId: 'thief_gloves' },
        });
        
        logs.push(createGameLog(
          context,
          'item',
          `${actor.name} 偷取了 ${target.name} 的 ${stolenDef?.name || stolen.definitionId}！小偷手套损坏。`
        ));
      } else {
        // Inventory full, steal fails
        logs.push(createGameLog(
          context,
          'item',
          `${actor.name} 尝试偷取但道具栏已满`
        ));
      }
    } else {
      // Target has no items, ability wasted
      logs.push(createGameLog(
        context,
        'item',
        `${actor.name} 尝试偷窃 ${target.name}，但目标没有道具，能力浪费。`
      ));
    }
    
    return { success: true, logs, stateChanges, events };
  }
  
  evaluate(context: DecisionContext): import('@/types').DecisionCandidate[] {
    const { self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    
    // Anyone with gloves can steal
    if (!hasItem(self, 'thief_gloves')) {
      return result;
    }
    
    // Check if already used
    if (this.usedBy.get(self.id)) {
      return result;
    }
    
    const aliveTargets = allPlayers.filter((p) => p.id !== self.id && p.alive && p.items.length > 0);
    
    aliveTargets.forEach((target) => {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'steal', target.id);
      
      result.push({
        action: 'steal',
        target: target.id,
        score: SCORE_THIEF_STEAL_BASE + target.items.length * (SCORE_THIEF_STEAL_BASE / 4) + scoreDelta,
        confidence: 0.5,
        reason: `偷取${target.name}的道具，目标持有${target.items.length}件物品${reason}`,
        strategy: 'ThiefGlovesPlugin',
        rule: 'steal_item',
        trigger: `目标持有 items.length=${target.items.length} > 0`,
      });
    });
    
    return result.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Reset usage tracking (for new game)
   */
  reset(): void {
    this.usedBy.clear();
  }
}
