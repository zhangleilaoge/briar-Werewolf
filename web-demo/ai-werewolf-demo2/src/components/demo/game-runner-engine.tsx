import React from 'react';
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
  roundCycle: number; // 白天轮次（判断本轮是否结束）
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
    this.roundCycle = 1;
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

  private _roundTitle(r: number): React.ReactNode {
    return <span className="text-amber-400 font-bold">🌙 === 第 {r} 轮 ===</span>;
  }
  private _dayHeader(): React.ReactNode { return <span className="text-slate-400">💬 白天：所有人发言</span>; }
  private _voteHeader(): React.ReactNode { return <span className="text-slate-400">🗳️ 投票阶段</span>; }
  private _nightHeader(): React.ReactNode { return <span className="text-slate-400">🌙 夜晚降临...</span>; }

  // 执行一步
  step(): StepResult | null {
    if (this.winner || this.round > MAX_ROUNDS) return null;
    if (this.stepQueue.length === 0) {
      this._fillVoteQueue();
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
        this.roundCycle = 1;
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
    const engine = new IntentionEngine(store2, inference, self, alive);
    const intentionState = engine.generateDayAction();
    let selected = intentionState.selected;

    // 去重逻辑：如果今天已经执行过相同的 action+targetId，则改为 silence
    if (selected) {
      const today = this.todayActions.get(self.id) || [];
      const isDuplicate = today.some((a) => a.action === selected!.action && a.targetId === selected!.targetId);
      if (isDuplicate) {
        // 改为 silence
        selected = { action: 'silence', targetId: undefined, score: 0, reason: '重复行动，改为沉默' };
        // 如果 silence 被性格禁用，改为 observe 随机目标
        const personality = PERSONALITIES[self.personality];
        if (personality && personality.disabledActions.includes('silence')) {
          const others = alive.filter((p) => p.id !== self.id);
          if (others.length > 0) {
            const target = others[randInt(0, others.length - 1)];
            selected = { action: 'observe', targetId: target.id, score: 0, reason: '重复行动，改为观察' };
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

    // 检查是否所有存活玩家都已完成当前 roundCycle 的行动
    const allDone = alive.every((p) => {
      const actions = this.todayActions.get(p.id) || [];
      return actions.length >= this.roundCycle;
    });

    if (allDone) {
      this._checkDayRoundEnd(alive);
    }

    // 生成日志
    const targetName = selected?.targetId ? this.players.find((p) => p.id === selected.targetId)?.name || selected.targetId : '';
    let content: React.ReactNode;
    if (!selected) {
      content = <span><span className="text-amber-400 font-bold">{self.name}</span> 没有行动</span>;
    } else {
      switch (selected.action) {
        case 'claim_identity': content = <span>📢 <span className="text-amber-400 font-bold">{self.name}</span> 公布身份：<span className="text-yellow-300">「我是预言家」</span></span>; break;
        case 'suspect': content = <span>⚔️ <span className="text-amber-400 font-bold">{self.name}</span> 号召投票给 <span className="text-yellow-300">{targetName}</span>：<span className="text-yellow-300">「大家今天投 {targetName}！」</span></span>; break;
        case 'defend': content = <span>🛡️ <span className="text-amber-400 font-bold">{self.name}</span> 为 <span className="text-yellow-300">{targetName}</span> 辩护：<span className="text-yellow-300">「{targetName} 不像狼人」</span></span>; break;
        case 'observe': content = <span>🔍 <span className="text-amber-400 font-bold">{self.name}</span> 暗中观察 <span className="text-yellow-300">{targetName}</span></span>; break;
        case 'silence': content = <span>🤫 <span className="text-amber-400 font-bold">{self.name}</span> 保持沉默</span>; break;
        case 'chat': content = <span>💬 <span className="text-amber-400 font-bold">{self.name}</span> 和 <span className="text-yellow-300">{targetName}</span> 闲聊</span>; break;
        default: content = <span><span className="text-amber-400 font-bold">{self.name}</span> {selected.action}</span>;
      }
    }

    return { time: this._nextTime(), playerId: self.id, round: this.round, subPhase: 'day', content };
  }

  private _checkDayRoundEnd(alive: Player[]) {
    const currentDayActions = alive.map((p) => {
      const actions = this.todayActions.get(p.id) || [];
      return actions[this.roundCycle - 1];
    });

    const allSkip = currentDayActions.every((a) => a && (a.action === 'observe' || a.action === 'silence'));

    if (allSkip) {
      this._fillVoteQueue();
    } else {
      this.roundCycle++;
      this._pushDayRoundActions(alive);
    }
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
      return { time: this._nextTime(), playerId: self.id, round: this.round, subPhase: 'vote', content: <span>🗳️ <span className="text-amber-400 font-bold">{self.name}</span> 投票给 <span className="text-yellow-300">{targetName}</span></span> };
    }
    return { time: this._nextTime(), playerId: self.id, round: this.round, subPhase: 'vote', content: <span>🗳️ <span className="text-amber-400 font-bold">{self.name}</span> 弃权</span> };
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
      return { time: this._nextTime(), isSystem: true, round, subPhase: 'result', deathEvent: { playerId: voteTarget, cause: 'vote' }, content: <span className="text-red-400">🗳️ {victim.name} 得票最多（{maxVotes} 票），被放逐</span> };
    }
    return { time: this._nextTime(), isSystem: true, round, subPhase: 'result', content: <span className="text-slate-400">🗳️ 无人被放逐</span> };
  }

  private _executeProphetCheck(p: Player, alive: Player[]): GameLog {
    const others = alive.filter((x) => x.id !== p.id);
    if (others.length === 0) {
      return { time: this._nextTime(), playerId: p.id, round: this.round, subPhase: 'night', content: <span>🔮 <span className="text-amber-400 font-bold">{p.name}</span> 没有查验目标</span> };
    }
    const target = others[randInt(0, others.length - 1)];
    this.store.add({ round: this.round, triggerAt: 'night_action', eventType: 'check_result', actorId: p.id, targetId: target.id, content: { result: target.role === 'werewolf' ? 'werewolf' : 'villager' }, source: 'self', credibility: CREDIBILITY.SELF, viewerId: p.id });
    const result = target.role === 'werewolf' ? '狼人' : '村民';
    return { time: this._nextTime(), playerId: p.id, round: this.round, subPhase: 'night', content: <span>🔮 <span className="text-amber-400 font-bold">{p.name}</span> 查验 <span className="text-yellow-300">{target.name}</span>：{result}</span> };
  }

  private _executeWerewolfKill(alive: Player[]): GameLog {
    const aliveWolves = alive.filter((p) => p.role === 'werewolf');
    if (aliveWolves.length === 0) {
      return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'night', content: <span className="text-slate-400">🌙 狼人没有行动</span> };
    }
    const nonWolves = alive.filter((p) => p.role !== 'werewolf');
    if (nonWolves.length === 0) {
      return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'night', content: <span className="text-slate-400">🌙 狼人没有目标</span> };
    }
    const votes: Record<string, number> = {};
    for (const w of aliveWolves) {
      const target = nonWolves[randInt(0, nonWolves.length - 1)];
      votes[target.id] = (votes[target.id] || 0) + 1;
    }
    const maxW = Math.max(...Object.values(votes));
    const candidates = Object.entries(votes).filter(([_, v]) => v === maxW).map(([k]) => k);
    const nightKill = candidates[randInt(0, candidates.length - 1)];
    // 狼人投票只记录到 store，不在此标记死亡（死亡在早晨公布时才生效）
    this.store.add({ round: this.round, triggerAt: 'night_end', eventType: 'death', actorId: 'system', targetId: nightKill, content: { cause: 'werewolf' }, source: 'system', credibility: CREDIBILITY.SYSTEM });
    const victimName = this.players.find((x) => x.id === nightKill)?.name || nightKill;
    return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'night', content: <span>🐺 <span className="text-red-400">狼人袭击了 {victimName}</span></span> };
  }

  private _executeMorning(round: number): GameLog {
    const nightKills = this.store.getAll().filter((m) => m.eventType === 'death' && m.content.cause === 'werewolf' && m.round === this.round - 1);
    if (nightKills.length > 0) {
      const lastKill = nightKills[nightKills.length - 1];
      const victim = this.players.find((p) => p.id === lastKill.targetId);
      // 早晨公布死亡时才真正标记死亡
      this.deadPlayerIds.add(lastKill.targetId!);
      this._broadcastMemory({ round, triggerAt: 'morning', eventType: 'morning', actorId: 'system', targetId: lastKill.targetId, content: { cause: 'werewolf' }, source: 'system', credibility: CREDIBILITY.SYSTEM });
      return { time: this._nextTime(), isSystem: true, round, subPhase: 'morning', deathEvent: { playerId: lastKill.targetId!, cause: 'werewolf' }, content: <span className="text-red-400">☀️ 天亮了，{victim?.name || lastKill.targetId} 被狼人杀害了</span> };
    }
    this._broadcastMemory({ round, triggerAt: 'morning', eventType: 'peaceful_night', actorId: 'system', content: {}, source: 'system', credibility: CREDIBILITY.SYSTEM });
    return { time: this._nextTime(), isSystem: true, round, subPhase: 'morning', content: <span className="text-slate-400">☀️ 天亮了，昨晚是平安夜</span> };
  }

  private _checkVictory(): GameLog {
    const aW = this.players.filter((p) => p.team === 'werewolf' && !this.deadPlayerIds.has(p.id)).length;
    const aV = this.players.filter((p) => p.team !== 'werewolf' && !this.deadPlayerIds.has(p.id)).length;
    if (aW === 0) {
      this.winner = 'villager';
    } else if (aW >= aV) {
      this.winner = 'werewolf';
    }
    if (this.winner) {
      return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'victory', content: <span className="text-amber-400 font-bold text-lg">🏆 {this.winner === 'werewolf' ? '狼人阵营' : '村民阵营'} 胜利！</span> };
    }
    return { time: this._nextTime(), isSystem: true, round: this.round, subPhase: 'victory', content: <span className="text-slate-400">游戏继续</span> };
  }

  // 广播记忆：所有存活角色收到
  private _broadcastMemory(opts: Omit<Parameters<MemStore['add']>[0], 'viewerId'> & { viewerId?: never }) {
    const alive = this.players.filter((p) => !this.deadPlayerIds.has(p.id));
    for (const p of alive) {
      this.store.add({ ...opts, viewerId: p.id });
    }
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
      store2.add(m);
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
      const store2Engine = this._getVisibleStore(self.id);
      const inferenceEngine = new InferenceEngine(store2Engine, self.id);
      const intentionEngine = new IntentionEngine(store2Engine, inferenceEngine, self, alive);
      const intentionState = intentionEngine.generateDayAction();
      results.set(self.id, {
        intentionState,
        selfCrisis: { score: selfCrisis.score, factors: selfCrisis.factors as Record<string, number>, basis: selfCrisis.basis },
        relations: relations.getAll(),
        inferences: new Map(Array.from(inferences.entries()).map(([k, v]) => [k, { werewolfProb: v.werewolfProb, villagerProb: v.villagerProb, basis: v.basis }])),
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
