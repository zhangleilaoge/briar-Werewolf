// ========== 心智系统评分常量 ==========

import { IDENTITY_CRISIS_LOW_THRESHOLD, IDENTITY_CRISIS_HIGH_THRESHOLD, IDENTITY_CRISIS_CRITICAL_THRESHOLD } from './strategy-thresholds';

// 意图生成基础分（纯场景描述分数，价值观影响统一由 mindMultiplier 的 valueAlignment 处理）
export const INTENTION_BASE_SCORE_SELF_PRESERVATION = 500;
export const INTENTION_BASE_SCORE_INFORMATION = 200;
export const INTENTION_BASE_SCORE_SOCIAL = 300;
export const INTENTION_BASE_SCORE_ATTACK = 400;
export const INTENTION_BASE_SCORE_PROTECTION = 250;
export const INTENTION_BASE_SCORE_DEFAULT = 100;
export const INTENTION_BASE_SCORE_DEFAULT_OBSERVE = 80;

// ========== 信心值常量 ==========
export const CONFIDENCE_VERY_HIGH = 0.9;
export const CONFIDENCE_HIGH = 0.8;
export const CONFIDENCE_MEDIUM_HIGH = 0.7;
export const CONFIDENCE_MEDIUM = 0.6;
export const CONFIDENCE_LOW_MEDIUM = 0.5;
export const CONFIDENCE_LOW = 0.4;
export const CONFIDENCE_VERY_LOW = 0.3;

// ========== 心智系统阈值常量 ==========

// 概率阈值
export const PROB_THRESHOLD_HIGH = 0.7;
export const PROB_THRESHOLD_MEDIUM = 0.5;
export const PROB_THRESHOLD_LOW = 0.4;
export const PROB_THRESHOLD_VERY_LOW = 0.3;

// 信息丰富度阈值
export const INFORMATION_RICHNESS_THRESHOLD = 0.5;
export const INFORMATION_RICHNESS_HIGH = 0.8;

// 身份危机阈值（统一使用 strategy-thresholds.ts 中的定义）
export const CRISIS_THRESHOLD_CRITICAL = IDENTITY_CRISIS_CRITICAL_THRESHOLD;
export const CRISIS_THRESHOLD_HIGH = IDENTITY_CRISIS_HIGH_THRESHOLD;
export const CRISIS_THRESHOLD_LOW = IDENTITY_CRISIS_LOW_THRESHOLD;

// 场面紧张度阈值
export const TENSION_THRESHOLD_HIGH = 0.7;

// 信任阈值
export const TRUST_THRESHOLD_HIGH = 5;
export const TRUST_THRESHOLD_MEDIUM = 3;

// 属性阈值
export const ATTRIBUTE_LEADERSHIP_HIGH = 6;

// 攻击次数阈值
export const ATTACK_COUNT_THRESHOLD = 2;

// ========== 心智模拟常量 ==========

// 心智模拟默认分数
export const SIMULATION_DEFAULT_GOAL_ALIGNMENT = 0.5;
export const SIMULATION_DEFAULT_EXPOSURE_RISK = 0.5;

// 心智模拟具体值
export const SIMULATION_EXPOSURE_RISK_HIGH = 0.7;
export const SIMULATION_EXPOSURE_RISK_MEDIUM = 0.6;
export const SIMULATION_EXPOSURE_RISK_LOW = 0.3;
export const SIMULATION_EXPOSURE_RISK_VERY_LOW = 0.2;
export const SIMULATION_GOAL_ALIGNMENT_HIGH = 0.9;
export const SIMULATION_GOAL_ALIGNMENT_MEDIUM = 0.8;
export const SIMULATION_GOAL_ALIGNMENT_LOW = 0.4;
export const SIMULATION_GOAL_ALIGNMENT_VERY_LOW = 0.3;
export const SIMULATION_CONFIDENCE_HIGH = 0.8;
export const SIMULATION_CONFIDENCE_MEDIUM = 0.6;
export const SIMULATION_CONFIDENCE_LOW = 0.5;

// 心智模拟感知变化值
export const SIMULATION_PERCEPTION_POSITIVE = 0.2;
export const SIMULATION_PERCEPTION_POSITIVE_SMALL = 0.1;
export const SIMULATION_PERCEPTION_NEGATIVE_SMALL = -0.1;
export const SIMULATION_PERCEPTION_NEGATIVE = -0.15;
export const SIMULATION_PERCEPTION_NEGATIVE_MEDIUM = -0.2;
export const SIMULATION_PERCEPTION_NEGATIVE_LARGE = -0.3;

// 心智模拟曝光风险（补充）
export const SIMULATION_EXPOSURE_RISK_MODERATE = 0.4;

// ========== 时机评估常量 ==========

// 时机评估默认分数
export const TIMING_DEFAULT_SCORE = 0.5;

// 时机评估具体值
export const TIMING_URGENCY_HIGH = 0.9;
export const TIMING_URGENCY_MEDIUM = 0.7;
export const TIMING_URGENCY_LOW = 0.4;
export const TIMING_URGENCY_VERY_LOW = 0.3;
export const TIMING_URGENCY_MINIMAL = 0.2;

export const TIMING_CREDIBILITY_HIGH = 0.9;
export const TIMING_CREDIBILITY_MEDIUM = 0.7;
export const TIMING_CREDIBILITY_LOW = 0.5;
export const TIMING_CREDIBILITY_VERY_LOW = 0.4;
export const TIMING_CREDIBILITY_MINIMAL = 0.3;

export const TIMING_RISK_HIGH = 0.8;
export const TIMING_RISK_MEDIUM = 0.6;
export const TIMING_RISK_LOW = 0.5;
export const TIMING_RISK_VERY_LOW = 0.4;
export const TIMING_RISK_MINIMAL = 0.3;

export const TIMING_IMPACT_HIGH = 0.8;
export const TIMING_IMPACT_MEDIUM = 0.7;
export const TIMING_IMPACT_LOW = 0.5;
export const TIMING_IMPACT_VERY_LOW = 0.4;
export const TIMING_IMPACT_MINIMAL = 0.3;

// 时机评估权重
export const TIMING_WEIGHT_URGENCY = 0.3;
export const TIMING_WEIGHT_CREDIBILITY = 0.25;
export const TIMING_WEIGHT_RISK = 0.2;
export const TIMING_WEIGHT_IMPACT = 0.15;
export const TIMING_WEIGHT_OPPORTUNITY_COST = 0.1;

// ========== 社交情境常量 ==========

// 行动强度
export const ACTION_INTENSITY_ACCUSE = 3;
export const ACTION_INTENSITY_SUSPECT = 2;
export const ACTION_INTENSITY_JOIN_SUSPECT = 1.5;
export const ACTION_INTENSITY_DEFEND = 1;
export const ACTION_INTENSITY_CALL_VOTE = 2.5;
export const ACTION_INTENSITY_BLOCK_VOTE = 2;
export const ACTION_INTENSITY_DEFAULT = 0.5;

// 身份危机因子
export const CRISIS_FACTOR_SILENCE_CRITICAL = 1.5;
export const CRISIS_FACTOR_OBSERVE_CRITICAL = 1.3;
export const CRISIS_FACTOR_DEFEND_CRITICAL = 1.4;
export const CRISIS_FACTOR_REBUT_CRITICAL = 1.6;
export const CRISIS_FACTOR_ACCUSE_CRITICAL = 0.5;
export const CRISIS_FACTOR_CALL_VOTE_CRITICAL = 0.4;
export const CRISIS_FACTOR_CLAIM_IDENTITY_CRITICAL = 0.3;
export const CRISIS_FACTOR_DEFAULT_CRITICAL = 1.0;

export const CRISIS_FACTOR_SILENCE_HIGH = 1.3;
export const CRISIS_FACTOR_DEFEND_HIGH = 1.2;
export const CRISIS_FACTOR_ACCUSE_HIGH = 0.7;
export const CRISIS_FACTOR_CALL_VOTE_HIGH = 0.6;
export const CRISIS_FACTOR_DEFAULT_HIGH = 1.0;

// 关系因子
export const RELATION_FACTOR_DEFEND_TRUSTED = 1.4;
export const RELATION_FACTOR_GUARANTEE_TRUSTED = 1.5;
export const RELATION_FACTOR_ACCUSE_TRUSTED = 0.4;
export const RELATION_FACTOR_ACCUSE_SUSPICIOUS = 1.5;
export const RELATION_FACTOR_SUSPECT_SUSPICIOUS = 1.3;
export const RELATION_FACTOR_DEFEND_SUSPICIOUS = 0.3;
export const RELATION_FACTOR_DEFAULT = 1.0;

// 社交情境加成
export const SOCIAL_BONUS_SILENCE_HIGH_TENSION = 0.7;
export const SOCIAL_BONUS_DEFEND_TARGET = 1.3;
export const SOCIAL_BONUS_CALL_VOTE_LEADER = 1.2;
export const SOCIAL_BONUS_OBSERVE_RICH_INFO = 0.8;
export const SOCIAL_BONUS_DEFAULT = 1.0;

// ========== 能力匹配常量 ==========

// 能力匹配因子
export const CAPABILITY_FACTOR_EXCELLENT = 1.3;
export const CAPABILITY_FACTOR_GOOD = 1.1;
export const CAPABILITY_FACTOR_AVERAGE = 1.0;
export const CAPABILITY_FACTOR_POOR = 0.7;
export const CAPABILITY_FACTOR_VERY_POOR = 0.4;

// 能力匹配阈值
export const CAPABILITY_THRESHOLD_EXCELLENT = 0.8;
export const CAPABILITY_THRESHOLD_GOOD = 0.6;
export const CAPABILITY_THRESHOLD_AVERAGE = 0.4;
export const CAPABILITY_THRESHOLD_POOR = 0.3;

// 能力匹配权重
export const CAPABILITY_PRIMARY_WEIGHT = 0.7;
export const CAPABILITY_SECONDARY_WEIGHT = 0.3;

// ========== 乘法系统常量 ==========

export const MIND_MULTIPLIER_BASE = 0.5;
export const MIND_MULTIPLIER_SCALE = 0.5;
export const MIND_MULTIPLIER_SOCIAL_BASE = 0.8;
export const MIND_MULTIPLIER_SOCIAL_SCALE = 0.2;

// ========== 温度系统常量 ==========

export const TEMPERATURE_BASE = 1.0;
export const TEMPERATURE_STRESS_LOW = 0.4;
export const TEMPERATURE_STRESS_HIGH = 0.8;
export const TEMPERATURE_CRISIS_CRITICAL = 0.3;
export const TEMPERATURE_CRISIS_HIGH = 0.15;
export const TEMPERATURE_WEREWOLF = 0.2;
export const TEMPERATURE_LOGIC_SCALE = 0.02;
export const TEMPERATURE_STEALTH_SCALE = 0.02;
export const TEMPERATURE_ANXIOUS = 0.3;
export const TEMPERATURE_CONFIDENT = -0.2;
export const TEMPERATURE_ANGRY = 0.4;
export const TEMPERATURE_MIN = 0.3;
export const TEMPERATURE_MAX = 2.5;

// ========== 价值观系统常量 ==========

export const VALUE_BASE = 0.5;
export const VALUE_SELF_PRESERVATION_BASE = 0.6;
export const VALUE_ATTRIBUTE_SCALE = 0.02;
export const VALUE_ATTRIBUTE_SCALE_LOW = 0.01;
export const VALUE_CLAMP_MIN = 0;
export const VALUE_CLAMP_MAX = 1;

