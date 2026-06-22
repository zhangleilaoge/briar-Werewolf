// ============================================================
// InferenceEngine — 推理引擎
// 全部依赖记忆，动态计算。不缓存，不存储。
// 呈现结果只有：某个角色可能是某个职业，概率是多少。
// ============================================================

import type { MemoryEntry, Player } from '@/types';
import type { MemStore } from '@/memory';
import { BELIEF_DEFAULT, CLAIM_WEIGHT_FACTOR, OBSERVE_WEIGHT, CRISIS_WEIGHT, HARD_INFO_THRESHOLD } from '@/constants';

export interface RoleInference {
  playerId: string;
  werewolfProb: number;  // 0~1，认为是狼人的概率
  villagerProb: number;  // 0~1，认为是村民的概率
  basis: string[];       // 支撑推理的记忆ID
}

interface CrisisFactors {
  accuseCount: number;    // 被指控次数
  voteCount: number;      // 被投票次数
  defendCount: number;     // 被辩护次数
  observeCount: number;    // 被观察次数
}

export interface PlayerCrisis {
  playerId: string;
  score: number;         // 危机度，越高越危险（被攻击越多）
  dominant: number;      // 主导度 = -score，越高越主导（被攻击越少、被保护越多）
  factors: CrisisFactors;
  basis: string[];       // 支撑的记忆ID
}

export class InferenceEngine {
  private store: MemStore;
  private selfId: string;

  constructor(store: MemStore, selfId: string) {
    this.store = store;
    this.selfId = selfId;
  }

  /**
   * 推理所有玩家的角色概率。
   * 每次调用都重新从记忆计算，不缓存。
   */
  inferAll(allPlayers: Player[]): Map<string, RoleInference> {
    const result = new Map<string, RoleInference>();
    for (const player of allPlayers) {
      if (player.id === this.selfId) continue; // 不需要推理自己
      result.set(player.id, this._inferPlayer(player.id));
    }
    return result;
  }

  /**
   * 推理单个玩家的角色概率。
   */
  inferPlayer(playerId: string): RoleInference {
    return this._inferPlayer(playerId);
  }

  // ==================== 局势推理（Situation Inference） ====================

  /**
   * 推理自己的危机度：通过所有人对我的态度，判断我当前有多危险。
   * 和 Relation.friendly 完全独立：friendly 是「我对谁好/坏」，crisis 是「谁对我好/坏」。
   */
  inferSelfCrisis(): PlayerCrisis {
    return this._inferCrisis(this.selfId);
  }

  /**
   * 推理场上所有人的危机度，返回：
   * - mostAtRisk：危机度最高（最被攻击）的人
   * - mostDominant：危机度最低（最主导）的人
   * - all：所有人的危机度列表
   */
  inferFieldCrisis(allPlayers: Player[]): {
    mostAtRisk: PlayerCrisis;
    mostDominant: PlayerCrisis;
    all: PlayerCrisis[];
  } {
    const all: PlayerCrisis[] = [];
    for (const player of allPlayers) {
      if (!player.alive) continue;
      all.push(this._inferCrisis(player.id));
    }
    all.sort((a, b) => b.score - a.score); // 按危机度降序

    return {
      mostAtRisk: all[0],
      mostDominant: all[all.length - 1],
      all,
    };
  }

  // ---- 核心推理逻辑 ----

  private _inferPlayer(playerId: string): RoleInference {
    // 获取关于该玩家的所有非遗忘记忆
    const memories = this.store.aboutPlayer(playerId).filter((m) => !m.isForgotten);
    const basis: string[] = [];

    // 1. 硬信息直接覆盖
    for (const mem of memories) {
      if (mem.credibility >= HARD_INFO_THRESHOLD) {
        if (mem.eventType === 'check_result' && mem.targetId === playerId) {
          const result = mem.content.result as string;
          if (result === 'werewolf') {
            return { playerId, werewolfProb: 1.0, villagerProb: 0, basis: [mem.id] };
          } else {
            return { playerId, werewolfProb: 0, villagerProb: 1.0, basis: [mem.id] };
          }
        }
        if (mem.eventType === 'teammate_reveal' && mem.targetId === playerId) {
          const role = mem.content.role as string;
          if (role === 'werewolf') {
            return { playerId, werewolfProb: 1.0, villagerProb: 0, basis: [mem.id] };
          } else {
            return { playerId, werewolfProb: 0, villagerProb: 1.0, basis: [mem.id] };
          }
        }
      }
    }

    // 2. 没有硬信息，从软信息综合推理
    let wolfWeight = 0;
    let villagerWeight = 0;
    let totalWeight = 0;

    // 声称查杀/金水
    for (const mem of memories) {
      if (mem.eventType === 'hear_claim' && mem.targetId === playerId) {
        const claimedResult = mem.content.claimedResult as string;
        const weight = mem.credibility * CLAIM_WEIGHT_FACTOR; // 声称的权重低
        if (claimedResult === 'werewolf') {
          wolfWeight += weight;
          basis.push(mem.id);
        } else if (claimedResult === 'villager') {
          villagerWeight += weight;
          basis.push(mem.id);
        }
        totalWeight += weight;
      }
    }

    // 观察到的短期意图
    for (const mem of memories) {
      if (mem.eventType === 'observe_pattern') {
        const content = mem.content as { inferredIntention?: string; intentionTarget?: string; confidence?: number };
        const intention = content.inferredIntention;
        const confidence = content.confidence ?? OBSERVE_WEIGHT.DEFAULT_CONFIDENCE;
        const weight = mem.credibility * confidence;

        // 如果观察到某人的意图是攻击"我"或指向"我"的目标
        if (intention === 'attack' && content.intentionTarget === playerId) {
          wolfWeight += weight * OBSERVE_WEIGHT.ATTACK_WOLF; // 攻击我的人可能是狼
          basis.push(mem.id);
          totalWeight += weight;
        }
        // 如果观察到某人的意图是保护"我"或指向"我"的目标
        if (intention === 'protect' && content.intentionTarget === playerId) {
          villagerWeight += weight * OBSERVE_WEIGHT.PROTECT_VILLAGER; // 保护我的人可能是村民
          basis.push(mem.id);
          totalWeight += weight;
        }
        // 如果观察到某人意图隐藏（可能是狼人隐藏身份）
        if (intention === 'hide') {
          wolfWeight += weight * OBSERVE_WEIGHT.HIDE_WOLF;
          basis.push(mem.id);
          totalWeight += weight;
        }
      }
    }

    // 归一化
    if (totalWeight === 0) {
      return { playerId, werewolfProb: BELIEF_DEFAULT.WEREWOLF_PROB, villagerProb: BELIEF_DEFAULT.VILLAGER_PROB, basis: [] };
    }

    const wolfProb = totalWeight > 0 ? wolfWeight / totalWeight : BELIEF_DEFAULT.WEREWOLF_PROB;
    const villagerProb = totalWeight > 0 ? villagerWeight / totalWeight : BELIEF_DEFAULT.VILLAGER_PROB;
    const sum = wolfProb + villagerProb;

    return {
      playerId,
      werewolfProb: sum > 0 ? wolfProb / sum : BELIEF_DEFAULT.WEREWOLF_PROB,
      villagerProb: sum > 0 ? villagerProb / sum : BELIEF_DEFAULT.VILLAGER_PROB,
      basis,
    };
  }

  // ---- 局势推理核心 ----

  /**
   * 计算某个玩家的危机度。
   * 只统计「别人对该玩家」的行为（该玩家是 targetId）。
   * 和 Relation.friendly 完全独立：friendly 是「我对谁好/坏」，crisis 是「谁对我好/坏」。
   */
  private _inferCrisis(playerId: string): PlayerCrisis {
    // 筛选所有非遗忘的、以该玩家为目标的行为记忆
    const memories = this.store.getAll().filter((m) => !m.isForgotten && m.targetId === playerId);
    const basis: string[] = [];

    const factors: CrisisFactors = {
      accuseCount: 0,
      voteCount: 0,
      defendCount: 0,
      observeCount: 0,
    };

    for (const mem of memories) {
      basis.push(mem.id);
      switch (mem.eventType) {
        case 'hear_accuse':
          factors.accuseCount++;
          break;
        case 'vote':
          factors.voteCount++;
          break;
        case 'hear_defend':
          factors.defendCount++;
          break;
        case 'observe_pattern':
          factors.observeCount++;
          break;
      }
    }

    // 权重：投票(+3) > 指控(+2) > 观察(+1) > 辩护(-2)
    const score =
      factors.accuseCount * CRISIS_WEIGHT.ACCUSE +
      factors.voteCount * CRISIS_WEIGHT.VOTE +
      factors.observeCount * CRISIS_WEIGHT.OBSERVE -
      factors.defendCount * Math.abs(CRISIS_WEIGHT.DEFEND);

    return {
      playerId,
      score,
      dominant: -score,
      factors,
      basis: basis.length > 0 ? basis : [],
    };
  }
}
