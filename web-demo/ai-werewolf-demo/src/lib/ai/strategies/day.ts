import {
  SCORE_SPEAK_BREAK_SILENCE, SCORE_SPEAK_DEFAULT, SCORE_WEREWOLF_KILL_BASE,
  WEREWOLF_PROBABILITY_HIGH, WEREWOLF_PROBABILITY_LOW, EXPOSURE_HIGH_THRESHOLD,
  SCORE_BERSERKER_SUICIDE, SCORE_MAX_INFO_VOTE, RELATION_MAX, SILENCE_NEAR_FULL_THRESHOLD,
  SCORE_WEREWOLF_VOTE_DUTY,
} from '../constants';
import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
import type { BeliefSystem } from '../belief-system';
import type { Strategy, StrategyContext } from './engine';
import type { Player } from '../types';

// ---------- Helper: Generate rich suspicion reason from public actions ----------
function getSuspicionReason(
  belief: BeliefSystem,
  targetId: string,
  publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
  allPlayers: Player[]
): string {
  const reasons: string[] = [];
  const target = allPlayers.find(p => p.id === targetId);

  // 1. 被多人攻击
  const attacks = publicActions.filter(a => a.targetId === targetId && (a.type === 'suspect' || a.type === 'accuse' || a.type === 'join_suspect'));
  if (attacks.length >= 2) {
    reasons.push(`已经被${attacks.length}人攻击`);
  }

  // 2. 攻击过明显好人（泼脏水）
  const theirAttacks = publicActions.filter(a => a.actorId === targetId && (a.type === 'suspect' || a.type === 'accuse'));
  const attacksOnGood = theirAttacks.filter(a => {
    if (!a.targetId) return false;
    const targetProb = belief.getWerewolfProbability(a.targetId);
    return targetProb < 0.4;
  });
  if (attacksOnGood.length > 0) {
    const victim = allPlayers.find(p => p.id === attacksOnGood[0].targetId);
    reasons.push(`攻击了明显的好人${victim?.name || ''}，像在泼脏水`);
  }

  // 3. 连续沉默
  const silenceCount = publicActions.filter(a => a.actorId === targetId && a.type === 'silence').length;
  if (silenceCount >= 2) {
    reasons.push(`连续${silenceCount}次沉默，似乎在隐藏`);
  }

  // 4. 阻止投票保护被多人怀疑的人
  const blocks = publicActions.filter(a => a.actorId === targetId && a.type === 'block_vote');
  if (blocks.length > 0) {
    const blockedTarget = blocks[0].targetId;
    if (blockedTarget) {
      const blockedSuspicion = publicActions.filter(a => a.targetId === blockedTarget && (a.type === 'suspect' || a.type === 'accuse')).length;
      if (blockedSuspicion >= 2) {
        const blockedPlayer = allPlayers.find(p => p.id === blockedTarget);
        reasons.push(`阻止投票保护被怀疑的${blockedPlayer?.name || ''}，像在保狼`);
      }
    }
  }

  // 5. 无依据号召投票
  const calls = publicActions.filter(a => a.actorId === targetId && a.type === 'call_vote');
  if (calls.length > 0) {
    const callTarget = calls[0].targetId;
    if (callTarget) {
      const callTargetProb = belief.getWerewolfProbability(callTarget);
      if (callTargetProb < 0.5) {
        const calledPlayer = allPlayers.find(p => p.id === callTarget);
        reasons.push(`无依据号召投票${calledPlayer?.name || ''}，像在搅局`);
      }
    }
  }

  // 6. 压力高
  if (target && target.stress > 5) {
    reasons.push(`压力很大（${target.stress}）`);
  }

  // 7. 信任度低
  const trust = belief.l1Inferences.trustScore[targetId] ?? 0;
  if (trust < -3) {
    reasons.push(`之前的发言可信度低`);
  }

  return reasons.length > 0 ? reasons.join('；') : '行为有些可疑';
}

// ---------- Helper: Generate wolf-attack reason for rebuttal ----------
function getWerewolfAttackReason(
  belief: BeliefSystem,
  attackerId: string,
  publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
  allPlayers: Player[]
): string {
  const reasons: string[] = [];
  const attacker = allPlayers.find(p => p.id === attackerId);

  const attacks = publicActions.filter(a => a.actorId === attackerId && (a.type === 'suspect' || a.type === 'accuse'));
  const goodAttacks = attacks.filter(a => {
    if (!a.targetId) return false;
    return belief.getWerewolfProbability(a.targetId) < 0.4;
  });

  if (goodAttacks.length > 0) {
    const victim = allPlayers.find(p => p.id === goodAttacks[0].targetId);
    reasons.push(`攻击了明显好人${victim?.name || ''}`);
  }

  const silenceCount = publicActions.filter(a => a.actorId === attackerId && a.type === 'silence').length;
  if (silenceCount >= 2) {
    reasons.push(`连续沉默${silenceCount}次`);
  }

  const blocks = publicActions.filter(a => a.actorId === attackerId && a.type === 'block_vote');
  if (blocks.length > 0) {
    const blockedTarget = blocks[0].targetId;
    if (blockedTarget) {
      const suspicion = publicActions.filter(a => a.targetId === blockedTarget && (a.type === 'suspect' || a.type === 'accuse')).length;
      if (suspicion >= 2) {
        const blocked = allPlayers.find(p => p.id === blockedTarget);
        reasons.push(`保护被怀疑的${blocked?.name || ''}`);
      }
    }
  }

  if (attacker && attacker.stress > 5) {
    reasons.push(`压力很大（${attacker.stress}）`);
  }

  return reasons.length > 0 ? reasons.join('，') : '行为可疑';
}

// ---------- Villager: Rich Day Strategy with Real Motivations ----------
export const VillagerDayStrategy: Strategy = {
  name: 'villager_day',
  requiredRoles: ['villager', 'prophet', 'thief', 'coroner'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount, publicActions } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const actions = publicActions || [];

    // 局势分析
    const attacksOnMe = actions.filter(a => a.targetId === self.id && (a.type === 'suspect' || a.type === 'accuse'));
    const myAttackers = [...new Set(attacksOnMe.map(a => a.actorId))].map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as Player[];
    const trustedCallers = actions.filter(a => a.type === 'call_vote' && a.actorId !== self.id && (belief.l1Inferences.trustScore[a.actorId] ?? 0) > 3);
    const suspectRanking = belief.getSuspectRanking(allPlayers);
    const topSuspect = suspectRanking[0];

    // 1. 职业义务：预言家公布查验
    if (self.role === 'prophet') {
      const checks = belief.l0Facts.checks;
      for (const [targetId, checkResult] of Object.entries(checks)) {
        if (checkResult === 'werewolf') {
          const target = allPlayers.find(p => p.id === targetId);
          if (target?.alive) {
            result.push({
              action: 'claim_identity',
              target: targetId,
              score: 1000,
              confidence: 1.0,
              reason: `我查验了${target.name}，结果是狼人！作为预言家我必须公布身份。`,
              details: { claimedRole: 'prophet', checkResult, checkTarget: targetId },
            });
            result.push({
              action: 'call_vote',
              target: targetId,
              score: 950,
              confidence: 1.0,
              reason: `${target.name}已被我查验为狼人，号召大家投票！`,
            });
            break;
          }
        }
      }
    }

    // 2. 被攻击 -> 反驳/反咬
    if (myAttackers.length > 0) {
      const attacker = myAttackers[0];
      const attackerWolfProb = belief.getWerewolfProbability(attacker.id);

      result.push({
        action: 'accuse',
        target: attacker.id,
        score: 100 + (attackerWolfProb > 0.5 ? 30 : 0),
        confidence: 0.7,
        reason: `${attacker.name}在攻击我，我觉得他才是狼人！${getWerewolfAttackReason(belief, attacker.id, actions, allPlayers)}。`,
      });
      result.push({
        action: 'guarantee',
        target: self.id,
        score: 70,
        confidence: 0.5,
        reason: `我需要证明自己的清白。${attacker.name}的指控没有依据。`,
      });
    }

    // 3. 高可疑目标 -> 指认/怀疑/号召
    if (topSuspect && topSuspect.werewolfProb > 0.5) {
      const target = allPlayers.find(p => p.id === topSuspect.id);
      if (target) {
        const reason = getSuspicionReason(belief, topSuspect.id, actions, allPlayers);

        if (topSuspect.werewolfProb > 0.7) {
          result.push({
            action: 'accuse',
            target: topSuspect.id,
            score: 130,
            confidence: topSuspect.werewolfProb,
            reason: `我强烈怀疑${target.name}是狼人！${reason}。狼概率${(topSuspect.werewolfProb * 100).toFixed(0)}%。`,
          });
        } else {
          result.push({
            action: 'suspect',
            target: topSuspect.id,
            score: 100,
            confidence: topSuspect.werewolfProb,
            reason: `我觉得${target.name}很可疑。${reason}。狼概率${(topSuspect.werewolfProb * 100).toFixed(0)}%。`,
          });
        }

        if (topSuspect.werewolfProb > 0.6) {
          result.push({
            action: 'call_vote',
            target: topSuspect.id,
            score: 110,
            confidence: topSuspect.werewolfProb,
            reason: `${target.name}嫌疑很高，我号召大家投票。${reason}。`,
          });
        }
      }
    }

    // 4. 观察异常行为（压力高/沉默多）
    const suspiciousByBehavior = allPlayers.filter(p => p.id !== self.id && p.alive && (
      (p.stress > 5) ||
      (actions.filter(a => a.actorId === p.id && a.type === 'silence').length >= 2)
    ));
    if (suspiciousByBehavior.length > 0) {
      const observeTarget = suspiciousByBehavior[0];
      const behaviorReasons: string[] = [];
      if (observeTarget.stress > 5) behaviorReasons.push(`压力很大（${observeTarget.stress}）`);
      const targetSilence = actions.filter(a => a.actorId === observeTarget.id && a.type === 'silence').length;
      if (targetSilence >= 2) behaviorReasons.push(`连续${targetSilence}次沉默`);

      result.push({
        action: 'observe',
        target: observeTarget.id,
        score: 75,
        confidence: 0.5,
        reason: `我注意到${observeTarget.name}${behaviorReasons.join('，')}，行为异常，想暗中观察他获取更多情报。`,
      });
    }

    // 5. 跟随可信的人号召
    trustedCallers.forEach(caller => {
      if (caller.targetId) {
        const target = allPlayers.find(p => p.id === caller.targetId);
        if (target?.alive) {
          const callerName = allPlayers.find(p => p.id === caller.actorId)?.name || '有人';
          result.push({
            action: 'call_vote',
            target: caller.targetId,
            score: 85,
            confidence: 0.6,
            reason: `${callerName}号召投票给${target.name}，我信任他的判断，跟票。`,
          });
        }
      }
    });

    // 6. 打破沉默
    if (consecutiveSilence && aliveCount && consecutiveSilence >= aliveCount - SILENCE_NEAR_FULL_THRESHOLD) {
      result.push({
        action: 'speak',
        target: null,
        score: 95,
        confidence: 0.7,
        reason: `快全员沉默了，我必须说点什么推动讨论。`,
      });
    }

    // 7. 默认：第一轮或有信息时的差异化表达
    if (result.length === 0) {
      const aliveOthers = allPlayers.filter(p => p.id !== self.id && p.alive);
      const randomTarget = aliveOthers.length > 0 ? aliveOthers[Math.floor(Math.random() * aliveOthers.length)] : null;
      const isRound1 = (publicActions?.filter(a => a.type === 'speak' || a.type === 'suspect' || a.type === 'accuse' || a.type === 'defend').length ?? 0) < 3;

      if (randomTarget) {
        if (isRound1) {
          result.push({
            action: 'observe',
            target: randomTarget.id,
            score: 50,
            confidence: 0.3,
            reason: `第一天信息不足，我打算观察${randomTarget.name}获取更多情报。`,
          });
        } else {
          result.push({
            action: 'observe',
            target: randomTarget.id,
            score: 50,
            confidence: 0.3,
            reason: `目前没什么明确线索，我打算观察${randomTarget.name}获取更多情报。`,
          });
        }
      }
      if (isRound1) {
        result.push({
          action: 'speak',
          target: null,
          score: 40,
          confidence: 0.3,
          reason: `第一天信息不足，我先听听大家的发言。`,
        });
      } else {
        result.push({
          action: 'speak',
          target: null,
          score: 40,
          confidence: 0.3,
          reason: `目前没什么明确线索，先看看大家的发言。`,
        });
      }
    }

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Werewolf: Rich Camouflage Strategy with Real Motivations ----------
export const WerewolfCamouflageStrategy: Strategy = {
  name: 'werewolf_camouflage',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers, consecutiveSilence, aliveCount, publicActions } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const actions = publicActions || [];
    const aliveVillagers = allPlayers.filter(p => p.id !== self.id && p.alive && p.team !== 'werewolf');

    // 1. 被攻击 -> 反咬/反驳
    const attacksOnMe = actions.filter(a => a.targetId === self.id && (a.type === 'suspect' || a.type === 'accuse'));
    if (attacksOnMe.length > 0) {
      const attacker = allPlayers.find(p => p.id === attacksOnMe[0].actorId);
      if (attacker) {
        result.push({
          action: 'accuse',
          target: attacker.id,
          score: 130,
          confidence: 0.8,
          reason: `${attacker.name}在攻击我，我觉得他才是狼人！${getWerewolfAttackReason(belief, attacker.id, actions, allPlayers)}。`,
        });
        result.push({
          action: 'suspect',
          target: attacker.id,
          score: 100,
          confidence: 0.7,
          reason: `我怀疑${attacker.name}，他的攻击没有依据。`,
        });
      }
    }

    // 2. 伪装：怀疑一个有"理由"的好人
    aliveVillagers.forEach(target => {
      const wolfProb = belief.getWerewolfProbability(target.id);
      const targetSuspicion = actions.filter(a => a.targetId === target.id && (a.type === 'suspect' || a.type === 'accuse')).length;
      const targetSilence = actions.filter(a => a.actorId === target.id && a.type === 'silence').length;

      if (wolfProb < 0.5 && (targetSuspicion >= 1 || targetSilence >= 2)) {
        const fakeReason = targetSuspicion >= 1
          ? `已经被一些玩家怀疑，我分析也觉得他有问题`
          : `连续${targetSilence}次沉默，行为很可疑`;

        result.push({
          action: 'suspect',
          target: target.id,
          score: 70 + targetSuspicion * 10,
          confidence: 0.6,
          reason: `我觉得${target.name}有点可疑，${fakeReason}。大家注意观察。`,
        });
      }
    });

    // 3. 队友暴露 -> 袒护/切割
    const teammates = allPlayers.filter(p => p.id !== self.id && p.alive && p.team === 'werewolf');
    teammates.forEach(teammate => {
      const exposure = Object.values(belief.l2TheoryOfMind.othersBeliefs).reduce(
        (sum, b) => sum + (b[teammate.id] ?? 0), 0
      );
      if (exposure > EXPOSURE_HIGH_THRESHOLD) {
        if (exposure > 0.8 && belief.getExposure() < 0.5) {
          // 倒钩：反咬队友
          result.push({
            action: 'suspect',
            target: teammate.id,
            score: 90,
            confidence: 0.7,
            reason: `我怀疑${teammate.name}，他行为太可疑了，不像是好人。`,
          });
        }
        result.push({
          action: 'defend',
          target: teammate.id,
          score: 60,
          confidence: 0.5,
          reason: `我觉得${teammate.name}被冤枉了，大家再想想。`,
        });
      }
    });

    // 4. 打破沉默
    if (consecutiveSilence && aliveCount && consecutiveSilence >= aliveCount - SILENCE_NEAR_FULL_THRESHOLD) {
      result.push({
        action: 'speak',
        target: null,
        score: 90,
        confidence: 0.7,
        reason: `快全员沉默了，我得当个好人样打破沉默。`,
      });
    }

    // 5. 默认
    if (result.length === 0) {
      const isRound1 = (publicActions?.filter(a => a.type === 'speak' || a.type === 'suspect' || a.type === 'accuse' || a.type === 'defend').length ?? 0) < 3;
      if (isRound1) {
        const random = aliveVillagers[Math.floor(Math.random() * aliveVillagers.length)];
        if (random) {
          result.push({
            action: 'speak',
            target: random.id,
            score: 55,
            confidence: 0.5,
            reason: `第一天信息不多，我先观察${random.name}，看看他有什么表现。`,
          });
        } else {
          result.push({
            action: 'speak',
            target: null,
            score: 50,
            confidence: 0.5,
            reason: `第一天信息不多，我先看看局势。`,
          });
        }
      } else {
        result.push({
          action: 'speak',
          target: null,
          score: 50,
          confidence: 0.5,
          reason: `我也没什么头绪，先看看大家怎么说。`,
        });
      }
    }

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Prophet: Claim Check Results ----------
export const ProphetClaimStrategy: Strategy = {
  name: 'prophet_claim',
  requiredRoles: ['prophet'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, allPlayers } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const checks = belief.l0Facts.checks;

    for (const [targetId, checkResult] of Object.entries(checks)) {
      if (checkResult === 'werewolf') {
        const target = allPlayers.find((p) => p.id === targetId);
        if (target?.alive) {
          result.push({
            action: 'claim_identity',
            target: targetId,
            score: SCORE_MAX_INFO_VOTE,
            confidence: 1.0,
            reason: `公布查验结果：${target.name} 是狼人。`,
            details: { claimedRole: 'prophet', checkResult, checkTarget: targetId },
          });
          break;
        }
      }
    }

    return result;
  },
};

// ---------- Berserker: Suicide Kill ----------
export const BerserkerSuicideStrategy: Strategy = {
  name: 'berserker_suicide',
  requiredRoles: ['berserker'],
  requiredPhase: ['day'],
  evaluate(context) {
    const { belief, self, allPlayers } = context;
    const result: import('../types').DecisionCandidate[] = [];
    const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');
    const werewolfCount = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
    const villagerCount = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;

    if (werewolfCount < villagerCount && werewolfCount <= 2) {
      alivePlayers.forEach((target) => {
        const claims = belief.l0Facts.publicClaims.filter((c) => c.playerId === target.id);
        if (claims.length > 0) {
          result.push({
            action: 'berserker_kill',
            target: target.id,
            score: SCORE_BERSERKER_SUICIDE,
            confidence: 0.8,
            reason: `狼队劣势(${werewolfCount} vs ${villagerCount})，${target.name}疑似神职，同归于尽。`,
          });
        }
      });
    }

    return result;
  },
};
