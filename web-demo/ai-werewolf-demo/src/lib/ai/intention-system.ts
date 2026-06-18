import type { Player, DecisionCandidate } from '@/types';
import type { BeliefSystem } from './belief-system';

// ============================================================
// Intention System (BDI Extension)
// ============================================================
// BDI Model: Belief -> Desire -> Intention
// - Belief (认知): 当前对世界的认知（由 BeliefSystem 提供）
// - Desire (愿望): 阵营目标 + 个人目标
// - Intention (意图): 经过硬约束过滤后的具体行动候选
//
// 核心设计：
// 1. Hard Constraints (硬约束/职业义务): 不可违反，直接过滤候选
// 2. Soft Preferences (软偏好): 可权衡，用于分数排序
// 3. Bus Mode (切割模式): 狼人团队允许牺牲队友的极端场景
// ============================================================

export interface DesireProfile {
  // 阵营目标 (Team Objective) — 硬约束来源
  teamObjective: 'eliminate_opposition' | 'survive' | 'protect_team' | 'find_wolves';
  // 个人目标 (Personal Objective) — 软偏好来源
  personalObjective: 'survive' | 'gain_trust' | 'eliminate_threat' | 'reveal_truth' | 'maintain_cover';
  // 当前模式
  mode: 'normal' | 'bus' | 'desperate' | 'dominant';
}

export interface HardConstraint {
  id: string;
  description: string;
  // 判断某个候选是否违反此约束
  violated: (candidate: DecisionCandidate, context: IntentionContext) => boolean;
  // 此约束是否在当前场景激活
  active: (context: IntentionContext) => boolean;
  // 约束来源：team_duty | role_duty | survival
  source: 'team_duty' | 'role_duty' | 'survival' | 'bus';
}

export interface IntentionContext {
  belief: BeliefSystem;
  self: Player;
  phase: string;
  allPlayers: Player[];
  publicActions?: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[];
  voteRound?: number;
  voteCandidates?: string[];
}

// ---------- 硬约束：狼人白天不得主动攻击队友 ----------
export const WolfNoAttackTeammateConstraint: HardConstraint = {
  id: 'wolf_no_attack_teammate',
  description: '狼人白天不得主动号召投票/强烈指认/怀疑队友（除非进入切割模式）',
  active(context) {
    // 仅对存活狼人激活
    if (context.self.team !== 'werewolf' || !context.self.alive) return false;
    // 切割模式时解除此约束
    if (isBusMode(context)) return false;
    return true;
  },
  violated(candidate, context) {
    if (!candidate.target) return false;
    const target = context.allPlayers.find(p => p.id === candidate.target);
    if (!target || target.team !== 'werewolf') return false;
    // 攻击行为：号召投票、强烈指认、怀疑、投票
    const attackActions = ['call_vote', 'accuse', 'suspect', 'vote'];
    return attackActions.includes(candidate.action);
  },
  source: 'team_duty',
};

// ---------- 硬约束：狼人夜间不得攻击队友（无理由） ----------
export const WolfNoKillTeammateConstraint: HardConstraint = {
  id: 'wolf_no_kill_teammate',
  description: '狼人夜间不得攻击队友（除非特殊策略需要）',
  active(context) {
    if (context.self.team !== 'werewolf' || !context.self.alive) return false;
    return true;
  },
  violated(candidate, _context) {
    if (candidate.action !== 'kill' || !candidate.target) return false;
    // 目标是否是队友由调用方提供信息，这里只做通用判断
    // 实际运行时结合 context.allPlayers 中目标的 team 判断
    return false; // 由具体策略自行处理，这里作为兜底
  },
  source: 'team_duty',
};

// ---------- 硬约束：预言家必须公布查验到的狼人 ----------
export const ProphetMustClaimWolfConstraint: HardConstraint = {
  id: 'prophet_must_claim_wolf',
  description: '预言家查验到狼人，在白天有义务公布身份（保护村民阵营）',
  active(context) {
    if (context.self.role !== 'prophet' || !context.self.alive) return false;
    // 检查是否有未公布的狼人查验结果
    const checks = context.belief.l0Facts.checks;
    return Object.entries(checks).some(([_, result]) => result === 'werewolf');
  },
  violated(candidate, context) {
    // 此约束不直接过滤，而是作为极高优先级愿望
    // 如果预言家没有执行 claim_identity 或 call_vote，则视为违反
    if (candidate.action === 'claim_identity' || candidate.action === 'call_vote') {
      const checks = context.belief.l0Facts.checks;
      // 确保目标确实是查验到的狼人
      if (candidate.target && checks[candidate.target] === 'werewolf') {
        return false; // 不违反，正确执行了义务
      }
    }
    // 非白天的相关阶段不约束
    if (context.phase !== 'day') return false;
    return true; // 在白天没有履行公布义务
  },
  source: 'role_duty',
};

// ---------- 切割模式判断 ----------
export function isBusMode(context: IntentionContext): boolean {
  if (context.self.team !== 'werewolf') return false;

  const allWolves = context.allPlayers.filter(p => p.team === 'werewolf' && p.alive);
  const allVillagers = context.allPlayers.filter(p => p.team !== 'werewolf' && p.alive);

  // 切割条件：狼队明显劣势 + 有队友高度暴露 + 自身相对安全
  if (allWolves.length >= allVillagers.length) return false; // 优势不切割

  const teammates = allWolves.filter(p => p.id !== context.self.id);
  for (const teammate of teammates) {
    const exposure = context.belief.getPlayerExposure(teammate.id);
    const myExposure = context.belief.getExposure();
    if (exposure > 0.8 && myExposure < 0.5) {
      return true; // 有队友极度暴露且自身安全，可以切割
    }
  }

  return false;
}

// ---------- 愿望生成器 ----------
export function generateDesireProfile(self: Player, belief: BeliefSystem, allPlayers: Player[]): DesireProfile {
  const aliveWolves = allPlayers.filter(p => p.team === 'werewolf' && p.alive).length;
  const aliveVillagers = allPlayers.filter(p => p.team !== 'werewolf' && p.alive).length;
  const myExposure = belief.getExposure();

  // 判断模式
  let mode: DesireProfile['mode'] = 'normal';
  if (self.team === 'werewolf') {
    if (aliveWolves < aliveVillagers && myExposure > 0.6) {
      mode = 'desperate';
    } else if (isBusMode({ belief, self, phase: 'day', allPlayers })) {
      mode = 'bus';
    } else if (aliveWolves >= aliveVillagers) {
      mode = 'dominant';
    }
  } else {
    if (aliveWolves >= aliveVillagers) {
      mode = 'desperate';
    }
  }

  // 阵营目标
  let teamObjective: DesireProfile['teamObjective'];
  if (self.team === 'werewolf') {
    teamObjective = 'eliminate_opposition';
  } else {
    teamObjective = 'find_wolves';
  }

  // 个人目标
  let personalObjective: DesireProfile['personalObjective'];
  if (self.team === 'werewolf') {
    personalObjective = mode === 'desperate' ? 'survive' : 'maintain_cover';
  } else if (self.role === 'prophet') {
    personalObjective = 'reveal_truth';
  } else {
    personalObjective = 'gain_trust';
  }

  return { teamObjective, personalObjective, mode };
}

// ---------- 硬约束过滤器 ----------
export function filterByHardConstraints(
  candidates: DecisionCandidate[],
  context: IntentionContext,
  constraints: HardConstraint[] = DEFAULT_CONSTRAINTS
): { allowed: DecisionCandidate[]; blocked: { candidate: DecisionCandidate; reason: string }[] } {
  const allowed: DecisionCandidate[] = [];
  const blocked: { candidate: DecisionCandidate; reason: string }[] = [];

  for (const candidate of candidates) {
    let violated = false;
    let violationReason = '';

    for (const constraint of constraints) {
      if (!constraint.active(context)) continue;
      if (constraint.violated(candidate, context)) {
        violated = true;
        violationReason = `违反硬约束[${constraint.id}]: ${constraint.description} (来源: ${constraint.source})`;
        break;
      }
    }

    if (violated) {
      blocked.push({ candidate, reason: violationReason });
    } else {
      allowed.push(candidate);
    }
  }

  return { allowed, blocked };
}

// ---------- 默认硬约束列表 ----------
export const DEFAULT_CONSTRAINTS: HardConstraint[] = [
  WolfNoAttackTeammateConstraint,
  WolfNoKillTeammateConstraint,
  ProphetMustClaimWolfConstraint,
];

// ---------- 意图解释器 ----------
export function explainIntention(
  desire: DesireProfile,
  blocked: { candidate: DecisionCandidate; reason: string }[],
  allPlayers: Player[]
): string {
  const lines: string[] = [];
  lines.push(`[意图状态] 模式=${desire.mode} | 阵营目标=${desire.teamObjective} | 个人目标=${desire.personalObjective}`);

  if (blocked.length > 0) {
    lines.push(`[被硬约束拦截的候选]`);
    blocked.forEach(b => {
      const targetName = b.candidate.target
        ? allPlayers.find(p => p.id === b.candidate.target)?.name || b.candidate.target
        : '无目标';
      lines.push(`  ○ ${b.candidate.action}→${targetName} (${b.reason})`);
    });
  }

  return lines.join('\n');
}
