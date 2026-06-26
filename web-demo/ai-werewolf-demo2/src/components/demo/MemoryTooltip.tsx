import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { FormulaDisplay } from '@/components/ui/FormulaDisplay';
import { PopOverlay } from '@/components/ui/PopOverlay';
import type { MemoryImpact } from '@/types/trace';

interface MemoryTooltipProps {
  title: string;
  content: string;
  basis?: string[]; // memoryIds 数组，与 content 的行一一对应
  impacts?: MemoryImpact[];
  children: React.ReactNode;
  className?: string;
}

/** 子 pop — 显示一条影响的公式明细 */
function ImpactDetail({ impact, children }: { impact: MemoryImpact; children: React.ReactNode }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedRef = useRef(false);

  const show = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!pinnedRef.current) setVisible(true);
  }, []);

  const hide = useCallback(() => {
    if (pinnedRef.current) return;
    timerRef.current = setTimeout(() => {
      if (!pinnedRef.current) setVisible(false);
    }, 200);
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

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const color = impact.deltaScore > 0 ? 'text-green-400' : impact.deltaScore < 0 ? 'text-red-400' : 'text-slate-400';

  return (
    <>
      <span
        ref={triggerRef}
        className="cursor-help"
      >
        {children}
      </span>
      <PopOverlay
        triggerRef={triggerRef}
        visible={visible}
        onClose={() => { setVisible(false); pinnedRef.current = false; }}
        onMouseEnter={show}
        onMouseLeave={hide}
        title="公式明细"
        zIndex={102}
        width={340}
        hoverTrigger={false}
      >
        <div className="text-xs text-slate-300 space-y-2">
          {/* 原始事件描述 */}
          <div className="text-slate-400">{impact.description}</div>
          {/* 公式 */}
          {impact.formula && (
            <div className="bg-slate-800 rounded px-2 py-1.5">
              <FormulaDisplay formula={impact.formula} />
            </div>
          )}
          {/* 变化前后 */}
          <div className="flex justify-between text-slate-500">
            <span>变化前: {impact.beforeScore.toFixed(2)}</span>
            <span className={color}>
              {impact.deltaScore > 0 ? '+' : ''}{impact.deltaScore.toFixed(2)}
            </span>
            <span>变化后: {impact.afterScore.toFixed(2)}</span>
          </div>
        </div>
      </PopOverlay>
    </>
  );
}

export function MemoryTooltip({ title, content, basis, impacts, children, className }: MemoryTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const pinnedRef = useRef(false);

  const show = useCallback(() => { if (!pinnedRef.current) setVisible(true); }, []);
  const hide = useCallback(() => { if (!pinnedRef.current) setVisible(false); }, []);
  const toggle = useCallback(() => { pinnedRef.current = !pinnedRef.current; if (pinnedRef.current) setVisible(true); }, []);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('click', toggle);
    return () => {
      el.removeEventListener('mouseenter', show);
      el.removeEventListener('mouseleave', hide);
      el.removeEventListener('click', toggle);
    };
  }, [show, hide, toggle]);

  const lines = content === '无支撑记忆' ? [] : content.split(' | ');

  // 按 memoryId 分组 impacts
  const impactsByMemoryId = useMemo(() => {
    if (!impacts) return new Map<string, MemoryImpact[]>();
    const map = new Map<string, MemoryImpact[]>();
    for (const imp of impacts) {
      if (!imp.memoryId) continue;
      if (!map.has(imp.memoryId)) map.set(imp.memoryId, []);
      map.get(imp.memoryId)!.push(imp);
    }
    return map;
  }, [impacts]);

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
            lines.map((line, i) => {
              const memId = basis?.[i];
              const lineImpacts = memId ? impactsByMemoryId.get(memId) ?? [] : [];
              return (
                <div key={i} className="bg-slate-800 rounded px-2 py-1 text-slate-300">
                  <div className="flex justify-between items-center">
                    <span>{line}</span>
                    {/* 数值在右侧，hover 触发二级 pop */}
                    {lineImpacts.length > 0 && (
                      <div className="flex gap-1 ml-2">
                        {lineImpacts.filter((imp) => Math.abs(imp.deltaScore) >= 0.005).slice(0, 4).map((imp, j) => {
                          const isWolf = imp.description.includes('狼人');
                          const isProphet = imp.description.includes('预言家');
                          const isVillager = imp.description.includes('村民');
                          const icon = isWolf ? '🐺' : isProphet ? '🔮' : isVillager ? '👤' : '';
                          return (
                            <ImpactDetail key={j} impact={imp}>
                              <span className={`font-mono text-[10px] ${imp.deltaScore > 0 ? 'text-green-400' : imp.deltaScore < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                {icon}{imp.deltaScore > 0 ? '+' : ''}{imp.deltaScore.toFixed(2)}
                              </span>
                            </ImpactDetail>
                          );
                        })}
                        {lineImpacts.filter((imp) => Math.abs(imp.deltaScore) >= 0.005).length > 4 && <span className="text-[10px] text-slate-500">+{lineImpacts.filter((imp) => Math.abs(imp.deltaScore) >= 0.005).length - 4}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopOverlay>
    </>
  );
}
