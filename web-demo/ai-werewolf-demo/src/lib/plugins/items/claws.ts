/**
 * Claws Plugin (尖牙利爪)
 * 
 * Provides the kill action for werewolves at night
 * and retaliation mechanic for villagers when attacked
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
import { createGameLog, getPlayerName } from '../base';
import { calculateBehaviorScoreDelta } from '@/lib/ai/behavior-modifiers';
import { ACTION } from '@/lib/constants/action-constants';
import {
  SCORE_WEREWOLF_KILL_BASE,
  SCORE_WEREWOLF_KILL_GOD_BONUS,
  SCORE_WEREWOLF_KILL_HIGH_INSIGHT,
  SCORE_EMPTY_KILL,
  WEREWOLF_PROBABILITY_LOW,
  EMPTY_KILL_CHANCE,
} from '@/types';

export class ClawsPlugin implements ActionProvider {
  id = 'claws';
  type = 'item' as const;
  
  getAvailableActions(player: Player, context: ActionContext): ActionDefinition[] {
    // Only werewolves with claws can kill
    if (player.team !== 'werewolf' || !hasItem(player, 'claws')) {
      return [];
    }
    
    return [{
      type: ACTION.KILL,
      label: '杀戮',
      description: '使用尖牙利爪袭击一名玩家',
      requiresTarget: true,
      targetFilter: (player, target) => target.alive && target.id !== player.id && target.team !== player.team,
    }];
  }
  
  execute(params: ActionExecutionParams): ActionResult {
    const { actor, target, context } = params;
    const logs: any[] = [];
    const stateChanges: StateChange[] = [];
    const events: PluginEvent[] = [];
    
    // Kill action is recorded but resolved later in resolveNightActions
    const targetName = target ? getPlayerName(context.players, target.id) : '空刀';
    
    logs.push(createGameLog(
      context,
      'action',
      `${actor.name} 选择袭击 ${targetName}`,
      { actorId: actor.id, action: ACTION.KILL, targetId: target?.id }
    ));
    
    return { success: true, logs, stateChanges, events };
  }
  
  evaluate(context: DecisionContext): import('@/types').DecisionCandidate[] {
    const { belief, self, allPlayers, nightDecisions } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    
    // Only werewolves with claws can kill
    if (self.team !== 'werewolf' || !hasItem(self, 'claws')) {
      return result;
    }
    
    const aliveTargets = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== self.team);
    
    // Check if other werewolves have already chosen a target
    const otherWolfDecisions = (nightDecisions || []).filter(
      (d) => d.action === ACTION.KILL && d.playerId !== self.id && allPlayers.find((p) => p.id === d.playerId)?.team === 'werewolf'
    );
    
    if (otherWolfDecisions.length > 0) {
      const teammateTarget = otherWolfDecisions[0].targetId;
      if (teammateTarget) {
        const teammate = allPlayers.find((p) => p.id === otherWolfDecisions[0].playerId);
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.KILL, teammateTarget);
        result.push({
          action: ACTION.KILL,
          target: teammateTarget,
          score: 80 + scoreDelta,
          confidence: 0.8,
          reason: `跟随队友${teammate?.name || ''}的目标，统一行动${reason}`,
          strategy: 'ClawsPlugin',
          rule: 'follow_teammate',
          trigger: `队友 ${teammate?.name || ''} 已选择 target=${teammateTarget}`,
        });
      }
    }
    
    aliveTargets.forEach((target) => {
      const claims = belief.l0Facts.publicClaims.filter((c: any) => c.playerId === target.id);
      const isLikelyGod = claims.length > 0 || (belief.l2TheoryOfMind.othersKnowMyRole[target.id] ?? 0) > 0.5;
      const isHighInsight = target.attributes.insight >= 6;
      
      let score = SCORE_WEREWOLF_KILL_BASE;
      if (isLikelyGod) score += SCORE_WEREWOLF_KILL_GOD_BONUS;
      if (isHighInsight) score += SCORE_WEREWOLF_KILL_HIGH_INSIGHT;
      if (belief.getWerewolfProbability(target.id) < WEREWOLF_PROBABILITY_LOW) score += SCORE_WEREWOLF_KILL_GOD_BONUS / 3;
      
      const relation = self.relations[target.id];
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.KILL, target.id, relation);

      result.push({
        action: ACTION.KILL,
        target: target.id,
        score: score + scoreDelta,
        confidence: isLikelyGod ? 0.7 : 0.5,
        reason: isLikelyGod
          ? `L2推断：${target.name}疑似神职，优先击杀${reason}`
          : isHighInsight
            ? `击杀${target.name}（高洞察${target.attributes.insight}，可能察觉到异常）${reason}`
            : `击杀${target.name}${reason}`,
        strategy: 'ClawsPlugin',
        rule: isLikelyGod ? 'kill_god_target' : isHighInsight ? 'kill_high_insight' : 'kill_normal',
        trigger: isLikelyGod
          ? `claims.length=${claims.length} > 0 或 othersKnowMyRole > 0.5`
          : isHighInsight
            ? `insight=${target.attributes.insight} >= 6`
            : `常规目标选择`,
      });
    });
    
    // Empty-kill option
    if (aliveTargets.length > 0 && Math.random() < EMPTY_KILL_CHANCE) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, ACTION.KILL, null);
      result.push({
        action: ACTION.KILL,
        target: null,
        score: SCORE_EMPTY_KILL + scoreDelta,
        confidence: 0.3,
        reason: `空刀：保存实力或制造平安夜${reason}`,
        strategy: 'ClawsPlugin',
        rule: 'empty_kill',
        trigger: `Math.random() < EMPTY_KILL_CHANCE=${EMPTY_KILL_CHANCE}，随机空刀`,
        random: true,
      });
    }
    
    return result.sort((a, b) => b.score - a.score);
  }
}
