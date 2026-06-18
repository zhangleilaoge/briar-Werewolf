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

// ---------- Actions (行动) ----------
export type DayActionType =
  | 'silence' | 'speak' | 'claim_identity' | 'reveal_info' | 'observe'
  | 'suspect' | 'defend' | 'thank' | 'call_vote' | 'block_vote'
  | 'guarantee' | 'accuse' | 'exclude_all' | 'berserker_kill';

export type AppendixActionType = 'join_suspect' | 'rebut' | 'join_defend';

export type NightActionType = 'kill' | 'check' | 'steal' | 'inspect';

export type ActionType = DayActionType | AppendixActionType | NightActionType | 'vote';

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
  werewolf: { role: 'werewolf', label: '普通狼人', team: 'werewolf', description: '参与夜晚讨论，可执行杀戮', defaultItems: ['claws'] },
  lone_wolf: { role: 'lone_wolf', label: '孤狼', team: 'werewolf', description: '独立选择杀戮目标，不与其他狼人沟通', defaultItems: ['claws'] },
  berserker: { role: 'berserker', label: '狂狼', team: 'werewolf', description: '白天可同归于尽，触发平安夜', defaultItems: ['claws', 'double_sword'] },
  villager: { role: 'villager', label: '普通村民', team: 'villager', description: '无特殊能力，通过投票放逐狼人', defaultItems: [] },
  prophet: { role: 'prophet', label: '预言家', team: 'villager', description: '每晚查验一名玩家身份', defaultItems: ['crystal_ball'] },
  thief: { role: 'thief', label: '窃贼', team: 'villager', description: '整场游戏限一次偷取一名玩家的道具', defaultItems: ['thief_gloves'] },
  coroner: { role: 'coroner', label: '验尸官', team: 'villager', description: '整场游戏限一次查看死亡角色的道具', defaultItems: ['coroner_tools'] },
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

// ---------- 策略分数：通用 ----------
export const SCORE_PROPHET_VOTE_DUTY = 200;           // 预言家查验到狼人后，号召投票的义务分数
export const SCORE_WEREWOLF_VOTE_DUTY = 80;           // 狼人跟票投票的基础分数
export const SCORE_MAX_INFO_VOTE = 100;               // 基于最大信息量投票的分数
export const SCORE_FOLLOW_CALL_VOTE = 40;             // 跟随他人号召投票的分数
export const SCORE_SOCIAL_TIE_BREAKER = 20;           // 社交关系作为投票平局决胜的分数
export const SCORE_SURVIVAL_VOTE = 70;                // 为生存而投票的分数
export const SCORE_WEREWOLF_KILL_GOD_BONUS = 30;      // 狼人击杀疑似神职的额外奖励
export const SCORE_WEREWOLF_KILL_HIGH_INSIGHT = 15;   // 狼人击杀高洞察玩家的额外奖励
export const SCORE_WEREWOLF_KILL_BASE = 50;           // 狼人夜间杀戮的基础分数
export const SCORE_PROPHET_CHECK_BASE = 50;           // 预言家夜间查验的基础分数
export const SCORE_THIEF_STEAL_BASE = 40;             // 窃贼偷窃的基础分数
export const SCORE_CORONER_INSPECT_BASE = 50;         // 验尸官验尸的基础分数
export const SCORE_BERSERKER_SUICIDE = 90;            // 狂狼同归于尽的基础分数
export const SCORE_SPEAK_BREAK_SILENCE = 80;          // 打破沉默发言的分数
export const SCORE_SPEAK_DEFAULT = 50;                // 默认发言分数
export const SCORE_EMPTY_KILL = 15;                   // 狼人空刀（不杀人）的分数
export const SCORE_SPEAK_BASE = 50;                   // 发言基础分数（与观察平衡）

// ---------- 策略分数：白天行动 ----------
export const SCORE_PROPHET_CLAIM = 1000;              // 预言家公布身份的分数（最高优先级）
export const SCORE_PROPHET_CALL_VOTE = 950;           // 预言家号召投票放逐狼人的分数
export const SCORE_DEFEND_ATTACKED = 100;             // 被攻击时辩护的分数
export const SCORE_DEFEND_ATTACKED_BONUS = 30;        // 被攻击时辩护的额外奖励
export const SCORE_SELF_GUARANTEE = 70;               // 担保自己清白的分数
export const SCORE_HIGH_SUSPECT_ACCUSE = 130;         // 对高嫌疑玩家强烈指认的分数
export const SCORE_HIGH_SUSPECT_SUSPECT = 100;        // 对高嫌疑玩家怀疑的分数
export const SCORE_HIGH_SUSPECT_CALL_VOTE = 110;      // 对高嫌疑玩家号召投票的分数
export const SCORE_BEHAVIOR_OBSERVE = 75;             // 观察其他玩家行为的分数
export const SCORE_FOLLOW_TRUSTED = 85;               // 跟随信任玩家行动的分数
export const SCORE_BREAK_SILENCE = 95;                // 打破沉默的分数
export const SCORE_DEFAULT_ROUND1_OBSERVE = 50;       // 第一轮默认观察分数
export const SCORE_DEFAULT_ROUND1_SPEAK = 40;         // 第一轮默认发言分数
export const SCORE_DEFAULT_OTHER_OBSERVE = 50;        // 其他轮次默认观察分数
export const SCORE_DEFAULT_OTHER_SPEAK = 40;          // 其他轮次默认发言分数

// ---------- 策略分数：狼人白天行动 ----------
export const SCORE_WW_DEFEND_ATTACKED_ACCUSE = 130;  // 狼人被攻击时，选择强烈指认攻击者的分数
export const SCORE_WW_DEFEND_ATTACKED_SUSPECT = 100; // 狼人被攻击时，选择怀疑攻击者的分数
export const SCORE_WW_CAMOUFLAGE_BASE = 70;          // 狼人伪装成村民的基础分数（如观察、发言）
export const SCORE_WW_CAMOUFLAGE_BONUS = 10;         // 狼人伪装时的额外奖励分数
export const SCORE_WW_TEAMMATE_EXPOSED_GOUGE = 90;   // 狼队友暴露时，落井下石（撇清关系）的分数
export const SCORE_WW_TEAMMATE_EXPOSED_DEFEND = 60;  // 狼队友暴露时，冒险辩护的分数
export const SCORE_WW_BREAK_SILENCE = 90;            // 狼人打破沉默（发言）的分数
export const SCORE_WW_DEFAULT_ROUND1_TARGET = 55;    // 第一轮白天有明确目标时的默认分数
export const SCORE_WW_DEFAULT_ROUND1 = 50;           // 第一轮白天无明确目标时的默认分数
export const SCORE_WW_DEFAULT_OTHER = 50;            // 其他轮次白天的默认分数

// ---------- 策略分数：追加行动 ----------
export const SCORE_JOIN_SUSPECT_BASE = 80;            // 一同怀疑的基础分数
export const SCORE_JOIN_SUSPECT_WOLF_BONUS = 30;      // 狼人一同怀疑的额外奖励
export const SCORE_JOIN_DEFEND_BASE = 10;             // 一同袒护的基础分数（较低，因为袒护有风险）
export const SCORE_JOIN_DEFEND_WOLF_BONUS = 40;       // 狼人一同袒护队友的额外奖励
export const SCORE_REBUT_WEREWOLF = 70;               // 狼人反驳的分数
export const SCORE_REBUT_VILLAGER = 90;               // 村民反驳的分数（村民反驳更有说服力）

// ---------- 阈值常量 ----------
export const WEREWOLF_PROBABILITY_HIGH = 0.6;         // 高狼人概率阈值（超过此值认为很可能是狼人）
export const WEREWOLF_PROBABILITY_LOW = 0.4;          // 低狼人概率阈值（低于此值认为不太可能是狼人）
export const WEREWOLF_PROBABILITY_MEDIUM = 0.5;       // 中等狼人概率阈值
export const EXPOSURE_HIGH_THRESHOLD = 0.6;           // 高暴露阈值（超过此值认为身份可能暴露）
export const EXPOSURE_CRITICAL_THRESHOLD = 0.7;       // 临界暴露阈值（超过此值认为身份几乎暴露）
export const SILENCE_NEAR_FULL_THRESHOLD = 2;         // 连续沉默接近上限的阈值

// ---------- UI 颜色阈值 ----------
export const ATTR_COLOR_HIGH = 8;                     // 属性颜色：高值阈值（绿色）
export const ATTR_COLOR_MEDIUM = 6;                   // 属性颜色：中值阈值（浅绿色）
export const ATTR_COLOR_LOW = 4;                      // 属性颜色：低值阈值（黄色）

export const STRESS_COLOR_CALM = -5;                  // 压力颜色：冷静阈值（蓝色）
export const STRESS_COLOR_NORMAL = 2;                 // 压力颜色：正常阈值（绿色）
export const STRESS_COLOR_TENSE = 5;                  // 压力颜色：紧张阈值（黄色）
export const STRESS_COLOR_ANXIOUS = 8;                // 压力颜色：焦虑阈值（橙色）

export const STRESS_LABEL_EXTREMELY_CALM = -7;        // 压力标签：极度冷静阈值
export const STRESS_LABEL_CALM = -3;                  // 压力标签：冷静阈值
export const STRESS_LABEL_NORMAL = 2;                 // 压力标签：正常阈值
export const STRESS_LABEL_TENSE = 5;                  // 压力标签：轻微紧张阈值
export const STRESS_LABEL_ANXIOUS = 8;                // 压力标签：明显焦虑阈值

// ---------- 游戏速度 ----------
export const GAME_SPEED_SLOW = 0.5;                   // 慢速
export const GAME_SPEED_NORMAL = 1;                   // 正常速度
export const GAME_SPEED_FAST = 2;                     // 快速

// ---------- UI 过滤阈值 ----------
export const RELATION_DISPLAY_THRESHOLD = 0.5;        // 关系显示阈值（低于此值不显示）

// ---------- 游戏引擎 ----------
export const DEFAULT_TICK_RATE = 2000;                 // 默认 tick 间隔（毫秒）

// ---------- AI 置信度 ----------
export const CONFIDENCE_JOIN_SUSPECT = 0.6;            // 一同怀疑置信度
export const CONFIDENCE_JOIN_DEFEND = 0.6;             // 一同袒护置信度

// ---------- 关系阈值 ----------
export const RELATION_FRIENDLY_JOIN_DEFEND = 3;        // 一同袒护的友好度阈值

// ---------- 信念系统：概率调整系数 ----------
export const BELIEF_DEATH_DECAY = 0.6;                 // 死亡时狼人概率衰减系数
export const BELIEF_SUSPECT_MAX_ADJ = 0.2;             // 怀疑行动最大调整值
export const BELIEF_SUSPECT_RATE = 0.06;               // 怀疑行动调整速率
export const BELIEF_ACCUSE_MAX_ADJ = 0.25;             // 指控行动最大调整值
export const BELIEF_ACCUSE_RATE = 0.08;                // 指控行动调整速率
export const BELIEF_DEFEND_MAX_ADJ = 0.15;             // 辩护行动最大调整值
export const BELIEF_DEFEND_RATE = 0.05;                // 辩护行动调整速率
export const BELIEF_CLAIM_IDENTITY_ADJ = 0.1;          // 公布身份调整值
export const BELIEF_REVEAL_INFO_ADJ = 0.2;             // 公开信息调整值
export const BELIEF_THANK_ADJ = 0.05;                  // 感谢行动调整值
export const BELIEF_CALL_VOTE_ADJ = 0.1;               // 号召投票调整值
export const BELIEF_JOIN_SUSPECT_RATE = 0.03;          // 一同怀疑调整速率
export const BELIEF_NATURAL_DECAY = 0.02;              // 自然衰减速率
export const BELIEF_FALSE_CLAIM_ADJ = 0.3;             // 虚假声明调整值

// ---------- 信念系统：信任分数变化 ----------
export const TRUST_CHANGE_SUSPECT = -2;                // 怀疑时信任变化
export const TRUST_CHANGE_DEFEND = 1;                  // 辩护时信任变化
export const TRUST_CHANGE_ACCUSE = -3;                 // 指控时信任变化
export const TRUST_CHANGE_GUARANTEE = 2;               // 担保时信任变化
export const TRUST_CHANGE_FALSE_CLAIM = -4;            // 虚假声明时信任变化
export const TRUST_SCORE_MIN = -10;                    // 信任分数最小值
export const TRUST_SCORE_MAX = 10;                     // 信任分数最大值

// ---------- 信念系统：意图系统 ----------
export const INTENTION_STRENGTH_BASE = 500;            // 意图强度基础值
export const INTENTION_STRENGTH_PROB_FACTOR = 300;     // 意图强度概率因子

// ---------- 行为修正：压力阈值 ----------
export const STRESS_EXTREMELY_CALM = -5;              // 极度冷静阈值
export const STRESS_CALM = -2;                        // 冷静阈值
export const STRESS_MILDLY_TENSE_MIN = 2;             // 轻微紧张最小值
export const STRESS_MILDLY_TENSE_MAX = 5;             // 轻微紧张最大值
export const STRESS_ANXIOUS_MIN = 6;                  // 焦虑最小值
export const STRESS_ANXIOUS_MAX = 8;                  // 焦虑最大值
export const STRESS_NEAR_OVERLOAD = 9;                // 接近过载阈值

// ---------- 行为修正：阵营修正值 ----------
export const ALIGNMENT_MOD_GOOD_DEFEND = 2;           // 善良阵营：保护行动加成
export const ALIGNMENT_MOD_EVIL_DEFEND = -1;          // 邪恶阵营：保护行动惩罚
export const ALIGNMENT_MOD_LAWFUL_ACCUSE = 1;         // 守序阵营：指控行动加成
export const ALIGNMENT_MOD_CHAOTIC_ACCUSE = 3;        // 混乱阵营：指控行动加成
export const ALIGNMENT_MOD_EVIL_ACCUSE = 2;           // 邪恶阵营：指控行动加成
export const ALIGNMENT_MOD_LAWFUL_OBSERVE = 2;        // 守序阵营：观察行动加成
export const ALIGNMENT_MOD_CHAOTIC_OBSERVE = -2;      // 混乱阵营：观察行动惩罚
export const ALIGNMENT_MOD_CHAOTIC_SPEAK = 1;         // 混乱阵营：发言行动加成
export const ALIGNMENT_MOD_CHAOTIC_EVIL_EXTREME = 5;  // 混乱邪恶：极端行动加成
export const ALIGNMENT_MOD_CHAOTIC_EXTREME = 2;       // 混乱阵营：极端行动加成
export const ALIGNMENT_MOD_EVIL_EXTREME = 2;          // 邪恶阵营：极端行动加成
export const ALIGNMENT_MOD_NON_EXTREME = -1;          // 非极端阵营：极端行动惩罚
export const ALIGNMENT_MOD_LAWFUL_BLOCK_VOTE = 1;     // 守序阵营：阻止投票加成
export const ALIGNMENT_MOD_CHAOTIC_REBUT = 1;         // 混乱阵营：反驳行动加成
export const ALIGNMENT_MOD_EVIL_JOIN_SUSPECT = 2;     // 邪恶阵营：一同怀疑加成
export const ALIGNMENT_MOD_GOOD_JOIN_SUSPECT = -1;    // 善良阵营：一同怀疑惩罚
export const ALIGNMENT_MOD_GOOD_JOIN_DEFEND = 2;      // 善良阵营：一同袒护加成
export const ALIGNMENT_MOD_EVIL_JOIN_DEFEND = -1;     // 邪恶阵营：一同袒护惩罚
export const ALIGNMENT_MOD_CHAOTIC_KILL = 1;          // 混乱阵营：杀戮行动加成
export const ALIGNMENT_MOD_LAWFUL_CHECK = 1;          // 守序阵营：查验行动加成

// ---------- 游戏平衡：压力变化 ----------
export const STRESS_CHANGE_MINOR_POS = 1;             // 轻微正面压力变化（最小值）
export const STRESS_CHANGE_MINOR_POS_RANDOM = 2;      // 轻微正面压力变化（随机最大值）
export const STRESS_CHANGE_MINOR_NEG = -1;            // 轻微负面压力变化（最小值）
export const STRESS_CHANGE_MINOR_NEG_RANDOM = -2;     // 轻微负面压力变化（随机最大值）
export const STRESS_CHANGE_MODERATE_POS = 2;          // 中度正面压力变化（最小值）
export const STRESS_CHANGE_MODERATE_POS_RANDOM = 3;   // 中度正面压力变化（随机最大值）
export const STRESS_CHANGE_MAJOR_POS = 3;             // 重度正面压力变化（最小值）
export const STRESS_CHANGE_MAJOR_POS_RANDOM = 4;      // 重度正面压力变化（随机最大值）

// ---------- 游戏平衡：关系变化 ----------
export const REL_CHANGE_MINOR_NEG = -1;               // 轻微负面关系变化
export const REL_CHANGE_MINOR_POS = 1;                // 轻微正面关系变化
export const REL_CHANGE_MODERATE_NEG = -2;            // 中度负面关系变化
export const REL_CHANGE_MODERATE_POS = 2;             // 中度正面关系变化
export const REL_CHANGE_MAJOR_NEG = -3;               // 重度负面关系变化
export const REL_CHANGE_MAJOR_POS = 3;                // 重度正面关系变化

// ---------- Default Fallback Values ----------
export const DEFAULT_ATTRIBUTE_FALLBACK = ATTRIBUTE_DEFAULT; // 10
export const DEFAULT_STRESS_FALLBACK = 0;
export const DEFAULT_ALIGNMENT_FALLBACK: { law: 'neutral_law'; good: 'neutral_good' } = { law: 'neutral_law', good: 'neutral_good' };

// ---------- Empty-kill Chance ----------
export const EMPTY_KILL_CHANCE = 0.1;

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

// 属性名称映射
export const ATTRIBUTE_NAMES: Record<keyof Attributes, string> = {
  affinity: '亲和', logic: '逻辑', leadership: '领导',
  deception: '诡诈', stealth: '隐蔽', insight: '洞察',
};
