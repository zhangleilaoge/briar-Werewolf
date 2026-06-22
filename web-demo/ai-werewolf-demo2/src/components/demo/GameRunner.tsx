import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PERSONALITIES } from '@/intention/personalities';
import type { Player } from '@/types';
import { ROLE_EMOJIS, ROLE_NAMES, ROLE_SKILLS, ATTRIBUTE_NAMES, ACTION_NAMES, LONG_TERM_NAMES, SHORT_TERM_NAMES, MEMORY_SOURCE_NAMES } from './game-runner-constants';
import { getPlayerDisplay, getMemoryTooltip, getMemoryDescription, formatRoundDisplay } from './game-runner-utils';
import { GameEngine } from './game-runner-engine';
import { MemoryTooltip } from './MemoryTooltip';
import type { GameConfig, GameLog } from './game-runner-types';

// ============================================================
// Main Component
// ============================================================
export default function GameRunner() {
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [config, setConfig] = useState<GameConfig>({ werewolfCount: 1, prophetCount: 1, villagerCount: 5 });
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [allPlayerResults, setAllPlayerResults] = useState<Map<string, ReturnType<GameEngine['_calcAllPlayerResults']> extends Map<string, infer V> ? V : never>>(new Map());
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

  const initialPlayers = engine?.players || [];
  const revealedPlayerIds = new Set(logs.filter((l) => l.playerId && l.subPhase === 'day').map((l) => l.playerId!));
  const lastPlayerId = logs.length > 0 ? [...logs].reverse().find((l) => l.playerId && l.subPhase === 'day')?.playerId : null;

  // ==================== SETUP ====================
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-6xl mb-4">🐺</h1>
            <h2 className="text-2xl font-bold text-amber-400 mb-2">AI 狼人杀</h2>
            <p className="text-slate-400">配置角色数量 → 开始游戏 → 观察所有 AI 决策</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-6">
            <div>
              <label className="text-sm text-slate-400 block mb-3">角色配置（共 {totalPlayers} 人）</label>
              <div className="space-y-3">
                {[
                  { key: 'werewolfCount' as const, label: '🐺 狼人', min: 1, max: 3 },
                  { key: 'prophetCount' as const, label: '🔮 预言家', min: 0, max: 1 },
                  { key: 'villagerCount' as const, label: '👤 村民', min: 3, max: 10 },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-sm w-24">{item.label}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <button onClick={() => setConfig((c) => ({ ...c, [item.key]: Math.max(item.min, c[item.key] - 1) }))} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm flex items-center justify-center transition">−</button>
                      <span className="w-8 text-center font-mono">{config[item.key]}</span>
                      <button onClick={() => setConfig((c) => ({ ...c, [item.key]: Math.min(item.max, c[item.key] + 1) }))} className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm flex items-center justify-center transition">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={startGame} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition text-lg">▶ 开始游戏</button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== PLAYING ====================
  return (
    <div className="h-screen bg-slate-900 text-slate-200 flex flex-col">
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-slate-700 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🐺</span>
          <span className="font-bold text-amber-400">AI 狼人杀</span>
          <span className="text-sm text-slate-400">第 {activeRound} 轮 | 狼人 {config.werewolfCount} | 村民 {config.villagerCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode((m) => (m === 'auto' ? 'step' : 'auto'))} className={`px-3 py-1.5 rounded-lg text-sm transition ${mode === 'auto' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>{mode === 'auto' ? '🔄 自动模式' : '🦶 步进模式'}</button>
          {mode === 'step' && (
            <button onClick={doStep} disabled={isGameOver} className={`px-3 py-1.5 rounded-lg text-sm transition ${isGameOver ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>⏩ 下一步</button>
          )}
          {mode === 'auto' && (
            <button onClick={togglePlay} className={`px-3 py-1.5 rounded-lg text-sm transition ${isPlaying ? 'bg-amber-600 hover:bg-amber-500' : (isGameOver ? 'bg-blue-600 hover:bg-blue-500' : 'bg-green-600 hover:bg-green-500')}`}>{isPlaying ? '⏸ 暂停' : (isGameOver ? '↺ 重播' : '▶ 继续')}</button>
          )}
          <button onClick={reset} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm border border-slate-700 transition">↺ 重置</button>
        </div>
      </div>

      {/* Three columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Players */}
        <div className="w-72 border-r border-slate-700 flex flex-col shrink-0">
          <div className="p-3 text-sm text-slate-400 border-b border-slate-700">参与角色</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {initialPlayers.map((p) => {
              const isDead = deadPlayers.has(p.id);
              const isSelected = selectedPlayer === p.id;
              const isCurrent = lastPlayerId === p.id;
              const borderColor = p.team === 'werewolf' ? 'border-red-800/60' : 'border-green-800/40';
              const bgColor = isSelected ? (p.team === 'werewolf' ? 'bg-red-900/20' : 'bg-green-900/20') : isCurrent ? 'bg-slate-700/50' : 'bg-slate-800/50';
              return (
                <div key={p.id} onClick={() => setSelectedPlayer(p.id)} className={`p-3 rounded-lg border cursor-pointer transition ${borderColor} ${bgColor} ${isSelected ? 'ring-1 ring-amber-500/30' : 'hover:bg-slate-800'} ${isCurrent ? 'ring-1 ring-blue-500/30' : ''} ${isDead ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${isDead ? 'line-through text-slate-500' : ''}`}>{p.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${isDead ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>{isDead ? '死亡' : '存活'}</span>
                  </div>
                  <div className={`text-xs mt-1 ${p.team === 'werewolf' ? 'text-red-400' : 'text-green-400'}`}>
                    {ROLE_NAMES[p.role]} · {p.team === 'werewolf' ? '狼人' : '好'}
                  </div>
                  <div className="text-xs text-yellow-500/80 mt-0.5">{ROLE_SKILLS[p.role]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle: Timeline */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-700">
          <div className="flex-1 overflow-y-auto p-4 space-y-2" ref={logRef}>
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-slate-500 shrink-0 font-mono text-xs">{log.time}</span>
                <span className={log.isSystem ? 'text-amber-400 font-bold' : 'text-slate-300'}>{log.content}</span>
              </div>
            ))}
            {isPlaying && !isGameOver && (
              <div className="flex gap-2 text-sm animate-pulse">
                <span className="text-slate-500 shrink-0 font-mono text-xs">...</span>
                <span className="text-slate-500">正在执行...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="w-96 flex flex-col shrink-0 overflow-y-auto bg-slate-900/50">
          {!activeResult || !activePlayerId ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              点击左侧角色查看详情
            </div>
          ) : (
            <div key={`${activePlayerId}-${logs.length}`} className="p-3 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-3 pb-2 border-b border-slate-700">
                <span className="text-3xl">{ROLE_EMOJIS[activePlayerObj?.role || 'villager']}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-lg ${deadPlayers.has(activePlayerId) ? 'line-through text-slate-500' : ''}`}>
                    {activePlayerObj?.name}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span>{ROLE_NAMES[activePlayerObj?.role || 'villager']}</span>
                    <span>·</span>
                    <span>{PERSONALITIES[activePlayerObj?.personality || 'cautious']?.name}</span>
                    <span>·</span>
                    <span>危机度 <span className={activeResult.selfCrisis.score >= 6 ? 'text-red-400' : activeResult.selfCrisis.score >= 3 ? 'text-amber-400' : 'text-green-400'}>{activeResult.selfCrisis.score}</span></span>
                    <span>·</span>
                    <span>压力 <span className={(activePlayerObj?.pressure ?? 0) >= 10 ? 'text-red-400' : (activePlayerObj?.pressure ?? 0) >= 5 ? 'text-amber-400' : 'text-green-400'}>{activePlayerObj?.pressure ?? 0}</span></span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-slate-700 pb-2">
                <button onClick={() => setActiveTab('basic')} className={`px-3 py-1 rounded text-xs font-medium transition ${activeTab === 'basic' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  基本信息
                </button>
                <button onClick={() => setActiveTab('thinking')} className={`px-3 py-1 rounded text-xs font-medium transition ${activeTab === 'thinking' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  思维推理
                </button>
              </div>

              {activeTab === 'basic' && (
                <div className="space-y-2">
                  {/* Attributes */}
                  <Drawer id="attributes" title="属性" openSections={openSections} toggleSection={toggleSection}>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(activePlayerObj?.attributes || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between bg-slate-800 rounded px-2 py-1">
                          <span className="text-slate-400">{ATTRIBUTE_NAMES[k] || k}</span>
                          <span className="font-mono text-slate-200">{v}</span>
                        </div>
                      ))}
                    </div>
                  </Drawer>

                  {/* Memories */}
                  <Drawer id="memories" title={`记忆 (${activeResult.memories.length})`} openSections={openSections} toggleSection={toggleSection}>
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {activeResult.memories.length === 0 && <div className="text-xs text-slate-500">暂无记忆</div>}
                      {activeResult.memories.slice().reverse().map((mem) => {
                        const forgottenClass = mem.isForgotten ? 'opacity-40 line-through' : '';
                        return (
                          <div key={mem.id} className={`bg-slate-800 rounded px-2 py-1.5 text-xs ${forgottenClass}`}>
                            <div className="text-slate-200 font-medium">{getMemoryDescription(mem, activePlayerId!, initialPlayers)}</div>
                            <div className="flex flex-wrap gap-x-2 mt-1 text-[10px] text-slate-500">
                              <span>时间：{formatRoundDisplay(mem.round, mem.content.dayRound)}</span>
                              <span>来源：{MEMORY_SOURCE_NAMES[mem.source] || mem.source}</span>
                              <span>可信度：{Math.round(mem.credibility * 100)}%</span>
                            </div>
                            {mem.notes && <div className="text-slate-400 mt-0.5 text-[10px]">{mem.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </Drawer>

                  {/* Forgotten Memories */}
                  {activeResult.forgottenMemories.length > 0 && (
                    <Drawer id="forgotten" title={`已遗忘 (${activeResult.forgottenMemories.length})`} openSections={openSections} toggleSection={toggleSection}>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {activeResult.forgottenMemories.slice().reverse().map((mem) => (
                          <div key={mem.id} className="bg-slate-800 rounded px-2 py-1.5 text-xs opacity-50 line-through">
                            <div className="text-slate-200 font-medium">{getMemoryDescription(mem, activePlayerId!, initialPlayers)}</div>
                            <div className="flex flex-wrap gap-x-2 mt-1 text-[10px] text-slate-500">
                              <span>时间：{formatRoundDisplay(mem.round, mem.content.dayRound)}</span>
                              <span>来源：{MEMORY_SOURCE_NAMES[mem.source] || mem.source}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Drawer>
                  )}
                </div>
              )}

              {activeTab === 'thinking' && (
                <div className="space-y-2">
                  {/* Relations */}
                  <Drawer id="relations" title="关系" openSections={openSections} toggleSection={toggleSection}>
                    <div className="flex flex-wrap gap-1">
                      {activeResult.relations.map((rel) => {
                        const displayName = getPlayerDisplay(rel.playerId, initialPlayers);
                        return (
                          <MemoryTooltip key={rel.playerId} title="支撑记忆" content={getMemoryTooltip(rel.memoryIds, activeResult.memories, activePlayerId, initialPlayers)} className="inline-block">
                            <span className={`text-xs px-2 py-1 rounded ${rel.friendly > 0 ? 'bg-green-900/30 text-green-400' : rel.friendly < 0 ? 'bg-red-900/30 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                              {displayName} {rel.friendly > 0 ? '+' : ''}{rel.friendly}
                            </span>
                          </MemoryTooltip>
                        );
                      })}
                    </div>
                  </Drawer>

                  {/* Inferences */}
                  <Drawer id="inferences" title="角色推理" openSections={openSections} toggleSection={toggleSection}>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(activeResult.inferences.entries()).sort((a, b) => b[1].werewolfProb - a[1].werewolfProb).map(([pid, inf]) => {
                        const wp = Math.round(inf.werewolfProb * 100);
                        const displayName = getPlayerDisplay(pid, initialPlayers);
                        return (
                          <MemoryTooltip key={pid} title="支撑记忆" content={getMemoryTooltip(inf.basis, activeResult.memories, activePlayerId, initialPlayers)} className="inline-block">
                            <span className={`text-xs px-2 py-1 rounded ${wp >= 50 ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                              {displayName} 🐺{wp}%
                            </span>
                          </MemoryTooltip>
                        );
                      })}
                    </div>
                  </Drawer>

                  {/* Intentions */}
                  <Drawer id="intentions" title="意图" openSections={openSections} toggleSection={toggleSection}>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">长期</div>
                        <div className="space-y-1">
                          {activeResult.intentionState.longTerm.slice(0, 5).map((lt) => (
                            <MemoryTooltip key={lt.id} title="支撑记忆" content={getMemoryTooltip(lt.basis, activeResult.memories, activePlayerId, initialPlayers)}>
                              <div className="flex justify-between text-xs bg-slate-800 rounded px-2 py-1">
                                <span className="text-slate-300 truncate mr-1">{LONG_TERM_NAMES[lt.id] || lt.id}</span>
                                <span className="text-amber-400 shrink-0">{(lt.priority * 100).toFixed(0)}%</span>
                              </div>
                            </MemoryTooltip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">短期</div>
                        <div className="space-y-1">
                          {activeResult.intentionState.shortTerm.slice(0, 5).map((st) => (
                            <MemoryTooltip key={st.id} title="支撑记忆" content={getMemoryTooltip(st.basis, activeResult.memories, activePlayerId, initialPlayers)}>
                              <div className="flex justify-between text-xs bg-slate-800 rounded px-2 py-1">
                                <span className="text-slate-300 truncate mr-1">{SHORT_TERM_NAMES[st.id] || st.id}</span>
                                <span className="text-purple-400 shrink-0">{st.weight.toFixed(1)}</span>
                              </div>
                            </MemoryTooltip>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Drawer>

                  {/* Actions */}
                  <Drawer id="candidates" title="行动" openSections={openSections} toggleSection={toggleSection}>
                    <div className="space-y-1">
                      {(() => {
                        const selected = activeResult.intentionState.selected;
                        const candidates = activeResult.intentionState.candidates;
                        const allActions = selected
                          ? [selected, ...candidates.filter((c) => !(c.action === selected.action && c.targetId === selected.targetId))]
                          : candidates;
                        return allActions.slice(0, 8).map((c, i) => {
                          const actionName = ACTION_NAMES[c.action] || c.action;
                          const targetName = c.targetId ? getPlayerDisplay(c.targetId, initialPlayers) : '';
                          const isSelected = selected && c.action === selected.action && c.targetId === selected.targetId;
                          return (
                            <MemoryTooltip key={i} title="支撑记忆" content={getMemoryTooltip(c.supportingMemories, activeResult.memories, activePlayerId, initialPlayers)}>
                              <div className="flex justify-between text-xs bg-slate-800 rounded px-2 py-1.5">
                                <span className={`truncate mr-1 ${isSelected ? 'text-amber-400 font-bold' : i === 0 && !selected ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                                  {actionName}{targetName && <span className="text-purple-300"> → {targetName}</span>}
                                </span>
                                <span className="text-slate-500 shrink-0">{c.score.toFixed(1)}</span>
                              </div>
                            </MemoryTooltip>
                          );
                        });
                      })()}
                    </div>
                  </Drawer>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================
function Drawer({ id, title, openSections, toggleSection, children }: {
  id: string;
  title: string;
  openSections: Set<string>;
  toggleSection: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-700/30 transition">
        <span className="font-medium text-slate-300">{title}</span>
        <span className={`text-slate-500 transition-transform ${openSections.has(id) ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {openSections.has(id) && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
