// ============================================================
// MemoryEntry 工厂函数 —— 创建记忆条目的便捷方法
// ============================================================

import type { MemoryEntry, MemorySource, MemoryEventType, MemoryTrigger } from '@/types';
import { CREDIBILITY } from '@/types';

function getDefaultCredibility(source: MemorySource): number {
  switch (source) {
    case 'system': return CREDIBILITY.SYSTEM;
    case 'self': return CREDIBILITY.SELF;
    case 'speech': return CREDIBILITY.SPEECH;
    case 'observe': return CREDIBILITY.OBSERVE;
    default: return 0.5;
  }
}

function getDefaultImportance(source: MemorySource): number {
  switch (source) {
    case 'system': return 0.9;
    case 'self': return 0.9;
    case 'observe': return 0.5;
    case 'speech': return 0.3;
    default: return 0.3;
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

// 便捷方法：查验结果
export function createCheckResult(
  round: number, actorId: string, targetId: string, result: 'werewolf' | 'villager'
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'night_action', eventType: 'check_result', actorId, targetId,
    content: { result }, source: 'self', notes: `查验 ${targetId}：${result}`,
  });
}

// 便捷方法：身份揭示
export function createRoleReveal(
  round: number, targetId: string, role: string, reason: 'self_role' | 'teammate'
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'init', eventType: 'teammate_reveal', actorId: 'system', targetId,
    content: { targetId, role, reason }, source: 'system',
    notes: `身份揭示：${targetId} 是 ${role}，来源：${reason}`,
  });
}

// 便捷方法：死亡
export function createDeath(
  round: number, playerId: string, cause: 'vote' | 'night_kill'
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'night_end', eventType: 'death', actorId: 'system', targetId: playerId,
    content: { playerId, cause }, source: 'system', notes: `${playerId} 死亡，原因：${cause}`,
  });
}

// 便捷方法：白天声称
export function createHearClaim(
  round: number, claimerId: string, claimedRole: string, claim?: string
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'speech', eventType: 'hear_claim', actorId: claimerId,
    content: { claimerId, claimedRole, claim }, source: 'speech',
    notes: `${claimerId} 声称自己是 ${claimedRole}${claim ? '：' + claim : ''}`,
  });
}

// 便捷方法：指控
export function createHearAccuse(
  round: number, accuserId: string, targetId: string, reason?: string
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'speech', eventType: 'hear_accuse', actorId: accuserId, targetId,
    content: { accuserId, targetId, reason }, source: 'speech',
    notes: reason || `${accuserId} 指控 ${targetId}`,
  });
}

// 便捷方法：辩护
export function createHearDefend(
  round: number, defenderId: string, targetId: string, reason?: string
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'speech', eventType: 'hear_defend', actorId: defenderId, targetId,
    content: { defenderId, targetId, reason }, source: 'speech',
    notes: reason || `${defenderId} 为 ${targetId} 辩护`,
  });
}

// 便捷方法：闲聊
export function createHearChat(
  round: number, chatterId: string, targetId: string, success: boolean
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'speech', eventType: 'hear_chat', actorId: chatterId, targetId,
    content: { chatterId, targetId, success }, source: 'speech',
    notes: `${chatterId} 找 ${targetId} 闲聊，${success ? '气氛融洽' : '气氛尴尬'}`,
  });
}

// 便捷方法：投票
export function createVote(
  round: number, voterId: string, targetId: string
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'vote', eventType: 'vote', actorId: voterId, targetId,
    content: { voterId, targetId }, source: 'system', notes: `${voterId} 投票给 ${targetId}`,
  });
}

// 便捷方法：观察到的短期意图
export function createObservePattern(
  round: number, observerId: string, targetId: string,
  inferredIntention: string, intentionTarget?: string, confidence = 0.5
): Omit<MemoryEntry, 'id' | 'createdAt'> {
  return createMemory({
    round, triggerAt: 'day_start', eventType: 'observe_pattern', actorId: observerId, targetId,
    content: { inferredIntention, intentionTarget, confidence }, source: 'observe',
    notes: `${observerId} 观察到 ${targetId} 似乎意图 ${inferredIntention}${intentionTarget ? '（目标：' + intentionTarget + '）' : ''}，置信度 ${confidence}`,
  });
}
