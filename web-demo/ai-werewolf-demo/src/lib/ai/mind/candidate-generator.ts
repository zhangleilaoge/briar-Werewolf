import type { BeliefSystem } from '../belief-system';
import type { Player, DecisionCandidate } from '@/types';
import type { SocialContext, ValueSystem } from './types';
import { ACTION } from '@/lib/constants/action-constants';
import type { StrategyMask } from '../mask';
import { MASK_COMPATIBILITY } from '../mask';

/** L0 事实内容类型 */
interface ActionContent {
  type: string;
  actorId: string;
  targetId?: string;
  [key: string]: unknown;
}

function isActionContent(content: Record<string, unknown>): content is ActionContent {
  return typeof content.type === 'string' && typeof content.actorId === 'string';
}
import {
  INTENTION_BASE_SCORE_INFORMATION,
  INTENTION_BASE_SCORE_SOCIAL,
  INTENTION_BASE_SCORE_ATTACK,
  INTENTION_BASE_SCORE_PROTECTION,
  INTENTION_BASE_SCORE_DEFAULT,
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
} from '@/lib/constants/mind';

// 所有白天行动
const ALL_DAY_ACTIONS = [
  ACTION.SILENCE,
  ACTION.CLAIM_IDENTITY,
  ACTION.REVEAL_INFO,
  ACTION.OBSERVE,
  ACTION.SUSPECT,
  ACTION.DEFEND,
  ACTION.CALL_VOTE,
  ACTION.BLOCK_VOTE,
  ACTION.GUARANTEE,
  ACTION.ACCUSE,
  ACTION.EXCLUDE_ALL,
];

export class CandidateGenerator {
  generate(
    socialContext: SocialContext,
    valueSystem: ValueSystem,
    self: Player,
    allPlayers: Player[],
    belief: BeliefSystem,
    mask: StrategyMask,           // 新增：当前策略面具
    isWerewolf?: boolean
  ): DecisionCandidate[] {
    const candidates: DecisionCandidate[] = [];

    // 遍历所有可用行动，不是 if-else 条件链
    for (const actionType of ALL_DAY_ACTIONS) {
      // 检查行动是否可用（特定条件限制）
      if (!this._isActionAvailable(actionType, self, belief, allPlayers, socialContext, mask)) {
        continue;
      }

      // 获取基础分
      const baseScore = this._getActionBaseScore(actionType, self, belief, allPlayers, socialContext, mask, isWerewolf);
      if (baseScore === null) continue; // 该行动在此局势下不应生成

      // 面具适配度
      const compatibility = MASK_COMPATIBILITY[actionType]?.[mask] ?? 0.5;

      // 选择目标
      const target = this._selectTarget(actionType, self, belief, allPlayers, socialContext, mask, isWerewolf);

      // 构建候选
      const candidate: DecisionCandidate = {
        action: actionType,
        target: target?.id ?? null,
        score: Math.round(baseScore * compatibility),
        confidence: this._getActionConfidence(actionType),
        reason: this._getActionReason(actionType, mask, target, self, belief, allPlayers, socialContext),
        strategy: 'CandidateGenerator',
        rule: `mask_${mask}_${actionType}`,
        // 新增字段供调试和心智加权使用
        maskCompatibility: compatibility,
      };

      // CLAIM_IDENTITY: 设置 claimedRole 详情供 simulator 使用
      if (actionType === ACTION.CLAIM_IDENTITY) {
        const claimedRole = self.role === 'prophet' ? 'prophet' : (isWerewolf ? 'prophet' : self.role);
        candidate.details = { claimedRole };
      }

      candidates.push(candidate);
    }

    return candidates;
  }

  // 辅助：检查是否有未公布的查验结果
  private _hasUnrevealedChecks(self: Player, belief: BeliefSystem): boolean {
    if (self.role !== 'prophet') return false;
    const checks = Object.entries(belief.l0Facts.checks);
    return checks.some(([targetId, _result]) => {
      const alreadyClaimed = belief.l0Facts.publicClaims.some(
        c => c.playerId === self.id && c.claim === 'prophet_check' && (c.content as any).targetId === targetId
      );
      return !alreadyClaimed;
    });
  }

  // ========== 行动可用性判断 ==========
  // 某些行动需要特定局势条件才生成
  private _isActionAvailable(
    actionType: string,
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext,
    mask: StrategyMask
  ): boolean {
    // BLOCK_VOTE: 需要有人号召投票
    if (actionType === ACTION.BLOCK_VOTE) {
      const hasCallVote = socialContext.informationState.knownFacts.some(
        f => f.type === 'action' && isActionContent(f.content as Record<string, unknown>) && (f.content as ActionContent).type === ACTION.CALL_VOTE
      );
      return hasCallVote;
    }

    // CLAIM_IDENTITY: 已声称过则不再生成，但预言家有未公布查验时例外
    if (actionType === ACTION.CLAIM_IDENTITY) {
      if (self.identityClaim?.hasClaimed) {
        // 预言家已声称过身份，但还有未公布的查验，可以继续生成
        return this._hasUnrevealedChecks(self, belief);
      }
      return true; // 未声称过，可用
    }

    // 其他行动默认可用
    return true;
  }

  // ========== 基础分计算 ==========
  // 返回 null 表示该行动在当前局势下不应生成
  private _getActionBaseScore(
    actionType: string,
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext,
    mask: StrategyMask,
    isWerewolf?: boolean
  ): number | null {
    switch (actionType) {
      case ACTION.SILENCE:
        return INTENTION_BASE_SCORE_DEFAULT;

      case ACTION.OBSERVE:
        return INTENTION_BASE_SCORE_INFORMATION;

      case ACTION.SUSPECT: {
        const topSuspect = this._getTopSuspect(belief, allPlayers, self);
        if (!topSuspect) return null;
        const wolfProb = belief.getWerewolfProbability(topSuspect.id);
        if (wolfProb <= PROB_THRESHOLD_MEDIUM) return null; // 没有足够可疑目标
        return 300; // 低于 ACCUSE 的 400
      }

      case ACTION.ACCUSE: {
        const topSuspect = this._getTopSuspect(belief, allPlayers, self);
        if (!topSuspect) return null;
        const wolfProb = belief.getWerewolfProbability(topSuspect.id);
        if (wolfProb <= PROB_THRESHOLD_HIGH) return null; // 没有高可疑目标
        return INTENTION_BASE_SCORE_ATTACK;
      }

      case ACTION.DEFEND: {
        // 保护被攻击的信任目标
        const protectTarget = this._selectProtectTarget(self, belief, allPlayers, socialContext, mask);
        if (!protectTarget) return null;
        return INTENTION_BASE_SCORE_PROTECTION;
      }

      case ACTION.GUARANTEE: {
        // 担保被攻击的信任目标（比 DEFEND 要求更高信任度）
        const guaranteeTarget = this._selectGuaranteeTarget(self, belief, allPlayers, socialContext, mask);
        if (!guaranteeTarget) return null;
        return INTENTION_BASE_SCORE_PROTECTION + 50; // 略高于 DEFEND
      }

      case ACTION.CALL_VOTE: {
        const topSuspect = this._getTopSuspect(belief, allPlayers, self);
        if (!topSuspect) return null;
        // 领导属性高或局势需要
        if (self.attributes.leadership < ATTRIBUTE_LEADERSHIP_HIGH && mask !== 'attack' && mask !== 'desperate') {
          return null; // 低领导力且非进攻面具，通常不号召投票
        }
        return INTENTION_BASE_SCORE_SOCIAL;
      }

      case ACTION.BLOCK_VOTE: {
        // 阻止投票目标选择
        const blockTarget = this._selectBlockVoteTarget(self, belief, allPlayers, socialContext, mask);
        if (!blockTarget) return null;
        return INTENTION_BASE_SCORE_SOCIAL;
      }

      case ACTION.EXCLUDE_ALL: {
        // 需要场面混乱
        if (socialContext.situation.tensionLevel < 0.5) return null;
        return INTENTION_BASE_SCORE_PROTECTION;
      }

      case ACTION.CLAIM_IDENTITY: {
        // 身份声称的基础分（身份特定）
        return this._getClaimIdentityBaseScore(self, belief, allPlayers, socialContext, mask, isWerewolf);
      }

      case ACTION.REVEAL_INFO: {
        // 目前不主动生成，由 CLAIM_IDENTITY 触发
        return null;
      }

      default:
        return null;
    }
  }

  // ========== 目标选择 ==========
  private _selectTarget(
    actionType: string,
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext,
    mask: StrategyMask,
    isWerewolf?: boolean
  ): Player | null {
    switch (actionType) {
      case ACTION.SUSPECT:
      case ACTION.ACCUSE:
      case ACTION.CALL_VOTE:
        return this._getTopSuspect(belief, allPlayers, self);

      case ACTION.DEFEND:
        return this._selectProtectTarget(self, belief, allPlayers, socialContext, mask);

      case ACTION.GUARANTEE:
        return this._selectGuaranteeTarget(self, belief, allPlayers, socialContext, mask);

      case ACTION.BLOCK_VOTE:
        return this._selectBlockVoteTarget(self, belief, allPlayers, socialContext, mask);

      case ACTION.OBSERVE:
        return this._selectObserveTarget(self, allPlayers, belief, mask, isWerewolf);

      case ACTION.CLAIM_IDENTITY:
        // 目标为 null，但 details 中会包含 claimedRole
        return null;

      default:
        return null;
    }
  }

  // ========== 各目标选择器 ==========

  private _selectProtectTarget(
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext,
    mask: StrategyMask
  ): Player | null {
    const candidates = allPlayers.filter(p => {
      if (p.id === self.id || !p.alive) return false;
      // 被攻击
      const isAttacked = socialContext.informationState.knownFacts.some(
        f => f.type === 'action' && isActionContent(f.content as Record<string, unknown>)
          && (f.content as ActionContent).targetId === p.id
          && ((f.content as ActionContent).type === ACTION.SUSPECT || (f.content as ActionContent).type === ACTION.ACCUSE)
      );
      if (!isAttacked) return false;
      // 信任度足够高
      const relation = belief.getRelation(p.id);
      return relation.trust > 2;
    });

    if (candidates.length === 0) return null;

    // 按面具优先级排序
    candidates.sort((a, b) => {
      const aWolfProb = belief.getWerewolfProbability(a.id);
      const bWolfProb = belief.getWerewolfProbability(b.id);
      const aTrust = belief.getRelation(a.id).trust;
      const bTrust = belief.getRelation(b.id).trust;

      switch (mask) {
        case 'protective':
          // 优先保护高信任目标
          return bTrust - aTrust;
        case 'conceal':
          // 保护看起来像好人的目标（建立信任）
          return (1 - aWolfProb) - (1 - bWolfProb);
        case 'cut_loss':
          // 保护队友（狼人）
          const aTeammate = a.team === self.team ? 1 : 0;
          const bTeammate = b.team === self.team ? 1 : 0;
          return bTeammate - aTeammate;
        default:
          return bTrust - aTrust;
      }
    });

    return candidates[0];
  }

  private _selectGuaranteeTarget(
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext,
    mask: StrategyMask
  ): Player | null {
    // 担保比 DEFEND 要求更高信任度（trust > 4）
    const candidates = allPlayers.filter(p => {
      if (p.id === self.id || !p.alive) return false;
      const isAttacked = socialContext.informationState.knownFacts.some(
        f => f.type === 'action' && isActionContent(f.content as Record<string, unknown>)
          && (f.content as ActionContent).targetId === p.id
          && ((f.content as ActionContent).type === ACTION.SUSPECT || (f.content as ActionContent).type === ACTION.ACCUSE)
      );
      if (!isAttacked) return false;
      const relation = belief.getRelation(p.id);
      return relation.trust > 4;
    });

    if (candidates.length === 0) return null;

    // 按信任度排序
    candidates.sort((a, b) => belief.getRelation(b.id).trust - belief.getRelation(a.id).trust);
    return candidates[0];
  }

  private _selectBlockVoteTarget(
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext,
    mask: StrategyMask
  ): Player | null {
    // 找出被号召投票的目标
    const calledVoteTargets = socialContext.informationState.knownFacts
      .filter(f => f.type === 'action' && isActionContent(f.content as Record<string, unknown>) && (f.content as ActionContent).type === ACTION.CALL_VOTE)
      .map(f => (f.content as ActionContent).targetId)
      .filter((id): id is string => id !== undefined);

    if (calledVoteTargets.length === 0) return null;

    const candidates = calledVoteTargets.map(targetId => {
      const target = allPlayers.find(p => p.id === targetId);
      if (!target || !target.alive) return null;

      const wolfProb = belief.getWerewolfProbability(targetId);
      const isTeammate = self.team === 'werewolf' && target.team === 'werewolf';
      const relation = belief.getRelation(targetId);

      let priority = 0;
      switch (mask) {
        case 'conceal':
          priority = (1 - wolfProb) * 100; // 保护看起来像好人的目标
          break;
        case 'manipulative':
          priority = (1 - wolfProb) * 60 + relation.trust * 5;
          break;
        case 'attack':
          priority = (1 - wolfProb) * 80 + (isTeammate ? 20 : 0);
          break;
        case 'cut_loss':
          priority = isTeammate ? 100 : 0;
          break;
        case 'protective':
          priority = relation.trust * 15 + (isTeammate ? 30 : 0);
          break;
        case 'defensive':
          priority = targetId === self.id ? 100 : relation.trust * 10;
          break;
        case 'desperate':
          priority = 0; // 绝境不阻止
          break;
      }

      return { targetId, priority };
    }).filter((item): item is { targetId: string; priority: number } => item !== null);

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.priority - a.priority);
    return allPlayers.find(p => p.id === candidates[0].targetId) || null;
  }

  private _selectObserveTarget(
    self: Player,
    allPlayers: Player[],
    belief: BeliefSystem,
    mask: StrategyMask,
    isWerewolf?: boolean
  ): Player | null {
    // 村民观察所有活着的其他人，狼人优先观察非队友
    const aliveOthers = allPlayers.filter(p => p.id !== self.id && p.alive);
    if (aliveOthers.length === 0) return null;

    let candidatePool = aliveOthers;
    if (isWerewolf) {
      const nonTeammates = aliveOthers.filter(p => p.team !== self.team);
      if (nonTeammates.length > 0) candidatePool = nonTeammates;
    }

    if (mask === 'conceal' || mask === 'defensive') {
      // 随机观察
      return candidatePool[Math.floor(Math.random() * candidatePool.length)];
    }

    // 其他面具：优先观察高嫌疑目标
    candidatePool.sort((a, b) => belief.getWerewolfProbability(b.id) - belief.getWerewolfProbability(a.id));
    return candidatePool[0];
  }

  // ========== 身份声称基础分 ==========
  private _getClaimIdentityBaseScore(
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext,
    mask: StrategyMask,
    isWerewolf?: boolean
  ): number | null {
    // 强信息角色：有硬信息时基础分高
    if (self.role === 'prophet') {
      const checks = Object.entries(belief.l0Facts.checks);
      const unrevealed = checks.find(([targetId, result]) => {
        const alreadyClaimed = belief.l0Facts.publicClaims.some(
          c => c.playerId === self.id && c.claim === 'prophet_check' && (c.content as any).targetId === targetId
        );
        return !alreadyClaimed;
      });
      if (unrevealed) {
        const result = unrevealed[1];
        // 查杀(0.65) > 金水(0.45)
        return result === 'werewolf' ? 650 : 450;
      }
    }

    // 狼人伪装：根据面具决定基础分
    if (isWerewolf) {
      if (mask === 'attack' || mask === 'desperate') {
        return 400; // 进攻时伪装带节奏
      }
      if (mask === 'manipulative') {
        return 300; // 操纵时伪装搅局
      }
      return 200; // 默认潜伏时低概率伪装
    }

    // 其他身份：通常不主动跳
    return 100;
  }

  // ========== 信心值 ==========
  private _getActionConfidence(actionType: string): number {
    switch (actionType) {
      case ACTION.SILENCE: return CONFIDENCE_LOW_MEDIUM;
      case ACTION.OBSERVE: return CONFIDENCE_LOW;
      case ACTION.SUSPECT: return CONFIDENCE_MEDIUM;
      case ACTION.ACCUSE: return CONFIDENCE_MEDIUM_HIGH;
      case ACTION.DEFEND: return CONFIDENCE_LOW_MEDIUM;
      case ACTION.GUARANTEE: return CONFIDENCE_MEDIUM;
      case ACTION.CALL_VOTE: return CONFIDENCE_MEDIUM;
      case ACTION.BLOCK_VOTE: return CONFIDENCE_LOW_MEDIUM;
      case ACTION.EXCLUDE_ALL: return CONFIDENCE_LOW_MEDIUM;
      case ACTION.CLAIM_IDENTITY: return CONFIDENCE_HIGH;
      default: return CONFIDENCE_LOW;
    }
  }

  // ========== 原因文本 ==========
  private _getActionReason(
    actionType: string,
    mask: StrategyMask,
    target: Player | null,
    self: Player,
    belief: BeliefSystem,
    allPlayers: Player[],
    socialContext: SocialContext
  ): string {
    const targetName = target?.name ?? '无';
    switch (actionType) {
      case ACTION.SILENCE:
        return `${mask}模式下，选择沉默观察`;
      case ACTION.OBSERVE:
        return `信息不足，观察${targetName}获取更多情报`;
      case ACTION.SUSPECT:
        return `${targetName}有点可疑，${mask}模式下怀疑试探`;
      case ACTION.ACCUSE:
        return `${targetName}狼概率高，${mask}模式下强烈指认`;
      case ACTION.DEFEND:
        return `${targetName}被攻击，${mask}模式下辩护保护`;
      case ACTION.GUARANTEE:
        return `${targetName}不像狼人，${mask}模式下担保清白`;
      case ACTION.CALL_VOTE:
        return `${mask}模式下，号召投票给${targetName}`;
      case ACTION.BLOCK_VOTE:
        return `${mask}模式下，阻止对${targetName}的投票`;
      case ACTION.EXCLUDE_ALL:
        return `${mask}模式下，提议全员排除搅浑水`;
      case ACTION.CLAIM_IDENTITY:
        if (self.role === 'prophet') {
          const checks = Object.entries(belief.l0Facts.checks);
          const unrevealed = checks.find(([targetId, result]) => {
            const alreadyClaimed = belief.l0Facts.publicClaims.some(
              c => c.playerId === self.id && c.claim === 'prophet_check' && (c.content as any).targetId === targetId
            );
            return !alreadyClaimed;
          });
          if (unrevealed) {
            const result = unrevealed[1];
            const targetId = unrevealed[0];
            const targetPlayer = allPlayers.find(p => p.id === targetId);
            return `${mask}模式下，作为预言家公布查验结果：${targetPlayer?.name ?? targetId}是${result === 'werewolf' ? '狼人' : '村民'}`;
          }
        }
        return `${mask}模式下，声称身份`;
      default:
        return `${mask}模式下执行${actionType}`;
    }
  }

  // ========== 辅助方法 ==========

  private _getTopSuspect(belief: BeliefSystem, allPlayers: Player[], self: Player): Player | null {
    const aliveOthers = allPlayers.filter(p => p.id !== self.id && p.alive && p.team !== self.team);
    if (aliveOthers.length === 0) return null;

    const suspectRanking = belief.getSuspectRanking(aliveOthers);
    if (suspectRanking.length === 0) return null;

    const topId = suspectRanking[0].id;
    return aliveOthers.find(p => p.id === topId) || null;
  }
}

