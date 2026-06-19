import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '../registry';
import type { ActionProvider, TraitProvider, ActionDefinition, ActionContext, DecisionContext } from '@/lib/plugins/types';
import type { Player, DecisionCandidate } from '@/types';

// ---------- Mock Helpers ----------
function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'TestPlayer',
    role: 'villager',
    team: 'villager',
    alive: true,
    items: [],
    attributes: { affinity: 10, logic: 10, leadership: 10, deception: 10, stealth: 10, insight: 10 },
    alignment: { law: 'neutral_law', good: 'neutral_good' },
    traits: [],
    stress: 0,
    relations: {},
    ...overrides,
  };
}

function makeActionProvider(id: string, actions: ActionDefinition[]): ActionProvider {
  return {
    id,
    type: 'item',
    getAvailableActions(_player: Player, _context: ActionContext) {
      return actions;
    },
    execute(_params) {
      return { success: true, logs: [], stateChanges: [], events: [] };
    },
  };
}

function makeTraitProvider(id: string, traitActions: ActionDefinition[], traitIds: string[]): TraitProvider {
  return {
    id,
    type: 'trait',
    hasTrait(player: Player) {
      return traitIds.some((t) => player.traits.includes(t));
    },
    getTraitActions(_player: Player, _context: ActionContext) {
      return traitActions;
    },
  };
}

function makeEvaluatingProvider(id: string, candidates: DecisionCandidate[]): ActionProvider {
  return {
    id,
    type: 'item',
    getAvailableActions() { return []; },
    execute() { return { success: true, logs: [], stateChanges: [], events: [] }; },
    evaluate(_context: DecisionContext) {
      return candidates;
    },
  };
}

function makeEvaluatingTraitProvider(
  id: string,
  traitIds: string[],
  candidates: DecisionCandidate[],
): TraitProvider {
  return {
    id,
    type: 'trait',
    hasTrait(player: Player) {
      return traitIds.some((t) => player.traits.includes(t));
    },
    evaluate(_context: DecisionContext) {
      return candidates;
    },
  };
}

// ---------- Tests ----------
describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('插件注册', () => {
    it('register() 注册后 getProvider() 能获取', () => {
      const provider = makeActionProvider('crystal_ball', []);
      registry.register(provider);

      const retrieved = registry.getProvider('crystal_ball');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('crystal_ball');
    });

    it('getProvider() 对未注册的返回 undefined', () => {
      expect(registry.getProvider('nonexistent')).toBeUndefined();
    });

    it('registerTrait() 注册后 getTraitProvider() 能获取', () => {
      const trait = makeTraitProvider('lone_wolf_trait', [], ['lone_wolf_trait']);
      registry.registerTrait(trait);

      const retrieved = registry.getTraitProvider('lone_wolf_trait');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('lone_wolf_trait');
    });

    it('unregister() 能移除已注册的 provider', () => {
      registry.register(makeActionProvider('item1', []));
      expect(registry.getProvider('item1')).toBeDefined();

      const removed = registry.unregister('item1');
      expect(removed).toBe(true);
      expect(registry.getProvider('item1')).toBeUndefined();
    });

    it('unregister() 对不存在的 provider 返回 false', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('getAllProviders() 返回所有已注册的 provider', () => {
      registry.register(makeActionProvider('item1', []));
      registry.register(makeActionProvider('item2', []));

      const all = registry.getAllProviders();
      expect(all.length).toBe(2);
    });

    it('clear() 清空所有 provider', () => {
      registry.register(makeActionProvider('item1', []));
      registry.registerTrait(makeTraitProvider('trait1', [], []));
      expect(registry.size).toBe(2);

      registry.clear();
      expect(registry.size).toBe(0);
    });

    it('size 返回 provider 数量', () => {
      expect(registry.size).toBe(0);
      registry.register(makeActionProvider('item1', []));
      expect(registry.size).toBe(1);
      registry.registerTrait(makeTraitProvider('trait1', [], []));
      expect(registry.size).toBe(2);
    });
  });

  describe('getAvailableActions 收集', () => {
    it('从多个 action provider 收集行动', () => {
      const actions1: ActionDefinition[] = [
        { type: 'check', label: '查验', description: '查验一名玩家', requiresTarget: true },
      ];
      const actions2: ActionDefinition[] = [
        { type: 'kill', label: '杀戮', description: '杀一名玩家', requiresTarget: true },
        { type: 'steal', label: '偷取', description: '偷取道具', requiresTarget: true },
      ];

      registry.register(makeActionProvider('crystal_ball', actions1));
      registry.register(makeActionProvider('claws', actions2));

      const player = makePlayer();
      const context: ActionContext = { round: 1, phase: 'night', players: [player] };
      const available = registry.getAvailableActions(player, context);

      expect(available.length).toBe(3);
      expect(available.map((a) => a.type)).toContain('check');
      expect(available.map((a) => a.type)).toContain('kill');
      expect(available.map((a) => a.type)).toContain('steal');
    });

    it('trait provider 为拥有特质的玩家提供行动', () => {
      const traitActions: ActionDefinition[] = [
        { type: 'lone_kill', label: '独立杀戮', description: '孤狼独立选择目标', requiresTarget: true },
      ];
      registry.registerTrait(makeTraitProvider('lone_wolf_trait', traitActions, ['lone_wolf_trait']));

      const wolfPlayer = makePlayer({ id: 'w1', traits: ['lone_wolf_trait'] });
      const villagerPlayer = makePlayer({ id: 'v1', traits: [] });
      const context: ActionContext = { round: 1, phase: 'night', players: [wolfPlayer, villagerPlayer] };

      const wolfActions = registry.getAvailableActions(wolfPlayer, context);
      const villagerActions = registry.getAvailableActions(villagerPlayer, context);

      expect(wolfActions.length).toBe(1);
      expect(wolfActions[0].type).toBe('lone_kill');
      expect(villagerActions.length).toBe(0);
    });

    it('同时收集 action 和 trait 的行动', () => {
      const itemActions: ActionDefinition[] = [
        { type: 'check', label: '查验', description: '查验', requiresTarget: true },
      ];
      const traitActions: ActionDefinition[] = [
        { type: 'lone_kill', label: '独立杀戮', description: '杀', requiresTarget: true },
      ];

      registry.register(makeActionProvider('crystal_ball', itemActions));
      registry.registerTrait(makeTraitProvider('lone_wolf_trait', traitActions, ['lone_wolf_trait']));

      const wolfPlayer = makePlayer({ traits: ['lone_wolf_trait'] });
      const context: ActionContext = { round: 1, phase: 'night', players: [wolfPlayer] };
      const available = registry.getAvailableActions(wolfPlayer, context);

      expect(available.length).toBe(2);
    });
  });

  describe('evaluateAll 评估', () => {
    it('从有 evaluate 的 provider 收集候选', () => {
      const candidates: DecisionCandidate[] = [
        { action: 'check', target: 'p2', score: 100, confidence: 0.8, reason: '查验怀疑对象' },
      ];
      registry.register(makeEvaluatingProvider('crystal_ball', candidates));

      const player = makePlayer();
      const context: DecisionContext = {
        round: 1, phase: 'night', players: [player],
        belief: {} as any, self: player, allPlayers: [player],
      };

      const result = registry.evaluateAll(context);
      expect(result.length).toBe(1);
      expect(result[0].action).toBe('check');
    });

    it('从多个 provider 收集候选', () => {
      const candidates1: DecisionCandidate[] = [
        { action: 'check', target: 'p2', score: 100, confidence: 0.8, reason: 'test1' },
      ];
      const candidates2: DecisionCandidate[] = [
        { action: 'kill', target: 'p3', score: 90, confidence: 0.7, reason: 'test2' },
      ];

      registry.register(makeEvaluatingProvider('provider1', candidates1));
      registry.register(makeEvaluatingProvider('provider2', candidates2));

      const player = makePlayer();
      const context: DecisionContext = {
        round: 1, phase: 'night', players: [player],
        belief: {} as any, self: player, allPlayers: [player],
      };

      const result = registry.evaluateAll(context);
      expect(result.length).toBe(2);
    });

    it('trait provider 为拥有特质的玩家评估', () => {
      const traitCandidates: DecisionCandidate[] = [
        { action: 'lone_kill', target: 'p2', score: 80, confidence: 0.6, reason: '孤狼独立决策' },
      ];
      registry.registerTrait(makeEvaluatingTraitProvider('lone_wolf_trait', ['lone_wolf_trait'], traitCandidates));

      const wolf = makePlayer({ id: 'w1', traits: ['lone_wolf_trait'] });
      const villager = makePlayer({ id: 'v1', traits: [] });
      const context: DecisionContext = {
        round: 1, phase: 'night', players: [wolf, villager],
        belief: {} as any, self: wolf, allPlayers: [wolf, villager],
      };

      const wolfResult = registry.evaluateAll(context);
      expect(wolfResult.length).toBe(1);
      expect(wolfResult[0].action).toBe('lone_kill');

      // 村民不应收到 trait 候选
      const villagerContext = { ...context, self: villager };
      const villagerResult = registry.evaluateAll(villagerContext);
      expect(villagerResult.length).toBe(0);
    });

    it('无 evaluate 方法的 provider 不产生候选', () => {
      registry.register(makeActionProvider('basic_provider', [
        { type: 'test', label: 'Test', description: 'test', requiresTarget: false },
      ]));

      const player = makePlayer();
      const context: DecisionContext = {
        round: 1, phase: 'night', players: [player],
        belief: {} as any, self: player, allPlayers: [player],
      };

      const result = registry.evaluateAll(context);
      expect(result.length).toBe(0);
    });
  });
});
