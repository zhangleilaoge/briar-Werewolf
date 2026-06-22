// ============================================================
// IntentionEngine — 意图引擎
// Step 1→2→3→4: 长期意图 → 短期意图 → 候选集 → 加权选择
// 按 INTENTION.md 文档实现
// ============================================================

import type { Player } from '@/types';
import type { MemStore } from '@/memory';
import type { RoleInference, PlayerCrisis } from '@/inference/inference-engine';
import { InferenceEngine } from '@/inference/inference-engine';
import type {
	ActionType,
	ActionCandidate,
	LongTermIntention,
	ShortTermIntention,
	IntentionState,
} from '@/types/decision';
import { PERSONALITIES } from './personalities';
import {
	LONG_TERM_PRIORITY,
	SHORT_TERM_WEIGHT,
	PRESSURE,
	CANDIDATE_BASE_SCORE,
	BONUS,
	RANDOMNESS_DEFAULT,
	PROFICIENCY,
	ATTRIBUTE_MAX,
	PROFICIENCY_MAP,
	CRISIS_PROTECT_THRESHOLD,
	LEADERSHIP_WEIGHT,
} from '@/constants';

export interface IntentionConfig {
	randomness: number;
	reasoningDisabled: boolean;
}

export class IntentionEngine {
	private store: MemStore;
	private inference: InferenceEngine;
	private self: Player;
	private allPlayers: Player[];
	private config: IntentionConfig;

	constructor(
		store: MemStore,
		inference: InferenceEngine,
		self: Player,
		allPlayers: Player[],
		config: Partial<IntentionConfig> = {}
	) {
		this.store = store;
		this.inference = inference;
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
		const team = this.self.team;
		const role = this.self.role;
		const selfCrisis = this.inference.inferSelfCrisis();
		const roleInferences = this.inference.inferAll(this.allPlayers);

		// 1. 生存意图（所有角色通用）
		const survivePriority = Math.min(1.0, LONG_TERM_PRIORITY.SURVIVE);
		intentions.push({ id: 'survive', priority: survivePriority, description: `生存优先级：${(survivePriority * 100).toFixed(0)}%`, basis: [] });

		if (team === 'villager') {
			// 村民：找狼
			let highest: RoleInference | null = null;
			for (const inf of roleInferences.values()) { if (!highest || inf.werewolfProb > highest.werewolfProb) highest = inf; }
			const findWolfPriority = highest ? Math.min(0.9, LONG_TERM_PRIORITY.FIND_WOLF) : LONG_TERM_PRIORITY.FIND_WOLF;
			intentions.push({ id: 'find_werewolf', priority: findWolfPriority, targetPlayer: highest?.playerId, description: `找狼优先级：${(findWolfPriority * 100).toFixed(0)}%`, basis: highest?.basis ?? [] });

			// 保护同伴
			const fieldCrisis = this.inference.inferFieldCrisis(this.allPlayers);
			const mostAtRisk = fieldCrisis.mostAtRisk;
			if (mostAtRisk.score >= CRISIS_PROTECT_THRESHOLD && mostAtRisk.playerId !== this.self.id) {
				const protectPriority = Math.min(0.8, LONG_TERM_PRIORITY.PROTECT_VILLAGER);
				intentions.push({ id: 'protect_villager', priority: protectPriority, targetPlayer: mostAtRisk.playerId, description: `保护 ${mostAtRisk.playerId}`, basis: mostAtRisk.basis });
			}

			// 主导局势
			const leadPriority = (this.self.attributes.leadership / ATTRIBUTE_MAX) * LEADERSHIP_WEIGHT + LONG_TERM_PRIORITY.LEAD;
			intentions.push({ id: 'lead', priority: leadPriority, description: `主导局势`, basis: [] });
		} else {
			// 狼人：隐藏身份
			const hidePriority = Math.min(1.0, LONG_TERM_PRIORITY.HIDE_IDENTITY);
			intentions.push({ id: 'hide_identity', priority: hidePriority, description: `隐藏身份`, basis: [] });

			// 误导村民
			let lowest: RoleInference | null = null;
			for (const inf of roleInferences.values()) { if (!lowest || inf.werewolfProb < lowest.werewolfProb) lowest = inf; }
			const misleadPriority = lowest ? Math.min(0.8, LONG_TERM_PRIORITY.MISLEAD) : LONG_TERM_PRIORITY.MISLEAD;
			intentions.push({ id: 'mislead', priority: misleadPriority, targetPlayer: lowest?.playerId, description: `误导`, basis: lowest?.basis ?? [] });
		}

		if (role === 'prophet') {
			const checkMemories = this.store.getAll().filter((m) => !m.isForgotten && m.actorId === this.self.id && m.eventType === 'check_result');
			if (checkMemories.length > 0) {
				intentions.push({ id: 'report_check', priority: 0.95, description: '报查验', basis: checkMemories.map(m => m.id) });
			}
		}

		return intentions.sort((a, b) => b.priority - a.priority);
	}

	// ==================== Step 2: 短期意图生成 ====================

	generateShortTermIntentions(longTerm: LongTermIntention[]): ShortTermIntention[] {
		const shortTerm: ShortTermIntention[] = [];
		for (const lt of longTerm) {
			const weight = lt.priority * SHORT_TERM_WEIGHT.FACTOR;
			switch (lt.id) {
				case 'survive': shortTerm.push({ id: 'survive', type: 'unpointed', weight, description: '自保', basis: lt.basis }); break;
				case 'find_werewolf':
					shortTerm.push({ id: lt.targetPlayer ? `attack_${lt.targetPlayer}` : 'attack', type: 'pointed', targetId: lt.targetPlayer, weight, description: '攻击', basis: lt.basis });
					shortTerm.push({ id: lt.targetPlayer ? `observe_${lt.targetPlayer}` : 'observe', type: 'pointed', targetId: lt.targetPlayer, weight: weight * SHORT_TERM_WEIGHT.OBSERVE_FACTOR, description: '观察', basis: lt.basis });
					break;
				case 'protect_villager': shortTerm.push({ id: lt.targetPlayer ? `protect_${lt.targetPlayer}` : 'protect', type: 'pointed', targetId: lt.targetPlayer, weight, description: '保护', basis: lt.basis }); break;
				case 'lead': shortTerm.push({ id: 'lead', type: 'unpointed', weight: weight * SHORT_TERM_WEIGHT.LEAD_FACTOR, description: '主导', basis: lt.basis }); break;
				case 'hide_identity':
					shortTerm.push({ id: 'hide', type: 'unpointed', weight, description: '隐藏', basis: lt.basis });
					shortTerm.push({ id: 'observe', type: 'unpointed', weight: weight * SHORT_TERM_WEIGHT.HIDE_OBSERVE_FACTOR, description: '观察', basis: lt.basis });
					break;
				case 'mislead': shortTerm.push({ id: lt.targetPlayer ? `attack_${lt.targetPlayer}` : 'attack', type: 'pointed', targetId: lt.targetPlayer, weight, description: '误导', basis: lt.basis }); break;
				case 'report_check': shortTerm.push({ id: 'report_check', type: 'unpointed', weight, description: '报查验', basis: lt.basis }); break;
			}
		}

		const pressure = this.self.pressure;
		for (const st of shortTerm) {
			if (pressure >= PRESSURE.HIGH_THRESHOLD) { if (st.id.includes('attack')) st.weight *= PRESSURE.HIGH_AGGRESSIVE_MULTIPLIER; else if (st.id.includes('observe')) st.weight *= PRESSURE.HIGH_DEFENSIVE_MULTIPLIER; }
			else if (pressure >= PRESSURE.MEDIUM_THRESHOLD) { if (st.id.includes('attack')) st.weight *= PRESSURE.MEDIUM_AGGRESSIVE_MULTIPLIER; }
		}

		const merged = new Map<string, ShortTermIntention>();
		for (const st of shortTerm) {
			if (merged.has(st.id)) {
				const existing = merged.get(st.id)!;
				existing.weight += st.weight;
				existing.basis = [...new Set([...existing.basis, ...st.basis])];
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

			if (st.id === 'survive' || st.id === 'hide') {
				if (phase === 'day') candidates.push({ action: 'silence', score: CANDIDATE_BASE_SCORE_SILENCE, reason: '隐藏', supportingMemories: baseBasis });
				else candidates.push({ action: 'sleep', score: CANDIDATE_BASE_SCORE.SLEEP, reason: '隐藏', supportingMemories: baseBasis });
			} else if (st.id === 'lead') {
				candidates.push({ action: 'claim_identity', score: CANDIDATE_BASE_SCORE.CLAIM_IDENTITY, reason: '带队', supportingMemories: baseBasis });
			} else if (st.id === 'report_check') {
				candidates.push({ action: 'claim_identity', score: CANDIDATE_BASE_SCORE.REPORT_CHECK, reason: '报查验', supportingMemories: baseBasis });
			} else if (st.id.startsWith('attack_') || st.id === 'attack') {
				for (const t of viable.slice(0, 3)) {
					const inf = roleInferences.get(t.id);
					const supportingMemories = [...baseBasis, ...(inf?.basis ?? [])];
					candidates.push({ action: 'suspect', targetId: t.id, score: CANDIDATE_BASE_SCORE.SUSPECT + (targetId === t.id ? CANDIDATE_BASE_SCORE.TARGET_MATCH_BONUS : 0), reason: `攻击 ${t.id}`, supportingMemories });
				}
			} else if (st.id.startsWith('protect_') || st.id === 'protect') {
				for (const t of viable.slice(0, 2)) {
					const inf = roleInferences.get(t.id);
					const supportingMemories = [...baseBasis, ...(inf?.basis ?? [])];
					candidates.push({ action: 'defend', targetId: t.id, score: CANDIDATE_BASE_SCORE.DEFEND + (targetId === t.id ? CANDIDATE_BASE_SCORE.DEFEND_TARGET_MATCH : 0), reason: `保护 ${t.id}`, supportingMemories });
				}
			} else if (st.id.startsWith('observe_') || st.id === 'observe') {
				for (const t of viable.slice(0, 3)) {
					candidates.push({ action: 'observe', targetId: t.id, score: CANDIDATE_BASE_SCORE.OBSERVE + (targetId === t.id ? CANDIDATE_BASE_SCORE.OBSERVE_TARGET_MATCH : 0), reason: `观察 ${t.id}`, supportingMemories: baseBasis });
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

	// ==================== Step 4: 加权选择 ====================

	selectAction(candidates: ActionCandidate[]): ActionCandidate | null {
		if (candidates.length === 0) return null;
		const roleInferences = this.config.reasoningDisabled ? new Map<string, RoleInference>() : this.inference.inferAll(this.allPlayers);
		const fieldCrisis = this.config.reasoningDisabled ? null : this.inference.inferFieldCrisis(this.allPlayers);
		const personality = PERSONALITIES[this.self.personality] || PERSONALITIES.cautious;

		const scored = candidates.map((c) => ({ ...c, score: this._calcScore(c, roleInferences, fieldCrisis, personality) }));
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

	generateDayAction(): IntentionState {
		const longTerm = this.evaluateLongTermIntentions();
		const shortTerm = this.generateShortTermIntentions(longTerm);
		const candidates = this.generateCandidates(shortTerm, 'day');
		const selected = this.selectAction(candidates);
		return { longTerm, shortTerm, candidates, selected };
	}

	generateNightAction(): IntentionState {
		const longTerm = this.evaluateLongTermIntentions();
		const shortTerm = this.generateShortTermIntentions(longTerm);
		const candidates = this.generateCandidates(shortTerm, 'night');
		const selected = this.selectAction(candidates);
		return { longTerm, shortTerm, candidates, selected };
	}

	// ==================== 内部方法 ====================

	private _calcScore(
		candidate: ActionCandidate,
		roleInferences: Map<string, RoleInference>,
		fieldCrisis: { all: PlayerCrisis[] } | null,
		personality: typeof PERSONALITIES[keyof typeof PERSONALITIES]
	): number {
		// 1. 性格过滤（禁用行动）
		if (personality.disabledActions.includes(candidate.action)) return 0;

		let score = candidate.score;

		// 2. roleBonus：基于角色概率的目标选择
		let roleBonus = 1.0;
		if (!this.config.reasoningDisabled && candidate.targetId && roleInferences.has(candidate.targetId)) {
			const inf = roleInferences.get(candidate.targetId)!;
			if (candidate.action === 'suspect' || candidate.action === 'kill') {
				roleBonus = 0.5 + inf.werewolfProb * 1.5; // 狼人概率越高，攻击得分越高
			} else if (candidate.action === 'defend') {
				roleBonus = 0.5 + (1 - inf.werewolfProb) * 1.5; // 狼人概率越低，辩护得分越高
			}
		}
		roleBonus = Math.max(BONUS.MIN, Math.min(BONUS.MAX, roleBonus));

		// 3. situationBonus：基于危机度的目标选择
		let situationBonus = 1.0;
		if (!this.config.reasoningDisabled && fieldCrisis && candidate.targetId) {
			const crisis = fieldCrisis.all.find((c) => c.playerId === candidate.targetId);
			if (crisis) {
				if (candidate.action === 'defend') {
					situationBonus = 0.5 + Math.min(crisis.score / 10, 1) * 1.5; // 危机度高，辩护得分高
				} else if (candidate.action === 'suspect') {
					situationBonus = 0.5 + Math.min(crisis.dominant / 10, 1) * 1.5; // 主导度高，攻击得分高
				}
			}
		}
		situationBonus = Math.max(BONUS.MIN, Math.min(BONUS.MAX, situationBonus));

		// 4. personalityBonus
		const personalityBonus = personality.actionWeightMods[candidate.action] ?? 1.0;

		// 5. pressureBonus
		let pressureBonus = 1.0;
		if (this.self.pressure >= PRESSURE.HIGH_THRESHOLD) {
			pressureBonus = PRESSURE.GENERAL_REDUCTION;
		}

		// 6. proficiencyBonus
		const proficiencyBonus = this._calcProficiency(candidate.action);

		score = score * roleBonus * situationBonus * personalityBonus * pressureBonus * proficiencyBonus;

		// 狼人硬约束：不攻击队友
		if (this.self.team === 'werewolf' && candidate.action === 'suspect' && candidate.targetId) {
			const t = this.allPlayers.find((p) => p.id === candidate.targetId);
			if (t && t.team === 'werewolf') score = 0;
		}

		return Math.max(0, score);
	}

	private _calcProficiency(action: ActionType): number {
		const map = PROFICIENCY_MAP.find((p) => p.action === action);
		if (!map) return 1.0;
		const a1 = this.self.attributes[map.primaryAttr as keyof Player['attributes']];
		const a2 = map.secondaryAttr ? this.self.attributes[map.secondaryAttr as keyof Player['attributes']] : null;
		return a2
			? PROFICIENCY.BASE + ((a1 + a2) / 2 / ATTRIBUTE_MAX) * PROFICIENCY.MULTIPLIER
			: PROFICIENCY.BASE + (a1 / ATTRIBUTE_MAX) * PROFICIENCY.MULTIPLIER;
	}
}
