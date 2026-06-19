// ---------- 策略分数常量 ----------

// 通用
export const SCORE_PROPHET_VOTE_DUTY = 200;           // 预言家查验到狼人后，号召投票的义务分数
export const SCORE_WEREWOLF_VOTE_DUTY = 80;           // 狼人跟票投票的基础分数
export const SCORE_MAX_INFO_VOTE = 100;               // 基于最大信息量投票的分数
export const SCORE_FOLLOW_CALL_VOTE = 40;             // 跟随他人号召投票的分数
export const SCORE_SOCIAL_TIE_BREAKER = 20;           // 社交关系作为投票平局决胜的分数
export const SCORE_SURVIVAL_VOTE = 70;                // 为生存而投票的分数
export const SCORE_WEREWOLF_KILL_GOD_BONUS = 30;      // 狼人击杀疑似神职的额外奖励
export const SCORE_WEREWOLF_KILL_HIGH_INSIGHT = 15;   // 狼人击杀高洞察玩家的额外奖励
export const SCORE_WEREWOLF_KILL_BASE = 50;           // 狼人夜间杀戮的基础分数
export const SCORE_PROPHET_CHECK_BASE = 50;           // 预言家夜间查验的基础分数
export const SCORE_THIEF_STEAL_BASE = 40;             // 窃贼偷窃的基础分数
export const SCORE_CORONER_INSPECT_BASE = 50;         // 验尸官验尸的基础分数
export const SCORE_BERSERKER_SUICIDE = 90;            // 狂狼同归于尽的基础分数
export const SCORE_EMPTY_KILL = 15;                   // 狼人空刀（不杀人）的分数

// 白天行动
export const SCORE_PROPHET_CLAIM = 1000;              // 预言家公布身份的分数（最高优先级）
export const SCORE_PROPHET_CALL_VOTE = 950;           // 预言家号召投票放逐狼人的分数
export const SCORE_DEFEND_ATTACKED = 100;             // 被攻击时辩护的分数
export const SCORE_DEFEND_ATTACKED_BONUS = 30;        // 被攻击时辩护的额外奖励
export const SCORE_SELF_GUARANTEE = 70;               // 担保自己清白的分数
export const SCORE_HIGH_SUSPECT_ACCUSE = 130;         // 对高嫌疑玩家强烈指认的分数
export const SCORE_HIGH_SUSPECT_SUSPECT = 100;        // 对高嫌疑玩家怀疑的分数
export const SCORE_HIGH_SUSPECT_CALL_VOTE = 110;      // 对高嫌疑玩家号召投票的分数
export const SCORE_BEHAVIOR_OBSERVE = 75;             // 观察其他玩家行为的分数
export const SCORE_FOLLOW_TRUSTED = 85;               // 跟随信任玩家行动的分数
export const SCORE_BREAK_SILENCE = 95;                // 打破沉默的分数
export const SCORE_DEFAULT_ROUND1_OBSERVE = 50;       // 第一轮默认观察分数
export const SCORE_DEFAULT_OTHER_OBSERVE = 50;        // 其他轮次默认观察分数

// 狼人白天行动
export const SCORE_WW_DEFEND_ATTACKED_ACCUSE = 130;  // 狼人被攻击时，选择强烈指认攻击者的分数
export const SCORE_WW_DEFEND_ATTACKED_SUSPECT = 100; // 狼人被攻击时，选择怀疑攻击者的分数
export const SCORE_WW_CAMOUFLAGE_BASE = 70;          // 狼人伪装成村民的基础分数（如观察）
export const SCORE_WW_CAMOUFLAGE_BONUS = 10;         // 狼人伪装时的额外奖励分数
export const SCORE_WW_TEAMMATE_EXPOSED_GOUGE = 90;   // 狼队友暴露时，落井下石（撇清关系）的分数
export const SCORE_WW_TEAMMATE_EXPOSED_DEFEND = 60;  // 狼队友暴露时，冒险辩护的分数
export const SCORE_WW_BREAK_SILENCE = 90;            // 狼人打破沉默的分数
export const SCORE_WW_DEFAULT_ROUND1_TARGET = 55;    // 第一轮白天有明确目标时的默认分数
export const SCORE_WW_DEFAULT_ROUND1 = 50;           // 第一轮白天无明确目标时的默认分数
export const SCORE_WW_DEFAULT_OTHER = 50;            // 其他轮次白天的默认分数

// 追加行动
export const SCORE_JOIN_SUSPECT_BASE = 80;            // 一同怀疑的基础分数
export const SCORE_JOIN_SUSPECT_WOLF_BONUS = 30;      // 狼人一同怀疑的额外奖励
export const SCORE_JOIN_DEFEND_BASE = 10;             // 一同袒护的基础分数（较低，因为袒护有风险）
export const SCORE_JOIN_DEFEND_WOLF_BONUS = 40;       // 狼人一同袒护队友的额外奖励
export const SCORE_REBUT_WEREWOLF = 70;               // 狼人反驳的分数
export const SCORE_REBUT_VILLAGER = 90;               // 村民反驳的分数（村民反驳更有说服力）
