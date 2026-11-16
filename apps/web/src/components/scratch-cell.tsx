import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';

const REVEAL_THRESHOLD = 0.4;
const BRUSH_SIZE = 26;
const COVERAGE_CHECK_INTERVAL = 6;
const SPECKLE_COUNT = 150;

interface ScratchCellProps {
  index: number;
  label: string;
  disabled?: boolean;
  pending?: boolean;
  onReveal: (index: number) => void;
}

export function ScratchCell({
  index,
  label,
  disabled = false,
  pending = false,
  onReveal,
}: ScratchCellProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const firedRef = useRef(false);
  const moveCountRef = useRef(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const onRevealRef = useRef(onReveal);
  const disabledRef = useRef(disabled || pending);

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  useEffect(() => {
    disabledRef.current = disabled || pending;
  }, [disabled, pending]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;

      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#334155');
      gradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -h; x < w + h; x += 8) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
      }
      ctx.stroke();

      let seed = 0x9e3779b9;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      ctx.fillStyle = 'rgba(241, 245, 249, 0.12)';
      for (let i = 0; i < SPECKLE_COUNT; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 0.4 + rand() * 1.1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    paint();

    const observer = new ResizeObserver(() => {
      if (moveCountRef.current === 0) paint();
    });
    observer.observe(canvas);

    const checkCoverage = () => {
      if (firedRef.current) return;
      const { width, height } = canvas;
      const image = ctx.getImageData(0, 0, width, height);
      const data = image.data;
      let erased = 0;
      const total = data.length / 4;
      for (let i = 3; i < data.length; i += 4) {
        const alpha = data[i] ?? 255;
        if (alpha < 128) erased += 1;
      }
      if (total > 0 && erased / total >= REVEAL_THRESHOLD) {
        firedRef.current = true;
        onRevealRef.current(index);
      }
    };

    const scratchAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const prev = lastPointRef.current;

      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.lineWidth = BRUSH_SIZE;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (prev) {
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, BRUSH_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      lastPointRef.current = { x, y };
      moveCountRef.current += 1;
      if (moveCountRef.current % COVERAGE_CHECK_INTERVAL === 0) {
        checkCoverage();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (disabledRef.current) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      lastPointRef.current = null;
      scratchAt(event.clientX, event.clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drawingRef.current) return;
      scratchAt(event.clientX, event.clientY);
    };

    const stopDrawing = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPointRef.current = null;
      checkCoverage();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerleave', stopDrawing);

    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', stopDrawing);
      canvas.removeEventListener('pointercancel', stopDrawing);
      canvas.removeEventListener('pointerleave', stopDrawing);
    };
  }, [index]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabledRef.current) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (firedRef.current) return;
    firedRef.current = true;
    onRevealRef.current(index);
  };

  const isDisabled = disabled || pending;

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-label={label}
      aria-busy={pending || undefined}
      onKeyDown={handleKeyDown}
      className={[
        'relative block aspect-square w-full touch-none overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 p-0 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
        isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-grab',
      ].join(' ')}
    >
      {pending ? (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-400/80">?</span>
        </div>
      ) : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      {pending ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60"
        >
          <span className="text-xs font-medium text-slate-200">Révélation…</span>
        </div>
      ) : null}
    </button>
  );
}
