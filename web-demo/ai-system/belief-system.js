/**
 * 信念系统 (Belief System)
 * 
 * 四层分层设计：
 * L0 - 原始事实层 (不可变、不可被关系覆盖)
 * L1 - 逻辑推导层 (概率推理)
 * L2 - 元认知层 (ToM: 其他玩家信念建模)
 * L3 - 社交情感层 (关系、压力、偏好)
 */

class BeliefSystem {
  constructor(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;
    
    // L0: 原始事实层 - 不可被覆盖
    this.l0Facts = {
      myRole: null,           // 我的职业
      myAlignment: null,      // 我的阵营
      myItems: [],            // 我的道具
      checks: {},            // 查验结果: { targetId: 'werewolf'|'villager' }
      deaths: [],             // 观察到的死亡 [playerId, ...]
      publicClaims: [],       // 公开声称: [{playerId, claim, content}]
      thefts: [],             // 偷取记录
      inspections: []         // 尸检记录
    };
    
    // L1: 逻辑推导层 - 概率推理
    this.l1Inferences = {
      roleBeliefs: {},        // 对每个玩家角色的信念概率: { playerId: { werewolf: 0.6, villager: 0.4, ... } }
      itemBeliefs: {},        // 对每个玩家道具的推测
      trustScore: {}          // 对每个玩家陈述可信度: 0~1
    };
    
    // L2: 元认知层 (ToM) - 对其他玩家心智的建模
    this.l2TheoryOfMind = {
      // playerId -> { targetId -> suspicionOfWerewolf }
      othersBeliefs: {},      // 我认为"其他玩家X"认为"Y"是狼的概率
      othersTrustMe: {},      // 我认为"其他玩家X"信任我的概率
      othersKnowMyRole: {}    // 我认为"其他玩家X"知道我是神的概率
    };
    
    // L3: 社交情感层 - 只影响表达方式，不决定核心目标
    this.l3Social = {
      relations: {},          // playerId -> { friendly: -1~1, trust: -1~1 }
      pressure: 0,           // 0~1 压力值
      emotionalState: 'neutral'  // neutral, anxious, confident, angry
    };
    
    // 初始化所有玩家的空关系
    this._initializeRelations = (allPlayers) => {
      allPlayers.forEach(p => {
        if (p.id !== this.playerId) {
          this.l3Social.relations[p.id] = { friendly: 0, trust: 0 };
          this.l1Inferences.roleBeliefs[p.id] = { werewolf: 0.5, villager: 0.5 };
          this.l1Inferences.trustScore[p.id] = 0.5;
        }
      });
    };
  }
  
  // ==================== L0 操作 ====================
  
  setMyRole(role, alignment) {
    this.l0Facts.myRole = role;
    this.l0Facts.myAlignment = alignment;
  }
  
  recordCheck(targetId, result) {
    this.l0Facts.checks[targetId] = result;
  }
  
  recordDeath(playerId) {
    if (!this.l0Facts.deaths.includes(playerId)) {
      this.l0Facts.deaths.push(playerId);
    }
  }
  
  recordPublicClaim(playerId, claimType, content) {
    this.l0Facts.publicClaims.push({
      playerId,
      claim: claimType,
      content,
      round: this.currentRound || 0
    });
  }
  
  // ==================== L1 更新 ====================
  
  /**
   * 基于 L0 事实更新 L1 推理
   * 关键规则：查验结果是 100% 事实，不会被关系覆盖
   */
  updateInferences(allPlayers) {
    // 基于查验结果直接设置信念
    Object.entries(this.l0Facts.checks).forEach(([targetId, result]) => {
      if (result === 'werewolf') {
        this.l1Inferences.roleBeliefs[targetId] = { werewolf: 1.0, villager: 0 };
      } else if (result === 'villager') {
        this.l1Inferences.roleBeliefs[targetId] = { werewolf: 0, villager: 1.0 };
      }
    });
    
    // 基于死亡信息推理
    this.l0Facts.deaths.forEach(deadId => {
      // 如果我是狼，知道队友的刀，不更新
      // 如果我是村民，死亡者是被刀的对象，可以排除一些信息
      // 这里做简单处理：死亡者如果是被刀，不太可能是狼（除非狼自刀）
      if (this.l1Inferences.roleBeliefs[deadId] && this.l1Inferences.roleBeliefs[deadId].werewolf > 0.5) {
        // 被刀的目标被怀疑是狼的概率应该降低
        this.l1Inferences.roleBeliefs[deadId].werewolf *= 0.7;
        this.l1Inferences.roleBeliefs[deadId].villager = 1 - this.l1Inferences.roleBeliefs[deadId].werewolf;
      }
    });
    
    // 基于公开声称的推理（贝叶斯简单近似）
    this.l0Facts.publicClaims.forEach(claim => {
      if (claim.claim === 'prophet_check') {
        // 有人声称查验了某人
        const { target, result } = claim.content;
        // 更新对该声称者的可信度
        this._evaluateClaim(claim.playerId, claim, allPlayers);
      }
    });
    
    // 确保所有玩家都有 L1 信念
    allPlayers.forEach(p => {
      if (p.id !== this.playerId && !this.l1Inferences.roleBeliefs[p.id]) {
        this.l1Inferences.roleBeliefs[p.id] = { werewolf: 0.5, villager: 0.5 };
      }
    });
  }
  
  _evaluateClaim(claimerId, claim, allPlayers) {
    // 如果claimer与我的查验矛盾，降低其可信度
    const { target, result } = claim.content;
    
    if (this.l0Facts.checks[target] !== undefined) {
      const myResult = this.l0Facts.checks[target];
      if (myResult !== result) {
        // 矛盾！claimer在撒谎
        this.l1Inferences.trustScore[claimerId] = Math.max(0, this.l1Inferences.trustScore[claimerId] - 0.4);
        this.l1Inferences.roleBeliefs[claimerId].werewolf = Math.min(1, 
          this.l1Inferences.roleBeliefs[claimerId].werewolf + 0.3);
      }
    }
  }
  
  // ==================== L2 (ToM) 更新 ====================
  
  /**
   * 更新对其他玩家信念的建模
   * 简化为：基于每个玩家的公开行为，推测他怀疑谁是狼
   */
  updateTheoryOfMind(allPlayers, publicActions) {
    allPlayers.forEach(observer => {
      if (observer.id === this.playerId) return;
      
      if (!this.l2TheoryOfMind.othersBeliefs[observer.id]) {
        this.l2TheoryOfMind.othersBeliefs[observer.id] = {};
      }
      
      // 基于 observer 的投票行为推测其怀疑对象
      const observerVotes = publicActions.filter(a => a.actorId === observer.id && a.type === 'vote');
      
      allPlayers.forEach(target => {
        if (target.id === observer.id) return;
        
        // 简单规则：observer 投过谁，就认为他怀疑谁是狼
        let suspicion = 0.5;
        observerVotes.forEach(v => {
          if (v.targetId === target.id) {
            suspicion += 0.3;
          }
        });
        
        this.l2TheoryOfMind.othersBeliefs[observer.id][target.id] = Math.min(1, suspicion);
      });
      
      // 推测 observer 对我的信任度（基于他是否攻击我）
      const attackedMe = observerVotes.some(v => v.targetId === this.playerId);
      this.l2TheoryOfMind.othersTrustMe[observer.id] = attackedMe ? 0.2 : 0.6;
      
      // 推测 observer 是否知道我的角色（基于我是否跳身份）
      const myClaims = this.l0Facts.publicClaims.filter(c => c.playerId === this.playerId);
      this.l2TheoryOfMind.othersKnowMyRole[observer.id] = myClaims.length > 0 ? 0.7 : 0.1;
    });
  }
  
  // ==================== L3 更新 ====================
  
  updateRelation(targetId, friendlyDelta, trustDelta) {
    if (!this.l3Social.relations[targetId]) {
      this.l3Social.relations[targetId] = { friendly: 0, trust: 0 };
    }
    this.l3Social.relations[targetId].friendly = Math.max(-1, Math.min(1, 
      this.l3Social.relations[targetId].friendly + friendlyDelta));
    this.l3Social.relations[targetId].trust = Math.max(-1, Math.min(1, 
      this.l3Social.relations[targetId].trust + trustDelta));
  }
  
  updatePressure(delta) {
    this.l3Social.pressure = Math.max(0, Math.min(1, this.l3Social.pressure + delta));
  }
  
  // ==================== 查询接口 ====================
  
  /**
   * 获取 L0 事实：查验结果（绝对不可被覆盖）
   */
  getCheckResult(targetId) {
    return this.l0Facts.checks[targetId] || null;
  }
  
  /**
   * 获取 L1 推理：某玩家是狼的概率
   */
  getWerewolfProbability(targetId) {
    return this.l1Inferences.roleBeliefs[targetId]?.werewolf || 0.5;
  }
  
  /**
   * 获取 L1 排序：按狼嫌疑排序的玩家列表
   */
  getSuspectRanking(allPlayers) {
    return allPlayers
      .filter(p => p.id !== this.playerId && p.alive)
      .map(p => ({
        id: p.id,
        name: p.name,
        werewolfProb: this.getWerewolfProbability(p.id)
      }))
      .sort((a, b) => b.werewolfProb - a.werewolfProb);
  }
  
  /**
   * 获取 L2 推测：某玩家认为我是狼的概率
   */
  getSuspicionOnMe(fromPlayerId) {
    return this.l2TheoryOfMind.othersBeliefs[fromPlayerId]?.[this.playerId] || 0.5;
  }
  
  /**
   * 获取 L3 关系值
   */
  getRelation(targetId) {
    return this.l3Social.relations[targetId] || { friendly: 0, trust: 0 };
  }
  
  /**
   * 调试输出：当前信念状态摘要
   */
  getSummary() {
    return {
      player: this.playerName,
      role: this.l0Facts.myRole,
      l0: {
        checks: this.l0Facts.checks,
        deaths: this.l0Facts.deaths
      },
      l1: {
        topSuspect: this._getTopSuspect()
      },
      l2: {
        myExposure: this._calculateExposure()
      },
      l3: {
        relations: this.l3Social.relations
      }
    };
  }
  
  _getTopSuspect() {
    let maxProb = -1;
    let topId = null;
    Object.entries(this.l1Inferences.roleBeliefs).forEach(([id, probs]) => {
      if (probs.werewolf > maxProb) {
        maxProb = probs.werewolf;
        topId = id;
      }
    });
    return { id: topId, probability: maxProb };
  }
  
  _calculateExposure() {
    let total = 0;
    Object.values(this.l2TheoryOfMind.othersBeliefs).forEach(beliefs => {
      total += beliefs[this.playerId] || 0;
    });
    return total / Math.max(1, Object.keys(this.l2TheoryOfMind.othersBeliefs).length);
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BeliefSystem };
}
