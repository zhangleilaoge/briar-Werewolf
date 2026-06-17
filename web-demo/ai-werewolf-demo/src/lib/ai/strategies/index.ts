import { ProphetCheckStrategy, WerewolfKillStrategy, ThiefStealStrategy, CoronerInspectStrategy } from './night';
import { VillagerDayStrategy, WerewolfCamouflageStrategy, ProphetClaimStrategy, BerserkerSuicideStrategy } from './day';
import { ProphetVoteDutyStrategy, WerewolfVoteDutyStrategy, MaxInfoVoteStrategy, FollowCallVoteStrategy, SocialTieBreakerStrategy, SurvivalVoteStrategy } from './vote';
import { JoinSuspectStrategy, JoinDefendStrategy, RebutStrategy } from './appendix';
import type { Strategy } from './engine';

export interface StrategyEntry {
  category: string;
  strategy: Strategy;
}

export function buildStrategies(): StrategyEntry[] {
  return [
    // Night
    { category: 'information', strategy: ProphetCheckStrategy },
    { category: 'information', strategy: WerewolfKillStrategy },
    { category: 'information', strategy: ThiefStealStrategy },
    { category: 'information', strategy: CoronerInspectStrategy },

    // Day
    { category: 'duty', strategy: ProphetClaimStrategy },
    { category: 'duty', strategy: BerserkerSuicideStrategy },
    { category: 'information', strategy: VillagerDayStrategy },
    { category: 'information', strategy: WerewolfCamouflageStrategy },

    // Vote
    { category: 'duty', strategy: ProphetVoteDutyStrategy },
    { category: 'duty', strategy: WerewolfVoteDutyStrategy },
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
