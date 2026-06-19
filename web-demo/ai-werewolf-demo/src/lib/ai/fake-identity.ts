// ============================
// 伪装身份系统
// 狼人伪装好人身份的动机评分、一致性检查、时机选择
// ============================

import type { Player, FakeIdentity, FakeIdentityState, Role } from '@/types';
import type { BeliefSystem } from './belief-system';
import { getClaimIdentityAlignmentModifier } from './behavior-modifiers';
import {
  FAKE_IDENTITY_SUSPECT_THRESHOLD,
  FAKE_IDENTITY_BASE_SCORE_SUSPECTED,
  FAKE_IDENTITY_BASE_SCORE_DISADVANTAGE,
  FAKE_IDENTITY_BASE_SCORE_PROPHET_NOT_REVEALED,
  FAKE_IDENTITY_BASE_SCORE_HIGH_EXPOSURE,
  FAKE_IDENTITY_BASE_SCORE_HUNTER_SUSPECTED,
  FAKE_IDENTITY_BASE_SCORE_HUNTER_EXPOSURE,
  FAKE_IDENTITY_TIMING_EARLY_ROUND,
  FAKE_IDENTITY_TIMING_LATE_ROUND,
  FAKE_IDENTITY_TIMING_EARLY_PENALTY,
  FAKE_IDENTITY_TIMING_LATE_BONUS,
  FAKE_IDENTITY_TIMING_COMPETITION_PENALTY,
  FAKE_IDENTITY_TIMING_REAL_PROPHET_PENALTY,
  FAKE_IDENTITY_CONSISTENCY_THRESHOLD,
  FAKE_IDENTITY_VIOLATION_NO_CHECKS,
  FAKE_IDENTITY_VIOLATION_NO_SUSPECTS,
  FAKE_IDENTITY_VIOLATION_LATE_CLAIM,
  FAKE_IDENTITY_LATE_CLAIM_ROUND,
  FAKE_IDENTITY_PERCENTAGE_MULTIPLIER,
  WEREWOLF_PROBABILITY_MEDIUM,
} from '@/types';

// ---------- 伪装动机评分 ----------
// 借鉴 CSP4SDG 约束满足：伪装收益 = 基础收益 + 时机收益 + 竞争收益

export interface FakeIdentityMotivation {
  /** 伪装目标角色 */
  targetRole: Role;
  /** 总收益分数 */
  totalScore: number;
  /** 基础收益 */
  baseScore: number;
  /** 时机收益 */
  timingScore: number;
  /** 竞争收益 */
  competitionScore: number;
  /** 阵营倾向收益 */
  alignmentScore: number;
  /** 原因说明 */
  reason: string;
}

/**
 * 计算伪装身份的动机评分
 */
export function calculateFakeIdentityMotivation(
  self: Player,
  allPlayers: Player[],
  belief: BeliefSystem,
  round: number,
  fakeState: FakeIdentityState
): FakeIdentityMotivation[] {
  if (self.team !== 'werewolf') return [];

  const motivations: FakeIdentityMotivation[] = [];
  const aliveWerewolves = allPlayers.filter(p => p.team === 'werewolf' && p.alive).length;
  const aliveVillagers = allPlayers.filter(p => p.team !== 'werewolf' && p.alive).length;
  const isWolfAdvantage = aliveWerewolves >= aliveVillagers;
  const myExposure = belief.getExposure();

  // 伪装预言家
  const prophetMotivation = calculateProphetMotivation(self, allPlayers, belief, round, fakeState, isWolfAdvantage, myExposure, aliveWerewolves, aliveVillagers);
  if (prophetMotivation) motivations.push(prophetMotivation);

  // 伪装猎人
  const hunterMotivation = calculateHunterMotivation(self, allPlayers, belief, round, fakeState, isWolfAdvantage, myExposure);
  if (hunterMotivation) motivations.push(hunterMotivation);

  return motivations.sort((a, b) => b.totalScore - a.totalScore);
}

function calculateProphetMotivation(
  self: Player,
  allPlayers: Player[],
  belief: BeliefSystem,
  round: number,
  fakeState: FakeIdentityState,
  isWolfAdvantage: boolean,
  myExposure: number,
  aliveWerewolves: number,
  aliveVillagers: number
): FakeIdentityMotivation | null {
  // 基础收益
  let baseScore = 0;

  // 被怀疑时伪装预言家（自救）
  const suspectsMe = allPlayers.filter(p =>
    p.alive && p.id !== self.id && belief.getWerewolfProbability(self.id) > WEREWOLF_PROBABILITY_MEDIUM
  ).length;
  if (suspectsMe >= FAKE_IDENTITY_SUSPECT_THRESHOLD) {
    baseScore += FAKE_IDENTITY_BASE_SCORE_SUSPECTED;
  }

  // 己方劣势时伪装预言家（扭转局势）
  if (!isWolfAdvantage && aliveWerewolves < aliveVillagers) {
    baseScore += FAKE_IDENTITY_BASE_SCORE_DISADVANTAGE;
  }

  // 真预言家未跳时伪装预言家（抢身份）
  if (!fakeState.realProphetRevealed && fakeState.claimedProphets.length === 0) {
    baseScore += FAKE_IDENTITY_BASE_SCORE_PROPHET_NOT_REVEALED;
  }

  // 高暴露时伪装预言家（ desperation）
  if (myExposure > WEREWOLF_PROBABILITY_MEDIUM) {
    baseScore += FAKE_IDENTITY_BASE_SCORE_HIGH_EXPOSURE;
  }

  // 时机收益
  let timingScore = 0;
  if (round < FAKE_IDENTITY_TIMING_EARLY_ROUND) {
    timingScore += FAKE_IDENTITY_TIMING_EARLY_PENALTY;
  } else if (round >= FAKE_IDENTITY_TIMING_LATE_ROUND) {
    timingScore += FAKE_IDENTITY_TIMING_LATE_BONUS;
  }

  // 竞争收益（避免撞车）
  let competitionScore = 0;
  if (fakeState.claimedProphets.length > 0) {
    competitionScore += FAKE_IDENTITY_TIMING_COMPETITION_PENALTY;
  }

  // 阵营倾向
  const alignmentScore = getClaimIdentityAlignmentModifier(self.alignment, 'prophet');

  const totalScore = baseScore + timingScore + competitionScore + alignmentScore;
  if (totalScore <= 0) return null;

  return {
    targetRole: 'prophet',
    totalScore,
    baseScore,
    timingScore,
    competitionScore,
    alignmentScore,
    reason: buildProphetMotivationReason(baseScore, timingScore, competitionScore, alignmentScore, suspectsMe, isWolfAdvantage, fakeState),
  };
}

function calculateHunterMotivation(
  self: Player,
  allPlayers: Player[],
  belief: BeliefSystem,
  _round: number,
  _fakeState: FakeIdentityState,
  _isWolfAdvantage: boolean,
  myExposure: number
): FakeIdentityMotivation | null {
  // 猎人伪装收益较低，主要用于混淆视听
  let baseScore = 0;

  // 被怀疑时伪装猎人
  const suspectsMe = allPlayers.filter(p =>
    p.alive && p.id !== self.id && belief.getWerewolfProbability(self.id) > WEREWOLF_PROBABILITY_MEDIUM
  ).length;
  if (suspectsMe >= FAKE_IDENTITY_SUSPECT_THRESHOLD) {
    baseScore += FAKE_IDENTITY_BASE_SCORE_HUNTER_SUSPECTED;
  }

  // 高暴露时伪装猎人
  if (myExposure > WEREWOLF_PROBABILITY_MEDIUM) {
    baseScore += FAKE_IDENTITY_BASE_SCORE_HUNTER_EXPOSURE;
  }

  const alignmentScore = getClaimIdentityAlignmentModifier(self.alignment, 'hunter');
  const totalScore = baseScore + alignmentScore;

  if (totalScore <= 0) return null;

  return {
    targetRole: 'hunter',
    totalScore,
    baseScore,
    timingScore: 0,
    competitionScore: 0,
    alignmentScore,
    reason: `伪装猎人：被${suspectsMe}人怀疑，暴露度${(myExposure * FAKE_IDENTITY_PERCENTAGE_MULTIPLIER).toFixed(0)}%`,
  };
}

function buildProphetMotivationReason(
  baseScore: number,
  timingScore: number,
  competitionScore: number,
  alignmentScore: number,
  suspectsMe: number,
  isWolfAdvantage: boolean,
  _fakeState: FakeIdentityState
): string {
  const reasons: string[] = [];
  if (suspectsMe >= 2) reasons.push(`被${suspectsMe}人怀疑`);
  if (!isWolfAdvantage) reasons.push('己方劣势');
  if (baseScore >= FAKE_IDENTITY_BASE_SCORE_PROPHET_NOT_REVEALED) reasons.push('预言家未跳');
  if (timingScore > 0) reasons.push('时机成熟');
  if (competitionScore < 0) reasons.push('有竞争者');
  if (alignmentScore > 0) reasons.push('阵营倾向');
  return `伪装预言家：${reasons.join('，')}`;
}

// ---------- 一致性检查 ----------
// 借鉴 Revac 记忆画像：伪装者行为需符合声称的身份

export interface ConsistencyCheckResult {
  /** 一致性分数 (0-1) */
  score: number;
  /** 违规列表 */
  violations: string[];
  /** 是否通过检查 */
  passed: boolean;
}

/**
 * 检查伪装者的行为一致性
 */
export function checkFakeIdentityConsistency(
  impersonator: Player,
  fakeIdentity: FakeIdentity,
  allPlayers: Player[],
  publicActions: { actorId: string; type: string; targetId?: string }[]
): ConsistencyCheckResult {
  const violations: string[] = [];
  let score = 1.0;

  // 检查伪装预言家的一致性
  if (fakeIdentity.claimedRole === 'prophet') {
    // 规则1：声称预言家必须有"查验结果"
    const myClaims = publicActions.filter(a =>
      a.actorId === impersonator.id && a.type === 'claim_identity'
    );
    if (myClaims.length > 0 && fakeIdentity.claimedChecks.size === 0) {
      score -= FAKE_IDENTITY_VIOLATION_NO_CHECKS;
      violations.push('声称预言家但没有公布查验结果');
    }

    // 规则2：行为需符合预言家逻辑（积极怀疑高嫌疑玩家）
    const suspectsByMe = publicActions.filter(a =>
      a.actorId === impersonator.id && (a.type === 'suspect' || a.type === 'accuse')
    );
    if (suspectsByMe.length === 0) {
      score -= FAKE_IDENTITY_VIOLATION_NO_SUSPECTS;
      violations.push('预言家没有怀疑任何人');
    }

    // 规则3：查验时机合理性
    const claimRound = fakeIdentity.claimRound;
    if (claimRound > FAKE_IDENTITY_LATE_CLAIM_ROUND && fakeIdentity.claimedChecks.size === 0) {
      score -= FAKE_IDENTITY_VIOLATION_LATE_CLAIM;
      violations.push('跳预言家后没有及时公布查验');
    }
  }

  // 检查伪装猎人的一致性
  if (fakeIdentity.claimedRole === 'hunter') {
    // 猎人被投票出局时应该"开枪"
    // 这个检查在投票阶段执行
  }

  // 更新一致性分数
  fakeIdentity.consistencyScore = Math.max(0, score);

  return {
    score: fakeIdentity.consistencyScore,
    violations,
    passed: fakeIdentity.consistencyScore >= FAKE_IDENTITY_CONSISTENCY_THRESHOLD,
  };
}

// ---------- 时机选择 ----------
// 借鉴 MaKTO 博弈优化

export interface TimingScore {
  /** 时机分数 */
  score: number;
  /** 原因 */
  reason: string;
}

/**
 * 计算跳身份的时机分数
 */
export function calculateTimingScore(
  self: Player,
  allPlayers: Player[],
  belief: BeliefSystem,
  round: number,
  publicActions: { actorId: string; type: string; targetId?: string }[],
  fakeState: FakeIdentityState
): TimingScore {
  let score = 0;
  const reasons: string[] = [];

  // 早期不跳（避免被针对）
  if (round < FAKE_IDENTITY_TIMING_EARLY_ROUND) {
    score += FAKE_IDENTITY_TIMING_EARLY_PENALTY;
    reasons.push('早期不跳');
  }

  // 被多人怀疑时跳（自救）
  const suspectsMe = allPlayers.filter(p =>
    p.alive && p.id !== self.id && belief.getWerewolfProbability(self.id) > WEREWOLF_PROBABILITY_MEDIUM
  ).length;
  if (suspectsMe >= FAKE_IDENTITY_SUSPECT_THRESHOLD) {
    score += FAKE_IDENTITY_BASE_SCORE_SUSPECTED;
    reasons.push(`被${suspectsMe}人怀疑`);
  }

  // 己方劣势时跳（扭转局势）
  const aliveWerewolves = allPlayers.filter(p => p.team === 'werewolf' && p.alive).length;
  const aliveVillagers = allPlayers.filter(p => p.team !== 'werewolf' && p.alive).length;
  if (aliveWerewolves < aliveVillagers) {
    score += FAKE_IDENTITY_BASE_SCORE_DISADVANTAGE;
    reasons.push('己方劣势');
  }

  // 竞争者已跳同一身份（避免撞车）
  if (fakeState.claimedProphets.length > 0) {
    score += FAKE_IDENTITY_TIMING_COMPETITION_PENALTY;
    reasons.push('有竞争者');
  }

  // 真预言家已跳（不能跳了）
  if (fakeState.realProphetRevealed) {
    score += FAKE_IDENTITY_TIMING_REAL_PROPHET_PENALTY;
    reasons.push('真预言家已跳');
  }

  return {
    score,
    reason: reasons.join('，') || '无特殊时机',
  };
}
