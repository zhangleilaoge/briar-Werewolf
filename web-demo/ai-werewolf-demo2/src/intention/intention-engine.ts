// ============================================================
// IntentionEngine — 意图引擎
// Step 1→2→3→4: 长期意图 → 短期意图 → 候选集 → 加权选择
// 按 INTENTION.md 文档实现
// ============================================================

import type { Player } from '@/types';
import type { RoleInference, PlayerCrisis } from '@/inference/inference-engine';
import { InferenceEngine } from '@/inference/inference-engine';
import type {
	ActionType,
	ActionCandidate,
	LongTermIntention,
	ShortTermIntention,
	IntentionState,
} from '@/types/decision';
import type { IntentionTrace, MemoryImpact } from '@/types/trace';
import { PERSONALITIES } from './personalities';
import { pluginRegistry } from '@/plugins';
import {
	LONG_TERM_PRIORITY,
	SHORT_TERM_WEIGHT,
	PRESSURE,
	CANDIDATE_BASE_SCORE,
	BONUS,
	RANDOMNESS_DEFAULT,
	PROFICIENCY,
	ATTRIBUTE_RANGE,
	PROFICIENCY_MAP,
	CRISIS_PROTECT_THRESHOLD,
	LEADERSHIP_WEIGHT,
} from '@/constants';

export interface IntentionConfig {
	randomness: number;
	reasoningDisabled: boolean;
}

export class IntentionEngine {
	private inference: InferenceEngine;
	private relation: import('@/relation').RelationTracker;
	private self: Player;
	private allPlayers: Player[];
	private config: IntentionConfig;

	constructor(
		inference: InferenceEngine,
		relation: import('@/relation').RelationTracker,
		self: Player,
		allPlayers: Player[],
		config: Partial<IntentionConfig> = {}
	) {
		this.inference = inference;
		this.relation = relation;
		this.self = self;
		this.allPlayers = allPlayers.filter((p) => p.alive);
		this.config = {
			randomness: config.randomness ?? RANDOMNESS_DEFAULT,
			reasoningDisabled: config.reasoningDisabled ?? false,
		};
	}

	// ==================== Step 1: 长期意图评估 ====================

	evaluateLongTermIntentions(): LongTermIntention[] {
		const intentions: LongTermIntention[] = [];
		const selfCrisis = this.inference.inferSelfCrisis();
		const roleInferences = this.inference.inferAll(this.allPlayers);
		const fieldCrisis = this.inference.inferFieldCrisis(this.allPlayers);

		// 1. 通用生存意图（所有角色）
		const survivePriority = Math.min(1.0, LONG_TERM_PRIORITY.SURVIVE);
		intentions.push({
			id: 'survive',
			priority: survivePriority,
			description: `生存优先级：${(survivePriority * 100).toFixed(0)}%`,
			basis: [],
			traces: [this._makeTrace('long_term', 'survive', LONG_TERM_PRIORITY.SURVIVE, 0, survivePriority, [])],
		});

		// 2. 插件提供的角色特有意图
		const plugin = pluginRegistry.getRole(this.self.role);
		if (plugin) {
			const pluginIntentions = plugin.getLongTermIntentions(
				this.self, this.allPlayers, roleInferences, selfCrisis, this.relation, fieldCrisis,
			);
			for (const pi of pluginIntentions) {
				if (pi.id === 'survive') continue; // 避免重复
				// 预言家 report_check：如果没有查验结果，跳过
				if (pi.id === 'report_check') {
					const checkMemories = this.inference.getMyCheckResults();
					if (checkMemories.length === 0) continue;
					intentions.push({
						...pi,
						basis: checkMemories.map((m) => m.id),
						traces: [this._makeTrace('long_term', 'report_check', LONG_TERM_PRIORITY.REPORT_CHECK, 0, LONG_TERM_PRIORITY.REPORT_CHECK, checkMemories.map((m) => m.id))],
					});
					continue;
				}
				intentions.push({
					...pi,
					traces: (pi.traces && pi.traces.length > 0) ? pi.traces : [
						this._makeTrace('long_term', pi.id, pi.priority, 0, pi.priority, pi.basis, pi.description),
					],
				});
			}
		} else {
			// fallback：当插件不存在时，保留通用硬编码逻辑
			if (this.self.team === 'villager') {
				let highest: RoleInference | null = null;
				for (const inf of roleInferences.values()) { if (!highest || inf.wolfProb > highest.wolfProb) highest = inf; }
				const findWolfPriority = highest ? Math.min(0.9, LONG_TERM_PRIORITY.FIND_WOLF) : LONG_TERM_PRIORITY.FIND_WOLF;
				intentions.push({
					id: 'find_werewolf',
					priority: findWolfPriority,
					targetPlayer: highest?.playerId,
					description: `找狼优先级：${(findWolfPriority * 100).toFixed(0)}%`,
					basis: highest?.basis ?? [],
					traces: [this._makeTrace('long_term', 'find_werewolf', LONG_TERM_PRIORITY.FIND_WOLF, 0, findWolfPriority, highest?.basis ?? [])],
				});

				const mostAtRisk = fieldCrisis.mostAtRisk;
				if (mostAtRisk.score >= CRISIS_PROTECT_THRESHOLD && mostAtRisk.playerId !== this.self.id) {
					const protectPriority = Math.min(0.8, LONG_TERM_PRIORITY.PROTECT_VILLAGER);
					intentions.push({
						id: 'protect_villager',
						priority: protectPriority,
						targetPlayer: mostAtRisk.playerId,
						description: `保护 ${mostAtRisk.playerId}`,
						basis: mostAtRisk.basis,
						traces: [this._makeTrace('long_term', 'protect_villager', LONG_TERM_PRIORITY.PROTECT_VILLAGER, 0, protectPriority, mostAtRisk.basis)],
					});
				}

				const leadPriority = (this.self.attributes.leadership / ATTRIBUTE_RANGE.MAX) * LEADERSHIP_WEIGHT + LONG_TERM_PRIORITY.LEAD;
				intentions.push({
					id: 'lead',
					priority: leadPriority,
					description: `主导局势`,
					basis: [],
					traces: [this._makeTrace('long_term', 'lead', LONG_TERM_PRIORITY.LEAD, 0, leadPriority, [], `领导力 ${this.self.attributes.leadership}/10`)],
				});
			} else {
				const hidePriority = Math.min(1.0, LONG_TERM_PRIORITY.HIDE_IDENTITY);
				intentions.push({
					id: 'hide_identity',
					priority: hidePriority,
					description: `隐藏身份`,
					basis: [],
					traces: [this._makeTrace('long_term', 'hide_identity', LONG_TERM_PRIORITY.HIDE_IDENTITY, 0, hidePriority, [])],
				});

				let lowest: RoleInference | null = null;
				for (const inf of roleInferences.values()) { if (!lowest || inf.wolfProb < lowest.wolfProb) lowest = inf; }
				const misleadPriority = lowest ? Math.min(0.8, LONG_TERM_PRIORITY.MISLEAD) : LONG_TERM_PRIORITY.MISLEAD;
				intentions.push({
					id: 'mislead',
					priority: misleadPriority,
					targetPlayer: lowest?.playerId,
					description: `误导`,
					basis: lowest?.basis ?? [],
					traces: [this._makeTrace('long_term', 'mislead', LONG_TERM_PRIORITY.MISLEAD, 0, misleadPriority, lowest?.basis ?? [])],
				});
			}

			if (this.self.role === 'prophet') {
				const checkMemories = this.inference.getMyCheckResults();
				if (checkMemories.length > 0) {
					intentions.push({
						id: 'report_check',
						priority: LONG_TERM_PRIORITY.REPORT_CHECK,
						description: '报查验',
						basis: checkMemories.map((m) => m.id),
						traces: [this._makeTrace('long_term', 'report_check', LONG_TERM_PRIORITY.REPORT_CHECK, 0, LONG_TERM_PRIORITY.REPORT_CHECK, checkMemories.map((m) => m.id))],
					});
				}
			}
		}

		return intentions.sort((a, b) => b.priority - a.priority);
	}

	// ==================== Step 2: 短期意图生成 ====================

	generateShortTermIntentions(longTerm: LongTermIntention[]): ShortTermIntention[] {
		const shortTerm: ShortTermIntention[] = [];
		for (const lt of longTerm) {
			const weight = lt.priority * SHORT_TERM_WEIGHT.FACTOR;
			const baseTrace = this._makeTrace('short_term', lt.id, lt.priority, (weight) - (lt.priority), weight, lt.basis, `长期意图 ${lt.id} × 因子 ${SHORT_TERM_WEIGHT.FACTOR}`);
			switch (lt.id) {
				case 'survive':
					shortTerm.push({
						id: 'survive', type: 'unpointed', weight,
						description: '自保', basis: lt.basis,
						traces: [baseTrace],
					});
					break;
				case 'find_werewolf':
					shortTerm.push({
						id: lt.targetPlayer ? `attack_${lt.targetPlayer}` : 'attack', type: 'pointed', targetId: lt.targetPlayer, weight,
						description: '攻击', basis: lt.basis,
						traces: [baseTrace],
					});
					shortTerm.push({
						id: lt.targetPlayer ? `observe_${lt.targetPlayer}` : 'observe', type: 'pointed', targetId: lt.targetPlayer,
						weight: weight * SHORT_TERM_WEIGHT.OBSERVE_FACTOR,
						description: '观察', basis: lt.basis,
						traces: [this._makeTrace('short_term', 'observe', weight, (weight * SHORT_TERM_WEIGHT.OBSERVE_FACTOR) - (weight), weight * SHORT_TERM_WEIGHT.OBSERVE_FACTOR, lt.basis, `观察因子 ${SHORT_TERM_WEIGHT.OBSERVE_FACTOR}`)],
					});
					break;
				case 'protect_villager':
					shortTerm.push({
						id: lt.targetPlayer ? `protect_${lt.targetPlayer}` : 'protect', type: 'pointed', targetId: lt.targetPlayer, weight,
						description: '保护', basis: lt.basis,
						traces: [baseTrace],
					});
					break;
				case 'lead':
					shortTerm.push({
						id: 'lead', type: 'unpointed', weight: weight * SHORT_TERM_WEIGHT.LEAD_FACTOR,
						description: '主导', basis: lt.basis,
						traces: [this._makeTrace('short_term', 'lead', weight, (weight * SHORT_TERM_WEIGHT.LEAD_FACTOR) - (weight), weight * SHORT_TERM_WEIGHT.LEAD_FACTOR, lt.basis, `主导因子 ${SHORT_TERM_WEIGHT.LEAD_FACTOR}`)],
					});
					break;
				case 'hide_identity':
					shortTerm.push({
						id: 'hide', type: 'unpointed', weight,
						description: '隐藏', basis: lt.basis,
						traces: [baseTrace],
					});
					shortTerm.push({
						id: 'observe', type: 'unpointed', weight: weight * SHORT_TERM_WEIGHT.HIDE_OBSERVE_FACTOR,
						description: '观察', basis: lt.basis,
						traces: [this._makeTrace('short_term', 'observe', weight, (weight * SHORT_TERM_WEIGHT.HIDE_OBSERVE_FACTOR) - (weight), weight * SHORT_TERM_WEIGHT.HIDE_OBSERVE_FACTOR, lt.basis, `隐藏观察因子 ${SHORT_TERM_WEIGHT.HIDE_OBSERVE_FACTOR}`)],
					});
					break;
				case 'mislead':
					shortTerm.push({
						id: lt.targetPlayer ? `attack_${lt.targetPlayer}` : 'attack', type: 'pointed', targetId: lt.targetPlayer, weight,
						description: '误导', basis: lt.basis,
						traces: [baseTrace],
					});
					break;
				case 'report_check':
					shortTerm.push({
						id: 'report_check', type: 'unpointed', weight,
						description: '报查验', basis: lt.basis,
						traces: [baseTrace],
					});
					break;
			}
		}

		// 压力修正
		const pressure = this.self.pressure;
		for (const st of shortTerm) {
			let pressureDelta = 0;
			let pressureDesc = '';
			if (pressure >= PRESSURE.HIGH_THRESHOLD) {
				if (st.id.includes('attack')) { st.weight *= PRESSURE.HIGH_AGGRESSIVE_MULTIPLIER; pressureDelta = PRESSURE.HIGH_AGGRESSIVE_MULTIPLIER; pressureDesc = '高压力激进×1.5'; }
				else if (st.id.includes('observe')) { st.weight *= PRESSURE.HIGH_DEFENSIVE_MULTIPLIER; pressureDelta = PRESSURE.HIGH_DEFENSIVE_MULTIPLIER; pressureDesc = '高压力防御×0.6'; }
			} else if (pressure >= PRESSURE.MEDIUM_THRESHOLD) {
				if (st.id.includes('attack')) { st.weight *= PRESSURE.MEDIUM_AGGRESSIVE_MULTIPLIER; pressureDelta = PRESSURE.MEDIUM_AGGRESSIVE_MULTIPLIER; pressureDesc = '中压力激进×1.2'; }
			}
			if (pressureDelta !== 0 && st.traces) {
				st.traces.push(this._makeTrace('short_term', st.id, st.weight / pressureDelta, (st.weight) - (st.weight / pressureDelta), st.weight, st.basis, pressureDesc));
			}
		}

		const merged = new Map<string, ShortTermIntention>();
		for (const st of shortTerm) {
			if (merged.has(st.id)) {
				const existing = merged.get(st.id)!;
				existing.weight += st.weight;
				existing.basis = [...new Set([...existing.basis, ...st.basis])];
				if (st.traces) {
					existing.traces = [...(existing.traces ?? []), ...st.traces];
				}
			} else {
				merged.set(st.id, { ...st });
			}
		}
		return Array.from(merged.values()).sort((a, b) => b.weight - a.weight);
	}

	// ==================== Step 3: 行动候选生成 ====================

	generateCandidates(shortTerm: ShortTermIntention[], phase: 'day' | 'night'): ActionCandidate[] {
		const candidates: ActionCandidate[] = [];
		const others = this.allPlayers.filter((p) => p.id !== this.self.id && p.alive);
		const roleInferences = this.inference.inferAll(this.allPlayers);

		for (const st of shortTerm) {
			const targetId = st.targetId;
			const target = targetId ? others.find((p) => p.id === targetId) : null;
			const viable = target ? [target] : others;
			const baseBasis = st.basis ?? [];
			const baseTraces = st.traces ?? [];

			if (st.id === 'survive' || st.id === 'hide') {
				if (phase === 'day') {
					candidates.push({
						action: 'silence', score: CANDIDATE_BASE_SCORE.SILENCE, reason: '隐藏', supportingMemories: baseBasis,
						traces: [...baseTraces, this._makeTrace('candidate', 'silence', 0, (CANDIDATE_BASE_SCORE.SILENCE) - (0), CANDIDATE_BASE_SCORE.SILENCE, baseBasis, '基础分数')],
					});
				} else {
					candidates.push({
						action: 'sleep', score: CANDIDATE_BASE_SCORE.SLEEP, reason: '隐藏', supportingMemories: baseBasis,
						traces: [...baseTraces, this._makeTrace('candidate', 'sleep', 0, (CANDIDATE_BASE_SCORE.SLEEP) - (0), CANDIDATE_BASE_SCORE.SLEEP, baseBasis, '基础分数')],
					});
				}
			} else if (st.id === 'lead') {
				candidates.push({
					action: 'claim_identity', score: CANDIDATE_BASE_SCORE.CLAIM_IDENTITY, reason: '带队', supportingMemories: baseBasis,
					traces: [...baseTraces, this._makeTrace('candidate', 'claim_identity', 0, (CANDIDATE_BASE_SCORE.CLAIM_IDENTITY) - (0), CANDIDATE_BASE_SCORE.CLAIM_IDENTITY, baseBasis, '基础分数')],
				});
			} else if (st.id === 'report_check') {
				candidates.push({
					action: 'claim_identity', score: CANDIDATE_BASE_SCORE.REPORT_CHECK, reason: '报查验', supportingMemories: baseBasis,
					traces: [...baseTraces, this._makeTrace('candidate', 'claim_identity', 0, (CANDIDATE_BASE_SCORE.REPORT_CHECK) - (0), CANDIDATE_BASE_SCORE.REPORT_CHECK, baseBasis, '报查验硬约束')],
				});
			} else if (st.id.includes('attack')) {
				for (const t of viable.slice(0, 3)) {
					const inf = roleInferences.get(t.id);
					const supportingMemories = [...baseBasis, ...(inf?.basis ?? [])];
					const score = CANDIDATE_BASE_SCORE.SUSPECT + (targetId === t.id ? CANDIDATE_BASE_SCORE.TARGET_MATCH_BONUS : 0);
					candidates.push({
						action: 'suspect', targetId: t.id, score, reason: `攻击 ${t.id}`, supportingMemories,
						traces: [
							...baseTraces,
							this._makeTrace('candidate', 'suspect', 0, (CANDIDATE_BASE_SCORE.SUSPECT) - (0), CANDIDATE_BASE_SCORE.SUSPECT, baseBasis, '基础分数'),
							...(targetId === t.id ? [this._makeTrace('candidate', 'suspect', CANDIDATE_BASE_SCORE.SUSPECT, (score) - (CANDIDATE_BASE_SCORE.SUSPECT), score, baseBasis, '目标匹配加成')] : []),
							...(inf?.basis ? [this._makeTrace('candidate', 'suspect', 0, (0) - (0), 0, inf.basis, `角色推理支撑 ${t.id}`)] : []),
						],
					});
				}
			} else if (st.id.includes('protect')) {
				for (const t of viable.slice(0, 2)) {
					const inf = roleInferences.get(t.id);
					const supportingMemories = [...baseBasis, ...(inf?.basis ?? [])];
					const score = CANDIDATE_BASE_SCORE.DEFEND + (targetId === t.id ? CANDIDATE_BASE_SCORE.DEFEND_TARGET_MATCH : 0);
					candidates.push({
						action: 'defend', targetId: t.id, score, reason: `保护 ${t.id}`, supportingMemories,
						traces: [
							...baseTraces,
							this._makeTrace('candidate', 'defend', 0, (CANDIDATE_BASE_SCORE.DEFEND) - (0), CANDIDATE_BASE_SCORE.DEFEND, baseBasis, '基础分数'),
							...(targetId === t.id ? [this._makeTrace('candidate', 'defend', CANDIDATE_BASE_SCORE.DEFEND, (score) - (CANDIDATE_BASE_SCORE.DEFEND), score, baseBasis, '目标匹配加成')] : []),
							...(inf?.basis ? [this._makeTrace('candidate', 'defend', 0, (0) - (0), 0, inf.basis, `角色推理支撑 ${t.id}`)] : []),
						],
					});
				}
			} else if (st.id.startsWith('observe_') || st.id === 'observe') {
				for (const t of viable.slice(0, 3)) {
					const score = CANDIDATE_BASE_SCORE.OBSERVE + (targetId === t.id ? CANDIDATE_BASE_SCORE.OBSERVE_TARGET_MATCH : 0);
					candidates.push({
						action: 'observe', targetId: t.id, score, reason: `观察 ${t.id}`, supportingMemories: baseBasis,
						traces: [
							...baseTraces,
							this._makeTrace('candidate', 'observe', 0, (CANDIDATE_BASE_SCORE.OBSERVE) - (0), CANDIDATE_BASE_SCORE.OBSERVE, baseBasis, '基础分数'),
							...(targetId === t.id ? [this._makeTrace('candidate', 'observe', CANDIDATE_BASE_SCORE.OBSERVE, (score) - (CANDIDATE_BASE_SCORE.OBSERVE), score, baseBasis, '目标匹配加成')] : []),
						],
					});
				}
			}
		}

		// 夜间角色行动候选（由插件提供）
		if (phase === 'night') {
			const plugin = pluginRegistry.getRole(this.self.role);
			if (plugin && plugin.hasNightAction) {
				const checkResults = this.self.role === 'prophet' ? this.inference.getMyCheckResults() : [];
				const pluginCandidates = plugin.getNightActionCandidates(
					this.self, this.allPlayers, roleInferences, this.relation, checkResults,
				);
				for (const c of pluginCandidates) {
					candidates.push({
						...c,
						traces: [
							this._makeTrace('candidate', c.action, 0, c.score, c.score, c.supportingMemories, `插件夜间候选 ${c.action} ${c.targetId ?? ''}`),
						],
					});
				}
			}
		}

		const merged = new Map<string, ActionCandidate>();
		for (const c of candidates) {
			const key = `${c.action}:${c.targetId ?? ''}`;
			if (!merged.has(key) || merged.get(key)!.score < c.score) merged.set(key, c);
		}
		return Array.from(merged.values()).sort((a, b) => b.score - a.score);
	}

	// ==================== Step 4: 加权选择（带溯源） ====================

	selectAction(candidates: ActionCandidate[]): ActionCandidate | null {
		if (candidates.length === 0) return null;
		const roleInferences = this.config.reasoningDisabled ? new Map<string, RoleInference>() : this.inference.inferAll(this.allPlayers);
		const fieldCrisis = this.config.reasoningDisabled ? null : this.inference.inferFieldCrisis(this.allPlayers);
		const personality = PERSONALITIES[this.self.personality] || PERSONALITIES.cautious;

		const scored = candidates.map((c) => {
			const { score, traces } = this._calcScoreWithTrace(c, roleInferences, fieldCrisis, personality);
			return { ...c, score, traces: [...(c.traces ?? []), ...traces] };
		});
		scored.sort((a, b) => b.score - a.score);

		const randomness = this.config.randomness;
		if (randomness > 0 && scored.length > 1) {
			const topScore = scored[0].score;
			const threshold = topScore * (1 - randomness);
			const viable = scored.filter((c) => c.score >= threshold);
			if (viable.length > 1) {
				const totalWeight = viable.reduce((sum, c) => sum + c.score, 0);
				let roll = Math.random() * totalWeight;
				for (const c of viable) { roll -= c.score; if (roll <= 0) return c; }
				return viable[viable.length - 1];
			}
		}
		return scored[0];
	}

	// ==================== 完整流程 ====================

	generateAction(phase: 'day' | 'night'): IntentionState {
		const longTerm = this.evaluateLongTermIntentions();
		const shortTerm = this.generateShortTermIntentions(longTerm);
		const candidates = this.generateCandidates(shortTerm, phase);
		const selected = this.selectAction(candidates);
		return { longTerm, shortTerm, candidates, selected };
	}

	generateDayAction(): IntentionState {
		return this.generateAction('day');
	}

	generateNightAction(): IntentionState {
		return this.generateAction('night');
	}

	// ==================== 内部方法 ====================

	private _makeTrace(
		stage: IntentionTrace['stage'],
		factor: string,
		baseValue: number,
		delta: number,
		result: number,
		basis: string[],
		description?: string
	): IntentionTrace {
		return {
			stage, factor, baseValue, delta, result,
			basis: basis.map((id) => ({
				memoryId: id,
				eventType: 'unknown',
				actorId: '',
				impactType: 'indirect',
				description: description || '',
				deltaScore: delta,
				beforeScore: baseValue,
				afterScore: result,
			})),
		};
	}

	private _calcScoreWithTrace(
		candidate: ActionCandidate,
		roleInferences: Map<string, RoleInference>,
		fieldCrisis: { all: PlayerCrisis[] } | null,
		personality: typeof PERSONALITIES[keyof typeof PERSONALITIES]
	): { score: number; traces: IntentionTrace[] } {
		const traces: IntentionTrace[] = [];
		let score = candidate.score;
		const baseScore = score;

		// 1. 性格过滤（禁用行动）
		if (personality.disabledActions.includes(candidate.action)) {
			traces.push(this._makeTrace('selection', candidate.action, score, -score, 0, candidate.supportingMemories, '性格禁用'));
			return { score: 0, traces };
		}
		traces.push(this._makeTrace('selection', 'personalityFilter', baseScore, 0, baseScore, candidate.supportingMemories, '性格未禁用'));

		// 2. roleBonus
		let roleBonus = 1.0;
		if (!this.config.reasoningDisabled && candidate.targetId && roleInferences.has(candidate.targetId)) {
			const inf = roleInferences.get(candidate.targetId)!;
			if (candidate.action === 'suspect') {
				roleBonus = 0.5 + inf.wolfProb * 1.5;
				traces.push(this._makeTrace('selection', 'roleBonus', 1.0, roleBonus - 1.0, roleBonus, inf.basis, `${candidate.targetId} 狼人概率 ${(inf.wolfProb * 100).toFixed(0)}% → 攻击加成`));
			} else if (candidate.action === 'defend') {
				roleBonus = 0.5 + (1 - inf.wolfProb) * 1.5;
				traces.push(this._makeTrace('selection', 'roleBonus', 1.0, roleBonus - 1.0, roleBonus, inf.basis, `${candidate.targetId} 村民概率 ${(inf.villagerProb * 100).toFixed(0)}% → 辩护加成`));
			}
		}
		roleBonus = Math.max(BONUS.MIN, Math.min(BONUS.MAX, roleBonus));
		score = score * roleBonus;
		traces.push(this._makeTrace('selection', 'roleBonus_applied', baseScore, score - baseScore, score, candidate.supportingMemories, `roleBonus ${roleBonus.toFixed(2)}`));

		// 3. situationBonus
		let situationBonus = 1.0;
		if (!this.config.reasoningDisabled && fieldCrisis && candidate.targetId) {
			const crisis = fieldCrisis.all.find((c) => c.playerId === candidate.targetId);
			if (crisis) {
				if (candidate.action === 'defend') {
					situationBonus = 0.5 + Math.min(crisis.score / 10, 1) * 1.5;
					traces.push(this._makeTrace('selection', 'situationBonus', 1.0, situationBonus - 1.0, situationBonus, crisis.basis, `${candidate.targetId} 危机度 ${crisis.score} → 辩护加成`));
				} else if (candidate.action === 'suspect') {
					situationBonus = 0.5 + Math.min(crisis.dominant / 10, 1) * 1.5;
					traces.push(this._makeTrace('selection', 'situationBonus', 1.0, situationBonus - 1.0, situationBonus, crisis.basis, `${candidate.targetId} 主导度 ${crisis.dominant} → 攻击加成`));
				}
			}
		}
		situationBonus = Math.max(BONUS.MIN, Math.min(BONUS.MAX, situationBonus));
		const afterSituation = score;
		score = score * situationBonus;
		traces.push(this._makeTrace('selection', 'situationBonus_applied', afterSituation, score - afterSituation, score, candidate.supportingMemories, `situationBonus ${situationBonus.toFixed(2)}`));

		// 4. personalityBonus
		const personalityBonus = personality.actionWeightMods[candidate.action] ?? 1.0;
		const afterPersonality = score;
		score = score * personalityBonus;
		traces.push(this._makeTrace('selection', 'personalityBonus', afterPersonality, score - afterPersonality, score, [], `personalityBonus ${personalityBonus.toFixed(2)} (${personality.name})`));

		// 4.5 relationBonus（关系影响决策）
		let relationBonus = 1.0;
		if (candidate.targetId) {
			const rel = this.relation.getRelation(candidate.targetId);
			if (rel) {
				if (candidate.action === 'suspect') {
					relationBonus = 1.0 - rel.friendly / 20;
					traces.push(this._makeTrace('selection', 'relationBonus', 1.0, relationBonus - 1.0, relationBonus, rel.memoryIds, `${candidate.targetId} 友好度 ${rel.friendly} → 攻击减益`));
				} else if (candidate.action === 'defend') {
					relationBonus = 1.0 + rel.friendly / 20;
					traces.push(this._makeTrace('selection', 'relationBonus', 1.0, relationBonus - 1.0, relationBonus, rel.memoryIds, `${candidate.targetId} 友好度 ${rel.friendly} → 辩护增益`));
				}
				relationBonus = Math.max(BONUS.MIN, Math.min(BONUS.MAX, relationBonus));
				const afterRelation = score;
				score = score * relationBonus;
				traces.push(this._makeTrace('selection', 'relationBonus_applied', afterRelation, score - afterRelation, score, candidate.supportingMemories, `relationBonus ${relationBonus.toFixed(2)}`));
			}
		}

		// 5. pressureBonus
		let pressureBonus = 1.0;
		if (this.self.pressure >= PRESSURE.HIGH_THRESHOLD) {
			pressureBonus = PRESSURE.GENERAL_REDUCTION;
			const afterPressure = score;
			score = score * pressureBonus;
			traces.push(this._makeTrace('selection', 'pressureBonus', afterPressure, score - afterPressure, score, [], `pressureBonus ${pressureBonus.toFixed(2)} (高压力)`));
		}

		// 6. proficiencyBonus
		const proficiencyBonus = this._calcProficiency(candidate.action);
		const afterProficiency = score;
		score = score * proficiencyBonus;
		traces.push(this._makeTrace('selection', 'proficiencyBonus', afterProficiency, score - afterProficiency, score, [], `proficiencyBonus ${proficiencyBonus.toFixed(2)}`));

		// 狼人硬约束：不攻击队友
		if (this.self.team === 'werewolf' && candidate.action === 'suspect' && candidate.targetId) {
			const t = this.allPlayers.find((p) => p.id === candidate.targetId);
			if (t && t.team === 'werewolf') {
				const before = score;
				score = 0;
				traces.push(this._makeTrace('selection', 'teamConstraint', before, -before, 0, [], '狼人不攻击队友（硬约束）'));
			}
		}

		return { score: Math.max(0, score), traces };
	}

	private _calcProficiency(action: ActionType): number {
		const map = PROFICIENCY_MAP.find((p) => p.action === action);
		if (!map) return 1.0;
		const a1 = this.self.attributes[map.primaryAttr];
		const a2 = map.secondaryAttr ? this.self.attributes[map.secondaryAttr] : null;
		return a2
			? PROFICIENCY.BASE + ((a1 + a2) / 2 / ATTRIBUTE_RANGE.MAX) * PROFICIENCY.MULTIPLIER
			: PROFICIENCY.BASE + (a1 / ATTRIBUTE_RANGE.MAX) * PROFICIENCY.MULTIPLIER;
	}
}
