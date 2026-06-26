// ============================================================
// MemStore — 记忆存储中心
// 所有 AI 的原始记忆都在这里，不可变内容，但会遗忘
// ============================================================

import type { MemoryEntry, MemorySource, MemoryEventType } from '@/types';
import { getDefaultImportance, FORGETTING, CREDIBILITY, CREDIBILITY_DEFAULT } from '@/constants';
import { MemoryView } from './memory-view';
import type { MemoryStore } from './memory-store';
import * as query from './memory-query';

export class MemStore implements MemoryStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private _idCounter = 0;

  // ---- 核心操作 ----

  // ---- 辅助方法 ----

  private _safeCredibilityLookup(source: MemorySource): number {
    const map = CREDIBILITY as unknown as Record<string, number>;
    return Object.hasOwn(map, source) ? map[source] : CREDIBILITY_DEFAULT;
  }

  add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'importance' | 'isForgotten' | 'credibility'> & { importance?: number; credibility?: number }): MemoryEntry {
    const id = `mem_${++this._idCounter}_${Date.now()}`;
    const importance = entry.importance ?? getDefaultImportance(entry.source);
    const credibility = entry.credibility ?? this._safeCredibilityLookup(entry.source);
    const fullEntry: MemoryEntry = {
      ...entry,
      id,
      credibility,
      importance,
      isForgotten: false,
      createdAt: Date.now(),
    };
    this.entries.set(id, fullEntry);
    return fullEntry;
  }

  /** 直接导入已有记忆（保留原始ID，不生成新ID） */
  import(entry: MemoryEntry): void {
    this.entries.set(entry.id, entry);
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  getAll(includeForgotten = false): MemoryEntry[] {
    return Array.from(this.entries.values())
      .filter((e) => includeForgotten || !e.isForgotten)
      .sort((a, b) => a.round - b.round || a.createdAt - b.createdAt);
  }

  // ---- 条件查询 ----

  aboutPlayer(playerId: string): MemoryEntry[] { return query.aboutPlayer(this, playerId); }

  byActor(actorId: string): MemoryEntry[] { return query.byActor(this, actorId); }

  byTarget(targetId: string): MemoryEntry[] { return query.byTarget(this, targetId); }

  byType(type: MemoryEventType): MemoryEntry[] { return query.byType(this, type); }

  bySource(source: MemorySource): MemoryEntry[] { return query.bySource(this, source); }

  byRound(round: number): MemoryEntry[] { return query.byRound(this, round); }

  hardInfo(): MemoryEntry[] { return query.hardInfo(this); }

  hardInfoAboutPlayer(playerId: string): MemoryEntry[] { return query.hardInfoAboutPlayer(this, playerId); }

  claimsByPlayer(playerId: string): MemoryEntry[] { return query.claimsByPlayer(this, playerId); }

  accusationsAgainst(targetId: string): MemoryEntry[] { return query.accusationsAgainst(this, targetId); }

  defensesFor(targetId: string): MemoryEntry[] { return query.defensesFor(this, targetId); }

  deaths(): MemoryEntry[] { return query.deaths(this); }

  isDead(playerId: string): boolean { return query.isDead(this, playerId); }

  // ---- 遗忘机制 ----

  /**
   * 应用遗忘。每回合调用一次。
   * 不删除记忆，只标记 isForgotten = true。
   */
  applyForgetting(currentRound: number): { forgotten: MemoryEntry[]; retained: MemoryEntry[] } {
    const totalMemories = this.entries.size;
    const memoryPressure = Math.min(FORGETTING.PRESSURE_CAP, totalMemories * FORGETTING.PRESSURE_PER_MEMORY);
    const base = FORGETTING.BASE_RATE;
    const forgotten: MemoryEntry[] = [];
    const retained: MemoryEntry[] = [];

    for (const [, entry] of this.entries) {
      // 已遗忘的不再处理
      if (entry.isForgotten) {
        forgotten.push(entry);
        continue;
      }

      const roundsPassed = currentRound - entry.round;
      const timeDecay = 1 - Math.exp(-roundsPassed * FORGETTING.TIME_DECAY_RATE);
      const forgettingRate = base + memoryPressure + timeDecay * (1 - base - memoryPressure);

      if (forgettingRate > entry.importance) {
        entry.isForgotten = true;
        forgotten.push(entry);
      } else {
        retained.push(entry);
      }
    }

    return { forgotten, retained };
  }

  // ---- 统计 ----

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this._idCounter = 0;
  }

  // ---- 视图 ----

  /**
   * 获取指定玩家的可见记忆视图
   */
  getView(viewerId: string): MemoryView {
    return new MemoryView(this.entries, viewerId);
  }
}
