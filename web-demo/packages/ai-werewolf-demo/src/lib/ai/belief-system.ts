import type {
  Player,
  Relation,
  RoleBeliefs,
  L2TheoryOfMind,
  L3Social,
  LogEntry,
  PublicClaim,
  CheckResult,
  OthersBeliefs,
  Role,
  Team,
} from './types';

export class BeliefSystem {
  playerId: string;
  playerName: string;

  // L0: 原始事实层（不可变）
  l0Facts: {
    myRole: Role | null;
    myAlignment: Team | null;
    myItems: string[];
    checks: Record<string, 'werewolf' | 'villager'>;
    deaths: string[];
    publicClaims: PublicClaim[];
    thefts: { thiefId: string; targetId: string; item: string }[];
    inspections: { inspectorId: string; targetId: string; items: string[] }[];
  };

  // L1: 逻辑推导层
  l1Inferences: {
    roleBeliefs: Record<string, RoleBeliefs>;
    itemBeliefs: Record<string, Record<string, number>>;
    trustScore: Record<string, number>;
  };

  // L2: 元认知（ToM）
  l2TheoryOfMind: L2TheoryOfMind;

  // L3: 社交情感层
  l3Social: L3Social;

  logs: LogEntry[];
  currentRound: number = 0;

  constructor(playerId: string, playerName: string) {
    this.playerId = playerId;
    this.playerName = playerName;

    this.l0Facts = {
      myRole: null,
      myAlignment: null,
      myItems: [],
      checks: {},
      deaths: [],
      publicClaims: [],
      thefts: [],
      inspections: [],
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

    this.logs = [];
  }

  setMyRole(role: Role, alignment: Team) {
    this.l0Facts.myRole = role;
    this.l0Facts.myAlignment = alignment;
  }

  recordCheck(targetId: string, result: 'werewolf' | 'villager') {
    this.l0Facts.checks[targetId] = result;
  }

  recordDeath(playerId: string) {
    if (!this.l0Facts.deaths.includes(playerId)) {
      this.l0Facts.deaths.push(playerId);
    }
  }

  recordPublicClaim(playerId: string, claim: string, content: Record<string, unknown>) {
    this.l0Facts.publicClaims.push({
      playerId,
      claim,
      content,
      round: this.currentRound,
    });
  }

  initializeRelations(allPlayers: Player[]) {
    allPlayers.forEach((p) => {
      if (p.id !== this.playerId) {
        this.l3Social.relations[p.id] = { friendly: 0, trust: 0 };
        this.l1Inferences.roleBeliefs[p.id] = { werewolf: 0.5, villager: 0.5 };
        this.l1Inferences.trustScore[p.id] = 0.5;
      }
    });
  }

  updateInferences(allPlayers: Player[]) {
    // 基于查验结果直接设置信念
    Object.entries(this.l0Facts.checks).forEach(([targetId, result]) => {
      if (result === 'werewolf') {
        this.l1Inferences.roleBeliefs[targetId] = { werewolf: 1.0, villager: 0 };
      } else {
        this.l1Inferences.roleBeliefs[targetId] = { werewolf: 0, villager: 1.0 };
      }
    });

    // 基于死亡信息
    this.l0Facts.deaths.forEach((deadId) => {
      const rb = this.l1Inferences.roleBeliefs[deadId];
      if (rb && rb.werewolf > 0.5) {
        rb.werewolf *= 0.7;
        rb.villager = 1 - rb.werewolf;
      }
    });

    // 基于公开声称
    this.l0Facts.publicClaims.forEach((claim) => {
      if (claim.claim === 'prophet_check') {
        this._evaluateClaim(claim.playerId, claim);
      }
    });

    // 确保所有存活玩家都有 L1 信念
    allPlayers.forEach((p) => {
      if (p.id !== this.playerId && !this.l1Inferences.roleBeliefs[p.id]) {
        this.l1Inferences.roleBeliefs[p.id] = { werewolf: 0.5, villager: 0.5 };
      }
    });
  }

  _evaluateClaim(claimerId: string, claim: PublicClaim) {
    const content = claim.content as { target?: string; result?: 'werewolf' | 'villager' };
    const target = content.target;
    const result = content.result;
    if (!target || !result) return;

    if (this.l0Facts.checks[target] !== undefined) {
      const myResult = this.l0Facts.checks[target];
      if (myResult !== result) {
        this.l1Inferences.trustScore[claimerId] = Math.max(0, (this.l1Inferences.trustScore[claimerId] ?? 0.5) - 0.4);
        const rb = this.l1Inferences.roleBeliefs[claimerId] ?? { werewolf: 0.5, villager: 0.5 };
        rb.werewolf = Math.min(1, rb.werewolf + 0.3);
      }
    }
  }

  updateTheoryOfMind(allPlayers: Player[], publicActions: { actorId: string; type: string; targetId?: string }[]) {
    allPlayers.forEach((observer) => {
      if (observer.id === this.playerId) return;
      if (!this.l2TheoryOfMind.othersBeliefs[observer.id]) {
        this.l2TheoryOfMind.othersBeliefs[observer.id] = {};
      }

      const observerVotes = publicActions.filter((a) => a.actorId === observer.id && a.type === 'vote');

      allPlayers.forEach((target) => {
        if (target.id === observer.id) return;
        let suspicion = 0.5;
        observerVotes.forEach((v) => {
          if (v.targetId === target.id) suspicion += 0.3;
        });
        this.l2TheoryOfMind.othersBeliefs[observer.id][target.id] = Math.min(1, suspicion);
      });

      const attackedMe = observerVotes.some((v) => v.targetId === this.playerId);
      this.l2TheoryOfMind.othersTrustMe[observer.id] = attackedMe ? 0.2 : 0.6;

      const myClaims = this.l0Facts.publicClaims.filter((c) => c.playerId === this.playerId);
      this.l2TheoryOfMind.othersKnowMyRole[observer.id] = myClaims.length > 0 ? 0.7 : 0.1;
    });
  }

  updateRelation(targetId: string, friendlyDelta: number, trustDelta: number) {
    if (!this.l3Social.relations[targetId]) {
      this.l3Social.relations[targetId] = { friendly: 0, trust: 0 };
    }
    this.l3Social.relations[targetId].friendly = Math.max(-1, Math.min(1, this.l3Social.relations[targetId].friendly + friendlyDelta));
    this.l3Social.relations[targetId].trust = Math.max(-1, Math.min(1, this.l3Social.relations[targetId].trust + trustDelta));
  }

  updatePressure(delta: number) {
    this.l3Social.pressure = Math.max(0, Math.min(1, this.l3Social.pressure + delta));
  }

  getCheckResult(targetId: string): 'werewolf' | 'villager' | null {
    return this.l0Facts.checks[targetId] ?? null;
  }

  getWerewolfProbability(targetId: string): number {
    return this.l1Inferences.roleBeliefs[targetId]?.werewolf ?? 0.5;
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
    return this.l2TheoryOfMind.othersBeliefs[fromPlayerId]?.[this.playerId] ?? 0.5;
  }

  getRelation(targetId: string): Relation {
    return this.l3Social.relations[targetId] ?? { friendly: 0, trust: 0 };
  }

  getSummary() {
    return {
      player: this.playerName,
      role: this.l0Facts.myRole,
      l0: { checks: this.l0Facts.checks, deaths: this.l0Facts.deaths },
      l1: { topSuspect: this._getTopSuspect() },
      l2: { myExposure: this._calculateExposure() },
      l3: { relations: this.l3Social.relations },
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

  private _calculateExposure(): number {
    const beliefs = this.l2TheoryOfMind.othersBeliefs;
    const entries = Object.entries(beliefs);
    if (entries.length === 0) return 0;
    let total = 0;
    entries.forEach(([, b]) => {
      total += b[this.playerId] ?? 0;
    });
    return total / entries.length;
  }
}
