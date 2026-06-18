import type { GameSimulator } from './simulator-core';
import type { Player, NightActionType } from '@/types';
import { hasItem, damageItem, addItem } from '@/types';
import { log, getPublicPlayerStates } from './simulator-utils';

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

  // Execute via plugin system
  const target = decision.target ? sim.players.find((p) => p.id === decision.target) : undefined;
  
  try {
    const result = sim.pluginRegistry.executeAction(decision.action, {
      actor: player,
      target,
      action: decision.action,
      context: {
        round: sim.round,
        phase: 'night',
        players: sim.players,
        nightDecisions: sim.nightDecisions,
      },
    });
    
    if (result.success) {
      // Apply state changes
      result.stateChanges.forEach((change) => {
        switch (change.type) {
          case 'item_damage':
            damageItem(sim.players.find(p => p.id === change.targetId)!, change.payload.itemId as string);
            break;
          case 'item_add':
            addItem(sim.players.find(p => p.id === change.targetId)!, change.payload.itemId as string);
            break;
          case 'item_remove': {
            const player = sim.players.find(p => p.id === change.targetId)!;
            const idx = player.items.findIndex(i => i.definitionId === change.payload.itemId);
            if (idx >= 0) player.items.splice(idx, 1);
            break;
          }
        }
      });
      
      // Emit events
      result.events.forEach((event) => {
        if (event.type === 'check_result' && event.payload.targetId && event.payload.result) {
          agent.recordCheckResult(event.payload.targetId as string, event.payload.result as 'werewolf' | 'villager');
        }
        if (event.type === 'inspection' && event.payload.targetId && event.payload.items) {
          agent.recordInspection(event.payload.targetId as string, event.payload.items as string[]);
        }
      });
      
      // Add logs
      result.logs.forEach((logItem) => {
        sim.tickLogBuffer.push({
          round: sim.round,
          phase: 'night',
          ...logItem,
        });
      });
    }
  } catch (error) {
    console.error(`[simulator-night] Plugin execution failed for ${decision.action}:`, error);
  }
}

export function resolveNightActions(sim: GameSimulator) {
  if (sim.options.skipNightKill) return;
  if (sim.peacefulNight) {
    log(sim, 'phase', '本夜为平安夜（狂狼同归于尽后），跳过狼人杀戮。');
    sim.peacefulNight = false; // 消耗掉标记
    return;
  }

  // Separate werewolf and lone wolf kills
  const werewolfKills = sim.nightDecisions.filter(
    (d) => d.action === 'kill' && sim.players.find((p) => p.id === d.playerId)?.role !== 'lone_wolf'
  );
  const loneWolfKills = sim.nightDecisions.filter(
    (d) => d.action === 'kill' && sim.players.find((p) => p.id === d.playerId)?.role === 'lone_wolf'
  );

  // Find primary werewolf kill target
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

  // Find lone wolf kill target
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

  // Use trait plugin to handle lone wolf coordination
  if (loneWolfId && loneWolfTarget) {
    const coordinationResult = sim.pluginRegistry.modifyNightKillCoordination(
      {
        round: sim.round,
        phase: 'night',
        players: sim.players,
        nightDecisions: sim.nightDecisions,
      },
      werewolfKills.map(d => ({ playerId: d.playerId, targetId: d.targetId })),
      { playerId: loneWolfId, targetId: loneWolfTarget }
    );
    
    if (!coordinationResult.valid) {
      // Trait invalidated the kill (e.g., lone wolf target matches regular wolf target)
      log(sim, 'death', coordinationResult.reason || '杀戮无效');
      return;
    }
    
    // Use trait's final decision if provided
    if (coordinationResult.finalTarget !== undefined) {
      killTarget = coordinationResult.finalTarget;
      killerId = coordinationResult.finalKiller || killerId;
    }
  }

  // If no regular wolf kill, check if only lone wolf remains
  if (!killTarget && loneWolfTarget) {
    const aliveWerewolves = sim.players.filter((p) => p.team === 'werewolf' && p.alive);
    const isLoneWolfOnly = aliveWerewolves.length === 1 && aliveWerewolves[0].role === 'lone_wolf';
    
    if (isLoneWolfOnly) {
      killTarget = loneWolfTarget;
      killerId = loneWolfId;
    }
  }

  if (!killTarget || !killerId) return;

  const target = sim.players.find((p) => p.id === killTarget);
  const killer = sim.players.find((p) => p.id === killerId);
  if (!target?.alive || !killer) return;

  // Check for amulet protection
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
    sim._checkWinCondition();
    return;
  }

  // Normal kill
  target.alive = false;
  sim.nightDeaths.push(target.id);
  log(sim, 'death', `${killer.name} 刀了 ${target.name}，${target.name} 死亡！`, { playerId: target.id });
  sim.players.forEach((p) => {
    const agent = sim._aiAgents[p.id];
    if (agent) agent.onEvent({ type: 'death', playerId: target.id });
  });
  sim._checkWinCondition();
}
