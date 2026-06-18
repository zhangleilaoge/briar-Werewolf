// ============================
// AI Werewolf Demo — Types, Constants & Utilities
// Single source of truth for all game data definitions
// ============================

// =====================================================================
// SECTION 1: Type Definitions
// =====================================================================

// ---------- Attributes (六维属性) ----------
export interface Attributes {
  affinity: number;    // 亲和: 说服、建立信任、降低压力
  logic: number;       // 逻辑: 推理、识破谎言、构建证据链
  leadership: number;  // 领导: 主导议程、影响跟票
  deception: number;   // 诡诈: 撒谎、伪装、误导、陷害
  stealth: number;     // 隐蔽: 隐藏立场、降低被怀疑概率
  insight: number;     // 洞察: 感知情绪动机、看穿伪装
}

export type AttributeKey = keyof Attributes;

export const DEFAULT_ATTRIBUTES: Attributes = {
  affinity: 5, logic: 5, leadership: 5,
  deception: 5, stealth: 5, insight: 5,
};

// ---------- Alignment (阵营九宫格) ----------
export type LawAxis = 'lawful' | 'neutral_law' | 'chaotic';
export type GoodAxis = 'good' | 'neutral_good' | 'evil';

export interface Alignment { law: LawAxis; good: GoodAxis }

// ---------- Relations (关系) ----------
export interface Relation { trust: number; friendly: number }
export interface RelationDelta { trustDelta: number; friendlyDelta: number }

// ---------- Items (道具) ----------
export type ItemType = 'action_prerequisite' | 'check_bonus' | 'consumable' | 'passive';

export interface ItemDefinition {
  id: string; name: string; type: ItemType; maxDurability: number;
  werewolfEffect: string; villagerEffect: string; description: string;
}

export interface ItemInstance { definitionId: string; durability: number }

// ---------- Roles (职业) ----------
export type Role = 'werewolf' | 'lone_wolf' | 'berserker' | 'villager' | 'prophet' | 'thief' | 'coroner';
export type Team = 'werewolf' | 'villager';

export interface RoleInfo {
  role: Role; label: string; team: Team; description: string; defaultItems: string[];
}

// ---------- Traits (特质) ----------
export interface Trait { id: string; name: string; description: string }

// ---------- Phases (阶段) ----------
export type Phase = 'night' | 'morning' | 'day' | 'vote' | 'init' | 'ended' | 'event';
export type DaySubPhase = 'action' | 'appendix' | 'vote';

// ---------- Actions (行动) ----------
export type DayActionType =
  | 'silence' | 'speak' | 'claim_identity' | 'reveal_info' | 'observe'
  | 'suspect' | 'defend' | 'thank' | 'call_vote' | 'block_vote'
  | 'guarantee' | 'accuse' | 'exclude_all' | 'berserker_kill';

export type AppendixActionType = 'join_suspect' | 'rebut' | 'join_defend';

export type NightActionType = 'kill' | 'check' | 'steal' | 'inspect';

export type ActionType = DayActionType | AppendixActionType | NightActionType | 'vote';

// ---------- Check / Roll (检定) ----------
export interface CheckResult {
  roll: number; modifier: number; total: number; difficulty: number;
  success: boolean; criticalSuccess: boolean; criticalFail: boolean; margin: number;
}

// ---------- Player (玩家) ----------
export interface Player {
  id: string; name: string; role: Role; team: Team; alive: boolean;
  items: ItemInstance[]; attributes: Attributes; alignment: Alignment;
  traits: string[]; stress: number; relations: Record<string, Relation>;
}

// ---------- Game Log ----------
export interface GameLogItem {
  round: number; phase: Phase; message: string;
  type: 'phase' | 'action' | 'death' | 'victory' | 'info' | 'check' | 'relation' | 'stress' | 'item' | 'thinking';
  details?: Record<string, unknown>;
}

// ---------- Config & Victory ----------
export interface GameConfig { totalPlayers: number; werewolfRoles: { role: Role; count: number }[]; villagerRoles: { role: Role; count: number }[] }
export type Winner = 'villager' | 'werewolf' | null;
export interface VoteResult { round: number; votes: Record<string, string[]>; maxVotes: number; topTargets: string[]; eliminatedId: string | null; tie: boolean; nextRound: boolean }
export interface SetupConfig { totalPlayers: number; werewolfConfig: { role: string; count: number }[]; villagerConfig: { role: string; count: number }[] }

// ---------- Decision Types (AI Decision System) ----------
export interface DecisionCandidate {
  action: string; target: string | null; score: number; confidence: number; reason: string;
  details?: Record<string, unknown>; stageWeight?: number; stage?: string;
  strategy?: string; rule?: string; trigger?: string; random?: boolean;
}

export interface DecisionProcess {
  candidates: {
    action: string; target: string | null; reason: string; score: number;
    stageWeight: number; totalScore: number; stage: string; strategy: string;
    rule: string; trigger: string; random: boolean;
    modifiers: { alignment: number; stress: number; relation: number; total: number };
  }[];
  winner: string;
  shortlist: string;
}

export interface DecisionResult {
  action: string; target: string | null; reason: string; stage: string;
  confidence: number; emotionalTone: string;
  details?: Record<string, unknown>; process?: DecisionProcess;
}

// ---------- Public Claim & Log ----------
export interface PublicClaim { playerId: string; claim: string; content: Record<string, unknown>; round: number }
export interface LogEntry { round: number; phase: Phase; message: string; timestamp: number }

// ---------- Check Log ----------
export interface ModifierBreakdown { baseAttribute: number; alignmentMod: number; stressMod: number; total: number }

export interface CheckLog {
  type: 'check' | 'opposed'; actorName: string; actorAttribute: string;
  actorBaseValue: number; actorAlignmentMod: number; actorStressMod: number;
  actorTotalModifier: number; actorRoll: number; actorTotal: number;
  targetName?: string; targetAttribute?: string; targetBaseValue?: number;
  targetAlignmentMod?: number; targetStressMod?: number; targetTotalModifier?: number;
  targetRoll?: number; targetTotal?: number; difficulty?: number;
  margin: number; success: boolean; successLevel: string;
}

export interface ActionLogDetail {
  decisionReason: string; checks: CheckLog[]; actorId: string; action: string;
  targetId?: string | null; process?: DecisionProcess;
  [key: string]: unknown;
}

// =====================================================================
// SECTION 2: Data Definitions
// =====================================================================

export const ALIGNMENT_NAMES: Record<string, string> = {
  'lawful-good': '守序善良', 'lawful-neutral_good': '守序中立', 'lawful-evil': '守序邪恶',
  'neutral_law-good': '中立善良', 'neutral_law-neutral_good': '绝对中立', 'neutral_law-evil': '中立邪恶',
  'chaotic-good': '混乱善良', 'chaotic-neutral_good': '混乱中立', 'chaotic-evil': '混乱邪恶',
};

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  claws: { id: 'claws', name: '尖牙利爪', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '拥有时可在夜晚执行一对一杀戮', villagerEffect: '被攻击时可选择与攻击者同归于尽', description: '狼人的天然武器' },
  crystal_ball: { id: 'crystal_ball', name: '水晶球', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '持有时可执行夜间查验；若查验到狼人，水晶球碎裂损坏', villagerEffect: '持有时可执行夜间查验；若查验到狼人，水晶球碎裂损坏', description: '查验身份的神秘道具' },
  thief_gloves: { id: 'thief_gloves', name: '小偷手套', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '持有时可执行一次偷取；使用后损坏', villagerEffect: '持有时可执行一次偷取；使用后损坏', description: '偷取他人道具的手套' },
  coroner_tools: { id: 'coroner_tools', name: '验尸工具', type: 'consumable', maxDurability: 1, werewolfEffect: '持有时可执行一次尸检，查看一名死亡角色的所有道具；使用后损坏', villagerEffect: '持有时可执行一次尸检，查看一名死亡角色的所有道具；使用后损坏', description: '检验尸体的工具' },
  amulet: { id: 'amulet', name: '护身符', type: 'consumable', maxDurability: 1, werewolfEffect: '抵挡一次夜晚杀戮，使用后损坏', villagerEffect: '抵挡一次夜晚杀戮，使用后损坏', description: '可抵挡一次致命攻击' },
  double_sword: { id: 'double_sword', name: '双刃剑', type: 'consumable', maxDurability: 1, werewolfEffect: '狂狼持有时可与一名玩家同归于尽，并触发平安夜；使用后消耗', villagerEffect: '无效果', description: '狂狼的毁灭性武器' },
};

export const ROLE_INFO: Record<Role, RoleInfo> = {
  werewolf: { role: 'werewolf', label: '普通狼人', team: 'werewolf', description: '参与夜晚讨论，可执行杀戮', defaultItems: ['claws'] },
  lone_wolf: { role: 'lone_wolf', label: '孤狼', team: 'werewolf', description: '独立选择杀戮目标，不与其他狼人沟通', defaultItems: ['claws'] },
  berserker: { role: 'berserker', label: '狂狼', team: 'werewolf', description: '白天可同归于尽，触发平安夜', defaultItems: ['claws', 'double_sword'] },
  villager: { role: 'villager', label: '普通村民', team: 'villager', description: '无特殊能力，通过投票放逐狼人', defaultItems: [] },
  prophet: { role: 'prophet', label: '预言家', team: 'villager', description: '每晚查验一名玩家身份', defaultItems: ['crystal_ball'] },
  thief: { role: 'thief', label: '窃贼', team: 'villager', description: '整场游戏限一次偷取一名玩家的道具', defaultItems: ['thief_gloves'] },
  coroner: { role: 'coroner', label: '验尸官', team: 'villager', description: '整场游戏限一次查看死亡角色的道具', defaultItems: ['coroner_tools'] },
};

export const TRAITS: Record<string, Trait> = {
  lone_wolf_trait: { id: 'lone_wolf_trait', name: '孤狼', description: '狼人阵营角色拥有此特质时，夜间不能与其他狼人沟通，杀戮阶段独立选择目标；若目标与普通狼人相同，本次杀戮无效。' },
};

// =====================================================================
// SECTION 3: Game Constants
// =====================================================================

// ---------- Attribute System ----------
export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 10;
export const ATTRIBUTE_DEFAULT = 5;
export const ATTRIBUTE_RANDOM_BASE = 3;
export const ATTRIBUTE_RANDOM_RANGE = 5;

// ---------- Stress System ----------
export const STRESS_MIN = -10;
export const STRESS_MAX = 10;
export const STRESS_OVERLOAD = 10;
export const STRESS_RECOVERY_BASE = 1;
export const STRESS_RECOVERY_BONUS = 1;
export const STRESS_MODIFIER_MULTIPLIER = 0.5;

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
export const CHECK_DIFFICULTY_DEFEND = CHECK_DIFFICULTY_EASY;
export const CHECK_DIFFICULTY_JOIN_SUSPECT = CHECK_DIFFICULTY_EASY;
export const CHECK_DIFFICULTY_JOIN_DEFEND = CHECK_DIFFICULTY_EASY;
export const CHECK_DIFFICULTY_CALL_VOTE = CHECK_DIFFICULTY_MEDIUM;
export const CHECK_DIFFICULTY_BLOCK_VOTE = CHECK_DIFFICULTY_MEDIUM;
export const CHECK_DIFFICULTY_GUARANTEE = CHECK_DIFFICULTY_MEDIUM;
export const CHECK_DIFFICULTY_EXCLUDE_ALL = CHECK_DIFFICULTY_HARD;

// ---------- AI Decision Weights ----------
export const STAGE_WEIGHT_DUTY = 1000;
export const STAGE_WEIGHT_SURVIVAL = 800;
export const STAGE_WEIGHT_INFORMATION = 500;
export const STAGE_WEIGHT_SOCIAL = 100;

// ---------- Strategy Scores (General) ----------
export const SCORE_PROPHET_VOTE_DUTY = 200;
export const SCORE_WEREWOLF_VOTE_DUTY = 80;
export const SCORE_MAX_INFO_VOTE = 100;
export const SCORE_FOLLOW_CALL_VOTE = 40;
export const SCORE_SOCIAL_TIE_BREAKER = 20;
export const SCORE_SURVIVAL_VOTE = 70;
export const SCORE_WEREWOLF_KILL_GOD_BONUS = 30;
export const SCORE_WEREWOLF_KILL_HIGH_INSIGHT = 15;
export const SCORE_WEREWOLF_KILL_BASE = 50;
export const SCORE_PROPHET_CHECK_BASE = 50;
export const SCORE_THIEF_STEAL_BASE = 40;
export const SCORE_CORONER_INSPECT_BASE = 50;
export const SCORE_BERSERKER_SUICIDE = 90;
export const SCORE_SPEAK_BREAK_SILENCE = 80;
export const SCORE_SPEAK_DEFAULT = 50;
export const SCORE_EMPTY_KILL = 15;
export const SCORE_SPEAK_BASE = 50;  // equal to observe for balance

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

// ---------- Thresholds ----------
export const WEREWOLF_PROBABILITY_HIGH = 0.6;
export const WEREWOLF_PROBABILITY_LOW = 0.4;
export const WEREWOLF_PROBABILITY_MEDIUM = 0.5;
export const EXPOSURE_HIGH_THRESHOLD = 0.6;
export const EXPOSURE_CRITICAL_THRESHOLD = 0.7;
export const SILENCE_NEAR_FULL_THRESHOLD = 2;

// ---------- Game Balance: Stress Changes ----------
export const STRESS_CHANGE_MINOR_POS = 1;
export const STRESS_CHANGE_MINOR_POS_RANDOM = 2;
export const STRESS_CHANGE_MINOR_NEG = -1;
export const STRESS_CHANGE_MINOR_NEG_RANDOM = -2;
export const STRESS_CHANGE_MODERATE_POS = 2;
export const STRESS_CHANGE_MODERATE_POS_RANDOM = 3;
export const STRESS_CHANGE_MAJOR_POS = 3;
export const STRESS_CHANGE_MAJOR_POS_RANDOM = 4;

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

// ---------- Empty-kill Chance ----------
export const EMPTY_KILL_CHANCE = 0.1;

// =====================================================================
// SECTION 4: Utility Functions
// =====================================================================

// ---------- Dice / Check ----------

/** 2d10 bell curve: range 2-20, average 11, less extreme variance than d20 */
export function rollD20(): number {
  return Math.floor(Math.random() * 10) + 1 + Math.floor(Math.random() * 10) + 1;
}

export function performCheck(modifier: number, difficulty: number): CheckResult {
  const roll = rollD20();
  const total = roll + modifier;
  const margin = total - difficulty;
  return {
    roll, modifier, total, difficulty,
    success: total >= difficulty,
    criticalSuccess: total >= difficulty + 10,
    criticalFail: total <= difficulty - 10,
    margin,
  };
}

export function performOpposedCheck(
  actorModifier: number, targetModifier: number
): { actorRoll: number; targetRoll: number; actorTotal: number; targetTotal: number; success: boolean; margin: number } {
  const actorRoll = rollD20();
  const targetRoll = rollD20();
  const actorTotal = actorRoll + actorModifier;
  const targetTotal = targetRoll + targetModifier;
  return { actorRoll, targetRoll, actorTotal, targetTotal, success: actorTotal > targetTotal, margin: actorTotal - targetTotal };
}

// ---------- Clamps ----------

export function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
export function clampStress(value: number): number { return clamp(value, -10, 10); }
export function clampRelation(value: number): number { return clamp(value, -10, 10); }

// ---------- Alignment ----------

export function getAlignmentName(alignment: Alignment): string {
  return ALIGNMENT_NAMES[`${alignment.law}-${alignment.good}`] || '未知';
}

// ---------- Item helpers ----------

export function hasItem(player: Player, itemId: string): boolean {
  return player.items.some((i) => i.definitionId === itemId && i.durability > 0);
}

export function getItem(player: Player, itemId: string): ItemInstance | undefined {
  return player.items.find((i) => i.definitionId === itemId && i.durability > 0);
}

export function removeItem(player: Player, itemId: string): boolean {
  const idx = player.items.findIndex((i) => i.definitionId === itemId);
  if (idx >= 0) { player.items.splice(idx, 1); return true; }
  return false;
}

export function addItem(player: Player, itemId: string): boolean {
  if (player.items.length >= MAX_ITEM_SLOTS) return false;
  const def = ITEM_DEFINITIONS[itemId];
  if (!def) return false;
  player.items.push({ definitionId: itemId, durability: def.maxDurability });
  return true;
}

export function damageItem(player: Player, itemId: string): boolean {
  const item = player.items.find((i) => i.definitionId === itemId);
  if (!item) return false;
  item.durability--;
  if (item.durability <= 0) removeItem(player, itemId);
  return true;
}

export function canUseItem(player: Player, itemId: string): boolean { return hasItem(player, itemId); }

// ---------- Random generation ----------

export function generateRandomAttributes(): Attributes {
  return {
    affinity: 3 + Math.floor(Math.random() * 5), logic: 3 + Math.floor(Math.random() * 5),
    leadership: 3 + Math.floor(Math.random() * 5), deception: 3 + Math.floor(Math.random() * 5),
    stealth: 3 + Math.floor(Math.random() * 5), insight: 3 + Math.floor(Math.random() * 5),
  };
}

export function generateRandomAlignment(): Alignment {
  const laws: LawAxis[] = ['lawful', 'neutral_law', 'chaotic'];
  const goods: GoodAxis[] = ['good', 'neutral_good', 'evil'];
  return { law: laws[Math.floor(Math.random() * laws.length)], good: goods[Math.floor(Math.random() * goods.length)] };
}

// ---------- Alignment & Stress Check Modifiers ----------

export function getStressModifier(stress: number, attribute: 'deception' | 'stealth' | 'other'): number {
  if ((attribute === 'deception' || attribute === 'stealth') && stress > 0) return -Math.floor(stress * 0.5);
  return 0;
}

export function getAlignmentModifier(
  alignment: Alignment, actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other', isGoodAction = false
): number {
  switch (actionType) {
    case 'leadership': return alignment.law === 'lawful' ? 1 : 0;
    case 'deception': case 'stealth':
      if (alignment.law === 'lawful') return -2;
      if (alignment.law === 'chaotic') return 2;
      if (alignment.good === 'evil') return 1;
      return 0;
    case 'affinity': return (alignment.good === 'good' && isGoodAction) ? 1 : 0;
    default: return 0;
  }
}

export const ATTRIBUTE_NAMES: Record<keyof Attributes, string> = {
  affinity: '亲和', logic: '逻辑', leadership: '领导',
  deception: '诡诈', stealth: '隐蔽', insight: '洞察',
};

// ---------- Modifier Calculation ----------

export function calculateModifierBreakdown(
  baseAttribute: number, alignment: Alignment, stress: number,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other', isGoodAction = false
): ModifierBreakdown {
  const alignmentMod = getAlignmentModifier(alignment, actionType, isGoodAction);
  const stressMod = getStressModifier(stress, actionType === 'deception' || actionType === 'stealth' ? actionType : 'other');
  return { baseAttribute, alignmentMod, stressMod, total: baseAttribute + alignmentMod + stressMod };
}

export function calculateFinalModifier(
  baseAttribute: number, alignment: Alignment, stress: number,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other', isGoodAction = false
): number {
  return calculateModifierBreakdown(baseAttribute, alignment, stress, actionType, isGoodAction).total;
}
