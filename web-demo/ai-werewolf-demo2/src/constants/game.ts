// ============================================================
// 游戏配置常量
// ============================================================

// ---------- 回合限制 ----------
export const MAX_ROUNDS = 20;

// ---------- 玩家属性范围 ----------
export const ATTRIBUTE_RANGE = {
  MIN: 1,
  MAX: 10,
} as const;

// ---------- 玩家初始值 ----------
export const PLAYER_INITIAL = {
  PRESSURE: 0,
  BURST_COUNT: 0,
  TRAITS: [] as string[],
} as const;

// ---------- ASCII 'A' 用于玩家 ID 生成 ----------
export const PLAYER_ID_BASE_CHAR_CODE = 65;

// ---------- 阶段标题 ----------
export const PHASE_HEADERS = {
  ROUND_TITLE: (r: number) => `=== 第 ${r} 轮 ===`,
  DAY: '💬 白天：所有人发言',
  VOTE: '🗳️ 投票阶段',
  NIGHT: '🌙 夜晚降临...',
  MORNING_PEACEFUL: '☀️ 天亮了，昨晚是平安夜',
  MORNING_DEATH: (name: string) => `☀️ 天亮了，${name} 被狼人杀害了`,
  VICTORY: (winner: 'werewolf' | 'villager') => `🏆 ${winner === 'werewolf' ? '狼人阵营' : '村民阵营'} 胜利！`,
  GAME_CONTINUE: '游戏继续',
} as const;

// ---------- 日志内容模板 ----------
export const LOG_TEMPLATES = {
  NO_ACTION: (name: string) => `[${name}] 没有行动`,
  CLAIM_IDENTITY: (name: string) => `📢 [${name}] 公布身份：「我是预言家」`,
  SUSPECT: (name: string, target: string) => `⚔️ [${name}] 号召投票给 ${target}：「大家今天投 ${target}！」`,
  DEFEND: (name: string, target: string) => `🛡️ [${name}] 为 ${target} 辩护：「${target} 不像狼人」`,
  OBSERVE: (name: string, target: string) => `🔍 [${name}] 暗中观察 ${target}`,
  SILENCE: (name: string) => `🤫 [${name}] 保持沉默`,
  CHAT: (name: string, target: string) => `💬 [${name}] 和 ${target} 闲聊`,
  VOTE: (name: string, target: string) => `🗳️ [${name}] 投票给 ${target}`,
  ABSTAIN: (name: string) => `🗳️ [${name}] 弃权`,
  EXILE_RESULT: (name: string, votes: number) => `🗳️ ${name} 得票最多（${votes} 票），被放逐`,
  NO_EXILE: '🗳️ 无人被放逐',
  PROPHET_NO_TARGET: (name: string) => `🔮 [${name}] 没有查验目标`,
  PROPHET_CHECK: (name: string, target: string, result: string) => `🔮 [${name}] 查验 ${target}：${result}`,
  WEREWOLF_NO_ACTION: '🌙 狼人没有行动',
  WEREWOLF_NO_TARGET: '🌙 狼人没有目标',
  WEREWOLF_KILL: (name: string) => `🐺 狼人袭击了 ${name}`,
} as const;
