import type { BeliefSystem } from '../belief-system';
import type { Player, DecisionCandidate, DecisionResult, DecisionProcess, } from '@/types';
import { getAlignmentBehaviorModifier, getStressBehaviorModifier, getRelationTargetModifier } from '../behavior-modifiers';
import { filterByHardConstraints, type IntentionContext, explainIntention, generateDesireProfile } from '../intention-system';

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
    pluginCandidates: DecisionCandidate[] = []
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
            candidates.push({ ...r, stageWeight: this._getStageWeight(stage), stage, strategy: strategy.name });
          });
          // 不再短路：收集所有阶段的候选，最终加权随机选择
        }
      }
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
        return { ...c, totalScore: (c.score || 0) + (c.stageWeight || 0) + mods.total };
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

    // 加权随机选择：以分数作为权重概率
    const selected = unique.length > 0 ? this._weightedRandom(unique) : scored[0];

    return this._finalizeDecision(selected, belief, self, selected.stage || 'default', candidates, allPlayers, blocked, intentionExplanation);
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

  private _buildProcess(candidates: DecisionCandidate[], winner: DecisionCandidate, self: Player, allPlayers: Player[], blocked?: { candidate: DecisionCandidate; reason: string }[], intentionExplanation?: string): DecisionProcess {
    const all = candidates.map((c) => {
      const modifiers = this._buildModifiers(self, c);
      return {
        action: c.action,
        target: c.target,
        reason: c.reason,
        score: c.score || 0,
        stageWeight: c.stageWeight || 0,
        totalScore: (c.score || 0) + (c.stageWeight || 0) + modifiers.total,
        stage: c.stage || 'unknown',
        strategy: c.strategy || 'unknown',
        rule: c.rule || 'unknown',
        trigger: c.trigger || '无特定触发条件',
        random: c.random || false,
        modifiers,
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

    const top3 = unique.slice(0, 3);

    const stageNames: Record<string, string> = {
      duty: '职业义务',
      survival: '生存',
      information: '信息',
      social: '社交',
    };

    const actionNames: Record<string, string> = {
      silence: '沉默',
      speak: '发言',
      claim_identity: '公布身份',
      reveal_info: '公开信息',
      observe: '暗中观察',
      suspect: '怀疑',
      defend: '袒护',
      thank: '感谢',
      call_vote: '号召投票',
      block_vote: '阻止投票',
      guarantee: '担保',
      accuse: '强烈指认',
      exclude_all: '全员排除',
      berserker_kill: '狂狼同归于尽',
      kill: '袭击',
      check: '查验',
      steal: '偷取',
      inspect: '验尸',
      vote: '投票',
      join_suspect: '一同怀疑',
      join_defend: '一同袒护',
      rebut: '反驳',
    };

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
      const modifierLine = c.modifiers.total !== 0
        ? `  修正：阵营${c.modifiers.alignment >= 0 ? '+' : ''}${c.modifiers.alignment} + 压力${c.modifiers.stress >= 0 ? '+' : ''}${c.modifiers.stress} + 关系${c.modifiers.relation >= 0 ? '+' : ''}${c.modifiers.relation} = ${c.modifiers.total >= 0 ? '+' : ''}${c.modifiers.total}`
        : `  修正：无`;

      return `${prefix} ${actionName}${targetName ? `→${targetName}` : ''}${randomMark}
  [${c.strategy}.${c.rule}]
  触发：${c.trigger}
  分数：基础${c.score} + 阶段${c.stageWeight}(${stageName})${modifierLine}
  总分：${c.totalScore}`;
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

    const winnerAction = actionNames[winner.action] || winner.action;
    const winnerTarget = getName(winner.target);
    const winnerStage = stageNames[winner.stage || ''] || winner.stage || 'unknown';
    const winnerStrategy = winner.strategy || 'unknown';
    const winnerRule = winner.rule || 'unknown';
    const winnerStr = winner.strategy && winner.rule
      ? `${winnerStrategy}.${winnerRule}`
      : '默认规则';
    const winnerTotal = all.find((a) => a.action === winner.action && a.target === winner.target)?.totalScore || 0;

    const shortlist = [
      intentionExplanation || '',
      '【可选行动】',
      ...lines,
      ...blockedLines,
      '',
      `【最终选择】${winnerAction}${winnerTarget ? `→${winnerTarget}` : ''}`,
      `  命中规则：${winnerStr}`,
      `  阶段：${winnerStage}`,
      `  总分：${winnerTotal}（在 ${unique.length} 个候选中最高）`,
    ].join('\n');

    const winnerActionStr = `${winner.action} → ${winner.target || '无目标'}`;
    return { candidates: all, winner: winnerActionStr, shortlist };
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

  private _finalizeDecision(candidate: DecisionCandidate, belief: BeliefSystem, self: Player, stage: string, candidates: DecisionCandidate[] = [], allPlayers: Player[] = [], blocked?: { candidate: DecisionCandidate; reason: string }[], intentionExplanation?: string): DecisionResult {
    const process = candidates.length > 0 ? this._buildProcess(candidates, candidate, self, allPlayers, blocked, intentionExplanation) : undefined;
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
