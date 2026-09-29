import React, { useRef, useCallback } from 'react';
import type { ColResizeApi } from './useColumnResize';

interface ColGroupProps {
  cr: ColResizeApi;
  columnIds: string[];
}

/** Renders a <colgroup> that drives table-layout: fixed column widths. */
export function ColGroup({ cr, columnIds }: ColGroupProps) {
  return (
    <colgroup>
      {columnIds.map(id => (
        <col key={id} data-col-id={id} style={{ width: `${cr.widths[id] ?? cr.defaults[id] ?? 120}px` }} />
      ))}
    </colgroup>
  );
}

interface ColResizeHandleProps {
  cr: ColResizeApi;
  colId: string;
  label?: string;
  isLast?: boolean;
}

/**
 * Invisible 8px drag handle placed at the right edge of a <th>.
 * Renders null for the last column (no right border to drag).
 * Pointer Events + setPointerCapture; RAF for perf; keyboard accessible.
 */
export function ColResizeHandle({ cr, colId, label, isLast }: ColResizeHandleProps) {
  if (isLast) return null;

  const drag = useRef<{ startX: number; startW: number; raf: number } | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const getCol = useCallback(
    () => cr.tableRef.current?.querySelector<HTMLElement>(`col[data-col-id="${colId}"]`) ?? null,
    [cr, colId],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const el = handleRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    el.setAttribute('data-drag', '1');
    document.documentElement.style.cursor = 'col-resize';
    document.documentElement.style.userSelect = 'none';
    drag.current = {
      startX: e.clientX,
      startW: cr.widths[colId] ?? cr.defaults[colId] ?? cr.cfg.min,
      raf: 0,
    };
  }, [cr, colId]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const d = drag.current;
    const newW = Math.min(cr.cfg.max, Math.max(cr.cfg.min, d.startW + e.clientX - d.startX));
    cancelAnimationFrame(d.raf);
    d.raf = requestAnimationFrame(() => {
      const col = getCol();
      if (col) col.style.width = `${newW}px`;
    });
  }, [cr, getCol]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    const newW = d.startW + e.clientX - d.startX;
    drag.current = null;
    handleRef.current?.removeAttribute('data-drag');
    document.documentElement.style.cursor = '';
    document.documentElement.style.userSelect = '';
    cr.setWidth(colId, newW);
  }, [cr, colId]);

  const handlePointerCancel = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    const origW = d.startW;
    drag.current = null;
    handleRef.current?.removeAttribute('data-drag');
    document.documentElement.style.cursor = '';
    document.documentElement.style.userSelect = '';
    const col = getCol();
    if (col) col.style.width = `${origW}px`;
  }, [getCol]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    cr.resetWidth(colId);
  }, [cr, colId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const cur = cr.widths[colId] ?? cr.defaults[colId] ?? cr.cfg.min;
    const step = e.shiftKey ? cr.cfg.stepShift : cr.cfg.step;
    if (e.key === 'ArrowRight') { e.preventDefault(); cr.setWidth(colId, cur + step); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); cr.setWidth(colId, cur - step); }
    else if (e.key === 'Home' || e.key === 'Escape') { e.preventDefault(); cr.resetWidth(colId); }
  }, [cr, colId]);

  return (
    <div
      ref={handleRef}
      className="col-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={label ? `Resize ${label}` : 'Resize column'}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onClick={e => e.stopPropagation()}
    />
  );
}
