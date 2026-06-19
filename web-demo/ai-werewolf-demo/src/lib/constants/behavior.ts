// ---------- 行为修正常量 ----------

// 压力阈值
export const STRESS_EXTREMELY_CALM = -5;              // 极度冷静阈值
export const STRESS_CALM = -2;                        // 冷静阈值
export const STRESS_MILDLY_TENSE_MIN = 2;             // 轻微紧张最小值
export const STRESS_MILDLY_TENSE_MAX = 5;             // 轻微紧张最大值
export const STRESS_ANXIOUS_MIN = 6;                  // 焦虑最小值
export const STRESS_ANXIOUS_MAX = 8;                  // 焦虑最大值
export const STRESS_NEAR_OVERLOAD = 9;                // 接近过载阈值

// ---------- 阵营行动取向常量 ----------
// 守序 vs 混乱：影响行动风格（稳健 vs 激进）
// 善良 vs 邪恶：影响阵营忠诚（保护同伴 vs 攻击敌人）

// 怀疑/指认/号召投票
export const ALIGNMENT_TENDENCY_LAWFUL_SUSPECT = -5;      // 守序：谨慎怀疑，不轻易指控
export const ALIGNMENT_TENDENCY_CHAOTIC_SUSPECT = 15;     // 混乱：激进怀疑，快速指控
export const ALIGNMENT_TENDENCY_EVIL_SUSPECT = 10;        // 邪恶：主动怀疑对手阵营

// 袒护/担保
export const ALIGNMENT_TENDENCY_GOOD_DEFEND = 10;         // 善良：积极保护同伴
export const ALIGNMENT_TENDENCY_EVIL_DEFEND = -5;         // 邪恶：不太愿意保护对手

// 号召投票
export const ALIGNMENT_TENDENCY_LAWFUL_CALL_VOTE = 5;     // 守序：有序号召
export const ALIGNMENT_TENDENCY_CHAOTIC_CALL_VOTE = 15;   // 混乱：冲动号召

// 阻止投票
export const ALIGNMENT_TENDENCY_LAWFUL_BLOCK_VOTE = 8;    // 守序：控制流程
export const ALIGNMENT_TENDENCY_CHAOTIC_BLOCK_VOTE = -3;  // 混乱：不耐烦阻止

// 强烈指认
export const ALIGNMENT_TENDENCY_CHAOTIC_ACCUSE = 20;      // 混乱：大胆指认
export const ALIGNMENT_TENDENCY_LAWFUL_ACCUSE = -5;       // 守序：谨慎指认

// 全员排除/极端行动
export const ALIGNMENT_TENDENCY_CHAOTIC_EXTREME = 25;     // 混乱：倾向极端
export const ALIGNMENT_TENDENCY_LAWFUL_EXTREME = -15;     // 守序：避免极端
export const ALIGNMENT_TENDENCY_EVIL_EXTREME = 10;        // 邪恶：倾向极端

// 公布身份（核心：伪装身份系统）
export const ALIGNMENT_TENDENCY_CHAOTIC_CLAIM_PROPHET = 30;   // 混乱狼人：大胆跳预言家
export const ALIGNMENT_TENDENCY_LAWFUL_CLAIM_PROPHET = -20;   // 守序狼人：保守，不轻易跳
export const ALIGNMENT_TENDENCY_CHAOTIC_CLAIM_HUNTER = 20;    // 混乱狼人：跳猎人
export const ALIGNMENT_TENDENCY_LAWFUL_CLAIM_HUNTER = -10;    // 守序狼人：不跳猎人
export const ALIGNMENT_TENDENCY_EVIL_CLAIM = 15;              // 邪恶阵营跳身份的基础收益

// 反驳
export const ALIGNMENT_TENDENCY_CHAOTIC_REBUT = 12;       // 混乱：情绪化反驳
export const ALIGNMENT_TENDENCY_LAWFUL_REBUT = 5;         // 守序：逻辑反驳

// 一同怀疑
export const ALIGNMENT_TENDENCY_EVIL_JOIN_SUSPECT = 15;   // 邪恶：落井下石
export const ALIGNMENT_TENDENCY_GOOD_JOIN_SUSPECT = -10;  // 善良：不愿落井下石

// 一同袒护
export const ALIGNMENT_TENDENCY_GOOD_JOIN_DEFEND = 12;    // 善良：团结保护
export const ALIGNMENT_TENDENCY_EVIL_JOIN_DEFEND = -8;    // 邪恶：不愿保护

// 沉默（混乱更少沉默，守序更多观察后行动）
export const ALIGNMENT_TENDENCY_CHAOTIC_SILENCE = -15;    // 混乱：不喜欢沉默
export const ALIGNMENT_TENDENCY_LAWFUL_SILENCE = 5;       // 守序：愿意等待

// 观察
export const ALIGNMENT_TENDENCY_LAWFUL_OBSERVE = 10;      // 守序：仔细观察
export const ALIGNMENT_TENDENCY_CHAOTIC_OBSERVE = -10;    // 混乱：不耐烦观察

// 杀戮（狼人夜间）
export const ALIGNMENT_TENDENCY_CHAOTIC_KILL = 10;        // 混乱：冲动杀戮
export const ALIGNMENT_TENDENCY_LAWFUL_KILL = -5;         // 守序：计算杀戮

// ---------- 伪装身份系统常量 ----------
// 伪装动机评分
export const FAKE_IDENTITY_SUSPECT_THRESHOLD = 2;         // 被怀疑人数阈值（超过此值触发伪装）
export const FAKE_IDENTITY_BASE_SCORE_SUSPECTED = 80;     // 被怀疑时伪装预言家基础分
export const FAKE_IDENTITY_BASE_SCORE_DISADVANTAGE = 150; // 己方劣势时伪装预言家基础分
export const FAKE_IDENTITY_BASE_SCORE_PROPHET_NOT_REVEALED = 200; // 预言家未跳时伪装基础分
export const FAKE_IDENTITY_BASE_SCORE_HIGH_EXPOSURE = 100; // 高暴露时伪装基础分
export const FAKE_IDENTITY_BASE_SCORE_HUNTER_SUSPECTED = 60; // 被怀疑时伪装猎人基础分
export const FAKE_IDENTITY_BASE_SCORE_HUNTER_EXPOSURE = 40; // 高暴露时伪装猎人基础分

// 时机选择
export const FAKE_IDENTITY_TIMING_EARLY_ROUND = 3;        // 早期跳身份阈值回合
export const FAKE_IDENTITY_TIMING_LATE_ROUND = 5;         // 后期跳身份阈值回合
export const FAKE_IDENTITY_TIMING_EARLY_PENALTY = -30;    // 早期跳身份惩罚
export const FAKE_IDENTITY_TIMING_LATE_BONUS = 20;        // 后期跳身份奖励
export const FAKE_IDENTITY_TIMING_COMPETITION_PENALTY = -50; // 有竞争者惩罚
export const FAKE_IDENTITY_TIMING_REAL_PROPHET_PENALTY = -100; // 真预言家已跳惩罚

// 一致性检查
export const FAKE_IDENTITY_CONSISTENCY_THRESHOLD = 0.5;   // 一致性分数阈值
export const FAKE_IDENTITY_VIOLATION_NO_CHECKS = 0.3;     // 无查验结果扣分
export const FAKE_IDENTITY_VIOLATION_NO_SUSPECTS = 0.2;   // 无怀疑扣分
export const FAKE_IDENTITY_VIOLATION_LATE_CLAIM = 0.2;    // 晚跳扣分
export const FAKE_IDENTITY_LATE_CLAIM_ROUND = 3;           // 晚跳判定回合阈值
export const FAKE_IDENTITY_PERCENTAGE_MULTIPLIER = 100;    // 百分比乘数
