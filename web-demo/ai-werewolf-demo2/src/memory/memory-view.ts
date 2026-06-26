// ============================================================
// MemoryView — 记忆视图
// 不复制数据，而是引用原始数据并过滤
// ============================================================

import type { MemoryEntry, MemorySource, MemoryEventType } from '@/types';
import type { MemoryStore } from './memory-store';
import * as query from './memory-query';

export class MemoryView implements MemoryStore {
  private source: Map<string, MemoryEntry>;
  private viewerId: string;

  constructor(source: Map<string, MemoryEntry>, viewerId: string) {
    this.source = source;
    this.viewerId = viewerId;
  }

  /**
   * 获取指定ID的记忆
   */
  get(id: string): MemoryEntry | undefined {
    const entry = this.source.get(id);
    if (!entry) return undefined;
    if (entry.isForgotten) return undefined;
    if (entry.viewerId && entry.viewerId !== this.viewerId) return undefined;
    return entry;
  }

  /**
   * 获取所有可见记忆
   */
  getAll(includeForgotten = false): MemoryEntry[] {
    const result: MemoryEntry[] = [];
    for (const entry of this.source.values()) {
      if (!includeForgotten && entry.isForgotten) continue;
      if (entry.viewerId && entry.viewerId !== this.viewerId) continue;
      result.push(entry);
    }
    return result.sort((a, b) => a.round - b.round || a.createdAt - b.createdAt);
  }

  /**
   * 获取关于指定玩家的记忆
   */
  aboutPlayer(playerId: string): MemoryEntry[] { return query.aboutPlayer(this, playerId); }

  /**
   * 获取指定演员的记忆
   */
  byActor(actorId: string): MemoryEntry[] { return query.byActor(this, actorId); }

  /**
   * 获取指定目标的记忆
   */
  byTarget(targetId: string): MemoryEntry[] { return query.byTarget(this, targetId); }

  /**
   * 获取指定类型的记忆
   */
  byType(type: MemoryEventType): MemoryEntry[] { return query.byType(this, type); }

  /**
   * 获取指定来源的记忆
   */
  bySource(source: MemorySource): MemoryEntry[] { return query.bySource(this, source); }

  /**
   * 获取指定回合的记忆
   */
  byRound(round: number): MemoryEntry[] { return query.byRound(this, round); }

  /**
   * 获取硬信息
   */
  hardInfo(): MemoryEntry[] { return query.hardInfo(this); }

  /**
   * 获取关于指定玩家的硬信息
   */
  hardInfoAboutPlayer(playerId: string): MemoryEntry[] { return query.hardInfoAboutPlayer(this, playerId); }

  /**
   * 获取指定玩家的声明
   */
  claimsByPlayer(playerId: string): MemoryEntry[] { return query.claimsByPlayer(this, playerId); }

  /**
   * 获取针对指定玩家的指控
   */
  accusationsAgainst(targetId: string): MemoryEntry[] { return query.accusationsAgainst(this, targetId); }

  /**
   * 获取为指定玩家的辩护
   */
  defensesFor(targetId: string): MemoryEntry[] { return query.defensesFor(this, targetId); }

  /**
   * 获取死亡记录
   */
  deaths(): MemoryEntry[] { return query.deaths(this); }

  /**
   * 检查玩家是否死亡
   */
  isDead(playerId: string): boolean { return query.isDead(this, playerId); }
}