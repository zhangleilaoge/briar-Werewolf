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
import type { Player } from '@/types';
import { randomInt, randomPick, shuffle } from '@/utils/math';

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
    attributes: { affinity: 10, logic: 10, leadership: 10, deception: 10, stealth: 10, insight: 10 },
    alignment: { law: 'neutral_law', good: 'neutral_good' },
    traits: [],
    stress: 0,
    relations: {},
    ...overrides,
  };
}

// ---------- rollD20 ----------
describe('rollD20', () => {
  it('returns a number between 1 and 20', () => {
    for (let i = 0; i < 100; i++) {
      const roll = rollD20();
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(20);
    }
  });
});

// ---------- performCheck ----------
describe('performCheck', () => {
  it('produces valid check results', () => {
    const result = performCheck(5, 12);
    expect(result.roll).toBeGreaterThanOrEqual(1);
    expect(result.roll).toBeLessThanOrEqual(20);
    expect(result.total).toBe(result.roll + result.modifier);
    expect(result.success).toBe(result.total >= result.difficulty);
    expect(result.margin).toBe(result.total - result.difficulty);
  });

  it('detects critical success on natural 20', () => {
    // Mock Math.random to return 0.95 (which gives 20)
    const originalRandom = Math.random;
    Math.random = () => 0.95;
    const result = performCheck(0, 10);
    expect(result.criticalSuccess).toBe(true);
    expect(result.criticalFail).toBe(false);
    Math.random = originalRandom;
  });

  it('detects critical fail on natural 1', () => {
    // Mock Math.random to return 0 (which gives 1)
    const originalRandom = Math.random;
    Math.random = () => 0;
    const result = performCheck(20, 10);
    expect(result.criticalFail).toBe(true);
    expect(result.criticalSuccess).toBe(false);
    Math.random = originalRandom;
  });
});

// ---------- performOpposedCheck ----------
describe('performOpposedCheck', () => {
  it('produces valid opposed check results', () => {
    const result = performOpposedCheck(5, 3);
    expect(result.actorRoll).toBeGreaterThanOrEqual(1);
    expect(result.targetRoll).toBeGreaterThanOrEqual(1);
    expect(result.actorTotal).toBe(result.actorRoll + 5);
    expect(result.targetTotal).toBe(result.targetRoll + 3);
    expect(result.success).toBe(result.actorTotal > result.targetTotal);
    expect(result.margin).toBe(result.actorTotal - result.targetTotal);
  });

  it('actor natural 20 always wins unless target also natural 20', () => {
    // Mock Math.random to give actor 20, target 10
    const originalRandom = Math.random;
    let callCount = 0;
    Math.random = () => {
      callCount++;
      return callCount === 1 ? 0.95 : 0.45; // actor=20, target=10
    };
    const result = performOpposedCheck(0, 100); // target has huge modifier
    expect(result.actorRoll).toBe(20);
    expect(result.targetRoll).toBe(10);
    expect(result.criticalSuccess).toBe(true);
    expect(result.success).toBe(true); // actor wins despite lower total
    Math.random = originalRandom;
  });

  it('actor natural 1 always loses unless target also natural 1', () => {
    // Mock Math.random to give actor 1, target 20
    const originalRandom = Math.random;
    let callCount = 0;
    Math.random = () => {
      callCount++;
      return callCount === 1 ? 0 : 0.95; // actor=1, target=20
    };
    const result = performOpposedCheck(100, 0); // actor has huge modifier
    expect(result.actorRoll).toBe(1);
    expect(result.targetRoll).toBe(20);
    expect(result.criticalFail).toBe(true);
    expect(result.success).toBe(false); // actor loses despite higher total
    Math.random = originalRandom;
  });

  it('both natural 20 compares totals', () => {
    // Mock Math.random to give both 20
    const originalRandom = Math.random;
    Math.random = () => 0.95;
    const result = performOpposedCheck(5, 3);
    expect(result.actorRoll).toBe(20);
    expect(result.targetRoll).toBe(20);
    expect(result.criticalSuccess).toBe(true);
    expect(result.success).toBe(true); // actor wins with higher total
    Math.random = originalRandom;
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
  it('generates attributes in range 1-20', () => {
    for (let i = 0; i < 50; i++) {
      const attrs = generateRandomAttributes();
      Object.values(attrs).forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
      });
    }
  });
  
  it('generates attributes summing to 72', () => {
    for (let i = 0; i < 50; i++) {
      const attrs = generateRandomAttributes();
      const sum = Object.values(attrs).reduce((a, b) => a + b, 0);
      expect(sum).toBe(72);
    }
  });
  
  it('limits variance - max difference between attributes is reasonable', () => {
    for (let i = 0; i < 50; i++) {
      const attrs = generateRandomAttributes();
      const values = Object.values(attrs);
      const max = Math.max(...values);
      const min = Math.min(...values);
      // Max difference should be around 10-16 (not 18+ like before)
      expect(max - min).toBeLessThanOrEqual(16);
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
  // 注意：阵营修正已禁用，现在所有检定返回0
  // 阵营只影响行动取向（behavior-modifiers.ts），不影响检定数值
  it('returns 0 for all cases (alignment disabled for checks)', () => {
    expect(getAlignmentModifier({ law: 'lawful', good: 'good' }, 'leadership')).toBe(0);
    expect(getAlignmentModifier({ law: 'chaotic', good: 'good' }, 'leadership')).toBe(0);
    expect(getAlignmentModifier({ law: 'lawful', good: 'good' }, 'deception')).toBe(0);
    expect(getAlignmentModifier({ law: 'chaotic', good: 'good' }, 'deception')).toBe(0);
    expect(getAlignmentModifier({ law: 'neutral_law', good: 'good' }, 'affinity', true)).toBe(0);
    expect(getAlignmentModifier({ law: 'neutral_law', good: 'good' }, 'affinity', false)).toBe(0);
  });
});

describe('calculateFinalModifier', () => {
  it('sums base + stress modifiers (alignment disabled)', () => {
    const mod = calculateFinalModifier(5, { law: 'lawful', good: 'good' }, 0, 'leadership');
    expect(mod).toBe(5); // 5 + 0 + 0 (alignment disabled)
  });
});

describe('calculateModifierBreakdown', () => {
  it('returns correct breakdown with alignment disabled', () => {
    const bd = calculateModifierBreakdown(5, { law: 'lawful', good: 'good' }, 0, 'leadership');
    expect(bd.baseAttribute).toBe(5);
    expect(bd.alignmentMod).toBe(0); // 阵营修正已禁用
    expect(bd.stressMod).toBe(0);
    expect(bd.total).toBe(5); // 5 + 0 + 0
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

// ---------- Math utilities ----------
describe('Math utilities', () => {
  it('randomInt returns integer in range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomInt(5, 10);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(10);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('randomPick returns element from array', () => {
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) {
      const picked = randomPick(arr);
      expect(arr).toContain(picked);
    }
  });

  it('shuffle returns shuffled array', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(arr);
    expect(shuffled.length).toBe(arr.length);
    expect(shuffled.sort()).toEqual(arr.sort()); // Same elements
    // Note: There's a tiny chance shuffle returns same order, but very unlikely
  });

  it('shuffle does not modify original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });
});
