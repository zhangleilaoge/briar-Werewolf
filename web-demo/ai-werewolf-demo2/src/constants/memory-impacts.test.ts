// ============================================================
// MemoryImpactRegistry 验证测试
// 确保声明式规则表与实际实现保持一致
// ============================================================

import { describe, it, expect } from 'vitest';
import { getImpactRules, MEMORY_IMPACT_REGISTRY } from '@/constants/memory-impacts';
import { FRIENDLY_DELTA, CRISIS_WEIGHT, CLAIM_WEIGHT_FACTOR, OBSERVE_WEIGHT, VOTE_ROLE_WEIGHT, ACCUSER_SPAM_WEIGHT } from '@/constants';

describe('MemoryImpactRegistry', () => {
  it('registry contains rules for all active memory types', () => {
    const activeTypes = ['check_result', 'teammate_reveal', 'hear_claim', 'hear_accuse', 'hear_defend', 'hear_chat', 'vote', 'observe_pattern', 'death', 'morning', 'peaceful_night', 'vote_result', 'night_kill_vote'];
    for (const t of activeTypes) {
      const rules = getImpactRules(t as any);
      expect(rules.length).toBeGreaterThan(0);
    }
  });

  it('crisis weights match registry descriptions', () => {
    // hear_accuse crisis +2
    const accuseRules = getImpactRules('hear_accuse', 'crisis');
    expect(accuseRules[0].value).toBe(CRISIS_WEIGHT.ACCUSE);

    // vote crisis +3
    const voteRules = getImpactRules('vote', 'crisis');
    expect(voteRules[0].value).toBe(CRISIS_WEIGHT.VOTE);

    // hear_defend crisis -2
    const defendRules = getImpactRules('hear_defend', 'crisis');
    expect(defendRules[0].value).toBe(CRISIS_WEIGHT.DEFEND);

    // observe_pattern crisis +1 (attack)
    const observeRules = getImpactRules('observe_pattern', 'crisis');
    expect(observeRules[0].value).toBe(CRISIS_WEIGHT.OBSERVE);

    // hear_claim crisis +4 (werewolf)
    const claimRules = getImpactRules('hear_claim', 'crisis');
    expect(claimRules[0].value).toBe(CRISIS_WEIGHT.CLAIM_WOLF);
  });

  it('relation deltas match registry values', () => {
    // hear_accuse direct -3
    const accuseDirect = getImpactRules('hear_accuse', 'relation').find(r => r.condition?.includes('selfId'));
    expect(accuseDirect?.value).toBe(FRIENDLY_DELTA.hear_accuse);

    // hear_defend direct +2
    const defendDirect = getImpactRules('hear_defend', 'relation').find(r => r.condition?.includes('selfId'));
    expect(defendDirect?.value).toBe(FRIENDLY_DELTA.hear_defend);

    // vote direct -2
    const voteDirect = getImpactRules('vote', 'relation').find(r => r.condition?.includes('selfId'));
    expect(voteDirect?.value).toBe(FRIENDLY_DELTA.vote);

    // hear_claim werewolf -5
    const claimWolf = getImpactRules('hear_claim', 'relation').find(r => r.condition?.includes('werewolf'));
    expect(claimWolf?.value).toBe(FRIENDLY_DELTA.hear_claim_wolf);

    // hear_claim villager +2
    const claimVillager = getImpactRules('hear_claim', 'relation').find(r => r.condition?.includes('villager'));
    expect(claimVillager?.value).toBe(FRIENDLY_DELTA.hear_claim_villager);
  });

  it('role inference weights match registry', () => {
    // hear_claim weight 0.2 = CLAIM_WEIGHT_FACTOR (0.5) at default credibility 0.4
    const claimRules = getImpactRules('hear_claim', 'role');
    expect(claimRules[0].value).toBe(0.2); // 0.4 * 0.5

    // vote anti-push 0.4 = default credibility 1.0 * VOTE_ROLE_WEIGHT.ANTI_PUSH_WOLF
    const voteRules = getImpactRules('vote', 'role');
    expect(voteRules[0].value).toBe(VOTE_ROLE_WEIGHT.ANTI_PUSH_WOLF);
  });
});
