import { ACTION } from '@/lib/constants/action-constants';
import {
  ACTION_VALUE_SIGNATURES,
  type calculateCapabilityMatch,
} from '../mind';
import type {
  MindFactorDetail,
  MindFactorBreakdown,
  RelationNetwork,
  SocialContext,
  ValueSystem,
  TimingEvaluation,
  MentalSimulation,
} from '../mind/types';
import type { Player } from '@/types';

// ========== 价值观对齐详情 ==========

export function buildValueAlignmentDetail(
  action: string,
  valueSystem: ValueSystem,
  valueAlignment: number
): MindFactorDetail {
  const signature = ACTION_VALUE_SIGNATURES[action];
  const breakdown: MindFactorBreakdown[] = [];

  const valueLabels: Record<string, string> = {
    truthSeeking: '求真',
    selfPreservation: '自保',
    socialHarmony: '社交和谐',
    dominance: '支配',
    deception: '欺骗',
    loyalty: '忠诚',
  };

  if (signature) {
    for (const [key, sigVal] of Object.entries(signature)) {
      const val = (valueSystem as unknown as Record<string, number>)[key];
      if (val !== undefined && sigVal !== undefined) {
        const label = valueLabels[key] || key;
        const product = sigVal * val;
        const impact = product > 0 ? '价值观与行动方向一致' : '价值观与行动方向冲突';
        breakdown.push({
          label: `${label}(${sigVal > 0 ? '+' : ''}${sigVal.toFixed(2)})`,
          value: val,
          reason: impact,
        });
      }
    }
  }

  const reason = valueAlignment > 0.8 ? '行动与价值观高度一致'
    : valueAlignment > 0.5 ? '行动与价值观基本匹配'
    : '行动与价值观存在冲突';

  return { score: valueAlignment, reason, breakdown };
}

// ========== 时机详情 ==========

export function buildTimingDetail(timing: TimingEvaluation, timingScore: number): MindFactorDetail {
  const breakdown: MindFactorBreakdown[] = [
    {
      label: '紧迫性',
      value: timing.urgency,
      reason: timing.urgency > 0.7 ? '局势紧迫，需要立即行动' : timing.urgency > 0.4 ? '有一定紧迫性' : '不紧迫，可以等待',
    },
    {
      label: '可信度',
      value: timing.credibility,
      reason: timing.credibility > 0.7 ? '有充分证据支持' : timing.credibility > 0.4 ? '证据一般' : '缺乏证据，可信度低',
    },
    {
      label: '风险规避',
      value: 1 - timing.risk,
      reason: timing.risk > 0.6 ? '高风险，可能暴露意图' : timing.risk > 0.3 ? '中等风险' : '低风险，相对安全',
    },
    {
      label: '预期影响力',
      value: timing.expectedImpact,
      reason: timing.expectedImpact > 0.7 ? '预期影响大' : timing.expectedImpact > 0.4 ? '有一定影响力' : '影响有限',
    },
    {
      label: '机会成本',
      value: timing.opportunityCost,
      reason: timing.opportunityCost > 0.6 ? '放弃其他机会代价高' : '机会成本较低',
    },
  ];

  const reason = timingScore > 0.8 ? '时机非常合适，多项条件有利'
    : timingScore > 0.5 ? '时机一般，部分条件有利'
    : '时机不佳，条件不成熟';
  return { score: timingScore, reason, breakdown };
}

// ========== 模拟详情 ==========

export function buildSimulationDetail(
  simulation: MentalSimulation,
  simulationScore: number,
  allPlayers: Player[]
): MindFactorDetail {
  const breakdown: MindFactorBreakdown[] = [
    {
      label: '目标对齐',
      value: simulation.goalAlignment,
      reason: simulation.goalAlignment > 0.7 ? '行动符合长远目标' : simulation.goalAlignment > 0.4 ? '行动与目标部分一致' : '行动与目标偏差较大',
    },
    {
      label: '暴露风险',
      value: 1 - simulation.exposureRisk,
      reason: simulation.exposureRisk > 0.6 ? '高暴露风险，容易被识破' : simulation.exposureRisk > 0.3 ? '中等暴露风险' : '暴露风险低，隐蔽性好',
    },
  ];

  if (simulation.expectedReactions.size > 0) {
    const reactions = Array.from(simulation.expectedReactions.entries()).slice(0, 3);
    for (const [pid, reaction] of reactions) {
      const player = allPlayers.find(p => p.id === pid);
      breakdown.push({
        label: `预期反应(${player?.name || pid})`,
        value: reaction.confidence,
        reason: reaction.reaction,
      });
    }
  }

  const reason = simulationScore > 0.8 ? '模拟结果优秀，预期反应有利'
    : simulationScore > 0.5 ? '模拟结果一般，存在一定风险'
    : '模拟结果不佳，预期不利反应较多';
  return { score: simulationScore, reason, breakdown };
}

// ========== 危机详情 ==========

export function buildCrisisDetail(
  action: string,
  crisis: { isCritical: boolean; isHigh: boolean },
  crisisFactor: number
): MindFactorDetail {
  const breakdown: MindFactorBreakdown[] = [];

  if (crisis.isCritical) {
    breakdown.push({
      label: '危机状态',
      value: 1,
      reason: '身份危机危急，行动选择受限',
    });
  } else if (crisis.isHigh) {
    breakdown.push({
      label: '危机状态',
      value: 0.5,
      reason: '身份危机较高，需谨慎行动',
    });
  } else {
    breakdown.push({
      label: '危机状态',
      value: 0,
      reason: '身份危机安全，行动不受限制',
    });
  }

  const actionReasons: Record<string, string> = {
    [ACTION.SILENCE]: '危急时沉默可降低暴露',
    [ACTION.OBSERVE]: '危急时观察比行动更安全',
    [ACTION.DEFEND]: '危急时辩护风险极高',
    [ACTION.REBUT]: '危急时反驳可能激化矛盾',
    [ACTION.ACCUSE]: '危急时指认风险极高',
    [ACTION.CALL_VOTE]: '危急时号召投票风险极高',
    [ACTION.CLAIM_IDENTITY]: '危急时跳身份风险极高',
  };
  breakdown.push({
    label: '行动影响',
    value: crisisFactor,
    reason: actionReasons[action] || `危急时执行该行动的影响`,
  });

  const reason = crisisFactor > 1 ? '危机加剧，该行动反而更有利'
    : crisisFactor < 1 ? '危机状态对该行动不利'
    : '危机状态对行动无显著影响';
  return { score: crisisFactor, reason, breakdown };
}

// ========== 关系详情 ==========

export function buildRelationDetail(
  target: string | null,
  relationNetwork: RelationNetwork,
  allPlayers: Player[],
  relationFactor: number
): MindFactorDetail {
  const breakdown: MindFactorBreakdown[] = [];

  if (!target) {
    breakdown.push({
      label: '关系影响',
      value: 1,
      reason: '无目标，关系因素不影响',
    });
    return { score: 1, reason: '无特定目标', breakdown };
  }

  const view = relationNetwork.myView.get(target);
  if (!view) {
    breakdown.push({
      label: '关系影响',
      value: 1,
      reason: '对目标不了解，关系因素中性',
    });
    return { score: 1, reason: '对目标关系未知', breakdown };
  }

  const targetPlayer = allPlayers.find(p => p.id === target);
  const targetName = targetPlayer?.name || target;

  breakdown.push({
    label: '信任度',
    value: view.trust,
    reason: view.trust > 5 ? `高度信任${targetName}` : view.trust > 0 ? `对${targetName}有一定信任` : `不信任${targetName}`,
  });

  if (view.inferredTeam !== 'unknown') {
    breakdown.push({
      label: '阵营推断',
      value: view.confidence,
      reason: `推断${targetName}是${view.inferredTeam === 'werewolf' ? '狼人' : '好人'}(置信度${(view.confidence * 100).toFixed(0)}%)`,
    });
  }

  const reason = view.trust > 5 ? '对目标高度信任，影响行动倾向'
    : view.inferredTeam === 'werewolf' && view.confidence > 0.6 ? '推断目标是狼人，攻击倾向增强'
    : '关系因素对行动影响一般';
  return { score: relationFactor, reason, breakdown };
}

// ========== 社交情境详情 ==========

export function buildSocialContextDetail(
  action: string,
  socialContext: SocialContext,
  socialContextBonus: number
): MindFactorDetail {
  const breakdown: MindFactorBreakdown[] = [];
  const { situation } = socialContext;

  if (action === ACTION.SILENCE && situation.tensionLevel > 0.7) {
    breakdown.push({
      label: '紧张氛围',
      value: situation.tensionLevel,
      reason: '场面紧张，沉默降低存在感',
    });
  }

  if ((action === ACTION.REBUT || action === ACTION.DEFEND) && situation.myPosition === 'target') {
    breakdown.push({
      label: '自身位置',
      value: 1,
      reason: '被攻击目标，防御行动正当性高',
    });
  }

  if (action === ACTION.CALL_VOTE && situation.myPosition === 'leader') {
    breakdown.push({
      label: '领导地位',
      value: 1,
      reason: '处于领导位置，号召投票影响力大',
    });
  }

  if (action === ACTION.OBSERVE && situation.informationRichness > 0.8) {
    breakdown.push({
      label: '信息饱和',
      value: situation.informationRichness,
      reason: '信息已充分，继续观察收益低',
    });
  }

  if (breakdown.length === 0) {
    breakdown.push({
      label: '社交情境',
      value: 1,
      reason: '当前情境对该行动无特殊影响',
    });
  }

  const reason = socialContextBonus > 1 ? '社交情境对行动有利'
    : socialContextBonus < 1 ? '社交情境对行动不利'
    : '社交情境对行动无显著影响';
  return { score: socialContextBonus, reason, breakdown };
}

// ========== 能力详情 ==========

export function buildCapabilityDetail(
  match: ReturnType<typeof calculateCapabilityMatch>,
  capabilityFactor: number
): MindFactorDetail {
  const breakdown: MindFactorBreakdown[] = [
    {
      label: `主要属性(${match.primaryValue})`,
      value: match.primaryValue / match.difficulty,
      reason: `${match.description}，需要${match.difficulty}，实际${match.primaryValue}`,
    },
  ];

  if (match.secondaryValue !== null) {
    breakdown.push({
      label: `次要属性(${match.secondaryValue})`,
      value: (match.secondaryValue || 0) / match.difficulty,
      reason: `次要属性匹配度${((match.secondaryValue || 0) / match.difficulty * 100).toFixed(0)}%`,
    });
  }

  breakdown.push({
    label: '综合匹配度',
    value: match.matchScore,
    reason: match.matchScore > 0.8 ? '非常擅长此行动' : match.matchScore > 0.5 ? '能力匹配' : '不擅长此行动',
  });

  const reason = capabilityFactor > 1.2 ? '能力出众，行动效果加成'
    : capabilityFactor < 0.8 ? '能力不足，行动效果减成'
    : '能力适中，对行动无显著影响';
  return { score: capabilityFactor, reason, breakdown };
}
