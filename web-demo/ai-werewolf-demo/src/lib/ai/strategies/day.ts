import {
  SILENCE_NEAR_FULL_THRESHOLD,
  SCORE_BREAK_SILENCE,
  SCORE_WW_BREAK_SILENCE,
} from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import type { Strategy } from './engine';
import type { Player } from '@/types';
import { canUseItem } from '@/types';
import { SocialContextBuilder, ValueSystemFactory, CandidateGenerator } from '../mind';
import { CONFIDENCE_MEDIUM_HIGH, CONFIDENCE_VERY_LOW, CONFIDENCE_HIGH } from '@/lib/constants/mind';

// ---------- Shared Helper: Break silence candidate ----------
function generateBreakSilenceCandidate(
  consecutiveSilence: number | undefined,
  aliveCount: number | undefined,
  strategyName: string,
  score: number,
  reason: string,
): import('@/types').DecisionCandidate | null {
  if (
    consecutiveSilence &&
    aliveCount &&
    consecutiveSilence >= aliveCount - SILENCE_NEAR_FULL_THRESHOLD
  ) {
    return {
      action: ACTION.SILENCE,
      target: null,
      score,
      confidence: CONFIDENCE_MEDIUM_HIGH,
      reason,
      strategy: strategyName,
      rule: 'break_silence',
      trigger: `consecutiveSilence=${consecutiveSilence} >= aliveCount-${SILENCE_NEAR_FULL_THRESHOLD}=${aliveCount - SILENCE_NEAR_FULL_THRESHOLD}`,
    };
  }
  return null;
}

// ---------- Shared Helper: Default behavior fallback ----------
function _generateDefaultCandidates(
  self: Player,
  allPlayers: Player[],
  publicActions:
    | { actorId: string; type: string; targetId?: string }[]
    | undefined,
  strategyName: string,
  scores: {
    round1Observe: number;
    otherObserve: number;
  },
  reasons: {
    round1Observe: string;
    otherObserve: string;
  },
): import('@/types').DecisionCandidate[] {
  const result: import('@/types').DecisionCandidate[] = [];
  const aliveOthers = allPlayers.filter((p) => p.id !== self.id && p.alive);
  const randomTarget =
    aliveOthers.length > 0
      ? aliveOthers[Math.floor(Math.random() * aliveOthers.length)]
      : null;
  const isRound1 =
    (publicActions?.filter(
      (a) =>
        a.type === ACTION.SILENCE ||
        a.type === ACTION.SUSPECT ||
        a.type === ACTION.ACCUSE ||
        a.type === ACTION.DEFEND,
    ).length ?? 0) < 3;

  if (randomTarget) {
    result.push({
      action: ACTION.OBSERVE,
      target: randomTarget.id,
      score: isRound1 ? scores.round1Observe : scores.otherObserve,
      stageWeight: 0,
      confidence: CONFIDENCE_VERY_LOW,
      reason: isRound1
        ? reasons.round1Observe.replace('{name}', randomTarget.name)
        : reasons.otherObserve.replace('{name}', randomTarget.name),
      strategy: strategyName,
      rule: isRound1 ? 'default_round1_observe' : 'default_other_observe',
      trigger: isRound1
        ? '无更高优先级规则命中，且为第一轮'
        : '无更高优先级规则命中',
      random: true,
    });
  }

  return result;
}

// ---------- Villager Day Strategy (mind-driven) ----------
export const VillagerDayStrategy: Strategy = {
  name: 'villager_day',
  requiredRoles: undefined,
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount, publicActions } = context;

    // 意图系统硬约束：此策略专为非狼人设计
    if (self.team === 'werewolf') return [];

    // 使用动态意图生成器
    const socialContextBuilder = new SocialContextBuilder();
    const socialContext = socialContextBuilder.build(
      belief,
      self,
      allPlayers,
      publicActions || [],
      1,
    );

    const valueSystemFactory = new ValueSystemFactory();
    const valueSystem = valueSystemFactory.create(self);

    const candidateGenerator = new CandidateGenerator();
    const candidates = candidateGenerator.generate(
      socialContext,
      valueSystem,
      self,
      allPlayers,
      belief,
      false,
    );

    // 添加打破沉默
    const breakSilence = generateBreakSilenceCandidate(
      consecutiveSilence,
      aliveCount,
      'VillagerDayStrategy',
      SCORE_BREAK_SILENCE,
      '快全员沉默了，我必须说点什么推动讨论。',
    );
    if (breakSilence) candidates.push(breakSilence);

    return candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
  },
};

// ---------- Werewolf Camouflage Strategy (mind-driven) ----------
export const WerewolfCamouflageStrategy: Strategy = {
  name: 'werewolf_camouflage',
  requiredRoles: undefined,
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount, publicActions } = context;

    // 意图系统硬约束：此策略专为狼人设计
    if (self.team !== 'werewolf') return [];

    // 使用动态意图生成器
    const socialContextBuilder = new SocialContextBuilder();
    const socialContext = socialContextBuilder.build(
      belief,
      self,
      allPlayers,
      publicActions || [],
      1,
    );

    const valueSystemFactory = new ValueSystemFactory();
    const valueSystem = valueSystemFactory.create(self);

    const candidateGenerator = new CandidateGenerator();
    const candidates = candidateGenerator.generate(
      socialContext,
      valueSystem,
      self,
      allPlayers,
      belief,
      true,
    );

    // 添加打破沉默
    const breakSilence = generateBreakSilenceCandidate(
      consecutiveSilence,
      aliveCount,
      'WerewolfCamouflageStrategy',
      SCORE_WW_BREAK_SILENCE,
      '快全员沉默了，我得当个好人样打破沉默。',
    );
    if (breakSilence) candidates.push(breakSilence);

    return candidates.sort((a, b) => (b.score || 0) - (a.score || 0));
  },
};

// ---------- Berserker: Suicide Kill ----------
export const BerserkerSuicideStrategy: Strategy = {
  name: 'berserker_suicide',
  requiredRoles: undefined,
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    // 狂狼同归于尽需要双刃剑，且只对狼人阵营有意义
    if (self.team !== 'werewolf' || !canUseItem(self, 'double_sword')) return result;

    const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');
    const werewolfCount = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
    const villagerCount = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;

    if (werewolfCount < villagerCount && werewolfCount <= 2) {
      alivePlayers.forEach((target) => {
        const claims = belief.l0Facts.publicClaims.filter((c) => c.playerId === target.id);
        if (claims.length > 0) {
          result.push({
            action: ACTION.BERSERKER_KILL,
            target: target.id,
            score: 500,
            confidence: CONFIDENCE_HIGH,
            reason: `狼队劣势(${werewolfCount} vs ${villagerCount})，${target.name}疑似神职，同归于尽。`,
            strategy: 'BerserkerSuicideStrategy',
            rule: 'suicide_kill',
            trigger: `werewolfCount=${werewolfCount} < villagerCount=${villagerCount} 且 werewolfCount <= 2，目标 claims.length=${claims.length} > 0`,
          });
        }
      });
    }

    return result;
  },
};
