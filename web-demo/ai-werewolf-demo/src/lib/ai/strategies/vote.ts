import {
  SCORE_MAX_INFO_VOTE, SCORE_WEREWOLF_VOTE_DUTY, SCORE_FOLLOW_CALL_VOTE, SCORE_SOCIAL_TIE_BREAKER,
  SCORE_SURVIVAL_VOTE, SCORE_PROPHET_VOTE_DUTY,
  RELATION_MIN, RELATION_MAX, IDENTITY_CRISIS_HIGH_THRESHOLD,
} from '@/types';
import type { Player } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
import type { Strategy } from './engine';
import { CONFIDENCE_VERY_LOW, CONFIDENCE_MEDIUM } from '@/lib/constants/mind';
import { BELIEF_DEFAULT_PROBABILITY } from '@/lib/constants/belief';

// ---------- 查验确认投票（查验到狼人则高权重投） ----------
export const CheckRevelationVoteStrategy: Strategy = {
  name: 'check_revelation_vote',
  requiredRoles: undefined,
  requiredPhase: ['vote'],
  evaluate(context) {
    const { self, belief, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const checks = belief.l0Facts.checks;

    Object.entries(checks).forEach(([targetId, checkResult]) => {
      if (checkResult === 'werewolf') {
        const target = allPlayers.find((p) => p.id === targetId);
        if (target?.alive) {
          const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'vote');
          const isTeammate = self.team === 'werewolf' && target.team === 'werewolf';
          const score = isTeammate
            ? -SCORE_PROPHET_VOTE_DUTY + scoreDelta
            : SCORE_PROPHET_VOTE_DUTY + scoreDelta;
          result.push({
            action: ACTION.VOTE,
            target: targetId,
            score,
            confidence: CONFIDENCE_MEDIUM,
            reason: isTeammate
              ? `L2推断：${target.name}被查验身份危机，作为狼人我需避免投他${reason}`
              : `L0事实：查验到${target.name}是狼人，必须投票淘汰${reason}`,
            strategy: 'CheckRevelationVoteStrategy',
            rule: isTeammate ? 'avoid_exposed_teammate' : 'vote_known_wolf',
            trigger: `l0Facts.checks[${targetId}] = 'werewolf'，self.team=${self.team}`,
          });
        }
      }
    });

    return result;
  },
};

// ---------- 避免投票给队友（狼人：给队友负分数，确保不投队友） ----------
export const AllyProtectionVoteStrategy: Strategy = {
  name: 'ally_protection_vote',
  requiredRoles: undefined,
  requiredPhase: ['vote'],
  evaluate(context) {
    const { self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];

    if (self.team !== 'werewolf') return result;

    const teammates = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team === self.team);
    teammates.forEach((teammate) => {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'vote');
      result.push({
        action: ACTION.VOTE,
        target: teammate.id,
        score: -SCORE_WEREWOLF_VOTE_DUTY + scoreDelta,
        confidence: CONFIDENCE_VERY_LOW,
        reason: `L2推断：${teammate.name}是我的队友，狼人不能投票淘汰队友${reason}`,
        strategy: 'AllyProtectionVoteStrategy',
        rule: 'avoid_teammate',
        trigger: `self.team=${self.team}，${teammate.name}是队友，给负分数避免投票`,
      });
    });

    return result;
  },
};

// ---------- 信息驱动投票（所有角色按嫌疑度投票，狼人反转） ----------
export const MaxInfoVoteStrategy: Strategy = {
  name: 'max_info_vote',
  requiredRoles: undefined,
  requiredPhase: ['vote'],
  evaluate(context) {
    const { self, allPlayers, belief, voteRound, voteCandidates } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    let alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);

    if (voteRound === 2 && voteCandidates) {
      alivePlayers = alivePlayers.filter((p) => voteCandidates.includes(p.id));
    }

    alivePlayers.forEach((target) => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      let baseScore = wolfProb * SCORE_MAX_INFO_VOTE;
      if (self.team === 'werewolf') {
        baseScore = (1 - wolfProb) * SCORE_WEREWOLF_VOTE_DUTY;
      }
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'vote');
      result.push({
        action: ACTION.VOTE,
        target: target.id,
        score: baseScore + scoreDelta,
        confidence: Math.abs(wolfProb - BELIEF_DEFAULT_PROBABILITY),
        reason: self.team === 'werewolf'
          ? `L2伪装：${target.name}嫌疑${(wolfProb * 100).toFixed(0)}%，投低嫌疑目标伪装好人${reason}`
          : wolfProb > 0.55
            ? `L1推理：${target.name}狼嫌疑较高${(wolfProb * 100).toFixed(0)}%${reason}`
            : wolfProb < 0.45
              ? `L1推理：${target.name}看起来比较可信${(wolfProb * 100).toFixed(0)}%${reason}`
              : `L1推理：${target.name}嫌疑度不明${(wolfProb * 100).toFixed(0)}%${reason}`,
        strategy: 'MaxInfoVoteStrategy',
        rule: self.team === 'werewolf' ? 'wolf_camouflage_vote' : 'max_info_vote',
        trigger: `wolfProb=${wolfProb.toFixed(2)}，self.team=${self.team}`,
      });
    });

    return result;
  },
};

// ---------- 跟随号召投票 ----------
export const FollowCallVoteStrategy: Strategy = {
  name: 'follow_call_vote',
  requiredRoles: undefined,
  requiredPhase: ['vote'],
  evaluate(context) {
    const { self, allPlayers, belief, publicActions } = context;
    const result: import('@/types').DecisionCandidate[] = [];

    const calls = (publicActions || []).filter((a) => a.type === ACTION.CALL_VOTE && a.targetId);

    calls.forEach((call) => {
      const caller = allPlayers.find((p) => p.id === call.actorId);
      const callTarget = allPlayers.find((p) => p.id === call.targetId);
      if (!caller || !callTarget?.alive) return;

      const relation = belief.getRelation(caller.id);
      const followScore = ((relation.favor + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * SCORE_FOLLOW_CALL_VOTE;

      if (followScore > (SCORE_FOLLOW_CALL_VOTE / 2)) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'vote');
        result.push({
          action: ACTION.VOTE,
          target: call.targetId!,
          score: followScore + scoreDelta,
          confidence: relation.favor / 10,
          reason: `跟随${caller.name}的号召：投票给${callTarget.name}（好感度${relation.favor.toFixed(1)}）${reason}`,
          strategy: 'FollowCallVoteStrategy',
          rule: 'follow_call',
          trigger: `followScore=${followScore.toFixed(1)}，好感度=${relation.favor.toFixed(1)}`,
        });
      }
    });

    return result;
  },
};

// ---------- 社交投票（关系驱动，打破平局） ----------
export const SocialTieBreakerStrategy: Strategy = {
  name: 'social_tiebreaker',
  requiredRoles: undefined,
  requiredPhase: ['vote'],
  evaluate(context) {
    const { self, allPlayers, belief, voteRound, voteCandidates } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    let alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);

    if (voteRound === 2 && voteCandidates) {
      alivePlayers = alivePlayers.filter((p) => voteCandidates.includes(p.id));
    }

    alivePlayers.forEach((target) => {
      const relation = belief.getRelation(target.id);
      let socialScore = 0;
      if (self.team !== 'werewolf') {
        socialScore = (1 - (relation.favor + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * SCORE_SOCIAL_TIE_BREAKER;
      } else {
        socialScore = ((relation.favor + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * (SCORE_SOCIAL_TIE_BREAKER * 0.75);
      }
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'vote');
      result.push({
        action: ACTION.VOTE,
        target: target.id,
        score: socialScore + scoreDelta,
        confidence: CONFIDENCE_VERY_LOW,
        reason: `L3社交：与${target.name}好感度${relation.favor.toFixed(1)}${reason}`,
        strategy: 'SocialTieBreakerStrategy',
        rule: self.team === 'werewolf' ? 'wolf_deflect_social' : 'social_tiebreaker',
        trigger: `self.team=${self.team}，好感度=${relation.favor.toFixed(1)}`,
      });
    });

    return result;
  },
};

// ---------- 生存投票（身份危机高时寻找安全目标） ----------
export const SurvivalVoteStrategy: Strategy = {
  name: 'survival_vote',
  requiredRoles: undefined,
  requiredPhase: ['vote'],
  evaluate(context) {
    const { self, belief, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const myIdentityCrisis = belief.getPlayerIdentityCrisis(self.id);

    if (myIdentityCrisis > IDENTITY_CRISIS_HIGH_THRESHOLD) {
      const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);
      let safeTargets: Player[];

      if (self.team === 'werewolf') {
        safeTargets = alivePlayers.filter(
          (p) => belief.getWerewolfProbability(p.id) > 0.5 || p.team === self.team
        );
      } else {
        safeTargets = alivePlayers.filter(
          (p) => belief.getWerewolfProbability(p.id) > 0.5
        );
      }

      safeTargets.forEach((target) => {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'vote');
        result.push({
          action: ACTION.VOTE,
          target: target.id,
          score: SCORE_SURVIVAL_VOTE - myIdentityCrisis * SCORE_MAX_INFO_VOTE + scoreDelta,
          confidence: CONFIDENCE_MEDIUM,
          reason: self.team === 'werewolf'
            ? `L2推断：自身被怀疑度${myIdentityCrisis.toFixed(2)}过高，投低嫌疑目标伪装好人${reason}`
            : `L2推断：自身被怀疑度${myIdentityCrisis.toFixed(2)}过高，需投高嫌疑目标证明立场${reason}`,
          strategy: 'SurvivalVoteStrategy',
          rule: self.team === 'werewolf' ? 'wolf_survival_deflect' : 'survival_clear_name',
          trigger: `myIdentityCrisis=${myIdentityCrisis.toFixed(2)} > 阈值=${IDENTITY_CRISIS_HIGH_THRESHOLD}，self.team=${self.team}`,
        });
      });
    }

    return result;
  },
};
