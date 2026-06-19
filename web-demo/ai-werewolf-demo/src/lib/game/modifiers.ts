/**
 * Game Modifiers
 * 
 * Functions for calculating alignment and stress modifiers for checks.
 * These are game-specific and depend on the game's alignment and stress systems.
 */

import type { Alignment } from '@/types';
import { STRESS_MIN, STRESS_MAX, RELATION_MIN, RELATION_MAX } from '@/types';
import { clamp } from '@/utils/math';

/**
 * 限制压力值在有效范围内
 */
export function clampStress(value: number): number {
  return clamp(value, STRESS_MIN, STRESS_MAX);
}

/**
 * 限制关系值在有效范围内
 */
export function clampRelation(value: number): number {
  return clamp(value, RELATION_MIN, RELATION_MAX);
}

/**
 * Get stress modifier for a check
 * 
 * @param stress - Current stress value (-10 to +10)
 * @param attribute - The attribute being used ('deception', 'stealth', or 'other')
 * @returns Modifier value (negative for deception/stealth under positive stress)
 */
export function getStressModifier(stress: number, attribute: 'deception' | 'stealth' | 'other'): number {
  if ((attribute === 'deception' || attribute === 'stealth') && stress > 0) {
    return -Math.floor(stress * 0.5);
  }
  return 0;
}

/**
 * Get alignment modifier for a check
 *
 * 注意：阵营修正已禁用。阵营现在只影响行动取向（behavior-modifiers.ts），
 * 不再影响检定数值。
 *
 * @param alignment - Character's alignment
 * @param actionType - Type of action being performed
 * @param isGoodAction - Whether the action is considered "good" (for affinity checks)
 * @returns 0 (阵营修正已禁用)
 */
export function getAlignmentModifier(
  _alignment: Alignment,
  _actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other',
  _isGoodAction = false
): number {
  // 阵营修正已禁用，阵营只影响行动取向，不影响检定
  return 0;
}

/**
 * Modifier breakdown for logging and debugging
 */
export interface ModifierBreakdown {
  baseAttribute: number;
  alignmentMod: number;
  stressMod: number;
  total: number;
}

/**
 * Calculate the full modifier breakdown for a check
 * 
 * @param baseAttribute - Base attribute value
 * @param alignment - Character's alignment
 * @param stress - Current stress value
 * @param actionType - Type of action
 * @param isGoodAction - Whether the action is "good"
 * @returns ModifierBreakdown with all components
 */
export function calculateModifierBreakdown(
  baseAttribute: number,
  alignment: Alignment,
  stress: number,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other',
  isGoodAction = false
): ModifierBreakdown {
  const alignmentMod = getAlignmentModifier(alignment, actionType, isGoodAction);
  const stressMod = getStressModifier(
    stress,
    actionType === 'deception' || actionType === 'stealth' ? actionType : 'other'
  );
  return {
    baseAttribute,
    alignmentMod,
    stressMod,
    total: baseAttribute + alignmentMod + stressMod,
  };
}

/**
 * Calculate the final modifier value for a check
 * 
 * @param baseAttribute - Base attribute value
 * @param alignment - Character's alignment
 * @param stress - Current stress value
 * @param actionType - Type of action
 * @param isGoodAction - Whether the action is "good"
 * @returns Total modifier value
 */
export function calculateFinalModifier(
  baseAttribute: number,
  alignment: Alignment,
  stress: number,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other',
  isGoodAction = false
): number {
  return calculateModifierBreakdown(baseAttribute, alignment, stress, actionType, isGoodAction).total;
}
