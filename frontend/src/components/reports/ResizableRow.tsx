import React, { useRef, useCallback } from 'react';
import { ROW_RESIZE_CONFIG as CFG } from './useRowResize';

export interface ResizableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  rowId: string;
  heights: Record<string, number>;
  onHeightChange: (rowId: string, h: number) => void;
  onHeightReset: (rowId: string) => void;
}

function clamp(v: number) {
  return Math.min(CFG.max, Math.max(CFG.min, v));
}

export function ResizableRow({
  rowId,
  heights,
  onHeightChange,
  onHeightReset,
  children,
  className,
  style,
  ...rest
}: ResizableRowProps) {
  const ref = useRef<HTMLTableRowElement>(null);
  const drag = useRef<{ startY: number; startH: number; raf: number } | null>(null);
  const savedH = heights[rowId];

  const inZone = useCallback((clientY: number) => {
    const el = ref.current;
    if (!el) return false;
    return clientY >= el.getBoundingClientRect().bottom - CFG.handle;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const d = drag.current;
    if (d) {
      const newH = clamp(d.startH + e.clientY - d.startY);
      cancelAnimationFrame(d.raf);
      d.raf = requestAnimationFrame(() => {
        if (ref.current) ref.current.style.height = `${newH}px`;
      });
    } else {
      const inH = inZone(e.clientY);
      el.style.cursor = inH ? 'row-resize' : '';
      if (inH) el.setAttribute('data-rr', 'hover');
      else el.removeAttribute('data-rr');
    }
  }, [inZone]);

  const handlePointerLeave = useCallback(() => {
    if (!drag.current) {
      const el = ref.current;
      if (el) { el.style.cursor = ''; el.removeAttribute('data-rr'); }
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 || !inZone(e.clientY)) return;
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const startH = savedH ?? el.getBoundingClientRect().height;
    drag.current = { startY: e.clientY, startH, raf: 0 };
    el.setAttribute('data-rr', 'drag');
    el.style.cursor = 'row-resize';
    document.documentElement.style.userSelect = 'none';
  }, [inZone, savedH]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    const newH = clamp(d.startH + e.clientY - d.startY);
    drag.current = null;
    const el = ref.current;
    if (el) { el.style.cursor = ''; el.removeAttribute('data-rr'); }
    document.documentElement.style.userSelect = '';
    onHeightChange(rowId, newH);
  }, [rowId, onHeightChange]);

  const handlePointerCancel = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    drag.current = null;
    const el = ref.current;
    if (el) {
      el.style.height = savedH ? `${savedH}px` : '';
      el.style.cursor = '';
      el.removeAttribute('data-rr');
    }
    document.documentElement.style.userSelect = '';
  }, [savedH]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (inZone(e.clientY)) onHeightReset(rowId);
  }, [inZone, rowId, onHeightReset]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const el = ref.current;
    if (!el) return;
    const step = e.shiftKey ? CFG.stepShift : CFG.step;
    const cur = savedH ?? el.getBoundingClientRect().height;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onHeightChange(rowId, clamp(cur + step));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onHeightChange(rowId, clamp(cur - step));
    } else if (e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault();
      onHeightReset(rowId);
    }
  }, [savedH, rowId, onHeightChange, onHeightReset]);

  return (
    <tr
      {...rest}
      ref={ref}
      className={`rr-row${className ? ` ${className}` : ''}`}
      style={{ ...style, ...(savedH ? { height: savedH } : {}) }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {children}
    </tr>
  );
}
