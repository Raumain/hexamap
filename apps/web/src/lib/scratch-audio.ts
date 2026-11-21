import { scratchAudioTone } from '@hexamap/shared';

/**
 * Son du grattoir : bruit blanc filtré, synthétisé, sans fichier audio.
 * Aucune fonction de ce module ne lève jamais : un contexte refusé reste muet,
 * parce qu'un navigateur qui bloque l'audio ne doit pas interrompre le grattage.
 */

type AudioContextCtor = typeof AudioContext;

const TARGET_TIME = 0.02;
const SUSPEND_DELAY_MS = 60;

let enabled = false;
let context: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let filter: BiquadFilterNode | null = null;
let gain: GainNode | null = null;
let suspendTimer: ReturnType<typeof setTimeout> | null = null;

function contextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  // Safari n'expose encore que le préfixe sur d'anciennes versions.
  const win = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const frames = Math.max(1, Math.floor(ctx.sampleRate));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < frames; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

interface Graph {
  ctx: AudioContext;
  filter: BiquadFilterNode;
  gain: GainNode;
}

function ensureGraph(): Graph | null {
  if (!enabled) return null;
  if (context && filter && gain && source) {
    return { ctx: context, filter, gain };
  }
  const Ctor = contextCtor();
  if (!Ctor) return null;
  try {
    const ctx = context ?? new Ctor();
    context = ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = makeNoise(ctx);
    noise.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.9;

    const out = ctx.createGain();
    out.gain.value = 0;

    noise.connect(band);
    band.connect(out);
    out.connect(ctx.destination);
    noise.start();

    source = noise;
    filter = band;
    gain = out;
    return { ctx, filter: band, gain: out };
  } catch {
    return null;
  }
}

function cancelSuspend(): void {
  if (suspendTimer === null) return;
  clearTimeout(suspendTimer);
  suspendTimer = null;
}

/** Rampe le gain vers zéro : une coupure sèche produit un clic audible. */
function rampToSilence(): void {
  if (!context || !gain) return;
  const now = context.currentTime;
  const level = gain.gain;
  level.cancelScheduledValues(now);
  level.setValueAtTime(level.value, now);
  level.linearRampToValueAtTime(0, now + TARGET_TIME);
}

/**
 * Coupe le son et suspend le contexte : sans cela, une boucle de bruit blanc
 * continuerait de tourner toute la session après la fermeture du ticket.
 */
export function suspendScratchAudio(): void {
  try {
    if (!context || !gain) return;
    const ctx = context;
    rampToSilence();
    cancelSuspend();
    suspendTimer = setTimeout(() => {
      suspendTimer = null;
      try {
        if (ctx.state === 'running') void ctx.suspend().catch(() => undefined);
      } catch {
        // Contexte déjà fermé : rien à suspendre.
      }
    }, SUSPEND_DELAY_MS);
  } catch {
    // Rien à faire : le silence est déjà l'état par défaut.
  }
}

export function setScratchAudioEnabled(next: boolean): void {
  enabled = next;
  if (next) {
    cancelSuspend();
    try {
      if (context && context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }
    } catch {
      // Contexte indisponible : le prochain geste le recréera.
    }
    return;
  }
  suspendScratchAudio();
}

export function primeScratchAudio(): void {
  try {
    const graph = ensureGraph();
    if (!graph) return;
    if (graph.ctx.state === 'suspended') {
      void graph.ctx.resume().catch(() => undefined);
    }
  } catch {
    // Contexte indisponible : on garde le silence.
  }
}

export function scratchTone(speed: number): void {
  try {
    const graph = ensureGraph();
    if (!graph) return;
    if (graph.ctx.state === 'suspended') {
      void graph.ctx.resume().catch(() => undefined);
    }
    const tone = scratchAudioTone(speed);
    const now = graph.ctx.currentTime;
    graph.filter.frequency.setTargetAtTime(tone.frequency, now, TARGET_TIME);
    graph.gain.gain.setTargetAtTime(tone.gain, now, TARGET_TIME);
  } catch {
    // Le son est un ornement : il ne bloque jamais le geste.
  }
}

export function silenceScratch(): void {
  try {
    rampToSilence();
  } catch {
    // Déjà silencieux.
  }
}
