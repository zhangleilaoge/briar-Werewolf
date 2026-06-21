// ============================================================
// Mask System — 策略面具类型定义
// ============================================================

import type { Player } from '@/types';
import type { BeliefSystem } from '../belief-system';
import type { SocialContext } from '../mind/types';

/** 策略面具类型：Agent 在当前局势下选择的策略姿态 */
export type StrategyMask =
  | 'conceal'        // 逃避：低调行事，不引起注意
  | 'manipulative'   // 操纵：间接引导、分散怀疑、制造不信任
  | 'attack'         // 进攻：直接攻击、怀疑、指认
  | 'desperate'      // 绝境：不惜暴露也要淘汰人
  | 'cut_loss'       // 切割：牺牲队友保全自己
  | 'protective'     // 保护：保护信任目标、挡刀、辩护
  | 'defensive';     // 防御：自保、沉默、不表态

/** 面具状态 */
export interface MaskState {
  currentMask: StrategyMask;
  selectedRound: number;
  selectionReason: string;
}

/** 面具-行动适配度表项 */
export interface MaskCompatibilityEntry {
  action: string;
  compatibility: Record<StrategyMask, number>; // 0.0-1.0
}
