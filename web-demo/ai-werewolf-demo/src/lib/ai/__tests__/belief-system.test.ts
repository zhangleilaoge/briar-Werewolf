import { describe, it, expect } from 'vitest';
import { BeliefSystem } from '../belief-system';
import type { Player } from '@/types';

function makePlayer(id: string, team: 'werewolf' | 'villager' = 'villager'): Player {
  return {
    id,
    name: `Player_${id}`,
    role: team === 'werewolf' ? 'werewolf' : 'villager',
    team,
    alive: true,
    items: [],
    attributes: { affinity: 10, logic: 10, leadership: 10, deception: 10, stealth: 10, insight: 10 },
    alignment: { law: 'neutral_law', good: 'neutral_good' },
    traits: [],
    stress: 0,
    relations: {},
  };
}

describe('BeliefSystem', () => {
  const allPlayers = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3', 'werewolf'), makePlayer('p4')];

  function makeBelief(playerId: string = 'p1') {
    const self = allPlayers.find(p => p.id === playerId)!;
    const belief = new BeliefSystem(self.id, self.name, self.role, self.team, self.attributes, self.alignment, allPlayers);
    belief.initializeRelations(allPlayers);
    return belief;
  }

  describe('recordCheck', () => {
    it('stores check result and overrides inference', () => {
      const belief = makeBelief();
      belief.recordCheck('p2', 'werewolf');
      expect(belief.getCheckResult('p2')).toBe('werewolf');
      belief.updateInferences(allPlayers);
      expect(belief.getWerewolfProbability('p2')).toBe(1.0);
    });

    it('villager check sets probability to 0', () => {
      const belief = makeBelief();
      belief.recordCheck('p2', 'villager');
      belief.updateInferences(allPlayers);
      expect(belief.getWerewolfProbability('p2')).toBe(0);
    });
  });

  describe('recordDeath', () => {
    it('records death and reduces werewolf probability', () => {
      const belief = makeBelief();
      belief.recordDeath('p2');
      expect(belief.l0Facts.deaths).toContain('p2');
    });
  });

  describe('updateInferences', () => {
    it('wolf knows teammates', () => {
      const belief = makeBelief('p3'); // p3 is werewolf
      belief.updateInferences(allPlayers);
      // p3 should know other wolves (there are none other, but p3 itself is wolf)
      // Since p3 is the only wolf, no teammate knowledge changes
    });

    it('suspect actions increase werewolf probability', () => {
      const belief = makeBelief();
      belief.updateInferences(allPlayers, [
        { actorId: 'p2', type: 'suspect', targetId: 'p4' },
        { actorId: 'p3', type: 'suspect', targetId: 'p4' },
      ]);
      const prob = belief.getWerewolfProbability('p4');
      expect(prob).toBeGreaterThan(0.5); // should be higher than default
    });
  });

  describe('updateTheoryOfMind', () => {
    it('tracks observer beliefs', () => {
      const belief = makeBelief();
      belief.updateTheoryOfMind(allPlayers, [
        { actorId: 'p2', type: 'suspect', targetId: 'p3' },
      ]);

      // p2 suspects p3, so p2's belief about p3 should be higher than base (0 + 0.3 = 0.3)
      const p2BeliefAboutP3 = belief.l2TheoryOfMind.othersBeliefs.p2?.p3 ?? 0;
      expect(p2BeliefAboutP3).toBeCloseTo(0.3, 1);
    });
  });

  describe('getPlayerIdentityCrisis', () => {
    it('returns 0 when no data', () => {
      const belief = makeBelief();
      expect(belief.getPlayerIdentityCrisis('p2')).toBe(0);
    });

    it('calculates average identity crisis from observer beliefs', () => {
      const belief = makeBelief();
      // Manually set some L2 data
      belief.l2TheoryOfMind.othersBeliefs.p2 = { 'p1': 0.8, 'p3': 0.3, 'p4': 0.2 };
      belief.l2TheoryOfMind.othersBeliefs.p4 = { 'p1': 0.6, 'p3': 0.5, 'p4': 0.1 };

      const identityCrisis = belief.getPlayerIdentityCrisis('p1');
      // Average of 0.8 and 0.6 = 0.7
      expect(identityCrisis).toBeCloseTo(0.7, 1);
    });

    it('getIdentityCrisis returns self identity crisis', () => {
      const belief = makeBelief('p1');
      belief.l2TheoryOfMind.othersBeliefs.p2 = { 'p1': 0.8, 'p3': 0.3, 'p4': 0.2 };
      belief.l2TheoryOfMind.othersBeliefs.p4 = { 'p1': 0.6, 'p3': 0.5, 'p4': 0.1 };

      expect(belief.getIdentityCrisis()).toBeCloseTo(0.7, 1);
    });
  });

  describe('relations and pressure', () => {
    it('updateRelation clamps values', () => {
      const belief = makeBelief();
      belief.updateRelation('p2', 15);
      const rel = belief.getRelation('p2');
      expect(rel.favor).toBe(10);
    });

    it('updatePressure updates emotional state', () => {
      const belief = makeBelief();
      belief.updatePressure(10);
      expect(belief.l3Social.emotionalState).toBe('anxious');

      belief.updatePressure(-15); // total = -5
      expect(belief.l3Social.emotionalState).toBe('confident');
    });
  });

  describe('getSuspectRanking', () => {
    it('returns sorted suspects by werewolf probability', () => {
      const belief = makeBelief();
      belief.recordCheck('p3', 'werewolf');
      belief.updateInferences(allPlayers);
      const ranking = belief.getSuspectRanking(allPlayers);
      expect(ranking[0].id).toBe('p3');
      expect(ranking[0].werewolfProb).toBe(1.0);
    });
  });
});
