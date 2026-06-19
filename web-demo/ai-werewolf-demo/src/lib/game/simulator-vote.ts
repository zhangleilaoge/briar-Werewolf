import type { GameSimulator } from './simulator-core';
import type { Player } from '@/types';
import { REL_CHANGE_MINOR_NEG } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { log, getName, getPublicPlayerStates, updateRelation, logAction } from './simulator-utils';

export function skipToVote(sim: GameSimulator) {
  sim.forcePhaseEnd = true;
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

  if (decision?.target) {
    if (!sim.votes[decision.target]) sim.votes[decision.target] = [];
    sim.votes[decision.target].push(player.id);
    logAction(sim, 'action', `${player.name} 投票给 ${getName(sim, decision.target)}：${decision.reason}`, decision.reason || '', [], { actorId: player.id, action: ACTION.VOTE, targetId: decision.target, process: decision.process });
  } else {
    logAction(sim, 'action', `${player.name} 弃票`, decision?.reason || '', [], { actorId: player.id, action: 'vote_abstain', process: decision?.process });
  }
}

function resolveVotesRound(
  sim: GameSimulator,
  round: number,
  nextRoundOnTie: boolean,
  roundLabel: string,
) {
  const voteCounts = Object.entries(sim.votes).map(([targetId, voters]) => ({
    targetId,
    count: voters.length,
  }));

  if (voteCounts.length === 0) {
    log(sim, 'info', `${roundLabel}无人投票，无人被放逐。`);
    sim.voteResult = { round, votes: sim.votes, maxVotes: 0, topTargets: [], eliminatedId: null, tie: false, nextRound: false };
    return;
  }

  const maxVotes = Math.max(...voteCounts.map((v) => v.count));
  const topTargets = voteCounts.filter((v) => v.count === maxVotes).map((v) => v.targetId);

  if (topTargets.length === 1) {
    const targetId = topTargets[0];
    const target = sim.players.find((p) => p.id === targetId);
    if (target?.alive) {
      target.alive = false;
      log(sim, 'death', `${target.name} ${roundLabel}被投票放逐！得票 ${maxVotes} 票。身份：${target.role === 'werewolf' || target.role === 'lone_wolf' || target.role === 'berserker' ? '狼人' : '村民'}。`, { playerId: target.id, role: target.role });
      sim._checkWinCondition();
      // 结算被放逐者与投票者之间的关系
      const voters = sim.votes[targetId] || [];
      voters.forEach((voterId) => {
        const voter = sim.players.find((p) => p.id === voterId);
        if (voter?.alive) {
          updateRelation(sim, target, voter, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
        }
      });
      sim.players.forEach((p) => {
        const agent = sim._aiAgents[p.id];
        if (agent) agent.onEvent({ type: 'death', playerId: target.id });
      });
      sim.voteResult = { round, votes: sim.votes, maxVotes, topTargets, eliminatedId: targetId, tie: false, nextRound: false };
    }
  } else {
    log(sim, 'info', `${roundLabel}投票平票：${topTargets.map((id) => getName(sim, id)).join('、')} 各得 ${maxVotes} 票。${nextRoundOnTie ? '进行第二轮投票。' : '无人被放逐，直接进入下一夜。'}`);
    sim.voteResult = { round, votes: sim.votes, maxVotes, topTargets, eliminatedId: null, tie: true, nextRound: nextRoundOnTie };
  }
}

export function resolveVotesRound1(sim: GameSimulator) {
  resolveVotesRound(sim, 1, true, '第一轮');
}

export function resolveVotesRound2(sim: GameSimulator, _candidates: string[]) {
  resolveVotesRound(sim, 2, false, '第二轮');
}

export function generateVoteRound2(sim: GameSimulator, _candidates: string[]) {
  // New model: VotePhaseController handles round 2 internally
  sim.voteRound = 2;
  sim.votes = {};
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

  if (decision?.target && candidates.includes(decision.target)) {
    if (!sim.votes[decision.target]) sim.votes[decision.target] = [];
    sim.votes[decision.target].push(player.id);
    logAction(sim, 'action', `${player.name} 第二轮投票给 ${getName(sim, decision.target)}：${decision.reason}`, decision.reason || '', [], { actorId: player.id, action: ACTION.VOTE, targetId: decision.target, process: decision.process });
  } else {
    logAction(sim, 'action', `${player.name} 第二轮弃票`, decision?.reason || '', [], { actorId: player.id, action: 'vote_abstain', process: decision?.process });
  }
}


