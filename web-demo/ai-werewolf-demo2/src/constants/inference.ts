// ============================================================
// 推理系统常量
// ============================================================

// ---------- 默认概率（无证据时） ----------
export const BELIEF_DEFAULT = {
  WEREWOLF_PROB: 0.3,
  PROPHET_PROB: 0.15,
  VILLAGER_PROB: 0.55,
} as const;

// ---------- 默认信念权重（防止单一证据推到100%） ----------
export const DEFAULT_BELIEF_WEIGHT = 1.0;

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
  /** 保护意图 → 预言家权重（保护预言家是好人的重要行为） */
  PROTECT_PROPHET: 0.3,
  /** 隐藏意图 → 狼人权重 */
  HIDE_WOLF: 0.3,
} as const;

export const ACCUSER_SPAM_WEIGHT = {
  /** 频繁指控不同人 → 该指控者狼人概率上升权重 */
  BASE_PENALTY: 0.05,
  /** 每多指控一个不同目标，额外惩罚 */
  PER_TARGET_PENALTY: 0.03,
  /** 同一目标多次指控的衰减：第二次起权重递减 */
  REPEAT_DECAY: 0.5,
} as const;

/** 投票参与角色推理的权重 */
export const VOTE_ROLE_WEIGHT = {
  /** 投票给被大众怀疑的人（跟票）→ 投票者可能是村民 */
  FOLLOW_VOTE_VILLAGER: 0.3,
  /** 投票给被辩护的人（抗推）→ 投票者可能是狼人 */
  ANTI_PUSH_WOLF: 0.4,
  /** 投票与之前声称不一致（声称A是狼但投票给B）→ 投票者可疑 */
  INCONSISTENCY_PENALTY: 0.5,
} as const;

// ---------- 危机度权重 ----------
export const CRISIS_WEIGHT = {
  ACCUSE: 2,
  VOTE: 3,
  OBSERVE: 1,
  DEFEND: -2,
  CLAIM_WOLF: 4, // 被声称查杀
} as const;

// ---------- 角色推理额外因子 ----------
export const ROLE_INFERENCE_FACTOR = {
  /** 预言家声称折扣：声称预言家的权重 = CLAIM_WEIGHT_FACTOR × 此因子 */
  PROPHET_CLAIM_DISCOUNT: 0.5,
  /** 辩护对村民权重的贡献因子 */
  DEFEND_WEIGHT: 0.15,
  /** 沉默对狼人权重的贡献因子 */
  SILENCE_WEIGHT: 0.05,
  /** 全局约束缩放的最小比例 */
  MIN_SCALE_FACTOR: 0.01,
  /** 默认投票角色权重（当 memory-impacts 未配置时的 fallback） */
  VOTE_ROLE_FALLBACK: 0.4,
} as const;
