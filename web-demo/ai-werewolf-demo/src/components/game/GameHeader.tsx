import { GAME_SPEED_SLOW, GAME_SPEED_NORMAL, GAME_SPEED_FAST } from '@/types';

interface GameHeaderProps {
  round: number;
  werewolfCount: number;
  villagerCount: number;
  isRunning: boolean;
  isEnded: boolean;
  winner: string | null;
  speed: number;
  setSpeed: (speed: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  exportLog: () => void;
  onOpenRules: () => void;
}

export default function GameHeader({
  round,
  werewolfCount,
  villagerCount,
  isRunning,
  isEnded,
  winner,
  speed,
  setSpeed,
  pauseGame,
  resumeGame,
  resetGame,
  exportLog,
  onOpenRules,
}: GameHeaderProps) {
  return (
    <div className="bg-card border-b border-border p-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">🐺 AI 狼人杀</h1>
        <div className="text-sm text-muted-foreground">
          第 {round} 轮 | 狼人 {werewolfCount} | 村民 {villagerCount}
        </div>
        {isEnded && winner && (
          <div className="text-lg font-bold text-green-400">
            {winner === 'villager' ? '🏆 村民胜利！' : '🏆 狼人胜利！'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-4 py-2 bg-[#1a1b2e] text-gray-300 border border-gray-600 rounded-lg text-sm font-bold hover:bg-[#252640] hover:text-white transition-colors"
          onClick={onOpenRules}
        >
          📖 规则
        </button>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:opacity-90 transition-colors"
          onClick={() => setSpeed(speed === GAME_SPEED_SLOW ? GAME_SPEED_NORMAL : speed === GAME_SPEED_NORMAL ? GAME_SPEED_FAST : GAME_SPEED_SLOW)}
        >
          {speed}x
        </button>
        {!isEnded && (
          isRunning ? (
            <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-bold hover:opacity-90" onClick={pauseGame}>
              ⏸ 暂停
            </button>
          ) : (
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:opacity-90" onClick={resumeGame}>
              ▶ 继续
            </button>
          )
        )}
        <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold hover:opacity-90" onClick={resetGame}>
          ↺ 重置
        </button>
        {isEnded && (
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:opacity-90" onClick={exportLog}>
            📥 导出日志
          </button>
        )}
      </div>
    </div>
  );
}
