# Journal — Phase 26 · Le Carnet

## Ce qui est livré

| Couche | Fichier | Rôle |
| --- | --- | --- |
| Formule pure | `packages/shared/src/charges.ts` | `regenerateCharges` (serveur) et `chargesAt` (décompte local), aucune entrée-sortie, aucun `Date.now()` |
| Spécifications | `packages/spec/src/charges.spec.ts` | 24 cas : 12 formule, 7 service, 5 API |
| Base | `packages/db/migrations/0009_scratch_charges.ts` | `user_scratch_charges` + semis des six clés de `game_config` |
| Schéma | `packages/db/src/schema.ts`, `migrator.ts` | `UserScratchChargeTable`, migration enregistrée |
| Service | `apps/api/src/services/config.ts`, `charges.ts` | lecture de `game_config`, dérivation, `FOR UPDATE`, dépense |
| API | `apps/api/src/routes/charges.ts`, `tickets.ts`, `app.ts` | `GET /api/v1/charges`, génération sous charge |
| Front | `apps/web/src/lib/charges.ts`, `use-charge-countdown.ts`, `components/charges-meter.tsx`, `routes/index.tsx`, `content/tickets.ts` | carnet, compte à rebours, bouton désarmé |
| Banc | `packages/e2e/tests/charges.spec.ts`, `scripts/import/src/e2e-seed.ts` | trois cas de bout en bout, plafond du banc relevé par `game_config` |

## Décisions

1. **La formule vit dans `packages/shared`, l'état avec.** `regenerateCharges` rend `{ charges, lastRegenAt, nextChargeAt }` et non un simple affichage : sans cela la route aurait recalculé le solde pour le persister, et la formule aurait eu deux propriétaires.
2. **`chargesAt` est un second helper pur, assumé.** Le décompte du navigateur a besoin de la même arithmétique ; le front ne pouvait pas rester sans formule. Le doublon est une duplication *de code* dans un même module, verrouillée par des cas, pas une duplication de règle entre deux couches.
3. **La conversion d'unité n'a qu'un endroit.** La base parle `timestamptz`, `packages/shared` parle en millisecondes epoch : `apps/api/src/services/charges.ts` est la seule frontière (`getTime()` à l'entrée, `new Date(ms)` à la sortie). Aucun `Date` n'entre dans le module partagé.
4. **La charge est dépensée dans la transaction du tirage.** Un `23505` sur `tickets_one_active_per_user` fait annuler la transaction, donc la dépense. Le pré-contrôle `TICKET_ALREADY_ACTIVE` reste hors transaction pour ne pas payer une charge sur un refus évident.
5. **`consumeCharge` redérive après décrément.** Renvoyer tel quel l'état figé au plafond donnerait `charges = cap - 1` avec `nextChargeAt = null` : une charge manquante sans compte à rebours. Le service rappelle `regenerateCharges` sur le solde décrémenté, ce qui arme `now + regenMs` sans réécrire l'arithmétique.
6. **Le bouton suit le solde dérivé, pas la valeur brute.** C'est la correction du premier jet : un compte à rebours qui crédite un point alors que le bouton reste inerte est une incohérence visible.

## Écarts assumés

1. **L'erreur de configuration est levée à la lecture, pas au démarrage.** `.docs/02-database.md` §4.1 dit « exigées au démarrage ». Un hook `onStart` couplerait le boot de l'API à l'ordre des migrations en développement ; une clé absente produit donc `503 GAME_CONFIG_MISSING` à la première lecture, jamais une valeur de repli. La divergence est de lieu, pas de comportement : aucun défaut silencieux n'existe.
2. **`config.ts` ne lit que les trois clés `SCRATCH_*`.** Une clé des phases 27 à 29 manquante ne doit pas fermer la génération de tickets. Les trois autres restent semées et au contrat.
3. **Le banc E2E relève son plafond à 30 par `game_config`.** `global-setup.ts` prépare jusqu'à 8 tickets pour un même compte, sans fenêtre de régénération. Relever le plafond par une ligne de `game_config` est aussi la démonstration mécanique qu'aucune migration n'est nécessaire pour le changer.
4. **Le baril `packages/shared/src/index.ts` est trié par Biome.** L'ajout d'export devait aller « en fin de liste » ; `organizeImports` de `ci:check` impose l'ordre alphabétique. Biome a tranché.
5. **`tickets.spec.ts` a une marge nulle.** Sa boucle de reprise autorise exactement six générations pour un même compte — le plafond. Le cas est vert, mais toute septième génération échouerait. Signalé, non modifié : un cas de spécification ne s'édite pas pour faire passer une implémentation.

## Défauts trouvés par le filet, pas par le plan

1. **Débordement horizontal de 104 px à 390 px et 174 px à 320 px sur Le Relevé.** La rangée de points du carnet valait `30 × 10 + 29 × 6 = 474 px` de largeur `min-content`, non sécable : `flex-wrap` sur le parent ne replie pas un enfant unique de 474 px. Corrigé par `min-w-0 flex-wrap` **sur la rangée elle-même**. Le défaut n'apparaissait que lorsque le compte n'avait aucun ticket actif — c'est-à-dire jamais dans le premier passage du banc, où le compte du banc en avait un. C'est exactement le genre de régression qu'un état de fixture peut masquer.
2. **Le banc ne reconstruit pas le service `seed`.** `up -d --build db api proxy` ne construit pas `seed`, qui rejoue son image en cache : le plafond relevé n'a pas été appliqué, et la préparation du banc a épuisé six charges. Il faut `docker compose -f docker-compose.e2e.yml build seed` dès que `scripts/import` change.
3. **Les cas E2E du carnet cherchaient le bouton dans un état qui ne l'affiche pas.** Le compte du banc arrivait avec un ticket actif : le Relevé rend « Reprendre mon ticket », sans carnet ni bouton de génération. Les deux cas sont désormais isolés par un `404 NO_ACTIVE_TICKET` intercepté sur `/api/v1/tickets/current`.

## Vérification (Docker uniquement)

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_26' \
  dev bun run ci:check
  1/4 Lint · 2/4 Typecheck · 3/4 Base de données · 4/4 Spécifications
  183 pass, 0 fail — 183 tests, 12 fichiers

docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  58 passed, 3 skipped, 0 failed
```

Avant la phase, la suite comptait **159 spécifications sur 11 fichiers** ; `charges.spec.ts` en ajoute **24** et porte le total à **183 sur 12 fichiers**. Le banc comptait **58 tests, 55 passés, 3 ignorés** ; il compte **61 tests, 58 passés, 3 ignorés** — les trois cas neufs, tous sur `chromium`.

**Un flaky préexistant, consigné.** Deux passages du banc complet ont rendu un cas instable de la barre basse (`mobile — la cible « Plus » fait au moins 44 px`, `mobile — « Les Planches » ne s'allume pas sur La Planche`) : chaque fois vert au rejeu, et `3/3` en exécution isolée. Ces cas dépendent de la résolution de session, pas du carnet, et changent d'un passage à l'autre — c'est un aléa de banc, pas une régression de la phase.

## Ce que la preuve ne prouve pas

- La concurrence HTTP de bout en bout (deux `POST /tickets` simultanés avec une charge) n'est vérifiée qu'au niveau **service**, où le `FOR UPDATE` est exercé sur deux transactions réelles. Au niveau HTTP, la course est absorbée soit par `NO_CHARGE_LEFT`, soit par `TICKET_ALREADY_ACTIVE`, et les deux cas sont couverts séparément.
- L'état « zéro charge » du banc est **intercepté** (`page.route`), donc déterministe mais non produit par le serveur. La génération réelle avec une charge restante est, elle, exercée sans interception.
- Aucune vérification visuelle de l'écran avec un plafond de 6 sur un vrai appareil, au-delà des deux projets tactiles du banc.
