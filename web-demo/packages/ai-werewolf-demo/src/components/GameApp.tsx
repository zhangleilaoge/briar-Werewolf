import { useState } from 'react';
import { useGameRunner } from './useGameRunner';
import SetupPanel from './SetupPanel';
import type { GameLogItem } from '../lib/ai/types';
import type { PlayerState } from './useGameRunner';

export default function GameApp() {
  const game = useGameRunner();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerState | null>(null);

  if (game.phase === 'setup') {
    return <SetupPanel onStart={game.startGame} />;
  }

  const isRunning = game.phase === 'running';
  const isPaused = game.phase === 'paused';
  const isEnded = game.phase === 'ended';

  const werewolfCount = game.players.filter((p) => p.team === 'werewolf' && p.alive).length;
  const villagerCount = game.players.filter((p) => p.team !== 'werewolf' && p.alive).length;

  const roleNameMap: Record<string, string> = {
    werewolf: '狼人',
    lone_wolf: '孤狼',
    berserker: '狂狼',
    villager: '村民',
    prophet: '预言家',
    thief: '窃贼',
    coroner: '验尸官',
  };

  const itemNameMap: Record<string, string> = {
    crystal_ball: '水晶球',
    claws: '尖牙利爪',
    double_sword: '双刃剑',
    thief_gloves: '小偷手套',
    coroner_tools: '验尸工具',
  };

  const getLogColor = (type: GameLogItem['type']) => {
    switch (type) {
      case 'phase': return 'text-blue-400';
      case 'action': return 'text-yellow-300';
      case 'death': return 'text-red-400';
      case 'victory': return 'text-green-400 font-bold';
      default: return 'text-gray-400';
    }
  };

  const renderBelief = (belief: Record<string, unknown>) => {
    const l0 = belief.l0 as Record<string, unknown> || {};
    const l1 = belief.l1 as Record<string, unknown> || {};
    const l3 = belief.l3 as Record<string, unknown> || {};
    const l0Checks = l0.checks as Record<string, string> || {};
    const l1Top = l1.topSuspect as { id: string | null; probability: number } | undefined;
    const l3Relations = l3.relations as Record<string, { friendly: number; trust: number }> || {};

    return (
      <div className="space-y-3">
        {Object.keys(l0Checks).length > 0 && (
          <div>
            <div className="text-xs font-bold text-orange-400 mb-1">🔒 L0 查验事实（不可覆盖）</div>
            {Object.entries(l0Checks).map(([tid, result]) => {
              const target = game.players.find((p) => p.id === tid);
              return (
                <div key={tid} className="text-sm">
                  {target?.name}: <span className={result === 'werewolf' ? 'text-red-400 font-bold' : 'text-green-400'}>
                    {result === 'werewolf' ? '狼人' : '村民'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {l1Top && l1Top.id && (
          <div>
            <div className="text-xs font-bold text-purple-400 mb-1">🧠 L1 最高嫌疑</div>
            <div className="text-sm">
              {game.players.find((p) => p.id === l1Top.id)?.name}: {(l1Top.probability * 100).toFixed(0)}%
            </div>
          </div>
        )}
        {Object.keys(l3Relations).length > 0 && (
          <div>
            <div className="text-xs font-bold text-green-400 mb-1">❤️ L3 社交关系</div>
            {Object.entries(l3Relations).map(([tid, rel]) => {
              if (Math.abs(rel.friendly) < 0.1) return null;
              const target = game.players.find((p) => p.id === tid);
              return (
                <div key={tid} className="text-sm">
                  {target?.name}: {rel.friendly > 0 ? '😊' : '😠'} {rel.friendly.toFixed(1)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {/* 顶部控制栏 */}
      <div className="bg-card border-b border-border p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">🐺 AI 狼人杀</h1>
          <div className="text-sm text-muted-foreground">
            第 {game.round} 轮 | 狼人 {werewolfCount} | 村民 {villagerCount}
          </div>
          {isEnded && game.winner && (
            <div className="text-lg font-bold text-green-400">
              {game.winner === 'villager' ? '🏆 村民胜利！' : '🏆 狼人胜利！'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-secondary text-secondary-foreground rounded px-2 py-1 text-sm"
            value={game.speed}
            onChange={(e) => game.setSpeed(Number(e.target.value))}
          >
            <option value={500}>0.5s</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={3000}>3s</option>
            <option value={5000}>5s</option>
          </select>
          {!isEnded && (
            <>
              {isRunning ? (
                <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-bold hover:opacity-90" onClick={game.pauseGame}>
                  ⏸ 暂停
                </button>
              ) : (
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:opacity-90" onClick={game.resumeGame}>
                  ▶ 继续
                </button>
              )}
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:opacity-90" onClick={game.nextStep}>
                ⏭ 下一步
              </button>
            </>
          )}
          <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold hover:opacity-90" onClick={game.resetGame}>
            ↺ 重置
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：玩家列表 */}
        <div className="w-64 bg-card border-r border-border overflow-y-auto p-4">
          <h3 className="text-sm font-bold mb-3 text-muted-foreground">参与角色</h3>
          <div className="space-y-2">
            {game.players.map((p) => (
              <button
                key={p.id}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  p.alive
                    ? p.team === 'werewolf'
                      ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20'
                      : 'border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
                    : 'border-gray-600/30 bg-gray-800/50 opacity-60'
                } ${selectedPlayer?.id === p.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedPlayer(p)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{p.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${p.alive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                    {p.alive ? '存活' : '死亡'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {roleNameMap[p.role] || p.role} {p.team === 'werewolf' ? '· 狼' : '· 好'}
                </div>
                {p.items.length > 0 && (
                  <div className="text-xs text-yellow-400 mt-1">
                    {p.items.map((i) => itemNameMap[i] || i).join(', ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 中间：日志 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {game.logs.map((log, idx) => (
              <div key={idx} className={`text-sm font-mono ${getLogColor(log.type)}`}>
                {log.message}
              </div>
            ))}
            {game.logs.length === 0 && (
              <div className="text-muted-foreground text-sm">等待游戏开始...</div>
            )}
          </div>
        </div>

        {/* 右侧：选中玩家状态 */}
        <div className="w-72 bg-card border-l border-border overflow-y-auto p-4">
          {selectedPlayer ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{selectedPlayer.name}</h3>
                <button className="text-muted-foreground hover:text-foreground" onClick={() => setSelectedPlayer(null)}>
                  ✕
                </button>
              </div>
              <div className="space-y-3 mb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">职业：</span>
                  <span className={selectedPlayer.team === 'werewolf' ? 'text-red-400' : 'text-green-400'}>
                    {roleNameMap[selectedPlayer.role] || selectedPlayer.role}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">阵营：</span>
                  <span className={selectedPlayer.team === 'werewolf' ? 'text-red-400' : 'text-green-400'}>
                    {selectedPlayer.team === 'werewolf' ? '狼人' : '村民'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">状态：</span>
                  <span className={selectedPlayer.alive ? 'text-green-400' : 'text-red-400'}>
                    {selectedPlayer.alive ? '存活' : '死亡'}
                  </span>
                </div>
                {selectedPlayer.items.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">道具：</span>
                    <span className="text-yellow-400">
                      {selectedPlayer.items.map((i) => itemNameMap[i] || i).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-2 text-muted-foreground">AI 信念状态</h4>
                {renderBelief(selectedPlayer.belief)}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center mt-8">
              点击左侧角色查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
