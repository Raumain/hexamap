import type { Category, Rarity } from '@hexamap/shared';

export const RARITY_CARD_STYLES: Record<Rarity, string> = {
  COMMUNE: 'border-slate-500/60 bg-gradient-to-tr from-slate-800 to-slate-900',
  INHABITUELLE: 'border-emerald-500/70 bg-gradient-to-tr from-emerald-950 to-slate-900',
  RARE: 'border-blue-500/70 bg-gradient-to-tr from-blue-950 to-slate-900',
  EPIQUE: 'border-violet-500/80 bg-gradient-to-tr from-violet-950 to-slate-900 card-foil',
  LEGENDAIRE:
    'border-amber-400/90 bg-gradient-to-tr from-amber-950 to-slate-900 card-foil card-glow',
  MYTHIQUE:
    'border-fuchsia-400/90 bg-gradient-to-tr from-fuchsia-950 via-violet-950 to-slate-900 card-holo card-glitch',
};

export const RARITY_TEXT: Record<Rarity, string> = {
  COMMUNE: 'text-slate-300',
  INHABITUELLE: 'text-emerald-300',
  RARE: 'text-blue-300',
  EPIQUE: 'text-violet-300',
  LEGENDAIRE: 'text-amber-300',
  MYTHIQUE: 'text-fuchsia-300',
};

export const CATEGORY_ACCENT: Record<Category, string> = {
  REGION: 'text-amber-300',
  DEPARTEMENT: 'text-sky-300',
  COMMUNE: 'text-emerald-300',
  RUE: 'text-white',
};
