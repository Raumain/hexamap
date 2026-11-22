---
objective: "La salle /atlas rend la carte à trois niveaux en descente guidée, alimentée par l'API de la phase 34, avec une table équivalente complète, et /assemblage redirige vers elle."
status: approved
---

# Plan : Phase 35 — L'Atlas, la salle

Source : `.docs/sessions` brief de phase (paramètres de session), `.docs/07-roadmap-v2.md` §4
« Phase 35 », `.docs/01-architecture.md` §4.5 / §4.9.

## Phases

| # | Phase | Contenu | Dépend de |
| - | ----- | ------- | --------- |
| 1 | Contrat de contenu et de route | `content/atlas.ts` (libellés + formateurs), `lib/atlas.ts` (queryOptions Eden), suppression de `content/assemblage.ts`, `validateSearch` borné de `collection.tsx` | none |
| 2 | La salle | `routes/atlas.tsx` : niveau national, descente département, table équivalente, `aria-live`, focus rendu au titre, états chargement / erreur / vide | 1 |
| 3 | La redirection | `routes/assemblage.tsx` réduit à `beforeLoad` + `redirect` vers `/atlas`, `search` conservée | 2 |
| 4 | Mémoire | ligne `/atlas` → **L'Atlas** dans `DESIGN_SYSTEM.md` §2 ; journal de session | 3 |
| 5 | Le banc | `packages/e2e/tests/atlas.spec.ts` (descente, deux liens Cadastre, redirection, table, 320 px, contraste, mouvement réduit) ; réécriture du cas `mobile.spec.ts` qui assertait le teaser | 4 |
| 6 | Vérification | `ci:check` + banc E2E complets dans Docker | 5 |

## Ce que la salle lit, et d'où

L'API de la phase 34 est **déjà fusionnée** dans la branche (`apps/api/src/routes/atlas.ts`,
`packages/shared/src/atlas.ts`, montée dans `buildProtectedRoutes()`).

| Niveau | Requête | Champs utilisés |
| ------ | ------- | --------------- |
| National | `GET /api/v1/atlas/summary` | `viewBox`, `regions[]` (`code`, `nom`, `pathD`, `hasRegionCard`, `communesOwned`, `communesTotal`), `departements[]` (idem + `codeRegion`) |
| Département | `GET /api/v1/atlas/departements/:code` | `viewBox`, `nom`, `communesOwned`, `communesTotal`, `communes[]` (`codeInsee`, `nom`, `pathD`, `ownedCards`, `hasCommuneCard`) |

Aucun champ n'est ajouté côté API. Aucun de ces nombres n'est recalculé : le pourcentage est une
**mise en forme** de `communesOwned / communesTotal` (et, pour une commune, de `hasCommuneCard`,
qui est binaire par nature : `100,0 %` ou `0,0 %`).

## Décisions d'implémentation

1. **Le SVG est purement décoratif.** `<svg aria-hidden="true" focusable="false">`, aucun
   gestionnaire de pointeur, aucun `tabIndex` sur un `<path>`. Toute l'interaction vit dans la
   table : c'est le seul moyen de tenir à la fois « aucune information exclusive dans le SVG »,
   « chaque entité interactive est un `<button>` ou un `<a>` » et « aucun état React par
   mouvement de pointeur ».
2. **Deux signaux visuels, deux sources.** Remplissage = couverture (`fill` vélin, `fillOpacity`
   monotone de 0,06 à 0,45) ; filet = possession (`stroke` laiton, 2 px, `vectorEffect
   non-scaling-stroke`). Le filet laiton est vérifié AA (≥ 3:1) contre le fond du cabinet.
3. **Le niveau national n'est jamais démonté pendant la descente.** La requête `summary` reste
   montée (`staleTime` 60 s) ; la requête département est une clé distincte,
   `['atlas', 'departement', code]`, `enabled` seulement quand un département est ouvert.
   Pendant son chargement, la carte nationale reste affichée avec un message « Chargement des
   communes… ».
4. **Le retour au national est un bouton**, pas un lien de route : il remet `level` à `national`.
   Le focus revient sur le titre du niveau (`h2` avec `tabIndex={-1}`) à chaque changement.
5. **Le lien Cadastre.** Département : un `<Link>` « Voir les cartes au Cadastre » vers
   `/collection?departement=<code>` ; commune : un `<Link>` vers
   `/collection?commune=<codeInsee>`. `collection.tsx` **ne filtre pas encore** : seule
   l'exception bornée du brief est appliquée (deux paramètres optionnels dans `validateSearch`,
   aucune logique), sinon TanStack Router refuserait le typage de `search`.
6. **Mouvement réduit par utilitaire.** `transition-[fill-opacity,stroke] duration-300
   motion-reduce:transition-none` : aucune règle CSS nouvelle, aucun jeton nouveau.
7. **`nav-items.ts` n'est pas touché** (phase 39). Son libellé `"L'Assemblage"` reste donc dans la
   feuille mobile et le titre de salle de la barre ; c'est écrit au journal comme dette de la
   phase 39. La page, elle, s'intitule « L'Atlas ».

## Fichiers touchés

| Fichier | Nature |
| ------- | ------ |
| `apps/web/src/content/atlas.ts` | créer — libellés, formateurs `fr-FR` |
| `apps/web/src/content/assemblage.ts` | supprimer — plus aucun lecteur après la redirection |
| `apps/web/src/lib/atlas.ts` | créer — `atlasSummaryQueryOptions`, `atlasDepartementQueryOptions` |
| `apps/web/src/routes/atlas.tsx` | créer — la salle |
| `apps/web/src/routes/assemblage.tsx` | réduire à la redirection |
| `apps/web/src/routes/collection.tsx` | 4 lignes : `validateSearch` optionnel, aucune logique |
| `packages/e2e/tests/atlas.spec.ts` | créer |
| `packages/e2e/tests/mobile.spec.ts` | réécrire le cas qui assertait le teaser |
| `DESIGN_SYSTEM.md` | une ligne : `/atlas` → **L'Atlas** dans §2 |

Interdits vérifiés : `apps/web/src/components/layout/` (phase 39) → aucun fichier ;
`apps/web/src/routes/collection.tsx` → aucune logique de filtre ; `apps/api/**` → inchangé ;
`apps/web/src/routeTree.gen.ts` → régénéré par `tsr generate`, jamais édité.

## Vérification de chaque critère

| Critère | Preuve |
| ------- | ------ |
| 1. Aucun débordement à 320 px | `atlas.spec.ts`, projet `mobile` à `viewport 320×640` : `scrollWidth - innerWidth ≤ 0` |
| 2. Aucun texte < 10 px | même cas : parcours des nœuds texte de `main`, `fontSize ≥ 10px` |
| 3. Contraste AA des traits informatifs | `atlas.spec.ts` : ratio WCAG entre `stroke` calculé du filet laiton et le fond du cabinet ≥ 3 |
| 4. Table équivalente complète | `atlas.spec.ts` : nombre de lignes = `regions + departements` au national, = `communes` au département ; chaque ligne porte nom + état + couverture ; `svg[aria-hidden=true]` |
| 5. Descente + liens + redirection | `atlas.spec.ts` : clic « Ouvrir les communes de Département E2E A » → lignes de communes ; lien `?commune=E2E-C-RARE-0` ; lien `?departement=E2E-D1` ; `/assemblage?x=1` → `/atlas?x=1` |
| 6. Aucun état React par mouvement | aucun `onPointer*`/`onMouse*` dans `atlas.tsx` (revue + grep), SVG `aria-hidden` |
| 7. Mouvement réduit | `atlas.spec.ts` sous `page.emulateMedia({ reducedMotion: 'reduce' })` : `transition-property` du tracé = `none` |
| 8. `layout/` inchangé | `git diff --stat` ne cite aucun fichier de `components/layout/` |
| 9. `ci:check` + banc verts | sortie réelle de `ci:check` et du banc, comptées |

## Vérification (commandes)

```sh
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_35' \
  dev bun run ci:check

docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
```

## Impact

| Catégorie | Verdict | Traitement |
| --------- | ------- | ---------- |
| runtime | Un cas E2E existant asserte le teaser (`mobile.spec.ts:832-846`) : il devient faux par construction (la salle est remplacée). Réécrit, jamais ignoré. | phase 5 |
| regression | `collection.tsx` gagne `validateSearch` : deux paramètres optionnels, aucun autre lien ne change de type. Vérifié par `tsc` et par le banc. | phase 1 |
| architecture | Aucune. Aucune table, aucun jeton, aucune dépendance. | none |
| documentation | `DESIGN_SYSTEM.md` §2 ne nommait pas la salle : la ligne `/atlas` est **ajoutée** (aucune occurrence d'« Assemblage » à renommer), et le journal le dit. | phase 4 |

## Contradiction relevée dans le brief, et sa résolution

Le point 8 des paramètres impose « clic département → `/collection?departement=<code>` », tandis
que le point 7 impose « clic département → ses communes ». Les deux sont tenus, sans invention :
**ouvrir** le département est un `<button>` sur son nom, **aller au Cadastre** est un `<a>`
distinct dans la même ligne. Aucun des deux ne remplace l'autre.
