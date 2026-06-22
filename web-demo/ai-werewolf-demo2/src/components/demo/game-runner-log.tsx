import React from 'react';
import { MemStore } from '@/memory';
import { InferenceEngine } from '@/inference/inference-engine';
import { IntentionEngine } from '@/intention/intention-engine';
import { RelationTracker } from '@/relation';
import type { Player } from '@/types';
import { CREDIBILITY, MAX_ROUNDS } from '@/constants';
import { generatePlayers, randInt, formatTime } from './game-runner-utils';
import type { GameConfig, GameLog, RoundResult, PlayerResult } from './game-runner-types';

export function generateGameLogs(config: GameConfig): {
  logs: GameLog[];
  roundResults: RoundResult[];
  initialPlayers: Player[];
} {
  const players = generatePlayers(config);
  const store = new MemStore();
  const base = Date.now();
  let logIdx = 0;
  const nextTime = () => formatTime(base + logIdx++ * 1000);

  const logs: GameLog[] = [];
  const roundResults: RoundResult[] = [];

  // init memories
  for (const p of players) {
    store.add({ round: 0, triggerAt: 'init', eventType: 'self_role', actorId: p.id, content: { role: p.role }, source: 'self', credibility: CREDIBILITY.SELF });
  }
  const wolves = players.filter((p) => p.role === 'werewolf');
  for (const w of wolves) {
    for (const t of wolves) {
      if (t.id !== w.id)
        store.add({ round: 0, triggerAt: 'init', eventType: 'teammate_reveal', actorId: w.id, targetId: t.id, content: {}, source: 'system', credibility: CREDIBILITY.SYSTEM });
    }
  }

  let deadPlayerIds = new Set<string>();
  let round = 1;
  let winner: 'werewolf' | 'villager' | null = null;

  while (!winner && round <= MAX_ROUNDS) {
    const alive = players.filter((p) => !deadPlayerIds.has(p.id));

    logs.push({ time: nextTime(), isSystem: true, round, subPhase: 'init', content: <span className="text-amber-400 font-bold">🌙 === 第 {round} 轮 ===</span> });

    // ---- DAY ----
    logs.push({ time: nextTime(), isSystem: true, round, subPhase: 'day', content: <span className="text-slate-400">💬 白天：所有人发言</span> });

    const playerResults = new Map<string, PlayerResult>();
    for (const self of alive) {
      const store2 = new MemStore();
      for (const m of store.getAll()) store2.add(m);
      const inference = new InferenceEngine(store2, self.id);
      const selfCrisis = inference.inferSelfCrisis();
      const relations = new RelationTracker(self.id, alive.map((p) => p.id));
      for (const m of store2.getAll()) relations.onMemoryAdded(m);
      const inferences = inference.inferAll(alive);
      const engine = new IntentionEngine(store2, inference, self, alive);
      const intentionState = engine.generateDayAction();

      const visibleMemories = store2.getAll().filter((m) => {
        if (m.actorId === self.id) return true;
        if (m.targetId === self.id) return true;
        if (m.source === 'system' && m.eventType !== 'teammate_reveal') return true;
        return false;
      });

      playerResults.set(self.id, {
        intentionState,
        selfCrisis: { score: selfCrisis.score, factors: selfCrisis.factors as Record<string, number>, basis: selfCrisis.basis },
        relations: relations.getAll(),
        inferences: new Map(Array.from(inferences.entries()).map(([k, v]) => [k, { werewolfProb: v.werewolfProb, villagerProb: v.villagerProb, basis: v.basis }])),
        memories: visibleMemories,
      });

      const selected = intentionState.selected;
      const time = nextTime();
      let content: React.ReactNode;
      if (!selected) {
        content = <span><span className="text-amber-400 font-bold">{self.name}</span> 没有行动</span>;
      } else {
        const targetName = selected.targetId ? players.find((p) => p.id === selected.targetId)?.name || selected.targetId : '';
        switch (selected.action) {
          case 'claim_identity':
            content = <span><span className="text-amber-400 font-bold">{self.name}</span> 公布身份：<span className="text-yellow-300">「我是预言家」</span></span>;
            break;
          case 'suspect':
            content = <span><span className="text-amber-400 font-bold">{self.name}</span> 号召投票给 <span className="text-yellow-300">{targetName}</span>：<span className="text-yellow-300">「大家今天投 {targetName}！」</span></span>;
            break;
          case 'defend':
            content = <span><span className="text-amber-400 font-bold">{self.name}</span> 为 <span className="text-yellow-300">{targetName}</span> 辩护：<span className="text-yellow-300">「{targetName} 不像狼人」</span></span>;
            break;
          case 'observe':
            content = <span><span className="text-amber-400 font-bold">{self.name}</span> 暗中观察 <span className="text-yellow-300">{targetName}</span></span>;
            break;
          case 'silence':
            content = <span><span className="text-amber-400 font-bold">{self.name}</span> 保持沉默</span>;
            break;
          case 'chat':
            content = <span><span className="text-amber-400 font-bold">{self.name}</span> 和 <span className="text-yellow-300">{targetName}</span> 闲聊</span>;
            break;
          default:
            content = <span><span className="text-amber-400 font-bold">{self.name}</span> {selected.action}</span>;
        }
      }
      logs.push({ time, playerId: self.id, round, subPhase: 'day', content });

      if (selected?.targetId) {
        store.add({ round, triggerAt: 'speech', eventType: 'hear_accuse', actorId: self.id, targetId: selected.targetId, content: {}, source: 'speech', credibility: CREDIBILITY.SPEECH });
      }
    }

    // ---- VOTE ----
    roundResults.push({ round, playerResults });
    logs.push({ time: nextTime(), isSystem: true, round, subPhase: 'vote', content: <span className="text-slate-400">🗳️ 投票阶段</span> });
    const voteCounts: Record<string, number> = {};
    for (const p of alive) {
      const inference = new InferenceEngine(store, p.id);
      const inferences = inference.inferAll(alive);
      let bestTarget: string | null = null;
      let bestProb = -1;
      for (const [pid, inf] of inferences.entries()) {
        if (pid !== p.id && inf.werewolfProb > bestProb) {
          bestProb = inf.werewolfProb;
          bestTarget = pid;
        }
      }
      if (!bestTarget) {
        const others = alive.filter((x) => x.id !== p.id);
        bestTarget = others.length > 0 ? others[randInt(0, others.length - 1)].id : null;
      }
      if (bestTarget) {
        voteCounts[bestTarget] = (voteCounts[bestTarget] || 0) + 1;
        store.add({ round, triggerAt: 'vote', eventType: 'vote', actorId: p.id, targetId: bestTarget, content: {}, source: 'system', credibility: CREDIBILITY.SYSTEM });
      }
    }
    const maxVotes = Math.max(0, ...Object.values(voteCounts));
    const voteCandidates = Object.entries(voteCounts)
      .filter(([_, v]) => v === maxVotes)
      .map(([k]) => k);
    const voteTarget = voteCandidates.length > 0 ? voteCandidates[randInt(0, voteCandidates.length - 1)] : undefined;

    if (voteTarget) {
      const victim = players.find((p) => p.id === voteTarget)!;
      deadPlayerIds.add(voteTarget);
      store.add({ round, triggerAt: 'vote_result', eventType: 'death', actorId: 'system', targetId: voteTarget, content: { cause: 'vote', votes: voteCounts }, source: 'system', credibility: CREDIBILITY.SYSTEM });
      logs.push({ time: nextTime(), isSystem: true, round, subPhase: 'result', deathEvent: { playerId: voteTarget, cause: 'vote' }, content: <span className="text-red-400">🗳️ {victim.name} 得票最多（{maxVotes} 票），被放逐</span> });
    } else {
      logs.push({ time: nextTime(), isSystem: true, round, subPhase: 'result', content: <span className="text-slate-400">🗳️ 无人被放逐</span> });
    }

    // Check win after vote
    const aW = players.filter((p) => p.team === 'werewolf' && !deadPlayerIds.has(p.id)).length;
    const aV = players.filter((p) => p.team !== 'werewolf' && !deadPlayerIds.has(p.id)).length;
    if (aW === 0) { winner = 'villager'; break; }
    if (aW >= aV) { winner = 'werewolf'; break; }

    // ---- NIGHT ----
    logs.push({ time: nextTime(), isSystem: true, round, subPhase: 'night', content: <span className="text-slate-400">🌙 夜晚降临...</span> });

    // Prophet checks
    const nightAlive = players.filter((p) => !deadPlayerIds.has(p.id));
    const prophets = nightAlive.filter((p) => p.role === 'prophet');
    for (const p of prophets) {
      const others = nightAlive.filter((x) => x.id !== p.id);
      if (others.length > 0) {
        const target = others[randInt(0, others.length - 1)];
        store.add({ round, triggerAt: 'night_action', eventType: 'check_result', actorId: p.id, targetId: target.id, content: { result: target.role === 'werewolf' ? 'werewolf' : 'villager' }, source: 'self', credibility: CREDIBILITY.SELF });
      }
    }

    // Werewolf kill
    const aliveWolves = nightAlive.filter((p) => p.role === 'werewolf');
    let nightKill: string | undefined;
    if (aliveWolves.length > 0) {
      const nonWolves = nightAlive.filter((p) => p.role !== 'werewolf');
      if (nonWolves.length > 0) {
        const votes: Record<string, number> = {};
        for (const w of aliveWolves) {
          const target = nonWolves[randInt(0, nonWolves.length - 1)];
          votes[target.id] = (votes[target.id] || 0) + 1;
        }
        const maxW = Math.max(...Object.values(votes));
        const candidates = Object.entries(votes)
          .filter(([_, v]) => v === maxW)
          .map(([k]) => k);
        nightKill = candidates[randInt(0, candidates.length - 1)];
        deadPlayerIds.add(nightKill);
        store.add({ round, triggerAt: 'night_end', eventType: 'death', actorId: 'system', targetId: nightKill, content: { cause: 'werewolf' }, source: 'system', credibility: CREDIBILITY.SYSTEM });
      }
    }

    // Morning death announcement
    if (nightKill) {
      const victim = players.find((p) => p.id === nightKill)!;
      logs.push({ time: nextTime(), isSystem: true, round: round + 1, subPhase: 'morning', deathEvent: { playerId: nightKill, cause: 'werewolf' }, content: <span className="text-red-400">☀️ 天亮了，{victim.name} 被狼人杀害了</span> });
    } else {
      logs.push({ time: nextTime(), isSystem: true, round: round + 1, subPhase: 'morning', content: <span className="text-slate-400">☀️ 天亮了，昨晚是平安夜</span> });
    }

    // Check win after night
    const aW2 = players.filter((p) => p.team === 'werewolf' && !deadPlayerIds.has(p.id)).length;
    const aV2 = players.filter((p) => p.team !== 'werewolf' && !deadPlayerIds.has(p.id)).length;
    if (aW2 === 0) { winner = 'villager'; break; }
    if (aW2 >= aV2) { winner = 'werewolf'; break; }

    round++;
  }

  if (winner) {
    logs.push({ time: nextTime(), isSystem: true, round, subPhase: 'victory', content: <span className="text-amber-400 font-bold text-lg">🏆 {winner === 'werewolf' ? '狼人阵营' : '村民阵营'} 胜利！</span> });
  }

  return { logs, roundResults, initialPlayers: players };
}
