---
objective: "L'Atelier est trouvable en tout état dans Le Cadastre — section toujours rendue, règle des trois exemplaires écrite à l'écran, état vide explicite, raison serveur affichée pour une grappe bloquée."
status: done
---

# Plan: Phase 48 — L'Atelier a une place

Source: `.docs/10-retours-v2.md` R-007 **constat B** (seul périmètre de cette phase ; le constat A
— les exemplaires multiples — est déjà livré par la phase 47) + brief de session phase 48.

## Décision de forme (tranchée, non rediscutée)

**Section stable du Cadastre**, pas de salle dédiée.

Justification en une ligne : le cas E2E existant de `atelier.spec.ts` doit passer **inchangé** et
cherche la région « L'Atelier » sur `/collection` ; une salle dédiée imposerait soit de dupliquer
le panneau, soit de casser ce cas, et ferait toucher `nav-items.ts`.

Conséquences : `apps/web/src/components/layout/` n'est pas modifié du tout ; aucune route, aucune
migration, aucun appel d'API nouveau.

## Phases

| # | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1 | Cas E2E neuf, vu rouge | `packages/e2e/tests/atelier.spec.ts` | none |
| 2 | Libellés dérivés de la règle partagée | `apps/web/src/content/collection.ts` | none |
| 3 | Panneau toujours rendu + état vide + raison bloquée | `apps/web/src/components/atelier/craft-panel.tsx` | 2 |
| 4 | Preuve complète (ci:check + banc E2E) | — | 1, 2, 3 |
| 5 | Revue hostile, commits, PR brouillon | `.docs/sessions/atelier-place/review.md` | 4 |

### Phase 1 — le cas E2E neuf, écrit avant le code

- Reporter l'état du banc : le compte principal reçoit 3 doublons `COMMUNE / E2E-C-RARE-1 / RARE`
  (`packages/e2e/fixtures/atelier-fixture.ts`) ; le **compte secondaire** (`e2e-second`) possède
  exactement **1 carte** `E2E-C-RARE-0`, sans aucun doublon (`packages/e2e/fixtures/second-account.ts`).
- Cas A — **état vide** sur le compte secondaire (`test.use({ storageState: secondStorageStatePath })`) :
  la région « L'Atelier » est visible, contient « Aucune grappe à fusionner. », la règle
  (« exemplaires identiques », « palier suivant », « Mythique », « Légendaire »), et aucun bouton
  « Fondre ».
- Cas B — **état bloqué** sur le compte principal : `ensureAtelierCards`, puis mise en vente d'un
  des trois exemplaires par la vraie route `POST /api/v1/market/listings` (`locked = true`), puis
  tentative de fusion. Attendu : l'alerte porte le message **du serveur**
  (« Une carte de ce groupe est verrouillée par une vente en cours. ») et le compteur affiche
  toujours « 3 × … ». Nettoyage : annulation de l'annonce (`DELETE /api/v1/market/listings/:id`)
  puis fusion effective du groupe par l'API, pour laisser le banc dans l'état où le cas de fusion
  existant le laisse (une carte Épique).
- Cas C — le cas de fusion existant **n'est pas touché** (aucune ligne modifiée).
- Vérification : `playwright test tests/atelier.spec.ts` doit être **rouge** sur le cas A avant la
  phase 3 (la section n'est pas rendue sans grappe), et les cas B/C ne doivent pas régresser.

### Phase 2 — les libellés, dérivés et non paraphrasés

`apps/web/src/content/collection.ts` :

- `ATELIER.intro` (qui écrit « trois » en toutes lettres) est remplacé par une fonction
  `atelierRuleLabel()` qui **calcule** son texte depuis `CRAFT_THRESHOLD` et `nextCraftRarity` de
  `@hexamap/shared`, et emprunte ses noms de palier à `RARITY_LABELS`. Aucun `3`, aucun
  `MYTHIQUE` littéral.
- `atelierEmptyHint()` : ce qu'il faut réunir (même carte, même rareté), seuil lu dans
  `CRAFT_THRESHOLD`.
- `ATELIER.emptyTitle` = « Aucune grappe à fusionner. »
- `atelierResultLabel` et `atelierSuccessMessage` restent **inchangés** (le cas de fusion existant
  assert leur texte exact).

### Phase 3 — le panneau ne disparaît plus

`apps/web/src/components/atelier/craft-panel.tsx` :

- Suppression du `if (groups.length === 0 && successCard === null) return null;`.
- La `<section aria-labelledby="atelier-title">` et son `<h2>` sont rendus **toujours**.
- La règle (`atelierRuleLabel()`) est affichée en permanence sous le titre.
- État vide (`role="status"`, donc annoncé) quand aucun groupe et aucune fusion récente.
- Erreur `CARD_ENGAGED` : rendue **dans la grappe tentée** (`role="alert"`), avec le message
  serveur tel que `atelierErrorMessage` le rend ; repli au niveau du panneau si la grappe a
  disparu entre-temps. Aucune heuristique sur `locked`, aucune lecture de `tableaux`, d'annonces
  ou d'offres côté client.
- `craftableGroups(items)` reste la seule source des groupes ; aucun second regroupement, aucun
  `+ 1` de rareté écrit à la main.

### Phase 4 — preuve

```sh
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_48' \
  dev bun run ci:check
```

puis, la surface étant visible, le banc complet :

```sh
docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
```

## External sources

| URL | What it settled |
| --- | --- |
| none | Aucune documentation externe consultée. |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | `craft-panel.tsx` ne rend plus `null` ; le panneau est monté inconditionnellement par `collection.tsx:340`, donc plus aucun état ne le cache. | 3 |
| regression | Le cas de fusion existant (texte `3 × … → 1 carte Épique`) et le budget DOM des planches ne sont pas touchés : aucun composant de planche n'est modifié. | 1, 3 |
| architecture | Aucune : pas de route, pas de migration, pas de contrat d'API, `nav-items.ts` intact. | — |
| documentation | Aucune modification de `.docs/01-architecture.md`, `.docs/02-database.md`, `.docs/05-deploiement.md`, `.docs/06-cadre-juridique.md` ni `packages/e2e` hors tests : R-007 ne l'exige pas. Journal de session seulement. | 5 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `packages/shared/src/atelier.ts` est la seule règle de fusion | La phase écrit la règle à l'écran, elle ne la réimplémente pas. |
| Libellés français dans `apps/web/src/content/` | Aucun texte visible en dur dans le JSX, aucun i18n. |
| Aucun texte visible sous 10 px, aucune couleur littérale | Le panneau n'emploie que les jetons existants et des tailles ≥ `text-[10px]`. |
| Spec-first, jamais de spec réécrite | Aucun calcul partagé n'est ajouté ; la preuve est le cas E2E neuf, écrit et vu rouge avant le code. Aucun cas de `packages/spec` n'est modifié. |
| Tout s'exécute dans Docker | `ci:check` et Playwright passent par Compose. |
| Coquille à propriétaire unique | `apps/web/src/components/layout/` n'est pas touché (forme = section du Cadastre). |

## Decisions

| Decision | Why |
| --- | --- |
| Section stable du Cadastre plutôt que salle dédiée | Le cas E2E existant cherche la région sur `/collection` et doit passer inchangé ; une salle dédiée dupliquerait le panneau ou casserait ce cas. |
| La règle s'affiche en permanence, au-dessus de la liste des grappes | « Écrite dans l'interface » veut dire lisible sans rien cliquer, y compris quand il n'y a rien à fondre. |
| La raison d'un refus est rendue dans la grappe tentée | Le joueur relie la raison au « ×3 » qu'il voit ; un message en tête de panneau se lirait comme une erreur globale. |
