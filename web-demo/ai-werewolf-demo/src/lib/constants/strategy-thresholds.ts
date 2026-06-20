// 策略阈值常量
export const STRATEGY_WOLF_PROB_CRITICAL = 0.7;  // 强烈怀疑阈值
export const STRATEGY_IDENTITY_CRISIS_CRITICAL = 0.8;    // 极度身份危机阈值
export const STRATEGY_IDENTITY_CRISIS_SAFE = 0.5;         // 自身安全身份危机阈值
export const STRATEGY_SILENCE_SUSPICIOUS = 2;      // 可疑沉默次数
export const STRATEGY_STRESS_SUSPICIOUS = 2;       // 可疑压力阈值
export const STRATEGY_TRUST_LOW = -3;              // 低信任度阈值

// 身份危机阈值（用于 UI 显示和策略决策）
export const IDENTITY_CRISIS_LOW_THRESHOLD = 0.3;    // 低身份危机阈值（低于此值为安全）
export const IDENTITY_CRISIS_HIGH_THRESHOLD = 0.6;   // 高身份危机阈值（超过此值认为身份可能身份危机）
export const IDENTITY_CRISIS_CRITICAL_THRESHOLD = 0.7; // 临界身份危机阈值（超过此值认为身份几乎身份危机）
