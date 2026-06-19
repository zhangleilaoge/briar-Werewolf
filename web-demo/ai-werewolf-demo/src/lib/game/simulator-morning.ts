import type { GameSimulator } from './simulator-core';
import { clampStress, clampRelation } from '@/types';
import { STRESS_RECOVERY_BASE, STRESS_RECOVERY_BONUS, RELATION_NATURAL_RECOVERY } from '@/types';
import { log, getName } from './simulator-utils';
import { ACTION } from '@/lib/constants/action-constants';

export function resolveMorningEvents(sim: GameSimulator) {
  // 1. Announce deaths
  if (sim.nightDeaths.length > 0) {
    const names = sim.nightDeaths.map((id: string) => getName(sim, id)).join('、');
    log(sim, 'death', `昨夜死亡：${names}`);
  } else {
    log(sim, 'info', '昨夜平安夜，无人死亡。');
  }

  // 2. Prophet duty: if claimed prophet alive, must announce all check results
  sim.players.forEach((p) => {
    if (p.role === 'prophet' && p.alive && sim.prophetClaims[p.id]) {
      const agent = sim._aiAgents[p.id];
      const checks = agent?.getCheckResults() ?? {};
      const unchecked = Object.entries(checks).filter(([_, result]) => result !== undefined);
      if (unchecked.length > 0) {
        unchecked.forEach(([targetId, result]) => {
          const target = sim.players.find((pl) => pl.id === targetId);
          if (target) {
            log(sim, 'action', `${p.name}（宣称预言家）公布查验：${target.name} 是 ${result === 'werewolf' ? '狼人' : '村民'}`);
            sim.publicActions.push({
              actorId: p.id,
              type: ACTION.CLAIM_IDENTITY,
              targetId: target.id,
              details: { claimType: 'prophet_check', result },
              round: sim.round,
            });
          }
        });
      }
    }
  });

  // 3. Overnight recovery: stress and relations naturally recover toward 0
  sim.players.forEach((p) => {
    if (p.alive) {
      if (p.stress > 0) {
        p.stress = clampStress(p.stress - (STRESS_RECOVERY_BASE + (Math.random() > 0.5 ? STRESS_RECOVERY_BONUS : 0)));
      } else if (p.stress < 0) {
        p.stress = clampStress(p.stress + (STRESS_RECOVERY_BASE + (Math.random() > 0.5 ? STRESS_RECOVERY_BONUS : 0)));
      }
      // 关系自然恢复：所有关系值向 0 回归
      Object.keys(p.relations).forEach((otherId) => {
        const rel = p.relations[otherId];
        if (rel) {
          if (rel.favor > 0) rel.favor = clampRelation(rel.favor - RELATION_NATURAL_RECOVERY);
          else if (rel.favor < 0) rel.favor = clampRelation(rel.favor + RELATION_NATURAL_RECOVERY);
        }
      });
    }
  });

  log(sim, 'info', ' overnight 状态自然恢复完成。');
}
