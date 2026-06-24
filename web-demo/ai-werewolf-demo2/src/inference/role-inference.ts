// ============================================================
// Role Inference — 角色概率推理
// 从记忆条目中推断某玩家的狼人/村民概率
// ============================================================

import type { MemoryEntry, MemoryEventType, Player } from '@/types';
import { getString, getNumber } from '@/types/guards';
import type { MemStore } from '@/memory';
import { getImpactRules } from '@/constants';
import type { RoleInferenceTrace, MemoryImpact, CalculationStep } from '@/types/trace';
import {
	BELIEF_DEFAULT,
	CLAIM_WEIGHT_FACTOR,
	OBSERVE_WEIGHT,
	HARD_INFO_THRESHOLD,
	ACCUSER_SPAM_WEIGHT,
} from '@/constants';

export interface RoleInference {
	playerId: string;
	werewolfProb: number;
	villagerProb: number;
	basis: string[];
	trace?: RoleInferenceTrace;
}

/**
 * 硬信息覆盖通用函数。
 * 对 check_result / teammate_reveal 类型记忆，若可信度≥阈值且目标匹配，直接覆盖概率。
 */
export function applyHardInfo(
	mem: MemoryEntry,
	playerId: string,
	withTrace: boolean,
	impacts: MemoryImpact[],
	steps: CalculationStep[],
): RoleInference | null {
	if (mem.credibility < HARD_INFO_THRESHOLD) return null;

	let result: string | undefined;
	let label: string | undefined;

	if (mem.eventType === 'check_result' && mem.targetId === playerId) {
		result = getString(mem.content, 'result');
		label = '查验结果';
	} else if (mem.eventType === 'teammate_reveal' && mem.targetId === playerId) {
		result = getString(mem.content, 'role');
		label = '队友揭示';
	}

	if (!result || !label) return null;

	const prob = result === 'werewolf' ? 1.0 : 0;
	if (withTrace) {
		impacts.push({
			memoryId: mem.id,
			eventType: mem.eventType,
			actorId: mem.actorId,
			targetId: mem.targetId,
			impactType: 'direct',
			description: `硬信息：${label}为 ${result}，直接覆盖概率`,
			deltaScore: prob === 1.0 ? 0.7 : -0.7,
			beforeScore: BELIEF_DEFAULT.WEREWOLF_PROB,
			afterScore: prob,
		});
		steps.push({
			step: '硬信息检查',
			formula: `${mem.eventType}: ${result} → 直接覆盖`,
			result: prob,
			basis: [mem.id],
		});
	}
	return {
		playerId,
		werewolfProb: prob,
		villagerProb: 1 - prob,
		basis: [mem.id],
		trace: withTrace
			? {
					resultType: 'role',
					targetId: playerId,
					finalValue: prob,
					impacts,
					calculationSteps: steps,
					werewolfProb: prob,
					villagerProb: 1 - prob,
					hardInfoOverride: true,
					claimContributions: [],
					observeContributions: [],
					accuserSpamPenalty: 0,
					voteConsistencyBonus: 0,
				}
			: undefined,
	};
}

/** 核心角色推理逻辑（带溯源） */
export function inferPlayer(
	store: MemStore,
	playerId: string,
	withTrace = false,
): RoleInference {
	const memories = store.aboutPlayer(playerId).filter((m) => !m.isForgotten);
	const basis: string[] = [];
	const impacts: MemoryImpact[] = [];
	const steps: CalculationStep[] = [];
	let hardInfoOverride = false;
	let accuserSpamPenalty = 0;
	let voteConsistencyBonus = 0;
	const claimContributions: { memoryId: string; weight: number; claimedResult: string }[] = [];
	const observeContributions: { memoryId: string; weight: number; inferredIntention: string }[] = [];

	// 1. 硬信息直接覆盖
	for (const mem of memories) {
		const hardInfoResult = applyHardInfo(
			mem,
			playerId,
			withTrace,
			impacts,
			steps,
		);
		if (hardInfoResult) {
			if (withTrace) {
				hardInfoOverride = true;
			}
			return hardInfoResult;
		}
	}

	if (withTrace) {
		steps.push({
			step: '硬信息检查',
			formula: '无硬信息覆盖',
			result: 0,
			basis: [],
		});
	}

	// 2. 软信息综合推理
	let wolfWeight = 0;
	let villagerWeight = 0;
	let totalWeight = 0;
	let stepBeforeWolf = BELIEF_DEFAULT.WEREWOLF_PROB;
	let stepBeforeVillager = BELIEF_DEFAULT.VILLAGER_PROB;

	// 2a. 声称查杀/金水
	for (const mem of memories) {
		if (mem.eventType === 'hear_claim' && mem.targetId === playerId) {
			const claimedResult = getString(mem.content, 'claimedResult');
			const weight = mem.credibility * CLAIM_WEIGHT_FACTOR;
			if (claimedResult === 'werewolf') {
				wolfWeight += weight;
				basis.push(mem.id);
				if (withTrace) {
					claimContributions.push({ memoryId: mem.id, weight, claimedResult: 'werewolf' });
					impacts.push({
						memoryId: mem.id,
						eventType: 'hear_claim',
						actorId: mem.actorId,
						targetId: mem.targetId,
						impactType: 'indirect',
						description: `${mem.actorId} 声称 ${playerId} 是狼，可信度 ${mem.credibility} × 0.5 = +${weight.toFixed(1)} 狼人权重`,
						deltaScore: weight,
						beforeScore: stepBeforeWolf,
						afterScore: stepBeforeWolf + weight,
					});
					stepBeforeWolf += weight;
				}
			} else if (claimedResult === 'villager') {
				villagerWeight += weight;
				basis.push(mem.id);
				if (withTrace) {
					claimContributions.push({ memoryId: mem.id, weight, claimedResult: 'villager' });
					impacts.push({
						memoryId: mem.id,
						eventType: 'hear_claim',
						actorId: mem.actorId,
						targetId: mem.targetId,
						impactType: 'indirect',
						description: `${mem.actorId} 声称 ${playerId} 是村民，可信度 ${mem.credibility} × 0.5 = +${weight.toFixed(1)} 村民权重`,
						deltaScore: weight,
						beforeScore: stepBeforeVillager,
						afterScore: stepBeforeVillager + weight,
					});
					stepBeforeVillager += weight;
				}
			}
			totalWeight += weight;
		}
	}
	if (withTrace && claimContributions.length > 0) {
		steps.push({
			step: '声称加权',
			formula: `Σ(可信度 × ${CLAIM_WEIGHT_FACTOR}) = ${totalWeight.toFixed(1)}`,
			result: totalWeight,
			basis: claimContributions.map((c) => c.memoryId),
		});
	}

	// 2b. 观察到的短期意图
	for (const mem of memories) {
		if (mem.eventType === 'observe_pattern') {
			const inferredIntention = getString(mem.content, 'inferredIntention');
			const intentionTarget = getString(mem.content, 'intentionTarget');
			const confidenceValue = getNumber(mem.content, 'confidence') ?? OBSERVE_WEIGHT.DEFAULT_CONFIDENCE;
			const weight = mem.credibility * confidenceValue;

			if (inferredIntention === 'attack' && intentionTarget === playerId) {
				const delta = weight * OBSERVE_WEIGHT.ATTACK_WOLF;
				wolfWeight += delta;
				basis.push(mem.id);
				totalWeight += weight;
				if (withTrace) {
					observeContributions.push({ memoryId: mem.id, weight: delta, inferredIntention: 'attack' });
					impacts.push({
						memoryId: mem.id,
						eventType: 'observe_pattern',
						actorId: mem.actorId,
						targetId: mem.targetId,
						impactType: 'indirect',
						description: `观察到 ${mem.actorId} 攻击 ${playerId}，可信度 ${mem.credibility} × 置信度 ${confidenceValue} × 攻击权重 ${OBSERVE_WEIGHT.ATTACK_WOLF} = +${delta.toFixed(1)} 狼人权重`,
						deltaScore: delta,
						beforeScore: stepBeforeWolf,
						afterScore: stepBeforeWolf + delta,
					});
					stepBeforeWolf += delta;
				}
			}
			if (inferredIntention === 'protect' && intentionTarget === playerId) {
				const delta = weight * OBSERVE_WEIGHT.PROTECT_VILLAGER;
				villagerWeight += delta;
				basis.push(mem.id);
				totalWeight += weight;
				if (withTrace) {
					observeContributions.push({ memoryId: mem.id, weight: delta, inferredIntention: 'protect' });
					impacts.push({
						memoryId: mem.id,
						eventType: 'observe_pattern',
						actorId: mem.actorId,
						targetId: mem.targetId,
						impactType: 'indirect',
						description: `观察到 ${mem.actorId} 保护 ${playerId}，可信度 ${mem.credibility} × 置信度 ${confidenceValue} × 保护权重 ${OBSERVE_WEIGHT.PROTECT_VILLAGER} = +${delta.toFixed(1)} 村民权重`,
						deltaScore: delta,
						beforeScore: stepBeforeVillager,
						afterScore: stepBeforeVillager + delta,
					});
					stepBeforeVillager += delta;
				}
			}
			if (inferredIntention === 'hide') {
				const delta = weight * OBSERVE_WEIGHT.HIDE_WOLF;
				wolfWeight += delta;
				basis.push(mem.id);
				totalWeight += weight;
				if (withTrace) {
					observeContributions.push({ memoryId: mem.id, weight: delta, inferredIntention: 'hide' });
					impacts.push({
						memoryId: mem.id,
						eventType: 'observe_pattern',
						actorId: mem.actorId,
						targetId: mem.targetId,
						impactType: 'indirect',
						description: `观察到 ${mem.actorId} 隐藏意图，可信度 ${mem.credibility} × 置信度 ${confidenceValue} × 隐藏权重 ${OBSERVE_WEIGHT.HIDE_WOLF} = +${delta.toFixed(1)} 狼人权重`,
						deltaScore: delta,
						beforeScore: stepBeforeWolf,
						afterScore: stepBeforeWolf + delta,
					});
					stepBeforeWolf += delta;
				}
			}
		}
	}
	if (withTrace && observeContributions.length > 0) {
		steps.push({
			step: '观察意图加权',
			formula: `观察到的行为模式加权`,
			result: observeContributions.reduce((s, c) => s + c.weight, 0),
			basis: observeContributions.map((c) => c.memoryId),
		});
	}

	// 2c. 【新增】搅屎棍检测：频繁指控不同人的玩家，其狼人概率上升
	// 收集所有指控 playerId 的记忆，统计指控者
	const accuserTargetMap = new Map<string, Set<string>>(); // accuserId -> Set of accused targets
	for (const mem of store.getAll().filter((m) => !m.isForgotten && m.eventType === 'hear_accuse')) {
		const accuser = mem.actorId;
		const target = mem.targetId;
		if (!accuser || !target) continue;
		if (!accuserTargetMap.has(accuser)) accuserTargetMap.set(accuser, new Set());
		accuserTargetMap.get(accuser)!.add(target);
	}
	// 如果当前 playerId 是某个指控者，且该指控者指控了多个不同目标
	if (accuserTargetMap.has(playerId)) {
		const accusedTargets = accuserTargetMap.get(playerId)!;
		const targetCount = accusedTargets.size;
		if (targetCount >= 2) {
			// 每多指控一个不同目标，增加狼人概率
			const penalty = ACCUSER_SPAM_WEIGHT.BASE_PENALTY + (targetCount - 2) * ACCUSER_SPAM_WEIGHT.PER_TARGET_PENALTY;
			wolfWeight += penalty;
			totalWeight += penalty;
			accuserSpamPenalty = penalty;
			if (withTrace) {
				impacts.push({
					memoryId: '',
					eventType: 'hear_accuse',
					actorId: playerId,
					targetId: playerId,
					impactType: 'indirect',
					description: `搅屎棍检测：${playerId} 指控了 ${targetCount} 个不同目标，额外 +${penalty.toFixed(1)} 狼人权重`,
					deltaScore: penalty,
					beforeScore: stepBeforeWolf,
					afterScore: stepBeforeWolf + penalty,
				});
				steps.push({
					step: '搅屎棍检测',
					formula: `${targetCount} 个不同目标 → +${penalty.toFixed(1)} 狼人权重`,
					result: penalty,
					basis: [],
				});
				stepBeforeWolf += penalty;
			}
		}
	}

	// 2d. 【新增】投票参与角色推理
	// 从 MEMORY_IMPACT_REGISTRY 读取 vote → role 的权重，替代硬编码 VOTE_ROLE_WEIGHT
	const voteRoleRules = getImpactRules('vote', 'role');
	const baseVoteWeight = voteRoleRules.length > 0 ? (voteRoleRules[0].value as number) : 0.4;
	// 如果某人投票给 playerId，且该投票是 system 来源（1.0 可信度），这比声称更可信
	for (const mem of store.getAll().filter((m) => !m.isForgotten && m.eventType === 'vote' && m.targetId === playerId)) {
		const voterId = mem.actorId;
		// 投票者投给 playerId，说明 voterId 认为 playerId 可疑
		// 这增加 playerId 的狼人权重（间接，通过投票者的判断）
		const voteWeight = mem.credibility * baseVoteWeight;
		wolfWeight += voteWeight;
		basis.push(mem.id);
		totalWeight += voteWeight;
		if (withTrace) {
			impacts.push({
				memoryId: mem.id,
				eventType: 'vote',
				actorId: voterId,
				targetId: playerId,
				impactType: 'indirect',
				description: `${voterId} 投票给 ${playerId}，可信度 ${mem.credibility} × 抗推权重 ${baseVoteWeight} = +${voteWeight.toFixed(1)} 狼人权重`,
				deltaScore: voteWeight,
				beforeScore: stepBeforeWolf,
				afterScore: stepBeforeWolf + voteWeight,
			});
			steps.push({
				step: '投票角色推理',
				formula: `${voterId} 投票 → +${voteWeight.toFixed(1)} 狼人权重`,
				result: voteWeight,
				basis: [mem.id],
			});
			stepBeforeWolf += voteWeight;
		}
	}

	// 归一化
	if (totalWeight === 0) {
		return {
			playerId,
			werewolfProb: BELIEF_DEFAULT.WEREWOLF_PROB,
			villagerProb: BELIEF_DEFAULT.VILLAGER_PROB,
			basis: [],
			trace: withTrace
				? {
						resultType: 'role',
						targetId: playerId,
						finalValue: BELIEF_DEFAULT.WEREWOLF_PROB,
						impacts,
						calculationSteps: [
							...steps,
							{
								step: '默认概率',
								formula: `无证据 → 默认狼人概率 ${BELIEF_DEFAULT.WEREWOLF_PROB}`,
								result: BELIEF_DEFAULT.WEREWOLF_PROB,
								basis: [],
							},
						],
						werewolfProb: BELIEF_DEFAULT.WEREWOLF_PROB,
						villagerProb: BELIEF_DEFAULT.VILLAGER_PROB,
						hardInfoOverride: false,
						claimContributions: [],
						observeContributions: [],
						accuserSpamPenalty: 0,
						voteConsistencyBonus: 0,
					}
				: undefined,
		};
	}

	const wolfProb = wolfWeight / totalWeight;
	const villagerProb = villagerWeight / totalWeight;
	const sum = wolfProb + villagerProb;
	const finalWolfProb = sum > 0 ? wolfProb / sum : BELIEF_DEFAULT.WEREWOLF_PROB;
	const finalVillagerProb = sum > 0 ? villagerProb / sum : BELIEF_DEFAULT.VILLAGER_PROB;

	if (withTrace) {
		steps.push({
			step: '归一化',
			formula: `狼人权重 ${wolfWeight.toFixed(1)} / 总权重 ${totalWeight.toFixed(1)} = ${finalWolfProb.toFixed(1)}`,
			result: finalWolfProb,
			basis: [...basis],
		});
	}

	return {
		playerId,
		werewolfProb: finalWolfProb,
		villagerProb: finalVillagerProb,
		basis,
		trace: withTrace
			? {
					resultType: 'role',
					targetId: playerId,
					finalValue: finalWolfProb,
					impacts,
					calculationSteps: steps,
					werewolfProb: finalWolfProb,
					villagerProb: finalVillagerProb,
					hardInfoOverride,
					claimContributions,
					observeContributions,
					accuserSpamPenalty,
					voteConsistencyBonus,
				}
			: undefined,
	};
}
