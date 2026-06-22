// ============================================================
// 游戏配置常量
// ============================================================

// ---------- 回合限制 ----------
export const MAX_ROUNDS = 20;

// ---------- 时间步进（毫秒） ----------
export const LOG_TIME_INCREMENT_MS = 1000;

// ---------- 玩家属性范围 ----------
export const ATTRIBUTE_RANGE = {
  MIN: 1,
  MAX: 10,
} as const;

// ---------- 玩家初始值 ----------
export const PLAYER_INITIAL = {
  PRESSURE: 0,
  BURST_COUNT: 0,
  TRAITS: [] as string[],
} as const;

// ---------- ASCII 'A' 用于玩家 ID 生成 ----------
export const PLAYER_ID_BASE_CHAR_CODE = 65;

// ---------- 角色人数范围 ----------
export const ROLE_COUNT_RANGE = {
  werewolf: { min: 1, max: 3 },
  prophet: { min: 0, max: 1 },
  villager: { min: 3, max: 10 },
} as const;
