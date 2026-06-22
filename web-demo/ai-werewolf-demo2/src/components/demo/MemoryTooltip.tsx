import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PopOverlay } from '@/components/ui/PopOverlay';

interface MemoryTooltipProps {
  title: string;
  content: string;
  children: React.ReactNode;
  className?: string;
}

export function MemoryTooltip({ title, content, children, className }: MemoryTooltipProps) {
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
        width={400}
        hoverTrigger={false}
      >
        <div className="text-xs text-slate-300 space-y-1">
          {content === '无支撑记忆' ? (
            <div className="text-slate-500">无支撑记忆</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="bg-slate-800 rounded px-2 py-1 text-slate-300">{line}</div>
            ))
          )}
        </div>
      </PopOverlay>
    </>
  );
}
