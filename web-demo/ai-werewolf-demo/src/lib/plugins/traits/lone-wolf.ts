/**
 * Lone Wolf Trait Plugin (孤狼特质)
 * 
 * Special trait for lone wolves that makes them act independently
 * from other werewolves during night kills.
 * 
 * Rules:
 * - Lone wolf chooses their own target independently
 * - If lone wolf target matches regular wolf target, kill is invalid
 * - If only lone wolf remains, they become the primary killer
 */

import type {
  TraitProvider,
  GameContext,
  ActionContext,
  ActionDefinition,
  DecisionContext,
} from '@/lib/plugins/types';
import type { Player } from '@/types';

export class LoneWolfTraitPlugin implements TraitProvider {
  id = 'lone_wolf_trait';
  type = 'trait' as const;
  
  hasTrait(player: Player): boolean {
    return player.role === 'lone_wolf' && player.team === 'werewolf';
  }
  
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
    // Find the lone wolf player
    const loneWolf = context.players.find(p => p.id === loneWolfDecision.playerId);
    if (!loneWolf || !this.hasTrait(loneWolf)) {
      return { valid: true };
    }
    
    // Check if there are other werewolves
    const aliveWerewolves = context.players.filter(p => p.team === 'werewolf' && p.alive);
    const isLoneWolfOnly = aliveWerewolves.length === 1 && aliveWerewolves[0].role === 'lone_wolf';
    
    // If only lone wolf remains, they become the primary killer
    if (isLoneWolfOnly) {
      return {
        valid: true,
        finalTarget: loneWolfDecision.targetId,
        finalKiller: loneWolfDecision.playerId,
      };
    }
    
    // Check if lone wolf target matches regular wolf target
    const regularWolfDecisions = werewolfDecisions.filter(d => d.playerId !== loneWolfDecision.playerId);
    
    if (regularWolfDecisions.length > 0 && loneWolfDecision.targetId) {
      const regularWolfTarget = regularWolfDecisions[0].targetId;
      
      if (loneWolfDecision.targetId === regularWolfTarget) {
        // Targets match - kill is invalid!
        const target = context.players.find(p => p.id === regularWolfTarget);
        return {
          valid: false,
          reason: `孤狼与普通狼人目标相同（${target?.name || regularWolfTarget}），本次杀戮无效！`,
        };
      }
    }
    
    // Lone wolf acts independently - their decision is separate
    // Return the regular wolf decision as the final one
    if (regularWolfDecisions.length > 0) {
      return {
        valid: true,
        finalTarget: regularWolfDecisions[0].targetId,
        finalKiller: regularWolfDecisions[0].playerId,
      };
    }
    
    // No regular wolves decided, use lone wolf's decision
    return {
      valid: true,
      finalTarget: loneWolfDecision.targetId,
      finalKiller: loneWolfDecision.playerId,
    };
  }
  
  getTraitActions(player: Player, context: ActionContext): ActionDefinition[] {
    // Lone wolf has no special actions, just modifies kill coordination
    return [];
  }
  
  evaluate(context: DecisionContext): import('@/types').DecisionCandidate[] {
    // Lone wolf doesn't need special AI evaluation
    // The regular werewolf kill strategy handles target selection
    return [];
  }
}
