import { describe, it, expect } from 'vitest';
import { GameSimulator } from '../simulator-core';
import { generateGameConfig } from '../simulator-config';

describe('GameSimulator', () => {
  function makeSim(playerCount: number = 6) {
    const villagerCount = playerCount - 2; // 2 wolves
    const configs = generateGameConfig(
      playerCount,
      [{ role: 'werewolf', count: 1 }, { role: 'lone_wolf', count: 1 }],
      [{ role: 'villager', count: villagerCount - 1 }, { role: 'prophet', count: 1 }]
    );
    return new GameSimulator(configs);
  }

  describe('initialization', () => {
    it('creates correct number of players', () => {
      const sim = makeSim(6);
      expect(sim.players.length).toBe(6);
    });

    it('initializes all players as alive', () => {
      const sim = makeSim();
      expect(sim.players.every(p => p.alive)).toBe(true);
    });

    it('initializes relations between all players', () => {
      const sim = makeSim();
      sim.players.forEach(p => {
        sim.players.forEach(other => {
          if (p.id !== other.id) {
            expect(p.relations[other.id]).toBeDefined();
            expect(p.relations[other.id].favor).toBe(0);
          }
        });
      });
    });

    it('starts with no winner', () => {
      const sim = makeSim();
      expect(sim.winner).toBeNull();
    });
  });

  describe('tick engine', () => {
    it('tick() returns true when game is active', () => {
      const sim = makeSim();
      sim.generateRoundSteps();
      expect(sim.tick()).toBe(true);
    });

    it('tick() returns false when winner exists', () => {
      const sim = makeSim();
      sim.winner = 'villager';
      expect(sim.tick()).toBe(false);
    });

    it('error in tick does not crash - caught by try-catch', () => {
      const sim = makeSim();
      sim.generateRoundSteps();
      // The tick should not throw even with edge cases
      expect(() => sim.tick()).not.toThrow();
    });
  });

  describe('win conditions', () => {
    it('villagers win when all wolves are dead', () => {
      const sim = makeSim();
      sim.players.filter(p => p.team === 'werewolf').forEach(p => p.alive = false);
      sim._checkWinCondition();
      expect(sim.winner).toBe('villager');
    });

    it('werewolves win when wolves >= villagers', () => {
      const sim = makeSim();
      const villagers = sim.players.filter(p => p.team !== 'werewolf');
      // Kill all but 1 villager
      villagers.slice(1).forEach(p => p.alive = false);
      sim._checkWinCondition();
      expect(sim.winner).toBe('werewolf');
    });

    it('no winner when game is balanced', () => {
      const sim = makeSim();
      sim._checkWinCondition();
      expect(sim.winner).toBeNull();
    });
  });

  describe('actors', () => {
    it('all actors start idle', () => {
      const sim = makeSim();
      sim.actors.forEach(actor => {
        expect(actor.state).toBe('idle');
      });
    });

    it('areAllActorsIdle returns true initially', () => {
      const sim = makeSim();
      expect(sim.areAllActorsIdle()).toBe(true);
    });
  });

  describe('getPlayers / getAliveCount', () => {
    it('getPlayers returns all players', () => {
      const sim = makeSim(6);
      expect(sim.getPlayers().length).toBe(6);
    });

    it('getAliveCount returns correct count', () => {
      const sim = makeSim(6);
      expect(sim.getAliveCount()).toBe(6);
      sim.players[0].alive = false;
      expect(sim.getAliveCount()).toBe(5);
    });

    it('getAlivePlayerIds excludes dead', () => {
      const sim = makeSim(6);
      sim.players[0].alive = false;
      const aliveIds = sim.getAlivePlayerIds();
      expect(aliveIds.length).toBe(5);
      expect(aliveIds).not.toContain(sim.players[0].id);
    });
  });
});
