import {IDENTITY_CRISIS_HIGH_THRESHOLD,
  WEREWOLF_PROBABILITY_LOW, WEREWOLF_PROBABILITY_MEDIUM, WEREWOLF_PROBABILITY_HIGH,
  STRESS_ANXIOUS_MIN,
  SCORE_BERSERKER_SUICIDE, SILENCE_NEAR_FULL_THRESHOLD,
  SCORE_PROPHET_CLAIM, SCORE_PROPHET_CALL_VOTE, SCORE_DEFEND_ATTACKED, SCORE_DEFEND_ATTACKED_BONUS,
  SCORE_SELF_GUARANTEE, SCORE_HIGH_SUSPECT_ACCUSE, SCORE_HIGH_SUSPECT_SUSPECT, SCORE_HIGH_SUSPECT_CALL_VOTE,
  SCORE_BEHAVIOR_OBSERVE, SCORE_FOLLOW_TRUSTED, SCORE_BREAK_SILENCE,
  SCORE_DEFAULT_ROUND1_OBSERVE, SCORE_DEFAULT_OTHER_OBSERVE,
  SCORE_WW_DEFEND_ATTACKED_ACCUSE, SCORE_WW_DEFEND_ATTACKED_SUSPECT,
  SCORE_WW_CAMOUFLAGE_BASE, SCORE_WW_CAMOUFLAGE_BONUS,
  SCORE_WW_TEAMMATE_CRISIS_GOUGE, SCORE_WW_TEAMMATE_CRISIS_DEFEND,
  SCORE_WW_BREAK_SILENCE, SCORE_WW_DEFAULT_ROUND1_TARGET, SCORE_WW_DEFAULT_ROUND1, SCORE_WW_DEFAULT_OTHER,
} from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import {
  STRATEGY_WOLF_PROB_CRITICAL,
  STRATEGY_IDENTITY_CRISIS_CRITICAL,
  STRATEGY_IDENTITY_CRISIS_SAFE,
  STRATEGY_SILENCE_SUSPICIOUS,
  STRATEGY_STRESS_SUSPICIOUS,
  STRATEGY_TRUST_LOW,
} from '@/lib/constants/strategy-thresholds';
import type { BeliefSystem } from '../belief-system';
import type { Strategy, } from './engine';
import type { Player } from '@/types';
import { canUseItem } from '@/types';

// ---------- Shared Helper: Break silence candidate ----------
function generateBreakSilenceCandidate(
  consecutiveSilence: number | undefined,
  aliveCount: number | undefined,
  strategyName: string,
  score: number,
  reason: string,
): import('@/types').DecisionCandidate | null {
  if (
    consecutiveSilence &&
    aliveCount &&
    consecutiveSilence >= aliveCount - SILENCE_NEAR_FULL_THRESHOLD
  ) {
    return {
      action: ACTION.SILENCE,
      target: null,
      score,
      confidence: 0.7,
      reason,
      strategy: strategyName,
      rule: 'break_silence',
      trigger: `consecutiveSilence=${consecutiveSilence} >= aliveCount-${SILENCE_NEAR_FULL_THRESHOLD}=${aliveCount - SILENCE_NEAR_FULL_THRESHOLD}`,
    };
  }
  return null;
}

// ---------- Shared Helper: Default behavior fallback ----------
function generateDefaultCandidates(
  self: Player,
  allPlayers: Player[],
  publicActions:
    | { actorId: string; type: string; targetId?: string }[]
    | undefined,
  strategyName: string,
  scores: {
    round1Observe: number;
    otherObserve: number;
  },
  reasons: {
    round1Observe: string;
    otherObserve: string;
  },
): import('@/types').DecisionCandidate[] {
  const result: import('@/types').DecisionCandidate[] = [];
  const aliveOthers = allPlayers.filter((p) => p.id !== self.id && p.alive);
  const randomTarget =
    aliveOthers.length > 0
      ? aliveOthers[Math.floor(Math.random() * aliveOthers.length)]
      : null;
  const isRound1 =
    (publicActions?.filter(
      (a) =>
        a.type === ACTION.SILENCE ||
        a.type === ACTION.SUSPECT ||
        a.type === ACTION.ACCUSE ||
        a.type === ACTION.DEFEND,
    ).length ?? 0) < 3;

  if (randomTarget) {
    result.push({
      action: ACTION.OBSERVE,
      target: randomTarget.id,
      score: isRound1 ? scores.round1Observe : scores.otherObserve,
      stageWeight: 0,
      confidence: 0.3,
      reason: isRound1
        ? reasons.round1Observe.replace('{name}', randomTarget.name)
        : reasons.otherObserve.replace('{name}', randomTarget.name),
      strategy: strategyName,
      rule: isRound1 ? 'default_round1_observe' : 'default_other_observe',
      trigger: isRound1
        ? '无更高优先级规则命中，且为第一轮'
        : '无更高优先级规则命中',
      random: true,
    });
  }

  return result;
}

// ---------- Helper: Generate rich suspicion reason from public actions ----------
function getSuspicionReason(
  belief: BeliefSystem,
  targetId: string,
  publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
  allPlayers: Player[]
): string {
  const reasons: string[] = [];
  const target = allPlayers.find(p => p.id === targetId);

  // 1. 被多人攻击
  const attacks = publicActions.filter(a => a.targetId === targetId && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE || a.type === ACTION.JOIN_SUSPECT));
  if (attacks.length >= 2) {
    reasons.push(`已经被${attacks.length}人攻击`);
  }

  // 2. 攻击过明显好人（泼脏水）
  const theirAttacks = publicActions.filter(a => a.actorId === targetId && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE));
  const attacksOnGood = theirAttacks.filter(a => {
    if (!a.targetId) return false;
    const targetProb = belief.getWerewolfProbability(a.targetId);
    return targetProb < WEREWOLF_PROBABILITY_LOW;
  });
  if (attacksOnGood.length > 0) {
    const victim = allPlayers.find(p => p.id === attacksOnGood[0].targetId);
    reasons.push(`攻击了明显的好人${victim?.name || ''}，像在泼脏水`);
  }

  // 3. 连续沉默
  const silenceCount = publicActions.filter(a => a.actorId === targetId && a.type === ACTION.SILENCE).length;
  if (silenceCount >= STRATEGY_SILENCE_SUSPICIOUS) {
    reasons.push(`连续${silenceCount}次沉默，似乎在隐藏`);
  }

  // 4. 阻止投票保护被多人怀疑的人
  const blocks = publicActions.filter(a => a.actorId === targetId && a.type === ACTION.BLOCK_VOTE);
  if (blocks.length > 0) {
    const blockedTarget = blocks[0].targetId;
    if (blockedTarget) {
      const blockedSuspicion = publicActions.filter(a => a.targetId === blockedTarget && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE)).length;
      if (blockedSuspicion >= 2) {
        const blockedPlayer = allPlayers.find(p => p.id === blockedTarget);
        reasons.push(`阻止投票保护被怀疑的${blockedPlayer?.name || ''}，像在保狼`);
      }
    }
  }

  // 5. 无依据号召投票
  const calls = publicActions.filter(a => a.actorId === targetId && a.type === ACTION.CALL_VOTE);
  if (calls.length > 0) {
    const callTarget = calls[0].targetId;
    if (callTarget) {
      const callTargetProb = belief.getWerewolfProbability(callTarget);
      if (callTargetProb < WEREWOLF_PROBABILITY_MEDIUM) {
        const calledPlayer = allPlayers.find(p => p.id === callTarget);
        reasons.push(`无依据号召投票${calledPlayer?.name || ''}，像在搅局`);
      }
    }
  }

  // 6. 压力高
  if (target && target.stress > STRESS_ANXIOUS_MIN) {
    reasons.push(`压力很大（${target.stress}）`);
  }

  // 7. 信任度低
  const trust = belief.l1Inferences.trustScore[targetId] ?? 0;
  if (trust < STRATEGY_TRUST_LOW) {
    reasons.push(`之前的表达可信度低`);
  }

  return reasons.length > 0 ? reasons.join('；') : '行为有些可疑';
}

// ---------- Helper: Generate wolf-attack reason for rebuttal ----------
function getWerewolfAttackReason(
  belief: BeliefSystem,
  attackerId: string,
  publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
  allPlayers: Player[]
): string {
  const reasons: string[] = [];
  const attacker = allPlayers.find(p => p.id === attackerId);

  const attacks = publicActions.filter(a => a.actorId === attackerId && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE));
  const goodAttacks = attacks.filter(a => {
    if (!a.targetId) return false;
    return belief.getWerewolfProbability(a.targetId) < WEREWOLF_PROBABILITY_LOW;
  });

  if (goodAttacks.length > 0) {
    const victim = allPlayers.find(p => p.id === goodAttacks[0].targetId);
    reasons.push(`攻击了明显好人${victim?.name || ''}`);
  }

  const silenceCount = publicActions.filter(a => a.actorId === attackerId && a.type === ACTION.SILENCE).length;
  if (silenceCount >= STRATEGY_SILENCE_SUSPICIOUS) {
    reasons.push(`连续沉默${silenceCount}次`);
  }

  const blocks = publicActions.filter(a => a.actorId === attackerId && a.type === ACTION.BLOCK_VOTE);
  if (blocks.length > 0) {
    const blockedTarget = blocks[0].targetId;
    if (blockedTarget) {
      const suspicion = publicActions.filter(a => a.targetId === blockedTarget && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE)).length;
      if (suspicion >= 2) {
        const blocked = allPlayers.find(p => p.id === blockedTarget);
        reasons.push(`保护被怀疑的${blocked?.name || ''}`);
      }
    }
  }

  if (attacker && attacker.stress > STRESS_ANXIOUS_MIN) {
    reasons.push(`压力很大（${attacker.stress}）`);
  }

  return reasons.length > 0 ? reasons.join('，') : '行为可疑';
}
// ---------- Villager: Rich Day Strategy with Real Motivations ----------
export const VillagerDayStrategy: Strategy = {
  name: 'villager_day',
  requiredRoles: undefined,
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount, publicActions } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const actions = publicActions || [];

    // === 意图系统硬约束：此策略专为非狼人设计 ===
    // 狼人白天行为由 WerewolfCamouflageStrategy 完全接管，避免"知道队友是狼人→号召投票队友"的荒谬逻辑
    if (self.team === 'werewolf') return result;

    // 局势分析
    const attacksOnMe = actions.filter(a => a.targetId === self.id && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE));
    const myAttackers = [...new Set(attacksOnMe.map(a => a.actorId))].map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
    const trustedCallers = actions.filter(a => a.type === ACTION.CALL_VOTE && a.actorId !== self.id && (belief.l1Inferences.trustScore[a.actorId] ?? 0) > 3);
    const suspectRanking = belief.getSuspectRanking(allPlayers);
    const topSuspect = suspectRanking[0];

    // 1. 职业义务：预言家公布查验
    if (self.role === 'prophet') {
      const checks = belief.l0Facts.checks;
      for (const [targetId, checkResult] of Object.entries(checks)) {
        if (checkResult === 'werewolf') {
          const target = allPlayers.find(p => p.id === targetId);
          if (target?.alive) {
            result.push({
              action: ACTION.CLAIM_IDENTITY,
              target: targetId,
              score: SCORE_PROPHET_CLAIM,
              confidence: 1.0,
              reason: `我查验了${target.name}，结果是狼人！作为预言家我必须公布身份。`,
              details: { claimedRole: 'prophet', checkResult, checkTarget: targetId },
              strategy: 'VillagerDayStrategy',
              rule: 'prophet_claim',
              trigger: 'role=prophet 且 l0Facts.checks 中存在 werewolf 结果',
            });
            result.push({
              action: ACTION.CALL_VOTE,
              target: targetId,
              score: SCORE_PROPHET_CALL_VOTE,
              confidence: 1.0,
              reason: `${target.name}已被我查验为狼人，号召大家投票！`,
              strategy: 'VillagerDayStrategy',
              rule: 'prophet_call_vote',
              trigger: 'role=prophet 且 l0Facts.checks 中存在 werewolf 结果',
            });
            break;
          }
        }
      }
    }

    // 2. 被攻击 -> 反驳/反咬
    if (myAttackers.length > 0) {
      const attacker = myAttackers[0];
      const attackerWolfProb = belief.getWerewolfProbability(attacker.id);

      result.push({
        action: ACTION.ACCUSE,
        target: attacker.id,
        score: SCORE_DEFEND_ATTACKED + (attackerWolfProb > WEREWOLF_PROBABILITY_MEDIUM ? SCORE_DEFEND_ATTACKED_BONUS : 0),
        confidence: 0.7,
        reason: `${attacker.name}在攻击我，我觉得他才是狼人！${getWerewolfAttackReason(belief, attacker.id, actions, allPlayers)}。`,
        strategy: 'VillagerDayStrategy',
        rule: 'defend_attacked',
        trigger: `被攻击次数=${attacksOnMe.length} > 0`,
      });
      result.push({
        action: ACTION.GUARANTEE,
        target: self.id,
        score: SCORE_SELF_GUARANTEE,
        confidence: 0.5,
        reason: `我需要证明自己的清白。${attacker.name}的指控没有依据。`,
        strategy: 'VillagerDayStrategy',
        rule: 'self_guarantee',
        trigger: `被攻击次数=${attacksOnMe.length} > 0`,
      });
    }

    // 3. 高可疑目标 -> 指认/怀疑/号召
    if (topSuspect && topSuspect.werewolfProb >= WEREWOLF_PROBABILITY_MEDIUM) {
      const target = allPlayers.find(p => p.id === topSuspect.id);
      if (target) {
        const reason = getSuspicionReason(belief, topSuspect.id, actions, allPlayers);

        if (topSuspect.werewolfProb > STRATEGY_WOLF_PROB_CRITICAL) {
          result.push({
            action: ACTION.ACCUSE,
            target: topSuspect.id,
            score: SCORE_HIGH_SUSPECT_ACCUSE,
            confidence: topSuspect.werewolfProb,
            reason: `我强烈怀疑${target.name}是狼人！${reason}。狼概率${(topSuspect.werewolfProb * 100).toFixed(0)}%。`,
            strategy: 'VillagerDayStrategy',
            rule: 'high_suspect_accuse',
            trigger: `topSuspect.werewolfProb=${topSuspect.werewolfProb.toFixed(2)} > ${STRATEGY_WOLF_PROB_CRITICAL}`,
          });
        } else {
          result.push({
            action: ACTION.SUSPECT,
            target: topSuspect.id,
            score: SCORE_HIGH_SUSPECT_SUSPECT,
            confidence: topSuspect.werewolfProb,
            reason: `我觉得${target.name}很可疑。${reason}。狼概率${(topSuspect.werewolfProb * 100).toFixed(0)}%。`,
            strategy: 'VillagerDayStrategy',
            rule: 'high_suspect_suspect',
            trigger: `topSuspect.werewolfProb=${topSuspect.werewolfProb.toFixed(2)} >= ${WEREWOLF_PROBABILITY_MEDIUM}`,
          });
        }

        if (topSuspect.werewolfProb > WEREWOLF_PROBABILITY_HIGH) {
          result.push({
            action: ACTION.CALL_VOTE,
            target: topSuspect.id,
            score: SCORE_HIGH_SUSPECT_CALL_VOTE,
            confidence: topSuspect.werewolfProb,
            reason: `${target.name}嫌疑很高，我号召大家投票。${reason}。`,
            strategy: 'VillagerDayStrategy',
            rule: 'high_suspect_call_vote',
            trigger: `topSuspect.werewolfProb=${topSuspect.werewolfProb.toFixed(2)} > ${WEREWOLF_PROBABILITY_HIGH}`,
          });
        }
      }
    }

    // 4. 观察异常行为（压力高/沉默多）
    const suspiciousByBehavior = allPlayers.filter(p => p.id !== self.id && p.alive && (
      (p.stress > STRESS_ANXIOUS_MIN) ||
      (actions.filter(a => a.actorId === p.id && a.type === ACTION.SILENCE).length >= STRATEGY_SILENCE_SUSPICIOUS)
    ));
    if (suspiciousByBehavior.length > 0) {
      const observeTarget = suspiciousByBehavior[0];
      const behaviorReasons: string[] = [];
      if (observeTarget.stress > STRESS_ANXIOUS_MIN) behaviorReasons.push(`压力很大（${observeTarget.stress}）`);
      const targetSilence = actions.filter(a => a.actorId === observeTarget.id && a.type === ACTION.SILENCE).length;
      if (targetSilence >= STRATEGY_SILENCE_SUSPICIOUS) behaviorReasons.push(`连续${targetSilence}次沉默`);

      result.push({
        action: ACTION.OBSERVE,
        target: observeTarget.id,
        score: SCORE_BEHAVIOR_OBSERVE,
        confidence: 0.5,
        reason: `我注意到${observeTarget.name}${behaviorReasons.join('，')}，行为异常，想暗中观察他获取更多情报。`,
        strategy: 'VillagerDayStrategy',
        rule: 'behavior_observe',
        trigger: `目标压力=${observeTarget.stress} > ${STRESS_ANXIOUS_MIN} 或 沉默次数=${targetSilence} >= ${STRATEGY_SILENCE_SUSPICIOUS}`,
      });
    }

    // 5. 跟随可信的人号召
    trustedCallers.forEach(caller => {
      if (caller.targetId) {
        const target = allPlayers.find(p => p.id === caller.targetId);
        if (target?.alive) {
          const callerName = allPlayers.find(p => p.id === caller.actorId)?.name || '有人';
          result.push({
            action: ACTION.CALL_VOTE,
            target: caller.targetId,
            score: SCORE_FOLLOW_TRUSTED,
            confidence: 0.6,
            reason: `${callerName}号召投票给${target.name}，我信任他的判断，跟票。`,
            strategy: 'VillagerDayStrategy',
            rule: 'follow_trusted',
            trigger: `信任者 ${callerName} 发起 call_vote，信任度=${(belief.l1Inferences.trustScore[caller.actorId] ?? 0).toFixed(1)}`,
          });
        }
      }
    });

    // 6. 打破沉默
    const breakSilence = generateBreakSilenceCandidate(
      consecutiveSilence,
      aliveCount,
      'VillagerDayStrategy',
      SCORE_BREAK_SILENCE,
      '快全员沉默了，我必须说点什么推动讨论。',
    );
    if (breakSilence) result.push(breakSilence);

    // NEW: Behavioral suspicion fallback - suspect high-stress players
    if (result.length === 0 || (result.length === 1 && result[0].action === ACTION.OBSERVE)) {
      const stressedPlayers = allPlayers.filter(p => p.id !== self.id && p.alive && p.stress > STRATEGY_STRESS_SUSPICIOUS);
      if (stressedPlayers.length > 0) {
        const target = stressedPlayers[0];
        result.push({
          action: ACTION.SUSPECT,
          target: target.id,
          score: 65,
          confidence: 0.4,
          reason: `${target.name}看起来很紧张（压力${target.stress}），行为可疑。`,
          strategy: 'VillagerDayStrategy',
          rule: 'behavior_suspect_stress',
          trigger: `目标压力=${target.stress} > ${STRATEGY_STRESS_SUSPICIOUS}`,
        });
      }
    }

    // 7. 默认：第一轮或有信息时的差异化表达
    if (result.length === 0) {
      result.push(
        ...generateDefaultCandidates(
          self,
          allPlayers,
          publicActions,
          'VillagerDayStrategy',
          {
            round1Observe: SCORE_DEFAULT_ROUND1_OBSERVE,
            otherObserve: SCORE_DEFAULT_OTHER_OBSERVE,
          },
          {
            round1Observe: '第一天信息不足，我打算观察{name}获取更多情报。',
            otherObserve: '目前没什么明确线索，我打算观察{name}获取更多情报。',
          },
        ),
      );
    }

    return result.sort((a, b) => b.score - a.score);
  },
};
// ---------- Werewolf: Rich Camouflage Strategy with Real Motivations ----------
export const WerewolfCamouflageStrategy: Strategy = {
  name: 'werewolf_camouflage',
  requiredRoles: undefined,
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount, publicActions } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const actions = publicActions || [];

    // === 意图系统硬约束：此策略专为狼人设计 ===
    // 非狼人走 VillagerDayStrategy，避免角色行为混淆
    if (self.team !== 'werewolf') return result;

    // 根据阵营动态确定目标：狼人伪装时找对立阵营
    const potentialTargets = allPlayers.filter(p => p.id !== self.id && p.alive && p.team !== self.team);

    // 1. 被攻击 -> 反咬/反驳（所有角色通用）
    const attacksOnMe = actions.filter(a => a.targetId === self.id && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE));
    if (attacksOnMe.length > 0) {
      const attacker = allPlayers.find(p => p.id === attacksOnMe[0].actorId);
      if (attacker) {
        result.push({
          action: ACTION.ACCUSE,
          target: attacker.id,
          score: SCORE_WW_DEFEND_ATTACKED_ACCUSE,
          confidence: 0.8,
          reason: `${attacker.name}在攻击我，我觉得他才是狼人！${getWerewolfAttackReason(belief, attacker.id, actions, allPlayers)}。`,
          strategy: 'WerewolfCamouflageStrategy',
          rule: 'defend_attacked_accuse',
          trigger: `被攻击次数=${attacksOnMe.length} > 0`,
        });
        result.push({
          action: ACTION.SUSPECT,
          target: attacker.id,
          score: SCORE_WW_DEFEND_ATTACKED_SUSPECT,
          confidence: 0.7,
          reason: `我怀疑${attacker.name}，他的攻击没有依据。`,
          strategy: 'WerewolfCamouflageStrategy',
          rule: 'defend_attacked_suspect',
          trigger: `被攻击次数=${attacksOnMe.length} > 0`,
        });
      }
    }

    // 2. 怀疑策略：狼人伪装怀疑"像好人"的目标，村民真正怀疑"像狼人"的目标
    potentialTargets.forEach(target => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      const targetSuspicion = actions.filter(a => a.targetId === target.id && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE)).length;
      const targetSilence = actions.filter(a => a.actorId === target.id && a.type === ACTION.SILENCE).length;

      if (self.team === 'werewolf') {
        // 狼人伪装：怀疑 wolfProb < 0.5 的目标（看起来像好人）
        if (wolfProb < WEREWOLF_PROBABILITY_MEDIUM && (targetSuspicion >= 1 || targetSilence >= 1)) {
          const fakeReason = targetSuspicion >= 1
            ? `已经被一些玩家怀疑，我分析也觉得他有问题`
            : `连续${targetSilence}次沉默，行为很可疑`;

          result.push({
            action: ACTION.SUSPECT,
            target: target.id,
            score: SCORE_WW_CAMOUFLAGE_BASE + targetSuspicion * SCORE_WW_CAMOUFLAGE_BONUS,
            confidence: 0.6,
            reason: `我觉得${target.name}有点可疑，${fakeReason}。大家注意观察。`,
            strategy: 'WerewolfCamouflageStrategy',
            rule: 'camouflage_suspect',
            trigger: `wolfProb=${wolfProb.toFixed(2)} < ${WEREWOLF_PROBABILITY_MEDIUM} 且 (targetSuspicion=${targetSuspicion} >= 1 或 targetSilence=${targetSilence} >= ${STRATEGY_SILENCE_SUSPICIOUS})`,
          });
        }
      } else {
        // 村民真正怀疑：怀疑 wolfProb > 0.5 的目标（看起来像狼人）
        if (wolfProb > WEREWOLF_PROBABILITY_MEDIUM && (targetSuspicion >= 1 || targetSilence >= 1)) {
          const realReason = targetSuspicion >= 1
            ? `已经被一些玩家怀疑，行为确实可疑`
            : `连续${targetSilence}次沉默，不像好人`;

          result.push({
            action: ACTION.SUSPECT,
            target: target.id,
            score: SCORE_WW_CAMOUFLAGE_BASE + targetSuspicion * SCORE_WW_CAMOUFLAGE_BONUS,
            confidence: 0.6,
            reason: `我怀疑${target.name}，${realReason}。`,
            strategy: 'WerewolfCamouflageStrategy',
            rule: 'villager_suspect',
            trigger: `wolfProb=${wolfProb.toFixed(2)} > ${WEREWOLF_PROBABILITY_MEDIUM} 且 (targetSuspicion=${targetSuspicion} >= 1 或 targetSilence=${targetSilence} >= ${STRATEGY_SILENCE_SUSPICIOUS})`,
          });
        }
      }
    });

    // 3. 队友身份危机 -> 袒护/切割（根据 self.team 动态找队友）
    const teammates = allPlayers.filter(p => p.id !== self.id && p.alive && p.team === self.team);
    teammates.forEach(teammate => {
      const identityCrisis = belief.getPlayerIdentityCrisis(teammate.id);
      if (identityCrisis > IDENTITY_CRISIS_HIGH_THRESHOLD) {
        if (identityCrisis > STRATEGY_IDENTITY_CRISIS_CRITICAL && belief.getIdentityCrisis() < STRATEGY_IDENTITY_CRISIS_SAFE) {
          // 倒钩：反咬队友
          result.push({
            action: ACTION.SUSPECT,
            target: teammate.id,
            score: SCORE_WW_TEAMMATE_CRISIS_GOUGE,
            confidence: 0.7,
            reason: `我怀疑${teammate.name}，他行为太可疑了，不像是好人。`,
            strategy: 'WerewolfCamouflageStrategy',
            rule: 'teammate_exposed_gouge',
            trigger: `队友身份危机=${identityCrisis.toFixed(2)} > ${STRATEGY_IDENTITY_CRISIS_CRITICAL} 且 自身身份危机=${belief.getIdentityCrisis().toFixed(2)} < ${STRATEGY_IDENTITY_CRISIS_SAFE}`,
          });
        }
        result.push({
          action: ACTION.DEFEND,
          target: teammate.id,
          score: SCORE_WW_TEAMMATE_CRISIS_DEFEND,
          confidence: 0.5,
          reason: `我觉得${teammate.name}被冤枉了，大家再想想。`,
          strategy: 'WerewolfCamouflageStrategy',
          rule: 'teammate_exposed_defend',
          trigger: `队友身份危机=${identityCrisis.toFixed(2)} > 阈值=${IDENTITY_CRISIS_HIGH_THRESHOLD}`,
        });
      }
    });

    // 4. 打破沉默
    const breakSilence = generateBreakSilenceCandidate(
      consecutiveSilence,
      aliveCount,
      'WerewolfCamouflageStrategy',
      SCORE_WW_BREAK_SILENCE,
      '快全员沉默了，我得当个好人样打破沉默。',
    );
    if (breakSilence) result.push(breakSilence);

    // 5. 默认
    if (result.length === 0) {
      const isRound1 = (publicActions?.filter(a => a.type === ACTION.SILENCE || a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE || a.type === ACTION.DEFEND).length ?? 0) < 3;
      if (isRound1) {
        const random = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
        if (random) {
          result.push({
            action: ACTION.OBSERVE,
            target: random.id,
            score: SCORE_WW_DEFAULT_ROUND1_TARGET,
            stageWeight: 0,
            confidence: 0.5,
            reason: `第一天信息不多，我先观察${random.name}，看看他有什么表现。`,
            strategy: 'WerewolfCamouflageStrategy',
            rule: 'default_round1_observe_target',
            trigger: '无更高优先级规则命中，且为第一轮',
            random: true,
          });
        }
        result.push({
          action: ACTION.SILENCE,
          target: null,
          score: SCORE_WW_DEFAULT_ROUND1,
          stageWeight: 0,
          confidence: 0.5,
          reason: `第一天信息不多，我先看看局势。`,
          strategy: 'WerewolfCamouflageStrategy',
          rule: 'default_round1_silence',
          trigger: '无更高优先级规则命中，且为第一轮',
        });
      } else {
        result.push({
          action: ACTION.SILENCE,
          target: null,
          score: SCORE_WW_DEFAULT_OTHER,
          stageWeight: 0,
          confidence: 0.5,
          reason: `我也没什么头绪，先看看大家怎么说。`,
          strategy: 'WerewolfCamouflageStrategy',
          rule: 'default_other_silence',
          trigger: '无更高优先级规则命中',
        });
      }
    }

    return result.sort((a, b) => b.score - a.score);
  },
};
// ---------- Berserker: Suicide Kill ----------
export const BerserkerSuicideStrategy: Strategy = {
  name: 'berserker_suicide',
  requiredRoles: undefined,
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    // 狂狼同归于尽需要双刃剑，且只对狼人阵营有意义
    if (self.team !== 'werewolf' || !canUseItem(self, 'double_sword')) return result;

    const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');
    const werewolfCount = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
    const villagerCount = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;

    if (werewolfCount < villagerCount && werewolfCount <= 2) {
      alivePlayers.forEach((target) => {
        const claims = belief.l0Facts.publicClaims.filter((c) => c.playerId === target.id);
        if (claims.length > 0) {
          result.push({
            action: ACTION.BERSERKER_KILL,
            target: target.id,
            score: SCORE_BERSERKER_SUICIDE,
            confidence: 0.8,
            reason: `狼队劣势(${werewolfCount} vs ${villagerCount})，${target.name}疑似神职，同归于尽。`,
            strategy: 'BerserkerSuicideStrategy',
            rule: 'suicide_kill',
            trigger: `werewolfCount=${werewolfCount} < villagerCount=${villagerCount} 且 werewolfCount <= 2，目标 claims.length=${claims.length} > 0`,
          });
        }
      });
    }

    return result;
  },
};
