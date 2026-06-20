import type { Player, Role } from '@/types';
import type { ValueSystem } from './types';

// 角色价值观模板
const ROLE_VALUE_TEMPLATES: Record<Role, Partial<ValueSystem>> = {
  prophet: { truthSeeking: VALUE_BASE + 0.4, selfPreservation: VALUE_BASE, dominance: VALUE_BASE - 0.1, deception: VALUE_BASE - 0.4 },
  villager: { truthSeeking: VALUE_BASE + 0.2, selfPreservation: VALUE_SELF_PRESERVATION_BASE, socialHarmony: VALUE_BASE + 0.2, deception: VALUE_BASE - 0.3 },
  werewolf: { truthSeeking: VALUE_BASE - 0.3, selfPreservation: VALUE_BASE + 0.3, deception: VALUE_BASE + 0.4, loyalty: VALUE_BASE + 0.4 },
  lone_wolf: { truthSeeking: VALUE_BASE - 0.2, selfPreservation: VALUE_BASE + 0.4, deception: VALUE_BASE + 0.3, loyalty: VALUE_BASE - 0.2 },
  berserker: { truthSeeking: VALUE_BASE - 0.3, selfPreservation: VALUE_BASE - 0.1, dominance: VALUE_BASE + 0.4, deception: VALUE_BASE + 0.1 },
  thief: { truthSeeking: VALUE_BASE - 0.1, selfPreservation: VALUE_BASE + 0.2, deception: VALUE_BASE + 0.1, dominance: VALUE_BASE - 0.2 },
  coroner: { truthSeeking: VALUE_BASE + 0.3, selfPreservation: VALUE_BASE, deception: VALUE_BASE - 0.3, dominance: VALUE_BASE - 0.2 },
  hunter: { truthSeeking: VALUE_BASE + 0.2, selfPreservation: VALUE_BASE + 0.3, deception: VALUE_BASE - 0.2, dominance: VALUE_BASE + 0.1 },
};

// 阵营价值观修正
const TEAM_VALUE_MODIFIERS: Record<string, Partial<ValueSystem>> = {
  villager: { truthSeeking: VALUE_BASE - 0.3, socialHarmony: VALUE_BASE - 0.4, deception: -0.1 },
  werewolf: { truthSeeking: -0.3, deception: VALUE_BASE - 0.3, loyalty: VALUE_BASE - 0.4 },
};

// 阵营九宫格价值观修正
const ALIGNMENT_VALUE_MODIFIERS: Record<string, Partial<ValueSystem>> = {
  'lawful-good': { truthSeeking: VALUE_BASE - 0.4, socialHarmony: VALUE_BASE - 0.4, deception: -0.1 },
  'neutral-good': { truthSeeking: VALUE_BASE - 0.4, socialHarmony: VALUE_BASE - 0.4 },
  'chaotic-good': { truthSeeking: VALUE_BASE - 0.4, dominance: VALUE_BASE - 0.4, socialHarmony: -0.1 },
  'lawful-neutral': { truthSeeking: VALUE_BASE - 0.4, socialHarmony: VALUE_BASE - 0.4 },
  'true-neutral': {},
  'chaotic-neutral': { dominance: VALUE_BASE - 0.4, socialHarmony: -0.1 },
  'lawful-evil': { deception: VALUE_BASE - 0.4, dominance: VALUE_BASE - 0.4, socialHarmony: -0.1 },
  'neutral-evil': { deception: VALUE_BASE - 0.4, socialHarmony: -0.1 },
  'chaotic-evil': { deception: VALUE_BASE - 0.3, dominance: VALUE_BASE - 0.3, socialHarmony: -0.2, loyalty: -0.1 },
};

export class ValueSystemFactory {
  create(player: Player): ValueSystem {
    // 基础值
    const base: ValueSystem = {
      truthSeeking: VALUE_BASE,
      selfPreservation: VALUE_SELF_PRESERVATION_BASE,
      socialHarmony: VALUE_BASE,
      dominance: VALUE_BASE,
      deception: VALUE_BASE,
      loyalty: VALUE_BASE,
    };

    // 应用角色模板
    const roleTemplate = ROLE_VALUE_TEMPLATES[player.role];
    if (roleTemplate) {
      this._applyTemplate(base, roleTemplate);
    }

    // 应用阵营修正
    const teamModifier = TEAM_VALUE_MODIFIERS[player.team];
    if (teamModifier) {
      this._applyTemplate(base, teamModifier);
    }

    // 应用阵营九宫格修正
    const alignmentKey = `${player.alignment.law}-${player.alignment.good}`;
    const alignmentModifier = ALIGNMENT_VALUE_MODIFIERS[alignmentKey];
    if (alignmentModifier) {
      this._applyTemplate(base, alignmentModifier);
    }

    // 属性影响
    base.truthSeeking += (player.attributes.logic - 10) * VALUE_ATTRIBUTE_SCALE;
    base.deception += (player.attributes.stealth - 10) * VALUE_ATTRIBUTE_SCALE;
    base.dominance += (player.attributes.leadership - 10) * VALUE_ATTRIBUTE_SCALE;
    base.socialHarmony += (player.attributes.affinity - 10) * VALUE_ATTRIBUTE_SCALE;
    base.selfPreservation += (player.attributes.stealth - 10) * VALUE_ATTRIBUTE_SCALE_LOW;

    // 归一化到 0-1
    return this._clampValues(base);
  }

  private _applyTemplate(base: ValueSystem, template: Partial<ValueSystem>): void {
    for (const [key, value] of Object.entries(template)) {
      if (value !== undefined) {
        (base as unknown as Record<string, number>)[key] += value;
      }
    }
  }

  private _clampValues(values: ValueSystem): ValueSystem {
    return {
      truthSeeking: this._clamp(values.truthSeeking),
      selfPreservation: this._clamp(values.selfPreservation),
      socialHarmony: this._clamp(values.socialHarmony),
      dominance: this._clamp(values.dominance),
      deception: this._clamp(values.deception),
      loyalty: this._clamp(values.loyalty),
    };
  }

  private _clamp(value: number): number {
    return Math.max(VALUE_CLAMP_MIN, Math.min(VALUE_CLAMP_MAX, value));
  }
}

// 行动价值观签名
import { ACTION } from '@/lib/constants/action-constants';
import {
  VALUE_BASE,
  VALUE_SELF_PRESERVATION_BASE,
  VALUE_ATTRIBUTE_SCALE,
  VALUE_ATTRIBUTE_SCALE_LOW,
  VALUE_CLAMP_MIN,
  VALUE_CLAMP_MAX,
} from '@/lib/constants/mind';

export const ACTION_VALUE_SIGNATURES: Record<string, Partial<ValueSystem>> = {
  [ACTION.SILENCE]: { selfPreservation: VALUE_BASE + 0.2, deception: VALUE_BASE - 0.1 },
  [ACTION.OBSERVE]: { truthSeeking: VALUE_BASE + 0.2, selfPreservation: VALUE_BASE },
  [ACTION.SUSPECT]: { truthSeeking: VALUE_BASE + 0.1, deception: VALUE_BASE - 0.2, dominance: VALUE_BASE - 0.1 },
  [ACTION.ACCUSE]: { truthSeeking: VALUE_BASE + 0.3, deception: VALUE_BASE - 0.1, dominance: VALUE_BASE + 0.2 },
  [ACTION.DEFEND]: { truthSeeking: VALUE_BASE - 0.1, socialHarmony: VALUE_BASE + 0.3, loyalty: VALUE_BASE + 0.2 },
  [ACTION.GUARANTEE]: { truthSeeking: VALUE_BASE + 0.4, socialHarmony: VALUE_BASE + 0.1, loyalty: VALUE_BASE + 0.3 },
  [ACTION.CALL_VOTE]: { truthSeeking: VALUE_BASE + 0.2, dominance: VALUE_BASE + 0.3, deception: VALUE_BASE - 0.2 },
  [ACTION.BLOCK_VOTE]: { truthSeeking: VALUE_BASE - 0.2, socialHarmony: VALUE_BASE + 0.1, deception: VALUE_BASE },
  [ACTION.EXCLUDE_ALL]: { truthSeeking: VALUE_BASE + 0.3, dominance: VALUE_BASE + 0.1, deception: VALUE_BASE - 0.3 },
  [ACTION.CLAIM_IDENTITY]: { truthSeeking: VALUE_BASE + 0.3, dominance: VALUE_BASE, selfPreservation: VALUE_BASE - 0.2 },
  [ACTION.REBUT]: { truthSeeking: VALUE_BASE + 0.1, selfPreservation: VALUE_BASE + 0.3, dominance: VALUE_BASE - 0.1 },
  [ACTION.JOIN_SUSPECT]: { truthSeeking: VALUE_BASE, deception: VALUE_BASE - 0.2, socialHarmony: VALUE_BASE - 0.1 },
  [ACTION.JOIN_DEFEND]: { truthSeeking: VALUE_BASE - 0.2, socialHarmony: VALUE_BASE + 0.3, loyalty: VALUE_BASE + 0.1 },
};

export function calculateValueAlignment(action: string, valueSystem: ValueSystem): number {
  const signature = ACTION_VALUE_SIGNATURES[action];
  if (!signature) return 0.5;

  let dot = 0;
  let normSig = 0;
  let normVal = 0;

  for (const [key, sigVal] of Object.entries(signature)) {
    const val = (valueSystem as unknown as Record<string, number>)[key];
    if (val !== undefined) {
      dot += sigVal * val;
      normSig += sigVal * sigVal;
      normVal += val * val;
    }
  }

  if (normSig === 0 || normVal === 0) return 0.5;
  return dot / (Math.sqrt(normSig) * Math.sqrt(normVal));
}
