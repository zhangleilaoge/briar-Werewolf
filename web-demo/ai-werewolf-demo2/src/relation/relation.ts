// ============================================================
// RelationTracker — 关系跟踪器
// 纯粹的关系系统，和推理无关。只维护友好度。
// 被攻击（怀疑、投票）→ 友好度降低
// 被袒护（辩护）→ 友好度升高
// ============================================================

import type { MemoryEntry, Relation } from '@/types';
import { FRIENDLY_DELTA, FRIENDLY_RANGE } from '@/constants';

export class RelationTracker {
  private relations: Map<string, Relation> = new Map();
  private selfId: string;

  constructor(selfId: string, allPlayerIds: string[]) {
    this.selfId = selfId;
    for (const id of allPlayerIds) {
      if (id !== selfId) {
        this.relations.set(id, { friendly: FRIENDLY_RANGE.INITIAL, memoryIds: [] });
      }
    }
  }

  /**
   * 当一条记忆被录入时，检查是否需要更新关系。
   * 只关注 "有人对我做了什么" 的记忆。
   */
  onMemoryAdded(memory: MemoryEntry): void {
    // 只处理目标是我的记忆（有人对我做了什么）
    if (memory.targetId !== this.selfId) return;
    // 不处理自己对自己做的事
    if (memory.actorId === this.selfId) return;

    const delta = FRIENDLY_DELTA[memory.eventType];
    if (delta !== undefined) {
      this.adjustFriendly(memory.actorId, delta, memory.id);
    }
  }

  /**
   * 调整对某人的友好度
   */
  adjustFriendly(targetId: string, delta: number, memoryId?: string): void {
    const rel = this.relations.get(targetId);
    if (!rel) return;
    rel.friendly = Math.max(FRIENDLY_RANGE.MIN, Math.min(FRIENDLY_RANGE.MAX, rel.friendly + delta));
    if (memoryId) rel.memoryIds.push(memoryId);
  }

  /**
   * 获取对某人的友好度
   */
  getFriendly(targetId: string): number {
    return this.relations.get(targetId)?.friendly ?? FRIENDLY_RANGE.INITIAL;
  }

  /**
   * 获取所有关系（按友好度排序，从低到高）
   */
  getAll(): { playerId: string; friendly: number; memoryIds: string[] }[] {
    return Array.from(this.relations.entries())
      .map(([playerId, rel]) => ({ playerId, friendly: rel.friendly, memoryIds: rel.memoryIds }))
      .sort((a, b) => a.friendly - b.friendly); // 从低到高（最不友好在前）
  }
}
