// ============================================================
// RelationTracker — 关系跟踪器
// 纯粹的关系系统，和推理无关。只维护友好度。
// 被攻击（怀疑、投票）→ 友好度降低
// 被袒护（辩护）→ 友好度升高
// ============================================================

import type { MemoryEntry, Relation } from '@/types';

// TODO: 后续可扩展为更复杂的权重表
const FRIENDLY_DELTA: Record<string, number> = {
  hear_accuse: -3,   // 被怀疑：友好度-3
  vote: -2,          // 被投票：友好度-2
  hear_defend: +2,   // 被辩护：友好度+2
};

export class RelationTracker {
  private relations: Map<string, Relation> = new Map();
  private selfId: string;

  constructor(selfId: string, allPlayerIds: string[]) {
    this.selfId = selfId;
    for (const id of allPlayerIds) {
      if (id !== selfId) {
        this.relations.set(id, { friendly: 0 });
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
      this.adjustFriendly(memory.actorId, delta);
    }
  }

  /**
   * 调整对某人的友好度
   */
  adjustFriendly(targetId: string, delta: number): void {
    const rel = this.relations.get(targetId);
    if (!rel) return;
    rel.friendly = Math.max(-10, Math.min(10, rel.friendly + delta));
  }

  /**
   * 获取对某人的友好度
   */
  getFriendly(targetId: string): number {
    return this.relations.get(targetId)?.friendly ?? 0;
  }

  /**
   * 获取所有关系（按友好度排序，从低到高）
   */
  getAll(): { playerId: string; friendly: number }[] {
    return Array.from(this.relations.entries())
      .map(([playerId, rel]) => ({ playerId, friendly: rel.friendly }))
      .sort((a, b) => a.friendly - b.friendly); // 从低到高（最不友好在前）
  }

  /**
   * 获取最友好的人（排除队友）
   */
  getMostFriendly(excludeIds?: string[]): { playerId: string; friendly: number } | undefined {
    const entries = this.getAll().filter((e) => !excludeIds?.includes(e.playerId));
    return entries.length > 0 ? entries[entries.length - 1] : undefined;
  }

  /**
   * 获取最不友好的人
   */
  getLeastFriendly(excludeIds?: string[]): { playerId: string; friendly: number } | undefined {
    const entries = this.getAll().filter((e) => !excludeIds?.includes(e.playerId));
    return entries.length > 0 ? entries[0] : undefined;
  }
}
