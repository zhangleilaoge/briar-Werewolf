import type { Player } from '@/types';
import type { Attributes } from '@/types';

// 行动所需的核心属性映射（可扩展，非硬编码）
import {
  CAPABILITY_FACTOR_EXCELLENT,
  CAPABILITY_FACTOR_GOOD,
  CAPABILITY_FACTOR_AVERAGE,
  CAPABILITY_FACTOR_POOR,
  CAPABILITY_FACTOR_VERY_POOR,
  CAPABILITY_THRESHOLD_EXCELLENT,
  CAPABILITY_THRESHOLD_GOOD,
  CAPABILITY_THRESHOLD_AVERAGE,
  CAPABILITY_THRESHOLD_POOR,
  CAPABILITY_PRIMARY_WEIGHT,
  CAPABILITY_SECONDARY_WEIGHT,
} from '@/lib/constants/mind';

export interface ActionCapability {
  primaryAttribute: keyof Attributes;    // 主要属性
  secondaryAttribute?: keyof Attributes; // 次要属性（可选）
  difficulty: number;                    // 基础难度（10-20）
  description: string;                  // 描述（用于UI展示）
}

// 行动能力配置表（可扩展）
export const ACTION_CAPABILITIES: Record<string, ActionCapability> = {
  'silence': {
    primaryAttribute: 'stealth',
    difficulty: 8,
    description: '沉默需要隐蔽能力来隐藏意图',
  },
  'observe': {
    primaryAttribute: 'insight',
    secondaryAttribute: 'stealth',
    difficulty: 12,
    description: '观察需要洞察力和隐蔽性',
  },
  'suspect': {
    primaryAttribute: 'insight',
    secondaryAttribute: 'logic',
    difficulty: 10,
    description: '怀疑需要洞察力和逻辑推理',
  },
  'accuse': {
    primaryAttribute: 'logic',
    secondaryAttribute: 'insight',
    difficulty: 14,
    description: '强烈指认需要逻辑和证据',
  },
  'defend': {
    primaryAttribute: 'affinity',
    secondaryAttribute: 'logic',
    difficulty: 10,
    description: '辩护需要亲和力和逻辑',
  },
  'guarantee': {
    primaryAttribute: 'affinity',
    secondaryAttribute: 'insight',
    difficulty: 14,
    description: '担保需要亲和力和洞察力',
  },
  'call_vote': {
    primaryAttribute: 'leadership',
    secondaryAttribute: 'logic',
    difficulty: 12,
    description: '号召投票需要领导力和逻辑',
  },
  'block_vote': {
    primaryAttribute: 'leadership',
    secondaryAttribute: 'affinity',
    difficulty: 12,
    description: '阻止投票需要领导力和亲和力',
  },
  'exclude_all': {
    primaryAttribute: 'logic',
    secondaryAttribute: 'leadership',
    difficulty: 16,
    description: '全员排除需要逻辑和领导力',
  },
  'claim_identity': {
    primaryAttribute: 'deception',
    secondaryAttribute: 'leadership',
    difficulty: 12,
    description: '公布身份需要诡诈或领导力',
  },
  'rebut': {
    primaryAttribute: 'logic',
    secondaryAttribute: 'affinity',
    difficulty: 12,
    description: '反驳需要逻辑和亲和力',
  },
  'join_suspect': {
    primaryAttribute: 'insight',
    difficulty: 10,
    description: '一同怀疑需要洞察力',
  },
  'join_defend': {
    primaryAttribute: 'affinity',
    difficulty: 10,
    description: '一同袒护需要亲和力',
  },
};

// 计算行动能力匹配度
export function calculateCapabilityMatch(
  action: string,
  player: Player
): { matchScore: number; primaryValue: number; secondaryValue: number | null; difficulty: number; description: string } {
  const capability = ACTION_CAPABILITIES[action];
  if (!capability) {
    return { matchScore: CAPABILITY_THRESHOLD_AVERAGE, primaryValue: 10, secondaryValue: null, difficulty: 10, description: '未知行动' };
  }

  const primaryValue = player.attributes[capability.primaryAttribute];
  const secondaryValue = capability.secondaryAttribute 
    ? player.attributes[capability.secondaryAttribute] 
    : null;

  // 计算匹配度：基于属性值与难度的对比
  // 属性值 10 为基准（平均水平）
  const primaryMatch = Math.min(1, Math.max(0, primaryValue / capability.difficulty));
  const secondaryMatch = secondaryValue !== null 
    ? Math.min(1, Math.max(0, secondaryValue / capability.difficulty)) * CAPABILITY_SECONDARY_WEIGHT  // 次要属性权重30%
    : 0;

  // 综合匹配度：主要属性70% + 次要属性30%
  const matchScore = primaryMatch * CAPABILITY_PRIMARY_WEIGHT + secondaryMatch;

  return {
    matchScore,
    primaryValue,
    secondaryValue,
    difficulty: capability.difficulty,
    description: capability.description,
  };
}

// 计算能力因子（用于乘法评分系统）
export function calculateCapabilityFactor(
  action: string,
  player: Player
): number {
  const { matchScore } = calculateCapabilityMatch(action, player);
  
  // 匹配度 -> 因子：
  // 匹配度 > 0.8 -> 1.3（擅长，加成）
  // 匹配度 0.5-0.8 -> 1.0（正常）
  // 匹配度 < 0.5 -> 0.6（不擅长，减成）
  // 匹配度 < 0.3 -> 0.3（很不擅长，大幅减成）
  
  if (matchScore > CAPABILITY_THRESHOLD_EXCELLENT) return CAPABILITY_FACTOR_EXCELLENT;
  if (matchScore > CAPABILITY_THRESHOLD_GOOD) return CAPABILITY_FACTOR_GOOD;
  if (matchScore > CAPABILITY_THRESHOLD_AVERAGE) return CAPABILITY_FACTOR_AVERAGE;
  if (matchScore > CAPABILITY_THRESHOLD_POOR) return CAPABILITY_FACTOR_POOR;
  return CAPABILITY_FACTOR_VERY_POOR;
}

// 获取行动推荐属性（用于UI展示）
export function getActionRecommendedAttributes(action: string): { primary: string; secondary: string | null } {
  const capability = ACTION_CAPABILITIES[action];
  if (!capability) return { primary: '未知', secondary: null };
  
  const attrNames: Record<string, string> = {
    affinity: '亲和',
    logic: '逻辑',
    leadership: '领导',
    deception: '诡诈',
    stealth: '隐蔽',
    insight: '洞察',
  };

  return {
    primary: attrNames[capability.primaryAttribute] || capability.primaryAttribute,
    secondary: capability.secondaryAttribute ? (attrNames[capability.secondaryAttribute] || capability.secondaryAttribute) : null,
  };
}
