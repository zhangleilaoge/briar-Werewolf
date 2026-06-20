import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { usePopManager } from '@/hooks/usePopManager';

interface PopOverlayProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  title: string;
  zIndex?: number;
  children: React.ReactNode;
  className?: string;
  width?: number | string;
}

export function PopOverlay({
  triggerRef,
  visible,
  onClose,
  onMouseEnter,
  onMouseLeave,
  title,
  zIndex = 100,
  children,
  className = '',
  width,
}: PopOverlayProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const manager = usePopManager();
  const popId = useRef(`pop-${Math.random().toString(36).slice(2)}`);

  // 注册/注销
  useEffect(() => {
    if (visible && popRef.current) {
      manager.registerPop(popId.current, popRef.current);
      return () => manager.unregisterPop(popId.current);
    }
  }, [visible, manager]);

  // 计算位置
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // 默认在 trigger 下方
    let top = rect.bottom + 4;
    let left = rect.left;

    // 边界检测：如果右侧超出视口，向左偏移
    const popWidth = typeof width === 'number' ? width : 520;
    if (left + popWidth > window.innerWidth - 16) {
      left = Math.max(8, window.innerWidth - popWidth - 8);
    }

    // 边界检测：如果下方超出视口，向上翻转
    if (top + 300 > window.innerHeight - 16) {
      top = Math.max(8, rect.top - 300);
    }

    setPosition({ top, left });
  }, [visible, triggerRef, width]);

  // 鼠标移出时关闭（如果未 pinned）
  const handleMouseLeave = () => {
    if (manager.isPinned(popId.current)) return;
    if (onMouseLeave) {
      onMouseLeave();
    } else {
      onClose();
    }
  };

  const handleMouseEnter = () => {
    onMouseEnter?.();
  };

  if (!visible) return null;

  const pinned = manager.isPinned(popId.current);

  return (
    <div
      ref={popRef}
      className={`fixed bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden ${className}`}
      style={{ top: position.top, left: position.left, zIndex, width }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 顶部提示栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 bg-gray-800/50 select-none">
        <span className="text-xs font-bold text-gray-300">{title}</span>
        <span className="text-[10px] text-gray-500">
          {pinned ? '已固定 (T 取消)' : '按 T 固定'}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// ========== 因子二级 Pop（嵌套 Pop） ==========

interface FactorTooltipProps {
  label: string;
  value: number;
  reason: string;
  breakdown?: { label: string; value: number; reason: string }[];
  children: React.ReactNode;
}

export function FactorTooltip({ label, value, reason, breakdown, children }: FactorTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(true);
  };

  const hide = () => {
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, 200);
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="border-b border-dotted border-gray-500 cursor-help text-gray-300 hover:text-white"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      <PopOverlay
        triggerRef={triggerRef}
        visible={visible}
        onClose={() => {}}
        onMouseEnter={show}
        onMouseLeave={hide}
        title={label}
        zIndex={101}
        width={300}
        className="max-h-64 overflow-y-auto"
      >
        <div className="text-xs text-gray-300">
          <div className="mb-2 font-medium text-gray-200">{reason}</div>
          {breakdown && breakdown.length > 0 && (
            <div className="space-y-1">
              {breakdown.map((b, i) => (
                <div key={i} className="text-[10px] text-gray-400">
                  <div>
                    <span className="text-gray-300">{b.label}</span>{' '}
                    <span className="font-mono text-gray-200">
                      {typeof b.value === 'number' ? b.value.toFixed(2) : b.value}
                    </span>
                  </div>
                  <div className="text-gray-500 pl-2">→ {b.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopOverlay>
    </>
  );
}
