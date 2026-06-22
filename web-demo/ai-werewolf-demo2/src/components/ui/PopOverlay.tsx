import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// 位置计算常量
const POP_OFFSET_Y = 4;
const DEFAULT_POP_WIDTH = 520;
const VIEWPORT_MARGIN = 16;
const MIN_POSITION = 8;
const POP_HEIGHT_ESTIMATE = 300;
const HOVER_DELAY_MS = 200;
const DEFAULT_OVERLAY_WIDTH = 900;

// 全局可见 pop 注册表（用于 clickOutside 排除其他 pop 的 trigger/body）
const activePopTriggers = new Set<HTMLElement>();
const activePopBodies = new Set<HTMLElement>();

interface PopOverlayProps {
  triggerRef?: React.RefObject<HTMLElement | null>;
  visible?: boolean;
  onClose?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  title: string;
  zIndex?: number;
  children: React.ReactNode;
  className?: string;
  width?: number | string;
  hoverTrigger?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  overlay?: boolean;
}

export function PopOverlay({
  triggerRef,
  visible: externalVisible,
  onClose,
  onMouseEnter,
  onMouseLeave,
  title,
  zIndex = 100,
  children,
  className = '',
  width,
  hoverTrigger = true,
  onVisibleChange,
  overlay = false,
}: PopOverlayProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [internalVisible, setInternalVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const visible =
    externalVisible !== undefined ? externalVisible : internalVisible;

  // 同步 pinned ref
  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  const show = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (externalVisible === undefined) {
      setInternalVisible(true);
    }
    onVisibleChange?.(true);
  }, [externalVisible, onVisibleChange]);

  const hide = useCallback(() => {
    if (pinnedRef.current) return;
    timerRef.current = setTimeout(() => {
      if (externalVisible === undefined) {
        setInternalVisible(false);
      } else {
        onClose?.();
      }
      onVisibleChange?.(false);
    }, HOVER_DELAY_MS);
  }, [externalVisible, onClose, onVisibleChange]);

  const close = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (externalVisible === undefined) {
      setInternalVisible(false);
    }
    setPinned(false);
    onVisibleChange?.(false);
    onClose?.();
  }, [externalVisible, onClose, onVisibleChange]);

  const togglePin = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPinned((prev) => {
      const next = !prev;
      pinnedRef.current = next; // 同步更新 ref，确保 handleMouseLeave 立即读到新值
      if (next) {
        if (externalVisible === undefined) {
          setInternalVisible(true);
        }
        onVisibleChange?.(true);
      }
      return next;
    });
  }, [externalVisible, onVisibleChange]);

  // 计算位置（非 overlay 模式）
  useLayoutEffect(() => {
    if (overlay || !visible || !triggerRef?.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popEl = popRef.current;
    const popHeight = popEl?.offsetHeight || POP_HEIGHT_ESTIMATE;

    let top = rect.bottom + POP_OFFSET_Y;
    let left = rect.left;

    const popWidth = typeof width === 'number' ? width : DEFAULT_POP_WIDTH;
    if (left + popWidth > window.innerWidth - VIEWPORT_MARGIN) {
      left = Math.max(
        MIN_POSITION,
        window.innerWidth - popWidth - MIN_POSITION,
      );
    }

    if (top + popHeight > window.innerHeight - VIEWPORT_MARGIN) {
      top = Math.max(MIN_POSITION, rect.top - popHeight - POP_OFFSET_Y);
    }

    setPosition({ top, left });
  }, [overlay, visible, triggerRef, width]);

  // 注册 trigger 到全局 Set（组件挂载时注册，卸载时注销）
  useEffect(() => {
    const trigger = triggerRef?.current;
    if (trigger) {
      activePopTriggers.add(trigger);
    }
    return () => {
      if (trigger) {
        activePopTriggers.delete(trigger);
      }
    };
  }, [triggerRef]);

  // 注册 pop body 到全局 Set（visible 时注册，不可见时注销）
  useEffect(() => {
    const body = popRef.current;
    if (visible && body) {
      activePopBodies.add(body);
    }
    return () => {
      if (body) {
        activePopBodies.delete(body);
      }
    };
  }, [visible]);

  // 点击 trigger 固定/取消固定
  useEffect(() => {
    if (overlay) return;
    const trigger = triggerRef?.current;
    if (!trigger) return;
    const handleClick = (e: MouseEvent) => {
      // 如果点击的是当前 pop body 内的元素（子 pop 的 trigger 等），不执行 togglePin
      if (popRef.current?.contains(e.target as HTMLElement)) {
        return;
      }
      togglePin();
    };
    trigger.addEventListener('click', handleClick);
    return () => trigger.removeEventListener('click', handleClick);
  }, [overlay, triggerRef, togglePin]);

  // Hover trigger 事件
  useEffect(() => {
    if (overlay || !hoverTrigger) return;
    const el = triggerRef?.current;
    if (!el) return;

    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);

    return () => {
      el.removeEventListener('mouseenter', show);
      el.removeEventListener('mouseleave', hide);
    };
  }, [overlay, hoverTrigger, triggerRef, show, hide]);

  // document click：clickOutside 关闭
  useEffect(() => {
    if (!visible) return;

    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 点击自己的 pop body 内 → 不关闭
      if (popRef.current?.contains(target)) return;
      // 点击自己的 trigger 上 → 不关闭（togglePin 在 click 事件处理）
      if (triggerRef?.current?.contains(target)) return;
      // 点击其他 pop 的 trigger → 子 pop 不关闭，同级 pop 关闭
      for (const el of activePopTriggers) {
        if (el !== triggerRef?.current && el.contains(target)) {
          if (popRef.current?.contains(el)) return; // 子 pop 的 trigger
          break; // 同级 pop 的 trigger，关闭当前 pop
        }
      }
      // 点击其他 pop 的 body → 子 pop 不关闭，同级 pop 关闭
      for (const el of activePopBodies) {
        if (el !== popRef.current && el.contains(target)) {
          if (popRef.current?.contains(el)) return; // 子 pop 的 body
          break; // 同级 pop 的 body，关闭当前 pop
        }
      }
      // 真正的外部点击 → 关闭
      close();
    };

    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [visible, close, triggerRef]);

  // 清理 timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!pinnedRef.current) return;
    setDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.left,
      y: e.clientY - position.top,
    };
  }, [position]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    setPosition({
      left: e.clientX - dragOffsetRef.current.x,
      top: e.clientY - dragOffsetRef.current.y,
    });
  }, [dragging]);

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, []);

  // Attach drag listeners
  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [dragging, handleDragMove, handleDragEnd]);

  const handleMouseEnter = () => {
    if (!overlay && hoverTrigger) show();
    onMouseEnter?.();
  };

  const handleMouseLeave = () => {
    if (pinnedRef.current) return;
    if (!overlay && hoverTrigger) hide();
    onMouseLeave?.();
  };

  if (!visible) return null;

  // Overlay 模式：全屏遮罩 + 居中内容
  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={close}
          aria-label="关闭"
        />
        <div
          ref={popRef}
          role="dialog"
          aria-modal="true"
          className={`relative bg-[#0f1019] border border-gray-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden ${className}`}
          style={{
            zIndex,
            width: width ?? DEFAULT_OVERLAY_WIDTH,
            maxWidth: '95vw',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 shrink-0">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <button
              className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
              onClick={close}
              type="button"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    );
  }

  // 普通 tooltip pop 模式（已固定时可拖拽）
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
      {/* 顶部提示栏 — 拖拽把手 */}
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b border-gray-700 bg-gray-800/50 select-none ${
          pinned ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onMouseDown={handleDragStart}
      >
        <span className="text-xs font-bold text-gray-300">{title}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">
            {pinned ? '已固定 (拖拽移动)' : '点击固定'}
          </span>
          <button
            className="text-gray-400 hover:text-white text-sm leading-none transition-colors"
            onClick={(e) => { e.stopPropagation(); close(); }}
            type="button"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
      </div>
      <div className="p-3 text-start">{children}</div>
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

export function FactorTooltip({
  label,
  value,
  reason,
  breakdown,
  children,
}: FactorTooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [_pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (pinnedRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    if (pinnedRef.current) return;
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, HOVER_DELAY_MS);
  }, []);

  const togglePin = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPinned((prev) => {
      const next = !prev;
      pinnedRef.current = next;
      if (next) {
        setVisible(true);
      }
      return next;
    });
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
      <span
        ref={triggerRef}
        className="border-b border-dotted border-gray-500 cursor-help text-gray-300 hover:text-white"
      >
        {children}
      </span>
      <PopOverlay
        triggerRef={triggerRef}
        visible={visible}
        onClose={() => { setVisible(false); setPinned(false); pinnedRef.current = false; }}
        onMouseEnter={show}
        onMouseLeave={hide}
        title={label}
        zIndex={101}
        width={400}
        hoverTrigger={false}
      >
        <div className="text-xs text-gray-300">
          {breakdown && breakdown.length > 0 && (
            <div className="space-y-1">
              {breakdown.map((b, i) => (
                <div key={i} className="text-[10px] text-gray-400">
                  <div>
                    <span className="text-gray-300">{b.label}</span>{' '}
                    <span className="font-mono text-gray-200">
                      {typeof b.value === 'number'
                        ? b.value.toFixed(2)
                        : b.value}
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
