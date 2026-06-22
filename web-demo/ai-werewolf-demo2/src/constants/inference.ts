// ============================================================
// 推理系统常量
// ============================================================

// ---------- 默认概率（无证据时） ----------
export const BELIEF_DEFAULT = {
  WEREWOLF_PROB: 0.3,
  VILLAGER_PROB: 0.7,
} as const;

// ---------- 声称权重因子 ----------
export const CLAIM_WEIGHT_FACTOR = 0.5;

// ---------- 观察意图权重因子 ----------
export const OBSERVE_WEIGHT = {
  /** 默认观察置信度 */
  DEFAULT_CONFIDENCE: 0.5,
  /** 攻击意图 → 狼人权重 */
  ATTACK_WOLF: 0.8,
  /** 保护意图 → 村民权重 */
  PROTECT_VILLAGER: 0.6,
  /** 隐藏意图 → 狼人权重 */
  HIDE_WOLF: 0.3,
} as const;

// ---------- 危机度权重 ----------
export const CRISIS_WEIGHT = {
  ACCUSE: 2,
  VOTE: 3,
  OBSERVE: 1,
  DEFEND: -2,
} as const;
