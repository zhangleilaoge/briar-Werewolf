import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PopOverlay } from '@/components/ui/PopOverlay';
import type { MemoryImpact } from '@/types/trace';
import { formatNumber, formatSignedNumber } from './game-runner-utils';

interface MemoryTooltipProps {
  title: string;
  content: string;
  basis?: string[]; // memoryIds 数组，与 content 的行一一对应
  impacts?: MemoryImpact[];
  children: React.ReactNode;
  className?: string;
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

  // 如果弹窗内容为空（无支撑记忆），不展示弹窗，只返回纯文本
  if (content === '无支撑记忆') {
    return <>{children}</>;
  }

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
          {lines.map((line, i) => {
            const memId = basis?.[i];
            const lineImpacts = memId ? impactsByMemoryId.get(memId) ?? [] : [];
            const visibleImpacts = lineImpacts.filter((imp) => Math.abs(imp.deltaScore) >= 0.005);
            if (visibleImpacts.length === 0) return null;
            return visibleImpacts.map((imp, j) => (
              <div key={`${i}-${j}`} className="bg-slate-800 rounded px-2 py-1 text-slate-300 font-mono text-[11px] flex items-center gap-1">
                <span className="text-slate-400">{formatNumber(imp.beforeScore, 2)}</span>
                <span className={imp.deltaScore > 0 ? 'text-green-400' : imp.deltaScore < 0 ? 'text-red-400' : 'text-slate-400'}>
                  {formatSignedNumber(imp.deltaScore, 2)}
                </span>
                <span className="text-slate-500 truncate">({line})</span>
                <span className="text-slate-400">=</span>
                <span className="text-slate-200">{formatNumber(imp.afterScore, 2)}</span>
              </div>
            ));
          }).flat().filter(Boolean)}
        </div>
      </PopOverlay>
    </>
  );
}
