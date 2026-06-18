// ============================
// Core Game Constants
// ============================

// ---------- Attribute System ----------
export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 10;
export const ATTRIBUTE_DEFAULT = 5;
export const ATTRIBUTE_RANDOM_BASE = 3;
export const ATTRIBUTE_RANDOM_RANGE = 5; // 3 + 0..4 = 3..7

// ---------- Stress System ----------
export const STRESS_MIN = -10;
export const STRESS_MAX = 10;
export const STRESS_OVERLOAD = 10;
export const STRESS_RECOVERY_BASE = 1;
export const STRESS_RECOVERY_BONUS = 1; // extra on coin flip

export const STRESS_MODIFIER_MULTIPLIER = 0.5; // stress * 0.5 for deception/stealth penalty

// ---------- Relation System ----------
export const RELATION_MIN = -10;
export const RELATION_MAX = 10;
export const RELATION_NATURAL_RECOVERY = 0.5;

// ---------- Item System ----------
export const MAX_ITEM_SLOTS = 3;

// ---------- Dice & Check System ----------
export const DICE_SIDES = 20;
export const CRITICAL_SUCCESS_MARGIN = 10;
export const CRITICAL_FAIL_MARGIN = -10;

// ---------- Alignment Modifiers ----------
export const ALIGNMENT_LAWFUL_LEADERSHIP_BONUS = 1;
export const ALIGNMENT_LAWFUL_DECEPTION_PENALTY = -2;
export const ALIGNMENT_CHAOTIC_DECEPTION_BONUS = 2;
export const ALIGNMENT_EVIL_DECEPTION_BONUS = 1;
export const ALIGNMENT_GOOD_AFFINITY_BONUS = 1;

// ---------- Check Difficulties ----------
export const CHECK_DIFFICULTY_EASY = 10;
export const CHECK_DIFFICULTY_MEDIUM = 12;
export const CHECK_DIFFICULTY_HARD = 15;
export const CHECK_DIFFICULTY_VERY_HARD = 18;

// ---------- AI Decision Weights ----------
export const STAGE_WEIGHT_DUTY = 1000;
export const STAGE_WEIGHT_SURVIVAL = 800;
export const STAGE_WEIGHT_INFORMATION = 500;
export const STAGE_WEIGHT_SOCIAL = 100;

// ---------- Strategy Scores ----------
export const SCORE_PROPHET_VOTE_DUTY = 200;
export const SCORE_WEREWOLF_VOTE_DUTY = 80;
export const SCORE_MAX_INFO_VOTE = 100;
export const SCORE_FOLLOW_CALL_VOTE = 40;
export const SCORE_SOCIAL_TIE_BREAKER = 20;
export const SCORE_SURVIVAL_VOTE = 70;
export const SCORE_WEREWOLF_KILL_GOD_BONUS = 30;
export const SCORE_WEREWOLF_KILL_BASE = 50;
export const SCORE_PROPHET_CHECK_BASE = 50;
export const SCORE_THIEF_STEAL_BASE = 40;
export const SCORE_CORONER_INSPECT_BASE = 50;
export const SCORE_BERSERKER_SUICIDE = 90;
export const SCORE_SPEAK_BREAK_SILENCE = 90;
export const SCORE_SPEAK_DEFAULT = 20;
export const SCORE_EMPTY_KILL = 15;

// ---------- Thresholds ----------
export const WEREWOLF_PROBABILITY_HIGH = 0.6;
export const WEREWOLF_PROBABILITY_LOW = 0.4;
export const WEREWOLF_PROBABILITY_MEDIUM = 0.5;
export const EXPOSURE_HIGH_THRESHOLD = 0.6;
export const EXPOSURE_CRITICAL_THRESHOLD = 0.7;
export const SILENCE_NEAR_FULL_THRESHOLD = 2; // aliveCount - 2

// ---------- Game Balance: Stress Changes ----------
export const STRESS_CHANGE_MINOR_POS = 1; // +1
export const STRESS_CHANGE_MINOR_POS_RANDOM = 2; // +1 + random(0..1)
export const STRESS_CHANGE_MINOR_NEG = -1; // -1
export const STRESS_CHANGE_MINOR_NEG_RANDOM = -2; // -1 - random(0..1)
export const STRESS_CHANGE_MODERATE_POS = 2; // +2
export const STRESS_CHANGE_MODERATE_POS_RANDOM = 3; // +2 + random(0..2)
export const STRESS_CHANGE_MAJOR_POS = 3; // +3
export const STRESS_CHANGE_MAJOR_POS_RANDOM = 4; // +3 + random(0..3)

// ---------- Game Balance: Relation Changes ----------
export const REL_CHANGE_MINOR_NEG = -1;
export const REL_CHANGE_MINOR_POS = 1;
export const REL_CHANGE_MODERATE_NEG = -2;
export const REL_CHANGE_MODERATE_POS = 2;
export const REL_CHANGE_MAJOR_NEG = -3;
export const REL_CHANGE_MAJOR_POS = 3;

// ---------- Default Fallback Values ----------
export const DEFAULT_ATTRIBUTE_FALLBACK = ATTRIBUTE_DEFAULT;
export const DEFAULT_STRESS_FALLBACK = 0;
export const DEFAULT_ALIGNMENT_FALLBACK: { law: 'neutral_law'; good: 'neutral_good' } = { law: 'neutral_law', good: 'neutral_good' };

// ---------- Check Difficulties (Action-Specific) ----------
export const CHECK_DIFFICULTY_DEFEND = CHECK_DIFFICULTY_EASY;
export const CHECK_DIFFICULTY_JOIN_SUSPECT = CHECK_DIFFICULTY_EASY;
export const CHECK_DIFFICULTY_JOIN_DEFEND = CHECK_DIFFICULTY_EASY;
export const CHECK_DIFFICULTY_CALL_VOTE = CHECK_DIFFICULTY_MEDIUM;
export const CHECK_DIFFICULTY_BLOCK_VOTE = CHECK_DIFFICULTY_MEDIUM;
export const CHECK_DIFFICULTY_GUARANTEE = CHECK_DIFFICULTY_MEDIUM;
export const CHECK_DIFFICULTY_EXCLUDE_ALL = CHECK_DIFFICULTY_HARD;

// ---------- Strategy Scores (Day) ----------
export const SCORE_PROPHET_CLAIM = 1000;
export const SCORE_PROPHET_CALL_VOTE = 950;
export const SCORE_DEFEND_ATTACKED = 100;
export const SCORE_DEFEND_ATTACKED_BONUS = 30;
export const SCORE_SELF_GUARANTEE = 70;
export const SCORE_HIGH_SUSPECT_ACCUSE = 130;
export const SCORE_HIGH_SUSPECT_SUSPECT = 100;
export const SCORE_HIGH_SUSPECT_CALL_VOTE = 110;
export const SCORE_BEHAVIOR_OBSERVE = 75;
export const SCORE_FOLLOW_TRUSTED = 85;
export const SCORE_BREAK_SILENCE = 95;
export const SCORE_DEFAULT_ROUND1_OBSERVE = 50;
export const SCORE_DEFAULT_ROUND1_SPEAK = 40;
export const SCORE_DEFAULT_OTHER_OBSERVE = 50;
export const SCORE_DEFAULT_OTHER_SPEAK = 40;

// ---------- Strategy Scores (Werewolf Day) ----------
export const SCORE_WW_DEFEND_ATTACKED_ACCUSE = 130;
export const SCORE_WW_DEFEND_ATTACKED_SUSPECT = 100;
export const SCORE_WW_CAMOUFLAGE_BASE = 70;
export const SCORE_WW_CAMOUFLAGE_BONUS = 10;
export const SCORE_WW_TEAMMATE_EXPOSED_GOUGE = 90;
export const SCORE_WW_TEAMMATE_EXPOSED_DEFEND = 60;
export const SCORE_WW_BREAK_SILENCE = 90;
export const SCORE_WW_DEFAULT_ROUND1_TARGET = 55;
export const SCORE_WW_DEFAULT_ROUND1 = 50;
export const SCORE_WW_DEFAULT_OTHER = 50;

// ---------- Strategy Scores (Appendix) ----------
export const SCORE_JOIN_SUSPECT_BASE = 80;
export const SCORE_JOIN_SUSPECT_WOLF_BONUS = 30;
export const SCORE_JOIN_DEFEND_BASE = 10;
export const SCORE_JOIN_DEFEND_WOLF_BONUS = 40;
export const SCORE_REBUT_WEREWOLF = 70;
export const SCORE_REBUT_VILLAGER = 90;

// ---------- Empty-kill Chance ----------
export const EMPTY_KILL_CHANCE = 0.1;

