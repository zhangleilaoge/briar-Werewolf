/**
 * Amulet Plugin (护身符)
 * 
 * Passive item that blocks one night kill
 * No active actions, but provides passive protection
 */

import type {
  ActionProvider,
  ActionDefinition,
  ActionContext,
  ActionExecutionParams,
  ActionResult,
  StateChange,
  PluginEvent,
} from '../types';
import type { Player } from '@/types';
import { hasItem } from '@/types';
import { createGameLog } from '../base';

export class AmuletPlugin implements ActionProvider {
  id = 'amulet';
  type = 'item' as const;
  
  getAvailableActions(_player: Player, _context: ActionContext): ActionDefinition[] {
    // Amulet is passive, no active actions
    return [];
  }
  
  execute(_params: ActionExecutionParams): ActionResult {
    // Amulet is passive, should not be executed directly
    return {
      success: false,
      logs: [],
      stateChanges: [],
      events: [],
    };
  }
  
  /**
   * Check if player has amulet protection
   * Called by the game system when player is attacked
   */
  hasProtection(player: Player): boolean {
    return hasItem(player, 'amulet');
  }
  
  /**
   * Consume amulet to block an attack
   * @returns ActionResult with logs and state changes
   */
  blockAttack(player: Player, context: ActionContext): ActionResult {
    const logs: any[] = [];
    const stateChanges: StateChange[] = [];
    const events: PluginEvent[] = [];
    
    if (!hasItem(player, 'amulet')) {
      return { success: false, logs, stateChanges, events };
    }
    
    // Damage the amulet
    stateChanges.push({
      type: 'item_damage',
      targetId: player.id,
      payload: { itemId: 'amulet' },
    });
    
    logs.push(createGameLog(
      context,
      'item',
      `${player.name} 的护身符抵挡了致命一击！护身符损坏。`
    ));
    
    return { success: true, logs, stateChanges, events };
  }
  
  // No AI evaluation for passive items
  evaluate?: undefined;
}
