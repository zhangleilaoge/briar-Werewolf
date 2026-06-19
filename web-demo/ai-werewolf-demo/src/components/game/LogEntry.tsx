import { ChevronRight, ChevronDown } from 'lucide-react';
import type { ActionLogDetail, DecisionProcess, GameLogItem, Player } from '@/types';
import { getLogColor, highlightNames } from '../ui-utils';
import { buildCheckExpr } from '@/lib/utils/expr';
import DecisionProcessView from './DecisionProcessView';

interface LogEntryProps {
  log: GameLogItem;
  idx: number;
  players: Player[];
  expanded: boolean;
  onToggle: (idx: number) => void;
}

export default function LogEntry({ log, idx, players, expanded, onToggle }: LogEntryProps) {
  const detail = log.details as ActionLogDetail | undefined;
  const hasExtra = !!(detail && ((detail.checks && detail.checks.length > 0) || (detail as Record<string, unknown>).process || detail.decisionReason));

  // 从 details 中提取需要高亮的玩家ID
  const _mentions = (detail as any)?.mentions as string[] | undefined;
  const _playerId = (detail as any)?.playerId as string | undefined;
  const mentionIds = _mentions ?? [
    detail?.actorId,
    detail?.targetId,
    _playerId,
  ].filter(Boolean) as string[];
  const playersToHighlight = players.filter(p => mentionIds.includes(p.id));

  return (
    <div className={`text-sm font-mono ${getLogColor(log.type, (log.details as ActionLogDetail)?.action)}`}>
      {log.type === 'thinking' ? (
        <div className="flex items-center gap-1">
          <span>
            {highlightNames(log.message, playersToHighlight).map((part, pi) =>
              part.isName ? (
                <span key={pi} className={`font-bold ${part.team === 'werewolf' ? 'text-red-200' : 'text-blue-200'}`}>
                  {part.text}
                </span>
              ) : (
                <span key={pi}>{part.text}</span>
              )
            )}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span>
              {highlightNames(log.message, playersToHighlight).map((part, pi) =>
                part.isName ? (
                  <span key={pi} className={`font-bold ${part.team === 'werewolf' ? 'text-red-200' : 'text-blue-200'}`}>
                    {part.text}
                  </span>
                ) : (
                  <span key={pi}>{part.text}</span>
                )
              )}
            </span>
            {hasExtra && (
              <button
                className="text-gray-500 hover:text-gray-300 shrink-0 select-none inline-flex items-center"
                onClick={() => onToggle(idx)}
                title={expanded ? '收起详情' : '展开详情'}
              >
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>
          {expanded && hasExtra && (
            <div className="mt-1 ml-2 text-xs text-gray-400 space-y-1 border-l-2 border-gray-700 pl-2">
              {/* 反应行动显示理由 */}
              {detail?.decisionReason && ['join_suspect', 'join_defend', 'rebut'].includes(detail.action) && (
                <div className="text-yellow-400">💡 {detail.decisionReason}</div>
              )}
              {!!(detail as Record<string, unknown>).process && (
                <DecisionProcessView
                  process={(detail as Record<string, unknown>).process as DecisionProcess}
                  players={players}
                  logIdx={idx}
                />
              )}
              {detail.checks?.map((check, ci) => (
                <div key={ci}>
                  <span className="text-gray-500">{check.type === 'check' ? '【直接检定】' : '【对抗检定】'}</span>
                  <span className="ml-1">
                    {check.actorName} {buildCheckExpr(
                      check.actorRoll, check.actorAttribute, check.actorBaseValue,
                      check.actorAlignmentMod ?? 0, check.actorStressMod ?? 0, check.actorTotal
                    )}
                    {check.type === 'check' ? (
                      ` vs 难度${check.difficulty} → ${check.successLevel}(${check.margin > 0 ? '+' : ''}${check.margin})`
                    ) : check.type === 'opposed' && check.targetName ? (
                      <span>
                        {' '}vs {check.targetName} {buildCheckExpr(
                          check.targetRoll ?? 0, check.targetAttribute ?? '', check.targetBaseValue ?? 0,
                          check.targetAlignmentMod ?? 0, check.targetStressMod ?? 0, check.targetTotal ?? 0
                        )} → {check.successLevel}({check.margin > 0 ? '+' : ''}{check.margin})
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
