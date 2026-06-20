
function calculateCrisisFactor(action: string, crisis: { isCritical: boolean; isHigh: boolean }): number {
  if (crisis.isCritical) {
    switch (action) {
      case ACTION.SILENCE: return CRISIS_FACTOR_SILENCE_CRITICAL;
      case ACTION.OBSERVE: return CRISIS_FACTOR_OBSERVE_CRITICAL;
      case ACTION.DEFEND: return CRISIS_FACTOR_DEFEND_CRITICAL;
      case ACTION.REBUT: return CRISIS_FACTOR_REBUT_CRITICAL;
      case ACTION.ACCUSE: return CRISIS_FACTOR_ACCUSE_CRITICAL;
      case ACTION.CALL_VOTE: return CRISIS_FACTOR_CALL_VOTE_CRITICAL;
      case ACTION.CLAIM_IDENTITY: return CRISIS_FACTOR_CLAIM_IDENTITY_CRITICAL;
      default: return CRISIS_FACTOR_DEFAULT_CRITICAL;
    }
  }
  if (crisis.isHigh) {
    switch (action) {
      case ACTION.SILENCE: return CRISIS_FACTOR_SILENCE_HIGH;
      case ACTION.DEFEND: return CRISIS_FACTOR_DEFEND_HIGH;
      case ACTION.ACCUSE: return CRISIS_FACTOR_ACCUSE_HIGH;
      case ACTION.CALL_VOTE: return CRISIS_FACTOR_CALL_VOTE_HIGH;
      default: return CRISIS_FACTOR_DEFAULT_CRITICAL;
    }
  }
  return RELATION_FACTOR_DEFAULT;
}

function calculateRelationFactor(
  action: string,
  target: string | null,
  relationNetwork: { myView: Map<string, { trust: number; inferredTeam: 'werewolf' | 'villager' | 'unknown'; confidence: number }> },
  self: Player
): number {
  if (!target) return RELATION_FACTOR_DEFAULT;

  const view = relationNetwork.myView.get(target);
  if (!view) return RELATION_FACTOR_DEFAULT;

  if (view.trust > 5) {
    if (action === ACTION.DEFEND) return RELATION_FACTOR_DEFEND_TRUSTED;
    if (action === ACTION.GUARANTEE) return RELATION_FACTOR_GUARANTEE_TRUSTED;
    if (action === ACTION.ACCUSE) return RELATION_FACTOR_ACCUSE_TRUSTED;
  }

  if (view.inferredTeam === 'werewolf' && view.confidence > 0.6) {
    if (action === ACTION.ACCUSE) return RELATION_FACTOR_ACCUSE_SUSPICIOUS;
    if (action === ACTION.SUSPECT) return RELATION_FACTOR_SUSPECT_SUSPICIOUS;
    if (action === ACTION.DEFEND) return RELATION_FACTOR_DEFEND_SUSPICIOUS;
  }

  return RELATION_FACTOR_DEFAULT;
}

function calculateSocialContextBonus(
  action: string,
  target: string | null,
  socialContext: { situation: { tensionLevel: number; myPosition: string; informationRichness: number } }
): number {
  let bonus = 1.0;

  if (action === ACTION.SILENCE && socialContext.situation.tensionLevel > 0.7) {
    bonus *= SOCIAL_BONUS_SILENCE_HIGH_TENSION;
  }

  if (socialContext.situation.myPosition === 'target') {
    if (action === ACTION.REBUT || action === ACTION.DEFEND) {
      bonus *= SOCIAL_BONUS_DEFEND_TARGET;
    }
  }

  if (socialContext.situation.myPosition === 'leader') {
    if (action === ACTION.CALL_VOTE) {
      bonus *= SOCIAL_BONUS_CALL_VOTE_LEADER;
    }
  }

  if (action === ACTION.OBSERVE && socialContext.situation.informationRichness > 0.8) {
    bonus *= SOCIAL_BONUS_OBSERVE_RICH_INFO;
  }

  return bonus;
}

import type { BeliefSystem } from '../belief-system';
import type { Player, DecisionCandidate, DecisionResult, DecisionProcess, EnrichedCandidate } from '@/types';
import { ROLE_INFO } from '@/types';
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
} from '../mind';
import { ACTION } from '@/lib/constants/action-constants';
import {
  CRISIS_FACTOR_SILENCE_CRITICAL,
  CRISIS_FACTOR_OBSERVE_CRITICAL,
  CRISIS_FACTOR_DEFEND_CRITICAL,
  CRISIS_FACTOR_REBUT_CRITICAL,
  CRISIS_FACTOR_ACCUSE_CRITICAL,
  CRISIS_FACTOR_CALL_VOTE_CRITICAL,
  CRISIS_FACTOR_CLAIM_IDENTITY_CRITICAL,
  CRISIS_FACTOR_DEFAULT_CRITICAL,
  CRISIS_FACTOR_SILENCE_HIGH,
  CRISIS_FACTOR_DEFEND_HIGH,
  CRISIS_FACTOR_ACCUSE_HIGH,
  CRISIS_FACTOR_CALL_VOTE_HIGH,
  CRISIS_FACTOR_DEFAULT_HIGH,
  RELATION_FACTOR_DEFEND_TRUSTED,
  RELATION_FACTOR_GUARANTEE_TRUSTED,
  RELATION_FACTOR_ACCUSE_TRUSTED,
  RELATION_FACTOR_ACCUSE_SUSPICIOUS,
  RELATION_FACTOR_SUSPECT_SUSPICIOUS,
  RELATION_FACTOR_DEFEND_SUSPICIOUS,
  RELATION_FACTOR_DEFAULT,
  SOCIAL_BONUS_SILENCE_HIGH_TENSION,
  SOCIAL_BONUS_DEFEND_TARGET,
  SOCIAL_BONUS_CALL_VOTE_LEADER,
  SOCIAL_BONUS_OBSERVE_RICH_INFO,
  SOCIAL_BONUS_DEFAULT,
  MIND_MULTIPLIER_BASE,
  MIND_MULTIPLIER_SCALE,
  MIND_MULTIPLIER_SOCIAL_BASE,
  MIND_MULTIPLIER_SOCIAL_SCALE,
  TEMPERATURE_BASE,
  TEMPERATURE_STRESS_LOW,
  TEMPERATURE_STRESS_HIGH,
  TEMPERATURE_CRISIS_CRITICAL,
  TEMPERATURE_CRISIS_HIGH,
  TEMPERATURE_WEREWOLF,
  TEMPERATURE_LOGIC_SCALE,
  TEMPERATURE_STEALTH_SCALE,
  TEMPERATURE_ANXIOUS,
  TEMPERATURE_CONFIDENT,
  TEMPERATURE_ANGRY,
  TEMPERATURE_MIN,
  TEMPERATURE_MAX,
  PROB_THRESHOLD_HIGH,
  PROB_THRESHOLD_MEDIUM,
  PROB_THRESHOLD_LOW,
  TRUST_THRESHOLD_HIGH,
  TRUST_THRESHOLD_MEDIUM,
  TENSION_THRESHOLD_HIGH,
  INFORMATION_RICHNESS_HIGH,
  CRISIS_THRESHOLD_CRITICAL,
  CRISIS_THRESHOLD_HIGH,
  CRISIS_THRESHOLD_LOW,
  SIMULATION_DEFAULT_GOAL_ALIGNMENT,
  SIMULATION_EXPOSURE_RISK_LOW,
  SIMULATION_EXPOSURE_RISK_VERY_LOW,
  TIMING_WEIGHT_URGENCY,
  TIMING_WEIGHT_CREDIBILITY,
  TIMING_WEIGHT_RISK,
  TIMING_WEIGHT_IMPACT,
  TIMING_WEIGHT_OPPORTUNITY_COST,
  CAPABILITY_FACTOR_EXCELLENT,
  CAPABILITY_FACTOR_GOOD,
  CAPABILITY_FACTOR_AVERAGE,
  CAPABILITY_FACTOR_POOR,
  CAPABILITY_FACTOR_VERY_POOR,
  CAPABILITY_THRESHOLD_EXCELLENT,
  CAPABILITY_THRESHOLD_GOOD,
  CAPABILITY_THRESHOLD_AVERAGE,
  CAPABILITY_THRESHOLD_POOR,
  CAPABILITY_PRIMARY_WEIGHT,
  CAPABILITY_SECONDARY_WEIGHT,
  VALUE_BASE,
} from '@/lib/constants/mind';
import { buildScoreExpr } from '@/lib/utils/expr';
import {
  ACTION_NAMES,
} from '@/lib/constants/display-names';

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
      return this._defaultDecision(self, allPlayers);
    }

    // === 心智 enrich：先对所有候选做心智 enrich，再应用硬约束 ===
    // 这样被拦截的候选也能展示 enrich 后的分数，便于调试和 UI 展示
    const enrichedCandidates: EnrichedCandidate[] = candidates.map((c) => {
      const mods = this._buildModifiers(self, c);
      const target = c.target;

      const valueAlignment = calculateValueAlignment(c.action, valueSystem);
      const timing = timingEvaluator.evaluate(c.action, target, socialContext, self, belief);
      const timingScore = calculateTimingScore(timing);
      const simulation = mentalSimulator.simulate(c.action, target, socialContext, self, belief);
      const simulationScore = calculateSimulationScore(simulation);
      const crisisFactor = calculateCrisisFactor(c.action, socialContext.identityCrisis);
      const relationFactor = calculateRelationFactor(c.action, target, socialContext.relationNetwork, self);
      const socialContextBonus = calculateSocialContextBonus(c.action, target, socialContext);
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
        timingScore,
        simulationScore,
        crisisFactor,
        relationFactor,
        socialContextBonus,
        capabilityFactor,
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
      return this._defaultDecision(self, allPlayers);
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
    const selected = unique.length > 0 ? this._softmaxSelect(unique) : effectiveCandidates[0];

    return this._finalizeDecision(
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
      case 'plugin': return this.config.infoWeight; // Plugin strategies use info weight
      default: return 0;
    }
  }

  private _buildModifiers(self: Player, candidate: DecisionCandidate): { alignment: number; stress: number; relation: number; total: number } {
    let alignmentMod = 0;
    let stressMod = 0;
    let relationMod = 0;

    if (candidate.action) {
      alignmentMod = getAlignmentBehaviorModifier(self.alignment, candidate.action) || 0;
      stressMod = getStressBehaviorModifier(self.stress, candidate.action) || 0;
    }
    if (candidate.target) {
      const relation = self.relations[candidate.target];
      if (relation) {
        relationMod = getRelationTargetModifier(relation, candidate.action) || 0;
      }
    }

    return {
      alignment: alignmentMod,
      stress: stressMod,
      relation: relationMod,
      total: alignmentMod + stressMod + relationMod,
    };
  }

  private _buildProcess(candidates: EnrichedCandidate[], winner: EnrichedCandidate, self: Player, allPlayers: Player[], blocked?: { candidate: DecisionCandidate; reason: string }[], intentionExplanation?: string, intentionManager?: IntentionManager): DecisionProcess {
    const all = candidates.map((c) => {
      const modifiers = this._buildModifiers(self, c);
      return {
        action: c.action,
        target: c.target,
        reason: c.reason,
        score: c.score || 0,
        stageWeight: c.stageWeight || 0,
        intentionDrivenBonus: c.intentionDrivenBonus || 0,
        totalScore: c.totalScore,
        stage: c.stage || 'unknown',
        strategy: c.strategy || 'unknown',
        rule: c.rule || 'unknown',
        trigger: c.trigger || '无特定触发条件',
        random: c.random || false,
        modifiers,
        details: c.details,
        mindData: c.mindData,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    // 去重：只保留不同 action+target 组合的第一个
    const seen = new Set<string>();
    const unique = all.filter((c) => {
      const key = `${c.action}:${c.target || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 计算加权随机概率（与 _weightedRandom 一致）
    const weights = unique.map((c) => Math.max(1, c.totalScore));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    const top5 = unique.slice(0, 5);

    const actionNames = ACTION_NAMES;

    const getName = (id: string | null) => {
      if (!id) return '';
      const p = allPlayers.find((x) => x.id === id);
      return p ? p.name : id;
    };

    const lines = top5.map((c) => {
      const actionName = actionNames[c.action] || c.action;
      const targetName = getName(c.target);
      const isWinner = c.action === winner.action && c.target === winner.target;
      const prefix = isWinner ? '✓' : '○';
      const stageName = c.stage;
      const randomMark = c.random ? ' [随机]' : '';
      const prob = totalWeight > 0 ? ((Math.max(1, c.totalScore) / totalWeight) * 100).toFixed(1) : '0.0';

      const scoreLine = buildScoreExpr(
        c.totalScore, c.score, c.intentionDrivenBonus, c.stageWeight, stageName, c.modifiers
      );

      // 解析 claimedRole（如"公布身份"行动需要显示角色）
      const claimedRole = c.details?.claimedRole as string | undefined;
      const roleLabel = claimedRole ? (ROLE_INFO[claimedRole as keyof typeof ROLE_INFO]?.label || claimedRole) : null;

      return `${prefix} ${actionName}${roleLabel ? `(${roleLabel})` : ''}${targetName ? `→${targetName}` : ''}${randomMark}
  [${c.strategy}.${c.rule}]
  ${scoreLine} (概率 ${prob}%)`;
    });

    // 硬约束拦截信息
    const blockedLines: string[] = [];
    if (blocked && blocked.length > 0) {
      blockedLines.push('');
      blockedLines.push('【被硬约束拦截】');
      blocked.forEach((b) => {
        const actionName = actionNames[b.candidate.action] || b.candidate.action;
        const targetName = getName(b.candidate.target);
        blockedLines.push(`  ✗ ${actionName}${targetName ? `→${targetName}` : ''}: ${b.reason}`);
      });
    }

    // 意图栈信息
    const intentionLines: string[] = [];
    if (intentionManager) {
      intentionLines.push('');
      intentionLines.push('【意图栈】');
      intentionLines.push(intentionManager.getSummary(allPlayers));
    }

    const winnerAction = actionNames[winner.action] || winner.action;
    const winnerTarget = getName(winner.target);

    const shortlist = [
      intentionExplanation || '',
      '【可选行动】',
      ...lines,
      ...blockedLines,
      ...intentionLines,
      '',
      `【最终选择】${winnerAction}${winnerTarget ? `→${winnerTarget}` : ''}`,
    ].join('\n');

    return { candidates: unique, winner: { action: winner.action, target: winner.target }, shortlist };
  }

  private _weightedRandom(candidates: (DecisionCandidate & { totalScore?: number })[]): DecisionCandidate {
    const weights = candidates.map((c) => Math.max(1, c.totalScore || c.score || 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      random -= weights[i];
      if (random <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  private _finalizeDecision(candidate: EnrichedCandidate, belief: BeliefSystem, self: Player, stage: string, candidates: EnrichedCandidate[] = [], allPlayers: Player[] = [], blocked?: { candidate: DecisionCandidate; reason: string }[], intentionExplanation?: string, intentionManager?: IntentionManager): DecisionResult {
    const process = candidates.length > 0 ? this._buildProcess(candidates, candidate, self, allPlayers, blocked, intentionExplanation, intentionManager) : undefined;
    return {
      action: candidate.action,
      target: candidate.target,
      reason: candidate.reason,
      stage,
      confidence: candidate.confidence || 0.7,
      emotionalTone: this._getEmotionalTone(belief, self, candidate.target, stage),
      details: candidate.details,
      process,
    };
  }

  private _getEmotionalTone(belief: BeliefSystem, self: Player, targetId: string | null, stage: string): string {
    if (!targetId || stage === 'duty') return 'neutral';
    const relation = belief.getRelation(targetId);
    if (relation.favor > TRUST_THRESHOLD_MEDIUM) return 'reluctant';
    if (relation.favor < -TRUST_THRESHOLD_MEDIUM) return 'firm';
    if (self.stress > TRUST_THRESHOLD_MEDIUM) return 'anxious';
    if (self.stress < -TRUST_THRESHOLD_MEDIUM) return 'calm';
    return 'neutral';
  }

  private _defaultDecision(self: Player, allPlayers: Player[]): DecisionResult {
    let candidates = allPlayers.filter((p) => p.id !== self.id && p.alive);
    if (self.team === 'werewolf') {
      candidates = candidates.filter((p) => p.team !== 'werewolf');
    }
    const randomTarget = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      action: 'vote',
      target: randomTarget?.id || null,
      reason: 'default_random',
      stage: 'default',
      confidence: 0.3,
      emotionalTone: 'neutral',
    };
  }


  private _softmaxSelect(candidates: EnrichedCandidate[]): EnrichedCandidate {
    const temperature = this._calculateTemperature(candidates);
    const scores = candidates.map((c) => c.totalScore);
    const maxScore = Math.max(...scores);
    const expScores = scores.map((s) => Math.exp((s - maxScore) / temperature));
    const sumExp = expScores.reduce((sum, e) => sum + e, 0);
    const probs = expScores.map((e) => e / sumExp);

    let random = Math.random();
    for (let i = 0; i < candidates.length; i++) {
      random -= probs[i];
      if (random <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  private _calculateTemperature(candidates: EnrichedCandidate[]): number {
    const scores = candidates.map((c) => c.totalScore);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore;

    // 分数差距大时降低温度（更确定性），差距小时提高温度（更随机）
    if (range > 50) return TEMPERATURE_MIN;
    if (range > 20) return 1.0;
    if (range > 10) return 2.0;
    return 3.0;
  }

}
