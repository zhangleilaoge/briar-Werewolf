/**
 * Base Plugin Helper
 * 
 * Provides common functionality for all plugins
 */

import type { Player, DecisionCandidate } from '@/types';
import type { GameContext } from '@/lib/plugins/types';
import type {
  ActionProvider,
  ActionDefinition,
  ActionContext,
  ActionExecutionParams,
  ActionResult,
  DecisionContext,
} from './types';
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

/**
 * Single-Use Item Plugin Base Class
 *
 * Provides common "use once per game" pattern for item plugins.
 * Subclasses must implement the abstract methods from ActionProvider
 * and define their own itemId and actionType.
 */
export abstract class SingleUseItemPlugin implements ActionProvider {
  protected usedBy = new Map<string, boolean>();
  protected abstract itemId: string;
  protected abstract actionType: string;

  abstract id: string;
  abstract type: 'item' | 'trait';

  abstract getAvailableActions(player: Player, context: ActionContext): ActionDefinition[];
  abstract execute(params: ActionExecutionParams): ActionResult;
  abstract evaluate?(context: DecisionContext): DecisionCandidate[];

  protected checkUsed(actor: Player): boolean {
    return this.usedBy.get(actor.id) === true;
  }

  protected markUsed(actor: Player): void {
    this.usedBy.set(actor.id, true);
  }

  reset(): void {
    this.usedBy.clear();
  }
}
