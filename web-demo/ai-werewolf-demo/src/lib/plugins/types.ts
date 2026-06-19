/**
 * Plugin System Types
 * 
 * Defines interfaces for the extensible action system.
 * Each item or trait can be implemented as an independent plugin
 * that provides actions, effects, and AI strategies.
 */

import type { Player, GameLogItem, Phase } from '@/types';
import type { DecisionCandidate } from '@/types';

// ==================== Context Types ====================

/**
 * Game context provided to plugins
 */
export interface GameContext {
  round: number;
  phase: Phase;
  players: Player[];
  nightDecisions?: { playerId: string; action: string; targetId: string | null; reason: string }[];
}

/**
 * Action context for determining available actions
 */
export interface ActionContext extends GameContext {
  // Additional action-specific context
}

/**
 * Decision context for AI evaluation
 */
export interface DecisionContext extends GameContext {
  belief: any; // BeliefSystem - avoid circular import
  self: Player;
  allPlayers: Player[];
  nightDecisions?: { playerId: string; action: string; targetId: string | null; reason: string }[];
  publicActions?: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[];
  consecutiveSilence?: number;
  aliveCount?: number;
}

/**
 * Action execution parameters
 */
export interface ActionExecutionParams {
  actor: Player;
  target?: Player;
  action: string;
  context: GameContext;
}

// ==================== Action Definition ====================

/**
 * Defines an action that a plugin can provide
 */
export interface ActionDefinition {
  /** Action type identifier */
  type: string;
  
  /** Human-readable label */
  label: string;
  
  /** Description of the action */
  description: string;
  
  /** Whether this action requires a target player */
  requiresTarget: boolean;
  
  /** Filter function to determine valid targets */
  targetFilter?: (player: Player, target: Player) => boolean;
  
  /** Maximum uses per game (undefined = unlimited) */
  maxUsesPerGame?: number;
  
  /** Maximum uses per round (undefined = unlimited) */
  maxUsesPerRound?: number;
}

/**
 * Extended action definition for join actions (join_suspect, join_defend)
 */
export interface JoinAction extends ActionDefinition {
  originalTargetId: string;
}

/**
 * Extended action definition for rebut action
 */
export interface RebutAction extends ActionDefinition {
  originalActorId: string;
}

// ==================== Action Result ====================

/**
 * State change descriptor
 */
export interface StateChange {
  type: 'item_damage' | 'item_add' | 'item_remove' | 'stress_change' | 'relation_change' | 'custom';
  targetId: string;
  payload: Record<string, unknown>;
}

/**
 * Event to be emitted after action execution
 */
export interface PluginEvent {
  type: string;
  source: string;
  payload: Record<string, unknown>;
}

/**
 * Result of executing an action
 */
export interface ActionResult {
  /** Whether the action was successful */
  success: boolean;
  
  /** Logs to be added to game log */
  logs: GameLogItem[];
  
  /** State changes to be applied */
  stateChanges: StateChange[];
  
  /** Events to be emitted */
  events: PluginEvent[];
}

// ==================== Action Provider Interface ====================

/**
 * Core interface for plugins that provide actions
 * 
 * Each plugin (item, trait) implements this interface to:
 * - Declare what actions it provides
 * - Execute those actions
 * - Provide AI evaluation for decision making
 */
export interface ActionProvider {
  /** Unique identifier for this provider */
  id: string;
  
  /** Type of provider */
  type: 'item' | 'trait';
  
  /**
   * Get available actions for a player
   * Returns empty array if player cannot use this provider's actions
   */
  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[];
  
  /**
   * Execute an action
   * Called when a player performs an action provided by this plugin
   */
  execute(params: ActionExecutionParams): ActionResult;
  
  /**
   * Evaluate actions for AI decision making
   * Returns scored candidates for the decision engine
   * Optional - not all providers need AI evaluation
   */
  evaluate?(context: DecisionContext): DecisionCandidate[];
}

// ==================== Trait Provider Interface ====================

/**
 * Interface for trait plugins
 * 
 * Traits modify game behavior for players who have them.
 * Unlike items, traits cannot be transferred or lost.
 */
export interface TraitProvider {
  /** Unique identifier for this trait */
  id: string;
  
  /** Type is always 'trait' */
  type: 'trait';
  
  /**
   * Check if a player has this trait
   */
  hasTrait(player: Player): boolean;
  
  /**
   * Modify night kill coordination for werewolves
   * Used by lone wolf trait to make wolves act independently
   */
  modifyNightKillCoordination?(
    context: GameContext,
    werewolfDecisions: { playerId: string; targetId: string | null }[],
    loneWolfDecision: { playerId: string; targetId: string | null }
  ): { 
    valid: boolean; 
    reason?: string;
    finalTarget?: string | null;
    finalKiller?: string | null;
  };
  
  /**
   * Get special actions provided by this trait
   */
  getTraitActions?(player: Player, context: ActionContext): ActionDefinition[];
  
  /**
   * Evaluate trait-specific AI decisions
   */
  evaluate?(context: DecisionContext): DecisionCandidate[];
}

// ==================== Plugin Lifecycle ====================

/**
 * Optional lifecycle hooks for plugins
 */
export interface PluginLifecycle {
  /**
   * Called when the plugin is registered
   */
  onRegister?(): void;
  
  /**
   * Called at the start of each round
   */
  onRoundStart?(round: number): void;
  
  /**
   * Called at the end of each round
   */
  onRoundEnd?(round: number): void;
  
  /**
   * Called when a player dies
   */
  onPlayerDeath?(playerId: string): void;
}

/**
 * Extended action provider with lifecycle hooks
 */
export interface FullActionProvider extends ActionProvider, PluginLifecycle {}

/**
 * Extended trait provider with lifecycle hooks
 */
export interface FullTraitProvider extends TraitProvider, PluginLifecycle {}
