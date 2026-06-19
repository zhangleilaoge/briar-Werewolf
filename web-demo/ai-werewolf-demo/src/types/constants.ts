// ============================
// AI 狼人杀 — 游戏常量
// ============================

// ---------- 属性系统 ----------
export const ATTRIBUTE_MIN = 1;                       // 属性最小值
export const ATTRIBUTE_MAX = 20;                      // 属性最大值
export const ATTRIBUTE_DEFAULT = 10;                  // 属性默认值
export const ATTRIBUTE_TOTAL_POINTS = 72;             // 角色总属性点数（6个属性共72点）

// ---------- 压力系统 ----------
export const STRESS_MIN = -10;                        // 压力最小值（极度冷静）
export const STRESS_MAX = 10;                         // 压力最大值（极度紧张）
export const STRESS_OVERLOAD = 10;                    // 压力过载阈值
export const STRESS_RECOVERY_BASE = 1;                // 每轮基础压力恢复
export const STRESS_RECOVERY_BONUS = 1;               // 额外压力恢复奖励
export const STRESS_MODIFIER_MULTIPLIER = 0.5;        // 压力对检定的修正系数

// ---------- 关系系统 ----------
export const RELATION_MIN = -10;                      // 关系最小值（极度敌对）
export const RELATION_MAX = 10;                       // 关系最大值（极度友好）
export const RELATION_NATURAL_RECOVERY = 0.5;         // 关系每轮自然恢复值（向0靠拢）

// ---------- 道具系统 ----------
export const MAX_ITEM_SLOTS = 3;                      // 每个玩家最大道具栏位

// ---------- 游戏配置 ----------
export const MIN_PLAYERS = 5;                         // 最少玩家数量
export const MAX_PLAYERS = 12;                        // 最多玩家数量
export const DEFAULT_PLAYERS = 6;                     // 默认玩家数量

// ---------- 阵营修正 ----------
export const ALIGNMENT_LAWFUL_LEADERSHIP_BONUS = 1;   // 守序阵营领导力加成
export const ALIGNMENT_LAWFUL_DECEPTION_PENALTY = -2; // 守序阵营诡诈惩罚
export const ALIGNMENT_CHAOTIC_DECEPTION_BONUS = 2;   // 混乱阵营诡诈加成
export const ALIGNMENT_EVIL_DECEPTION_BONUS = 1;      // 邪恶阵营诡诈加成
export const ALIGNMENT_GOOD_AFFINITY_BONUS = 1;       // 善良阵营亲和加成（仅善良行动）

// ---------- 检定难度 ----------
export const CHECK_DIFFICULTY_EASY = 10;              // 简单难度
export const CHECK_DIFFICULTY_MEDIUM = 12;            // 中等难度
export const CHECK_DIFFICULTY_HARD = 15;              // 困难难度
export const CHECK_DIFFICULTY_VERY_HARD = 18;         // 极难难度
export const CHECK_DIFFICULTY_DEFEND = CHECK_DIFFICULTY_EASY;           // 袒护难度（简单）
export const CHECK_DIFFICULTY_JOIN_SUSPECT = CHECK_DIFFICULTY_EASY;     // 一同怀疑难度（简单）
export const CHECK_DIFFICULTY_JOIN_DEFEND = CHECK_DIFFICULTY_EASY;      // 一同袒护难度（简单）
export const CHECK_DIFFICULTY_CALL_VOTE = CHECK_DIFFICULTY_MEDIUM;      // 号召投票难度（中等）
export const CHECK_DIFFICULTY_BLOCK_VOTE = CHECK_DIFFICULTY_MEDIUM;     // 阻止投票难度（中等）
export const CHECK_DIFFICULTY_GUARANTEE = CHECK_DIFFICULTY_MEDIUM;      // 担保清白难度（中等）
export const CHECK_DIFFICULTY_EXCLUDE_ALL = CHECK_DIFFICULTY_HARD;      // 全员排除难度（困难）

// ---------- AI 决策权重 ----------
export const STAGE_WEIGHT_DUTY = 1000;                // 职业义务阶段权重（最高优先级）
export const STAGE_WEIGHT_SURVIVAL = 800;             // 生存阶段权重
export const STAGE_WEIGHT_INFORMATION = 500;          // 信息阶段权重
export const STAGE_WEIGHT_SOCIAL = 100;               // 社交阶段权重

// ---------- 阈值常量 ----------
export const WEREWOLF_PROBABILITY_HIGH = 0.6;         // 高狼人概率阈值（超过此值认为很可能是狼人）
export const WEREWOLF_PROBABILITY_LOW = 0.4;          // 低狼人概率阈值（低于此值认为不太可能是狼人）
export const WEREWOLF_PROBABILITY_MEDIUM = 0.5;       // 中等狼人概率阈值
export const EXPOSURE_HIGH_THRESHOLD = 0.6;           // 高暴露阈值（超过此值认为身份可能暴露）
export const EXPOSURE_CRITICAL_THRESHOLD = 0.7;       // 临界暴露阈值（超过此值认为身份几乎暴露）
export const SILENCE_NEAR_FULL_THRESHOLD = 2;         // 连续沉默接近上限的阈值

// ---------- 游戏引擎 ----------
export const DEFAULT_TICK_RATE = 2000;                 // 默认 tick 间隔（毫秒）

// ---------- AI 置信度 ----------
export const CONFIDENCE_JOIN_SUSPECT = 0.6;            // 一同怀疑置信度
export const CONFIDENCE_JOIN_DEFEND = 0.6;             // 一同袒护置信度

// ---------- 关系阈值 ----------
export const RELATION_FRIENDLY_JOIN_DEFEND = 3;        // 一同袒护的友好度阈值
