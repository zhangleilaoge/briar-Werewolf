import { describe, it, expect } from 'vitest';
import { IntentionEngine } from './intention-engine';
import { MemStore } from '@/memory';
import { InferenceEngine } from '@/inference/inference-engine';
import { RelationTracker } from '@/relation';
import type { Player } from '@/types';

function makePlayer(id: string, team: 'werewolf' | 'villager', role: 'werewolf' | 'prophet' | 'villager' = team === 'werewolf' ? 'werewolf' : 'villager'): Player {
  return { id, name: id, role, team, alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } };
}

describe('IntentionEngine', () => {
  it('villager generates find_werewolf long-term intention', () => {
    const store = new MemStore();
    const players = [makePlayer('A', 'villager'), makePlayer('B', 'villager'), makePlayer('C', 'werewolf')];
    const inference = new InferenceEngine(store, 'A');
    const engine = new IntentionEngine(inference, new RelationTracker(players[0].id, players.map((p) => p.id)), players[0], players);
    const longTerm = engine.evaluateLongTermIntentions();
    const ids = longTerm.map((lt) => lt.id);
    expect(ids).toContain('survive');
    expect(ids).toContain('find_werewolf');
  });

  it('werewolf generates hide_identity long-term intention', () => {
    const store = new MemStore();
    const players = [makePlayer('A', 'werewolf'), makePlayer('B', 'villager'), makePlayer('C', 'villager')];
    const inference = new InferenceEngine(store, 'A');
    const engine = new IntentionEngine(inference, new RelationTracker(players[0].id, players.map((p) => p.id)), players[0], players);
    const longTerm = engine.evaluateLongTermIntentions();
    const ids = longTerm.map((lt) => lt.id);
    expect(ids).toContain('survive');
    expect(ids).toContain('hide_identity');
  });

  it('generateDayAction returns valid IntentionState', () => {
    const store = new MemStore();
    const players = [makePlayer('A', 'villager'), makePlayer('B', 'villager'), makePlayer('C', 'werewolf')];
    const inference = new InferenceEngine(store, 'A');
    const engine = new IntentionEngine(inference, new RelationTracker(players[0].id, players.map((p) => p.id)), players[0], players);
    const state = engine.generateDayAction();
    expect(state.longTerm.length).toBeGreaterThan(0);
    expect(state.shortTerm.length).toBeGreaterThan(0);
    expect(state.candidates.length).toBeGreaterThan(0);
    expect(state.selected).not.toBeNull();
  });

  it('short-term intentions have correct weight factors', () => {
    const store = new MemStore();
    const players = [makePlayer('A', 'villager'), makePlayer('B', 'villager'), makePlayer('C', 'werewolf')];
    const inference = new InferenceEngine(store, 'A');
    const engine = new IntentionEngine(inference, new RelationTracker(players[0].id, players.map((p) => p.id)), players[0], players);
    const longTerm = engine.evaluateLongTermIntentions();
    const shortTerm = engine.generateShortTermIntentions(longTerm);
    for (const st of shortTerm) {
      expect(st.weight).toBeGreaterThanOrEqual(0);
    }
  });

  it('weighted selectAction picks from candidates list', () => {
    const store = new MemStore();
    const players = [makePlayer('A', 'villager'), makePlayer('B', 'villager'), makePlayer('C', 'werewolf')];
    const inference = new InferenceEngine(store, 'A');
    const engine = new IntentionEngine(inference, new RelationTracker(players[0].id, players.map((p) => p.id)), players[0], players);
    const state = engine.generateDayAction();
    // selected should be one of the candidates (weighted random, not necessarily highest)
    expect(state.selected).not.toBeNull();
    const candidateKeys = state.candidates.map((c) => `${c.action}:${c.targetId ?? ''}`);
    const selectedKey = `${state.selected!.action}:${state.selected!.targetId ?? ''}`;
    expect(candidateKeys).toContain(selectedKey);
  });

  it('generateNightAction for prophet includes check candidates', () => {
    const store = new MemStore();
    const players = [makePlayer('A', 'villager', 'prophet'), makePlayer('B', 'villager'), makePlayer('C', 'werewolf')];
    const inference = new InferenceEngine(store, 'A');
    const engine = new IntentionEngine(inference, new RelationTracker(players[0].id, players.map((p) => p.id)), players[0], players);
    const state = engine.generateNightAction();
    const checkCandidates = state.candidates.filter((c) => c.action === 'check');
    expect(checkCandidates.length).toBeGreaterThan(0);
  });

  it('generateNightAction for werewolf includes kill candidates', () => {
    const store = new MemStore();
    const players = [makePlayer('A', 'werewolf', 'werewolf'), makePlayer('B', 'villager'), makePlayer('C', 'villager')];
    const inference = new InferenceEngine(store, 'A');
    const engine = new IntentionEngine(inference, new RelationTracker(players[0].id, players.map((p) => p.id)), players[0], players);
    const state = engine.generateNightAction();
    const killCandidates = state.candidates.filter((c) => c.action === 'kill');
    expect(killCandidates.length).toBeGreaterThan(0);
  });
});
