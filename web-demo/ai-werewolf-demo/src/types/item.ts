import type { ItemDefinition } from './core';

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  claws: { id: 'claws', name: '尖牙利爪', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '拥有时可在夜晚执行一对一杀戮', villagerEffect: '被攻击时可选择与攻击者同归于尽', description: '狼人的天然武器' },
  crystal_ball: { id: 'crystal_ball', name: '水晶球', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '持有时可执行夜间查验；若查验到狼人，水晶球碎裂损坏', villagerEffect: '持有时可执行夜间查验；若查验到狼人，水晶球碎裂损坏', description: '查验身份的神秘道具' },
  thief_gloves: { id: 'thief_gloves', name: '小偷手套', type: 'action_prerequisite', maxDurability: 1, werewolfEffect: '持有时可执行一次偷取；使用后损坏', villagerEffect: '持有时可执行一次偷取；使用后损坏', description: '偷取他人道具的手套' },
  coroner_tools: { id: 'coroner_tools', name: '验尸工具', type: 'consumable', maxDurability: 1, werewolfEffect: '持有时可执行一次尸检，查看一名死亡角色的所有道具；使用后损坏', villagerEffect: '持有时可执行一次尸检，查看一名死亡角色的所有道具；使用后损坏', description: '检验尸体的工具' },
  amulet: { id: 'amulet', name: '护身符', type: 'consumable', maxDurability: 1, werewolfEffect: '抵挡一次夜晚杀戮，使用后损坏', villagerEffect: '抵挡一次夜晚杀戮，使用后损坏', description: '可抵挡一次致命攻击' },
  double_sword: { id: 'double_sword', name: '双刃剑', type: 'consumable', maxDurability: 1, werewolfEffect: '狂狼持有时可与一名玩家同归于尽，并触发平安夜；使用后消耗', villagerEffect: '无效果', description: '狂狼的毁灭性武器' },
  // 损坏版本道具（碎裂/损坏后保留，无法使用）
  claws_broken: { id: 'claws_broken', name: '尖牙利爪(已损坏)', type: 'consumable', maxDurability: 0, werewolfEffect: '已损坏，无法使用', villagerEffect: '已损坏，无法使用', description: '狼人的天然武器，已损坏' },
  crystal_ball_broken: { id: 'crystal_ball_broken', name: '水晶球(已损坏)', type: 'consumable', maxDurability: 0, werewolfEffect: '已损坏，无法使用', villagerEffect: '已损坏，无法使用', description: '查验身份的神秘道具，已碎裂' },
  thief_gloves_broken: { id: 'thief_gloves_broken', name: '小偷手套(已损坏)', type: 'consumable', maxDurability: 0, werewolfEffect: '已损坏，无法使用', villagerEffect: '已损坏，无法使用', description: '偷取他人道具的手套，已损坏' },
  coroner_tools_broken: { id: 'coroner_tools_broken', name: '验尸工具(已损坏)', type: 'consumable', maxDurability: 0, werewolfEffect: '已损坏，无法使用', villagerEffect: '已损坏，无法使用', description: '检验尸体的工具，已损坏' },
  amulet_broken: { id: 'amulet_broken', name: '护身符(已损坏)', type: 'consumable', maxDurability: 0, werewolfEffect: '已损坏，无法使用', villagerEffect: '已损坏，无法使用', description: '可抵挡一次致命攻击，已损坏' },
  double_sword_broken: { id: 'double_sword_broken', name: '双刃剑(已损坏)', type: 'consumable', maxDurability: 0, werewolfEffect: '已损坏，无法使用', villagerEffect: '已损坏，无法使用', description: '狂狼的毁灭性武器，已损坏' },
};
