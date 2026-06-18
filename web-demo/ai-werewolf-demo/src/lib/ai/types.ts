// ============================
// AI Werewolf Demo - Complete Game Types
// Based on design docs in /doc
// ============================

// ---------- Attributes (六维属性) ----------
export interface Attributes {
  affinity: number;    // 亲和: 说服、建立信任、降低压力
  logic: number;       // 逻辑: 推理、识破谎言、构建证据链
  leadership: number;  // 领导: 主导议程、影响跟票
  deception: number;   // 诡诈: 撒谎、伪装、误导、陷害
  stealth: number;     // 隐蔽: 隐藏立场、降低被怀疑概率
  insight: number;     // 洞察: 感知情绪动机、看穿伪装
  [key: string]: number;
}

export type AttributeKey = keyof Attributes;

export const DEFAULT_ATTRIBUTES: Attributes = {
  affinity: 5,
  logic: 5,
  leadership: 5,
  deception: 5,
  stealth: 5,
  insight: 5,
};

// ---------- Alignment (阵营九宫格) ----------
export type LawAxis = 'lawful' | 'neutral_law' | 'chaotic';
export type GoodAxis = 'good' | 'neutral_good' | 'evil';

export interface Alignment {
  law: LawAxis;
  good: GoodAxis;
}

export const ALIGNMENT_NAMES: Record<string, string> = {
  'lawful-good': '守序善良',
  'lawful-neutral_good': '守序中立',
  'lawful-evil': '守序邪恶',
  'neutral_law-good': '中立善良',
  'neutral_law-neutral_good': '绝对中立',
  'neutral_law-evil': '中立邪恶',
  'chaotic-good': '混乱善良',
  'chaotic-neutral_good': '混乱中立',
  'chaotic-evil': '混乱邪恶',
};

// ---------- Relations (关系) ----------
export interface Relation {
  trust: number;      // -10 ~ +10, 理性判断对方可靠性
  friendly: number;   // -10 ~ +10, 情感倾向
}

export interface RelationDelta {
  trustDelta: number;
  friendlyDelta: number;
}

// ---------- Stress (压力值) ----------
// Range: -10 ~ +10, 0 is baseline
// +10 = overload, triggers overload reaction

export interface StressState {
  value: number;
  overload: boolean;
}

// ---------- Items (道具) ----------
export type ItemType = 'action_prerequisite' | 'check_bonus' | 'consumable' | 'passive';

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  maxDurability: number; // 耐久度上限
  // Effects differ by holder's team
  werewolfEffect: string;
  villagerEffect: string;
  description: string;
}

export interface ItemInstance {
  definitionId: string;
  durability: number; // 当前耐久度, 0 = broken/destroyed
}

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  claws: {
    id: 'claws',
    name: '尖牙利爪',
    type: 'action_prerequisite',
    maxDurability: 1,
    werewolfEffect: '拥有时可在夜晚执行一对一杀戮',
    villagerEffect: '被攻击时可选择与攻击者同归于尽',
    description: '狼人的天然武器',
  },
  crystal_ball: {
    id: 'crystal_ball',
    name: '水晶球',
    type: 'action_prerequisite',
    maxDurability: 1,
    werewolfEffect: '无效果',
    villagerEffect: '预言家持有时可执行夜间查验；若查验到狼人，水晶球碎裂损坏',
    description: '预言家的查验工具',
  },
  thief_gloves: {
    id: 'thief_gloves',
    name: '小偷手套',
    type: 'action_prerequisite',
    maxDurability: 1,
    werewolfEffect: '无效果',
    villagerEffect: '窃贼持有时可执行一次偷取；使用后损坏',
    description: '窃贼的偷窃工具',
  },
  coroner_tools: {
    id: 'coroner_tools',
    name: '验尸工具',
    type: 'consumable',
    maxDurability: 1,
    werewolfEffect: '无效果',
    villagerEffect: '验尸官持有时可执行一次尸检，查看一名死亡角色的所有道具；使用后损坏',
    description: '验尸官的检验工具',
  },
  amulet: {
    id: 'amulet',
    name: '护身符',
    type: 'consumable',
    maxDurability: 1,
    werewolfEffect: '抵挡一次夜晚杀戮，使用后损坏',
    villagerEffect: '抵挡一次夜晚杀戮，使用后损坏',
    description: '可抵挡一次致命攻击',
  },
  double_sword: {
    id: 'double_sword',
    name: '双刃剑',
    type: 'consumable',
    maxDurability: 1,
    werewolfEffect: '狂狼持有时可与一名玩家同归于尽，并触发平安夜；使用后消耗',
    villagerEffect: '无效果',
    description: '狂狼的毁灭性武器',
  },
};

export const MAX_ITEM_SLOTS = 3;

// ---------- Roles (职业) ----------
export type Role =
  | 'werewolf'      // 普通狼人
  | 'lone_wolf'     // 孤狼 (trait-based)
  | 'berserker'     // 狂狼
  | 'villager'      // 普通村民
  | 'prophet'       // 预言家
  | 'thief'         // 窃贼
  | 'coroner';      // 验尸官

export type Team = 'werewolf' | 'villager';

export interface RoleInfo {
  role: Role;
  label: string;
  team: Team;
  description: string;
  defaultItems: string[];
}

export const ROLE_INFO: Record<Role, RoleInfo> = {
  werewolf: { role: 'werewolf', label: '普通狼人', team: 'werewolf', description: '参与夜晚讨论，可执行杀戮', defaultItems: ['claws'] },
  lone_wolf: { role: 'lone_wolf', label: '孤狼', team: 'werewolf', description: '独立选择杀戮目标，不与其他狼人沟通', defaultItems: ['claws'] },
  berserker: { role: 'berserker', label: '狂狼', team: 'werewolf', description: '白天可同归于尽，触发平安夜', defaultItems: ['claws', 'double_sword'] },
  villager: { role: 'villager', label: '普通村民', team: 'villager', description: '无特殊能力，通过投票放逐狼人', defaultItems: [] },
  prophet: { role: 'prophet', label: '预言家', team: 'villager', description: '每晚查验一名玩家身份', defaultItems: ['crystal_ball'] },
  thief: { role: 'thief', label: '窃贼', team: 'villager', description: '整场游戏限一次偷取一名玩家的道具', defaultItems: ['thief_gloves'] },
  coroner: { role: 'coroner', label: '验尸官', team: 'villager', description: '整场游戏限一次查看死亡角色的道具', defaultItems: ['coroner_tools'] },
};

// ---------- Traits (特质) ----------
export interface Trait {
  id: string;
  name: string;
  description: string;
}

export const TRAITS: Record<string, Trait> = {
  lone_wolf_trait: {
    id: 'lone_wolf_trait',
    name: '孤狼',
    description: '狼人阵营角色拥有此特质时，夜间不能与其他狼人沟通，杀戮阶段独立选择目标；若目标与普通狼人相同，本次杀戮无效。',
  },
};

// ---------- Phases (阶段) ----------
export type Phase = 'night' | 'morning' | 'day' | 'vote' | 'init' | 'ended' | 'event';

export type DaySubPhase = 'action' | 'appendix' | 'vote';

// ---------- Actions (行动) ----------

// 白天普通行动
export type DayActionType =
  | 'silence'           // 沉默
  | 'speak'             // 普通发言（无特定行动，仅打破沉默）
  | 'claim_identity'    // 公布身份
  | 'reveal_info'       // 公开信息
  | 'observe'           // 观察
  | 'suspect'           // 怀疑
  | 'defend'            // 袒护
  | 'thank'             // 感谢
  | 'call_vote'         // 号召投票
  | 'block_vote'        // 阻止投票
  | 'guarantee'         // 担保清白
  | 'accuse'            // 强烈指认
  | 'exclude_all'       // 全员排除
  | 'berserker_kill';   // 狂狼同归于尽

// 追加行动
export type AppendixActionType =
  | 'join_suspect'      // 一同怀疑
  | 'rebut'             // 反驳
  | 'join_defend';      // 一同袒护

// 夜晚行动
export type NightActionType =
  | 'kill'              // 狼人杀戮
  | 'check'             // 预言家查验
  | 'steal'             // 窃贼偷取
  | 'inspect';          // 验尸官验尸

export type ActionType = DayActionType | AppendixActionType | NightActionType | 'vote';

export interface ActionResult {
  success: boolean;
  critical: boolean; // 大成功/大失败
  action: ActionType;
  actorId: string;
  targetId?: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---------- Check / Roll (检定) ----------
export interface CheckResult {
  roll: number;        // d20 result (1-20)
  modifier: number;    // attribute + other bonuses
  total: number;       // roll + modifier
  difficulty: number;    // target value
  success: boolean;
  criticalSuccess: boolean; // total >= difficulty + 10
  criticalFail: boolean;    // total <= difficulty - 10
  margin: number;      // total - difficulty
}

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function performCheck(
  modifier: number,
  difficulty: number
): CheckResult {
  const roll = rollD20();
  const total = roll + modifier;
  const margin = total - difficulty;
  return {
    roll,
    modifier,
    total,
    difficulty,
    success: total >= difficulty,
    criticalSuccess: total >= difficulty + 10,
    criticalFail: total <= difficulty - 10,
    margin,
  };
}

// ---------- Player (玩家) ----------
export interface Player {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  items: ItemInstance[];
  attributes: Attributes;
  alignment: Alignment;
  traits: string[];
  stress: number; // -10 ~ +10
  // Relations: directed, this player's view of others
  relations: Record<string, Relation>; // key = other player id
}

export interface PlayerPublicState {
  id: string;
  name: string;
  role: Role;
  team: Team;
  alive: boolean;
  items: ItemInstance[];
  attributes: Attributes;
  alignment: Alignment;
  traits: string[];
  stress: number;
  relations: Record<string, Relation>;
}

// ---------- Game Log ----------
export interface GameLogItem {
  round: number;
  phase: Phase;
  message: string;
  type: 'phase' | 'action' | 'death' | 'victory' | 'info' | 'check' | 'relation' | 'stress' | 'item' | 'thinking';
  details?: Record<string, unknown>;
}

// ---------- Game Config ----------
export interface GameConfig {
  totalPlayers: number;
  werewolfRoles: { role: Role; count: number }[];
  villagerRoles: { role: Role; count: number }[];
}

// ---------- Victory ----------
export type Winner = 'villager' | 'werewolf' | null;

// ---------- Night Kill Resolution ----------
export interface NightKillResult {
  targetId: string | null;
  killerId: string | null;
  loneWolfTargetId: string | null;
  loneWolfId: string | null;
  conflict: boolean; // lone wolf and werewolf targeted same person
  blocked: boolean; // amulet blocked
  amuletUsedBy?: string;
  success: boolean;
}

// ---------- Vote Result ----------
export interface VoteResult {
  round: number; // 1 or 2
  votes: Record<string, string[]>; // targetId -> voterIds
  maxVotes: number;
  topTargets: string[];
  eliminatedId: string | null;
  tie: boolean;
  nextRound: boolean; // needs second round
}

// ---------- Setup Config ----------
export interface SetupConfig {
  totalPlayers: number;
  werewolfConfig: { role: string; count: number }[];
  villagerConfig: { role: string; count: number }[];
}

// ---------- Utility Functions ----------
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampStress(value: number): number {
  return clamp(value, -10, 10);
}

export function clampRelation(value: number): number {
  return clamp(value, -10, 10);
}

export function getAlignmentName(alignment: Alignment): string {
  const key = `${alignment.law}-${alignment.good}`;
  return ALIGNMENT_NAMES[key] || '未知';
}

export function hasItem(player: Player, itemId: string): boolean {
  return player.items.some((i) => i.definitionId === itemId && i.durability > 0);
}

export function getItem(player: Player, itemId: string): ItemInstance | undefined {
  return player.items.find((i) => i.definitionId === itemId && i.durability > 0);
}

export function removeItem(player: Player, itemId: string): boolean {
  const idx = player.items.findIndex((i) => i.definitionId === itemId);
  if (idx >= 0) {
    player.items.splice(idx, 1);
    return true;
  }
  return false;
}

export function addItem(player: Player, itemId: string): boolean {
  if (player.items.length >= MAX_ITEM_SLOTS) return false;
  const def = ITEM_DEFINITIONS[itemId];
  if (!def) return false;
  player.items.push({
    definitionId: itemId,
    durability: def.maxDurability,
  });
  return true;
}

export function damageItem(player: Player, itemId: string): boolean {
  const item = player.items.find((i) => i.definitionId === itemId);
  if (!item) return false;
  item.durability--;
  if (item.durability <= 0) {
    removeItem(player, itemId);
  }
  return true;
}

export function canUseItem(player: Player, itemId: string): boolean {
  return hasItem(player, itemId);
}

// Default attribute generation for AI players
export function generateRandomAttributes(): Attributes {
  return {
    affinity: 3 + Math.floor(Math.random() * 5), // 3-7
    logic: 3 + Math.floor(Math.random() * 5),
    leadership: 3 + Math.floor(Math.random() * 5),
    deception: 3 + Math.floor(Math.random() * 5),
    stealth: 3 + Math.floor(Math.random() * 5),
    insight: 3 + Math.floor(Math.random() * 5),
  };
}

export function generateRandomAlignment(): Alignment {
  const laws: LawAxis[] = ['lawful', 'neutral_law', 'chaotic'];
  const goods: GoodAxis[] = ['good', 'neutral_good', 'evil'];
  return {
    law: laws[Math.floor(Math.random() * laws.length)],
    good: goods[Math.floor(Math.random() * goods.length)],
  };
}

// ---------- Decision Types (AI Decision System) ----------

export interface DecisionCandidate {
  action: string;
  target: string | null;
  score: number;
  confidence: number;
  reason: string;
  details?: Record<string, unknown>;
  stageWeight?: number;
  stage?: string;
  strategy?: string;
  rule?: string;
  trigger?: string;
  random?: boolean;
}

export interface DecisionProcess {
  candidates: {
    action: string;
    target: string | null;
    reason: string;
    score: number;
    stageWeight: number;
    totalScore: number;
    stage: string;
    strategy: string;
    rule: string;
    trigger: string;
    random: boolean;
    modifiers: { alignment: number; stress: number; relation: number; total: number };
  }[];
  winner: string;
  shortlist: string;
}

export interface DecisionResult {
  action: string;
  target: string | null;
  reason: string;
  stage: string;
  confidence: number;
  emotionalTone: string;
  details?: Record<string, unknown>;
  process?: DecisionProcess;
}

// ---------- Log Entry ----------

export interface LogEntry {
  round: number;
  phase: Phase;
  message: string;
  timestamp: number;
}

// ---------- Public Claim ----------

export interface PublicClaim {
  playerId: string;
  claim: string;
  content: Record<string, unknown>;
  round: number;
}

// ---------- Alignment & Stress Check Modifiers ----------

export function getStressModifier(stress: number, attribute: 'deception' | 'stealth' | 'other'): number {
  if (attribute === 'deception' || attribute === 'stealth') {
    // 压力越高，诡诈/隐蔽检定减值越大（约压力值 × 0.5）
    if (stress > 0) {
      return -Math.floor(stress * 0.5);
    }
  }
  return 0;
}

export function getAlignmentModifier(
  alignment: Alignment,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other',
  isGoodAction: boolean = false
): number {
  switch (actionType) {
    case 'leadership':
      // 守序：发起/支持规则性行动时领导 +1
      if (alignment.law === 'lawful') return 1;
      return 0;
    case 'deception':
    case 'stealth':
      // 守序：撒谎/隐蔽时诡诈检定难度 +2（对检定者来说是减值）
      if (alignment.law === 'lawful') return -2;
      // 混乱：撒谎/隐蔽时诡诈检定难度 -2（对检定者来说是加值）
      if (alignment.law === 'chaotic') return 2;
      // 邪恶：转移嫌疑时诡诈检定难度 -1
      if (alignment.good === 'evil') return 1;
      return 0;
    case 'affinity':
      // 善良：辩护/分享信息时亲和 +1
      if (alignment.good === 'good' && isGoodAction) return 1;
      return 0;
    default:
      return 0;
  }
}

// 计算最终检定加值 = 基础属性 + 阵营修正 + 压力修正
export const ATTRIBUTE_NAMES: Record<keyof Attributes, string> = {
  affinity: '亲和',
  logic: '逻辑',
  leadership: '领导',
  deception: '诡诈',
  stealth: '隐蔽',
  insight: '洞察',
};

export interface ModifierBreakdown {
  baseAttribute: number;
  alignmentMod: number;
  stressMod: number;
  total: number;
}

export function calculateModifierBreakdown(
  baseAttribute: number,
  alignment: Alignment,
  stress: number,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other',
  isGoodAction: boolean = false
): ModifierBreakdown {
  const alignmentMod = getAlignmentModifier(alignment, actionType, isGoodAction);
  const stressMod = getStressModifier(stress, actionType === 'deception' || actionType === 'stealth' ? actionType : 'other');
  return { baseAttribute, alignmentMod, stressMod, total: baseAttribute + alignmentMod + stressMod };
}

export function calculateFinalModifier(
  baseAttribute: number,
  alignment: Alignment,
  stress: number,
  actionType: 'leadership' | 'deception' | 'affinity' | 'stealth' | 'other',
  isGoodAction: boolean = false
): number {
  return calculateModifierBreakdown(baseAttribute, alignment, stress, actionType, isGoodAction).total;
}

export interface CheckLog {
  type: 'check' | 'opposed';
  actorName: string;
  actorAttribute: string;
  actorBaseValue: number;
  actorAlignmentMod: number;
  actorStressMod: number;
  actorTotalModifier: number;
  actorRoll: number;
  actorTotal: number;
  targetName?: string;
  targetAttribute?: string;
  targetBaseValue?: number;
  targetAlignmentMod?: number;
  targetStressMod?: number;
  targetTotalModifier?: number;
  targetRoll?: number;
  targetTotal?: number;
  difficulty?: number;
  margin: number;
  success: boolean;
  successLevel: string;
}

export interface ActionLogDetail {
  decisionReason: string;
  checks: CheckLog[];
  actorId: string;
  action: string;
  targetId?: string | null;
  [key: string]: unknown;
}

// 对抗检定：双方各掷 d20 + 属性
export function performOpposedCheck(
  actorModifier: number,
  targetModifier: number
): { actorRoll: number; targetRoll: number; actorTotal: number; targetTotal: number; success: boolean; margin: number } {
  const actorRoll = rollD20();
  const targetRoll = rollD20();
  const actorTotal = actorRoll + actorModifier;
  const targetTotal = targetRoll + targetModifier;
  return {
    actorRoll,
    targetRoll,
    actorTotal,
    targetTotal,
    success: actorTotal > targetTotal,
    margin: actorTotal - targetTotal,
  };
}
