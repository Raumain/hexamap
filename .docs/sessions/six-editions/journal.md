# Journal — phase 56, « Une région, six éditions »

Branche `feat/v2-56-six-editions`, partie de `feat/v2-idees-wave-3` (627e3a6).
Aucune migration, aucune table, aucune route, aucun changement de tirage.

## Ce que la phase livre

| Fichier | Changement |
| --- | --- |
| `packages/spec/src/tickets.spec.ts` | un cas neuf dans `describe('Plan §5.6 — robustesse du tirage')` : pour les six paliers, `drawCard(trx, 'REGION', palier)` et `drawCard(trx, 'DEPARTEMENT', palier)` portent le palier demandé et `EDITION_SCORE[palier]` (+ `departementPopulationBonus` pour le département) |
| `apps/web/src/content/rarete.ts` | le bloc `RARETE.editions` et les deux libellés d'édition (`editionLabel`, réutilisé par le Cartel et le bandeau) |
| `apps/web/src/routes/rarete.tsx` | la planche « Régions et départements : six éditions » : tableau `ÉDITION_SCORE` (200 → 3 500), la phrase « deux cartes », le contraste avec la commune |
| `apps/web/src/content/card-detail.ts` | `editionLabel`, `editionLink`, et `editionNote(catégorie, rareté)` (forme accordée : « une région peut être tirée » / « un département peut être tiré ») |
| `apps/web/src/routes/card.$cardId.tsx` | pour `REGION` / `DEPARTEMENT` seulement : la ligne « Rareté » devient « Édition », et une note sous le cartel porte la phrase + le lien vers `/rarete` |
| `apps/web/src/components/revealed-cell.tsx` | `CellStrip` nomme l'édition d'une région / d'un département, le palier restant au sceau |
| `packages/e2e/tests/rarete.spec.ts` | un cas de plus : la section « six éditions » montre les six scores et la phrase « deux cartes » |

## Le cas de spécification : rouge puis vert

**Vert du premier coup, et c'est le constat attendu.** Le comportement est correct depuis
`draw.ts` : le premier passage du cas neuf donne `1 pass` en 12,60 ms sur la base
`hexamap_test_56`. Une spécification verte n'est pas une preuve : rien ne dit qu'elle regarde
quelque chose.

**Preuve de non-vacuité, faite et non commitée.** L'assertion a été inversée en local
(`expect(region.card.rarity).not.toBe(rarity)`), rejouée, puis restaurée :

```text
error: expect(received).not.toBe(expected)
Expected: not "COMMUNE"
(fail) Plan §5.6 — robustesse du tirage > Archi §2.1 — une région et un département …
 1 fail · 2 expect() calls
```

L'assertion mord donc bien sur la valeur réelle. Restauré, le cas est repassé vert (19 cas du
fichier, 1 seul filtré).

## Écart constaté sur les constantes de Pépite

I-006 cite `TREASURE_RARITIES` et `CARD_RARITIES` de `packages/shared`. **Elles n'existent pas** :
`packages/shared/src/rarity.ts` ne contient que `RARITY`, `RARITY_LABELS`,
`RARITY_ACCENT_HEX`, `RARITY_WEIGHTS`, `EDITION_SCORE`, `ALIGNMENT_MULTIPLIER`, `CATEGORY`,
`CATEGORY_WEIGHTS`, `communeRarity` et `rueRarity` ; aucun autre fichier de `packages/shared`
n'en déclare. Aucune constante n'a été inventée et aucun pourcentage n'a été écrit à la main :
la page n'affiche que `RARITY_WEIGHTS` (déjà là) et `EDITION_SCORE`. La phrase d'I-006 qui
s'appuyait sur ces listes n'est donc pas reprise telle quelle.

## Vérification visuelle, faite dans le banc E2E

Banc `docker-compose.e2e.yml` (image de production), captures prises par une spec temporaire
supprimée depuis, à 390 px et 1280 px :

- **`/rarete`** — la planche « Régions et départements : six éditions » rend le tableau complet
  (Commune 200 pts → Mythique 3 500 pts), la phrase « n'est pas un doublon, c'est deux cartes »
  et le contraste avec la commune. À 390 px, aucun débordement horizontal ; à 1280 px, la
  planche occupe les deux colonnes.
- **Le Cartel d'une région** (`E2E-R1`) — ligne « ÉDITION — Rare » et la note « Édition rare —
  une région peut être tirée dans les six éditions ; sa valeur est celle de l'édition, pas du
  lieu. Comprendre les six éditions ».
- **Le Cartel d'un département** (`E2E-D2`) — même ligne, note accordée « un département peut
  être tiré… ».
- **Le Cartel d'une commune** (`E2E-C-RARE-0`) — inchangé : « RARETÉ — Rare », aucune note,
  aucun lien.
- **Le bandeau d'une case révélée** (ticket fabriqué pour l'occasion : région `MYTHIQUE` en case
  0, révélée) — le bandeau affiche « ÉD. » à gauche et « 3 PAS » à droite ; le survol donne
  « Édition mythique » (`title`).

### Mesure qui a décidé du texte du bandeau

Relevé dans le navigateur à 390 px, classes réelles du bandeau :

```text
cellule 66,5 px · bandeau 56,5 px · badge de distance 30 px → 26,5 px pour la marque
« Jumelé » = 42 px · « Édition » = 49 px · « Édition mythique » = 112 px
```

Le bandeau de 16 px ne peut donc tenir **aucun** des deux mots entiers : « Jumelé » y est déjà
tronqué en « JUM… » avant cette phase. « Édition mythique » s'affichait « ÉD… », illisible. La
marque retenue est l'abréviation « Éd. » (18,3 px, jamais tronquée), avec la phrase complète en
`title`. Aucune géométrie n'a bougé, aucun `h-*` n'a été ajouté, comme le brief l'impose.

## Mesures

`ci:check`, base `postgres://hexamap:hexamap@db:5432/hexamap_test_56`, conteneur `dev` :

```text
1/5 Lint        biome check . — 369 fichiers, aucune erreur
2/5 Typecheck   shared, db, api, web (tsr generate + tsc + tsconfig.sw), spec, e2e
3/5 Base        joignable · 22 migrations, dans l'ordre
4/5 Spécifs     589 pass · 0 fail · 3434 expect() · 33 fichiers
5/5 Charge      p95 du résumé d'Atlas = 21,0 ms (seuil 200) · 360 927 octets (garde-fou 512 Kio)
Gatekeeper vert
```

Banc E2E complet, image de production reconstruite sur le diff final :

```text
134 passed (3,3 min) — chromium, pwa, Pixel 7, iPhone 13
dont rarete.spec.ts : 4/4, le cas neuf compris
```

**Un passage intermédiaire d'`ci:check` a échoué à l'étape 5** (p95 sous contention, banc E2E
allumé en parallèle sur la même machine — la fragilité déjà consignée dans
`.docs/03-active-task.md`, « Ce qui reste » §5). Le banc a été éteint, la mesure est repassée à
21,0 ms et la porte est verte. Aucun seuil n'a été relâché.

## Ce que la phase ne prouve pas

- Le bandeau porte « Éd. », pas « Édition mythique » : c'est une contrainte mesurée du bandeau de
  16 px, pas un choix esthétique (voir ci-dessus).
- Aucune capture n'a été commitée : les quatre surfaces ont été regardées dans le banc, la revue
  les décrit.
