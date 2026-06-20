import { useState, useRef } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { DecisionProcess } from '@/types';
import { ROLE_INFO } from '@/types';
import type { Player } from '@/types';
import { ACTION_NAMES } from '@/lib/constants/display-names';
import { MIND_MULTIPLIER_BASE, MIND_MULTIPLIER_SCALE, MIND_MULTIPLIER_SOCIAL_BASE, MIND_MULTIPLIER_SOCIAL_SCALE } from '@/lib/constants/mind';
import { TOP_CANDIDATES_COUNT, PERCENT_MULTIPLIER } from '@/lib/constants/ui-thresholds';
import { PopOverlay, FactorTooltip } from '@/components/ui/PopOverlay';

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

// ==================== 可复用组件 ====================

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
  const _baseSource = (() => {
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
      <span>{score}(基础分)</span>
      {intentionDrivenBonus ? (
        <span> + {intentionDrivenBonus}({intentionLabel})</span>
      ) : null}
      {stageWeight ? (
        <span> + {stageWeight}({stageLabel})</span>
      ) : null}
      {modifiers.alignment ? (
        <span> + {modifiers.alignment}(阵营修正)</span>
      ) : null}
      {modifiers.stress ? (
        <span> + {modifiers.stress}(压力修正)</span>
      ) : null}
      {modifiers.relation ? (
        <span> + {modifiers.relation}(关系修正)</span>
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

/** 心智因子公式行 — 每个因子 hover 弹出二级 Pop */
function MindFactorFormula({ mindData }: { mindData?: Record<string, unknown> }) {
  if (!mindData) return null;

  const factorDefs = [
    { key: 'valueAlignment', detailKey: 'valueAlignmentDetail', label: '价值观', transform: (v: number) => (MIND_MULTIPLIER_BASE + MIND_MULTIPLIER_SCALE * v).toFixed(2) },
    { key: 'timingScore', detailKey: 'timingDetail', label: '时机', transform: (v: number) => (MIND_MULTIPLIER_BASE + MIND_MULTIPLIER_SCALE * v).toFixed(2) },
    { key: 'simulationScore', detailKey: 'simulationDetail', label: '模拟', transform: (v: number) => (MIND_MULTIPLIER_BASE + MIND_MULTIPLIER_SCALE * v).toFixed(2) },
    { key: 'crisisFactor', detailKey: 'crisisDetail', label: '危机', transform: (v: number) => v.toFixed(2) },
    { key: 'relationFactor', detailKey: 'relationDetail', label: '关系', transform: (v: number) => v.toFixed(2) },
    { key: 'socialContextBonus', detailKey: 'socialContextDetail', label: '社交情境', transform: (v: number) => (MIND_MULTIPLIER_SOCIAL_BASE + MIND_MULTIPLIER_SOCIAL_SCALE * v).toFixed(2) },
    { key: 'capabilityFactor', detailKey: 'capabilityDetail', label: '能力', transform: (v: number) => v.toFixed(2) },
  ];

  const multiplier = mindData.mindMultiplier as number | undefined;

  const parts = factorDefs.map(({ key, detailKey, label, transform }) => {
    const raw = mindData[key] as number | undefined;
    if (raw === undefined) return null;
    const detail = mindData[detailKey] as { score: number; reason: string; breakdown?: { label: string; value: number; reason: string }[] } | undefined;
    const display = transform(raw);

    if (detail) {
      return (
        <span key={key}>
          <FactorTooltip
            label={label}
            value={detail.score}
            reason={detail.reason}
            breakdown={detail.breakdown}
          >
            {display}({label})
          </FactorTooltip>
        </span>
      );
    }
    return <span key={key}>{display}({label})</span>;
  }).filter(Boolean);

  return (
    <div className="text-[10px] text-gray-500">
      <span className="text-gray-400">心智因子：</span>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && ' × '}
          {part}
        </span>
      ))}
      {multiplier !== undefined && (
        <span className="text-gray-400">= {multiplier.toFixed(2)}</span>
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

      {/* 心智因子公式（每个因子可 hover 看详情） */}
      {hasMindData && <MindFactorFormula mindData={candidate.mindData} />}

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
  const triggerRef = useRef<HTMLButtonElement>(null);

  const allCandidates = process.candidates || [];
  const winnerActionStr = process.winner?.action || '';
  const winnerTargetStr = process.winner?.target ?? '';
  const shortlist = process.shortlist;
  const lines = shortlist.split('\n');

  // 计算 top3 候选的概率
  const top3 = allCandidates.slice(0, TOP_CANDIDATES_COUNT);
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
        {allCandidates.length > TOP_CANDIDATES_COUNT && (
          <span
            ref={triggerRef}
            className="relative inline-block p-0 border-0 bg-transparent"
            onMouseEnter={() => setHoveredCandidates(logIdx)}
          >
            <MoreHorizontal size={12} className="text-gray-500 hover:text-gray-300 cursor-pointer" />
            <PopOverlay
              triggerRef={triggerRef}
              visible={hoveredCandidates === logIdx}
              onClose={() => setHoveredCandidates(null)}
              onMouseLeave={() => setHoveredCandidates(null)}
              title="所有候选行动（按分数排序）"
              zIndex={100}
              width={520}
            >
              {allCandidates.map((c, ci) => {
                const isWinner = c.action === winnerActionStr && (
                  (c.target === null && winnerTargetStr === '') || (c.target !== null && c.target === winnerTargetStr)
                );
                const probability = totalWeight > 0 ? (Math.max(1, c.totalScore) / totalWeight) * PERCENT_MULTIPLIER : 0;
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
            </PopOverlay>
          </span>
        )}
      </div>
      {top3.map((candidate, i) => {
        const isSelected = candidate.action === winnerActionStr && (
          (candidate.target === null && winnerTargetStr === '') || (candidate.target !== null && candidate.target === winnerTargetStr)
        );
        const probability = totalWeight > 0 ? (Math.max(1, candidate.totalScore) / totalWeight) * PERCENT_MULTIPLIER : 0;
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
