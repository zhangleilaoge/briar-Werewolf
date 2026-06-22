// ============================================================
// 性格定义（Personality Definitions）
// 按 PERSONALITY.md 文档实现
// ============================================================

import type { PersonalityPlugin } from '@/types/decision';

export const PERSONALITIES: Record<string, PersonalityPlugin> = {
	aggressive: {
		id: 'aggressive',
		name: '好斗型',
		description: '喜欢攻击和质疑，容易与人发生冲突',
		disabledActions: ['silence'],
		actionWeightMods: {
			suspect: 2.0,
			observe: 0.8,
			defend: 0.3,
			claim_identity: 1.5,
			silence: 0,
			chat: 0.5,
			check: 1.0,
			kill: 1.0,
		},
	},
	cautious: {
		id: 'cautious',
		name: '谨慎型',
		description: '避免冲突，谨慎发言，不轻易站队',
		disabledActions: ['claim_identity'],
		actionWeightMods: {
			suspect: 0.5,
			observe: 1.5,
			defend: 1.2,
			claim_identity: 0,
			silence: 1.5,
			chat: 1.2,
			check: 1.0,
			kill: 1.0,
		},
	},
	manipulative: {
		id: 'manipulative',
		name: '操控型',
		description: '喜欢操控局势，善于引导他人',
		disabledActions: [],
		actionWeightMods: {
			suspect: 1.5,
			observe: 1.5,
			defend: 1.8,
			claim_identity: 1.2,
			silence: 0.5,
			chat: 2.0,
			check: 1.0,
			kill: 1.0,
		},
	},
	loyal: {
		id: 'loyal',
		name: '忠诚型',
		description: '重视关系和承诺，会保护同伴',
		disabledActions: [],
		actionWeightMods: {
			suspect: 0.8,
			observe: 1.0,
			defend: 2.0,
			claim_identity: 1.0,
			silence: 1.0,
			chat: 1.5,
			check: 1.0,
			kill: 1.0,
		},
	},
	suspicious: {
		id: 'suspicious',
		name: '多疑型',
		description: '总是怀疑别人，难以信任任何人',
		disabledActions: ['defend'],
		actionWeightMods: {
			suspect: 2.0,
			observe: 1.5,
			defend: 0,
			claim_identity: 0.5,
			silence: 0.8,
			chat: 0.3,
			check: 1.0,
			kill: 1.0,
		},
	},
} as const;

export type PersonalityId = keyof typeof PERSONALITIES;
