import { useState, useCallback, useRef, useEffect } from 'react';
import { GameSimulator, generateGameConfig } from '../lib/game/simulator';
import type { GameLogItem } from '../lib/ai/types';

export interface PlayerState {
  id: string;
  name: string;
  role: string;
  team: string;
  alive: boolean;
  items: string[];
  belief: Record<string, unknown>;
}

export interface GameConfig {
  totalPlayers: number;
  werewolfConfig: { role: string; count: number }[];
  villagerConfig: { role: string; count: number }[];
}

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

  const syncFromSimulator = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim) return;
    setPlayers(sim.getPlayerStates());
    setLogs([...sim.getLogs()]);
    setRound(sim.round);
  }, []);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const currentSpeed = speed;
    timerRef.current = setTimeout(() => {
      if (pausedRef.current) return;
      const sim = simulatorRef.current;
      if (!sim) return;
      const win = sim.runRound();
      syncFromSimulator();
      if (win) {
        setWinner(win);
        setPhase('ended');
        timerRef.current = null;
      } else if (!pausedRef.current) {
        scheduleNext();
      }
    }, currentSpeed);
  }, [speed, syncFromSimulator]);

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
      scheduleNext();
    },
    [scheduleNext]
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
    scheduleNext();
  }, [scheduleNext]);

  const nextStep = useCallback(() => {
    const sim = simulatorRef.current;
    if (!sim || phase === 'ended') return;
    const win = sim.runRound();
    syncFromSimulator();
    if (win) {
      setWinner(win);
      setPhase('ended');
    }
  }, [phase, syncFromSimulator]);

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
