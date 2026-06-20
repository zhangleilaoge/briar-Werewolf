// 白天行动类型常量
export const DAY_ACTION = {
  SILENCE: 'silence', // 沉默
  CLAIM_IDENTITY: 'claim_identity', // 声称身份
  REVEAL_INFO: 'reveal_info', // 透露信息
  OBSERVE: 'observe', // 观察
  SUSPECT: 'suspect', // 怀疑
  DEFEND: 'defend', // 辩护
  CALL_VOTE: 'call_vote', // 发起投票
  BLOCK_VOTE: 'block_vote', // 阻止投票
  GUARANTEE: 'guarantee', // 担保
  ACCUSE: 'accuse', // 指控
  EXCLUDE_ALL: 'exclude_all', // 排除所有
  BERSERKER_KILL: 'berserker_kill', // 狂战士击杀
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
} as const;

// 反应行动（追加行动）
export const REACTION_ACTION = {
  JOIN_SUSPECT: 'join_suspect', // 一同怀疑
  JOIN_DEFEND: 'join_defend',   // 一同袒护
  REBUT: 'rebut',               // 反驳
} as const;

// 所有行动类型合并
export const ACTION = {
  ...DAY_ACTION,
  ...NIGHT_ACTION,
  ...VOTE_ACTION,
  ...REACTION_ACTION,
} as const;

// 用于生成 DayActionType 联合类型
export type DayActionType =
  | typeof DAY_ACTION.SILENCE
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

export type VoteActionType = typeof VOTE_ACTION[keyof typeof VOTE_ACTION];

export type ReactionActionType = typeof REACTION_ACTION[keyof typeof REACTION_ACTION];

export type ActionType = DayActionType | NightActionType | VoteActionType | ReactionActionType;

// 承诺等级（从 intention/types.ts 统一导出）

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

// 主意图
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

// 职业常量
export const ROLE = {
  WEREWOLF: 'werewolf',
  LONE_WOLF: 'lone_wolf',
  BERSERKER: 'berserker',
  VILLAGER: 'villager',
  PROPHET: 'prophet',
  THIEF: 'thief',
  CORONER: 'coroner',
} as const;

// 日志行动类型（用于日志记录，非游戏行动）
export const LOG_ACTION = {
  CLAIM_CHECK_RESULT: 'claim_check_result',
  CLAIM_IDENTITY_END: 'claim_identity_end',
  OBSERVE_DETECTED: 'observe_detected',
  OBSERVE_MISSED: 'observe_missed',
} as const;

export type LogActionType = typeof LOG_ACTION[keyof typeof LOG_ACTION];
