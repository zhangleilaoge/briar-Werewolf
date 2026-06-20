import type { BeliefSystem } from '../belief-system';
import type { Player } from '@/types';
import type { SocialContext, TimingEvaluation } from './types';
import { ACTION } from '@/lib/constants/action-constants';
import {
  TIMING_DEFAULT_SCORE,
  TIMING_URGENCY_HIGH,
  TIMING_URGENCY_MEDIUM,
  TIMING_URGENCY_LOW,
  TIMING_URGENCY_VERY_LOW,
  TIMING_URGENCY_MINIMAL,
  TIMING_CREDIBILITY_HIGH,
  TIMING_CREDIBILITY_MEDIUM,
  TIMING_CREDIBILITY_LOW,
  TIMING_CREDIBILITY_VERY_LOW,
  TIMING_CREDIBILITY_MINIMAL,
  TIMING_RISK_HIGH,
  TIMING_RISK_MEDIUM,
  TIMING_RISK_LOW,
  TIMING_RISK_VERY_LOW,
  TIMING_RISK_MINIMAL,
  TIMING_IMPACT_HIGH,
  TIMING_IMPACT_MEDIUM,
  TIMING_IMPACT_LOW,
  TIMING_IMPACT_VERY_LOW,
  TIMING_IMPACT_MINIMAL,
  TIMING_WEIGHT_URGENCY,
  TIMING_WEIGHT_CREDIBILITY,
  TIMING_WEIGHT_RISK,
  TIMING_WEIGHT_IMPACT,
  TIMING_WEIGHT_OPPORTUNITY_COST,
  PROB_THRESHOLD_HIGH,
  PROB_THRESHOLD_MEDIUM,
  PROB_THRESHOLD_LOW,
  CRISIS_THRESHOLD_CRITICAL,
  CRISIS_THRESHOLD_HIGH,
  CRISIS_THRESHOLD_LOW,
  TENSION_THRESHOLD_HIGH,
  INFORMATION_RICHNESS_THRESHOLD,
  INFORMATION_RICHNESS_HIGH,
  TRUST_THRESHOLD_MEDIUM,
  ATTACK_COUNT_THRESHOLD,
} from '@/lib/constants/mind';

export class TimingEvaluator {
  evaluate(
    action: string,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): TimingEvaluation {
    const timing: TimingEvaluation = {
      urgency: TIMING_DEFAULT_SCORE,
      credibility: TIMING_DEFAULT_SCORE,
      risk: TIMING_DEFAULT_SCORE,
      expectedImpact: TIMING_DEFAULT_SCORE,
      opportunityCost: TIMING_DEFAULT_SCORE,
    };

    // 根据行动类型评估时机
    switch (action) {
      case ACTION.CLAIM_IDENTITY:
        this._evaluateClaimIdentity(timing, socialContext, self, belief);
        break;
      case ACTION.ACCUSE:
      case ACTION.SUSPECT:
        this._evaluateAccusation(timing, action, target, socialContext, self, belief);
        break;
      case ACTION.CALL_VOTE:
        this._evaluateCallVote(timing, target, socialContext, self, belief);
        break;
      case ACTION.DEFEND:
      case ACTION.GUARANTEE:
        this._evaluateDefense(timing, action, target, socialContext, self, belief);
        break;
      case ACTION.BLOCK_VOTE:
        this._evaluateBlockVote(timing, target, socialContext, self, belief);
        break;
      case ACTION.EXCLUDE_ALL:
        this._evaluateExcludeAll(timing, socialContext, self, belief);
        break;
      case ACTION.SILENCE:
        this._evaluateSilence(timing, socialContext, self, belief);
        break;
      case ACTION.REBUT:
        this._evaluateRebut(timing, socialContext, self, belief);
        break;
    }

    return timing;
  }

  private _evaluateClaimIdentity(
    timing: TimingEvaluation,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    const { round } = socialContext.situation;
    
    // 紧迫性：验到狼人 → urgency 高；但第一回合 → urgency 低
    const foundWerewolf = socialContext.informationState.knownFacts
      .some(f => f.type === 'check' && (f.content as { result?: string })?.result === 'werewolf');
    
    if (foundWerewolf) {
      timing.urgency = round > 1 ? TIMING_URGENCY_HIGH : TIMING_URGENCY_LOW;
    } else {
      timing.urgency = TIMING_URGENCY_MINIMAL; // 没验到狼人，跳身份意义不大
    }

    // 可信度：已有其他人跳同样身份 → 可信度低
    const sameClaims = socialContext.informationState.knownFacts
      .filter(f => f.type === 'claim' && (f.content as { claimedRole?: string })?.claimedRole === self.role)
      .length;
    timing.credibility = sameClaims > 0 ? TIMING_CREDIBILITY_MINIMAL : TIMING_CREDIBILITY_HIGH;

    // 风险：身份危机高时跳身份风险高
    timing.risk = socialContext.identityCrisis.isCritical ? TIMING_RISK_HIGH : 
                  socialContext.identityCrisis.isHigh ? TIMING_RISK_MEDIUM : TIMING_RISK_LOW;

    // 预期影响力：场上还有多少人没表态
    const aliveCount = Object.keys(socialContext.relationNetwork.myView).length + 1;
    const actedCount = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action').length;
    timing.expectedImpact = actedCount < aliveCount * TIMING_DEFAULT_SCORE ? TIMING_IMPACT_MEDIUM : TIMING_IMPACT_VERY_LOW;

    // 机会成本：不跳身份，还能做什么？
    timing.opportunityCost = foundWerewolf ? TIMING_RISK_HIGH : TIMING_RISK_LOW;
  }

  private _evaluateAccusation(
    timing: TimingEvaluation,
    action: string,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    if (!target) return;

    const targetView = socialContext.relationNetwork.myView.get(target);
    const wolfProb = targetView?.confidence || 0;

    // 紧迫性：目标狼概率高 → 紧迫；但第一回合 → 不紧迫
    timing.urgency = wolfProb > PROB_THRESHOLD_HIGH ? TIMING_IMPACT_HIGH : TIMING_URGENCY_LOW;
    if (socialContext.situation.round === 1) timing.urgency *= TIMING_DEFAULT_SCORE;

    // 可信度：我有证据吗？
    const hasEvidence = socialContext.informationState.knownFacts
      .some(f => f.type === 'check' && (f.content as { targetId?: string })?.targetId === target);
    timing.credibility = hasEvidence ? TIMING_CREDIBILITY_HIGH : TIMING_CREDIBILITY_LOW;

    // 风险：身份危机高时，激进行动风险高
    timing.risk = socialContext.identityCrisis.isCritical ? TIMING_RISK_HIGH : 0.4;

    // 预期影响力：已有多少人怀疑目标
    const existingSuspicion = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action' && (f.content as { targetId?: string })?.targetId === target 
        && ((f.content as { type?: string })?.type === ACTION.SUSPECT || (f.content as { type?: string })?.type === ACTION.ACCUSE))
      .length;
    timing.expectedImpact = existingSuspicion >= ATTACK_COUNT_THRESHOLD ? TIMING_IMPACT_HIGH : TIMING_IMPACT_LOW;

    // 机会成本
    timing.opportunityCost = TIMING_DEFAULT_SCORE;
  }

  private _evaluateCallVote(
    timing: TimingEvaluation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    if (!target) return;

    // 紧迫性：目标已经被多人怀疑 → 紧迫
    const targetSuspicion = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action' && (f.content as { targetId?: string })?.targetId === target
        && ((f.content as { type?: string })?.type === ACTION.SUSPECT || (f.content as { type?: string })?.type === ACTION.ACCUSE))
      .length;
    timing.urgency = targetSuspicion >= ATTACK_COUNT_THRESHOLD ? TIMING_URGENCY_HIGH : TIMING_URGENCY_LOW;

    // 可信度：我有多少信任度
    const myTrust = Array.from(socialContext.relationNetwork.trustNetwork.values())
      .map(m => m.get(self.id) || 0)
      .reduce((a, b) => a + b, 0) / socialContext.relationNetwork.trustNetwork.size;
    timing.credibility = myTrust > 0 ? 0.7 : 0.4;

    // 风险
    timing.risk = socialContext.identityCrisis.isHigh ? TIMING_RISK_MEDIUM : TIMING_RISK_LOW;

    // 预期影响力：已有多少人跟票
    const followers = socialContext.relationNetwork.myView.get(target)?.trust || 0;
    timing.expectedImpact = followers > 0 ? 0.7 : 0.3;

    // 机会成本
    timing.opportunityCost = TIMING_RISK_MEDIUM;
  }

  private _evaluateDefense(
    timing: TimingEvaluation,
    action: string,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    if (!target) return;

    const isSelf = target === self.id;
    const targetView = socialContext.relationNetwork.myView.get(target);

    // 紧迫性：目标被攻击次数
    const attacksOnTarget = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action' && (f.content as { targetId?: string })?.targetId === target
        && ((f.content as { type?: string })?.type === ACTION.SUSPECT || (f.content as { type?: string })?.type === ACTION.ACCUSE))
      .length;
    timing.urgency = attacksOnTarget >= ATTACK_COUNT_THRESHOLD ? TIMING_URGENCY_HIGH : TIMING_DEFAULT_SCORE;

    // 可信度：目标真的是好人吗？
    if (isSelf) {
      timing.credibility = TIMING_CREDIBILITY_HIGH; // 自己知道自己是不是好人
    } else {
      timing.credibility = targetView?.inferredTeam === 'villager' ? TIMING_CREDIBILITY_HIGH : TIMING_CREDIBILITY_VERY_LOW;
    }

    // 风险：保狼人风险高
    timing.risk = targetView?.inferredTeam === 'werewolf' ? TIMING_RISK_HIGH : TIMING_RISK_LOW;

    // 预期影响力
    timing.expectedImpact = TIMING_DEFAULT_SCORE;

    // 机会成本
    timing.opportunityCost = TIMING_IMPACT_VERY_LOW;
  }

  private _evaluateBlockVote(
    timing: TimingEvaluation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    if (!target) return;

    // 紧迫性：目标被多少人号召投票
    const callsOnTarget = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action' && (f.content as { targetId?: string })?.targetId === target
        && (f.content as { type?: string })?.type === ACTION.CALL_VOTE)
      .length;
    timing.urgency = callsOnTarget >= 1 ? TIMING_CREDIBILITY_MEDIUM : TIMING_RISK_LOW;

    // 可信度
    timing.credibility = TIMING_DEFAULT_SCORE;

    // 风险：阻止投票容易被怀疑
    timing.risk = TIMING_RISK_MEDIUM;

    // 预期影响力
    timing.expectedImpact = callsOnTarget >= ATTACK_COUNT_THRESHOLD ? TIMING_IMPACT_MEDIUM : TIMING_CREDIBILITY_MINIMAL;

    // 机会成本
    timing.opportunityCost = TIMING_DEFAULT_SCORE;
  }

  private _evaluateExcludeAll(
    timing: TimingEvaluation,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    // 紧迫性：某身份有多人自称 → 紧迫
    const claims = socialContext.informationState.knownFacts
      .filter(f => f.type === 'claim');
    const roleClaimCounts = new Map<string, number>();
    for (const claim of claims) {
      const role = (claim.content as { claimedRole?: string })?.claimedRole;
      if (role) {
        roleClaimCounts.set(role, (roleClaimCounts.get(role) || 0) + 1);
      }
    }
    const hasConflict = Array.from(roleClaimCounts.values()).some(c => c >= 2);
    timing.urgency = hasConflict ? TIMING_IMPACT_HIGH : TIMING_URGENCY_VERY_LOW;

    // 可信度
    timing.credibility = PROB_THRESHOLD_MEDIUM;

    // 风险：搅浑水风险
    timing.risk = TIMING_DEFAULT_SCORE;

    // 预期影响力
    timing.expectedImpact = hasConflict ? TIMING_IMPACT_MEDIUM : TIMING_URGENCY_VERY_LOW;

    // 机会成本
    timing.opportunityCost = TIMING_IMPACT_VERY_LOW;
  }

  private _evaluateSilence(
    timing: TimingEvaluation,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    // 紧迫性：场面紧张时，沉默可能不好
    timing.urgency = socialContext.situation.tensionLevel > TENSION_THRESHOLD_HIGH ? TIMING_RISK_LOW : PROB_THRESHOLD_MEDIUM;

    // 可信度：沉默没有可信度问题
    timing.credibility = TIMING_CREDIBILITY_HIGH;

    // 风险：身份危机高时，沉默=默认怀疑
    timing.risk = socialContext.identityCrisis.isHigh ? TIMING_DEFAULT_SCORE : TIMING_URGENCY_VERY_LOW;

    // 预期影响力：沉默没有影响力
    timing.expectedImpact = TIMING_URGENCY_VERY_LOW;

    // 机会成本：沉默=放弃机会
    timing.opportunityCost = socialContext.situation.informationRichness < INFORMATION_RICHNESS_THRESHOLD ? TIMING_IMPACT_MEDIUM : TIMING_RISK_LOW;
  }

  private _evaluateRebut(
    timing: TimingEvaluation,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): void {
    // 紧迫性：被攻击时，必须反驳
    const attacksOnMe = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action' && (f.content as { targetId?: string })?.targetId === self.id
        && ((f.content as { type?: string })?.type === ACTION.SUSPECT || (f.content as { type?: string })?.type === ACTION.ACCUSE))
      .length;
    timing.urgency = attacksOnMe >= 1 ? TIMING_URGENCY_HIGH : TIMING_URGENCY_VERY_LOW;

    // 可信度
    timing.credibility = TIMING_CREDIBILITY_MEDIUM;

    // 风险
    timing.risk = socialContext.identityCrisis.isHigh ? TIMING_RISK_MEDIUM : TIMING_RISK_LOW;

    // 预期影响力
    timing.expectedImpact = attacksOnMe >= ATTACK_COUNT_THRESHOLD ? TIMING_IMPACT_MEDIUM : TIMING_DEFAULT_SCORE;

    // 机会成本
    timing.opportunityCost = TIMING_DEFAULT_SCORE;
  }
}

// 计算时机综合分数
export function calculateTimingScore(timing: TimingEvaluation): number {
  return (
    timing.urgency * TIMING_WEIGHT_URGENCY +
    timing.credibility * TIMING_WEIGHT_CREDIBILITY +
    (1 - timing.risk) * TIMING_WEIGHT_RISK +
    timing.expectedImpact * TIMING_WEIGHT_IMPACT +
    timing.opportunityCost * TIMING_WEIGHT_OPPORTUNITY_COST
  );
}
