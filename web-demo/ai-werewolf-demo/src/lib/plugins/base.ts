/**
 * Base Plugin Helper
 * 
 * Provides common functionality for all plugins
 */

import type { Player } from '@/types';
import type { ActionContext, DecisionContext, GameContext } from '../types';
import { hasItem, canUseItem, ITEM_DEFINITIONS } from '@/types';

/**
 * Check if player has a specific item with durability > 0
 */
export function playerHasItem(player: Player, itemId: string): boolean {
  return hasItem(player, itemId);
}

/**
 * Check if player can use a specific item
 */
export function playerCanUseItem(player: Player, itemId: string): boolean {
  return canUseItem(player, itemId);
}

/**
 * Get item definition
 */
export function getItemDefinition(itemId: string) {
  return ITEM_DEFINITIONS[itemId];
}

/**
 * Create a standard game log item
 */
export function createGameLog(
  context: GameContext,
  type: 'phase' | 'action' | 'death' | 'victory' | 'info' | 'check' | 'relation' | 'stress' | 'item' | 'thinking',
  message: string,
  details?: Record<string, unknown>
) {
  return {
    round: context.round,
    phase: context.phase,
    message,
    type,
    details,
  };
}

/**
 * Get player name safely
 */
export function getPlayerName(players: Player[], playerId: string): string {
  return players.find(p => p.id === playerId)?.name || playerId;
}

/**
 * Calculate behavior score delta (imported from AI module)
 * This is a bridge function to avoid circular dependencies
 */
export { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
