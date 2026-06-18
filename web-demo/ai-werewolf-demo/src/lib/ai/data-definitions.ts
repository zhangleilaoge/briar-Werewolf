// ============================
// Data Definitions — constants & lookup tables
// Extracted from types.ts for modularity
// ============================

import type { ItemDefinition, Role, RoleInfo, Trait, LawAxis, GoodAxis } from './types';

// ---------- Alignment Names ----------
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

// ---------- Item Definitions ----------
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

// ---------- Role Info ----------
export const ROLE_INFO: Record<Role, RoleInfo> = {
  werewolf: { role: 'werewolf', label: '普通狼人', team: 'werewolf', description: '参与夜晚讨论，可执行杀戮', defaultItems: ['claws'] },
  lone_wolf: { role: 'lone_wolf', label: '孤狼', team: 'werewolf', description: '独立选择杀戮目标，不与其他狼人沟通', defaultItems: ['claws'] },
  berserker: { role: 'berserker', label: '狂狼', team: 'werewolf', description: '白天可同归于尽，触发平安夜', defaultItems: ['claws', 'double_sword'] },
  villager: { role: 'villager', label: '普通村民', team: 'villager', description: '无特殊能力，通过投票放逐狼人', defaultItems: [] },
  prophet: { role: 'prophet', label: '预言家', team: 'villager', description: '每晚查验一名玩家身份', defaultItems: ['crystal_ball'] },
  thief: { role: 'thief', label: '窃贼', team: 'villager', description: '整场游戏限一次偷取一名玩家的道具', defaultItems: ['thief_gloves'] },
  coroner: { role: 'coroner', label: '验尸官', team: 'villager', description: '整场游戏限一次查看死亡角色的道具', defaultItems: ['coroner_tools'] },
};

// ---------- Traits ----------
export const TRAITS: Record<string, Trait> = {
  lone_wolf_trait: {
    id: 'lone_wolf_trait',
    name: '孤狼',
    description: '狼人阵营角色拥有此特质时，夜间不能与其他狼人沟通，杀戮阶段独立选择目标；若目标与普通狼人相同，本次杀戮无效。',
  },
};
