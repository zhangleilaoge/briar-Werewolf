import type { Player } from '@/types';
import { roleNameMap, itemLabel } from '../ui-utils';

interface PlayerListProps {
  players: Player[];
  selectedPlayer: Player | null;
  onSelectPlayer: (player: Player) => void;
}

export default function PlayerList({ players, selectedPlayer, onSelectPlayer }: PlayerListProps) {
  return (
    <div className="w-64 bg-card border-r border-border overflow-y-auto p-4">
      <h3 className="text-sm font-bold mb-3 text-muted-foreground">参与角色</h3>
      <div className="space-y-2">
        {players.map((p) => (
          <button
            key={p.id}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              p.alive
                ? p.team === 'werewolf'
                  ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20'
                  : 'border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
                : 'border-gray-600/30 bg-gray-800/50 opacity-60'
            } ${selectedPlayer?.id === p.id ? 'ring-2 ring-primary' : ''}`}
            onClick={() => onSelectPlayer(p)}
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
  );
}
