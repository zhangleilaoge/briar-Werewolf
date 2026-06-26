// ============================================================
// 村民角色插件（默认角色）
// ============================================================

import type { RolePlugin } from '../registry';
import { LONG_TERM_PRIORITY, CRISIS_PROTECT_THRESHOLD, LEADERSHIP_WEIGHT, ATTRIBUTE_RANGE } from '@/constants';

export const villagerPlugin: RolePlugin = {
	id: 'villager',
	roleName: '村民',
	team: 'villager',
	hasNightAction: false,

	getLongTermIntentions(self, allPlayers, inferences, selfCrisis, relations, fieldCrisis) {
		const longTerm = [];
		// 所有角色通用的生存意图
		longTerm.push({
			id: 'survive',
			priority: LONG_TERM_PRIORITY.SURVIVE,
			description: '活着',
			basis: [],
			traces: [],
		});
		// 村民特有：寻找狼人
		let highest = null;
		for (const inf of inferences.values()) {
			if (!highest || inf.wolfProb > highest.wolfProb) highest = inf;
		}
		const findWolfPriority = highest ? Math.min(0.9, LONG_TERM_PRIORITY.FIND_WOLF) : LONG_TERM_PRIORITY.FIND_WOLF;
		longTerm.push({
			id: 'find_werewolf',
			priority: findWolfPriority,
			targetPlayer: highest?.playerId,
			description: `找狼优先级：${(findWolfPriority * 100).toFixed(0)}%`,
			basis: highest?.basis ?? [],
			traces: [],
		});
		// 保护同伴（基于 fieldCrisis）
		if (fieldCrisis) {
			const mostAtRisk = fieldCrisis.mostAtRisk;
			if (mostAtRisk.score >= CRISIS_PROTECT_THRESHOLD && mostAtRisk.playerId !== self.id) {
				const protectPriority = Math.min(0.8, LONG_TERM_PRIORITY.PROTECT_VILLAGER);
				longTerm.push({
					id: 'protect_villager',
					priority: protectPriority,
					targetPlayer: mostAtRisk.playerId,
					description: `保护 ${mostAtRisk.playerId}`,
					basis: mostAtRisk.basis,
					traces: [],
				});
			}
		}
		// 主导局势
		const leadPriority = (self.attributes.leadership / ATTRIBUTE_RANGE.MAX) * LEADERSHIP_WEIGHT + LONG_TERM_PRIORITY.LEAD;
		longTerm.push({
			id: 'lead',
			priority: leadPriority,
			description: `主导局势`,
			basis: [],
			traces: [],
		});
		return longTerm;
	},

	getNightActionCandidates() {
		// 村民没有夜间行动
		return [];
	},
};
