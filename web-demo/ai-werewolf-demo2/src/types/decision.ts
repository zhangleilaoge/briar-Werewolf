// ============================================================
// 决策系统类型定义（Decision Types）
// 从 types/index.ts 的注释中提取，独立文件避免修改已有代码
// ============================================================

export type DayActionType =
  | 'silence'          // 沉默：跳过本回合
  | 'claim_identity'   // 公布身份
  | 'observe'          // 观察
  | 'suspect'          // 怀疑
  | 'defend'           // 袒护
  | 'chat';            // 闲聊

export type NightActionType =
  | 'check'            // 预言家查验
  | 'kill';            // 狼人击杀

export type ActionType = DayActionType | NightActionType;

export interface ActionCandidate {
  action: ActionType;
  targetId?: string;
  score: number;           // 综合评分
  reason: string;          // 为什么选这个
  supportingMemories: string[]; // 支撑这个决策的记忆ID
}

// ---------- 意图系统 ----------
export interface LongTermIntention {
  id: string;
  priority: number;        // 优先级，0~1
  targetPlayer?: string;   // 指向性目标
  description: string;     // 意图描述
  basis: string[];         // 支撑记忆ID
}

export interface ShortTermIntention {
  id: string;
  type: 'pointed' | 'unpointed';  // 有指向 / 无指向
  targetId?: string;              // 指向的目标
  weight: number;                  // 当前权重
  description: string;
  basis: string[];                  // 支撑记忆ID
}

export interface IntentionState {
  longTerm: LongTermIntention[];
  shortTerm: ShortTermIntention[];
  candidates: ActionCandidate[];
  selected: ActionCandidate | null;
}

// ---------- 性格系统 ----------
export interface PersonalityPlugin {
  id: string;
  name: string;
  description: string;
  disabledActions: ActionType[];
  actionWeightMods: Record<string, number>; // 使用 string 避免 ActionType 严格限制
}

// ---------- 压力系统 ----------
export interface PressureState {
  current: number;     // 当前压力值，0~20
  max: number;        // 压力上限
  burstCount: number; // 已满次数
}
