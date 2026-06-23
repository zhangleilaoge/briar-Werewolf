// ============================================================
// 推理溯源类型定义（Trace Types）
// 为 hover 展示和可解释性提供完整计算轨迹
// ============================================================

import type { MemoryEventType, MemoryEntry } from './base';

/** 溯源中允许的记忆事件类型（包含占位符 'unknown'） */
export type TraceEventType = MemoryEventType | 'unknown';

// ---------- 单条记忆对推理结果的具体影响 ----------
export interface MemoryImpact {
	memoryId: string;
	eventType: TraceEventType;
	actorId: string;
	targetId?: string;
	impactType: 'direct' | 'indirect' | 'cascade';
	// direct: 直接支撑（如 check_result 直接决定概率）
	// indirect: 间接加权（如 hear_claim 通过可信度加权）
	// cascade: 级联影响（如 hear_accuse → 危机度上升 → 保护意图权重上升）
	description: string; // 人类可读描述
	deltaScore: number; // 分数变化量
	beforeScore: number; // 变化前
	afterScore: number; // 变化后
}

// ---------- 计算步骤 ----------
export interface CalculationStep {
	step: string; // 如 "硬信息检查"
	formula: string; // 如 "check_result: werewolf → 直接覆盖"
	result: number;
	basis: string[]; // 相关记忆ID
}

// ---------- 推理结果的影响溯源（通用） ----------
export interface InferenceTrace {
	resultType: 'role' | 'crisis' | 'relation' | 'intention' | 'candidate';
	targetId: string; // 对谁的结果
	finalValue: number; // 最终值
	impacts: MemoryImpact[]; // 所有影响，按重要性排序
	calculationSteps: CalculationStep[];
}

// ---------- 角色推理溯源（专用于角色概率） ----------
export interface RoleInferenceTrace extends InferenceTrace {
	resultType: 'role';
	werewolfProb: number;
	villagerProb: number;
	// 各阶段贡献
	hardInfoOverride: boolean; // 是否被硬信息直接覆盖
	claimContributions: { memoryId: string; weight: number; claimedResult: string }[];
	observeContributions: { memoryId: string; weight: number; inferredIntention: string }[];
	accuserSpamPenalty: number; // 搅屎棍惩罚
	voteConsistencyBonus: number; // 投票一致性奖励
}

// ---------- 危机度溯源 ----------
export interface CrisisTrace extends InferenceTrace {
	resultType: 'crisis';
	factors: {
		accuseCount: number;
		voteCount: number;
		defendCount: number;
		observeCount: number;
		claimWolfCount: number;
	};
	factorDetails: { memoryId: string; eventType: TraceEventType; actorId: string; delta: number; decayed?: boolean }[];
}

// ---------- 关系溯源 ----------
export interface RelationTrace extends InferenceTrace {
	resultType: 'relation';
	directImpacts: MemoryImpact[]; // 直接对我做的
	bystanderImpacts: MemoryImpact[]; // 我观察到的（衰减后）
	totalDirect: number;
	totalBystander: number;
}

// ---------- 意图溯源 ----------
export interface IntentionTrace {
	stage: 'long_term' | 'short_term' | 'candidate' | 'selection';
	factor: string; // 如 "roleBonus"
	baseValue: number; // 修正前
	delta: number; // 修正量
	result: number; // 修正后
	basis: MemoryImpact[]; // 支撑记忆
}

// ---------- 带溯源的候选 ----------
export interface TracedActionCandidate {
	action: string;
	targetId?: string;
	score: number;
	reason: string;
	supportingMemories: string[];
	traces: IntentionTrace[]; // 完整的得分计算轨迹
}

// ---------- 带溯源的意图状态 ----------
export interface TracedIntentionState {
	longTerm: { id: string; priority: number; targetPlayer?: string; description: string; basis: string[]; traces: IntentionTrace[] }[];
	shortTerm: { id: string; type: 'pointed' | 'unpointed'; targetId?: string; weight: number; description: string; basis: string[]; traces: IntentionTrace[] }[];
	candidates: TracedActionCandidate[];
	selected: TracedActionCandidate | null;
	selectionTrace: IntentionTrace[]; // 最终选择的计算轨迹
}
