import type {
  Player, GameLogItem, Phase, Winner, SetupConfig, Role,
  VoteResult, ItemInstance, Attributes, Alignment
} from '../ai/types';
import { generateGameConfig } from './simulator-config';
import {
  ROLE_INFO, ITEM_DEFINITIONS, generateRandomAttributes, generateRandomAlignment
} from '../ai/types';
import { AIAgent } from '../ai/ai-agent';
import {
  PhaseController, DayPhaseController, NightPhaseController, VotePhaseController, MorningPhaseController, CheckWinPhaseController, LOG_PRIORITY
} from './simulator-phases';

// ---------- Actor State Machine ----------

export type ActorState = 'idle' | 'thinking' | 'acting';

export interface PlayerActor {
  id: string;
  state: ActorState;
  thinkCountdown: number; // ticks remaining until ready to act
  pendingEvent: GameEvent | null; // what triggered this thinking period
}

// ---------- Event Bus ----------

export interface GameEvent {
  type: string;
  source: string; // playerId who produced the event, or 'system'
  payload: Record<string, unknown>;
}

export class EventBus {
  private queue: GameEvent[] = [];
  private subscribers: Map<string, ((event: GameEvent) => string[])[]> = new Map();

  subscribe(eventType: string, resolver: (event: GameEvent) => string[]) {
    if (!this.subscribers.has(eventType)) this.subscribers.set(eventType, []);
    this.subscribers.get(eventType)!.push(resolver);
  }

  emit(event: GameEvent) {
    this.queue.push(event);
    console.log(`[消息中心] 📨 EventBus 入队: type=${event.type} source=${event.source}, queueLength=${this.queue.length}`);
  }

  flush(sim: GameSimulator): GameEvent[] {
    const processed = [...this.queue];
    this.queue = [];
    console.log(`[消息中心] 📨 EventBus flush: ${processed.length} 个事件`);
    processed.forEach((event) => {
      const resolvers = this.subscribers.get(event.type) || [];
      resolvers.forEach((resolve) => {
        const targetIds = resolve(event);
        console.log(`[消息中心] 📡 EventBus ${event.type} resolver 返回 ${targetIds.length} 个目标: [${targetIds.join(', ')}]`);
        targetIds.forEach((pid) => sim.notifyPlayer(pid, event));
        if (targetIds.length > 0) {
          console.log(`[消息中心] 📡 EventBus 广播 ${event.type} → ${targetIds.length} 个玩家: [${targetIds.join(', ')}]`);
        }
      });
    });
    return processed;
  }
}

// ---------- Phase Interface ----------

// ---------- Game Simulator (Tick-Based) ----------

export interface PublicActionRecord {
  actorId: string;
  type: string;
  targetId?: string;
  details?: Record<string, unknown>;
  round: number;
}

export interface NightDecision {
  playerId: string;
  action: string;
  targetId: string | null;
  reason: string;
}

export interface GameSimulatorOptions {
  skipNightKill?: boolean;
  debug?: boolean;
}

export class GameSimulator {
  players: Player[];
  round: number;
  phase: Phase;
  logs: GameLogItem[];
  winner: Winner;
  publicActions: PublicActionRecord[];

  // Night state
  nightDecisions: NightDecision[];
  nightDeaths: string[];
  peacefulNight: boolean;

  // Day state
  consecutiveSilenceCount: number;
  dayActionIndex: number;
  alivePlayerIds: string[];

  // Vote state
  voteRound: number;
  votes: Record<string, string[]>;
  voteResult: VoteResult | null;

  prophetClaims: Record<string, boolean>;
  thiefUsed: Record<string, boolean>;
  coronerUsed: Record<string, boolean>;

  gameConfig: SetupConfig;
  options: GameSimulatorOptions;
  _aiAgents: Record<string, AIAgent> = {};

  // ---- Tick Engine ----
  actors: Map<string, PlayerActor> = new Map();
  eventBus: EventBus = new EventBus();
  currentPhase: PhaseController | null = null;
  forcePhaseEnd = false;

  // ---- Tick Log Buffer ----
  // During a tick, all logs are written here; sorted and committed at tick end
  tickLogBuffer: GameLogItem[] = [];

  private phaseQueue: PhaseController[] = [];
  private currentPhaseIndex = 0;

  constructor(
    playerConfigs: {
      id: string;
      name: string;
      role: Role;
      team: 'werewolf' | 'villager';
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

    this.prophetClaims = {};
    this.thiefUsed = {};
    this.coronerUsed = {};

    this.gameConfig = { totalPlayers: playerConfigs.length, werewolfConfig: [], villagerConfig: [] };
    this.options = options;

    this._createPlayers(playerConfigs);

    // Initialize appendix reaction subscription (FIXED: was 'appendix_trigger')
    this.eventBus.subscribe('appendix_reaction', (event) => {
      const triggerAction = event.payload.triggerAction as PublicActionRecord;
      return this.players
        .filter((p) => p.alive && p.id !== triggerAction.actorId)
        .map((p) => p.id);
    });
  }

  private _createPlayers(configs: {
    id: string;
    name: string;
    role: Role;
    team: 'werewolf' | 'villager';
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

      // Initialize actor
      this.actors.set(cfg.id, {
        id: cfg.id,
        state: 'idle',
        thinkCountdown: 0,
        pendingEvent: null,
      });
    });

    // Initialize relations
    this.players.forEach((p) => {
      this.players.forEach((other) => {
        if (p.id !== other.id) {
          p.relations[other.id] = { trust: 0, friendly: 0 };
        }
      });
    });

    // Initialize AI agents
    this._aiAgents = {};
    this.players.forEach((p) => {
      this._aiAgents[p.id] = new AIAgent(p, this.players);
    });
  }

  // ==================== TICK API ====================

  tick(): boolean {
    if (this.winner) {
      console.log('[消息中心] 🏁 游戏已结束，停止 tick');
      return false;
    }

    // Ensure we have a phase controller
    if (!this.currentPhase) {
      if (this.currentPhaseIndex >= this.phaseQueue.length) {
        // All phases done for this round - prepare next round
        console.log('[消息中心] 🔄 所有阶段完成，准备下一轮');
        this._prepareNextRound();
        return this.tick();
      }
      this.currentPhase = this.phaseQueue[this.currentPhaseIndex];
      this.currentPhase.onEnter(this);
      this.phase = this.currentPhase.name;
      console.log(`[消息中心] 🔄 阶段切换 → ${this.phase}`);
    }

    console.log(`[消息中心] ⏱️ tick() 执行: phase=${this.currentPhase.name}, round=${this.round}`);

    // Collect tick logs into tickLogBuffer; commit at the end of tick
    this.tickLogBuffer = [];
    const continuePhase = this.currentPhase.onTick(this);
    // Commit tick logs sorted by priority
    this.tickLogBuffer.sort((a, b) => {
      const pa = LOG_PRIORITY[a.type] ?? 99;
      const pb = LOG_PRIORITY[b.type] ?? 99;
      return pa - pb;
    });
    this.logs.push(...this.tickLogBuffer);
    this.tickLogBuffer = [];

    if (!continuePhase) {
      console.log(`[消息中心] 🔄 阶段结束: ${this.currentPhase.name}`);
      this.currentPhase.onExit(this);
      this.currentPhaseIndex++;
      this.currentPhase = null;
    }

    return !this.winner && (this.currentPhase !== null || this.currentPhaseIndex < this.phaseQueue.length);
  }

  notifyPlayer(playerId: string, event: GameEvent) {
    const actor = this.actors.get(playerId);
    console.log(`[消息中心] 📢 notifyPlayer: ${playerId}, event=${event.type}, actorState=${actor?.state ?? 'not found'}`);
    if (actor && actor.state === 'idle') {
      actor.state = 'thinking';
      actor.thinkCountdown = 1; // Default 1 tick think time
      actor.pendingEvent = event;
      console.log(`[消息中心] 🔔 notifyPlayer: ${playerId} 进入 thinking (事件: ${event.type})`);
    } else {
      console.log(`[消息中心] ⚠️ notifyPlayer: ${playerId} 状态=${actor?.state ?? 'not found'}，不是 idle，拒绝通知 event=${event.type}`);
    }
  }

  broadcastEvent(event: GameEvent) {
    this.eventBus.emit(event);
  }

  // ==================== ROUND MANAGEMENT ====================

  private _prepareNextRound() {
    this.round++;
    this.logs.push({ round: this.round, phase: 'init', message: `=== 第 ${this.round} 轮 ===`, type: 'phase' });

    this.phaseQueue = [
      new DayPhaseController(),
      new VotePhaseController(),
      new NightPhaseController(),
      new MorningPhaseController(),
      new CheckWinPhaseController(),
    ];
    this.currentPhaseIndex = 0;
    this.currentPhase = null;
    console.log(`[消息中心] 🔄 第 ${this.round} 轮开始，生成 5 个阶段`);
  }

  generateRoundSteps() {
    // Compatibility: initialize a new round
    this._prepareNextRound();
  }

  // ==================== LEGACY STEP API (for compatibility) ====================

  executeNextStep(): boolean {
    return this.tick();
  }

  hasMoreSteps(): boolean {
    if (this.winner) return false;
    if (this.currentPhase) return true;
    return this.currentPhaseIndex < this.phaseQueue.length;
  }

  runRound(options: GameSimulatorOptions = {}): Winner {
    this.generateRoundSteps();
    while (this.hasMoreSteps()) {
      this.executeNextStep();
    }
    return this.getWinner();
  }

  // ==================== WIN CHECK ====================

  _checkWinCondition() {
    const aliveWerewolves = this.players.filter((p) => p.team === 'werewolf' && p.alive).length;
    const aliveVillagers = this.players.filter((p) => p.team !== 'werewolf' && p.alive).length;

    if (aliveWerewolves === 0) {
      this.winner = 'villager';
      this.logs.push({ round: this.round, phase: 'init', message: '=== 村民阵营胜利！所有狼人已被消灭。 ===', type: 'victory' });
      this.phase = 'ended';
      console.log('[消息中心] 🏆 村民阵营胜利！');
    } else if (aliveWerewolves >= aliveVillagers) {
      this.winner = 'werewolf';
      this.logs.push({ round: this.round, phase: 'init', message: '=== 狼人阵营胜利！狼人数量 >= 村民数量。 ===', type: 'victory' });
      this.phase = 'ended';
      console.log('[消息中心] 🏆 狼人阵营胜利！');
    }
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

  getAlivePlayerIds(): string[] {
    return this.players.filter((p) => p.alive).map((p) => p.id);
  }

  getCurrentTickRate(): number {
    return this.currentPhase?.tickRate ?? 2000;
  }
}

export { generateGameConfig } from './simulator-config';
