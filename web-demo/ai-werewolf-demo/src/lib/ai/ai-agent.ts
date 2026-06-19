import { BeliefSystem } from './belief-system';
import { DecisionEngine, buildStrategies } from './strategies';
import { IntentionManager } from './intention-system';
import type { Player, DecisionResult, LogEntry, Phase, Attributes } from '@/types';
import type { PluginRegistry } from '../plugins';
import { ACTION } from '@/lib/constants/action-constants';

export interface AgentEvent {
  type: 'death' | 'check_result' | 'public_claim' | 'relation_update' | 'observation' | 'inspection';
  playerId?: string;
  targetId?: string;
  result?: 'werewolf' | 'villager';
  claimType?: string;
  content?: Record<string, unknown>;
  friendlyDelta?: number;
  trustDelta?: number;
  stress?: number;
  attributes?: Attributes;
  items?: string[];
}

export class AIAgent {
  id: string;
  player: Player | null;
  belief: BeliefSystem;
  engine: DecisionEngine;
  intentionManager: IntentionManager;
  logs: LogEntry[];
  currentRound: number = 0;
  pluginRegistry?: PluginRegistry;

  private _allPlayers: Player[];

  constructor(player: Player, allPlayers: Player[], pluginRegistry?: PluginRegistry) {
    this.id = player.id;
    this.player = player;
    this.belief = new BeliefSystem(player.id, player.name, player.role, player.team, player.attributes, player.alignment);
    this.engine = new DecisionEngine();
    this.intentionManager = new IntentionManager();
    this._registerDefaultStrategies();
    this.logs = [];
    this._allPlayers = allPlayers;
    this.pluginRegistry = pluginRegistry;
  }

  private _registerDefaultStrategies() {
    const strategies = buildStrategies();
    strategies.forEach((s) => this.engine.registerStrategy(s.category, s.strategy));
  }

  setPlayers(allPlayers: Player[]) {
    this._allPlayers = allPlayers;
  }

  nightAction(allPlayers: Player[], nightDecisions: { playerId: string; action: string; targetId: string | null; reason: string }[]): DecisionResult | null {
    if (!this.player?.alive) return null;
    const availableActions = this._getAvailableNightActions();
    this.belief.updateInferences(allPlayers, this.player, []);
    
    // === 意图系统更新 ===
    this.intentionManager.update(this.player, this.belief, allPlayers, this.currentRound);
    
    // Get plugin strategies if available
    const pluginStrategies = this.pluginRegistry?.evaluateAll({
      belief: this.belief,
      self: this.player,
      allPlayers,
      nightDecisions,
      round: this.currentRound,
      phase: 'night',
      players: allPlayers,
    }) || [];
    
    const decision = this.engine.decide(
      this.belief, 
      this.player, 
      'night', 
      availableActions, 
      allPlayers, 
      nightDecisions, 
      [],
      0,
      0,
      1,
      undefined,
      pluginStrategies,
      this.intentionManager
    );
    this._log('night', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    this._advanceIntentionIfMatch(decision, 'night');
    return decision;
  }

  dayAction(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[], consecutiveSilence: number, aliveCount: number): DecisionResult | null {
    if (!this.player?.alive) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || [], this.player);
    const availableActions = this._getAvailableDayActions();
    this.belief.updateInferences(allPlayers, this.player, publicActions);
    
    // === 意图系统更新 ===
    this.intentionManager.update(this.player, this.belief, allPlayers, this.currentRound, publicActions || []);
    
    const decision = this.engine.decide(this.belief, this.player, 'day', availableActions, allPlayers, [], publicActions, consecutiveSilence, aliveCount, 1, undefined, undefined, this.intentionManager);
    this._log('day', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    this._advanceIntentionIfMatch(decision, 'day');
    return decision;
  }

  appendixAction(allPlayers: Player[], triggerAction: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }, publicActions: { actorId: string; type: string; targetId?: string }[]): DecisionResult | null {
    if (!this.player?.alive) return null;
    const availableActions = this._getAvailableAppendixActions(triggerAction);
    if (availableActions.length === 0) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || [], this.player);
    
    const decision = this.engine.decide(this.belief, this.player, 'appendix', availableActions, allPlayers, [], publicActions, 0, 0, 1, undefined, undefined, this.intentionManager);
    this._log('day', `追加行动：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    this._advanceIntentionIfMatch(decision, 'appendix');
    return decision;
  }

  vote(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string }[], voteRound: number = 1): DecisionResult | null {
    if (!this.player?.alive) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || [], this.player);
    const availableActions = [{ type: ACTION.VOTE }];
    this.belief.updateInferences(allPlayers, this.player, publicActions);
    
    const decision = this.engine.decide(this.belief, this.player, 'vote', availableActions, allPlayers, [], publicActions, 0, 0, voteRound, undefined, undefined, this.intentionManager);
    this._log('vote', `投票：${decision.target || '无目标'}，原因：${decision.reason}`);
    this._advanceIntentionIfMatch(decision, 'vote');
    return decision;
  }

  voteRound2(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string }[], candidates: string[]): DecisionResult | null {
    if (!this.player?.alive) return null;
    const availableActions = [{ type: ACTION.VOTE }];
    this.belief.updateInferences(allPlayers, this.player, publicActions);
    
    const decision = this.engine.decide(this.belief, this.player, 'vote', availableActions, allPlayers, [], publicActions, 0, 0, 2, candidates, undefined, this.intentionManager);
    this._log('vote', `第二轮投票：${decision.target || '无目标'}，原因：${decision.reason}`);
    this._advanceIntentionIfMatch(decision, 'vote');
    return decision;
  }

  onEvent(event: AgentEvent) {
    switch (event.type) {
      case 'check_result':
        if (event.targetId && event.result) {
          this.belief.recordCheck(event.targetId, event.result);
          this._log('event', `收到查验结果：${event.targetId} 是 ${event.result}`);
        }
        break;
      case 'death':
        if (event.playerId) {
          this.belief.recordDeath(event.playerId);
          if (event.playerId === this.id) {
            if (this.player) this.player.alive = false;
          }
          this._log('event', `玩家 ${event.playerId} 死亡`);
        }
        break;
      case 'public_claim':
        if (event.playerId && event.claimType) {
          this.belief.recordPublicClaim(event.playerId, event.claimType, event.content || {});
          this._log('event', `玩家 ${event.playerId} 声称：${event.claimType}`);
        }
        break;
      case 'relation_update':
        if (event.targetId && event.friendlyDelta !== undefined && event.trustDelta !== undefined) {
          this.belief.updateRelation(event.targetId, event.friendlyDelta, event.trustDelta);
        }
        break;
      case 'observation':
        if (event.targetId && event.stress !== undefined && event.attributes) {
          this.belief.recordObservation(event.targetId, event.stress, event.attributes);
        }
        break;
      case 'inspection':
        if (event.targetId && event.items) {
          this.belief.recordInspection(event.targetId, event.items);
        }
        break;
    }
  }

  recordCheckResult(targetId: string, result: 'werewolf' | 'villager') {
    this.belief.recordCheck(targetId, result);
  }

  recordInspection(targetId: string, items: string[]) {
    this.belief.recordInspection(targetId, items);
  }

  recordObservation(targetId: string, stress: number, attributes: Attributes) {
    this.belief.recordObservation(targetId, stress, attributes);
  }

  getCheckResults(): Record<string, 'werewolf' | 'villager'> {
    return this.belief.l0Facts.checks;
  }

  getDecisionExplanation() {
    return {
      player: this.player?.name,
      role: this.player?.role,
      alive: this.player?.alive,
      l0: this.belief.l0Facts,
      l1: this.belief.l1Inferences,
      l2: this.belief.l2TheoryOfMind,
      l3: this.belief.l3Social,
      intentions: this.intentionManager.getSummary(),
      logs: this.logs,
    };
  }

  private _advanceIntentionIfMatch(decision: DecisionResult, phase: string) {
    // 找到当前最高意图
    const topIntention = this.intentionManager.getTopIntention(phase);
    if (!topIntention) return;

    // 检查决策是否与意图的计划步骤匹配
    const currentStep = topIntention.plan[topIntention.currentStepIndex];
    if (!currentStep) return;

    if (currentStep.phase === phase && (currentStep.action === decision.action || (currentStep.action === ACTION.SPEAK && decision.action === ACTION.SPEAK))) {
      this.intentionManager.advanceStep(topIntention.id, phase, decision.action);
    }
  }

  private _getAvailableNightActions(): { type: string }[] {
    if (!this.player) return [];
    
    // Use plugin registry to get available actions based on items
    if (this.pluginRegistry) {
      const pluginActions = this.pluginRegistry.getAvailableActions(this.player, {
        round: this.currentRound,
        phase: 'night',
        players: this._allPlayers,
      });
      return pluginActions.map(a => ({ type: a.type }));
    }
    
    return [];
  }

  private _getAvailableDayActions(): { type: string }[] {
    if (!this.player) return [];
    const actions: { type: string }[] = [];

    // Use plugin registry for role-specific actions
    if (this.pluginRegistry) {
      const pluginActions = this.pluginRegistry.getAvailableActions(this.player, {
        round: this.currentRound,
        phase: 'day',
        players: this._allPlayers,
      });
      actions.push(...pluginActions.map(a => ({ type: a.type })));
    }

    // Common day actions (always available)
    actions.push({ type: ACTION.SILENCE });
    actions.push({ type: ACTION.CLAIM_IDENTITY });
    actions.push({ type: ACTION.REVEAL_INFO });
    actions.push({ type: ACTION.OBSERVE });
    actions.push({ type: ACTION.SUSPECT });
    actions.push({ type: ACTION.DEFEND });
    actions.push({ type: ACTION.CALL_VOTE });
    actions.push({ type: ACTION.BLOCK_VOTE });
    actions.push({ type: ACTION.GUARANTEE });
    actions.push({ type: ACTION.ACCUSE });
    actions.push({ type: ACTION.EXCLUDE_ALL });

    return actions;
  }

  private _getAvailableAppendixActions(triggerAction: { actorId: string; type: string; targetId?: string }): { type: string }[] {
    if (!this.player) return [];
    const actions: { type: string; originalTargetId?: string; originalActorId?: string }[] = [];

    if (triggerAction.type === ACTION.SUSPECT || triggerAction.type === ACTION.JOIN_SUSPECT) {
      // Can join suspect if not the original target and not the trigger actor
      if (triggerAction.targetId !== this.player.id && triggerAction.actorId !== this.player.id) {
        actions.push({ type: ACTION.JOIN_SUSPECT, originalTargetId: triggerAction.targetId });
      }
      // Can rebut if we are the target
      if (triggerAction.targetId === this.player.id && triggerAction.actorId !== this.player.id) {
        actions.push({ type: ACTION.REBUT, originalActorId: triggerAction.actorId });
      }
    }

    if (triggerAction.type === ACTION.DEFEND || triggerAction.type === ACTION.JOIN_DEFEND) {
      // Can join defend if not the original target and not the trigger actor
      if (triggerAction.targetId !== this.player.id && triggerAction.actorId !== this.player.id) {
        actions.push({ type: ACTION.JOIN_DEFEND, originalTargetId: triggerAction.targetId });
      }
    }

    return actions;
  }

  private _log(phase: Phase, message: string) {
    this.logs.push({ round: this.currentRound, phase, message, timestamp: Date.now() });
  }
}
