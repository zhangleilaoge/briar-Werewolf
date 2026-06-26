import React from 'react';
import type { Player } from '@/types';
import { ROLE_NAMES, ROLE_SKILLS } from './game-runner-constants';

interface Props {
  players: Player[];
  deadPlayers: Set<string>;
  selectedPlayer: string | null;
  lastPlayerId: string | null;
  onSelect: (id: string) => void;
}

export function PlayerPanel({ players, deadPlayers, selectedPlayer, lastPlayerId, onSelect }: Props) {
  return (
    <div className="w-72 border-r border-slate-700 flex flex-col shrink-0">
      <div className="p-3 text-sm text-slate-400 border-b border-slate-700">参与角色</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {players.map((p) => {
          const isDead = deadPlayers.has(p.id);
          const isSelected = selectedPlayer === p.id;
          const isCurrent = lastPlayerId === p.id;
          const borderClass = isSelected ? 'border border-blue-500/60' : isCurrent ? 'border border-blue-500/60 animate-pulse' : 'border border-slate-700/60';
          const bgClass = isSelected ? 'bg-slate-800/90' : isCurrent ? 'bg-slate-700/50' : 'bg-slate-800/50';
          return (
            <div key={p.id} onClick={() => onSelect(p.id)} className={`p-3 rounded-lg cursor-pointer transition ${borderClass} ${bgClass} ${isDead ? 'opacity-50' : 'hover:bg-slate-700/50'}`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold text-sm ${isDead ? 'line-through text-slate-500' : ''}`}>{p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${isDead ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'}`}>{isDead ? '死亡' : '存活'}</span>
              </div>
              <div className={`text-xs mt-1 flex justify-between ${p.team === 'werewolf' ? 'text-red-400' : 'text-green-400'}`}>
                <span>{ROLE_NAMES[p.role]}</span>
                {ROLE_SKILLS[p.role] !== '平民' && <span className="text-yellow-500/80">{ROLE_SKILLS[p.role]}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}