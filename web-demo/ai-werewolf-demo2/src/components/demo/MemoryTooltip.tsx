import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PopOverlay } from '@/components/ui/PopOverlay';
import type { MemoryImpact } from '@/types/trace';

interface MemoryTooltipProps {
  title: string;
  content: string;
  impacts?: MemoryImpact[];
  children: React.ReactNode;
  className?: string;
}

export function MemoryTooltip({ title, content, impacts, children, className }: MemoryTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const pinnedRef = useRef(false);

  const show = useCallback(() => {
    if (pinnedRef.current) return;
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    if (pinnedRef.current) return;
    setVisible(false);
  }, []);

  const togglePin = useCallback(() => {
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

  const lines = content === '无支撑记忆' ? [] : content.split(' | ');

  return (
    <>
      <div ref={triggerRef} className={`cursor-help ${className || ''}`}>
        {children}
      </div>
      <PopOverlay
        triggerRef={triggerRef}
        visible={visible}
        onClose={() => { setVisible(false); pinnedRef.current = false; }}
        onMouseEnter={show}
        onMouseLeave={hide}
        title={title}
        zIndex={101}
        width={340}
        hoverTrigger={false}
      >
        <div className="text-xs text-slate-300 space-y-1 max-h-[60vh] overflow-y-auto">
          {content === '无支撑记忆' ? (
            <div className="text-slate-500">无支撑记忆</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="bg-slate-800 rounded px-2 py-1 text-slate-300">{line}</div>
            ))
          )}

          {/* 影响明细 */}
          {impacts && impacts.length > 0 && (
            <div className="space-y-1 mt-2 pt-2 border-t border-slate-700">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                影响明细 ({impacts.length} 条)
              </div>
              {impacts.slice(0, 10).map((impact, i) => {
                const color = impact.deltaScore > 0 ? 'text-green-400' : impact.deltaScore < 0 ? 'text-red-400' : 'text-slate-400';
                const badgeColor = impact.impactType === 'direct' ? 'bg-green-900/50 text-green-300' : impact.impactType === 'indirect' ? 'bg-amber-900/50 text-amber-300' : 'bg-purple-900/50 text-purple-300';
                return (
                  <div key={i} className="bg-slate-800/50 rounded px-2 py-1 text-[11px]">
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
              })}
              {impacts.length > 10 && (
                <div className="text-[10px] text-slate-500 text-center">... 还有 {impacts.length - 10} 条影响</div>
              )}
            </div>
          )}
        </div>
      </PopOverlay>
    </>
  );
}
