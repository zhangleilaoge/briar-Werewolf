import { describe, it, expect } from 'vitest';
import { InferenceEngine } from './inference-engine';
import { MemStore } from '@/memory';
import { CREDIBILITY, BELIEF_DEFAULT } from '@/constants';
import type { Player } from '@/types';

function makePlayers(): Player[] {
  return [
    { id: 'A', name: 'A', role: 'werewolf', team: 'werewolf', alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } },
    { id: 'B', name: 'B', role: 'villager', team: 'villager', alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } },
    { id: 'C', name: 'C', role: 'prophet', team: 'villager', alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } },
  ];
}

describe('InferenceEngine', () => {
  it('inferAll returns default probability with no evidence', () => {
    const store = new MemStore();
    const engine = new InferenceEngine(store, 'A');
    const players = makePlayers();
    const result = engine.inferAll(players);
    const bInfer = result.get('B')!;
    expect(bInfer.werewolfProb).toBe(BELIEF_DEFAULT.WEREWOLF_PROB);
    expect(bInfer.villagerProb).toBe(BELIEF_DEFAULT.VILLAGER_PROB);
  });

  it('hard info check_result overrides to 100%', () => {
    const store = new MemStore();
    store.add({ round: 1, triggerAt: 'night_action', eventType: 'check_result', actorId: 'C', targetId: 'B', content: { result: 'werewolf' }, source: 'self', credibility: CREDIBILITY.SELF });
    const engine = new InferenceEngine(store, 'C');
    const result = engine.inferAll(makePlayers());
    const bInfer = result.get('B')!;
    expect(bInfer.werewolfProb).toBe(1.0);
    expect(bInfer.villagerProb).toBe(0);
  });

  it('inferSelfCrisis returns 0 with no attacks', () => {
    const store = new MemStore();
    const engine = new InferenceEngine(store, 'A');
    const crisis = engine.inferSelfCrisis();
    expect(crisis.score).toBe(0);
  });

  it('inferSelfCrisis increases with accusations', () => {
    const store = new MemStore();
    store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'A', content: {}, source: 'speech' });
    const engine = new InferenceEngine(store, 'A');
    const crisis = engine.inferSelfCrisis();
    expect(crisis.score).toBeGreaterThan(0);
  });

  it('inferFieldCrisis identifies mostAtRisk', () => {
    const store = new MemStore();
    // A gets attacked twice
    store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'A', content: {}, source: 'speech' });
    store.add({ round: 1, triggerAt: 'vote', eventType: 'vote', actorId: 'C', targetId: 'A', content: {}, source: 'system' });
    const engine = new InferenceEngine(store, 'A');
    const field = engine.inferFieldCrisis(makePlayers());
    expect(field.mostAtRisk.playerId).toBe('A');
  });
});
