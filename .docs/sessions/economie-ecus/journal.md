# Journal — phase 30.0 (Économie des écus et catalogue des packs)

Branche : `feat/phase-30-0-economie` · Migration réservée : aucune · Base : `main`
Plan : [`plan.md`](./plan.md) · Revue : [`review.md`](./review.md)

## 2026-11-20 — Le catalogue des médailles vaut 6 000 écus, les packs sont écrits

**L'intention, et le chiffre qui la porte.** La progression gratuite ne devait plus valoir
≈ 66 000 écus — un montant qui rendait toute boutique décorative. Le tableau normatif du brief
ramène les 37 primes à **6 000 écus**, soit exactement le prix du plus gros pack (44,99 € TTC).
La boutique devient un raccourci mesurable, pas un chemin parallèle.

**Spec d'abord, vue rouge.** Le `CATALOGUE` local de `packages/spec/src/achievements.spec.ts`
et l'attendu du total ont été descendus à la nouvelle table avant que `achievements.ts` ne bouge,
et `packages/spec/src/packs.spec.ts` a été écrit avant que le module n'existe. Sortie rouge,
dans Docker :

```
$ docker compose --profile tools run --rm -e TEST_DATABASE_URL=… dev bun test \
    packages/spec/src/achievements.spec.ts packages/spec/src/packs.spec.ts

error: expect(received).toBe(expected)
Expected: 25   Received: 100        (… six blocs identiques)

Expected: 50   Received: 250

packages/spec/src/packs.spec.ts:
# Unhandled error between tests
SyntaxError: Export named 'PACKS' not found in module '/app/packages/shared/src/index.ts'.

 14 pass
 46 fail
 1 error
Ran 60 tests across 2 files.
```

Le rouge du total (`Expected 6000 / Received 65950`) tombait dans la tête tronquée de la sortie ;
il n'est donc pas cité comme observé.

**Ce qui a été écrit.**

1. `packages/shared/src/achievements.ts` — les 37 `payout` remplacés, rien d'autre. Aucune clé,
   aucune famille, aucune métrique, aucun seuil, aucun libellé modifié.
   `ACHIEVEMENT_PAYOUT_TOTAL` reste un `reduce` sur la table : le total n'est jamais écrit à la
   main, donc il ne peut pas diverger de la somme réelle.
2. `packages/shared/src/packs.ts` — module pur : `PackKey`, `PackDefinition`, `PACKS` (quatre
   entrées ordonnées), `PACK_KEYS`, `packByKey`, `ecusPerEuro`. Aucun import, aucun
   `process.env` lu, aucun accès réseau, aucun `price_…` réel — seulement des **noms** de
   variables `STRIPE_PRICE_*`.
3. `packages/shared/src/index.ts` — `export * from './packs';`.
4. `packages/spec/src/packs.spec.ts` — 11 cas : longueur, ordre des clés, entiers positifs,
   `currency === 'EUR'`, ratio strictement croissant par accumulateur, égalité
   `PACK_6000.ecus === ACHIEVEMENT_PAYOUT_TOTAL === 6000`, `packByKey` hors catalogue, noms de
   variables uniques et préfixés.
5. `.docs/01-architecture.md` §2.8 — budget à 6 000 (dont 2 440 pour la collection), puce
   « le catalogue complet vaut exactement un `PACK_6000` », puce sur le module pur, tableau des
   quatre packs.

**Le contrôle arithmétique, fait à la main.** Par famille : SCRATCH 1 140, COLLECTION 2 440,
TABLEAU 775, MARKET 575, SOCIAL 730, ATTENDANCE 340 → **6 000**. Le « 2 440 » inscrit dans le
document d'architecture est la somme réelle de la famille, pas une reprise du brief.

**Le prix des annonces dans la spec d'intégration.** Avec la prime du premier ticket à 25 écus,
l'acheteur ne pouvait plus honorer une annonce à 100. Le prix des deux cas d'achat passe à 25 —
c'est une donnée dérivée de la prime, pas une assertion de structure. Effet de bord consigné en
revue (O1) : l'acheteur dépense alors exactement tout son solde.

**Un écart de forme assumé.** La consigne de fichiers partagés demandait d'ajouter l'export
`./packs` **à la fin** de `index.ts`. Il est en position alphabétique : `biome check`
(`organizeImports`) refuse un export non trié et `ci:check` s'arrêterait à `1/4 Lint`.

**Ce qui n'a pas été touché, volontairement.** Aucune migration, aucun schéma, aucun index,
aucune route, aucun composant, aucun texte d'interface. `currency_ledger` et `user.currency`
gardent leur historique : un solde n'est pas une table de configuration. `ROADMAP.md`,
`.docs/02-database.md` et `.docs/03-active-task.md` sont intacts. Aucune dépendance ajoutée.

**Vérification (Docker uniquement)**

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_300' \
  dev bun run ci:check

[hexamap] ✓ 1/4 Lint   ✓ 2/4 Typecheck   ✓ 3/4 Base de données   ✓ 4/4 Spécifications
 279 pass, 0 fail, 1670 expect() calls, Ran 279 tests across 16 files
[hexamap] ✓ Gatekeeper vert.
```

Ciblé sur les deux fichiers de la phase : `70 pass, 0 fail, 506 expect() calls`.

**Références obsolètes laissées en place.** `ROADMAP.md:79` (« ~66 000 écus ») et
`.docs/sessions/les-medailles/{phase-1,journal}.md` citent encore 65 950. Les premiers sont hors
périmètre (interdits), les seconds appartiennent à l'archive d'une autre session. Consigné en
revue (O3) pour consolidation par le lanceur.

**Portée** : cinq fichiers de code/doc, plus ce dossier de session. Aucune migration, aucune
dépendance nouvelle, `packages/db`, `apps/api` et `apps/web` intacts.
