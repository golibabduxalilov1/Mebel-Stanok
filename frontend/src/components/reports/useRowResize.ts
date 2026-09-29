import { useState, useCallback } from 'react';

/** Shared config — change here to update all report tables globally. */
export const ROW_RESIZE_CONFIG = {
  min: 44,       // px — minimum row height
  max: 200,      // px — maximum row height
  handle: 8,     // px — pointer hit-area at bottom of row
  step: 4,       // px — keyboard ArrowUp/Down step
  stepShift: 16, // px — keyboard step when Shift held
};

function lsKey(tableId: string) { return `rowHeights:${tableId}`; }

function load(tableId: string): Record<string, number> {
  try {
    const v = localStorage.getItem(lsKey(tableId));
    return v ? (JSON.parse(v) as Record<string, number>) : {};
  } catch { return {}; }
}

function persist(tableId: string, h: Record<string, number>) {
  try { localStorage.setItem(lsKey(tableId), JSON.stringify(h)); } catch {}
}

/**
 * Manages per-row heights for a report table.
 *
 * Usage:
 *   const { heights, setHeight, resetHeight } = useRowResize('my-table-id');
 *
 * Pass heights/setHeight/resetHeight to <ResizableRow> on each tbody row.
 * Heights persist in localStorage under "rowHeights:my-table-id".
 *
 * To change min/max globally: edit ROW_RESIZE_CONFIG above.
 * To add the feature to a new table: 3 lines —
 *   1. const { heights, setHeight, resetHeight } = useRowResize('unique-table-id');
 *   2. In tbody: replace <tr key={id}> with
 *      <ResizableRow key={id} rowId={id} heights={heights} onHeightChange={setHeight} onHeightReset={resetHeight}>
 *   3. Keep </tr> → </ResizableRow>
 */
export function useRowResize(tableId: string) {
  const [heights, setH] = useState<Record<string, number>>(() => load(tableId));

  const setHeight = useCallback((rowId: string, px: number) => {
    const v = Math.min(ROW_RESIZE_CONFIG.max, Math.max(ROW_RESIZE_CONFIG.min, Math.round(px)));
    setH(prev => {
      const next = { ...prev, [rowId]: v };
      persist(tableId, next);
      return next;
    });
  }, [tableId]);

  const resetHeight = useCallback((rowId: string) => {
    setH(prev => {
      const { [rowId]: _, ...next } = prev;
      persist(tableId, next);
      return next;
    });
  }, [tableId]);

  return { heights, setHeight, resetHeight };
}
