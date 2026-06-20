// ============================================================
// Intention Manager — 意图栈管理
// ============================================================

import { ACTION } from '@/lib/constants/action-constants';
import {
  INTENTION_TYPE_NAMES, INTENTION_SOURCE_NAMES, PLAN_PHASE_NAMES, ACTION_NAMES,
  COMMITMENT_NAMES,
} from '@/lib/constants/display-names';
import type { Player, DecisionCandidate } from '@/types';
import {
  INTENTION_LIFETIME_ROLE_DUTY,
  INTENTION_LIFETIME_DEFAULT,
} from '@/types';

import type { BeliefSystem } from '../belief-system';
import {
  IntentionType, IntentionSource, CommitmentLevel,
  type Intention, type Desire, type PlanStep,
} from './types';
import { DesireEngine } from './desire-engine';
import { PlanLibrary } from './plan-library';
import { generateDesireProfile } from './legacy';

export class IntentionManager {
  intentions: Intention[] = [];
  private _desireEngine: DesireEngine;
  private _round: number = 0;

  constructor() {
    this._desireEngine = new DesireEngine();
  }

  /** 每回合开始时更新意图栈 */
  update(self: Player, belief: BeliefSystem, allPlayers: Player[], round: number, publicActions?: { actorId: string; type: string; targetId?: string }[]) {
    this._round = round;

    // 1. 清理过期/完成的意图
    this._cleanupIntentions();

    // 2. 从愿望生成新意图候选（模式影响欲望强度）
    const desireProfile = generateDesireProfile(self, belief, allPlayers);
    const desires = this._desireEngine.generateDesires(self, belief, allPlayers, desireProfile.mode);
    const newIntentions = this._desiresToIntentions(desires, round, self, allPlayers);

    // 3. 合并意图栈，处理冲突
    for (const newInt of newIntentions) {
      this._mergeIntention(newInt, self, allPlayers);
    }

    // 4. 根据外部事件调整意图（如被攻击、被号召投票）
    if (publicActions) {
      this._reactToEvents(publicActions, self, allPlayers);
    }

    // 5. 排序：按优先级和承诺
    this._sortIntentions();
  }

  /** 获取当前最高优先级且激活的意图 */
  getTopIntention(phase: string): Intention | null {
    return (
      this.intentions.find((i) => i.active && !i.abandoned && this._isRelevantToPhase(i, phase)) || null
    );
  }

  /** 为指定阶段生成意图驱动的决策候选 */
  generateCandidates(phase: string, allPlayers: Player[], self: Player): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];
    const typeNames = INTENTION_TYPE_NAMES;
    const actionNames = ACTION_NAMES;

    const activeIntentions = this.getActiveIntentions().filter(
      (i) => i.plan.some((s) => s.phase === phase)
    );

    for (const intention of activeIntentions) {
      const step = PlanLibrary.getStepForPhase(intention.plan, phase);
      if (!step?.action) continue;

      let targetId: string | null = null;
      if (step.targetRequired) {
        if (intention.targetId) {
          targetId = intention.targetId;
        } else {
          const others = allPlayers.filter((p) => p.id !== self.id && p.alive);
          if (others.length > 0) {
            targetId = others[Math.floor(Math.random() * others.length)].id;
          }
        }
      }

      const isTop = intention === this.getTopIntention(phase);
      const targetName = targetId ? (allPlayers.find((p) => p.id === targetId)?.name || targetId) : '无';

      candidates.push({
        action: step.action,
        target: targetId,
        score: intention.priority,
        confidence: 0.6,
        reason: `[意图${isTop ? '驱动' : '补充'}] ${typeNames[intention.type] || intention.type}${targetId ? `→${targetName}` : ''}，计划步骤=${actionNames[step.action] || step.action}`,
        stage: 'intention',
        strategy: 'IntentionManager',
        rule: isTop ? 'top_intention_step' : 'secondary_intention_step',
        trigger: `意图=${typeNames[intention.type] || intention.type}（优先级${intention.priority}，来源${intention.source}），计划=${step.phase}:${step.action}`,
        intentionDrivenBonus: isTop ? 200 : 50,
      });
    }

    return candidates;
  }

  /** 获取所有激活的意图 */
  getActiveIntentions(): Intention[] {
    return this.intentions.filter((i) => i.active && !i.abandoned);
  }

  /** 获取当前意图的目标行为 */
  getIntendedAction(phase: string): { type: IntentionType; targetId: string | null; step: PlanStep | null } | null {
    const top = this.getTopIntention(phase);
    if (!top) return null;
    const step = PlanLibrary.getStepForPhase(top.plan, phase);
    return { type: top.type, targetId: top.targetId, step };
  }

  /** 执行意图的当前步骤（推进计划） */
  advanceStep(intentionId: string, phase: string, action: string) {
    const intention = this.intentions.find((i) => i.id === intentionId);
    if (!intention) return;
    intention.executionHistory.push({
      round: this._round,
      phase,
      action,
      result: 'executed',
    });
    // 找到下一步
    const nextIndex = intention.plan.findIndex((s, idx) => idx > intention.currentStepIndex && s.phase === phase);
    if (nextIndex >= 0) {
      intention.currentStepIndex = nextIndex;
    } else {
      // 尝试推进到下一阶段
      const currentStep = intention.plan[intention.currentStepIndex];
      if (currentStep && currentStep.phase === phase) {
        intention.currentStepIndex++;
      }
    }
    // 计划完成
    if (intention.currentStepIndex >= intention.plan.length) {
      intention.active = false;
    }
    intention.lifetime--;
    if (intention.lifetime === 0) {
      intention.active = false;
    }
  }

  /** 放弃意图 */
  abandonIntention(intentionId: string, reason: string) {
    const intention = this.intentions.find((i) => i.id === intentionId);
    if (!intention) return;
    // STRONG 承诺的意图不能轻易放弃（除非硬约束冲突）
    if (intention.commitment === CommitmentLevel.STRONG) {
      // 记录但保留（除非被更高优先级硬约束覆盖）
      return;
    }
    intention.abandoned = true;
    intention.abandonReason = reason;
    intention.active = false;
  }

  /** 获取意图栈摘要（用于调试展示） */
  getSummary(allPlayers?: Player[]): string {
    const getName = (id: string | null | undefined) => {
      if (!id) return '无';
      const p = allPlayers?.find((x) => x.id === id);
      return p ? p.name : id;
    };
    const typeNames = INTENTION_TYPE_NAMES;
    const sourceNames = INTENTION_SOURCE_NAMES;
    const phaseNames = PLAN_PHASE_NAMES;
    const actionNames = ACTION_NAMES;
    const commitmentNames = COMMITMENT_NAMES;
    const lines = this.intentions.map((i) => {
      const status = i.abandoned ? '[已放弃]' : i.active ? '[激活]' : '[完成]';
      const stepInfo = i.plan[i.currentStepIndex]
        ? `${phaseNames[i.plan[i.currentStepIndex].phase] || i.plan[i.currentStepIndex].phase},${actionNames[i.plan[i.currentStepIndex].action] || i.plan[i.currentStepIndex].action}`
        : '无';
      return `  ${status} ${typeNames[i.type] || i.type}${i.targetId ? `→${getName(i.targetId)}` : ''} (优先级${i.priority}, 意愿强度${commitmentNames[i.commitment] || i.commitment}, 来源${sourceNames[i.source] || i.source}) 计划:${stepInfo}`;
    });
    return lines.join('\n');
  }

  // -------- Private --------

  private _cleanupIntentions() {
    this.intentions = this.intentions.filter((i) => {
      if (i.abandoned) return false;
      if (i.lifetime <= 0 && i.lifetime !== -1) return false;
      return true;
    });
  }

  private _desiresToIntentions(desires: Desire[], round: number, self: Player, allPlayers: Player[]): Intention[] {
    return desires.map((d, idx) => {
      const plan = PlanLibrary.getPlan(d.type, d.targetId, self, allPlayers);
      const commitment = this._sourceToCommitment(d.source);
      const lifetime = d.source === IntentionSource.ROLE_DUTY || d.source === IntentionSource.TEAM_DUTY
        ? INTENTION_LIFETIME_ROLE_DUTY
        : INTENTION_LIFETIME_DEFAULT;
      return {
        id: `${d.type}_${d.targetId || 'none'}_${round}_${idx}`,
        type: d.type,
        targetId: d.targetId,
        priority: d.strength,
        commitment,
        source: d.source,
        plan,
        currentStepIndex: 0,
        lifetime,
        createdRound: round,
        context: { desireReason: d.reason },
        active: true,
        executionHistory: [],
      };
    });
  }

  private _sourceToCommitment(source: IntentionSource): CommitmentLevel {
    switch (source) {
      case IntentionSource.ROLE_DUTY:
        return CommitmentLevel.STRONG;
      case IntentionSource.TEAM_DUTY:
        return CommitmentLevel.MEDIUM;
      case IntentionSource.PERSONAL_GOAL:
        return CommitmentLevel.WEAK;
      case IntentionSource.REACTION:
        return CommitmentLevel.WEAK;
      case IntentionSource.OPPORTUNITY:
        return CommitmentLevel.WEAK;
      default:
        return CommitmentLevel.WEAK;
    }
  }

  private _mergeIntention(newInt: Intention, self: Player, allPlayers: Player[]) {
    // 检查是否已有相同类型+目标的意图
    const existing = this.intentions.find((i) => i.type === newInt.type && i.targetId === newInt.targetId && !i.abandoned);
    if (existing) {
      // 更新优先级（如果新意图更强）
      if (newInt.priority > existing.priority) {
        existing.priority = newInt.priority;
      }
      // 如果新意图来源更强，更新来源和承诺
      if (this._sourcePriority(newInt.source) > this._sourcePriority(existing.source)) {
        existing.source = newInt.source;
        existing.commitment = newInt.commitment;
      }
      return;
    }

    // 冲突检测：检查是否有冲突的意图
    const conflicts = this.intentions.filter((i) => !i.abandoned && this._intentionsConflict(i, newInt, self, allPlayers));
    if (conflicts.length > 0) {
      // 冲突消解：按来源优先级 + 承诺级别决定
      for (const conflict of conflicts) {
        const resolution = this._resolveConflict(newInt, conflict);
        if (resolution === 'abandon_new') {
          return; // 新意图被放弃
        } else if (resolution === 'abandon_existing') {
          this.abandonIntention(conflict.id, `被更高优先级意图${newInt.type}覆盖`);
        }
        // 'coexist' 则保留两者
      }
    }

    this.intentions.push(newInt);
  }

  private _intentionsConflict(a: Intention, b: Intention, self: Player, allPlayers: Player[]): boolean {
    // 同类型不同目标：冲突（如同时攻击两个不同的人）
    if (a.type === b.type && a.targetId !== b.targetId && a.targetId && b.targetId) {
      // 但 CUT_LOSS 和 ATTACK 不冲突（Bus队友同时攻击村民）
      if (a.type === IntentionType.ATTACK && b.type === IntentionType.CUT_LOSS) return false;
      return true;
    }
    // 攻击队友 vs 保护队友：冲突
    if (a.type === IntentionType.ATTACK && b.type === IntentionType.DEFEND && a.targetId === b.targetId) return true;
    if (a.type === IntentionType.DEFEND && b.type === IntentionType.ATTACK && a.targetId === b.targetId) return true;
    // 隐藏 vs 揭露：冲突
    if (a.type === IntentionType.CONCEAL && b.type === IntentionType.REVEAL) return true;
    // 攻击目标如果是队友：冲突
    if (a.type === IntentionType.ATTACK && a.targetId) {
      const target = allPlayers.find((p) => p.id === a.targetId);
      if (target && target.team === self.team) {
        // 除非 b 是 CUT_LOSS
        if (b.type !== IntentionType.CUT_LOSS) return true;
      }
    }
    return false;
  }

  private _resolveConflict(newInt: Intention, existing: Intention): 'abandon_new' | 'abandon_existing' | 'coexist' {
    const newPriority = this._sourcePriority(newInt.source) * 10 + (newInt.commitment === CommitmentLevel.STRONG ? 3 : newInt.commitment === CommitmentLevel.MEDIUM ? 2 : 1);
    const existingPriority = this._sourcePriority(existing.source) * 10 + (existing.commitment === CommitmentLevel.STRONG ? 3 : existing.commitment === CommitmentLevel.MEDIUM ? 2 : 1);

    if (newPriority > existingPriority) {
      return 'abandon_existing';
    } else if (existingPriority > newPriority) {
      return 'abandon_new';
    }
    // 优先级相同，按优先级数值
    if (newInt.priority > existing.priority) {
      return 'abandon_existing';
    }
    return 'abandon_new';
  }

  private _sourcePriority(source: IntentionSource): number {
    switch (source) {
      case IntentionSource.ROLE_DUTY:
        return 5;
      case IntentionSource.TEAM_DUTY:
        return 4;
      case IntentionSource.PERSONAL_GOAL:
        return 3;
      case IntentionSource.REACTION:
        return 2;
      case IntentionSource.OPPORTUNITY:
        return 1;
      default:
        return 0;
    }
  }

  private _reactToEvents(
    publicActions: { actorId: string; type: string; targetId?: string }[],
    self: Player,
    allPlayers: Player[]
  ) {
    // 被号召投票时，生成 FOLLOW 意图
    const callsOnMe = publicActions.filter((a) => a.type === ACTION.CALL_VOTE && a.targetId === self.id);
    for (const call of callsOnMe) {
      const caller = allPlayers.find((p) => p.id === call.actorId);
      if (caller?.alive) {
        // 检查是否已有攻击该目标的意图
        const existingAttack = this.intentions.find((i) => i.type === IntentionType.ATTACK && i.targetId === self.id && i.active);
        if (!existingAttack) {
          // 添加防御意图
          const defendIntention: Intention = {
            id: `defend_${self.id}_${this._round}`,
            type: IntentionType.DEFEND,
            targetId: self.id,
            priority: 400,
            commitment: CommitmentLevel.WEAK,
            source: IntentionSource.REACTION,
            plan: PlanLibrary.getPlan(IntentionType.DEFEND, self.id, self, allPlayers),
            currentStepIndex: 0,
            lifetime: 2,
            createdRound: this._round,
            context: { attackerId: call.actorId },
            active: true,
            executionHistory: [],
          };
          this._mergeIntention(defendIntention, self, allPlayers);
        }
      }
    }
  }

  private _sortIntentions() {
    this.intentions.sort((a, b) => {
      // sourcePriority 权重降低为100，让 priority（desire strength）主导排序
      const aScore = this._sourcePriority(a.source) * 100 + a.priority + (a.commitment === CommitmentLevel.STRONG ? 100 : 0);
      const bScore = this._sourcePriority(b.source) * 100 + b.priority + (b.commitment === CommitmentLevel.STRONG ? 100 : 0);
      return bScore - aScore;
    });
  }

  private _isRelevantToPhase(intention: Intention, phase: string): boolean {
    return intention.plan.some((s) => s.phase === phase);
  }
}
