// ============================================================
// 狼人角色插件
// ============================================================

import type { RolePlugin } from '../registry';
import { CANDIDATE_BASE_SCORE, LONG_TERM_PRIORITY } from '@/constants';

export const werewolfPlugin: RolePlugin = {
	id: 'werewolf',
	roleName: '狼人',
	team: 'werewolf',
	hasNightAction: true,

	getLongTermIntentions(self, allPlayers, inferences, selfCrisis, relations, fieldCrisis) {
		const longTerm = [];
		longTerm.push({
			id: 'survive',
			priority: LONG_TERM_PRIORITY.SURVIVE,
			description: '活着',
			basis: [],
			traces: [],
		});
		// 狼人特有：隐藏身份
		longTerm.push({
			id: 'hide_identity',
			priority: LONG_TERM_PRIORITY.HIDE_IDENTITY,
			description: '隐藏身份',
			basis: [],
			traces: [],
		});
		// 误导村民：找 werewolfProb 最低的（最像村民的）
		let lowest = null;
		for (const inf of inferences.values()) {
			if (!lowest || inf.wolfProb < lowest.wolfProb) lowest = inf;
		}
		const misleadPriority = lowest ? Math.min(0.8, LONG_TERM_PRIORITY.MISLEAD) : LONG_TERM_PRIORITY.MISLEAD;
		longTerm.push({
			id: 'mislead',
			priority: misleadPriority,
			targetPlayer: lowest?.playerId,
			description: `误导`,
			basis: lowest?.basis ?? [],
			traces: [],
		});
		return longTerm;
	},

	getNightActionCandidates(self, allPlayers, inferences, relations, checkResults) {
		const candidates = [];
		const nonWerewolf = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');
		for (const t of nonWerewolf) {
			const inf = inferences.get(t.id);
			const score = CANDIDATE_BASE_SCORE.KILL + (inf ? inf.wolfProb * 10 : 0);
			candidates.push({
				action: 'kill' as const,
				targetId: t.id,
				score,
				reason: `击杀 ${t.name}`,
				supportingMemories: inf?.basis ?? [],
			});
		}
		return candidates;
	},
};
