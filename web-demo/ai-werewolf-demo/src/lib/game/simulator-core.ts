import type {
  Player, GameLogItem, Phase, Winner, SetupConfig, Role,
  VoteResult, ItemInstance, Attributes, Alignment
} from '@/types';
import {
  ROLE_INFO, ITEM_DEFINITIONS, generateRandomAttributes, generateRandomAlignment
} from '@/types';
import { AIAgent } from '../ai/ai-agent';
import {
  type PhaseController, DayPhaseController, NightPhaseController, VotePhaseController, MorningPhaseController, CheckWinPhaseController, LOG_PRIORITY
} from './simulator-phases';
import { PluginRegistry, registerDefaultPlugins } from '../plugins';

const DEBUG = false;
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}

// ---------- Actor State Machine ----------

export type ActorState = 'idle' | 'thinking' | 'acting';

export interface PlayerActor {
  id: string;
  state: ActorState;
  thinkCountdown: number; // milliseconds remaining until ready to act
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
    this.subscribers.get(eventType)?.push(resolver);
  }

  emit(event: GameEvent) {
    this.queue.push(event);
  }

  flush(sim: GameSimulator): GameEvent[] {
    const processed = [...this.queue];
    this.queue = [];
    processed.forEach((event) => {
      const resolvers = this.subscribers.get(event.type) || [];
      resolvers.forEach((resolve) => {
        const targetIds = resolve(event);
        targetIds.forEach((pid) => sim.notifyPlayer(pid, event));
        if (targetIds.length > 0) {
          debugLog(`[消息中心] 📡 事件 ${event.type} → ${targetIds.length} 人响应: [${targetIds.join(', ')}]`);
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
  // 记录今天白天每个玩家已经执行过动作的目标（同一人同天对同一人只能动作一次）
  dayActionTargets: Map<string, Set<string>>;

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

  // ---- Plugin System ----
  pluginRegistry: PluginRegistry;

  // ---- Tick Engine ----
  actors: Map<string, PlayerActor> = new Map();
  eventBus: EventBus = new EventBus();
  currentPhase: PhaseController | null = null;
  forcePhaseEnd = false;

  // ---- Thinking Log Index ----
  // Tracks playerIds with active thinking logs for O(1) lookup
  private thinkingLogPlayerIds = new Set<string>();

  // ---- Tick Log Buffer ----
  // During a tick, all logs are written here; sorted and committed at tick end
  tickLogBuffer: GameLogItem[] = [];

  private phaseQueue: PhaseController[] = [];
  private currentPhaseIndex = 0;

  // ---- Robustness: tick counter & stuck-actor detection ----
  private _tickCount = 0;
  private _actorStuckSince: Map<string, number> = new Map();

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

    this.dayActionTargets = new Map();

    this.gameConfig = { totalPlayers: playerConfigs.length, werewolfConfig: [], villagerConfig: [] };
    this.options = options;

    // Initialize plugin registry
    this.pluginRegistry = new PluginRegistry();
    registerDefaultPlugins(this.pluginRegistry);

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
      this._aiAgents[p.id] = new AIAgent(p, this.players, this.pluginRegistry);
    });
  }

  // ==================== TICK API ====================

  tick(): boolean {
    this._tickCount++;

    if (this.winner) {
      return false;
    }

    try {
      // Ensure we have a phase controller
      if (!this.currentPhase) {
        if (this.currentPhaseIndex >= this.phaseQueue.length) {
          this._prepareNextRound();
          return this.tick();
        }
        this.currentPhase = this.phaseQueue[this.currentPhaseIndex];
        this.currentPhase.onEnter(this);
        this.phase = this.currentPhase.name;
        debugLog(`[消息中心] 🔄 进入 ${this.phase} 阶段`);
      }

      // 添加 thinking 日志（当前正在思考的玩家）
      this._addThinkingLogs();

      // Collect tick logs into tickLogBuffer; commit at the end of tick
      this.tickLogBuffer = [];
      const continuePhase = this.currentPhase.onTick(this);

      // Check for stuck actors after thinkers advance
      this._checkStuckActors();

      // 移除已完成的 thinking 日志（刚执行完的玩家）
      this._removeCompletedThinkingLogs();

      // Commit tick logs sorted by priority
      this.tickLogBuffer.sort((a, b) => {
        const pa = LOG_PRIORITY[a.type] ?? 99;
        const pb = LOG_PRIORITY[b.type] ?? 99;
        return pa - pb;
      });
      this.logs.push(...this.tickLogBuffer);
      this.tickLogBuffer = [];

      if (!continuePhase) {
        debugLog(`[消息中心] 🔄 ${this.currentPhase.name} 阶段结束`);
        this.currentPhase.onExit(this);
        this.currentPhaseIndex++;
        this.currentPhase = null;
      }

      return !this.winner && (this.currentPhase !== null || this.currentPhaseIndex < this.phaseQueue.length);
    } catch (e) {
      console.error('[GameSimulator] Tick error:', e);
      return true; // skip failed tick, continue game
    }
  }

  private _addThinkingLogs() {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    this.actors.forEach((actor, id) => {
      if (actor.state === 'thinking' && !this.thinkingLogPlayerIds.has(id)) {
        const player = this.players.find(p => p.id === id);
        this.logs.push({
          round: this.round,
          phase: this.phase,
          message: `[${time}] ⏳ ${player?.name || id} 正在思考...`,
          type: 'thinking',
          details: { playerId: id, thinking: true }
        });
        this.thinkingLogPlayerIds.add(id);
      }
    });
  }

  private _checkStuckActors() {
    const tickRate = this.currentPhase?.tickRate ?? 200;
    const maxTicks = Math.max(50, Math.ceil(15000 / tickRate));
    this.actors.forEach((actor, id) => {
      if (actor.state === 'thinking') {
        const stuckSince = this._actorStuckSince.get(id);
        if (stuckSince === undefined) {
          this._actorStuckSince.set(id, this._tickCount);
        } else if (this._tickCount - stuckSince > maxTicks) {
          console.warn(`[GameSimulator] ⚠️ Actor ${id} stuck in thinking for ${this._tickCount - stuckSince} ticks, forcing to acting`);
          actor.state = 'acting';
          this._actorStuckSince.delete(id);
        }
      } else {
        this._actorStuckSince.delete(id);
      }
    });
  }

  private _removeCompletedThinkingLogs() {
    this.actors.forEach((actor, id) => {
      if (actor.state === 'idle' && this.thinkingLogPlayerIds.has(id)) {
        const idx = this.logs.findIndex(log =>
          log.type === 'thinking' && log.details?.playerId === id
        );
        if (idx >= 0) {
          this.logs.splice(idx, 1);
        }
        this.thinkingLogPlayerIds.delete(id);
      }
    });
  }

  notifyPlayer(playerId: string, event: GameEvent) {
    const actor = this.actors.get(playerId);
    if (actor && actor.state === 'idle') {
      actor.state = 'thinking';
      const player = this.players.find((p) => p.id === playerId);
      // 白天行动: 个性化思考时间（1-3秒基础，受角色属性影响）
      // 其他事件: 个性化思考时间（反应/投票/夜间行动）
      actor.thinkCountdown = player ? calculateThinkTime(player) : 1000;
      actor.pendingEvent = event;
    } else {
      debugLog(`[消息中心] ⚠️ ${playerId} 状态=${actor?.state}，无法接收 ${event.type}`);
    }
  }

  broadcastEvent(event: GameEvent) {
    this.eventBus.emit(event);
  }

  // ==================== ROUND MANAGEMENT ====================

  private _prepareNextRound() {
    this.round++;
    this.thinkingLogPlayerIds.clear();
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
    debugLog(`[消息中心] 🔄 第 ${this.round} 轮开始`);
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

  runRound(_options: GameSimulatorOptions = {}): Winner {
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
      this.tickLogBuffer.push({ round: this.round, phase: 'init', message: '=== 村民阵营胜利！所有狼人已被消灭。 ===', type: 'victory' });
      this.phase = 'ended';
      debugLog('[消息中心] 🏆 村民胜利！');
    } else if (aliveWerewolves >= aliveVillagers) {
      this.winner = 'werewolf';
      this.tickLogBuffer.push({ round: this.round, phase: 'init', message: '=== 狼人阵营胜利！狼人数量 >= 村民数量。 ===', type: 'victory' });
      this.phase = 'ended';
      debugLog('[消息中心] 🏆 狼人胜利！');
    }
  }

  // ==================== GETTERS ====================

  getWinner(): Winner {
    return this.winner;
  }

  getLogs(): GameLogItem[] {
    return this.logs;
  }

  /** @deprecated Use getPlayers() instead. Kept for backward compatibility. */
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

  /** 检查是否所有玩家都 idle（没有 pending 的思考或行动） */
  areAllActorsIdle(): boolean {
    return Array.from(this.actors.values()).every((a) => a.state === 'idle');
  }
}

// ---------- Think Time Calculation (personalized) ----------

function calculateThinkTime(player: Player): number {
  // 基础 1-3 秒
  let base = 1000 + Math.random() * 2000;

  // 压力大 → 更快（慌乱）
  if (player.stress > 5) base *= 0.6;
  // 冷静 → 更慢（谨慎）
  else if (player.stress < -3) base *= 1.4;

  // 逻辑高 → 更快（思路清晰）
  if (player.attributes.logic > 7) base *= 0.7;
  // 逻辑低 → 更慢（犹豫）
  else if (player.attributes.logic < 3) base *= 1.3;

  // 洞察高 → 更快（看透局势）
  if (player.attributes.insight > 7) base *= 0.8;
  // 洞察低 → 更慢（茫然）
  else if (player.attributes.insight < 3) base *= 1.2;

  // 诡诈高 → 更快（早有预谋）
  if (player.attributes.deception > 7) base *= 0.8;
  // 诡诈低 → 更慢（拙劣表演）
  else if (player.attributes.deception < 3) base *= 1.2;

  return Math.max(500, Math.min(5000, Math.round(base)));
}

export { generateGameConfig } from './simulator-config';
