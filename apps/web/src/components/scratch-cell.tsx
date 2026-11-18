import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';

const REVEAL_THRESHOLD = 0.4;
const BRUSH_SIZE = 26;
const COVERAGE_CHECK_INTERVAL = 6;

// Canvas fills need literal colours; these mirror the --color-muted and
// --color-ink-muted tokens declared in styles.css.
const COVER_FILL = '#E6E2D8';
const COVER_HATCH = 'rgba(148, 163, 184, 0.45)';
const COVER_STAMP = 'rgba(71, 85, 105, 0.22)';

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

      ctx.fillStyle = COVER_FILL;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = COVER_HATCH;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -h; x < w + h; x += 8) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
      }
      ctx.stroke();

      // Single flat stamp — no speckles, no gradient (DESIGN_SYSTEM.md §6.2).
      ctx.save();
      ctx.fillStyle = COVER_STAMP;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(Math.min(w, h) * 0.42)}px "JetBrains Mono", monospace`;
      ctx.fillText('?', w / 2, h / 2 - h * 0.06);
      ctx.font = `700 ${Math.max(7, Math.round(Math.min(w, h) * 0.1))}px "JetBrains Mono", monospace`;
      ctx.fillText('HEXAGONE', w / 2, h / 2 + h * 0.18);
      ctx.restore();
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
        'relative block aspect-square w-full touch-none overflow-hidden rounded-md border border-border bg-surface p-0 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sign-ochre',
        isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-grab',
      ].join(' ')}
    >
      {pending ? (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-2xl font-bold text-ink-muted">?</span>
        </div>
      ) : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
      {pending ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70"
        >
          <span className="text-xs font-medium text-ink-inverse">Révélation…</span>
        </div>
      ) : null}
    </button>
  );
}
