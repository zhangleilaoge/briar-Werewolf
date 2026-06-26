// ============================================================
// 预言家角色插件
// ============================================================

import type { RolePlugin } from '../registry';
import { CANDIDATE_BASE_SCORE, LONG_TERM_PRIORITY } from '@/constants';

export const prophetPlugin: RolePlugin = {
	id: 'prophet',
	roleName: '预言家',
	team: 'villager',
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
		// 预言家特有：带队报查验
		longTerm.push({
			id: 'lead',
			priority: LONG_TERM_PRIORITY.LEAD,
			description: '带队',
			basis: [],
			traces: [],
		});
		// 报查验（由引擎层根据实际 checkResults 过滤）
		longTerm.push({
			id: 'report_check',
			priority: LONG_TERM_PRIORITY.REPORT_CHECK,
			description: '报查验',
			basis: [],
			traces: [],
		});
		return longTerm;
	},

	getNightActionCandidates(self, allPlayers, inferences, relations, checkResults) {
		const candidates = [];
		const others = allPlayers.filter((p) => p.id !== self.id && p.alive);
		for (const t of others) {
			const inf = inferences.get(t.id);
			const score = CANDIDATE_BASE_SCORE.CHECK + (inf ? (1 - inf.wolfProb) * 10 : 0);
			candidates.push({
				action: 'check' as const,
				targetId: t.id,
				score,
				reason: `查验 ${t.name}`,
				supportingMemories: inf?.basis ?? [],
			});
		}
		return candidates;
	},
};
