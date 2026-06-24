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

const IMPACT_TYPE_LABEL: Record<string, string> = {
  direct: '对我',
  indirect: '旁观',
  cascade: '连锁',
};

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
            <>
              {lines.map((line, i) => (
                <div key={i} className="bg-slate-800 rounded px-2 py-1 text-slate-300">{line}</div>
              ))}
              {/* 影响明细：子 pop 风格紧凑 badge */}
              {impacts && impacts.length > 0 && (
                <div className="mt-1 pt-1 border-t border-slate-700">
                  <div className="flex flex-wrap gap-1">
                    {impacts.slice(0, 8).map((impact, i) => {
                      const color = impact.deltaScore > 0 ? 'text-green-400' : impact.deltaScore < 0 ? 'text-red-400' : 'text-slate-400';
                      const typeLabel = IMPACT_TYPE_LABEL[impact.impactType] || impact.impactType;
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-slate-700/50"
                          title={impact.description}
                        >
                          <span className="text-slate-400">{typeLabel}</span>
                          <span className={`font-mono font-bold ${color}`}>
                            {impact.deltaScore > 0 ? '+' : ''}{impact.deltaScore.toFixed(1)}
                          </span>
                        </span>
                      );
                    })}
                    {impacts.length > 8 && (
                      <span className="text-[10px] text-slate-500 self-center">+{impacts.length - 8}</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </PopOverlay>
    </>
  );
}
