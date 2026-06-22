import { describe, it, expect } from 'vitest';
import { MemStore } from './mem-store';

describe('MemStore', () => {
  it('add and get', () => {
    const store = new MemStore();
    const mem = store.add({ round: 1, triggerAt: 'init', eventType: 'self_role', actorId: 'A', content: { role: 'werewolf' }, source: 'system' });
    expect(store.get(mem.id)).toBeDefined();
    expect(store.size).toBe(1);
  });

  it('getAll sorts by round then createdAt', () => {
    const store = new MemStore();
    store.add({ round: 2, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'A', content: {}, source: 'speech' });
    store.add({ round: 1, triggerAt: 'init', eventType: 'self_role', actorId: 'B', content: {}, source: 'system' });
    const all = store.getAll();
    expect(all[0].round).toBe(1);
    expect(all[1].round).toBe(2);
  });

  it('aboutPlayer returns memories where player is actor or target', () => {
    const store = new MemStore();
    store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'A', targetId: 'B', content: {}, source: 'speech' });
    store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'C', targetId: 'D', content: {}, source: 'speech' });
    const result = store.aboutPlayer('A');
    expect(result.length).toBe(1);
    expect(result[0].actorId).toBe('A');
  });

  it('hardInfo returns only credibility >= 1.0', () => {
    const store = new MemStore();
    store.add({ round: 1, triggerAt: 'init', eventType: 'self_role', actorId: 'A', content: {}, source: 'system', credibility: 1.0 });
    store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'B', targetId: 'A', content: {}, source: 'speech', credibility: 0.4 });
    expect(store.hardInfo().length).toBe(1);
  });

  it('applyForgetting marks low-importance old memories', () => {
    const store = new MemStore();
    // speech memories have importance 0.3, easy to forget
    store.add({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'A', targetId: 'B', content: {}, source: 'speech' });
    const { forgotten, retained } = store.applyForgetting(20);
    expect(forgotten.length + retained.length).toBe(1);
    // After 19 rounds, speech memory (importance 0.3) should be forgotten
    expect(forgotten.length).toBe(1);
  });

  it('clear resets store', () => {
    const store = new MemStore();
    store.add({ round: 1, triggerAt: 'init', eventType: 'self_role', actorId: 'A', content: {}, source: 'system' });
    store.clear();
    expect(store.size).toBe(0);
  });
});
