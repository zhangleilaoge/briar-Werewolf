// ============================
// 行为修正系统
// 阵营、压力和关系影响 AI 的行为选择
// ============================

import type { Alignment, Player, Relation } from '@/types';
import {
  STRESS_EXTREMELY_CALM, STRESS_CALM, STRESS_MILDLY_TENSE_MIN, STRESS_MILDLY_TENSE_MAX,
  STRESS_ANXIOUS_MIN, STRESS_ANXIOUS_MAX, STRESS_NEAR_OVERLOAD,
  ALIGNMENT_MOD_GOOD_DEFEND, ALIGNMENT_MOD_EVIL_DEFEND,
  ALIGNMENT_MOD_LAWFUL_ACCUSE, ALIGNMENT_MOD_CHAOTIC_ACCUSE, ALIGNMENT_MOD_EVIL_ACCUSE,
  ALIGNMENT_MOD_LAWFUL_OBSERVE, ALIGNMENT_MOD_CHAOTIC_OBSERVE,
  ALIGNMENT_MOD_CHAOTIC_SPEAK, ALIGNMENT_MOD_CHAOTIC_EVIL_EXTREME,
  ALIGNMENT_MOD_CHAOTIC_EXTREME, ALIGNMENT_MOD_EVIL_EXTREME, ALIGNMENT_MOD_NON_EXTREME,
  ALIGNMENT_MOD_LAWFUL_BLOCK_VOTE, ALIGNMENT_MOD_CHAOTIC_REBUT,
  ALIGNMENT_MOD_EVIL_JOIN_SUSPECT, ALIGNMENT_MOD_GOOD_JOIN_SUSPECT,
  ALIGNMENT_MOD_GOOD_JOIN_DEFEND, ALIGNMENT_MOD_EVIL_JOIN_DEFEND,
  ALIGNMENT_MOD_CHAOTIC_KILL, ALIGNMENT_MOD_LAWFUL_CHECK,
} from '@/types';

export interface BehaviorModifier {
  actionType: string;
  targetId: string | null;
  scoreDelta: number;
  reason: string;
}

// ---------- Alignment Behavior Modifiers ----------

export function getAlignmentBehaviorModifier(
  alignment: Alignment,
  action: 'suspect' | 'accuse' | 'defend' | 'guarantee' | 'observe' | 'speak' | 'call_vote' | 'block_vote' | 'exclude_all' | 'berserker_kill' | 'kill' | 'check' | 'steal' | 'inspect' | 'vote' | 'rebut' | 'join_suspect' | 'join_defend' | 'claim_identity' | 'thank' | 'reveal_info' | string
): number {
  const { law, good } = alignment;

  switch (action) {
    case 'defend':
    case 'guarantee':
      // 善良：保护行动加成；邪恶：仅在有利时保护
      if (good === 'good') return ALIGNMENT_MOD_GOOD_DEFEND;
      if (good === 'evil') return ALIGNMENT_MOD_EVIL_DEFEND;
      return 0;

    case 'suspect':
    case 'accuse':
    case 'call_vote':
      // 守序：系统性指控；混乱：激进指控
      if (law === 'lawful') return ALIGNMENT_MOD_LAWFUL_ACCUSE;
      if (law === 'chaotic') return ALIGNMENT_MOD_CHAOTIC_ACCUSE;
      if (good === 'evil') return ALIGNMENT_MOD_EVIL_ACCUSE;
      return 0;

    case 'observe':
      // 守序：仔细观察；混乱：不耐烦，减少观察
      if (law === 'lawful') return ALIGNMENT_MOD_LAWFUL_OBSERVE;
      if (law === 'chaotic') return ALIGNMENT_MOD_CHAOTIC_OBSERVE;
      return 0;

    case 'speak':
      // 混乱：冲动发言；守序：谨慎发言
      if (law === 'chaotic') return ALIGNMENT_MOD_CHAOTIC_SPEAK;
      return 0;

    case 'exclude_all':
    case 'berserker_kill':
      // 混乱邪恶：极端行动大幅加成
      if (law === 'chaotic' && good === 'evil') return ALIGNMENT_MOD_CHAOTIC_EVIL_EXTREME;
      if (law === 'chaotic') return ALIGNMENT_MOD_CHAOTIC_EXTREME;
      if (good === 'evil') return ALIGNMENT_MOD_EVIL_EXTREME;
      return ALIGNMENT_MOD_NON_EXTREME;

    case 'block_vote':
      // 守序：控制流程加成
      if (law === 'lawful') return ALIGNMENT_MOD_LAWFUL_BLOCK_VOTE;
      return 0;

    case 'rebut':
      // 混乱：情绪化反驳；守序：逻辑反驳（相同分数，不同风格）
      if (law === 'chaotic') return ALIGNMENT_MOD_CHAOTIC_REBUT;
      return 0;

    case 'join_suspect':
      // 邪恶：跟风怀疑；善良：不太可能落井下石
      if (good === 'evil') return ALIGNMENT_MOD_EVIL_JOIN_SUSPECT;
      if (good === 'good') return ALIGNMENT_MOD_GOOD_JOIN_SUSPECT;
      return 0;

    case 'join_defend':
      // 善良：团结一致；邪恶：仅在有用时辩护
      if (good === 'good') return ALIGNMENT_MOD_GOOD_JOIN_DEFEND;
      if (good === 'evil') return ALIGNMENT_MOD_EVIL_JOIN_DEFEND;
      return 0;

    case 'kill':
      // 混乱：冲动杀戮；守序：计算杀戮
      if (law === 'chaotic') return ALIGNMENT_MOD_CHAOTIC_KILL;
      return 0;

    case 'check':
      // 守序：系统性调查
      if (law === 'lawful') return ALIGNMENT_MOD_LAWFUL_CHECK;
      return 0;

    case 'vote':
      // 投票更多受关系影响，而非阵营
      return 0;

    default:
      return 0;
  }
}

// ---------- Stress Behavior Modifiers ----------

export function getStressBehaviorModifier(
  stress: number,
  action: 'suspect' | 'accuse' | 'defend' | 'guarantee' | 'observe' | 'speak' | 'call_vote' | 'block_vote' | 'exclude_all' | 'berserker_kill' | 'kill' | 'check' | 'steal' | 'inspect' | 'vote' | 'rebut' | 'join_suspect' | 'join_defend' | 'claim_identity' | 'thank' | 'reveal_info' | string
): number {
  // 压力范围：-10（极度冷静）到 +10（过载）

  // 定义各压力等级的修正值常量
  const EXTREMELY_CALM_MODS = { observe: 3, speak: -2, suspect: -1, accuse: -3, defend: 1, guarantee: 1, call_vote: -2, exclude_all: -3, berserker_kill: -5 };
  const CALM_MODS = { observe: 2, defend: 1, guarantee: 1, accuse: -1, exclude_all: -2 };
  const MILDLY_TENSE_MODS = { suspect: 2, accuse: 1, call_vote: 1, observe: -1, defend: -1 };
  const ANXIOUS_MODS = { accuse: 3, suspect: 2, call_vote: 2, defend: 2, rebut: 3, observe: -2, speak: 1, exclude_all: 2, berserker_kill: 3 };
  const NEAR_OVERLOAD_MODS = { accuse: 5, exclude_all: 4, berserker_kill: 5, call_vote: 3, rebut: 4, speak: 2, observe: -3, defend: -2, guarantee: -3, claim_identity: 2 };

  if (stress <= STRESS_EXTREMELY_CALM) {
    // 极度冷静：有条理、耐心、不激进
    return EXTREMELY_CALM_MODS[action as keyof typeof EXTREMELY_CALM_MODS] ?? 0;
  }

  if (stress <= STRESS_CALM) {
    // 冷静：理性、保护性
    return CALM_MODS[action as keyof typeof CALM_MODS] ?? 0;
  }

  if (stress >= STRESS_MILDLY_TENSE_MIN && stress <= STRESS_MILDLY_TENSE_MAX) {
    // 轻微紧张：更怀疑、更活跃
    return MILDLY_TENSE_MODS[action as keyof typeof MILDLY_TENSE_MODS] ?? 0;
  }

  if (stress >= STRESS_ANXIOUS_MIN && stress <= STRESS_ANXIOUS_MAX) {
    // 焦虑：激进、防御、冲动
    return ANXIOUS_MODS[action as keyof typeof ANXIOUS_MODS] ?? 0;
  }

  if (stress >= STRESS_NEAR_OVERLOAD) {
    // 接近/过载：不稳定、绝望、可能冻结或爆发
    return NEAR_OVERLOAD_MODS[action as keyof typeof NEAR_OVERLOAD_MODS] ?? 0;
  }

  // 正常范围（-1 到 +1）：无修正
  return 0;
}

// ---------- Relation-Based Target Preference ----------

export function getRelationTargetModifier(
  relation: Relation | undefined,
  action: 'suspect' | 'accuse' | 'defend' | 'guarantee' | 'call_vote' | 'block_vote' | 'vote' | 'kill' | 'check' | 'steal' | string
): number {
  if (!relation) return 0;

  const { trust, friendly } = relation;

  // 关系修正系数
  const RELATION_WEIGHT_HIGH = 2;    // 高权重（保护、指控）
  const RELATION_WEIGHT_LOW = 4;     // 低权重（杀戮）

  switch (action) {
    case 'defend':
    case 'guarantee':
    case 'block_vote':
      // 正面关系 = 更可能保护/担保
      return (friendly + trust) / RELATION_WEIGHT_HIGH;

    case 'suspect':
    case 'accuse':
    case 'call_vote':
    case 'vote':
      // 负面关系 = 更可能怀疑/指控/投票反对
      return -(friendly + trust) / RELATION_WEIGHT_HIGH;

    case 'kill':
      // 负面关系 = 稍微更可能杀戮（狼人）
      return -(friendly + trust) / RELATION_WEIGHT_LOW;

    case 'check':
      // 低信任 = 更可能查验（预言家）
      return -trust / RELATION_WEIGHT_HIGH;

    case 'steal':
      // 低信任 = 更可能偷窃（窃贼）
      return -trust / RELATION_WEIGHT_HIGH;

    default:
      return 0;
  }
}

// ---------- Combined Modifier for Strategy Use ----------

export function calculateBehaviorScoreDelta(
  player: Player,
  action: string,
  _targetId: string | null,
  relation?: Relation
): { scoreDelta: number; reason: string } {
  const alignmentMod = getAlignmentBehaviorModifier(player.alignment, action);
  const stressMod = getStressBehaviorModifier(player.stress, action);
  const relationMod = relation ? getRelationTargetModifier(relation, action) : 0;

  const totalDelta = alignmentMod + stressMod + relationMod;
  const reasons: string[] = [];

  if (alignmentMod !== 0) {
    reasons.push(`阵营修正${alignmentMod > 0 ? '+' : ''}${alignmentMod}`);
  }
  if (stressMod !== 0) {
    reasons.push(`压力修正${stressMod > 0 ? '+' : ''}${stressMod}`);
  }
  if (relationMod !== 0) {
    reasons.push(`关系修正${relationMod > 0 ? '+' : ''}${relationMod.toFixed(1)}`);
  }

  return {
    scoreDelta: totalDelta,
    reason: reasons.length > 0 ? `(${reasons.join('，')})` : '',
  };
}
