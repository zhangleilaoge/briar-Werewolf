// ============================================================
// Intention Types — Core Type Definitions
// ============================================================

import type { BeliefSystem } from '../belief-system';
import type { Player } from '@/types';

export enum IntentionType {
  ATTACK = 'attack', // 攻击/淘汰目标
  DEFEND = 'defend', // 保护目标
  CONCEAL = 'conceal', // 隐藏自身身份
  REVEAL = 'reveal', // 揭露信息
  INVESTIGATE = 'investigate', // 调查/查验
  SURVIVE = 'survive', // 个人生存
  RECRUIT = 'recruit', // 拉票/建立信任
  CUT_LOSS = 'cut_loss', // 切割/止损（狼人Bus队友）
  FOLLOW = 'follow', // 跟随他人号召
  SILENCE = 'silence', // 保持沉默/观察
}

export enum IntentionSource {
  ROLE_DUTY = 'role_duty', // 角色义务（硬约束）
  TEAM_DUTY = 'team_duty', // 团队义务（硬约束）
  PERSONAL_GOAL = 'personal_goal', // 个人目标
  REACTION = 'reaction', // 对事件的即时反应
  OPPORTUNITY = 'opportunity', // 机会驱动
}

export enum CommitmentLevel {
  STRONG = 'strong', // 几乎不可改变（如预言家公布查验）
  MEDIUM = 'medium', // 需要强烈证据才改变
  WEAK = 'weak', // 灵活改变
}

/** 计划步骤：意图分解为具体行为 */
export interface PlanStep {
  phase: string; // 适用阶段（day/vote/appendix/night）
  action: string; // 行为类型
  targetRequired: boolean; // 是否需要目标
  condition?: (ctx: IntentionExecutionContext) => boolean; // 执行条件
  fallback?: string; // 条件不满足时的回退行为
}

/** 意图：高层决策单元，有持久性 */
export interface Intention {
  id: string;
  type: IntentionType;
  targetId: string | null; // 目标玩家ID或null
  priority: number; // 0-1000，动态计算
  commitment: CommitmentLevel;
  source: IntentionSource;
  plan: PlanStep[];
  currentStepIndex: number; // 当前执行到第几步
  lifetime: number; // 剩余回合寿命（-1=永久）
  createdRound: number;
  context: Record<string, unknown>; // 额外上下文
  active: boolean;
  abandoned?: boolean;
  abandonReason?: string;
  // 历史追踪
  executionHistory: { round: number; phase: string; action: string; result: 'executed' | 'skipped' | 'blocked' }[];
}

/** 意图执行上下文 */
export interface IntentionExecutionContext {
  self: Player;
  belief: BeliefSystem;
  allPlayers: Player[];
  phase: string;
  publicActions?: { actorId: string; type: string; targetId?: string }[];
  voteRound?: number;
  voteCandidates?: string[];
}

/** 愿望：意图的前置，从状态推导 */
export interface Desire {
  type: IntentionType;
  targetId: string | null;
  strength: number; // 0-100
  source: IntentionSource;
  reason: string;
  conditions: string[]; // 触发条件描述
}

/** 意图上下文（用于硬约束） */
export interface IntentionContext {
  belief: BeliefSystem;
  self: Player;
  phase: string;
  allPlayers: Player[];
  publicActions?: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[];
  voteRound?: number;
  voteCandidates?: string[];
}
