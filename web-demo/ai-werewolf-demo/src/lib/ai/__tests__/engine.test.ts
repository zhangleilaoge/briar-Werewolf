import { describe, it, expect } from 'vitest';
import { DecisionEngine, buildStrategies } from '../strategies';
import { BeliefSystem } from '../belief-system';
import { filterByHardConstraints } from '../intention-system';
import type { Player, DecisionCandidate } from '@/types';

// ---------- Helper to create a test player ----------
function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player_${id}`,
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

function makeBelief(player: Player, allPlayers: Player[]): BeliefSystem {
  const belief = new BeliefSystem(player.id, player.name, player.role, player.team, player.attributes, player.alignment);
  belief.initializeRelations(allPlayers);
  return belief;
}

// ---------- DecisionEngine 基本流程 ----------
describe('DecisionEngine', () => {
  describe('decide() 基本流程', () => {
    it('传入候选行动后返回决策结果', () => {
      const allPlayers = [
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ];
      const self = allPlayers[0];
      const belief = makeBelief(self, allPlayers);

      const engine = new DecisionEngine();
      buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

      const decision = engine.decide(
        belief,
        self,
        'day',
        [{ type: 'silence' }, { type: 'observe' }, { type: 'suspect' }],
        allPlayers,
      );

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();
      expect(decision.stage).toBeDefined();
      expect(typeof decision.confidence).toBe('number');
      expect(decision.process).toBeDefined();
    });

    it('决策包含 process 候选列表', () => {
      const allPlayers = [
        makePlayer('p1'),
        makePlayer('p2'),
        makePlayer('p3'),
      ];
      const self = allPlayers[0];
      const belief = makeBelief(self, allPlayers);

      const engine = new DecisionEngine();
      buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

      const decision = engine.decide(
        belief,
        self,
        'day',
        [{ type: 'silence' }, { type: 'observe' }],
        allPlayers,
      );

      expect(decision.process).toBeDefined();
      expect(decision.process!.candidates).toBeDefined();
      expect(decision.process!.shortlist).toContain('【可选行动】');
      expect(decision.process!.shortlist).toContain('【最终选择】');
    });
  });

  // ---------- 硬约束过滤 ----------
  describe('硬约束过滤', () => {
    it('WolfNoAttackTeammateConstraint 拦截狼人攻击队友的候选', () => {
      const allPlayers = [
        makePlayer('w1', { team: 'werewolf', role: 'werewolf' }),
        makePlayer('w2', { team: 'werewolf', role: 'werewolf' }),
        makePlayer('v1'),
        makePlayer('v2'),
      ];
      const wolf = allPlayers[0];
      const belief = makeBelief(wolf, allPlayers);

      const candidates: DecisionCandidate[] = [
        { action: 'call_vote', target: 'w2', score: 100, confidence: 0.8, reason: 'test' },
        { action: 'suspect', target: 'v1', score: 80, confidence: 0.7, reason: 'test' },
        { action: 'vote', target: 'w2', score: 90, confidence: 0.6, reason: 'test' },
      ];

      const context = {
        belief,
        self: wolf,
        phase: 'day',
        allPlayers,
        publicActions: [],
        voteRound: 1,
        voteCandidates: [],
      };

      const { allowed, blocked } = filterByHardConstraints(candidates, context);

      // 应拦截 2 个攻击队友的候选（call_vote→w2, vote→w2）
      expect(blocked.length).toBe(2);
      // 应允许 1 个合法候选
      expect(allowed.length).toBe(1);
      expect(allowed[0].target).toBe('v1');

      // 拦截的候选目标都是队友
      for (const b of blocked) {
        expect(b.candidate.target).toBe('w2');
        expect(b.reason).toContain('wolf_no_attack_teammate');
      }
    });

    it('非狼人不触发 WolfNoAttackTeammateConstraint', () => {
      const allPlayers = [
        makePlayer('p1'),
        makePlayer('p2'),
      ];
      const villager = allPlayers[0];
      const belief = makeBelief(villager, allPlayers);

      const candidates: DecisionCandidate[] = [
        { action: 'call_vote', target: 'p2', score: 100, confidence: 0.8, reason: 'test' },
      ];

      const context = {
        belief,
        self: villager,
        phase: 'day',
        allPlayers,
        publicActions: [],
        voteRound: 1,
        voteCandidates: [],
      };

      const { allowed, blocked } = filterByHardConstraints(candidates, context);
      expect(blocked.length).toBe(0);
      expect(allowed.length).toBe(1);
    });

    it('狼人决策引擎不会选择攻击队友的行动', () => {
      const allPlayers = [
        makePlayer('w1', { team: 'werewolf', role: 'werewolf' }),
        makePlayer('w2', { team: 'werewolf', role: 'werewolf' }),
        makePlayer('v1'),
        makePlayer('v2'),
      ];
      const wolf = allPlayers[0];
      const belief = makeBelief(wolf, allPlayers);

      const engine = new DecisionEngine();
      buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

      // 多次运行以排除随机性
      for (let i = 0; i < 10; i++) {
        const decision = engine.decide(
          belief,
          wolf,
          'day',
          [{ type: 'call_vote' }, { type: 'accuse' }, { type: 'suspect' }, { type: 'silence' }, { type: 'observe' }],
          allPlayers,
        );
        if (decision.target) {
          expect(decision.target).not.toBe('w2');
        }
      }
    });
  });

  // ---------- 空候选处理 ----------
  describe('空候选处理', () => {
    it('无策略匹配且无候选时返回默认决策', () => {
      const allPlayers = [
        makePlayer('p1'),
        makePlayer('p2'),
      ];
      const self = allPlayers[0];
      const belief = makeBelief(self, allPlayers);

      const engine = new DecisionEngine();
      // 不注册任何策略

      const decision = engine.decide(
        belief,
        self,
        'day',
        [], // 空行动列表
        allPlayers,
      );

      expect(decision).toBeDefined();
      expect(decision.action).toBe('vote');
      expect(decision.stage).toBe('default');
      expect(decision.confidence).toBe(0.3);
    });

    it('空候选返回随机目标（或 null）', () => {
      const allPlayers = [
        makePlayer('p1'),
        makePlayer('p2'),
      ];
      const self = allPlayers[0];
      const belief = makeBelief(self, allPlayers);

      const engine = new DecisionEngine();

      const decision = engine.decide(
        belief,
        self,
        'day',
        [],
        allPlayers,
      );

      // 默认决策应选择一个存活的其他玩家
      if (decision.target) {
        expect(decision.target).not.toBe('p1');
        expect(allPlayers.some((p) => p.id === decision.target && p.alive)).toBe(true);
      }
    });
  });
});
