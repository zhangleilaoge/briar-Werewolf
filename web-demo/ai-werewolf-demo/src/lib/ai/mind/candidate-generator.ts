import type { BeliefSystem } from '../belief-system';
import type { Player, DecisionCandidate } from '@/types';
import type { SocialContext, ValueSystem } from './types';
import { ACTION } from '@/lib/constants/action-constants';

/** L0 事实内容类型 */
interface ActionContent {
  type: string;
  actorId: string;
  targetId?: string;
}

interface CheckContent {
  result: 'werewolf' | 'villager';
  targetId: string;
}

function isActionContent(content: Record<string, unknown>): content is ActionContent {
  return typeof content.type === 'string' && typeof content.actorId === 'string';
}

function isCheckContent(content: Record<string, unknown>): content is CheckContent {
  return typeof content.result === 'string' && typeof content.targetId === 'string';
}
import {
  INTENTION_BASE_SCORE_SELF_PRESERVATION,
  INTENTION_BASE_SCORE_INFORMATION,
  INTENTION_BASE_SCORE_SOCIAL,
  INTENTION_BASE_SCORE_ATTACK,
  INTENTION_BASE_SCORE_PROTECTION,
  INTENTION_BASE_SCORE_DEFAULT,
  INTENTION_BASE_SCORE_DEFAULT_OBSERVE,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM_HIGH,
  CONFIDENCE_MEDIUM,
  CONFIDENCE_LOW_MEDIUM,
  CONFIDENCE_LOW,
  CONFIDENCE_VERY_LOW,
  PROB_THRESHOLD_HIGH,
  PROB_THRESHOLD_MEDIUM,
  PROB_THRESHOLD_LOW,
  INFORMATION_RICHNESS_THRESHOLD,
  ATTRIBUTE_LEADERSHIP_HIGH,
  ATTACK_COUNT_THRESHOLD,
} from '@/lib/constants/mind';

export class CandidateGenerator {
  generate(
    socialContext: SocialContext,
    valueSystem: ValueSystem,
    self: Player,
    allPlayers: Player[],
    belief: BeliefSystem,
    isWerewolf?: boolean
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 1. 自我保护意图（高优先级）
    candidates.push(...this._generateSelfPreservation(socialContext, self, belief));

    // 2. 信息收集意图
    candidates.push(...this._generateInformationGathering(socialContext, self, allPlayers, isWerewolf));

    // 3. 社交操控意图
    candidates.push(...this._generateSocialManipulation(socialContext, valueSystem, self, allPlayers, belief));

    // 4. 攻击/怀疑意图
    candidates.push(...this._generateAttack(self, allPlayers, belief));

    // 5. 保护/支持意图
    candidates.push(...this._generateProtection(socialContext, self, allPlayers, belief));

    // 6. 沉默/观察意图（默认）
    candidates.push(...this._generateDefault(self, allPlayers));

    return candidates;
  }

  private _generateSelfPreservation(
    socialContext: SocialContext,
    self: Player,
    belief: BeliefSystem
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 被攻击时：反驳、自辩
    const attacksOnMe = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action' && isActionContent(f.content) && f.content.targetId === self.id
        && (f.content.type === ACTION.SUSPECT || f.content.type === ACTION.ACCUSE));

    if (attacksOnMe.length > 0) {
      const attacker = attacksOnMe[0];
      const attackerId = isActionContent(attacker.content) ? attacker.content.actorId : undefined;

      // 反驳规则（无条件执行）
      candidates.push({
        action: ACTION.REBUT,
        target: attackerId,
        score: INTENTION_BASE_SCORE_SELF_PRESERVATION,
        confidence: CONFIDENCE_MEDIUM_HIGH,
        reason: '被攻击，需要为自己辩护',
        strategy: 'CandidateGenerator',
        rule: 'self_preservation_rebut',
      });

      // 反咬规则（条件执行）
      const attackerWolfProb = belief.getWerewolfProbability(attackerId);
      if (attackerWolfProb > PROB_THRESHOLD_MEDIUM) {
        candidates.push({
          action: ACTION.ACCUSE,
          target: attackerId,
          score: INTENTION_BASE_SCORE_ATTACK,
          confidence: CONFIDENCE_MEDIUM,
          reason: '被攻击，反咬对方可能是狼人',
          strategy: 'CandidateGenerator',
          rule: 'self_preservation_accuse',
        });
      }
    }

    // 身份危机高时：沉默、隐藏
    if (socialContext.identityCrisis.isHigh) {
      candidates.push({
        action: ACTION.SILENCE,
        target: null,
        score: INTENTION_BASE_SCORE_SOCIAL,
        confidence: CONFIDENCE_MEDIUM,
        reason: '身份危机高，选择沉默自保',
        strategy: 'CandidateGenerator',
        rule: 'self_preservation_silence',
      });
    }

    return candidates;
  }

  private _generateInformationGathering(
    socialContext: SocialContext,
    self: Player,
    allPlayers: Player[],
    isWerewolf?: boolean
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 信息收集规则配置表
    const infoRules = [
      {
        id: 'information_observe',
        condition: () => socialContext.situation.informationRichness < INFORMATION_RICHNESS_THRESHOLD,
        generate: () => {
          const aliveOthers = allPlayers.filter(p => p.id !== self.id && p.alive && p.team !== self.team);
          if (aliveOthers.length === 0) return null;
          const randomTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
          return {
            action: ACTION.OBSERVE,
            target: randomTarget.id,
            score: INTENTION_BASE_SCORE_INFORMATION,
            confidence: CONFIDENCE_LOW,
            reason: `信息不足，观察${randomTarget.name}获取更多情报`,
            strategy: 'CandidateGenerator',
            rule: 'information_observe',
          };
        },
      },
    ];

    for (const rule of infoRules) {
      if (rule.condition()) {
        const candidate = rule.generate();
        if (candidate) candidates.push(candidate);
      }
    }

    // 有信息缺口时：公开信息（如果验到狼人）
    const knownChecks = socialContext.informationState.knownFacts
      .filter(f => f.type === 'check' && isCheckContent(f.content) && f.content.result === 'werewolf');

    for (const check of knownChecks) {
      const targetId = isCheckContent(check.content) ? check.content.targetId : undefined;
      const target = allPlayers.find(p => p.id === targetId);
      if (target?.alive) {
        // 狼人验到狼人时不会公开，村民会公开
        if (!isWerewolf) {
          candidates.push({
            action: ACTION.CLAIM_IDENTITY,
            target: null,
            score: INTENTION_BASE_SCORE_SELF_PRESERVATION,
            confidence: CONFIDENCE_HIGH,
            reason: `验到${target.name}是狼人，公布身份`,
            strategy: 'CandidateGenerator',
            rule: 'information_claim',
            details: { claimedRole: self.role, checkResult: 'werewolf', checkTarget: targetId },
          });
        }
      }
    }

    return candidates;
  }

  private _generateSocialManipulation(
    socialContext: SocialContext,
    valueSystem: ValueSystem,
    self: Player,
    allPlayers: Player[],
    belief: BeliefSystem
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 社交操控规则配置表
    const socialRules = [
      {
        id: 'social_call_vote',
        condition: () => self.attributes.leadership > ATTRIBUTE_LEADERSHIP_HIGH && socialContext.situation.myPosition === 'leader',
        generate: () => {
          const topSuspect = this._getTopSuspect(belief, allPlayers, self);
          if (!topSuspect) return null;
          return {
            action: ACTION.CALL_VOTE,
            target: topSuspect.id,
            score: INTENTION_BASE_SCORE_SOCIAL,
            confidence: CONFIDENCE_MEDIUM,
            reason: `领导属性高，号召投票给${topSuspect.name}`,
            strategy: 'CandidateGenerator',
            rule: 'social_call_vote',
          };
        },
      },
      {
        id: 'social_exclude_all',
        condition: () => valueSystem.truthSeeking < PROB_THRESHOLD_LOW && valueSystem.dominance > PROB_THRESHOLD_HIGH,
        generate: () => {
          const claims = socialContext.informationState.knownFacts.filter(f => f.type === 'claim');
          if (claims.length < ATTACK_COUNT_THRESHOLD) return null;
          return {
            action: ACTION.EXCLUDE_ALL,
            target: null,
            score: INTENTION_BASE_SCORE_PROTECTION,
            confidence: CONFIDENCE_LOW_MEDIUM,
            reason: '场面混乱，提议全员排除搅浑水',
            strategy: 'CandidateGenerator',
            rule: 'social_exclude_all',
          };
        },
      },
    ];

    for (const rule of socialRules) {
      if (rule.condition()) {
        const candidate = rule.generate();
        if (candidate) candidates.push(candidate);
      }
    }

    return candidates;
  }

  private _generateAttack(
    self: Player,
    allPlayers: Player[],
    belief: BeliefSystem
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    const topSuspect = this._getTopSuspect(belief, allPlayers, self);
    if (!topSuspect) return candidates;

    const wolfProb = belief.getWerewolfProbability(topSuspect.id);

    // 配置表：按阈值从高到低匹配，只执行第一个命中的规则
    const attackRules = [
      {
        threshold: PROB_THRESHOLD_HIGH,
        action: ACTION.ACCUSE,
        score: INTENTION_BASE_SCORE_ATTACK,
        confidence: CONFIDENCE_MEDIUM_HIGH,
        reason: (name: string) => `${name}狼概率高，强烈指认`,
        rule: 'attack_accuse',
      },
      {
        threshold: PROB_THRESHOLD_MEDIUM,
        action: ACTION.SUSPECT,
        score: 300,
        confidence: CONFIDENCE_MEDIUM,
        reason: (name: string) => `${name}有点可疑`,
        rule: 'attack_suspect',
      },
    ];

    for (const rule of attackRules) {
      if (wolfProb > rule.threshold) {
        candidates.push({
          action: rule.action,
          target: topSuspect.id,
          score: rule.score,
          confidence: rule.confidence,
          reason: rule.reason(topSuspect.name),
          strategy: 'CandidateGenerator',
          rule: rule.rule,
        });
        break; // 只匹配第一个命中的规则
      }
    }

    return candidates;
  }

  private _generateProtection(
    socialContext: SocialContext,
    self: Player,
    allPlayers: Player[],
    belief: BeliefSystem
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 保护规则配置表：对每个玩家评估保护条件
    for (const player of allPlayers) {
      if (player.id === self.id || !player.alive) continue;
      if (self.team === 'werewolf' && player.team === 'werewolf') continue;

      const attacksOnPlayer = socialContext.informationState.knownFacts
        .filter(f => f.type === 'action' && isActionContent(f.content) && f.content.targetId === player.id
          && (f.content.type === ACTION.SUSPECT || f.content.type === ACTION.ACCUSE));

      const protectionRule = {
        condition: () => attacksOnPlayer.length >= ATTACK_COUNT_THRESHOLD,
        generate: () => {
          const playerWolfProb = belief.getWerewolfProbability(player.id);
          if (playerWolfProb >= PROB_THRESHOLD_LOW) return null;
          return {
            action: ACTION.DEFEND,
            target: player.id,
            score: INTENTION_BASE_SCORE_PROTECTION,
            confidence: CONFIDENCE_LOW_MEDIUM,
            reason: `${player.name}被多人攻击，但看起来不像狼人，辩护一下`,
            strategy: 'CandidateGenerator',
            rule: 'protection_defend',
          };
        },
      };

      if (protectionRule.condition()) {
        const candidate = protectionRule.generate();
        if (candidate) candidates.push(candidate);
      }
    }

    return candidates;
  }

  private _generateDefault(
    self: Player,
    allPlayers: Player[]
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 默认行为配置表
    const defaultRules = [
      {
        action: ACTION.SILENCE,
        target: null as string | null,
        score: INTENTION_BASE_SCORE_DEFAULT,
        confidence: CONFIDENCE_LOW_MEDIUM,
        reason: '没什么特别想说的',
        rule: 'default_silence',
      },
    ];

    for (const rule of defaultRules) {
      candidates.push({
        action: rule.action,
        target: rule.target,
        score: rule.score,
        confidence: rule.confidence,
        reason: rule.reason,
        strategy: 'CandidateGenerator',
        rule: rule.rule,
      });
    }

    // 随机观察（需要动态 target）
    const aliveOthers = allPlayers.filter(p => p.id !== self.id && p.alive && p.team !== self.team);
    if (aliveOthers.length > 0) {
      const randomTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
      candidates.push({
        action: ACTION.OBSERVE,
        target: randomTarget.id,
        score: INTENTION_BASE_SCORE_DEFAULT_OBSERVE,
        confidence: CONFIDENCE_VERY_LOW,
        reason: `观察${randomTarget.name}看看`,
        strategy: 'CandidateGenerator',
        rule: 'default_observe',
      });
    }

    return candidates;
  }

  private _getTopSuspect(belief: BeliefSystem, allPlayers: Player[], self: Player): Player | null {
    const aliveOthers = allPlayers.filter(p => p.id !== self.id && p.alive && p.team !== self.team);
    if (aliveOthers.length === 0) return null;

    const suspectRanking = belief.getSuspectRanking(allPlayers);
    if (suspectRanking.length === 0) return null;

    const topId = suspectRanking[0].id;
    return allPlayers.find(p => p.id === topId) || null;
  }
}
