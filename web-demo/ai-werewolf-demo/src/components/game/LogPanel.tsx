import type { GameLogItem, Player } from '@/types';
import LogEntry from './LogEntry';

interface LogPanelProps {
  logs: GameLogItem[];
  players: Player[];
  expandedLogs: Set<number>;
  onToggleLog: (idx: number) => void;
}

export default function LogPanel({ logs, players, expandedLogs, onToggleLog }: LogPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {logs.map((log, idx) => (
          <LogEntry
            key={idx}
            log={log}
            idx={idx}
            players={players}
            expanded={expandedLogs.has(idx)}
            onToggle={onToggleLog}
          />
        ))}
        {logs.length === 0 && (
          <div className="text-muted-foreground text-sm">等待游戏开始...</div>
        )}
      </div>
    </div>
  );
}
