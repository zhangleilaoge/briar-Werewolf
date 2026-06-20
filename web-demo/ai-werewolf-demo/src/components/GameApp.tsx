import { useState, useCallback } from 'react';
import { useGameRunner } from '@/hooks/useGameRunner';
import type { PlayerState } from '@/hooks/useGameRunner';
import SetupPanel from './SetupPanel';
import GameHeader from './game/GameHeader';
import PlayerList from './game/PlayerList';
import LogPanel from './game/LogPanel';
import PlayerDrawer from './game/PlayerDrawer';
import RulesModal from './game/RulesModal';

export default function GameApp() {
  const game = useGameRunner();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [rulesOpen, setRulesOpen] = useState(false);

  const toggleLog = useCallback((idx: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setSelectedPlayer(null);
  }, []);

  if (game.phase === 'setup') {
    return <SetupPanel onStart={game.startGame} />;
  }

  const isRunning = game.phase === 'running';
  const isEnded = game.phase === 'ended';
  const werewolfCount = game.players.filter((p) => p.team === 'werewolf' && p.alive).length;
  const villagerCount = game.players.filter((p) => p.team !== 'werewolf' && p.alive).length;

  return (
    <div className="h-screen flex flex-col">
      <GameHeader
        round={game.round}
        werewolfCount={werewolfCount}
        villagerCount={villagerCount}
        isRunning={isRunning}
        isEnded={isEnded}
        winner={game.winner}
        speed={game.speed}
        setSpeed={game.setSpeed}
        pauseGame={game.pauseGame}
        resumeGame={game.resumeGame}
        resetGame={game.resetGame}
        exportLog={game.exportLog}
        onOpenRules={() => setRulesOpen(true)}
      />

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <div className="flex-1 flex overflow-hidden">
        <PlayerList
          players={game.players}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={setSelectedPlayer}
        />

        <LogPanel
          logs={game.logs}
          players={game.players}
          expandedLogs={expandedLogs}
          onToggleLog={toggleLog}
        />

        <PlayerDrawer
          selectedPlayer={selectedPlayer}
          players={game.players}
          drawerOpen={drawerOpen}
          onToggleDrawer={handleToggleDrawer}
          onClosePlayer={handleClosePlayer}
        />
      </div>
    </div>
  );
}
