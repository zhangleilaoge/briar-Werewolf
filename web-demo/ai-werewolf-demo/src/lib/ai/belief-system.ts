import { ACTION } from '@/lib/constants/action-constants';
import type {
  Player, Relation, Role, Team, Attributes, Alignment, PublicClaim
} from '@/types';
import {
  BELIEF_DEATH_DECAY, BELIEF_SUSPECT_MAX_ADJ, BELIEF_SUSPECT_RATE,
  BELIEF_ACCUSE_MAX_ADJ, BELIEF_ACCUSE_RATE, BELIEF_DEFEND_MAX_ADJ, BELIEF_DEFEND_RATE,
  BELIEF_CLAIM_IDENTITY_ADJ, BELIEF_REVEAL_INFO_ADJ, BELIEF_THANK_ADJ, BELIEF_CALL_VOTE_ADJ,
  BELIEF_JOIN_SUSPECT_RATE, BELIEF_NATURAL_DECAY, BELIEF_FALSE_CLAIM_ADJ,
  TRUST_CHANGE_SUSPECT, TRUST_CHANGE_DEFEND, TRUST_CHANGE_ACCUSE, TRUST_CHANGE_GUARANTEE, TRUST_CHANGE_FALSE_CLAIM,
  TRUST_SCORE_MIN, TRUST_SCORE_MAX,
  BELIEF_DEFAULT_PROBABILITY, BELIEF_LOW_SUSPICION_THRESHOLD, BELIEF_HIGH_SUSPICION_THRESHOLD,
  BELIEF_SUSPICION_BASE, BELIEF_SUSPICION_VOTE_ADJ, BELIEF_SUSPICION_ACCUSE_ADJ, BELIEF_SUSPICION_DEFEND_ADJ,
  BELIEF_TRUST_ATTACKED, BELIEF_TRUST_DEFAULT, BELIEF_IDENTITY_CRISIS_KNOWN, BELIEF_IDENTITY_CRISIS_UNKNOWN,
} from '@/types';

export class BeliefSystem {
  playerId: string;
  playerName: string;
  myRole: Role | null;
  myTeam: Team | null;
  myAttributes: Attributes;
  myAlignment: Alignment;
  teammateIds: Set<string>;

  // L0: Raw Facts (immutable truths this agent knows)
  l0Facts: {
    checks: Record<string, 'werewolf' | 'villager'>;
    deaths: string[];
    publicClaims: PublicClaim[];
    thefts: { thiefId: string; targetId: string; item: string }[];
    inspections: { inspectorId: string; targetId: string; items: string[] }[];
    observations: Record<string, { stress: number; attributes: Attributes; round: number }>;
  };

  // L1: Inferences (probabilistic role beliefs)
  l1Inferences: {
    roleBeliefs: Record<string, { werewolf: number; villager: number }>;
    itemBeliefs: Record<string, Record<string, number>>; // playerId -> itemId -> probability
    trustScore: Record<string, number>; // -10 to 10, how much we trust this player's claims
  };

  // L2: Theory of Mind (what others think)
  l2TheoryOfMind: {
    othersBeliefs: Record<string, Record<string, number>>; // observerId -> targetId -> suspicion
    othersTrustMe: Record<string, number>;
    othersKnowMyRole: Record<string, number>;
  };

  // L3: Social / Emotional
  l3Social: {
    relations: Record<string, Relation>;
    pressure: number; // -10 to 10
    emotionalState: 'neutral' | 'anxious' | 'confident' | 'angry';
  };

  constructor(
    playerId: string,
    playerName: string,
    role: Role,
    team: Team,
    attributes: Attributes,
    alignment: Alignment,
    allPlayers?: Player[]
  ) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.myRole = role;
    this.myTeam = team;
    this.myAttributes = attributes;
    this.myAlignment = alignment;
    this.teammateIds = new Set(
      allPlayers?.filter(p => p.id !== playerId && p.team === team && team === 'werewolf').map(p => p.id) ?? []
    );

    this.l0Facts = {
      checks: {},
      deaths: [],
      publicClaims: [],
      thefts: [],
      inspections: [],
      observations: {},
    };

    this.l1Inferences = {
      roleBeliefs: {},
      itemBeliefs: {},
      trustScore: {},
    };

    this.l2TheoryOfMind = {
      othersBeliefs: {},
      othersTrustMe: {},
      othersKnowMyRole: {},
    };

    this.l3Social = {
      relations: {},
      pressure: 0,
      emotionalState: 'neutral',
    };
  }

  recordCheck(targetId: string, result: 'werewolf' | 'villager') {
    this.l0Facts.checks[targetId] = result;
  }

  recordDeath(playerId: string) {
    if (!this.l0Facts.deaths.includes(playerId)) {
      this.l0Facts.deaths.push(playerId);
    }
  }

  recordPublicClaim(playerId: string, claim: string, content: Record<string, unknown>, round: number = 0) {
    this.l0Facts.publicClaims.push({
      playerId,
      claim,
      content,
      round,
    });
  }

  recordObservation(targetId: string, stress: number, attributes: Attributes) {
    this.l0Facts.observations[targetId] = { stress, attributes, round: 0 };
  }

  recordInspection(targetId: string, items: string[]) {
    this.l0Facts.inspections.push({ inspectorId: this.playerId, targetId, items });
  }

  initializeRelations(allPlayers: Player[]) {
    allPlayers.forEach((p) => {
      if (p.id !== this.playerId) {
        this.l3Social.relations[p.id] = { favor: 0, trust: 0, friendly: 0 };
        this.l1Inferences.roleBeliefs[p.id] = { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
        this.l1Inferences.trustScore[p.id] = 0;
      }
    });
  }

  updateInferences(
    allPlayers: Player[],
    _self: Player,
    publicActions?: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[]
  ) {
    // 1. L0 hard facts: checks override everything
    Object.entries(this.l0Facts.checks).forEach(([targetId, result]) => {
      if (result === 'werewolf') {
        this.l1Inferences.roleBeliefs[targetId] = { werewolf: 1.0, villager: 0 };
      } else {
        this.l1Inferences.roleBeliefs[targetId] = { werewolf: 0, villager: 1.0 };
      }
    });

    // 2. Deaths: killed by wolf -> likely villager
    this.l0Facts.deaths.forEach((deadId) => {
      const rb = this.l1Inferences.roleBeliefs[deadId];
      if (rb) {
        rb.werewolf = Math.max(0, rb.werewolf * BELIEF_DEATH_DECAY);
        rb.villager = 1 - rb.werewolf;
      }
    });

    // 3. Evaluate claims (prophet claims)
    this.l0Facts.publicClaims.forEach((claim) => {
      if (claim.claim === 'prophet_check') {
        this._evaluateClaim(claim.playerId, claim);
      }
    });

    // 4. Infer from public actions (NEW - core of this refactor)
    if (publicActions && publicActions.length > 0) {
      this._inferFromPublicActions(publicActions, allPlayers);
    }

    // 5. Initialize missing players
    allPlayers.forEach((p) => {
      if (p.id !== this.playerId && !this.l1Inferences.roleBeliefs[p.id]) {
        this.l1Inferences.roleBeliefs[p.id] = { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
        this.l1Inferences.trustScore[p.id] = 0;
      }
    });

    // 6. Self-knowledge for wolves
    if (this.myTeam === 'werewolf') {
      allPlayers.forEach((p) => {
        if (p.id !== this.playerId && p.team === 'werewolf') {
          this.l1Inferences.roleBeliefs[p.id] = { werewolf: 1.0, villager: 0 };
        }
      });
    }
  }

  private _inferFromPublicActions(
    publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
    _allPlayers: Player[]
  ) {
    // 统计各类型行动
    const suspectCount: Record<string, number> = {};
    const accuseCount: Record<string, number> = {};
    const defendCount: Record<string, number> = {};
    const guaranteeCount: Record<string, number> = {};
    const silenceCount: Record<string, number> = {};
    const callVoteCount: Record<string, number> = {};

    publicActions.forEach((action) => {
      if ((action.type === ACTION.SUSPECT || action.type === ACTION.JOIN_SUSPECT) && action.targetId) {
        suspectCount[action.targetId] = (suspectCount[action.targetId] || 0) + 1;
      }
      if (action.type === ACTION.ACCUSE && action.targetId) {
        accuseCount[action.targetId] = (accuseCount[action.targetId] || 0) + 1;
      }
      if ((action.type === ACTION.DEFEND || action.type === ACTION.JOIN_DEFEND) && action.targetId) {
        defendCount[action.targetId] = (defendCount[action.targetId] || 0) + 1;
      }
      if (action.type === ACTION.GUARANTEE && action.targetId) {
        guaranteeCount[action.targetId] = (guaranteeCount[action.targetId] || 0) + 1;
        defendCount[action.targetId] = (defendCount[action.targetId] || 0) + 1;
      }
      if (action.type === ACTION.SILENCE) {
        silenceCount[action.actorId] = (silenceCount[action.actorId] || 0) + 1;
      }
      if (action.type === ACTION.CALL_VOTE && action.targetId) {
        callVoteCount[action.targetId] = (callVoteCount[action.targetId] || 0) + 1;
      }
    });

    // 规则 1: 被多人怀疑/指认的目标，狼概率上升
    Object.entries(suspectCount).forEach(([targetId, count]) => {
      if (count >= 1) {
        const rb = this.l1Inferences.roleBeliefs[targetId] || { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
        const adj = Math.min(BELIEF_SUSPECT_MAX_ADJ, count * BELIEF_SUSPECT_RATE);
        rb.werewolf = Math.min(1, rb.werewolf + adj);
        rb.villager = 1 - rb.werewolf;
        this.l1Inferences.roleBeliefs[targetId] = rb;
      }
    });
    Object.entries(accuseCount).forEach(([targetId, count]) => {
      if (count >= 1) {
        const rb = this.l1Inferences.roleBeliefs[targetId] || { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
        const adj = Math.min(BELIEF_ACCUSE_MAX_ADJ, count * BELIEF_ACCUSE_RATE);
        rb.werewolf = Math.min(1, rb.werewolf + adj);
        rb.villager = 1 - rb.werewolf;
        this.l1Inferences.roleBeliefs[targetId] = rb;
      }
    });

    // 规则 2: 被多人袒护/担保的目标，好人概率上升
    Object.entries(defendCount).forEach(([targetId, count]) => {
      if (count >= 1) {
        const rb = this.l1Inferences.roleBeliefs[targetId] || { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
        const adj = Math.min(BELIEF_DEFEND_MAX_ADJ, count * BELIEF_DEFEND_RATE);
        rb.werewolf = Math.max(0, rb.werewolf - adj);
        rb.villager = 1 - rb.werewolf;
        this.l1Inferences.roleBeliefs[targetId] = rb;
      }
    });

    // 规则 3: 怀疑者分析（关键逻辑）
    publicActions.forEach((action) => {
      if ((action.type === ACTION.SUSPECT || action.type === ACTION.ACCUSE) && action.targetId) {
        const actorId = action.actorId;
        const targetId = action.targetId;
        const targetWolfProb = this.l1Inferences.roleBeliefs[targetId]?.werewolf ?? 0.5;
        const totalSuspicion = (suspectCount[targetId] || 0) + (accuseCount[targetId] || 0);

        // 攻击一个明显好人（狼概率 < 0.4） -> 攻击者像泼脏水
        if (targetWolfProb < BELIEF_LOW_SUSPICION_THRESHOLD) {
          const rb = this.l1Inferences.roleBeliefs[actorId] || { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
          rb.werewolf = Math.min(1, rb.werewolf + BELIEF_CLAIM_IDENTITY_ADJ);
          rb.villager = 1 - rb.werewolf;
          this.l1Inferences.roleBeliefs[actorId] = rb;
          this.l1Inferences.trustScore[actorId] = Math.max(TRUST_SCORE_MIN, (this.l1Inferences.trustScore[actorId] ?? 0) + TRUST_CHANGE_SUSPECT);
        }

        // 攻击一个已被多人怀疑的目标（有依据） -> 攻击者更可信
        if (totalSuspicion >= 2 && targetWolfProb >= BELIEF_LOW_SUSPICION_THRESHOLD) {
          this.l1Inferences.trustScore[actorId] = Math.min(TRUST_SCORE_MAX, (this.l1Inferences.trustScore[actorId] ?? 0) + TRUST_CHANGE_DEFEND);
        }

        // 攻击一个我查验为好人的目标 -> 攻击者非常像狼
        if (this.l0Facts.checks[targetId] === 'villager') {
          const rb = this.l1Inferences.roleBeliefs[actorId] || { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
          rb.werewolf = Math.min(1, rb.werewolf + BELIEF_REVEAL_INFO_ADJ);
          rb.villager = 1 - rb.werewolf;
          this.l1Inferences.roleBeliefs[actorId] = rb;
          this.l1Inferences.trustScore[actorId] = Math.max(TRUST_SCORE_MIN, (this.l1Inferences.trustScore[actorId] ?? 0) + TRUST_CHANGE_ACCUSE);
        }
      }
    });

    // 规则 4: 号召投票分析
    publicActions.forEach((action) => {
      if (action.type === ACTION.CALL_VOTE && action.targetId) {
        const actorId = action.actorId;
        const targetId = action.targetId;
        const targetWolfProb = this.l1Inferences.roleBeliefs[targetId]?.werewolf ?? 0.5;
        const totalSuspicion = (suspectCount[targetId] || 0) + (accuseCount[targetId] || 0);

        if (targetWolfProb > BELIEF_HIGH_SUSPICION_THRESHOLD || totalSuspicion >= 2) {
          this.l1Inferences.trustScore[actorId] = Math.min(TRUST_SCORE_MAX, (this.l1Inferences.trustScore[actorId] ?? 0) + TRUST_CHANGE_GUARANTEE);
        } else {
          // 无依据号召 -> 像搅局
          this.l1Inferences.trustScore[actorId] = Math.max(TRUST_SCORE_MIN, (this.l1Inferences.trustScore[actorId] ?? 0) + TRUST_CHANGE_SUSPECT);
          const rb = this.l1Inferences.roleBeliefs[actorId] || { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
          rb.werewolf = Math.min(1, rb.werewolf + BELIEF_THANK_ADJ);
          rb.villager = 1 - rb.werewolf;
          this.l1Inferences.roleBeliefs[actorId] = rb;
        }
      }
    });

    // 规则 5: 阻止投票保护被多人怀疑的目标
    publicActions.forEach((action) => {
      if (action.type === ACTION.BLOCK_VOTE && action.targetId) {
        const actorId = action.actorId;
        const targetId = action.targetId;
        const totalSuspicion = (suspectCount[targetId] || 0) + (accuseCount[targetId] || 0);
        if (totalSuspicion >= 2) {
          const rb = this.l1Inferences.roleBeliefs[actorId] || { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
          rb.werewolf = Math.min(1, rb.werewolf + BELIEF_CALL_VOTE_ADJ);
          rb.villager = 1 - rb.werewolf;
          this.l1Inferences.roleBeliefs[actorId] = rb;
        }
      }
    });

    // 规则 6: 连续沉默增加可疑度（弱信号）
    Object.entries(silenceCount).forEach(([actorId, count]) => {
      if (count >= 2) {
        const rb = this.l1Inferences.roleBeliefs[actorId] || { werewolf: 0.5, villager: 0.5 };
        rb.werewolf = Math.min(1, rb.werewolf + BELIEF_JOIN_SUSPECT_RATE * count);
        rb.villager = 1 - rb.werewolf;
        this.l1Inferences.roleBeliefs[actorId] = rb;
      }
    });

    // 规则 7: 反驳者敢于辩护，轻微降低其狼概率
    publicActions.forEach((action) => {
      if (action.type === ACTION.REBUT) {
        const actorId = action.actorId;
        const rb = this.l1Inferences.roleBeliefs[actorId] || { werewolf: 0.5, villager: 0.5 };
        rb.werewolf = Math.max(0, rb.werewolf - BELIEF_NATURAL_DECAY);
        rb.villager = 1 - rb.werewolf;
        this.l1Inferences.roleBeliefs[actorId] = rb;
      }
    });
  }

  _evaluateClaim(claimerId: string, claim: PublicClaim) {
    const content = claim.content as { target?: string; result?: 'werewolf' | 'villager' };
    const target = content.target;
    const result = content.result;
    if (!target || !result) return;

    const myResult = this.l0Facts.checks[target];
    if (myResult !== undefined && myResult !== result) {
      // Claim contradicts our known fact -> claimer is lying
      this.l1Inferences.trustScore[claimerId] = Math.max(TRUST_SCORE_MIN, (this.l1Inferences.trustScore[claimerId] ?? 0) + TRUST_CHANGE_FALSE_CLAIM);
      const rb = this.l1Inferences.roleBeliefs[claimerId] ?? { werewolf: BELIEF_DEFAULT_PROBABILITY, villager: BELIEF_DEFAULT_PROBABILITY };
      rb.werewolf = Math.min(1, rb.werewolf + BELIEF_FALSE_CLAIM_ADJ);
    } else if (myResult !== undefined && myResult === result) {
      // Claim matches our known fact -> claimer is truthful
      this.l1Inferences.trustScore[claimerId] = Math.min(TRUST_SCORE_MAX, (this.l1Inferences.trustScore[claimerId] ?? 0) + TRUST_CHANGE_GUARANTEE);
    }
  }

  updateTheoryOfMind(
    allPlayers: Player[],
    publicActions: { actorId: string; type: string; targetId?: string; details?: Record<string, unknown> }[],
    _self: Player
  ) {
    allPlayers.forEach((observer) => {
      if (observer.id === this.playerId) return;
      if (!this.l2TheoryOfMind.othersBeliefs[observer.id]) {
        this.l2TheoryOfMind.othersBeliefs[observer.id] = {};
      }

      const observerVotes = publicActions.filter((a) => a.actorId === observer.id && a.type === ACTION.VOTE);
      const observerSuspects = publicActions.filter((a) => a.actorId === observer.id && (a.type === ACTION.SUSPECT || a.type === ACTION.ACCUSE));
      const observerDefends = publicActions.filter((a) => a.actorId === observer.id && (a.type === ACTION.DEFEND || a.type === ACTION.GUARANTEE));

      allPlayers.forEach((target) => {
        if (target.id === observer.id) return;
        let suspicion = BELIEF_SUSPICION_BASE;
        observerVotes.forEach((v) => {
          if (v.targetId === target.id) suspicion += BELIEF_SUSPICION_VOTE_ADJ;
        });
        observerSuspects.forEach((s) => {
          if (s.targetId === target.id) suspicion += BELIEF_SUSPICION_ACCUSE_ADJ;
        });
        observerDefends.forEach((d) => {
          if (d.targetId === target.id) suspicion += BELIEF_SUSPICION_DEFEND_ADJ;
        });
        this.l2TheoryOfMind.othersBeliefs[observer.id][target.id] = Math.max(0, Math.min(1, suspicion));
      });

      const attackedMe = observerVotes.some((v) => v.targetId === this.playerId) ||
        observerSuspects.some((s) => s.targetId === this.playerId);
      this.l2TheoryOfMind.othersTrustMe[observer.id] = attackedMe ? BELIEF_TRUST_ATTACKED : BELIEF_TRUST_DEFAULT;

      const myClaims = this.l0Facts.publicClaims.filter((c) => c.playerId === this.playerId);
      this.l2TheoryOfMind.othersKnowMyRole[observer.id] = myClaims.length > 0 ? BELIEF_IDENTITY_CRISIS_KNOWN : BELIEF_IDENTITY_CRISIS_UNKNOWN;
    });
  }

  updateRelation(targetId: string, favorDelta: number, trustDelta?: number, friendlyDelta?: number) {
    if (!this.l3Social.relations[targetId]) {
      this.l3Social.relations[targetId] = { favor: 0, trust: 0, friendly: 0 };
    }
    const rel = this.l3Social.relations[targetId];
    if (favorDelta !== undefined) {
      rel.favor = Math.max(-10, Math.min(10, rel.favor + favorDelta));
    }
    if (trustDelta !== undefined) {
      rel.trust = Math.max(-10, Math.min(10, (rel.trust || 0) + trustDelta));
    }
    if (friendlyDelta !== undefined) {
      rel.friendly = Math.max(-10, Math.min(10, (rel.friendly || 0) + friendlyDelta));
    }
    if (trustDelta !== undefined || friendlyDelta !== undefined) {
      rel.favor = Math.max(-10, Math.min(10, ((rel.trust || 0) + (rel.friendly || 0)) / 2));
    }
  }

  updatePressure(delta: number) {
    this.l3Social.pressure = Math.max(-10, Math.min(10, this.l3Social.pressure + delta));
    if (this.l3Social.pressure >= 10) {
      this.l3Social.emotionalState = 'anxious';
    } else if (this.l3Social.pressure <= -5) {
      this.l3Social.emotionalState = 'confident';
    } else if (this.l3Social.pressure >= 5) {
      this.l3Social.emotionalState = 'angry';
    } else {
      this.l3Social.emotionalState = 'neutral';
    }
  }

  getCheckResult(targetId: string): 'werewolf' | 'villager' | null {
    return this.l0Facts.checks[targetId] ?? null;
  }

  getWerewolfProbability(targetId: string): number {
    return this.l1Inferences.roleBeliefs[targetId]?.werewolf ?? BELIEF_DEFAULT_PROBABILITY;
  }

  getSuspectRanking(allPlayers: Player[]): { id: string; name: string; werewolfProb: number }[] {
    return allPlayers
      .filter((p) => p.id !== this.playerId && p.alive)
      .map((p) => ({
        id: p.id,
        name: p.name,
        werewolfProb: this.getWerewolfProbability(p.id),
      }))
      .sort((a, b) => b.werewolfProb - a.werewolfProb);
  }

  getSuspicionOnMe(fromPlayerId: string): number {
    return this.l2TheoryOfMind.othersBeliefs[fromPlayerId]?.[this.playerId] ?? BELIEF_DEFAULT_PROBABILITY;
  }

  getRelation(targetId: string): Relation {
    return this.l3Social.relations[targetId] ?? { favor: 0, trust: 0, friendly: 0 };
  }

  getSummary() {
    return {
      player: this.playerName,
      role: this.myRole,
      l0: { checks: this.l0Facts.checks, deaths: this.l0Facts.deaths },
      l1: { topSuspect: this._getTopSuspect() },
      l2: { myIdentityCrisis: this.getIdentityCrisis() },
      l3: { relations: this.l3Social.relations, pressure: this.l3Social.pressure, emotionalState: this.l3Social.emotionalState },
    };
  }

  private _getTopSuspect(): { id: string | null; probability: number } {
    let maxProb = -1;
    let topId: string | null = null;
    Object.entries(this.l1Inferences.roleBeliefs).forEach(([id, probs]) => {
      if (probs.werewolf > maxProb) {
        maxProb = probs.werewolf;
        topId = id;
      }
    });
    return { id: topId, probability: maxProb };
  }

  getIdentityCrisis(): number {
    return this.getPlayerIdentityCrisis(this.playerId);
  }

  /** 计算任意玩家在其他人眼中的平均身份危机（排除队友） */
  getPlayerIdentityCrisis(playerId: string): number {
    const beliefs = this.l2TheoryOfMind.othersBeliefs;
    const entries = Object.entries(beliefs).filter(([observerId]) => !this.teammateIds.has(observerId));
    if (entries.length === 0) return 0;
    let total = 0;
    entries.forEach(([, b]) => {
      total += b[playerId] ?? 0;
    });
    return total / entries.length;
  }
}
