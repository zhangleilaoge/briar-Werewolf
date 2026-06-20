// 心智驱动决策系统的类型定义


// ========== 社交情境 ==========

export interface DominantNarrative {
  topic: string;
  participants: string[];
  intensity: number;
}

export interface SituationAwareness {
  dominantNarrative: DominantNarrative;
  tensionLevel: number;
  myPosition: 'center' | 'suspect' | 'leader' | 'observer' | 'target';
  informationRichness: number;
  round: number;
}

export interface PlayerView {
  trust: number;
  affinity: number;
  inferredTeam: 'werewolf' | 'villager' | 'unknown';
  confidence: number;
}

export interface RelationNetwork {
  myView: Map<string, PlayerView>;
  observedRelations: Map<string, Map<string, {
    interactionPattern: 'ally' | 'enemy' | 'neutral' | 'suspicious';
    evidence: string[];
  }>>;
  trustNetwork: Map<string, Map<string, number>>;
}

export interface KnownFact {
  type: 'check' | 'death' | 'claim' | 'observation' | 'theft' | 'action';
  content: unknown;
  certainty: number;
  source: string;
  round: number;
}

export interface InformationGap {
  question: string;
  importance: number;
  urgency: number;
}

export interface SuspiciousPattern {
  pattern: string;
  involvedPlayers: string[];
  confidence: number;
}

export interface InformationState {
  knownFacts: KnownFact[];
  informationGaps: InformationGap[];
  suspiciousPatterns: SuspiciousPattern[];
}

export interface ExposureSource {
  source: string;
  reason: string;
  weight: number;
}

export interface IdentityCrisisAwareness {
  selfPerceivedExposure: number;
  othersPerceivedExposure: Map<string, number>;
  isCritical: boolean;
  isHigh: boolean;
  isSafe: boolean;
  exposureSources: ExposureSource[];
}

export interface SocialContext {
  situation: SituationAwareness;
  relationNetwork: RelationNetwork;
  informationState: InformationState;
  identityCrisis: IdentityCrisisAwareness;
}

// ========== 价值观系统 ==========

export interface ValueSystem {
  truthSeeking: number;
  selfPreservation: number;
  socialHarmony: number;
  dominance: number;
  deception: number;
  loyalty: number;
}

// ========== 时机评估 ==========

export interface TimingEvaluation {
  urgency: number;
  credibility: number;
  risk: number;
  expectedImpact: number;
  opportunityCost: number;
}

// ========== 心智模拟 ==========

export interface ExpectedReaction {
  reaction: string;
  confidence: number;
}

export interface MentalSimulation {
  action: string;
  target: string | null;
  expectedReactions: Map<string, ExpectedReaction>;
  expectedPerceptionChange: Map<string, number>;
  goalAlignment: number;
  exposureRisk: number;
}

// ========== 决策候选扩展 ==========

export interface MindFactorBreakdown {
  label: string;
  value: number;
  reason: string;
}

export interface MindFactorDetail {
  score: number;
  reason: string;
  breakdown: MindFactorBreakdown[];
}

export interface MindEnrichedCandidate {
  valueAlignment: number;
  timingScore: number;
  simulationScore: number;
  socialContextBonus: number;
  crisisFactor: number;
  relationFactor: number;
}
