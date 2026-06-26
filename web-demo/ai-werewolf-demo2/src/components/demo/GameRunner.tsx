import React from 'react';
import { useGameRunner } from './useGameRunner';
import { SetupPanel } from './SetupPanel';
import { PlayerPanel } from './PlayerPanel';
import { TimelinePanel } from './TimelinePanel';
import { DetailPanel } from './DetailPanel';

export default function GameRunner() {
  const state = useGameRunner();

  if (state.phase === 'setup') {
    return <SetupPanel config={state.config} setConfig={state.setConfig} totalPlayers={state.totalPlayers} startGame={state.startGame} />;
  }

  return (
    <div className="h-screen bg-slate-900 text-slate-200 flex flex-col">
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-slate-700 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐺</span>
          <span className="font-bold text-amber-400">AI 狼人杀</span>
          <span className="text-sm text-slate-400">第 {state.activeRound} 轮 | 狼人 {state.config.werewolfCount} | 村民 {state.config.villagerCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => state.setMode((m) => (m === 'auto' ? 'step' : 'auto'))} className={`px-3 py-1.5 rounded-lg text-sm transition ${state.mode === 'auto' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>{state.mode === 'auto' ? '🔄 自动模式' : '🦶 步进模式'}</button>
          {state.mode === 'step' && (
            <button onClick={state.doStep} disabled={state.isGameOver} className={`px-3 py-1.5 rounded-lg text-sm transition ${state.isGameOver ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>⏩ 下一步</button>
          )}
          {state.mode === 'auto' && (
            <button onClick={state.togglePlay} className={`px-3 py-1.5 rounded-lg text-sm transition ${state.isPlaying ? 'bg-amber-600 hover:bg-amber-500' : (state.isGameOver ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500')}`}>{state.isPlaying ? '⏸ 暂停' : (state.isGameOver ? '↺ 重播' : '▶ 继续')}</button>
          )}
          <button onClick={state.reset} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm border border-slate-700 transition">↺ 重置</button>
        </div>
      </div>

      {/* Three columns */}
      <div className="flex-1 flex overflow-hidden">
        <PlayerPanel
          players={state.initialPlayers}
          deadPlayers={state.deadPlayers}
          selectedPlayer={state.selectedPlayer}
          lastPlayerId={state.lastPlayerId ?? null}
          onSelect={state.setSelectedPlayer}
        />
        <TimelinePanel logs={state.logs} isPlaying={state.isPlaying} isGameOver={state.isGameOver} logRef={state.logRef} />
        <DetailPanel
          activeResult={state.activeResult}
          activePlayerId={state.activePlayerId ?? null}
          activePlayerObj={state.activePlayerObj ?? undefined}
          deadPlayers={state.deadPlayers}
          initialPlayers={state.initialPlayers}
          logsLength={state.logs.length}
          activeTab={state.activeTab}
          setActiveTab={state.setActiveTab}
          openSections={state.openSections}
          toggleSection={state.toggleSection}
        />
      </div>
    </div>
  );
}
