// ============================================================
// MemoryView — 记忆视图
// 不复制数据，而是引用原始数据并过滤
// ============================================================

import type { MemoryEntry, MemorySource, MemoryEventType } from '@/types';
import { HARD_INFO_THRESHOLD } from '@/constants';
import type { MemoryStore } from './memory-store';

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
  aboutPlayer(playerId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.actorId === playerId || e.targetId === playerId);
  }

  /**
   * 获取指定演员的记忆
   */
  byActor(actorId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.actorId === actorId);
  }

  /**
   * 获取指定目标的记忆
   */
  byTarget(targetId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.targetId === targetId);
  }

  /**
   * 获取指定类型的记忆
   */
  byType(type: MemoryEventType): MemoryEntry[] {
    return this.getAll().filter((e) => e.eventType === type);
  }

  /**
   * 获取指定来源的记忆
   */
  bySource(source: MemorySource): MemoryEntry[] {
    return this.getAll().filter((e) => e.source === source);
  }

  /**
   * 获取指定回合的记忆
   */
  byRound(round: number): MemoryEntry[] {
    return this.getAll().filter((e) => e.round === round);
  }

  /**
   * 获取硬信息
   */
  hardInfo(): MemoryEntry[] {
    return this.getAll().filter((e) => e.credibility >= HARD_INFO_THRESHOLD);
  }

  /**
   * 获取关于指定玩家的硬信息
   */
  hardInfoAboutPlayer(playerId: string): MemoryEntry[] {
    return this.hardInfo().filter((e) => e.actorId === playerId || e.targetId === playerId);
  }

  /**
   * 获取指定玩家的声明
   */
  claimsByPlayer(playerId: string): MemoryEntry[] {
    return this.getAll().filter(
      (e) => e.actorId === playerId && (e.eventType === 'hear_claim')
    );
  }

  /**
   * 获取针对指定玩家的指控
   */
  accusationsAgainst(targetId: string): MemoryEntry[] {
    return this.getAll().filter(
      (e) => e.targetId === targetId && e.eventType === 'hear_accuse'
    );
  }

  /**
   * 获取为指定玩家的辩护
   */
  defensesFor(targetId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.targetId === targetId && e.eventType === 'hear_defend');
  }

  /**
   * 获取死亡记录
   */
  deaths(): MemoryEntry[] {
    return this.getAll().filter((e) => e.eventType === 'death');
  }

  /**
   * 检查玩家是否死亡
   */
  isDead(playerId: string): boolean {
    return this.deaths().some((e) => e.targetId === playerId || e.content.playerId === playerId);
  }
}