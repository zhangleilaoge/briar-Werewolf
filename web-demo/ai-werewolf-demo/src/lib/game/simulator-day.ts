import type { GameSimulator, PublicActionRecord } from './simulator-core';
import type { Player, DayActionType, ActionType, DecisionProcess } from '@/types';
import { performCheck, hasItem, calculateModifierBreakdown, performOpposedCheck, type CheckLog, } from '@/types';
import { ACTION, PLAN_PHASE, ROLE, LOG_ACTION } from '@/lib/constants/action-constants';
import {
  STRESS_CHANGE_MINOR_POS, 
  REL_CHANGE_MINOR_NEG, 
  DEFAULT_ATTRIBUTE_FALLBACK, DEFAULT_STRESS_FALLBACK, DEFAULT_ALIGNMENT_FALLBACK,CHECK_DIFFICULTY_EXCLUDE_ALL,
  ROLE_INFO,
} from '@/types';
import { log, getPublicPlayerStates, logAction, buildCheckLog } from './simulator-utils';
import { skipToVote } from './simulator-vote';
import { openAppendixWindow } from './simulator-day-appendix';

export function runDayAction(sim: GameSimulator, playerId: string) {
  const player = sim.players.find((p) => p.id === playerId);
  if (!player?.alive) return;

  const agent = sim._aiAgents[playerId];
  if (!agent) return;

  const decision = agent.dayAction(
    getPublicPlayerStates(sim),
    sim.publicActions,
    sim.consecutiveSilenceCount,
    sim.getAliveCount()
  );

  if (!decision) {
    sim.consecutiveSilenceCount++;
    if (sim.consecutiveSilenceCount >= sim.getAliveCount()) {
      log(sim, 'phase', '全员连续沉默，进入投票阶段。');
      skipToVote(sim);
    }
    return;
  }

  // 检查今天是否已对目标执行过动作（同一人对同一人一天只能动作一次）
  if (decision.target) {
    const targets = sim.dayActionTargets.get(playerId);
    if (targets?.has(decision.target)) {
      sim.consecutiveSilenceCount++;
      if (sim.consecutiveSilenceCount >= sim.getAliveCount()) {
        log(sim, 'phase', '全员连续沉默，进入投票阶段。');
        skipToVote(sim);
      }
      return;
    }
  }

  // 记录今天对目标执行的动作
  if (decision.target) {
    if (!sim.dayActionTargets.has(playerId)) {
      sim.dayActionTargets.set(playerId, new Set());
    }
    sim.dayActionTargets.get(playerId)!.add(decision.target);
  }

  const actionRecord: PublicActionRecord = {
    actorId: player.id,
    type: decision.action as ActionType,
    targetId: decision.target ?? undefined,
    details: { ...decision.details, process: decision.process },
    round: sim.round,
  };
  sim.publicActions.push(actionRecord);

  // 执行行动，观察/沉默视为沉默（不重置），其他动作重置计数
  const shouldResetSilence = resolveDayAction(sim, player, decision.action as DayActionType, decision.target, decision.details || {}, decision.reason || '', decision.process);
  if (shouldResetSilence) {
    sim.consecutiveSilenceCount = 0;
  } else {
    sim.consecutiveSilenceCount++;
    if (sim.consecutiveSilenceCount >= sim.getAliveCount()) {
      log(sim, 'phase', '全员连续沉默，进入投票阶段。');
      skipToVote(sim);
    }
  }

  if (ACTION.SUSPECT === decision.action || ACTION.DEFEND === decision.action) {
    openAppendixWindow(sim, actionRecord);
  }
}

export function resolveDayAction(
  sim: GameSimulator,
  actor: Player,
  action: DayActionType,
  targetId: string | null,
  details: Record<string, unknown>,
  decisionReason: string,
  process?: DecisionProcess
): boolean {
  const target = targetId ? sim.players.find((p) => p.id === targetId) : null;
  const targetName = target?.name || '无目标';
  let shouldResetSilence = true;

  // Try plugin execution for core day actions first
  const pluginActions = [ACTION.SUSPECT, ACTION.DEFEND, ACTION.ACCUSE, ACTION.CALL_VOTE, ACTION.BLOCK_VOTE, ACTION.GUARANTEE];
  if (pluginActions.includes(action as typeof pluginActions[number])) {
    try {
      const result = sim.pluginRegistry.executeAction(action, {
        actor,
        target: target || undefined,
        action,
        context: { round: sim.round, phase: PLAN_PHASE.DAY, players: sim.players },
      });

      if (result.success) {
        // Apply state changes via bus
        result.stateChanges.forEach((change) => {
          switch (change.type) {
            case 'stress_change':
              sim.playerStateBus.changeStress(change.targetId, change.payload.delta as number, `day_${action}`);
              break;
            case 'relation_change': {
              const { fromId, toId, trustDelta, friendlyDelta, favorDelta } = change.payload as { fromId: string; toId: string; trustDelta?: number; friendlyDelta?: number; favorDelta?: number };
              sim.playerStateBus.changeRelation(fromId, toId, { trustDelta, friendlyDelta, favorDelta }, `day_${action}`);
              break;
            }
          }
        });

        // Add logs with decision reason, checks, and process
        result.logs.forEach((logItem) => {
          logAction(sim, logItem.type as 'action', logItem.message, decisionReason, result.checks || [], { actorId: actor.id, action, targetId, process });
        });

        return shouldResetSilence;
      }
    } catch (error) {
      console.error(`[simulator-day] Plugin execution failed for ${action}:`, error);
    }
  }

  switch (action) {
    case ACTION.SILENCE:
      logAction(sim, 'action', `${actor.name} 选择沉默`, decisionReason, [], { actorId: actor.id, action: ACTION.SILENCE , process });
      break;
    case ACTION.CLAIM_IDENTITY: {
      const claimedRoleKey = details.claimedRole as string || ROLE.VILLAGER;
      const claimedRoleName = ROLE_INFO[claimedRoleKey as keyof typeof ROLE_INFO]?.label || claimedRoleKey;
      logAction(sim, 'action', `${actor.name} 公布身份：「我是${claimedRoleName}」`, decisionReason, [], { actorId: actor.id, action: ACTION.CLAIM_IDENTITY, claimedRole: claimedRoleKey , process });
      if (actor.role === ROLE.PROPHET && claimedRoleKey === ROLE.PROPHET) {
        sim.prophetClaims[actor.id] = true;
        const agent = sim._aiAgents[actor.id];
        if (agent) {
          const checks = agent.getCheckResults();
          Object.entries(checks).forEach(([checkTargetId, result]) => {
            const checkTarget = sim.players.find((p) => p.id === checkTargetId);
            if (checkTarget) {
              logAction(sim, 'action', `${actor.name}（宣称预言家）公布查验：${checkTarget.name} 是 ${result === ROLE.WEREWOLF ? '狼人' : '村民'}`, decisionReason, [], { actorId: actor.id, action: LOG_ACTION.CLAIM_CHECK_RESULT, targetId: checkTargetId , process });
            }
          });
        }
      }
      if (actor.role === ROLE.PROPHET && claimedRoleKey !== ROLE.PROPHET && sim.prophetClaims[actor.id]) {
        sim.prophetClaims[actor.id] = false;
        logAction(sim, 'action', `${actor.name} 终止了预言家身份的公布义务。`, decisionReason, [], { actorId: actor.id, action: LOG_ACTION.CLAIM_IDENTITY_END , process });
      }
      break;
    }
    case ACTION.REVEAL_INFO: {
      // TODO: 公开信息行动 - 需要实现具体的信息公开逻辑（如窃贼公开偷到的道具等）
      const _infoType = details.infoType as string;
      const infoTarget = details.infoTarget as string;
      const infoContent = details.infoContent as string;
      logAction(sim, 'action', `${actor.name} 公开信息：${infoTarget || targetName} 持有 ${infoContent || '某物'}`, decisionReason, [], { actorId: actor.id, action: ACTION.REVEAL_INFO, infoTarget, infoContent , process });
      break;
    }
    case ACTION.OBSERVE: {
      // 观察：洞察 vs 目标隐蔽（对抗检定），目标洞察 vs 观察者隐蔽（是否被发现）
      const checks: CheckLog[] = [];
      const _observeMsg = `${actor.name} 暗中观察 ${targetName}...`;

      const actorInsightBreakdown = calculateModifierBreakdown(actor.attributes.insight, actor.alignment, actor.stress, 'other');
      const targetStealthBreakdown = calculateModifierBreakdown(target?.attributes.stealth || DEFAULT_ATTRIBUTE_FALLBACK, target?.alignment || DEFAULT_ALIGNMENT_FALLBACK, target?.stress || DEFAULT_STRESS_FALLBACK, 'stealth');
      const observeResult = performOpposedCheck(actorInsightBreakdown.total, targetStealthBreakdown.total);
      checks.push(buildCheckLog(
        actor, 'insight', actorInsightBreakdown,
        { roll: observeResult.actorRoll, total: observeResult.actorTotal, margin: observeResult.margin, success: observeResult.success },
        undefined, target || undefined, 'stealth', targetStealthBreakdown,
        { roll: observeResult.targetRoll, total: observeResult.targetTotal }
      ));

      const targetInsightBreakdown = calculateModifierBreakdown(target?.attributes.insight || DEFAULT_ATTRIBUTE_FALLBACK, target?.alignment || DEFAULT_ALIGNMENT_FALLBACK, target?.stress || DEFAULT_STRESS_FALLBACK, 'other');
      const actorStealthBreakdown = calculateModifierBreakdown(actor.attributes.stealth, actor.alignment, actor.stress, 'stealth');
      const discoveredResult = performOpposedCheck(targetInsightBreakdown.total, actorStealthBreakdown.total);
      const discoveredCheck = buildCheckLog(
        target || actor, 'insight', targetInsightBreakdown,
        { roll: discoveredResult.actorRoll, total: discoveredResult.actorTotal, margin: discoveredResult.margin, success: discoveredResult.success },
        undefined, actor, 'stealth', actorStealthBreakdown,
        { roll: discoveredResult.targetRoll, total: discoveredResult.targetTotal }
      );

      // 始终先输出 a观察了b（仅第一次检定）
      logAction(sim, 'action', `${actor.name} 观察了 ${targetName}`, decisionReason, checks, { actorId: actor.id, action: ACTION.OBSERVE, targetId, process });

      if (target) {
        if (discoveredResult.success) {
          // 目标察觉到了（不传 process，避免重复展示决策过程）
          logAction(sim, 'action', `${targetName} 察觉到 ${actor.name} 在观察自己`, '', [discoveredCheck], { actorId: target.id, action: LOG_ACTION.OBSERVE_DETECTED, targetId: actor.id });
          const observeStressDelta = STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS);
          sim.playerStateBus.changeStress(target.id, observeStressDelta, LOG_ACTION.OBSERVE_DETECTED);
          sim.playerStateBus.changeRelation(target.id, actor.id, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG }, LOG_ACTION.OBSERVE_DETECTED);
        } else {
          logAction(sim, 'action', `${targetName} 未察觉到 ${actor.name} 在观察自己`, '', [discoveredCheck], { actorId: target.id, action: LOG_ACTION.OBSERVE_MISSED, targetId: actor.id });
        }
      }
      // 是否被其他旁观者发现
      sim.players.forEach((observer) => {
        if (observer.id === actor.id || observer.id === targetId || !observer.alive) return;
        const observerInsightBreakdown = calculateModifierBreakdown(observer.attributes.insight, observer.alignment, observer.stress, 'other');
        const actorStealthBreakdown2 = calculateModifierBreakdown(actor.attributes.stealth, actor.alignment, actor.stress, 'stealth');
        const discoveredByOther = performOpposedCheck(observerInsightBreakdown.total, actorStealthBreakdown2.total);
        const otherChecks: CheckLog[] = [
          buildCheckLog(
            observer, 'insight', observerInsightBreakdown,
            { roll: discoveredByOther.actorRoll, total: discoveredByOther.actorTotal, margin: discoveredByOther.margin, success: discoveredByOther.success },
            undefined, actor, 'stealth', actorStealthBreakdown2,
            { roll: discoveredByOther.targetRoll, total: discoveredByOther.targetTotal }
          )
        ];
        if (discoveredByOther.success) {
          logAction(sim, 'action', `${observer.name} 察觉到 ${actor.name} 在观察 ${targetName}。`, '', otherChecks, { actorId: observer.id, action: LOG_ACTION.OBSERVE_DETECTED, targetId: actor.id });
        } else {
          logAction(sim, 'action', `${observer.name} 未察觉到 ${actor.name} 在观察 ${targetName}。`, '', otherChecks, { actorId: observer.id, action: LOG_ACTION.OBSERVE_MISSED, targetId: actor.id });
        }
      });
      const agent = sim._aiAgents[actor.id];
      if (agent && target) {
        agent.recordObservation(target.id, target.stress, target.attributes);
      }
      // 观察视同沉默，不重置计数
      shouldResetSilence = false;
      break;
    }
    case ACTION.EXCLUDE_ALL: {
      // 全员排除检定：逻辑/领导
      const excludeActorAttr = actor.attributes.logic >= actor.attributes.leadership ? 'logic' : 'leadership';
      const excludeMod = calculateModifierBreakdown(
        actor.attributes[excludeActorAttr], actor.alignment, actor.stress, 'leadership'
      );
      const excludeCheckResult = performCheck(excludeMod.total, CHECK_DIFFICULTY_EXCLUDE_ALL);
      const successLevel = excludeCheckResult.success ? (excludeCheckResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const excludeCheck = buildCheckLog(actor, excludeActorAttr, excludeMod, excludeCheckResult, CHECK_DIFFICULTY_EXCLUDE_ALL);
      logAction(sim, 'action', `${actor.name} 提议全员排除：「这些自称${details.identity || '某身份'}的人全部放逐！」（${successLevel}）`, decisionReason, [excludeCheck], { actorId: actor.id, action: ACTION.EXCLUDE_ALL, targetId , process });
      break;
    }
    case ACTION.BERSERKER_KILL: {
      if (actor.role === ROLE.BERSERKER && hasItem(actor, 'double_sword') && target?.alive) {
        logAction(sim, 'death', `${actor.name} 发动狂狼同归于尽！${target.name} 与 ${actor.name} 双双死亡！`, decisionReason, [], { actorId: actor.id, action: ACTION.BERSERKER_KILL, targetId: target.id });
        sim.playerStateBus.killPlayer(actor.id, ACTION.BERSERKER_KILL);
        sim.playerStateBus.killPlayer(target.id, ACTION.BERSERKER_KILL);
        sim.nightDeaths.push(target.id);
        sim.playerStateBus.damageItem(actor.id, 'double_sword', ACTION.BERSERKER_KILL);
        sim.peacefulNight = true;
        sim._checkWinCondition();
        skipToVote(sim);
      }
      break;
    }
  }
  return shouldResetSilence;
}
