import { describe, it, expect } from 'vitest';
import { RelationTracker } from './relation';
import { FRIENDLY_DELTA, FRIENDLY_RANGE } from '@/constants';
import type { MemoryEntry } from '@/types';

function makeMem(eventType: string, actorId: string, targetId: string): MemoryEntry {
  return {
    id: `mem_${Math.random()}`,
    round: 1,
    triggerAt: 'speech',
    eventType: eventType as any,
    actorId,
    targetId,
    content: {},
    source: 'speech',
    credibility: 0.4,
    importance: 0.3,
    isForgotten: false,
    createdAt: Date.now(),
  };
}

describe('RelationTracker', () => {
  it('initializes with zero friendly', () => {
    const tracker = new RelationTracker('A', ['A', 'B', 'C']);
    expect(tracker.getFriendly('B')).toBe(FRIENDLY_RANGE.INITIAL);
    expect(tracker.getFriendly('C')).toBe(FRIENDLY_RANGE.INITIAL);
  });

  it('adjustFriendly clamps to range', () => {
    const tracker = new RelationTracker('A', ['A', 'B']);
    tracker.adjustFriendly('B', 100);
    expect(tracker.getFriendly('B')).toBe(FRIENDLY_RANGE.MAX);
    tracker.adjustFriendly('B', -200);
    expect(tracker.getFriendly('B')).toBe(FRIENDLY_RANGE.MIN);
  });

  it('onMemoryAdded updates friendly based on event type and credibility', () => {
    const tracker = new RelationTracker('A', ['A', 'B']);
    const mem = makeMem('hear_accuse', 'B', 'A');
    tracker.onMemoryAdded(mem);
    expect(tracker.getFriendly('B')).toBe(FRIENDLY_DELTA.hear_accuse * mem.credibility);
  });

  it('onMemoryAdded ignores self-actions', () => {
    const tracker = new RelationTracker('A', ['A', 'B']);
    tracker.onMemoryAdded(makeMem('hear_accuse', 'A', 'A'));
    expect(tracker.getFriendly('B')).toBe(0);
  });

  it('onMemoryAdded ignores non-target memories', () => {
    const tracker = new RelationTracker('A', ['A', 'B']);
    tracker.onMemoryAdded(makeMem('hear_accuse', 'C', 'D'));
    expect(tracker.getFriendly('B')).toBe(0);
  });

  it('getAll sorts by friendly ascending', () => {
    const tracker = new RelationTracker('A', ['A', 'B', 'C']);
    tracker.adjustFriendly('B', -5);
    tracker.adjustFriendly('C', 5);
    const all = tracker.getAll();
    // A is excluded (selfId), only B and C
    expect(all.length).toBe(2);
    expect(all[0].playerId).toBe('B');
    expect(all[1].playerId).toBe('C');
  });

  it('bystander impact: observing others attack affects relation to actor', () => {
    const tracker = new RelationTracker('A', ['A', 'B', 'C']);
    // B attacks C (A observes, target is not A)
    tracker.onMemoryAdded(makeMem('hear_accuse', 'B', 'C'));
    // A's relation to B should decrease (bystander decay applied)
    expect(tracker.getFriendly('B')).toBeLessThan(0);
  });

  it('bystander impact: observing vote affects relation to actor', () => {
    const tracker = new RelationTracker('A', ['A', 'B', 'C']);
    tracker.onMemoryAdded({ ...makeMem('vote', 'B', 'C'), source: 'system', credibility: 1.0 });
    expect(tracker.getFriendly('B')).toBeLessThan(0);
  });
});
