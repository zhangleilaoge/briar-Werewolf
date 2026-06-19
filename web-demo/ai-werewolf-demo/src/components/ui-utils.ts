import type { GameLogItem, ItemInstance } from '@/types';
import {
  ITEM_DEFINITIONS,
  ATTR_COLOR_HIGH, ATTR_COLOR_MEDIUM, ATTR_COLOR_LOW,
  STRESS_COLOR_CALM, STRESS_COLOR_NORMAL, STRESS_COLOR_TENSE, STRESS_COLOR_ANXIOUS,
  STRESS_LABEL_EXTREMELY_CALM, STRESS_LABEL_CALM, STRESS_LABEL_NORMAL, STRESS_LABEL_TENSE, STRESS_LABEL_ANXIOUS,
} from '@/types';

export const roleNameMap: Record<string, string> = {
  werewolf: '狼人',
  lone_wolf: '孤狼',
  berserker: '狂狼',
  villager: '村民',
  prophet: '预言家',
  thief: '窃贼',
  coroner: '验尸官',
};

const ACTION_LOG_COLORS: Record<string, string> = {
  // 红色：杀人相关
  kill: 'text-red-400 font-bold',
  berserker_kill: 'text-red-400 font-bold',
  // 黄色：指认、投票、指控、声明
  accuse: 'text-yellow-300',
  suspect: 'text-yellow-300',
  call_vote: 'text-yellow-300',
  block_vote: 'text-yellow-300',
  exclude_all: 'text-yellow-300',
  claim_identity: 'text-yellow-300',
  reveal_info: 'text-yellow-300',
  vote: 'text-yellow-300',
  // 绿色：日常行动、侦查、特殊能力
  observe: 'text-green-300',
  speak: 'text-green-300',
  defend: 'text-green-300',
  guarantee: 'text-green-300',
  check: 'text-green-300',
  steal: 'text-green-300',
  inspect: 'text-green-300',
  // 白色：察觉、反应
  observe_detected: 'text-white',
  // 灰色：沉默
  silence: 'text-gray-400',
};

export const getLogColor = (type: GameLogItem['type'], action?: string) => {
  switch (type) {
    case 'death': return 'text-red-400 font-bold';
    case 'phase': return 'text-blue-400';
    case 'victory': return 'text-green-400 font-bold';
    case 'action': return ACTION_LOG_COLORS[action || ''] || 'text-yellow-300';
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

export const highlightNames = (
  text: string,
  players: { name: string; team: string }[]
): { text: string; isName: boolean; team?: string }[] => {
  const names = [...players.map(p => p.name)].sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ text, isName: false }];

  const escapedNames = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedNames.join('|')})`, 'g');

  const parts: { text: string; isName: boolean; team?: string }[] = [];
  let lastIndex = 0;

  text.replace(regex, (match, _group, offset) => {
    if (offset > lastIndex) {
      parts.push({ text: text.slice(lastIndex, offset), isName: false });
    }
    const player = players.find(p => p.name === match);
    parts.push({ text: match, isName: true, team: player?.team });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isName: false });
  }

  return parts;
};

export const attributeLabel = (key: string) => {
  const labels: Record<string, string> = {
    affinity: '亲和', logic: '逻辑', leadership: '领导',
    deception: '诡诈', stealth: '隐蔽', insight: '洞察',
  };
  return labels[key] || key;
};

export const attributeColor = (value: number) => {
  if (value >= ATTR_COLOR_HIGH) return 'text-green-400';
  if (value >= ATTR_COLOR_MEDIUM) return 'text-green-300';
  if (value >= ATTR_COLOR_LOW) return 'text-yellow-300';
  return 'text-red-300';
};

export const stressColor = (value: number) => {
  if (value <= STRESS_COLOR_CALM) return 'text-blue-400';
  if (value <= STRESS_COLOR_NORMAL) return 'text-green-400';
  if (value <= STRESS_COLOR_TENSE) return 'text-yellow-400';
  if (value <= STRESS_COLOR_ANXIOUS) return 'text-orange-400';
  return 'text-red-400 font-bold';
};

export const stressLabel = (value: number) => {
  if (value <= STRESS_LABEL_EXTREMELY_CALM) return '极度冷静';
  if (value <= STRESS_LABEL_CALM) return '冷静';
  if (value <= STRESS_LABEL_NORMAL) return '正常';
  if (value <= STRESS_LABEL_TENSE) return '轻微紧张';
  if (value <= STRESS_LABEL_ANXIOUS) return '明显焦虑';
  return '高度紧张';
};
