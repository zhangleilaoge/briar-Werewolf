/**
 * 决策引擎 (Decision Engine)
 * 
 * 核心设计：优先级覆盖制
 * 阶段 1: 职业义务 (Hard Constraint) - 不可被覆盖
 * 阶段 2: 生存策略 (Hard Constraint) - 不可被关系覆盖
 * 阶段 3: 信息最大化 (Soft Strategy) - 可被覆盖
 * 阶段 4: 社交润滑 (Soft Tiebreaker) - 仅在此处 L3 介入
 */

class DecisionEngine {
  constructor(aiConfig = {}) {
    this.config = {
      priorityOrder: ['duty', 'survival', 'information', 'social'],
      dutyWeight: 1000,
      survivalWeight: 800,
      infoWeight: 500,
      socialWeight: 100,
      ...aiConfig
    };
    
    // 策略注册表
    this.strategies = {
      duty: [],      // 职业义务策略
      survival: [],  // 生存策略
      information: [], // 信息策略
      social: []     // 社交策略
    };
  }
  
  registerStrategy(category, strategy) {
    if (this.strategies[category]) {
      this.strategies[category].push(strategy);
    }
  }
  
  /**
   * 核心决策入口
   * @param {BeliefSystem} belief - 当前 AI 的信念系统
   * @param {string} phase - 当前阶段 'day' | 'night' | 'vote'
   * @param {Array} availableActions - 可用行动列表
   * @param {Array} allPlayers - 所有玩家
   * @returns {Object} 决策结果 { action, target, reason, confidence }
   */
  decide(belief, phase, availableActions, allPlayers) {
    const candidates = [];
    
    // 按优先级顺序执行各阶段
    for (const stage of this.config.priorityOrder) {
      const stageStrategies = this.strategies[stage] || [];
      
      for (const strategy of stageStrategies) {
        // 检查策略是否适用当前阶段
        if (strategy.requiredPhase && !strategy.requiredPhase.includes(phase)) {
          continue;
        }
        
        // 检查策略是否适用当前角色
        if (strategy.requiredRoles && !strategy.requiredRoles.includes(belief.l0Facts.myRole)) {
          continue;
        }
        
        const result = strategy.evaluate(belief, availableActions, allPlayers, this.config);
        
        if (result && result.length > 0) {
          // 给每个候选加上阶段权重
          result.forEach(r => {
            r.stageWeight = this._getStageWeight(stage);
            r.stage = stage;
            candidates.push(r);
          });
          
          // 阶段 1 和 2 产生唯一候选时直接返回（硬约束）
          if ((stage === 'duty' || stage === 'survival') && result.length === 1) {
            return this._finalizeDecision(result[0], belief, stage);
          }
        }
      }
    }
    
    // 如果没有候选，执行默认行为
    if (candidates.length === 0) {
      return this._defaultDecision(belief, availableActions, allPlayers);
    }
    
    // 综合评分排序
    const scored = candidates.map(c => ({
      ...c,
      totalScore: (c.score || 0) + c.stageWeight
    })).sort((a, b) => b.totalScore - a.totalScore);
    
    // 返回最高分
    return this._finalizeDecision(scored[0], belief, scored[0].stage);
  }
  
  _getStageWeight(stage) {
    switch (stage) {
      case 'duty': return this.config.dutyWeight;
      case 'survival': return this.config.survivalWeight;
      case 'information': return this.config.infoWeight;
      case 'social': return this.config.socialWeight;
      default: return 0;
    }
  }
  
  _finalizeDecision(candidate, belief, stage) {
    return {
      action: candidate.action,
      target: candidate.target,
      reason: candidate.reason,
      stage: stage,
      confidence: candidate.confidence || 0.7,
      // L3 只影响行为表现，不影响决策本身
      emotionalTone: this._getEmotionalTone(belief, candidate.target, stage)
    };
  }
  
  _getEmotionalTone(belief, targetId, stage) {
    if (!targetId || stage === 'duty') return 'neutral';
    
    const relation = belief.getRelation(targetId);
    if (relation.friendly > 0.5) return 'reluctant';  // 关系好但不得不做
    if (relation.friendly < -0.5) return 'firm';      // 关系差，果断执行
    return 'neutral';
  }
  
  _defaultDecision(belief, availableActions, allPlayers) {
    // 默认行为：随机选择存活玩家投票
    const alivePlayers = allPlayers.filter(p => p.id !== belief.playerId && p.alive);
    const randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    
    return {
      action: 'vote',
      target: randomTarget?.id || null,
      reason: 'default_random',
      stage: 'default',
      confidence: 0.3,
      emotionalTone: 'neutral'
    };
  }
}

// ==================== 内置策略 ====================

/**
 * 预言家职业义务策略
 * 查验到狼 -> 必须投票给狼
 */
const ProphetDutyStrategy = {
  name: 'prophet_check_duty',
  requiredRoles: ['prophet'],
  requiredPhase: ['vote', 'day'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    
    // L0 检查：我是否有查杀结果
    const checks = belief.l0Facts.checks;
    
    Object.entries(checks).forEach(([targetId, checkResult]) => {
      if (checkResult === 'werewolf') {
        const target = allPlayers.find(p => p.id === targetId);
        if (target && target.alive) {
          result.push({
            action: 'vote',
            target: targetId,
            score: 100,  // 极高分数，确保优先
            confidence: 1.0,
            reason: `L0事实：查验到${target.name}是狼人，职业义务优先淘汰`
          });
        }
      }
    });
    
    return result;
  }
};

/**
 * 狼人职业义务策略
 * 狼人需要保护队友，但如果队友被预言家查杀且暴露风险高，考虑切割
 */
const WerewolfDutyStrategy = {
  name: 'werewolf_team_duty',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote', 'day'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    
    // 获取所有狼队友（根据 L0 我知道的队友）
    // 注意：这里简化处理，假设狼人知道队友
    const teammates = allPlayers.filter(p => 
      p.id !== belief.playerId && 
      p.alive && 
      p.team === 'werewolf'
    );
    
    teammates.forEach(teammate => {
      // 检查队友是否被预言家查杀（L2 ToM）
      const teammateExposure = belief.l2TheoryOfMind.othersBeliefs;
      let exposureScore = 0;
      
      Object.values(teammateExposure).forEach(beliefs => {
        if (beliefs[teammate.id]) exposureScore += beliefs[teammate.id];
      });
      
      // 如果队友暴露风险极高，考虑倒钩（切割）
      if (exposureScore > 0.7) {
        result.push({
          action: 'vote',
          target: teammate.id,
          score: 80,
          confidence: 0.8,
          reason: `L2推断：队友${teammate.name}暴露风险极高(${exposureScore.toFixed(2)})，倒钩保自己`
        });
      } else {
        // 保护队友，不投他
        // 以"不投队友"的形式体现，这里返回负向选择
        // 实际实现中可以通过排除列表实现
      }
    });
    
    return result;
  }
};

/**
 * 狼人杀戮策略（夜晚）
 */
const WerewolfKillStrategy = {
  name: 'werewolf_kill',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['night'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    
    // 优先刀神职（基于 L2 推测谁最像神）
    const aliveTargets = allPlayers.filter(p => 
      p.id !== belief.playerId && p.alive && p.team !== 'werewolf'
    );
    
    aliveTargets.forEach(target => {
      // 根据公开行为推测是否神职
      const claims = belief.l0Facts.publicClaims.filter(c => c.playerId === target.id);
      const isLikelyGod = claims.length > 0 || belief.l2TheoryOfMind.othersKnowMyRole[target.id] > 0.5;
      
      let score = 50;
      if (isLikelyGod) score += 30;  // 优先刀疑似神职
      if (belief.getWerewolfProbability(target.id) < 0.3) score += 10;  // 优先刀像村民的
      
      result.push({
        action: 'kill',
        target: target.id,
        score: score,
        confidence: isLikelyGod ? 0.7 : 0.5,
        reason: isLikelyGod ? 
          `L2推断：${target.name}疑似神职，优先击杀` : 
          `击杀${target.name}，平民嫌疑高`
      });
    });
    
    return result.sort((a, b) => b.score - a.score);
  }
};

/**
 * 生存策略：狼人暴露风险高时，优先做低怀疑行为
 */
const SurvivalStrategy = {
  name: 'exposure_avoidance',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote', 'day'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    
    // 计算自己的暴露风险
    let myExposure = 0;
    Object.values(belief.l2TheoryOfMind.othersBeliefs).forEach(beliefs => {
      myExposure += beliefs[belief.playerId] || 0;
    });
    myExposure /= Math.max(1, Object.keys(belief.l2TheoryOfMind.othersBeliefs).length);
    
    if (myExposure > 0.6) {
      // 暴露风险高，优先做看起来像村民的行为
      // 比如：投给狼队友（倒钩），或者跟随大势投票
      const alivePlayers = allPlayers.filter(p => p.id !== belief.playerId && p.alive);
      const safeTargets = alivePlayers.filter(p => 
        belief.getWerewolfProbability(p.id) > 0.5 || p.team === 'werewolf'
      );
      
      safeTargets.forEach(target => {
        result.push({
          action: 'vote',
          target: target.id,
          score: 70 - (myExposure * 20),  // 暴露越高分数越高（负相关）
          confidence: 0.6,
          reason: `L2推断：自己被怀疑度${myExposure.toFixed(2)}过高，需做低嫌疑行为，跟随大势投${target.name}`
        });
      });
    }
    
    return result;
  }
};

/**
 * 信息最大化策略：村民投票优先投最可疑的人
 */
const MaxInfoVoteStrategy = {
  name: 'max_info_vote',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner'],
  requiredPhase: ['vote'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    const alivePlayers = allPlayers.filter(p => p.id !== belief.playerId && p.alive);
    
    alivePlayers.forEach(target => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      const relation = belief.getRelation(target.id);
      
      // 信息分数：基于狼嫌疑概率
      let score = wolfProb * 100;
      
      // 阶段 3 允许信息策略
      result.push({
        action: 'vote',
        target: target.id,
        score: score,
        confidence: wolfProb,
        reason: wolfProb > 0.5 ? 
          `L1推理：${target.name}狼嫌疑${(wolfProb*100).toFixed(0)}%，优先淘汰` : 
          `L1推理：${target.name}相对安全，狼嫌疑${(wolfProb*100).toFixed(0)}%`
      });
    });
    
    return result.sort((a, b) => b.score - a.score);
  }
};

/**
 * 社交润滑策略：在多个候选分数相同时，用关系值打破平局
 */
const SocialTieBreakerStrategy = {
  name: 'social_tiebreaker',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner', 'werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['vote'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    const alivePlayers = allPlayers.filter(p => p.id !== belief.playerId && p.alive);
    
    alivePlayers.forEach(target => {
      const relation = belief.getRelation(target.id);
      
      // 社交分数：关系差的人更容易被投票（负相关）
      // 注意：这个分数很低，只在总分接近时起作用
      const socialScore = (1 - relation.friendly) * 10;  // 关系越差，分数越高
      
      result.push({
        action: 'vote',
        target: target.id,
        score: socialScore,  // 低分，仅作为 tiebreaker
        confidence: 0.3,
        reason: `L3社交：与${target.name}关系值${relation.friendly.toFixed(2)}，${relation.friendly < 0 ? '关系差' : '关系一般'}`
      });
    });
    
    return result;
  }
};

/**
 * 预言家夜晚查验策略
 */
const ProphetCheckStrategy = {
  name: 'prophet_night_check',
  requiredRoles: ['prophet'],
  requiredPhase: ['night'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    
    // 优先查验 L1 推理中狼嫌疑最高的人
    const alivePlayers = allPlayers.filter(p => p.id !== belief.playerId && p.alive);
    
    alivePlayers.forEach(target => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      
      // 排除已查验过的人
      if (belief.l0Facts.checks[target.id] !== undefined) {
        return;
      }
      
      result.push({
        action: 'check',
        target: target.id,
        score: wolfProb * 100 + 50,  // 基础分+狼嫌疑分
        confidence: 0.7,
        reason: `优先查验${target.name}，L1推理狼嫌疑${(wolfProb*100).toFixed(0)}%`
      });
    });
    
    // 如果没有优先目标，随机选择未查验的
    if (result.length === 0) {
      const unchecked = alivePlayers.filter(p => belief.l0Facts.checks[p.id] === undefined);
      if (unchecked.length > 0) {
        const random = unchecked[Math.floor(Math.random() * unchecked.length)];
        result.push({
          action: 'check',
          target: random.id,
          score: 30,
          confidence: 0.5,
          reason: `无明确嫌疑，随机查验${random.name}`
        });
      }
    }
    
    return result.sort((a, b) => b.score - a.score);
  }
};

/**
 * 狂狼白天自爆策略
 */
const BerserkerSuicideStrategy = {
  name: 'berserker_suicide',
  requiredRoles: ['berserker'],
  requiredPhase: ['day'],
  
  evaluate(belief, availableActions, allPlayers) {
    const result = [];
    
    // 狂狼评估：是否有高价值目标值得同归于尽
    // 比如：明确的预言家、强神职、或者狼队劣势时
    
    const alivePlayers = allPlayers.filter(p => p.id !== belief.playerId && p.alive && p.team !== 'werewolf');
    
    // 评估形势：如果狼队人数劣势，考虑自爆换关键角色
    const werewolfCount = allPlayers.filter(p => p.team === 'werewolf' && p.alive).length;
    const villagerCount = allPlayers.filter(p => p.team !== 'werewolf' && p.alive).length;
    
    if (werewolfCount < villagerCount && werewolfCount <= 2) {
      // 劣势，寻找高价值目标
      alivePlayers.forEach(target => {
        // 推测是否神职（基于公开行为）
        const claims = belief.l0Facts.publicClaims.filter(c => c.playerId === target.id);
        const isLikelyGod = claims.length > 0;
        
        if (isLikelyGod) {
          result.push({
            action: 'berserker_kill',
            target: target.id,
            score: 90,
            confidence: 0.8,
            reason: `狼队劣势(${werewolfCount} vs ${villagerCount})，${target.name}疑似神职，同归于尽换平安夜`
          });
        }
      });
    }
    
    return result;
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DecisionEngine,
    ProphetDutyStrategy,
    WerewolfDutyStrategy,
    WerewolfKillStrategy,
    SurvivalStrategy,
    MaxInfoVoteStrategy,
    SocialTieBreakerStrategy,
    ProphetCheckStrategy,
    BerserkerSuicideStrategy
  };
}
