# Journal — phase 38, La Vitrine, la planche montrée

Branche `feat/v2-38-vitrine-planche`, base `feat/v2-wave-1`. Aucune migration, aucune dépendance
nouvelle. Journal de session, hors `.docs/03-active-task.md` (consolidé par le lanceur).

## Ce qui a été lu avant d'écrire

`AGENTS.md`, `.docs/01-architecture.md` (§2.9 et §4.9 en entier), `.docs/02-database.md`,
`.docs/03-active-task.md`, `.docs/07-roadmap-v2.md` §4. Puis, dans le code :
`apps/api/src/routes/players.ts`, `apps/api/src/services/profile.ts` (les 518 lignes),
`apps/api/src/services/draw.ts` (`blasonOf`, `resolveCardAssets`, `resolveCardNoms`),
`apps/web/src/routes/players.$playerId.tsx`, `apps/web/src/components/ui/Card.tsx`,
`cards/card-shell.ts`, `cards/region-card.tsx`, `cards/rue-card.tsx`,
`apps/web/src/content/player-profile.ts`, `packages/spec/src/profile.spec.ts`,
`packages/e2e/fixtures/{tableau,second-account}.ts`, `packages/e2e/tests/{second-account,tableau,design-system}.spec.ts`,
`packages/e2e/playwright.config.ts`, `packages/db/src/index.ts`.

## Ce que l'état des lieux a établi, et qui a conduit le plan

- `loadBestTableau` **jetait** les quatre `CardRow` après le calcul du score : le travail de
  résolution était déjà fait, il manquait la restitution.
- Un tableau troué était **purement ignoré** (`continue`), donc jamais rendu. La phase exige
  l'inverse : quatre positions, `null` compris.
- `blasonOf` est l'unique propriétaire du repli `blason_url ?? contour_url` et n'était pas utilisé
  par la vitrine.
- Aucun cas E2E ne couvrait `/players/:id`, et **aucune ligne `tableaux` n'est semée** par le
  banc : le cas navigateur ne pouvait pas exister sans une fixture neuve.
- `createDb` n'acceptait aucune option, donc aucun journal SQL exploitable pour prouver le nombre
  d'instructions.

## Ordre réel des travaux

1. Plan écrit dans `.docs/sessions/vitrine-planche/plan.md` avant toute ligne de code.
2. **Spec d'abord** : cinq cas neufs dans `packages/spec/src/profile.spec.ts`, vus **rouges**
   (`Received value does not have a length property: undefined`, `expect(…).not.toBeNull()`
   reçu `null`) puis verts.
3. API : `PlayerBestTableauSlot`, `loadBestTableauSlots` (une instruction, CTE `showcase_slots`,
   `blasonOf` côté TS), suppression du saut des tableaux troués, schéma TypeBox.
4. Web : libellés dans `content/player-profile.ts`, quatre cellules dans la feuille du meilleur
   tableau, feuille passée en pleine largeur.
5. Banc : `packages/e2e/fixtures/vitrine-fixture.ts` et `packages/e2e/tests/vitrine.spec.ts`.
6. Revue hostile, qui a trouvé deux défauts réels (voir `review.md` R-1 et R-2).

## Deux corrections issues de la revue, pas de l'implémentation

- `t.Array(t.Union([objet, t.Null()]))` répondait **422** sur un tableau troué, alors que le
  tableau complet passait. Vérifié en rejouant la spec avec ce schéma, puis remplacé par un tuple
  de quatre `anyOf`.
- La fixture E2E désignait le compte principal par les trois codes stables seulement. Après un
  réensemencement, les identifiants d'odonyme changent et un compte d'un run précédent reste
  candidat : le banc échouait sur « ne possède aucune carte RUE 75 ». Résolu en exigeant le combo
  entier avec l'odonyme courant et en prenant le compte le plus récent.

## Mesures

| Mesure | Valeur |
| :--- | :--- |
| `ci:check` | **353 spécifications, 19 fichiers, 0 échec, 2 091 assertions** |
| Banc E2E complet | **75 exécutés, 75 passés, 0 échoué, 0 ignoré** (deux passages) |
| Instructions pour les quatre emplacements | **1**, invariante au nombre de cartes (spec, deux fois) |
| Instructions de la page | 17 au premier appel du processus, 12 en régime établi (14 avant la phase) |
| Budget DOM des quatre planches | Région 15, Département 16, Commune 15, Rue 17 (≤ 18) |

Référence de branche avant la phase : `ci:check` 343/18 dans `.docs/03-active-task.md` ; sur
`feat/v2-wave-1`, avant cette phase, la suite comptait **348** cas sur 19 fichiers. La phase en
ajoute cinq, tous dans `profile.spec.ts`.

## Ce que cette session ne prouve pas

- Le total « une seule requête pour la page entière » n'est pas atteint au sens littéral ; seul le
  coût des quatre emplacements est prouvé (voir `review.md` R-6).
- Les planches affichent `—` pour la population d'une commune et les occurrences d'une rue, faute
  de champ au contrat (R-4).
- Le SQL brut de la requête contrevient à `apps/api/AGENTS.md`, avec le précédent du même fichier
  et la forme demandée par le brief (R-3).
- Aucune vérification visuelle humaine hors Playwright : la preuve navigateur est le banc, capture
  `vitrine-planches` attachée au cas de budget.
