import { useState, useCallback, useRef, useEffect } from 'react';
import { GameSimulator, generateGameConfig } from '../lib/game/simulator';
import type { GameLogItem, Player, Role } from '@/types';
import { DEFAULT_TICK_RATE } from '@/types';

export interface GameConfig {
  totalPlayers: number;
  werewolfConfig: { role: Role; count: number }[];
  villagerConfig: { role: Role; count: number }[];
}

export type PlayerState = Player;

function compressLogForExport(logs: GameLogItem[]): GameLogItem[] {
  return logs.map((log) => {
    if (!log.details) return log;
    const details = { ...log.details };

    // 压缩 process：移除 candidates 非 winner 和 shortlist
    if (details.process && typeof details.process === 'object') {
      const proc = details.process as Record<string, unknown>;
      const winnerStr = proc.winner as string;
      const candidates = proc.candidates as Record<string, unknown>[] | undefined;
      const winnerCandidate = candidates?.find((c) => {
        const key = `${c.action} → ${c.target || '无目标'}`;
        return key === winnerStr;
      });
      if (winnerCandidate) {
        const { reason: _r, trigger: _t, ...slimWinner } = winnerCandidate;
        details.process = { winner: slimWinner, candidateCount: candidates?.length ?? 0 };
      } else {
        details.process = { winner: winnerStr, candidateCount: candidates?.length ?? 0 };
      }
    }

    if (Array.isArray(details.checks) && details.checks.length === 0) {
      delete details.checks;
    }
    delete details.mentions;

    return { ...log, details };
  });
}

function exportGameLog(sim: GameSimulator) {
  const data = {
    timestamp: new Date().toISOString(),
    winner: sim.getWinner(),
    totalRounds: sim.round,
    players: sim.getPlayers().map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      team: p.team,
      alive: p.alive,
      attributes: p.attributes,
      alignment: p.alignment,
      stress: p.stress,
      items: p.items,
      traits: p.traits,
      relations: p.relations,
    })),
    logs: compressLogForExport(sim.getLogs()),
    publicActions: sim.getPublicActions(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `werewolf-log-${data.timestamp.replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useGameRunner() {
  const [phase, setPhase] = useState<'setup' | 'running' | 'paused' | 'ended'>('setup');
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [logs, setLogs] = useState<GameLogItem[]>([]);
  const [speed, setSpeed] = useState(1);

  const simulatorRef = useRef<GameSimulator | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const phaseRef = useRef('setup');
  const lastProgressRef = useRef<number>(0);
  const watchdogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const syncFromSimulator = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim) return;
    const newPlayers = sim.getPlayers();
    const newLogs = sim.getLogs();

    setPlayers((prev) => {
      if (
        prev.length === newPlayers.length &&
        prev.every(
          (p, i) =>
            p.alive === newPlayers[i].alive &&
            p.stress === newPlayers[i].stress &&
            p.id === newPlayers[i].id
        )
      ) {
        return prev;
      }
      return newPlayers;
    });

    setLogs([...newLogs]);
    setRound(sim.round);
  }, []);

  const runNextStepRef = useRef<(() => void) | undefined>(undefined);

  const _safeTick = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim) return;
    try {
      const hasMore = sim.executeNextStep();
      syncFromSimulator();
      if (!hasMore) {
        const win = sim.getWinner();
        if (win) {
          setWinner(win);
          setPhase('ended');
          phaseRef.current = 'ended'; // 同步更新，避免看门狗误判
          lastProgressRef.current = Date.now(); // 更新进度，避免看门狗触发
          return;
        }
        sim.generateRoundSteps();
      }
      lastProgressRef.current = Date.now();
    } catch (e) {
      console.error('[useGameRunner] tick error:', e);
    }
  }, [syncFromSimulator]);

  const runNextStep = useCallback(() => {
    if (pausedRef.current) return;
    const sim = simulatorRef.current;
    if (!sim) return;

    _safeTick();

    if (!pausedRef.current && phaseRef.current !== 'ended') {
      const tickRate = sim.getCurrentTickRate?.() ?? DEFAULT_TICK_RATE;
      const delay = tickRate / speedRef.current;
      timerRef.current = setTimeout(() => runNextStepRef.current?.(), delay);
    }
  }, [_safeTick]);

  useEffect(() => {
    runNextStepRef.current = runNextStep;
  }, [runNextStep]);

  const startGame = useCallback((config: GameConfig) => {
    const configs = generateGameConfig(config.totalPlayers, config.werewolfConfig, config.villagerConfig);
    const sim = new GameSimulator(configs);
    simulatorRef.current = sim;
    pausedRef.current = false;
    setWinner(null);
    setRound(0);
    setLogs([]);
    setPlayers(sim.getPlayers());
    setPhase('running');
    lastProgressRef.current = Date.now();
    sim.generateRoundSteps();
    timerRef.current = setTimeout(() => runNextStepRef.current?.(), 0);
  }, []);

  const pauseGame = useCallback(() => {
    pausedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase('paused');
  }, []);

  const resumeGame = useCallback(() => {
    pausedRef.current = false;
    setPhase('running');
    lastProgressRef.current = Date.now();
    const sim = simulatorRef.current;
    const tickRate = sim?.getCurrentTickRate?.() ?? DEFAULT_TICK_RATE;
    const delay = tickRate / speedRef.current;
    timerRef.current = setTimeout(() => runNextStepRef.current?.(), delay);
  }, []);

  const nextStep = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim || phaseRef.current === 'ended') return;
    _safeTick();
  }, [_safeTick]);

  const resetGame = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    simulatorRef.current = null;
    pausedRef.current = false;
    setPhase('setup');
    setRound(0);
    setWinner(null);
    setPlayers([]);
    setLogs([]);
  }, []);

  // 看门狗：检测流程卡住并自动推动
  useEffect(() => {
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
    if (phase !== 'running') return;

    watchdogIntervalRef.current = setInterval(() => {
      if (pausedRef.current || phaseRef.current !== 'running') return;
      const elapsed = Date.now() - lastProgressRef.current;
      if (elapsed > 10000) {
        const sim = simulatorRef.current;
        if (!sim) return;

        // 健壮性：如果已经分出胜负，同步结束避免看门狗误报
        const win = sim.getWinner();
        if (win) {
          phaseRef.current = 'ended';
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = null;
          return;
        }

        // 检查是否有 actor 卡住
        const stuckActors: string[] = [];
        sim.actors.forEach((actor, id) => {
          if (actor.state !== 'idle') {
            stuckActors.push(`${id}(${actor.state})`);
          }
        });

        console.error(
          `[useGameRunner] ⚠️ WATCHDOG: game stuck for ${elapsed}ms. ` +
          `simulator phase=${sim.phase}, round=${sim.round}, ` +
          `stuck actors=[${stuckActors.join(', ') || 'none'}]`
        );

        // 强制推动：恢复卡住的 actor 并执行一次 tick
        if (stuckActors.length > 0) {
          sim.actors.forEach((actor) => {
            if (actor.state !== 'idle') {
              actor.state = 'idle';
              actor.pendingEvent = null;
              actor.thinkCountdown = 0;
            }
          });
          console.error('[useGameRunner] WATCHDOG: forced all actors to idle');
        }

        _safeTick();

        // 如果 tick 后仍未结束，重新设置 timer
        if (!pausedRef.current && phaseRef.current !== 'ended') {
          const tickRate = sim.getCurrentTickRate?.() ?? DEFAULT_TICK_RATE;
          const delay = tickRate / speedRef.current;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => runNextStepRef.current?.(), delay);
        }
      }
    }, 2000);

    return () => {
      if (watchdogIntervalRef.current) {
        clearInterval(watchdogIntervalRef.current);
        watchdogIntervalRef.current = null;
      }
    };
  }, [phase, _safeTick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    };
  }, []);

  const exportLog = useCallback(() => {
    const sim = simulatorRef.current;
    if (sim) exportGameLog(sim);
  }, []);

  return {
    phase,
    round,
    winner,
    players,
    logs,
    speed,
    setSpeed,
    startGame,
    pauseGame,
    resumeGame,
    nextStep,
    resetGame,
    exportLog,
  };
}
