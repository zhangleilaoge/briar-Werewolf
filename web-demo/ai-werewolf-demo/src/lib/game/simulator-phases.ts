import type { GameSimulator, PublicActionRecord, GameEvent, PlayerActor } from './simulator-core';
import type { Phase, Player, GameLogItem } from '../ai/types';
import { log, getName, updateRelation, logAction, buildCheckLog, getPublicPlayerStates } from './simulator-utils';
import { runDayAction, runAppendixAction } from './simulator-day';
import { runNightAction, resolveNightActions } from './simulator-night';
import { resolveMorningEvents } from './simulator-morning';
import { runVote, runVoteRound2, resolveVotesRound1, resolveVotesRound2 } from './simulator-vote';

// ---------- Log Priority (for rendering order) ----------

export const LOG_PRIORITY: Record<string, number> = {
  phase: 0,
  death: 1,
  vote_result: 2,
  action: 3,
  check: 4,
  relation: 5,
  item: 6,
  info: 7,
  system: 8,
};

// ---------- PhaseController Interface ----------

export abstract class PhaseController {
  abstract readonly name: Phase;
  abstract readonly tickRate: number; // ms per tick

  abstract onEnter(sim: GameSimulator): void;
  abstract onTick(sim: GameSimulator): boolean; // return true to continue phase, false to end
  abstract onExit(sim: GameSimulator): void;
}

// ---------- TickPhase Base Class ----------

export abstract class TickPhase extends PhaseController {
  onTick(sim: GameSimulator): boolean {
    if (sim.forcePhaseEnd) {
      sim.forcePhaseEnd = false;
      return false;
    }
    this.advanceThinkers(sim);
    this.executeActors(sim);
    this.flushEventBus(sim);
    return this.checkEnd(sim);
  }

  protected advanceThinkers(sim: GameSimulator): void {
    sim.eventBus.flush(sim);
    sim.actors.forEach((actor) => {
      if (actor.state === 'thinking') {
        actor.thinkCountdown--;
        console.log(`[消息中心] 💭 ${actor.id} thinking countdown=${actor.thinkCountdown}, event=${actor.pendingEvent?.type}`);
        if (actor.thinkCountdown <= 0) {
          actor.state = 'acting';
          console.log(`[消息中心] 💭 ${actor.id} 思考完成 → 准备行动 (事件: ${actor.pendingEvent?.type})`);
        }
      }
    });
  }

  protected executeActors(sim: GameSimulator): void {
    const acting = Array.from(sim.actors.values()).filter((a) => a.state === 'acting');
    if (acting.length > 0) {
      console.log(`[消息中心] ▶️ 本 tick 执行 ${acting.length} 个 Actor: [${acting.map((a) => `${a.id}(${a.pendingEvent?.type})`).join(', ')}]`);
    }
    for (const actor of acting) {
      const event = actor.pendingEvent;
      if (event) {
        console.log(`[消息中心] ▶️ 执行 ${actor.id} 的 ${event.type}`);
        this.handleEvent(sim, actor, event);
      } else {
        console.log(`[消息中心] ⚠️ ${actor.id} 在 acting 状态但没有 pendingEvent`);
      }
      actor.state = 'idle';
      actor.pendingEvent = null;
    }
  }

  protected flushEventBus(sim: GameSimulator): void {
    sim.eventBus.flush(sim);
  }

  onExit(sim: GameSimulator): void {
    sim.actors.forEach((a) => {
      a.state = 'idle';
      a.thinkCountdown = 0;
      a.pendingEvent = null;
    });
    sim.eventBus.flush(sim);
  }

  abstract handleEvent(sim: GameSimulator, actor: PlayerActor, event: GameEvent): void;
  abstract checkEnd(sim: GameSimulator): boolean;
}

// ---------- Day Phase ----------

export class DayPhaseController extends TickPhase {
  readonly name = 'day' as const;
  readonly tickRate = 2000;

  private hasActed = new Set<string>();
  private silenceCount = 0;
  private aliveOrder: string[] = [];
  private nextIndex = 0;

  onTick(sim: GameSimulator): boolean {
    if (sim.forcePhaseEnd) {
      sim.forcePhaseEnd = false;
      return false;
    }
    this.advanceThinkers(sim);
    this.executeActors(sim);
    this.flushEventBus(sim);
    this._notifyNextSpeaker(sim);
    return this.checkEnd(sim);
  }

  onEnter(sim: GameSimulator) {
    this.hasActed.clear();
    this.silenceCount = 0;
    this.aliveOrder = sim.getAlivePlayerIds();
    this.nextIndex = 0;

    log(sim, 'phase', '-- 白天阶段 --');
    console.log('[消息中心] 🌅 进入白天阶段');
    this._notifyNextSpeaker(sim);
  }

  handleEvent(sim: GameSimulator, actor: PlayerActor, event: GameEvent): void {
    switch (event.type) {
      case 'day_turn': {
        this._executeDayTurn(sim, actor.id);
        break;
      }
      case 'appendix_reaction': {
        this._executeAppendixReaction(sim, actor.id, event);
        break;
      }
      default: {
        console.log(`[消息中心] ⚠️ 未处理的事件类型: ${event.type} for ${actor.id}`);
      }
    }
  }

  checkEnd(sim: GameSimulator): boolean {
    const allActed = this.aliveOrder.every((id) => this.hasActed.has(id));
    console.log(`[消息中心] 📊 白天进度: ${this.hasActed.size}/${this.aliveOrder.length} 已行动, silenceCount=${this.silenceCount}/${sim.getAliveCount()}`);
    if (allActed || this.silenceCount >= sim.getAliveCount()) {
      console.log(`[消息中心] 🌅 白天阶段结束 (allActed=${allActed}, silenceCount=${this.silenceCount})`);
      return false;
    }
    return true;
  }

  private _notifyNextSpeaker(sim: GameSimulator) {
    while (this.nextIndex < this.aliveOrder.length) {
      const pid = this.aliveOrder[this.nextIndex];
      const player = sim.players.find((p) => p.id === pid);
      const actor = sim.actors.get(pid);
      console.log(
        `[消息中心] 📢 _notifyNextSpeaker 尝试 ${pid} (hasActed=${this.hasActed.has(pid)}, alive=${player?.alive}, state=${actor?.state})`
      );
      if (!this.hasActed.has(pid) && player?.alive) {
        if (actor?.state === 'idle') {
          sim.notifyPlayer(pid, { type: 'day_turn', source: 'system', payload: {} });
          this.nextIndex++;
          console.log(`[消息中心] 🔔 通知 ${pid} 进行白天行动`);
          return;
        } else {
          console.log(`[消息中心] ⚠️ 跳过 ${pid}，状态=${actor?.state}，不是 idle，稍后重试`);
          break;
        }
      } else {
        console.log(`[消息中心] ⏭️ 跳过 ${pid}，已行动或已死亡`);
        this.nextIndex++;
      }
    }
    console.log(`[消息中心] 📢 _notifyNextSpeaker 没有更多可通知的发言者`);
  }

  private _executeDayTurn(sim: GameSimulator, playerId: string) {
    console.log(`[消息中心] 📢 _executeDayTurn: ${playerId}`);
    const player = sim.players.find((p) => p.id === playerId);
    if (!player || !player.alive) {
      this.hasActed.add(playerId);
      console.log(`[消息中心] ${playerId} 已死亡，跳过行动`);
      return;
    }

    const prevSilence = sim.consecutiveSilenceCount;
    runDayAction(sim, playerId);
    this.hasActed.add(playerId);

    if (sim.consecutiveSilenceCount > prevSilence) {
      this.silenceCount++;
    } else {
      this.silenceCount = 0;
    }

    console.log(`[消息中心] 📢 _executeDayTurn: ${playerId} 执行完毕，hasActed=${this.hasActed.size}/${this.aliveOrder.length}`);
  }

  private _executeAppendixReaction(sim: GameSimulator, playerId: string, event: GameEvent) {
    console.log(`[消息中心] 📢 _executeAppendixReaction: ${playerId}`);
    const triggerAction = event.payload.triggerAction as PublicActionRecord;
    if (!triggerAction) {
      console.log(`[消息中心] ⚠️ _executeAppendixReaction: ${playerId} 没有 triggerAction`);
      return;
    }

    const player = sim.players.find((p) => p.id === playerId);
    if (!player || !player.alive || playerId === triggerAction.actorId) {
      console.log(`[消息中心] ⏭️ _executeAppendixReaction: ${playerId} 跳过 (alive=${player?.alive}, isTrigger=${playerId === triggerAction.actorId})`);
      return;
    }

    console.log(`[消息中心] 💬 ${playerId} 执行追加反应 (trigger: ${triggerAction.actorId} ${triggerAction.type})`);

    runAppendixAction(sim, playerId, triggerAction);

    sim.consecutiveSilenceCount = 0;
    this.silenceCount = 0;
  }
}

// ---------- Night Phase ----------

export class NightPhaseController extends TickPhase {
  readonly name = 'night' as const;
  readonly tickRate = 2000;

  private completedGroups = new Set<string>();
  private groups: { name: string; filter: (p: Player) => boolean }[] = [
    { name: 'werewolf', filter: (p) => p.team === 'werewolf' && p.alive },
    { name: 'prophet', filter: (p) => p.role === 'prophet' && p.alive },
    { name: 'thief', filter: (p) => p.role === 'thief' && p.alive },
    { name: 'coroner', filter: (p) => p.role === 'coroner' && p.alive },
  ];
  private currentGroupIndex = 0;

  onEnter(sim: GameSimulator) {
    this.completedGroups.clear();
    this.currentGroupIndex = 0;
    sim.nightDecisions = [];
    sim.nightDeaths = [];
    log(sim, 'phase', '-- 夜晚阶段 --');
    console.log('[消息中心] 🌙 进入夜晚阶段');
    this._notifyCurrentGroup(sim);
  }

  handleEvent(sim: GameSimulator, actor: PlayerActor, event: GameEvent): void {
    if (event.type === 'night_action') {
      const player = sim.players.find((p) => p.id === actor.id);
      if (player) runNightAction(sim, player);
    }
  }

  checkEnd(sim: GameSimulator): boolean {
    const currentGroup = this.groups[this.currentGroupIndex];
    if (currentGroup) {
      const groupPlayers = sim.players.filter(currentGroup.filter);
      const allActed = groupPlayers.every((p) => {
        const actor = sim.actors.get(p.id);
        return actor?.state === 'idle' && !actor.pendingEvent;
      });
      if (allActed) {
        console.log(`[消息中心] ✅ ${currentGroup.name} 组完成`);
        this.completedGroups.add(currentGroup.name);
        this.currentGroupIndex++;
        this._notifyCurrentGroup(sim);
      }
    }

    const allGroupsDone = this.groups.every((g) => {
      const groupPlayers = sim.players.filter(g.filter);
      return groupPlayers.length === 0 || this.completedGroups.has(g.name);
    });

    if (allGroupsDone) {
      resolveNightActions(sim);
      console.log('[消息中心] 🌙 夜晚阶段结束，开始结算');
      return false;
    }

    return true;
  }

  private _notifyCurrentGroup(sim: GameSimulator) {
    while (this.currentGroupIndex < this.groups.length) {
      const group = this.groups[this.currentGroupIndex];
      const players = sim.players.filter(group.filter);
      if (players.length > 0) {
        players.forEach((p) => {
          sim.notifyPlayer(p.id, { type: 'night_action', source: 'system', payload: {} });
          console.log(`[消息中心] 🔔 通知 ${p.id} (${group.name}) 夜间行动`);
        });
        return;
      }
      console.log(`[消息中心] ⏭️ ${group.name} 组为空，跳过`);
      this.completedGroups.add(group.name);
      this.currentGroupIndex++;
    }
  }
}

// ---------- Vote Phase ----------

export class VotePhaseController extends TickPhase {
  readonly name = 'vote' as const;
  readonly tickRate = 2000;

  private voted = new Set<string>();
  private aliveVoters: string[] = [];
  private round2Candidates: string[] | null = null;

  onEnter(sim: GameSimulator) {
    this.voted.clear();
    sim.votes = {};
    sim.voteRound = 1;
    sim.voteResult = null;
    this.round2Candidates = null;
    this.aliveVoters = sim.getAlivePlayerIds();

    log(sim, 'phase', '-- 投票阶段 --');
    console.log('[消息中心] 🗳️ 进入投票阶段，通知所有存活玩家');
    this.aliveVoters.forEach((pid) => {
      sim.notifyPlayer(pid, { type: 'vote', source: 'system', payload: { round: 1 } });
      console.log(`[消息中心] 🔔 通知 ${pid} 投票 (Round 1)`);
    });
  }

  handleEvent(sim: GameSimulator, actor: PlayerActor, event: GameEvent): void {
    if (event.type === 'vote') {
      const player = sim.players.find((p) => p.id === actor.id);
      if (player) {
        if (this.round2Candidates) {
          runVoteRound2(sim, player, this.round2Candidates);
        } else {
          runVote(sim, player);
        }
      }
      this.voted.add(actor.id);
      console.log(`[消息中心] ✅ ${actor.id} 完成投票`);
    }
  }

  checkEnd(sim: GameSimulator): boolean {
    const allVoted = this.aliveVoters.every((id) => this.voted.has(id));
    console.log(`[消息中心] 📊 投票进度: ${this.voted.size}/${this.aliveVoters.length} 已投票`);
    if (!allVoted) return true;

    if (this.round2Candidates) {
      resolveVotesRound2(sim, this.round2Candidates);
      console.log('[消息中心] 🗳️ 投票阶段结束 (Round 2)');
      return false;
    } else {
      resolveVotesRound1(sim);
      if (sim.voteResult && (sim.voteResult as any).nextRound) {
        this.round2Candidates = (sim.voteResult as any).topTargets || [];
        this.voted.clear();
        sim.votes = {};
        sim.voteRound = 2;
        this.aliveVoters = sim.getAlivePlayerIds();
        console.log('[消息中心] 🗳️ 第一轮平票，进入第二轮投票');
        this.aliveVoters.forEach((pid) => {
          sim.notifyPlayer(pid, { type: 'vote', source: 'system', payload: { round: 2, candidates: this.round2Candidates } });
          console.log(`[消息中心] 🔔 通知 ${pid} 第二轮投票`);
        });
        return true;
      }
      console.log('[消息中心] 🗳️ 投票阶段结束 (Round 1)');
      return false;
    }
  }
}

// ---------- Morning Phase ----------

export class MorningPhaseController extends PhaseController {
  readonly name = 'morning' as const;
  readonly tickRate = 2000;
  private done = false;

  onEnter(sim: GameSimulator) {
    this.done = false;
    log(sim, 'phase', '-- 早晨事件 --');
    console.log('[消息中心] 🌄 进入早晨阶段');
  }

  onTick(sim: GameSimulator): boolean {
    if (!this.done) {
      resolveMorningEvents(sim);
      this.done = true;
      console.log('[消息中心] 🌄 早晨事件结算完成');
    }
    return false;
  }

  onExit(sim: GameSimulator) {}
}

// ---------- Check Win Phase ----------

export class CheckWinPhaseController extends PhaseController {
  readonly name = 'init' as const;
  readonly tickRate = 2000;
  private done = false;

  onEnter(sim: GameSimulator) {
    this.done = false;
    console.log('[消息中心] 🏆 进入胜利检查阶段');
  }

  onTick(sim: GameSimulator): boolean {
    if (!this.done) {
      sim._checkWinCondition();
      this.done = true;
      console.log(`[消息中心] 🏆 胜利检查完成: ${sim.winner ?? '继续'}`);
    }
    return false;
  }

  onExit(sim: GameSimulator) {}
}
