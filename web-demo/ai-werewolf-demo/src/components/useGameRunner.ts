import { useState, useCallback, useRef, useEffect } from 'react';
import { GameSimulator, generateGameConfig } from '../lib/game/simulator';
import type { GameLogItem, Player } from '../lib/ai/types';

export interface GameConfig {
  totalPlayers: number;
  werewolfConfig: { role: string; count: number }[];
  villagerConfig: { role: string; count: number }[];
}

export type PlayerState = Player;

export function useGameRunner() {
  const [phase, setPhase] = useState<'setup' | 'running' | 'paused' | 'ended'>('setup');
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [logs, setLogs] = useState<GameLogItem[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [speed, setSpeed] = useState(2000);

  const simulatorRef = useRef<GameSimulator | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const speedRef = useRef(2000);
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
    setPlayers(sim.getPlayerStates());
    setLogs([...sim.getLogs()]);
    setRound(sim.round);
  }, []);

  const runNextStep = useCallback(() => {
    if (pausedRef.current) return;
    const sim = simulatorRef.current;
    if (!sim) return;

    const hasMore = sim.executeNextStep();
    syncFromSimulator();

    if (!hasMore) {
      // 一轮步骤执行完毕
      const win = sim.getWinner();
      if (win) {
        setWinner(win);
        setPhase('ended');
        return;
      }
      // 生成下一轮步骤
      sim.generateRoundSteps();
    }

    if (!pausedRef.current && phaseRef.current !== 'ended') {
      timerRef.current = setTimeout(runNextStep, speedRef.current);
    }
  }, [syncFromSimulator]);

  const startGame = useCallback(
    (config: GameConfig) => {
      const configs = generateGameConfig(config.totalPlayers, config.werewolfConfig, config.villagerConfig);
      const sim = new GameSimulator(configs);
      simulatorRef.current = sim;
      pausedRef.current = false;
      setWinner(null);
      setRound(0);
      setLogs([]);
      setPlayers(sim.getPlayerStates());
      setPhase('running');
      sim.generateRoundSteps();
      timerRef.current = setTimeout(runNextStep, speedRef.current);
    },
    [runNextStep]
  );

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
    timerRef.current = setTimeout(runNextStep, speedRef.current);
  }, [runNextStep]);

  const nextStep = useCallback(() => {
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
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    simulatorRef.current = null;
    pausedRef.current = false;
    setPhase('setup');
    setRound(0);
    setWinner(null);
    setPlayers([]);
    setLogs([]);
    setSelectedPlayerId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    phase,
    round,
    winner,
    players,
    logs,
    selectedPlayerId,
    speed,
    setSpeed,
    setSelectedPlayerId,
    startGame,
    pauseGame,
    resumeGame,
    nextStep,
    resetGame,
  };
}
