import { BeliefSystem } from './belief-system';
import { DecisionEngine, ProphetDutyStrategy, WerewolfDutyStrategy, WerewolfKillStrategy, SurvivalStrategy, MaxInfoVoteStrategy, SocialTieBreakerStrategy, ProphetCheckStrategy, BerserkerSuicideStrategy } from './decision-engine';
import type { Player, DecisionResult, LogEntry, Role, Team } from './types';

export class AIAgent {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  items: string[];
  belief: BeliefSystem;
  engine: DecisionEngine;
  logs: LogEntry[];
  currentRound: number = 0;

  constructor(id: string, name: string, role: Role, team: Team, config: Record<string, unknown> = {}) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.team = team;
    this.alive = true;
    this.items = [];
    this.belief = new BeliefSystem(id, name);
    this.belief.setMyRole(role, team);
    this.engine = new DecisionEngine(config);
    this._registerDefaultStrategies();
    this.logs = [];
  }

  private _registerDefaultStrategies() {
    this.engine.registerStrategy('duty', ProphetDutyStrategy);
    this.engine.registerStrategy('duty', WerewolfDutyStrategy);
    this.engine.registerStrategy('duty', BerserkerSuicideStrategy);
    this.engine.registerStrategy('survival', SurvivalStrategy);
    this.engine.registerStrategy('information', WerewolfKillStrategy);
    this.engine.registerStrategy('information', MaxInfoVoteStrategy);
    this.engine.registerStrategy('information', ProphetCheckStrategy);
    this.engine.registerStrategy('social', SocialTieBreakerStrategy);
  }

  initializeRelations(allPlayers: Player[]) {
    this.belief._initializeRelations(allPlayers);
    if (this.team === 'werewolf') {
      allPlayers.forEach((p) => {
        if (p.team === 'werewolf' && p.id !== this.id) {
          this.belief.l1Inferences.roleBeliefs[p.id] = { werewolf: 1.0, villager: 0 };
        }
      });
    }
    this._log('init', `初始化完成，职业：${this.role}，阵营：${this.team}`);
  }

  nightAction(allPlayers: Player[]): DecisionResult | null {
    if (!this.alive) return null;
    const availableActions = this._getAvailableNightActions();
    this.belief.updateInferences(allPlayers);
    const decision = this.engine.decide(this.belief, 'night', availableActions, allPlayers);
    this._log('night', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    return decision;
  }

  dayAction(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string }[]): DecisionResult | null {
    if (!this.alive) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || []);
    const availableActions = this._getAvailableDayActions();
    this.belief.updateInferences(allPlayers);
    const decision = this.engine.decide(this.belief, 'day', availableActions, allPlayers);
    this._log('day', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    return decision;
  }

  vote(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string }[]): DecisionResult | null {
    if (!this.alive) return null;
    this.belief.updateTheoryOfMind(allPlayers, publicActions || []);
    const availableActions = [{ type: 'vote' }];
    this.belief.updateInferences(allPlayers);
    const decision = this.engine.decide(this.belief, 'vote', availableActions, allPlayers);
    this._log('vote', `投票：${decision.target || '无目标'}，原因：${decision.reason}`);
    return decision;
  }

  onEvent(event: { type: string; targetId?: string; result?: 'werewolf' | 'villager'; playerId?: string; claimType?: string; content?: Record<string, unknown>; friendlyDelta?: number; trustDelta?: number }) {
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
          if (event.playerId === this.id) this.alive = false;
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
    }
  }

  getDecisionExplanation() {
    return {
      player: this.name,
      role: this.role,
      alive: this.alive,
      l0: this.belief.l0Facts,
      l1: this.belief.l1Inferences,
      l2: this.belief.l2TheoryOfMind,
      l3: this.belief.l3Social,
      logs: this.logs,
    };
  }

  private _getAvailableNightActions() {
    const actions: { type: string }[] = [];
    switch (this.role) {
      case 'prophet':
        if (this.items.includes('crystal_ball')) actions.push({ type: 'check' });
        break;
      case 'werewolf':
      case 'lone_wolf':
      case 'berserker':
        if (this.items.includes('claws')) actions.push({ type: 'kill' });
        break;
      case 'thief':
        if (this.items.includes('thief_gloves')) actions.push({ type: 'steal' });
        break;
      case 'coroner':
        if (this.items.includes('coroner_tools')) actions.push({ type: 'inspect' });
        break;
    }
    return actions;
  }

  private _getAvailableDayActions() {
    const actions: { type: string }[] = [{ type: 'vote' }];
    if (this.role === 'berserker' && this.items.includes('double_sword')) {
      actions.push({ type: 'berserker_kill' });
    }
    return actions;
  }

  private _log(phase: string, message: string) {
    this.logs.push({ round: this.currentRound, phase, message, timestamp: Date.now() });
  }
}
