// ============================================================
// Legacy Helpers — 保留兼容
// ============================================================

import type { GameMode } from '@/lib/constants/action-constants';
import {
  MODE_NAMES, TEAM_OBJECTIVE_NAMES, PERSONAL_OBJECTIVE_NAMES,
} from '@/lib/constants/display-names';
import type { Player } from '@/types';

import type { BeliefSystem } from '../belief-system';
import type { IntentionContext } from './types';

export function generateDesireProfile(self: Player, belief: BeliefSystem, allPlayers: Player[]): {
  teamObjective: string;
  personalObjective: string;
  mode: GameMode;
} {
  const aliveWolves = allPlayers.filter((p) => p.team === 'werewolf' && p.alive).length;
  const aliveVillagers = allPlayers.filter((p) => p.team !== 'werewolf' && p.alive).length;
  const myExposure = belief.getExposure();

  let mode: GameMode = 'normal';
  if (self.team === 'werewolf') {
    if (aliveWolves < aliveVillagers && myExposure > 0.6) {
      mode = 'desperate';
    } else if (aliveWolves >= aliveVillagers) {
      mode = 'dominant';
    }
  } else {
    if (aliveWolves >= aliveVillagers) {
      mode = 'desperate';
    }
  }

  const teamObjective = self.team === 'werewolf' ? 'eliminate_opposition' : 'find_wolves';
  let personalObjective = 'gain_trust';
  if (self.team === 'werewolf') {
    personalObjective = mode === 'desperate' ? 'survive' : 'maintain_cover';
  } else if (self.role === 'prophet') {
    personalObjective = 'reveal_truth';
  }

  return { teamObjective, personalObjective, mode };
}

export function explainIntention(
  desire: ReturnType<typeof generateDesireProfile>,
  blocked: { candidate: { action: string; target: string | null }; reason: string }[],
  allPlayers: Player[]
): string {
  const modeNames = MODE_NAMES;
  const teamNames = TEAM_OBJECTIVE_NAMES;
  const personalNames = PERSONAL_OBJECTIVE_NAMES;
  const lines: string[] = [];
  lines.push(`【意图状态】 模式=${modeNames[desire.mode] || desire.mode} | 阵营目标=${teamNames[desire.teamObjective] || desire.teamObjective} | 个人目标=${personalNames[desire.personalObjective] || desire.personalObjective}`);

  if (blocked.length > 0) {
    lines.push(`[被硬约束拦截的候选]`);
    blocked.forEach((b) => {
      const targetName = b.candidate.target
        ? allPlayers.find((p) => p.id === b.candidate.target)?.name || b.candidate.target
        : '无目标';
      lines.push(`  ○ ${b.candidate.action}→${targetName} (${b.reason})`);
    });
  }

  return lines.join('\n');
}

export function isBusMode(context: IntentionContext): boolean {
  if (context.self.team !== 'werewolf') return false;

  const allWolves = context.allPlayers.filter((p) => p.team === 'werewolf' && p.alive);
  const allVillagers = context.allPlayers.filter((p) => p.team !== 'werewolf' && p.alive);

  if (allWolves.length >= allVillagers.length) return false;

  const teammates = allWolves.filter((p) => p.id !== context.self.id);
  for (const teammate of teammates) {
    const exposure = context.belief.getPlayerExposure(teammate.id);
    const myExposure = context.belief.getExposure();
    if (exposure > 0.8 && myExposure < 0.5) {
      return true;
    }
  }

  return false;
}
