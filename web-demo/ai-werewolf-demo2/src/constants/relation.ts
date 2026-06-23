// ============================================================
// 关系系统常量
// ============================================================

// ---------- 旁观者视角衰减系数 ----------
export const BYSTANDER_DECAY = 0.3;

// ---------- 友好度变化量 ----------
export const FRIENDLY_DELTA = {
	hear_accuse: -3,	// 被怀疑：友好度-3
	vote: -2,			// 被投票：友好度-2
	hear_defend: +2,	// 被辩护：友好度+2
	hear_chat_success: +1,	// 闲聊成功：友好度+1
	hear_chat_fail: -1,		// 闲聊失败：友好度-1
	hear_claim_wolf: -5,	// 被声称查杀：极度敌对
	hear_claim_villager: +2,	// 被声称金水：友好度+2
	observe_attack_me: -2,		// 观察到某人攻击我：友好度-2
	observe_protect_me: +2,		// 观察到某人保护我：友好度+2
} as const;

// ---------- 友好度范围 ----------
export const FRIENDLY_RANGE = {
  MIN: -10,
  MAX: 10,
  INITIAL: 0,
} as const;
