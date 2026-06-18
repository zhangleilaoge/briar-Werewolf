import type { GameLogItem, ItemInstance } from '../lib/ai/types';
import { ITEM_DEFINITIONS } from '../lib/ai/types';

export const roleNameMap: Record<string, string> = {
  werewolf: '狼人',
  lone_wolf: '孤狼',
  berserker: '狂狼',
  villager: '村民',
  prophet: '预言家',
  thief: '窃贼',
  coroner: '验尸官',
};

export const getLogColor = (type: GameLogItem['type']) => {
  switch (type) {
    case 'phase': return 'text-blue-400';
    case 'action': return 'text-yellow-300';
    case 'death': return 'text-red-400 font-bold';
    case 'victory': return 'text-green-400 font-bold';
    case 'check': return 'text-purple-400';
    case 'relation': return 'text-pink-400';
    case 'stress': return 'text-orange-400';
    case 'item': return 'text-cyan-400';
    case 'thinking': return 'text-yellow-400 animate-pulse';
    default: return 'text-gray-400';
  }
};

export const itemLabel = (item: ItemInstance) => {
  const def = ITEM_DEFINITIONS[item.definitionId];
  return `${def?.name || item.definitionId}${item.durability > 0 ? '' : ' [损坏]'}`;
};

export const attributeLabel = (key: string) => {
  const labels: Record<string, string> = {
    affinity: '亲和', logic: '逻辑', leadership: '领导',
    deception: '诡诈', stealth: '隐蔽', insight: '洞察',
  };
  return labels[key] || key;
};

export const attributeColor = (value: number) => {
  if (value >= 8) return 'text-green-400';
  if (value >= 6) return 'text-green-300';
  if (value >= 4) return 'text-yellow-300';
  return 'text-red-300';
};

export const stressColor = (value: number) => {
  if (value <= -5) return 'text-blue-400';
  if (value <= 2) return 'text-green-400';
  if (value <= 5) return 'text-yellow-400';
  if (value <= 8) return 'text-orange-400';
  return 'text-red-400 font-bold';
};

export const stressLabel = (value: number) => {
  if (value <= -7) return '极度冷静';
  if (value <= -3) return '冷静';
  if (value <= 2) return '正常';
  if (value <= 5) return '轻微紧张';
  if (value <= 8) return '明显焦虑';
  return '高度紧张';
};
