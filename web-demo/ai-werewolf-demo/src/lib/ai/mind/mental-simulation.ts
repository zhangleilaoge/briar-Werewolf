import type { BeliefSystem } from '../belief-system';
import type { Player } from '@/types';
import type { SocialContext, MentalSimulation } from './types';
import { ACTION } from '@/lib/constants/action-constants';
import {
  SIMULATION_DEFAULT_GOAL_ALIGNMENT,
  SIMULATION_DEFAULT_EXPOSURE_RISK,
  SIMULATION_EXPOSURE_RISK_HIGH,
  SIMULATION_EXPOSURE_RISK_MEDIUM,
  SIMULATION_EXPOSURE_RISK_LOW,
  SIMULATION_EXPOSURE_RISK_VERY_LOW,
  SIMULATION_EXPOSURE_RISK_MODERATE,
  SIMULATION_GOAL_ALIGNMENT_HIGH,
  SIMULATION_GOAL_ALIGNMENT_MEDIUM,
  SIMULATION_GOAL_ALIGNMENT_LOW,
  SIMULATION_GOAL_ALIGNMENT_VERY_LOW,
  SIMULATION_CONFIDENCE_HIGH,
  SIMULATION_CONFIDENCE_MEDIUM,
  SIMULATION_CONFIDENCE_LOW,
  SIMULATION_PERCEPTION_POSITIVE,
  SIMULATION_PERCEPTION_POSITIVE_SMALL,
  SIMULATION_PERCEPTION_NEGATIVE_SMALL,
  SIMULATION_PERCEPTION_NEGATIVE,
  SIMULATION_PERCEPTION_NEGATIVE_MEDIUM,
  SIMULATION_PERCEPTION_NEGATIVE_LARGE,
  PROB_THRESHOLD_HIGH,
  PROB_THRESHOLD_MEDIUM,
  TRUST_THRESHOLD_MEDIUM,
} from '@/lib/constants/mind';

export class MentalSimulator {
  simulate(
    action: string,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): MentalSimulation {
    const sim: MentalSimulation = {
      action,
      target,
      expectedReactions: new Map(),
      expectedPerceptionChange: new Map(),
      goalAlignment: SIMULATION_DEFAULT_GOAL_ALIGNMENT,
      exposureRisk: SIMULATION_DEFAULT_EXPOSURE_RISK,
    };

    switch (action) {
      case ACTION.GUARANTEE:
        this._simulateGuarantee(sim, target, socialContext, self, belief);
        break;
      case ACTION.ACCUSE:
        this._simulateAccuse(sim, target, socialContext, self, belief);
        break;
      case ACTION.DEFEND:
        this._simulateDefend(sim, target, socialContext, self, belief);
        break;
      case ACTION.CALL_VOTE:
        this._simulateCallVote(sim, target, socialContext, self, belief);
        break;
      case ACTION.BLOCK_VOTE:
        this._simulateBlockVote(sim, target, socialContext, self, belief);
        break;
      case ACTION.EXCLUDE_ALL:
        this._simulateExcludeAll(sim, socialContext, self, belief);
        break;
      case ACTION.CLAIM_IDENTITY:
        this._simulateClaimIdentity(sim, socialContext, self, belief);
        break;
      case ACTION.SUSPECT:
        this._simulateSuspect(sim, target, socialContext, self, belief);
        break;
      case ACTION.SILENCE:
        this._simulateSilence(sim, socialContext, self, belief);
        break;
    }

    return sim;
  }

  private _simulateGuarantee(
    sim: MentalSimulation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    if (!target) return;

    const targetView = socialContext.relationNetwork.myView.get(target);
    const targetIsWerewolf = targetView?.inferredTeam === 'werewolf';

    if (targetIsWerewolf && targetView?.confidence > SIMULATION_CONFIDENCE_MEDIUM) {
      // 担保狼人 = 高风险
      sim.exposureRisk = SIMULATION_EXPOSURE_RISK_HIGH;
      sim.goalAlignment = SIMULATION_GOAL_ALIGNMENT_VERY_LOW;
      
      // 旁观者会怀疑我
      for (const [pid, view] of socialContext.relationNetwork.myView) {
        if (pid !== self.id && pid !== target) {
          sim.expectedReactions.set(pid, {
            reaction: view.trust > TRUST_THRESHOLD_MEDIUM ? '可能相信我' : '可能怀疑我',
            confidence: SIMULATION_CONFIDENCE_MEDIUM,
          });
          sim.expectedPerceptionChange.set(pid, SIMULATION_PERCEPTION_NEGATIVE_MEDIUM);
        }
      }
    } else if (targetView?.inferredTeam === 'villager') {
      // 担保好人 = 低风险，符合 truthSeeking
      sim.exposureRisk = SIMULATION_EXPOSURE_RISK_VERY_LOW;
      sim.goalAlignment = SIMULATION_GOAL_ALIGNMENT_MEDIUM;
      
      for (const [pid, _view] of socialContext.relationNetwork.myView) {
        if (pid !== self.id && pid !== target) {
          sim.expectedReactions.set(pid, {
            reaction: '可能更信任我',
            confidence: SIMULATION_CONFIDENCE_LOW,
          });
          sim.expectedPerceptionChange.set(pid, SIMULATION_PERCEPTION_POSITIVE_SMALL);
        }
      }
    } else {
      // 不确定
      sim.exposureRisk = SIMULATION_EXPOSURE_RISK_MODERATE;
      sim.goalAlignment = SIMULATION_DEFAULT_GOAL_ALIGNMENT;
    }
  }

  private _simulateAccuse(
    sim: MentalSimulation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    if (!target) return;

    const targetView = socialContext.relationNetwork.myView.get(target);
    const wolfProb = targetView?.confidence || 0;

    // 目标真的是狼人 → 目标对齐高
    sim.goalAlignment = wolfProb > PROB_THRESHOLD_HIGH ? SIMULATION_GOAL_ALIGNMENT_HIGH : SIMULATION_GOAL_ALIGNMENT_VERY_LOW;
    
    // 身份危机高时，激进行动风险高
    sim.exposureRisk = socialContext.identityCrisis.isHigh ? SIMULATION_EXPOSURE_RISK_MEDIUM : SIMULATION_EXPOSURE_RISK_LOW;

    // 目标会反驳
    sim.expectedReactions.set(target, {
      reaction: '会反驳我',
      confidence: SIMULATION_CONFIDENCE_HIGH,
    });

    // 旁观者反应
    for (const [pid, view] of socialContext.relationNetwork.myView) {
      if (pid !== self.id && pid !== target) {
        if (view.inferredTeam === 'werewolf' && view.confidence > PROB_THRESHOLD_MEDIUM) {
          // 其他狼人可能会支持目标
          sim.expectedReactions.set(pid, {
            reaction: '可能支持目标',
            confidence: SIMULATION_CONFIDENCE_LOW,
          });
        } else {
          sim.expectedReactions.set(pid, {
            reaction: wolfProb > PROB_THRESHOLD_HIGH ? '可能相信我' : '持观望态度',
            confidence: SIMULATION_CONFIDENCE_LOW,
          });
        }
      }
    }
  }

  private _simulateDefend(
    sim: MentalSimulation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    if (!target) return;

    const isSelf = target === self.id;
    const targetView = socialContext.relationNetwork.myView.get(target);

    if (isSelf) {
      // 自辩
      sim.exposureRisk = SIMULATION_EXPOSURE_RISK_LOW;
      sim.goalAlignment = SIMULATION_GOAL_ALIGNMENT_MEDIUM;
      sim.expectedReactions.set(target, {
        reaction: '接受我的辩护',
        confidence: SIMULATION_CONFIDENCE_MEDIUM,
      });
    } else {
      // 保他人
      const targetIsWerewolf = targetView?.inferredTeam === 'werewolf';
      sim.exposureRisk = targetIsWerewolf ? SIMULATION_EXPOSURE_RISK_MEDIUM : SIMULATION_EXPOSURE_RISK_VERY_LOW;
      sim.goalAlignment = targetIsWerewolf ? SIMULATION_GOAL_ALIGNMENT_VERY_LOW : SIMULATION_GOAL_ALIGNMENT_MEDIUM;

      for (const [pid, _view] of socialContext.relationNetwork.myView) {
        if (pid !== self.id && pid !== target) {
          sim.expectedReactions.set(pid, {
            reaction: targetIsWerewolf ? '可能怀疑我' : '可能更信任我',
            confidence: SIMULATION_CONFIDENCE_LOW,
          });
          sim.expectedPerceptionChange.set(pid, targetIsWerewolf ? SIMULATION_PERCEPTION_NEGATIVE : SIMULATION_PERCEPTION_POSITIVE_SMALL);
        }
      }
    }
  }

  private _simulateCallVote(
    sim: MentalSimulation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    if (!target) return;

    const targetView = socialContext.relationNetwork.myView.get(target);
    const wolfProb = targetView?.confidence || 0;

    // 号召投票目标对齐
    sim.goalAlignment = wolfProb > PROB_THRESHOLD_HIGH ? SIMULATION_GOAL_ALIGNMENT_HIGH : SIMULATION_GOAL_ALIGNMENT_LOW;
    sim.exposureRisk = socialContext.identityCrisis.isHigh ? SIMULATION_DEFAULT_EXPOSURE_RISK : SIMULATION_EXPOSURE_RISK_LOW;

    // 预期跟票人数
    let _expectedFollowers = 0;
    for (const [pid, view] of socialContext.relationNetwork.myView) {
      if (pid !== self.id && pid !== target) {
        if (view.trust > TRUST_THRESHOLD_MEDIUM) {
          _expectedFollowers++;
          sim.expectedReactions.set(pid, {
            reaction: '可能跟票',
            confidence: SIMULATION_CONFIDENCE_MEDIUM,
          });
        } else {
          sim.expectedReactions.set(pid, {
            reaction: '可能观望',
            confidence: SIMULATION_CONFIDENCE_LOW,
          });
        }
      }
    }

    // 预期影响力 = 跟票人数 / 总人数
    const _totalOthers = socialContext.relationNetwork.myView.size;
    sim.expectedPerceptionChange.set(target, SIMULATION_PERCEPTION_NEGATIVE_LARGE);
  }

  private _simulateBlockVote(
    sim: MentalSimulation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    if (!target) return;

    sim.exposureRisk = SIMULATION_EXPOSURE_RISK_MEDIUM;
    sim.goalAlignment = SIMULATION_GOAL_ALIGNMENT_LOW;

    for (const [pid, _view] of socialContext.relationNetwork.myView) {
      if (pid !== self.id && pid !== target) {
        sim.expectedReactions.set(pid, {
          reaction: '可能怀疑我',
          confidence: SIMULATION_CONFIDENCE_LOW,
        });
        sim.expectedPerceptionChange.set(pid, SIMULATION_PERCEPTION_NEGATIVE_SMALL);
      }
    }
  }

  private _simulateExcludeAll(
    sim: MentalSimulation,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    sim.exposureRisk = SIMULATION_DEFAULT_EXPOSURE_RISK;
    sim.goalAlignment = SIMULATION_EXPOSURE_RISK_MEDIUM;

    // 搅浑水效果
    for (const [pid, _view] of socialContext.relationNetwork.myView) {
      if (pid !== self.id) {
        sim.expectedReactions.set(pid, {
          reaction: '可能混乱',
          confidence: SIMULATION_CONFIDENCE_MEDIUM,
        });
      }
    }
  }

  private _simulateClaimIdentity(
    sim: MentalSimulation,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    sim.exposureRisk = SIMULATION_DEFAULT_EXPOSURE_RISK;
    sim.goalAlignment = self.role === 'prophet' ? SIMULATION_GOAL_ALIGNMENT_MEDIUM : SIMULATION_DEFAULT_GOAL_ALIGNMENT;

    // 跳身份后，别人会怎么看我
    for (const [pid, view] of socialContext.relationNetwork.myView) {
      if (pid !== self.id) {
        if (view.trust > TRUST_THRESHOLD_MEDIUM) {
          sim.expectedReactions.set(pid, {
            reaction: '可能相信我',
            confidence: SIMULATION_CONFIDENCE_MEDIUM,
          });
          sim.expectedPerceptionChange.set(pid, SIMULATION_PERCEPTION_POSITIVE);
        } else {
          sim.expectedReactions.set(pid, {
            reaction: '可能怀疑我',
            confidence: SIMULATION_CONFIDENCE_LOW,
          });
          sim.expectedPerceptionChange.set(pid, SIMULATION_PERCEPTION_NEGATIVE_SMALL);
        }
      }
    }
  }

  private _simulateSuspect(
    sim: MentalSimulation,
    target: string | null,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    if (!target) return;

    const targetView = socialContext.relationNetwork.myView.get(target);
    const wolfProb = targetView?.confidence || 0;

    sim.goalAlignment = wolfProb > PROB_THRESHOLD_MEDIUM ? SIMULATION_GOAL_ALIGNMENT_MEDIUM : SIMULATION_GOAL_ALIGNMENT_LOW;
    sim.exposureRisk = SIMULATION_EXPOSURE_RISK_LOW;

    sim.expectedReactions.set(target, {
      reaction: '可能反驳',
      confidence: SIMULATION_CONFIDENCE_MEDIUM,
    });
  }

  private _simulateSilence(
    sim: MentalSimulation,
    socialContext: SocialContext,
    self: Player,
    _belief: BeliefSystem
  ): void {
    sim.exposureRisk = SIMULATION_EXPOSURE_RISK_VERY_LOW;
    sim.goalAlignment = SIMULATION_DEFAULT_GOAL_ALIGNMENT;

    // 沉默 = 不引起注意
    for (const [pid, _view] of socialContext.relationNetwork.myView) {
      if (pid !== self.id) {
        sim.expectedReactions.set(pid, {
          reaction: '可能忽略我',
          confidence: SIMULATION_EXPOSURE_RISK_HIGH,
        });
      }
    }
  }
}

// 计算心智模拟综合分数
export function calculateSimulationScore(simulation: MentalSimulation): number {
  const perceptionChanges = Array.from(simulation.expectedPerceptionChange.values());
  const avgPerceptionChange = perceptionChanges.length > 0 
    ? perceptionChanges.reduce((a, b) => a + b, 0) / perceptionChanges.length 
    : 0;

  return (
    simulation.goalAlignment * SIMULATION_DEFAULT_GOAL_ALIGNMENT +
    (1 - simulation.exposureRisk) * SIMULATION_EXPOSURE_RISK_LOW +
    avgPerceptionChange * SIMULATION_EXPOSURE_RISK_VERY_LOW
  );
}
