import React, { useState, useMemo } from 'react';
import { MemStore } from '@/memory';
import { InferenceEngine } from '@/inference/inference-engine';
import { IntentionEngine } from '@/intention/intention-engine';
import { RelationTracker } from '@/relation';
import { DEMO_PLAYERS, SCENARIOS } from '@/data/scenarios';
import { PERSONALITIES } from '@/intention/personalities';
import { HoverCard } from '@/components/ui/HoverCard';
import { getPlayerEmoji, getRoleEmoji } from './game-runner-constants';
import type { IntentionState, LongTermIntention, ShortTermIntention, ActionCandidate } from '@/types/decision';
import type { RoleInference, PlayerCrisis } from '@/inference/inference-engine';

export default function SystemPreview() {
  const [scenarioId, setScenarioId] = useState<string>('mixed');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('E');
  const [activeTab, setActiveTab] = useState<string>('memory');

  const scenario = SCENARIOS[scenarioId];
  const player = DEMO_PLAYERS.find((p) => p.id === selectedPlayer);

  const { store, inferences, crisisResult, relations, intentionState, tracedInferences, tracedCrisis } = useMemo(() => {
    const store = new MemStore();
    scenario.build(store);
    const inference = new InferenceEngine(store, selectedPlayer);
    const inferences = inference.inferAll(DEMO_PLAYERS);
    const crisisResult = inference.inferFieldCrisis(DEMO_PLAYERS);
    const relations = new RelationTracker(selectedPlayer, DEMO_PLAYERS.map((p) => p.id));
    for (const mem of store.getAll()) {
      relations.onMemoryAdded(mem);
    }
    const playerWithPersonality = player ? { ...player } : null;
    let intentionState: IntentionState | null = null;
    if (playerWithPersonality) {
      const relation = new RelationTracker(selectedPlayer, DEMO_PLAYERS.map((p) => p.id));
      const engine = new IntentionEngine(inference, relation, playerWithPersonality, DEMO_PLAYERS);
      intentionState = engine.generateDayAction();
    }
    // 带 trace 的版本（用于 hover 展示）
    const tracedInferences = new Map<string, ReturnType<typeof inference.inferPlayerWithTrace>>();
    const tracedCrisis = new Map<string, ReturnType<typeof inference.inferCrisisWithTrace>>();
    for (const p of DEMO_PLAYERS) {
      if (p.id !== selectedPlayer) tracedInferences.set(p.id, inference.inferPlayerWithTrace(p.id));
      tracedCrisis.set(p.id, inference.inferCrisisWithTrace(p.id));
    }
    return { store, inferences, crisisResult, relations, intentionState, tracedInferences, tracedCrisis };
  }, [scenarioId, selectedPlayer]);

  const sortedInferences = useMemo(() => {
    return Array.from(inferences.entries()).sort((a, b) => b[1].wolfProb - a[1].wolfProb);
  }, [inferences]);

  const tabs = [
    { id: 'memory', label: '📚 记忆库', desc: '当前记忆条目' },
    { id: 'inference', label: '🎯 推理引擎', desc: '角色概率 + 危机度' },
    { id: 'relation', label: '💕 关系系统', desc: '友好度网络' },
    { id: 'intention', label: '🧠 意图系统', desc: '长期→短期→候选→选择' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-amber-400 text-center mb-2">🐺 狼人杀 AI 系统预览</h1>
        <p className="text-center text-slate-400 text-sm mb-6">记忆 → 推理 → 关系 → 意图 → 行动，完整串联</p>

        {/* 控制栏 */}
        <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <span className="text-slate-400 text-xs">场景</span>
              <div className="flex gap-1 mt-1">
                {Object.values(SCENARIOS).map((s) => (
                  <button key={s.id} onClick={() => setScenarioId(s.id)}
                    className={`px-3 py-1 rounded text-xs transition ${scenarioId === s.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-slate-400 text-xs">观察玩家</span>
              <div className="flex gap-1 mt-1">
                {DEMO_PLAYERS.map((p) => (
                  <button key={p.id} onClick={() => setSelectedPlayer(p.id)}
                    className={`px-3 py-1 rounded text-xs transition ${selectedPlayer === p.id ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    {getPlayerEmoji(p.id, DEMO_PLAYERS)} {p.id}
                  </button>
                ))}
              </div>
            </div>
            {player && (
              <div className="text-xs">
                <span className="text-slate-400">身份：</span>
                <span className={player.role === 'werewolf' ? 'text-red-400' : player.role === 'prophet' ? 'text-purple-400' : 'text-green-400'}>
                  {player.role}
                </span>
                <span className="text-slate-400 ml-2">性格：</span>
                <span className="text-amber-400">{PERSONALITIES[player.personality]?.name || player.personality}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">{scenario.desc}</p>
        </div>

        {/* Tab 导航 */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              <div>{tab.label}</div>
              <div className="text-xs opacity-70">{tab.desc}</div>
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeTab === 'memory' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 lg:col-span-2">
              <h2 className="text-lg font-semibold text-sky-400 mb-4">📚 记忆库（{store.getAll().length} 条）</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {store.getAll().map((mem) => (
                  <div key={mem.id} className={`bg-slate-900 rounded-lg p-3 text-xs border-l-2 ${mem.credibility >= 1.0 ? 'border-green-500' : 'border-slate-600'}`}>
                    <div className="flex justify-between">
                      <span><strong className="text-amber-400">{mem.eventType}</strong> | {mem.actorId} → {mem.targetId || '-'}</span>
                      <span className="text-slate-500">R{mem.round} | {mem.source} | 可信度 {mem.credibility}</span>
                    </div>
                    <div className="text-slate-400 mt-1">{mem.notes || JSON.stringify(mem.content)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'inference' && (
            <>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-sky-400 mb-4">🎯 角色推理 <span className="text-xs text-slate-500">（hover 查看计算过程）</span></h2>
                <div className="space-y-3">
                  {sortedInferences.map(([playerId, inference]) => {
                    const wp = inference.wolfProb;
                    const pp = inference.prophetProb;
                    const vp = inference.villagerProb;
                    const wolfPct = Math.round(wp * 100);
                    const prophetPct = Math.round(pp * 100);
                    const villagerPct = Math.round(vp * 100);
                    let borderColor = 'border-slate-600';
                    if (wp > 0.7) borderColor = 'border-red-500';
                    else if (wp < 0.3) borderColor = 'border-green-500';
                    const traced = tracedInferences.get(playerId);
                    return (
                      <div key={playerId} className={`bg-slate-900 rounded-lg p-3 border-l-4 ${borderColor}`}>
                        <div className="font-semibold text-sm">{getPlayerEmoji(playerId, DEMO_PLAYERS)} {playerId}</div>
                        <HoverCard
                          title={`🐺 ${playerId} 角色推理溯源`}
                          subtitle={`狼人 ${(wp * 100).toFixed(1)}% | 预言家 ${(pp * 100).toFixed(1)}% | 村民 ${(vp * 100).toFixed(1)}%`}
                          trace={traced?.trace}
                        >
                          <div className="h-4 rounded overflow-hidden flex mt-2 bg-slate-800 cursor-help">
                            <div className="bg-red-700 h-full transition-all" style={{ width: `${wolfPct}%` }} />
                            <div className="bg-amber-700 h-full transition-all" style={{ width: `${prophetPct}%` }} />
                            <div className="bg-green-700 h-full transition-all" style={{ width: `${villagerPct}%` }} />
                          </div>
                        </HoverCard>
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                          <span className="text-red-300">🐺 {wolfPct}%</span>
                          <span className="text-amber-300">🔮 {prophetPct}%</span>
                          <span className="text-green-300">👤 {villagerPct}%</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          基于 {inference.basis.length} 条证据
                          {traced?.trace?.accuserSpamPenalty ? ` | 搅屎棍惩罚 +${traced.trace.accuserSpamPenalty.toFixed(1)}` : ''}
                          {traced?.trace?.voteConsistencyBonus ? ` | 投票一致 +${traced.trace.voteConsistencyBonus.toFixed(1)}` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-sky-400 mb-4">⚠️ 局势推理 <span className="text-xs text-slate-500">（hover 查看计算过程）</span></h2>
                <div className="space-y-2">
                  {crisisResult.all.map((c) => {
                    let scoreColor = 'text-green-400';
                    if (c.score >= 6) scoreColor = 'text-red-400';
                    else if (c.score >= 3) scoreColor = 'text-amber-400';
                    const traced = tracedCrisis.get(c.playerId);
                    return (
                      <div key={c.playerId} className="bg-slate-900 rounded-lg p-3 flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{getRoleEmoji(c.playerId)} {c.playerId}</div>
                          <div className="flex flex-wrap gap-1 mt-1 text-xs text-slate-400">
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded">指控:{c.factors.accuseCount.toFixed(1)}</span>
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded">投票:{c.factors.voteCount}</span>
                            <span className="bg-slate-800 px-1.5 py-0.5 rounded">辩护:{c.factors.defendCount}</span>
                            {c.factors.claimWolfCount > 0 && (
                              <span className="bg-red-900/50 px-1.5 py-0.5 rounded text-red-300">声称查杀:{c.factors.claimWolfCount}</span>
                            )}
                          </div>
                        </div>
                        <HoverCard
                          title={`⚠️ ${c.playerId} 危机度溯源`}
                          subtitle={`危机度 ${c.score.toFixed(1)}`}
                          trace={traced?.trace}
                        >
                          <div className={`text-2xl font-bold ${scoreColor} cursor-help`}>{c.score.toFixed(1)}</div>
                        </HoverCard>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'relation' && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 lg:col-span-2">
              <h2 className="text-lg font-semibold text-sky-400 mb-4">💕 关系系统（{selectedPlayer} 的视角）<span className="text-xs text-slate-500">（hover 查看影响明细）</span></h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {relations.getAll().map((rel) => (
                  <div key={rel.playerId} className={`bg-slate-900 rounded-lg p-3 border-l-4 ${rel.friendly > 0 ? 'border-green-500' : rel.friendly < 0 ? 'border-red-500' : 'border-slate-600'}`}>
                    <div className="font-semibold text-sm">{getRoleEmoji(rel.playerId)} {rel.playerId}</div>
                    <HoverCard
                      title={`💕 对 ${rel.playerId} 的友好度溯源`}
                      subtitle={`友好度 ${rel.friendly > 0 ? '+' : ''}${rel.friendly.toFixed(1)}`}
                      trace={{
                        resultType: 'relation',
                        targetId: rel.playerId,
                        finalValue: rel.friendly,
                        impacts: [...rel.directImpacts, ...rel.bystanderImpacts],
                        calculationSteps: [
                          { step: '直接影响', formula: `直接对我的行为`, result: rel.directImpacts.reduce((s, i) => s + i.deltaScore, 0), basis: rel.directImpacts.map((i) => i.memoryId) },
                          { step: '旁观影响', formula: `我观察到的行为 × 衰减系数`, result: rel.bystanderImpacts.reduce((s, i) => s + i.deltaScore, 0), basis: rel.bystanderImpacts.map((i) => i.memoryId) },
                        ],
                      }}
                    >
                      <div className={`text-lg font-bold mt-1 cursor-help ${rel.friendly > 0 ? 'text-green-400' : rel.friendly < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {rel.friendly > 0 ? '+' : ''}{rel.friendly.toFixed(1)}
                      </div>
                    </HoverCard>
                    <div className="text-xs text-slate-500">
                      {rel.friendly >= 5 ? '亲密' : rel.friendly >= 2 ? '友好' : rel.friendly > -2 ? '中立' : rel.friendly > -5 ? '不信任' : '敌对'}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1">
                      直接:{rel.directImpacts.length} | 旁观:{rel.bystanderImpacts.length}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'intention' && intentionState && (
            <>
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-sky-400 mb-4">🎯 长期意图</h2>
                <div className="space-y-2">
                  {intentionState.longTerm.map((lt: LongTermIntention) => (
                    <div key={lt.id} className={`bg-slate-900 rounded-lg p-3 border-l-4 border-blue-500`}>
                      <div className="flex justify-between items-center">
                        <strong className="text-sm">{lt.id}</strong>
                        <HoverCard
                          title={`🎯 长期意图: ${lt.id}`}
                          subtitle={`优先级 ${(lt.priority * 100).toFixed(0)}%`}
                          intentionTraces={lt.traces}
                        >
                          <span className="text-amber-400 text-sm font-bold cursor-help">{(lt.priority * 100).toFixed(0)}%</span>
                        </HoverCard>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{lt.description}</div>
                      {lt.targetPlayer && <div className="text-xs text-indigo-300 mt-1">→ {lt.targetPlayer}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-sky-400 mb-4">⚡ 短期意图</h2>
                <div className="space-y-2">
                  {intentionState.shortTerm.map((st: ShortTermIntention) => (
                    <div key={st.id} className={`bg-slate-900 rounded-lg p-3 border-l-4 ${st.type === 'pointed' ? 'border-purple-500' : 'border-slate-600'}`}>
                      <div className="flex justify-between items-center">
                        <strong className="text-sm">{st.id}</strong>
                        <HoverCard
                          title={`⚡ 短期意图: ${st.id}`}
                          subtitle={`权重 ${st.weight.toFixed(2)}`}
                          intentionTraces={st.traces}
                        >
                          <span className="text-amber-400 text-sm font-bold cursor-help">{st.weight.toFixed(2)}</span>
                        </HoverCard>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{st.description}</div>
                      {st.targetId && <div className="text-xs text-purple-300 mt-1">→ {st.targetId}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-sky-400 mb-4">🎲 行动候选</h2>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {intentionState.candidates.slice(0, 8).map((c: ActionCandidate, idx: number) => (
                    <div key={idx} className={`bg-slate-900 rounded-lg p-2 text-sm flex justify-between ${idx === 0 ? 'border border-amber-500/30' : ''}`}>
                      <span>
                        <strong>{c.action}</strong>
                        {c.targetId && <span className="text-purple-300"> → {c.targetId}</span>}
                      </span>
                      <HoverCard
                        title={`🎲 候选: ${c.action}${c.targetId ? ` → ${c.targetId}` : ''}`}
                        subtitle={`得分 ${c.score.toFixed(1)}`}
                        intentionTraces={c.traces}
                      >
                        <span className="text-slate-400 cursor-help">{c.score.toFixed(1)}</span>
                      </HoverCard>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-sky-400 mb-4">✅ 最终选择</h2>
                {intentionState.selected ? (
                  <div className="bg-slate-900 rounded-lg p-4 border-l-4 border-amber-400">
                    <div className="text-2xl font-bold text-amber-400">
                      {intentionState.selected.action}
                      {intentionState.selected.targetId && <span className="text-purple-300 text-lg"> → {intentionState.selected.targetId}</span>}
                    </div>
                    <div className="text-slate-400 text-sm mt-2">{intentionState.selected.reason}</div>
                    <div className="text-amber-400 text-sm font-bold mt-2">最终得分：{intentionState.selected.score.toFixed(1)}</div>
                    {intentionState.selected.traces && intentionState.selected.traces.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] text-slate-500 uppercase">得分计算轨迹</div>
                        {intentionState.selected.traces.map((t, i) => (
                          <div key={i} className="text-[10px] text-slate-400 flex justify-between">
                            <span>{t.factor}</span>
                            <span className="font-mono">{t.baseValue.toFixed(2)} → {t.result.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-500">无候选</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
