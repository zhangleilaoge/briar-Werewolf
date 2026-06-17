import type { BeliefSystem } from './belief-system';
import type { Player, DecisionCandidate, DecisionResult } from './types';

interface StrategyConfig {
  priorityOrder: string[];
  dutyWeight: number;
  survivalWeight: number;
  infoWeight: number;
  socialWeight: number;
}

interface Strategy {
  name: string;
  requiredRoles?: string[];
  requiredPhase?: string[];
  evaluate(belief: BeliefSystem, availableActions: unknown[], allPlayers: Player[], config: StrategyConfig): DecisionCandidate[];
}

export class DecisionEngine {
  config: StrategyConfig;
  strategies: Record<string, Strategy[]>;

  constructor(aiConfig: Partial<StrategyConfig> = {}) {
    this.config = {
      priorityOrder: ['duty', 'survival', 'information', 'social'],
      dutyWeight: 1000,
      survivalWeight: 800,
      infoWeight: 500,
      socialWeight: 100,
      ...aiConfig,
    };

    this.strategies = {
      duty: [],
      survival: [],
      information: [],
      social: [],
    };
  }

  registerStrategy(category: string, strategy: Strategy) {
    if (this.strategies[category]) {
      this.strategies[category].push(strategy);
    }
  }

  decide(belief: BeliefSystem, phase: string, availableActions: unknown[], allPlayers: Player[]): DecisionResult {
    const candidates: DecisionCandidate[] = [];

    for (const stage of this.config.priorityOrder) {
      const stageStrategies = this.strategies[stage] || [];

      for (const strategy of stageStrategies) {
        if (strategy.requiredPhase && !strategy.requiredPhase.includes(phase)) continue;
        if (strategy.requiredRoles && !strategy.requiredRoles.includes(belief.l0Facts.myRole ?? '')) continue;

        const result = strategy.evaluate(belief, availableActions, allPlayers, this.config);

        if (result && result.length > 0) {
          result.forEach((r) => {
            candidates.push({ ...r, stageWeight: this._getStageWeight(stage), stage });
          });

          if ((stage === 'duty' || stage === 'survival') && result.length === 1) {
            return this._finalizeDecision(result[0], belief, stage);
          }
        }
      }
    }

    if (candidates.length === 0) {
      return this._defaultDecision(belief, availableActions, allPlayers);
    }

    const scored = candidates
      .map((c) => ({ ...c, totalScore: (c.score || 0) + (c.stageWeight || 0) }))
      .sort((a, b) => b.totalScore - a.totalScore);

    return this._finalizeDecision(scored[0], belief, scored[0].stage || 'default');
  }

  private _getStageWeight(stage: string): number {
    switch (stage) {
      case 'duty': return this.config.dutyWeight;
      case 'survival': return this.config.survivalWeight;
      case 'information': return this.config.infoWeight;
      case 'social': return this.config.socialWeight;
      default: return 0;
    }
  }

  private _finalizeDecision(candidate: DecisionCandidate, belief: BeliefSystem, stage: string): DecisionResult {
    return {
      action: candidate.action,
      target: candidate.target,
      reason: candidate.reason,
      stage,
      confidence: candidate.confidence || 0.7,
      emotionalTone: this._getEmotionalTone(belief, candidate.target, stage),
    };
  }

  private _getEmotionalTone(belief: BeliefSystem, targetId: string | null, stage: string): string {
    if (!targetId || stage === 'duty') return 'neutral';
    const relation = belief.getRelation(targetId);
    if (relation.friendly > 0.5) return 'reluctant';
    if (relation.friendly < -0.5) return 'firm';
    return 'neutral';
  }

  private _defaultDecision(belief: BeliefSystem, _availableActions: unknown[], allPlayers: Player[]): DecisionResult {
    const alivePlayers = allPlayers.filter((p) => p.id !== belief.playerId && p.alive);
    const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    return {
      action: 'vote',
      target: randomTarget?.id || null,
      reason: 'default_random',
      stage: 'default',
      confidence: 0.3,
      emotionalTone: 'neutral',
    };
  }
}

// ==================== Built-in Strategies ====================

export const ProphetDutyStrategy: Strategy = {
  name: 'prophet_check_duty',
  requiredRoles: ['prophet'],
  requiredPhase: ['vote', 'day'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const checks = belief.l0Facts.checks;
    Object.entries(checks).forEach(([targetId, checkResult]) => {
      if (checkResult === 'werewolf') {
        const target = allPlayers.find((p) => p.id === targetId);
        if (target?.alive) {
          result.push({
            action: 'vote',
            target: targetId,
            score: 100,
            confidence: 1.0,
            reason: `L0事实：查验到${target.name}是狼人，职业义务优先淘汰`,
          });
        }
      }
    });
    return result;
  },
};

export const WerewolfDutyStrategy: Strategy = {
  name: 'werewolf_team_duty',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote', 'day'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const teammates = allPlayers.filter((p) => p.id !== belief.playerId && p.alive && p.team === 'werewolf');
    teammates.forEach((teammate) => {
      const exposure = Object.values(belief.l2TheoryOfMind.othersBeliefs).reduce((sum, b) => sum + (b[teammate.id] ?? 0), 0);
      if (exposure > 0.7) {
        result.push({
          action: 'vote',
          target: teammate.id,
          score: 80,
          confidence: 0.8,
          reason: `L2推断：队友${teammate.name}暴露风险极高，倒钩保自己`,
        });
      }
    });
    return result;
  },
};

export const WerewolfKillStrategy: Strategy = {
  name: 'werewolf_kill',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['night'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const aliveTargets = allPlayers.filter((p) => p.id !== belief.playerId && p.alive && p.team !== 'werewolf');
    aliveTargets.forEach((target) => {
      const claims = belief.l0Facts.publicClaims.filter((c) => c.playerId === target.id);
      const isLikelyGod = claims.length > 0 || (belief.l2TheoryOfMind.othersKnowMyRole[target.id] ?? 0) > 0.5;
      let score = 50;
      if (isLikelyGod) score += 30;
      if (belief.getWerewolfProbability(target.id) < 0.3) score += 10;
      result.push({
        action: 'kill',
        target: target.id,
        score,
        confidence: isLikelyGod ? 0.7 : 0.5,
        reason: isLikelyGod ? `L2推断：${target.name}疑似神职，优先击杀` : `击杀${target.name}`,
      });
    });
    return result.sort((a, b) => b.score - a.score);
  },
};

export const SurvivalStrategy: Strategy = {
  name: 'exposure_avoidance',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote', 'day'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const myExposure = Object.values(belief.l2TheoryOfMind.othersBeliefs).reduce((sum, b) => sum + (b[belief.playerId] ?? 0), 0) /
      Math.max(1, Object.keys(belief.l2TheoryOfMind.othersBeliefs).length);
    if (myExposure > 0.6) {
      const alivePlayers = allPlayers.filter((p) => p.id !== belief.playerId && p.alive);
      const safeTargets = alivePlayers.filter((p) => belief.getWerewolfProbability(p.id) > 0.5 || p.team === 'werewolf');
      safeTargets.forEach((target) => {
        result.push({
          action: 'vote',
          target: target.id,
          score: 70 - myExposure * 20,
          confidence: 0.6,
          reason: `L2推断：自己被怀疑度${myExposure.toFixed(2)}过高，需做低嫌疑行为`,
        });
      });
    }
    return result;
  },
};

export const MaxInfoVoteStrategy: Strategy = {
  name: 'max_info_vote',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner'],
  requiredPhase: ['vote'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const alivePlayers = allPlayers.filter((p) => p.id !== belief.playerId && p.alive);
    alivePlayers.forEach((target) => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      result.push({
        action: 'vote',
        target: target.id,
        score: wolfProb * 100,
        confidence: wolfProb,
        reason: wolfProb > 0.5 ? `L1推理：${target.name}狼嫌疑${(wolfProb * 100).toFixed(0)}%` : `L1推理：${target.name}相对安全`,
      });
    });
    return result.sort((a, b) => b.score - a.score);
  },
};

export const SocialTieBreakerStrategy: Strategy = {
  name: 'social_tiebreaker',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const alivePlayers = allPlayers.filter((p) => p.id !== belief.playerId && p.alive);
    alivePlayers.forEach((target) => {
      const relation = belief.getRelation(target.id);
      const socialScore = (1 - relation.friendly) * 10;
      result.push({
        action: 'vote',
        target: target.id,
        score: socialScore,
        confidence: 0.3,
        reason: `L3社交：与${target.name}关系值${relation.friendly.toFixed(2)}`,
      });
    });
    return result;
  },
};

export const ProphetCheckStrategy: Strategy = {
  name: 'prophet_night_check',
  requiredRoles: ['prophet'],
  requiredPhase: ['night'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const alivePlayers = allPlayers.filter((p) => p.id !== belief.playerId && p.alive);
    alivePlayers.forEach((target) => {
      if (belief.l0Facts.checks[target.id] !== undefined) return;
      const wolfProb = belief.getWerewolfProbability(target.id);
      result.push({
        action: 'check',
        target: target.id,
        score: wolfProb * 100 + 50,
        confidence: 0.7,
        reason: `优先查验${target.name}，L1推理狼嫌疑${(wolfProb * 100).toFixed(0)}%`,
      });
    });
    if (result.length === 0) {
      const unchecked = alivePlayers.filter((p) => belief.l0Facts.checks[p.id] === undefined);
      if (unchecked.length > 0) {
        const random = unchecked[Math.floor(Math.random() * unchecked.length)];
        result.push({ action: 'check', target: random.id, score: 30, confidence: 0.5, reason: `无明确嫌疑，随机查验${random.name}` });
      }
    }
    return result.sort((a, b) => b.score - a.score);
  },
};

export const BerserkerSuicideStrategy: Strategy = {
  name: 'berserker_suicide',
  requiredRoles: ['berserker'],
  requiredPhase: ['day'],
  evaluate(belief, _actions, allPlayers) {
    const result: DecisionCandidate[] = [];
    const alivePlayers = allPlayers.filter((p) => p.id !== belief.playerId && p.alive && p.team !== 'werewolf');
    const werewolfCount = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
    const villagerCount = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;
    if (werewolfCount < villagerCount && werewolfCount <= 2) {
      alivePlayers.forEach((target) => {
        const claims = belief.l0Facts.publicClaims.filter((c) => c.playerId === target.id);
        if (claims.length > 0) {
          result.push({
            action: 'berserker_kill',
            target: target.id,
            score: 90,
            confidence: 0.8,
            reason: `狼队劣势(${werewolfCount} vs ${villagerCount})，${target.name}疑似神职，同归于尽`,
          });
        }
      });
    }
    return result;
  },
};
