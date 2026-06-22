// ============================================================
// 可信度常量
// ============================================================

/** 各来源的默认可信度 */
export const CREDIBILITY = {
  SYSTEM: 1.0,   // 系统事件或系统告知
  SELF: 1.0,     // 自己的行动
  SPEECH: 0.4,   // 他人发言，默认不可信
  OBSERVE: 0.7,  // 自己的观察
} as const;

/** 默认可信度（未知来源） */
export const CREDIBILITY_DEFAULT = 0.5;

/** 硬信息阈值：credibility >= 此值视为硬信息 */
export const HARD_INFO_THRESHOLD = 1.0;
