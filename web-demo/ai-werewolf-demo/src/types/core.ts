// ============================
// AI 狼人杀 — 核心类型定义
// ============================

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
export interface Relation {
  favor: number;    // 综合好感度
  trust: number;    // 信任度
  friendly: number; // 友好度
}
export interface RelationDelta {
  favorDelta?: number;
  trustDelta?: number;
  friendlyDelta?: number;
}

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

// ---------- Player (玩家) ----------
export interface Player {
  id: string; name: string; role: Role; team: Team; alive: boolean;
  items: ItemInstance[]; attributes: Attributes; alignment: Alignment;
  traits: string[]; stress: number; relations: Record<string, Relation>;
  exposure?: number; // 暴露度（0-1），由belief系统计算
  suspicionByOthers?: Record<string, number>; // 其他人对我的怀疑度
}

// ---------- Fake Identity System (伪装身份系统) ----------
export interface FakeIdentity {
  /** 伪装者ID */
  impersonatorId: string;
  /** 伪装目标角色 */
  claimedRole: Role;
  /** 伪装回合 */
  claimRound: number;
  /** 伪造的查验结果 */
  claimedChecks: Map<string, 'werewolf' | 'villager'>;
  /** 行为一致性分数 (0-1) */
  consistencyScore: number;
  /** 是否已被揭穿 */
  exposed: boolean;
}

export interface FakeIdentityState {
  /** 全局伪装记录：被伪装者ID → 伪装信息 */
  claims: Map<string, FakeIdentity>;
  /** 真预言家是否已跳身份 */
  realProphetRevealed: boolean;
  /** 已跳预言家的玩家列表 */
  claimedProphets: string[];
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
    details?: Record<string, unknown>;
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
