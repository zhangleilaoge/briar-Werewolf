import type { BeliefSystem } from '../belief-system';
import type { Player, DecisionCandidate, DecisionResult, DecisionProcess, } from '@/types';
import { ROLE_INFO } from '@/types';
import { getAlignmentBehaviorModifier, getStressBehaviorModifier, getRelationTargetModifier } from '../behavior-modifiers';
import { filterByHardConstraints, type IntentionContext, explainIntention, generateDesireProfile, type IntentionManager } from '../intention-system';

import { buildScoreExpr } from '@/lib/utils/expr';
import {
  ACTION_NAMES, STAGE_NAMES,
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
            // 候选可显式覆盖 stageWeight（0 表示无阶段加值，如默认回退行为）
            const effectiveStageWeight = r.stageWeight !== undefined ? r.stageWeight : this._getStageWeight(stage);
            candidates.push({ ...r, stageWeight: effectiveStageWeight, stage, strategy: strategy.name });
          });
          // 不再短路：收集所有阶段的候选，最终加权随机选择
        }
      }
    }

    // === 意图驱动候选 ===
    // 由 IntentionManager 统一生成，策略候选与意图候选在同一评分体系中竞争
    if (intentionManager) {
      const intentionCandidates = intentionManager.generateCandidates(phase, allPlayers, self);
      intentionCandidates.forEach((c) => {
        candidates.push({ ...c, stageWeight: this._getStageWeight('social'), stage: 'intention' });
      });
    }

    if (candidates.length === 0) {
      return this._defaultDecision(self, allPlayers);
    }

    // === 意图系统硬约束过滤 ===
    // 职业义务不可被分数覆盖：狼人不得主动攻击队友、预言家必须公布查验等
    const intentionContext: IntentionContext = {
      belief, self, phase, allPlayers, publicActions, voteRound, voteCandidates,
    };
    const { allowed, blocked } = filterByHardConstraints(candidates, intentionContext);
    const desire = generateDesireProfile(self, belief, allPlayers);
    const intentionExplanation = explainIntention(desire, blocked, allPlayers);

    const effectiveCandidates = allowed.length > 0 ? allowed : candidates; // 如果全部拦截，回退到原始候选（兜底）

    const scored = effectiveCandidates
      .map((c) => {
        const mods = this._buildModifiers(self, c);
        return { ...c, totalScore: (c.score || 0) + (c.intentionDrivenBonus || 0) + (c.stageWeight || 0) + mods.total };
      })
      .sort((a, b) => b.totalScore - a.totalScore);

    // 去重：只保留不同 action+target 组合的第一个
    const seen = new Set<string>();
    const unique = scored.filter((c) => {
      const key = `${c.action}:${c.target || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 加权随机选择：从 top 3 中选择（与 UI 展示一致）
    const topCandidates = unique.slice(0, 3);
    const selected = topCandidates.length > 0 ? this._weightedRandom(topCandidates) : scored[0];

    return this._finalizeDecision(selected, belief, self, selected.stage || 'default', candidates, allPlayers, blocked, intentionExplanation, intentionManager);
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

  private _buildProcess(candidates: DecisionCandidate[], winner: DecisionCandidate, self: Player, allPlayers: Player[], blocked?: { candidate: DecisionCandidate; reason: string }[], intentionExplanation?: string, intentionManager?: IntentionManager): DecisionProcess {
    const all = candidates.map((c) => {
      const modifiers = this._buildModifiers(self, c);
      return {
        action: c.action,
        target: c.target,
        reason: c.reason,
        score: c.score || 0,
        stageWeight: c.stageWeight || 0,
        intentionDrivenBonus: c.intentionDrivenBonus || 0,
        totalScore: (c.score || 0) + (c.intentionDrivenBonus || 0) + (c.stageWeight || 0) + modifiers.total,
        stage: c.stage || 'unknown',
        strategy: c.strategy || 'unknown',
        rule: c.rule || 'unknown',
        trigger: c.trigger || '无特定触发条件',
        random: c.random || false,
        modifiers,
        details: c.details,
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

    const top3 = unique.slice(0, 3);

    const stageNames = STAGE_NAMES;
    const actionNames = ACTION_NAMES;

    const getName = (id: string | null) => {
      if (!id) return '';
      const p = allPlayers.find((x) => x.id === id);
      return p ? p.name : id;
    };

    const lines = top3.map((c) => {
      const actionName = actionNames[c.action] || c.action;
      const targetName = getName(c.target);
      const isWinner = c.action === winner.action && c.target === winner.target;
      const prefix = isWinner ? '✓' : '○';
      const stageName = stageNames[c.stage] || c.stage;
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

    const winnerActionStr = `${winner.action} → ${winner.target || '无目标'}`;
    return { candidates: unique, winner: winnerActionStr, shortlist };
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

  private _finalizeDecision(candidate: DecisionCandidate, belief: BeliefSystem, self: Player, stage: string, candidates: DecisionCandidate[] = [], allPlayers: Player[] = [], blocked?: { candidate: DecisionCandidate; reason: string }[], intentionExplanation?: string, intentionManager?: IntentionManager): DecisionResult {
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
    if (relation.favor > 5) return 'reluctant';
    if (relation.favor < -5) return 'firm';
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
