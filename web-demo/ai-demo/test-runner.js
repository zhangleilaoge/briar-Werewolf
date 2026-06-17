/**
 * 测试运行器 - 在 Node.js 中验证 AI 逻辑
 */
const { BeliefSystem } = require('../ai-system/belief-system.js');
const { DecisionEngine, ProphetDutyStrategy, WerewolfDutyStrategy, WerewolfKillStrategy, SurvivalStrategy, MaxInfoVoteStrategy, SocialTieBreakerStrategy, ProphetCheckStrategy, BerserkerSuicideStrategy } = require('../ai-system/decision-engine.js');
const { AIAgent } = require('../ai-system/ai-agent.js');

// 在 Node.js 中让 simulation.js 和 ai-agent.js 能访问到全局依赖
global.BeliefSystem = BeliefSystem;
global.DecisionEngine = DecisionEngine;
global.ProphetDutyStrategy = ProphetDutyStrategy;
global.WerewolfDutyStrategy = WerewolfDutyStrategy;
global.WerewolfKillStrategy = WerewolfKillStrategy;
global.SurvivalStrategy = SurvivalStrategy;
global.MaxInfoVoteStrategy = MaxInfoVoteStrategy;
global.SocialTieBreakerStrategy = SocialTieBreakerStrategy;
global.ProphetCheckStrategy = ProphetCheckStrategy;
global.BerserkerSuicideStrategy = BerserkerSuicideStrategy;
global.AIAgent = AIAgent;

const { GameSimulator, createScenario1, createScenario2, createScenario3 } = require('./simulation.js');

function testScenario1() {
  console.log('\n========== 场景1：预言家硬约束 ==========');
  const configs = createScenario1();
  const sim = new GameSimulator(configs);
  
  // 让预言家和狼人B关系好
  const prophet = sim.players.find(p => p.role === 'prophet');
  const wolfB = sim.players.find(p => p.name === '狼人B');
  prophet.belief.updateRelation(wolfB.id, 0.8, 0.5);
  
  // 预言家查验狼人B
  prophet.belief.recordCheck(wolfB.id, 'werewolf');
  
  // 运行一轮，跳过狼刀以确保预言家活到投票阶段
  sim.runRound({ skipNightKill: true });
  
  // 检查预言家的投票
  const prophetVote = prophet.logs.find(l => l.phase === 'vote');
  console.log('预言家决策:', prophetVote?.message);
  console.log('预言家对狼人B的关系值:', prophet.belief.getRelation(wolfB.id));
  
  const votedWolfB = prophetVote?.message.includes(wolfB.id);
  console.log('✅ 验证:', votedWolfB ? '通过 - 硬约束生效，预言家投票给查杀的狼' : '❌ 失败 - 预言家未投票给查杀的狼');
  
  return votedWolfB;
}

function testScenario2() {
  console.log('\n========== 场景2：狼人倒钩 ==========');
  const configs = createScenario2();
  const sim = new GameSimulator(configs);
  
  // 预言家查验狼队友
  const prophet = sim.players.find(p => p.role === 'prophet');
  const wolfTeammate = sim.players.find(p => p.name === '狼队友');
  const hookWolf = sim.players.find(p => p.name === '倒钩狼');
  
  prophet.belief.recordCheck(wolfTeammate.id, 'werewolf');
  
  // 让倒钩狼感知到队友暴露风险高（更新 ToM）
  hookWolf.belief.l2TheoryOfMind.othersBeliefs = {
    'p1': { 'p2': 0.9, 'p3': 0.3 },  // p1认为p2是狼
    'p4': { 'p2': 0.8, 'p3': 0.2 },  // p4认为p2是狼
    'p5': { 'p2': 0.7, 'p3': 0.2 }   // p5认为p2是狼
  };
  
  sim.runRound();
  
  const hookVote = hookWolf.logs.find(l => l.phase === 'vote');
  console.log('倒钩狼决策:', hookVote?.message);
  
  const votedTeammate = hookVote?.message.includes(wolfTeammate.id);
  console.log('✅ 验证:', votedTeammate ? '通过 - 狼人倒钩投队友' : '信息 - 狼人选择保护队友');
  
  return votedTeammate;
}

function testScenario3() {
  console.log('\n========== 场景3：村民关系投票 ==========');
  const configs = createScenario3();
  const sim = new GameSimulator(configs);
  
  const villager = sim.players.find(p => p.name === '村民甲');
  const wolfA = sim.players.find(p => p.name === '狼人A');
  const wolfB = sim.players.find(p => p.name === '狼人B');
  
  // 设置关系
  villager.belief.updateRelation(wolfA.id, -0.6, -0.3);
  villager.belief.updateRelation(wolfB.id, 0.4, 0.2);
  
  sim.runRound({ skipNightKill: true });
  
  const villagerVote = villager.logs.find(l => l.phase === 'vote');
  console.log('村民甲决策:', villagerVote?.message);
  console.log('村民甲对狼人A的关系:', villager.belief.getRelation(wolfA.id));
  console.log('村民甲对狼人B的关系:', villager.belief.getRelation(wolfB.id));
  
  const votedWolfA = villagerVote?.message.includes(wolfA.id);
  console.log('✅ 验证:', votedWolfA ? '通过 - 村民优先投关系差的狼人A' : '信息 - 村民投给了其他人');
  
  return votedWolfA;
}

// 运行所有测试
const results = {
  scenario1: testScenario1(),
  scenario2: testScenario2(),
  scenario3: testScenario3()
};

console.log('\n========== 测试结果汇总 ==========');
console.log('场景1 (预言家硬约束):', results.scenario1 ? '✅ 通过' : '❌ 失败');
console.log('场景2 (狼人倒钩):', results.scenario2 ? '✅ 通过' : '⚠️ 未触发');
console.log('场景3 (村民关系投票):', results.scenario3 ? '✅ 通过' : '⚠️ 未触发');
