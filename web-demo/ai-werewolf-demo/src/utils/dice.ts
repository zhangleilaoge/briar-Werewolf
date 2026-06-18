/**
 * Dice and Check System Utilities
 * 
 * Pure utility functions for dice rolling and check mechanics.
 * These functions are independent of game-specific logic.
 */

// Constants
export const DICE_SIDES = 20;
export const NATURAL_20 = 20;
export const NATURAL_1 = 1;

// Types
export interface CheckResult {
  roll: number;
  modifier: number;
  total: number;
  difficulty: number;
  success: boolean;
  criticalSuccess: boolean;
  criticalFail: boolean;
  margin: number;
}

export interface OpposedCheckResult {
  actorRoll: number;
  targetRoll: number;
  actorTotal: number;
  targetTotal: number;
  success: boolean;
  margin: number;
  criticalSuccess: boolean;
  criticalFail: boolean;
}

/**
 * Roll 1d20: uniform distribution, range 1-20
 */
export function rollD20(): number {
  return Math.floor(Math.random() * DICE_SIDES) + 1;
}

/**
 * Perform a standard check against a difficulty
 * 
 * @param modifier - Total modifier to add to the roll
 * @param difficulty - Target number to beat
 * @returns CheckResult with success/failure and critical status
 */
export function performCheck(modifier: number, difficulty: number): CheckResult {
  const roll = rollD20();
  const total = roll + modifier;
  const margin = total - difficulty;
  
  return {
    roll,
    modifier,
    total,
    difficulty,
    success: total >= difficulty,
    criticalSuccess: roll === NATURAL_20,
    criticalFail: roll === NATURAL_1,
    margin,
  };
}

/**
 * Perform an opposed check between two participants
 * 
 * Critical success/failure rules:
 * - Natural 20 always wins (unless opponent also rolls 20, then compare totals)
 * - Natural 1 always loses (unless opponent also rolls 1, then compare totals)
 * 
 * @param actorModifier - Modifier for the acting character
 * @param targetModifier - Modifier for the target character
 * @returns OpposedCheckResult with success/failure and critical status
 */
export function performOpposedCheck(
  actorModifier: number,
  targetModifier: number
): OpposedCheckResult {
  const actorRoll = rollD20();
  const targetRoll = rollD20();
  const actorTotal = actorRoll + actorModifier;
  const targetTotal = targetRoll + targetModifier;
  
  // Handle critical success/failure rules
  const actorCriticalSuccess = actorRoll === NATURAL_20;
  const actorCriticalFail = actorRoll === NATURAL_1;
  const targetCriticalSuccess = targetRoll === NATURAL_20;
  const targetCriticalFail = targetRoll === NATURAL_1;
  
  // Determine success based on critical rules
  let success: boolean;
  
  if (actorCriticalSuccess && targetCriticalSuccess) {
    // Both critical success: compare totals
    success = actorTotal > targetTotal;
  } else if (actorCriticalSuccess) {
    // Actor critical success: always win
    success = true;
  } else if (targetCriticalSuccess) {
    // Target critical success: actor always loses
    success = false;
  } else if (actorCriticalFail && targetCriticalFail) {
    // Both critical fail: compare totals
    success = actorTotal > targetTotal;
  } else if (actorCriticalFail) {
    // Actor critical fail: always lose
    success = false;
  } else if (targetCriticalFail) {
    // Target critical fail: actor always wins
    success = true;
  } else {
    // Normal comparison
    success = actorTotal > targetTotal;
  }
  
  return {
    actorRoll,
    targetRoll,
    actorTotal,
    targetTotal,
    success,
    margin: actorTotal - targetTotal,
    criticalSuccess: actorCriticalSuccess,
    criticalFail: actorCriticalFail,
  };
}
