// ============================================================
// MemoryBroadcaster — 记忆广播和可见性管理
// ============================================================

import { MemStore } from '@/memory';
import { MemoryView } from '@/memory/memory-view';
import type { MemoryEntry } from '@/types';
import { PressureSystem } from './pressure-system';

export class MemoryBroadcaster {
  private store: MemStore;
  private pressureSystem: PressureSystem;

  constructor(store: MemStore, pressureSystem: PressureSystem) {
    this.store = store;
    this.pressureSystem = pressureSystem;
  }

  /**
   * 广播记忆：单条共享，所有存活角色可见（通过 getVisibleStore 过滤）
   */
  broadcast(opts: Omit<Parameters<MemStore['add']>[0], 'viewerId'> & { viewerId?: never }): void {
    const memory = this.store.add({ ...opts });
    this.pressureSystem.updateFromMemory(memory);
  }

  /**
   * 写入单条记忆
   */
  write(opts: Parameters<MemStore['add']>[0]): void {
    const memory = this.store.add(opts);
    this.pressureSystem.updateFromMemory(memory);
  }

  /**
   * 获取某个角色可见的记忆视图
   */
  getVisibleStore(selfId: string): MemoryView {
    return this.store.getView(selfId);
  }

  /**
   * 获取所有记忆
   */
  getAllMemories(includeForgotten = false): MemoryEntry[] {
    return this.store.getAll(includeForgotten);
  }

  /**
   * 应用遗忘
   */
  applyForgetting(round: number): void {
    this.store.applyForgetting(round);
  }
}