# HEXAMAP — Le Cabinet de cartographie

> **Design System v4 — remplace intégralement les revisions 1 à 3.**
> Ce document n'est pas une liste de classes : c'est le parti pris visuel du produit.
> Tout ce qui est dans `apps/web` doit pouvoir s'y rattacher. En cas de doute, relire §1.

---

## 1. Le parti pris

Hexamap n'est pas un tableau de bord. C'est **un cabinet de cartographie** : une pièce
sombre, boisée, un peu poussiéreuse, où l'on conserve des planches gravées, des écus, des
vues de villages et des spécimens de rues. Le joueur n'« utilise » pas une application ;
il **ouvre des tiroirs**, **gratte un bordereau**, **épingle une planche**.

Trois conséquences, et elles gouvernent tout le reste :

1. **Le fond est une pièce, pas une page.** Vert-noir profond, lumière chaude tombée d'en
   haut, grain fixe, vignettage. Le contenu est posé *sur* ce fond : feuilles de vélin,
   plateaux de liège, laiton, cire.
2. **Chaque carte est un objet exposé.** Elle a un carton de montage, une planche imprimée,
   une marque de collection. La rareté n'est pas une couleur de badge : c'est **le métal du
   cadre**.
3. **Le temps est lent et cher.** Les animations durent 180 ms pour les micro-états, 320 à
   600 ms pour les révélations. Rien ne rebondit, rien ne clignote, rien ne « pulse ».

La direction précédente — panneaux routiers, EB10, plaques émaillées — est **abandonnée**.
Aucun élément de signalétique routière ne doit subsister. La rue n'est plus une plaque : c'est
un **spécimen typographique**.

### Ce qui a changé par rapport à la v3

| Sujet | v3 (abandonné) | v4 |
| :--- | :--- | :--- |
| Métaphore | carte IGN + panneaux routiers | cabinet de curiosités cartographiques |
| Fond | papier clair `#F4F1EA` | pièce sombre `#0C1210` |
| Objet | carte plate bordée | planche sous carton, éclairée |
| Rareté | badge coloré Tailwind | métal du cadre + sceau de cire |
| Typo | Space Grotesk + JetBrains Mono | Fraunces + Instrument Sans + JetBrains Mono |
| Profondeur | ombres dures 0 px de flou | lumière, vignettage, ombres profondes |
| Effets | tout interdit | autorisés, sauf dans les listes virtualisées et autour du canvas |
| Navigation | barre horizontale | rail de cabinet + barre basse mobile |

---

## 2. Les salles

Chaque route est une salle nommée. Le nom de salle est un titre, pas un libellé de menu.

| Route | Salle | Ce qu'on y fait |
| :--- | :--- | :--- |
| `/` | **Le Relevé** | Ouvrir, gratter et solder le bordereau topographique du jour. |
| `/collection` | **Le Cadastre** | Consulter le registre de ses planches, filtrer, verrouiller. |
| `/tableau` | **La Planche** | Composer une planche à quatre emplacements et lire l'alignement. |
| `/tableaux` | **Les Planches** | Retrouver ses planches enregistrées. |
| `/friends` | **Les Amis** | Ajouter des joueurs, accepter les demandes, tenir son cercle. |
| `/market` | **Le Comptoir** | Parcourir les lots mis en vente, acheter. |
| `/market/mine` | **Mes Offres** | Suivre et retirer ses propres lots. |
| `/card/$cardId` | **Le Cartel** | Lire la fiche complète d'une planche : cartel, lieu, réserves, mise à l'offre. |
| `/players/$playerId` | **La Vitrine** | Lire la fiche publique d'un joueur : complétude, meilleur tableau, médailles, annonces, amis. |
| `/atlas` | **L'Atlas** | Descendre la carte de France : régions, départements, communes, du possédé au couvert. |
| `/guichet` | **Le Guichet** | Lire ce que le cabinet a laissé : demandes d'ami, ventes, médailles. |
| `/palmares` | **Le Palmarès** | Lire le classement hebdomadaire des meilleurs tableaux, au score figé à la soumission. |
| `/login`, `/register` | **Le Seuil** | Entrer dans le cabinet. |

Le vocabulaire est fixe : un **bordereau** (ticket), une **planche** (carte possédée), un
**emplacement** (slot de tableau), un **lot** (annonce), un **écu** (monnaie), un **sceau**
(marque de rareté).

---

## 3. Matière et lumière

Quatre matières, jamais plus.

- **La pièce.** Vert-noir. Deux valeurs seulement : `cabinet` (fond) et `cabinet-raised`
  (meubles, rail, barres). Une vignette chaude tombe du haut du viewport.
- **Le vélin.** Papier os, chaud, légèrement fibreux. C'est la seule surface claire de
  l'application. Une planche, un formulaire, un bordereau sont en vélin.
- **Le laiton.** Filets, vis, étiquettes, boutons primaires, curseurs. Toujours mat, jamais
  chromé. Deux valeurs : `brass` et `brass-deep`.
- **La cire.** Sceaux de rareté, tampons, validation. `oxide` (rouge oxblood) et `verdigris`.

La lumière vient **toujours du haut**. Une planche exposée reçoit un cône de lumière doux
(`radial-gradient` centré à 20 % du haut) et projette une ombre large et basse. Un élément
en creux (case non grattée, emplacement vide) reçoit une ombre *interne*.

### Grain

Une seule couche de grain, fixe, sur `body::after`. Elle est statique (aucune animation),
`pointer-events: none`, et n'entre jamais dans une liste virtualisée : c'est un
pseudo-élément unique sur `body`, pas un `filter` par ligne.

```css
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

### Fibre du vélin

Sur les grandes surfaces en vélin uniquement (planche, formulaire, bordereau) :

```css
.vellum {
  background-color: var(--color-vellum);
  background-image:
    repeating-linear-gradient(92deg, rgb(26 23 18 / 0.025) 0 1px, transparent 1px 4px),
    radial-gradient(120% 90% at 50% 0%, #f6efdf 0%, #ece3d0 60%, #e3d7bf 100%);
  box-shadow: var(--shadow-sheet);
}
```

---

## 4. Jetons

**Un seul propriétaire : `apps/web/src/styles.css`.** Tailwind v4 est CSS-first ; il n'y a
et il n'y aura **jamais** de `tailwind.config.ts`. Toute couleur littérale dans un composant
est un bug.

```css
@theme {
  /* ── La pièce ─────────────────────────────────────────────── */
  --color-cabinet: #0c1210;
  --color-cabinet-raised: #121a16;
  --color-cabinet-sunk: #070c0a;
  --color-veil: #24312b;        /* filet sur fond sombre */
  --color-veil-strong: #3a4a42;

  /* ── Le vélin ─────────────────────────────────────────────── */
  --color-vellum: #efe7d7;
  --color-vellum-2: #e3d7bd;
  --color-vellum-edge: #cbb995;

  /* ── L'encre gravée ───────────────────────────────────────── */
  --color-ink: #1a1712;
  --color-ink-soft: #4a4237;
  --color-ink-faint: #6a5e4c;

  /* ── Le laiton et la cire ─────────────────────────────────── */
  --color-brass: #c6a15b;
  --color-brass-deep: #8a6a2f;
  --color-brass-pale: #e6d3a3;
  --color-oxide: #8e3b2e;
  --color-verdigris: #4e7c6a;
  --color-indigo: #2b3a63;

  /* ── Métaux de rareté (ordre strict) ──────────────────────── */
  --color-metal-etain: #8f979a;
  --color-metal-cuivre: #b2703f;
  --color-metal-argent: #d3d9dd;
  --color-metal-email: #3e5a8a;
  --color-metal-or: #c9a227;
  --color-metal-orichalque: #e8ce8c;

  /* ── Signalétique d'état (rare, jamais décorative) ────────── */
  --color-ok: #5f8f74;
  --color-warn: #c98a3a;
  --color-danger: #b4463a;

  /* ── Typographie ──────────────────────────────────────────── */
  --font-display: "Fraunces", "Iowan Old Style", Palatino, Georgia, serif;
  --font-sans: "Instrument Sans", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* ── Rayons : le papier se coupe, le meuble s'arrondit ────── */
  --radius-sheet: 2px;
  --radius-panel: 14px;
  --radius-pill: 999px;

  /* ── Ombres ───────────────────────────────────────────────── */
  --shadow-sheet: 0 1px 0 rgb(255 255 255 / 0.5) inset, 0 18px 40px -22px rgb(0 0 0 / 0.75);
  --shadow-lifted: 0 28px 60px -28px rgb(0 0 0 / 0.95), 0 2px 0 rgb(0 0 0 / 0.35);
  --shadow-sunk: inset 0 2px 6px rgb(0 0 0 / 0.55), inset 0 0 0 1px rgb(0 0 0 / 0.35);
  --shadow-brass: 0 1px 0 rgb(255 255 255 / 0.18) inset, 0 6px 14px -8px rgb(0 0 0 / 0.8);

  /* ── Mouvement ────────────────────────────────────────────── */
  --ease-cabinet: cubic-bezier(0.22, 1, 0.36, 1);
}
```

### 4.1 Polices

Trois familles, trois métiers, aucun chevauchement.

| Rôle | Famille | Usage |
| :--- | :--- | :--- |
| Éditorial | **Fraunces** | Titres de salle, nom d'une planche, chiffre d'un score, chiffre romain d'un chapitre. `opsz` automatique, `wght` 400–600. |
| Interface | **Instrument Sans** | Corps de texte, libellés, boutons, navigation. 400/500/600. |
| Donnée | **JetBrains Mono** | INSEE, populations, scores, prix, multiplicateurs, numéros de bordereau, étiquettes en capitales. |

Les fichiers sont auto-hébergés dans `apps/web/public/fonts/` en deux sous-ensembles
(`latin`, `latin-ext`) avec `unicode-range` et `font-display: swap`. Fraunces et
Instrument Sans sont variables (`font-weight: 100 900` / `400 700`). Aucun CDN, aucune
requête tierce au runtime. `index.html` précharge les deux fichiers `latin` seulement.

---

## 5. Typographie

### 5.1 Échelle

| Rôle | Classe de référence | Taille |
| :--- | :--- | :--- |
| Titre de salle | `font-display text-4xl md:text-5xl font-semibold tracking-tight` | 36 → 48 px |
| Titre de section | `font-display text-2xl font-semibold` | 24 px |
| Nom sur une planche | `font-display text-lg md:text-xl font-semibold leading-[1.1]` | 18 → 20 px |
| Corps | `text-[15px] leading-relaxed text-ink-soft` | 15 px |
| Étiquette | `font-mono text-[10px] uppercase tracking-[0.16em]` | 10 px |
| Donnée | `font-mono text-[13px] tabular-nums` | 13 px |

**Règle des capitales.** Les capitales espacées sont réservées aux *étiquettes* (catégorie,
salle, état, numéro). Un nom de lieu ne s'écrit jamais tout en capitales : c'est un titre
éditorial, en Fraunces, casse normale. C'est l'inverse exact de la v3.

**Règle des chiffres.** Tout nombre est en `font-mono tabular-nums`, formaté
`Intl.NumberFormat('fr-FR')`. Les grands nombres d'une planche (score) passent en Fraunces
*avec* `font-variant-numeric: lining-nums tabular-nums` — Fraunces les rend comme un chiffre
gravé. Les deux règles se cumulent : `font-display tabular-nums`.

### 5.2 Le filet éditorial

Un titre de salle est toujours accompagné, au-dessus, d'un **sur-titre** en mono :
`SALLE II · LE CADASTRE`. Sous le titre, un filet de laiton de 1 px qui ne prend que la
largeur du texte (`w-fit`), jamais toute la page.

---

## 6. Grille et rythme

- Colonne de contenu : `max-w-[1600px]`, gouttière `px-5 md:px-10`. Sur un écran large, la
  page **occupe l'espace** : la colonne s'élargit, les grilles passent à quatre colonnes, et
  les registres gagnent en hauteur visible.
- Espacement vertical : 8 / 12 / 16 / 24 / 32 / 48. Rien d'intermédiaire.
- Une "feuille" (panneau) a toujours : rayon `2px`, bord `1px` de `veil` ou `vellum-edge`,
  ombre `sheet`, padding `p-5 md:p-7`.
- Un "tiroir" (liste) est séparé par des filets `veil`, pas par des cartes flottantes.

---

## 7. Les planches (cartes)

### 7.1 Anatomie

Une planche est un **objet encadré**, pas une carte de visite.

```text
article.exhibit                 ← le carton de montage (métal de rareté)
 ├─ div.exhibit__glow           ← cône de lumière (pseudo-élément, 0 nœud)
 ├─ (svg décoratif catégorie)   ← internes hors budget
 ├─ header                     ← étiquette de catégorie + numéro
 ├─ div.exhibit__plate         ← la planche en vélin
 │   ├─ h3                     ← le nom, en Fraunces
 │   └─ (vignette catégorie)
 └─ footer                     ← score + sceau de rareté
```

- Format : `aspect-[5/7]` (plus élancé que la v3, comme une planche de musée).
- **Une seule planche, fluide.** `.exhibit` ouvre un conteneur (`container-type: inline-size`) :
  le nom, les étiquettes, le blason et le sceau sont exprimés en `cqi` bornés par `clamp()`.
  La même planche reste lisible de **56 px** (tiroir de La Planche) à **320 px** (bureau large).
  On ne duplique donc pas un « petit » et un « grand » gabarit : la collection, le marché,
  les emplacements et le chapiteau du Relevé rendent exactement le même objet.
- **Deux compositions, un seul vocabulaire.** Les listes rendent la planche fluide décrite
  ci-dessus. Le Cartel (§8.6) rend une **composition distincte**,
  `apps/web/src/components/ui/cards/detailed-plate.tsx` — et non une planche agrandie : quatre
  zones réservées (en-tête, bande de gravure, cartouche blason + lecture, pied). La raison est
  mécanique : le blason et la gravure ne doivent **jamais** partager la même surface. Le
  serveur replie `contour_url` dans `blasonUrl` (`blasonOf`), donc un blason est souvent un
  contour transparent ; posé sur la gravure en `mix-blend-multiply`, les deux dessins se
  confondent en une bouillie. `DetailedPlate` n'emploie donc **aucun mode de fusion** et porte
  son propre budget de **26 nœuds non-SVG**. La collection, le marché, les emplacements et le
  chapiteau du Relevé gardent l'unique planche fluide.
- Tailles de référence : registre **96 px**, lot du Comptoir **132 px**, emplacement de La
  Planche **132 px**, chapiteau du Relevé **240 px**, tiroir **56 px**.
- Carton : `bg-cabinet-raised`, bord `1px` du métal de rareté, `p-[3px]`, rayon `2px`.
- Planche : `bg-vellum`, filet intérieur `1px` `vellum-edge` à 3 px du bord.
- Nom : `font-display`, 18–20 px, `leading-[1.08]`, `line-clamp-2`, encre `ink`.
- Pied : catégorie + référence à gauche (mono 10 px), score à droite en Fraunces.
- **Aucune** étoile, **aucun** badge coloré, **aucun** fond dégradé plein cadre.

### 7.2 Les quatre planches

Chaque catégorie possède une **gravure** différente, dessinée en SVG inline, monochrome
encre, à faible opacité, derrière le texte. Aucune image externe.

| Catégorie | Gravure | Composition |
| :--- | :--- | :--- |
| **Région** | *La planche topographique* | Courbes de niveau concentriques + rose des vents discrète en bas à droite. Nom en haut, grand. |
| **Département** | *L'écu* | Écu héraldique centré (clip-path), code à l'intérieur en Fraunces, devise de filets autour. |
| **Commune** | *La vue* | Silhouette de village **générée de façon déterministe depuis le code INSEE** : collines, clocher, toits, un astre. Deux communes différentes ne se ressemblent jamais. |
| **Rue** | *Le spécimen* | Le nom en grand Fraunces italique, posé sur un fragment de carte (trois rues, un pâté de maisons), avec le nombre d'occurrences tamponné. |

La génération déterministe de la vue communale est le cœur de l'identité : elle transforme
une collection de 35 000 lignes en 35 000 objets distincts. Elle vit dans
`apps/web/src/lib/commune-vignette.ts` (hachage du code INSEE → géométrie). Aucun état React,
aucun aléatoire au rendu.

```ts
// signature livrée
export function communeVignette(codeInsee: string): {
  ridges: string;   // deux crêtes, fermées sur la ligne de sol
  roofline: string; // toits et murs du village
  steeple: { x: number; height: number; width: number };
  orb: { cx: number; cy: number; r: number };
  light: number;    // orientation de la lumière, 0–1
};
```

### 7.3 Les six métaux de rareté

Sur la planche, la rareté est **le métal du carton** et **le sceau**. Dans les listes, elle
devient une **pastille pleine** du même métal (§7.4). Jamais un simple texte gris, jamais une
information portée par la couleur seule.

| Palier | Métal | Hex | Traitement |
| :--- | :--- | :--- | :--- |
| `COMMUNE` | Étain | `#8f979a` | filet 1 px |
| `INHABITUELLE` | Cuivre | `#b2703f` | filet 1 px |
| `RARE` | Argent | `#d3d9dd` | filet 2 px + halo de métal |
| `EPIQUE` | Émail | `#3e5a8a` | filet 2 px + halo de métal |
| `LEGENDAIRE` | Or | `#c9a227` | filet 2 px + halo d'or |
| `MYTHIQUE` | Électrum | `#e8ce8c` | filet 2 px + halo d'électrum, **balayage de lumière** animé (8 s, `ease-in-out`, `prefers-reduced-motion` respecté) |

Les six valeurs vivent dans `RARITY_ACCENT_HEX` (`packages/shared/src/rarity.ts`) : c'est
l'unique propriétaire des hexadécimaux de rareté. `rarity-theme.ts` y ajoute l'initiale du
sceau, l'épaisseur du filet et l'encre lisible, jamais une couleur.

Le libellé français vient de `RARITY_LABELS` (`packages/shared/src/rarity.ts`) :
« Commune », « Peu commune », « Rare », « Épique », « Légendaire », « Mythique ».
Le mapping métal vit dans `apps/web/src/lib/rarity-theme.ts` et **n'invente aucun texte**.

`packages/spec/src/rarity.spec.ts` continue de verrouiller la parité six paliers.

### 7.4 Le sceau et la pastille

En bas à droite de chaque planche, un **sceau de cire** :

- disque plein dans le métal du palier ;
- initiale du palier en Fraunces, en `ink` sur métal clair et `vellum` sur métal sombre ;
- anneau interne `1px` en `box-shadow` ;
- diamètre `clamp(15px, 7.5cqi, 22px)` : il suit la planche ;
- `aria-label` complet sur le nœud (« Rareté : Peu commune »), pas de `title`.

Dans les listes (registre, lots, filtres), la rareté est une **pastille pleine** :
fond `color-mix(in srgb, metal 22%, cabinet)`, bord `1px` du métal, texte
`color-mix(in srgb, metal 42%, vellum)` et pastille de métal. Le mélange garantit un
contraste **≥ 4,5:1** pour les six paliers — l'émail `#3E5A8A` est illisible sur la pièce
s'il est employé tel quel. La rareté ne repose jamais sur la seule couleur : le libellé
français est toujours écrit.

### 7.5 Budget DOM

Le budget reste **≤ 18 nœuds non-SVG** par planche (racine incluse, internes `<svg>` exclus).
Les gravures ajoutent de la richesse sans coûter de nœuds. Les ornements passent par
`::before` / `::after`.

---

## 8. Écrans

### 8.1 Le Relevé — `/`

C'est la scène. Elle doit être **la plus belle page de l'application**.

- **En-tête de salle** : sur-titre `SALLE I · LE RELEVÉ`, titre en Fraunces
  « Le relevé topographique », sous-titre d'une ligne, puis le **numéro de bordereau** en
  mono et les **quatre coups de grattoir** représentés par quatre chevilles de laiton
  (pleines = disponibles, creuses = consommées).
- **Le bordereau** : une feuille de vélin de `max-w-2xl`, posée sur un plateau de liège,
  avec un coin corné (`clip-path`), une ombre `lifted`, et une **bande de carbonique** sur
  la grille.
- **La grille** : 4 × 4, gouttière de 10 px, chaque case est un **creux** (`shadow-sunk`)
  de 72 à 88 px. Non grattée : carbone ardoise avec un filigrane hexagonal en creux.
  Grattée : la planche apparaît, la case s'éclaire d'un halo chaud pendant 400 ms.
- **Le carnet de bord** : sous le bordereau (ou à droite en `lg`), une liste de lignes en
  mono — `R4 · 2 pas · Commune · 1 604 pts` — avec la distance en laiton. C'est le seul
  endroit où l'on affiche la distance ; jamais sur la case.
- **La trouvaille** : quand `TREASURE_FOUND` arrive, l'écran s'assombrit
  (`bg-cabinet/80`), la planche monte de 12 px dans un cône de lumière, son nom s'écrit en
  Fraunces 40 px. Bouton « Ranger dans le cadastre ».

Le canvas reste **impératif** : `ref` + `requestAnimationFrame`, aucun état React par
mouvement. Le pinceau brosse une **poudre de laiton** (deux tons) sur un carbone ardoise.
Interdiction de `filter` sur le canvas.

### 8.2 Le Cadastre — `/collection`

Un **registre**, pas une grille de cartes.

- **Bandeau de chiffres** : quatre compteurs (Régions, Départements, Communes, Rues) en
  Fraunces 32 px, séparés par des filets de laiton. Puis le total et la valeur du cabinet.
- **Barre d'instruments** : collante sous l'en-tête, fond `cabinet-raised`, filet bas.
  Sélecteur de catégorie en **onglets à soulignement de laiton**, sélecteur de rareté
  (menu), champ de recherche avec une loupe gravée. Tout en 40 px de haut.
- **Un seul défilement.** La liste est virtualisée sur **la fenêtre**
  (`useWindowVirtualizer`) : pas de conteneur à hauteur fixe, donc pas de barre de
  défilement imbriquée. La barre d'instruments reste `sticky` ; l'en-tête de colonnes défile.
- **Desktop** : ligne de **152 px**, `grid` à six colonnes, planche de **96 px** (le même
  objet que dans Le Comptoir) qui porte le nom, le blason et le sceau — donc pas de colonne
  « nom » redondante. Puis *Catégorie*, *Rareté* (pastille pleine), *Score*, *Acquise le*,
  *État*.
- **Mobile** : ligne d'environ **126 px**, une seule colonne ; l'en-tête de colonnes est
  masqué et les colonnes secondaires aussi. La cellule unique montre la planche (72 px), le
  nom, `Catégorie · score pts`, la pastille de rareté et la date. **Aucun défilement
  horizontal.**
- **Filtres** : sur mobile, la recherche passe en premier et occupe toute la largeur (avec
  une loupe), puis les onglets de catégorie, puis le sélecteur de rareté. Sur desktop,
  onglets → rareté → recherche.
- Survol desktop : la ligne s'éclaire (`bg-cabinet-raised`) et la planche se soulève de
  2 px. **Aucune** transition de layout, aucune ombre animée dans la liste.

`@tanstack/react-table` reste utilisé **ici seulement**, avec un `gridTemplate` partagé
entre l'en-tête et les lignes.

### 8.3 La Planche — `/tableau`

Une **table de travail**, pas un formulaire.

- **Colonne gauche (lg)** : la planche de composition. Quatre **emplacements** verticaux
  reliés par un filet de laiton. Un emplacement vide est un creux de vélin avec une
  gravure de catégorie et « Emplacement libre ». Un emplacement rempli porte la planche et
  une **épingle de laiton** en haut.
- **Connecteurs** : entre deux emplacements, un petit **sceau de validation** — `✓` en
  `verdigris`, `✗` en `oxide` — avec le libellé du lien en mono 10 px. La géométrie vient
  du serveur (`alignment.breakdown[].valid`), jamais d'un calcul local.
- **Colonne droite** : la **plaque de calcul**. Trois lignes — base, multiplicateur, total —
  le total en Fraunces 48 px. Le multiplicateur `×N` est frappé dans un **sceau de cire**
  oxblood. `aria-live="polite"` sur la plaque.
- **Le tiroir de planches** : un panneau qui monte du bas (`translate-y`), fond
  `cabinet-raised`, filet haut de laiton, liste virtualisée de mini-planches filtrées par
  l'emplacement actif. Fermeture par `Échap`, clic hors panneau, ou bouton.

### 8.4 Le Comptoir — `/market`

Un **catalogue de vente**, pas une boutique.

- Grille de lots `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`, gouttière 20.
- Un lot = une **planche de 132 px** + un **cartel** : nom, catégorie, vendeur, date, et une
  **étiquette de prix** en laiton suspendue (un filet de 8 px + une pastille).
- Prix en Fraunces 24 px + « écus » en mono 11 px.
- Bouton **Acquérir** : laiton plein, encre sombre, `active:translate-y-px`. Désactivé
  uniquement pour le lot en cours d'achat (`mutation.variables?.id === listing.id`),
  jamais globalement.
- `Mes Offres` : les lots du joueur, avec statut (`Ouvert`, `Vendu`, `Retiré`) et retrait.
- Pagination discrète en bas, mono.

### 8.5 Le Seuil — `/login`, `/register`

- Deux colonnes en `lg` : à gauche une **grande gravure** (hexagone, rose des vents,
  courbes de niveau, tout en trait fin laiton sur fond sombre) et une phrase de marque ;
  à droite une **fiche d'admission** en vélin.
- Champs : libellé en mono 10 px capitales, input de 44 px, fond `vellum`, filet
  `vellum-edge`, focus = anneau laiton 2 px.
- Bouton primaire pleine largeur, laiton. Lien secondaire en `ink-soft` souligné.
- Aucune carte flottante générique, aucun logo centré, aucun dégradé violet.

### 8.6 Le Cartel — `/card/$cardId`

La **fiche d'une planche**, atteinte depuis n'importe quelle vignette (Le Cadastre, Le
Comptoir, Mes Offres, La Planche). Deux colonnes à partir de `lg`.

- **À gauche, le montage.** La planche seule sur un carton `bg-cabinet-raised`, un cône de
  lumière (`radial-gradient(120% 70% at 50% -10%, …)`, jamais un dégradé par rareté), le
  code de référence encadré de deux filets de laiton, l'attribution du blason en mono 9 px.
  Jusqu'à 380 px de large, centré, `lg:sticky` : la pièce reste au regard pendant qu'on lit.
- **À droite, quatre feuilles empilées.**
  1. **Cartel** — une feuille de vélin, sept lignes séparées par un filet d'encre : catégorie,
     rareté (sceau + libellé, jamais la pastille sombre), score en Fraunces 3xl, référence,
     date d'acquisition, provenance, état.
  2. **Le lieu** — carton sombre ; population, département, région, communes homonymes,
     coordonnées. Seules les valeurs présentes sont rendues ; aucune donnée n'est inventée.
  3. **Réserves** — trois tuiles à filet pointillé et pastille « À paraître » (cote du marché,
     détenteurs, chronique du lieu). Ces rubriques sont **visuellement vides** : on nomme le
     manque, on ne le comble pas.
  4. **Mise à l'offre** — filet de laiton. Sa propre planche non verrouillée et non vendue :
     un formulaire de prix (entier entre 1 et 1 000 000). Déjà en vente : le prix, la date et
     un renvoi vers Mes Offres. Verrouillée : la raison, sans action. Planche d'autrui en
     vente : vendeur, prix et **Acquérir**. Planche d'autrui sans vente : la section
     disparaît.
- Aucune requête supplémentaire n'est nécessaire : la fiche, le propriétaire, le détail
  géographique et l'annonce éventuelle viennent d'une seule réponse serveur.
- Téléphone : une seule colonne, montage en premier, cibles tactiles de 44 px, chiffres
  tabulaires, aucun défilement horizontal.

### 8.7 Les Amis — `/friends`

Le **cercle du joueur** : une seule salle pour ajouter, accepter et retenir ses amis.

- **En-tête de salle**, puis un formulaire de recherche : un champ `pseudo` (24 caractères au
  plus, `autocomplete` coupé) et un bouton **Ajouter**. Sous le formulaire, une zone
  `aria-live="polite"` porte le retour — message français d'erreur (code stable traduit) ou
  confirmation d'action.
- **Deux colonnes à partir de `lg`**, une seule en dessous. À gauche **Demandes reçues**
  (**Accepter**, **Refuser**) puis **Demandes envoyées** (**Annuler**) ; à droite **Mes amis**
  (**Retirer**, **Bloquer**).
- Chaque section est un carton `bg-cabinet-raised` à filet `veil`, titrée en Fraunces, comptée
  en mono 9 px. Une section vide nomme le manque (« Aucune demande reçue… ») : aucune section
  ne disparaît, et la salle d'un compte neuf montre trois sections vides.
- Une ligne est un `li` en `bg-cabinet-sunk/40` : le pseudo en Fraunces, tronqué, puis les
  actions. Sur téléphone, les actions passent sous le pseudo.
- **Toute action est une mutation serveur** : elle invalide la clé `friends` et l'état se relit
  depuis le serveur. Aucune mise à jour optimiste, aucune retouche locale de la liste.
- Cibles tactiles de 44 px, `focus-visible` sur chaque contrôle, aucun défilement horizontal
  à 390 px. La salle s'atteint par le rail, ou sur téléphone par la barre basse puis la
  feuille « Plus ».

### 8.8 La Vitrine — `/players/$playerId`

La **fiche publique d'un joueur**, en deux colonnes à partir de `lg`, une seule requête
serveur et aucun recalcul : pseudo, ancienneté, biographie en vélin, complétude en quatre
tuiles, meilleur tableau (score et `×N`), médailles en clés nues, annonces et amis.

- Liste blanche stricte : jamais l'adresse électronique, le solde, l'état `locked`, la
  `grid` d'un ticket ni la Pépite (§2.6).
- Une vitrine privée répond `404` : un `403` confirmerait l'existence du compte.

### 8.9 Le Guichet — `/guichet`

Le **guichet des avis** : ce que le cabinet a laissé au joueur, dans une salle unique. Elle
appartient à la coquille (`components/layout/`), pas à une fonctionnalité : la cloche vit dans le
rail (§9.1) et dans l'en-tête mobile (§9.2), la salle en est la destination.

- **La cloche suit le serveur, jamais un compteur local.** `notification-bell.tsx` lit
  `GET /api/v1/notifications/unread-count` (`sondage 60 s` + `refetchOnWindowFocus`) et rend
  `unread` tel quel. Aucun `useState`, aucun décrément optimiste, aucune mémoire locale : un
  rechargement de page ne peut pas afficher un chiffre que le serveur n'a pas donné. La
  pastille affiche la valeur **plafonnée à 99** (`GUICHIET.bell.cap`) ; le libellé accessible et
  la région `aria-live` annoncent la valeur exacte, la pastille ne faisant que la montrer.
- **La pastille est en laiton, jamais une couleur de rareté.** C'est un compteur d'attention,
  pas un palier : `bg-brass`, encre `cabinet`, mono tabulaire 9 px. Aucune teinte de métal
  n'entre dans la cloche.
- **Neuf `kind` groupés, un ordre fixe.** La salle liste `NOTIFICATION_KINDS` : demandes d'ami,
  amitiés acceptées, médailles, ventes, achats, puis les quatre `TRADE_*` — déclarés et rendus
  dès aujourd'hui, **émis par la phase du troc**. Les sections vides ne rendent rien ; un `kind`
  hors liste tombe dans « Autres avis » au lieu de casser le rendu.
- **Le `payload` décide de ce que dit une ligne.** Pseudo, prix, libellé de médaille, `playerId`
  viennent de la charge utile serveur ; une clé absente ou d'un type inattendu rend le repli
  français (« un joueur », « une médaille ») et ne lève jamais. Les `TRADE_*` se rendent sans
  lire leur charge utile : la forme appartient à la phase suivante.
- **L'état vide est honnête.** Un carton nomme ce que le guichet remettra — une demande d'ami,
  une vente au Comptoir, une médaille frappée — et dit qu'il n'y a rien à dépouiller. Aucune
  planche n'est dessinée pour meubler : le Guichet ne rend **aucune** carte.
- **« Tout marquer comme lu »** n'apparaît qu'avec au moins un avis non lu, et son retour passe
  par la zone `aria-live` de la salle. Chaque ligne non lue porte un point laiton et son bouton
  **Marquer comme lu** ; le compteur affiché vient de la page serveur, jamais du nombre de
  lignes rendues. Une action est une mutation suivie d'invalidation : la cloche et la liste se
  relisent, aucune retouche locale.
- **Afficher plus** suit le curseur `nextCursor` ; la pagination est un keyset, elle ne numérote
  pas de page. Date relative sous la semaine, absolue au-delà, en mono 9 px.
- Sans session, la salle renvoie au Seuil ; une session illisible montre `SessionUnavailable`
  (§4.5). Cibles tactiles de 44 px, aucun défilement horizontal à 390 px.

---

## 9. Navigation

### 9.1 Rail de cabinet — desktop (`md:` et plus)

- Largeur 232 px, fond `cabinet-raised`, filet droit `veil`, fixe.
- En haut : **le sceau** — un hexagone gravé de 28 px + « HEXAMAP » en mono 11 px
  lettres espacées, puis « Cabinet de cartographie » en Fraunces italique 12 px. À droite du
  sceau, **la cloche du Guichet** (§8.9) : elle appartient à l'en-tête du rail, pas à la liste.
- Entrées principales, avec un glyphe SVG de 16 px et un libellé :
  **Le Relevé** `/`, **Le Cadastre** `/collection`, **La Planche** `/tableau`,
  **Le Comptoir** `/market`.
- Entrées secondaires, plus petites, séparées par un filet :
  **Le Guichet** `/guichet`, **Les Planches** `/tableaux`, **Les Amis** `/friends`,
  **Mes Offres** `/market/mine`, **Le Palmarès** `/palmares`. Le Guichet ouvre la liste :
  c'est la salle qu'on vient consulter, pas celle où l'on travaille, et la cloche qui la
  signale est juste au-dessus.
- État actif : fond `cabinet`, filet gauche de laiton de 2 px, libellé en `vellum`.
  `aria-current="page"`.
- En bas : la **bourse** (pièce de laiton + « 1 250 écus » en mono) et l'**usager**
  (pseudo + Déconnexion).

### 9.2 Barre de salle — mobile

- En-tête collant de 56 px : sceau + nom de la salle courante en Fraunces 17 px, à droite
  **la cloche du Guichet** puis la bourse compacte. `pt-[env(safe-area-inset-top)]`, et
  `pl-[max(1rem,env(safe-area-inset-left))]` sur la rangée.
- Barre basse de 64 px, **cinq cibles** de 44 px minimum, glyphe + libellé court : les
  quatre salles principales (`Relevé`, `Cadastre`, `Planche`, `Comptoir`) et le contrôle
  `Plus`. Onglet actif : glyphe laiton + filet supérieur de 2 px.
  `pb-[env(safe-area-inset-bottom)]`, plus `pl`/`pr` d'encoche : en paysage, le premier et
  le dernier onglet ne doivent pas passer sous la découpe.
- **La feuille des salles secondaires** s'ouvre depuis `Plus` : `role="dialog"`,
  `aria-modal="true"`, recouvre la barre, `rounded-t-panel`, `bg-cabinet-raised`, poignée,
  titre « Autres salles », les entrées de `SECONDARY_NAV` à `min-h-[44px]`,
  `aria-current="page"` sur la salle courante seulement. Fermeture par Échap, par le voile
  et par le bouton ; le focus revient au contrôle. **Le Guichet y figure par construction** :
  la feuille lit `SECONDARY_NAV`, où la salle est la première entrée (§9.1), donc aucune
  seconde liste n'est à tenir.
- **La cloche vit dans l'en-tête mobile, pas dans un sixième onglet.** La barre basse garde
  ses quatre salles principales et le contrôle `Plus` : un onglet de plus aurait réduit chaque
  cible sous 44 px et fait du Guichet une salle de travail. La cloche de l'en-tête porte le
  compteur, le `Plus` porte la salle.
- **Le contrôle `Plus` n'apparaît qu'avec une session ouverte**, comme le bloc de
  navigation du rail : les salles secondaires vivent dans le rail sur bureau (§9.1) et
  dans la feuille sur mobile.
- Le contenu a `pb-24 md:pb-10`.

`viewport-fit=cover` est obligatoire dans `index.html`.

### 9.3 Transitions de salle

Changement de route : fondu 160 ms + montée de 6 px, une seule fois, sur le conteneur de
`main`. Pas de transition croisée, pas de scaling.

---

## 10. Mouvement

| Geste | Durée | Courbe |
| :--- | :--- | :--- |
| Survol, focus, changement de couleur | 150 ms | `linear` |
| Ouverture d'un tiroir / panneau | 320 ms | `--ease-cabinet` |
| Révélation d'une planche | 420 ms | `--ease-cabinet` |
| Balayage `MYTHIQUE` | 8 s | `ease-in-out` |
| Entrée de salle | 180 ms | `--ease-cabinet` |

Règles :

- On n'anime **que** `transform` et `opacity` (plus `background-color` / `border-color`).
- Aucune animation dans une liste virtualisée.
- Une animation d'entrée portée par un ancêtre de mise en page (`main`) ne remplit jamais vers
  l'avant : `fill-mode: backwards`, parce que le `transform` résiduel redéfinirait le bloc
  conteneur des overlays `fixed`. Un ornement de feuille (`.enter-plate`) peut garder `both`.
- `prefers-reduced-motion: reduce` supprime les translations, garde les fondus de 1 ms.
- Le seul mouvement continu autorisé est le balayage `MYTHIQUE`, et il est coupé en
  `prefers-reduced-motion`.

---

## 11. Voix

Français, sobre, un peu lettré. On vouvoie, on ne crie pas, on n'utilise pas d'emoji.

| Contexte | Formulation |
| :--- | :--- |
| Bouton principal du relevé | « Gratter le bordereau » |
| Relevé épuisé | « Ce bordereau est soldé. » |
| Achat | « Acquérir » |
| Vente | « Mettre à l'offre » |
| Multiplicateur | « Alignement ×2,5 » |
| Rareté | libellés de `RARITY_LABELS`, jamais réécrits |
| Monnaie | « écus » (minuscule dans la phrase, `Écus` en étiquette) |
| Erreur | ce qui s'est passé + quoi faire, sans code technique |

Les titres de salle sont des noms, pas des verbes. « Le Cadastre », pas « Ma Collection ».

---

## 12. Accessibilité

- Contraste minimum 4,5:1 pour le texte, 3:1 pour les glyphes et filets porteurs de sens.
  Sur la pièce, aucun texte utile ne descend sous **`text-vellum/55`** ; les opacités
  `25–45 %` ne servent qu'à des ornements non porteurs d'information. Le vélin utilise
  `ink` / `ink-soft` / `ink-faint` (`#6a5e4c`, ≥ 5:1 sur `vellum`).
- La rareté est toujours **nommée** et sa pastille utilise `color-mix` pour rester au-dessus
  de 4,5:1, y compris pour l'émail.
- Focus visible partout : `outline: 2px solid var(--color-brass); outline-offset: 2px`.
  Jamais `outline: none` sans remplacement.
- Cible tactile ≥ 44 px.
- Chaque planche est un `article` avec un titre `h3` lisible ; le sceau porte un
  `aria-label` complet.
- La grille de grattage est un `fieldset` avec `legend`, chaque case un `button` avec
  `aria-label` (« Case 7, non révélée »).
- Les changements de score et de multiplicateur sont en `aria-live="polite"`.
- Aucune information portée par la seule couleur : le métal est toujours doublé du libellé.

---

## 13. Performance

- **Interdit** : `filter`, `backdrop-filter`, `mix-blend-mode` sur les lignes d'une liste
  virtualisée et sur/autour du canvas de grattage.
- Le grain est un unique pseudo-élément fixe sur `body`, jamais un filtre par composant.
- Les ombres portées sont statiques ; seule l'opacité change au survol.
- Les gravures SVG des planches sont **petites** (viewBox 100 × 140), sans filtre.
- Le balayage `MYTHIQUE` utilise `background-position` sur un pseudo-élément, pas un
  `filter`.
- Le canvas conserve `touch-none select-none`, la brosse dérivée de `scratchBrushRadius`
  et le seuil `SCRATCH_REVEAL_THRESHOLD`.

---

## 14. Interdits

1. **Aucune signalétique routière** : plus d'EB10, de plaque bleue émaillée, de borne
   Michelin, de bordure rouge de commune. La direction est abandonnée.
2. Aucune couleur littérale dans un composant. Tout passe par `@theme`.
3. Aucun `tailwind.config.ts`.
4. Aucune image distante, aucun CDN de police, aucune icône importée d'un paquet.
5. Aucun dégradé **en plein cadre d'une planche** : les dégradés servent la lumière
   (cônes, vignettage, fibre), jamais la rareté.
6. Aucun `backdrop-blur` sur une planche, une ligne ou le canvas.
7. Aucun `rounded-full` sur une planche ou un panneau (`pill` réservé aux pastilles).
8. Aucun `animate-pulse`, aucun `transition-all`, aucun `hover:scale-*` dans une liste.
9. Aucun emoji, aucun texte anglais visible, aucune dépendance i18n.
10. Aucun état React pour le canvas.

---

## 15. Carte d'implémentation

| Fichier | Rôle |
| :--- | :--- |
| `apps/web/src/styles.css` | `@theme`, `@font-face` ×6, `@layer base`, grain, `.vellum`, utilitaires de planche |
| `apps/web/index.html` | préchargement des deux `latin`, `viewport-fit=cover`, `favicon.svg` |
| `apps/web/public/fonts/` | Fraunces ×2, Instrument Sans ×2, JetBrains Mono ×2, `OFL.txt` |
| `apps/web/src/lib/rarity-theme.ts` | métal, sceau, libellé (réexporté) par palier |
| `apps/web/src/lib/category-theme.ts` | glyphe + gravure + libellé par catégorie |
| `apps/web/src/lib/commune-vignette.ts` | génération déterministe de la vue communale |
| `apps/web/src/components/ui/rarity-seal.tsx` | le sceau (unique) |
| `apps/web/src/components/ui/cards/*` | quatre planches + `card-shell.ts` |
| `apps/web/src/components/layout/app-shell.tsx` | rail + barre de salle + `main` |
| `apps/web/src/components/layout/sidebar.tsx` | rail desktop |
| `apps/web/src/components/layout/bottom-tab-bar.tsx` | onglets mobiles |
| `apps/web/src/routes/__root.tsx` | monte la coquille |
| `apps/web/src/routes/*` | les salles |

Ordre de livraison : jetons et polices → coquille → planches → Le Relevé → Le Cadastre →
La Planche → Le Comptoir → Le Guichet → Le Palmarès → Le Seuil.

---

## 16. Vérification

`packages/e2e/tests/design-system.spec.ts` doit vérifier, dans cet ordre :

1. `body` porte `--color-cabinet` comme fond, et une couche de grain existe.
2. Aucune planche ne contient de `linear-gradient` en `background-image` direct.
3. Les quatre gravures produisent quatre structures différentes.
4. Chaque planche reste sous 18 nœuds non-SVG.
5. Deux communes différentes produisent deux vignettes différentes (déterminisme).
6. Le multiplicateur et l'alignement viennent du serveur.
7. `prefers-reduced-motion` coupe le balayage `MYTHIQUE`.
8. Aucun `backdrop-filter` sur une ligne de liste ni sur le canvas.

`packages/spec/src/rarity.spec.ts` continue de verrouiller les six paliers.
