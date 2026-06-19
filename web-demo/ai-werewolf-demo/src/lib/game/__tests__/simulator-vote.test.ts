import { describe, it, expect } from 'vitest';
import { GameSimulator } from '../simulator-core';
import { generateGameConfig } from '../simulator-config';
import { resolveVotesRound1, resolveVotesRound2 } from '../simulator-vote';
import type { Player } from '@/types';

function makeSim(playerCount: number = 6): GameSimulator {
  const villagerCount = playerCount - 2; // 2 wolves
  const configs = generateGameConfig(
    playerCount,
    [{ role: 'werewolf', count: 1 }, { role: 'lone_wolf', count: 1 }],
    [{ role: 'villager', count: villagerCount - 1 }, { role: 'prophet', count: 1 }],
  );
  return new GameSimulator(configs);
}

function getAlivePlayers(sim: GameSimulator): Player[] {
  return sim.players.filter((p) => p.alive);
}

describe('投票解析 (resolveVotesRound)', () => {
  describe('单人淘汰', () => {
    it('最高票者被淘汰', () => {
      const sim = makeSim(6);
      const alive = getAlivePlayers(sim);
      // 选择两个目标
      const target1 = alive[0];
      const target2 = alive[1];

      // 模拟投票：target1 获 3 票，target2 获 1 票
      sim.votes = {
        [target1.id]: [alive[2].id, alive[3].id, alive[4].id],
        [target2.id]: [alive[5].id],
      };

      resolveVotesRound1(sim);

      expect(sim.voteResult).not.toBeNull();
      expect(sim.voteResult!.tie).toBe(false);
      expect(sim.voteResult!.eliminatedId).toBe(target1.id);
      expect(sim.voteResult!.maxVotes).toBe(3);
      expect(target1.alive).toBe(false);
    });

    it('得票最多者被淘汰后检查胜负', () => {
      const sim = makeSim(6);
      const alive = getAlivePlayers(sim);
      const target = alive[0];

      // 其余所有人投 target
      const voters = alive.filter((p) => p.id !== target.id);
      sim.votes = {
        [target.id]: voters.map((p) => p.id),
      };

      resolveVotesRound1(sim);

      expect(sim.voteResult!.eliminatedId).toBe(target.id);
      expect(target.alive).toBe(false);
    });
  });

  describe('平票处理', () => {
    it('平票时 nextRoundOnTie=true 触发第二轮', () => {
      const sim = makeSim(6);
      const alive = getAlivePlayers(sim);
      const target1 = alive[0];
      const target2 = alive[1];

      // 平票：各得 2 票
      sim.votes = {
        [target1.id]: [alive[2].id, alive[3].id],
        [target2.id]: [alive[4].id, alive[5].id],
      };

      resolveVotesRound1(sim); // nextRoundOnTie=true

      expect(sim.voteResult!.tie).toBe(true);
      expect(sim.voteResult!.nextRound).toBe(true);
      expect(sim.voteResult!.eliminatedId).toBeNull();
      // 两人都应存活
      expect(target1.alive).toBe(true);
      expect(target2.alive).toBe(true);
    });

    it('第二轮平票时 nextRoundOnTie=false 不触发再投', () => {
      const sim = makeSim(6);
      const alive = getAlivePlayers(sim);
      const target1 = alive[0];
      const target2 = alive[1];

      // 平票
      sim.votes = {
        [target1.id]: [alive[2].id, alive[3].id],
        [target2.id]: [alive[4].id, alive[5].id],
      };

      resolveVotesRound2(sim, [target1.id, target2.id]); // nextRoundOnTie=false

      expect(sim.voteResult!.tie).toBe(true);
      expect(sim.voteResult!.nextRound).toBe(false);
      expect(sim.voteResult!.eliminatedId).toBeNull();
    });
  });

  describe('空票处理', () => {
    it('无人投票时无人被淘汰', () => {
      const sim = makeSim(6);
      sim.votes = {};

      resolveVotesRound1(sim);

      expect(sim.voteResult).not.toBeNull();
      expect(sim.voteResult!.eliminatedId).toBeNull();
      expect(sim.voteResult!.maxVotes).toBe(0);
      expect(sim.voteResult!.topTargets).toEqual([]);
      expect(sim.voteResult!.tie).toBe(false);
    });

    it('仅有弃票时无人被淘汰', () => {
      const sim = makeSim(6);
      sim.votes = {};

      resolveVotesRound1(sim);

      const alive = getAlivePlayers(sim);
      expect(alive.every((p) => p.alive)).toBe(true);
    });
  });
});
