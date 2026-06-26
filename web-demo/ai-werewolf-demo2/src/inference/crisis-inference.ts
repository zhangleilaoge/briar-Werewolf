// ============================================================
// Crisis Inference — 局势/危机度推理
// 从记忆条目中推断某玩家的危机度（被怀疑/被投票程度）
// ============================================================

import type { MemoryEntry, MemoryEventType } from '@/types';
import { getString } from '@/types/guards';
import type { MemStore } from '@/memory';
import type { MemoryStore } from '@/memory/memory-store';
import type { CrisisTrace, MemoryImpact, CalculationStep } from '@/types/trace';
import { CRISIS_WEIGHT, ACCUSER_SPAM_WEIGHT } from '@/constants';

interface CrisisFactors {
	accuseCount: number;
	voteCount: number;
	defendCount: number;
	observeCount: number;
	claimWolfCount: number;
}

export interface PlayerCrisis {
	playerId: string;
	score: number;
	dominant: number;
	factors: CrisisFactors;
	basis: string[];
	trace?: CrisisTrace;
}

/** 核心危机度推理逻辑（带溯源） */
export function inferCrisis(
	store: MemoryStore,
	playerId: string,
	withTrace = false,
): PlayerCrisis {
	const memories = store.getAll().filter((m) => !m.isForgotten && m.targetId === playerId);
	const basis: string[] = [];
	const impacts: MemoryImpact[] = [];
	const steps: CalculationStep[] = [];
	const factorDetails: { memoryId: string; eventType: MemoryEventType; actorId: string; delta: number; decayed: boolean }[] = [];

	const factors: CrisisFactors = {
		accuseCount: 0,
		voteCount: 0,
		defendCount: 0,
		observeCount: 0,
		claimWolfCount: 0,
	};

	// 同一人反复指控的衰减追踪：actorId -> 该actor对playerId的指控次数
	const accuserRepeatCount = new Map<string, number>();

	for (const mem of memories) {
		basis.push(mem.id);
		let delta = 0;
		let decayed = false;

		switch (mem.eventType) {
			case 'hear_accuse': {
				const count = (accuserRepeatCount.get(mem.actorId) ?? 0) + 1;
				accuserRepeatCount.set(mem.actorId, count);
				if (count === 1) {
					delta = CRISIS_WEIGHT.ACCUSE;
					factors.accuseCount++;
				} else {
					// 同一来源的重复指控递减：第二次 ×0.5，第三次 ×0.25，以此类推
					const decay = Math.pow(ACCUSER_SPAM_WEIGHT.REPEAT_DECAY, count - 1);
					delta = CRISIS_WEIGHT.ACCUSE * decay;
					decayed = true;
					factors.accuseCount += decay; // 计数也衰减
				}
				break;
			}
			case 'vote': {
				delta = CRISIS_WEIGHT.VOTE;
				factors.voteCount++;
				break;
			}
			case 'hear_defend': {
				delta = CRISIS_WEIGHT.DEFEND;
				factors.defendCount++;
				break;
			}
			case 'hear_claim': {
				// 【新增】补全 hear_claim 的危机度处理
				const claimedResult = getString(mem.content, 'claimedResult');
				if (claimedResult === 'werewolf' && mem.targetId === playerId) {
					delta = CRISIS_WEIGHT.CLAIM_WOLF;
					factors.claimWolfCount++;
				}
				break;
			}
			case 'observe_pattern': {
				// 【改进】区分攻击型观察(+1) vs 隐藏型观察(+0)
				const inferredIntention = getString(mem.content, 'inferredIntention');
				if (inferredIntention === 'attack') {
					delta = CRISIS_WEIGHT.OBSERVE;
					factors.observeCount++;
				} else if (inferredIntention === 'hide') {
					// 隐藏意图不增加危机度，只记录观察
					factors.observeCount += 0.5;
					delta = 0;
				} else {
					delta = CRISIS_WEIGHT.OBSERVE;
					factors.observeCount++;
				}
				break;
			}
		}

		delta *= mem.credibility;
		factorDetails.push({ memoryId: mem.id, eventType: mem.eventType, actorId: mem.actorId, delta, decayed });

		if (withTrace && delta !== 0) {
			impacts.push({
				memoryId: mem.id,
				eventType: mem.eventType,
				actorId: mem.actorId,
				targetId: mem.targetId,
				impactType: 'direct',
				description: `${mem.actorId} ${mem.eventType} ${playerId}${decayed ? ' (衰减后)' : ''} → ${delta > 0 ? '+' : ''}${delta}`,
				deltaScore: delta,
				beforeScore: 0, // 危机度是累加的，这里用0作为基准
				afterScore: delta,
			});
		}
	}

	const score = factorDetails.reduce((sum, factor) => sum + factor.delta, 0);

	if (withTrace) {
		steps.push({
			step: '危机度计算',
			formula: `Σ(事件基础危机值 × 记忆可信度)，指控×${CRISIS_WEIGHT.ACCUSE} + 投票×${CRISIS_WEIGHT.VOTE} + 观察×${CRISIS_WEIGHT.OBSERVE} + 声称查杀×${CRISIS_WEIGHT.CLAIM_WOLF} - 辩护×${Math.abs(CRISIS_WEIGHT.DEFEND)}`,
			result: score,
			basis: [...basis],
		});
	}

	return {
		playerId,
		score,
		dominant: -score,
		factors,
		basis: basis.length > 0 ? basis : [],
		trace: withTrace
			? {
					resultType: 'crisis',
					targetId: playerId,
					finalValue: score,
					impacts,
					calculationSteps: steps,
					factors,
					factorDetails,
				}
			: undefined,
	};
}
