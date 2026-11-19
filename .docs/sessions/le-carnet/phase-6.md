---
status: done
---

# Instruction: Preuve et mémoire

## Architecture projection

```txt
scripts/import/src/
  e2e-seed.ts            ✏️ plafond du banc relevé dans game_config
packages/e2e/tests/
  charges.spec.ts        ✅ trois cas : rendu, état zéro, dépense réelle
.docs/sessions/le-carnet/
  review.md              ✅ verdict de la relecture hostile
  journal.md             ✅ journal de session
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | image de production du banc construite | `hexamap.test` répond en HTTPS | cli |
| Happy path | `/api/v1/charges` intercepté à `{charges: 4, cap: 6, nextChargeAt}` | quatre points pleins, libellé « 4 charges sur 6 », compte à rebours affiché | browser |
| Happy path | aucune interception : clic sur « Obtenir un ticket », retour au Relevé | les points ont diminué de un et un compte à rebours est affiché | browser |
| Edge case | `/api/v1/charges` forcé à `{charges: 0}` | bouton inerte, « Aucune charge disponible », compte à rebours affiché | browser |
| Edge case | `nextChargeAt` à +2 s, attente de 3 s | le compte à rebours atteint zéro **sans requête réseau** | browser |
| Teardown | `down -v` du banc | base du banc jetable, aucune ligne résiduelle | cli |

## Tasks to do

### `1)` Le banc E2E

1. `packages/e2e/tests/charges.spec.ts`, projet `chromium`, sur le modèle de `packages/e2e/tests/core-loop.spec.ts` (sélecteurs par rôle et libellés français).
2. **Cas 1, sans interception** : lire le nombre de points sur `/`, cliquer « Obtenir un ticket », revenir sur `/`, constater un point de moins et un compte à rebours. C'est la seule preuve de bout en bout que le carnet se vide réellement.
3. **Cas 2** : `page.route('**/api/v1/charges', …)` rend `{charges: 0, cap: 6, nextChargeAt: +12 min, regenMs: 1800000}`; constater bouton inerte et motif français. Déterministe, sans état serveur.
4. **Cas 3** : même interception avec `nextChargeAt` à `+2 s`, attendre 3 s, constater que le compte à rebours a atteint zéro et qu'**aucune** requête `/api/v1/charges` n'a été émise pendant l'attente.
5. `scripts/import/src/e2e-seed.ts`: relever `SCRATCH_CHARGE_CAP` et `SCRATCH_START_CHARGES` (par exemple 30) **avec un commentaire** expliquant que `global-setup.ts` prépare jusqu'à 8 tickets pour un même compte et que le plafond vient de `game_config`, jamais du code. C'est aussi la démonstration mécanique que le plafond n'est pas une constante.

### `2)` La preuve

1. `docker compose --profile tools run --rm -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_26' dev bun run ci:check` — quatre étapes vertes.
2. Banc E2E si l'image se construit : `docker-compose.e2e.yml`, suite complète, aucun flaky.
3. Vérifier qu'aucun solde n'est mis en cache par le worker : les entrées `NetworkOnly` de `apps/web/vite.config.ts` couvrent `/api/` par méthode, donc `/api/v1/charges` est déjà exclu — le constater, ne rien changer.
4. Consigner les chiffres réellement observés (spécifications, fichiers), sans les arrondir.

### `3)` La mémoire de session

1. `.docs/sessions/le-carnet/review.md`: verdict de la relecture hostile, défauts et gravité.
2. `.docs/sessions/le-carnet/journal.md`: décisions, écarts assumés (dont l'erreur de configuration levée à la lecture et non au démarrage), résultats exacts.
3. `.docs/03-active-task.md`, `ROADMAP.md` et `.docs/01-architecture.md` restent intacts.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les trois cas passent sur `chromium`; le cas 1 échoue si le carnet ne se vide pas réellement. |
| 1 | Le plafond relevé dans le semis est commenté et aucun `MAX_TICKETS` du banc ne dépasse le plafond effectif. |
| 2 | `ci:check` vert, avec le nombre de spécifications et de fichiers observé, pas estimé. |
| 2 | Si le banc E2E ne peut pas être construit, le rapport le dit — aucun « fait » sur une intention. |
| 3 | Le journal nomme chaque écart assumé et sa raison. |
