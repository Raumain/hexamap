# HEXAGONE — Design System & UI Architecture Specification

> **MANDATORY INSTRUCTION FOR AI AGENTS (DeepSeek / OpenCode):**
> You MUST strictly adhere to every token, class map, and DOM structure defined in this document when creating or modifying files in `apps/web`. Do NOT improvise colors, gradients, shadows, or layouts outside these rules.

> **Revision 2 — aligned with the Phase 11 codebase.**
> This document previously described a 5-tier rarity map and a `tailwind.config.ts`. Both were wrong:
> the domain has **6 rarity tiers** (`packages/shared/src/rarity.ts`) and this repo is **Tailwind v4
> CSS-first** with no config file. Read §3 before touching any rarity or token. See `ROADMAP.md`
> Phase 13 for the migration plan.

> **Revision 3 — mise en œuvre (phase 13, branche `feat/phase-13-design-system`).**
> Ce document est désormais la description de ce qui est **livré**, pas une cible.
> Quatre corrections de spec : les budgets DOM du §5 sont les **comptes mesurés** (§5 dit
> « racine + descendants non-SVG ≤ 12 », les internes d'un `<svg>` ne comptent pas) ; la
> plaque de rue n'a que **deux rivets** (l'astuce `999px` du §5.4 était invalide en CSS, voir
> §5.4) ; les polices sont livrées en **deux sous-ensembles** par famille (§3.1) ; et
> `alignment.links` est un **nombre**, pas un tableau (§6.3). Les écarts assumés sont listés
> au §9.

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

Each family ships **two static subset files**, split by `unicode-range` — not one variable
file. Four `@font-face` rules, declared next to the `@theme` block in `styles.css`:

```css
/* Space Grotesk — latin */
@font-face {
  font-family: "Space Grotesk";
  src: url("/fonts/SpaceGrotesk-latin.woff2") format("woff2");
  font-weight: 300 700;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
    U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191,
    U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* Space Grotesk — latin-ext (français accentué) */
@font-face {
  font-family: "Space Grotesk";
  src: url("/fonts/SpaceGrotesk-latin-ext.woff2") format("woff2");
  font-weight: 300 700;
  font-display: swap;
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF,
    U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
```

Les mêmes deux règles existent pour `JetBrains Mono` (`JetBrainsMono-latin.woff2` et
`JetBrainsMono-latin-ext.woff2`, `font-weight: 100 800`).

Les cinq fichiers (`SpaceGrotesk-latin.woff2`, `SpaceGrotesk-latin-ext.woff2`,
`JetBrainsMono-latin.woff2`, `JetBrainsMono-latin-ext.woff2`, `OFL.txt`) vivent dans
`apps/web/public/fonts/` et sont versionnés. Ils viennent des sous-ensembles Fontsource ;
`OFL.txt` porte la licence **SIL Open Font License** et doit rester à côté des fichiers.

`apps/web/index.html` précharge les **deux fichiers `latin` seulement** avec
`<link rel="preload" as="font" type="font/woff2" crossorigin>` : le `latin-ext` n'est
téléchargé que si un caractère le réclame. Aucune Google Fonts, aucun CDN, aucune requête
réseau tierce au runtime.

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

### 5.0. Budget DOM — règle de comptage

**Le budget se mesure sur l'élément racine plus tous ses descendants non-SVG : ≤ 12 nœuds.**
Les enfants internes d'un `<svg>` (`path`, `line`, `circle`…) ne sont **pas** des nœuds du
budget : ce sont des instructions de dessin, pas des boîtes de layout, et
`@tanstack/react-virtual` ne paie pas leur coût. Le `<svg>` lui-même compte pour un nœud.

`packages/e2e/tests/design-system.spec.ts` applique exactement cette règle : il compte les
nœuds sous la carte et exclut le sous-arbre d'un `<svg>`. Les quatre comptes ci-dessous sont
les valeurs **mesurées** dans le DOM rendu, racine incluse :

| Modèle | Racine + descendants non-SVG | Avec le blason `<img>` |
| :--- | :--- | :--- |
| Région | **11** | — (blason en fond CSS) |
| Département | **9** | — (blason en fond CSS) |
| Commune | **10** | **11** (blason dans le cartouche EB10) |
| Rue | **6** | aucun blason |

Aucun gabarit ne dépasse 12. Rivets, filets et cadres internes restent en `::before` /
`::after`, en `border` ou en `background`, jamais en éléments supplémentaires.

### 5.0.1. Politique du blason

Le blason réel n'est **jamais** un nœud décoratif libre. Trois traitements, un par famille :

- **Région et Département : calque de fond CSS.** Le blason est posé en
  `background-image` / `background-position` sur un conteneur existant. Il ne crée aucun
  nœud et ne peut pas casser le budget. Il est décoratif : pas de texte alternatif, il ne
  participe pas à l'information accessible (le nom de la carte la porte déjà).
- **Commune : un seul `<img>`**, à l'intérieur du cartouche EB10, avec `alt` vide et
  `aria-hidden` (même raison). C'est le seul blason qui coûte un nœud : 11 au lieu de 10.
- **Rue : aucun blason.** Une plaque de rue n'en porte pas.

Le blason est un asset statique servi par l'API sur `/blasons/*` (§4.7 de
`.docs/01-architecture.md`) ; `blasonUrl` et `blasonCredit` viennent de la charge utile. Une
carte sans armoiries retombe sur `contour_url`.

### 5.1. Carte « Région » — IGN topography · **11 nœuds mesurés**

- **Visual Identity:** Ochre topographic contour lines (`--color-sign-ochre`) on aged map paper (`bg-paper`).
- **DOM Structure:** `div` (racine) → `div.header` → `span.badge` → `span.rarity` → `svg` → `div.center` → `div.insee` → `h3` → `div.footer` → 2 × `span`. Les trois `path` du SVG sont internes et hors budget. **Total : 11.**
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

### 5.2. Carte « Département » — milestone & shield · **9 nœuds mesurés**

- **Visual Identity:** A highway milestone. A large watermark department code (`01`–`976`, including Corsica `2A`/`2B` and overseas `971`–`976`) sits behind a geometric shield holding the code again at reading size.
- **Shield geometry:** produced with `clip-path` on a bordered box — **not** an extra SVG node, and never a raster asset.
- **DOM Structure:** `div` (racine) → `div.watermark` → `div` (enveloppe du bouclier) → `div` (face `clip-path`) → `div` (enveloppe du nom) → `h3` → `div.footer` → 2 × `span`. **Total : 9.**
- **Pied de carte : `DÉP. · {score} pts`.** La mention de catégorie et le score partagent un seul `span` de gauche ; le badge de rareté occupe le `span` de droite. Sans cette fusion, le score du département serait invisible sur la carte, alors qu'il est visible sur les trois autres gabarits.

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

### 5.3. Carte « Commune » — French EB10 city-entry sign · **10 nœuds mesurés** (11 avec le blason)

- **Visual Identity:** The iconic French municipal boundary plate: white rectangular field, thick red inner rule (`border-2 border-sign-red`), heavy uppercase black typography.
- **DOM Structure:** `div` (racine) → `div.header` → `span.badge` → `span.rarity` → `div.sign` → `h3` → `div.population` → `div.footer` → `span.score` → `span.insee`. **Total : 10**, plus un `<img>` de blason dans le cartouche EB10 quand `blasonUrl` existe : **11**. Le blason est le seul nœud supplémentaire toléré, et il reste sous le plafond de 12.
- **Population :** la puce `{population} hab.` ne s'affiche que si la charge utile expose `ref_commune.population` ; en son absence le nœud reste présent mais vide, pour ne pas changer le compte de nœuds entre deux rendus.

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

### 5.4. Carte « Rue » — French enameled street plaque · **6 nœuds mesurés**

- **Visual Identity:** Enameled metal street sign — deep blue (`bg-sign-blue`) or green (`bg-sign-green` for `RARE` and above) — with a thin white inner frame and white uppercase typography.
- **Rivets — deux, pas quatre.** Quatre rivets exigeraient de placer un `box-shadow` par rapport au coin opposé de l'élément, ce que CSS ne sait pas faire sans unités de conteneur (`cqw`/`cqi`) : l'astuce `999px` de la Revision 2 était invalide (elle dessine un trait, pas un point, et sort du cadre en `overflow-hidden`). L'implémentation livrée pose donc **deux rivets**, en haut à gauche et en bas à droite, via `::before` / `::after`. C'est un écart assumé, documenté au §9.
- **Plate color:** `bg-sign-blue` for `COMMUNE` / `INHABITUELLE`, `bg-sign-green` for `RARE` and above — i.e. `isHighRarity = RARITY.indexOf(rarity) >= RARITY.indexOf('RARE')`.
- **No score.** La plaque ne porte pas de score, contrairement aux trois autres gabarits ; le score reste lisible sur la fiche et dans la collection.
- **DOM Structure:** `div` (racine) → `div.inner` → `h3` → `div.footer` → `span.occurrences` → `span.rarity`. **Total : 6.** Le `span.occurrences` ne se remplit que si la charge utile expose `ref_odonyme.nb_communes` ; il reste dans le DOM sinon, pour ne pas changer le compte de nœuds.

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
/* apps/web/src/styles.css — deux rivets, sans nœud DOM supplémentaire.
   Un point 4×4 px + un anneau d'encre de 1 px, rien de flouté. */
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
.rue-plaque::before { top: 6px; left: 6px; }
.rue-plaque::after  { bottom: 6px; right: 6px; }
```

Pas de troisième et quatrième rivet sans wrapper dédié : ce serait deux nœuds de plus (8 au
lieu de 6) pour un détail décoratif. La diagonale de deux rivets suffit à lire la plaque
comme un panneau émaillé.

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
- **Layout:** `grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch`. Connecteurs dessinés *entre* les cases **uniquement à partir de `lg`** ; en dessous de `lg` (`grid-cols-2`), la ligne SVG et ses poignées sont masquées et chaque case porte son propre badge `✓` / `✗`. Aucun connecteur ne se dessine dans une grille à deux colonnes : la géométrie ne le permet pas.
- **Validation source:** the connector state comes **only** from the server response of `GET /api/v1/tableaux/preview`. `alignment.links` est un **nombre** (le nombre de liens valides), pas un tableau : ne jamais l'itérer. Le détail par lien est dans `alignment.breakdown[]` — `alignment.breakdown[i].valid` pilote le `✓`/`✗`, `alignment.multiplier` porte le multiplicateur final. Rien de tout cela n'est recalculé dans le navigateur ; importer `TABLEAU_LINK_LABELS` / `TABLEAU_LINK_RULES` depuis `@hexamap/shared` seulement pour un libellé.
- **Link badges:**
  - Valid: `bg-emerald-100 text-emerald-900 border border-emerald-700 font-mono text-xs px-2 py-0.5` — `✓ Aligné`
  - Broken: `bg-slate-200 text-slate-600 border border-slate-400 font-mono text-xs px-2 py-0.5` — `✗ Hors-zone`
- **Multiplier callout:** a high-contrast scoreboard box showing `Score de base × Multiplicateur (×1,0 – ×5,0) = Score Final` in `font-mono tabular-nums text-lg md:text-2xl font-black`, wrapped in `aria-live="polite"`. `MULTIPLIER_TIERS` conserve ses **quatre paliers** mais n'a plus de halo flouté ni de `scale-[1.02]` : le palier actif se distingue par la bordure et le fond, pas par une animation.

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

---

## 9. Écarts assumés — Revision 3 (mise en œuvre de la phase 13)

Quatre points où le code livré s'écarte volontairement de la Revision 2. Aucun n'est un
raccourci : chacun est une contrainte technique ou une décision produit.

1. **Deux rivets au lieu de quatre sur la plaque de rue** (§5.4). CSS ne place pas un
   `box-shadow` par rapport au coin opposé d'un élément sans unités de conteneur ;
   l'astuce `999px` produisait un trait et débordait du cadre `overflow-hidden`. Quatre
   rivets coûteraient deux nœuds de plus, donc 8 au lieu de 6.
2. **Pied de la carte Département : `DÉP. · {score} pts`** (§5.2). Le libellé de catégorie
   et le score partagent un seul élément, sinon le score du département disparaît.
3. **La carte Rue n'affiche pas de score** (§5.4), alors que les trois autres gabarits
   l'affichent. C'est la lecture du panneau : une plaque émaillée ne porte pas de points.
4. **La population de la Commune et le nombre de communes de la Rue sont masqués** tant que
   la charge utile de l'API ne porte pas `ref_commune.population` et
   `ref_odonyme.nb_communes`. Les deux nœuds existent (le budget est stable), mais restent
   vides. C'est un suivi **spec-first** hors phase 13 : d'abord `.docs/02-database.md` et
   `packages/spec`, ensuite le select de l'API.

Deux règles de contrat complètent ces écarts : `alignment.links` est un **nombre** (§6.3), et
le budget DOM se mesure **racine + descendants non-SVG** (§5.0), les internes d'un `<svg>`
étant exclus.
