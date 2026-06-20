import { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { usePopManager } from '@/hooks/usePopManager';

// 位置计算常量
const POP_OFFSET_Y = 4;
const DEFAULT_POP_WIDTH = 520;
const VIEWPORT_MARGIN = 16;
const MIN_POSITION = 8;
const POP_HEIGHT_ESTIMATE = 300;
const HOVER_DELAY_MS = 200;
const RANDOM_ID_RADIX = 36;

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
  onRegisterPop?: (id: string) => void;
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
  onRegisterPop,
}: PopOverlayProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const manager = usePopManager();
  const popId = useRef(`pop-${Math.random().toString(RANDOM_ID_RADIX).slice(2)}`);

  // 注册/注销
  const onRegisterPopRef = useRef(onRegisterPop);
  onRegisterPopRef.current = onRegisterPop;
  useEffect(() => {
    if (visible && popRef.current) {
      manager.registerPop(popId.current, popRef.current);
      onRegisterPopRef.current?.(popId.current);
      return () => manager.unregisterPop(popId.current);
    }
  }, [visible, manager]);

  // 点击 trigger 固定/取消固定
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const handleClick = () => manager.togglePin(popId.current);
    trigger.addEventListener('click', handleClick);
    return () => trigger.removeEventListener('click', handleClick);
  }, [triggerRef, manager]);

  // 计算位置
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // 默认在 trigger 下方
    let top = rect.bottom + POP_OFFSET_Y;
    let left = rect.left;

    // 边界检测：如果右侧超出视口，向左偏移
    const popWidth = typeof width === 'number' ? width : DEFAULT_POP_WIDTH;
    if (left + popWidth > window.innerWidth - VIEWPORT_MARGIN) {
      left = Math.max(MIN_POSITION, window.innerWidth - popWidth - MIN_POSITION);
    }

    // 边界检测：如果下方超出视口，向上翻转
    if (top + POP_HEIGHT_ESTIMATE > window.innerHeight - VIEWPORT_MARGIN) {
      top = Math.max(MIN_POSITION, rect.top - POP_HEIGHT_ESTIMATE);
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
      role="dialog"
      aria-modal="false"
      className={`fixed bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden ${className}`}
      style={{ top: position.top, left: position.left, zIndex, width }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 顶部提示栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 bg-gray-800/50 select-none">
        <span className="text-xs font-bold text-gray-300">{title}</span>
        <span className="text-[10px] text-gray-500">
          {pinned ? '已固定 (T 或点击取消)' : '按 T 或点击固定'}
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

export function FactorTooltip({ label, reason, breakdown, children }: FactorTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const popIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manager = usePopManager();

  // 动态绑定 trigger 事件，避免 JSX 上写事件属性导致 Biome 报错
  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;

    const show = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(true);
    };

    const hide = () => {
      const id = popIdRef.current;
      if (id && manager.isPinned(id)) return;
      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, HOVER_DELAY_MS);
    };

    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);

    return () => {
      el.removeEventListener('mouseenter', show);
      el.removeEventListener('mouseleave', hide);
    };
  }, [manager]);

  const handlePopEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(true);
  };

  const handlePopLeave = () => {
    const id = popIdRef.current;
    console.log('[FactorTooltip] popLeave check, popId=', id, 'pinned=', id ? manager.isPinned(id) : 'n/a');
    if (id && manager.isPinned(id)) return;
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, HOVER_DELAY_MS);
  };

  const handleRegisterPop = (id: string) => {
    console.log('[FactorTooltip] registerPop', id);
    popIdRef.current = id;
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="border-b border-dotted border-gray-500 cursor-help text-gray-300 hover:text-white"
      >
        {children}
      </span>
      <PopOverlay
        triggerRef={triggerRef}
        visible={visible}
        onClose={() => {}}
        onMouseEnter={handlePopEnter}
        onMouseLeave={handlePopLeave}
        onRegisterPop={handleRegisterPop}
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
