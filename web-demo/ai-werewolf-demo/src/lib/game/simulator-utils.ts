import type { GameSimulator } from './simulator-core';
import type { Player, GameLogItem, RelationDelta, CheckLog, ModifierBreakdown, ActionLogDetail, Attributes } from '@/types';
import { clampRelation, ATTRIBUTE_NAMES } from '@/types';

export function getPublicPlayerStates(sim: GameSimulator): Player[] {
  return sim.players.map((p) => ({ ...p }));
}

export function getName(sim: GameSimulator, id: string): string {
  const p = sim.players.find((x) => x.id === id);
  return p ? p.name : id;
}

function formatTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function log(sim: GameSimulator, type: GameLogItem['type'], message: string, details?: Record<string, unknown>) {
  const time = formatTime();
  const item = { round: sim.round, phase: sim.phase, message: `[${time}] ${message}`, type, details };
  if (sim.tickLogBuffer !== undefined) {
    sim.tickLogBuffer.push(item);
  } else {
    sim.logs.push(item);
  }
}

export function logAction(
  sim: GameSimulator,
  type: GameLogItem['type'],
  message: string,
  decisionReason: string,
  checks: CheckLog[],
  meta: { actorId: string; action: string; targetId?: string | null; [key: string]: unknown }
) {
  const time = formatTime();
  // 自动从 meta 中提取涉及的玩家ID，避免在 UI 中硬匹配所有玩家名字
  const mentions = [meta.actorId, meta.targetId].filter(Boolean) as string[];
  const item = {
    round: sim.round,
    phase: sim.phase,
    message: `[${time}] ${message}`,
    type,
    details: {
      decisionReason,
      checks,
      mentions,
      ...meta,
    } as ActionLogDetail,
  };
  if (sim.tickLogBuffer !== undefined) {
    sim.tickLogBuffer.push(item);
  } else {
    sim.logs.push(item);
  }
}

export function buildCheckLog(
  actor: Player,
  actorAttr: keyof Attributes,
  actorBreakdown: ModifierBreakdown,
  result: { roll: number; total: number; margin: number; success: boolean; criticalSuccess?: boolean; criticalFail?: boolean },
  difficulty?: number,
  target?: Player,
  targetAttr?: keyof Attributes,
  targetBreakdown?: ModifierBreakdown,
  targetResult?: { roll: number; total: number }
): CheckLog {
  const isOpposed = !!target;

  let successLevel: string;
  if (isOpposed) {
    successLevel = result.margin >= 10 ? '大成功' : result.margin <= -10 ? '大失败' : result.success ? '成功' : '失败';
  } else {
    successLevel = result.criticalSuccess ? '大成功' : result.criticalFail ? '大失败' : result.success ? '成功' : '失败';
  }

  const log: CheckLog = {
    type: isOpposed ? 'opposed' : 'check',
    actorName: actor.name,
    actorAttribute: ATTRIBUTE_NAMES[actorAttr],
    actorBaseValue: actorBreakdown.baseAttribute,
    actorAlignmentMod: actorBreakdown.alignmentMod,
    actorStressMod: actorBreakdown.stressMod,
    actorTotalModifier: actorBreakdown.total,
    actorRoll: result.roll,
    actorTotal: result.total,
    margin: result.margin,
    success: result.success,
    successLevel,
  };

  if (difficulty !== undefined) {
    log.difficulty = difficulty;
  }

  if (target && targetAttr && targetBreakdown && targetResult) {
    log.targetName = target.name;
    log.targetAttribute = ATTRIBUTE_NAMES[targetAttr];
    log.targetBaseValue = targetBreakdown.baseAttribute;
    log.targetAlignmentMod = targetBreakdown.alignmentMod;
    log.targetStressMod = targetBreakdown.stressMod;
    log.targetTotalModifier = targetBreakdown.total;
    log.targetRoll = targetResult.roll;
    log.targetTotal = targetResult.total;
  }

  return log;
}

