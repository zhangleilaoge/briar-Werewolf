// ============================================================
// 基础类型定义（Base Types）—— 避免循环依赖
// 核心实体、记忆系统基础类型在此定义
// 其他类型文件（trace, decision）从本文件导入，不从 index.ts 导入
// ============================================================

// ---------- 基础实体 ----------
export type Role = 'prophet' | 'werewolf' | 'villager';
export type Team = 'werewolf' | 'villager';
export type Phase = 'day' | 'night';

export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  personality: string;    // 性格ID
  pressure: number;       // 当前压力值，0~20，初始0
  burstCount: number;     // 已爆满次数，初始0
  traits: string[];       // 已获得的特质ID列表
  attributes: {
    leadership: number;
    eloquence: number;
    observation: number;
    cunning: number;
    affinity: number;
    logic: number;
  };
}

// ---------- 关系系统 ----------
export interface Relation {
  friendly: number; // 友好度，-10 ~ 10，初始 0
  memoryIds: string[]; // 支撑记忆ID
}

// ---------- 记忆系统 ----------
export type MemoryTrigger =
  | 'init'
  | 'night_start'
  | 'night_action'
  | 'night_end'
  | 'day_start'
  | 'speech'
  | 'vote'
  | 'vote_result'
  | 'morning';

export type MemorySource =
  | 'system'
  | 'self'
  | 'speech'
  | 'observe';

export type MemoryEventType =
  | 'self_role'
  | 'teammate_reveal'
  | 'check_result'
  | 'night_kill_vote'
  | 'death'
  | 'hear_claim'
  | 'hear_accuse'
  | 'hear_defend'
  | 'hear_silence'
  | 'hear_chat'
  | 'morning'
  | 'peaceful_night'
  | 'vote'
  | 'vote_result'
  | 'observe_pattern';

export interface MemoryEntry {
  id: string;
  triggerAt: MemoryTrigger;
  round: number;
  eventType: MemoryEventType;
  actorId: string;
  targetId?: string;
  content: Record<string, unknown>;
  source: MemorySource;
  credibility: number;
  importance: number;
  isForgotten: boolean;
  createdAt: number;
  notes?: string;
  viewerId?: string;
}
