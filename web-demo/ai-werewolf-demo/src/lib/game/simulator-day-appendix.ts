/**
 * Day Phase Appendix Actions (追加行动/反应)
 *
 * Handles reactions to suspect/defend actions:
 * - join_suspect (一同怀疑)
 * - join_defend (一同袒护)
 * - rebut (反驳)
 */

import type { GameSimulator, PublicActionRecord } from './simulator-core';
import type { ActionType, DecisionProcess } from '@/types';
import { performCheck, performOpposedCheck, calculateModifierBreakdown } from '@/types';
import { ACTION } from '@/lib/constants/action-constants';
import {
  STRESS_CHANGE_MINOR_POS,
  REL_CHANGE_MINOR_NEG, REL_CHANGE_MINOR_POS, REL_CHANGE_MODERATE_POS,
  CHECK_DIFFICULTY_JOIN_SUSPECT, CHECK_DIFFICULTY_JOIN_DEFEND,
} from '@/types';
import { getPublicPlayerStates, logAction, buildCheckLog } from './simulator-utils';

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
        const joinSuspectStressDelta = STRESS_CHANGE_MINOR_POS + Math.floor(Math.random() * STRESS_CHANGE_MINOR_POS);
        sim.playerStateBus.changeStress(originalTarget.id, joinSuspectStressDelta, ACTION.JOIN_SUSPECT);
        sim.playerStateBus.changeRelation(originalTarget.id, player.id, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG }, ACTION.JOIN_SUSPECT);
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
        sim.playerStateBus.changeStress(originalTarget.id, -STRESS_CHANGE_MINOR_POS, ACTION.JOIN_DEFEND);
        sim.playerStateBus.changeRelation(originalTarget.id, player.id, { trustDelta: 0, friendlyDelta: REL_CHANGE_MODERATE_POS }, ACTION.JOIN_DEFEND);
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

        if (rebutResult.success) {
          sim.playerStateBus.changeStress(player.id, -STRESS_CHANGE_MINOR_POS, 'rebut_success');
          // 旁观者信任反驳者
          sim.players.forEach((p) => {
            if (p.id !== player.id && p.id !== triggerActor.id && p.alive) {
              sim.playerStateBus.changeRelation(p.id, player.id, { trustDelta: REL_CHANGE_MINOR_POS, friendlyDelta: REL_CHANGE_MINOR_POS }, 'rebut_success');
              // 反驳成功：怀疑者失旁观者信任
              sim.playerStateBus.changeRelation(p.id, triggerActor.id, { trustDelta: REL_CHANGE_MINOR_NEG, friendlyDelta: REL_CHANGE_MINOR_NEG }, 'rebut_success');
            }
          });
        } else {
          sim.playerStateBus.changeStress(player.id, STRESS_CHANGE_MINOR_POS, 'rebut_failure');
          // 反驳失败：旁观者更信任怀疑者
          sim.players.forEach((p) => {
            if (p.id !== player.id && p.id !== triggerActor.id && p.alive) {
              sim.playerStateBus.changeRelation(p.id, triggerActor.id, { trustDelta: REL_CHANGE_MINOR_POS, friendlyDelta: REL_CHANGE_MINOR_POS }, 'rebut_failure');
            }
          });
        }
      }
      break;
    }
  }
}
