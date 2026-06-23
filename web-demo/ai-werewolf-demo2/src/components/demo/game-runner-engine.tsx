import { MemStore } from '@/memory';
import { InferenceEngine } from '@/inference/inference-engine';
import { IntentionEngine } from '@/intention/intention-engine';
import { RelationTracker } from '@/relation';
import type { Player } from '@/types';
import { CREDIBILITY, MAX_ROUNDS } from '@/constants';
import { PERSONALITIES } from '@/intention/personalities';
import { generatePlayers, randInt, formatTime } from './game-runner-utils';
import type { GameConfig, GameLog, PlayerResult } from './game-runner-types';

export type SubPhase = 'init' | 'morning' | 'day' | 'vote' | 'result' | 'night' | 'victory';

export interface StepResult {
  log: GameLog;
  playerResults: Map<string, PlayerResult>;
}

export interface GameSnapshot {
  players: Player[];
  deadPlayerIds: Set<string>;
  round: number;
  winner: 'werewolf' | 'villager' | null;
}

export class GameEngine {
  players: Player[];
  store: MemStore;
  deadPlayerIds: Set<string>;
  round: number;
  winner: 'werewolf' | 'villager' | null;
  private logIdx: number;
  private base: number;
  private stepQueue: Array<() => GameLog>;
  private queueLabels: Array<{ subPhase: SubPhase; playerId?: string; label: string }>;
  dayRound: number; // 全局行动计数器（显示用）
  consecutiveSkip: number; // 连续沉默/观察计数
  todayActions: Map<string, Array<{ action: string; targetId?: string }>>;
  voteTargets: Record<string, string>;

  constructor(config: GameConfig) {
    this.players = generatePlayers(config);
    this.store = new MemStore();
    this.deadPlayerIds = new Set();
    this.round = 1;
    this.winner = null;
    this.logIdx = 0;
    this.base = Date.now();
    this.stepQueue = [];
    this.queueLabels = [];
    this.dayRound = 1;
    this.consecutiveSkip = 0;
    this.todayActions = new Map();
    this.voteTargets = {};

    // 初始化记忆：每人知道自己的身份
    for (const p of this.players) {
      this.store.add({ round: 0, triggerAt: 'init', eventType: 'self_role', actorId: p.id, content: { role: p.role }, source: 'self', credibility: CREDIBILITY.SELF, viewerId: p.id });
    }
    // 狼人知道队友
    const wolves = this.players.filter((p) => p.role === 'werewolf');
    for (const w of wolves) {
      for (const t of wolves) {
        if (t.id !== w.id) {
          this.store.add({ round: 0, triggerAt: 'init', eventType: 'teammate_reveal', actorId: w.id, targetId: t.id, content: {}, source: 'system', credibility: CREDIBILITY.SYSTEM, viewerId: w.id });
        }
      }
    }

    // 预填充第1轮队列
    this._fillRoundQueue();
  }

  // 填充一轮的队列
  private _fillRoundQueue() {
    this.voteTargets = {};
    this.store.applyForgetting(this.round);
    const alive = this.players.filter((p) => !this.deadPlayerIds.has(p.id));
    const r = this.round;

    // 轮次标题
    this._push(() => ({ time: this._nextTime(), isSystem: true, round: r, subPhase: 'init' as SubPhase, content: this._roundTitle(r) }));

    // 白天
    this._push(() => ({ time: this._nextTime(), isSystem: true, round: r, subPhase: 'day' as SubPhase, content: this._dayHeader() }));
    this._pushDayRoundActions(alive);
  }

  private _pushDayRoundActions(alive: Player[]) {
    for (const self of alive) {
      this._push(() => this._executeDayAction(self, alive), 'day', self.id);
    }
  }

  private _fillVoteQueue() {
    const r = this.round;
    const alive = this.players.filter((p) => !this.deadPlayerIds.has(p.id));

    // 投票
    this._push(() => ({ time: this._nextTime(), isSystem: true, round: r, subPhase: 'vote' as SubPhase, content: this._voteHeader() }));
    for (const p of alive) {
      this._push(() => this._executeVote(p, alive, this.voteTargets), 'vote', p.id);
    }

    // 投票结果
    this._push(() => this._executeVoteResult(this.voteTargets, r), 'result');

    // 夜晚
    this._push(() => ({ time: this._nextTime(), isSystem: true, round: r, subPhase: 'night' as SubPhase, content: this._nightHeader() }));
    // 预言家查验
    const nightAlive = this.players.filter((p) => !this.deadPlayerIds.has(p.id));
    for (const p of nightAlive) {
      if (p.role === 'prophet') {
        this._push(() => this._executeProphetCheck(p, nightAlive), 'night', p.id);
      }
    }
    // 狼人投票
    this._push(() => this._executeWerewolfKill(nightAlive), 'night');

    // 早晨
    this._push(() => this._executeMorning(r + 1), 'morning');

    // 检查胜利条件
    this._push(() => this._checkVictory(), 'victory');
  }

  private _push(fn: () => GameLog, subPhase?: SubPhase, playerId?: string) {
    this.stepQueue.push(fn);
    this.queueLabels.push({ subPhase: subPhase || 'init', playerId, label: '' });
  }

  private _nextTime(): string {
    return formatTime(this.base + this.logIdx++ * 1000);
  }

  private _roundTitle(r: number): string {
    return `🌙 === 第 ${r} 轮 ===`;
  }
  private _dayHeader(): string { return '💬 白天：所有人发言'; }
  private _voteHeader(): string { return '🗳️ 投票阶段'; }
  private _nightHeader(): string { return '🌙 夜晚降临...'; }

  // 执行一步
  step(): StepResult | null {
    if (this.winner || this.round > MAX_ROUNDS) return null;
    if (this.stepQueue.length === 0) {
      const alive = this.players.filter((p) => !this.deadPlayerIds.has(p.id));
      if (this.consecutiveSkip >= alive.length) {
        this._fillVoteQueue();
      } else {
        this._pushDayRoundActions(alive);
      }
      if (this.stepQueue.length === 0) return null;
    }

    const fn = this.stepQueue.shift()!;
    this.queueLabels.shift();
    const log = fn();

    // 如果这一步宣布胜利，winner 已设置
    if (this.winner && log.subPhase === 'victory') {
      return { log, playerResults: this._calcAllPlayerResults() };
    }

    // 检查是否该填充下一轮队列
    if (this.stepQueue.length === 0 && !this.winner) {
      if (log.subPhase === 'victory') {
        this.round++;
        this.dayRound = 1;
        this.consecutiveSkip = 0;
        this.todayActions.clear();
        this.voteTargets = {};
        this._fillRoundQueue();
      }
    }

    return { log, playerResults: this._calcAllPlayerResults() };
  }

  private _executeDayAction(self: Player, alive: Player[]): GameLog {
    const store2 = this._getVisibleStore(self.id);
    const inference = new InferenceEngine(store2, self.id);
    const relation = new RelationTracker(self.id, alive.map((p) => p.id));
    const engine = new IntentionEngine(inference, relation, self, alive);
    const intentionState = engine.generateDayAction();
    let selected = intentionState.selected;

    // 去重逻辑：如果今天已经执行过相同的 action+targetId，则改为 silence
    if (selected) {
      const today = this.todayActions.get(self.id) || [];
      const isDuplicate = today.some((a) => a.action === selected!.action && a.targetId === selected!.targetId);
      if (isDuplicate) {
        // 改为 silence
        selected = { action: 'silence', targetId: undefined, score: 0, reason: '重复行动，改为沉默', supportingMemories: [] };
        // 如果 silence 被性格禁用，改为 observe 随机目标
        const personality = PERSONALITIES[self.personality];
        if (personality && personality.disabledActions.includes('silence')) {
          const others = alive.filter((p) => p.id !== self.id);
          if (others.length > 0) {
            const target = others[randInt(0, others.length - 1)];
            selected = { action: 'observe', targetId: target.id, score: 0, reason: '重复行动，改为观察', supportingMemories: [] };
          }
        }
      }
    }

    // 记录今天行动
    if (selected) {
      if (!this.todayActions.has(self.id)) {
        this.todayActions.set(self.id, []);
      }
      this.todayActions.get(self.id)!.push({ action: selected.action, targetId: selected.targetId });
    }

    // 写入全局记忆（所有存活者可见），content 中加上 dayRound
    const baseContent = { dayRound: this.dayRound++ };
    if (selected) {
      switch (selected.action) {
        case 'suspect':
          this._broadcastMemory({ round: this.round, triggerAt: 'speech', eventType: 'hear_accuse', actorId: self.id, targetId: selected.targetId, content: baseContent, source: 'speech', credibility: CREDIBILITY.SPEECH });
          break;
        case 'defend':
          this._broadcastMemory({ round: this.round, triggerAt: 'speech', eventType: 'hear_defend', actorId: self.id, targetId: selected.targetId, content: baseContent, source: 'speech', credibility: CREDIBILITY.SPEECH });
          break;
        case 'observe':
          this._broadcastMemory({ round: this.round, triggerAt: 'day_start', eventType: 'observe_pattern', actorId: self.id, targetId: selected.targetId, content: { ...baseContent, inferredIntention: 'unknown', confidence: 0.5 }, source: 'observe', credibility: CREDIBILITY.OBSERVE });
          break;
        case 'claim_identity':
          this._broadcastMemory({ round: this.round, triggerAt: 'speech', eventType: 'hear_claim', actorId: self.id, targetId: selected.targetId, content: { ...baseContent, claimedRole: 'prophet' }, source: 'speech', credibility: CREDIBILITY.SPEECH });
          break;
        case 'chat':
          this._broadcastMemory({ round: this.round, triggerAt: 'speech', eventType: 'hear_chat', actorId: self.id, targetId: selected.targetId, content: baseContent, source: 'speech', credibility: CREDIBILITY.SPEECH });
          break;
        case 'silence':
          this._broadcastMemory({ round: this.round, triggerAt: 'speech', eventType: 'hear_silence', actorId: self.id, content: baseContent, source: 'speech', credibility: CREDIBILITY.SPEECH });
          break;
      }
    }

    // 更新连续计数器
    if (selected && (selected.action === 'silence' || selected.action === 'observe')) {
      this.consecutiveSkip++;
    } else {
      this.consecutiveSkip = 0;
    }

    // 生成日志
    const targetName = selected?.targetId ? this.players.find((p) => p.id === selected.targetId)?.name || selected.targetId : '';
    let content: string;
    if (!selected) {
      content = `[${self.name}] 没有行动`;
    } else {
      switch (selected.action) {
        case 'claim_identity': content = `📢 [${self.name}] 公布身份：「我是预言家」`; break;
        case 'suspect': content = `⚔️ [${self.name}] 号召投票给 ${targetName}：「大家今天投 ${targetName}！」`; break;
        case 'defend': content = `🛡️ [${self.name}] 为 ${targetName} 辩护：「${targetName} 不像狼人」`; break;
        case 'observe': content = `🔍 [${self.name}] 暗中观察 ${targetName}`; break;
        case 'silence': content = `🤫 [${self.name}] 保持沉默`; break;
        case 'chat': content = `💬 [${self.name}] 和 ${targetName} 闲聊`; break;
        default: content = `[${self.name}] ${selected.action}`;
      }
    }

    return { time: this._nextTime(), playerId: self.id, round: this.round, subPhase: 'day', content };
  }

  private _executeVote(self: Player, alive: Player[], voteTargets: Record<string, string>): GameLog {
    const inference = new InferenceEngine(this._getVisibleStore(self.id), self.id);
    const inferences = inference.inferAll(alive);
    let bestTarget: string | null = null;
    let bestProb = -1;
    for (const [pid, inf] of inferences.entries()) {
      if (pid !== self.id && inf.werewolfProb > bestProb) {
        bestProb = inf.werewolfProb;
        bestTarget = pid;
      }
    }
    if (!bestTarget) {
      const others = alive.filter((x) => x.id !== self.id);
      bestTarget = others.length > 0 ? others[randInt(0, others.length - 1)].id : null;
    }
    if (bestTarget) {
      voteTargets[self.id] = bestTarget;
      this.store.add({ round: this.round, triggerAt: 'vote', eventType: 'vote', actorId: self.id, targetId: bestTarget, content: {}, source: 'system', credibility: CREDIBILITY.SYSTEM });
      const targetName = this.players.find((x) => x.id === bestTarget)?.name || bestTarget;
      return { time: this._nextTime(), playerId: self.id, round: this.round, subPhase: 'vote', content: `🗳️ [${self.name}] 投票给 ${targetName}` };
    }
    return { time: this._nextTime(), playerId: self.id, round: this.round, subPhase: 'vote', content: `🗳️ [${self.name}] 弃权` };
  }

  private _executeVoteResult(voteTargets: Record<string, string>, round: number): GameLog {
    const counts: Record<string, number> = {};
    for (const target of Object.values(voteTargets)) {
      counts[target] = (counts[target] || 0) + 1;
    }
    const maxVotes = Math.max(0, ...Object.values(counts));
    const candidates = Object.entries(counts).filter(([_, v]) => v === maxVotes).map(([k]) => k);
    const voteTarget = candidates.length > 0 ? candidates[randInt(0, candidates.length - 1)] : undefined;

    if (voteTarget) {
      const victim = this.players.find((p) => p.id === voteTarget)!;
      this.deadPlayerIds.add(voteTarget);
      this.store.add({ round, triggerAt: 'vote_result', eventType: 'death', actorId: 'system', targetId: voteTarget, content: { cause: 'vote', votes: counts }, source: 'system', credibility: CREDIBILITY.SYSTEM });
      return { time: this._nextTime(), isSystem: true, round, subPhase: 'result', deathEvent: { playerId: voteTarget, cause: 'vote' }, content: `🗳️ ${victim.name} 得票最多（${maxVotes} 票），被放逐` };
    }
    return { time: this._nextTime(), isSystem: true, round, subPhase: 'result', content: '🗳️ 无人被放逐' };
  }

  private _executeProphetCheck(p: Player, alive: Player[]): GameLog {
    const others = alive.filter((x) => x.id !== p.id);
    if (others.length === 0) {
      return { time: this._nextTime(), playerId: p.id, round: this.round, subPhase: 'night', content: `🔮 [${p.name}] 没有查验目标` };
    }
    const store2 = this._getVisibleStore(p.id);
    const inference = new InferenceEngine(store2, p.id);
    const relation = new RelationTracker(p.id, alive.map((x) => x.id));
    for (const m of store2.getAll()) relation.onMemoryAdded(m);
    const engine = new IntentionEngine(inference, relation, p, alive);
    const intentionState = engine.generateNightAction();
    const selected = intentionState.selected;

    if (selected && selected.action === 'check' && selected.targetId) {
      const target = this.players.find((x) => x.id === selected.targetId);
      if (target) {
        this.store.add({ round: this.round, triggerAt: 'night_action', eventType: 'check_result', actorId: p.id, targetId: target.id, content: { result: target.role === 'werewolf' ? 'werewolf' : 'villager' }, source: 'self', credibility: CREDIBILITY.SELF, viewerId: p.id });
        const result = target.role === 'werewolf' ? '狼人' : '村民';
        return { time: this._nextTime(), playerId: p.id, round: this.round, subPhase: 'night', content: `🔮 [${p.name}] 查验 ${target.name}：${result}` };
      }
    }
    return { time: this._nextTime(), playerId: p.id, round: this.round, subPhase: 'night', content: `🔮 [${p.name}] 没有查验目标` };
  }

  private _executeWerewolfKill(alive: Player[]): GameLog {
    const aliveWolves = alive.filter((p) => p.role === 'werewolf');
    if (aliveWolves.length === 0) {
      return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'night', content: '🌙 狼人没有行动' };
    }
    const nonWolves = alive.filter((p) => p.role !== 'werewolf');
    if (nonWolves.length === 0) {
      return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'night', content: '🌙 狼人没有目标' };
    }
    const votes: Record<string, number> = {};
    for (const w of aliveWolves) {
      const store2 = this._getVisibleStore(w.id);
      const inference = new InferenceEngine(store2, w.id);
      const relation = new RelationTracker(w.id, alive.map((x) => x.id));
      for (const m of store2.getAll()) relation.onMemoryAdded(m);
      const engine = new IntentionEngine(inference, relation, w, alive);
      const intentionState = engine.generateNightAction();
      const selected = intentionState.selected;
      if (selected && selected.action === 'kill' && selected.targetId) {
        votes[selected.targetId] = (votes[selected.targetId] || 0) + 1;
      } else {
        const fallback = nonWolves[randInt(0, nonWolves.length - 1)];
        votes[fallback.id] = (votes[fallback.id] || 0) + 1;
      }
    }
    const maxW = Math.max(0, ...Object.values(votes));
    const candidates = Object.entries(votes).filter(([_, v]) => v === maxW).map(([k]) => k);
    const nightKill = candidates.length > 0 ? candidates[randInt(0, candidates.length - 1)] : undefined;
    if (nightKill) {
      this.store.add({ round: this.round, triggerAt: 'night_end', eventType: 'death', actorId: 'system', targetId: nightKill, content: { cause: 'werewolf' }, source: 'system', credibility: CREDIBILITY.SYSTEM });
      const victimName = this.players.find((x) => x.id === nightKill)?.name || nightKill;
      return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'night', content: `🐺 狼人袭击了 ${victimName}` };
    }
    return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'night', content: '🌙 狼人没有行动' };
  }

  private _executeMorning(round: number): GameLog {
    const nightKills = this.store.getAll().filter((m) => m.eventType === 'death' && m.content.cause === 'werewolf' && m.round === this.round - 1);
    if (nightKills.length > 0) {
      const lastKill = nightKills[nightKills.length - 1];
      const victim = this.players.find((p) => p.id === lastKill.targetId);
      // 早晨公布死亡时才真正标记死亡
      this.deadPlayerIds.add(lastKill.targetId!);
      this._broadcastMemory({ round, triggerAt: 'morning', eventType: 'morning', actorId: 'system', targetId: lastKill.targetId, content: { cause: 'werewolf' }, source: 'system', credibility: CREDIBILITY.SYSTEM });
      return { time: this._nextTime(), isSystem: true, round, subPhase: 'morning', deathEvent: { playerId: lastKill.targetId!, cause: 'werewolf' }, content: `☀️ 天亮了，${victim?.name || lastKill.targetId} 被狼人杀害了` };
    }
    this._broadcastMemory({ round, triggerAt: 'morning', eventType: 'peaceful_night', actorId: 'system', content: {}, source: 'system', credibility: CREDIBILITY.SYSTEM });
    return { time: this._nextTime(), isSystem: true, round, subPhase: 'morning', content: '☀️ 天亮了，昨晚是平安夜' };
  }

  private _checkVictory(): GameLog {
    const aW = this.players.filter((p) => p.team === 'werewolf' && !this.deadPlayerIds.has(p.id)).length;
    const aV = this.players.filter((p) => p.team !== 'werewolf' && !this.deadPlayerIds.has(p.id)).length;
    if (aW === 0 && aV > 0) {
      this.winner = 'villager';
    } else if (aW >= aV) {
      this.winner = 'werewolf';
    }
    if (this.winner) {
      return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'victory', content: `🏆 ${this.winner === 'werewolf' ? '狼人阵营' : '村民阵营'} 胜利！` };
    }
    return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'victory', content: '游戏继续' };
  }

  // 广播记忆：单条共享，所有存活角色可见（通过 _getVisibleStore 过滤）
  private _broadcastMemory(opts: Omit<Parameters<MemStore['add']>[0], 'viewerId'> & { viewerId?: never }) {
    this.store.add({ ...opts });
  }

  // 写入单条记忆
  private _writeMemory(opts: Parameters<MemStore['add']>[0]) {
    this.store.add(opts);
  }

  // 获取某个角色可见的记忆
  private _getVisibleStore(selfId: string): MemStore {
    const store2 = new MemStore();
    for (const m of this.store.getAll()) {
      if (m.isForgotten) continue;
      if (m.viewerId && m.viewerId !== selfId) continue;
      store2.import(m);
    }
    return store2;
  }

  // 计算所有存活角色的当前结果
  private _calcAllPlayerResults(): Map<string, PlayerResult> {
    const alive = this.players.filter((p) => !this.deadPlayerIds.has(p.id));
    const results = new Map<string, PlayerResult>();
    for (const self of alive) {
      const store2 = this._getVisibleStore(self.id);
      const inference = new InferenceEngine(store2, self.id);
      const selfCrisis = inference.inferSelfCrisis();
      const relations = new RelationTracker(self.id, alive.map((p) => p.id));
      for (const m of store2.getAll()) relations.onMemoryAdded(m);
      const inferences = inference.inferAll(alive);
      const visibleMemories = this.store.getAll().filter((m) => {
        if (m.isForgotten) return false;
        if (m.viewerId && m.viewerId !== self.id) return false;
        return true;
      });
      const forgottenMemories = this.store.getAll(true).filter((m) => {
        if (!m.isForgotten) return false;
        if (m.viewerId && m.viewerId !== self.id) return false;
        return true;
      });
      const intentionEngine = new IntentionEngine(inference, relations, self, alive);
      const intentionState = intentionEngine.generateDayAction();
      results.set(self.id, {
        intentionState,
        selfCrisis: { score: selfCrisis.score, factors: selfCrisis.factors as unknown as Record<string, number>, basis: selfCrisis.basis, trace: selfCrisis.trace },
        relations: relations.getAll(),
        inferences: new Map(Array.from(inferences.entries()).map(([k, v]) => [k, { werewolfProb: v.werewolfProb, villagerProb: v.villagerProb, basis: v.basis, trace: v.trace }])),
        memories: visibleMemories,
        forgottenMemories,
      });
    }
    return results;
  }
}

// 兼容旧 API：预生成模式（不再使用）
export function generateGameLogs(config: GameConfig): {
  logs: GameLog[];
  roundResults: never[];
  initialPlayers: Player[];
} {
  const engine = new GameEngine(config);
  const logs: GameLog[] = [];
  while (true) {
    const result = engine.step();
    if (!result) break;
    logs.push(result.log);
    if (engine.winner) break;
  }
  return { logs, roundResults: [], initialPlayers: engine.players };
}
