import type { GameSimulator } from './simulator-core';
import type { Player, DayActionType, ActionType, PublicActionRecord, GameStep } from './simulator-core';
import { clampStress, performCheck, damageItem, hasItem, ITEM_DEFINITIONS, calculateFinalModifier, performOpposedCheck } from '../ai/types';
import {
  CRITICAL_SUCCESS_MARGIN, CHECK_DIFFICULTY_EASY, CHECK_DIFFICULTY_MEDIUM, CHECK_DIFFICULTY_HARD,
  STRESS_CHANGE_MINOR_POS, STRESS_CHANGE_MINOR_POS_RANDOM, STRESS_CHANGE_MINOR_NEG, STRESS_CHANGE_MINOR_NEG_RANDOM,
  STRESS_CHANGE_MODERATE_POS, STRESS_CHANGE_MODERATE_POS_RANDOM, STRESS_CHANGE_MAJOR_POS, STRESS_CHANGE_MAJOR_POS_RANDOM,
  REL_CHANGE_MINOR_NEG, REL_CHANGE_MINOR_POS, REL_CHANGE_MODERATE_NEG, REL_CHANGE_MODERATE_POS, REL_CHANGE_MAJOR_NEG, REL_CHANGE_MAJOR_POS,
  DEFAULT_ATTRIBUTE_FALLBACK, DEFAULT_STRESS_FALLBACK, DEFAULT_ALIGNMENT_FALLBACK,
  CHECK_DIFFICULTY_DEFEND, CHECK_DIFFICULTY_JOIN_SUSPECT, CHECK_DIFFICULTY_JOIN_DEFEND,
  CHECK_DIFFICULTY_CALL_VOTE, CHECK_DIFFICULTY_BLOCK_VOTE, CHECK_DIFFICULTY_GUARANTEE, CHECK_DIFFICULTY_EXCLUDE_ALL,
} from '../ai/constants';
import { log, getName, getPublicPlayerStates, updateRelation } from './simulator-utils';
import { skipToVote } from './simulator-vote';

export function runDayAction(sim: GameSimulator, playerId: string) {
  const player = sim.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return;

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
    log(sim, 'action', `${player.name} 选择沉默。（连续沉默: ${sim.consecutiveSilenceCount}/${sim.getAliveCount()}）`);

    if (sim.consecutiveSilenceCount >= sim.getAliveCount()) {
      log(sim, 'phase', '全员连续沉默，进入投票阶段。');
      skipToVote(sim);
    }
    return;
  }

  const actionRecord: PublicActionRecord = {
    actorId: player.id,
    type: decision.action as ActionType,
    targetId: decision.target || undefined,
    details: decision.details,
    round: sim.round,
  };
  sim.publicActions.push(actionRecord);

  // 执行行动，根据返回值决定是否重置沉默计数
  const shouldResetSilence = resolveDayAction(sim, player, decision.action as DayActionType, decision.target, decision.details || {});
  if (shouldResetSilence) {
    sim.consecutiveSilenceCount = 0;
  } else {
    // 观察未被发现 = 视同沉默，递增计数
    sim.consecutiveSilenceCount++;
    log(sim, 'action', `${player.name} 的观察未被发现，视同沉默。（连续沉默: ${sim.consecutiveSilenceCount}/${sim.getAliveCount()}）`);
    if (sim.consecutiveSilenceCount >= sim.getAliveCount()) {
      log(sim, 'phase', '全员连续沉默，进入投票阶段。');
      skipToVote(sim);
    }
  }

  if (['suspect', 'defend'].includes(decision.action)) {
    openAppendixWindow(sim, actionRecord);
  }
}

export function resolveDayAction(
  sim: GameSimulator,
  actor: Player,
  action: DayActionType,
  targetId: string | null,
  details: Record<string, unknown>
): boolean {
  const target = targetId ? sim.players.find((p) => p.id === targetId) : null;
  const targetName = target?.name || '无目标';
  let shouldResetSilence = true;

  switch (action) {
    case 'silence':
      break;
    case 'speak': {
      log(sim, 'action', `${actor.name} 发言：${details.message || '没什么头绪，先看看大家怎么说。'}`, { actorId: actor.id, action: 'speak' });
      break;
    }
    case 'claim_identity': {
      const claimedRole = details.claimedRole as string || '村民';
      log(sim, 'action', `${actor.name} 公布身份：「我是${claimedRole}」`, { actorId: actor.id, action: 'claim_identity', claimedRole });
      if (actor.role === 'prophet' && claimedRole === 'prophet') {
        sim.prophetClaims[actor.id] = true;
        const agent = sim._aiAgents[actor.id];
        if (agent) {
          const checks = agent.getCheckResults();
          Object.entries(checks).forEach(([checkTargetId, result]) => {
            const checkTarget = sim.players.find((p) => p.id === checkTargetId);
            if (checkTarget) {
              log(sim, 'action', `${actor.name}（宣称预言家）公布查验：${checkTarget.name} 是 ${result === 'werewolf' ? '狼人' : '村民'}`);
            }
          });
        }
      }
      if (actor.role === 'prophet' && claimedRole !== 'prophet' && sim.prophetClaims[actor.id]) {
        sim.prophetClaims[actor.id] = false;
        log(sim, 'action', `${actor.name} 终止了预言家身份的公布义务。`);
      }
      break;
    }
    case 'reveal_info': {
      const infoType = details.infoType as string;
      const infoTarget = details.infoTarget as string;
      const infoContent = details.infoContent as string;
      log(sim, 'action', `${actor.name} 公开信息：${infoTarget || targetName} 持有 ${infoContent || '某物'}`, { actorId: actor.id, action: 'reveal_info', infoTarget, infoContent });
      break;
    }
    case 'observe': {
      log(sim, 'action', `${actor.name} 暗中观察 ${targetName}...`, { actorId: actor.id, action: 'observe', targetId });
      // 观察检定：洞察 vs 目标隐蔽（对抗检定）
      const actorInsightMod = calculateFinalModifier(actor.attributes.insight, actor.alignment, actor.stress, 'other');
      const targetStealthMod = calculateFinalModifier(target?.attributes.stealth || DEFAULT_ATTRIBUTE_FALLBACK, target?.alignment || DEFAULT_ALIGNMENT_FALLBACK, target?.stress || DEFAULT_STRESS_FALLBACK, 'stealth');
      const observeResult = performOpposedCheck(actorInsightMod, targetStealthMod);
      
      // 是否被目标发现：目标洞察 vs 观察者隐蔽（对抗检定）
      const targetInsightMod = calculateFinalModifier(target?.attributes.insight || DEFAULT_ATTRIBUTE_FALLBACK, target?.alignment || DEFAULT_ALIGNMENT_FALLBACK, target?.stress || DEFAULT_STRESS_FALLBACK, 'other');
      const actorStealthMod = calculateFinalModifier(actor.attributes.stealth, actor.alignment, actor.stress, 'stealth');
      const discoveredResult = performOpposedCheck(targetInsightMod, actorStealthMod);
      
      if (discoveredResult.success && target) {
        log(sim, 'action', `${actor.name} 的观察被 ${targetName} 察觉！`);
        target.stress = clampStress(target.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
      } else {
        log(sim, 'action', `${actor.name} 的观察未被发现。`);
      }
      // 是否被其他旁观者发现
      sim.players.forEach((observer) => {
        if (observer.id === actor.id || observer.id === targetId || !observer.alive) return;
        const observerInsightMod = calculateFinalModifier(observer.attributes.insight, observer.alignment, observer.stress, 'other');
        const actorStealthMod2 = calculateFinalModifier(actor.attributes.stealth, actor.alignment, actor.stress, 'stealth');
        const discoveredByOther = performOpposedCheck(observerInsightMod, actorStealthMod2);
        if (discoveredByOther.success) {
          log(sim, 'action', `${observer.name} 察觉到 ${actor.name} 在观察 ${targetName}。`);
        }
      });
      const agent = sim._aiAgents[actor.id];
      if (agent && target) {
        agent.recordObservation(target.id, target.stress, target.attributes);
      }
      // 观察未被发现 = 视同沉默，不重置计数
      if (!discoveredResult.success) {
        shouldResetSilence = false;
      }
      break;
    }
    case 'suspect': {
      // 怀疑检定：洞察/逻辑 vs 目标隐蔽（对抗检定）
      const suspectMod = calculateFinalModifier(
        Math.max(actor.attributes.insight, actor.attributes.logic),
        actor.alignment, actor.stress, 'other'
      );
      const targetHideMod = calculateFinalModifier(
        target?.attributes.stealth || DEFAULT_ATTRIBUTE_FALLBACK,
        target?.alignment || DEFAULT_ALIGNMENT_FALLBACK,
        target?.stress || DEFAULT_STRESS_FALLBACK, 'stealth'
      );
      const suspectResult = performOpposedCheck(suspectMod, targetHideMod);
      const successLevel = suspectResult.success ? (suspectResult.margin >= CRITICAL_SUCCESS_MARGIN ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${actor.name} 怀疑 ${targetName}：「我觉得 ${targetName} 可能是狼人」（${successLevel}）`, { actorId: actor.id, action: 'suspect', targetId });
      if (target) {
        target.stress = clampStress(target.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
      }
      break;
    }
    case 'defend': {
      // 袒护检定：亲和 + 阵营修正
      const defendMod = calculateFinalModifier(actor.attributes.affinity, actor.alignment, actor.stress, 'affinity', true);
      const defendCheck = performCheck(defendMod, CHECK_DIFFICULTY_DEFEND);
      const successLevel = defendCheck.success ? (defendCheck.criticalSuccess ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${actor.name} 袒护 ${targetName}：「我相信 ${targetName} 是好人」（${successLevel}）`, { actorId: actor.id, action: 'defend', targetId });
      if (target) {
        target.stress = clampStress(target.stress - STRESS_CHANGE_MINOR_POS);
        updateRelation(sim, target, actor, { trustDelta: 0, friendlyDelta: REL_CHANGE_MODERATE_POS });
      }
      break;
    }
    case 'thank': {
      log(sim, 'action', `${actor.name} 感谢 ${targetName}`, { actorId: actor.id, action: 'thank', targetId });
      if (target) {
        target.stress = clampStress(target.stress - (Math.random() > 0.5 ? STRESS_CHANGE_MINOR_POS : 0));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MINOR_POS, friendlyDelta: REL_CHANGE_MINOR_POS });
      }
      break;
    }
    case 'call_vote': {
      // 号召投票检定：领导/逻辑
      const callMod = calculateFinalModifier(
        Math.max(actor.attributes.leadership, actor.attributes.logic),
        actor.alignment, actor.stress, 'leadership'
      );
      const callCheck = performCheck(callMod, CHECK_DIFFICULTY_CALL_VOTE);
      const successLevel = callCheck.success ? (callCheck.criticalSuccess ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${actor.name} 号召投票给 ${targetName}：「大家今天投 ${targetName}！」（${successLevel}）`, { actorId: actor.id, action: 'call_vote', targetId });
      if (target) {
        target.stress = clampStress(target.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
      }
      break;
    }
    case 'block_vote': {
      // 阻止投票检定：领导/亲和
      const blockMod = calculateFinalModifier(
        Math.max(actor.attributes.leadership, actor.attributes.affinity),
        actor.alignment, actor.stress, 'leadership'
      );
      const blockCheck = performCheck(blockMod, CHECK_DIFFICULTY_BLOCK_VOTE);
      const successLevel = blockCheck.success ? (blockCheck.criticalSuccess ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${actor.name} 阻止投票给 ${targetName}：「今天不要投 ${targetName}」（${successLevel}）`, { actorId: actor.id, action: 'block_vote', targetId });
      if (target) {
        target.stress = clampStress(target.stress - (STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS)));
        updateRelation(sim, target, actor, { trustDelta: 0, friendlyDelta: REL_CHANGE_MINOR_POS });
      }
      break;
    }
    case 'guarantee': {
      // 担保清白检定：亲和/洞察
      const guaranteeMod = calculateFinalModifier(
        Math.max(actor.attributes.affinity, actor.attributes.insight),
        actor.alignment, actor.stress, 'affinity', true
      );
      const guaranteeCheck = performCheck(guaranteeMod, CHECK_DIFFICULTY_GUARANTEE);
      const successLevel = guaranteeCheck.success ? (guaranteeCheck.criticalSuccess ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${actor.name} 担保 ${targetName} 是好人！（${successLevel}）`, { actorId: actor.id, action: 'guarantee', targetId });
      if (target) {
        target.stress = clampStress(target.stress - (STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS)));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MODERATE_POS, friendlyDelta: REL_CHANGE_MAJOR_POS });
      }
      break;
    }
    case 'accuse': {
      // 强烈指认检定：洞察/逻辑 vs 目标隐蔽（对抗检定）
      const accuseMod = calculateFinalModifier(
        Math.max(actor.attributes.insight, actor.attributes.logic),
        actor.alignment, actor.stress, 'other'
      );
      const targetHideMod = calculateFinalModifier(
        target?.attributes.stealth || DEFAULT_ATTRIBUTE_FALLBACK,
        target?.alignment || DEFAULT_ALIGNMENT_FALLBACK,
        target?.stress || DEFAULT_STRESS_FALLBACK, 'stealth'
      );
      const accuseResult = performOpposedCheck(accuseMod, targetHideMod);
      const successLevel = accuseResult.success ? (accuseResult.margin >= CRITICAL_SUCCESS_MARGIN ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${actor.name} 强烈指认 ${targetName} 是狼人！（${successLevel}）`, { actorId: actor.id, action: 'accuse', targetId });
      if (target) {
        target.stress = clampStress(target.stress + STRESS_CHANGE_MODERATE_POS + Math.floor(Math.random() * STRESS_CHANGE_MODERATE_POS));
        updateRelation(sim, target, actor, { trustDelta: REL_CHANGE_MAJOR_NEG, friendlyDelta: REL_CHANGE_MAJOR_NEG });
      }
      break;
    }
    case 'exclude_all': {
      // 全员排除检定：逻辑/领导
      const excludeMod = calculateFinalModifier(
        Math.max(actor.attributes.logic, actor.attributes.leadership),
        actor.alignment, actor.stress, 'leadership'
      );
      const excludeCheck = performCheck(excludeMod, CHECK_DIFFICULTY_EXCLUDE_ALL);
      const successLevel = excludeCheck.success ? (excludeCheck.criticalSuccess ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${actor.name} 提议全员排除：「这些自称${details.identity || '某身份'}的人全部放逐！」（${successLevel}）`, { actorId: actor.id, action: 'exclude_all', identity: details.identity });
      break;
    }
    case 'berserker_kill': {
      if (actor.role === 'berserker' && hasItem(actor, 'double_sword') && target && target.alive) {
        log(sim, 'death', `${actor.name} 发动狂狼同归于尽！${target.name} 与 ${actor.name} 双双死亡！`, { actorId: actor.id, targetId: target.id });
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
  const respondents = sim.players
    .filter((p) => p.alive && p.id !== triggerAction.actorId)
    .map((p) => p.id);

  sim.appendixWindow = {
    triggerAction,
    respondents,
    currentIndex: 0,
    responses: [],
  };

  const appendixSteps: GameStep[] = [];

  respondents.forEach((rid) => {
    appendixSteps.push({
      type: 'appendix_action',
      actorId: rid,
      fn: () => runAppendixAction(sim, rid),
    });
  });

  const insertIndex = sim.currentStep + 1;
  sim.stepQueue.splice(insertIndex, 0, ...appendixSteps);
}

export function runAppendixAction(sim: GameSimulator, playerId: string) {
  if (!sim.appendixWindow) return;
  const player = sim.players.find((p) => p.id === playerId);
  if (!player || !player.alive) return;

  const agent = sim._aiAgents[playerId];
  if (!agent) return;

  const decision = agent.appendixAction(
    getPublicPlayerStates(sim),
    sim.appendixWindow.triggerAction,
    sim.publicActions
  );

  if (!decision) return;

  // 追加行动是公开行动，打断沉默计数
  sim.consecutiveSilenceCount = 0;

  const actionRecord: PublicActionRecord = {
    actorId: player.id,
    type: decision.action as ActionType,
    targetId: decision.target || undefined,
    details: decision.details,
    round: sim.round,
  };
  sim.publicActions.push(actionRecord);
  sim.appendixWindow.responses.push(actionRecord);

  const triggerActor = sim.players.find((p) => p.id === sim.appendixWindow!.triggerAction.actorId);
  const originalTarget = sim.players.find((p) => p.id === sim.appendixWindow!.triggerAction.targetId);

  switch (decision.action) {
    case 'join_suspect': {
      // 一同怀疑检定：洞察/逻辑
      const joinSuspectMod = calculateFinalModifier(
        Math.max(player.attributes.insight, player.attributes.logic),
        player.alignment, player.stress, 'other'
      );
      const joinSuspectCheck = performCheck(joinSuspectMod, CHECK_DIFFICULTY_JOIN_SUSPECT);
      const successLevel = joinSuspectCheck.success ? (joinSuspectCheck.criticalSuccess ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${player.name} 一同怀疑 ${originalTarget?.name || '目标'}（${successLevel}）`, { actorId: player.id, action: 'join_suspect' });
      if (originalTarget) {
        originalTarget.stress = clampStress(originalTarget.stress + STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS));
        updateRelation(sim, originalTarget, player, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG });
      }
      break;
    }
    case 'join_defend': {
      // 一同袒护检定：亲和
      const joinDefendMod = calculateFinalModifier(player.attributes.affinity, player.alignment, player.stress, 'affinity', true);
      const joinDefendCheck = performCheck(joinDefendMod, CHECK_DIFFICULTY_JOIN_DEFEND);
      const successLevel = joinDefendCheck.success ? (joinDefendCheck.criticalSuccess ? '大成功' : '成功') : '失败';
      log(sim, 'action', `${player.name} 一同袒护 ${originalTarget?.name || '目标'}（${successLevel}）`, { actorId: player.id, action: 'join_defend' });
      if (originalTarget) {
        originalTarget.stress = clampStress(originalTarget.stress - STRESS_CHANGE_MINOR_POS);
        updateRelation(sim, originalTarget, player, { trustDelta: 0, friendlyDelta: REL_CHANGE_MODERATE_POS });
      }
      break;
    }
    case 'rebut': {
      log(sim, 'action', `${player.name} 反驳：「我不是狼人！」`, { actorId: player.id, action: 'rebut' });
      if (triggerActor) {
        // 反驳检定：反驳者逻辑 + 阵营/压力修正 vs 怀疑者洞察 + 阵营/压力修正
        const rebutLogicMod = calculateFinalModifier(player.attributes.logic, player.alignment, player.stress, 'other');
        const suspectInsightMod = calculateFinalModifier(triggerActor.attributes.insight, triggerActor.alignment, triggerActor.stress, 'other');
        const rebutResult = performOpposedCheck(rebutLogicMod, suspectInsightMod);
        if (rebutResult.success) {
          log(sim, 'check', `${player.name} 的反驳成功！(优势 ${rebutResult.margin})`);
          player.stress = clampStress(player.stress - STRESS_CHANGE_MINOR_POS);
          // 旁观者信任反驳者
          sim.players.forEach((p) => {
            if (p.id !== player.id && p.id !== triggerActor.id && p.alive) {
              updateRelation(sim, p, player, { trustDelta: REL_CHANGE_MINOR_POS, friendlyDelta: 0 });
              // 反驳成功：怀疑者失旁观者信任
              updateRelation(sim, p, triggerActor, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: 0 });
            }
          });
        } else {
          log(sim, 'check', `${player.name} 的反驳失败...`);
          player.stress = clampStress(player.stress + STRESS_CHANGE_MINOR_POS);
          // 反驳失败：旁观者更信任怀疑者
          sim.players.forEach((p) => {
            if (p.id !== player.id && p.id !== triggerActor.id && p.alive) {
              updateRelation(sim, p, triggerActor, { trustDelta: REL_CHANGE_MINOR_POS, friendlyDelta: 0 });
            }
          });
        }
      }
      break;
    }
  }
}
