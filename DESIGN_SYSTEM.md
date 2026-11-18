# HEXAGONE — Design System & UI Architecture Specification

> **MANDATORY INSTRUCTION FOR AI AGENTS (DeepSeek / OpenCode):**
> You MUST strictly adhere to every token, class map, and DOM structure defined in this document when creating or modifying files in `apps/web`. Do NOT improvise colors, gradients, shadows, or layouts outside these rules.

> **Revision 2 — aligned with the Phase 11 codebase.**
> This document previously described a 5-tier rarity map and a `tailwind.config.ts`. Both were wrong:
> the domain has **6 rarity tiers** (`packages/shared/src/rarity.ts`) and this repo is **Tailwind v4
> CSS-first** with no config file. Read §3 before touching any rarity or token. See `ROADMAP.md`
> Phase 13 for the migration plan.

---

## 1. Visual Direction & Core Philosophy

**Theme:** *"IGN Topographic Cartography & French Road Signage"*
The interface merges the tactile precision of French *Institut Géographique National (IGN)* paper maps with the utilitarian clarity of French municipal signage (enameled street plaques, Michelin milestones, and EB10 city-entry road signs).

### Core Engineering Constraints

1. **Language:** Code, props, and variables in **English**. All user-facing UI labels in **French exclusively** (hardcoded, no i18n library).
2. **Zero External Assets:** No external image URLs, no `<img>` tags pointing to third-party APIs, **no font CDN**. All visuals use pure CSS and inline SVG; fonts are self-hosted `woff2` files under `apps/web/public/fonts/`. Runtime network calls to any third-party origin are forbidden.
3. **Flat DOM Budget (Virtualization Critical):** Every `<Card/>` component rendered inside `@tanstack/react-virtual` MUST contain **at most 12 DOM nodes** (root element included). Decorative rivets, filigree, and inner frames MUST be drawn with `::before` / `::after` or `box-shadow`, never with extra elements.
4. **60 FPS Scrolling & Scratching:** Zero expensive CSS filters (`backdrop-blur`, `filter: drop-shadow`, `mix-blend-mode`) inside scrollable grids or around `<ScratchCell/>`.

---

## 2. Forbidden Patterns (Anti-Hallucination Guardrails)

You are **STRICTLY FORBIDDEN** from using the following Tailwind classes or patterns anywhere in `apps/web`:

- **NO gradients of any kind:** Forbidden: `bg-gradient-to-*`, `from-*`, `via-*`, `to-*`, `bg-radial`, `bg-conic`, and any `linear-gradient()` / `conic-gradient()` in `styles.css` or inline styles. Rarity and depth are expressed with solid surfaces, border weight, and hard-edged offset shadows only. *(This replaces the previous "no arbitrary SaaS gradients" rule: the exemption that allowed rarity gradients is withdrawn.)*
- **NO blend modes or filters:** Forbidden: `mix-blend-mode`, `backdrop-blur-*`, `filter`, `drop-shadow`.
- **NO glassmorphism:** Forbidden: `bg-white/10`, `bg-black/20`. Use opaque borders and high-contrast solid surfaces.
- **NO soft floating shadows:** Forbidden: `shadow-sm`, `shadow-lg`, `shadow-xl`, `shadow-2xl` on cards, rows, and panels. Use crisp hard-edge borders (`border`, `border-2`) or tactile offset shadows (`shadow-tactile`, `shadow-tactile-sm`, `shadow-tactile-lg`).
- **NO pill-shaped cards:** Forbidden: `rounded-2xl`, `rounded-3xl`, `rounded-full` on cards or panels. Use `rounded-md` (6px) or `rounded-sm` (4px) to mimic cut paper and metal signage. (`rounded-full` remains legal for the currency pill and status dots.)
- **NO layout animations in lists:** Forbidden: `transition-all`, `animate-pulse`, `hover:scale-*` inside `@tanstack/react-virtual` rows. Use `transition-colors duration-150` only.
- **NO hardcoded color literals in components:** Colors come from the §3 tokens. Arbitrary values such as `bg-[#FAF8F5]` are forbidden outside `styles.css`.
- **NO React state for the scratch canvas:** see `.docs/01-architecture.md` §4.6. `ref` + `requestAnimationFrame` + native events only.

---

## 3. Tailwind v4 Tokens (`apps/web/src/styles.css`)

This project uses **Tailwind CSS v4 (CSS-first)** through `@tailwindcss/vite`. There is **no `tailwind.config.ts`** and there must never be one — it would silently not be loaded.

Declare tokens once, in `apps/web/src/styles.css`:

```css
@import "tailwindcss";

@theme {
  /* ── Typography ───────────────────────────────────────────── */
  --font-sans: "Space Grotesk", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  /* ── Cartographic surfaces (light / paper mode by default) ── */
  --color-canvas: #F4F1EA;   /* topographic warm paper background */
  --color-surface: #FFFFFF;  /* card & panel background */
  --color-paper: #FAF8F5;    /* aged map paper (Région cards) */
  --color-muted: #E6E2D8;    /* inactive slots, secondary containers */
  --color-border: #1E293B;   /* crisp ink border (Slate 800) */

  /* ── Inks ─────────────────────────────────────────────────── */
  --color-ink: #0F172A;              /* primary text (Slate 900) */
  --color-ink-secondary: #475569;    /* subtitles, metadata (Slate 600) */
  --color-ink-muted: #94A3B8;        /* placeholders, disabled (Slate 400) */
  --color-ink-inverse: #F8FAFC;      /* text on dark signage */

  /* ── Authentic French signage & IGN accents ───────────────── */
  --color-sign-blue: #003399;   /* Parisian enameled street plaque blue */
  --color-sign-green: #005C36;  /* historical / floral street plaque green */
  --color-sign-red: #D92323;    /* national road / city-entry border red */
  --color-sign-ochre: #C25E00;  /* IGN contour line brown / ochre */
  --color-sign-gold: #D97706;   /* departmental heraldic gold */

  /* ── Tactile offset shadows (no blur, ever) ───────────────── */
  --shadow-tactile-sm: 1px 1px 0px 0px #0F172A;
  --shadow-tactile: 2px 2px 0px 0px #0F172A;
  --shadow-tactile-lg: 4px 4px 0px 0px #0F172A;
}

@layer base {
  body {
    background-color: var(--color-canvas);
    color: var(--color-ink);
    font-family: var(--font-sans);
    -webkit-tap-highlight-color: transparent;
  }
}
```

### 3.1 Self-hosted fonts

```css
@font-face {
  font-family: "Space Grotesk";
  src: url("/fonts/SpaceGrotesk-Variable.woff2") format("woff2-variations");
  font-weight: 300 700;
  font-display: swap;
}

@font-face {
  font-family: "JetBrains Mono";
  src: url("/fonts/JetBrainsMono-Variable.woff2") format("woff2-variations");
  font-weight: 100 800;
  font-display: swap;
}
```

Files live in `apps/web/public/fonts/` and are preloaded from `index.html` with `<link rel="preload" as="font" type="font/woff2" crossorigin>`. Subset must cover `latin` + `latin-ext` (French accents). No Google Fonts, no CDN.

### 3.2 Deterministic Rarity Theme Map

**The domain defines SIX tiers.** The single source of truth is `packages/shared/src/rarity.ts`:

```ts
export const RARITY = [
  'COMMUNE',
  'INHABITUELLE',
  'RARE',
  'EPIQUE',
  'LEGENDAIRE',
  'MYTHIQUE',
] as const;

export type Rarity = (typeof RARITY)[number];
```

Create `apps/web/src/lib/rarity-theme.ts` and use it **everywhere** rarity is displayed. Never invent ad-hoc rarity colors in a component, and never re-declare a `RarityBadge` locally:

```ts
// apps/web/src/lib/rarity-theme.ts
import type { Rarity } from '@hexamap/shared';

export const RARITY_THEME: Record<
  Rarity,
  {
    label: string;
    borderClass: string;
    badgeBgClass: string;
    badgeTextClass: string;
    accentHex: string;
  }
> = {
  COMMUNE: {
    label: 'Commune',
    borderClass: 'border-slate-400',
    badgeBgClass: 'bg-slate-200',
    badgeTextClass: 'text-slate-800',
    accentHex: '#64748B',
  },
  INHABITUELLE: {
    label: 'Peu commune',
    borderClass: 'border-emerald-700',
    badgeBgClass: 'bg-emerald-100',
    badgeTextClass: 'text-emerald-900',
    accentHex: '#047857',
  },
  RARE: {
    label: 'Rare',
    borderClass: 'border-blue-700',
    badgeBgClass: 'bg-blue-100',
    badgeTextClass: 'text-blue-900',
    accentHex: '#1D4ED8',
  },
  EPIQUE: {
    label: 'Épique',
    borderClass: 'border-purple-800',
    badgeBgClass: 'bg-purple-100',
    badgeTextClass: 'text-purple-900',
    accentHex: '#6B21A8',
  },
  LEGENDAIRE: {
    label: 'Légendaire',
    borderClass: 'border-amber-600 border-r-4 border-b-4',
    badgeBgClass: 'bg-amber-100',
    badgeTextClass: 'text-amber-950',
    accentHex: '#C25E00',
  },
  MYTHIQUE: {
    label: 'Mythique',
    borderClass: 'border-sign-gold ring-1 ring-sign-gold',
    badgeBgClass: 'bg-amber-50',
    badgeTextClass: 'text-amber-950',
    accentHex: '#D97706',
  },
};
```

**Tier separation rule.** The six tiers form a single hue ramp — *slate → emerald → blue → purple → ochre → gold* — and the two top tiers are separated by **structure, not by a new hue**:

- `LEGENDAIRE` (ochre, `#C25E00`) is distinguished by a **thickened offset border** (`border-r-4 border-b-4`), reading as embossed card stock.
- `MYTHIQUE` (gold, `#D97706`) is distinguished by a **double outline** (`border-sign-gold` + `ring-1 ring-sign-gold`), reading as struck metal.

Do not introduce a seventh treatment (glow, foil sweep, holo shift). Those were removed in Revision 2.

**Label ownership.** French labels come from `RARITY_LABELS` in `packages/shared/src/rarity.ts`; this file re-exports them through `label`. `packages/spec/src/rarity.spec.ts` asserts that `RARITY_LABELS` and `RARITY_THEME` both cover exactly `RARITY` — a missing tier is a test failure, not a visual bug.

---

## 4. Typography & Numeric Rules

1. **Headings & Signage (`font-sans`):**
   - Page titles: `text-xl md:text-2xl font-bold tracking-tight text-ink uppercase`
   - Card titles (Place names): `font-bold tracking-tight uppercase leading-tight line-clamp-2`
2. **Numeric Data (`font-mono tabular-nums` — MANDATORY):**
   - Every number in the application (INSEE codes, department numbers, population counts, street occurrence counts, score points, rarity odds, multipliers `x1.0`–`x5.0`, prices, and currency balances) MUST use `font-mono tabular-nums`.
   - Format French numbers using `Intl.NumberFormat('fr-FR')` (e.g., `12 450 hab.`, `1 250 ⬢`).
   - The multiplier is rendered with the French decimal comma: `×1,0`, `×1,5`, `×2,5`, `×5,0`.

---

## 5. Procedural Card Templates (Pure CSS/SVG, Flat DOM)

All cards share a strict outer container: `aspect-[3/4] w-full rounded-md border-2 bg-surface p-2.5 flex flex-col justify-between select-none relative overflow-hidden`.

Each of the four templates MUST stay at or below 12 DOM nodes. The node count for each is stated below and is asserted by `packages/e2e/tests/design-system.spec.ts`.

### 5.1. Carte « Région » — IGN topography · **10 nodes**

- **Visual Identity:** Ochre topographic contour lines (`--color-sign-ochre`) on aged map paper (`bg-paper`).
- **DOM Structure:** `div` → `div.header` → `span.badge` → `span.rarity` → `svg` → 3 × `path` → `div.center` → `div.insee` → `h3` → `div.footer` → 2 × `span`.
  To stay inside the budget, the header/category labels share one element and the footer metrics share one element.

```tsx
<div className={`aspect-[3/4] rounded-md border-2 ${rarity.borderClass} bg-paper p-2.5 flex flex-col justify-between relative overflow-hidden shadow-tactile-sm`}>
  {/* 1 node, 3 paths — decorative, aria-hidden */}
  <svg aria-hidden="true" className="absolute inset-0 h-full w-full opacity-20 pointer-events-none" viewBox="0 0 100 140" fill="none">
    <path d="M-10 30 C 30 10, 70 50, 110 25 C 75 70, 25 90, -10 110 Z" stroke="currentColor" strokeWidth="1.2" className="text-sign-ochre" />
    <path d="M10 45 C 40 30, 65 55, 95 40 C 70 75, 35 85, 10 100 Z" stroke="currentColor" strokeWidth="1" className="text-sign-ochre" />
    <path d="M25 60 C 45 50, 60 65, 80 55 C 65 75, 45 80, 25 88 Z" stroke="currentColor" strokeWidth="0.8" className="text-sign-ochre" />
  </svg>

  <div className="z-10 flex items-center justify-between gap-1">
    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-secondary">Région</span>
    <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-mono font-bold ${rarity.badgeBgClass} ${rarity.badgeTextClass}`}>{rarity.label}</span>
  </div>

  <div className="z-10 my-auto px-1 text-center">
    <div className="mb-0.5 text-xs font-mono tabular-nums text-ink-secondary">INSEE {code}</div>
    <h3 className="text-sm font-bold uppercase tracking-tight text-ink line-clamp-2 md:text-base">{name}</h3>
  </div>

  <div className="z-10 flex items-center justify-between border-t border-slate-300 pt-1.5 text-[11px] font-mono tabular-nums text-ink-secondary">
    <span>+{basePoints} pts</span>
    <span>IGN-REG</span>
  </div>
</div>
```

### 5.2. Carte « Département » — milestone & shield · **7 nodes**

- **Visual Identity:** A highway milestone. A large watermark department code (`01`–`976`, including Corsica `2A`/`2B` and overseas `971`–`976`) sits behind a geometric shield holding the code again at reading size.
- **Shield geometry:** produced with `clip-path` on a bordered box — **not** an extra SVG node, and never a raster asset.
- **DOM Structure:** `div` → `div.watermark` → `div.shield` → `h3` → `div.code` → `div.footer` → 2 × `span`.

```tsx
<div className={`aspect-[3/4] rounded-md border-2 ${rarity.borderClass} bg-surface p-2.5 flex flex-col justify-between relative overflow-hidden shadow-tactile-sm`}>
  {/* Watermark: the department number, oversized and nearly transparent */}
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-[7rem] font-mono font-black leading-none text-ink/10 select-none">
    {code}
  </div>

  <div className="relative z-10 mx-auto my-auto w-full max-w-[7rem]">
    <div
      className="border-2 border-ink bg-paper px-2 py-3 text-center shadow-tactile-sm"
      style={{ clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)' }}
    >
      <div className="text-2xl font-mono font-black tabular-nums leading-none text-ink">{code}</div>
    </div>
  </div>

  <div className="relative z-10 text-center">
    <h3 className="text-xs font-bold uppercase tracking-tight text-ink line-clamp-2 md:text-sm">{name}</h3>
  </div>

  <div className="relative z-10 flex items-center justify-between border-t border-slate-300 pt-1.5 text-[11px] font-mono tabular-nums text-ink-secondary">
    <span>DÉP.</span>
    <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${rarity.badgeBgClass} ${rarity.badgeTextClass}`}>{rarity.label}</span>
  </div>
</div>
```

### 5.3. Carte « Commune » — French EB10 city-entry sign · **9 nodes**

- **Visual Identity:** The iconic French municipal boundary plate: white rectangular field, thick red inner rule (`border-2 border-sign-red`), heavy uppercase black typography.
- **DOM Structure:** card → header(2 spans → the header itself counts 1) → `div.sign` → `h3` → `div.population` → `div.footer` → `span.score` → `span.insee`.

```tsx
<div className={`aspect-[3/4] rounded-md border-2 ${rarity.borderClass} bg-surface p-2.5 flex flex-col justify-between shadow-tactile-sm`}>
  <div className="flex items-center justify-between">
    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-secondary">Commune</span>
    <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-mono font-bold ${rarity.badgeBgClass} ${rarity.badgeTextClass}`}>{rarity.label}</span>
  </div>

  <div className="mx-0.5 my-auto rounded-sm border-2 border-sign-red bg-white px-2 py-2.5 text-center">
    <h3 className="text-xs font-black uppercase tracking-tight text-ink line-clamp-2 md:text-sm">{name}</h3>
    <div className="mt-1 inline-block rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-ink-secondary">
      {formattedPopulation} hab.
    </div>
  </div>

  <div className="flex items-center justify-between border-t border-slate-300 pt-1.5 text-[11px] font-mono tabular-nums text-ink-secondary">
    <span>{score} pts</span>
    <span>{inseeCode}</span>
  </div>
</div>
```

### 5.4. Carte « Rue » — French enameled street plaque · **6 nodes**

- **Visual Identity:** Enameled metal street sign — deep blue (`bg-sign-blue`) or green (`bg-sign-green` for `RARE` and above) — with a thin white inner frame and white uppercase typography.
- **Rivets:** four corner rivets are drawn with **`::before` / `::after` + `box-shadow`**, never with elements. This is what keeps the template at 6 nodes.
- **Plate color:** `bg-sign-blue` for `COMMUNE` / `INHABITUELLE`, `bg-sign-green` for `RARE` and above — i.e. `isHighRarity = RARITY.indexOf(rarity) >= RARITY.indexOf('RARE')`.
- **DOM Structure:** `div` → `div.inner` → `h3` → `div.footer` → `span.occurrences` → `span.rarity`.

```tsx
<div className={`aspect-[3/4] rounded-md border-2 ${rarity.borderClass} p-2 ${isHighRarity ? 'bg-sign-green' : 'bg-sign-blue'} flex flex-col justify-between relative shadow-tactile-sm rue-plaque`}>
  <div className="border border-white/80 px-2 py-2 text-center">
    <h3 className="text-xs font-bold uppercase tracking-wide leading-snug text-white line-clamp-2 md:text-sm">{name}</h3>
  </div>

  <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-white/90">
    <span>{occurrenceCount} rép. FR</span>
    <span className="rounded-sm bg-white px-1.5 py-0.5 font-bold text-sign-blue">{rarity.label}</span>
  </div>
</div>
```

```css
/* apps/web/src/styles.css — rivets without extra DOM nodes */
.rue-plaque::before,
.rue-plaque::after {
  content: "";
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.35);
}
.rue-plaque::before { top: 6px; left: 6px; box-shadow: 0 0 0 1px rgba(15,23,42,.35), 999px 0 0 -0 rgba(255,255,255,.75); }
.rue-plaque::after  { bottom: 6px; right: 6px; box-shadow: 0 0 0 1px rgba(15,23,42,.35), -999px 0 0 -0 rgba(255,255,255,.75); }
```

---

## 6. Core Screen Layouts & Navigation Architecture

### 6.1. Responsive Shell (`apps/web/src/components/layout/app-shell.tsx`)

Three regions, one shell. Implemented in Phase 14.

- **Top Header (sticky, `h-14`):** `sticky top-0 z-30 h-14 border-b-2 border-border bg-surface pt-[env(safe-area-inset-top)]`
  - Left: Hexagone geometric logo (inline SVG hexagon) + current view title in French.
  - Right: user currency pill `bg-surface border-2 border-border shadow-tactile-sm px-3 py-1 rounded-sm font-mono tabular-nums font-bold text-sm` + compact profile/logout.
- **Desktop Navigation (`components/layout/sidebar.tsx`):** `hidden md:flex md:w-60 md:flex-col border-r-2 border-border bg-surface fixed inset-y-0 left-0`
  - 4 primary links: *Tickets à Gratter* (`/`), *Ma Collection* (`/collection`), *Tableau de Combo* (`/tableau`), *Marché National* (`/market`).
  - 2 secondary links: *Mes tableaux* (`/tableaux`), *Mes ventes* (`/market/mine`).
  - `aria-current="page"` on the active entry.
- **Mobile Navigation (`components/layout/bottom-tab-bar.tsx`):** `fixed bottom-0 inset-x-0 z-40 flex md:hidden h-16 border-t-2 border-border bg-surface pb-[env(safe-area-inset-bottom)]`
  - 4 equal-width tabs (`flex-1 flex flex-col items-center justify-center text-xs font-medium`), each with `min-h-11` (44 px minimum touch target).
  - Active tab: `bg-amber-100/70 text-ink font-bold border-t-2 border-ink`.
- **Content column:** `md:pl-60 pb-20 md:pb-8`.

`viewport-fit=cover` is required in `index.html` before any `env(safe-area-inset-*)` resolves to a non-zero value.

### 6.2. Scratch Ticket View (`4x4` Grid & `<ScratchCell/>`)

- **Ticket Container:** Looks like an official physical French scratch card — `bg-surface border-2 border-border rounded-md p-3 md:p-5 shadow-tactile-lg max-w-xl mx-auto`.
- **Grid:** `grid grid-cols-4 gap-2 md:gap-3` inside an `overscroll-none` fieldset.
- **Foil Overlay (`<canvas>`):**
  - Must have `className="absolute inset-0 w-full h-full touch-none select-none cursor-crosshair z-20"`.
  - Paint the untouched canvas with a metallic silver-slate hatch (`--color-ink-muted` base with `#CBD5E1` diagonal cross-lines and a centered `HEXAGONE` or `?` stamp) so it feels tactile without external textures. **Flat fills only — no `createLinearGradient`.**
  - The brush radius is derived from the cell size via `scratchBrushRadius(width, height)` from `@hexamap/shared`, never a constant.
  - Reveal threshold is `SCRATCH_REVEAL_THRESHOLD = 0.4` from `@hexamap/shared`. 40 % cleared pixels, measured on the canvas backing store, fires exactly one server mutation.
  - **Zero React state.** All mutable scratch state lives in `useRef`. Event handling is Pointer Events only (`pointerdown` / `pointermove` / `pointerup` / `pointercancel` / `pointerleave`) with `setPointerCapture`, batched through `requestAnimationFrame`.

### 6.3. Combo Board View (4-Card Geographic Alignment)

- Displays the 4 active slots in strict hierarchical order: **1. Région** → **2. Département** → **3. Commune** → **4. Rue**.
- **Layout:** `grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch`. Connectors are drawn *between* slots on `lg` and collapse into per-slot badges below `lg`.
- **Validation source:** the connector state comes **only** from `GET /api/v1/tableaux/preview` → `alignment.links[].valid`. Never recompute geographic alignment or the multiplier in the browser — import `evaluateTableauAlignment` / `tableauScore` / `TABLEAU_LINK_LABELS` from `@hexamap/shared` when a label is needed.
- **Link badges:**
  - Valid: `bg-emerald-100 text-emerald-900 border border-emerald-700 font-mono text-xs px-2 py-0.5` — `✓ Aligné`
  - Broken: `bg-slate-200 text-slate-600 border border-slate-400 font-mono text-xs px-2 py-0.5` — `✗ Hors-zone`
- **Multiplier callout:** a high-contrast scoreboard box showing `Score de base × Multiplicateur (×1,0 – ×5,0) = Score Final` in `font-mono tabular-nums text-lg md:text-2xl font-black`, wrapped in `aria-live="polite"`.

### 6.4. Virtualized Collection & Market

Both views are virtualization-first. There is **no `@tanstack/react-table` in the market** — the market is a paginated card grid. `@tanstack/react-table` (v9 `tableFeatures`) is used **only** in the collection.

- **Collection (`components/…/collection.tsx`, `@tanstack/react-virtual` + `@tanstack/react-table`):**
  - Desktop (`md:` and up) — a virtualized **row table** with columns *Carte*, *Type*, *Rareté*, *Score*, *Acquise le*, *Verrouillée*. Row height is fixed (`estimateSize: () => 84`) so virtualization stays O(1).
  - Mobile (`< md:`) — the same virtualized row list with a condensed template: hide *Score*, *Acquise le*, and *Verrouillée*; the row becomes card thumbnail + name + rarity badge in a 2-track grid. **Never** switch virtualization strategies on breakpoint; hide cells instead.
  - Filter bar fixed above the scroller: type selector (*Tous, Régions, Départements, Communes, Rues*), rarity selector, search input `h-10 border-2 border-border rounded-sm px-3 bg-surface text-sm`.
  - The header row and the row cells MUST share one `gridTemplate` constant, otherwise columns desynchronize.
- **Market (`market.index.tsx`):**
  - Responsive card grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`. Paginated at 20 (`limit = 20`), so no virtualizer is required.
  - Mobile: compact variant — thumbnail `w-16`, meta stacked, price in `font-mono tabular-nums`.
  - **Anti-Double-Tap Rule:** the *Acheter* button (`bg-ink text-white font-mono text-xs px-3 py-2 rounded-sm shadow-tactile-sm active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 touch-manipulation`) MUST be scoped to the row being mutated: `disabled={mutation.isPending && mutation.variables?.id === listing.id}`, plus `aria-busy`. A shared global `isPending` is not acceptable — it freezes the whole market on one purchase.
  - Desktop (`md:`) additionally shows *Vendeur* and *Statistique (Pop./Rép.)*; both are hidden below `md`.

---

## 7. Phase Mapping

| Phase | What this document governs |
| :--- | :--- |
| 12 | Nothing. Build/container work only. |
| 13 | §3 tokens and fonts, §3.2 rarity theme, §4 typography, §5 all four templates, §6.3 combo board. |
| 14 | §6.1 shell and navigation, §6.2 scratch canvas, §6.4 collection/market, §1.3 DOM budget enforcement. |
| 15 | §1.2 (fonts already self-hosted, so the SW can precache them), §6.1 safe-area insets verified in `standalone` display mode. |

Enforcement lives in `packages/e2e/tests/design-system.spec.ts` (tokens, no-gradient, tabular numbers, 12-node budget, four distinct templates) and `packages/spec/src/rarity.spec.ts` (six-tier coverage).

---

## 8. Delta from Revision 1

| Item | Revision 1 (wrong) | Revision 2 |
| :--- | :--- | :--- |
| Rarity tiers | 5 (`COMMON/UNCOMMON/RARE/EPIC/MYTHIC`) | **6** (`COMMUNE/INHABITUELLE/RARE/EPIQUE/LEGENDAIRE/MYTHIQUE`) |
| Config location | `apps/web/tailwind.config.ts` | `@theme` in `apps/web/src/styles.css` (Tailwind v4 CSS-first) |
| Gradients | allowed for rarity foils | **forbidden everywhere** |
| Top tier color | `MYTHIC` = amber (collided with `LEGENDAIRE`'s position) | `LEGENDAIRE` = ochre + thick offset border; `MYTHIQUE` = gold + double outline |
| Département template | prose only | full 7-node JSX |
| Market component | `@tanstack/react-table` table | paginated card grid; react-table lives in the collection |
| Collection layout | 2/3/4/5-column card grid | virtualized row table, condensed on mobile |
| Fonts | implied CDN usage | self-hosted `woff2` under `apps/web/public/fonts/` |
| `paper` surface | hardcoded `bg-[#FAF8F5]` | `--color-paper` token |
