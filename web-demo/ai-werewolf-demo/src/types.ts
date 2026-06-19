// ============================
// AI 狼人杀 — 类型、常量与工具函数
// 所有游戏数据定义的唯一来源
// ============================

// =====================================================================
// 第一部分：类型定义
// =====================================================================

// ---------- 六维属性 ----------
export interface Attributes {
  affinity: number;    // 亲和: 说服、建立信任、降低压力
  logic: number;       // 逻辑: 推理、识破谎言、构建证据链
  leadership: number;  // 领导: 主导议程、影响跟票
  deception: number;   // 诡诈: 撒谎、伪装、误导、陷害
  stealth: number;     // 隐蔽: 隐藏立场、降低被怀疑概率
  insight: number;     // 洞察: 感知情绪动机、看穿伪装
}

export type AttributeKey = keyof Attributes;

export const DEFAULT_ATTRIBUTES: Attributes = {
  affinity: 10, logic: 10, leadership: 10,
  deception: 10, stealth: 10, insight: 10,
};

// ---------- Alignment (阵营九宫格) ----------
export type LawAxis = 'lawful' | 'neutral_law' | 'chaotic';
export type GoodAxis = 'good' | 'neutral_good' | 'evil';

export interface Alignment { law: LawAxis; good: GoodAxis }

// ---------- Relations (关系) ----------
export interface Relation { trust: number; friendly: number }
export interface RelationDelta { trustDelta: number; friendlyDelta: number }

// ---------- Items (道具) ----------
export type ItemType = 'action_prerequisite' | 'check_bonus' | 'consumable' | 'passive';

export interface ItemDefinition {
  id: string; name: string; type: ItemType; maxDurability: number;
  werewolfEffect: string; villagerEffect: string; description: string;
}

export interface ItemInstance { definitionId: string; durability: number }

// ---------- Roles (职业) ----------
export type Role = 'werewolf' | 'lone_wolf' | 'berserker' | 'villager' | 'prophet' | 'thief' | 'coroner';
export type Team = 'werewolf' | 'villager';

export interface RoleInfo {
  role: Role; label: string; team: Team; description: string; defaultItems: string[];
  nightAction?: boolean;
}

// ---------- Traits (特质) ----------
export interface Trait { id: string; name: string; description: string }

// ---------- Phases (阶段) ----------
export type Phase = 'night' | 'morning' | 'day' | 'vote' | 'init' | 'ended' | 'event';
export type DaySubPhase = 'action' | 'appendix' | 'vote';

// 游戏状态常量（UI 使用，这些在 useGameRunner 中定义，不属于 Phase 类型）
export const GAME_STATUS_SETUP = 'setup';
export const GAME_STATUS_RUNNING = 'running';
export const GAME_STATUS_PAUSED = 'paused';
export const GAME_STATUS_ENDED = 'ended';

// ---------- Actions (行动) —— 从 action-constants 重新导出 ----------
export type { DayActionType, NightActionType, VoteActionType, ActionType } from '@/lib/constants/action-constants';

// ---------- Check / Roll (检定) ----------
// Re-exported from @/utils/dice

// ---------- Player (玩家) ----------
export interface Player {
  id: string; name: string; role: Role; team: Team; alive: boolean;
  items: ItemInstance[]; attributes: Attributes; alignment: Alignment;
  traits: string[]; stress: number; relations: Record<string, Relation>;
}

// ---------- Game Log ----------
export interface GameLogItem {
  round: number; phase: Phase; message: string;
  type: 'phase' | 'action' | 'death' | 'victory' | 'info' | 'check' | 'relation' | 'stress' | 'item' | 'thinking';
  details?: Record<string, unknown>;
}

// ---------- Config & Victory ----------
export interface GameConfig { totalPlayers: number; werewolfRoles: { role: Role; count: number }[]; villagerRoles: { role: Role; count: number }[] }
export type Winner = 'villager' | 'werewolf' | null;
export interface VoteResult { round: number; votes: Record<string, string[]>; maxVotes: number; topTargets: string[]; eliminatedId: string | null; tie: boolean; nextRound: boolean }
export interface SetupConfig { totalPlayers: number; werewolfConfig: { role: string; count: number }[]; villagerConfig: { role: string; count: number }[] }

// ---------- Decision Types (AI Decision System) ----------
export interface DecisionCandidate {
  action: string; target: string | null; score: number; confidence: number; reason: string;
  details?: Record<string, unknown>; stageWeight?: number; stage?: string;
  strategy?: string; rule?: string; trigger?: string; random?: boolean;
  intentionDrivenBonus?: number; // 意图驱动评分调整加分（行为匹配+200，目标匹配+100）
}

export interface DecisionProcess {
  candidates: {
    action: string; target: string | null; reason: string; score: number;
    stageWeight: number; totalScore: number; stage: string; strategy: string;
    rule: string; trigger: string; random: boolean;
    modifiers: { alignment: number; stress: number; relation: number; total: number };
    intentionDrivenBonus?: number;
  }[];
  winner: string;
  shortlist: string;
}

export interface DecisionResult {
  action: string; target: string | null; reason: string; stage: string;
  confidence: number; emotionalTone: string;
  details?: Record<string, unknown>; process?: DecisionProcess;
}

// ---------- Public Claim & Log ----------
export interface PublicClaim { playerId: string; claim: string; content: Record<string, unknown>; round: number }
export interface LogEntry { round: number; phase: Phase; message: string; timestamp: number }

// ---------- Check Log ----------
// ModifierBreakdown is re-exported from @/lib/game/modifiers

export interface CheckLog {
  type: 'check' | 'opposed'; actorName: string; actorAttribute: string;
  actorBaseValue: number; actorAlignmentMod: number; actorStressMod: number;
  actorTotalModifier: number; actorRoll: number; actorTotal: number;
  targetName?: string; targetAttribute?: string; targetBaseValue?: number;
  targetAlignmentMod?: number; targetStressMod?: number; targetTotalModifier?: number;
  targetRoll?: number; targetTotal?: number; difficulty?: number;
  margin: number; success: boolean; successLevel: string;
}

export interface ActionLogDetail {
  decisionReason: string; checks: CheckLog[]; actorId: string; action: string;
  targetId?: string | null; process?: DecisionProcess;
  [key: string]: unknown;
}

// =====================================================================
// SECTION 2: Data Definitions
// =====================================================================

export const ALIGNMENT_NAMES: Record<string, string> = {
  'lawful-good': '守序善良', 'lawful-neutral_good': '守序中立', 'lawful-evil': '守序邪恶',
  'neutral_law-good': '中立善良', 'neutral_law-neutral_good': '绝对中立', 'neutral_law-evil': '中立邪恶',
  'chaotic-good': '混乱善良', 'chaotic-neutral_good': '混乱中立', 'chaotic-evil': '混乱邪恶',
};

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  claws: { id: 'claws', name: '尖牙利爪', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '拥有时可在夜晚执行一对一杀戮', villagerEffect: '被攻击时可选择与攻击者同归于尽', description: '狼人的天然武器' },
  crystal_ball: { id: 'crystal_ball', name: '水晶球', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '持有时可执行夜间查验；若查验到狼人，水晶球碎裂损坏', villagerEffect: '持有时可执行夜间查验；若查验到狼人，水晶球碎裂损坏', description: '查验身份的神秘道具' },
  thief_gloves: { id: 'thief_gloves', name: '小偷手套', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '持有时可执行一次偷取；使用后损坏', villagerEffect: '持有时可执行一次偷取；使用后损坏', description: '偷取他人道具的手套' },
  coroner_tools: { id: 'coroner_tools', name: '验尸工具', type: 'consumable', maxDurability: 1, werewolfEffect: '持有时可执行一次尸检，查看一名死亡角色的所有道具；使用后损坏', villagerEffect: '持有时可执行一次尸检，查看一名死亡角色的所有道具；使用后损坏', description: '检验尸体的工具' },
  amulet: { id: 'amulet', name: '护身符', type: 'consumable', maxDurability: 1, werewolfEffect: '抵挡一次夜晚杀戮，使用后损坏', villagerEffect: '抵挡一次夜晚杀戮，使用后损坏', description: '可抵挡一次致命攻击' },
  double_sword: { id: 'double_sword', name: '双刃剑', type: 'consumable', maxDurability: 1, werewolfEffect: '狂狼持有时可与一名玩家同归于尽，并触发平安夜；使用后消耗', villagerEffect: '无效果', description: '狂狼的毁灭性武器' },
};

export const ROLE_INFO: Record<Role, RoleInfo> = {
  werewolf: { role: 'werewolf', label: '普通狼人', team: 'werewolf', description: '参与夜晚讨论，可执行杀戮', defaultItems: ['claws'], nightAction: true },
  lone_wolf: { role: 'lone_wolf', label: '孤狼', team: 'werewolf', description: '独立选择杀戮目标，不与其他狼人沟通', defaultItems: ['claws'], nightAction: true },
  berserker: { role: 'berserker', label: '狂狼', team: 'werewolf', description: '白天可同归于尽，触发平安夜', defaultItems: ['claws', 'double_sword'] },
  villager: { role: 'villager', label: '普通村民', team: 'villager', description: '无特殊能力，通过投票放逐狼人', defaultItems: [] },
  prophet: { role: 'prophet', label: '预言家', team: 'villager', description: '每晚查验一名玩家身份', defaultItems: ['crystal_ball'], nightAction: true },
  thief: { role: 'thief', label: '窃贼', team: 'villager', description: '整场游戏限一次偷取一名玩家的道具', defaultItems: ['thief_gloves'], nightAction: true },
  coroner: { role: 'coroner', label: '验尸官', team: 'villager', description: '整场游戏限一次查看死亡角色的道具', defaultItems: ['coroner_tools'], nightAction: true },
};

export const TRAITS: Record<string, Trait> = {
  lone_wolf_trait: { id: 'lone_wolf_trait', name: '孤狼', description: '狼人阵营角色拥有此特质时，夜间不能与其他狼人沟通，杀戮阶段独立选择目标；若目标与普通狼人相同，本次杀戮无效。' },
};

// =====================================================================
// SECTION 3: Game Constants
// =====================================================================

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

// ---------- Dice & Check System ----------
// Re-exported from @/utils/dice

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

// ---------- 策略分数常量 - 从 ./lib/constants/scores 重新导出 ----------
export * from './lib/constants/scores';

// ---------- 阈值常量 ----------
export const WEREWOLF_PROBABILITY_HIGH = 0.6;         // 高狼人概率阈值（超过此值认为很可能是狼人）
export const WEREWOLF_PROBABILITY_LOW = 0.4;          // 低狼人概率阈值（低于此值认为不太可能是狼人）
export const WEREWOLF_PROBABILITY_MEDIUM = 0.5;       // 中等狼人概率阈值
export const EXPOSURE_HIGH_THRESHOLD = 0.6;           // 高暴露阈值（超过此值认为身份可能暴露）
export const EXPOSURE_CRITICAL_THRESHOLD = 0.7;       // 临界暴露阈值（超过此值认为身份几乎暴露）
export const SILENCE_NEAR_FULL_THRESHOLD = 2;         // 连续沉默接近上限的阈值

// ---------- UI 阈值常量 - 从 ./lib/constants/ui-thresholds 重新导出 ----------
export * from './lib/constants/ui-thresholds';

// ---------- 游戏引擎 ----------
export const DEFAULT_TICK_RATE = 2000;                 // 默认 tick 间隔（毫秒）

// ---------- AI 置信度 ----------
export const CONFIDENCE_JOIN_SUSPECT = 0.6;            // 一同怀疑置信度
export const CONFIDENCE_JOIN_DEFEND = 0.6;             // 一同袒护置信度

// ---------- 关系阈值 ----------
export const RELATION_FRIENDLY_JOIN_DEFEND = 3;        // 一同袒护的友好度阈值

// ---------- 信念系统常量 - 从 ./lib/constants/belief 重新导出 ----------
export * from './lib/constants/belief';

// ---------- 行为修正常量 - 从 ./lib/constants/behavior 重新导出 ----------
export * from './lib/constants/behavior';

// ---------- 游戏平衡常量 - 从 ./lib/constants/balance 重新导出 ----------
export * from './lib/constants/balance';

// =====================================================================
// SECTION 4: Utility Functions (Re-exports)
// =====================================================================

// 从 utils 重新导出（向后兼容）
export { rollD20, performCheck, performOpposedCheck, DICE_SIDES, NATURAL_20, NATURAL_1 } from '@/utils/dice';
export type { CheckResult, OpposedCheckResult } from '@/utils/dice';
export { clamp } from '@/utils/math';

// 从 lib/game 重新导出（向后兼容）
export { clampStress, clampRelation } from '@/lib/game/modifiers';
export { getAlignmentName } from '@/lib/game/alignment';
export { hasItem, getItem, removeItem, addItem, damageItem, canUseItem } from '@/lib/game/items';
export { generateRandomAttributes, generateRandomAlignment } from '@/lib/game/random';
export { getStressModifier, getAlignmentModifier, calculateModifierBreakdown, calculateFinalModifier } from '@/lib/game/modifiers';
export type { ModifierBreakdown } from '@/lib/game/modifiers';

// 从 action-constants 重新导出（向后兼容）
export type { IntentionType, IntentionSource, CommitmentLevel, GameMode } from '@/lib/constants/action-constants';
export const ATTRIBUTE_NAMES: Record<keyof Attributes, string> = {
  affinity: '亲和', logic: '逻辑', leadership: '领导',
  deception: '诡诈', stealth: '隐蔽', insight: '洞察',
};
