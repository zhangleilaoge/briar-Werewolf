import { useState } from 'react';
import { useGameRunner } from './useGameRunner';
import SetupPanel from './SetupPanel';
import type { GameLogItem, Player, ItemInstance, CheckLog, ActionLogDetail } from '../lib/ai/types';
import { getAlignmentName, ITEM_DEFINITIONS } from '../lib/ai/types';
import type { PlayerState } from './useGameRunner';

export default function GameApp() {
  const game = useGameRunner();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);

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

  const getLogColor = (type: GameLogItem['type']) => {
    switch (type) {
      case 'phase': return 'text-blue-400';
      case 'action': return 'text-yellow-300';
      case 'death': return 'text-red-400 font-bold';
      case 'victory': return 'text-green-400 font-bold';
      case 'check': return 'text-purple-400';
      case 'relation': return 'text-pink-400';
      case 'stress': return 'text-orange-400';
      case 'item': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  const itemLabel = (item: ItemInstance) => {
    const def = ITEM_DEFINITIONS[item.definitionId];
    return `${def?.name || item.definitionId}${item.durability > 0 ? '' : ' [损坏]'}`;
  };

  const attributeLabel = (key: string) => {
    const labels: Record<string, string> = {
      affinity: '亲和', logic: '逻辑', leadership: '领导',
      deception: '诡诈', stealth: '隐蔽', insight: '洞察',
    };
    return labels[key] || key;
  };

  const attributeColor = (value: number) => {
    if (value >= 8) return 'text-green-400';
    if (value >= 6) return 'text-green-300';
    if (value >= 4) return 'text-yellow-300';
    return 'text-red-300';
  };

  const stressColor = (value: number) => {
    if (value <= -5) return 'text-blue-400';
    if (value <= 2) return 'text-green-400';
    if (value <= 5) return 'text-yellow-400';
    if (value <= 8) return 'text-orange-400';
    return 'text-red-400 font-bold';
  };

  const stressLabel = (value: number) => {
    if (value <= -7) return '极度冷静';
    if (value <= -3) return '冷静';
    if (value <= 2) return '正常';
    if (value <= 5) return '轻微紧张';
    if (value <= 8) return '明显焦虑';
    return '高度紧张';
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
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
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
                    {p.items.map((i) => itemLabel(i)).join(', ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 中间：日志 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {game.logs.map((log, idx) => {
              const detail = log.details as ActionLogDetail | undefined;
              return (
                <div key={idx} className={`text-sm font-mono ${getLogColor(log.type)}`}>
                  <div>{log.message}</div>
                  {detail && (detail.decisionReason || (detail.checks && detail.checks.length > 0)) && (
                    <div className="mt-1 ml-4 text-xs text-gray-400 space-y-1 border-l-2 border-gray-700 pl-3">
                      {detail.decisionReason && (
                        <div>🧠 {detail.decisionReason}</div>
                      )}
                      {detail.checks && detail.checks.map((check, ci) => (
                        <div key={ci}>
                          <span className="text-gray-500">{check.type === 'check' ? '【直接检定】' : '【对抗检定】'}</span>
                          <span className="ml-1">
                            {check.actorName} {check.actorAttribute}({check.actorBaseValue})
                            {check.actorAlignmentMod !== 0 && ` + 阵营修正(${check.actorAlignmentMod > 0 ? '+' : ''}${check.actorAlignmentMod})`}
                            {check.actorStressMod !== 0 && ` + 压力修正(${check.actorStressMod > 0 ? '+' : ''}${check.actorStressMod})`}
                            = 加值({check.actorTotalModifier})
                            → d20({check.actorRoll}) + 加值({check.actorTotalModifier}) = <strong>{check.actorTotal}</strong>
                            {check.type === 'check' ? (
                              ` vs 难度(${check.difficulty}) → ${check.successLevel} (差距 ${check.margin > 0 ? '+' : ''}${check.margin})`
                            ) : check.type === 'opposed' && check.targetName ? (
                              <span>
                                {' '}vs {check.targetName} {check.targetAttribute}({check.targetBaseValue})
                                {(check.targetAlignmentMod ?? 0) !== 0 && ` + 阵营修正(${(check.targetAlignmentMod ?? 0) > 0 ? '+' : ''}${check.targetAlignmentMod ?? 0})`}
                                {(check.targetStressMod ?? 0) !== 0 && ` + 压力修正(${(check.targetStressMod ?? 0) > 0 ? '+' : ''}${check.targetStressMod ?? 0})`}
                                = 加值({check.targetTotalModifier})
                                → d20({check.targetRoll}) + 加值({check.targetTotalModifier}) = <strong>{check.targetTotal}</strong>
                                {' → '}{check.successLevel} (差距 {check.margin > 0 ? '+' : ''}{check.margin})
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {game.logs.length === 0 && (
              <div className="text-muted-foreground text-sm">等待游戏开始...</div>
            )}
          </div>
        </div>

        {/* 右侧：选中玩家状态 */}
        <div className="w-80 bg-card border-l border-border overflow-y-auto p-4">
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
                    {selectedPlayer.team === 'werewolf' ? '狼人' : '村民'} · {getAlignmentName(selectedPlayer.alignment)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">状态：</span>
                  <span className={selectedPlayer.alive ? 'text-green-400' : 'text-red-400'}>
                    {selectedPlayer.alive ? '存活' : '死亡'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">压力：</span>
                  <span className={stressColor(selectedPlayer.stress)}>
                    {selectedPlayer.stress > 0 ? '+' : ''}{selectedPlayer.stress} ({stressLabel(selectedPlayer.stress)})
                  </span>
                </div>
                {selectedPlayer.traits.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">特质：</span>
                    <span className="text-purple-400">{selectedPlayer.traits.join(', ')}</span>
                  </div>
                )}
                {selectedPlayer.items.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">道具：</span>
                    <span className="text-yellow-400">
                      {selectedPlayer.items.map((i) => itemLabel(i)).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* 六维属性 */}
              <div className="border-t border-border pt-4 mb-4">
                <h4 className="text-sm font-bold mb-2 text-muted-foreground">六维属性</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedPlayer.attributes).map(([key, value]) => (
                    <div key={key} className="text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">{attributeLabel(key)}</span>
                      <span className={`font-mono font-bold ${attributeColor(value)}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 关系网 */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-2 text-muted-foreground">关系网</h4>
                <div className="space-y-1">
                  {Object.entries(selectedPlayer.relations).filter(([_, rel]) => Math.abs(rel.trust) > 0.5 || Math.abs(rel.friendly) > 0.5).map(([otherId, rel]) => {
                    const other = game.players.find((p) => p.id === otherId);
                    if (!other) return null;
                    return (
                      <div key={otherId} className="text-sm flex items-center justify-between">
                        <span className="text-muted-foreground">{other.name}</span>
                        <span className="text-xs">
                          <span className={rel.trust > 0 ? 'text-green-400' : 'text-red-400'}>信任{rel.trust > 0 ? '+' : ''}{rel.trust.toFixed(1)}</span>
                          <span className="mx-1">·</span>
                          <span className={rel.friendly > 0 ? 'text-green-400' : 'text-red-400'}>友好{rel.friendly > 0 ? '+' : ''}{rel.friendly.toFixed(1)}</span>
                        </span>
                      </div>
                    );
                  })}
                  {Object.entries(selectedPlayer.relations).filter(([_, rel]) => Math.abs(rel.trust) > 0.5 || Math.abs(rel.friendly) > 0.5).length === 0 && (
                    <div className="text-xs text-muted-foreground">暂无显著关系变化</div>
                  )}
                </div>
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
