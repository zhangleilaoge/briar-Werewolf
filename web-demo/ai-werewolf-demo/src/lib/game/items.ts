/**
 * 道具操作函数
 * 
 * 提供道具的增删改查操作
 */

import type { Player, ItemInstance } from '@/types';
import { MAX_ITEM_SLOTS, ITEM_DEFINITIONS } from '@/types';

/**
 * 检查玩家是否拥有指定道具（且耐久度 > 0）
 */
export function hasItem(player: Player, itemId: string): boolean {
  return player.items.some((i) => i.definitionId === itemId && i.durability > 0);
}

/**
 * 获取玩家的指定道具实例
 */
export function getItem(player: Player, itemId: string): ItemInstance | undefined {
  return player.items.find((i) => i.definitionId === itemId && i.durability > 0);
}

/**
 * 移除玩家的指定道具
 */
export function removeItem(player: Player, itemId: string): boolean {
  const idx = player.items.findIndex((i) => i.definitionId === itemId);
  if (idx >= 0) {
    player.items.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * 为玩家添加道具
 * @returns 是否添加成功（道具栏已满或道具不存在时返回 false）
 */
export function addItem(player: Player, itemId: string): boolean {
  if (player.items.length >= MAX_ITEM_SLOTS) return false;
  const def = ITEM_DEFINITIONS[itemId];
  if (!def) return false;
  player.items.push({ definitionId: itemId, durability: def.maxDurability });
  return true;
}

/**
 * 损坏道具（减少耐久度，耐久度为 0 时自动移除）
 */
export function damageItem(player: Player, itemId: string): boolean {
  const item = player.items.find((i) => i.definitionId === itemId);
  if (!item) return false;
  item.durability--;
  if (item.durability <= 0) removeItem(player, itemId);
  return true;
}

/**
 * 检查玩家是否可以使用指定道具（别名，与 hasItem 相同）
 */
export function canUseItem(player: Player, itemId: string): boolean {
  return hasItem(player, itemId);
}
