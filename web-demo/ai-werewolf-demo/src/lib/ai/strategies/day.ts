import {
  SCORE_SPEAK_BREAK_SILENCE, SCORE_SPEAK_DEFAULT, SCORE_WEREWOLF_KILL_BASE,
  WEREWOLF_PROBABILITY_HIGH, WEREWOLF_PROBABILITY_LOW, EXPOSURE_HIGH_THRESHOLD,
  SCORE_BERSERKER_SUICIDE, SCORE_MAX_INFO_VOTE, RELATION_MAX, SILENCE_NEAR_FULL_THRESHOLD,
  SCORE_WEREWOLF_VOTE_DUTY,
} from '../constants';
import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
import type { Strategy, StrategyContext } from './engine';

// ---------- Villager: Day Speak / Suspect / Defend ----------
export const VillagerDayStrategy: Strategy = {
  name: 'villager_day',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const aliveTargets = allPlayers.filter((p) => p.id !== self.id && p.alive);
    const topSuspect = belief.getSuspectRanking(allPlayers)[0];

    // If everyone is silent, someone should speak to avoid forced vote
    if (consecutiveSilence && aliveCount && consecutiveSilence >= aliveCount - SILENCE_NEAR_FULL_THRESHOLD) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'speak', null);
      result.push({
        action: 'speak',
        target: null,
        score: SCORE_SPEAK_BREAK_SILENCE + scoreDelta,
        confidence: 0.7,
        reason: `即将全员沉默，必须打破沉默！${reason}`,
      });
    }

    // If high suspect exists, accuse or suspect
    if (topSuspect && topSuspect.werewolfProb > WEREWOLF_PROBABILITY_HIGH) {
      const target = allPlayers.find((p) => p.id === topSuspect.id);
      if (target) {
        const { scoreDelta: scoreDeltaAccuse, reason: reasonAccuse } = calculateBehaviorScoreDelta(self, 'accuse', topSuspect.id);
        result.push({
          action: 'accuse',
          target: topSuspect.id,
          score: topSuspect.werewolfProb * SCORE_MAX_INFO_VOTE + scoreDeltaAccuse,
          confidence: topSuspect.werewolfProb,
          reason: `强烈指认${target.name}是狼人！狼嫌疑${(topSuspect.werewolfProb * SCORE_MAX_INFO_VOTE).toFixed(0)}%${reasonAccuse}`,
        });
        const { scoreDelta: scoreDeltaSuspect, reason: reasonSuspect } = calculateBehaviorScoreDelta(self, 'suspect', topSuspect.id);
        result.push({
          action: 'suspect',
          target: topSuspect.id,
          score: topSuspect.werewolfProb * (SCORE_MAX_INFO_VOTE * 0.6) + scoreDeltaSuspect,
          confidence: topSuspect.werewolfProb * 0.8,
          reason: `怀疑${target.name}，狼嫌疑${(topSuspect.werewolfProb * SCORE_MAX_INFO_VOTE).toFixed(0)}%${reasonSuspect}`,
        });
      }
    }

    // Defend someone with high friendly
    Object.entries(belief.l3Social.relations).forEach(([otherId, rel]) => {
      if (rel.friendly > (RELATION_MAX / 2) && rel.trust > (RELATION_MAX / 3)) {
        const target = allPlayers.find((p) => p.id === otherId);
        if (target?.alive) {
          const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'defend', otherId, rel);
          result.push({
            action: 'defend',
            target: otherId,
            score: rel.friendly * (RELATION_MAX / 2) + rel.trust * (RELATION_MAX / 3) + scoreDelta,
            confidence: 0.6,
            reason: `袒护${target.name}，关系友好${rel.friendly.toFixed(1)}${reason}`,
          });
        }
      }
    });

    // Default speak
    if (result.length === 0) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'speak', null);
      result.push({
        action: 'speak',
        target: null,
        score: SCORE_SPEAK_DEFAULT + scoreDelta,
        confidence: 0.3,
        reason: `目前没什么线索，先观察一下${reason}`,
      });
    }

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Werewolf: Day Camouflage ----------
export const WerewolfCamouflageStrategy: Strategy = {
  name: 'werewolf_camouflage',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const aliveTargets = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');

    // If almost silent, must speak
    if (consecutiveSilence && aliveCount && consecutiveSilence >= aliveCount - SILENCE_NEAR_FULL_THRESHOLD) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'speak', null);
      result.push({
        action: 'speak',
        target: null,
        score: SCORE_WEREWOLF_VOTE_DUTY + 5 + scoreDelta,
        confidence: 0.7,
        reason: `即将全员沉默，必须打破沉默保持低调${reason}`,
      });
    }

    // Pretend to suspect a low-probability villager
    aliveTargets.forEach((target) => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      if (wolfProb < WEREWOLF_PROBABILITY_LOW) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'suspect', target.id);
        result.push({
          action: 'suspect',
          target: target.id,
          score: SCORE_WEREWOLF_VOTE_DUTY / 2 + (1 - wolfProb) * (SCORE_WEREWOLF_VOTE_DUTY / 2) + scoreDelta,
          confidence: 0.6,
          reason: `我觉得${target.name}有点可疑，大家注意观察${reason}`,
        });
      }
    });

    // Defend a teammate if exposed
    const teammates = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team === 'werewolf');
    teammates.forEach((teammate) => {
      const exposure = Object.values(belief.l2TheoryOfMind.othersBeliefs).reduce(
        (sum, b) => sum + (b[teammate.id] ?? 0), 0
      );
      if (exposure > EXPOSURE_HIGH_THRESHOLD) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'defend', teammate.id);
        result.push({
          action: 'defend',
          target: teammate.id,
          score: SCORE_WEREWOLF_KILL_BASE + 10 + scoreDelta,
          confidence: 0.6,
          reason: `袒护队友${teammate.name}，降低其暴露风险${reason}`,
        });
      }
    });

    if (result.length === 0) {
      const random = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      if (random) {
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'speak', random.id);
        result.push({
          action: 'speak',
          target: random.id,
          score: SCORE_WEREWOLF_KILL_BASE - 20 + scoreDelta,
          confidence: 0.5,
          reason: `我也没什么头绪，先看看大家怎么说${reason}`,
        });
      }
    }

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Prophet: Claim Check Results ----------
export const ProphetClaimStrategy: Strategy = {
  name: 'prophet_claim',
  requiredRoles: ['prophet'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, allPlayers } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const checks = belief.l0Facts.checks;

    for (const [targetId, checkResult] of Object.entries(checks)) {
      if (checkResult === 'werewolf') {
        const target = allPlayers.find((p) => p.id === targetId);
        if (target?.alive) {
          result.push({
            action: 'claim_identity',
            target: targetId,
            score: SCORE_MAX_INFO_VOTE,
            confidence: 1.0,
            reason: `公布查验结果：${target.name} 是狼人`,
            details: { claimedRole: 'prophet', checkResult, checkTarget: targetId },
          });
          break; // Only announce first wolf found
        }
      }
    }

    return result;
  },
};

// ---------- Berserker: Suicide Kill ----------
export const BerserkerSuicideStrategy: Strategy = {
  name: 'berserker_suicide',
  requiredRoles: ['berserker'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');
    const werewolfCount = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
    const villagerCount = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;

    if (werewolfCount < villagerCount && werewolfCount <= 2) {
      alivePlayers.forEach((target) => {
        const claims = belief.l0Facts.publicClaims.filter((c) => c.playerId === target.id);
        if (claims.length > 0) {
          result.push({
            action: 'berserker_kill',
            target: target.id,
            score: SCORE_BERSERKER_SUICIDE,
            confidence: 0.8,
            reason: `狼队劣势(${werewolfCount} vs ${villagerCount})，${target.name}疑似神职，同归于尽`,
          });
        }
      });
    }

    return result;
  },
};
