// ============================================================
// InferenceEngine — 推理引擎协调器
// 全部依赖记忆，动态计算。不缓存，不存储。
// 呈现结果只有：某个角色可能是某个职业，概率是多少。
// ============================================================

import type { Player } from '@/types';
import type { MemStore } from '@/memory';
import type { RoleInferenceTrace, CrisisTrace } from '@/types/trace';
import type { RoleInference } from './role-inference';
import type { PlayerCrisis } from './crisis-inference';
import { inferPlayer } from './role-inference';
import { inferCrisis } from './crisis-inference';

export type { RoleInference, PlayerCrisis };
export type { RoleInferenceTrace, CrisisTrace };

export class InferenceEngine {
	private store: MemStore;
	private selfId: string;

	constructor(store: MemStore, selfId: string) {
		this.store = store;
		this.selfId = selfId;
	}

	// ==================== 角色推理（Role Inference） ====================

	inferAll(allPlayers: Player[]): Map<string, RoleInference> {
		const result = new Map<string, RoleInference>();
		for (const player of allPlayers) {
			if (player.id === this.selfId) continue;
			result.set(player.id, inferPlayer(this.store, player.id));
		}
		return result;
	}

	inferPlayer(playerId: string): RoleInference {
		return inferPlayer(this.store, playerId);
	}

	/** 带完整溯源的角色推理（用于 hover 展示） */
	inferPlayerWithTrace(playerId: string): RoleInference {
		return inferPlayer(this.store, playerId, true);
	}

	// ==================== 局势推理（Situation Inference） ====================

	inferSelfCrisis(): PlayerCrisis {
		return inferCrisis(this.store, this.selfId);
	}

	inferFieldCrisis(allPlayers: Player[]): {
		mostAtRisk: PlayerCrisis;
		mostDominant: PlayerCrisis;
		all: PlayerCrisis[];
	} {
		const all: PlayerCrisis[] = [];
		for (const player of allPlayers) {
			if (!player.alive) continue;
			all.push(inferCrisis(this.store, player.id));
		}
		all.sort((a, b) => b.score - a.score);
		return { mostAtRisk: all[0], mostDominant: all[all.length - 1], all };
	}

	/** 带完整溯源的危机度推理（用于 hover 展示） */
	inferCrisisWithTrace(playerId: string): PlayerCrisis {
		return inferCrisis(this.store, playerId, true);
	}

	// ==================== 辅助查询接口（供意图层调用） ====================

	/** 获取自己的硬信息查验结果 */
	getMyCheckResults(): import('@/types').MemoryEntry[] {
		return this.store
			.getAll()
			.filter((m) => !m.isForgotten && m.actorId === this.selfId && m.eventType === 'check_result');
	}
}
