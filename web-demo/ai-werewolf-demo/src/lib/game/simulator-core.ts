import type {
  Player, Role, Team, Phase, Winner, GameLogItem, ItemInstance,
  NightActionType, DayActionType, AppendixActionType, ActionType,
  NightKillResult, VoteResult, CheckResult, SetupConfig,
  RelationDelta, Attributes, Alignment, ItemDefinition,
  MAX_ITEM_SLOTS,
} from '../ai/types';

import { ROLE_INFO, ITEM_DEFINITIONS, rollD20, performCheck, clamp, clampStress, clampRelation, hasItem, getItem, removeItem, addItem, damageItem, canUseItem, generateRandomAttributes, generateRandomAlignment, getAlignmentName } from '../ai/types';

import { AIAgent } from '../ai/ai-agent';
import { generateGameConfig } from './simulator-config';
import { runNightAction, resolveNightActions } from './simulator-night';
import { resolveMorningEvents } from './simulator-morning';
import { runDayAction, resolveDayAction, openAppendixWindow, runAppendixAction } from './simulator-day';
import { skipToVote, runVote, resolveVotesRound1, generateVoteRound2, runVoteRound2, resolveVotesRound2 } from './simulator-vote';
import { getPublicPlayerStates, getName, log, updateRelation } from './simulator-utils';

// ---------- Public Action Record ----------
export interface PublicActionRecord {
  actorId: string;
  type: ActionType;
  targetId?: string;
  details?: Record<string, unknown>;
  round: number;
}

// ---------- Night Decision Record ----------
export interface NightDecision {
  playerId: string;
  action: NightActionType;
  targetId: string | null;
  reason: string;
}

// ---------- Step Queue ----------
export interface GameStep {
  type: string;
  actorId?: string;
  fn: () => void | boolean; // return true to skip remaining steps in this sub-phase
}

export interface GameSimulatorOptions {
  skipNightKill?: boolean;
  debug?: boolean;
}

// ---------- Game Simulator Core ----------
export class GameSimulator {
  players: Player[];
  round: number;
  phase: Phase;
  stepQueue: GameStep[];
  currentStep: number;
  logs: GameLogItem[];
  winner: Winner;
  publicActions: PublicActionRecord[];

  // Night state
  nightDecisions: NightDecision[];
  nightDeaths: string[];
  peacefulNight: boolean; // set by berserker suicide

  // Day state
  consecutiveSilenceCount: number;
  dayActionIndex: number;
  alivePlayerIds: string[];

  // Vote state
  voteRound: number;
  votes: Record<string, string[]>; // targetId -> voterIds
  voteResult: VoteResult | null;

  // Appendix window
  appendixWindow: {
    triggerAction: PublicActionRecord;
    respondents: string[];
    currentIndex: number;
    responses: PublicActionRecord[];
  } | null;

  // Tracking
  prophetClaims: Record<string, boolean>; // playerId -> has claimed prophet
  thiefUsed: Record<string, boolean>; // playerId -> used steal
  coronerUsed: Record<string, boolean>; // playerId -> used inspect

  gameConfig: SetupConfig;
  options: GameSimulatorOptions;

  _aiAgents: Record<string, AIAgent> = {};

  constructor(
    playerConfigs: {
      id: string;
      name: string;
      role: Role;
      team: Team;
      items?: ItemInstance[];
      attributes?: Attributes;
      alignment?: Alignment;
      traits?: string[];
    }[],
    options: GameSimulatorOptions = {}
  ) {
    this.players = [];
    this.round = 0;
    this.phase = 'init';
    this.stepQueue = [];
    this.currentStep = 0;
    this.logs = [];
    this.winner = null;
    this.publicActions = [];

    this.nightDecisions = [];
    this.nightDeaths = [];
    this.peacefulNight = false;

    this.consecutiveSilenceCount = 0;
    this.dayActionIndex = 0;
    this.alivePlayerIds = [];

    this.voteRound = 0;
    this.votes = {};
    this.voteResult = null;

    this.appendixWindow = null;

    this.prophetClaims = {};
    this.thiefUsed = {};
    this.coronerUsed = {};

    this.gameConfig = { totalPlayers: playerConfigs.length, werewolfConfig: [], villagerConfig: [] };
    this.options = options;

    this._createPlayers(playerConfigs);
  }

  private _createPlayers(configs: {
    id: string;
    name: string;
    role: Role;
    team: Team;
    items?: ItemInstance[];
    attributes?: Attributes;
    alignment?: Alignment;
    traits?: string[];
  }[]) {
    configs.forEach((cfg) => {
      const roleInfo = ROLE_INFO[cfg.role];
      const items: ItemInstance[] = cfg.items ?? roleInfo.defaultItems.map((id) => ({
        definitionId: id,
        durability: ITEM_DEFINITIONS[id]?.maxDurability ?? 1,
      }));

      const player: Player = {
        id: cfg.id,
        name: cfg.name,
        role: cfg.role,
        team: cfg.team,
        alive: true,
        items,
        attributes: cfg.attributes ?? generateRandomAttributes(),
        alignment: cfg.alignment ?? generateRandomAlignment(),
        traits: cfg.traits ?? [],
        stress: 0,
        relations: {},
      };

      this.players.push(player);
    });

    // Initialize relations (directed, start at 0)
    this.players.forEach((p) => {
      this.players.forEach((other) => {
        if (p.id !== other.id) {
          p.relations[other.id] = { trust: 0, friendly: 0 };
        }
      });
    });

    // Initialize AI agents for each player
    this._aiAgents = {};
    this.players.forEach((p) => {
      this._aiAgents[p.id] = new AIAgent(p, this.players);
    });
  }

  // ==================== ROUND GENERATION ====================

  generateRoundSteps() {
    this.round++;
    this.stepQueue = [];
    this.nightDecisions = [];
    this.nightDeaths = [];
    // peacefulNight: 若上一轮白天狂狼同归于尽，标记为 true，影响本轮夜晚
    // 夜晚结算后会自动清除
    this.consecutiveSilenceCount = 0;
    this.dayActionIndex = 0;
    this.voteRound = 0;
    this.votes = {};
    this.voteResult = null;
    this.appendixWindow = null;
    this.winner = null;

    this._log('phase', `=== 第 ${this.round} 轮 ===`);

    // --- Night Phase ---
    this._generateNightSteps();
    // --- Morning Phase ---
    this._generateMorningSteps();
    // --- Day Phase ---
    this._generateDaySteps();
    // --- Vote Phase ---
    this._generateVoteSteps();

    // Check Win
    this.stepQueue.push({
      type: 'check_win',
      fn: () => {
        this._checkWinCondition();
      },
    });

    this.currentStep = 0;
  }

  // ==================== NIGHT PHASE STEPS ====================

  private _generateNightSteps() {
    this.stepQueue.push({
      type: 'phase',
      fn: () => {
        this.phase = 'night';
        this._log('phase', '-- 夜晚阶段 --');
      },
    });

    // 1. Werewolf kill decisions (including lone wolf)
    const werewolves = this.players.filter((p) => p.team === 'werewolf' && p.alive);
    werewolves.forEach((p) => {
      this.stepQueue.push({
        type: 'night_action',
        actorId: p.id,
        fn: () => this._runNightAction(p),
      });
    });

    // 2. Prophet check
    const prophets = this.players.filter((p) => p.role === 'prophet' && p.alive);
    prophets.forEach((p) => {
      this.stepQueue.push({
        type: 'night_action',
        actorId: p.id,
        fn: () => this._runNightAction(p),
      });
    });

    // 3. Thief steal
    const thieves = this.players.filter((p) => p.role === 'thief' && p.alive);
    thieves.forEach((p) => {
      this.stepQueue.push({
        type: 'night_action',
        actorId: p.id,
        fn: () => this._runNightAction(p),
      });
    });

    // 4. Coroner inspect
    const coroners = this.players.filter((p) => p.role === 'coroner' && p.alive);
    coroners.forEach((p) => {
      this.stepQueue.push({
        type: 'night_action',
        actorId: p.id,
        fn: () => this._runNightAction(p),
      });
    });

    // 5. Night resolution
    this.stepQueue.push({
      type: 'night_resolve',
      fn: () => this._resolveNightActions(),
    });
  }

  // ==================== MORNING PHASE STEPS ====================

  private _generateMorningSteps() {
    this.stepQueue.push({
      type: 'phase',
      fn: () => {
        this.phase = 'morning';
        this._log('phase', '-- 早晨事件 --');
      },
    });

    this.stepQueue.push({
      type: 'morning_event',
      fn: () => this._resolveMorningEvents(),
    });
  }

  // ==================== DAY PHASE STEPS ====================

  private _generateDaySteps() {
    this.stepQueue.push({
      type: 'phase',
      fn: () => {
        this.phase = 'day';
        this._log('phase', '-- 白天阶段 --');
      },
    });

    this.alivePlayerIds = this.players.filter((p) => p.alive).map((p) => p.id);
    this.dayActionIndex = 0;

    // Generate steps for each alive player to take a turn
    this.alivePlayerIds.forEach((playerId) => {
      this.stepQueue.push({
        type: 'day_action',
        actorId: playerId,
        fn: () => this._runDayAction(playerId),
      });
    });
  }

  // ==================== VOTE PHASE STEPS ====================

  private _generateVoteSteps() {
    this.stepQueue.push({
      type: 'phase',
      fn: () => {
        this.phase = 'vote';
        this._log('phase', '-- 投票阶段 --');
      },
    });

    // Vote round 1
    this.voteRound = 1;
    const aliveVoters = this.players.filter((p) => p.alive);
    aliveVoters.forEach((p) => {
      this.stepQueue.push({
        type: 'vote_action',
        actorId: p.id,
        fn: () => this._runVote(p),
      });
    });

    this.stepQueue.push({
      type: 'vote_resolve',
      fn: () => this._resolveVotesRound1(),
    });
  }

  // ==================== WIN CHECK ====================

  private _checkWinCondition() {
    const aliveWerewolves = this.players.filter((p) => p.team === 'werewolf' && p.alive).length;
    const aliveVillagers = this.players.filter((p) => p.team !== 'werewolf' && p.alive).length;

    if (aliveWerewolves === 0) {
      this.winner = 'villager';
      this._log('victory', '=== 村民阵营胜利！所有狼人已被消灭。 ===');
      this.phase = 'ended';
    } else if (aliveWerewolves >= aliveVillagers) {
      this.winner = 'werewolf';
      this._log('victory', '=== 狼人阵营胜利！狼人数量 >= 村民数量。 ===');
      this.phase = 'ended';
    }
  }

  // ==================== STEP EXECUTION ====================

  executeNextStep(): boolean {
    if (this.currentStep >= this.stepQueue.length) return false;
    const step = this.stepQueue[this.currentStep];
    const skip = step.fn();
    this.currentStep++;
    return this.currentStep < this.stepQueue.length;
  }

  hasMoreSteps(): boolean {
    return this.currentStep < this.stepQueue.length;
  }

  // ==================== GETTERS ====================

  getWinner(): Winner {
    return this.winner;
  }

  getLogs(): GameLogItem[] {
    return this.logs;
  }

  getPlayerStates(): Player[] {
    return this.players;
  }

  getPlayers(): Player[] {
    return this.players;
  }

  getPublicActions(): PublicActionRecord[] {
    return this.publicActions;
  }

  getRound(): number {
    return this.round;
  }

  getPhase(): Phase {
    return this.phase;
  }

  getConsecutiveSilence(): number {
    return this.consecutiveSilenceCount;
  }

  getAliveCount(): number {
    return this.players.filter((p) => p.alive).length;
  }

  // ==================== PHASE DELEGATES (class methods, not prototype) ====================

  private _runNightAction(player: Player) { runNightAction(this, player); }
  private _resolveNightActions() { resolveNightActions(this); }
  private _resolveMorningEvents() { resolveMorningEvents(this); }
  private _runDayAction(playerId: string) { runDayAction(this, playerId); }
  private _resolveDayAction(actor: Player, action: DayActionType, targetId: string | null, details: Record<string, unknown>): boolean { return resolveDayAction(this, actor, action, targetId, details); }
  private _openAppendixWindow(triggerAction: PublicActionRecord) { openAppendixWindow(this, triggerAction); }
  private _runAppendixAction(playerId: string) { runAppendixAction(this, playerId); }
  private _skipToVote() { skipToVote(this); }
  private _runVote(player: Player) { runVote(this, player); }
  private _resolveVotesRound1() { resolveVotesRound1(this); }
  private _generateVoteRound2(candidates: string[]) { generateVoteRound2(this, candidates); }
  private _runVoteRound2(player: Player, candidates: string[]) { runVoteRound2(this, player, candidates); }
  private _resolveVotesRound2(candidates: string[]) { resolveVotesRound2(this, candidates); }
  private _getPublicPlayerStates(): Player[] { return getPublicPlayerStates(this); }
  private _getName(id: string): string { return getName(this, id); }
  private _log(type: GameLogItem['type'], message: string, details?: Record<string, unknown>) { log(this, type, message, details); }
  private _updateRelation(fromPlayer: Player, toPlayer: Player, delta: RelationDelta) { updateRelation(this, fromPlayer, toPlayer, delta); }

  // ==================== OLD API COMPATIBILITY ====================

  runRound(options: GameSimulatorOptions = {}): Winner {
    this.generateRoundSteps();
    while (this.hasMoreSteps()) {
      this.executeNextStep();
    }
    return this.getWinner();
  }
}

export { generateGameConfig } from './simulator-config';
