/**
 * Game Modifiers
 * 
 * Functions for calculating alignment and stress modifiers for checks.
 * These are game-specific and depend on the game's alignment and stress systems.
 */

import type { Alignment } from '@/types';

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
 * @param alignment - Character's alignment
 * @param actionType - Type of action being performed
 * @param isGoodAction - Whether the action is considered "good" (for affinity checks)
 * @returns Modifier value
 */
export function getAlignmentModifier(
  alignment: Alignment,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other',
  isGoodAction = false
): number {
  switch (actionType) {
    case 'leadership':
      return alignment.law === 'lawful' ? 1 : 0;
    case 'deception':
    case 'stealth':
      if (alignment.law === 'lawful') return -2;
      if (alignment.law === 'chaotic') return 2;
      if (alignment.good === 'evil') return 1;
      return 0;
    case 'affinity':
      return (alignment.good === 'good' && isGoodAction) ? 1 : 0;
    default:
      return 0;
  }
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
