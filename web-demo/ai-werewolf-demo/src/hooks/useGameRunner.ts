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
      // 只保留 winner 对应的候选（精简字段）
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

    // 移除空 checks 数组
    if (Array.isArray(details.checks) && details.checks.length === 0) {
      delete details.checks;
    }

    // 移除 mentions（内部字段）
    delete details.mentions;

    return { ...log, details };
  });
}

function exportGameLog(sim: GameSimulator) {
  const data = {
    timestamp: new Date().toISOString(),
    winner: sim.getWinner(),
    totalRounds: sim.round,
    players: sim.getPlayers().map(p => ({
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
  const [speed, setSpeed] = useState(1); // 倍速: 1x = 2s/步

  const simulatorRef = useRef<GameSimulator | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const phaseRef = useRef('setup');

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
      // 避免不必要的重渲染：只在关键字段变化时更新
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

  const runNextStep = useCallback(() => {
    if (pausedRef.current) {
      return;
    }
    const sim = simulatorRef.current;
    if (!sim) {
      return;
    }

    const hasMore = sim.executeNextStep();
    syncFromSimulator();

    if (!hasMore) {
      const win = sim.getWinner();
      if (win) {
        setWinner(win);
        setPhase('ended');
        return;
      }
      sim.generateRoundSteps();
    }

    if (!pausedRef.current && phaseRef.current !== 'ended') {
      const tickRate = (sim.getCurrentTickRate?.() ?? DEFAULT_TICK_RATE);
      const delay = tickRate / speedRef.current;
      timerRef.current = setTimeout(() => runNextStepRef.current?.(), delay);
    }
  }, [syncFromSimulator]);

  useEffect(() => {
    runNextStepRef.current = runNextStep;
  }, [runNextStep]);

  const startGame = useCallback(
    (config: GameConfig) => {
      console.log(`[startGame] speed=${speedRef.current}`);
      const configs = generateGameConfig(config.totalPlayers, config.werewolfConfig, config.villagerConfig);
      const sim = new GameSimulator(configs);
      simulatorRef.current = sim;
      pausedRef.current = false;
      setWinner(null);
      setRound(0);
      setLogs([]);
      setPlayers(sim.getPlayers());
      setPhase('running');
      sim.generateRoundSteps();
      // 立即开始，不等待
      timerRef.current = setTimeout(() => runNextStepRef.current?.(), 0);
    },
    [runNextStep]
  );

  const pauseGame = useCallback(() => {
    console.log('[pauseGame]');
    pausedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase('paused');
  }, []);

  const resumeGame = useCallback(() => {
    console.log('[resumeGame]');
    pausedRef.current = false;
    setPhase('running');
    const sim = simulatorRef.current;
    const tickRate = sim?.getCurrentTickRate?.() ?? DEFAULT_TICK_RATE;
    const delay = tickRate / speedRef.current;
    console.log(`[resumeGame] delay=${delay}ms tickRate=${tickRate}`);
    timerRef.current = setTimeout(() => runNextStepRef.current?.(), delay);
  }, [runNextStep]);

  const nextStep = useCallback(() => {
    console.log('[nextStep] manual');
    const sim = simulatorRef.current;
    if (!sim || phaseRef.current === 'ended') return;
    const hasMore = sim.executeNextStep();
    syncFromSimulator();
    if (!hasMore) {
      const win = sim.getWinner();
      if (win) {
        setWinner(win);
        setPhase('ended');
      } else {
        sim.generateRoundSteps();
      }
    }
  }, [syncFromSimulator]);

  const resetGame = useCallback(() => {
    console.log('[resetGame]');
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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
