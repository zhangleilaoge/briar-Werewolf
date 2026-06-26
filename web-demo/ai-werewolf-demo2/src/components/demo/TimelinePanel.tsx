import React from 'react';
import type { GameLog } from './game-runner-types';

interface Props {
  logs: GameLog[];
  isPlaying: boolean;
  isGameOver: boolean;
  logRef: React.RefObject<HTMLDivElement | null>;
}

export function TimelinePanel({ logs, isPlaying, isGameOver, logRef }: Props) {
  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-slate-700">
      <div className="flex-1 overflow-y-auto p-4 space-y-2" ref={logRef}>
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 text-sm items-center">
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
  );
}