import type { Player } from '@/types';
import { getAlignmentName, RELATION_DISPLAY_THRESHOLD } from '@/types';
import { roleNameMap, itemLabel, attributeLabel, attributeColor, stressColor, stressLabel } from '../ui-utils';

interface PlayerDrawerProps {
  selectedPlayer: Player | null;
  players: Player[];
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  onClosePlayer: () => void;
}

export default function PlayerDrawer({
  selectedPlayer,
  players,
  drawerOpen,
  onToggleDrawer,
  onClosePlayer,
}: PlayerDrawerProps) {
  return (
    <div className={`bg-card border-l border-border overflow-y-auto transition-all duration-300 flex flex-col ${drawerOpen ? 'w-80 p-4' : 'w-10 items-center'}`}>
      {/* 抽屉切换按钮 */}
      <button
        className={`text-muted-foreground hover:text-foreground transition-colors ${drawerOpen ? 'self-end mb-2' : 'mt-4'}`}
        onClick={onToggleDrawer}
        title={drawerOpen ? '收起详情' : '展开详情'}
      >
        {drawerOpen ? (
          <span>››</span>
        ) : (
          <span>‹‹</span>
        )}
      </button>

      {drawerOpen && (
        <div className="flex-1">
          {selectedPlayer ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{selectedPlayer.name}</h3>
                <button className="text-muted-foreground hover:text-foreground" onClick={onClosePlayer}>
                  ✕
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">职业：</span>
                  <span className={selectedPlayer.team === 'werewolf' ? 'text-red-400' : 'text-green-400'}>
                    {roleNameMap[selectedPlayer.role] || selectedPlayer.role}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">阵营：</span>
                  <span className={selectedPlayer.team === 'werewolf' ? 'text-red-400' : 'text-green-400'}>
                    {selectedPlayer.team === 'werewolf' ? '狼人' : '村民'} · {getAlignmentName(selectedPlayer.alignment)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">状态：</span>
                  <span className={selectedPlayer.alive ? 'text-green-400' : 'text-red-400'}>
                    {selectedPlayer.alive ? '存活' : '死亡'}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">压力：</span>
                  <span className={stressColor(selectedPlayer.stress)}>
                    {selectedPlayer.stress > 0 ? '+' : ''}{selectedPlayer.stress} ({stressLabel(selectedPlayer.stress)})
                  </span>
                </div>
                {selectedPlayer.exposure !== undefined && (
                  <div className="text-sm relative group">
                    <span className="text-muted-foreground">暴露度：</span>
                    <span className={selectedPlayer.exposure > 0.6 ? 'text-red-400' : selectedPlayer.exposure > 0.3 ? 'text-yellow-400' : 'text-green-400'}>
                      {(selectedPlayer.exposure * 100).toFixed(0)}%
                      {selectedPlayer.exposure > 0.6 ? ' (高)' : selectedPlayer.exposure > 0.3 ? ' (中)' : ' (低)'}
                    </span>
                    {/* Hover 弹窗：显示暴露度变更日志 */}
                    <div className="absolute left-0 top-6 z-50 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg hidden group-hover:block min-w-64 max-h-64 overflow-y-auto">
                      <div className="text-xs font-bold text-gray-300 mb-2">暴露度变更日志</div>
                      {(selectedPlayer as any).exposureLog?.map((log: any, i: number) => (
                        <div key={i} className="text-xs mb-1 border-b border-gray-700 pb-1">
                          <div className="text-gray-400">{log.reason}</div>
                          <div className={`${log.delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {log.delta > 0 ? '+' : ''}{(log.delta * 100).toFixed(1)}% → {(log.after * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                      {!(selectedPlayer as any).exposureLog?.length && (
                        <div className="text-xs text-gray-500">暂无变更记录</div>
                      )}
                    </div>
                  </div>
                )}
                {selectedPlayer.traits.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">特质：</span>
                    <span className="text-purple-400">{selectedPlayer.traits.join(', ')}</span>
                  </div>
                )}
                {selectedPlayer.items.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">道具：</span>
                    <span className="text-yellow-400">
                      {selectedPlayer.items.map((i) => itemLabel(i)).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* 六维属性 */}
              <div className="border-t border-border pt-4 mb-4">
                <h4 className="text-sm font-bold mb-2 text-muted-foreground">六维属性</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedPlayer.attributes).map(([key, value]) => (
                    <div key={key} className="text-sm flex items-center justify-between">
                      <span className="text-muted-foreground">{attributeLabel(key)}</span>
                      <span className={`font-mono font-bold ${attributeColor(value)}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 关系网 */}
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-bold mb-2 text-muted-foreground">关系网</h4>
                <div className="space-y-1">
                  {players.filter(p => p.id !== selectedPlayer.id && p.alive).map(other => {
                    const rel = selectedPlayer.relations[other.id];
                    const favor = rel?.favor ?? 0;
                    const suspicion = selectedPlayer.suspicionByOthers?.[other.id] ?? 0.5;
                    const isEnemy = other.team !== selectedPlayer.team;

                    // 敌人始终显示，友方只显示显著变化
                    if (!isEnemy && Math.abs(favor) <= RELATION_DISPLAY_THRESHOLD) return null;

                    return (
                      <div key={other.id} className="text-sm flex items-center">
                        <span className="text-muted-foreground shrink-0">{other.name}</span>
                        <div className="flex items-center gap-2 text-xs ml-auto shrink-0">
                          {/* 好感度（敌人显示，友方只在有变化时显示） */}
                          {(isEnemy || Math.abs(favor) > RELATION_DISPLAY_THRESHOLD) && (
                            <span className={`${favor > 0 ? 'text-green-400' : favor < 0 ? 'text-red-400' : 'text-gray-500'} w-16 text-right`}>
                              好感{favor > 0 ? '+' : ''}{favor.toFixed(1)}
                            </span>
                          )}
                          {/* 怀疑度（敌人始终显示） */}
                          {isEnemy && (
                            <span className={`${suspicion > 0.6 ? 'text-red-400' : suspicion > 0.3 ? 'text-yellow-400' : 'text-green-400'} w-16 text-right`}>
                              怀疑{(suspicion * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {players.filter(p => p.id !== selectedPlayer.id && p.alive).filter(p => {
                    const rel = selectedPlayer.relations[p.id];
                    const favor = rel?.favor ?? 0;
                    const isEnemy = p.team !== selectedPlayer.team;
                    return isEnemy || Math.abs(favor) > RELATION_DISPLAY_THRESHOLD;
                  }).length === 0 && (
                    <div className="text-xs text-muted-foreground">暂无显著关系变化</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center mt-8">
              点击左侧角色查看详情
            </div>
          )}
        </div>
      )}
    </div>
  );
}
