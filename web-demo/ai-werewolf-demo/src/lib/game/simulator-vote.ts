import type { GameSimulator } from './simulator-core';
import type { Player } from '../ai/types';
import { REL_CHANGE_MINOR_NEG } from '../ai/constants';
import { log, getName, getPublicPlayerStates, updateRelation } from './simulator-utils';

export function skipToVote(sim: GameSimulator) {
  const remainingTypes = new Set(['check_win']);
  sim.stepQueue = sim.stepQueue.filter((s, idx) => idx <= sim.currentStep || remainingTypes.has(s.type));
}

export function runVote(sim: GameSimulator, player: Player) {
  if (!player.alive) return;
  const agent = sim._aiAgents[player.id];
  if (!agent) return;

  const decision = agent.vote(
    getPublicPlayerStates(sim),
    sim.publicActions,
    sim.voteRound
  );

  if (decision && decision.target) {
    if (!sim.votes[decision.target]) sim.votes[decision.target] = [];
    sim.votes[decision.target].push(player.id);
    log(sim, 'action', `${player.name} 投票给 ${getName(sim, decision.target)}：${decision.reason}`, { actorId: player.id, action: 'vote', targetId: decision.target });
  } else {
    log(sim, 'action', `${player.name} 弃票`);
  }
}

export function resolveVotesRound1(sim: GameSimulator) {
  const voteCounts = Object.entries(sim.votes).map(([targetId, voters]) => ({
    targetId,
    count: voters.length,
  }));

  if (voteCounts.length === 0) {
    log(sim, 'info', '无人投票，无人被放逐。');
    sim.voteResult = { round: 1, votes: sim.votes, maxVotes: 0, topTargets: [], eliminatedId: null, tie: false, nextRound: false };
    return;
  }

  const maxVotes = Math.max(...voteCounts.map((v) => v.count));
  const topTargets = voteCounts.filter((v) => v.count === maxVotes).map((v) => v.targetId);

  if (topTargets.length === 1) {
    const targetId = topTargets[0];
    const target = sim.players.find((p) => p.id === targetId);
    if (target && target.alive) {
      target.alive = false;
      log(sim, 'death', `${target.name} 被投票放逐！得票 ${maxVotes} 票。身份：${target.role === 'werewolf' || target.role === 'lone_wolf' || target.role === 'berserker' ? '狼人' : '村民'}。`, { playerId: target.id, role: target.role });
      // 结算被放逐者与投票者之间的关系
      const voters = sim.votes[targetId] || [];
      voters.forEach((voterId) => {
        const voter = sim.players.find((p) => p.id === voterId);
        if (voter && voter.alive) {
          updateRelation(sim, target, voter, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
        }
      });
      sim.players.forEach((p) => {
        const agent = sim._aiAgents[p.id];
        if (agent) agent.onEvent({ type: 'death', playerId: target.id });
      });
      sim.voteResult = { round: 1, votes: sim.votes, maxVotes, topTargets, eliminatedId: targetId, tie: false, nextRound: false };
    }
  } else {
    log(sim, 'info', `第一轮投票平票：${topTargets.map((id) => getName(sim, id)).join('、')} 各得 ${maxVotes} 票。进行第二轮投票。`);
    generateVoteRound2(sim, topTargets);
  }
}

export function generateVoteRound2(sim: GameSimulator, candidates: string[]) {
  sim.voteRound = 2;
  sim.votes = {};

  const aliveVoters = sim.players.filter((p) => p.alive);
  aliveVoters.forEach((p) => {
    sim.stepQueue.push({
      type: 'vote_action',
      actorId: p.id,
      fn: () => runVoteRound2(sim, p, candidates),
    });
  });

  sim.stepQueue.push({
    type: 'vote_resolve',
    fn: () => resolveVotesRound2(sim, candidates),
  });
}

export function runVoteRound2(sim: GameSimulator, player: Player, candidates: string[]) {
  if (!player.alive) return;
  const agent = sim._aiAgents[player.id];
  if (!agent) return;

  const decision = agent.voteRound2(
    getPublicPlayerStates(sim),
    sim.publicActions,
    candidates
  );

  if (decision && decision.target && candidates.includes(decision.target)) {
    if (!sim.votes[decision.target]) sim.votes[decision.target] = [];
    sim.votes[decision.target].push(player.id);
    log(sim, 'action', `${player.name} 第二轮投票给 ${getName(sim, decision.target)}：${decision.reason}`, { actorId: player.id, action: 'vote', targetId: decision.target });
  } else {
    log(sim, 'action', `${player.name} 第二轮弃票`);
  }
}

export function resolveVotesRound2(sim: GameSimulator, candidates: string[]) {
  const voteCounts = Object.entries(sim.votes).map(([targetId, voters]) => ({
    targetId,
    count: voters.length,
  }));

  if (voteCounts.length === 0) {
    log(sim, 'info', '第二轮无人投票，无人被放逐。');
    sim.voteResult = { round: 2, votes: sim.votes, maxVotes: 0, topTargets: [], eliminatedId: null, tie: false, nextRound: false };
    return;
  }

  const maxVotes = Math.max(...voteCounts.map((v) => v.count));
  const topTargets = voteCounts.filter((v) => v.count === maxVotes).map((v) => v.targetId);

  if (topTargets.length === 1) {
    const targetId = topTargets[0];
    const target = sim.players.find((p) => p.id === targetId);
    if (target && target.alive) {
      target.alive = false;
      log(sim, 'death', `${target.name} 在第二轮投票中被放逐！得票 ${maxVotes} 票。身份：${target.role === 'werewolf' || target.role === 'lone_wolf' || target.role === 'berserker' ? '狼人' : '村民'}。`, { playerId: target.id, role: target.role });
      const voters = sim.votes[targetId] || [];
      voters.forEach((voterId) => {
        const voter = sim.players.find((p) => p.id === voterId);
        if (voter && voter.alive) {
          updateRelation(sim, target, voter, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
        }
      });
      sim.players.forEach((p) => {
        const agent = sim._aiAgents[p.id];
        if (agent) agent.onEvent({ type: 'death', playerId: target.id });
      });
      sim.voteResult = { round: 2, votes: sim.votes, maxVotes, topTargets, eliminatedId: targetId, tie: false, nextRound: false };
    }
  } else {
    log(sim, 'info', `第二轮仍平票：${topTargets.map((id) => getName(sim, id)).join('、')} 各得 ${maxVotes} 票。无人被放逐，直接进入下一夜。`);
    sim.voteResult = { round: 2, votes: sim.votes, maxVotes, topTargets, eliminatedId: null, tie: true, nextRound: false };
  }
}
