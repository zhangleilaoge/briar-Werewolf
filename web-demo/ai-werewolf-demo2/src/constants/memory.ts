// ============================================================
// 记忆系统常量
// ============================================================

// ---------- 重要度默认值（按来源） ----------
export const IMPORTANCE = {
  SYSTEM: 0.9,
  SELF: 0.9,
  OBSERVE: 0.5,
  SPEECH: 0.3,
  DEFAULT: 0.3,
} as const;

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

// ---------- 观察默认置信度 ----------
export const OBSERVE_CONFIDENCE_DEFAULT = 0.5;
