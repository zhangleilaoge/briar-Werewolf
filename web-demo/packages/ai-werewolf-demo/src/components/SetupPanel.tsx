import { useState } from 'react';
import type { GameConfig } from './useGameRunner';

interface SetupPanelProps {
  onStart: (config: GameConfig) => void;
}

const WEREWOLF_ROLES = [
  { role: 'werewolf', label: '普通狼人', max: 5 },
  { role: 'lone_wolf', label: '孤狼', max: 2 },
  { role: 'berserker', label: '狂狼', max: 2 },
];

const VILLAGER_ROLES = [
  { role: 'villager', label: '普通村民', max: 10 },
  { role: 'prophet', label: '预言家', max: 2 },
  { role: 'thief', label: '窃贼', max: 2 },
  { role: 'coroner', label: '验尸官', max: 2 },
];

export default function SetupPanel({ onStart }: SetupPanelProps) {
  const [werewolfCounts, setWerewolfCounts] = useState<Record<string, number>>({
    werewolf: 2,
    lone_wolf: 0,
    berserker: 0,
  });
  const [villagerCounts, setVillagerCounts] = useState<Record<string, number>>({
    villager: 3,
    prophet: 1,
    thief: 0,
    coroner: 0,
  });

  const total =
    Object.values(werewolfCounts).reduce((a, b) => a + b, 0) +
    Object.values(villagerCounts).reduce((a, b) => a + b, 0);

  const handleStart = () => {
    const werewolfConfig = Object.entries(werewolfCounts)
      .filter(([, count]) => count > 0)
      .map(([role, count]) => ({ role, count }));
    const villagerConfig = Object.entries(villagerCounts)
      .filter(([, count]) => count > 0)
      .map(([role, count]) => ({ role, count }));

    onStart({
      totalPlayers: total,
      werewolfConfig,
      villagerConfig,
    });
  };

  const renderCounter = (label: string, value: number, max: number, onChange: (v: number) => void) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          className="w-8 h-8 rounded bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          -
        </button>
        <span className="w-8 text-center font-mono">{value}</span>
        <button
          className="w-8 h-8 rounded bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2 text-center text-primary-foreground">🐺 AI 狼人杀演示</h1>
      <p className="text-center text-muted-foreground mb-8">配置角色，让 AI 自己玩给你看</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl p-6 border border-border">
          <h2 className="text-lg font-bold mb-4 text-red-400">🐺 狼人阵营</h2>
          {WEREWOLF_ROLES.map((r) => (
            <div key={r.role}>
              {renderCounter(r.label, werewolfCounts[r.role] || 0, r.max, (v) =>
                setWerewolfCounts((prev) => ({ ...prev, [r.role]: v }))
              )}
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl p-6 border border-border">
          <h2 className="text-lg font-bold mb-4 text-green-400">🏘️ 村民阵营</h2>
          {VILLAGER_ROLES.map((r) => (
            <div key={r.role}>
              {renderCounter(r.label, villagerCounts[r.role] || 0, r.max, (v) =>
                setVillagerCounts((prev) => ({ ...prev, [r.role]: v }))
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center">
        <div className="text-xl font-bold mb-4">总人数: {total} 人</div>
        <button
          className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleStart}
          disabled={total < 5}
        >
          {total < 5 ? '至少需要 5 人' : '▶ 开始游戏'}
        </button>
      </div>
    </div>
  );
}
