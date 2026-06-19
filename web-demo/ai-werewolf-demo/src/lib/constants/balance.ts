// ---------- 游戏平衡常量 ----------

// 压力变化
export const STRESS_CHANGE_MINOR_POS = 1;             // 轻微正面压力变化（最小值）
export const STRESS_CHANGE_MINOR_POS_RANDOM = 2;      // 轻微正面压力变化（随机最大值）
export const STRESS_CHANGE_MINOR_NEG = -1;            // 轻微负面压力变化（最小值）
export const STRESS_CHANGE_MINOR_NEG_RANDOM = -2;     // 轻微负面压力变化（随机最大值）
export const STRESS_CHANGE_MODERATE_POS = 2;          // 中度正面压力变化（最小值）
export const STRESS_CHANGE_MODERATE_POS_RANDOM = 3;   // 中度正面压力变化（随机最大值）
export const STRESS_CHANGE_MAJOR_POS = 3;             // 重度正面压力变化（最小值）
export const STRESS_CHANGE_MAJOR_POS_RANDOM = 4;      // 重度正面压力变化（随机最大值）

// 关系变化
export const REL_CHANGE_MINOR_NEG = -1;               // 轻微负面关系变化
export const REL_CHANGE_MINOR_POS = 1;                // 轻微正面关系变化
export const REL_CHANGE_MODERATE_NEG = -2;            // 中度负面关系变化
export const REL_CHANGE_MODERATE_POS = 2;             // 中度正面关系变化
export const REL_CHANGE_MAJOR_NEG = -3;               // 重度负面关系变化
export const REL_CHANGE_MAJOR_POS = 3;                // 重度正面关系变化

// 默认回退值
export const DEFAULT_ATTRIBUTE_FALLBACK = 10;         // 属性默认回退值
export const DEFAULT_STRESS_FALLBACK = 0;             // 压力默认回退值
export const DEFAULT_ALIGNMENT_FALLBACK: { law: 'neutral_law'; good: 'neutral_good' } = { law: 'neutral_law', good: 'neutral_good' };

// 空刀概率
export const EMPTY_KILL_CHANCE = 0.1;
