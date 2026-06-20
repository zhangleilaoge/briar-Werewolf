import type { BeliefSystem } from '../belief-system';
import type { Player } from '@/types';
import type {
  SocialContext,
  SituationAwareness,
  RelationNetwork,
  PlayerView,
  InformationState,
  KnownFact,
  InformationGap,
  SuspiciousPattern,
  IdentityCrisisAwareness,
  ExposureSource,
} from './types';
import { ACTION } from '@/lib/constants/action-constants';
import {
  ACTION_INTENSITY_ACCUSE,
  ACTION_INTENSITY_SUSPECT,
  ACTION_INTENSITY_JOIN_SUSPECT,
  ACTION_INTENSITY_DEFEND,
  ACTION_INTENSITY_CALL_VOTE,
  ACTION_INTENSITY_BLOCK_VOTE,
  ACTION_INTENSITY_DEFAULT,
  PROB_THRESHOLD_HIGH,
  PROB_THRESHOLD_LOW,
  CRISIS_THRESHOLD_CRITICAL,
  CRISIS_THRESHOLD_HIGH,
  CRISIS_THRESHOLD_LOW,
  ATTACK_COUNT_THRESHOLD,
  INFORMATION_RICHNESS_THRESHOLD,
} from '@/lib/constants/mind';

export class SocialContextBuilder {
  build(
    belief: BeliefSystem,
    self: Player,
    allPlayers: Player[],
    publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
    round: number
  ): SocialContext {
    return {
      situation: this._buildSituationAwareness(self, allPlayers, publicActions, round),
      relationNetwork: this._buildRelationNetwork(belief, self, allPlayers, publicActions),
      informationState: this._buildInformationState(belief, publicActions, round),
      identityCrisis: this._buildIdentityCrisisAwareness(belief, self, allPlayers, publicActions),
    };
  }

  private _buildSituationAwareness(
    self: Player,
    allPlayers: Player[],
    publicActions: { actorId: string; type: string; targetId?: string }[],
    round: number
  ): SituationAwareness {
    // 主导叙事：找出当前讨论最激烈的话题
    const topicCounts = new Map<string, { participants: Set<string>; intensity: number }>();
    
    for (const action of publicActions) {
      if (action.targetId) {
        const key = `${action.type}:${action.targetId}`;
        if (!topicCounts.has(key)) {
          topicCounts.set(key, { participants: new Set(), intensity: 0 });
        }
        const topic = topicCounts.get(key)!;
        topic.participants.add(action.actorId);
        topic.intensity += this._actionIntensity(action.type);
      }
    }

    let dominantTopic = { topic: '无', participants: [] as string[], intensity: 0 };
    for (const [key, value] of topicCounts) {
      if (value.intensity > dominantTopic.intensity) {
        dominantTopic = {
          topic: key,
          participants: Array.from(value.participants),
          intensity: value.intensity,
        };
      }
    }

    // 场面紧张度
    const attackActions = publicActions.filter(a => 
      a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE || a.type === ACTION.JOIN_SUSPECT
    );
    const tensionLevel = Math.min(1, attackActions.length / (allPlayers.filter(p => p.alive).length * 2));

    // 我在场面中的位置
    const attacksOnMe = publicActions.filter(a => a.targetId === self.id && 
      (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE)
    ).length;
    const defendsOnMe = publicActions.filter(a => a.targetId === self.id && a.type === ACTION.DEFEND).length;
    const myCalls = publicActions.filter(a => a.actorId === self.id && a.type === ACTION.CALL_VOTE).length;
    
    let myPosition: SituationAwareness['myPosition'] = 'observer';
    if (attacksOnMe >= ATTACK_COUNT_THRESHOLD) myPosition = 'target';
    else if (attacksOnMe >= 1) myPosition = 'suspect';
    else if (myCalls >= 1) myPosition = 'leader';
    else if (defendsOnMe >= 1) myPosition = 'center';

    // 信息丰度
    const uniqueActors = new Set(publicActions.map(a => a.actorId)).size;
    const aliveCount = allPlayers.filter(p => p.alive).length;
    const informationRichness = aliveCount > 0 ? Math.min(1, uniqueActors / aliveCount) : 0;

    return {
      dominantNarrative: {
        topic: dominantTopic.topic,
        participants: dominantTopic.participants,
        intensity: Math.min(1, dominantTopic.intensity / 5),
      },
      tensionLevel,
      myPosition,
      informationRichness,
      round,
    };
  }

  private _actionIntensity(actionType: string): number {
    switch (actionType) {
      case ACTION.ACCUSE: return ACTION_INTENSITY_ACCUSE;
      case ACTION.SUSPECT: return ACTION_INTENSITY_SUSPECT;
      case ACTION.JOIN_SUSPECT: return ACTION_INTENSITY_JOIN_SUSPECT;
      case ACTION.DEFEND: return ACTION_INTENSITY_DEFEND;
      case ACTION.CALL_VOTE: return ACTION_INTENSITY_CALL_VOTE;
      case ACTION.BLOCK_VOTE: return ACTION_INTENSITY_BLOCK_VOTE;
      default: return ACTION_INTENSITY_DEFAULT;
    }
  }

  private _buildRelationNetwork(
    belief: BeliefSystem,
    self: Player,
    allPlayers: Player[],
    publicActions: { actorId: string; type: string; targetId?: string }[]
  ): RelationNetwork {
    const myView = new Map<string, PlayerView>();
    const observedRelations = new Map<string, Map<string, { interactionPattern: 'ally' | 'enemy' | 'neutral' | 'suspicious'; evidence: string[] }>>();
    const trustNetwork = new Map<string, Map<string, number>>();

    // 构建 myView
    for (const player of allPlayers) {
      if (player.id === self.id) continue;
      
      const relation = belief.getRelation(player.id);
      const wolfProb = belief.getWerewolfProbability(player.id);
      
      myView.set(player.id, {
        trust: relation.favor + (relation.trust || 0) * 0.5,
        affinity: relation.favor + (relation.friendly || 0) * 0.5,
        inferredTeam: wolfProb > PROB_THRESHOLD_HIGH ? 'werewolf' : wolfProb < PROB_THRESHOLD_LOW ? 'villager' : 'unknown',
        confidence: Math.abs(wolfProb - 0.5) * 2,
      });
    }

    // 构建 observedRelations（观察到的他人之间的关系）
    for (const action of publicActions) {
      if (!action.targetId) continue;
      
      if (!observedRelations.has(action.actorId)) {
        observedRelations.set(action.actorId, new Map());
      }
      
      const actorRelations = observedRelations.get(action.actorId)!;
      const existing = actorRelations.get(action.targetId);
      
      let pattern: 'ally' | 'enemy' | 'neutral' | 'suspicious' = 'neutral';
      if (action.type === ACTION.DEFEND || action.type === ACTION.GUARANTEE || action.type === ACTION.JOIN_DEFEND) {
        pattern = 'ally';
      } else if (action.type === ACTION.SUSPECT || action.type === ACTION.ACCUSE || action.type === ACTION.JOIN_SUSPECT) {
        pattern = 'enemy';
      } else if (action.type === ACTION.BLOCK_VOTE) {
        pattern = 'suspicious';
      }
      
      if (existing) {
        existing.evidence.push(`${action.type} on ${action.targetId}`);
        if (pattern === 'ally' && existing.interactionPattern === 'enemy') {
          existing.interactionPattern = 'suspicious';
        }
      } else {
        actorRelations.set(action.targetId, {
          interactionPattern: pattern,
          evidence: [`${action.type} on ${action.targetId}`],
        });
      }
    }

    // 构建 trustNetwork（简化为基于信任分数）
    for (const player of allPlayers) {
      if (!player.alive) continue;
      const playerTrust = new Map<string, number>();
      for (const other of allPlayers) {
        if (other.id === player.id || !other.alive) continue;
        const trustScore = belief.l1Inferences.trustScore[other.id] ?? 0;
        playerTrust.set(other.id, trustScore);
      }
      trustNetwork.set(player.id, playerTrust);
    }

    return { myView, observedRelations, trustNetwork };
  }

  private _buildInformationState(
    belief: BeliefSystem,
    publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
    round: number
  ): InformationState {
    const knownFacts: KnownFact[] = [];
    const informationGaps: InformationGap[] = [];
    const suspiciousPatterns: SuspiciousPattern[] = [];

    // L0 事实
    for (const [targetId, result] of Object.entries(belief.l0Facts.checks)) {
      knownFacts.push({
        type: 'check',
        content: { targetId, result },
        certainty: 1.0,
        source: 'self',
        round,
      });
    }

    for (const death of belief.l0Facts.deaths) {
      knownFacts.push({
        type: 'death',
        content: death,
        certainty: 1.0,
        source: 'system',
        round,
      });
    }

    for (const claim of belief.l0Facts.publicClaims) {
      knownFacts.push({
        type: 'claim',
        content: claim,
        certainty: PROB_THRESHOLD_HIGH,
        source: claim.playerId,
        round: claim.round,
      });
    }

    // 公开行动作为事实
    for (const action of publicActions) {
      knownFacts.push({
        type: 'action',
        content: action,
        certainty: 1.0,
        source: action.actorId,
        round,
      });
    }

    // 信息缺口
    const claimedProphets = publicActions.filter(a => 
      a.type === ACTION.CLAIM_IDENTITY && a.details?.claimedRole === 'prophet'
    );
    if (claimedProphets.length > 0) {
      informationGaps.push({
        question: '谁是真预言家？',
        importance: PROB_THRESHOLD_HIGH,
        urgency: claimedProphets.length > 1 ? PROB_THRESHOLD_HIGH : INFORMATION_RICHNESS_THRESHOLD,
      });
    }

    // 可疑模式
    const protectionPatterns = new Map<string, string[]>();
    for (const action of publicActions) {
      if (action.type === ACTION.DEFEND || action.type === ACTION.BLOCK_VOTE) {
        if (!protectionPatterns.has(action.actorId)) {
          protectionPatterns.set(action.actorId, []);
        }
        if (action.targetId) {
          protectionPatterns.get(action.actorId)!.push(action.targetId);
        }
      }
    }
    
    for (const [protector, protectedPlayers] of protectionPatterns) {
      if (protectedPlayers.length >= ATTACK_COUNT_THRESHOLD) {
        suspiciousPatterns.push({
          pattern: `${protector} 多次保护他人`,
          involvedPlayers: [protector, ...protectedPlayers],
          confidence: PROB_THRESHOLD_HIGH,
        });
      }
    }

    return { knownFacts, informationGaps, suspiciousPatterns };
  }

  private _buildIdentityCrisisAwareness(
    belief: BeliefSystem,
    self: Player,
    allPlayers: Player[],
    publicActions: { actorId: string; type: string; targetId?: string }[]
  ): IdentityCrisisAwareness {
    const selfExposure = belief.getIdentityCrisis();
    
    const othersExposure = new Map<string, number>();
    for (const player of allPlayers) {
      if (player.id !== self.id) {
        othersExposure.set(player.id, belief.getPlayerIdentityCrisis(player.id));
      }
    }

    const exposureSources: ExposureSource[] = [];
    for (const action of publicActions) {
      if (action.targetId === self.id) {
        if (action.type === ACTION.SUSPECT) {
          exposureSources.push({
            source: action.actorId,
            reason: '被怀疑',
            weight: INFORMATION_RICHNESS_THRESHOLD,
          });
        } else if (action.type === ACTION.ACCUSE) {
          exposureSources.push({
            source: action.actorId,
            reason: '被强烈指认',
            weight: PROB_THRESHOLD_HIGH,
          });
        }
      }
    }

    return {
      selfPerceivedExposure: selfExposure,
      othersPerceivedExposure: othersExposure,
      isCritical: selfExposure > CRISIS_THRESHOLD_CRITICAL,
      isHigh: selfExposure > CRISIS_THRESHOLD_HIGH,
      isSafe: selfExposure < CRISIS_THRESHOLD_LOW,
      exposureSources,
    };
  }
}
