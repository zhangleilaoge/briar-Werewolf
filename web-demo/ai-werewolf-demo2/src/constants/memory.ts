// ============================================================
// 记忆系统常量
// ============================================================

import type { MemorySource } from '@/types';

// ---------- 重要度默认值（按来源） ----------
export const IMPORTANCE = {
  SYSTEM: 0.9,
  SELF: 0.9,
  OBSERVE: 0.5,
  SPEECH: 0.3,
  DEFAULT: 0.3,
} as const;

/** 根据来源获取默认重要度 */
export function getDefaultImportance(source: MemorySource): number {
  switch (source) {
    case 'system': return IMPORTANCE.SYSTEM;
    case 'self': return IMPORTANCE.SELF;
    case 'observe': return IMPORTANCE.OBSERVE;
    case 'speech': return IMPORTANCE.SPEECH;
    default: return IMPORTANCE.DEFAULT;
  }
}

// ---------- 遗忘机制参数 ----------
export const FORGETTING = {
  /** 记忆压力上限 */
  PRESSURE_CAP: 0.5,
  /** 每条记忆产生的压力因子 */
  PRESSURE_PER_MEMORY: 0.005,
  /** 基础遗忘率 */
  BASE_RATE: 0.2,
  /** 时间衰减速率（指数衰减系数） */
  TIME_DECAY_RATE: 0.3,
} as const;
