import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/** Image viewer with zoom: mouse wheel, +/- buttons, double click/tap, drag to pan, pinch on touch screens. */
export function ZoomableImage({ src, alt, heightClass = 'h-[70vh]' }: { src: string; alt: string; heightClass?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const view = useRef({ scale: 1, offset: { x: 0, y: 0 } });
  view.current = { scale, offset };

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  /** Zooms to `next`, keeping the point (cx, cy) - relative to the container centre - fixed under the cursor. */
  const zoomTo = (next: number, cx = 0, cy = 0) => {
    const { scale: s, offset: o } = view.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (clamped === MIN_ZOOM) {
      reset();
      return;
    }
    const ratio = clamped / s;
    setScale(clamped);
    setOffset({ x: cx - (cx - o.x) * ratio, y: cy - (cy - o.y) * ratio });
  };

  const centerOf = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  // Native listener: React's onWheel is passive and cannot stop the page behind the modal from scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = centerOf(e.clientX, e.clientY);
      zoomTo(view.current.scale * Math.exp(-e.deltaY * 0.0015), c.x, c.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.current.scale };
      dragStart.current = null;
    } else {
      dragStart.current = { x: e.clientX, y: e.clientY, ox: view.current.offset.x, oy: view.current.offset.y };
      setDragging(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const c = centerOf((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomTo(pinchStart.current.scale * (dist / pinchStart.current.dist), c.x, c.y);
    } else if (dragStart.current && view.current.scale > 1) {
      setOffset({
        x: dragStart.current.ox + e.clientX - dragStart.current.x,
        y: dragStart.current.oy + e.clientY - dragStart.current.y,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinchStart.current = null;
    dragStart.current = null;
    setDragging(false);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (view.current.scale > 1) reset();
    else {
      const c = centerOf(e.clientX, e.clientY);
      zoomTo(3, c.x, c.y);
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        className={`w-full ${heightClass} overflow-hidden flex items-center justify-center select-none touch-none`}
        style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full object-contain rounded-lg"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragging || pointers.current.size > 0 ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur border border-white/10 text-white">
        <button
          type="button"
          onClick={() => zoomTo(scale / 1.5)}
          disabled={scale <= MIN_ZOOM}
          className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40"
          title="Уменьшить"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="w-12 text-center text-xs font-mono">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => zoomTo(scale * 1.5)}
          disabled={scale >= MAX_ZOOM}
          className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40"
          title="Увеличить"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={scale === 1}
          className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40"
          title="Сбросить масштаб"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
