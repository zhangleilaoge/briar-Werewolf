// ============================================================
// MemStore — 记忆存储中心
// 所有 AI 的原始记忆都在这里，不可变内容，但会遗忘
// ============================================================

import type { MemoryEntry, MemorySource, MemoryEventType, Phase } from '@/types';
import { IMPORTANCE, HARD_INFO_THRESHOLD, FORGETTING } from '@/constants';

function getDefaultImportance(source: MemorySource): number {
  switch (source) {
    case 'system': return IMPORTANCE.SYSTEM;
    case 'self': return IMPORTANCE.SELF;
    case 'observe': return IMPORTANCE.OBSERVE;
    case 'speech': return IMPORTANCE.SPEECH;
    default: return IMPORTANCE.DEFAULT;
  }
}

export class MemStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private _idCounter = 0;

  // ---- 核心操作 ----

  add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'importance' | 'isForgotten'> & { importance?: number }): MemoryEntry {
    const id = `mem_${++this._idCounter}_${Date.now()}`;
    const importance = entry.importance ?? getDefaultImportance(entry.source);
    const fullEntry: MemoryEntry = {
      ...entry,
      id,
      importance,
      isForgotten: false,
      createdAt: Date.now(),
    };
    this.entries.set(id, fullEntry);
    return fullEntry;
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

  aboutPlayer(playerId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.actorId === playerId || e.targetId === playerId);
  }

  byActor(actorId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.actorId === actorId);
  }

  byTarget(targetId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.targetId === targetId);
  }

  byType(type: MemoryEventType): MemoryEntry[] {
    return this.getAll().filter((e) => e.eventType === type);
  }

  bySource(source: MemorySource): MemoryEntry[] {
    return this.getAll().filter((e) => e.source === source);
  }

  byRound(round: number): MemoryEntry[] {
    return this.getAll().filter((e) => e.round === round);
  }

  hardInfo(): MemoryEntry[] {
    return this.getAll().filter((e) => e.credibility >= HARD_INFO_THRESHOLD);
  }

  hardInfoAboutPlayer(playerId: string): MemoryEntry[] {
    return this.hardInfo().filter((e) => e.actorId === playerId || e.targetId === playerId);
  }

  claimsByPlayer(playerId: string): MemoryEntry[] {
    return this.getAll().filter(
      (e) => e.actorId === playerId && (e.eventType === 'hear_claim')
    );
  }

  accusationsAgainst(targetId: string): MemoryEntry[] {
    return this.getAll().filter(
      (e) => e.targetId === targetId && e.eventType === 'hear_accuse'
    );
  }

  defensesFor(targetId: string): MemoryEntry[] {
    return this.getAll().filter((e) => e.targetId === targetId && e.eventType === 'hear_defend');
  }

  deaths(): MemoryEntry[] {
    return this.getAll().filter((e) => e.eventType === 'death');
  }

  isDead(playerId: string): boolean {
    return this.deaths().some((e) => e.targetId === playerId || e.content.playerId === playerId);
  }

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
}
