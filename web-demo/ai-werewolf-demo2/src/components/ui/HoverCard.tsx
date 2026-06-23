import React, { useRef, useState, useCallback, useEffect } from 'react';
import { PopOverlay } from './PopOverlay';
import type { InferenceTrace, IntentionTrace, MemoryImpact } from '@/types/trace';

interface HoverCardProps {
  title: string;
  subtitle?: string;
  trace?: InferenceTrace;
  intentionTraces?: IntentionTrace[];
  children: React.ReactNode;
  className?: string;
  width?: number;
}

export function HoverCard({ title, subtitle, trace, intentionTraces, children, className, width = 420 }: HoverCardProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const pinnedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (pinnedRef.current) return;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    if (pinnedRef.current) return;
    timerRef.current = setTimeout(() => setVisible(false), 200);
  }, []);

  const togglePin = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pinnedRef.current = !pinnedRef.current;
    if (pinnedRef.current) setVisible(true);
  }, []);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click', togglePin);
    return () => {
      el.removeEventListener('mouseenter', show);
      el.removeEventListener('mouseleave', hide);
      el.removeEventListener('click', togglePin);
    };
  }, [show, hide, togglePin]);

  return (
    <>
      <div ref={triggerRef} className={`cursor-help ${className || ''}`}>
        {children}
      </div>
      <PopOverlay
        triggerRef={triggerRef as React.RefObject<HTMLElement | null>}
        visible={visible}
        onClose={() => { setVisible(false); pinnedRef.current = false; }}
        onMouseEnter={show}
        onMouseLeave={hide}
        title={title}
        zIndex={102}
        width={width}
        hoverTrigger={false}
      >
        <div className="text-xs text-slate-300 space-y-2 max-h-[60vh] overflow-y-auto">
          {subtitle && (
            <div className="text-sm font-bold text-amber-400 mb-2">{subtitle}</div>
          )}
          
          {/* 计算步骤 */}
          {trace && trace.calculationSteps.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">计算步骤</div>
              {trace.calculationSteps.map((step, i) => (
                <div key={i} className="bg-slate-800/50 rounded px-2 py-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{step.step}</span>
                    <span className="font-mono text-amber-300">{typeof step.result === 'number' ? step.result.toFixed(3) : step.result}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{step.formula}</div>
                </div>
              ))}
            </div>
          )}

          {/* 意图轨迹 */}
          {intentionTraces && intentionTraces.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">得分计算</div>
              {intentionTraces.map((t, i) => (
                <div key={i} className="bg-slate-800/50 rounded px-2 py-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t.factor}</span>
                    <span className="font-mono text-amber-300">
                      {t.baseValue.toFixed(2)} → {t.result.toFixed(2)}
                      {t.delta !== 0 && <span className={t.delta > 0 ? 'text-green-400' : 'text-red-400'}> ({t.delta > 0 ? '+' : ''}{t.delta.toFixed(2)})</span>}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {t.basis.length > 0 ? `${t.basis.length} 条记忆支撑` : '无记忆支撑'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 记忆影响明细 */}
          {trace && trace.impacts.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mt-2">
                记忆影响明细 ({trace.impacts.length} 条)
              </div>
              {trace.impacts.slice(0, 10).map((impact, i) => (
                <ImpactRow key={i} impact={impact} />
              ))}
              {trace.impacts.length > 10 && (
                <div className="text-[10px] text-slate-500 text-center">... 还有 {trace.impacts.length - 10} 条影响</div>
              )}
            </div>
          )}
        </div>
      </PopOverlay>
    </>
  );
}

function ImpactRow({ impact }: { impact: MemoryImpact }) {
  const color = impact.deltaScore > 0 ? 'text-green-400' : impact.deltaScore < 0 ? 'text-red-400' : 'text-slate-400';
  const badgeColor = impact.impactType === 'direct' ? 'bg-green-900/50 text-green-300' : impact.impactType === 'indirect' ? 'bg-amber-900/50 text-amber-300' : 'bg-purple-900/50 text-purple-300';
  
  return (
    <div className="bg-slate-800 rounded px-2 py-1 text-[11px]">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className={`px-1 py-0.5 rounded text-[9px] ${badgeColor}`}>{impact.impactType}</span>
            <span className="text-slate-300 truncate">{impact.description}</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {impact.memoryId && <span className="font-mono text-slate-600 mr-1">{impact.memoryId.slice(0, 12)}</span>}
            {impact.actorId} → {impact.targetId || 'self'}
          </div>
        </div>
        <div className={`font-mono font-bold ${color} ml-2 shrink-0`}>
          {impact.deltaScore > 0 ? '+' : ''}{impact.deltaScore.toFixed(3)}
        </div>
      </div>
    </div>
  );
}
