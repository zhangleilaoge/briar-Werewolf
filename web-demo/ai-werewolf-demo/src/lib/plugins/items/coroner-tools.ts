/**
 * Coroner Tools Plugin (验尸工具)
 * 
 * Provides the inspect action for coroners at night
 * Allows coroners to examine dead players' items
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
import { hasItem, damageItem, ITEM_DEFINITIONS } from '@/types';
import { createGameLog, getPlayerName } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import {
  SCORE_CORONER_INSPECT_BASE,
} from '@/types';

export class CoronerToolsPlugin implements ActionProvider {
  id = 'coroner_tools';
  type = 'item' as const;
  
  // Track usage per player
  private usedBy: Map<string, boolean> = new Map();
  
  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    // Anyone with tools can inspect, but only once per game
    if (!hasItem(player, 'coroner_tools')) {
      return [];
    }
    
    // Check if already used
    if (this.usedBy.get(player.id)) {
      return [];
    }
    
    return [{
      type: 'inspect',
      label: '验尸',
      description: '使用验尸工具查看死亡角色的道具',
      requiresTarget: true,
      targetFilter: (player, target) => !target.alive && target.items.length > 0,
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
      logs.push(createGameLog(context, 'action', `${actor.name} 已使用过验尸能力`));
      return { success: false, logs, stateChanges, events };
    }
    
    if (!target || target.alive) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试验尸但目标无效`));
      return { success: false, logs, stateChanges, events };
    }
    
    if (!hasItem(actor, 'coroner_tools')) {
      logs.push(createGameLog(context, 'action', `${actor.name} 尝试验尸但缺少验尸工具`));
      return { success: false, logs, stateChanges, events };
    }
    
    // Mark as used
    this.usedBy.set(actor.id, true);
    
    // Get item names
    const items = target.items
      .map((i) => ITEM_DEFINITIONS[i.definitionId]?.name || i.definitionId)
      .join(', ') || '无';
    
    // Damage coroner tools
    stateChanges.push({
      type: 'item_damage',
      targetId: actor.id,
      payload: { itemId: 'coroner_tools' },
    });
    
    logs.push(createGameLog(
      context,
      'item',
      `${actor.name} 验尸 ${target.name}，发现道具：${items}。验尸工具损坏。`
    ));
    
    // Emit inspection event for AI to record
    events.push({
      type: 'inspection',
      source: actor.id,
      payload: {
        targetId: target.id,
        items: target.items.map((i) => i.definitionId),
      },
    });
    
    return { success: true, logs, stateChanges, events };
  }
  
  evaluate(context: DecisionContext): import('@/types').DecisionCandidate[] {
    const { allPlayers, self } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    
    // Anyone with tools can inspect
    if (!hasItem(self, 'coroner_tools')) {
      return result;
    }
    
    // Check if already used
    if (this.usedBy.get(self.id)) {
      return result;
    }
    
    const deadTargets = allPlayers.filter((p) => !p.alive && p.items.length > 0);
    
    deadTargets.forEach((target) => {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'inspect', target.id);
      
      result.push({
        action: 'inspect',
        target: target.id,
        score: SCORE_CORONER_INSPECT_BASE + target.items.length * (SCORE_CORONER_INSPECT_BASE / 5) + scoreDelta,
        confidence: 0.6,
        reason: `验尸${target.name}，查看其${target.items.length}件道具${reason}`,
        strategy: 'CoronerToolsPlugin',
        rule: 'inspect_body',
        trigger: `目标已死亡且 items.length=${target.items.length} > 0`,
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
