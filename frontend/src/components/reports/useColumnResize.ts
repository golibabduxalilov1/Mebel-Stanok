import { useState, useCallback, useRef } from 'react';
import type { RefObject } from 'react';

export const COL_RESIZE_CFG = {
  min: 60,
  max: 500,
  handle: 8,
  step: 4,
  stepShift: 16,
};

type Widths = Record<string, number>;

function lsKey(id: string) { return `colWidths:${id}`; }
function load(id: string): Widths {
  try { const v = localStorage.getItem(lsKey(id)); return v ? (JSON.parse(v) as Widths) : {}; }
  catch { return {}; }
}
function persist(id: string, w: Widths) {
  try { localStorage.setItem(lsKey(id), JSON.stringify(w)); } catch {}
}

// One-time cleanup of legacy rowHeights:* keys from the previous row-resize feature.
try {
  Object.keys(localStorage)
    .filter(k => k.startsWith('rowHeights:'))
    .forEach(k => localStorage.removeItem(k));
} catch {}

export interface ColResizeApi {
  tableRef: RefObject<HTMLTableElement | null>;
  widths: Widths;
  defaults: Widths;
  setWidth: (colId: string, px: number) => void;
  resetWidth: (colId: string) => void;
  cfg: typeof COL_RESIZE_CFG;
}

/**
 * Manages per-column widths for a report table.
 *
 * Usage:
 *   const cr = useColumnResize('my-table-id', { col1: 200, col2: 100, ... });
 *
 * Then in JSX:
 *   <table ref={cr.tableRef} ...>
 *     <ColGroup cr={cr} columnIds={['col1', 'col2', ...]} />
 *     <thead><tr>
 *       <th>Label<ColResizeHandle cr={cr} colId="col1" label="Label" /></th>
 *       <th>Last<ColResizeHandle cr={cr} colId="col2" label="Last" isLast /></th>
 *     </tr></thead>
 *   </table>
 *
 * To add to a new table: 3 lines — (1) call useColumnResize with unique tableId and default widths,
 * (2) add ref + ColGroup to <table>, (3) add ColResizeHandle inside each <th>.
 * To change min/max globally: edit COL_RESIZE_CFG above.
 */
export function useColumnResize(
  tableId: string,
  defaultWidths: Widths,
  cfgOverride?: Partial<typeof COL_RESIZE_CFG>,
): ColResizeApi {
  const cfg = cfgOverride ? { ...COL_RESIZE_CFG, ...cfgOverride } : COL_RESIZE_CFG;
  const tableRef = useRef<HTMLTableElement>(null);
  const [saved, setSaved] = useState<Widths>(() => load(tableId));

  const widths = { ...defaultWidths, ...saved };

  const setWidth = useCallback((colId: string, px: number) => {
    const v = Math.min(cfg.max, Math.max(cfg.min, Math.round(px)));
    setSaved(prev => {
      const next = { ...prev, [colId]: v };
      persist(tableId, next);
      return next;
    });
  }, [tableId, cfg.min, cfg.max]);

  const resetWidth = useCallback((colId: string) => {
    setSaved(prev => {
      const { [colId]: _, ...next } = prev;
      persist(tableId, next);
      return next;
    });
  }, [tableId]);

  return { tableRef, widths, defaults: defaultWidths, setWidth, resetWidth, cfg };
}
