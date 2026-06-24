// ============================================================
// MemoryImpactRegistry — 统一声明式记忆影响规则表
// 解决：记忆影响规则分散在 inference/relation/intention 三处
// 所有影响值从此表导入，禁止在子系统中硬编码
// ============================================================

import type { MemoryEventType } from '@/types';

// ---------- 影响类型 ----------
export type ImpactTarget = 'role' | 'crisis' | 'relation' | 'intention';
export type ImpactDirection = 'direct' | 'indirect' | 'cascade';

/** 单条记忆对某子系统的具体影响定义 */
export interface MemoryImpactRule {
	target: ImpactTarget;
	field: string; // 如 'werewolfProb', 'crisisScore', 'friendly'
	operation: 'override' | 'add' | 'multiply' | 'trigger';
	value: number | string; // 数值或枚举值
	condition?: string; // 条件表达式，如 'claimedResult === werewolf'
	description: string;
	direction: ImpactDirection;
}

/** 每种记忆类型对应的完整影响规则集 */
export type MemoryImpactRegistry = Record<MemoryEventType, MemoryImpactRule[]>;

// ============================================================
// 声明式规则表：16 种 MemoryEventType × 4 种子系统
// 此表为唯一真相源，子系统应从本表读取而非硬编码
// ============================================================
export const MEMORY_IMPACT_REGISTRY: Partial<MemoryImpactRegistry> = {
	// ---- 硬信息（直接覆盖） ----
	check_result: [
		{ target: 'role', field: 'werewolfProb', operation: 'override', value: 1, condition: "result === 'werewolf'", description: '查验结果为狼人，直接覆盖概率', direction: 'direct' },
		{ target: 'role', field: 'werewolfProb', operation: 'override', value: 0, condition: "result === 'villager'", description: '查验结果为村民，直接覆盖概率', direction: 'direct' },
	],
	teammate_reveal: [
		{ target: 'role', field: 'werewolfProb', operation: 'override', value: 1, condition: "role === 'werewolf'", description: '队友揭示为狼人，直接覆盖概率', direction: 'direct' },
		{ target: 'role', field: 'werewolfProb', operation: 'override', value: 0, condition: "role !== 'werewolf'", description: '队友揭示非狼人，直接覆盖概率', direction: 'direct' },
	],
	self_role: [
		{ target: 'intention', field: 'longTerm', operation: 'trigger', value: 'survive', description: '知道自己角色，生成生存意图', direction: 'direct' },
	],

	// ---- 发言（间接加权） ----
	hear_claim: [
		{ target: 'role', field: 'werewolfProb', operation: 'add', value: 0.2, condition: "claimedResult === 'werewolf'", description: '声称查杀增加狼人权重（credibility × 0.5）', direction: 'indirect' },
		{ target: 'role', field: 'villagerProb', operation: 'add', value: 0.2, condition: "claimedResult === 'villager'", description: '声称金水增加村民权重（credibility × 0.5）', direction: 'indirect' },
		{ target: 'crisis', field: 'score', operation: 'add', value: 4, condition: "claimedResult === 'werewolf'", description: '被声称查杀增加危机度 +4', direction: 'indirect' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -5, condition: "claimedResult === 'werewolf' && targetId === selfId", description: '被声称查杀，对声称者友好度 -5', direction: 'direct' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: +2, condition: "claimedResult === 'villager' && targetId === selfId", description: '被声称金水，对声称者友好度 +2', direction: 'direct' },
	],
	hear_accuse: [
		{ target: 'crisis', field: 'score', operation: 'add', value: 2, description: '被指控增加危机度 +2', direction: 'indirect' },
		{ target: 'role', field: 'werewolfProb', operation: 'add', value: 0, description: '指控者统计（搅屎棍检测）：频繁指控不同人增加自身狼人概率', direction: 'indirect' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -3, condition: 'targetId === selfId', description: '被指控，对指控者友好度 -3', direction: 'direct' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -0.3, condition: 'targetId !== selfId', description: '观察到别人指控别人，对指控者友好度 -0.3（旁观衰减）', direction: 'indirect' },
	],
	hear_defend: [
		{ target: 'crisis', field: 'score', operation: 'add', value: -2, description: '被辩护降低危机度 -2', direction: 'indirect' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: +2, condition: 'targetId === selfId', description: '被辩护，对辩护者友好度 +2', direction: 'direct' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: +0.2, condition: 'targetId !== selfId', description: '观察到别人辩护别人，对辩护者友好度 +0.2（旁观衰减）', direction: 'indirect' },
	],
	hear_chat: [
		{ target: 'relation', field: 'friendly', operation: 'add', value: +1, condition: 'content.success === true && targetId === selfId', description: '闲聊成功，对发起者友好度 +1', direction: 'direct' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -1, condition: 'content.success === false && targetId === selfId', description: '闲聊失败，对发起者友好度 -1', direction: 'direct' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: +0.1, condition: 'content.success === true && targetId !== selfId', description: '观察到闲聊成功，对发起者友好度 +0.1（旁观衰减）', direction: 'indirect' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -0.1, condition: 'content.success === false && targetId !== selfId', description: '观察到闲聊失败，对发起者友好度 -0.1（旁观衰减）', direction: 'indirect' },
		{ target: 'intention', field: 'shortTerm', operation: 'trigger', value: 'chat', condition: 'content.success === true', description: '闲聊成功触发社交意图', direction: 'indirect' },
	],
	hear_silence: [
		{ target: 'role', field: 'werewolfProb', operation: 'add', value: 0, description: '沉默本身不直接改变概率，但可结合 observe_pattern 的 hide 意图', direction: 'indirect' },
	],

	// ---- 投票（system 来源，高可信度） ----
	vote: [
		{ target: 'crisis', field: 'score', operation: 'add', value: 3, description: '被投票增加危机度 +3', direction: 'indirect' },
		{ target: 'role', field: 'werewolfProb', operation: 'add', value: 0.4, description: '被投票增加狼人权重（抗推检测）', direction: 'indirect' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -2, condition: 'targetId === selfId', description: '被投票，对投票者友好度 -2', direction: 'direct' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -0.2, condition: 'targetId !== selfId', description: '观察到别人投票给别人，对投票者友好度 -0.2（旁观衰减）', direction: 'indirect' },
	],

	// ---- 观察（observe 来源） ----
	observe_pattern: [
		{ target: 'role', field: 'werewolfProb', operation: 'add', value: 0.392, condition: "inferredIntention === 'attack'", description: '观察到攻击意图增加狼人权重（credibility × confidence × 0.8）', direction: 'indirect' },
		{ target: 'role', field: 'villagerProb', operation: 'add', value: 0.35, condition: "inferredIntention === 'protect'", description: '观察到保护意图增加村民权重（credibility × confidence × 0.5）', direction: 'indirect' },
		{ target: 'role', field: 'werewolfProb', operation: 'add', value: 0.245, condition: "inferredIntention === 'hide'", description: '观察到隐藏意图增加狼人权重（credibility × confidence × 0.5）', direction: 'indirect' },
		{ target: 'crisis', field: 'score', operation: 'add', value: 1, condition: "inferredIntention === 'attack'", description: '被观察攻击增加危机度 +1', direction: 'indirect' },
		{ target: 'crisis', field: 'score', operation: 'add', value: 0, condition: "inferredIntention === 'hide'", description: '被观察隐藏不增加危机度', direction: 'indirect' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: -2, condition: "inferredIntention === 'attack' && intentionTarget === selfId", description: '观察到某人攻击我，对攻击者友好度 -2', direction: 'direct' },
		{ target: 'relation', field: 'friendly', operation: 'add', value: +2, condition: "inferredIntention === 'protect' && intentionTarget === selfId", description: '观察到某人保护我，对保护者友好度 +2', direction: 'direct' },
	],

	// ---- 系统事件 ----
	death: [
		{ target: 'intention', field: 'longTerm', operation: 'trigger', value: 're_evaluate', description: '有人死亡，重新评估局势', direction: 'cascade' },
	],
	morning: [
		{ target: 'intention', field: 'longTerm', operation: 'trigger', value: 're_evaluate', description: '天亮，重新评估局势', direction: 'cascade' },
	],
	peaceful_night: [
		{ target: 'intention', field: 'longTerm', operation: 'trigger', value: 're_evaluate', description: '平安夜，重新评估局势', direction: 'cascade' },
	],
	vote_result: [
		{ target: 'intention', field: 'longTerm', operation: 'trigger', value: 're_evaluate', description: '投票结果公布，重新评估局势', direction: 'cascade' },
	],
	night_kill_vote: [
		{ target: 'intention', field: 'shortTerm', operation: 'trigger', value: 'coordinate_attack', description: '狼人夜间投票，白天协同攻击', direction: 'direct' },
	],
};

/** 获取某记忆类型对指定子系统的所有影响规则 */
export function getImpactRules(
	eventType: MemoryEventType,
	target?: ImpactTarget,
): MemoryImpactRule[] {
	const rules = MEMORY_IMPACT_REGISTRY[eventType] ?? [];
	if (!target) return rules;
	return rules.filter((r) => r.target === target);
}

/** 获取所有记忆类型对指定子系统的规则汇总（用于文档生成） */
export function getAllRulesByTarget(target: ImpactTarget): { eventType: MemoryEventType; rules: MemoryImpactRule[] }[] {
	const result: { eventType: MemoryEventType; rules: MemoryImpactRule[] }[] = [];
	for (const [eventType, rules] of Object.entries(MEMORY_IMPACT_REGISTRY)) {
		const filtered = rules.filter((r) => r.target === target);
		if (filtered.length > 0) {
			result.push({ eventType: eventType as MemoryEventType, rules: filtered });
		}
	}
	return result;
}
