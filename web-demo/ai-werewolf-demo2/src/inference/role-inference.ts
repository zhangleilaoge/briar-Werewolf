// ============================================================
// Role Inference — 角色概率推理（三概率分布 + 全局约束）
// 从记忆条目中推断某玩家的狼人/预言家/村民概率
// ============================================================

import type { MemoryEntry, Player } from '@/types';
import { getString, getNumber } from '@/types/guards';
import type { MemStore } from '@/memory';
import { getImpactRules } from '@/constants';
import type { RoleInference, RoleInferenceTrace, MemoryImpact, CalculationStep } from '@/types/trace';
import {
	BELIEF_DEFAULT,
	CLAIM_WEIGHT_FACTOR,
	OBSERVE_WEIGHT,
	HARD_INFO_THRESHOLD,
	ACCUSER_SPAM_WEIGHT,
	DEFAULT_BELIEF_WEIGHT,
} from '@/constants';

export type { RoleInference };

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
	} else if (mem.eventType === 'self_role' && mem.actorId === playerId) {
		result = getString(mem.content, 'role');
		label = '自身角色';
	}

	if (!result || !label) return null;

	// 硬信息直接覆盖：100% 确定对应角色，其余为 0
	let wolfProb = 0, prophetProb = 0, villagerProb = 0;
	if (result === 'werewolf') wolfProb = 1.0;
	else if (result === 'prophet') prophetProb = 1.0;
	else villagerProb = 1.0; // villager or any non-wolf non-prophet

	if (withTrace) {
		impacts.push({
			memoryId: mem.id,
			eventType: mem.eventType,
			actorId: mem.actorId,
			targetId: mem.targetId,
			impactType: 'direct',
			description: `硬信息：${label}为 ${result}，直接覆盖概率`,
			deltaScore: 1.0,
			beforeScore: 0,
			afterScore: 1.0,
		});
		steps.push({
			step: '硬信息检查',
			formula: `${mem.eventType}: ${result} → 直接覆盖`,
			result: 1.0,
			basis: [mem.id],
		});
	}
	return {
		playerId,
		wolfProb,
		prophetProb,
		villagerProb,
		hardInfoOverride: true,
		basis: [mem.id],
		trace: withTrace
			? {
					resultType: 'role',
					targetId: playerId,
					finalValue: wolfProb,
					impacts,
					calculationSteps: steps,
					wolfProb,
					prophetProb,
					villagerProb,
					wolfWeight: wolfProb,
					prophetWeight: prophetProb,
					villagerWeight: villagerProb,
					totalWeight: 1.0,
					defaultWeight: 0,
					hardInfoOverride: true,
					claimContributions: [],
					observeContributions: [],
					accuserSpamPenalty: 0,
					voteConsistencyBonus: 0,
				}
			: undefined,
	};
}

/** 核心角色推理逻辑（带溯源）——三概率分布 */
export function inferPlayer(
	store: MemStore,
	playerId: string,
	withTrace = false,
): RoleInference {
	const memories = store.aboutPlayer(playerId).filter((m) => !m.isForgotten);
	const basis: string[] = [];
	const impacts: MemoryImpact[] = [];
	const steps: CalculationStep[] = [];
	const claimContributions: { memoryId: string; weight: number; claimedResult: string }[] = [];
	const observeContributions: { memoryId: string; weight: number; inferredIntention: string }[] = [];

	// 1. 硬信息直接覆盖
	for (const mem of memories) {
		const hardInfoResult = applyHardInfo(mem, playerId, withTrace, impacts, steps);
		if (hardInfoResult) return hardInfoResult;
	}

	if (withTrace) {
		steps.push({
			step: '硬信息检查',
			formula: '无硬信息覆盖',
			result: 0,
			basis: [],
		});
	}

	// 2. 软信息综合推理 —— 分别计算三种权重
	let wolfWeight = 0;
	let prophetWeight = 0;
	let villagerWeight = 0;
	let totalWeight = 0;
	let stepWolf = BELIEF_DEFAULT.WEREWOLF_PROB;
	let stepProphet = BELIEF_DEFAULT.PROPHET_PROB;
	let stepVillager = BELIEF_DEFAULT.VILLAGER_PROB;
	// 权重累加值（用于 beforeScore/afterScore，从 0 开始）
	let wolfWeightAccum = 0;
	let prophetWeightAccum = 0;
	let villagerWeightAccum = 0;

	// 2a. 声称（查杀/金水/跳身份）
	for (const mem of memories) {
		if (mem.eventType === 'hear_claim') {
			const claimedResult = getString(mem.content, 'claimedResult');
			const claimedRole = getString(mem.content, 'claimedRole');
			const weight = mem.credibility * CLAIM_WEIGHT_FACTOR;

			if (mem.targetId === playerId) {
				// 声称关于 playerId 的结果
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
							beforeScore: wolfWeightAccum,
							afterScore: wolfWeightAccum + weight,
						});
						stepWolf += weight;
								wolfWeightAccum += weight;
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
							beforeScore: villagerWeightAccum,
							afterScore: villagerWeightAccum + weight,
						});
						stepVillager += weight;
								villagerWeightAccum += weight;
					}
				}
				totalWeight += weight;
			}

			// 如果声称者是 playerId 且声称自己是预言家
			if (mem.actorId === playerId && claimedRole === 'prophet') {
				// 跳预言家增加自身预言家权重（但如果是狼人悍跳，则不会增加，因为狼人知道自己是狼）
				// 这里从外部视角看：有人跳预言家 → 有一定概率真的是预言家
				prophetWeight += weight * 0.5;
				basis.push(mem.id);
				if (withTrace) {
					claimContributions.push({ memoryId: mem.id, weight: weight * 0.5, claimedResult: 'prophet_claim' });
					impacts.push({
						memoryId: mem.id,
						eventType: 'hear_claim',
						actorId: mem.actorId,
						targetId: mem.targetId,
						impactType: 'indirect',
						description: `${playerId} 声称自己是预言家，可信度 ${mem.credibility} × 0.5 × 0.5 = +${(weight * 0.5).toFixed(1)} 预言家权重`,
						deltaScore: weight * 0.5,
						beforeScore: prophetWeightAccum,
						afterScore: prophetWeightAccum + weight * 0.5,
					});
					stepProphet += weight * 0.5;
							prophetWeightAccum += weight * 0.5;
				}
				totalWeight += weight * 0.5;
			}
		}
	}
	if (withTrace && claimContributions.length > 0) {
		steps.push({
			step: '声称加权',
			formula: `Σ(可信度 × ${CLAIM_WEIGHT_FACTOR}(声称权重系数)) = ${totalWeight.toFixed(1)}`,
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
						beforeScore: wolfWeightAccum,
						afterScore: wolfWeightAccum + delta,
					});
					stepWolf += delta;
								wolfWeightAccum += delta;
				}
			}
			if (inferredIntention === 'protect' && intentionTarget === playerId) {
				const deltaVillager = weight * OBSERVE_WEIGHT.PROTECT_VILLAGER;
				const deltaProphet = weight * OBSERVE_WEIGHT.PROTECT_PROPHET;
				villagerWeight += deltaVillager;
				prophetWeight += deltaProphet;
				basis.push(mem.id);
				totalWeight += weight;
				if (withTrace) {
					observeContributions.push({ memoryId: mem.id, weight: deltaVillager + deltaProphet, inferredIntention: 'protect' });
					impacts.push({
						memoryId: mem.id,
						eventType: 'observe_pattern',
						actorId: mem.actorId,
						targetId: mem.targetId,
						impactType: 'indirect',
						description: `观察到 ${mem.actorId} 保护 ${playerId}，村民权重 +${deltaVillager.toFixed(1)}，预言家权重 +${deltaProphet.toFixed(1)}`,
						deltaScore: deltaVillager + deltaProphet,
						beforeScore: villagerWeightAccum + prophetWeightAccum,
						afterScore: villagerWeightAccum + deltaVillager + prophetWeightAccum + deltaProphet,
					});
					stepVillager += deltaVillager;
								villagerWeightAccum += deltaVillager;
					stepProphet += deltaProphet;
								prophetWeightAccum += deltaProphet;
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
						beforeScore: wolfWeightAccum,
						afterScore: wolfWeightAccum + delta,
					});
					stepWolf += delta;
								wolfWeightAccum += delta;
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

	// 2c. 搅屎棍检测：频繁指控不同人的玩家，其狼人概率上升
	const accuserTargetMap = new Map<string, Set<string>>();
	for (const mem of store.getAll().filter((m) => !m.isForgotten && m.eventType === 'hear_accuse')) {
		const accuser = mem.actorId;
		const target = mem.targetId;
		if (!accuser || !target) continue;
		if (!accuserTargetMap.has(accuser)) accuserTargetMap.set(accuser, new Set());
		accuserTargetMap.get(accuser)!.add(target);
	}
	let accuserSpamPenalty = 0;
	if (accuserTargetMap.has(playerId)) {
		const accusedTargets = accuserTargetMap.get(playerId)!;
		const targetCount = accusedTargets.size;
		if (targetCount >= 2) {
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
					beforeScore: wolfWeightAccum,
					afterScore: wolfWeightAccum + penalty,
				});
				steps.push({
					step: '搅屎棍检测',
					formula: `${ACCUSER_SPAM_WEIGHT.BASE_PENALTY}(搅屎棍基础惩罚) + ${(targetCount - 2) * ACCUSER_SPAM_WEIGHT.PER_TARGET_PENALTY}(多目标惩罚) = ${penalty.toFixed(1)}`,
					result: penalty,
					basis: [],
				});
				stepWolf += penalty;
							wolfWeightAccum += penalty;
			}
		}
	}

	// 2d. 投票参与角色推理
	const voteRoleRules = getImpactRules('vote', 'role');
	const baseVoteWeight = voteRoleRules.length > 0 ? (voteRoleRules[0].value as number) : 0.4;
	let voteConsistencyBonus = 0;
	for (const mem of store.getAll().filter((m) => !m.isForgotten && m.eventType === 'vote' && m.targetId === playerId)) {
		const voterId = mem.actorId;
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
				beforeScore: wolfWeightAccum,
				afterScore: wolfWeightAccum + voteWeight,
			});
			steps.push({
				step: '投票角色推理',
				formula: `${mem.credibility}(投票可信度) × ${baseVoteWeight}(投票抗推权重) = ${voteWeight.toFixed(1)}`,
				result: voteWeight,
				basis: [mem.id],
			});
			stepWolf += voteWeight;
							wolfWeightAccum += voteWeight;
		}
	}

	// 2e. 辩护增加村民权重
	for (const mem of store.getAll().filter((m) => !m.isForgotten && m.eventType === 'hear_defend' && m.targetId === playerId)) {
		const defendWeight = mem.credibility * 0.15;
		villagerWeight += defendWeight;
		basis.push(mem.id);
		totalWeight += defendWeight;
		if (withTrace) {
			impacts.push({
				memoryId: mem.id,
				eventType: 'hear_defend',
				actorId: mem.actorId,
				targetId: playerId,
				impactType: 'indirect',
				description: `${mem.actorId} 辩护 ${playerId}，可信度 ${mem.credibility} × 0.15 = +${defendWeight.toFixed(1)} 村民权重`,
				deltaScore: defendWeight,
				beforeScore: villagerWeightAccum,
				afterScore: villagerWeightAccum + defendWeight,
			});
			stepVillager += defendWeight;
							villagerWeightAccum += defendWeight;
		}
	}

	// 2f. 沉默增加轻微狼人嫌疑
	for (const mem of store.getAll().filter((m) => !m.isForgotten && m.eventType === 'hear_silence' && m.actorId === playerId)) {
		const silenceWeight = mem.credibility * 0.05;
		wolfWeight += silenceWeight;
		basis.push(mem.id);
		totalWeight += silenceWeight;
		if (withTrace) {
			impacts.push({
				memoryId: mem.id,
				eventType: 'hear_silence',
				actorId: mem.actorId,
				targetId: playerId,
				impactType: 'indirect',
				description: `${playerId} 沉默，可信度 ${mem.credibility} × 0.05 = +${silenceWeight.toFixed(1)} 狼人权重`,
				deltaScore: silenceWeight,
				beforeScore: wolfWeightAccum,
				afterScore: wolfWeightAccum + silenceWeight,
			});
			stepWolf += silenceWeight;
							wolfWeightAccum += silenceWeight;
		}
	}

	// 3. 归一化（线性加权 + 默认信念权重）
	if (totalWeight === 0) {
		return {
			playerId,
			wolfProb: BELIEF_DEFAULT.WEREWOLF_PROB,
			prophetProb: BELIEF_DEFAULT.PROPHET_PROB,
			villagerProb: BELIEF_DEFAULT.VILLAGER_PROB,
			hardInfoOverride: false,
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
								formula: `无证据 → 默认狼人概率 ${BELIEF_DEFAULT.WEREWOLF_PROB}，预言家 ${BELIEF_DEFAULT.PROPHET_PROB}，村民 ${BELIEF_DEFAULT.VILLAGER_PROB}`,
								result: BELIEF_DEFAULT.WEREWOLF_PROB,
								basis: [],
							},
						],
						wolfProb: BELIEF_DEFAULT.WEREWOLF_PROB,
						prophetProb: BELIEF_DEFAULT.PROPHET_PROB,
						villagerProb: BELIEF_DEFAULT.VILLAGER_PROB,
						wolfWeight: 0,
						prophetWeight: 0,
						villagerWeight: 0,
						totalWeight: 0,
						defaultWeight: DEFAULT_BELIEF_WEIGHT,
						hardInfoOverride: false,
						claimContributions: [],
						observeContributions: [],
						accuserSpamPenalty: 0,
						voteConsistencyBonus: 0,
					}
				: undefined,
		};
	}

	// 线性加权归一化：加入默认信念权重作为锚点
	const wolfProb = (wolfWeight + BELIEF_DEFAULT.WEREWOLF_PROB * DEFAULT_BELIEF_WEIGHT) / (totalWeight + DEFAULT_BELIEF_WEIGHT);
	const prophetProb = (prophetWeight + BELIEF_DEFAULT.PROPHET_PROB * DEFAULT_BELIEF_WEIGHT) / (totalWeight + DEFAULT_BELIEF_WEIGHT);
	const villagerProb = (villagerWeight + BELIEF_DEFAULT.VILLAGER_PROB * DEFAULT_BELIEF_WEIGHT) / (totalWeight + DEFAULT_BELIEF_WEIGHT);
	const sum = wolfProb + prophetProb + villagerProb;
	const finalWolfProb = sum > 0 ? wolfProb / sum : BELIEF_DEFAULT.WEREWOLF_PROB;
	const finalProphetProb = sum > 0 ? prophetProb / sum : BELIEF_DEFAULT.PROPHET_PROB;
	const finalVillagerProb = sum > 0 ? villagerProb / sum : BELIEF_DEFAULT.VILLAGER_PROB;

	if (withTrace) {
		steps.push({
			step: '归一化',
			formula: `狼人权重 ${wolfWeight.toFixed(1)} + 默认 ${BELIEF_DEFAULT.WEREWOLF_PROB}×${DEFAULT_BELIEF_WEIGHT} / 总权重 ${totalWeight.toFixed(1)} + ${DEFAULT_BELIEF_WEIGHT} = ${finalWolfProb.toFixed(2)} | 预言家 ${finalProphetProb.toFixed(2)} | 村民 ${finalVillagerProb.toFixed(2)}`,
			result: finalWolfProb,
			basis: [...basis],
		});
	}

	return {
		playerId,
		wolfProb: finalWolfProb,
		prophetProb: finalProphetProb,
		villagerProb: finalVillagerProb,
		hardInfoOverride: false,
		basis,
		trace: withTrace
			? {
					resultType: 'role',
					targetId: playerId,
					finalValue: finalWolfProb,
					impacts,
					calculationSteps: steps,
					wolfProb: finalWolfProb,
					prophetProb: finalProphetProb,
					villagerProb: finalVillagerProb,
					wolfWeight: wolfWeight + BELIEF_DEFAULT.WEREWOLF_PROB * DEFAULT_BELIEF_WEIGHT,
					prophetWeight: prophetWeight + BELIEF_DEFAULT.PROPHET_PROB * DEFAULT_BELIEF_WEIGHT,
					villagerWeight: villagerWeight + BELIEF_DEFAULT.VILLAGER_PROB * DEFAULT_BELIEF_WEIGHT,
					totalWeight: totalWeight + DEFAULT_BELIEF_WEIGHT,
					defaultWeight: DEFAULT_BELIEF_WEIGHT,
					hardInfoOverride: false,
					claimContributions,
					observeContributions,
					accuserSpamPenalty,
					voteConsistencyBonus,
				}
			: undefined,
	};
}

// ============================================================
// 全局约束校正 —— 基于已知角色配置迭代缩放概率
// ============================================================

export interface RoleConfig {
	wolfCount: number;
	prophetCount: number;
	villagerCount: number;
}

/**
 * 应用全局角色配置约束。
 * 已知全场有 W 狼、P 预言家、V 村民，迭代缩放使概率期望匹配配置。
 * 硬信息覆盖（100% 确定）的玩家不参与缩放。
 */
export function applyGlobalConstraint(
	inferences: Map<string, RoleInference>,
	config: RoleConfig,
): Map<string, RoleInference> {
	// 深拷贝，避免修改原始值
	const result = new Map<string, RoleInference>();
	for (const [pid, inf] of inferences) {
		result.set(pid, { ...inf });
	}

	// 迭代 5 轮（通常 2-3 轮收敛）
	for (let iter = 0; iter < 5; iter++) {
		// 计算当前期望
		let wolfSum = 0, prophetSum = 0, fixedWolves = 0, fixedProphets = 0;
		for (const [, inf] of result) {
			if (inf.hardInfoOverride) {
				if (inf.wolfProb === 1) fixedWolves++;
				if (inf.prophetProb === 1) fixedProphets++;
			} else {
				wolfSum += inf.wolfProb;
				prophetSum += inf.prophetProb;
			}
		}

		let changed = false;

		// 狼人配额校正
		if (wolfSum > 0 && wolfSum + fixedWolves > config.wolfCount) {
			const scale = Math.max(0.01, (config.wolfCount - fixedWolves) / wolfSum);
			for (const [, inf] of result) {
				if (!inf.hardInfoOverride) {
					inf.wolfProb *= scale;
					changed = true;
				}
			}
		}

		// 预言家配额校正
		if (prophetSum > 0 && prophetSum + fixedProphets > config.prophetCount) {
			const scale = Math.max(0.01, (config.prophetCount - fixedProphets) / prophetSum);
			for (const [, inf] of result) {
				if (!inf.hardInfoOverride) {
					inf.prophetProb *= scale;
					changed = true;
				}
			}
		}

		if (!changed) break;

	// 重新归一化每个人的三种概率（保持和为 1），并同步更新 trace
	for (const [, inf] of result) {
		const total = inf.wolfProb + inf.prophetProb + inf.villagerProb;
		if (total > 0) {
			inf.wolfProb /= total;
			inf.prophetProb /= total;
			inf.villagerProb /= total;
		}
		if (inf.trace) {
			inf.trace.wolfProb = inf.wolfProb;
			inf.trace.prophetProb = inf.prophetProb;
			inf.trace.villagerProb = inf.villagerProb;
			inf.trace.finalValue = inf.wolfProb;
			// 权重保持原始值，不缩放（权重是原始证据累加值，展示百分比如何从权重归一化而来）
		}
	}
}

	return result;
}
