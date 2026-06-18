// ============================
// Game Utility Functions
// Extracted from types.ts for modularity
// ============================

import type { Attributes, Alignment, Player, ItemInstance, CheckResult, ModifierBreakdown, LawAxis, GoodAxis } from './types';
import { ALIGNMENT_NAMES, ITEM_DEFINITIONS } from './data-definitions';
import { MAX_ITEM_SLOTS } from './constants';

// ---------- Dice / Check ----------

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

// ---------- Clamps ----------

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampStress(value: number): number {
  return clamp(value, -10, 10);
}

export function clampRelation(value: number): number {
  return clamp(value, -10, 10);
}

// ---------- Alignment ----------

export function getAlignmentName(alignment: Alignment): string {
  const key = `${alignment.law}-${alignment.good}`;
  return ALIGNMENT_NAMES[key] || '未知';
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

// ---------- Random generation ----------

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

// ---------- Alignment & Stress Check Modifiers ----------

export function getStressModifier(stress: number, attribute: 'deception' | 'stealth' | 'other'): number {
  if (attribute === 'deception' || attribute === 'stealth') {
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
      if (alignment.law === 'lawful') return 1;
      return 0;
    case 'deception':
    case 'stealth':
      if (alignment.law === 'lawful') return -2;
      if (alignment.law === 'chaotic') return 2;
      if (alignment.good === 'evil') return 1;
      return 0;
    case 'affinity':
      if (alignment.good === 'good' && isGoodAction) return 1;
      return 0;
    default:
      return 0;
  }
}

// ---------- Attribute Names ----------

export const ATTRIBUTE_NAMES: Record<keyof Attributes, string> = {
  affinity: '亲和',
  logic: '逻辑',
  leadership: '领导',
  deception: '诡诈',
  stealth: '隐蔽',
  insight: '洞察',
};

// ---------- Modifier Calculation ----------

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

// ---------- Opposed Check ----------

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
