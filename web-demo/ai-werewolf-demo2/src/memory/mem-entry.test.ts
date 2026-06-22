import { describe, it, expect } from 'vitest';
import { createMemory, createCheckResult, createDeath, createVote } from './mem-entry';
import { CREDIBILITY } from '@/constants';

describe('mem-entry', () => {
  it('createMemory sets default credibility and importance', () => {
    const mem = createMemory({ round: 1, triggerAt: 'speech', eventType: 'hear_accuse', actorId: 'A', targetId: 'B', content: {}, source: 'speech' });
    expect(mem.credibility).toBe(CREDIBILITY.SPEECH);
    expect(mem.importance).toBe(0.3);
  });

  it('createCheckResult creates correct entry', () => {
    const mem = createCheckResult(2, 'A', 'B', 'werewolf');
    expect(mem.eventType).toBe('check_result');
    expect(mem.source).toBe('self');
    expect(mem.targetId).toBe('B');
  });

  it('createDeath creates death entry', () => {
    const mem = createDeath(3, 'C', 'vote');
    expect(mem.eventType).toBe('death');
    expect(mem.content.cause).toBe('vote');
  });

  it('createVote creates vote entry', () => {
    const mem = createVote(1, 'A', 'B');
    expect(mem.eventType).toBe('vote');
    expect(mem.actorId).toBe('A');
    expect(mem.targetId).toBe('B');
  });
});
