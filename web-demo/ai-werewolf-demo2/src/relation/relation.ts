// ============================================================
// RelationTracker — 关系跟踪器
// 纯粹的关系系统，和推理无关。只维护友好度。
// 被攻击（怀疑、投票）→ 友好度降低
// 被袒护（辩护）→ 友好度升高
// ============================================================

import type { MemoryEntry, Relation } from '@/types';
import { getString, getBoolean } from '@/types/guards';
import { FRIENDLY_DELTA, FRIENDLY_RANGE, BYSTANDER_DECAY } from '@/constants';
import type { MemoryImpact } from '@/types/trace';

export interface RelationDetail {
	playerId: string;
	friendly: number;
	memoryIds: string[];
	directImpacts: MemoryImpact[];
	bystanderImpacts: MemoryImpact[];
}

export class RelationTracker {
	private relations: Map<string, Relation> = new Map();
	private relationDetails: Map<string, RelationDetail> = new Map();
	private selfId: string;

	constructor(selfId: string, allPlayerIds: string[]) {
		this.selfId = selfId;
		for (const id of allPlayerIds) {
			if (id !== selfId) {
				this.relations.set(id, { friendly: FRIENDLY_RANGE.INITIAL, memoryIds: [] });
				this.relationDetails.set(id, {
					playerId: id,
					friendly: FRIENDLY_RANGE.INITIAL,
					memoryIds: [],
					directImpacts: [],
					bystanderImpacts: [],
				});
			}
		}
	}

	/**
	 * 当一条记忆被录入时，检查是否需要更新关系。
	 * 处理两种视角：
	 * 1. 直接对我做的（targetId === selfId）
	 * 2. 我观察到的（targetId !== selfId，衰减后）
	 */
	onMemoryAdded(memory: MemoryEntry): void {
		// 不处理自己对自己做的事
		if (memory.actorId === this.selfId) return;
		// 不处理 system 事件（没有 actorId）
		if (memory.actorId === 'system') return;

		// === 1. 直接对我做的（目标是我）===
		if (memory.targetId === this.selfId) {
			this._handleDirectImpact(memory);
		}
		// === 2. 旁观者视角：我观察到别人对别人做了什么（衰减系数）===
		else if (memory.targetId && memory.targetId !== this.selfId) {
			this._handleBystanderImpact(memory);
		}
	}

	/** 处理直接影响（别人对我做的） */
	private _handleDirectImpact(memory: MemoryEntry): void {
		let delta = 0;
		let description = '';
		let baseValue = 0;
		let multiplier = 1;
		let formula = '';
		let impactType: 'direct' = 'direct';

		switch (memory.eventType) {
			case 'hear_accuse': {
				baseValue = FRIENDLY_DELTA.hear_accuse;
				delta = baseValue;
				description = `${memory.actorId} 指控我`;
				formula = `${baseValue}(被指控影响)`;
				break;
			}
			case 'vote': {
				baseValue = FRIENDLY_DELTA.vote;
				delta = baseValue;
				description = `${memory.actorId} 投票给我`;
				formula = `${baseValue}(被投票影响)`;
				break;
			}
			case 'hear_defend': {
				baseValue = FRIENDLY_DELTA.hear_defend;
				delta = baseValue;
				description = `${memory.actorId} 为我辩护`;
				formula = `${baseValue}(被辩护影响)`;
				break;
			}
			case 'hear_chat': {
				const success = getBoolean(memory.content, 'success');
				baseValue = success ? FRIENDLY_DELTA.hear_chat_success : FRIENDLY_DELTA.hear_chat_fail;
				delta = baseValue;
				description = `${memory.actorId} 对我闲聊${success ? '（成功）' : '（失败）'}`;
				formula = `${baseValue}(闲聊${success ? '成功' : '失败'})`;
				break;
			}
			case 'hear_claim': {
				const claimedResult = getString(memory.content, 'claimedResult');
				if (claimedResult === 'werewolf') {
					baseValue = FRIENDLY_DELTA.hear_claim_wolf;
					delta = baseValue;
					description = `${memory.actorId} 声称查杀我`;
					formula = `${baseValue}(被声称查杀)`;
				} else if (claimedResult === 'villager') {
					baseValue = FRIENDLY_DELTA.hear_claim_villager;
					delta = baseValue;
					description = `${memory.actorId} 声称我是金水`;
					formula = `${baseValue}(被声称金水)`;
				}
				break;
			}
			case 'observe_pattern': {
				const inferredIntention = getString(memory.content, 'inferredIntention');
				const intentionTarget = getString(memory.content, 'intentionTarget');
				if (inferredIntention === 'attack' && intentionTarget === this.selfId) {
					baseValue = FRIENDLY_DELTA.observe_attack_me;
					delta = baseValue;
					description = `观察到 ${memory.actorId} 攻击我`;
					formula = `${baseValue}(观察到攻击)`;
				} else if (inferredIntention === 'protect' && intentionTarget === this.selfId) {
					baseValue = FRIENDLY_DELTA.observe_protect_me;
					delta = baseValue;
					description = `观察到 ${memory.actorId} 保护我`;
					formula = `${baseValue}(观察到保护)`;
				}
				break;
			}
		}

		if (delta !== 0) {
			delta *= memory.credibility;
			multiplier *= memory.credibility;
			formula = `${formula} × ${memory.credibility}(可信度) = ${delta.toFixed(1)}`;
			this.adjustFriendly(memory.actorId, delta, memory.id);
			const detail = this.relationDetails.get(memory.actorId);
			if (detail) {
				const before = detail.friendly - delta;
				detail.directImpacts.push({
					memoryId: memory.id,
					eventType: memory.eventType,
					actorId: memory.actorId,
					targetId: memory.targetId,
					impactType,
					description,
					deltaScore: delta,
					beforeScore: before,
					afterScore: detail.friendly,
					baseValue,
					multiplier,
					formula,
				});
			}
		}
	}

	/** 处理旁观者视角（我观察到别人对别人做的，衰减后） */
	private _handleBystanderImpact(memory: MemoryEntry): void {
		let delta = 0;
		let description = '';
		let baseValue = 0;
		let multiplier = BYSTANDER_DECAY;
		let formula = '';

		switch (memory.eventType) {
			case 'hear_accuse': {
				baseValue = FRIENDLY_DELTA.hear_accuse;
				delta = baseValue * multiplier;
				description = `我观察到 ${memory.actorId} 指控 ${memory.targetId}`;
				formula = `${baseValue}(被指控影响) × ${multiplier}(旁观者衰减系数) = ${delta.toFixed(1)}`;
				break;
			}
			case 'vote': {
				baseValue = FRIENDLY_DELTA.vote;
				delta = baseValue * multiplier;
				description = `我观察到 ${memory.actorId} 投票给 ${memory.targetId}`;
				formula = `${baseValue}(被投票影响) × ${multiplier}(旁观者衰减系数) = ${delta.toFixed(1)}`;
				break;
			}
			case 'hear_defend': {
				baseValue = FRIENDLY_DELTA.hear_defend;
				delta = baseValue * multiplier;
				description = `我观察到 ${memory.actorId} 为 ${memory.targetId} 辩护`;
				formula = `${baseValue}(被辩护影响) × ${multiplier}(旁观者衰减系数) = ${delta.toFixed(1)}`;
				break;
			}
			case 'hear_chat': {
				const success = getBoolean(memory.content, 'success');
				baseValue = success ? FRIENDLY_DELTA.hear_chat_success : FRIENDLY_DELTA.hear_chat_fail;
				delta = baseValue * multiplier;
				description = `我观察到 ${memory.actorId} 对 ${memory.targetId} 闲聊${success ? '成功' : '失败'}`;
				formula = `${baseValue}(闲聊${success ? '成功' : '失败'}) × ${multiplier}(旁观者衰减系数) = ${delta.toFixed(1)}`;
				break;
			}
		}

		if (delta !== 0) {
			delta *= memory.credibility;
			multiplier *= memory.credibility;
			formula = `${formula} × ${memory.credibility}(可信度) = ${delta.toFixed(1)}`;
			this.adjustFriendly(memory.actorId, delta, memory.id);
			const detail = this.relationDetails.get(memory.actorId);
			if (detail) {
				const before = detail.friendly - delta;
				detail.bystanderImpacts.push({
					memoryId: memory.id,
					eventType: memory.eventType,
					actorId: memory.actorId,
					targetId: memory.targetId,
					impactType: 'cascade',
					description,
					deltaScore: delta,
					beforeScore: before,
					afterScore: detail.friendly,
					baseValue,
					multiplier,
					formula,
				});
			}
		}
	}

	adjustFriendly(targetId: string, delta: number, memoryId?: string): void {
		const rel = this.relations.get(targetId);
		if (!rel) return;
		rel.friendly = Math.max(FRIENDLY_RANGE.MIN, Math.min(FRIENDLY_RANGE.MAX, rel.friendly + delta));
		if (memoryId) rel.memoryIds.push(memoryId);

		const detail = this.relationDetails.get(targetId);
		if (detail) {
			detail.friendly = rel.friendly;
			if (memoryId) detail.memoryIds.push(memoryId);
		}
	}

	getFriendly(targetId: string): number {
		return this.relations.get(targetId)?.friendly ?? FRIENDLY_RANGE.INITIAL;
	}

	getDetail(targetId: string): RelationDetail | undefined {
		return this.relationDetails.get(targetId);
	}

	getAll(): RelationDetail[] {
		return Array.from(this.relationDetails.values())
			.sort((a, b) => a.friendly - b.friendly); // 从低到高（最不友好在前）
	}

	getRelation(targetId: string): Relation | undefined {
		return this.relations.get(targetId);
	}
}
