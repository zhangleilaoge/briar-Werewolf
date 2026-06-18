import { describe, it, expect } from 'vitest';
import { AIAgent } from '../ai-agent';
import type { Player, DecisionResult } from '@/types';
import { DecisionEngine, buildStrategies } from '../strategies';
import { BeliefSystem } from '../belief-system';
import { filterByHardConstraints, generateDesireProfile, isBusMode } from '../intention-system';

function makePlayer(id: string, role: 'werewolf' | 'villager' | 'prophet', team: 'werewolf' | 'villager', overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player_${id}`,
    role,
    team,
    alive: true,
    items: [],
    attributes: { affinity: 5, logic: 5, leadership: 5, deception: 5, stealth: 5, insight: 5 },
    alignment: { law: 'neutral_law', good: role === 'werewolf' ? 'evil' : 'good' },
    traits: [],
    stress: 0,
    relations: {},
    ...overrides,
  };
}

// ========== 硬约束系统测试 ==========

describe('Intention System - Hard Constraints', () => {
  const allPlayers = [
    makePlayer('w1', 'werewolf', 'werewolf'),
    makePlayer('w2', 'werewolf', 'werewolf'),
    makePlayer('v1', 'villager', 'villager'),
    makePlayer('v2', 'villager', 'villager'),
    makePlayer('p1', 'prophet', 'villager'),
  ];

  describe('WolfNoAttackTeammateConstraint', () => {
    it('拦截狼人号召投票给队友的候选', () => {
      const wolf1 = allPlayers[0];
      const wolf2 = allPlayers[1];
      const engine = new DecisionEngine();
      buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

      const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
      belief.initializeRelations(allPlayers);

      // 模拟狼人1知道狼人2是队友（狼人概率=1.0）
      belief.updateInferences(allPlayers, wolf1, []);
      expect(belief.getWerewolfProbability(wolf2.id)).toBe(1.0);

      // 白天行动（day phase）
      const decision = engine.decide(
        belief, wolf1, 'day',
        [{ type: 'call_vote' }, { type: 'accuse' }, { type: 'suspect' }, { type: 'speak' }],
        allPlayers, [], [], 0, 5
      );

      // 结果：不应该号召投票给队友
      expect(decision.target).not.toBe(wolf2.id);
      // 决策日志中显示意图状态
      expect(decision.process?.shortlist).toContain('[意图状态]');
    });

    it('拦截狼人投票给队友的候选', () => {
      const wolf1 = allPlayers[0];
      const wolf2 = allPlayers[1];
      const engine = new DecisionEngine();
      buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

      const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
      belief.initializeRelations(allPlayers);
      belief.updateInferences(allPlayers, wolf1, []);

      const decision = engine.decide(
        belief, wolf1, 'vote',
        [{ type: 'vote' }],
        allPlayers, [], [], 0, 5, 1
      );

      // 投票结果不应该投给队友
      expect(decision.target).not.toBe(wolf2.id);
    });

    it('非狼人不受此约束（直接过滤层验证）', () => {
      const villager = allPlayers[2];
      const wolf1 = allPlayers[0];
      const engine = new DecisionEngine();
      buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

      const belief = new BeliefSystem(villager.id, villager.name, villager.role, villager.team, villager.attributes, villager.alignment);
      belief.initializeRelations(allPlayers);
      // 村民知道 w1 是狼人（通过查验）
      belief.recordCheck('w1', 'werewolf');
      belief.updateInferences(allPlayers, villager, []);

      // 直接验证 filterByHardConstraints 对非狼人不拦截投票给狼人
      const { allowed } = filterByHardConstraints(
        [{ action: 'vote', target: 'w1', score: 100, confidence: 1, reason: 'test', strategy: 'test', rule: 'test' }],
        { belief, self: villager, phase: 'vote', allPlayers }
      );
      expect(allowed.length).toBe(1); // 非狼人不受 wolf_no_attack_teammate 约束
      expect(allowed[0].target).toBe('w1');

      // 狼人则会拦截投票给队友
      const wolfBelief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
      wolfBelief.initializeRelations(allPlayers);
      wolfBelief.updateInferences(allPlayers, wolf1, []);
      const { allowed: wolfAllowed } = filterByHardConstraints(
        [{ action: 'vote', target: 'w2', score: 100, confidence: 1, reason: 'test', strategy: 'test', rule: 'test' }],
        { belief: wolfBelief, self: wolf1, phase: 'vote', allPlayers }
      );
      expect(wolfAllowed.length).toBe(0); // 狼人投票给队友被拦截
    });
  });

  describe('切割模式 (Bus Mode)', () => {
    it('正常模式不切割队友', () => {
      const wolf1 = allPlayers[0];
      const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
      belief.initializeRelations(allPlayers);
      belief.updateInferences(allPlayers, wolf1, []);

      const ctx = { belief, self: wolf1, phase: 'day', allPlayers };
      expect(isBusMode(ctx)).toBe(false);
    });
  });

  describe('DesireProfile', () => {
    it('狼人正常模式为 maintain_cover', () => {
      const wolf1 = allPlayers[0];
      const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
      belief.initializeRelations(allPlayers);
      const desire = generateDesireProfile(wolf1, belief, allPlayers);
      expect(desire.personalObjective).toBe('maintain_cover');
      expect(desire.mode).toBe('normal');
    });

    it('狼人劣势+高暴露为 desperate', () => {
      const wolf1 = makePlayer('w1', 'werewolf', 'werewolf', { stress: 8 });
      const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
      belief.initializeRelations(allPlayers);
      // 高暴露
      belief.l2TheoryOfMind.othersBeliefs = {
        v1: { w1: 0.9 },
        v2: { w1: 0.85 },
      };
      const desire = generateDesireProfile(wolf1, belief, allPlayers);
      expect(desire.mode).toBe('desperate');
      expect(desire.personalObjective).toBe('survive');
    });
  });
});

// ========== AIAgent 集成测试 ==========

describe('AIAgent - Intention System Integration', () => {
  const allPlayers = [
    makePlayer('w1', 'werewolf', 'werewolf'),
    makePlayer('w2', 'werewolf', 'werewolf'),
    makePlayer('v1', 'villager', 'villager'),
    makePlayer('v2', 'villager', 'villager'),
    makePlayer('p1', 'prophet', 'villager'),
  ];

  it('狼人白天不会号召投票给队友', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    const decision = agent.dayAction(allPlayers, [], 0, 5);
    expect(decision).not.toBeNull();
    expect(decision!.target).not.toBe('w2'); // 不能号召投票给队友
  });

  it('狼人投票阶段不会投队友', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    const decision = agent.vote(allPlayers, []);
    expect(decision).not.toBeNull();
    expect(decision!.target).not.toBe('w2'); // 不能投票给队友
  });

  it('狼人1号召投票给村民是允许的', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    // 第一轮白天，狼人可能会选择 speak 或 observe（默认行为）
    // 或如果有公开行动，可能怀疑/攻击村民
    const decision = agent.dayAction(allPlayers, [], 0, 5);
    expect(decision).not.toBeNull();
    // 如果目标不是 null，则不应是队友
    if (decision!.target) {
      expect(decision!.target).not.toBe('w2');
    }
  });
});
