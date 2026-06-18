// ============================================================
// Intention System (BDI Extension) — Complete Architecture
// ============================================================
// BDI Model: Belief → Desire → Intention → Plan → Behavior
//
// 核心概念（基于论文设计）:
// 1. Desire (愿望): 从游戏状态推导出的目标倾向。受阵营、角色、局势驱动。
// 2. Intention (意图): 已选择并承诺执行的愿望。具有持久性（Commitment）。
// 3. Plan (计划): 意图分解为行为序列。支持条件判断和回退。
// 4. Commitment (承诺): 意图改变难度。STRONG 几乎不可改变，WEAK 灵活。
// 5. Conflict Resolution (冲突消解): 多意图竞争时的仲裁机制。
//    优先级: ROLE_DUTY(硬) > TEAM_DUTY(硬) > PERSONAL_GOAL > REACTION > OPPORTUNITY
// 6. Intention Inference (意图推断): L2 Theory of Mind 扩展——推断他人意图。
//
// 与旧系统的本质区别:
// 旧系统: 每回合独立评分 → 加权随机选行为（无记忆、无一致性）
// 新系统: 意图栈驱动行为 → 计划按步骤执行 → 行为前后一致
// ============================================================

import type { BeliefSystem } from './belief-system';
import type { Player } from '@/types';

// =====================================================================
// SECTION 1: Core Types
// =====================================================================

export enum IntentionType {
  ATTACK = 'attack', // 攻击/淘汰目标
  DEFEND = 'defend', // 保护目标
  CONCEAL = 'conceal', // 隐藏自身身份
  REVEAL = 'reveal', // 揭露信息
  INVESTIGATE = 'investigate', // 调查/查验
  SURVIVE = 'survive', // 个人生存
  RECRUIT = 'recruit', // 拉票/建立信任
  CUT_LOSS = 'cut_loss', // 切割/止损（狼人Bus队友）
  FOLLOW = 'follow', // 跟随他人号召
  SILENCE = 'silence', // 保持沉默/观察
}

export enum IntentionSource {
  ROLE_DUTY = 'role_duty', // 角色义务（硬约束）
  TEAM_DUTY = 'team_duty', // 团队义务（硬约束）
  PERSONAL_GOAL = 'personal_goal', // 个人目标
  REACTION = 'reaction', // 对事件的即时反应
  OPPORTUNITY = 'opportunity', // 机会驱动
}

export enum CommitmentLevel {
  STRONG = 'strong', // 几乎不可改变（如预言家公布查验）
  MEDIUM = 'medium', // 需要强烈证据才改变
  WEAK = 'weak', // 灵活改变
}

/** 计划步骤：意图分解为具体行为 */
export interface PlanStep {
  phase: string; // 适用阶段（day/vote/appendix/night）
  action: string; // 行为类型
  targetRequired: boolean; // 是否需要目标
  condition?: (ctx: IntentionExecutionContext) => boolean; // 执行条件
  fallback?: string; // 条件不满足时的回退行为
}

/** 意图：高层决策单元，有持久性 */
export interface Intention {
  id: string;
  type: IntentionType;
  targetId: string | null; // 目标玩家ID或null
  priority: number; // 0-1000，动态计算
  commitment: CommitmentLevel;
  source: IntentionSource;
  plan: PlanStep[];
  currentStepIndex: number; // 当前执行到第几步
  lifetime: number; // 剩余回合寿命（-1=永久）
  createdRound: number;
  context: Record<string, unknown>; // 额外上下文
  active: boolean;
  abandoned?: boolean;
  abandonReason?: string;
  // 历史追踪
  executionHistory: { round: number; phase: string; action: string; result: 'executed' | 'skipped' | 'blocked' }[];
}

/** 意图执行上下文 */
export interface IntentionExecutionContext {
  self: Player;
  belief: BeliefSystem;
  allPlayers: Player[];
  phase: string;
  publicActions?: { actorId: string; type: string; targetId?: string }[];
  voteRound?: number;
  voteCandidates?: string[];
}

/** 愿望：意图的前置，从状态推导 */
export interface Desire {
  type: IntentionType;
  targetId: string | null;
  strength: number; // 0-100
  source: IntentionSource;
  reason: string;
  conditions: string[]; // 触发条件描述
}

// =====================================================================
// SECTION 2: Desire Engine — 从状态推导愿望
// =====================================================================

export class DesireEngine {
  generateDesires(self: Player, belief: BeliefSystem, allPlayers: Player[], round: number): Desire[] {
    const desires: Desire[] = [];
    const aliveWolves = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
    const aliveVillagers = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;
    const myExposure = belief.getExposure();

    // === ROLE_DUTY: 角色义务 ===
    if (self.role === 'prophet') {
      const checks = belief.l0Facts.checks;
      for (const [targetId, result] of Object.entries(checks)) {
        if (result === 'werewolf') {
          const target = allPlayers.find((p) => p.id === targetId);
          if (target?.alive) {
            desires.push({
              type: IntentionType.REVEAL,
              targetId,
              strength: 1000,
              source: IntentionSource.ROLE_DUTY,
              reason: `预言家查验到${target.name}是狼人，必须公布`,
              conditions: ['role=prophet', 'check_result=werewolf', 'target_alive'],
            });
          }
        }
      }
    }

    // === TEAM_DUTY: 团队义务 ===
    if (self.team === 'werewolf') {
      // 狼人团队义务：淘汰村民阵营
      const villagerTargets = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');
      for (const target of villagerTargets) {
        const suspicion = belief.getWerewolfProbability(target.id);
        // 狼人知道谁是村民，所以目标是村民
        desires.push({
          type: IntentionType.ATTACK,
          targetId: target.id,
          strength: 600 + Math.round(suspicion * 100),
          source: IntentionSource.TEAM_DUTY,
          reason: `狼人团队义务：淘汰村民${target.name}`,
          conditions: ['team=werewolf', 'target=villager'],
        });
      }

      // 切割模式：队友极度暴露且自身安全
      const teammates = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team === self.team);
      for (const teammate of teammates) {
        const teammateExposure = belief.getPlayerExposure(teammate.id);
        if (teammateExposure > 0.8 && myExposure < 0.5 && aliveWolves < aliveVillagers) {
          desires.push({
            type: IntentionType.CUT_LOSS,
            targetId: teammate.id,
            strength: 700,
            source: IntentionSource.TEAM_DUTY,
            reason: `队友${teammate.name}极度暴露，切割保团队`,
            conditions: ['teammate_exposure>0.8', 'self_exposure<0.5', 'wolf_disadvantage'],
          });
        }
      }
    } else {
      // 村民团队义务：找出狼人
      const suspects = allPlayers
        .filter((p) => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) > 0.5)
        .sort((a, b) => belief.getWerewolfProbability(b.id) - belief.getWerewolfProbability(a.id));

      for (const suspect of suspects.slice(0, 2)) {
        desires.push({
          type: IntentionType.ATTACK,
          targetId: suspect.id,
          strength: 500 + Math.round(belief.getWerewolfProbability(suspect.id) * 300),
          source: IntentionSource.TEAM_DUTY,
          reason: `村民义务：淘汰高嫌疑狼人${suspect.name}`,
          conditions: ['team=villager', 'suspect_wolf_prob>0.5'],
        });
      }
    }

    // === PERSONAL_GOAL: 个人目标 ===
    // 生存压力
    if (myExposure > 0.6) {
      desires.push({
        type: IntentionType.SURVIVE,
        targetId: null,
        strength: 800,
        source: IntentionSource.PERSONAL_GOAL,
        reason: `自身暴露度${myExposure.toFixed(2)}过高，需自保`,
        conditions: ['self_exposure>0.6'],
      });
    }

    // 狼人隐藏身份
    if (self.team === 'werewolf' && myExposure < 0.4) {
      desires.push({
        type: IntentionType.CONCEAL,
        targetId: null,
        strength: 500,
        source: IntentionSource.PERSONAL_GOAL,
        reason: '狼人需隐藏身份，伪装好人',
        conditions: ['team=werewolf', 'self_exposure<0.4'],
      });
    }

    // 建立信任（领导属性高）
    if (self.attributes.leadership > 6) {
      desires.push({
        type: IntentionType.RECRUIT,
        targetId: null,
        strength: 300 + self.attributes.leadership * 30,
        source: IntentionSource.PERSONAL_GOAL,
        reason: '领导属性高，倾向于建立影响力',
        conditions: ['leadership>6'],
      });
    }

    // === REACTION: 对事件的即时反应 ===
    // 被攻击时反击
    if (belief.l2TheoryOfMind.othersBeliefs) {
      const attackers = Object.entries(belief.l2TheoryOfMind.othersBeliefs)
        .filter(([, beliefs]) => beliefs[self.id] > 0.6)
        .map(([id]) => id);
      for (const attackerId of attackers) {
        const attacker = allPlayers.find((p) => p.id === attackerId);
        if (attacker?.alive) {
          desires.push({
            type: IntentionType.DEFEND,
            targetId: self.id,
            strength: 400,
            source: IntentionSource.REACTION,
            reason: `${attacker?.name}在攻击我，需反击或自证`,
            conditions: ['being_attacked'],
          });
          desires.push({
            type: IntentionType.ATTACK,
            targetId: attackerId,
            strength: 350,
            source: IntentionSource.REACTION,
            reason: `反咬攻击者${attacker?.name}`,
            conditions: ['being_attacked'],
          });
        }
      }
    }

    // === OPPORTUNITY: 机会驱动 ===
    // 有人号召投票，跟随机会
    // 在 IntentionManager 中处理，这里不生成

    return desires.sort((a, b) => b.strength - a.strength);
  }
}

// =====================================================================
// SECTION 3: Plan Library — 预定义计划模板
// =====================================================================

export class PlanLibrary {
  static getPlan(intentionType: IntentionType, targetId: string | null, self: Player, allPlayers: Player[]): PlanStep[] {
    switch (intentionType) {
      case IntentionType.ATTACK:
        return PlanLibrary._attackPlan(targetId, self, allPlayers);
      case IntentionType.DEFEND:
        return PlanLibrary._defendPlan(targetId, self);
      case IntentionType.CONCEAL:
        return PlanLibrary._concealPlan(self);
      case IntentionType.REVEAL:
        return PlanLibrary._revealPlan(targetId, self);
      case IntentionType.INVESTIGATE:
        return PlanLibrary._investigatePlan(targetId);
      case IntentionType.SURVIVE:
        return PlanLibrary._survivePlan(self, allPlayers);
      case IntentionType.RECRUIT:
        return PlanLibrary._recruitPlan(self, allPlayers);
      case IntentionType.CUT_LOSS:
        return PlanLibrary._cutLossPlan(targetId, self);
      case IntentionType.FOLLOW:
        return PlanLibrary._followPlan(targetId);
      case IntentionType.SILENCE:
        return PlanLibrary._silencePlan();
      default:
        return [];
    }
  }

  private static _attackPlan(targetId: string | null, self: Player, _allPlayers: Player[]): PlanStep[] {
    if (!targetId) return [];
    const steps: PlanStep[] = [];
    if (self.team === 'werewolf') {
      // 狼人攻击：伪装怀疑 → 号召投票 → 投票
      steps.push(
        { phase: 'day', action: 'suspect', targetRequired: true },
        { phase: 'day', action: 'call_vote', targetRequired: true },
        { phase: 'vote', action: 'vote', targetRequired: true }
      );
    } else {
      // 村民攻击：指认 → 号召投票 → 投票
      steps.push(
        { phase: 'day', action: 'accuse', targetRequired: true },
        { phase: 'day', action: 'call_vote', targetRequired: true },
        { phase: 'vote', action: 'vote', targetRequired: true }
      );
    }
    return steps;
  }

  private static _defendPlan(targetId: string | null, _self: Player): PlanStep[] {
    if (!targetId) return [];
    return [
      { phase: 'day', action: 'defend', targetRequired: true },
      { phase: 'day', action: 'guarantee', targetRequired: true },
      { phase: 'appendix', action: 'join_defend', targetRequired: true },
    ];
  }

  private static _concealPlan(self: Player): PlanStep[] {
    if (self.team === 'werewolf') {
      return [
        { phase: 'day', action: 'speak', targetRequired: false },
        { phase: 'day', action: 'suspect', targetRequired: true },
        { phase: 'vote', action: 'vote', targetRequired: true },
      ];
    }
    return [
      { phase: 'day', action: 'observe', targetRequired: true },
      { phase: 'day', action: 'speak', targetRequired: false },
    ];
  }

  private static _revealPlan(targetId: string | null, self: Player): PlanStep[] {
    if (self.role === 'prophet' && targetId) {
      return [
        { phase: 'day', action: 'claim_identity', targetRequired: true },
        { phase: 'day', action: 'call_vote', targetRequired: true },
        { phase: 'vote', action: 'vote', targetRequired: true },
      ];
    }
    return [{ phase: 'day', action: 'reveal_info', targetRequired: false }];
  }

  private static _investigatePlan(targetId: string | null): PlanStep[] {
    if (!targetId) return [];
    return [{ phase: 'night', action: 'check', targetRequired: true }];
  }

  private static _survivePlan(self: Player, allPlayers: Player[]): PlanStep[] {
    if (self.team === 'werewolf') {
      // 狼人自保：攻击低嫌疑目标洗白
      const lowSuspect = allPlayers
        .filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf')
        .sort((a, b) => a.stress - b.stress)[0];
      if (lowSuspect) {
        return [
          { phase: 'day', action: 'suspect', targetRequired: true },
          { phase: 'vote', action: 'vote', targetRequired: true },
        ];
      }
    }
    return [
      { phase: 'day', action: 'guarantee', targetRequired: true },
      { phase: 'day', action: 'defend', targetRequired: true },
      { phase: 'appendix', action: 'rebut', targetRequired: true },
    ];
  }

  private static _recruitPlan(self: Player, allPlayers: Player[]): PlanStep[] {
    const highTrust = allPlayers
      .filter((p) => p.id !== self.id && p.alive)
      .sort((a, b) => (self.relations[b.id]?.trust ?? 0) - (self.relations[a.id]?.trust ?? 0))[0];
    if (highTrust) {
      return [
        { phase: 'day', action: 'speak', targetRequired: false },
        { phase: 'day', action: 'defend', targetRequired: true },
      ];
    }
    return [{ phase: 'day', action: 'speak', targetRequired: false }];
  }

  private static _cutLossPlan(targetId: string | null, _self: Player): PlanStep[] {
    if (!targetId) return [];
    return [
      { phase: 'day', action: 'suspect', targetRequired: true },
      { phase: 'day', action: 'call_vote', targetRequired: true },
      { phase: 'vote', action: 'vote', targetRequired: true },
    ];
  }

  private static _followPlan(targetId: string | null): PlanStep[] {
    if (!targetId) return [];
    return [
      { phase: 'day', action: 'join_suspect', targetRequired: true },
      { phase: 'vote', action: 'vote', targetRequired: true },
    ];
  }

  private static _silencePlan(): PlanStep[] {
    return [
      { phase: 'day', action: 'silence', targetRequired: false },
      { phase: 'day', action: 'observe', targetRequired: true },
    ];
  }

  /** 获取当前阶段对应的计划步骤 */
  static getStepForPhase(plan: PlanStep[], phase: string): PlanStep | null {
    return plan.find((s) => s.phase === phase) || null;
  }
}

// =====================================================================
// SECTION 4: Intention Manager — 意图栈管理
// =====================================================================

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

    // 2. 从愿望生成新意图候选
    const desires = this._desireEngine.generateDesires(self, belief, allPlayers, round);
    const newIntentions = this._desiresToIntentions(desires, round, self, allPlayers);

    // 3. 合并意图栈，处理冲突
    for (const newInt of newIntentions) {
      this._mergeIntention(newInt, self, belief, allPlayers);
    }

    // 4. 根据外部事件调整意图（如被攻击、被号召投票）
    if (publicActions) {
      this._reactToEvents(publicActions, self, belief, allPlayers);
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
  getSummary(): string {
    const lines = this.intentions.map((i) => {
      const status = i.abandoned ? '[已放弃]' : i.active ? '[激活]' : '[完成]';
      const stepInfo = i.plan[i.currentStepIndex]
        ? `${i.plan[i.currentStepIndex].phase}:${i.plan[i.currentStepIndex].action}`
        : '无';
      return `  ${status} ${i.type}→${i.targetId || '无'} (优先级${i.priority}, 承诺${i.commitment}, 来源${i.source}) 计划:${stepInfo}`;
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
      const lifetime = d.source === IntentionSource.ROLE_DUTY || d.source === IntentionSource.TEAM_DUTY ? -1 : 3;
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

  private _mergeIntention(newInt: Intention, self: Player, belief: BeliefSystem, allPlayers: Player[]) {
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
    const conflicts = this.intentions.filter((i) => !i.abandoned && this._intentionsConflict(i, newInt, self, belief, allPlayers));
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

  private _intentionsConflict(a: Intention, b: Intention, self: Player, _belief: BeliefSystem, allPlayers: Player[]): boolean {
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
    _belief: BeliefSystem,
    allPlayers: Player[]
  ) {
    // 被号召投票时，生成 FOLLOW 意图
    const callsOnMe = publicActions.filter((a) => a.type === 'call_vote' && a.targetId === self.id);
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
          this._mergeIntention(defendIntention, self, _belief, allPlayers);
        }
      }
    }
  }

  private _sortIntentions() {
    this.intentions.sort((a, b) => {
      const aScore = this._sourcePriority(a.source) * 1000 + a.priority + (a.commitment === CommitmentLevel.STRONG ? 100 : 0);
      const bScore = this._sourcePriority(b.source) * 1000 + b.priority + (b.commitment === CommitmentLevel.STRONG ? 100 : 0);
      return bScore - aScore;
    });
  }

  private _isRelevantToPhase(intention: Intention, phase: string): boolean {
    return intention.plan.some((s) => s.phase === phase);
  }
}

// =====================================================================
// SECTION 5: Hard Constraints (Legacy Interface — 保留兼容)
// =====================================================================

export interface IntentionContext {
  belief: BeliefSystem;
  self: Player;
  phase: string;
  allPlayers: Player[];
  publicActions?: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[];
  voteRound?: number;
  voteCandidates?: string[];
}

export interface HardConstraint {
  id: string;
  description: string;
  violated: (candidate: { action: string; target: string | null }, context: IntentionContext) => boolean;
  active: (context: IntentionContext) => boolean;
  source: 'team_duty' | 'role_duty' | 'survival' | 'bus';
}

export const WolfNoAttackTeammateConstraint: HardConstraint = {
  id: 'wolf_no_attack_teammate',
  description: '狼人白天不得主动号召投票/强烈指认/怀疑队友（除非进入切割模式）',
  active(context) {
    if (context.self.team !== 'werewolf' || !context.self.alive) return false;
    return true;
  },
  violated(candidate, context) {
    if (!candidate.target) return false;
    const target = context.allPlayers.find((p) => p.id === candidate.target);
    if (!target || target.team !== 'werewolf') return false;
    const attackActions = ['call_vote', 'accuse', 'suspect', 'vote'];
    return attackActions.includes(candidate.action);
  },
  source: 'team_duty',
};

export function filterByHardConstraints(
  candidates: { action: string; target: string | null; score?: number; confidence?: number; reason?: string; strategy?: string; rule?: string }[],
  context: IntentionContext,
  constraints: HardConstraint[] = [WolfNoAttackTeammateConstraint]
): { allowed: typeof candidates; blocked: { candidate: typeof candidates[0]; reason: string }[] } {
  const allowed: typeof candidates = [];
  const blocked: { candidate: typeof candidates[0]; reason: string }[] = [];

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

// =====================================================================
// SECTION 6: Legacy Helpers (保留兼容)
// =====================================================================

export function generateDesireProfile(self: Player, belief: BeliefSystem, allPlayers: Player[]): {
  teamObjective: string;
  personalObjective: string;
  mode: 'normal' | 'bus' | 'desperate' | 'dominant';
} {
  const aliveWolves = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
  const aliveVillagers = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;
  const myExposure = belief.getExposure();

  let mode: 'normal' | 'bus' | 'desperate' | 'dominant' = 'normal';
  if (self.team === 'werewolf') {
    if (aliveWolves < aliveVillagers && myExposure > 0.6) {
      mode = 'desperate';
    } else if (aliveWolves >= aliveVillagers) {
      mode = 'dominant';
    }
  } else {
    if (aliveWolves >= aliveVillagers) {
      mode = 'desperate';
    }
  }

  const teamObjective = self.team === 'werewolf' ? 'eliminate_opposition' : 'find_wolves';
  let personalObjective = 'gain_trust';
  if (self.team === 'werewolf') {
    personalObjective = mode === 'desperate' ? 'survive' : 'maintain_cover';
  } else if (self.role === 'prophet') {
    personalObjective = 'reveal_truth';
  }

  return { teamObjective, personalObjective, mode };
}

export function explainIntention(
  desire: ReturnType<typeof generateDesireProfile>,
  blocked: { candidate: { action: string; target: string | null }; reason: string }[],
  allPlayers: Player[]
): string {
  const lines: string[] = [];
  lines.push(`[意图状态] 模式=${desire.mode} | 阵营目标=${desire.teamObjective} | 个人目标=${desire.personalObjective}`);

  if (blocked.length > 0) {
    lines.push(`[被硬约束拦截的候选]`);
    blocked.forEach((b) => {
      const targetName = b.candidate.target
        ? allPlayers.find((p) => p.id === b.candidate.target)?.name || b.candidate.target
        : '无目标';
      lines.push(`  ○ ${b.candidate.action}→${targetName} (${b.reason})`);
    });
  }

  return lines.join('\n');
}

export function isBusMode(context: IntentionContext): boolean {
  if (context.self.team !== 'werewolf') return false;

  const allWolves = context.allPlayers.filter((p) => p.team === 'werewolf' && p.alive);
  const allVillagers = context.allPlayers.filter((p) => p.team !== 'werewolf' && p.alive);

  if (allWolves.length >= allVillagers.length) return false;

  const teammates = allWolves.filter((p) => p.id !== context.self.id);
  for (const teammate of teammates) {
    const exposure = context.belief.getPlayerExposure(teammate.id);
    const myExposure = context.belief.getExposure();
    if (exposure > 0.8 && myExposure < 0.5) {
      return true;
    }
  }

  return false;
}
