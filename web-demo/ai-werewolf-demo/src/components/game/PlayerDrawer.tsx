import { useRef, useState } from 'react';
import type { Player } from '@/types';
import { getAlignmentName, RELATION_DISPLAY_THRESHOLD, IDENTITY_CRISIS_HIGH_THRESHOLD, IDENTITY_CRISIS_LOW_THRESHOLD, BELIEF_DEFAULT_PROBABILITY } from '@/types';
import { PERCENT_MULTIPLIER, SUSPICION_COLOR_HIGH, SUSPICION_COLOR_MEDIUM } from '@/lib/constants/ui-thresholds';
import { roleNameMap, itemLabel, attributeLabel, attributeColor, stressColor, stressLabel } from '../ui-utils';
import { PopOverlay } from '@/components/ui/PopOverlay';

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
  const crisisTriggerRef = useRef<HTMLButtonElement>(null);
  const [crisisVisible, setCrisisVisible] = useState(false);

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
                {selectedPlayer.identityCrisis !== undefined && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">身份危机：</span>
                    <button
                      ref={crisisTriggerRef}
                      type="button"
                      className={`${selectedPlayer.identityCrisis > IDENTITY_CRISIS_HIGH_THRESHOLD ? 'text-red-400' : selectedPlayer.identityCrisis > IDENTITY_CRISIS_LOW_THRESHOLD ? 'text-yellow-400' : 'text-green-400'} bg-transparent p-0 m-0 border-0 cursor-help`}
                      onMouseEnter={() => setCrisisVisible(true)}
                    >
                      {(selectedPlayer.identityCrisis * PERCENT_MULTIPLIER).toFixed(0)}%
                      {selectedPlayer.identityCrisis > IDENTITY_CRISIS_HIGH_THRESHOLD ? ' (高)' : selectedPlayer.identityCrisis > IDENTITY_CRISIS_LOW_THRESHOLD ? ' (中)' : ' (低)'}
                    </button>
                    <PopOverlay
                      triggerRef={crisisTriggerRef}
                      visible={crisisVisible}
                      onClose={() => setCrisisVisible(false)}
                      title="身份危机变更日志"
                      zIndex={50}
                      width={260}
                      className="max-h-64 overflow-y-auto"
                    >
                      {selectedPlayer.identityCrisisLog?.map((log, i) => (
                        <div key={i} className="text-xs mb-1 border-b border-gray-700 pb-1">
                          <div className="text-gray-400">{log.reason}</div>
                          <div className={`${log.delta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {(log.before * PERCENT_MULTIPLIER).toFixed(0)}% {log.delta >= 0 ? '+' : ''}{(log.delta * PERCENT_MULTIPLIER).toFixed(1)}% → {(log.after * PERCENT_MULTIPLIER).toFixed(0)}%
                          </div>
                          {log.timestamp && (
                            <div className="text-gray-600 text-[10px]">
                              {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ))}
                      {!selectedPlayer.identityCrisisLog?.length && (
                        <div className="text-xs text-gray-500">暂无变更记录</div>
                      )}
                    </PopOverlay>
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
                <div className="grid grid-cols-[1fr_80px_80px] gap-1 text-sm">
                  {players.filter(p => p.id !== selectedPlayer.id && p.alive).map(other => {
                    const rel = selectedPlayer.relations[other.id];
                    const favor = rel?.favor ?? 0;
                    const suspicion = selectedPlayer.suspicionByOthers?.[other.id] ?? BELIEF_DEFAULT_PROBABILITY;
                    const isEnemy = other.team !== selectedPlayer.team;

                    // 敌人始终显示，友方只显示显著变化
                    if (!isEnemy && Math.abs(favor) <= RELATION_DISPLAY_THRESHOLD) return null;

                    const showFavor = isEnemy || Math.abs(favor) > RELATION_DISPLAY_THRESHOLD;

                    return (
                      <div key={other.id} className="contents">
                        <span className="text-muted-foreground">{other.name}</span>
                        <span className={`text-xs text-right ${showFavor ? (favor > 0 ? 'text-green-400' : favor < 0 ? 'text-red-400' : 'text-gray-500') : 'text-transparent'}`}>
                          {showFavor ? `好感${favor > 0 ? '+' : ''}${favor.toFixed(1)}` : ' '}
                        </span>
                        <span className="text-xs text-right">
                          {selectedPlayer.team === 'werewolf' && other.team === 'werewolf' ? (
                            <span className="text-gray-500">-</span>
                          ) : (
                            <span className={`${suspicion > SUSPICION_COLOR_HIGH ? 'text-red-400' : suspicion > SUSPICION_COLOR_MEDIUM ? 'text-yellow-400' : 'text-green-400'}`}>
                              怀疑{(suspicion * PERCENT_MULTIPLIER).toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {players.filter(p => p.id !== selectedPlayer.id && p.alive).filter(p => {
                  const rel = selectedPlayer.relations[p.id];
                  const favor = rel?.favor ?? 0;
                  const isEnemy = p.team !== selectedPlayer.team;
                  return isEnemy || Math.abs(favor) > RELATION_DISPLAY_THRESHOLD;
                }).length === 0 && (
                  <div className="text-xs text-muted-foreground mt-1">暂无显著关系变化</div>
                )}
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
