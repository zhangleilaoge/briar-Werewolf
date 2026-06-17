import { BeliefSystem } from './belief-system';
import { DecisionEngine, buildStrategies } from './strategies';
import type { Player, DecisionResult, LogEntry, Role, Team, Phase, NightActionType, DayActionType, AppendixActionType, ItemInstance, ActionType } from './types';

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
  attributes?: Record<string, number>;
  items?: string[];
}

export class AIAgent {
  id: string;
  player: Player | null;
  belief: BeliefSystem;
  engine: DecisionEngine;
  logs: LogEntry[];
  currentRound: number = 0;
  private _allPlayers: Player[] = [];

  constructor(player: Player, allPlayers: Player[]) {
    this.id = player.id;
    this.player = player;
    this.belief = new BeliefSystem(player.id, player.name, player.role, player.team, player.attributes, player.alignment);
    this.engine = new DecisionEngine();
    this._registerDefaultStrategies();
    this.logs = [];
    this._allPlayers = allPlayers;
  }

  private _registerDefaultStrategies() {
    const strategies = buildStrategies();
    strategies.forEach((s) => this.engine.registerStrategy(s.category, s.strategy));
  }

  setPlayers(allPlayers: Player[]) {
    this._allPlayers = allPlayers;
  }

  nightAction(allPlayers: Player[], nightDecisions: { playerId: string; action: string; targetId: string | null; reason: string }[]): DecisionResult | null {
    if (!this.player || !this.player.alive) return null;
    const availableActions = this._getAvailableNightActions();
    this.belief.updateInferences(allPlayers, this.player);
    const decision = this.engine.decide(this.belief, this.player, 'night', availableActions, allPlayers, nightDecisions, []);
    this._log('night', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    return decision;
  }

  dayAction(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[], consecutiveSilence: number, aliveCount: number): DecisionResult | null {
    if (!this.player || !this.player.alive) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || [], this.player);
    const availableActions = this._getAvailableDayActions();
    this.belief.updateInferences(allPlayers, this.player);
    const decision = this.engine.decide(this.belief, this.player, 'day', availableActions, allPlayers, [], publicActions, consecutiveSilence, aliveCount);
    this._log('day', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    return decision;
  }

  appendixAction(allPlayers: Player[], triggerAction: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }, publicActions: { actorId: string; type: string; targetId?: string }[]): DecisionResult | null {
    if (!this.player || !this.player.alive) return null;
    const availableActions = this._getAvailableAppendixActions(triggerAction);
    if (availableActions.length === 0) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || [], this.player);
    const decision = this.engine.decide(this.belief, this.player, 'appendix', availableActions, allPlayers, [], publicActions);
    this._log('day', `追加行动：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    return decision;
  }

  vote(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string }[], voteRound: number = 1): DecisionResult | null {
    if (!this.player || !this.player.alive) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || [], this.player);
    const availableActions = [{ type: 'vote' }];
    this.belief.updateInferences(allPlayers, this.player);
    const decision = this.engine.decide(this.belief, this.player, 'vote', availableActions, allPlayers, [], publicActions, 0, 0, voteRound);
    this._log('vote', `投票：${decision.target || '无目标'}，原因：${decision.reason}`);
    return decision;
  }

  voteRound2(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string }[], candidates: string[]): DecisionResult | null {
    if (!this.player || !this.player.alive) return null;
    const availableActions = [{ type: 'vote' }];
    this.belief.updateInferences(allPlayers, this.player);
    const decision = this.engine.decide(this.belief, this.player, 'vote', availableActions, allPlayers, [], publicActions, 0, 0, 2, candidates);
    this._log('vote', `第二轮投票：${decision.target || '无目标'}，原因：${decision.reason}`);
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

  recordObservation(targetId: string, stress: number, attributes: Record<string, number>) {
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
      logs: this.logs,
    };
  }

  private _getAvailableNightActions(): { type: string }[] {
    if (!this.player) return [];
    const actions: { type: string }[] = [];
    const p = this.player;
    switch (p.role) {
      case 'prophet':
        if (p.items.some((i) => i.definitionId === 'crystal_ball' && i.durability > 0)) actions.push({ type: 'check' });
        break;
      case 'werewolf':
      case 'lone_wolf':
      case 'berserker':
        if (p.items.some((i) => i.definitionId === 'claws' && i.durability > 0)) actions.push({ type: 'kill' });
        break;
      case 'thief':
        if (p.items.some((i) => i.definitionId === 'thief_gloves' && i.durability > 0)) actions.push({ type: 'steal' });
        break;
      case 'coroner':
        if (p.items.some((i) => i.definitionId === 'coroner_tools' && i.durability > 0)) actions.push({ type: 'inspect' });
        break;
    }
    return actions;
  }

  private _getAvailableDayActions(): { type: string }[] {
    if (!this.player) return [];
    const actions: { type: string }[] = [];
    const p = this.player;

    // Silence is always available
    actions.push({ type: 'silence' });

    // Claim identity
    actions.push({ type: 'claim_identity' });

    // Reveal info
    actions.push({ type: 'reveal_info' });

    // Observe
    actions.push({ type: 'observe' });

    // Suspect
    actions.push({ type: 'suspect' });

    // Defend
    actions.push({ type: 'defend' });

    // Thank
    actions.push({ type: 'thank' });

    // Call vote / Block vote
    actions.push({ type: 'call_vote' });
    actions.push({ type: 'block_vote' });

    // Guarantee / Accuse
    actions.push({ type: 'guarantee' });
    actions.push({ type: 'accuse' });

    // Exclude all
    actions.push({ type: 'exclude_all' });

    // Berserker special
    if (p.role === 'berserker' && p.items.some((i) => i.definitionId === 'double_sword' && i.durability > 0)) {
      actions.push({ type: 'berserker_kill' });
    }

    return actions;
  }

  private _getAvailableAppendixActions(triggerAction: { actorId: string; type: string; targetId?: string }): { type: string }[] {
    if (!this.player) return [];
    const actions: { type: string }[] = [];

    if (triggerAction.type === 'suspect' || triggerAction.type === 'join_suspect') {
      // Can join suspect if not the original target and not the trigger actor
      if (triggerAction.targetId !== this.player.id && triggerAction.actorId !== this.player.id) {
        actions.push({ type: 'join_suspect', originalTargetId: triggerAction.targetId });
      }
      // Can rebut if we are the target
      if (triggerAction.targetId === this.player.id && triggerAction.actorId !== this.player.id) {
        actions.push({ type: 'rebut', originalActorId: triggerAction.actorId });
      }
    }

    if (triggerAction.type === 'defend' || triggerAction.type === 'join_defend') {
      // Can join defend if not the original target and not the trigger actor
      if (triggerAction.targetId !== this.player.id && triggerAction.actorId !== this.player.id) {
        actions.push({ type: 'join_defend', originalTargetId: triggerAction.targetId });
      }
    }

    return actions;
  }

  private _log(phase: Phase, message: string) {
    this.logs.push({ round: this.currentRound, phase, message, timestamp: Date.now() });
  }
}
