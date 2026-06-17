// ============================
// Behavior Modifiers
// Alignment, Stress, and Relations influence AI behavior choices
// beyond just check modifiers.
// ============================

import type { Alignment, Player, Relation } from './types';
import { STRESS_MIN, STRESS_MAX, RELATION_MIN, RELATION_MAX } from './constants';

export interface BehaviorModifier {
  actionType: string;
  targetId: string | null;
  scoreDelta: number;
  reason: string;
}

// ---------- Alignment Behavior Modifiers ----------

export function getAlignmentBehaviorModifier(
  alignment: Alignment,
  action: 'suspect' | 'accuse' | 'defend' | 'guarantee' | 'observe' | 'speak' | 'call_vote' | 'block_vote' | 'exclude_all' | 'berserker_kill' | 'kill' | 'check' | 'steal' | 'inspect' | 'vote' | 'rebut' | 'join_suspect' | 'join_defend' | 'claim_identity' | 'thank' | 'reveal_info' | string
): number {
  const { law, good } = alignment;

  switch (action) {
    case 'defend':
    case 'guarantee':
      // Good: protective actions favored; Evil: only protect if beneficial
      if (good === 'good') return 2;
      if (good === 'evil') return -1;
      return 0;

    case 'suspect':
    case 'accuse':
    case 'call_vote':
      // Lawful: systematic accusation favored; Chaotic: aggressive accusation favored
      if (law === 'lawful') return 1;
      if (law === 'chaotic') return 3;
      if (good === 'evil') return 2;
      return 0;

    case 'observe':
      // Lawful: careful observation favored; Chaotic: impatience reduces observation
      if (law === 'lawful') return 2;
      if (law === 'chaotic') return -2;
      return 0;

    case 'speak':
      // Chaotic: impulsive speech favored; Lawful: measured speech
      if (law === 'chaotic') return 1;
      return 0;

    case 'exclude_all':
    case 'berserker_kill':
      // Chaotic Evil: extreme actions heavily favored
      if (law === 'chaotic' && good === 'evil') return 5;
      if (law === 'chaotic') return 2;
      if (good === 'evil') return 2;
      return -1;

    case 'block_vote':
      // Lawful: controlling the process favored
      if (law === 'lawful') return 1;
      return 0;

    case 'rebut':
      // Chaotic: emotional rebuttal favored; Lawful: logical rebuttal (same score, different flavor)
      if (law === 'chaotic') return 1;
      return 0;

    case 'join_suspect':
      // Evil: bandwagon suspicion favored; Good: less likely to pile on
      if (good === 'evil') return 2;
      if (good === 'good') return -1;
      return 0;

    case 'join_defend':
      // Good: solidarity favored; Evil: only defend if useful
      if (good === 'good') return 2;
      if (good === 'evil') return -1;
      return 0;

    case 'kill':
      // Chaotic: impulsive kills favored; Lawful: calculated kills
      if (law === 'chaotic') return 1;
      return 0;

    case 'check':
      // Lawful: systematic investigation favored
      if (law === 'lawful') return 1;
      return 0;

    case 'vote':
      // Lawful: follow rules/majority; Chaotic: emotional voting; Good: justice; Evil: self-interest
      return 0; // voting is more influenced by relations than alignment

    default:
      return 0;
  }
}

// ---------- Stress Behavior Modifiers ----------

export function getStressBehaviorModifier(
  stress: number,
  action: 'suspect' | 'accuse' | 'defend' | 'guarantee' | 'observe' | 'speak' | 'call_vote' | 'block_vote' | 'exclude_all' | 'berserker_kill' | 'kill' | 'check' | 'steal' | 'inspect' | 'vote' | 'rebut' | 'join_suspect' | 'join_defend' | 'claim_identity' | 'thank' | 'reveal_info' | string
): number {
  // Stress range: -10 (extremely calm) to +10 (overload)

  if (stress <= -5) {
    // Extremely calm: methodical, patient, less aggressive
    switch (action) {
      case 'observe': return 3;
      case 'speak': return -2; // prefers silence/observation
      case 'suspect': return -1;
      case 'accuse': return -3;
      case 'defend': return 1;
      case 'guarantee': return 1;
      case 'call_vote': return -2;
      case 'exclude_all': return -3;
      case 'berserker_kill': return -5;
      default: return 0;
    }
  }

  if (stress <= -2) {
    // Calm: reasoned, protective
    switch (action) {
      case 'observe': return 2;
      case 'defend': return 1;
      case 'guarantee': return 1;
      case 'accuse': return -1;
      case 'exclude_all': return -2;
      default: return 0;
    }
  }

  if (stress >= 2 && stress <= 5) {
    // Mildly tense: more suspicious, more active
    switch (action) {
      case 'suspect': return 2;
      case 'accuse': return 1;
      case 'call_vote': return 1;
      case 'observe': return -1;
      case 'defend': return -1;
      default: return 0;
    }
  }

  if (stress >= 6 && stress <= 8) {
    // Anxious: aggressive, defensive, impulsive
    switch (action) {
      case 'accuse': return 3;
      case 'suspect': return 2;
      case 'call_vote': return 2;
      case 'defend': return 2; // defensive
      case 'rebut': return 3;
      case 'observe': return -2;
      case 'speak': return 1; // impulsive speech
      case 'exclude_all': return 2;
      case 'berserker_kill': return 3;
      default: return 0;
    }
  }

  if (stress >= 9) {
    // Near/overload: erratic, desperate, may freeze or explode
    switch (action) {
      case 'accuse': return 5;
      case 'exclude_all': return 4;
      case 'berserker_kill': return 5;
      case 'call_vote': return 3;
      case 'rebut': return 4;
      case 'speak': return 2;
      case 'observe': return -3;
      case 'defend': return -2; // too stressed to defend others
      case 'guarantee': return -3;
      case 'claim_identity': return 2; // may impulsively claim
      default: return 0;
    }
  }

  // Normal range (-1 to +1): no modifier
  return 0;
}

// ---------- Relation-Based Target Preference ----------

export function getRelationTargetModifier(
  relation: Relation | undefined,
  action: 'suspect' | 'accuse' | 'defend' | 'guarantee' | 'call_vote' | 'block_vote' | 'vote' | 'kill' | 'check' | 'steal' | string
): number {
  if (!relation) return 0;

  const { trust, friendly } = relation;

  switch (action) {
    case 'defend':
    case 'guarantee':
    case 'block_vote':
      // Positive relations = more likely to defend/guarantee
      return (friendly + trust) / 2;

    case 'suspect':
    case 'accuse':
    case 'call_vote':
    case 'vote':
      // Negative relations = more likely to suspect/accuse/vote against
      return -(friendly + trust) / 2;

    case 'kill':
      // Negative relations = slightly more likely to kill (for wolves)
      return -(friendly + trust) / 4;

    case 'check':
      // Low trust = more likely to check (for prophets)
      return -trust / 2;

    case 'steal':
      // Low trust = more likely to steal (for thieves)
      return -trust / 2;

    default:
      return 0;
  }
}

// ---------- Combined Modifier for Strategy Use ----------

export function calculateBehaviorScoreDelta(
  player: Player,
  action: string,
  targetId: string | null,
  relation?: Relation
): { scoreDelta: number; reason: string } {
  const alignmentMod = getAlignmentBehaviorModifier(player.alignment, action);
  const stressMod = getStressBehaviorModifier(player.stress, action);
  const relationMod = relation ? getRelationTargetModifier(relation, action) : 0;

  const totalDelta = alignmentMod + stressMod + relationMod;
  const reasons: string[] = [];

  if (alignmentMod !== 0) {
    reasons.push(`阵营修正${alignmentMod > 0 ? '+' : ''}${alignmentMod}`);
  }
  if (stressMod !== 0) {
    reasons.push(`压力修正${stressMod > 0 ? '+' : ''}${stressMod}`);
  }
  if (relationMod !== 0) {
    reasons.push(`关系修正${relationMod > 0 ? '+' : ''}${relationMod.toFixed(1)}`);
  }

  return {
    scoreDelta: totalDelta,
    reason: reasons.length > 0 ? `(${reasons.join('，')})` : '',
  };
}
