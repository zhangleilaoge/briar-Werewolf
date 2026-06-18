import {
  SCORE_PROPHET_CHECK_BASE, SCORE_WEREWOLF_KILL_BASE, SCORE_WEREWOLF_KILL_GOD_BONUS,
  SCORE_THIEF_STEAL_BASE, SCORE_CORONER_INSPECT_BASE, SCORE_EMPTY_KILL,
  WEREWOLF_PROBABILITY_LOW, EMPTY_KILL_CHANCE, SCORE_MAX_INFO_VOTE, SCORE_SPEAK_BREAK_SILENCE,
} from '@/types';
import { calculateBehaviorScoreDelta } from '../behavior-modifiers';
import type { Strategy, } from './engine';

// ---------- Prophet: Night Check ----------
export const ProphetCheckStrategy: Strategy = {
  name: 'prophet_night_check',
  requiredRoles: ['prophet'],
  requiredPhase: ['night'],
  evaluate(context) {
    const { belief, self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const alivePlayers = allPlayers.filter((p) => p.id !== self.id && p.alive);

    alivePlayers.forEach((target) => {
      if (belief.l0Facts.checks[target.id] !== undefined) return;
      const wolfProb = belief.getWerewolfProbability(target.id);
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'check', target.id);
      result.push({
        action: 'check',
        target: target.id,
        score: wolfProb * SCORE_MAX_INFO_VOTE + SCORE_PROPHET_CHECK_BASE + scoreDelta,
        confidence: 0.7,
        reason: `优先查验${target.name}，L1推理狼嫌疑${(wolfProb * SCORE_MAX_INFO_VOTE).toFixed(0)}%${reason}`,
        strategy: 'ProphetCheckStrategy',
        rule: 'check_high_suspect',
        trigger: `wolfProb=${wolfProb.toFixed(2)}，未查验过`,
      });
    });

    if (result.length === 0) {
      const unchecked = alivePlayers.filter((p) => belief.l0Facts.checks[p.id] === undefined);
      if (unchecked.length > 0) {
        const random = unchecked[Math.floor(Math.random() * unchecked.length)];
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'check', random.id);
        result.push({
          action: 'check',
          target: random.id,
          score: SCORE_PROPHET_CHECK_BASE - 20 + scoreDelta,
          confidence: 0.5,
          reason: `无明确嫌疑，随机查验${random.name}${reason}`,
          strategy: 'ProphetCheckStrategy',
          rule: 'check_random',
          trigger: '无明确嫌疑目标，从未查验中随机选择',
          random: true,
        });
      }
    }

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Werewolf: Night Kill (with coordination and empty-kill option) ----------
export const WerewolfKillStrategy: Strategy = {
  name: 'werewolf_kill',
  requiredRoles: ['werewolf', 'lone_wolf', 'berserker'],
  requiredPhase: ['night'],
  evaluate(context) {
    const { belief, self, allPlayers, nightDecisions } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const aliveTargets = allPlayers.filter((p) => p.id !== self.id && p.alive && p.team !== 'werewolf');

    // Check if other werewolves have already chosen a target
    const otherWolfDecisions = (nightDecisions || []).filter(
      (d) => d.action === 'kill' && d.playerId !== self.id && allPlayers.find((p) => p.id === d.playerId)?.team === 'werewolf'
    );
    if (otherWolfDecisions.length > 0) {
      const teammateTarget = otherWolfDecisions[0].targetId;
      if (teammateTarget) {
        const teammate = allPlayers.find((p) => p.id === otherWolfDecisions[0].playerId);
        const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'kill', teammateTarget);
        result.push({
          action: 'kill',
          target: teammateTarget,
          score: SCORE_SPEAK_BREAK_SILENCE + scoreDelta,
          confidence: 0.8,
          reason: `跟随队友${teammate?.name || ''}的目标，统一行动${reason}`,
          strategy: 'WerewolfKillStrategy',
          rule: 'follow_teammate',
          trigger: `队友 ${teammate?.name || ''} 已选择 target=${teammateTarget}`,
        });
      }
    }

    aliveTargets.forEach((target) => {
      const claims = belief.l0Facts.publicClaims.filter((c) => c.playerId === target.id);
      const isLikelyGod = claims.length > 0 || (belief.l2TheoryOfMind.othersKnowMyRole[target.id] ?? 0) > 0.5;
      let score = SCORE_WEREWOLF_KILL_BASE;
      if (isLikelyGod) score += SCORE_WEREWOLF_KILL_GOD_BONUS;
      if (belief.getWerewolfProbability(target.id) < WEREWOLF_PROBABILITY_LOW) score += SCORE_WEREWOLF_KILL_GOD_BONUS / 3;
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'kill', target.id);
      result.push({
        action: 'kill',
        target: target.id,
        score: score + scoreDelta,
        confidence: isLikelyGod ? 0.7 : 0.5,
        reason: isLikelyGod ? `L2推断：${target.name}疑似神职，优先击杀${reason}` : `击杀${target.name}${reason}`,
        strategy: 'WerewolfKillStrategy',
        rule: isLikelyGod ? 'kill_god_target' : 'kill_normal',
        trigger: isLikelyGod ? `claims.length=${claims.length} > 0 或 othersKnowMyRole=${(belief.l2TheoryOfMind.othersKnowMyRole[target.id] ?? 0).toFixed(2)} > 0.5` : `常规目标选择`,
      });
    });

    // Empty-kill option: skip kill to save amulets or create confusion
    if (aliveTargets.length > 0 && Math.random() < EMPTY_KILL_CHANCE) {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(self, 'kill', null);
      result.push({
        action: 'kill',
        target: null,
        score: SCORE_EMPTY_KILL + scoreDelta,
        confidence: 0.3,
        reason: `空刀：保存实力或制造平安夜${reason}`,
        strategy: 'WerewolfKillStrategy',
        rule: 'empty_kill',
        trigger: `Math.random() < EMPTY_KILL_CHANCE=${EMPTY_KILL_CHANCE}，随机空刀`,
        random: true,
      });
    }

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Thief: Night Steal ----------
export const ThiefStealStrategy: Strategy = {
  name: 'thief_steal',
  requiredRoles: ['thief'],
  requiredPhase: ['night'],
  evaluate(context) {
    const { self, allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const aliveTargets = allPlayers.filter((p) => p.id !== self.id && p.alive && p.items.length > 0);

    aliveTargets.forEach((target) => {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'steal', target.id);
      result.push({
        action: 'steal',
        target: target.id,
        score: SCORE_THIEF_STEAL_BASE + target.items.length * (SCORE_THIEF_STEAL_BASE / 4) + scoreDelta,
        confidence: 0.5,
        reason: `偷取${target.name}的道具，目标持有${target.items.length}件物品${reason}`,
        strategy: 'ThiefStealStrategy',
        rule: 'steal_item',
        trigger: `目标持有 items.length=${target.items.length} > 0`,
      });
    });

    return result.sort((a, b) => b.score - a.score);
  },
};

// ---------- Coroner: Night Inspect ----------
export const CoronerInspectStrategy: Strategy = {
  name: 'coroner_inspect',
  requiredRoles: ['coroner'],
  requiredPhase: ['night'],
  evaluate(context) {
    const { allPlayers } = context;
    const result: import('@/types').DecisionCandidate[] = [];
    const deadTargets = allPlayers.filter((p) => !p.alive && p.items.length > 0);

    deadTargets.forEach((target) => {
      const { scoreDelta, reason } = calculateBehaviorScoreDelta(context.self, 'inspect', target.id);
      result.push({
        action: 'inspect',
        target: target.id,
        score: SCORE_CORONER_INSPECT_BASE + target.items.length * (SCORE_CORONER_INSPECT_BASE / 5) + scoreDelta,
        confidence: 0.6,
        reason: `验尸${target.name}，查看其${target.items.length}件道具${reason}`,
        strategy: 'CoronerInspectStrategy',
        rule: 'inspect_body',
        trigger: `目标已死亡且 items.length=${target.items.length} > 0`,
      });
    });

    return result.sort((a, b) => b.score - a.score);
  },
};
