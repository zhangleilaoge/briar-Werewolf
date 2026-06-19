import type { GameSimulator, PublicActionRecord } from './simulator-core';
import type { Player, DayActionType, ActionType, DecisionProcess } from '@/types';
import { clampStress, performCheck, damageItem, hasItem, calculateModifierBreakdown, performOpposedCheck, type CheckLog, } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import {
  STRESS_CHANGE_MINOR_POS, 
  STRESS_CHANGE_MODERATE_POS, 
  REL_CHANGE_MINOR_NEG, REL_CHANGE_MINOR_POS, REL_CHANGE_MODERATE_POS, REL_CHANGE_MAJOR_NEG, REL_CHANGE_MAJOR_POS,
  DEFAULT_ATTRIBUTE_FALLBACK, DEFAULT_STRESS_FALLBACK, DEFAULT_ALIGNMENT_FALLBACK,
  CHECK_DIFFICULTY_DEFEND, CHECK_DIFFICULTY_JOIN_SUSPECT, CHECK_DIFFICULTY_JOIN_DEFEND,
  CHECK_DIFFICULTY_CALL_VOTE, CHECK_DIFFICULTY_BLOCK_VOTE, CHECK_DIFFICULTY_GUARANTEE, CHECK_DIFFICULTY_EXCLUDE_ALL,
} from '@/types';
import { log, getPublicPlayerStates, updateRelation, logAction, buildCheckLog } from './simulator-utils';
import { skipToVote } from './simulator-vote';

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
    if (targets && targets.has(decision.target)) {
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

  if ([ACTION.SUSPECT, ACTION.DEFEND].includes(decision.action)) {
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

  switch (action) {
    case ACTION.SILENCE:
      logAction(sim, 'action', `${actor.name} 选择沉默`, decisionReason, [], { actorId: actor.id, action: ACTION.SILENCE , process });
      break;
    case ACTION.CLAIM_IDENTITY: {
      const claimedRoleKey = details.claimedRole as string || 'villager';
      const claimedRoleName = ROLE_INFO[claimedRoleKey as keyof typeof ROLE_INFO]?.label || claimedRoleKey;
      logAction(sim, 'action', `${actor.name} 公布身份：「我是${claimedRoleName}」`, decisionReason, [], { actorId: actor.id, action: ACTION.CLAIM_IDENTITY, claimedRole: claimedRoleKey , process });
      if (actor.role === 'prophet' && claimedRole === 'prophet') {
        sim.prophetClaims[actor.id] = true;
        const agent = sim._aiAgents[actor.id];
        if (agent) {
          const checks = agent.getCheckResults();
          Object.entries(checks).forEach(([checkTargetId, result]) => {
            const checkTarget = sim.players.find((p) => p.id === checkTargetId);
            if (checkTarget) {
              logAction(sim, 'action', `${actor.name}（宣称预言家）公布查验：${checkTarget.name} 是 ${result === 'werewolf' ? '狼人' : '村民'}`, decisionReason, [], { actorId: actor.id, action: 'claim_check_result', targetId: checkTargetId , process });
            }
          });
        }
      }
      if (actor.role === 'prophet' && claimedRole !== 'prophet' && sim.prophetClaims[actor.id]) {
        sim.prophetClaims[actor.id] = false;
        logAction(sim, 'action', `${actor.name} 终止了预言家身份的公布义务。`, decisionReason, [], { actorId: actor.id, action: 'claim_identity_end' , process });
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
          logAction(sim, 'action', `${targetName} 察觉到 ${actor.name} 在观察自己`, '', [discoveredCheck], { actorId: target.id, action: 'observe_detected', targetId: actor.id });
          target.stress = clampStress(target.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
          updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
        } else {
          logAction(sim, 'action', `${targetName} 未察觉到 ${actor.name} 在观察自己`, '', [discoveredCheck], { actorId: target.id, action: 'observe_missed', targetId: actor.id });
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
          logAction(sim, 'action', `${observer.name} 察觉到 ${actor.name} 在观察 ${targetName}。`, '', otherChecks, { actorId: observer.id, action: 'observe_detected', targetId: actor.id });
        } else {
          logAction(sim, 'action', `${observer.name} 未察觉到 ${actor.name} 在观察 ${targetName}。`, '', otherChecks, { actorId: observer.id, action: 'observe_missed', targetId: actor.id });
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
    case ACTION.SUSPECT: {
      // 怀疑检定：洞察/逻辑 vs 目标隐蔽（对抗检定）
      const suspectActorAttr = actor.attributes.insight >= actor.attributes.logic ? 'insight' : 'logic';
      const suspectMod = calculateModifierBreakdown(
        actor.attributes[suspectActorAttr], actor.alignment, actor.stress, 'other'
      );
      const targetHideMod = calculateModifierBreakdown(
        target?.attributes.stealth || DEFAULT_ATTRIBUTE_FALLBACK,
        target?.alignment || DEFAULT_ALIGNMENT_FALLBACK,
        target?.stress || DEFAULT_STRESS_FALLBACK, 'stealth'
      );
      const suspectResult = performOpposedCheck(suspectMod.total, targetHideMod.total);
      const successLevel = suspectResult.success ? (suspectResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const suspectCheck = buildCheckLog(
        actor, suspectActorAttr, suspectMod,
        { roll: suspectResult.actorRoll, total: suspectResult.actorTotal, margin: suspectResult.margin, success: suspectResult.success },
        undefined, target || undefined, 'stealth', targetHideMod,
        { roll: suspectResult.targetRoll, total: suspectResult.targetTotal }
      );
      logAction(sim, 'action', `${actor.name} 怀疑 ${targetName}：「我觉得 ${targetName} 可能是狼人」（${successLevel}）`, decisionReason, [suspectCheck], { actorId: actor.id, action: ACTION.SUSPECT, targetId , process });
      if (target) {
        target.stress = clampStress(target.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
        updateRelation(sim, target, actor, { favorDelta: REL_CHANGE_MINOR_NEG });

        // 记录暴露度变更：被怀疑者暴露度增加
        const targetAgent = sim._aiAgents[target.id];
        if (targetAgent) {
          const before = targetAgent.belief.getExposure();
          // 怀疑行动会增加被怀疑者的l2暴露度
          const delta = suspectResult.success ? 0.15 : 0.05;
          targetAgent.recordExposureChange(
            `${actor.name} 怀疑 ${target.name}（${successLevel}）`,
            delta,
            before,
            Math.min(1, before + delta)
          );
        }
      }
      break;
    }
    case ACTION.DEFEND: {
      // 袒护检定：亲和 + 阵营修正
      const defendMod = calculateModifierBreakdown(actor.attributes.affinity, actor.alignment, actor.stress, 'affinity', true);
      const defendCheckResult = performCheck(defendMod.total, CHECK_DIFFICULTY_DEFEND);
      const successLevel = defendCheckResult.success ? (defendCheckResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const defendCheck = buildCheckLog(
        actor, 'affinity', defendMod, defendCheckResult, CHECK_DIFFICULTY_DEFEND
      );
      logAction(sim, 'action', `${actor.name} 袒护 ${targetName}：「我相信 ${targetName} 是好人」（${successLevel}）`, decisionReason, [defendCheck], { actorId: actor.id, action: ACTION.DEFEND, targetId , process });
      if (target) {
        target.stress = clampStress(target.stress - STRESS_CHANGE_MINOR_POS);
        updateRelation(sim, target, actor, { trustDelta: 0, friendlyDelta: REL_CHANGE_MODERATE_POS });
      }
      break;
    }
    case ACTION.CALL_VOTE: {
      // 号召投票检定：领导/逻辑
      const callActorAttr = actor.attributes.leadership >= actor.attributes.logic ? 'leadership' : 'logic';
      const callMod = calculateModifierBreakdown(
        actor.attributes[callActorAttr], actor.alignment, actor.stress, 'leadership'
      );
      const callCheckResult = performCheck(callMod.total, CHECK_DIFFICULTY_CALL_VOTE);
      const successLevel = callCheckResult.success ? (callCheckResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const callCheck = buildCheckLog(actor, callActorAttr, callMod, callCheckResult, CHECK_DIFFICULTY_CALL_VOTE);
      logAction(sim, 'action', `${actor.name} 号召投票给 ${targetName}：「大家今天投 ${targetName}！」（${successLevel}）`, decisionReason, [callCheck], { actorId: actor.id, action: ACTION.CALL_VOTE, targetId , process });
      if (target) {
        target.stress = clampStress(target.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
      }
      break;
    }
    case ACTION.BLOCK_VOTE: {
      // 阻止投票检定：领导/亲和
      const blockActorAttr = actor.attributes.leadership >= actor.attributes.affinity ? 'leadership' : 'affinity';
      const blockMod = calculateModifierBreakdown(
        actor.attributes[blockActorAttr], actor.alignment, actor.stress, 'leadership'
      );
      const blockCheckResult = performCheck(blockMod.total, CHECK_DIFFICULTY_BLOCK_VOTE);
      const successLevel = blockCheckResult.success ? (blockCheckResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const blockCheck = buildCheckLog(actor, blockActorAttr, blockMod, blockCheckResult, CHECK_DIFFICULTY_BLOCK_VOTE);
      logAction(sim, 'action', `${actor.name} 阻止投票给 ${targetName}：「今天不要投 ${targetName}」（${successLevel}）`, decisionReason, [blockCheck], { actorId: actor.id, action: ACTION.BLOCK_VOTE, targetId , process });
      if (target) {
        target.stress = clampStress(target.stress - (STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS)));
        updateRelation(sim, target, actor, { trustDelta: 0, friendlyDelta: REL_CHANGE_MINOR_POS });
      }
      break;
    }
    case ACTION.GUARANTEE: {
      // 担保清白检定：亲和/洞察
      const guaranteeActorAttr = actor.attributes.affinity >= actor.attributes.insight ? 'affinity' : 'insight';
      const guaranteeMod = calculateModifierBreakdown(
        actor.attributes[guaranteeActorAttr], actor.alignment, actor.stress, 'affinity', true
      );
      const guaranteeCheckResult = performCheck(guaranteeMod.total, CHECK_DIFFICULTY_GUARANTEE);
      const successLevel = guaranteeCheckResult.success ? (guaranteeCheckResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const guaranteeCheck = buildCheckLog(actor, guaranteeActorAttr, guaranteeMod, guaranteeCheckResult, CHECK_DIFFICULTY_GUARANTEE);
      logAction(sim, 'action', `${actor.name} 担保 ${targetName} 是好人！（${successLevel}）`, decisionReason, [guaranteeCheck], { actorId: actor.id, action: ACTION.GUARANTEE, targetId , process });
      if (target) {
        target.stress = clampStress(target.stress - (STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS)));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MODERATE_POS, friendlyDelta: REL_CHANGE_MAJOR_POS });
      }
      break;
    }
    case ACTION.ACCUSE: {
      // 强烈指认检定：洞察/逻辑 vs 目标隐蔽（对抗检定）
      const accuseActorAttr = actor.attributes.insight >= actor.attributes.logic ? 'insight' : 'logic';
      const accuseMod = calculateModifierBreakdown(
        actor.attributes[accuseActorAttr], actor.alignment, actor.stress, 'other'
      );
      const targetHideMod = calculateModifierBreakdown(
        target?.attributes.stealth || DEFAULT_ATTRIBUTE_FALLBACK,
        target?.alignment || DEFAULT_ALIGNMENT_FALLBACK,
        target?.stress || DEFAULT_STRESS_FALLBACK, 'stealth'
      );
      const accuseResult = performOpposedCheck(accuseMod.total, targetHideMod.total);
      const successLevel = accuseResult.success ? (accuseResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const accuseCheck = buildCheckLog(
        actor, accuseActorAttr, accuseMod,
        { roll: accuseResult.actorRoll, total: accuseResult.actorTotal, margin: accuseResult.margin, success: accuseResult.success },
        undefined, target || undefined, 'stealth', targetHideMod,
        { roll: accuseResult.targetRoll, total: accuseResult.targetTotal }
      );
      logAction(sim, 'action', `${actor.name} 强烈指认 ${targetName} 是狼人！（${successLevel}）`, decisionReason, [accuseCheck], { actorId: actor.id, action: ACTION.ACCUSE, targetId , process });
      if (target) {
        target.stress = clampStress(target.stress + STRESS_CHANGE_MODERATE_POS + Math.floor(Math.random() * STRESS_CHANGE_MODERATE_POS));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MAJOR_NEG, friendlyDelta: REL_CHANGE_MAJOR_NEG });
      }
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
      if (actor.role === 'berserker' && hasItem(actor, 'double_sword') && target?.alive) {
        logAction(sim, 'death', `${actor.name} 发动狂狼同归于尽！${target.name} 与 ${actor.name} 双双死亡！`, decisionReason, [], { actorId: actor.id, action: ACTION.BERSERKER_KILL, targetId: target.id });
        actor.alive = false;
        target.alive = false;
        sim.nightDeaths.push(target.id);
        damageItem(actor, 'double_sword');
        sim.peacefulNight = true;
        sim.players.forEach((p) => {
          const agent = sim._aiAgents[p.id];
          if (agent) {
            agent.onEvent({ type: 'death', playerId: actor.id });
            agent.onEvent({ type: 'death', playerId: target.id });
          }
        });
        skipToVote(sim);
      }
      break;
    }
  }
  return shouldResetSilence;
}

export function openAppendixWindow(sim: GameSimulator, triggerAction: PublicActionRecord) {
  // New model: emit appendix_reaction to event bus for TickPhase to handle
  sim.broadcastEvent({
    type: 'appendix_reaction',
    source: triggerAction.actorId,
    payload: { triggerAction },
  });
}

export function runAppendixAction(sim: GameSimulator, playerId: string, triggerAction: PublicActionRecord, _process?: DecisionProcess) {
  const player = sim.players.find((p) => p.id === playerId);
  if (!player?.alive) return;

  const agent = sim._aiAgents[playerId];
  if (!agent) return;

  const decision = agent.appendixAction(
    getPublicPlayerStates(sim),
    triggerAction,
    sim.publicActions
  );

  if (!decision) return;

  // 追加行动是公开行动，打断沉默计数
  sim.consecutiveSilenceCount = 0;

  const actionRecord: PublicActionRecord = {
    actorId: player.id,
    type: decision.action as ActionType,
    targetId: decision.target ?? undefined,
    details: { ...decision.details },
    round: sim.round,
  };
  sim.publicActions.push(actionRecord);

  const triggerActor = sim.players.find((p) => p.id === triggerAction.actorId);
  const originalTarget = sim.players.find((p) => p.id === triggerAction.targetId);

  switch (decision.action) {
    case ACTION.JOIN_SUSPECT: {
      // 一同怀疑检定：洞察/逻辑
      const joinSuspectAttr = player.attributes.insight >= player.attributes.logic ? 'insight' : 'logic';
      const joinSuspectMod = calculateModifierBreakdown(
        player.attributes[joinSuspectAttr], player.alignment, player.stress, 'other'
      );
      const joinSuspectCheckResult = performCheck(joinSuspectMod.total, CHECK_DIFFICULTY_JOIN_SUSPECT);
      const successLevel = joinSuspectCheckResult.success ? (joinSuspectCheckResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const joinSuspectCheck = buildCheckLog(player, joinSuspectAttr, joinSuspectMod, joinSuspectCheckResult, CHECK_DIFFICULTY_JOIN_SUSPECT);
      logAction(sim, 'action', `${player.name} 一同怀疑 ${originalTarget?.name || '目标'}（${successLevel}）`, decision.reason || '', [joinSuspectCheck], { actorId: player.id, action: ACTION.JOIN_SUSPECT, targetId: originalTarget?.id });
      if (originalTarget) {
        originalTarget.stress = clampStress(originalTarget.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
        updateRelation(sim, originalTarget, player, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
      }
      break;
    }
    case ACTION.JOIN_DEFEND: {
      // 一同袒护检定：亲和
      const joinDefendMod = calculateModifierBreakdown(player.attributes.affinity, player.alignment, player.stress, 'affinity', true);
      const joinDefendCheckResult = performCheck(joinDefendMod.total, CHECK_DIFFICULTY_JOIN_DEFEND);
      const successLevel = joinDefendCheckResult.success ? (joinDefendCheckResult.criticalSuccess ? '大成功' : '成功') : '失败';
      const joinDefendCheck = buildCheckLog(player, 'affinity', joinDefendMod, joinDefendCheckResult, CHECK_DIFFICULTY_JOIN_DEFEND);
      logAction(sim, 'action', `${player.name} 一同袒护 ${originalTarget?.name || '目标'}（${successLevel}）`, decision.reason || '', [joinDefendCheck], { actorId: player.id, action: ACTION.JOIN_DEFEND, targetId: originalTarget?.id });
      if (originalTarget) {
        originalTarget.stress = clampStress(originalTarget.stress - STRESS_CHANGE_MINOR_POS);
        updateRelation(sim, originalTarget, player, { trustDelta: 0, friendlyDelta: REL_CHANGE_MODERATE_POS });
      }
      break;
    }
    case ACTION.REBUT: {
      const rebutReason = decision.reason || '被怀疑，必须为自己辩护';
      if (triggerActor) {
        // 反驳检定：反驳者逻辑 + 阵营/压力修正 vs 怀疑者洞察 + 阵营/压力修正
        const rebutLogicBreakdown = calculateModifierBreakdown(player.attributes.logic, player.alignment, player.stress, 'other');
        const suspectInsightBreakdown = calculateModifierBreakdown(triggerActor.attributes.insight, triggerActor.alignment, triggerActor.stress, 'other');
        const rebutResult = performOpposedCheck(rebutLogicBreakdown.total, suspectInsightBreakdown.total);
        const rebutCheck = buildCheckLog(
          player, 'logic', rebutLogicBreakdown,
          { roll: rebutResult.actorRoll, total: rebutResult.actorTotal, margin: rebutResult.margin, success: rebutResult.success },
          undefined, triggerActor, 'insight', suspectInsightBreakdown,
          { roll: rebutResult.targetRoll, total: rebutResult.targetTotal }
        );
        const successText = rebutResult.success ? `（成功，优势 ${rebutResult.margin}）` : '（失败）';
        logAction(sim, 'action', `${player.name} 反驳：「我不是狼人！」${successText}`, rebutReason, [rebutCheck], { actorId: player.id, action: ACTION.REBUT, targetId: triggerActor.id });

        // 记录反驳者的暴露度变更
        const playerAgent = sim._aiAgents[player.id];
        if (playerAgent) {
          const before = playerAgent.belief.getExposure();
          if (rebutResult.success) {
            // 反驳成功：暴露度降低
            const delta = -0.1;
            playerAgent.recordExposureChange(
              `反驳成功：${player.name} 成功反驳 ${triggerActor.name}`,
              delta,
              before,
              Math.max(0, before + delta)
            );
          } else {
            // 反驳失败：暴露度增加
            const delta = 0.1;
            playerAgent.recordExposureChange(
              `反驳失败：${player.name} 反驳 ${triggerActor.name} 失败`,
              delta,
              before,
              Math.min(1, before + delta)
            );
          }
        }

        if (rebutResult.success) {
          player.stress = clampStress(player.stress - STRESS_CHANGE_MINOR_POS);
          // 旁观者信任反驳者
          sim.players.forEach((p) => {
            if (p.id !== player.id && p.id !== triggerActor.id && p.alive) {
              updateRelation(sim, p, player, { favorDelta: REL_CHANGE_MINOR_POS });
              // 反驳成功：怀疑者失旁观者信任
              updateRelation(sim, p, triggerActor, { favorDelta: REL_CHANGE_MINOR_NEG });
            }
          });
        } else {
          player.stress = clampStress(player.stress + STRESS_CHANGE_MINOR_POS);
          // 反驳失败：旁观者更信任怀疑者
          sim.players.forEach((p) => {
            if (p.id !== player.id && p.id !== triggerActor.id && p.alive) {
              updateRelation(sim, p, triggerActor, { favorDelta: REL_CHANGE_MINOR_POS });
            }
          });
        }
      }
      break;
    }
  }
}
