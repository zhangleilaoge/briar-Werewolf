import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { DecisionProcess } from '@/types';
import { ROLE_INFO } from '@/types';
import type { Player } from '@/types';
import { ACTION_NAMES } from '@/lib/constants/display-names';

interface DecisionProcessViewProps {
  process: DecisionProcess;
  players: Player[];
  logIdx: number;
}

// ==================== 常量 ====================

/** 阶段标签映射 */
const STAGE_LABELS: Record<string, string> = {
  intention: '社交',
  plugin: '插件',
  duty: '职业义务',
  survival: '生存',
  information: '信息',
  social: '社交',
};

/** 分数来源映射 */
const SCORE_SOURCE: Record<string, string> = {
  intention: '意图系统 (IntentionManager)',
  plugin: '插件系统 (PluginRegistry)',
  duty: '策略引擎 - 职业义务',
  survival: '策略引擎 - 生存',
  information: '策略引擎 - 信息',
  social: '策略引擎 - 社交',
  unknown: '策略引擎',
};

// ==================== 可复用组件 ====================

/** 带 hover 提示的分数标签 */
function ScoreLabel({ label, source, value }: { label: string; source?: string; value: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  if (!value) return null;

  // 没有 source 时不显示下划线和 hover
  if (!source) {
    return <span>{value}({label})</span>;
  }

  return (
    <span className="relative inline-block">
      <span
        className="border-b border-dotted border-gray-500 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {value}({label})
      </span>
      {showTooltip && (
        <span className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-800 text-[10px] text-gray-300 rounded shadow-lg whitespace-nowrap z-50">
          {source}
        </span>
      )}
    </span>
  );
}

/** 玩家名显示 */
function PlayerName({ id, players }: { id: string | null; players: Player[] }) {
  if (!id) return null;
  const p = players.find((x) => x.id === id);
  return <span className="text-white font-medium">{p?.name || id}</span>;
}

/** 分数公式组件 — 从结构化数据渲染，不解析字符串 */
function ScoreLine({ candidate }: { candidate: DecisionProcess['candidates'][0] }) {
  const { score, intentionDrivenBonus, stageWeight, stage, modifiers, totalScore, strategy, rule } = candidate;

  // 基础分来源
  const baseSource = (() => {
    if (rule?.includes('intention') || strategy?.includes('Intention')) return '意图分数';
    if (strategy?.includes('Plugin') || strategy?.includes('fake') || rule?.includes('fake')) return '插件分数';
    return '策略分数';
  })();

  // 意图匹配标签
  const intentionLabel = rule?.includes('top') ? '主意图' : '次意图';

  // 阶段标签
  const stageLabel = STAGE_LABELS[stage || ''] || stage || '';

  return (
    <span className="text-gray-300">
      <span className="text-white font-bold">总分：{totalScore} = </span>
      <ScoreLabel value={score} label="基础分" source={baseSource} />
      {intentionDrivenBonus ? (
        <span> + <ScoreLabel value={intentionDrivenBonus} label={intentionLabel} /></span>
      ) : null}
      {stageWeight ? (
        <span> + {stageWeight}({stageLabel})</span>
      ) : null}
      {modifiers.alignment ? (
        <span> + <ScoreLabel value={modifiers.alignment} label="阵营修正" /></span>
      ) : null}
      {modifiers.stress ? (
        <span> + <ScoreLabel value={modifiers.stress} label="压力修正" /></span>
      ) : null}
      {modifiers.relation ? (
        <span> + <ScoreLabel value={modifiers.relation} label="关系修正" /></span>
      ) : null}
    </span>
  );
}

/** 候选行动卡片 — 从结构化数据渲染 */
function CandidateCard({
  candidate,
  isWinner,
  players,
  probability,
}: {
  candidate: DecisionProcess['candidates'][0];
  isWinner: boolean;
  players: Player[];
  probability?: number;
}) {
  const actionName = ACTION_NAMES[candidate.action] || candidate.action;
  const claimedRole = candidate.details?.claimedRole as string | undefined;
  const roleLabel = claimedRole ? ROLE_INFO[claimedRole as keyof typeof ROLE_INFO]?.label || claimedRole : null;

  return (
    <div className={`pl-4 ${isWinner ? 'text-green-400' : ''}`}>
      <div className={isWinner ? 'font-bold' : ''}>
        {isWinner ? '✓' : '○'} {actionName}{roleLabel ? `(${roleLabel})` : ''}
        <PlayerName id={candidate.target} players={players} />
      </div>
      <div className="text-cyan-400">[{candidate.strategy}.{candidate.rule}]</div>
      <ScoreLine candidate={candidate} />
      {probability !== undefined && (
        <span className="text-gray-400"> (概率 {probability.toFixed(1)}%)</span>
      )}
    </div>
  );
}

/** 弹窗中的候选列表（简化版，无 hover） */
function CandidatePopupItem({
  candidate,
  isWinner,
  players,
  probability,
}: {
  candidate: DecisionProcess['candidates'][0];
  isWinner: boolean;
  players: Player[];
  probability?: number;
}) {
  const actionName = ACTION_NAMES[candidate.action] || candidate.action;
  const claimedRole = candidate.details?.claimedRole as string | undefined;
  const roleLabel = claimedRole ? ROLE_INFO[claimedRole as keyof typeof ROLE_INFO]?.label || claimedRole : null;
  const isNegative = candidate.totalScore < 0;
  const stageLabel = STAGE_LABELS[candidate.stage || ''] || candidate.stage || '';

  return (
    <div className={`text-xs mb-1 ${isWinner ? 'text-green-400' : isNegative ? 'text-red-400 opacity-60' : 'text-gray-400'}`}>
      <div className="flex items-center gap-2">
        <span>{isWinner ? '✓' : '○'}</span>
        <span className="font-medium">{actionName}{roleLabel ? `(${roleLabel})` : ''}{candidate.target ? `→${players.find(p => p.id === candidate.target)?.name || candidate.target}` : ''}</span>
        <span className={`ml-auto ${isNegative ? 'text-red-400' : 'text-yellow-400'}`}>{candidate.totalScore}</span>
      </div>
      <div className="text-[10px] text-gray-500 ml-4">
        {candidate.score}(基础分)
        {candidate.intentionDrivenBonus ? ` +${candidate.intentionDrivenBonus}(${candidate.rule?.includes('top') ? '主意图' : '次意图'})` : ''}
        {candidate.stageWeight ? ` +${candidate.stageWeight}(${stageLabel})` : ''}
        {candidate.modifiers?.alignment ? ` +${candidate.modifiers.alignment}(阵营修正)` : ''}
        {candidate.modifiers?.stress ? ` +${candidate.modifiers.stress}(压力修正)` : ''}
        {candidate.modifiers?.relation ? ` +${candidate.modifiers.relation}(关系修正)` : ''}
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

export default function DecisionProcessView({ process, players, logIdx }: DecisionProcessViewProps) {
  const [hoveredCandidates, setHoveredCandidates] = useState<number | null>(null);

  const allCandidates = process.candidates || [];
  const winnerActionStr = process.winner?.split(' → ')[0] || '';
  const winnerTargetStr = process.winner?.split(' → ')[1] || '';
  const shortlist = process.shortlist;
  const lines = shortlist.split('\n');

  // 计算 top3 候选的概率
  const top3 = allCandidates.slice(0, 3);
  const totalWeight = top3.reduce((sum, c) => sum + Math.max(1, c.totalScore), 0);

  // 从 shortlist 中提取非候选行（意图状态、意图栈、最终选择等）
  const headerLines: string[] = [];
  const footerLines: string[] = [];
  let inCandidateSection = false;
  let inFooter = false;

  for (const line of lines) {
    if (line.startsWith('【可选行动】')) {
      inCandidateSection = true;
      headerLines.push(line);
      continue;
    }
    if (line.startsWith('【最终选择】') || line.startsWith('【意图栈】') || line.startsWith('【被硬约束拦截】')) {
      inCandidateSection = false;
      inFooter = true;
    }
    if (inFooter) {
      footerLines.push(line);
    } else if (!inCandidateSection) {
      headerLines.push(line);
    }
  }

  return (
    <div className="space-y-0.5 text-xs text-gray-500 whitespace-pre-wrap font-mono">
      {/* 头部：意图状态等 */}
      {headerLines.map((line, i) => {
        if (!line.trim()) return <div key={`h-${i}`} className="h-1" />;
        // 跳过【可选行动】行，由下面的 CandidateCard 部分处理
        if (line.startsWith('【可选行动】')) return null;
        return <div key={`h-${i}`}>{line}</div>;
      })}

      {/* 【可选行动】标题 + 更多候选按钮 */}
      <div className="text-gray-400 font-bold flex items-center gap-1">
        【可选行动】
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
                  const isWinner = c.action === winnerActionStr && c.target === winnerTargetStr;
                  const probability = totalWeight > 0 ? (Math.max(1, c.totalScore) / totalWeight) * 100 : 0;
                  return (
                    <CandidatePopupItem
                      key={ci}
                      candidate={c}
                      isWinner={isWinner}
                      players={players}
                      probability={probability}
                    />
                  );
                })}
              </div>
            )}
          </span>
        )}
      </div>
      {top3.map((candidate, i) => {
        const isSelected = candidate.action === winnerActionStr && candidate.target === winnerTargetStr;
        const probability = totalWeight > 0 ? (Math.max(1, candidate.totalScore) / totalWeight) * 100 : 0;
        return (
          <CandidateCard
            key={`c-${i}`}
            candidate={candidate}
            isWinner={isSelected}
            players={players}
            probability={probability}
          />
        );
      })}

      {/* 尾部：最终选择、意图栈等 */}
      {footerLines.map((line, i) => {
        if (!line.trim()) return <div key={`f-${i}`} className="h-1" />;
        if (line.startsWith('【最终选择】')) {
          return <div key={`f-${i}`} className="text-green-400 font-bold mt-1">{line}</div>;
        }
        if (line.startsWith('【意图栈】')) {
          return <div key={`f-${i}`} className="text-gray-400 font-bold mt-1">{line}</div>;
        }
        if (line.startsWith('【被硬约束拦截】')) {
          return <div key={`f-${i}`} className="text-red-400 font-bold mt-1">{line}</div>;
        }
        return <div key={`f-${i}`} className={line.startsWith('  [激活]') || line.startsWith('  [拦截]') ? 'text-cyan-400 pl-4' : ''}>{line}</div>;
      })}
    </div>
  );
}
