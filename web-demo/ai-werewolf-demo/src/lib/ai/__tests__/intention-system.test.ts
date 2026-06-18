import { describe, it, expect } from 'vitest';
import { AIAgent } from '../ai-agent';
import { BeliefSystem } from '../belief-system';
import { DecisionEngine, buildStrategies } from '../strategies';
import {
  IntentionManager,
  DesireEngine,
  PlanLibrary,
  IntentionType,
  IntentionSource,
  CommitmentLevel,
  type Intention,
} from '../intention-system';
import type { Player } from '@/types';

function makePlayer(id: string, role: 'werewolf' | 'villager' | 'prophet', team: 'werewolf' | 'villager', overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player_${id}`,
    role,
    team,
    alive: true,
    items: [],
    attributes: { affinity: 10, logic: 10, leadership: 10, deception: 10, stealth: 10, insight: 10 },
    alignment: { law: 'neutral_law', good: role === 'werewolf' ? 'evil' : 'good' },
    traits: [],
    stress: 0,
    relations: {},
    ...overrides,
  };
}

// ========== 核心意图系统测试 ==========

describe('IntentionManager - Core Lifecycle', () => {
  const allPlayers = [
    makePlayer('w1', 'werewolf', 'werewolf'),
    makePlayer('w2', 'werewolf', 'werewolf'),
    makePlayer('v1', 'villager', 'villager'),
    makePlayer('v2', 'villager', 'villager'),
    makePlayer('p1', 'prophet', 'villager'),
  ];

  it('狼人更新后生成攻击村民意图', () => {
    const wolf1 = allPlayers[0];
    const manager = new IntentionManager();
    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    belief.updateInferences(allPlayers, wolf1, []);

    manager.update(wolf1, belief, allPlayers, 1);

    const intentions = manager.getActiveIntentions();
    expect(intentions.length).toBeGreaterThan(0);
    // 狼人应该有攻击村民的意图（TEAM_DUTY）
    const attackIntentions = intentions.filter((i) => i.type === IntentionType.ATTACK);
    expect(attackIntentions.length).toBeGreaterThan(0);
    for (const attack of attackIntentions) {
      expect(attack.source).toBe(IntentionSource.TEAM_DUTY);
      expect(attack.targetId).not.toBe('w1'); // 不能攻击自己
      expect(attack.targetId).not.toBe('w2'); // 不能攻击队友
    }
  });

  it('预言家查验到狼人后生成REVEAL意图（STRONG承诺）', () => {
    const prophet = allPlayers[4];
    const manager = new IntentionManager();
    const belief = new BeliefSystem(prophet.id, prophet.name, prophet.role, prophet.team, prophet.attributes, prophet.alignment);
    belief.initializeRelations(allPlayers);
    belief.recordCheck('w1', 'werewolf');
    belief.updateInferences(allPlayers, prophet, []);

    manager.update(prophet, belief, allPlayers, 1);

    const topIntention = manager.getTopIntention('day');
    expect(topIntention).not.toBeNull();
    expect(topIntention!.type).toBe(IntentionType.REVEAL);
    expect(topIntention!.source).toBe(IntentionSource.ROLE_DUTY);
    expect(topIntention!.commitment).toBe(CommitmentLevel.STRONG);
    expect(topIntention!.targetId).toBe('w1');
    // 计划应包含 claim_identity → call_vote → vote
    expect(topIntention!.plan.length).toBeGreaterThan(0);
    expect(topIntention!.plan[0].action).toBe('claim_identity');
  });

  it('意图生命周期：执行步骤后推进计划', () => {
    const prophet = allPlayers[4];
    const manager = new IntentionManager();
    const belief = new BeliefSystem(prophet.id, prophet.name, prophet.role, prophet.team, prophet.attributes, prophet.alignment);
    belief.initializeRelations(allPlayers);
    belief.recordCheck('w1', 'werewolf');
    belief.updateInferences(allPlayers, prophet, []);

    manager.update(prophet, belief, allPlayers, 1);
    const intention = manager.getTopIntention('day')!;
    expect(intention.currentStepIndex).toBe(0);
    expect(intention.plan[0].action).toBe('claim_identity');

    // 模拟执行第一步
    manager.advanceStep(intention.id, 'day', 'claim_identity');
    const updated = manager.getTopIntention('day')!;
    expect(updated.currentStepIndex).toBe(1);
    expect(updated.plan[1].action).toBe('call_vote');
  });

  it('多回合意图持久性：非ROLE_DUTY意图有寿命限制', () => {
    const wolf1 = allPlayers[0];
    const manager = new IntentionManager();
    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    belief.updateInferences(allPlayers, wolf1, []);

    // 第1回合
    manager.update(wolf1, belief, allPlayers, 1);
    const intentionsR1 = manager.getActiveIntentions().length;
    expect(intentionsR1).toBeGreaterThan(0);

    // 第2回合
    manager.update(wolf1, belief, allPlayers, 2);
    const intentionsR2 = manager.getActiveIntentions().length;
    // 有些意图（lifetime=3）仍然存活，有些可能合并或过期
    expect(intentionsR2).toBeGreaterThan(0);
  });

  it('意图冲突：攻击队友 vs 保护队友 → 攻击被拦截/消解', () => {
    const wolf1 = allPlayers[0];
    const manager = new IntentionManager();
    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    belief.updateInferences(allPlayers, wolf1, []);

    // 先制造一个攻击队友的意图（模拟旧系统可能出现的错误）
    // 通过手动创建
    const fakeAttackIntention: Intention = {
      id: 'fake_attack_w2',
      type: IntentionType.ATTACK,
      targetId: 'w2', // 队友
      priority: 500,
      commitment: CommitmentLevel.WEAK,
      source: IntentionSource.OPPORTUNITY,
      plan: PlanLibrary.getPlan(IntentionType.ATTACK, 'w2', wolf1, allPlayers),
      currentStepIndex: 0,
      lifetime: 3,
      createdRound: 1,
      context: {},
      active: true,
      executionHistory: [],
    };
    manager.intentions.push(fakeAttackIntention);

    // 然后触发正常更新（生成TEAM_DUTY攻击村民意图）
    manager.update(wolf1, belief, allPlayers, 1);

    // 检查攻击队友的意图是否被冲突消解（因为TEAM_DUTY优先级更高）
    // 或者如果仍然存在，它不应该是最高优先级
    const topIntention = manager.getTopIntention('day');
    if (topIntention && topIntention.type === IntentionType.ATTACK) {
      expect(topIntention.targetId).not.toBe('w2'); // 最高优先级不应攻击队友
    }
  });

  it('切割模式：生成CUT_LOSS意图（队友暴露）', () => {
    const wolf1 = allPlayers[0];
    const manager = new IntentionManager();
    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    // 模拟 w2 极度暴露
    belief.l2TheoryOfMind.othersBeliefs = {
      v1: { w2: 0.9 },
      v2: { w2: 0.85 },
      v3: { w2: 0.9 },
    };
    // wolf1 自身安全
    belief.l2TheoryOfMind.othersBeliefs.v1.w1 = 0.2;
    belief.l2TheoryOfMind.othersBeliefs.v2.w1 = 0.3;
    belief.updateInferences(allPlayers, wolf1, []);

    manager.update(wolf1, belief, allPlayers, 1);

    const intentions = manager.getActiveIntentions();
    const cutLoss = intentions.find((i) => i.type === IntentionType.CUT_LOSS);
    // 切割模式应生成（队友暴露+自身安全+狼队劣势）
    expect(cutLoss).toBeDefined();
    if (cutLoss) {
      expect(cutLoss.targetId).toBe('w2');
      expect(cutLoss.source).toBe(IntentionSource.TEAM_DUTY);
    }
  });

  it('意图驱动评分：匹配的候选获得额外分数', () => {
    const wolf1 = allPlayers[0];
    const manager = new IntentionManager();
    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    belief.updateInferences(allPlayers, wolf1, []);

    manager.update(wolf1, belief, allPlayers, 1);

    const engine = new DecisionEngine();
    buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

    const topIntention = manager.getTopIntention('day');
    expect(topIntention).not.toBeNull();

    // 获取决策，检查是否被意图驱动
    const decision = engine.decide(
      belief, wolf1, 'day',
      [{ type: 'suspect' }, { type: 'speak' }, { type: 'observe' }],
      allPlayers, [], [], 0, 5, 1, undefined, undefined, manager
    );

    // 决策日志应包含意图栈信息
    expect(decision.process?.shortlist).toContain('【意图栈】');
    expect(decision.process?.shortlist).toContain('当前意图');
  });
});

// ========== 愿望引擎测试 ==========

describe('DesireEngine', () => {
  const allPlayers = [
    makePlayer('w1', 'werewolf', 'werewolf'),
    makePlayer('w2', 'werewolf', 'werewolf'),
    makePlayer('v1', 'villager', 'villager'),
    makePlayer('v2', 'villager', 'villager'),
    makePlayer('p1', 'prophet', 'villager'),
  ];

  it('预言家愿望包含高优先级REVEAL', () => {
    const engine = new DesireEngine();
    const prophet = allPlayers[4];
    const belief = new BeliefSystem(prophet.id, prophet.name, prophet.role, prophet.team, prophet.attributes, prophet.alignment);
    belief.initializeRelations(allPlayers);
    belief.recordCheck('w1', 'werewolf');
    belief.updateInferences(allPlayers, prophet, []);

    const desires = engine.generateDesires(prophet, belief, allPlayers, 1);
    const reveal = desires.find((d) => d.type === IntentionType.REVEAL);
    expect(reveal).toBeDefined();
    expect(reveal!.strength).toBe(1000);
    expect(reveal!.source).toBe(IntentionSource.ROLE_DUTY);
  });

  it('狼人愿望不包含攻击队友', () => {
    const engine = new DesireEngine();
    const wolf1 = allPlayers[0];
    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    belief.updateInferences(allPlayers, wolf1, []);

    const desires = engine.generateDesires(wolf1, belief, allPlayers, 1);
    const attackDesires = desires.filter((d) => d.type === IntentionType.ATTACK);
    for (const d of attackDesires) {
      const target = allPlayers.find((p) => p.id === d.targetId);
      expect(target?.team).not.toBe('werewolf');
    }
  });

  it('高暴露时生成SURVIVE愿望', () => {
    const engine = new DesireEngine();
    const wolf1 = allPlayers[0];
    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    // 高暴露
    belief.l2TheoryOfMind.othersBeliefs = {
      v1: { w1: 0.9 },
      v2: { w1: 0.85 },
    };

    const desires = engine.generateDesires(wolf1, belief, allPlayers, 1);
    const survive = desires.find((d) => d.type === IntentionType.SURVIVE);
    expect(survive).toBeDefined();
    expect(survive!.strength).toBe(800);
  });
});

// ========== 计划库测试 ==========

describe('PlanLibrary', () => {
  const allPlayers = [
    makePlayer('w1', 'werewolf', 'werewolf'),
    makePlayer('v1', 'villager', 'villager'),
  ];

  it('狼人攻击计划：suspect → call_vote → vote', () => {
    const plan = PlanLibrary.getPlan(IntentionType.ATTACK, 'v1', allPlayers[0], allPlayers);
    expect(plan.length).toBe(3);
    expect(plan[0].action).toBe('suspect');
    expect(plan[1].action).toBe('call_vote');
    expect(plan[2].action).toBe('vote');
  });

  it('预言家揭露计划：claim_identity → call_vote → vote', () => {
    const prophet = makePlayer('p1', 'prophet', 'villager');
    const plan = PlanLibrary.getPlan(IntentionType.REVEAL, 'w1', prophet, allPlayers);
    expect(plan.length).toBe(3);
    expect(plan[0].action).toBe('claim_identity');
    expect(plan[1].action).toBe('call_vote');
    expect(plan[2].action).toBe('vote');
  });

  it('狼人隐藏计划包含伪装行为', () => {
    const plan = PlanLibrary.getPlan(IntentionType.CONCEAL, null, allPlayers[0], allPlayers);
    expect(plan.length).toBeGreaterThan(0);
    const actions = plan.map((p) => p.action);
    expect(actions).toContain('speak');
    expect(actions).toContain('suspect');
  });
});

// ========== 硬约束测试（保留） ==========

describe('Hard Constraints', () => {
  const allPlayers = [
    makePlayer('w1', 'werewolf', 'werewolf'),
    makePlayer('w2', 'werewolf', 'werewolf'),
    makePlayer('v1', 'villager', 'villager'),
    makePlayer('v2', 'villager', 'villager'),
    makePlayer('p1', 'prophet', 'villager'),
  ];

  it('拦截狼人号召投票给队友', () => {
    const wolf1 = allPlayers[0];
    const wolf2 = allPlayers[1];
    const engine = new DecisionEngine();
    buildStrategies().forEach((s) => engine.registerStrategy(s.category, s.strategy));

    const belief = new BeliefSystem(wolf1.id, wolf1.name, wolf1.role, wolf1.team, wolf1.attributes, wolf1.alignment);
    belief.initializeRelations(allPlayers);
    belief.updateInferences(allPlayers, wolf1, []);

    const decision = engine.decide(
      belief, wolf1, 'day',
      [{ type: 'call_vote' }, { type: 'accuse' }, { type: 'suspect' }, { type: 'speak' }],
      allPlayers, [], [], 0, 5
    );

    expect(decision.target).not.toBe(wolf2.id);
  });

  it('狼人投票不投队友', () => {
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

    expect(decision.target).not.toBe(wolf2.id);
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

  it('AIAgent初始化包含意图管理器', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);
    expect(agent.intentionManager).toBeDefined();
    expect(agent.intentionManager).toBeInstanceOf(IntentionManager);
  });

  it('狼人白天行为后意图栈被更新', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    const decision = agent.dayAction(allPlayers, [], 0, 5);
    expect(decision).not.toBeNull();

    // 意图栈应有内容
    const summary = agent.intentionManager.getSummary();
    expect(summary.length).toBeGreaterThan(0);
  });

  it('狼人决策日志包含意图栈信息', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    const decision = agent.dayAction(allPlayers, [], 0, 5);
    expect(decision).not.toBeNull();
    expect(decision!.process?.shortlist).toContain('【意图栈】');
    expect(decision!.process?.shortlist).toContain('当前意图');
  });

  it('预言家决策包含REVEAL意图驱动', () => {
    const prophet = allPlayers[4];
    const agent = new AIAgent(prophet, allPlayers);
    agent.recordCheckResult('w1', 'werewolf');

    const decision = agent.dayAction(allPlayers, [], 0, 5);
    expect(decision).not.toBeNull();
    // 意图应为 REVEAL
    const topIntention = agent.intentionManager.getTopIntention('day');
    expect(topIntention).not.toBeNull();
    expect(topIntention!.type).toBe(IntentionType.REVEAL);
    expect(topIntention!.targetId).toBe('w1');
  });

  it('狼人白天不会号召投票给队友', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    const decision = agent.dayAction(allPlayers, [], 0, 5);
    expect(decision).not.toBeNull();
    expect(decision!.target).not.toBe('w2');
  });

  it('狼人投票阶段不会投队友', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    const decision = agent.vote(allPlayers, []);
    expect(decision).not.toBeNull();
    expect(decision!.target).not.toBe('w2');
  });

  it('多回合后意图栈保持一致性', () => {
    const wolf1 = allPlayers[0];
    const agent = new AIAgent(wolf1, allPlayers);

    // 第1回合
    agent.currentRound = 1;
    const d1 = agent.dayAction(allPlayers, [], 0, 5);
    expect(d1).not.toBeNull();

    // 第2回合
    agent.currentRound = 2;
    const d2 = agent.dayAction(allPlayers, [], 0, 5);
    expect(d2).not.toBeNull();

    // 意图栈应仍有效
    const summary = agent.intentionManager.getSummary();
    expect(summary.length).toBeGreaterThan(0);
  });
});
