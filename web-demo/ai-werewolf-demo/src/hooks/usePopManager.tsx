import type React from 'react';
import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';

interface PopState {
  id: string;
  pinned: boolean;
  element: HTMLElement | null;
}

interface PopManagerContextValue {
  registerPop: (id: string, element: HTMLElement | null) => void;
  unregisterPop: (id: string) => void;
  togglePin: (id: string) => void;
  isPinned: (id: string) => boolean;
  getPopAtPoint: (x: number, y: number) => string | null;
}

const PopManagerContext = createContext<PopManagerContextValue | null>(null);

export function PopProvider({ children }: { children: React.ReactNode }) {
  const popsRef = useRef<Map<string, PopState>>(new Map());
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [, forceUpdate] = useState(0);

  const registerPop = useCallback((id: string, element: HTMLElement | null) => {
    const existing = popsRef.current.get(id);
    popsRef.current.set(id, { id, pinned: existing?.pinned ?? false, element });
  }, []);

  const unregisterPop = useCallback((id: string) => {
    popsRef.current.delete(id);
  }, []);

  const togglePin = useCallback((id: string) => {
    const pop = popsRef.current.get(id);
    if (pop) {
      pop.pinned = !pop.pinned;
      forceUpdate((n) => n + 1); // 触发重新渲染以更新 pinned UI
    }
  }, []);

  const isPinned = useCallback((id: string) => {
    return popsRef.current.get(id)?.pinned ?? false;
  }, []);

  const getPopAtPoint = useCallback((x: number, y: number) => {
    const entries = Array.from(popsRef.current.values());
    for (let i = entries.length - 1; i >= 0; i--) {
      const pop = entries[i];
      if (pop.element) {
        const rect = pop.element.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return pop.id;
        }
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        const { x, y } = mousePosRef.current;
        const id = getPopAtPoint(x, y);
        if (id) {
          togglePin(id);
        }
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [getPopAtPoint, togglePin]);

  const value = useMemo(() => ({ registerPop, unregisterPop, togglePin, isPinned, getPopAtPoint }), [registerPop, unregisterPop, togglePin, isPinned, getPopAtPoint]);

  return (
    <PopManagerContext.Provider value={value}>
      {children}
    </PopManagerContext.Provider>
  );
}

export function usePopManager() {
  const ctx = useContext(PopManagerContext);
  if (!ctx) throw new Error('usePopManager must be used within PopProvider');
  return ctx;
}
