import type { GameSimulator } from './simulator-core';
import type { Player, NightActionType } from '../ai/types';
import { hasItem, damageItem, canUseItem, ITEM_DEFINITIONS, addItem } from '../ai/types';
import { getName, log, logAction } from './simulator-utils';

export function runNightAction(sim: GameSimulator, player: Player) {
  if (!player.alive) return;
  const agent = sim._aiAgents[player.id];
  if (!agent) return;

  const decision = agent.nightAction(getPublicPlayerStates(sim), sim.nightDecisions);
  if (!decision) return;

  sim.nightDecisions.push({
    playerId: player.id,
    action: decision.action as NightActionType,
    targetId: decision.target,
    reason: decision.reason,
  });

  switch (decision.action) {
    case 'kill': {
      const targetName = getName(sim, decision.target || '');
      logAction(sim, 'action', `${player.name} 选择袭击 ${targetName || '空刀'}`, decision.reason, [], { actorId: player.id, action: 'kill', targetId: decision.target });
      break;
    }
    case 'check': {
      const target = sim.players.find((p) => p.id === decision.target);
      if (target && canUseItem(player, 'crystal_ball')) {
        const result = target.team === 'werewolf' ? 'werewolf' : 'villager';
        agent.recordCheckResult(target.id, result);
        logAction(sim, 'action', `${player.name} 查验 ${target.name} → ${result === 'werewolf' ? '狼人' : '村民'}`, decision.reason, [], { actorId: player.id, action: 'check', targetId: target.id });
        if (result === 'werewolf') {
          damageItem(player, 'crystal_ball');
          log(sim, 'item', `${player.name} 的水晶球在查验狼人时碎裂！`);
        }
      } else {
        log(sim, 'action', `${player.name} 尝试查验但缺少水晶球`);
      }
      break;
    }
    case 'steal': {
      if (sim.thiefUsed[player.id]) {
        log(sim, 'action', `${player.name} 已使用过偷窃能力`);
        return;
      }
      const target = sim.players.find((p) => p.id === decision.target);
      if (target && target.alive && canUseItem(player, 'thief_gloves')) {
        sim.thiefUsed[player.id] = true;
        if (target.items.length > 0) {
          const stolenIdx = Math.floor(Math.random() * target.items.length);
          const stolen = target.items.splice(stolenIdx, 1)[0];
          if (addItem(player, stolen.definitionId)) {
            damageItem(player, 'thief_gloves');
            log(sim, 'item', `${player.name} 偷取了 ${target.name} 的 ${ITEM_DEFINITIONS[stolen.definitionId]?.name || stolen.definitionId}！小偷手套损坏。`);
          } else {
            target.items.push(stolen);
            log(sim, 'item', `${player.name} 尝试偷取但道具栏已满`);
          }
        } else {
          sim.thiefUsed[player.id] = true;
          log(sim, 'item', `${player.name} 尝试偷窃 ${target.name}，但目标没有道具，能力浪费。`);
        }
      }
      break;
    }
    case 'inspect': {
      if (sim.coronerUsed[player.id]) {
        log(sim, 'action', `${player.name} 已使用过验尸能力`);
        return;
      }
      const target = sim.players.find((p) => p.id === decision.target);
      if (target && !target.alive && canUseItem(player, 'coroner_tools')) {
        sim.coronerUsed[player.id] = true;
        const items = target.items.map((i) => ITEM_DEFINITIONS[i.definitionId]?.name || i.definitionId).join(', ') || '无';
        log(sim, 'item', `${player.name} 验尸 ${target.name}，发现道具：${items}。验尸工具损坏。`);
        damageItem(player, 'coroner_tools');
        agent.recordInspection(target.id, target.items.map((i) => i.definitionId));
      } else {
        log(sim, 'action', `${player.name} 尝试验尸但条件不满足`);
      }
      break;
    }
  }
}

export function resolveNightActions(sim: GameSimulator) {
  if (sim.options.skipNightKill) return;
  if (sim.peacefulNight) {
    log(sim, 'phase', '本夜为平安夜（狂狼同归于尽后），跳过狼人杀戮。');
    sim.peacefulNight = false; // 消耗掉标记
    return;
  }

  const werewolfKills = sim.nightDecisions.filter(
    (d) => d.action === 'kill' && sim.players.find((p) => p.id === d.playerId)?.role !== 'lone_wolf'
  );
  const loneWolfKills = sim.nightDecisions.filter(
    (d) => d.action === 'kill' && sim.players.find((p) => p.id === d.playerId)?.role === 'lone_wolf'
  );

  let killTarget: string | null = null;
  let killerId: string | null = null;

  for (const dec of werewolfKills) {
    const p = sim.players.find((pl) => pl.id === dec.playerId);
    if (p && hasItem(p, 'claws')) {
      killTarget = dec.targetId;
      killerId = dec.playerId;
      break;
    }
  }

  let loneWolfTarget: string | null = null;
  let loneWolfId: string | null = null;

  for (const dec of loneWolfKills) {
    const p = sim.players.find((pl) => pl.id === dec.playerId);
    if (p && hasItem(p, 'claws')) {
      loneWolfTarget = dec.targetId;
      loneWolfId = dec.playerId;
      break;
    }
  }

  const aliveWerewolves = sim.players.filter((p) => p.team === 'werewolf' && p.alive);
  const isLoneWolfOnly = aliveWerewolves.length === 1 && aliveWerewolves[0].role === 'lone_wolf';

  if (loneWolfTarget && killTarget && !isLoneWolfOnly && loneWolfTarget === killTarget) {
    log(sim, 'death', `孤狼与普通狼人目标相同（${getName(sim, killTarget)}），本次杀戮无效！`);
    return;
  }

  const finalTarget = isLoneWolfOnly && loneWolfTarget ? loneWolfTarget : killTarget;
  const finalKiller = isLoneWolfOnly && loneWolfTarget ? loneWolfId : killerId;

  if (!finalTarget || !finalKiller) return;

  const target = sim.players.find((p) => p.id === finalTarget);
  const killer = sim.players.find((p) => p.id === finalKiller);
  if (!target || !target.alive || !killer) return;

  if (hasItem(target, 'amulet')) {
    damageItem(target, 'amulet');
    log(sim, 'item', `${target.name} 的护身符抵挡了致命一击！护身符损坏。`);
    return;
  }

  // Human with claws can retaliate: mutual kill
  if (hasItem(target, 'claws') && target.team !== 'werewolf') {
    target.alive = false;
    sim.nightDeaths.push(target.id);
    log(sim, 'death', `${target.name} 持有尖牙利爪，与 ${killer.name} 同归于尽！`, { playerId: target.id });
    killer.alive = false;
    sim.nightDeaths.push(killer.id);
    log(sim, 'death', `${killer.name} 被 ${target.name} 反击致死！`, { playerId: killer.id });
    damageItem(target, 'claws');
    sim.players.forEach((p) => {
      const agent = sim._aiAgents[p.id];
      if (agent) {
        agent.onEvent({ type: 'death', playerId: target.id });
        agent.onEvent({ type: 'death', playerId: killer.id });
      }
    });
    return;
  }

  target.alive = false;
  sim.nightDeaths.push(target.id);
  log(sim, 'death', `${killer.name} 刀了 ${target.name}，${target.name} 死亡！`, { playerId: target.id });
  sim.players.forEach((p) => {
    const agent = sim._aiAgents[p.id];
    if (agent) agent.onEvent({ type: 'death', playerId: target.id });
  });
}

// Helper needed for getPublicPlayerStates
function getPublicPlayerStates(sim: GameSimulator): Player[] {
  return sim.players.map((p) => ({ ...p }));
}
