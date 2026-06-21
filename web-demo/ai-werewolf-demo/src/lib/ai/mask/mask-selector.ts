// ============================================================
// Mask Selector — 面具选择逻辑 + 面具-行动适配度表
// ============================================================

import type { Player } from '@/types';
import type { BeliefSystem } from '../belief-system';
import type { SocialContext } from '../mind/types';
import type { StrategyMask, MaskState } from './types';
import { ACTION } from '@/lib/constants/action-constants';

// ========== 面具-行动适配度表 ==========
// 所有身份共用同一套适配度，差异由基础分和目标选择体现

export const MASK_COMPATIBILITY: Record<string, Record<string, number>> = {
  [ACTION.SILENCE]:       { conceal: 0.90, manipulative: 0.40, attack: 0.30, desperate: 0.10, cut_loss: 0.20, protective: 0.30, defensive: 0.80 },
  [ACTION.OBSERVE]:       { conceal: 0.80, manipulative: 0.70, attack: 0.50, desperate: 0.20, cut_loss: 0.40, protective: 0.50, defensive: 0.60 },
  [ACTION.SUSPECT]:       { conceal: 0.40, manipulative: 0.80, attack: 0.90, desperate: 0.80, cut_loss: 0.70, protective: 0.40, defensive: 0.30 },
  [ACTION.ACCUSE]:        { conceal: 0.10, manipulative: 0.60, attack: 0.80, desperate: 0.90, cut_loss: 0.80, protective: 0.20, defensive: 0.20 },
  [ACTION.DEFEND]:        { conceal: 0.70, manipulative: 0.50, attack: 0.20, desperate: 0.30, cut_loss: 0.40, protective: 0.90, defensive: 0.60 },
  [ACTION.GUARANTEE]:     { conceal: 0.60, manipulative: 0.40, attack: 0.20, desperate: 0.30, cut_loss: 0.20, protective: 0.85, defensive: 0.50 },
  [ACTION.CALL_VOTE]:     { conceal: 0.20, manipulative: 0.80, attack: 0.90, desperate: 0.90, cut_loss: 0.80, protective: 0.50, defensive: 0.30 },
  [ACTION.BLOCK_VOTE]:    { conceal: 0.60, manipulative: 0.50, attack: 0.40, desperate: 0.20, cut_loss: 0.50, protective: 0.80, defensive: 0.50 },
  [ACTION.EXCLUDE_ALL]:   { conceal: 0.30, manipulative: 0.70, attack: 0.40, desperate: 0.60, cut_loss: 0.50, protective: 0.30, defensive: 0.30 },
  [ACTION.CLAIM_IDENTITY]:{ conceal: 0.30, manipulative: 0.50, attack: 0.60, desperate: 0.70, cut_loss: 0.40, protective: 0.40, defensive: 0.20 },
};

// ========== 面具选择函数 ==========
// 面具选择 = 局势评估的"分类器"
// 输入: belief + socialContext, 输出: 离散策略标签

export function selectMask(
  self: Player,
  belief: BeliefSystem,
  allPlayers: Player[],
  socialContext: SocialContext,
  round: number
): MaskState {
  const myCrisis = belief.getIdentityCrisis();
  const aliveWolves = allPlayers.filter(p => p.team === 'werewolf' && p.alive).length;
  const aliveVillagers = allPlayers.filter(p => p.team !== 'werewolf' && p.alive).length;
  const totalAlive = aliveWolves + aliveVillagers;
  const wolfRatio = totalAlive > 0 ? aliveWolves / totalAlive : 0.5;

  // 队友危机（仅狼人相关）
  const teammates = allPlayers.filter(p => p.id !== self.id && p.team === self.team && p.alive);
  const teammateCrisis = teammates.length > 0
    ? Math.max(...teammates.map(p => belief.getPlayerIdentityCrisis(p.id)))
    : 0;

  // 信任目标被攻击（通用，所有身份都可能有）
  const trustedBeingAttacked = allPlayers.filter(p => {
    if (p.id === self.id || !p.alive) return false;
    const relation = belief.getRelation(p.id);
    if (!relation || relation.trust <= 3) return false;
    // 检查是否被攻击
    const isAttacked = isBeingAttacked(p.id, socialContext);
    return isAttacked;
  });

  // 按优先级判断（从高到低）
  if (trustedBeingAttacked.length > 0 && myCrisis < 0.5) {
    return { currentMask: 'protective', selectedRound: round, selectionReason: '信任目标被攻击' };
  }
  if (wolfRatio < 0.4 && myCrisis < 0.5) {
    return { currentMask: 'desperate', selectedRound: round, selectionReason: '狼人大劣势' };
  }
  if (teammateCrisis > 0.8 && myCrisis < 0.5) {
    return { currentMask: 'cut_loss', selectedRound: round, selectionReason: '队友极度身份危机' };
  }
  if (myCrisis > 0.6) {
    return { currentMask: 'defensive', selectedRound: round, selectionReason: '自身身份危机高' };
  }
  if (socialContext.situation.tensionLevel > 0.7 && myCrisis < 0.4) {
    return { currentMask: 'manipulative', selectedRound: round, selectionReason: '场面混乱可搅局' };
  }
  if (wolfRatio > 0.5) {
    return { currentMask: 'attack', selectedRound: round, selectionReason: '狼人优势' };
  }
  return { currentMask: 'conceal', selectedRound: round, selectionReason: '默认潜伏' };
}

// 辅助函数：判断某玩家是否被攻击
function isBeingAttacked(playerId: string, socialContext: SocialContext): boolean {
  const facts = socialContext.informationState.knownFacts;
  return facts.some(f => {
    if (f.type !== 'action') return false;
    const content = f.content as { type?: string; targetId?: string } | undefined;
    if (!content) return false;
    return (
      content.targetId === playerId &&
      (content.type === ACTION.SUSPECT || content.type === ACTION.ACCUSE || content.type === ACTION.CALL_VOTE)
    );
  });
}
