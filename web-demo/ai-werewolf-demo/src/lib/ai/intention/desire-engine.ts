// ============================================================
// Desire Engine — 从状态推导愿望
// ============================================================

import { ACTION } from '@/lib/constants/action-constants';
import type { Player } from '@/types';
import {
  INTENTION_MODE_ATTACK_DESPERATE,
  INTENTION_MODE_ATTACK_DOMINANT,
  INTENTION_MODE_ATTACK_NORMAL,
  INTENTION_MODE_CONCEAL_DESPERATE,
  INTENTION_MODE_CONCEAL_NORMAL,
  INTENTION_MODE_CONCEAL_OTHER,
} from '@/types';

import type { BeliefSystem } from '../belief-system';
import { IntentionType, IntentionSource, type Desire } from './types';

export class DesireEngine {
  generateDesires(self: Player, belief: BeliefSystem, allPlayers: Player[], round: number, mode: 'normal' | 'bus' | 'desperate' | 'dominant' = 'normal'): Desire[] {
    const desires: Desire[] = [];
    const aliveWolves = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
    const aliveVillagers = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;
    const myIdentityCrisis = belief.getIdentityCrisis();

    // === ROLE_DUTY: 角色义务 ===
    if (self.role === 'prophet') {
      const checks = belief.l0Facts.checks;
      for (const [targetId, result] of Object.entries(checks)) {
        if (result === 'werewolf') {
          const target = allPlayers.find((p) => p.id === targetId);
          if (target?.alive) {
            // 身份危机评估：危机高时不跳，危机低时可以跳
            let strength = 1000;
            let reason = `预言家查验到${target.name}是狼人，必须公布`;
            if (myIdentityCrisis > 0.6) {
              strength = 300; // 危机高，大幅降权，优先自保
              reason = `查验到${target.name}是狼人，但自身身份危机过高，谨慎公布`;
            } else if (myIdentityCrisis > 0.3) {
              strength = 700; // 危机中等，适度降权
              reason = `查验到${target.name}是狼人，身份危机中等，择机公布`;
            }
            desires.push({
              type: IntentionType.REVEAL,
              targetId,
              strength,
              source: IntentionSource.ROLE_DUTY,
              reason,
              conditions: ['role=prophet', 'check_result=werewolf', 'target_alive', `self_crisis=${myIdentityCrisis.toFixed(2)}`],
            });
          }
        }
      }
    }

    // === TEAM_DUTY: 团队义务 ===
    if (self.team === 'werewolf') {
      // 狼人团队义务：淘汰村民阵营。强度受模式影响：normal=潜伏，dominant=积极，desperate=全力
      const modeAttackBase = mode === 'desperate'
        ? INTENTION_MODE_ATTACK_DESPERATE
        : mode === 'dominant'
          ? INTENTION_MODE_ATTACK_DOMINANT
          : INTENTION_MODE_ATTACK_NORMAL;
      const villagerTargets = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');
      for (const target of villagerTargets) {
        const suspicion = belief.getWerewolfProbability(target.id);
        desires.push({
          type: IntentionType.ATTACK,
          targetId: target.id,
          strength: modeAttackBase + Math.round(suspicion * 100),
          source: IntentionSource.TEAM_DUTY,
          reason: `狼人团队义务：淘汰村民${target.name}`,
          conditions: ['team=werewolf', 'target=villager'],
        });
      }

      // 切割模式：队友极度身份危机且自身安全
      const teammates = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team === self.team);
      for (const teammate of teammates) {
        const teammateIdentityCrisis = belief.getPlayerIdentityCrisis(teammate.id);
        if (teammateIdentityCrisis > 0.8 && myIdentityCrisis < 0.5 && aliveWolves < aliveVillagers) {
          desires.push({
            type: IntentionType.CUT_LOSS,
            targetId: teammate.id,
            strength: 700,
            source: IntentionSource.TEAM_DUTY,
            reason: `队友${teammate.name}极度身份危机，切割保团队`,
            conditions: ['teammate_crisis>0.8', 'self_crisis<0.5', 'wolf_disadvantage'],
          });
        }
      }
    } else {
      // 村民团队义务：找出狼人
      const suspects = allPlayers
        .filter((p) => p.id !== self.id && p.alive && belief.getWerewolfProbability(p.id) > 0.5)
        .sort((a, b) => belief.getWerewolfProbability(b.id) - belief.getWerewolfProbability(a.id));

      for (const suspect of suspects.slice(0, 2)) {
        desires.push({
          type: IntentionType.ATTACK,
          targetId: suspect.id,
          strength: 500 + Math.round(belief.getWerewolfProbability(suspect.id) * 300),
          source: IntentionSource.TEAM_DUTY,
          reason: `村民义务：淘汰高嫌疑狼人${suspect.name}`,
          conditions: ['team=villager', 'suspect_wolf_prob>0.5'],
        });
      }
    }

    // === PERSONAL_GOAL: 主意图 ===
    // 生存压力
    if (myIdentityCrisis > 0.6) {
      desires.push({
        type: IntentionType.SURVIVE,
        targetId: null,
        strength: 800,
        source: IntentionSource.PERSONAL_GOAL,
        reason: `自身身份危机${myIdentityCrisis.toFixed(2)}过高，需自保`,
        conditions: ['self_crisis>0.6'],
      });
    }

    // 狼人隐藏身份。强度受模式影响：normal=优先躲藏，dominant=可以身份危机
    if (self.team === 'werewolf' && myIdentityCrisis < 0.4) {
      const modeConcealStrength = mode === 'normal'
        ? INTENTION_MODE_CONCEAL_NORMAL
        : mode === 'desperate'
          ? INTENTION_MODE_CONCEAL_DESPERATE
          : INTENTION_MODE_CONCEAL_OTHER;
      desires.push({
        type: IntentionType.CONCEAL,
        targetId: null,
        strength: modeConcealStrength,
        source: IntentionSource.PERSONAL_GOAL,
        reason: '狼人需隐藏身份，伪装好人',
        conditions: ['team=werewolf', 'self_crisis<0.4'],
      });
    }

    // 村民被怀疑时自证清白（非狼人且身份危机高）
    if (self.team !== 'werewolf' && myIdentityCrisis > 0.5) {
      desires.push({
        type: IntentionType.DEFEND,
        targetId: self.id,
        strength: 600 + Math.round(myIdentityCrisis * 200),
        source: IntentionSource.PERSONAL_GOAL,
        reason: `村民被怀疑，身份危机${myIdentityCrisis.toFixed(2)}，需自证清白`,
        conditions: ['team=villager', 'self_crisis>0.5'],
      });
    }

    // 建立信任（领导属性高）
    if (self.attributes.leadership > 6) {
      desires.push({
        type: IntentionType.RECRUIT,
        targetId: null,
        strength: 300 + self.attributes.leadership * 30,
        source: IntentionSource.PERSONAL_GOAL,
        reason: '领导属性高，倾向于建立影响力',
        conditions: ['leadership>6'],
      });
    }

    // === REACTION: 对事件的即时反应 ===
    // 被攻击时反击
    if (belief.l2TheoryOfMind.othersBeliefs) {
      const attackers = Object.entries(belief.l2TheoryOfMind.othersBeliefs)
        .filter(([, beliefs]) => beliefs[self.id] > 0.6)
        .map(([id]) => id);
      for (const attackerId of attackers) {
        const attacker = allPlayers.find((p) => p.id === attackerId);
        if (attacker?.alive) {
          desires.push({
            type: IntentionType.DEFEND,
            targetId: self.id,
            strength: 400,
            source: IntentionSource.REACTION,
            reason: `${attacker?.name}在攻击我，需反击或自证`,
            conditions: ['being_attacked'],
          });
          desires.push({
            type: IntentionType.ATTACK,
            targetId: attackerId,
            strength: 350,
            source: IntentionSource.REACTION,
            reason: `反咬攻击者${attacker?.name}`,
            conditions: ['being_attacked'],
          });
        }
      }
    }

    // === OPPORTUNITY: 机会驱动 ===
    // 有人号召投票，跟随机会
    // 在 IntentionManager 中处理，这里不生成

    return desires.sort((a, b) => b.strength - a.strength);
  }
}
