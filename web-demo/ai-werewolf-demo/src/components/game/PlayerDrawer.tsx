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
                  {Object.entries(selectedPlayer.relations).filter(([_, rel]) => Math.abs(rel.trust) > RELATION_DISPLAY_THRESHOLD || Math.abs(rel.friendly) > RELATION_DISPLAY_THRESHOLD).map(([otherId, rel]) => {
                    const other = players.find((p) => p.id === otherId);
                    if (!other) return null;
                    return (
                      <div key={otherId} className="text-sm flex items-center justify-between">
                        <span className="text-muted-foreground">{other.name}</span>
                        <span className="text-xs">
                          <span className={rel.trust > 0 ? 'text-green-400' : 'text-red-400'}>信任{rel.trust > 0 ? '+' : ''}{rel.trust.toFixed(1)}</span>
                          <span className="mx-1">·</span>
                          <span className={rel.friendly > 0 ? 'text-green-400' : 'text-red-400'}>友好{rel.friendly > 0 ? '+' : ''}{rel.friendly.toFixed(1)}</span>
                        </span>
                      </div>
                    );
                  })}
                  {Object.entries(selectedPlayer.relations).filter(([_, rel]) => Math.abs(rel.trust) > RELATION_DISPLAY_THRESHOLD || Math.abs(rel.friendly) > RELATION_DISPLAY_THRESHOLD).length === 0 && (
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
