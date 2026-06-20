import { describe, it, expect, vi } from 'vitest';
import { PlayerStateBus } from '../player-state-bus';
import type { Player } from '@/types';

function makePlayer(id: string, alive = true): Player {
  return {
    id,
    name: `Player ${id}`,
    role: 'villager',
    team: 'villager',
    alive,
    items: [],
    attributes: { affinity: 10, logic: 10, leadership: 10, deception: 10, stealth: 10, insight: 10 },
    alignment: { law: 'neutral_law', good: 'neutral_good' },
    traits: [],
    stress: 0,
    relations: {},
  };
}

describe('PlayerStateBus', () => {
  describe('basic operations', () => {
    it('setPlayers and getPlayers', () => {
      const bus = new PlayerStateBus();
      const players = [makePlayer('p1'), makePlayer('p2')];
      bus.setPlayers(players);
      expect(bus.getPlayers()).toHaveLength(2);
      expect(bus.getPlayers()[0].id).toBe('p1');
    });

    it('getPlayer returns correct player', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2')]);
      expect(bus.getPlayer('p1')?.name).toBe('Player p1');
      expect(bus.getPlayer('nonexistent')).toBeUndefined();
    });

    it('getAliveCount excludes dead players', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2', false), makePlayer('p3')]);
      expect(bus.getAliveCount()).toBe(2);
    });

    it('getAlivePlayerIds returns only alive ids', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2', false), makePlayer('p3')]);
      expect(bus.getAlivePlayerIds()).toEqual(['p1', 'p3']);
    });
  });

  describe('killPlayer', () => {
    it('sets player alive to false', () => {
      const bus = new PlayerStateBus();
      const p1 = makePlayer('p1');
      bus.setPlayers([p1]);
      const result = bus.killPlayer('p1', 'test');
      expect(result).toBe(true);
      expect(p1.alive).toBe(false);
    });

    it('returns false for already dead player', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1', false)]);
      expect(bus.killPlayer('p1')).toBe(false);
    });

    it('emits player_killed event', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1')]);
      const listener = vi.fn();
      bus.onEvent(listener);
      bus.killPlayer('p1', 'test');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        playerId: 'p1',
        type: 'player_killed',
        before: true,
        after: false,
        source: 'test',
      }));
    });

    it('notifies all agents on kill', () => {
      const bus = new PlayerStateBus();
      const p1 = makePlayer('p1');
      bus.setPlayers([p1]);

      const mockCallback1 = vi.fn();
      const mockCallback2 = vi.fn();
      bus.onDeath(mockCallback1);
      bus.onDeath(mockCallback2);

      bus.killPlayer('p1', 'test');

      expect(mockCallback1).toHaveBeenCalledWith('p1');
      expect(mockCallback2).toHaveBeenCalledWith('p1');
    });
  });

  describe('changeStress', () => {
    it('changes stress by delta', () => {
      const bus = new PlayerStateBus();
      const p1 = makePlayer('p1');
      bus.setPlayers([p1]);
      bus.changeStress('p1', 5, 'test');
      expect(p1.stress).toBe(5);
    });

    it('clamps stress to valid range', () => {
      const bus = new PlayerStateBus();
      const p1 = makePlayer('p1');
      bus.setPlayers([p1]);
      bus.changeStress('p1', 100, 'test');
      expect(p1.stress).toBe(10);
      bus.changeStress('p1', -200, 'test');
      expect(p1.stress).toBe(-10);
    });

    it('emits stress_changed event', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1')]);
      const listener = vi.fn();
      bus.onEvent(listener);
      bus.changeStress('p1', 3, 'test');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'stress_changed',
        before: 0,
        after: 3,
      }));
    });

    it('does not emit event when stress unchanged', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1')]);
      const listener = vi.fn();
      bus.onEvent(listener);
      bus.changeStress('p1', 0, 'test');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('changeRelation', () => {
    it('updates favor via favorDelta', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2')]);
      bus.changeRelation('p1', 'p2', { favorDelta: 5 }, 'test');
      expect(bus.getPlayer('p1')!.relations.p2.favor).toBe(5);
    });

    it('computes favor from trust+friendly', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2')]);
      bus.changeRelation('p1', 'p2', { trustDelta: 6, friendlyDelta: 4 }, 'test');
      const rel = bus.getPlayer('p1')!.relations.p2;
      expect(rel.trust).toBe(6);
      expect(rel.friendly).toBe(4);
      expect(rel.favor).toBe(5); // (6+4)/2
    });

    it('emits relation_changed event', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2')]);
      const listener = vi.fn();
      bus.onEvent(listener);
      bus.changeRelation('p1', 'p2', { favorDelta: 3 }, 'test');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'relation_changed',
        playerId: 'p1',
      }));
    });
  });

  describe('event log', () => {
    it('records events in order', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1')]);
      bus.changeStress('p1', 1, 'a');
      bus.changeStress('p1', 2, 'b');
      const log = bus.getEventLog();
      expect(log).toHaveLength(2);
      expect(log[0].source).toBe('a');
      expect(log[1].source).toBe('b');
    });

    it('getEventsForPlayer filters correctly', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2')]);
      bus.changeStress('p1', 1, 'a');
      bus.changeStress('p2', 1, 'b');
      expect(bus.getEventsForPlayer('p1')).toHaveLength(1);
      expect(bus.getEventsForPlayer('p2')).toHaveLength(1);
    });

    it('clearEventLog empties the log', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1')]);
      bus.changeStress('p1', 1);
      bus.clearEventLog();
      expect(bus.getEventLog()).toHaveLength(0);
    });
  });

  describe('getPublicPlayerStates', () => {
    it('returns deep copies', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1')]);
      const copies = bus.getPublicPlayerStates();
      copies[0].stress = 999;
      expect(bus.getPlayer('p1')!.stress).toBe(0);
    });

    it('deep copies nested objects', () => {
      const bus = new PlayerStateBus();
      bus.setPlayers([makePlayer('p1'), makePlayer('p2')]);
      bus.changeRelation('p1', 'p2', { favorDelta: 5 });
      const copies = bus.getPublicPlayerStates();
      copies[0].relations.p2.favor = 999;
      expect(bus.getPlayer('p1')!.relations.p2.favor).toBe(5);
    });
  });
});
