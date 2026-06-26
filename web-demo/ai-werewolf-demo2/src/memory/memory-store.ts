// ============================================================
// MemoryStore — 记忆存储接口
// MemStore 和 MemoryView 都实现此接口
// ============================================================

import type { MemoryEntry, MemorySource, MemoryEventType } from '@/types';

export interface MemoryStore {
  /**
   * 获取指定ID的记忆
   */
  get(id: string): MemoryEntry | undefined;

  /**
   * 获取所有可见记忆
   */
  getAll(includeForgotten?: boolean): MemoryEntry[];

  /**
   * 获取关于指定玩家的记忆
   */
  aboutPlayer(playerId: string): MemoryEntry[];

  /**
   * 获取指定演员的记忆
   */
  byActor(actorId: string): MemoryEntry[];

  /**
   * 获取指定目标的记忆
   */
  byTarget(targetId: string): MemoryEntry[];

  /**
   * 获取指定类型的记忆
   */
  byType(type: MemoryEventType): MemoryEntry[];

  /**
   * 获取指定来源的记忆
   */
  bySource(source: MemorySource): MemoryEntry[];

  /**
   * 获取指定回合的记忆
   */
  byRound(round: number): MemoryEntry[];

  /**
   * 获取硬信息
   */
  hardInfo(): MemoryEntry[];

  /**
   * 获取关于指定玩家的硬信息
   */
  hardInfoAboutPlayer(playerId: string): MemoryEntry[];

  /**
   * 获取指定玩家的声明
   */
  claimsByPlayer(playerId: string): MemoryEntry[];

  /**
   * 获取针对指定玩家的指控
   */
  accusationsAgainst(targetId: string): MemoryEntry[];

  /**
   * 获取为指定玩家的辩护
   */
  defensesFor(targetId: string): MemoryEntry[];

  /**
   * 获取死亡记录
   */
  deaths(): MemoryEntry[];

  /**
   * 检查玩家是否死亡
   */
  isDead(playerId: string): boolean;
}