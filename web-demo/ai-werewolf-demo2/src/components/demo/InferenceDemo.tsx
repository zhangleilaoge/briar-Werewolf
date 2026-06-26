import React, { useState, useMemo } from 'react';
import { MemStore } from '@/memory';
import { InferenceEngine } from '@/inference/inference-engine';
import { DEMO_PLAYERS, SCENARIOS } from '@/data/scenarios';
import { getPlayerEmoji } from './game-runner-constants';
import { formatNumber } from './game-runner-utils';
import type { RoleInference, PlayerCrisis } from '@/inference/inference-engine';
import type { Scenario } from '@/data/scenarios';

export default function InferenceDemo() {
  const [scenarioId, setScenarioId] = useState<string>('basic');
  const [showTruth, setShowTruth] = useState(false);

  const scenario = SCENARIOS[scenarioId];

  const { inferences, crisisResult } = useMemo(() => {
    const store = new MemStore();
    scenario.build(store);
    const engine = new InferenceEngine(store, 'E');
    const inferences = engine.inferAll(DEMO_PLAYERS);
    const crisisResult = engine.inferFieldCrisis(DEMO_PLAYERS);
    return { inferences, crisisResult };
  }, [scenarioId]);

  const sortedInferences = useMemo(() => {
    return Array.from(inferences.entries()).sort((a, b) => b[1].wolfProb - a[1].wolfProb);
  }, [inferences]);

  const roleEmoji = (id: string) => showTruth ? getPlayerEmoji(id, DEMO_PLAYERS) : '';

  const getRoleText = (id: string) => {
    const p = DEMO_PLAYERS.find((p) => p.id === id);
    return p?.role ?? 'unknown';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-amber-400 text-center mb-2">🐺 推理引擎演示</h1>
        <p className="text-center text-slate-400 text-sm mb-6">基于贝叶斯推理 + 社交关系网络分析</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {Object.values(SCENARIOS).map((s) => (
            <button
              key={s.id}
              onClick={() => setScenarioId(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                scenarioId === s.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s.name}
            </button>
          ))}
          <button
            onClick={() => setShowTruth(!showTruth)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition"
          >
            {showTruth ? '隐藏真实身份' : '显示真实身份'}
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
          <p className="text-sm text-slate-300 leading-relaxed">{scenario.desc}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 角色推理 */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-sky-400 mb-4 pb-2 border-b border-slate-700">🎯 角色推理</h2>
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

                return (
                  <div key={playerId} className={`bg-slate-900 rounded-lg p-3 border-l-4 ${borderColor}`}>
                    <div className="font-semibold text-sm">
                      {roleEmoji(playerId)} {playerId}
                      {showTruth && <span className="text-slate-500 text-xs ml-1">({getRoleText(playerId)})</span>}
                    </div>
                    <div className="h-5 rounded overflow-hidden flex mt-2 bg-slate-800">
                      <div className="bg-red-700 h-full transition-all duration-500" style={{ width: `${wolfPct}%` }} />
                      <div className="bg-amber-700 h-full transition-all duration-500" style={{ width: `${prophetPct}%` }} />
                      <div className="bg-green-700 h-full transition-all duration-500" style={{ width: `${villagerPct}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span className="text-red-300">🐺 {wolfPct}%</span>
                      <span className="text-amber-300">🔮 {prophetPct}%</span>
                      <span className="text-green-300">👤 {villagerPct}%</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">基于 {inference.basis.length} 条证据</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 局势推理 */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-sky-400 mb-4 pb-2 border-b border-slate-700">⚠️ 局势推理</h2>
            <div className="space-y-2">
              {crisisResult.all.map((c) => {
                let scoreColor = 'text-green-400';
                if (c.score >= 6) scoreColor = 'text-red-400';
                else if (c.score >= 3) scoreColor = 'text-amber-400';
                return (
                  <div key={c.playerId} className="bg-slate-900 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-sm">
                        {roleEmoji(c.playerId)} {c.playerId}
                        {showTruth && <span className="text-slate-500 text-xs ml-1">({getRoleText(c.playerId)})</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400">
                        <span className="bg-slate-800 px-2 py-0.5 rounded">指控:{c.factors.accuseCount}</span>
                        <span className="bg-slate-800 px-2 py-0.5 rounded">投票:{c.factors.voteCount}</span>
                        <span className="bg-slate-800 px-2 py-0.5 rounded">辩护:{c.factors.defendCount}</span>
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${scoreColor}`}>{formatNumber(c.score)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
