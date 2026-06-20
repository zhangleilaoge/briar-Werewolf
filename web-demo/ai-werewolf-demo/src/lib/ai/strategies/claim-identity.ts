// ============================
// 公布身份策略
// 包含伪装身份系统和真预言家策略
// ============================

import type { DecisionCandidate, FakeIdentityState } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import type { Strategy, StrategyContext } from './engine';
import { calculateFakeIdentityMotivation, calculateTimingScore } from '../fake-identity';
import { calculateBehaviorScoreDelta, getClaimIdentityAlignmentModifier } from '../behavior-modifiers';

// ---------- 狼人伪装身份策略 ----------

export const WerewolfFakeIdentityStrategy: Strategy = {
  name: 'werewolf_fake_identity',
  requiredRoles: ['werewolf', 'lone_wolf'],
  requiredPhase: ['day'],
  evaluate(context: StrategyContext): DecisionCandidate[] {
    const { self, allPlayers, belief, publicActions = [], voteRound } = context;
    const result: DecisionCandidate[] = [];

    // 初始化伪装状态
    const fakeState: FakeIdentityState = {
      claims: new Map(),
      realProphetRevealed: publicActions.some(a => a.type === 'claim_identity' && allPlayers.find(p => p.id === a.actorId)?.role === 'prophet'),
      claimedProphets: publicActions.filter(a => a.type === 'claim_identity' && a.details?.claimedRole === 'prophet').map(a => a.actorId),
    };

    // 计算伪装动机
    const motivations = calculateFakeIdentityMotivation(self, allPlayers, belief, voteRound || 1, fakeState);

    for (const motivation of motivations) {
      // 检查是否已经跳过该身份
      const alreadyClaimed = publicActions.some(a =>
        a.actorId === self.id && a.type === ACTION.CLAIM_IDENTITY && a.details?.claimedRole === motivation.targetRole
      );
      if (alreadyClaimed) continue;

      // 计算时机分数
      const timing = calculateTimingScore(self, allPlayers, belief, voteRound || 1, publicActions, fakeState);

      // 阵营倾向修正
      const alignmentMod = getClaimIdentityAlignmentModifier(self.alignment, motivation.targetRole);

      // 基础分数（伪装身份分数要打折，不能和真预言家一样高）
      const baseScore = Math.floor((motivation.totalScore + timing.score) * 0.4);

      // 计算行为修正
      const { scoreDelta, reason: behaviorReason } = calculateBehaviorScoreDelta(self, ACTION.CLAIM_IDENTITY, null, undefined, motivation.targetRole);

      result.push({
        action: ACTION.CLAIM_IDENTITY,
        target: null,
        score: baseScore + scoreDelta,
        confidence: 0.6,
        reason: `伪装${motivation.targetRole === 'prophet' ? '预言家' : '猎人'}：${motivation.reason}${behaviorReason}`,
        strategy: 'WerewolfFakeIdentityStrategy',
        rule: `fake_claim_${motivation.targetRole}`,
        trigger: `伪装动机=${motivation.totalScore}，时机=${timing.score}，阵营=${alignmentMod}`,
        details: { claimedRole: motivation.targetRole, isFake: true },
        stageWeight: 0,
      });
    }

    return result;
  },
};

// ---------- 真预言家策略（mind-driven） ----------

export const RealProphetClaimStrategy: Strategy = {
  name: 'real_prophet_claim',
  requiredRoles: ['prophet'],
  requiredPhase: ['day'],
  evaluate(context: StrategyContext): DecisionCandidate[] {
    const { self, publicActions = [] } = context;
    const result: DecisionCandidate[] = [];

    // 检查是否已经跳过
    const alreadyClaimed = publicActions.some(a =>
      a.actorId === self.id && a.type === ACTION.CLAIM_IDENTITY && a.details?.claimedRole === 'prophet'
    );
    if (alreadyClaimed) return result;

    // 行为修正
    const { scoreDelta, reason: behaviorReason } = calculateBehaviorScoreDelta(self, ACTION.CLAIM_IDENTITY, null, undefined, 'prophet');

    result.push({
      action: ACTION.CLAIM_IDENTITY,
      target: null,
      score: 300 + scoreDelta,
      confidence: 0.9,
      reason: `预言家公布身份${behaviorReason}`,
      strategy: 'RealProphetClaimStrategy',
      rule: 'prophet_claim',
      trigger: 'role=prophet',
      details: { claimedRole: 'prophet', isFake: false },
    });

    return result;
  },
};

// ---------- 真猎人策略（mind-driven） ----------

export const RealHunterClaimStrategy: Strategy = {
  name: 'real_hunter_claim',
  requiredRoles: ['hunter'],
  requiredPhase: ['day'],
  evaluate(context: StrategyContext): DecisionCandidate[] {
    const { self, publicActions = [] } = context;
    const result: DecisionCandidate[] = [];

    // 检查是否已经跳过
    const alreadyClaimed = publicActions.some(a =>
      a.actorId === self.id && a.type === ACTION.CLAIM_IDENTITY && a.details?.claimedRole === 'hunter'
    );
    if (alreadyClaimed) return result;

    // 猎人一般不主动跳，除非有人冒充猎人
    const fakeHunters = publicActions.filter(a =>
      a.type === ACTION.CLAIM_IDENTITY && a.details?.claimedRole === 'hunter' && a.actorId !== self.id
    );

    if (fakeHunters.length > 0) {
      const { scoreDelta, reason: behaviorReason } = calculateBehaviorScoreDelta(self, ACTION.CLAIM_IDENTITY, null, undefined, 'hunter');

      result.push({
        action: ACTION.CLAIM_IDENTITY,
        target: null,
        score: 100 + scoreDelta,
        confidence: 0.8,
        reason: `有人冒充猎人，公布真实身份${behaviorReason}`,
        strategy: 'RealHunterClaimStrategy',
        rule: 'hunter_claim',
        trigger: `假猎人=${fakeHunters.length}`,
        details: { claimedRole: 'hunter', isFake: false },
      });
    }

    return result;
  },
};
