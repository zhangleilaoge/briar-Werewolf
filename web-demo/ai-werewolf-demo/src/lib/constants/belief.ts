// ---------- 信念系统常量 ----------

// 概率调整系数
export const BELIEF_DEATH_DECAY = 0.6;                 // 死亡时狼人概率衰减系数
export const BELIEF_SUSPECT_MAX_ADJ = 0.2;             // 怀疑行动最大调整值
export const BELIEF_SUSPECT_RATE = 0.06;               // 怀疑行动调整速率
export const BELIEF_ACCUSE_MAX_ADJ = 0.25;             // 指控行动最大调整值
export const BELIEF_ACCUSE_RATE = 0.08;                // 指控行动调整速率
export const BELIEF_DEFEND_MAX_ADJ = 0.15;             // 辩护行动最大调整值
export const BELIEF_DEFEND_RATE = 0.05;                // 辩护行动调整速率
export const BELIEF_CLAIM_IDENTITY_ADJ = 0.1;          // 公布身份调整值
export const BELIEF_REVEAL_INFO_ADJ = 0.2;             // 公开信息调整值
export const BELIEF_CALL_VOTE_ADJ = 0.1;               // 号召投票调整值
export const BELIEF_THANK_ADJ = 0.05;                  // 号召投票无依据时的狼人概率调整值
export const BELIEF_JOIN_SUSPECT_RATE = 0.03;          // 一同怀疑调整速率
export const BELIEF_NATURAL_DECAY = 0.02;              // 自然衰减速率
export const BELIEF_FALSE_CLAIM_ADJ = 0.3;             // 虚假声明调整值

// 信任分数变化
export const TRUST_CHANGE_SUSPECT = -2;                // 怀疑时信任变化
export const TRUST_CHANGE_DEFEND = 1;                  // 辩护时信任变化
export const TRUST_CHANGE_ACCUSE = -3;                 // 指控时信任变化
export const TRUST_CHANGE_GUARANTEE = 2;               // 担保时信任变化
export const TRUST_CHANGE_FALSE_CLAIM = -4;            // 虚假声明时信任变化
export const TRUST_SCORE_MIN = -10;                    // 信任分数最小值
export const TRUST_SCORE_MAX = 10;                     // 信任分数最大值

// 意图系统
export const INTENTION_STRENGTH_BASE = 500;            // 意图强度基础值
export const INTENTION_STRENGTH_PROB_FACTOR = 300;     // 意图强度概率因子

// 意图系统：寿命常量
export const INTENTION_LIFETIME_ROLE_DUTY = -1;        // 永久（角色义务）
export const INTENTION_LIFETIME_DEFAULT = 3;            // 默认 3 回合

// 意图系统：模式攻击基础强度
export const INTENTION_MODE_ATTACK_DESPERATE = 800;    // 绝境模式攻击强度
export const INTENTION_MODE_ATTACK_DOMINANT = 600;     // 优势模式攻击强度
export const INTENTION_MODE_ATTACK_NORMAL = 300;       // 正常模式攻击强度

// 意图系统：模式隐藏强度
export const INTENTION_MODE_CONCEAL_DESPERATE = 700;   // 绝境模式隐藏强度
export const INTENTION_MODE_CONCEAL_NORMAL = 650;      // 正常模式隐藏强度
export const INTENTION_MODE_CONCEAL_OTHER = 400;       // 其他模式隐藏强度

// 概率默认值和阈值
export const BELIEF_DEFAULT_PROBABILITY = 0.5;         // 默认概率值（无信息时）
export const BELIEF_LOW_SUSPICION_THRESHOLD = 0.4;     // 低嫌疑阈值
export const BELIEF_HIGH_SUSPICION_THRESHOLD = 0.5;    // 高嫌疑阈值
export const BELIEF_SUSPICION_BASE = 0.5;              // 基础嫌疑值
export const BELIEF_SUSPICION_VOTE_ADJ = 0.2;          // 投票嫌疑调整
export const BELIEF_SUSPICION_ACCUSE_ADJ = 0.3;        // 指控嫌疑调整
export const BELIEF_SUSPICION_DEFEND_ADJ = -0.2;       // 辩护嫌疑调整（降低）
export const BELIEF_TRUST_ATTACKED = 0.2;              // 被攻击时的信任度
export const BELIEF_TRUST_DEFAULT = 0.6;               // 默认信任度
export const BELIEF_EXPOSURE_KNOWN = 0.7;              // 已知暴露度
export const BELIEF_EXPOSURE_UNKNOWN = 0.1;            // 未知暴露度
