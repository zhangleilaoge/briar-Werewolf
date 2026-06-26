import React from 'react';
import type { GameConfig } from './game-runner-types';

interface Props {
  config: GameConfig;
  setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
  totalPlayers: number;
  startGame: () => void;
}

export function SetupPanel({ config, setConfig, totalPlayers, startGame }: Props) {
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