import { VillagerDayStrategy, WerewolfCamouflageStrategy, BerserkerSuicideStrategy } from './day';
import { CheckRevelationVoteStrategy, AllyProtectionVoteStrategy, MaxInfoVoteStrategy, FollowCallVoteStrategy, SocialTieBreakerStrategy, SurvivalVoteStrategy } from './vote';
import { JoinSuspectStrategy, JoinDefendStrategy, RebutStrategy } from './appendix';
import { WerewolfFakeIdentityStrategy, RealProphetClaimStrategy, RealHunterClaimStrategy } from './claim-identity';
import type { Strategy } from './engine';

export interface StrategyEntry {
  category: string;
  strategy: Strategy;
}

export function buildStrategies(): StrategyEntry[] {
  return [
    // Night strategies are now provided by item plugins:
    // - CrystalBallPlugin (check)
    // - ClawsPlugin (kill)
    // - ThiefGlovesPlugin (steal)
    // - CoronerToolsPlugin (inspect)

    // Day - 身份公布策略（伪装身份系统）
    { category: 'information', strategy: WerewolfFakeIdentityStrategy },   // 狼人伪装身份（不享受 duty 权重）
    { category: 'duty', strategy: RealProphetClaimStrategy },        // 真预言家跳身份
    { category: 'duty', strategy: RealHunterClaimStrategy },         // 真猎人跳身份
    { category: 'duty', strategy: BerserkerSuicideStrategy },

    // Day - 行动策略
    { category: 'information', strategy: VillagerDayStrategy },
    { category: 'information', strategy: WerewolfCamouflageStrategy },

    // Vote
    { category: 'duty', strategy: CheckRevelationVoteStrategy },
    { category: 'duty', strategy: AllyProtectionVoteStrategy },
    { category: 'information', strategy: MaxInfoVoteStrategy },
    { category: 'social', strategy: FollowCallVoteStrategy },
    { category: 'social', strategy: SocialTieBreakerStrategy },
    { category: 'survival', strategy: SurvivalVoteStrategy },

    // Appendix
    { category: 'social', strategy: JoinSuspectStrategy },
    { category: 'social', strategy: JoinDefendStrategy },
    { category: 'survival', strategy: RebutStrategy },
  ];
}

export * from './engine';
