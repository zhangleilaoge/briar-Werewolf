import { AIAgent } from '../ai/ai-agent';
import type { Player, GameLogItem, GameConfig, Role } from '../ai/types';

interface GameSimulatorOptions {
  skipNightKill?: boolean;
}

export class GameSimulator {
  players: AIAgent[];
  round: number;
  phase: string;
  publicActions: { actorId: string; type: string; targetId?: string }[];
  logs: GameLogItem[];
  gameConfig: GameConfig;

  constructor(playerConfigs: { id: string; name: string; role: Role; team: string; items?: string[]; aiConfig?: Record<string, unknown> }[]) {
    this.players = [];
    this.round = 0;
    this.phase = 'init';
    this.publicActions = [];
    this.logs = [];
    this.gameConfig = { totalPlayers: playerConfigs.length, werewolfRoles: [], villagerRoles: [] };
    this._createPlayers(playerConfigs);
  }

  private _createPlayer(config: { id: string; name: string; role: Role; team: string; items?: string[]; aiConfig?: Record<string, unknown> }) {
    const agent = new AIAgent(config.id, config.name, config.role, config.team as 'werewolf' | 'villager', config.aiConfig);
    agent.items = config.items || [];
    return agent;
  }

  private _createPlayers(configs: { id: string; name: string; role: Role; team: string; items?: string[]; aiConfig?: Record<string, unknown> }[]) {
    configs.forEach((cfg) => {
      const player = this._createPlayer(cfg);
      this.players.push(player);
    });
    this.players.forEach((p) => {
      p.initializeRelations(
        this.players.map((x) => ({ id: x.id, name: x.name, role: x.role, team: x.team, alive: x.alive, items: x.items }))
      );
    });
  }

  runRound(options: GameSimulatorOptions = {}) {
    this.round++;
    this._log(`=== 第 ${this.round} 轮 ===`, 'phase');

    this._log('-- 夜晚阶段 --', 'phase');
    const nightDecisions: { playerId: string; decision: { action: string; target: string | null; reason: string } }[] = [];

    this.players.forEach((p) => {
      if (!p.alive) return;
      const decision = p.nightAction(this.players.map((x) => ({ id: x.id, name: x.name, role: x.role, team: x.team, alive: x.alive, items: x.items })));
      if (decision) {
        nightDecisions.push({ playerId: p.id, decision: { action: decision.action, target: decision.target, reason: decision.reason } });
      }
    });

    this._resolveNightActions(nightDecisions, options);

    this._log('-- 白天阶段 --', 'phase');
    this.publicActions = [];

    this.players.forEach((p) => {
      if (!p.alive) return;
      const decision = p.dayAction(
        this.players.map((x) => ({ id: x.id, name: x.name, role: x.role, team: x.team, alive: x.alive, items: x.items })),
        this.publicActions
      );
      if (decision) {
        this.publicActions.push({ actorId: p.id, type: decision.action, targetId: decision.target || undefined });
      }
    });

    this._log('-- 投票阶段 --', 'phase');
    const votes: Record<string, number> = {};

    this.players.forEach((p) => {
      if (!p.alive) return;
      const decision = p.vote(
        this.players.map((x) => ({ id: x.id, name: x.name, role: x.role, team: x.team, alive: x.alive, items: x.items })),
        this.publicActions
      );
      if (decision && decision.target) {
        votes[decision.target] = (votes[decision.target] || 0) + 1;
        this._log(`${p.name} 投票给 ${this._getName(decision.target)}，原因：${decision.reason}`, 'action');
      }
    });

    const maxVotes = Math.max(...Object.values(votes), 0);
    const votedOut = Object.keys(votes).filter((k) => votes[k] === maxVotes);

    if (votedOut.length === 1 && maxVotes > 0) {
      const target = this.players.find((p) => p.id === votedOut[0]);
      if (target) {
        target.alive = false;
        this.players.forEach((p) => p.onEvent({ type: 'death', playerId: target.id }));
        this._log(`${target.name} 被投票放逐！`, 'death');
      }
    } else {
      this._log('投票平票，无人被放逐', 'info');
    }

    return this._checkWinCondition();
  }

  private _resolveNightActions(decisions: { playerId: string; decision: { action: string; target: string | null } }[], options: GameSimulatorOptions) {
    decisions.forEach((d) => {
      if (d.decision.action === 'check') {
        const prophet = this.players.find((p) => p.id === d.playerId);
        const target = this.players.find((p) => p.id === d.decision.target);
        if (target) {
          const result = target.team === 'werewolf' ? 'werewolf' : 'villager';
          prophet?.onEvent({ type: 'check_result', targetId: target.id, result });
          this._log(`${prophet?.name} 查验 ${target.name} → ${result === 'werewolf' ? '狼人' : '村民'}`, 'action');
        }
      }
    });

    if (options.skipNightKill) return;

    let killTargetId: string | null = null;
    let killerId: string | null = null;

    const killDecision = decisions.find((d) => d.decision.action === 'kill');
    if (killDecision) {
      killTargetId = killDecision.decision.target;
      killerId = killDecision.playerId;
    }

    if (killTargetId && killerId) {
      const werewolf = this.players.find((p) => p.id === killerId);
      const target = this.players.find((p) => p.id === killTargetId);
      if (target && target.alive) {
        target.alive = false;
        this.players.forEach((p) => p.onEvent({ type: 'death', playerId: target.id }));
        this._log(`${werewolf?.name} 刀了 ${target.name}，${target.name} 死亡`, 'death');
      }
    }
  }

  private _checkWinCondition() {
    const aliveWerewolves = this.players.filter((p) => p.team === 'werewolf' && p.alive).length;
    const aliveVillagers = this.players.filter((p) => p.team !== 'werewolf' && p.alive).length;

    if (aliveWerewolves === 0) {
      this._log('=== 村民阵营胜利！ ===', 'victory');
      return 'villager';
    }
    if (aliveWerewolves >= aliveVillagers) {
      this._log('=== 狼人阵营胜利！ ===', 'victory');
      return 'werewolf';
    }
    return null;
  }

  private _getName(id: string) {
    const p = this.players.find((x) => x.id === id);
    return p ? p.name : id;
  }

  private _log(message: string, type: GameLogItem['type'] = 'info') {
    this.logs.push({ round: this.round, message, type });
  }

  getLogs() {
    return this.logs;
  }

  getPlayerStates() {
    return this.players.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      team: p.team,
      alive: p.alive,
      items: p.items,
      belief: p.belief.getSummary(),
    }));
  }

  getPlayers() {
    return this.players;
  }
}

export function generateGameConfig(totalPlayers: number, werewolfConfig: { role: string; count: number }[], villagerConfig: { role: string; count: number }[]) {
  const configs: { id: string; name: string; role: Role; team: string; items: string[] }[] = [];
  const roleItems: Record<string, string[]> = {
    prophet: ['crystal_ball'],
    werewolf: ['claws'],
    lone_wolf: ['claws'],
    berserker: ['claws', 'double_sword'],
    thief: ['thief_gloves'],
    coroner: ['coroner_tools'],
    villager: [],
  };

  let id = 1;
  werewolfConfig.forEach((wc) => {
    for (let i = 0; i < wc.count; i++) {
      configs.push({
        id: `p${id++}`,
        name: `${wc.role === 'werewolf' ? '狼人' : wc.role === 'lone_wolf' ? '孤狼' : '狂狼'}${i + 1}`,
        role: wc.role as Role,
        team: 'werewolf',
        items: roleItems[wc.role] || [],
      });
    }
  });

  villagerConfig.forEach((vc) => {
    for (let i = 0; i < vc.count; i++) {
      const nameMap: Record<string, string> = {
        villager: '村民',
        prophet: '预言家',
        thief: '窃贼',
        coroner: '验尸官',
      };
      configs.push({
        id: `p${id++}`,
        name: `${nameMap[vc.role] || vc.role}${i + 1}`,
        role: vc.role as Role,
        team: 'villager',
        items: roleItems[vc.role] || [],
      });
    }
  });

  return configs;
}
