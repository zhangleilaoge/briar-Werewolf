// ============================================================
// 意图系统常量
// ============================================================

// ---------- 长期意图优先级基准 ----------
export const LONG_TERM_PRIORITY = {
  SURVIVE: 0.9,
  FIND_WOLF: 0.8,
  PROTECT_VILLAGER: 0.6,
  LEAD: 0.4,
  HIDE_IDENTITY: 0.8,
  MISLEAD: 0.7,
  REPORT_CHECK: 0.95,
} as const;

// ---------- 短期意图权重映射 ----------
export const SHORT_TERM_WEIGHT = {
  FACTOR: 1.0,
  OBSERVE_FACTOR: 0.6,
  LEAD_FACTOR: 0.8,
  HIDE_OBSERVE_FACTOR: 0.5,
} as const;

// ---------- 压力修正阈值 ----------
export const PRESSURE = {
  HIGH_THRESHOLD: 12,
  MEDIUM_THRESHOLD: 8,
  HIGH_AGGRESSIVE_MULTIPLIER: 1.5,
  HIGH_DEFENSIVE_MULTIPLIER: 0.6,
  MEDIUM_AGGRESSIVE_MULTIPLIER: 1.2,
  GENERAL_REDUCTION: 0.9,
} as const;

// ---------- 行动候选基础分数 ----------
export const CANDIDATE_BASE_SCORE = {
  SILENCE: 40,
  SLEEP: 50,
  CLAIM_IDENTITY: 50,
  REPORT_CHECK: 90,
  SUSPECT: 50,
  DEFEND: 60,
  OBSERVE: 40,
  CHAT: 35,
  TARGET_MATCH_BONUS: 20,
  OBSERVE_TARGET_MATCH: 15,
  DEFEND_TARGET_MATCH: 20,
} as const;

// ---------- 加权选择因子范围 ----------
export const BONUS = {
  MIN: 0.5,
  MAX: 2.0,
} as const;

// ---------- 随机选择 ----------
export const RANDOMNESS_DEFAULT = 0.15;

// ---------- 擅长度计算 ----------
export const PROFICIENCY = {
  BASE: 0.5,
  MULTIPLIER: 1.5,
} as const;

// ---------- 属性最大值 ----------
export const ATTRIBUTE_MAX = 10;

// ---------- 危机度阈值（触发保护意图） ----------
export const CRISIS_PROTECT_THRESHOLD = 4;

// ---------- 领导力权重 ----------
export const LEADERSHIP_WEIGHT = 0.05;

// ---------- 行动-属性映射 ----------
export interface ProficiencyMapEntry {
  action: string;
  primaryAttr: string;
  secondaryAttr?: string;
  description: string;
}

export const PROFICIENCY_MAP: ProficiencyMapEntry[] = [
  { action: 'silence', primaryAttr: 'cunning', description: '诡诈高更善于隐藏' },
  { action: 'claim_identity', primaryAttr: 'eloquence', secondaryAttr: 'leadership', description: '口才+领导力' },
  { action: 'observe', primaryAttr: 'observation', secondaryAttr: 'cunning', description: '观察力+诡诈' },
  { action: 'suspect', primaryAttr: 'logic', secondaryAttr: 'eloquence', description: '逻辑+口才' },
  { action: 'defend', primaryAttr: 'eloquence', secondaryAttr: 'affinity', description: '口才+亲和' },
  { action: 'chat', primaryAttr: 'eloquence', secondaryAttr: 'affinity', description: '口才+亲和' },
  { action: 'check', primaryAttr: 'observation', description: '观察力' },
  { action: 'kill', primaryAttr: 'cunning', secondaryAttr: 'leadership', description: '诡诈+领导力' },
  { action: 'sleep', primaryAttr: 'cunning', description: '诡诈' },
] as const;
