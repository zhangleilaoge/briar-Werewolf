import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { DecisionProcess } from '@/types';
import { ROLE_INFO } from '@/types';
import { ACTION_NAMES } from '@/lib/constants/display-names';
import type { Player } from '@/types';

interface DecisionProcessViewProps {
  process: DecisionProcess;
  players: Player[];
  logIdx: number;
}

export default function DecisionProcessView({ process, players, logIdx }: DecisionProcessViewProps) {
  const [hoveredCandidates, setHoveredCandidates] = useState<number | null>(null);

  const getName = (id: string | null) => {
    if (!id) return '';
    const p = players.find((x) => x.id === id);
    return p ? p.name : id;
  };

  const shortlist = process.shortlist;
  const allCandidates = process.candidates || [];
  const winnerActionStr = process.winner?.split(' → ')[0] || '';

  return (
    <div className="space-y-0.5 text-xs text-gray-500 whitespace-pre-wrap font-mono">
      {shortlist.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith('✓') || line.startsWith('○')) {
          const isSelected = line.startsWith('✓');
          return <div key={i} className={isSelected ? 'text-green-400 font-bold pl-4' : 'pl-4'}>{line}</div>;
        }
        if (line.startsWith('  [')) {
          // 解析策略规则行，分色展示规则和分数计算过程
          const ruleMatch = line.match(/(\[.+?\])\s+总分：(\d+) = (.+)/);
          if (ruleMatch) {
            const rule = ruleMatch[1];
            const total = ruleMatch[2];
            const parts = ruleMatch[3];
            return (
              <div key={i} className="pl-4">
                <span className="text-cyan-400">{rule} </span>
                <span className="text-white font-bold">总分：{total} = </span>
                <span className="text-gray-300">{parts}</span>
              </div>
            );
          }
          return <div key={i} className="text-cyan-400 pl-4">{line}</div>;
        }
        if (line.startsWith('  触发：')) return <div key={i} className="text-yellow-400 pl-4">{line}</div>;
        if (line.startsWith('  分数：') || line.startsWith('  修正：')) return <div key={i} className="text-gray-400 pl-4">{line}</div>;
        if (line.startsWith('  总分：')) {
          // 解析总分字符串，展示计算过程
          const match = line.match(/总分：(\d+) = (.+)/);
          if (match) {
            const total = match[1];
            const parts = match[2];
            return (
              <div key={i} className="pl-4">
                <span className="text-white font-bold">
                  &nbsp;
                  总分：{total} =&nbsp;
                </span>
                <span className="text-gray-300">{parts}</span>
              </div>
            );
          }
          return <div key={i} className="text-white font-bold pl-4">{line}</div>;
        }

        if (line.startsWith('【最终选择】')) return <div key={i} className="text-green-400 font-bold mt-1">{line}</div>;
        if (line.startsWith('  命中规则：')) return <div key={i} className="text-cyan-400 pl-4">{line}</div>;
        if (line.startsWith('  阶段：')) return <div key={i} className="text-gray-400 pl-4">{line}</div>;
        if (line.startsWith('  总分：') && line.includes('个候选')) return <div key={i} className="text-green-300 pl-4">{line}</div>;
        if (line.startsWith('【可选行动】')) {
          return (
            <div key={i} className="text-gray-400 font-bold flex items-center gap-1">
              {line}
              {allCandidates.length > 3 && (
                <span
                  className="relative"
                  onMouseEnter={() => setHoveredCandidates(logIdx)}
                  onMouseLeave={() => setHoveredCandidates(null)}
                >
                  <MoreHorizontal size={12} className="text-gray-500 hover:text-gray-300 cursor-pointer" />
                  {hoveredCandidates === logIdx && (
                    <div className="absolute left-0 top-5 z-50 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg whitespace-nowrap min-w-64">
                      <div className="text-xs font-bold text-gray-300 mb-2">所有候选行动（按分数排序）</div>
                      {allCandidates.map((c, ci) => {
                        const actionName = ACTION_NAMES[c.action] || c.action;
                        const claimedRole = (c as Record<string, unknown>).details ? ((c as Record<string, unknown>).details as Record<string, unknown>)?.claimedRole : null;
                        const roleLabel = claimedRole ? ROLE_INFO[claimedRole as keyof typeof ROLE_INFO]?.label || claimedRole : null;
                        const isSelected = c.action === winnerActionStr;
                        return (
                          <div key={ci} className={`text-xs mb-1 ${isSelected ? 'text-green-400' : 'text-gray-400'}`}>
                            <div className="flex items-center gap-2">
                              <span>{isSelected ? '✓' : '○'}</span>
                              <span className="font-medium">{actionName}{roleLabel ? `(${roleLabel})` : ''}{c.target ? `→${getName(c.target)}` : ''}</span>
                              <span className="text-yellow-400 ml-auto">{c.totalScore}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 ml-4">
                              {c.score}(基础) {c.intentionDrivenBonus ? `+${c.intentionDrivenBonus}(意图驱动)` : ''} {c.stageWeight ? `+${c.stageWeight}(${c.stage || ''})` : ''}
                              {c.modifiers?.alignment ? `+${c.modifiers.alignment}(阵营)` : ''}
                              {c.modifiers?.stress ? `+${c.modifiers.stress}(压力)` : ''}
                              {c.modifiers?.relation ? `+${c.modifiers.relation}(关系)` : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </span>
              )}
            </div>
          );
        }
        return <div key={i}>{line}</div>;
      })}
    </div>
  );
}
