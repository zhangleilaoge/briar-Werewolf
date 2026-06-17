/**
 * AI 模拟器 (Simulation)
 *
 * 运行简化版游戏流程，验证 AI 决策逻辑
 * 核心验证场景：
 * 1. 预言家查到狼但关系好 -> 仍然投票给狼
 * 2. 狼人队友暴露 -> 考虑倒钩
 * 3. 村民无信息 -> 用社交关系做 tiebreaker
 */

class GameSimulator {
  constructor(playerConfigs) {
    this.players = [];
    this.round = 0;
    this.phase = 'init';
    this.publicActions = [];
    this.logs = [];

    this._createPlayers(playerConfigs);
  }

  _createPlayer(config) {
    const agent = new AIAgent(
      config.id,
      config.name,
      config.role,
      config.team,
      config.aiConfig
    );
    agent.items = config.items || [];
    return agent;
  }

  _createPlayers(configs) {
    configs.forEach(cfg => {
      const player = this._createPlayer(cfg);
      this.players.push(player);
    });

    // 初始化所有 AI 的关系
    this.players.forEach(p => {
      p.initializeRelations(this.players.map(x => ({
        id: x.id, name: x.name, role: x.role, team: x.team, alive: x.alive
      })));
    });
  }

  /**
   * 运行一局游戏（简化版：一个夜晚 + 一个白天 + 投票）
   * @param {Object} options - 可选参数
   * @param {string} options.forcedKillTarget - 强制狼刀目标（用于测试）
   * @param {boolean} options.skipNightKill - 跳过狼刀（用于测试白天逻辑）
   */
  runRound(options = {}) {
    this.round++;
    this._log('=== 第 ' + this.round + ' 轮 ===');

    // 1. 夜晚阶段
    this._log('-- 夜晚阶段 --');
    const nightDecisions = [];

    this.players.forEach(p => {
      if (!p.alive) return;
      const decision = p.nightAction(this.players, 'night');
      if (decision) {
        nightDecisions.push({ playerId: p.id, decision });
      }
    });

    // 处理夜晚行动
    this._resolveNightActions(nightDecisions, options);

    // 2. 白天阶段
    this._log('-- 白天阶段 --');
    this.publicActions = [];

    // 简化：每个玩家依次做白天决策
    this.players.forEach(p => {
      if (!p.alive) return;
      const decision = p.dayAction(this.players, 'day', this.publicActions);
      if (decision) {
        this.publicActions.push({
          actorId: p.id,
          type: decision.action,
          targetId: decision.target,
          reason: decision.reason
        });
      }
    });

    // 3. 投票阶段
    this._log('-- 投票阶段 --');
    const votes = {};

    this.players.forEach(p => {
      if (!p.alive) return;
      const decision = p.vote(this.players, 'vote', this.publicActions);
      if (decision && decision.target) {
        votes[decision.target] = (votes[decision.target] || 0) + 1;
        this._log(p.name + ' 投票给 ' + this._getName(decision.target) + '，原因：' + decision.reason);
      }
    });

    // 统计投票
    const maxVotes = Math.max(...Object.values(votes), 0);
    const votedOut = Object.keys(votes).filter(k => votes[k] === maxVotes);

    if (votedOut.length === 1 && maxVotes > 0) {
      const target = this.players.find(p => p.id === votedOut[0]);
      if (target) {
        target.alive = false;
        this.players.forEach(p => p.onEvent({ type: 'death', playerId: target.id }));
        this._log(target.name + ' 被投票放逐！');
      }
    } else {
      this._log('投票平票，无人被放逐');
    }

    // 检查胜利条件
    return this._checkWinCondition();
  }

  _resolveNightActions(decisions, options = {}) {
    // 处理查验
    decisions.forEach(d => {
      if (d.decision.action === 'check') {
        const prophet = this.players.find(p => p.id === d.playerId);
        const target = this.players.find(p => p.id === d.decision.target);
        if (target) {
          const result = target.team === 'werewolf' ? 'werewolf' : 'villager';
          prophet.onEvent({ type: 'check_result', targetId: target.id, result });
          this._log(prophet.name + ' 查验 ' + target.name + ' -> ' + result);
        }
      }
    });

    // 处理狼刀
    if (options.skipNightKill) return;

    let killTargetId = null;
    let killerId = null;

    if (options.forcedKillTarget) {
      killTargetId = options.forcedKillTarget;
      const killDecision = decisions.find(d => d.decision.action === 'kill');
      if (killDecision) killerId = killDecision.playerId;
    } else {
      // 简化：取第一个狼人的目标
      const killDecision = decisions.find(d => d.decision.action === 'kill');
      if (killDecision) {
        killTargetId = killDecision.decision.target;
        killerId = killDecision.playerId;
      }
    }

    if (killTargetId && killerId) {
      const werewolf = this.players.find(p => p.id === killerId);
      const target = this.players.find(p => p.id === killTargetId);
      if (target && target.alive) {
        target.alive = false;
        this.players.forEach(p => p.onEvent({ type: 'death', playerId: target.id }));
        this._log(werewolf.name + ' 刀了 ' + target.name + '，' + target.name + ' 死亡');
      }
    }
  }

  _checkWinCondition() {
    const aliveWerewolves = this.players.filter(p => p.team === 'werewolf' && p.alive).length;
    const aliveVillagers = this.players.filter(p => p.team !== 'werewolf' && p.alive).length;

    if (aliveWerewolves === 0) {
      this._log('=== 村民阵营胜利！ ===');
      return 'villager';
    }
    if (aliveWerewolves >= aliveVillagers) {
      this._log('=== 狼人阵营胜利！ ===');
      return 'werewolf';
    }
    return null;
  }

  _getName(id) {
    const p = this.players.find(x => x.id === id);
    return p ? p.name : id;
  }

  _log(msg) {
    this.logs.push({ round: this.round, message: msg });
  }

  getLogs() {
    return this.logs;
  }

  getPlayerStates() {
    return this.players.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      team: p.team,
      alive: p.alive,
      belief: p.belief.getSummary()
    }));
  }
}

// ==================== 预设场景 ====================

/**
 * 场景 1：预言家查到狼但关系好
 * 验证：预言家应该仍然投票给狼，不受关系影响
 */
function createScenario1() {
  return [
    {
      id: 'p1', name: '预言家A', role: 'prophet', team: 'villager',
      items: ['crystal_ball'],
      aiConfig: { dutyWeight: 1000 }
    },
    {
      id: 'p2', name: '狼人B', role: 'werewolf', team: 'werewolf',
      items: ['claws']
    },
    {
      id: 'p3', name: '村民C', role: 'villager', team: 'villager'
    },
    {
      id: 'p4', name: '村民D', role: 'villager', team: 'villager'
    },
    {
      id: 'p5', name: '狼人E', role: 'werewolf', team: 'werewolf',
      items: ['claws']
    }
  ];
}

/**
 * 场景 2：狼人队友被查杀，需要倒钩
 * 验证：狼人应该考虑投队友而不是保护
 */
function createScenario2() {
  return [
    {
      id: 'p1', name: '预言家', role: 'prophet', team: 'villager',
      items: ['crystal_ball']
    },
    {
      id: 'p2', name: '狼队友', role: 'werewolf', team: 'werewolf',
      items: ['claws']
    },
    {
      id: 'p3', name: '倒钩狼', role: 'werewolf', team: 'werewolf',
      items: ['claws']
    },
    {
      id: 'p4', name: '村民A', role: 'villager', team: 'villager'
    },
    {
      id: 'p5', name: '村民B', role: 'villager', team: 'villager'
    }
  ];
}

/**
 * 场景 3：村民无信息，靠关系 tiebreaker
 * 验证：村民在无法判断时，用关系值做投票选择
 */
function createScenario3() {
  return [
    {
      id: 'p1', name: '村民甲', role: 'villager', team: 'villager'
    },
    {
      id: 'p2', name: '狼人A', role: 'werewolf', team: 'werewolf',
      items: ['claws']
    },
    {
      id: 'p3', name: '狼人B', role: 'werewolf', team: 'werewolf',
      items: ['claws']
    },
    {
      id: 'p4', name: '村民乙', role: 'villager', team: 'villager'
    },
    {
      id: 'p5', name: '村民丙', role: 'villager', team: 'villager'
    }
  ];
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GameSimulator,
    createScenario1,
    createScenario2,
    createScenario3
  };
}
