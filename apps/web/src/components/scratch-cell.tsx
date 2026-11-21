import {
  SCRATCH_COVERAGE_STRIDE,
  SCRATCH_REVEAL_THRESHOLD,
  scratchBrushRadius,
  scratchDebrisCount,
  scratchStampAlpha,
  scratchStampSpacing,
} from '@hexamap/shared';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useRef } from 'react';
import { primeScratchAudio, scratchTone, silenceScratch } from '../lib/scratch-audio';

// La couverture lit getImageData : au plus ~8 lectures par seconde, quelle que
// soit la vitesse du geste.
const COVERAGE_CHECK_MS = 120;
const GRAIN_SIZE = 96;
const GRAIN_ALPHA = 0.07;
const SPECULAR_ANGLE = (25 * Math.PI) / 180;
// Un grattoir enlève la matière sur toute la surface de contact : le tampon est
// un plateau, seul le bord est tendre. Une décroissance pure ne laissait compter
// que ~35 % du rayon par checkCoverage (alpha < 128), donc un tap ne pesait que
// 0,45 % de la case et les neuf taps du banc n'atteignaient jamais les 40 %.
const SPRITE_PLATEAU = 0.68;
const SPRITE_RIM_EXPONENT = 1.1;
const SPRITE_STOPS = 20;
const HATCH_STEP = 8;
const MAX_DEBRIS = 40;
const DEBRIS_GRAVITY = 0.35;
const HAPTIC_INTERVAL_MS = 120;
const DISSOLVE_MS = 220;

// Fallbacks alignés sur le bloc @theme de styles.css : les variables CSS ne sont
// pas lisibles depuis un contexte 2d, donc paint() les recopie à chaque passe.
const FOIL_FALLBACK = '#3a423d';
const FOIL_DEEP_FALLBACK = '#232926';
const FOIL_HI_FALLBACK = '#7b8a80';
const DUST_GOLD = '#c9a227';
const DUST_PALE = '#e6d3a3';
const STAMP_INK = 'rgba(239, 231, 215, 0.24)';

interface Point {
  x: number;
  y: number;
}

interface Palette {
  hi: string;
  mid: string;
  deep: string;
}

interface DebrisParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  colour: string;
}

interface ScratchCellProps {
  index: number;
  disabled?: boolean;
  pending?: boolean;
  onReveal: (index: number) => void;
  sound?: boolean;
}

function readToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Grain 96 × 96 déterministe : un redimensionnement repeint le même motif. */
function createGrain(seed: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = GRAIN_SIZE;
  canvas.height = GRAIN_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  const data = image.data;
  const random = mulberry32(seed * 2654435761 + 1);
  for (let i = 0; i < data.length; i += 4) {
    const shade = Math.floor(random() * 255);
    data[i] = shade;
    data[i + 1] = shade;
    data[i + 2] = shade;
    // 0,5 à 1,0 : sous 0,5, la multiplication `destination-in` percerait le
    // plateau du tampon et la case ne se révélerait plus au doigt.
    data[i + 3] = 128 + Math.floor(random() * 127);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function ScratchCell({
  index,
  disabled = false,
  pending = false,
  onReveal,
  sound = false,
}: ScratchCellProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debrisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const moveCountRef = useRef(0);
  const lastCoverageRef = useRef(0);
  const lastPointRef = useRef<Point | null>(null);
  const pendingPointRef = useRef<Point | null>(null);
  const rafRef = useRef<number | null>(null);
  const debrisRafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const pressureRef = useRef(0.5);
  const lastHapticRef = useRef(0);
  const brushRef = useRef(18);
  const reducedMotionRef = useRef(false);
  const spriteRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<Palette>({
    hi: FOIL_HI_FALLBACK,
    mid: FOIL_FALLBACK,
    deep: FOIL_DEEP_FALLBACK,
  });
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const particlesRef = useRef<DebrisParticle[]>([]);
  const debrisTimeRef = useRef(0);
  const revealRef = useRef<(() => void) | null>(null);
  const onRevealRef = useRef(onReveal);
  const disabledRef = useRef(disabled || pending);
  const soundRef = useRef(sound);

  useEffect(() => {
    onRevealRef.current = onReveal;
  }, [onReveal]);

  useEffect(() => {
    disabledRef.current = disabled || pending;
  }, [disabled, pending]);

  useEffect(() => {
    // Le commutateur a un seul propriétaire : la route. Ici on recopie la prop
    // dans une ref sans jamais l'éteindre au démontage — révéler la première
    // case ne doit pas couper le son des quinze autres.
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const debrisCanvas = debrisCanvasRef.current;

    // Un seul tampon de pinceau par passe : le rayon suit la taille de la case.
    const buildSprite = (radius: number) => {
      const size = Math.max(4, Math.ceil(radius * 2 + 8));
      const sprite = document.createElement('canvas');
      sprite.width = size;
      sprite.height = size;
      const sctx = sprite.getContext('2d');
      if (!sctx) {
        spriteRef.current = null;
        return;
      }
      const centre = size / 2;
      const gradient = sctx.createRadialGradient(centre, centre, 0, centre, centre, radius);
      // Vingt arrêts : à huit, le genou du plateau se lirait comme un anneau.
      for (let i = 0; i <= SPRITE_STOPS; i += 1) {
        const t = i / SPRITE_STOPS;
        const a = t <= SPRITE_PLATEAU ? 1 : ((1 - t) / (1 - SPRITE_PLATEAU)) ** SPRITE_RIM_EXPONENT;
        gradient.addColorStop(t, `rgba(0, 0, 0, ${Math.max(0, a).toFixed(4)})`);
      }
      sctx.fillStyle = gradient;
      sctx.beginPath();
      sctx.arc(centre, centre, radius, 0, Math.PI * 2);
      sctx.fill();

      const grain = createGrain(index * 31 + 7);
      const pattern = grain ? sctx.createPattern(grain, 'repeat') : null;
      if (pattern) {
        // Le tampon hérite du grain : il raie au lieu de gommer rond.
        sctx.globalCompositeOperation = 'destination-in';
        sctx.globalAlpha = 1;
        sctx.fillStyle = pattern;
        sctx.fillRect(0, 0, size, size);
        sctx.globalCompositeOperation = 'source-over';
      }

      // Bord déchiqueté : douze encoches le long de la circonférence.
      const random = mulberry32(index * 7919 + 13);
      const notch = Math.max(1, radius * 0.12);
      sctx.globalAlpha = 0.35;
      sctx.fillStyle = '#000000';
      sctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 12; i += 1) {
        const angle = random() * Math.PI * 2;
        const distance = radius * (0.86 + random() * 0.14);
        sctx.beginPath();
        sctx.arc(
          centre + Math.cos(angle) * distance,
          centre + Math.sin(angle) * distance,
          notch,
          0,
          Math.PI * 2,
        );
        sctx.fill();
      }
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-over';
      spriteRef.current = sprite;
    };

    const paint = () => {
      // matchMedia alloue : une lecture par passe, jamais une par tampon.
      reducedMotionRef.current = prefersReducedMotion();
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;
      sizeRef.current = { w, h };
      const radius = scratchBrushRadius(w, h);
      brushRef.current = radius;

      const hi = readToken('--color-foil-hi', FOIL_HI_FALLBACK);
      const mid = readToken('--color-foil', FOIL_FALLBACK);
      const deep = readToken('--color-foil-deep', FOIL_DEEP_FALLBACK);
      paletteRef.current = { hi, mid, deep };

      if (debrisCanvas) {
        debrisCanvas.width = canvas.width;
        debrisCanvas.height = canvas.height;
      }
      particlesRef.current = [];

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // 1. Le métal : haut éclairé, bas dans l'ombre.
      const vertical = ctx.createLinearGradient(0, 0, 0, h);
      vertical.addColorStop(0, hi);
      vertical.addColorStop(0.5, mid);
      vertical.addColorStop(1, deep);
      ctx.fillStyle = vertical;
      ctx.fillRect(0, 0, w, h);

      // 2. La bande spéculaire : c'est elle qui fait lire du métal.
      const dx = Math.cos(SPECULAR_ANGLE);
      const dy = Math.sin(SPECULAR_ANGLE);
      const span = Math.abs(w * dx) + Math.abs(h * dy);
      const specular = ctx.createLinearGradient(
        w / 2 - (dx * span) / 2,
        h / 2 - (dy * span) / 2,
        w / 2 + (dx * span) / 2,
        h / 2 + (dy * span) / 2,
      );
      specular.addColorStop(0, 'rgba(255, 255, 255, 0)');
      specular.addColorStop(0.36, 'rgba(255, 255, 255, 0)');
      specular.addColorStop(0.46, 'rgba(255, 255, 255, 0.10)');
      specular.addColorStop(0.62, 'rgba(255, 255, 255, 0)');
      specular.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specular;
      ctx.fillRect(0, 0, w, h);

      // 3. Le grain métallique, tuilé.
      const grain = createGrain(index + 1);
      const pattern = grain ? ctx.createPattern(grain, 'repeat') : null;
      if (pattern) {
        ctx.globalAlpha = GRAIN_ALPHA;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // 4. Le motif imprimé : sérigraphie à peine visible.
      ctx.globalAlpha = 0.02;
      ctx.strokeStyle = hi;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -h; x < w + h; x += HATCH_STEP) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 5. Le biseau intérieur : lumière en haut à gauche, ombre en bas à droite.
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = hi;
      ctx.beginPath();
      ctx.moveTo(0.5, h - 0.5);
      ctx.lineTo(0.5, 0.5);
      ctx.lineTo(w - 0.5, 0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = deep;
      ctx.beginPath();
      ctx.moveTo(w - 0.5, 0.5);
      ctx.lineTo(w - 0.5, h - 0.5);
      ctx.lineTo(0.5, h - 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 6. Le pourtour usé.
      const vignette = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.15,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75,
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // 7. La poussière de laiton : semis déterministe, aplats only.
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = DUST_GOLD;
      for (let i = 0; i < 14; i += 1) {
        const px = (((i * 73) % 97) / 97) * w;
        const py = (((i * 41) % 89) / 89) * h;
        const dotRadius = 0.6 + (i % 3) * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = DUST_PALE;
      for (let i = 0; i < 9; i += 1) {
        const px = (((i * 59) % 83) / 83) * w;
        const py = (((i * 31) % 71) / 71) * h;
        ctx.beginPath();
        ctx.arc(px, py, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 8. L'identité du ticket.
      ctx.save();
      ctx.fillStyle = STAMP_INK;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(Math.min(w, h) * 0.42)}px "JetBrains Mono", monospace`;
      ctx.fillText('?', w / 2, h / 2 - h * 0.06);
      ctx.font = `700 ${Math.max(7, Math.round(Math.min(w, h) * 0.1))}px "JetBrains Mono", monospace`;
      ctx.fillText('HEXAGONE', w / 2, h / 2 + h * 0.18);
      ctx.restore();

      buildSprite(radius);
    };

    paint();

    const checkCoverage = () => {
      if (firedRef.current) return;
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;
      const data = ctx.getImageData(0, 0, width, height).data;
      let erased = 0;
      let total = 0;
      for (let y = 0; y < height; y += SCRATCH_COVERAGE_STRIDE) {
        for (let x = 0; x < width; x += SCRATCH_COVERAGE_STRIDE) {
          const alpha = data[(y * width + x) * 4 + 3] ?? 255;
          total += 1;
          if (alpha < 128) erased += 1;
        }
      }
      if (total > 0 && erased / total >= SCRATCH_REVEAL_THRESHOLD) {
        dissolveAndReveal();
      }
    };

    // ---- Gravats -----------------------------------------------------------

    const drawDebris = (now: number) => {
      debrisRafRef.current = null;
      if (!debrisCanvas) return;
      const dctx = debrisCanvas.getContext('2d');
      if (!dctx) return;
      const { w, h } = sizeRef.current;
      if (w === 0 || h === 0) {
        particlesRef.current = [];
        return;
      }
      const delta =
        debrisTimeRef.current === 0 ? 16 : Math.min(64, Math.max(1, now - debrisTimeRef.current));
      debrisTimeRef.current = now;
      const dpr = window.devicePixelRatio || 1;
      // Effacer sous transformation identité : sinon l'arrondi du DPR laisse
      // une bande de gravats figée sur les bords droit et bas.
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.clearRect(0, 0, debrisCanvas.width, debrisCanvas.height);
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dctx.globalAlpha = 1;

      const alive: DebrisParticle[] = [];
      const scale = delta / 16;
      for (const particle of particlesRef.current) {
        particle.life -= delta;
        if (particle.life <= 0) continue;
        particle.vy += DEBRIS_GRAVITY * scale;
        particle.x += particle.vx * scale;
        particle.y += particle.vy * scale;
        if (particle.x < 0 || particle.x > w || particle.y < 0 || particle.y > h) continue;
        dctx.globalAlpha = Math.min(1, particle.life / 180);
        dctx.fillStyle = particle.colour;
        dctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        alive.push(particle);
      }
      dctx.globalAlpha = 1;
      particlesRef.current = alive;

      if (alive.length === 0) {
        debrisTimeRef.current = 0;
        return;
      }
      debrisRafRef.current = requestAnimationFrame(drawDebris);
    };

    const startDebris = () => {
      if (reducedMotionRef.current) return;
      if (debrisRafRef.current !== null) return;
      debrisTimeRef.current = 0;
      debrisRafRef.current = requestAnimationFrame(drawDebris);
    };

    const spawnDebris = (
      x: number,
      y: number,
      dirX: number,
      dirY: number,
      len: number,
      speed: number,
      random: () => number,
    ) => {
      const count = scratchDebrisCount(speed);
      if (count === 0 || reducedMotionRef.current) return;
      const palette = paletteRef.current;
      const paletteList = [palette.mid, palette.deep, palette.hi];
      // Normale au trait : les éclats partent sur les côtés, pas dans l'axe.
      const normalX = len > 0 ? -dirY / len : 0;
      const normalY = len > 0 ? dirX / len : -1;
      const forwardX = len > 0 ? dirX / len : 0;
      const forwardY = len > 0 ? dirY / len : 0;

      for (let i = 0; i < count; i += 1) {
        if (particlesRef.current.length >= MAX_DEBRIS) {
          particlesRef.current.shift();
        }
        const side = random() < 0.5 ? -1 : 1;
        const spread = 0.15 + random() * 0.45;
        const goldFleck = random() < 0.25;
        particlesRef.current.push({
          x,
          y,
          vx: normalX * side * spread - forwardX * 0.1,
          vy: normalY * side * spread - forwardY * 0.1 - 0.25 - random() * 0.35,
          life: 300 + random() * 200,
          size: 0.8 + random() * 1.4,
          colour: goldFleck
            ? DUST_GOLD
            : (paletteList[Math.floor(random() * paletteList.length)] ?? palette.mid),
        });
      }
      startDebris();
    };

    // ---- Tampons -----------------------------------------------------------

    const stampStroke = (from: Point, to: Point, now: number) => {
      const sprite = spriteRef.current;
      if (!sprite) return;
      const radius = brushRef.current;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      const dt = Math.min(64, Math.max(1, now - lastTimeRef.current));
      const speed = len / dt;
      const alpha = scratchStampAlpha(speed, pressureRef.current);
      const step = scratchStampSpacing(radius);
      const count = Math.min(160, Math.max(1, Math.ceil(len / step)));
      const jitter = radius * 0.06;
      const random = mulberry32(
        (Math.floor(now) * 131 + moveCountRef.current * 17 + index * 7) >>> 0,
      );

      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = alpha;
      for (let i = 0; i < count; i += 1) {
        const t = count === 1 ? 1 : i / (count - 1);
        const px = from.x + dx * t + (random() - 0.5) * 2 * jitter;
        const py = from.y + dy * t + (random() - 0.5) * 2 * jitter;
        const scale = 0.94 + random() * 0.12;
        const rotation = random() * Math.PI * 2;
        const size = sprite.width * scale;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rotation);
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.restore();

        spawnDebris(px, py, dx, dy, len, speed, random);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (soundRef.current) {
        primeScratchAudio();
        scratchTone(speed);
      }
      if (
        typeof navigator.vibrate === 'function' &&
        now - lastHapticRef.current >= HAPTIC_INTERVAL_MS
      ) {
        lastHapticRef.current = now;
        navigator.vibrate(8);
      }
    };

    // ---- Révélation --------------------------------------------------------

    const dissolveAndReveal = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      const targets: HTMLElement[] = [canvas];
      if (debrisCanvas) targets.push(debrisCanvas);
      if (reducedMotionRef.current) {
        for (const target of targets) target.style.opacity = '0';
      } else {
        for (const target of targets) {
          target.style.transition = `opacity ${DISSOLVE_MS}ms ease-out`;
          target.style.opacity = '0';
        }
      }
      onRevealRef.current(index);
    };

    revealRef.current = dissolveAndReveal;

    // ---- Une seule image en vol -------------------------------------------

    const flush = (now: number) => {
      rafRef.current = null;
      const point = pendingPointRef.current;
      if (!point) {
        lastTimeRef.current = now;
        return;
      }
      pendingPointRef.current = null;
      const from = lastPointRef.current ?? point;
      stampStroke(from, point, now);
      lastPointRef.current = point;
      lastTimeRef.current = now;
      moveCountRef.current += 1;
      if (now - lastCoverageRef.current >= COVERAGE_CHECK_MS) {
        lastCoverageRef.current = now;
        checkCoverage();
      }
    };

    const queuePoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      pendingPointRef.current = { x: clientX - rect.left, y: clientY - rect.top };
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    };

    const observer = new ResizeObserver(() => {
      if (moveCountRef.current === 0) {
        paint();
        return;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingPointRef.current = null;

      // La zone grattée survit : copie à l'ancienne taille, repeinture, puis
      // réapplication de la copie sous transformation identité.
      const snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      const snapshotCtx = snapshot.getContext('2d');
      if (snapshotCtx) snapshotCtx.drawImage(canvas, 0, 0);

      paint();

      // L'instantané porte déjà le métal ET les trous : le rejouer en 'copy'
      // remplace la destination, alpha compris. Un 'source-over' sur un métal
      // opaque ne peut pas réintroduire de transparence — il guérissait la case.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      // restore() rend 'source-over' et globalAlpha 1 à la passe suivante.
    });
    observer.observe(canvas);

    // ---- Pointer Events ----------------------------------------------------

    const onPointerDown = (event: PointerEvent) => {
      if (disabledRef.current) return;
      // Un seul pointeur gratte : un second doigt ne prend pas le relais.
      if (drawingRef.current) return;
      if (firedRef.current) {
        // La révélation a échoué côté serveur : la case se réarme sous le doigt,
        // sans quoi elle resterait blanche et inerte pour de bon.
        firedRef.current = false;
        canvas.style.transition = '';
        canvas.style.opacity = '';
        if (debrisCanvas) {
          debrisCanvas.style.transition = '';
          debrisCanvas.style.opacity = '';
        }
      }
      event.preventDefault();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Identifiant déjà relâché : la capture est un confort, pas un prérequis.
      }
      drawingRef.current = true;
      activePointerRef.current = event.pointerId;
      pendingPointRef.current = null;
      pressureRef.current = event.pressure > 0 ? event.pressure : 0.5;
      const now = performance.now();
      lastTimeRef.current = now;
      const rect = canvas.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      lastPointRef.current = point;
      // Un appui immobile doit effacer : len = 0, donc alpha plein.
      stampStroke(point, point, now);
      moveCountRef.current += 1;
      if (now - lastCoverageRef.current >= COVERAGE_CHECK_MS) {
        lastCoverageRef.current = now;
        checkCoverage();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drawingRef.current) return;
      if (event.pointerId !== activePointerRef.current) return;
      if (event.pressure > 0) pressureRef.current = event.pressure;
      queuePoint(event.clientX, event.clientY);
    };

    const stopDrawing = (event: PointerEvent) => {
      if (!drawingRef.current) return;
      // Seul le pointeur propriétaire du trait peut le terminer.
      if (event.pointerId !== activePointerRef.current) return;
      drawingRef.current = false;
      activePointerRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Aucun échantillon perdu : le trait en attente est vidé avant le test.
      flush(performance.now());
      pendingPointRef.current = null;
      lastPointRef.current = null;
      silenceScratch();
      checkCoverage();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerleave', stopDrawing);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (debrisRafRef.current !== null) {
        cancelAnimationFrame(debrisRafRef.current);
        debrisRafRef.current = null;
      }
      pendingPointRef.current = null;
      drawingRef.current = false;
      activePointerRef.current = null;
      particlesRef.current = [];
      revealRef.current = null;
      silenceScratch();
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
    revealRef.current?.();
  };

  const isDisabled = disabled || pending;

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-label={`Case ${index + 1}, non révélée`}
      aria-busy={pending || undefined}
      onKeyDown={handleKeyDown}
      className={[
        'carbon relative block aspect-[3/5] w-full touch-none select-none overflow-hidden rounded-[2px] p-0 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-vellum',
        isDisabled ? 'cursor-not-allowed opacity-70' : 'cursor-grab',
      ].join(' ')}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] m-auto h-1/2 w-1/2 text-vellum opacity-[0.07]"
      >
        <path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z" />
      </svg>
      {pending ? (
        <div aria-hidden="true" className="absolute inset-0 z-[2] flex items-center justify-center">
          <span className="font-mono text-2xl font-bold text-vellum/60">?</span>
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 h-full w-full cursor-crosshair touch-none select-none"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] block">
        <canvas ref={debrisCanvasRef} className="pointer-events-none block h-full w-full" />
      </span>
      {pending ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center bg-cabinet/70"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">
            Révélation…
          </span>
        </div>
      ) : null}
    </button>
  );
}
