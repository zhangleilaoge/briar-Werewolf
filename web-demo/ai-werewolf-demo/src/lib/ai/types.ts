// ============================
// AI Werewolf Demo - Complete Game Types
// Based on design docs in /doc
// ============================

// ---------- Attributes (六维属性) ----------
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
  affinity: 5,
  logic: 5,
  leadership: 5,
  deception: 5,
  stealth: 5,
  insight: 5,
};

// ---------- Alignment (阵营九宫格) ----------
export type LawAxis = 'lawful' | 'neutral_law' | 'chaotic';
export type GoodAxis = 'good' | 'neutral_good' | 'evil';

export interface Alignment {
  law: LawAxis;
  good: GoodAxis;
}

// ---------- Relations (关系) ----------
export interface Relation {
  trust: number;      // -10 ~ +10, 理性判断对方可靠性
  friendly: number;   // -10 ~ +10, 情感倾向
}

export interface RelationDelta {
  trustDelta: number;
  friendlyDelta: number;
}

// ---------- Stress (压力值) ----------
// Range: -10 ~ +10, 0 is baseline
// +10 = overload, triggers overload reaction

// ---------- Items (道具) ----------
export type ItemType = 'action_prerequisite' | 'check_bonus' | 'consumable' | 'passive';

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  maxDurability: number; // 耐久度上限
  // Effects differ by holder's team
  werewolfEffect: string;
  villagerEffect: string;
  description: string;
}

export interface ItemInstance {
  definitionId: string;
  durability: number; // 当前耐久度, 0 = broken/destroyed
}

// ---------- Roles (职业) ----------
export type Role =
  | 'werewolf'      // 普通狼人
  | 'lone_wolf'     // 孤狼 (trait-based)
  | 'berserker'     // 狂狼
  | 'villager'      // 普通村民
  | 'prophet'       // 预言家
  | 'thief'         // 窃贼
  | 'coroner';      // 验尸官

export type Team = 'werewolf' | 'villager';

export interface RoleInfo {
  role: Role;
  label: string;
  team: Team;
  description: string;
  defaultItems: string[];
}

// ---------- Traits (特质) ----------
export interface Trait {
  id: string;
  name: string;
  description: string;
}

// ---------- Phases (阶段) ----------
export type Phase = 'night' | 'morning' | 'day' | 'vote' | 'init' | 'ended' | 'event';

export type DaySubPhase = 'action' | 'appendix' | 'vote';

// ---------- Actions (行动) ----------

// 白天普通行动
export type DayActionType =
  | 'silence'           // 沉默
  | 'speak'             // 普通发言（无特定行动，仅打破沉默）
  | 'claim_identity'    // 公布身份
  | 'reveal_info'       // 公开信息
  | 'observe'           // 观察
  | 'suspect'           // 怀疑
  | 'defend'            // 袒护
  | 'thank'             // 感谢
  | 'call_vote'         // 号召投票
  | 'block_vote'        // 阻止投票
  | 'guarantee'         // 担保清白
  | 'accuse'            // 强烈指认
  | 'exclude_all'       // 全员排除
  | 'berserker_kill';   // 狂狼同归于尽

// 追加行动
export type AppendixActionType =
  | 'join_suspect'      // 一同怀疑
  | 'rebut'             // 反驳
  | 'join_defend';      // 一同袒护

// 夜晚行动
export type NightActionType =
  | 'kill'              // 狼人杀戮
  | 'check'             // 预言家查验
  | 'steal'             // 窃贼偷取
  | 'inspect';          // 验尸官验尸

export type ActionType = DayActionType | AppendixActionType | NightActionType | 'vote';

// ---------- Check / Roll (检定) ----------
export interface CheckResult {
  roll: number;        // d20 result (1-20)
  modifier: number;    // attribute + other bonuses
  total: number;       // roll + modifier
  difficulty: number;    // target value
  success: boolean;
  criticalSuccess: boolean; // total >= difficulty + 10
  criticalFail: boolean;    // total <= difficulty - 10
  margin: number;      // total - difficulty
}

// ---------- Player (玩家) ----------
export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  items: ItemInstance[];
  attributes: Attributes;
  alignment: Alignment;
  traits: string[];
  stress: number; // -10 ~ +10
  // Relations: directed, this player's view of others
  relations: Record<string, Relation>; // key = other player id
}

// ---------- Game Log ----------
export interface GameLogItem {
  round: number;
  phase: Phase;
  message: string;
  type: 'phase' | 'action' | 'death' | 'victory' | 'info' | 'check' | 'relation' | 'stress' | 'item' | 'thinking';
  details?: Record<string, unknown>;
}

// ---------- Game Config ----------
export interface GameConfig {
  totalPlayers: number;
  werewolfRoles: { role: Role; count: number }[];
  villagerRoles: { role: Role; count: number }[];
}

// ---------- Victory ----------
export type Winner = 'villager' | 'werewolf' | null;

// ---------- Vote Result ----------
export interface VoteResult {
  round: number; // 1 or 2
  votes: Record<string, string[]>; // targetId -> voterIds
  maxVotes: number;
  topTargets: string[];
  eliminatedId: string | null;
  tie: boolean;
  nextRound: boolean; // needs second round
}

// ---------- Setup Config ----------
export interface SetupConfig {
  totalPlayers: number;
  werewolfConfig: { role: string; count: number }[];
  villagerConfig: { role: string; count: number }[];
}

// ---------- Decision Types (AI Decision System) ----------

export interface DecisionCandidate {
  action: string;
  target: string | null;
  score: number;
  confidence: number;
  reason: string;
  details?: Record<string, unknown>;
  stageWeight?: number;
  stage?: string;
  strategy?: string;
  rule?: string;
  trigger?: string;
  random?: boolean;
}

export interface DecisionProcess {
  candidates: {
    action: string;
    target: string | null;
    reason: string;
    score: number;
    stageWeight: number;
    totalScore: number;
    stage: string;
    strategy: string;
    rule: string;
    trigger: string;
    random: boolean;
    modifiers: { alignment: number; stress: number; relation: number; total: number };
  }[];
  winner: string;
  shortlist: string;
}

export interface DecisionResult {
  action: string;
  target: string | null;
  reason: string;
  stage: string;
  confidence: number;
  emotionalTone: string;
  details?: Record<string, unknown>;
  process?: DecisionProcess;
}

// ---------- Public Claim ----------

export interface PublicClaim {
  playerId: string;
  claim: string;
  content: Record<string, unknown>;
  round: number;
}

// ---------- Log Entry ----------

export interface LogEntry {
  round: number;
  phase: Phase;
  message: string;
  timestamp: number;
}

// ---------- Check Log ----------

export interface ModifierBreakdown {
  baseAttribute: number;
  alignmentMod: number;
  stressMod: number;
  total: number;
}

export interface CheckLog {
  type: 'check' | 'opposed';
  actorName: string;
  actorAttribute: string;
  actorBaseValue: number;
  actorAlignmentMod: number;
  actorStressMod: number;
  actorTotalModifier: number;
  actorRoll: number;
  actorTotal: number;
  targetName?: string;
  targetAttribute?: string;
  targetBaseValue?: number;
  targetAlignmentMod?: number;
  targetStressMod?: number;
  targetTotalModifier?: number;
  targetRoll?: number;
  targetTotal?: number;
  difficulty?: number;
  margin: number;
  success: boolean;
  successLevel: string;
}

export interface ActionLogDetail {
  decisionReason: string;
  checks: CheckLog[];
  actorId: string;
  action: string;
  targetId?: string | null;
  process?: DecisionProcess;
  [key: string]: unknown;
}

// ---------- Re-exports for backward compatibility ----------
export { ALIGNMENT_NAMES, ITEM_DEFINITIONS, ROLE_INFO, TRAITS } from './data-definitions';
export {
  rollD20, performCheck,
  clamp, clampStress, clampRelation,
  getAlignmentName,
  hasItem, getItem, removeItem, addItem, damageItem, canUseItem,
  generateRandomAttributes, generateRandomAlignment,
  getStressModifier, getAlignmentModifier,
  calculateModifierBreakdown, calculateFinalModifier,
  performOpposedCheck,
  ATTRIBUTE_NAMES,
} from './game-utils';
