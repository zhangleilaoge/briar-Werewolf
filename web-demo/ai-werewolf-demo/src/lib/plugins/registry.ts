/**
 * Plugin Registry
 * 
 * Central registry for all action providers and trait providers.
 * Manages plugin registration, action lookup, and strategy aggregation.
 */

import type {
  ActionProvider,
  TraitProvider,
  ActionDefinition,
  ActionContext,
  ActionExecutionParams,
  ActionResult,
  DecisionContext,
  FullActionProvider,
  FullTraitProvider,
  PluginEvent,
  StateChange,
  GameContext,
} from './types';
import type { Player, GameLogItem } from '@/types';
import type { DecisionCandidate } from '@/types';

export class PluginRegistry {
  private providers: Map<string, ActionProvider> = new Map();
  private traitProviders: Map<string, TraitProvider> = new Map();
  
  /**
   * Register an action provider (items)
   * @throws Error if provider with same id already exists
   */
  register(provider: ActionProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[PluginRegistry] Provider ${provider.id} already registered, overwriting`);
    }
    this.providers.set(provider.id, provider);
    
    // Call lifecycle hook if available
    const fullProvider = provider as FullActionProvider;
    fullProvider.onRegister?.();
  }
  
  /**
   * Register a trait provider
   */
  registerTrait(provider: TraitProvider): void {
    if (this.traitProviders.has(provider.id)) {
      console.warn(`[PluginRegistry] Trait ${provider.id} already registered, overwriting`);
    }
    this.traitProviders.set(provider.id, provider);
    
    // Call lifecycle hook if available
    const fullProvider = provider as FullTraitProvider;
    fullProvider.onRegister?.();
  }
  
  /**
   * Unregister an action provider
   */
  unregister(providerId: string): boolean {
    return this.providers.delete(providerId);
  }
  
  /**
   * Unregister a trait provider
   */
  unregisterTrait(providerId: string): boolean {
    return this.traitProviders.delete(providerId);
  }
  
  /**
   * Get a specific provider by id
   */
  getProvider(providerId: string): ActionProvider | undefined {
    return this.providers.get(providerId);
  }
  
  /**
   * Get a specific trait provider by id
   */
  getTraitProvider(providerId: string): TraitProvider | undefined {
    return this.traitProviders.get(providerId);
  }
  
  /**
   * Get all registered providers
   */
  getAllProviders(): ActionProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Get all registered trait providers
   */
  getAllTraitProviders(): TraitProvider[] {
    return Array.from(this.traitProviders.values());
  }
  
  /**
   * Get providers of a specific type
   */
  getProvidersByType(type: 'item' | 'trait'): ActionProvider[] {
    return Array.from(this.providers.values()).filter(p => p.type === type);
  }
  
  /**
   * Get all traits for a player
   */
  getPlayerTraits(player: Player): TraitProvider[] {
    const traits: TraitProvider[] = [];
    for (const traitProvider of this.traitProviders.values()) {
      if (traitProvider.hasTrait(player)) {
        traits.push(traitProvider);
      }
    }
    return traits;
  }
  
  /**
   * Check if a player has a specific trait
   */
  hasTrait(player: Player, traitId: string): boolean {
    const traitProvider = this.traitProviders.get(traitId);
    return traitProvider ? traitProvider.hasTrait(player) : false;
  }
  
  /**
   * Get all available actions for a player
   * Iterates through all registered providers and collects available actions
   */
  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    const actions: ActionDefinition[] = [];
    
    // Get actions from item providers
    for (const provider of this.providers.values()) {
      try {
        const providerActions = provider.getAvailableActions(player, context);
        actions.push(...providerActions);
      } catch (error) {
        console.error(`[PluginRegistry] Error getting actions from ${provider.id}:`, error);
      }
    }
    
    // Get actions from trait providers
    for (const traitProvider of this.traitProviders.values()) {
      if (traitProvider.hasTrait(player) && traitProvider.getTraitActions) {
        try {
          const traitActions = traitProvider.getTraitActions(player, context);
          actions.push(...traitActions);
        } catch (error) {
          console.error(`[PluginRegistry] Error getting trait actions from ${traitProvider.id}:`, error);
        }
      }
    }
    
    return actions;
  }
  
  /**
   * Execute an action using the appropriate provider
   * @param actionType The action type to execute
   * @param params Execution parameters
   * @returns ActionResult with logs, state changes, and events
   * @throws Error if no provider found for the action
   */
  executeAction(actionType: string, params: ActionExecutionParams): ActionResult {
    const provider = this.findProviderForAction(actionType, params.actor);
    
    if (!provider) {
      throw new Error(`[PluginRegistry] No provider found for action: ${actionType}`);
    }
    
    try {
      return provider.execute(params);
    } catch (error) {
      console.error(`[PluginRegistry] Error executing ${actionType}:`, error);
      return {
        success: false,
        logs: [],
        stateChanges: [],
        events: [],
      };
    }
  }
  
  /**
   * Evaluate all plugins for AI decision making
   * Collects candidates from all providers that have evaluate method
   */
  evaluateAll(context: DecisionContext): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];
    
    // Evaluate item providers
    for (const provider of this.providers.values()) {
      if (provider.evaluate) {
        try {
          const providerCandidates = provider.evaluate(context);
          candidates.push(...providerCandidates);
        } catch (error) {
          console.error(`[PluginRegistry] Error evaluating ${provider.id}:`, error);
        }
      }
    }
    
    // Evaluate trait providers
    for (const traitProvider of this.traitProviders.values()) {
      if (traitProvider.hasTrait(context.self) && traitProvider.evaluate) {
        try {
          const traitCandidates = traitProvider.evaluate(context);
          candidates.push(...traitCandidates);
        } catch (error) {
          console.error(`[PluginRegistry] Error evaluating trait ${traitProvider.id}:`, error);
        }
      }
    }
    
    return candidates;
  }
  
  /**
   * Modify night kill coordination based on traits
   * Used by lone wolf trait to handle independent wolf behavior
   */
  modifyNightKillCoordination(
    context: GameContext,
    werewolfDecisions: { playerId: string; targetId: string | null }[],
    loneWolfDecision: { playerId: string; targetId: string | null }
  ): { 
    valid: boolean; 
    reason?: string;
    finalTarget?: string | null;
    finalKiller?: string | null;
  } {
    // Find all trait providers that modify night kill coordination
    for (const traitProvider of this.traitProviders.values()) {
      if (traitProvider.modifyNightKillCoordination) {
        // Check if the lone wolf has this trait
        const loneWolf = context.players.find(p => p.id === loneWolfDecision.playerId);
        if (loneWolf && traitProvider.hasTrait(loneWolf)) {
          const result = traitProvider.modifyNightKillCoordination(
            context,
            werewolfDecisions,
            loneWolfDecision
          );
          
          if (!result.valid) {
            return result; // Trait invalidated the kill
          }
          
          // Trait may have modified the final target/killer
          if (result.finalTarget !== undefined) {
            return result;
          }
        }
      }
    }
    
    // No trait modified the coordination
    return { valid: true };
  }
  
  /**
   * Evaluate specific providers by type
   */
  evaluateByType(type: 'item' | 'trait', context: DecisionContext): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];
    
    for (const provider of this.providers.values()) {
      if (provider.type === type && provider.evaluate) {
        try {
          const providerCandidates = provider.evaluate(context);
          candidates.push(...providerCandidates);
        } catch (error) {
          console.error(`[PluginRegistry] Error evaluating ${provider.id}:`, error);
        }
      }
    }
    
    return candidates;
  }
  
  /**
   * Notify all plugins of round start
   */
  notifyRoundStart(round: number): void {
    for (const provider of this.providers.values()) {
      const fullProvider = provider as FullActionProvider;
      fullProvider.onRoundStart?.(round);
    }
    for (const traitProvider of this.traitProviders.values()) {
      const fullProvider = traitProvider as FullTraitProvider;
      fullProvider.onRoundStart?.(round);
    }
  }
  
  /**
   * Notify all plugins of round end
   */
  notifyRoundEnd(round: number): void {
    for (const provider of this.providers.values()) {
      const fullProvider = provider as FullActionProvider;
      fullProvider.onRoundEnd?.(round);
    }
    for (const traitProvider of this.traitProviders.values()) {
      const fullProvider = traitProvider as FullTraitProvider;
      fullProvider.onRoundEnd?.(round);
    }
  }
  
  /**
   * Notify all plugins of player death
   */
  notifyPlayerDeath(playerId: string): void {
    for (const provider of this.providers.values()) {
      const fullProvider = provider as FullActionProvider;
      fullProvider.onPlayerDeath?.(playerId);
    }
    for (const traitProvider of this.traitProviders.values()) {
      const fullProvider = traitProvider as FullTraitProvider;
      fullProvider.onPlayerDeath?.(playerId);
    }
  }
  
  /**
   * Find the provider that can handle a specific action type
   */
  private findProviderForAction(actionType: string, player: Player): ActionProvider | undefined {
    // Check item providers
    for (const provider of this.providers.values()) {
      const actions = provider.getAvailableActions(player, {
        round: 0,
        phase: 'night',
        players: [],
      });
      
      if (actions.some(a => a.type === actionType)) {
        return provider;
      }
    }
    
    // Check trait providers
    for (const traitProvider of this.traitProviders.values()) {
      if (traitProvider.hasTrait(player) && traitProvider.getTraitActions) {
        const actions = traitProvider.getTraitActions(player, {
          round: 0,
          phase: 'night',
          players: [],
        });
        
        if (actions.some(a => a.type === actionType)) {
          // Return a wrapper that delegates to the trait provider
          return {
            id: traitProvider.id,
            type: 'trait',
            getAvailableActions: (player, context) => traitProvider.getTraitActions!(player, context),
            execute: (params) => {
              // Trait providers don't have execute, this is a placeholder
              return { success: false, logs: [], stateChanges: [], events: [] };
            },
          };
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
    this.traitProviders.clear();
  }
  
  /**
   * Get the number of registered providers
   */
  get size(): number {
    return this.providers.size + this.traitProviders.size;
  }
}

// Singleton instance for global use
let globalRegistry: PluginRegistry | null = null;

/**
 * Get or create the global plugin registry
 */
export function getGlobalRegistry(): PluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new PluginRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetGlobalRegistry(): void {
  globalRegistry = null;
}
