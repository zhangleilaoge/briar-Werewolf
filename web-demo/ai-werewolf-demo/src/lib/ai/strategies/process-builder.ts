
import { ROLE_INFO } from '@/types';
import type { Player, EnrichedCandidate, DecisionProcess, DecisionCandidate, DecisionResult } from '@/types';
import { buildScoreExpr } from '@/lib/utils/expr';
import { ACTION_NAMES } from '@/lib/constants/display-names';
import type { BeliefSystem } from '../belief-system';
import type { IntentionManager } from '../intention-system';
import { getAlignmentBehaviorModifier, getStressBehaviorModifier, getRelationTargetModifier } from '../behavior-modifiers';
import { TRUST_THRESHOLD_MEDIUM } from '@/lib/constants/mind';

// ========== 辅助方法（被 _buildProcess 和 _finalizeDecision 共用） ==========

export function buildModifiers(
  self: Player,
  candidate: DecisionCandidate
): { alignment: number; stress: number; relation: number; total: number } {
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

export function getEmotionalTone(
  belief: BeliefSystem,
  self: Player,
  targetId: string | null,
  stage: string
): string {
  if (!targetId || stage === 'duty') return 'neutral';
  const relation = belief.getRelation(targetId);
  if (relation.favor > TRUST_THRESHOLD_MEDIUM) return 'reluctant';
  if (relation.favor < -TRUST_THRESHOLD_MEDIUM) return 'firm';
  if (self.stress > TRUST_THRESHOLD_MEDIUM) return 'anxious';
  if (self.stress < -TRUST_THRESHOLD_MEDIUM) return 'calm';
  return 'neutral';
}

// ========== Process Builder ==========

export function buildProcess(
  candidates: EnrichedCandidate[],
  winner: EnrichedCandidate,
  self: Player,
  allPlayers: Player[],
  blocked?: { candidate: DecisionCandidate; reason: string; constraintId: string; description: string }[],
  intentionExplanation?: string,
  intentionManager?: IntentionManager
): DecisionProcess {
  const all = candidates.map((c) => {
    const modifiers = buildModifiers(self, c);
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

  const getName = (id: string | null) => {
    if (!id) return '';
    const p = allPlayers.find((x) => x.id === id);
    return p ? p.name : id;
  };

  const lines = top5.map((c) => {
    const actionName = ACTION_NAMES[c.action] || c.action;
    const targetName = getName(c.target);
    const isWinner = c.action === winner.action && c.target === winner.target;
    const prefix = isWinner ? '✓' : '○';
    const stageName = c.stage;
    const randomMark = c.random ? ' [随机]' : '';
    const prob = totalWeight > 0 ? ((Math.max(1, c.totalScore) / totalWeight) * 100).toFixed(1) : '0.0';

    const scoreLine = buildScoreExpr(
      c.totalScore, c.score, c.intentionDrivenBonus, c.stageWeight, stageName, c.modifiers
    );

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
      const actionName = ACTION_NAMES[b.candidate.action] || b.candidate.action;
      const targetName = getName(b.candidate.target);
      blockedLines.push(`  ✗ ${actionName}${targetName ? ` → ${targetName}` : ''}: 违反硬约束`);
      blockedLines.push(`    [${b.constraintId}]`);
      blockedLines.push(`    原因：${b.description}`);
    });
  }

  // 意图栈信息
  const intentionLines: string[] = [];
  if (intentionManager) {
    intentionLines.push('');
    intentionLines.push('【意图栈】');
    intentionLines.push(intentionManager.getSummary(allPlayers));
  }

  const winnerAction = ACTION_NAMES[winner.action] || winner.action;
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

// ========== Finalize Decision ==========

export function finalizeDecision(
  candidate: EnrichedCandidate,
  belief: BeliefSystem,
  self: Player,
  stage: string,
  candidates: EnrichedCandidate[] = [],
  allPlayers: Player[] = [],
  blocked?: { candidate: DecisionCandidate; reason: string; constraintId: string; description: string }[],
  intentionExplanation?: string,
  intentionManager?: IntentionManager
): DecisionResult {
  const process = candidates.length > 0
    ? buildProcess(candidates, candidate, self, allPlayers, blocked, intentionExplanation, intentionManager)
    : undefined;
  return {
    action: candidate.action,
    target: candidate.target,
    reason: candidate.reason,
    stage,
    confidence: candidate.confidence || 0.7,
    emotionalTone: getEmotionalTone(belief, self, candidate.target, stage),
    details: candidate.details,
    process,
  };
}

// ========== Default Decision ==========

export function defaultDecision(self: Player, allPlayers: Player[]): DecisionResult {
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
