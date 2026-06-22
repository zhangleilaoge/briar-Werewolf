// ============================================================
// MemoryEntry 工厂函数 —— 创建记忆条目的便捷方法
// ============================================================

import type { MemoryEntry, MemorySource, MemoryEventType, MemoryTrigger } from '@/types';
import { CREDIBILITY, CREDIBILITY_DEFAULT, getDefaultImportance } from '@/constants';

function getDefaultCredibility(source: MemorySource): number {
  switch (source) {
    case 'system': return CREDIBILITY.SYSTEM;
    case 'self': return CREDIBILITY.SELF;
    case 'speech': return CREDIBILITY.SPEECH;
    case 'observe': return CREDIBILITY.OBSERVE;
    default: return CREDIBILITY_DEFAULT;
  }
}

export function createMemory(
  params: {
    round: number;
    triggerAt: MemoryTrigger;
    eventType: MemoryEventType;
    actorId: string;
    targetId?: string;
    content: Record<string, unknown>;
    source: MemorySource;
    credibility?: number;
    importance?: number;
    notes?: string;
  }
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return {
    ...params,
    credibility: params.credibility ?? getDefaultCredibility(params.source),
    importance: params.importance ?? getDefaultImportance(params.source),
  };
}

export function createCheckResult(
  round: number, actorId: string, targetId: string, result: 'werewolf' | 'villager'
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'night_action', eventType: 'check_result', actorId, targetId,
    content: { result }, source: 'self', notes: `查验 ${targetId}：${result}`,
  });
}

export function createDeath(
  round: number, playerId: string, cause: 'vote' | 'night_kill'
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'night_end', eventType: 'death', actorId: 'system', targetId: playerId,
    content: { playerId, cause }, source: 'system', notes: `${playerId} 死亡，原因：${cause}`,
  });
}

export function createVote(
  round: number, voterId: string, targetId: string
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'vote', eventType: 'vote', actorId: voterId, targetId,
    content: { voterId, targetId }, source: 'system', notes: `${voterId} 投票给 ${targetId}`,
  });
}
