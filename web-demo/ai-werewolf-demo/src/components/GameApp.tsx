import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useGameRunner } from './useGameRunner';
import SetupPanel from './SetupPanel';
import type { ActionLogDetail, DecisionProcess } from '@/types';
import { getAlignmentName } from '@/types';
import { roleNameMap, getLogColor, itemLabel, attributeLabel, attributeColor, stressColor, stressLabel } from './ui-utils';
import type { PlayerState } from './useGameRunner';

export default function GameApp() {
  const game = useGameRunner();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const toggleLog = (idx: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const isLogExpanded = (idx: number) => expandedLogs.has(idx);

  if (game.phase === 'setup') {
    return <SetupPanel onStart={game.startGame} />;
  }

  const isRunning = game.phase === 'running';
  const _isPaused = game.phase === 'paused';
  const isEnded = game.phase === 'ended';

  const werewolfCount = game.players.filter((p) => p.team === 'werewolf' && p.alive).length;
  const villagerCount = game.players.filter((p) => p.team !== 'werewolf' && p.alive).length;


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
              const hasExtra = detail && ((detail.checks && detail.checks.length > 0) || (detail as Record<string, unknown>).process);
              const expanded = isLogExpanded(idx);
              return (
                <div key={idx} className={`text-sm font-mono ${getLogColor(log.type)}`}>
                  {log.type === 'thinking' ? (
                    <div className="flex items-center gap-1">
                      <span>{log.message}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span>{log.message}</span>
                        {hasExtra && (
                          <button
                            className="text-gray-500 hover:text-gray-300 shrink-0 select-none inline-flex items-center"
                            onClick={() => toggleLog(idx)}
                            title={expanded ? '收起详情' : '展开详情'}
                          >
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </div>
                      {expanded && hasExtra && (
                        <div className="mt-1 ml-4 text-xs text-gray-400 space-y-1 border-l-2 border-gray-700 pl-3">
                          {(detail as Record<string, unknown>).process && (
                            <div className="space-y-0.5 text-xs text-gray-500 whitespace-pre-wrap font-mono">
                              {((detail as Record<string, unknown>).process as DecisionProcess).shortlist.split('\n').map((line, i) => {
                                if (!line.trim()) return <div key={i} className="h-1" />;
                                if (line.startsWith('✓') || line.startsWith('○')) {
                                  const isSelected = line.startsWith('✓');
                                  return <div key={i} className={isSelected ? 'text-green-400 font-bold' : ''}>{line}</div>;
                                }
                                if (line.startsWith('  [')) return <div key={i} className="text-cyan-400 pl-2">{line}</div>;
                                if (line.startsWith('  触发：')) return <div key={i} className="text-yellow-400 pl-2">{line}</div>;
                                if (line.startsWith('  分数：') || line.startsWith('  修正：')) return <div key={i} className="text-gray-400 pl-2">{line}</div>;
                                if (line.startsWith('  总分：')) return <div key={i} className="text-white font-bold pl-2">{line}</div>;
                                if (line.startsWith('  原因：')) return <div key={i} className="text-gray-300 pl-2">{line}</div>;
                                if (line.startsWith('【最终选择】')) return <div key={i} className="text-green-400 font-bold mt-1">{line}</div>;
                                if (line.startsWith('  命中规则：')) return <div key={i} className="text-cyan-400 pl-2">{line}</div>;
                                if (line.startsWith('  阶段：')) return <div key={i} className="text-gray-400 pl-2">{line}</div>;
                                if (line.startsWith('  总分：') && line.includes('个候选')) return <div key={i} className="text-green-300 pl-2">{line}</div>;
                                if (line.startsWith('【可选行动】')) return <div key={i} className="text-gray-400 font-bold">{line}</div>;
                                return <div key={i}>{line}</div>;
                              })}
                            </div>
                          )}
                          {detail.checks?.map((check, ci) => (
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
                    </>
                  )}
                </div>
              );
            })}
            {game.logs.length === 0 && (
              <div className="text-muted-foreground text-sm">等待游戏开始...</div>
            )}
          </div>
        </div>

        {/* 右侧：选中玩家状态（可折叠抽屉）*/}
        <div className={`bg-card border-l border-border overflow-y-auto transition-all duration-300 flex flex-col ${drawerOpen ? 'w-80 p-4' : 'w-10 items-center'}`}>
          {/* 抽屉切换按钮 */}
          <button
            className={`text-muted-foreground hover:text-foreground transition-colors ${drawerOpen ? 'self-end mb-2' : 'mt-4'}`}
            onClick={() => setDrawerOpen((prev) => !prev)}
            title={drawerOpen ? '收起详情' : '展开详情'}
          >
            {drawerOpen ? (
              <span>››</span>
            ) : (
              <span>‹‹</span>
            )}
          </button>

          {drawerOpen && (
            <div className="flex-1">
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
          )}
        </div>
      </div>
    </div>
  );
}
