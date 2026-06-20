import { ACTION } from '@/lib/constants/action-constants';
import {
  CRISIS_FACTOR_SILENCE_CRITICAL,
  CRISIS_FACTOR_OBSERVE_CRITICAL,
  CRISIS_FACTOR_DEFEND_CRITICAL,
  CRISIS_FACTOR_REBUT_CRITICAL,
  CRISIS_FACTOR_ACCUSE_CRITICAL,
  CRISIS_FACTOR_CALL_VOTE_CRITICAL,
  CRISIS_FACTOR_CLAIM_IDENTITY_CRITICAL,
  CRISIS_FACTOR_DEFAULT_CRITICAL,
  CRISIS_FACTOR_SILENCE_HIGH,
  CRISIS_FACTOR_DEFEND_HIGH,
  CRISIS_FACTOR_ACCUSE_HIGH,
  CRISIS_FACTOR_CALL_VOTE_HIGH,
  RELATION_FACTOR_DEFEND_TRUSTED,
  RELATION_FACTOR_GUARANTEE_TRUSTED,
  RELATION_FACTOR_ACCUSE_TRUSTED,
  RELATION_FACTOR_ACCUSE_SUSPICIOUS,
  RELATION_FACTOR_SUSPECT_SUSPICIOUS,
  RELATION_FACTOR_DEFEND_SUSPICIOUS,
  RELATION_FACTOR_DEFAULT,
  SOCIAL_BONUS_SILENCE_HIGH_TENSION,
  SOCIAL_BONUS_DEFEND_TARGET,
  SOCIAL_BONUS_CALL_VOTE_LEADER,
  SOCIAL_BONUS_OBSERVE_RICH_INFO,
} from '@/lib/constants/mind';
import type { Player } from '@/types';
import type { RelationNetwork } from '../mind/types';

// ========== 危机因子 ==========

export function calculateCrisisFactor(
  action: string,
  crisis: { isCritical: boolean; isHigh: boolean }
): number {
  if (crisis.isCritical) {
    switch (action) {
      case ACTION.SILENCE: return CRISIS_FACTOR_SILENCE_CRITICAL;
      case ACTION.OBSERVE: return CRISIS_FACTOR_OBSERVE_CRITICAL;
      case ACTION.DEFEND: return CRISIS_FACTOR_DEFEND_CRITICAL;
      case ACTION.REBUT: return CRISIS_FACTOR_REBUT_CRITICAL;
      case ACTION.ACCUSE: return CRISIS_FACTOR_ACCUSE_CRITICAL;
      case ACTION.CALL_VOTE: return CRISIS_FACTOR_CALL_VOTE_CRITICAL;
      case ACTION.CLAIM_IDENTITY: return CRISIS_FACTOR_CLAIM_IDENTITY_CRITICAL;
      default: return CRISIS_FACTOR_DEFAULT_CRITICAL;
    }
  }
  if (crisis.isHigh) {
    switch (action) {
      case ACTION.SILENCE: return CRISIS_FACTOR_SILENCE_HIGH;
      case ACTION.DEFEND: return CRISIS_FACTOR_DEFEND_HIGH;
      case ACTION.ACCUSE: return CRISIS_FACTOR_ACCUSE_HIGH;
      case ACTION.CALL_VOTE: return CRISIS_FACTOR_CALL_VOTE_HIGH;
      default: return CRISIS_FACTOR_DEFAULT_CRITICAL;
    }
  }
  return RELATION_FACTOR_DEFAULT;
}

// ========== 关系因子 ==========

export function calculateRelationFactor(
  action: string,
  target: string | null,
  relationNetwork: { myView: Map<string, { trust: number; inferredTeam: 'werewolf' | 'villager' | 'unknown'; confidence: number }> },
  self: Player
): number {
  if (!target) return RELATION_FACTOR_DEFAULT;

  const view = relationNetwork.myView.get(target);
  if (!view) return RELATION_FACTOR_DEFAULT;

  if (view.trust > 5) {
    if (action === ACTION.DEFEND) return RELATION_FACTOR_DEFEND_TRUSTED;
    if (action === ACTION.GUARANTEE) return RELATION_FACTOR_GUARANTEE_TRUSTED;
    if (action === ACTION.ACCUSE) return RELATION_FACTOR_ACCUSE_TRUSTED;
  }

  if (view.inferredTeam === 'werewolf' && view.confidence > 0.6) {
    if (action === ACTION.ACCUSE) return RELATION_FACTOR_ACCUSE_SUSPICIOUS;
    if (action === ACTION.SUSPECT) return RELATION_FACTOR_SUSPECT_SUSPICIOUS;
    if (action === ACTION.DEFEND) return RELATION_FACTOR_DEFEND_SUSPICIOUS;
  }

  return RELATION_FACTOR_DEFAULT;
}

// ========== 社交情境因子 ==========

export function calculateSocialContextBonus(
  action: string,
  target: string | null,
  socialContext: { situation: { tensionLevel: number; myPosition: string; informationRichness: number } }
): number {
  let bonus = 1.0;

  if (action === ACTION.SILENCE && socialContext.situation.tensionLevel > 0.7) {
    bonus *= SOCIAL_BONUS_SILENCE_HIGH_TENSION;
  }

  if (socialContext.situation.myPosition === 'target') {
    if (action === ACTION.REBUT || action === ACTION.DEFEND) {
      bonus *= SOCIAL_BONUS_DEFEND_TARGET;
    }
  }

  if (socialContext.situation.myPosition === 'leader') {
    if (action === ACTION.CALL_VOTE) {
      bonus *= SOCIAL_BONUS_CALL_VOTE_LEADER;
    }
  }

  if (action === ACTION.OBSERVE && socialContext.situation.informationRichness > 0.8) {
    bonus *= SOCIAL_BONUS_OBSERVE_RICH_INFO;
  }

  return bonus;
}
