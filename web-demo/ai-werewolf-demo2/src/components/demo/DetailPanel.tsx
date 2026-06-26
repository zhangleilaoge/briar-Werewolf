import React from 'react';
import { PERSONALITIES } from '@/intention/personalities';
import type { Player } from '@/types';
import { ROLE_EMOJIS, ROLE_NAMES, ATTRIBUTE_NAMES, ACTION_NAMES, LONG_TERM_NAMES, SHORT_TERM_NAMES, MEMORY_SOURCE_NAMES } from './game-runner-constants';
import { getPlayerDisplay, getMemoryTooltip, getMemoryDescription, formatRoundDisplay } from './game-runner-utils';
import { MemoryTooltip } from './MemoryTooltip';
import { HoverCard } from '@/components/ui/HoverCard';
import type { PlayerResult } from './game-runner-types';

interface Props {
  activeResult: PlayerResult | null;
  activePlayerId: string | null | undefined;
  activePlayerObj: Player | null | undefined;
  deadPlayers: Set<string>;
  initialPlayers: Player[];
  logsLength: number;
  activeTab: 'basic' | 'thinking';
  setActiveTab: (tab: 'basic' | 'thinking') => void;
  openSections: Set<string>;
  toggleSection: (id: string) => void;
}

export function DetailPanel({
  activeResult, activePlayerId, activePlayerObj, deadPlayers,
  initialPlayers, logsLength, activeTab, setActiveTab, openSections, toggleSection,
}: Props) {
  if (!activeResult || !activePlayerId) {
    return (
      <div className="w-96 flex flex-col shrink-0 overflow-y-auto bg-slate-900/50">
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          点击左侧角色查看详情
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 flex flex-col shrink-0 overflow-y-auto bg-slate-900/50">
      <div key={`${activePlayerId}-${logsLength}`} className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-3 pb-2 border-b border-slate-700">
          <span className="text-3xl">{ROLE_EMOJIS[activePlayerObj?.role || 'villager']}</span>
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-lg ${deadPlayers.has(activePlayerId) ? 'line-through text-slate-500' : ''}`}>
              {activePlayerObj?.name}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              <span>{ROLE_NAMES[activePlayerObj?.role || 'villager']}</span>
              <span>·</span>
              <span>{PERSONALITIES[activePlayerObj?.personality || 'cautious']?.name}</span>
              <span>·</span>
              <span>危机度 <span className={activeResult.selfCrisis.score >= 6 ? 'text-red-400' : activeResult.selfCrisis.score >= 3 ? 'text-amber-400' : 'text-green-400'}>{activeResult.selfCrisis.score}</span></span>
              <span>·</span>
              <span>压力 <span className={(activePlayerObj?.pressure ?? 0) >= 10 ? 'text-red-400' : (activePlayerObj?.pressure ?? 0) >= 5 ? 'text-amber-400' : 'text-green-400'}>{activePlayerObj?.pressure ?? 0}</span></span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-700 pb-2">
          <button onClick={() => setActiveTab('basic')} className={`px-3 py-1 rounded text-xs font-medium transition ${activeTab === 'basic' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            基本信息
          </button>
          <button onClick={() => setActiveTab('thinking')} className={`px-3 py-1 rounded text-xs font-medium transition ${activeTab === 'thinking' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            思维推理
          </button>
        </div>

        {activeTab === 'basic' && (
          <BasicTab activeResult={activeResult} activePlayerObj={activePlayerObj} activePlayerId={activePlayerId} initialPlayers={initialPlayers} openSections={openSections} toggleSection={toggleSection} />
        )}

        {activeTab === 'thinking' && (
          <ThinkingTab activeResult={activeResult} activePlayerId={activePlayerId} initialPlayers={initialPlayers} openSections={openSections} toggleSection={toggleSection} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================

function Drawer({ id, title, openSections, toggleSection, children }: {
  id: string; title: string; openSections: Set<string>; toggleSection: (id: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-700/30 transition">
        <span className="font-medium text-slate-300">{title}</span>
        <span className={`text-slate-500 transition-transform ${openSections.has(id) ? 'rotate-90' : ''}`}>▶</span>
      </button>
      {openSections.has(id) && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function BasicTab({ activeResult, activePlayerObj, activePlayerId, initialPlayers, openSections, toggleSection }: any) {
  return (
    <div className="space-y-2">
      <Drawer id="attributes" title="属性" openSections={openSections} toggleSection={toggleSection}>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {Object.entries(activePlayerObj?.attributes || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between bg-slate-800 rounded px-2 py-1">
              <span className="text-slate-400">{ATTRIBUTE_NAMES[k] || k}</span>
              <span className="font-mono text-slate-200">{v as number}</span>
            </div>
          ))}
        </div>
      </Drawer>

      <Drawer id="memories" title={`记忆 (${activeResult.memories.length})`} openSections={openSections} toggleSection={toggleSection}>
        <div className="space-y-1 max-h-[calc(100vh-360px)] overflow-y-scroll">
          {activeResult.memories.length === 0 && <div className="text-xs text-slate-500">暂无记忆</div>}
          {activeResult.memories.slice().reverse().map((mem: any) => {
            const forgottenClass = mem.isForgotten ? 'opacity-40 line-through' : '';
            return (
              <div key={mem.id} className={`bg-slate-800 rounded px-2 py-1.5 text-xs ${forgottenClass}`}>
                <div className="text-slate-200 font-medium">{getMemoryDescription(mem, activePlayerId!, initialPlayers)}</div>
                <div className="flex flex-wrap gap-x-2 mt-1 text-[10px] text-slate-500">
                  <span>时间：{formatRoundDisplay(mem.round, mem.content.dayRound)}</span>
                  <span>来源：{MEMORY_SOURCE_NAMES[mem.source] || mem.source}</span>
                  <span>可信度：{Math.round(mem.credibility * 100)}%</span>
                </div>
                {mem.notes && <div className="text-slate-400 mt-0.5 text-[10px]">{mem.notes}</div>}
              </div>
            );
          })}
        </div>
      </Drawer>

      {activeResult.forgottenMemories.length > 0 && (
        <Drawer id="forgotten" title={`已遗忘 (${activeResult.forgottenMemories.length})`} openSections={openSections} toggleSection={toggleSection}>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {activeResult.forgottenMemories.slice().reverse().map((mem: any) => (
              <div key={mem.id} className="bg-slate-800 rounded px-2 py-1.5 text-xs opacity-50 line-through">
                <div className="text-slate-200 font-medium">{getMemoryDescription(mem, activePlayerId!, initialPlayers)}</div>
                <div className="flex flex-wrap gap-x-2 mt-1 text-[10px] text-slate-500">
                  <span>时间：{formatRoundDisplay(mem.round, mem.content.dayRound)}</span>
                  <span>来源：{MEMORY_SOURCE_NAMES[mem.source] || mem.source}</span>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </div>
  );
}

function ThinkingTab({ activeResult, activePlayerId, initialPlayers, openSections, toggleSection }: any) {
  return (
    <div className="space-y-2">
      <Drawer id="relations" title="关系" openSections={openSections} toggleSection={toggleSection}>
        <div className="flex flex-wrap gap-1">
          {activeResult.relations.map((rel: any) => {
            const displayName = getPlayerDisplay(rel.playerId, initialPlayers);
            return (
              <MemoryTooltip key={rel.playerId} title="支撑记忆" content={getMemoryTooltip(rel.memoryIds, activeResult.memories, activePlayerId, initialPlayers)} basis={rel.memoryIds} impacts={[...rel.directImpacts, ...rel.bystanderImpacts]} className="inline-block">
                <span className={`text-xs px-2 py-1 rounded ${rel.friendly > 0 ? 'bg-green-900/30 text-green-400' : rel.friendly < 0 ? 'bg-red-900/30 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                  {displayName} {rel.friendly > 0 ? '+' : ''}{rel.friendly.toFixed(1)}
                </span>
              </MemoryTooltip>
            );
          })}
        </div>
      </Drawer>

      <Drawer id="inferences" title="角色推理" openSections={openSections} toggleSection={toggleSection}>
        <div className="flex flex-wrap gap-1">
          {Array.from<[string, any]>(activeResult.inferences.entries()).sort((a, b) => b[1].wolfProb - a[1].wolfProb).map(([pid, inf]) => {
            const wp = Math.round(inf.wolfProb * 100);
            const pp = Math.round(inf.prophetProb * 100);
            const vp = Math.round(inf.villagerProb * 100);
            const displayName = getPlayerDisplay(pid, initialPlayers);
            const t = inf.trace;
            const wolfImpacts = t?.impacts?.filter((i: any) => i.description.includes('狼人')) ?? [];
            const prophetImpacts = t?.impacts?.filter((i: any) => i.description.includes('预言家')) ?? [];
            const villagerImpacts = t?.impacts?.filter((i: any) => i.description.includes('村民')) ?? [];
            return (
              <span key={pid} className="text-xs px-2 py-1 rounded bg-slate-800">
                <span className="text-slate-300">{displayName}</span>
                {wolfImpacts.length > 0 ? (
                  <MemoryTooltip title="支撑记忆（狼人）" content={getMemoryTooltip(inf.basis, activeResult.memories, activePlayerId, initialPlayers)} basis={inf.basis} impacts={wolfImpacts} className="inline-block">
                    <span className="text-red-400 ml-1 cursor-help">🐺{wp}%({t?.wolfWeight.toFixed(2) ?? '?'})</span>
                  </MemoryTooltip>
                ) : (
                  <span className="text-red-400 ml-1">🐺{wp}%({t?.wolfWeight.toFixed(2) ?? '?'})</span>
                )}
                {prophetImpacts.length > 0 ? (
                  <MemoryTooltip title="支撑记忆（预言家）" content={getMemoryTooltip(inf.basis, activeResult.memories, activePlayerId, initialPlayers)} basis={inf.basis} impacts={prophetImpacts} className="inline-block">
                    <span className="text-amber-400 ml-1 cursor-help">🔮{pp}%({t?.prophetWeight.toFixed(2) ?? '?'})</span>
                  </MemoryTooltip>
                ) : (
                  <span className="text-amber-400 ml-1">🔮{pp}%({t?.prophetWeight.toFixed(2) ?? '?'})</span>
                )}
                {villagerImpacts.length > 0 ? (
                  <MemoryTooltip title="支撑记忆（村民）" content={getMemoryTooltip(inf.basis, activeResult.memories, activePlayerId, initialPlayers)} basis={inf.basis} impacts={villagerImpacts} className="inline-block">
                    <span className="text-green-400 ml-1 cursor-help">👤{vp}%({t?.villagerWeight.toFixed(2) ?? '?'})</span>
                  </MemoryTooltip>
                ) : (
                  <span className="text-green-400 ml-1">👤{vp}%({t?.villagerWeight.toFixed(2) ?? '?'})</span>
                )}
              </span>
            );
          })}
        </div>
      </Drawer>

      <Drawer id="intentions" title="意图" openSections={openSections} toggleSection={toggleSection}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-slate-400 mb-1">长期</div>
            <div className="space-y-1">
              {activeResult.intentionState.longTerm.slice(0, 5).map((lt: any) => (
                <HoverCard
                  key={lt.id}
                  title={`长期意图：${LONG_TERM_NAMES[lt.id] || lt.id}`}
                  subtitle={`优先级 ${(lt.priority * 100).toFixed(0)}%`}
                  intentionTraces={lt.traces}
                  width={360}
                >
                  <div className="flex justify-between text-xs bg-slate-800 rounded px-2 py-1">
                    <span className="text-slate-300 truncate mr-1">{LONG_TERM_NAMES[lt.id] || lt.id}</span>
                    <span className="text-amber-400 shrink-0">{(lt.priority * 100).toFixed(0)}%</span>
                  </div>
                </HoverCard>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">短期</div>
            <div className="space-y-1">
              {activeResult.intentionState.shortTerm.slice(0, 5).map((st: any) => (
                <HoverCard
                  key={st.id}
                  title={`短期意图：${SHORT_TERM_NAMES[st.id] || st.id}`}
                  subtitle={`权重 ${st.weight.toFixed(2)}`}
                  intentionTraces={st.traces}
                  width={360}
                >
                  <div className="flex justify-between text-xs bg-slate-800 rounded px-2 py-1">
                    <span className="text-slate-300 truncate mr-1">{SHORT_TERM_NAMES[st.id] || st.id}</span>
                    <span className="text-purple-400 shrink-0">{st.weight.toFixed(1)}</span>
                  </div>
                </HoverCard>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      <Drawer id="candidates" title="行动" openSections={openSections} toggleSection={toggleSection}>
        <div className="space-y-1">
          {(() => {
            const selected = activeResult.intentionState.selected;
            const candidates = activeResult.intentionState.candidates;
            const allActions = selected
              ? [selected, ...candidates.filter((c: any) => !(c.action === selected.action && c.targetId === selected.targetId))]
              : candidates;
            return allActions.slice(0, 8).map((c: any, i: number) => {
              const actionName = ACTION_NAMES[c.action] || c.action;
              const targetName = c.targetId ? getPlayerDisplay(c.targetId, initialPlayers) : '';
              const isSelected = selected && c.action === selected.action && c.targetId === selected.targetId;
              return (
                <MemoryTooltip key={i} title="支撑记忆" content={getMemoryTooltip(c.supportingMemories, activeResult.memories, activePlayerId, initialPlayers)} basis={c.supportingMemories} impacts={c.traces?.flatMap((t: any) => t.basis) ?? []}>
                  <div className="flex justify-between text-xs bg-slate-800 rounded px-2 py-1.5">
                    <span className={`truncate mr-1 ${isSelected ? 'text-amber-400 font-bold' : i === 0 && !selected ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                      {actionName}{targetName && <span className="text-purple-300"> → {targetName}</span>}
                    </span>
                    <span className="text-slate-500 shrink-0">{c.score.toFixed(1)}</span>
                  </div>
                </MemoryTooltip>
              );
            });
          })()}
        </div>
      </Drawer>
    </div>
  );
}