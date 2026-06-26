// ============================================================
// PressureSystem — 压力系统
// 根据游戏事件更新玩家压力值
// ============================================================

import type { Player, MemoryEntry } from '@/types';

export class PressureSystem {
  private players: Player[];
  private deadPlayerIds: Set<string>;

  constructor(players: Player[], deadPlayerIds: Set<string>) {
    this.players = players;
    this.deadPlayerIds = deadPlayerIds;
  }

  /**
   * 根据最后一条新增记忆更新所有玩家压力
   */
  updateFromMemory(memory: MemoryEntry): void {
    const alive = this.players.filter((p) => !this.deadPlayerIds.has(p.id));
    const addPressure = (p: Player, delta: number) => {
      p.pressure = Math.max(0, Math.min(20, p.pressure + delta));
    };

    switch (memory.eventType) {
      case 'self_role': {
        if (memory.viewerId) {
          const p = this.players.find((x) => x.id === memory.viewerId);
          if (p) addPressure(p, -1);
        }
        break;
      }
      case 'hear_accuse': {
        if (memory.targetId) {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, +1);
        }
        break;
      }
      case 'hear_defend': {
        if (memory.targetId) {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, -1);
        }
        break;
      }
      case 'hear_claim': {
        if (memory.targetId && memory.content?.claimedResult === 'werewolf') {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, +3);
        }
        if (memory.targetId && memory.content?.claimedResult === 'villager') {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, -1);
        }
        break;
      }
      case 'hear_chat': {
        if (memory.targetId && memory.content?.success === true) {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, -0.5);
        }
        if (memory.targetId && memory.content?.success === false) {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, +0.5);
        }
        break;
      }
      case 'hear_silence': {
        if (memory.actorId) {
          const p = this.players.find((x) => x.id === memory.actorId);
          if (p) addPressure(p, +0.5);
        }
        break;
      }
      case 'vote': {
        if (memory.targetId) {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, +2);
        }
        break;
      }
      case 'check_result': {
        if (memory.viewerId) {
          const p = this.players.find((x) => x.id === memory.viewerId);
          if (p) {
            if (memory.content?.result === 'werewolf') addPressure(p, +3);
            else if (memory.content?.result === 'villager') addPressure(p, -2);
          }
        }
        break;
      }
      case 'death': {
        for (const p of alive) addPressure(p, +1);
        break;
      }
      case 'morning': {
        for (const p of alive) addPressure(p, -0.5);
        break;
      }
      case 'peaceful_night': {
        for (const p of alive) addPressure(p, -1);
        break;
      }
      case 'vote_result': {
        for (const p of alive) addPressure(p, +1);
        break;
      }
      case 'observe_pattern': {
        if (memory.content?.inferredIntention === 'attack' && memory.targetId) {
          const p = this.players.find((x) => x.id === memory.targetId);
          if (p) addPressure(p, +1);
        }
        break;
      }
      default:
        break;
    }
  }
}