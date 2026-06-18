/**
 * Base Plugin Helper
 * 
 * Provides common functionality for all plugins
 */

import type { Player } from '@/types';
import type { GameContext } from '../types';
import { hasItem } from '@/types';

/**
 * Check if player has a specific item with durability > 0
 */
export function playerHasItem(player: Player, itemId: string): boolean {
  return hasItem(player, itemId);
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
