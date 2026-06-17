import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { GameLogItem } from '../lib/ai/types';
import type { GameSimulator } from '../lib/game/simulator';

interface PlayerState {
  id: string;
  name: string;
  role: string;
  team: string;
  alive: boolean;
  items: string[];
  belief: Record<string, unknown>;
}

interface GameState {
  phase: 'setup' | 'running' | 'paused' | 'ended';
  round: number;
  winner: string | null;
  players: PlayerState[];
  logs: GameLogItem[];
  selectedPlayerId: string | null;
  speed: number; // ms per step
}

interface GameStore {
  state: GameState;
  simulator: GameSimulator | null;
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setSimulator: (sim: GameSimulator) => void;
  startGame: (config: { totalPlayers: number; werewolfConfig: { role: string; count: number }[]; villagerConfig: { role: string; count: number }[] }) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  nextStep: () => void;
  selectPlayer: (id: string | null) => void;
  setSpeed: (ms: number) => void;
  updateState: () => void;
}

const GameContext = createContext<GameStore | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>({
    phase: 'setup',
    round: 0,
    winner: null,
    players: [],
    logs: [],
    selectedPlayerId: null,
    speed: 2000,
  });
  const [simulator, setSimulator] = useState<GameSimulator | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateState = useCallback(() => {
    if (!simulator) return;
    setState((prev) => ({
      ...prev,
      players: simulator.getPlayerStates(),
      logs: [...simulator.getLogs()],
      round: simulator.round,
    }));
  }, [simulator]);

  const startGame = useCallback(
    (config: { totalPlayers: number; werewolfConfig: { role: string; count: number }[]; villagerConfig: { role: string; count: number }[] }) => {
      import('../lib/game/simulator').then(({ generateGameConfig, GameSimulator }) => {
        const configs = generateGameConfig(config.totalPlayers, config.werewolfConfig, config.villagerConfig);
        const sim = new GameSimulator(configs);
        setSimulator(sim);
        setState({
          phase: 'running',
          round: 0,
          winner: null,
          players: sim.getPlayerStates(),
          logs: [],
          selectedPlayerId: null,
          speed: 2000,
        });
        // schedule first round
        const timer = setTimeout(() => {
          runNextRound(sim);
        }, 2000);
        timerRef.current = timer;
      });
    },
    []
  );

  const runNextRound = (sim: GameSimulator) => {
    const winner = sim.runRound();
    const newLogs = [...sim.getLogs()];
    const newPlayers = sim.getPlayerStates();
    const newRound = sim.round;
    setState((prev) => ({
      ...prev,
      players: newPlayers,
      logs: newLogs,
      round: newRound,
      winner: winner || prev.winner,
      phase: winner ? 'ended' : prev.phase,
    }));
    if (!winner) {
      const timer = setTimeout(() => runNextRound(sim), 2000);
      timerRef.current = timer;
    }
  };

  const pauseGame = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, phase: 'paused' }));
  }, []);

  const resumeGame = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'running' }));
    if (simulator && state.phase !== 'ended') {
      const timer = setTimeout(() => runNextRound(simulator), state.speed);
      timerRef.current = timer;
    }
  }, [simulator, state.phase, state.speed]);

  const nextStep = useCallback(() => {
    if (!simulator || state.phase === 'ended') return;
    const winner = simulator.runRound();
    setState((prev) => ({
      ...prev,
      players: simulator.getPlayerStates(),
      logs: [...simulator.getLogs()],
      round: simulator.round,
      winner: winner || prev.winner,
      phase: winner ? 'ended' : prev.phase,
    }));
  }, [simulator, state.phase]);

  const selectPlayer = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, selectedPlayerId: id }));
  }, []);

  const setSpeed = useCallback((ms: number) => {
    setState((prev) => ({ ...prev, speed: ms }));
  }, []);

  const store: GameStore = {
    state,
    simulator,
    timerRef,
    setSimulator,
    startGame,
    pauseGame,
    resumeGame,
    nextStep,
    selectPlayer,
    setSpeed,
    updateState,
  };

  return <GameContext.Provider value={store}>{children}</GameContext.Provider>;
}

export function useGameStore() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameStore must be used within GameProvider');
  return ctx;
}
