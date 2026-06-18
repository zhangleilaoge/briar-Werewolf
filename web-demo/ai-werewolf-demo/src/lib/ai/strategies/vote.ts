import {
  SCORE_MAX_INFO_VOTE, SCORE_WEREWOLF_VOTE_DUTY, SCORE_FOLLOW_CALL_VOTE, SCORE_SOCIAL_TIE_BREAKER,
  SCORE_SURVIVAL_VOTE, SCORE_PROPHET_VOTE_DUTY, WEREWOLF_PROBABILITY_HIGH, WEREWOLF_PROBABILITY_MEDIUM,
  RELATION_MIN, RELATION_MAX, EXPOSURE_HIGH_THRESHOLD, EXPOSURE_CRITICAL_THRESHOLD,
} from '../constants';
import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
import type { Strategy, StrategyContext } from './engine';

// ---------- Prophet: Vote Duty (vote for known wolf) ----------
export const ProphetVoteDutyStrategy: Strategy = {
  name: 'prophet_vote_duty',
  requiredRoles: ['prophet'],
  requiredPhase: ['vote'],
  evaluate(context) {
    const { belief, allPlayers } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const checks = belief.l0Facts.checks;

    Object.entries(checks).forEach(([targetId, checkResult]) => {
      if (checkResult === 'werewolf') {
        const target = allPlayers.find((p) => p.id === targetId);
        if (target?.alive) {
          const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'vote', targetId);
          result.push({
            action: 'vote',
            target: targetId,
            score: SCORE_PROPHET_VOTE_DUTY + scoreDelta,
            confidence: 1.0,
            reason: `L0事实：查验到${target.name}是狼人，职业义务优先淘汰${reason}`,
            strategy: 'ProphetVoteDutyStrategy',
            rule: 'vote_known_wolf',
            trigger: `l0Facts.checks[${targetId}] = 'werewolf' 且目标存活`,
          });
        }
      }
    });

    return result;
  },
};

// ---------- Werewolf: Vote Duty (protect teammate) ----------
export const WerewolfVoteDutyStrategy: Strategy = {
  name: 'werewolf_vote_duty',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote'],
  evaluate(context) {
    const { belief, allPlayers } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const teammates = allPlayers.filter((p) => p.id !== context.self.id && p.alive && p.team === 'werewolf');

    teammates.forEach((teammate) => {
      const exposure = belief.getPlayerExposure(teammate.id);
      if (exposure > EXPOSURE_CRITICAL_THRESHOLD) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'vote', teammate.id);
        result.push({
          action: 'vote',
          target: teammate.id,
          score: SCORE_WEREWOLF_VOTE_DUTY + scoreDelta,
          confidence: 0.8,
          reason: `L2推断：队友${teammate.name}暴露风险极高，倒钩保自己${reason}`,
          strategy: 'WerewolfVoteDutyStrategy',
          rule: 'protect_teammate',
          trigger: `队友暴露度=${exposure.toFixed(2)} > 阈值=${EXPOSURE_CRITICAL_THRESHOLD}`,
        });
      }
    });

    return result;
  },
};

// ---------- Information-Based Vote ----------
export const MaxInfoVoteStrategy: Strategy = {
  name: 'max_info_vote',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote'],
  evaluate(context) {
    const { belief, self, allPlayers, voteRound, voteCandidates } = context;
    const result: import('../types').DecisionCandidate[] = [];
    let alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);

    // Round 2: only candidates
    if (voteRound === 2 && voteCandidates) {
      alivePlayers = alivePlayers.filter((p) => voteCandidates.includes(p.id));
    }

    alivePlayers.forEach((target) => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      let score = wolfProb * SCORE_MAX_INFO_VOTE;
      // For wolves, invert: vote for least suspicious to deflect
      if (context.self.team === 'werewolf') {
        score = (1 - wolfProb) * SCORE_WEREWOLF_VOTE_DUTY;
      }
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'vote', target.id);
      result.push({
        action: 'vote',
        target: target.id,
        score: score + scoreDelta,
        confidence: wolfProb,
        reason: wolfProb > 0.5 ? `L1推理：${target.name}狼嫌疑${(wolfProb * 100).toFixed(0)}%${reason}` : `L1推理：${target.name}相对安全${reason}`,
        strategy: 'MaxInfoVoteStrategy',
        rule: context.self.team === 'werewolf' ? 'deflect_vote' : 'max_info_vote',
        trigger: `wolfProb=${wolfProb.toFixed(2)}，${context.self.team === 'werewolf' ? '狼人反转投票' : '村民按嫌疑投票'}`,
      });
    });

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Follow Call Vote (follow trusted player's call) ----------
export const FollowCallVoteStrategy: Strategy = {
  name: 'follow_call_vote',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote'],
  evaluate(context) {
    const { belief, self, allPlayers, publicActions } = context;
    const result: import('../types').DecisionCandidate[] = [];

    // Find all call_vote actions in this round's public actions
    const calls = (publicActions || []).filter(
      (a) => a.type === 'call_vote' && a.targetId
    );

    calls.forEach((call) => {
      const caller = allPlayers.find((p) => p.id === call.actorId);
      const callTarget = allPlayers.find((p) => p.id === call.targetId);
      if (!caller || !callTarget || !callTarget.alive) return;

      const relation = belief.getRelation(caller.id);
      // Higher trust/friendly -> more likely to follow
      const followScore = ((relation.trust + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * SCORE_FOLLOW_CALL_VOTE + ((relation.friendly + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * (SCORE_FOLLOW_CALL_VOTE / 2);
      if (followScore > (SCORE_FOLLOW_CALL_VOTE / 2)) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'vote', call.targetId!);
        result.push({
          action: 'vote',
          target: call.targetId!,
          score: followScore + scoreDelta,
          confidence: relation.trust / 10,
          reason: `跟随${caller.name}的号召：${caller.name}号召投票给${callTarget.name}（信任${relation.trust.toFixed(1)}）${reason}`,
          strategy: 'FollowCallVoteStrategy',
          rule: 'follow_call',
          trigger: `followScore=${followScore.toFixed(1)} > 阈值=${(SCORE_FOLLOW_CALL_VOTE / 2).toFixed(1)}，信任度=${relation.trust.toFixed(1)}`,
        });
      }
    });

    return result;
  },
};

// ---------- Social Tie-Breaker Vote ----------
export const SocialTieBreakerStrategy: Strategy = {
  name: 'social_tiebreaker',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote'],
  evaluate(context) {
    const { belief, self, allPlayers, voteRound, voteCandidates } = context;
    const result: import('../types').DecisionCandidate[] = [];
    let alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);

    if (voteRound === 2 && voteCandidates) {
      alivePlayers = alivePlayers.filter((p) => voteCandidates.includes(p.id));
    }

    alivePlayers.forEach((target) => {
      const relation = belief.getRelation(target.id);
      let socialScore = 0;
      // Low trust/friendly -> more likely to vote against
      if (self.team !== 'werewolf') {
        socialScore = (1 - (relation.friendly + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * (SCORE_SOCIAL_TIE_BREAKER / 2) + (1 - (relation.trust + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * (SCORE_SOCIAL_TIE_BREAKER / 2);
      } else {
        // Wolves: vote for low-suspicion targets to deflect, or high friendly to seem good
        socialScore = ((relation.friendly + RELATION_MAX) / (RELATION_MAX - RELATION_MIN)) * (SCORE_SOCIAL_TIE_BREAKER * 0.75);
      }
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'vote', target.id);
      result.push({
        action: 'vote',
        target: target.id,
        score: socialScore + scoreDelta,
        confidence: 0.3,
        reason: `L3社交：与${target.name}信任${relation.trust.toFixed(1)}友好${relation.friendly.toFixed(1)}${reason}`,
        strategy: 'SocialTieBreakerStrategy',
        rule: self.team === 'werewolf' ? 'wolf_deflect_social' : 'social_tiebreaker',
        trigger: `self.team=${self.team}，信任=${relation.trust.toFixed(1)}，友好=${relation.friendly.toFixed(1)}`,
      });
    });

    return result;
  },
};

// ---------- Survival Vote (for wolves under suspicion) ----------
export const SurvivalVoteStrategy: Strategy = {
  name: 'survival_vote',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote'],
  evaluate(context) {
    const { belief, self, allPlayers } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const myExposure = belief.getPlayerExposure(self.id);

    if (myExposure > EXPOSURE_HIGH_THRESHOLD) {
      const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);
      const safeTargets = alivePlayers.filter(
        (p) => belief.getWerewolfProbability(p.id) > WEREWOLF_PROBABILITY_MEDIUM || p.team === 'werewolf'
      );
      safeTargets.forEach((target) => {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'vote', target.id);
        result.push({
          action: 'vote',
          target: target.id,
          score: SCORE_SURVIVAL_VOTE - myExposure * SCORE_MAX_INFO_VOTE + scoreDelta,
          confidence: 0.6,
          reason: `L2推断：自己被怀疑度${myExposure.toFixed(2)}过高，需做低嫌疑行为${reason}`,
          strategy: 'SurvivalVoteStrategy',
          rule: 'survival_deflect',
          trigger: `myExposure=${myExposure.toFixed(2)} > 阈值=${EXPOSURE_HIGH_THRESHOLD}`,
        });
      });
    }

    return result;
  },
};
