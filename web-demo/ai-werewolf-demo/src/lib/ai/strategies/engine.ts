import type { BeliefSystem } from '../belief-system';
import type { Player, DecisionCandidate, DecisionResult, EnrichedCandidate } from '@/types';
import { getAlignmentBehaviorModifier, getStressBehaviorModifier, getRelationTargetModifier } from '../behavior-modifiers';
import { filterByHardConstraints, type IntentionContext, explainIntention, generateDesireProfile, type IntentionManager } from '../intention-system';
import {
  SocialContextBuilder,
  ValueSystemFactory,
  TimingEvaluator,
  MentalSimulator,
  calculateValueAlignment,
  calculateTimingScore,
  calculateSimulationScore,
  calculateCapabilityFactor,
  calculateCapabilityMatch,
} from '../mind';
import {
  calculateCrisisFactor,
  calculateRelationFactor,
  calculateSocialContextBonus,
} from '../mind/factor-calculators';
import {
  buildValueAlignmentDetail,
  buildTimingDetail,
  buildSimulationDetail,
  buildCrisisDetail,
  buildRelationDetail,
  buildSocialContextDetail,
  buildCapabilityDetail,
} from './mind-detail-builders';
import { buildModifiers, finalizeDecision, defaultDecision } from './process-builder';
import { softmaxSelect } from './selection';
import {
  MIND_MULTIPLIER_BASE,
  MIND_MULTIPLIER_SCALE,
} from '@/lib/constants/mind';

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
  private _socialContextCache: { key: string; socialContext: ReturnType<SocialContextBuilder['build']>; valueSystem: ReturnType<ValueSystemFactory['create']> } | null = null;

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
    voteCandidates: string[] = [],
    pluginCandidates: DecisionCandidate[] = [],
    intentionManager?: IntentionManager
  ): DecisionResult {
    const context: StrategyContext = {
      belief, self, phase, availableActions, allPlayers,
      nightDecisions, publicActions, consecutiveSilence, aliveCount, voteRound, voteCandidates,
    };

    const candidates: DecisionCandidate[] = [];

    // === SocialContext 缓存：同一轮内不重复构建 ===
    const cacheKey = JSON.stringify({ selfId: self.id, phase, voteRound, actionCount: publicActions.length });
    let socialContext: ReturnType<SocialContextBuilder['build']>;
    let valueSystem: ReturnType<ValueSystemFactory['create']>;
    
    if (this._socialContextCache && this._socialContextCache.key === cacheKey) {
      socialContext = this._socialContextCache.socialContext;
      valueSystem = this._socialContextCache.valueSystem;
    } else {
      const socialContextBuilder = new SocialContextBuilder();
      socialContext = socialContextBuilder.build(belief, self, allPlayers, publicActions || [], voteRound || 1);
      
      const valueSystemFactory = new ValueSystemFactory();
      valueSystem = valueSystemFactory.create(self);
      
      this._socialContextCache = { key: cacheKey, socialContext, valueSystem };
    }

    const timingEvaluator = new TimingEvaluator();
    const mentalSimulator = new MentalSimulator();

    // Add plugin candidates with 'plugin' stage
    pluginCandidates.forEach((c) => {
      candidates.push({ ...c, stageWeight: this._getStageWeight('plugin'), stage: 'plugin' });
    });

    for (const stage of this.config.priorityOrder) {
      const stageStrategies = this.strategies[stage] || [];

      for (const strategy of stageStrategies) {
        if (strategy.requiredPhase && !strategy.requiredPhase.includes(phase)) continue;
        if (strategy.requiredRoles && !strategy.requiredRoles.includes(self.role)) continue;

        const result = strategy.evaluate(context);

        if (result && result.length > 0) {
          result.forEach((r) => {
            const effectiveStageWeight = r.stageWeight !== undefined ? r.stageWeight : this._getStageWeight(stage);
            candidates.push({ ...r, stageWeight: effectiveStageWeight, stage, strategy: strategy.name });
          });
        }
      }
    }

    // === 意图驱动候选 ===
    if (intentionManager) {
      const intentionCandidates = intentionManager.generateCandidates(phase, allPlayers, self);
      intentionCandidates.forEach((c) => {
        candidates.push({ ...c, stageWeight: this._getStageWeight('social'), stage: 'intention' });
      });
    }

    if (candidates.length === 0) {
      return defaultDecision(self, allPlayers);
    }

    // === 心智 enrich：先对所有候选做心智 enrich，再应用硬约束 ===
    const enrichedCandidates: EnrichedCandidate[] = candidates.map((c) => {
      const mods = buildModifiers(self, c);
      const target = c.target;

      const valueAlignment = calculateValueAlignment(c.action, valueSystem);
      const timing = timingEvaluator.evaluate(c.action, target, socialContext, self, belief);
      const timingScore = calculateTimingScore(timing);
      const simulation = mentalSimulator.simulate(c.action, target, socialContext, self, belief);
      const simulationScore = calculateSimulationScore(simulation);
      const crisisFactor = calculateCrisisFactor(c.action, socialContext.identityCrisis);
      const relationFactor = calculateRelationFactor(c.action, target, socialContext.relationNetwork, self);
      const socialContextBonus = calculateSocialContextBonus(c.action, target, socialContext);
      const capabilityMatch = calculateCapabilityMatch(c.action, self);
      const capabilityFactor = calculateCapabilityFactor(c.action, self);

      const mindMultiplier =
        (MIND_MULTIPLIER_BASE + MIND_MULTIPLIER_SCALE * valueAlignment) *
        (0.5 + 0.5 * timingScore) *
        (0.5 + 0.5 * simulationScore) *
        crisisFactor *
        relationFactor *
        (0.8 + 0.2 * socialContextBonus) *
        capabilityFactor;

      const baseScore = (c.score || 0) + (c.intentionDrivenBonus || 0) + (c.stageWeight || 0) + mods.total;
      const totalScore = Math.round(baseScore * mindMultiplier);

      const mindData = {
        valueAlignment,
        valueAlignmentDetail: buildValueAlignmentDetail(c.action, valueSystem, valueAlignment),
        timingScore,
        timingDetail: buildTimingDetail(timing, timingScore),
        simulationScore,
        simulationDetail: buildSimulationDetail(simulation, simulationScore, allPlayers),
        crisisFactor,
        crisisDetail: buildCrisisDetail(c.action, socialContext.identityCrisis, crisisFactor),
        relationFactor,
        relationDetail: buildRelationDetail(c.action, target, socialContext.relationNetwork, self, allPlayers, relationFactor),
        socialContextBonus,
        socialContextDetail: buildSocialContextDetail(c.action, socialContext, socialContextBonus),
        capabilityFactor,
        capabilityDetail: buildCapabilityDetail(capabilityMatch, capabilityFactor),
        mindMultiplier,
        baseScore,
      };

      return { ...c, score: c.score ?? 0, totalScore, mindData };
    });

    // === 硬约束过滤（在 mind enrich 之后执行，被拦截的候选也带有 mindData）===
    const intentionContext: IntentionContext = {
      belief, self, phase, allPlayers, publicActions, voteRound, voteCandidates,
    };
    const { allowed, blocked } = filterByHardConstraints(enrichedCandidates, intentionContext);
    const desire = generateDesireProfile(self, belief, allPlayers);
    const intentionExplanation = explainIntention(desire, blocked, allPlayers);

    const effectiveCandidates = allowed;

    if (effectiveCandidates.length === 0) {
      return defaultDecision(self, allPlayers);
    }

    // 去重：先排序保留最高分，再去重只保留不同 action+target 组合的第一个
    const sorted = effectiveCandidates.sort((a, b) => b.totalScore - a.totalScore);
    const seen = new Set<string>();
    const unique = sorted.filter((c) => {
      const key = `${c.action}:${c.target || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Softmax 全分布选择（替代 Top 3 截断）
    const selected = unique.length > 0 ? softmaxSelect(unique) : effectiveCandidates[0];

    return finalizeDecision(
      selected,
      belief,
      self,
      selected.stage || 'default',
      unique,
      allPlayers,
      blocked,
      intentionExplanation,
      intentionManager
    );
  }

  private _getStageWeight(stage: string): number {
    switch (stage) {
      case 'duty': return this.config.dutyWeight;
      case 'survival': return this.config.survivalWeight;
      case 'information': return this.config.infoWeight;
      case 'social': return this.config.socialWeight;
      case 'plugin': return this.config.infoWeight;
      default: return 0;
    }
  }
}
