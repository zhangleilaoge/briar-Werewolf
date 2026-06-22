// ============================================================
// 游戏配置常量
// ============================================================

// ---------- 回合限制 ----------
export const MAX_ROUNDS = 20;

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
