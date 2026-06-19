// ============================
// AI 狼人杀 — 类型、常量与工具函数
// 所有游戏数据定义的唯一来源
// 
// 注意：本文件已拆分为 src/types/ 目录结构。
// 此处保留为 barrel re-export 以维持向后兼容。
// 所有 import { ... } from '@/types' 继续有效。
// ============================

// 从新结构 barrel re-export
export * from './types/index';

// ---------- Actions (行动) —— 从 action-constants 重新导出 ----------
export type { DayActionType, NightActionType, VoteActionType, ActionType } from '@/lib/constants/action-constants';

// ---------- Dice & Check System (从 utils 重新导出) ----------
export { rollD20, performCheck, performOpposedCheck, DICE_SIDES, NATURAL_20, NATURAL_1 } from '@/utils/dice';
export type { CheckResult, OpposedCheckResult } from '@/utils/dice';

// ---------- Math Utility ----------
export { clamp } from '@/utils/math';

// ---------- Game Modifiers (从 lib/game 重新导出) ----------
export { clampStress, clampRelation } from '@/lib/game/modifiers';
export { getAlignmentName } from '@/lib/game/alignment';
export { hasItem, getItem, removeItem, addItem, damageItem, canUseItem } from '@/lib/game/items';
export { generateRandomAttributes, generateRandomAlignment } from '@/lib/game/random';
export { getStressModifier, getAlignmentModifier, calculateModifierBreakdown, calculateFinalModifier } from '@/lib/game/modifiers';
export type { ModifierBreakdown } from '@/lib/game/modifiers';

// ---------- Action Constants (从 lib/constants 重新导出) ----------
export type { IntentionType, IntentionSource, CommitmentLevel, GameMode } from '@/lib/constants/action-constants';

// ---------- 策略分数常量 - 从 ./lib/constants/scores 重新导出 ----------
export * from './lib/constants/scores';

// ---------- UI 阈值常量 - 从 ./lib/constants/ui-thresholds 重新导出 ----------
export * from './lib/constants/ui-thresholds';

// ---------- 信念系统常量 - 从 ./lib/constants/belief 重新导出 ----------
export * from './lib/constants/belief';

// ---------- 行为修正常量 - 从 ./lib/constants/behavior 重新导出 ----------
export * from './lib/constants/behavior';

// ---------- 游戏平衡常量 - 从 ./lib/constants/balance 重新导出 ----------
export * from './lib/constants/balance';
