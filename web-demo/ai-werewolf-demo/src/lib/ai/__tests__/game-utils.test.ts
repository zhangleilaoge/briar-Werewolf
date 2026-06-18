import { describe, it, expect } from 'vitest';
import {
  rollD20, performCheck, performOpposedCheck,
  clamp, clampStress, clampRelation,
  hasItem, addItem, removeItem, damageItem, getItem, canUseItem,
  generateRandomAttributes, generateRandomAlignment,
  getStressModifier, getAlignmentModifier,
  calculateFinalModifier, calculateModifierBreakdown,
  getAlignmentName,
} from '@/types';
import type { Player, } from '@/types';

const MAX_ITEM_SLOTS = 3;

// ---------- Helper to create a test player ----------
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'TestPlayer',
    role: 'villager',
    team: 'villager',
    alive: true,
    items: [],
    attributes: { affinity: 5, logic: 5, leadership: 5, deception: 5, stealth: 5, insight: 5 },
    alignment: { law: 'neutral_law', good: 'neutral_good' },
    traits: [],
    stress: 0,
    relations: {},
    ...overrides,
  };
}

// ---------- rollD20 ----------
describe('rollD20', () => {
  it('returns a number between 2 and 20', () => {
    for (let i = 0; i < 100; i++) {
      const roll = rollD20();
      expect(roll).toBeGreaterThanOrEqual(2);
      expect(roll).toBeLessThanOrEqual(20);
    }
  });
});

// ---------- performCheck ----------
describe('performCheck', () => {
  it('produces valid check results', () => {
    const result = performCheck(5, 12);
    expect(result.roll).toBeGreaterThanOrEqual(2);
    expect(result.roll).toBeLessThanOrEqual(20);
    expect(result.total).toBe(result.roll + result.modifier);
    expect(result.success).toBe(result.total >= result.difficulty);
    expect(result.margin).toBe(result.total - result.difficulty);
  });

  it('detects critical success when total >= difficulty + 10', () => {
    // modifier 20 ensures total >= difficulty + 10 for any roll
    const result = performCheck(20, 10);
    expect(result.criticalSuccess).toBe(true);
    expect(result.criticalFail).toBe(false);
  });

  it('detects critical fail when total <= difficulty - 10', () => {
    // modifier -20 ensures total <= difficulty - 10 for any roll
    const result = performCheck(-20, 20);
    expect(result.criticalFail).toBe(true);
    expect(result.criticalSuccess).toBe(false);
  });
});

// ---------- performOpposedCheck ----------
describe('performOpposedCheck', () => {
  it('produces valid opposed check results', () => {
    const result = performOpposedCheck(5, 3);
    expect(result.actorRoll).toBeGreaterThanOrEqual(2);
    expect(result.targetRoll).toBeGreaterThanOrEqual(2);
    expect(result.actorTotal).toBe(result.actorRoll + 5);
    expect(result.targetTotal).toBe(result.targetRoll + 3);
    expect(result.success).toBe(result.actorTotal > result.targetTotal);
    expect(result.margin).toBe(result.actorTotal - result.targetTotal);
  });
});

// ---------- clamp ----------
describe('clamp', () => {
  it('clamps value to min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps value to max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('returns value within range', () => expect(clamp(5, 0, 10)).toBe(5));
  it('clampStress works', () => expect(clampStress(15)).toBe(10));
  it('clampStress handles negative', () => expect(clampStress(-15)).toBe(-10));
  it('clampRelation works', () => expect(clampRelation(15)).toBe(10));
});

// ---------- Item helpers ----------
describe('Item helpers', () => {
  it('addItem adds an item to player', () => {
    const player = makePlayer();
    const result = addItem(player, 'claws');
    expect(result).toBe(true);
    expect(player.items.length).toBe(1);
    expect(player.items[0].definitionId).toBe('claws');
    expect(player.items[0].durability).toBeGreaterThan(0);
  });

  it('addItem fails when inventory is full', () => {
    const player = makePlayer();
    for (let i = 0; i < MAX_ITEM_SLOTS; i++) addItem(player, 'claws');
    expect(addItem(player, 'claws')).toBe(false);
  });

  it('addItem fails for unknown item', () => {
    const player = makePlayer();
    expect(addItem(player, 'nonexistent')).toBe(false);
  });

  it('hasItem returns true for owned items', () => {
    const player = makePlayer();
    addItem(player, 'claws');
    expect(hasItem(player, 'claws')).toBe(true);
    expect(hasItem(player, 'amulet')).toBe(false);
  });

  it('getItem returns the item instance', () => {
    const player = makePlayer();
    addItem(player, 'amulet');
    const item = getItem(player, 'amulet');
    expect(item).toBeDefined();
    expect(item?.definitionId).toBe('amulet');
  });

  it('canUseItem delegates to hasItem', () => {
    const player = makePlayer();
    expect(canUseItem(player, 'claws')).toBe(false);
    addItem(player, 'claws');
    expect(canUseItem(player, 'claws')).toBe(true);
  });

  it('removeItem removes the item', () => {
    const player = makePlayer();
    addItem(player, 'claws');
    expect(removeItem(player, 'claws')).toBe(true);
    expect(player.items.length).toBe(0);
    expect(removeItem(player, 'claws')).toBe(false);
  });

  it('damageItem reduces durability and removes when broken', () => {
    const player = makePlayer();
    addItem(player, 'claws'); // claws has maxDurability 1
    expect(damageItem(player, 'claws')).toBe(true);
    expect(player.items.length).toBe(0); // removed because durability hit 0
  });
});

// ---------- Random generation ----------
describe('generateRandomAttributes', () => {
  it('generates attributes in range 3-7', () => {
    for (let i = 0; i < 50; i++) {
      const attrs = generateRandomAttributes();
      Object.values(attrs).forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
      });
    }
  });
});

describe('generateRandomAlignment', () => {
  it('generates valid alignment', () => {
    for (let i = 0; i < 50; i++) {
      const alignment = generateRandomAlignment();
      expect(['lawful', 'neutral_law', 'chaotic']).toContain(alignment.law);
      expect(['good', 'neutral_good', 'evil']).toContain(alignment.good);
    }
  });
});

// ---------- Alignment & Stress modifiers ----------
describe('getStressModifier', () => {
  it('returns 0 for non-deception/stealth attributes', () => {
    expect(getStressModifier(5, 'other')).toBe(0);
  });

  it('returns negative modifier for deception under positive stress', () => {
    const mod = getStressModifier(6, 'deception');
    expect(mod).toBeLessThan(0);
  });

  it('returns 0 for negative stress', () => {
    expect(getStressModifier(-5, 'deception')).toBe(0);
  });
});

describe('getAlignmentModifier', () => {
  it('gives lawful leadership bonus', () => {
    expect(getAlignmentModifier({ law: 'lawful', good: 'good' }, 'leadership')).toBe(1);
    expect(getAlignmentModifier({ law: 'chaotic', good: 'good' }, 'leadership')).toBe(0);
  });

  it('applies deception penalty for lawful', () => {
    expect(getAlignmentModifier({ law: 'lawful', good: 'good' }, 'deception')).toBe(-2);
  });

  it('applies deception bonus for chaotic', () => {
    expect(getAlignmentModifier({ law: 'chaotic', good: 'good' }, 'deception')).toBe(2);
  });

  it('applies affinity bonus for good with good action', () => {
    expect(getAlignmentModifier({ law: 'neutral_law', good: 'good' }, 'affinity', true)).toBe(1);
    expect(getAlignmentModifier({ law: 'neutral_law', good: 'good' }, 'affinity', false)).toBe(0);
  });
});

describe('calculateFinalModifier', () => {
  it('sums base + alignment + stress modifiers', () => {
    // lawful + leadership = +1 alignment
    const mod = calculateFinalModifier(5, { law: 'lawful', good: 'good' }, 0, 'leadership');
    expect(mod).toBe(6); // 5 + 1 + 0
  });
});

describe('calculateModifierBreakdown', () => {
  it('returns correct breakdown', () => {
    const bd = calculateModifierBreakdown(5, { law: 'lawful', good: 'good' }, 0, 'leadership');
    expect(bd.baseAttribute).toBe(5);
    expect(bd.alignmentMod).toBe(1);
    expect(bd.stressMod).toBe(0);
    expect(bd.total).toBe(6);
  });
});

// ---------- getAlignmentName ----------
describe('getAlignmentName', () => {
  it('returns correct name for known alignments', () => {
    expect(getAlignmentName({ law: 'lawful', good: 'good' })).toBe('守序善良');
    expect(getAlignmentName({ law: 'chaotic', good: 'evil' })).toBe('混乱邪恶');
    expect(getAlignmentName({ law: 'neutral_law', good: 'neutral_good' })).toBe('绝对中立');
  });

  it('returns 未知 for unknown alignment', () => {
    // This shouldn't happen with valid types, but tests the fallback
    expect(getAlignmentName({ law: 'lawful' as any, good: 'unknown' as any })).toBe('未知');
  });
});
