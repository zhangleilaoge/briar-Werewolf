// ============================================================
// useGameRunner — 游戏运行状态管理 Hook
// ============================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { GameEngine } from './game-runner-engine';
import type { GameConfig, GameLog, PlayerResult } from './game-runner-types';

export function useGameRunner() {
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [config, setConfig] = useState<GameConfig>({ werewolfCount: 1, prophetCount: 1, villagerCount: 5 });
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [allPlayerResults, setAllPlayerResults] = useState<Map<string, PlayerResult>>(new Map());
  const [isGameOver, setIsGameOver] = useState(false);
  const [mode, setMode] = useState<'auto' | 'step'>('auto');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['attributes', 'memories', 'relations', 'inferences', 'intentions']));
  const [activeTab, setActiveTab] = useState<'basic' | 'thinking'>('basic');
  const logRef = useRef<HTMLDivElement>(null);

  const totalPlayers = config.werewolfCount + config.prophetCount + config.villagerCount;
  const currentLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const activeRound = currentLog ? currentLog.round : 1;
  const lastPlayerLog = logs.length > 0 ? [...logs].reverse().find((l) => l.playerId) : null;
  const activePlayerId = selectedPlayer || currentLog?.playerId || lastPlayerLog?.playerId;
  const activeResult = activePlayerId ? allPlayerResults.get(activePlayerId) || null : null;
  const activePlayerObj = activePlayerId ? engine?.players.find((p) => p.id === activePlayerId) : null;
  const initialPlayers = engine?.players || [];
  const lastPlayerId = logs.length > 0 ? [...logs].reverse().find((l) => l.playerId && l.subPhase === 'day')?.playerId : null;

  const deadPlayers = new Set<string>();
  for (const log of logs) { if (log.deathEvent) deadPlayers.add(log.deathEvent.playerId); }

  // Timer (only in auto mode)
  useEffect(() => {
    if (mode !== 'auto' || !isPlaying || isGameOver) { if (isGameOver) setIsPlaying(false); return; }
    const delay = speed === 1 ? 1000 : 500;
    const timer = setTimeout(() => doStep(), delay);
    return () => clearTimeout(timer);
  }, [mode, isPlaying, isGameOver, speed, logs.length]);

  // Auto-scroll
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs.length]);

  const doStep = useCallback(() => {
    if (!engine || isGameOver) return;
    const result = engine.step();
    if (!result) {
      setIsGameOver(true);
      setIsPlaying(false);
      return;
    }
    setLogs((prev) => [...prev, result.log]);
    setAllPlayerResults((prev) => {
      const next = new Map(prev);
      for (const [k, v] of result.playerResults.entries()) {
        next.set(k, v);
      }
      return next;
    });
    if (engine.winner) {
      setIsGameOver(true);
      setIsPlaying(false);
    }
  }, [engine, isGameOver]);

  const startGame = useCallback(() => {
    const newEngine = new GameEngine(config);
    setEngine(newEngine);
    setLogs([]);
    setAllPlayerResults(new Map());
    setIsGameOver(false);
    setIsPlaying(true);
    setSelectedPlayer(null);
    setPhase('playing');
  }, [config]);

  const reset = useCallback(() => {
    setPhase('setup'); setEngine(null); setLogs([]); setAllPlayerResults(new Map()); setIsGameOver(false); setIsPlaying(false); setSpeed(1); setSelectedPlayer(null);
  }, []);

  const togglePlay = useCallback(() => { if (isGameOver) { startGame(); } else { setIsPlaying((p) => !p); } }, [isGameOver, startGame]);
  const toggleSpeed = useCallback(() => setSpeed((s) => (s === 1 ? 2 : 1)), []);
  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return {
    // State
    phase, config, engine, logs, allPlayerResults, isGameOver,
    mode, isPlaying, speed, selectedPlayer, openSections, activeTab,
    logRef, totalPlayers,
    // Derived
    currentLog, activeRound, lastPlayerLog, activePlayerId,
    activeResult, activePlayerObj, initialPlayers, lastPlayerId, deadPlayers,
    // Actions
    setConfig, setMode, setSelectedPlayer, setActiveTab,
    doStep, startGame, reset, togglePlay, toggleSpeed, toggleSection,
  };
}