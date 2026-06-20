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

/** 心智因子标签 */
const MIND_FACTOR_LABELS: Record<string, string> = {
  valueAlignment: '价值观',
  timingScore: '时机',
  simulationScore: '模拟',
  crisisFactor: '危机',
  relationFactor: '关系',
  socialContextBonus: '社交情境',
  capabilityFactor: '能力',
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

/** 分数公式组件 — 从结构化数据渲染，优先展示心智乘法因子 */
function ScoreLine({ candidate }: { candidate: DecisionProcess['candidates'][0] }) {
  const { score, intentionDrivenBonus, stageWeight, stage, modifiers, totalScore, mindData } = candidate;

  // 基础分来源
  const baseSource = (() => {
    if (candidate.rule?.includes('intention') || candidate.strategy?.includes('Intention')) return '意图分数';
    if (candidate.strategy?.includes('Plugin') || candidate.strategy?.includes('fake') || candidate.rule?.includes('fake')) return '插件分数';
    return '策略分数';
  })();

  // 意图匹配标签
  const intentionLabel = candidate.rule?.includes('top') ? '主意图' : '次意图';

  // 阶段标签
  const stageLabel = STAGE_LABELS[stage || ''] || stage || '';

  // 如果存在 mind enrich 数据，展示乘法公式
  const mindMultiplier = mindData?.mindMultiplier as number | undefined;
  const baseScore = mindData?.baseScore as number | undefined;
  if (mindMultiplier !== undefined && baseScore !== undefined) {
    return (
      <span className="text-gray-300">
        <span className="text-white font-bold">总分：{totalScore} = </span>
        {Math.round(baseScore)}(基础分) × {mindMultiplier.toFixed(2)}(心智因子)
      </span>
    );
  }

  // 旧展示逻辑（兼容回退）
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
        {candidate.target ? ` → ` : ''}<PlayerName id={candidate.target} players={players} />
      </div>
      <div className="text-cyan-400">[{candidate.strategy}.{candidate.rule}]</div>
      <ScoreLine candidate={candidate} />
      {probability !== undefined && (
        <span className="text-gray-400"> (概率 {probability.toFixed(1)}%)</span>
      )}
    </div>
  );
}

/** 弹窗中的心智因子详细展开 */
function MindFactorDetails({ mindData }: { mindData?: Record<string, unknown> }) {
  if (!mindData) return null;

  const factors = [
    { key: 'valueAlignment', label: '价值观', transform: (v: number) => (0.5 + 0.5 * v).toFixed(2) },
    { key: 'timingScore', label: '时机', transform: (v: number) => (0.5 + 0.5 * v).toFixed(2) },
    { key: 'simulationScore', label: '模拟', transform: (v: number) => (0.5 + 0.5 * v).toFixed(2) },
    { key: 'crisisFactor', label: '危机', transform: (v: number) => v.toFixed(2) },
    { key: 'relationFactor', label: '关系', transform: (v: number) => v.toFixed(2) },
    { key: 'socialContextBonus', label: '社交情境', transform: (v: number) => (0.8 + 0.2 * v).toFixed(2) },
    { key: 'capabilityFactor', label: '能力', transform: (v: number) => v.toFixed(2) },
  ];

  const parts = factors
    .map(({ key, label, transform }) => {
      const raw = mindData[key] as number | undefined;
      if (raw === undefined) return null;
      return `${transform(raw)}(${label})`;
    })
    .filter(Boolean);

  if (parts.length === 0) return null;

  const multiplier = mindData.mindMultiplier as number | undefined;

  return (
    <div className="text-[10px] text-gray-500 mt-0.5">
      <span className="text-gray-400">心智因子：</span>
      {parts.join(' × ')}
      {multiplier !== undefined && (
        <span className="text-gray-400"> = {multiplier.toFixed(2)}</span>
      )}
    </div>
  );
}

/** 弹窗中的基础分详细展开 */
function BaseScoreDetails({ candidate }: { candidate: DecisionProcess['candidates'][0] }) {
  const { score, intentionDrivenBonus, stageWeight, modifiers } = candidate;
  const parts: string[] = [];

  if (score) parts.push(`${score}(策略)`);
  if (intentionDrivenBonus) {
    const label = candidate.rule?.includes('top') ? '主意图' : '次意图';
    parts.push(`${intentionDrivenBonus}(${label})`);
  }
  if (stageWeight) {
    const stageLabel = STAGE_LABELS[candidate.stage || ''] || candidate.stage || '阶段';
    parts.push(`${stageWeight}(${stageLabel})`);
  }
  if (modifiers.alignment) parts.push(`${modifiers.alignment}(阵营)`);
  if (modifiers.stress) parts.push(`${modifiers.stress}(压力)`);
  if (modifiers.relation) parts.push(`${modifiers.relation}(关系)`);

  if (parts.length === 0) return null;

  const total = (score || 0) + (intentionDrivenBonus || 0) + (stageWeight || 0) + (modifiers?.total || 0);

  return (
    <div className="text-[10px] text-gray-500">
      <span className="text-gray-400">基础分：</span>
      {parts.join(' + ')} = {total}
    </div>
  );
}

/** 弹窗中的候选列表（详细版） */
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
  const hasMindData = candidate.mindData && candidate.mindData.mindMultiplier !== undefined;

  return (
    <div className={`text-xs mb-2 ${isWinner ? 'text-green-400' : isNegative ? 'text-red-400 opacity-60' : 'text-gray-400'}`}>
      <div className="flex items-center gap-2">
        <span>{isWinner ? '✓' : '○'}</span>
        <span className="font-medium">
          {actionName}{roleLabel ? `(${roleLabel})` : ''}
          {candidate.target ? `→${players.find(p => p.id === candidate.target)?.name || candidate.target}` : ''}
        </span>
        <span className={`ml-auto ${isNegative ? 'text-red-400' : 'text-yellow-400'}`}>{candidate.totalScore}</span>
      </div>

      {/* 基础分详细 */}
      <BaseScoreDetails candidate={candidate} />

      {/* 心智因子详细 */}
      {hasMindData && <MindFactorDetails mindData={candidate.mindData} />}

      {/* 汇总公式 */}
      <div className="text-[10px] text-gray-500">
        {(() => {
          const mindMultiplier = candidate.mindData?.mindMultiplier as number | undefined;
          const baseScore = candidate.mindData?.baseScore as number | undefined;
          if (mindMultiplier !== undefined && baseScore !== undefined) {
            return (
              <span className="text-gray-400">
                {Math.round(baseScore)} × {mindMultiplier.toFixed(2)} = {Math.round(candidate.totalScore)}
              </span>
            );
          }
          // 旧展示逻辑（兼容回退）
          const stageLabel = STAGE_LABELS[candidate.stage || ''] || candidate.stage || '';
          return (
            <span>
              {candidate.score}(基础分)
              {candidate.intentionDrivenBonus ? ` +${candidate.intentionDrivenBonus}(${candidate.rule?.includes('top') ? '主意图' : '次意图'})` : ''}
              {candidate.stageWeight ? ` +${candidate.stageWeight}(${stageLabel})` : ''}
              {candidate.modifiers?.alignment ? ` +${candidate.modifiers.alignment}(阵营修正)` : ''}
              {candidate.modifiers?.stress ? ` +${candidate.modifiers.stress}(压力修正)` : ''}
              {candidate.modifiers?.relation ? ` +${candidate.modifiers.relation}(关系修正)` : ''}
            </span>
          );
        })()}
        {probability !== undefined && (
          <span className="text-gray-600 ml-2">(概率 {probability.toFixed(1)}%)</span>
        )}
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

export default function DecisionProcessView({ process, players, logIdx }: DecisionProcessViewProps) {
  const [hoveredCandidates, setHoveredCandidates] = useState<number | null>(null);

  const allCandidates = process.candidates || [];
  const winnerActionStr = process.winner?.action || '';
  const winnerTargetStr = process.winner?.target ?? '';
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
              <div className="absolute left-0 top-5 z-50 bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-lg whitespace-nowrap min-w-[520px]">
                <div className="text-xs font-bold text-gray-300 mb-3">所有候选行动（按分数排序）</div>
                {allCandidates.map((c, ci) => {
                  const isWinner = c.action === winnerActionStr && (
                    (c.target === null && winnerTargetStr === '') || (c.target !== null && c.target === winnerTargetStr)
                  );
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
        const isSelected = candidate.action === winnerActionStr && (
          (candidate.target === null && winnerTargetStr === '') || (candidate.target !== null && candidate.target === winnerTargetStr)
        );
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
