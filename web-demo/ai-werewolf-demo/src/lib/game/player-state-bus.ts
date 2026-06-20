/**
 * PlayerStateBus — 集中式状态变更总线
 *
 * 所有 Player 状态变更通过此总线执行，自动发射变更事件。
 * 消除 GameSimulator / AIAgent / BeliefSystem 之间的共享引用隐患。
 */

import type { Player, RelationDelta, } from '@/types';
import { clampStress, clampRelation, damageItem as damageItemFn, addItem as addItemFn } from '@/types';
import type { PluginRegistry } from '../plugins';

// ==================== Event Types ====================

export type StateEventType = 'player_killed' | 'stress_changed' | 'relation_changed' | 'item_damaged' | 'item_added' | 'item_removed';

export interface StateEvent {
  timestamp: number;
  playerId: string;
  type: StateEventType;
  before: unknown;
  after: unknown;
  source: string;
}

export type StateEventListener = (event: StateEvent) => void;

/** Callback for death notifications (decoupled from AIAgent) */
export type DeathNotificationCallback = (playerId: string) => void;

// ==================== PlayerStateBus ====================

export class PlayerStateBus {
  private _players: Player[] = [];
  private _deathCallbacks: DeathNotificationCallback[] = [];
  private _pluginRegistry: PluginRegistry | null = null;
  private _eventLog: StateEvent[] = [];
  private _listeners: StateEventListener[] = [];

  // ---- Setup ----

  setPlayers(players: Player[]): void {
    this._players = players;
  }

  getPlayers(): Player[] {
    return this._players;
  }

  /** Register a callback for death notifications */
  onDeath(callback: DeathNotificationCallback): void {
    this._deathCallbacks.push(callback);
  }

  setPluginRegistry(registry: PluginRegistry): void {
    this._pluginRegistry = registry;
  }

  // ---- Query ----

  getPlayer(playerId: string): Player | undefined {
    return this._players.find(p => p.id === playerId);
  }

  getAlivePlayers(): Player[] {
    return this._players.filter(p => p.alive);
  }

  getAliveCount(): number {
    return this._players.filter(p => p.alive).length;
  }

  getAlivePlayerIds(): string[] {
    return this._players.filter(p => p.alive).map(p => p.id);
  }

  /** 深拷贝所有玩家状态（供 AI 侧使用） */
  getPublicPlayerStates(): Player[] {
    return this._players.map(p => ({
      ...p,
      items: p.items.map(i => ({ ...i })),
      attributes: { ...p.attributes },
      alignment: { ...p.alignment },
      relations: Object.fromEntries(
        Object.entries(p.relations).map(([id, r]) => [id, { ...r }])
      ),
    }));
  }

  // ---- Mutations ----

  /** 杀死玩家：设 alive=false + 通知所有监听者 + 发射事件 */
  killPlayer(playerId: string, source: string = 'system'): boolean {
    const player = this.getPlayer(playerId);
    if (!player?.alive) return false;

    const before = player.alive;
    player.alive = false;

    this._emit({
      timestamp: Date.now(),
      playerId,
      type: 'player_killed',
      before,
      after: false,
      source,
    });

    // 通知所有死亡监听者（解耦 AIAgent）
    this._deathCallbacks.forEach(callback => callback(playerId));

    return true;
  }

  /** 变更玩家压力 */
  changeStress(playerId: string, delta: number, source: string = 'system'): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const before = player.stress;
    player.stress = clampStress(player.stress + delta);

    if (player.stress !== before) {
      this._emit({
        timestamp: Date.now(),
        playerId,
        type: 'stress_changed',
        before,
        after: player.stress,
        source,
      });
    }
  }

  /** 直接设置玩家压力值 */
  setStress(playerId: string, value: number, source: string = 'system'): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const before = player.stress;
    player.stress = clampStress(value);

    if (player.stress !== before) {
      this._emit({
        timestamp: Date.now(),
        playerId,
        type: 'stress_changed',
        before,
        after: player.stress,
        source,
      });
    }
  }

  /** 变更关系 */
  changeRelation(fromId: string, toId: string, delta: RelationDelta, source: string = 'system'): void {
    const fromPlayer = this.getPlayer(fromId);
    if (!fromPlayer) return;

    if (!fromPlayer.relations[toId]) {
      fromPlayer.relations[toId] = { favor: 0, trust: 0, friendly: 0 };
    }
    const rel = fromPlayer.relations[toId];
    const beforeFavor = rel.favor;

    if (delta.favorDelta !== undefined) {
      rel.favor = clampRelation(rel.favor + delta.favorDelta);
    }
    if (delta.trustDelta !== undefined) {
      rel.trust = clampRelation((rel.trust || 0) + delta.trustDelta);
    }
    if (delta.friendlyDelta !== undefined) {
      rel.friendly = clampRelation((rel.friendly || 0) + delta.friendlyDelta);
    }
    // 当传了 trustDelta 或 friendlyDelta 时，自动计算 favor = (trust + friendly) / 2
    if (delta.trustDelta !== undefined || delta.friendlyDelta !== undefined) {
      rel.favor = clampRelation(((rel.trust || 0) + (rel.friendly || 0)) / 2);
    }

    if (rel.favor !== beforeFavor) {
      this._emit({
        timestamp: Date.now(),
        playerId: fromId,
        type: 'relation_changed',
        before: beforeFavor,
        after: rel.favor,
        source,
      });
    }
  }

  /** 损坏道具 */
  damageItem(playerId: string, itemId: string, source: string = 'system'): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const before = JSON.parse(JSON.stringify(player.items));
    const result = damageItemFn(player, itemId);

    if (result) {
      this._emit({
        timestamp: Date.now(),
        playerId,
        type: 'item_damaged',
        before,
        after: player.items,
        source,
      });
    }

    return result;
  }

  /** 添加道具 */
  addItem(playerId: string, itemId: string, source: string = 'system'): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const result = addItemFn(player, itemId);

    if (result) {
      this._emit({
        timestamp: Date.now(),
        playerId,
        type: 'item_added',
        before: null,
        after: itemId,
        source,
      });
    }

    return result;
  }

  /** 移除道具 */
  removeItem(playerId: string, itemId: string, source: string = 'system'): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const idx = player.items.findIndex(i => i.definitionId === itemId);
    if (idx < 0) return false;

    player.items.splice(idx, 1);

    this._emit({
      timestamp: Date.now(),
      playerId,
      type: 'item_removed',
      before: itemId,
      after: null,
      source,
    });

    return true;
  }

  // ---- Event System ----

  onEvent(listener: StateEventListener): void {
    this._listeners.push(listener);
  }

  offEvent(listener: StateEventListener): void {
    this._listeners = this._listeners.filter(l => l !== listener);
  }

  getEventLog(): StateEvent[] {
    return this._eventLog;
  }

  getEventsForPlayer(playerId: string): StateEvent[] {
    return this._eventLog.filter(e => e.playerId === playerId);
  }

  clearEventLog(): void {
    this._eventLog = [];
  }

  // ---- Private ----

  private _emit(event: StateEvent): void {
    this._eventLog.push(event);
    this._listeners.forEach(l => l(event));
  }
}
