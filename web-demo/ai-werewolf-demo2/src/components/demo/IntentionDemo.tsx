import React, { useState, useMemo } from 'react';
import { MemStore } from '@/memory';
import { InferenceEngine } from '@/inference/inference-engine';
import { RelationTracker } from '@/relation';
import { IntentionEngine } from '@/intention/intention-engine';
import { DEMO_PLAYERS, SCENARIOS } from '@/data/scenarios';
import { PERSONALITIES } from '@/intention/personalities';
import { getPlayerEmoji } from './game-runner-constants';
import { formatNumber } from './game-runner-utils';
import type { IntentionState, LongTermIntention, ShortTermIntention, ActionCandidate } from '@/types/decision';

export default function IntentionDemo() {
  const [scenarioId, setScenarioId] = useState<string>('mixed');
  const [personalityId, setPersonalityId] = useState<string>('aggressive');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('A');

  const scenario = SCENARIOS[scenarioId];

  const intentionState = useMemo(() => {
    const store = new MemStore();
    scenario.build(store);
    const inference = new InferenceEngine(store, selectedPlayer);
    const player = DEMO_PLAYERS.find((p) => p.id === selectedPlayer);
    if (!player) return null;
    const playerWithPersonality = { ...player, personality: personalityId };
    const relation = new RelationTracker(selectedPlayer, DEMO_PLAYERS.map((p) => p.id));
    const engine = new IntentionEngine(inference, relation, playerWithPersonality, DEMO_PLAYERS);
    return engine.generateDayAction();
  }, [scenarioId, personalityId, selectedPlayer]);

  const selectedPlayerInfo = DEMO_PLAYERS.find((p) => p.id === selectedPlayer);

  const getLongTermBorderColor = (id: string) => {
    if (id === 'survive') return 'border-red-500';
    if (id === 'find_werewolf') return 'border-blue-500';
    if (id === 'protect_villager') return 'border-cyan-500';
    if (id === 'lead') return 'border-yellow-500';
    if (id === 'hide_identity') return 'border-slate-500';
    if (id === 'mislead') return 'border-orange-500';
    if (id === 'report_check') return 'border-indigo-500';
    return 'border-blue-500';
  };

  const getShortTermBorderColor = (id: string) => {
    if (id === 'survive') return 'border-red-500';
    if (id.startsWith('attack_')) return 'border-blue-500';
    if (id.startsWith('protect_')) return 'border-cyan-500';
    if (id === 'lead') return 'border-yellow-500';
    if (id === 'hide') return 'border-slate-500';
    if (id.startsWith('observe_')) return 'border-purple-500';
    if (id === 'report_check') return 'border-indigo-500';
    return 'border-slate-600';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-amber-400 text-center mb-2">🧠 意图系统演示</h1>
        <p className="text-center text-slate-400 text-sm mb-6">长期意图 → 短期意图 → 行动候选 → 加权选择</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {Object.values(SCENARIOS).map((s) => (
            <button key={s.id} onClick={() => setScenarioId(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${scenarioId === s.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {s.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-slate-400 text-sm self-center">观察玩家：</span>
          {DEMO_PLAYERS.map((p) => (
            <button key={p.id} onClick={() => setSelectedPlayer(p.id)}
              className={`px-3 py-1 rounded-lg text-sm transition ${selectedPlayer === p.id ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {getPlayerEmoji(p.id, DEMO_PLAYERS)} {p.id}
            </button>
          ))}
        </div>

        {selectedPlayerInfo && (
          <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getPlayerEmoji(selectedPlayerInfo.id, DEMO_PLAYERS)}</span>
              <div>
                <div className="font-bold text-slate-200">{selectedPlayerInfo.id} ({selectedPlayerInfo.name})</div>
                <div className="text-xs text-slate-400">真实身份：<span className={selectedPlayerInfo.role === 'werewolf' ? 'text-red-400' : selectedPlayerInfo.role === 'prophet' ? 'text-purple-400' : 'text-green-400'}>{selectedPlayerInfo.role}</span> | 阵营：{selectedPlayerInfo.team}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(selectedPlayerInfo.attributes).map(([attr, val]) => (
                <span key={attr} className="bg-slate-700 px-2 py-1 rounded text-slate-300">{attr}:{val}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-slate-400 text-sm self-center">性格：</span>
          {Object.values(PERSONALITIES).map((p) => (
            <button key={p.id} onClick={() => setPersonalityId(p.id)}
              className={`px-3 py-1 rounded-lg text-sm transition ${personalityId === p.id ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
          <p className="text-sm text-slate-300 leading-relaxed">{scenario.desc}</p>
        </div>

        {!intentionState && (
          <div className="text-center text-slate-500">未找到该玩家</div>
        )}

        {intentionState && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 长期意图 */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-sky-400 mb-4 pb-2 border-b border-slate-700">🎯 长期意图</h2>
              <div className="space-y-2">
                {intentionState.longTerm.map((lt: LongTermIntention) => (
                  <div key={lt.id} className={`bg-slate-900 rounded-lg p-3 border-l-4 ${getLongTermBorderColor(lt.id)}`}>
                    <div className="flex justify-between items-center">
                      <strong className="text-sm">{lt.id}</strong>
                      <span className="text-amber-400 text-sm font-bold">{formatNumber(lt.priority * 100, 0)}%</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{lt.description}</div>
                    {lt.targetPlayer && <div className="text-xs text-indigo-300 mt-1">→ {lt.targetPlayer}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* 短期意图 */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-sky-400 mb-4 pb-2 border-b border-slate-700">⚡ 短期意图</h2>
              <div className="space-y-2">
                {intentionState.shortTerm.map((st: ShortTermIntention) => (
                  <div key={st.id} className={`bg-slate-900 rounded-lg p-3 border-l-4 ${getShortTermBorderColor(st.id)}`}>
                    <div className="flex justify-between items-center">
                      <strong className="text-sm">{st.id}</strong>
                      <span className="text-amber-400 text-sm font-bold">{formatNumber(st.weight)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{st.description}</div>
                    {st.targetId && <div className="text-xs text-purple-300 mt-1">→ {st.targetId}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* 行动候选 */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-sky-400 mb-4 pb-2 border-b border-slate-700">🎲 行动候选集</h2>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {intentionState.candidates.slice(0, 10).map((c: ActionCandidate, idx: number) => (
                  <div key={idx} className={`bg-slate-900 rounded-lg p-2 text-sm flex justify-between ${idx === 0 ? 'border border-amber-500/30' : ''}`}>
                    <span>
                      <strong>{c.action}</strong>
                      {c.targetId && <span className="text-purple-300"> → {c.targetId}</span>}
                    </span>
                    <span className="text-slate-400">{formatNumber(c.score)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 最终选择 */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-sky-400 mb-4 pb-2 border-b border-slate-700">✅ 最终选择</h2>
              {intentionState.selected ? (
                <div className="bg-slate-900 rounded-lg p-4 border-l-4 border-amber-400">
                  <div className="text-2xl font-bold text-amber-400">
                    {intentionState.selected.action}
                    {intentionState.selected.targetId && <span className="text-purple-300 text-lg"> → {intentionState.selected.targetId}</span>}
                  </div>
                  <div className="text-slate-400 text-sm mt-2">{intentionState.selected.reason}</div>
                  <div className="text-amber-400 text-sm font-bold mt-2">最终得分：{formatNumber(intentionState.selected.score)}</div>
                </div>
              ) : (
                <div className="text-slate-500">无候选</div>
              )}

              <h3 className="text-sm font-semibold text-indigo-300 mt-6 mb-2">加权公式</h3>
              <div className="bg-slate-900 rounded-lg p-3 text-xs text-slate-300">
                <code className="text-amber-400">score = baseScore × roleBonus × situationBonus × relationBonus × personalityBonus × traitBonus × pressureBonus × proficiencyBonus</code>
                <div className="mt-2 text-slate-500">每个 factor 范围：0.5 ~ 2.0，推理禁用时 roleBonus/situationBonus = 1.0</div>
              </div>

              <h3 className="text-sm font-semibold text-indigo-300 mt-4 mb-2">当前性格：{PERSONALITIES[personalityId]?.name}</h3>
              <div className="text-xs text-slate-400 space-y-1">
                <div>禁用行动：{(PERSONALITIES[personalityId]?.disabledActions ?? []).join(', ') || '无'}</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(PERSONALITIES[personalityId]?.actionWeightMods ?? {}).map(([action, mod]) => (
                    <span key={action} className={`px-2 py-0.5 rounded ${mod > 1 ? 'bg-green-900 text-green-300' : mod < 1 ? 'bg-red-900 text-red-300' : 'bg-slate-700 text-slate-400'}`}>
                      {action}: {mod}x
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
