import type { GameSimulator } from './simulator-core';
import type { Player, GameLogItem, RelationDelta } from '../ai/types';
import { clampRelation } from '../ai/types';

export function getPublicPlayerStates(sim: GameSimulator): Player[] {
  return sim.players.map((p) => ({ ...p }));
}

export function getName(sim: GameSimulator, id: string): string {
  const p = sim.players.find((x) => x.id === id);
  return p ? p.name : id;
}

export function log(sim: GameSimulator, type: GameLogItem['type'], message: string, details?: Record<string, unknown>) {
  sim.logs.push({ round: sim.round, phase: sim.phase, message, type, details });
}

export function updateRelation(sim: GameSimulator, fromPlayer: Player, toPlayer: Player, delta: RelationDelta) {
  if (!fromPlayer.relations[toPlayer.id]) {
    fromPlayer.relations[toPlayer.id] = { trust: 0, friendly: 0 };
  }
  const rel = fromPlayer.relations[toPlayer.id];
  rel.trust = clampRelation(rel.trust + delta.trustDelta);
  rel.friendly = clampRelation(rel.friendly + delta.friendlyDelta);

  if (Math.abs(delta.trustDelta) >= 2 || Math.abs(delta.friendlyDelta) >= 2) {
    log(sim, 'relation', `${fromPlayer.name} 对 ${toPlayer.name} 的关系变化：信任 ${delta.trustDelta > 0 ? '+' : ''}${delta.trustDelta}，友好 ${delta.friendlyDelta > 0 ? '+' : ''}${delta.friendlyDelta}`);
  }
}
