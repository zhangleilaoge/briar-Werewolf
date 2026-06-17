/**
 * AI Agent 封装
 * 
 * 将 BeliefSystem + DecisionEngine 组合成一个完整的 AI 玩家
 * 提供统一的接口供游戏逻辑调用
 */

class AIAgent {
  constructor(id, name, role, team, config = {}) {
    this.id = id;
    this.name = name;
    this.role = role;  // 'prophet' | 'werewolf' | 'villager' | 'thief' | 'coroner' | 'lone_wolf' | 'berserker'
    this.team = team;  // 'werewolf' | 'villager'
    this.alive = true;
    this.items = [];
    
    // 初始化信念系统
    this.belief = new BeliefSystem(id, name);
    this.belief.setMyRole(role, team);
    
    // 初始化决策引擎
    this.engine = new DecisionEngine(config);
    this._registerDefaultStrategies();
    
    // 日志
    this.logs = [];
  }
  
  _registerDefaultStrategies() {
    // 注册所有内置策略
    this.engine.registerStrategy('duty', ProphetDutyStrategy);
    this.engine.registerStrategy('duty', WerewolfDutyStrategy);
    this.engine.registerStrategy('duty', BerserkerSuicideStrategy);
    
    this.engine.registerStrategy('survival', SurvivalStrategy);
    
    this.engine.registerStrategy('information', WerewolfKillStrategy);
    this.engine.registerStrategy('information', MaxInfoVoteStrategy);
    this.engine.registerStrategy('information', ProphetCheckStrategy);
    
    this.engine.registerStrategy('social', SocialTieBreakerStrategy);
  }
  
  // ==================== 游戏事件接口 ====================
  
  /**
   * 初始化关系（游戏开始时调用）
   */
  initializeRelations(allPlayers) {
    this.belief._initializeRelations(allPlayers);
    
    // 如果我是狼，记录队友（简化为 L0 事实）
    if (this.team === 'werewolf') {
      allPlayers.forEach(p => {
        if (p.team === 'werewolf' && p.id !== this.id) {
          // 在 L1 中直接标记队友为狼（但我不会暴露他们）
          this.belief.l1Inferences.roleBeliefs[p.id] = { werewolf: 1.0, villager: 0 };
        }
      });
    }
    
    this._log('init', `初始化完成，职业：${this.role}，阵营：${this.team}`);
  }
  
  /**
   * 夜晚行动
   */
  nightAction(allPlayers, phase) {
    if (!this.alive) return null;
    
    const availableActions = this._getAvailableNightActions();
    
    this.belief.updateInferences(allPlayers);
    
    const decision = this.engine.decide(this.belief, 'night', availableActions, allPlayers);
    
    this._log('night', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    
    return decision;
  }
  
  /**
   * 白天行动（投票）
   */
  dayAction(allPlayers, phase, publicActions) {
    if (!this.alive) return null;
    
    // 更新 ToM
    this.belief.updateTheoryOfMind(allPlayers, publicActions || []);
    
    const availableActions = this._getAvailableDayActions();
    
    this.belief.updateInferences(allPlayers);
    
    const decision = this.engine.decide(this.belief, 'day', availableActions, allPlayers);
    
    this._log('day', `决策：${decision.action} → ${decision.target || '无目标'}，原因：${decision.reason}`);
    
    return decision;
  }
  
  /**
   * 投票阶段
   */
  vote(allPlayers, phase, publicActions) {
    if (!this.alive) return null;
    
    this.belief.updateTheoryOfMind(allPlayers, publicActions || []);
    
    const availableActions = [{ type: 'vote' }];
    
    this.belief.updateInferences(allPlayers);
    
    const decision = this.engine.decide(this.belief, 'vote', availableActions, allPlayers);
    
    this._log('vote', `投票：${decision.target || '无目标'}，原因：${decision.reason}`);
    
    return decision;
  }
  
  /**
   * 接收游戏事件（死亡、查验结果等）
   */
  onEvent(event) {
    switch (event.type) {
      case 'check_result':
        this.belief.recordCheck(event.targetId, event.result);
        this._log('event', `收到查验结果：${event.targetId} 是 ${event.result}`);
        break;
        
      case 'death':
        this.belief.recordDeath(event.playerId);
        if (event.playerId === this.id) {
          this.alive = false;
        }
        this._log('event', `玩家 ${event.playerId} 死亡`);
        break;
        
      case 'public_claim':
        this.belief.recordPublicClaim(event.playerId, event.claimType, event.content);
        this._log('event', `玩家 ${event.playerId} 声称：${event.claimType}`);
        break;
        
      case 'vote_result':
        // 记录投票行为，用于后续 ToM 推理
        break;
        
      case 'relation_update':
        this.belief.updateRelation(event.targetId, event.friendlyDelta, event.trustDelta);
        break;
    }
  }
  
  /**
   * 获取当前决策的详细说明（用于调试/展示）
   */
  getDecisionExplanation() {
    return {
      player: this.name,
      role: this.role,
      alive: this.alive,
      l0: this.belief.l0Facts,
      l1: this.belief.l1Inferences,
      l2: this.belief.l2TheoryOfMind,
      l3: this.belief.l3Social,
      logs: this.logs
    };
  }
  
  // ==================== 内部辅助 ====================
  
  _getAvailableNightActions() {
    const actions = [];
    
    switch (this.role) {
      case 'prophet':
        if (this.items.includes('crystal_ball')) {
          actions.push({ type: 'check' });
        }
        break;
      case 'werewolf':
      case 'lone_wolf':
      case 'berserker':
        if (this.items.includes('claws')) {
          actions.push({ type: 'kill' });
        }
        break;
      case 'thief':
        if (this.items.includes('thief_gloves')) {
          actions.push({ type: 'steal' });
        }
        break;
      case 'coroner':
        if (this.items.includes('coroner_tools')) {
          actions.push({ type: 'inspect' });
        }
        break;
    }
    
    return actions;
  }
  
  _getAvailableDayActions() {
    const actions = [{ type: 'vote' }];
    
    if (this.role === 'berserker' && this.items.includes('double_sword')) {
      actions.push({ type: 'berserker_kill' });
    }
    
    return actions;
  }
  
  _log(phase, message) {
    this.logs.push({
      round: this.currentRound || 0,
      phase,
      message,
      timestamp: Date.now()
    });
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIAgent };
}
