# Journal — Phase 27, Les Médailles (succès → écus)

Branche : `feat/phase-27-les-medailles`. Migration réservée : `0011_achievements`. Base de test :
`hexamap_test_27`.

## Ce qui est livré

| Élément | Fichier |
| :--- | :--- |
| Catalogue pur (37 médailles, six familles, budget 65 950) | `packages/shared/src/achievements.ts` |
| Spec du catalogue et d'intégration (54 cas) | `packages/spec/src/achievements.spec.ts` |
| Table `user_achievements` + semis de l'interrupteur | `packages/db/migrations/0011_achievements.ts` |
| Enregistrement et types Kysely | `packages/db/src/migrator.ts`, `packages/db/src/schema.ts` |
| Métriques serveur et versement transactionnel | `apps/api/src/services/achievements.ts` |
| `GET /api/v1/achievements` | `apps/api/src/routes/achievements.ts`, `apps/api/src/app.ts` |
| Chargeur de tableaux partagé | `apps/api/src/services/tableaux.ts`, `apps/api/src/routes/tableaux.ts` |
| Salle « Les Médailles » | `apps/web/src/routes/achievements.tsx`, `lib/achievements.ts`, `content/achievements.ts`, `nav-items.ts` |
| Statut de la table | `.docs/02-database.md` §2 : `user_achievements` **Migrée** |

## Résultat exact de `ci:check`

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_27' \
  dev bun run ci:check

✓ 1/4 Lint        Checked 173 files, no fixes applied
✓ 2/4 Typecheck   six workspaces, dont apps/web (tsr generate && tsc)
✓ 3/4 Base de données   PostgreSQL joignable
✓ 4/4 Spécifications    213 pass, 0 fail, 1228 expect() calls, 12 fichiers
```

Premier passage : **rouge** au typecheck, `packages/spec/src/achievements.spec.ts(129,27)`
(`new Set(CATALOGUE.map(...))` inféré en union littérale). Corrigé par une annotation
`new Set<string>(…)` — aucune assertion modifiée, aucun comportement touché.

## Écarts assumés

1. **Contradiction de contrat sur `"user".currency`.** `.docs/01-architecture.md` §2.8 dit que
   le solde « ne monte que par une ligne de `currency_ledger`, jamais par une écriture directe
   sur `user.currency` ». Or le marché ne lit **que** cette colonne (`market.ts:407`) : verser
   le grand-livre seul laisserait le joueur insolvable, et le critère « il peut acheter »
   échouerait. Le versement écrit donc les deux dans la même transaction, exactement comme
   l'achat du marché le fait déjà. Le grand-livre reste la source d'audit ; la colonne en est le
   cache lisible. La contradiction est signalée, pas corrigée : la trancher demande une édition
   de `.docs/01-architecture.md`, interdite dans cette session.

2. **Médailles sociales déclarées et verrouillées.** `friendships` n'existe ni dans
   `schema.ts` ni en migration sur cette base (la phase 28 n'est pas fusionnée ici, contrairement
   au brief). Le ROADMAP §2 prescrit explicitement « ship declared and locked with this phase ».
   `friendsAccepted` and `profileComplete` valent donc `null` : la médaille reste « À venir » et
   ne peut jamais être obtenue. Le comptage des amitiés `ACCEPTED` n'est pas branché.

3. **Extraction du chargeur de tableaux.** `apps/api/src/routes/tableaux.ts` portait en ligne la
   construction de la géographie et la résolution des cartes. La phase a extrait ces aides dans
   `apps/api/src/services/tableaux.ts` (`loadTableauScores` en plus) pour que les médailles et La
   Planche partagent un seul calcul. La route ne change pas de comportement (`+7 / −108`).

4. **Fixtures de spec.** Le cas d'intégration sème un `tickets` `ACTIVE` (`grid: []`) et un
   `ticket_reveals` plutôt que de générer un ticket par l'API, qui exigerait un référentiel
   complet. La case révélée n'est pas la Pépite (`cell_index 1` vs `treasure_index 0`), donc
   seule `SCRATCH_FIRST_TICKET` se déclenche.

## Ce qui n'est pas fait

- Aucun passage navigateur/E2E : l'absence de défilement horizontal à 390 px et le rendu des 37
  cartes sont structurels (`grid-cols-1`, `min-w-0`, aucune largeur fixe) mais non mesurés.
- Le cycle `down`/`up` de la migration 0011 n'a pas été rejoué : le runner n'expose pas de
  commande `down`.
- Les médailles ne sont pas réévaluées à chaque mutation (grattage, vente, achat). L'évaluation
  se déclenche à la lecture de `GET /api/v1/achievements`, ce qui suffit à l'idempotence et évite
  d'alourdir chaque transaction du jeu.
