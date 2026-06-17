import type { BeliefSystem } from '../belief-system';
import type { Player, DecisionCandidate, DecisionResult, Attributes, Alignment } from '../types';

export interface StrategyContext {
  belief: BeliefSystem;
  self: Player;
  phase: string;
  availableActions: { type: string }[];
  allPlayers: Player[];
  nightDecisions?: { playerId: string; action: string; targetId: string | null; reason: string }[];
  publicActions?: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[];
  consecutiveSilence?: number;
  aliveCount?: number;
  voteRound?: number;
  voteCandidates?: string[];
}

export interface Strategy {
  name: string;
  requiredRoles?: string[];
  requiredPhase?: string[];
  evaluate(context: StrategyContext): DecisionCandidate[];
}

interface StrategyConfig {
  priorityOrder: string[];
  dutyWeight: number;
  survivalWeight: number;
  infoWeight: number;
  socialWeight: number;
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

  decide(
    belief: BeliefSystem,
    self: Player,
    phase: string,
    availableActions: { type: string }[],
    allPlayers: Player[],
    nightDecisions: { playerId: string; action: string; targetId: string | null; reason: string }[] = [],
    publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[] = [],
    consecutiveSilence: number = 0,
    aliveCount: number = 0,
    voteRound: number = 1,
    voteCandidates: string[] = []
  ): DecisionResult {
    const context: StrategyContext = {
      belief, self, phase, availableActions, allPlayers,
      nightDecisions, publicActions, consecutiveSilence, aliveCount, voteRound, voteCandidates,
    };

    const candidates: DecisionCandidate[] = [];

    for (const stage of this.config.priorityOrder) {
      const stageStrategies = this.strategies[stage] || [];

      for (const strategy of stageStrategies) {
        if (strategy.requiredPhase && !strategy.requiredPhase.includes(phase)) continue;
        if (strategy.requiredRoles && !strategy.requiredRoles.includes(self.role)) continue;

        const result = strategy.evaluate(context);

        if (result && result.length > 0) {
          result.forEach((r) => {
            candidates.push({ ...r, stageWeight: this._getStageWeight(stage), stage });
          });

          if ((stage === 'duty' || stage === 'survival') && result.length === 1) {
            return this._finalizeDecision(result[0], belief, self, stage);
          }
        }
      }
    }

    if (candidates.length === 0) {
      return this._defaultDecision(self, allPlayers);
    }

    const scored = candidates
      .map((c) => ({ ...c, totalScore: (c.score || 0) + (c.stageWeight || 0) }))
      .sort((a, b) => b.totalScore - a.totalScore);

    return this._finalizeDecision(scored[0], belief, self, scored[0].stage || 'default');
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

  private _finalizeDecision(candidate: DecisionCandidate, belief: BeliefSystem, self: Player, stage: string): DecisionResult {
    return {
      action: candidate.action,
      target: candidate.target,
      reason: candidate.reason,
      stage,
      confidence: candidate.confidence || 0.7,
      emotionalTone: this._getEmotionalTone(belief, self, candidate.target, stage),
      details: candidate.details,
    };
  }

  private _getEmotionalTone(belief: BeliefSystem, self: Player, targetId: string | null, stage: string): string {
    if (!targetId || stage === 'duty') return 'neutral';
    const relation = belief.getRelation(targetId);
    if (relation.friendly > 5) return 'reluctant';
    if (relation.friendly < -5) return 'firm';
    if (self.stress > 5) return 'anxious';
    if (self.stress < -5) return 'calm';
    return 'neutral';
  }

  private _defaultDecision(self: Player, allPlayers: Player[]): DecisionResult {
    const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);
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
