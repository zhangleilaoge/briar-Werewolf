// ============================================================
// PluginRegistry 测试
// ============================================================

import { describe, it, expect } from 'vitest';
import { pluginRegistry, PluginRegistry } from './registry';

describe('PluginRegistry', () => {
  it('auto-registers default role plugins', () => {
    expect(pluginRegistry.hasRole('villager')).toBe(true);
    expect(pluginRegistry.hasRole('prophet')).toBe(true);
    expect(pluginRegistry.hasRole('werewolf')).toBe(true);
  });

  it('villager plugin has correct properties', () => {
    const villager = pluginRegistry.getRole('villager');
    expect(villager).toBeDefined();
    expect(villager!.team).toBe('villager');
    expect(villager!.hasNightAction).toBe(false);
    expect(villager!.roleName).toBe('村民');
  });

  it('prophet plugin has correct properties', () => {
    const prophet = pluginRegistry.getRole('prophet');
    expect(prophet).toBeDefined();
    expect(prophet!.team).toBe('villager');
    expect(prophet!.hasNightAction).toBe(true);
    expect(prophet!.roleName).toBe('预言家');
  });

  it('werewolf plugin has correct properties', () => {
    const werewolf = pluginRegistry.getRole('werewolf');
    expect(werewolf).toBeDefined();
    expect(werewolf!.team).toBe('werewolf');
    expect(werewolf!.hasNightAction).toBe(true);
    expect(werewolf!.roleName).toBe('狼人');
  });

  it('villager plugin generates long-term intentions', () => {
    const villager = pluginRegistry.getRole('villager')!;
    const self = { id: 'A', name: 'A', role: 'villager' as const, team: 'villager' as const, alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } };
    const players = [self];
    const longTerm = villager.getLongTermIntentions(self, players, new Map(), { playerId: 'A', score: 0, dominant: 0, factors: { accuseCount: 0, voteCount: 0, defendCount: 0, observeCount: 0, claimWolfCount: 0 }, basis: [] }, { getFriendly: () => 0, getAll: () => [] } as any);
    expect(longTerm.length).toBeGreaterThan(0);
    expect(longTerm.map((lt) => lt.id)).toContain('survive');
    expect(longTerm.map((lt) => lt.id)).toContain('find_werewolf');
  });

  it('prophet plugin generates check night action candidates', () => {
    const prophet = pluginRegistry.getRole('prophet')!;
    const self = { id: 'A', name: 'A', role: 'prophet' as const, team: 'villager' as const, alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } };
    const b = { id: 'B', name: 'B', role: 'villager' as const, team: 'villager' as const, alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } };
    const players = [self, b];
    const candidates = prophet.getNightActionCandidates(self, players, new Map(), { getFriendly: () => 0, getAll: () => [] } as any, []);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].action).toBe('check');
    expect(candidates[0].targetId).toBe('B');
  });

  it('werewolf plugin generates kill night action candidates', () => {
    const werewolf = pluginRegistry.getRole('werewolf')!;
    const self = { id: 'A', name: 'A', role: 'werewolf' as const, team: 'werewolf' as const, alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } };
    const b = { id: 'B', name: 'B', role: 'villager' as const, team: 'villager' as const, alive: true, personality: 'cautious', pressure: 0, burstCount: 0, traits: [], attributes: { leadership: 5, eloquence: 5, observation: 5, cunning: 5, affinity: 5, logic: 5 } };
    const players = [self, b];
    const candidates = werewolf.getNightActionCandidates(self, players, new Map(), { getFriendly: () => 0, getAll: () => [] } as any, []);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].action).toBe('kill');
    expect(candidates[0].targetId).toBe('B');
  });

  it('new registry can be created independently', () => {
    const registry = new PluginRegistry();
    expect(registry.hasRole('villager')).toBe(false);
    registry.registerDefaultRoles();
    expect(registry.hasRole('villager')).toBe(true);
  });
});
