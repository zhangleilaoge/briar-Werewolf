import { VillagerDayStrategy, WerewolfCamouflageStrategy, ProphetClaimStrategy, BerserkerSuicideStrategy } from './day';
import { CheckRevelationVoteStrategy, AllyProtectionVoteStrategy, MaxInfoVoteStrategy, FollowCallVoteStrategy, SocialTieBreakerStrategy, SurvivalVoteStrategy } from './vote';
import { JoinSuspectStrategy, JoinDefendStrategy, RebutStrategy } from './appendix';
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

    // Day
    { category: 'duty', strategy: ProphetClaimStrategy },
    { category: 'duty', strategy: BerserkerSuicideStrategy },
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
