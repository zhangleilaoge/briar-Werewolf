// ============================
// 行为修正系统
// 阵营影响行动取向，压力和关系影响具体选择
// ============================

import { ACTION } from '@/lib/constants/action-constants';
import type { Alignment, Player, Relation, ActionType } from '@/types';
import {
  STRESS_EXTREMELY_CALM, STRESS_CALM, STRESS_MILDLY_TENSE_MIN, STRESS_MILDLY_TENSE_MAX,
  STRESS_ANXIOUS_MIN, STRESS_ANXIOUS_MAX, STRESS_NEAR_OVERLOAD,
  // 阵营行动取向常量
  ALIGNMENT_TENDENCY_LAWFUL_SUSPECT, ALIGNMENT_TENDENCY_CHAOTIC_SUSPECT, ALIGNMENT_TENDENCY_EVIL_SUSPECT,
  ALIGNMENT_TENDENCY_GOOD_DEFEND, ALIGNMENT_TENDENCY_EVIL_DEFEND,
  ALIGNMENT_TENDENCY_LAWFUL_CALL_VOTE, ALIGNMENT_TENDENCY_CHAOTIC_CALL_VOTE,
  ALIGNMENT_TENDENCY_LAWFUL_BLOCK_VOTE, ALIGNMENT_TENDENCY_CHAOTIC_BLOCK_VOTE,
  ALIGNMENT_TENDENCY_CHAOTIC_ACCUSE, ALIGNMENT_TENDENCY_LAWFUL_ACCUSE,
  ALIGNMENT_TENDENCY_CHAOTIC_EXTREME, ALIGNMENT_TENDENCY_LAWFUL_EXTREME, ALIGNMENT_TENDENCY_EVIL_EXTREME,
  ALIGNMENT_TENDENCY_CHAOTIC_CLAIM_PROPHET, ALIGNMENT_TENDENCY_LAWFUL_CLAIM_PROPHET,
  ALIGNMENT_TENDENCY_CHAOTIC_CLAIM_HUNTER, ALIGNMENT_TENDENCY_LAWFUL_CLAIM_HUNTER,
  ALIGNMENT_TENDENCY_CHAOTIC_REBUT, ALIGNMENT_TENDENCY_LAWFUL_REBUT,
  ALIGNMENT_TENDENCY_EVIL_JOIN_SUSPECT, ALIGNMENT_TENDENCY_GOOD_JOIN_SUSPECT,
  ALIGNMENT_TENDENCY_GOOD_JOIN_DEFEND, ALIGNMENT_TENDENCY_EVIL_JOIN_DEFEND,
  ALIGNMENT_TENDENCY_CHAOTIC_SILENCE, ALIGNMENT_TENDENCY_LAWFUL_SILENCE,
  ALIGNMENT_TENDENCY_LAWFUL_OBSERVE, ALIGNMENT_TENDENCY_CHAOTIC_OBSERVE,
  ALIGNMENT_TENDENCY_CHAOTIC_KILL, ALIGNMENT_TENDENCY_LAWFUL_KILL,
} from '@/types';

export interface BehaviorModifier {
  actionType: string;
  targetId: string | null;
  scoreDelta: number;
  reason: string;
}

// ---------- Alignment Action Tendency ----------
// 阵营影响行动取向：守序稳健 vs 混乱激进，善良保护 vs 邪恶攻击

export function getAlignmentBehaviorModifier(
  alignment: Alignment,
  action: ActionType | string
): number {
  const { law, good } = alignment;
  let mod = 0;

  // 守序 vs 混乱维度
  if (law === 'lawful') {
    switch (action) {
      case ACTION.SUSPECT: mod += ALIGNMENT_TENDENCY_LAWFUL_SUSPECT; break;
      case ACTION.CALL_VOTE: mod += ALIGNMENT_TENDENCY_LAWFUL_CALL_VOTE; break;
      case ACTION.BLOCK_VOTE: mod += ALIGNMENT_TENDENCY_LAWFUL_BLOCK_VOTE; break;
      case ACTION.ACCUSE: mod += ALIGNMENT_TENDENCY_LAWFUL_ACCUSE; break;
      case ACTION.EXCLUDE_ALL:
      case ACTION.BERSERKER_KILL: mod += ALIGNMENT_TENDENCY_LAWFUL_EXTREME; break;
      case ACTION.REBUT: mod += ALIGNMENT_TENDENCY_LAWFUL_REBUT; break;
      case ACTION.SILENCE: mod += ALIGNMENT_TENDENCY_LAWFUL_SILENCE; break;
      case ACTION.OBSERVE: mod += ALIGNMENT_TENDENCY_LAWFUL_OBSERVE; break;
      case ACTION.KILL: mod += ALIGNMENT_TENDENCY_LAWFUL_KILL; break;
      default: break;
    }
  } else if (law === 'chaotic') {
    switch (action) {
      case ACTION.SUSPECT: mod += ALIGNMENT_TENDENCY_CHAOTIC_SUSPECT; break;
      case ACTION.CALL_VOTE: mod += ALIGNMENT_TENDENCY_CHAOTIC_CALL_VOTE; break;
      case ACTION.BLOCK_VOTE: mod += ALIGNMENT_TENDENCY_CHAOTIC_BLOCK_VOTE; break;
      case ACTION.ACCUSE: mod += ALIGNMENT_TENDENCY_CHAOTIC_ACCUSE; break;
      case ACTION.EXCLUDE_ALL:
      case ACTION.BERSERKER_KILL: mod += ALIGNMENT_TENDENCY_CHAOTIC_EXTREME; break;
      case ACTION.REBUT: mod += ALIGNMENT_TENDENCY_CHAOTIC_REBUT; break;
      case ACTION.SILENCE: mod += ALIGNMENT_TENDENCY_CHAOTIC_SILENCE; break;
      case ACTION.OBSERVE: mod += ALIGNMENT_TENDENCY_CHAOTIC_OBSERVE; break;
      case ACTION.KILL: mod += ALIGNMENT_TENDENCY_CHAOTIC_KILL; break;
      default: break;
    }
  }

  // 善良 vs 邪恶维度
  if (good === 'good') {
    switch (action) {
      case ACTION.DEFEND:
      case ACTION.GUARANTEE: mod += ALIGNMENT_TENDENCY_GOOD_DEFEND; break;
      case ACTION.JOIN_SUSPECT: mod += ALIGNMENT_TENDENCY_GOOD_JOIN_SUSPECT; break;
      case ACTION.JOIN_DEFEND: mod += ALIGNMENT_TENDENCY_GOOD_JOIN_DEFEND; break;
      default: break;
    }
  } else if (good === 'evil') {
    switch (action) {
      case ACTION.DEFEND:
      case ACTION.GUARANTEE: mod += ALIGNMENT_TENDENCY_EVIL_DEFEND; break;
      case ACTION.SUSPECT: mod += ALIGNMENT_TENDENCY_EVIL_SUSPECT; break;
      case ACTION.EXCLUDE_ALL:
      case ACTION.BERSERKER_KILL: mod += ALIGNMENT_TENDENCY_EVIL_EXTREME; break;
      case ACTION.JOIN_SUSPECT: mod += ALIGNMENT_TENDENCY_EVIL_JOIN_SUSPECT; break;
      case ACTION.JOIN_DEFEND: mod += ALIGNMENT_TENDENCY_EVIL_JOIN_DEFEND; break;
      default: break;
    }
  }

  return mod;
}

// ---------- Claim Identity Alignment Tendency ----------
// 公布身份的阵营倾向（伪装身份系统核心）

export function getClaimIdentityAlignmentModifier(
  alignment: Alignment,
  claimedRole: string
): number {
  const { law, good } = alignment;
  let mod = 0;

  // 守序 vs 混乱维度：混乱更愿意跳身份
  if (law === 'lawful') {
    if (claimedRole === 'prophet') mod += ALIGNMENT_TENDENCY_LAWFUL_CLAIM_PROPHET;
    else if (claimedRole === 'hunter') mod += ALIGNMENT_TENDENCY_LAWFUL_CLAIM_HUNTER;
  } else if (law === 'chaotic') {
    if (claimedRole === 'prophet') mod += ALIGNMENT_TENDENCY_CHAOTIC_CLAIM_PROPHET;
    else if (claimedRole === 'hunter') mod += ALIGNMENT_TENDENCY_CHAOTIC_CLAIM_HUNTER;
  }

  // 邪恶阵营：跳好人身份有额外收益（伪装动机）
  if (good === 'evil') {
    mod += 15; // 邪恶阵营跳身份的基础收益
  }

  return mod;
}

// ---------- Stress Behavior Modifiers ----------

export function getStressBehaviorModifier(
  stress: number,
  action: ActionType | string
): number {
  // 压力范围：-10（极度冷静）到 +10（过载）

  // 定义各压力等级的修正值常量
  const EXTREMELY_CALM_MODS = { observe: 3, silence: -2, suspect: -1, accuse: -3, defend: 1, guarantee: 1, call_vote: -2, exclude_all: -3, berserker_kill: -5 };
  const CALM_MODS = { observe: 2, defend: 1, guarantee: 1, accuse: -1, exclude_all: -2 };
  const MILDLY_TENSE_MODS = { suspect: 2, accuse: 1, call_vote: 1, observe: -1, defend: -1 };
  const ANXIOUS_MODS = { accuse: 3, suspect: 2, call_vote: 2, defend: 2, rebut: 3, observe: -2, silence: 1, exclude_all: 2, berserker_kill: 3 };
  const NEAR_OVERLOAD_MODS = { accuse: 5, exclude_all: 4, berserker_kill: 5, call_vote: 3, rebut: 4, silence: 2, observe: -3, defend: -2, guarantee: -3, claim_identity: 2 };

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
  action: ActionType | string
): number {
  if (!relation) return 0;

  const { trust, friendly } = relation;

  // 关系修正系数
  const RELATION_WEIGHT_HIGH = 2;    // 高权重（保护、指控）
  const RELATION_WEIGHT_LOW = 4;     // 低权重（杀戮）

  switch (action) {
    case ACTION.DEFEND:
    case ACTION.GUARANTEE:
    case ACTION.BLOCK_VOTE:
      // 正面关系 = 更可能保护/担保
      return (friendly + trust) / RELATION_WEIGHT_HIGH;

    case ACTION.SUSPECT:
    case ACTION.ACCUSE:
    case ACTION.CALL_VOTE:
    case ACTION.VOTE:
      // 负面关系 = 更可能怀疑/指控/投票反对
      return -(friendly + trust) / RELATION_WEIGHT_HIGH;

    case ACTION.KILL:
      // 负面关系 = 稍微更可能杀戮（狼人）
      return -(friendly + trust) / RELATION_WEIGHT_LOW;

    case ACTION.CHECK:
      // 低信任 = 更可能查验（预言家）
      return -trust / RELATION_WEIGHT_HIGH;

    case ACTION.STEAL:
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
  relation?: Relation,
  claimedRole?: string
): { scoreDelta: number; reason: string } {
  let alignmentMod = getAlignmentBehaviorModifier(player.alignment, action);

  // 公布身份特殊处理：使用专门的阵营倾向
  if (action === ACTION.CLAIM_IDENTITY && claimedRole) {
    alignmentMod = getClaimIdentityAlignmentModifier(player.alignment, claimedRole);
  }

  const stressMod = getStressBehaviorModifier(player.stress, action);
  const relationMod = relation ? getRelationTargetModifier(relation, action) : 0;

  const totalDelta = alignmentMod + stressMod + relationMod;
  const reasons: string[] = [];

  if (alignmentMod !== 0) {
    reasons.push(`阵营倾向${alignmentMod > 0 ? '+' : ''}${alignmentMod}`);
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
