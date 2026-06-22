// ============================================================
// 演示组件共享显示常量
// ============================================================

import { PERSONALITIES } from '@/intention/personalities';
import type { Player } from '@/types';

// ---------- 角色显示 ----------
export const ROLE_EMOJIS: Record<string, string> = { werewolf: '🐺', prophet: '🔮', villager: '👤' };
export const ROLE_NAMES: Record<string, string> = { werewolf: '狼人', prophet: '预言家', villager: '村民' };
export const ROLE_SKILLS: Record<string, string> = { werewolf: '尖牙利爪', prophet: '水晶球', villager: '平民' };
export const ATTRIBUTE_NAMES: Record<string, string> = { leadership: '领导力', eloquence: '口才', observation: '观察力', cunning: '狡诈', affinity: '亲和力', logic: '逻辑' };
export const PERSONALITY_IDS = Object.keys(PERSONALITIES);

/** 根据角色返回 emoji */
export function getRoleEmoji(role: string): string {
  return ROLE_EMOJIS[role] ?? '❓';
}

/** 根据玩家 ID 查找并返回 emoji */
export function getPlayerEmoji(playerId: string, players: Player[]): string {
  const p = players.find((x) => x.id === playerId);
  return p ? getRoleEmoji(p.role) : '❓';
}

// ---------- 显示名映射（仅实际产生的 ID） ----------
export const ACTION_NAMES: Record<string, string> = {
  silence: '保持沉默',
  claim_identity: '公布身份',
  observe: '暗中观察',
  suspect: '号召投票',
  defend: '辩护',
  chat: '闲聊',
  sleep: '休息',
};

export const LONG_TERM_NAMES: Record<string, string> = {
  survive: '生存',
  find_werewolf: '找出狼人',
  protect_villager: '保护村民',
  lead: '领导村庄',
  hide_identity: '隐藏身份',
  mislead: '误导村民',
  report_check: '报查验',
};

export const SHORT_TERM_NAMES: Record<string, string> = {
  survive: '自保',
  attack: '攻击',
  observe: '观察',
  protect: '保护',
  lead: '主导',
  hide: '隐藏',
  report_check: '报查验',
};

export const MEMORY_SOURCE_NAMES: Record<string, string> = { system: '系统', self: '自己', speech: '发言', observe: '观察' };
