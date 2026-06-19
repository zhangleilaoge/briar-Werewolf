// 白天行动类型常量
export const DAY_ACTION = {
  SILENCE: 'silence',
  SPEAK: 'speak',
  CLAIM_IDENTITY: 'claim_identity',
  REVEAL_INFO: 'reveal_info',
  OBSERVE: 'observe',
  SUSPECT: 'suspect',
  DEFEND: 'defend',
  CALL_VOTE: 'call_vote',
  BLOCK_VOTE: 'block_vote',
  GUARANTEE: 'guarantee',
  ACCUSE: 'accuse',
  EXCLUDE_ALL: 'exclude_all',
  BERSERKER_KILL: 'berserker_kill',
} as const;

// 夜间行动类型常量
export const NIGHT_ACTION = {
  KILL: 'kill',
  CHECK: 'check',
  STEAL: 'steal',
  INSPECT: 'inspect',
} as const;

// 投票阶段行动
export const VOTE_ACTION = {
  VOTE: 'vote',
  JOIN_SUSPECT: 'join_suspect',
  JOIN_DEFEND: 'join_defend',
  REBUT: 'rebut',
} as const;

// 所有行动类型合并
export const ACTION = {
  ...DAY_ACTION,
  ...NIGHT_ACTION,
  ...VOTE_ACTION,
} as const;

// 用于生成 DayActionType 联合类型
export type DayActionType =
  | typeof DAY_ACTION.SILENCE
  | typeof DAY_ACTION.SPEAK
  | typeof DAY_ACTION.CLAIM_IDENTITY
  | typeof DAY_ACTION.REVEAL_INFO
  | typeof DAY_ACTION.OBSERVE
  | typeof DAY_ACTION.SUSPECT
  | typeof DAY_ACTION.DEFEND
  | typeof DAY_ACTION.CALL_VOTE
  | typeof DAY_ACTION.BLOCK_VOTE
  | typeof DAY_ACTION.GUARANTEE
  | typeof DAY_ACTION.ACCUSE
  | typeof DAY_ACTION.EXCLUDE_ALL
  | typeof DAY_ACTION.BERSERKER_KILL;

export type NightActionType =
  | typeof NIGHT_ACTION.KILL
  | typeof NIGHT_ACTION.CHECK
  | typeof NIGHT_ACTION.STEAL
  | typeof NIGHT_ACTION.INSPECT;

export type VoteActionType =
  | typeof VOTE_ACTION.VOTE
  | typeof VOTE_ACTION.JOIN_SUSPECT
  | typeof VOTE_ACTION.JOIN_DEFEND
  | typeof VOTE_ACTION.REBUT;

export type ActionType = DayActionType | NightActionType | VoteActionType;

// 意图类型常量
export const INTENTION = {
  ATTACK: 'attack',
  RECRUIT: 'recruit',
  PROTECT: 'protect',
  REVEAL: 'reveal',
  INVESTIGATE: 'investigate',
  COORDINATE: 'coordinate',
  SURVIVE: 'survive',
  CONCEAL: 'conceal',
} as const;

export type IntentionType = typeof INTENTION[keyof typeof INTENTION];

// 意图来源常量
export const INTENTION_SOURCE = {
  TEAM_DUTY: 'team_duty',
  PERSONAL_GOAL: 'personal_goal',
  CRISIS: 'crisis',
  STRATEGIC: 'strategic',
  EXTERNAL: 'external',
  ROLE_DUTY: 'role_duty',
  BUS: 'bus',
} as const;

export type IntentionSource = typeof INTENTION_SOURCE[keyof typeof INTENTION_SOURCE];

// 承诺等级
export const COMMITMENT_LEVEL = {
  WEAK: 'weak',
  MEDIUM: 'medium',
  STRONG: 'strong',
} as const;

export type CommitmentLevel = typeof COMMITMENT_LEVEL[keyof typeof COMMITMENT_LEVEL];

// 模式
export const GAME_MODE = {
  NORMAL: 'normal',
  BUS: 'bus',
  DESPERATE: 'desperate',
  DOMINANT: 'dominant',
} as const;

export type GameMode = typeof GAME_MODE[keyof typeof GAME_MODE];

// 阵营目标
export const TEAM_OBJECTIVE = {
  ELIMINATE_OPPOSITION: 'eliminate_opposition',
  FIND_WOLVES: 'find_wolves',
} as const;

export type TeamObjective = typeof TEAM_OBJECTIVE[keyof typeof TEAM_OBJECTIVE];

// 个人目标
export const PERSONAL_OBJECTIVE = {
  MAINTAIN_COVER: 'maintain_cover',
  SURVIVE: 'survive',
  GAIN_TRUST: 'gain_trust',
  REVEAL_TRUTH: 'reveal_truth',
} as const;

export type PersonalObjective = typeof PERSONAL_OBJECTIVE[keyof typeof PERSONAL_OBJECTIVE];

// 计划阶段
export const PLAN_PHASE = {
  DAY: 'day',
  NIGHT: 'night',
  VOTE: 'vote',
  MORNING: 'morning',
  INIT: 'init',
  EVENT: 'event',
  ENDED: 'ended',
} as const;

export type PlanPhase = typeof PLAN_PHASE[keyof typeof PLAN_PHASE];
