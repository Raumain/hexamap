# Revue hostile — Phase 26 « Le Carnet »

**Verdict : « prêt à livrer »**

Relecture statique du diff `main...HEAD` et des fichiers non suivis. Aucun code n'a été exécuté,
aucun fichier source n'a été modifié. Aucun défaut de gravité **deal-breaker** n'a été trouvé :
les huit critères numérotés de `.docs/03-active-task.md` tiennent, et la preuve E2E qui les
complète tient aussi. Les points ci-dessous sont des suggestions, dont deux à traiter avant
merge (contrat §4.1 et fuite d'intervalle).

> Note de lecture : `.docs/03-active-task.md` numérote **huit** critères, pas neuf. Le neuvième
> retenu ici est le critère de preuve de l'étape 6 (« Banc E2E : le carnet se vide, le compte à
> rebours s'affiche, le bouton se désarme à zéro »), qui n'est pas numéroté dans le document.

---

## Défauts et points vérifiés

| Gravité | Fichier:ligne | Défaut | Correctif |
| :--- | :--- | :--- | :--- |
| **suggestion** | `apps/api/src/services/config.ts:28-41` ; `.docs/02-database.md` §4.1 | Le contrat exige **six** clés « au démarrage » ; le code n'en lit que **trois**, à la première requête. Une base incomplète démarre saine et n'échoue qu'au premier ticket (`503 GAME_CONFIG_MISSING`). La déviation est assumée dans `plan.md`, mais §4.1 n'a pas été amendé : la mémoire projet contredit le code. | Soit un contrôle de démarrage (`onStart`/`createApp`) lisant les six clés et levant une erreur fatale, soit amender §4.1 (« lues à la première utilisation ; trois clés requises en phase 26 ») et le journal. Ne pas laisser le plan seul porter la décision. |
| **suggestion** | `apps/web/src/lib/use-charge-countdown.ts:27-32` ; `apps/web/src/routes/index.tsx:163-171,199` | L'intervalle d'une seconde n'est arrêté que lorsque `nextChargeAt` change ou au démontage. Deux cas le laissent tourner à vide : **(a)** le solde atteint localement le plafond — `chargesAt` rend `nextChargeAt: null`, mais la prop `nextAt` reste non nulle, donc l'intervalle continue et le composant se re-rend chaque seconde ; **(b)** un ticket est actif — le hook est appelé avant le `return` de la branche ticket, donc le Relevé se re-rend chaque seconde alors que le carnet n'est pas affiché. Le commentaire « ne s'arme pas au plafond » est faux dans (a). | Calculer `local` avant l'effet et n'armer l'intervalle que si `local.nextChargeAt !== null` ; ajouter `charges` et `cap` aux dépendances. Extraire le CTA sans ticket dans un composant enfant qui porte `useQuery(chargesQueryOptions)` + `useChargeCountdown`, rendu seulement dans la branche « aucun ticket ». |
| **suggestion** | `packages/shared/src/charges.ts:39-63` | Deuxième implémentation de l'arithmétique du crédit (`chargesAt`) à côté de `regenerateCharges`. Elles ne partent pas du même état (`nextChargeAt` vs `lastRegenAt`) : une évolution de l'une (arrondi, plafond, délai) peut diverger silencieusement de l'autre. Le plan le justifie, mais la propriété n'est verrouillée que par quatre cas d'exemple. | Faire dériver `chargesAt` de la même fonction (par exemple un unique `creditAt(nextChargeAt, …)`), ou ajouter un test de propriété qui compare les deux sur des états aléatoires, plafond et horloges qui reculent compris. |
| **suggestion** | `packages/db/src/schema.ts:126` et `:204` | Les ajouts ne sont pas en fin de liste, contrairement à la règle du plan (« Ajouts en fin de liste dans `migrator.ts`, `schema.ts` »). `UserScratchChargeTable` est inséré entre `CurrencyLedgerTable` et `RefRegionTable`, et l'entrée `Database` entre `currency_ledger` et `ref_regions`. Cela suit l'ordre de `.docs/02-database.md` §6, mais expose une collision de merge avec les sessions 27-29 qui écrivent les mêmes fichiers. | Déplacer l'interface après `CommuneOdonymeTable` et l'entrée après `commune_odonymes`, puis aligner §6 sur le même ordre ; ou assumer l'ordre du contrat et le documenter. |
| **suggestion** | `apps/api/src/routes/tickets.ts:137-143` ; `apps/api/src/services/charges.ts:121-125` | `consumeCharge` accepte `Executor` (donc un `Kysely` nu). Appelé avec `db`, le `SELECT … FOR UPDATE` est en autocommit : le verrou est relâché à la fin de la requête et la dépense est persistée avant `generateTicket`. La route passe bien `trx`, mais la signature invite un futur appelant à perdre une charge sur un échec ultérieur. | Typer `consumeCharge` en `Transaction<Database>` (ou ajouter une garde `exec.isTransaction`), et réserver `Executor` à `readCharges`. |
| **suggestion** | `packages/spec/src/charges.spec.ts:370-395,421-437,439-451` | Ces cas mutent la configuration **globale** (`SCRATCH_CHARGE_CAP` à 8, `SCRATCH_START_CHARGES` à 9, suppression de `SCRATCH_CHARGE_CAP`) dans la base partagée par tous les fichiers de spec (`ci:check` impose un seul `DATABASE_URL`, pas de schéma isolé par worker). Si Bun exécute les fichiers en parallèle, un autre cas peut lire un plafond à 8/9 ou une clé absente. Les `finally` restaurent, mais la fenêtre existe et un crash laisse la base modifiée. | Isoler ces cas (schéma dédié ou transaction annulée), ou les marquer `test.serial`/les déplacer dans un fichier exécuté seul. À défaut, documenter que Bun exécute les fichiers séquentiellement. |
| **suggestion** | `packages/spec/src/tickets.spec.ts:504` | Boucle de reprise préexistante qui peut créer **exactement six** tickets pour un même compte (`attempt < 6`, `createTicket` à `attempt > 0`) : c'est le plafond, sans marge. Le cas passe aujourd'hui, mais toute reprise supplémentaire ou tout changement de `SCRATCH_START_CHARGES` le transforme en `409 NO_CHARGE_LEFT`. La règle interdit de modifier les specs existantes ; le risque doit être décidé, pas subi. | Ne pas toucher au cas dans cette PR ; consigner le couplage et, dans une PR de spec dédiée, donner un compte neuf à la boucle ou abaisser la borne. |
| **suggestion** | `apps/api/src/services/config.ts:20-25` | `requireNumber` accepte un nombre négatif ou fractionnaire. Un `SCRATCH_CHARGE_CAP` négatif rend `current` négatif, un `startCharges` négatif viole le `CHECK (charges >= 0)` (500), et un `regenMs` fractionnaire fausse le compte à rebours. Le schéma TypeBox `t.Integer()` ne protège que la réponse. | Valider `Number.isInteger`, `cap >= 1`, `regenMs >= 0`, `startCharges >= 0` dans `requireNumber` (ou des validateurs nommés), et lever `503 GAME_CONFIG_MISSING` sinon. |
| **suggestion** | `apps/web/src/components/charges-meter.tsx:36-51` ; `apps/web/src/routes/index.tsx:259` | Le passage de `0` à `1` charge n'est pas annoncé (`aria-live` absent sur le libellé) ; le bouton désarmé porte un `aria-label`, mais le motif affiché n'est pas relié par `aria-describedby`. Un lecteur d'écran ne sait pas que le bouton vient de s'activer. | Ajouter une région `aria-live="polite"` (ou annoncer le crédit) et `aria-describedby` sur le bouton vers le paragraphe de motif. |
| **suggestion** | `apps/api/src/services/charges.ts:25` ; `apps/web/src/content/tickets.ts:100` | Le message français « Aucune charge disponible : votre prochaine charge arrive bientôt. » est écrit deux fois. Une évolution de l'un désynchronise l'API et l'UI. | Extraire le message dans `packages/shared` (ou un module de contenu partagé) et l'importer des deux côtés ; à défaut, un test verrouille l'égalité. |
| **correct** | `packages/shared/src/charges.ts:20-36` | La dérivation conserve bien le reste fractionnaire : `earned` est un plancher, `lastRegenAt` avance de `credited × regen` et non jusqu'à `now`. Le figeage au plafond et le `nextChargeAt: null` sont corrects. | — |
| **correct** | `apps/api/src/services/charges.ts:60-72` ; `apps/api/src/routes/tickets.ts:137-143` | Le verrou `FOR UPDATE` est pris dans la transaction qui génère le ticket ; un refus ultérieur annule la dépense. Le `23505` de `tickets_one_active_per_user` est mappé en `409`, pas en `500`. | — |
| **correct** | `packages/db/migrations/0009_scratch_charges.ts:11-16` | Le `CHECK` ne porte aucune borne haute ; le plafond reste dans `game_config`. La table `tickets` et son index unique partiel ne sont pas touchés. | — |

---

## Critères d'acceptation

| # | Critère | Verdict | Preuve |
| :--- | :--- | :--- | :--- |
| 1 | Un compte neuf dispose de `SCRATCH_START_CHARGES` charges, au plafond. | **tenu** | `apps/api/src/services/charges.ts:50-58` insère `min(startCharges, cap)` ; `packages/spec/src/charges.spec.ts:346` « un compte neuf démarre au plafond » (6/6) et `:439` « les charges de départ sont plafonnées » (9 → 6). |
| 2 | Une charge se régénère toutes les `SCRATCH_REGEN_MS` et le solde est **dérivé** : aucun compteur incrémenté par une requête. | **tenu** | `packages/shared/src/charges.ts:20-36` ; `apps/api/src/services/charges.ts:67-72,95-100` persisté uniquement l'état dérivé ; aucun `charges++` dans le diff. `charges.spec.ts` « une charge créditée avance `last_regen_at` d'exactement un délai ». |
| 3 | Le plafond est lu dans `game_config` : le passer à 8 ne demande aucune migration. | **tenu** | `apps/api/src/services/config.ts:28-41` lit `SCRATCH_CHARGE_CAP` ; `0009_scratch_charges.ts:13` n'a pas de borne haute ; `charges.spec.ts:370` règle le plafond à 8, `snapshot.cap` vaut 8 ; `:439` prouve que les charges de départ suivent le plafond. |
| 4 | Deux lectures consécutives ne perdent aucune minute vers la charge suivante. | **tenu** | `packages/shared/src/charges.ts:32-36` avance `lastRegenAt` de `credited × regen` ; `charges.spec.ts` « deux lectures successives ne volent pas le reste fractionnaire » ; le service persiste la valeur avancée (`services/charges.ts:95-100`), et le test d'intégration vérifie `stored + REGEN`. |
| 5 | Au plafond, la régénération est suspendue et `nextChargeAt` vaut `null`. | **tenu** | `packages/shared/src/charges.ts:28-30,58-60` ; `charges.spec.ts` « la régénération se fige au plafond » et « `nextChargeAt` vaut null au plafond » ; `charges.spec.ts` « GET /api/v1/charges rend le carnet complet » rend `nextChargeAt: null`. |
| 6 | Deux générations concurrentes avec une charge restante : une seule passe. | **tenu** | `apps/api/src/services/charges.ts:60-72` (`FOR UPDATE`) ; `apps/api/src/routes/tickets.ts:137-143` (une seule transaction avec la génération) ; `charges.spec.ts:397` « deux dépenses concurrentes avec une charge : une seule passe » (1 succès, 1 `409`, solde 0). Réserve : le cas appelle `consumeCharge` directement, pas la route HTTP complète. |
| 7 | `tickets_one_active_per_user` et l'unicité du ticket actif sont intacts. | **tenu** | `0009_scratch_charges.ts` ne touche pas `tickets` ; aucun diff sur `0003_game.ts` ; `apps/api/src/routes/tickets.ts:124-134` garde le pré-contrôle et `:151-160` mappe le `23505` ; `charges.spec.ts` « un ticket déjà actif laisse le solde intact » (5 charges avant et après). |
| 8 | Aucun sondage : `/charges` n'est pas appelé en boucle, aucun solde en cache du worker. | **tenu** | `apps/web/src/lib/charges.ts:63-69` n'a ni `refetchInterval` ni `refetchOnWindowFocus` forcé ; le tic est local (`use-charge-countdown.ts:30`) ; `packages/e2e/tests/charges.spec.ts:119` vérifie `chargeRequests === 1` après le crédit ; le worker reste en `NetworkOnly` sur `/api/` (vérifié en phase 6, aucun changement). Réserve : la fuite de l'intervalle au plafond est réelle (défaut ci-dessus), mais elle n'appelle pas `/charges`. |
| 9 | Preuve E2E (étape 6, non numérotée dans `.docs/03`) : le carnet se vide, le compte à rebours s'affiche, le bouton se désarme à zéro. | **tenu** | `packages/e2e/tests/charges.spec.ts:73` (clic réel, retour au Relevé, `before - 1`, `role="timer"` visible), `:98` (zéro, bouton `disabled`, motif français), `:119` (crédit local sans requête). Banc annoncé : 58 passés, 3 ignorés. Réserve : l'état zéro est **stubbé**, pas atteint par épuisement réel du serveur ; le cas réel ne prouve que `before - 1`. |

---

## Régression

**Ce que la preuve établit.** `ci:check` vert — 183 spécifications, 12 fichiers, 0 échec — couvre
la formule pure (`regenerateCharges`, `chargesAt`), le service (`readCharges`, `consumeCharge`),
l'API (`GET /charges`, `409 NO_CHARGE_LEFT`, compte neuf, ticket déjà actif) et l'isolation par
préfixe des données de référence. Le banc E2E (58 passés, 3 ignorés) couvre le clic réel qui
consomme une charge, l'affichage du compte à rebours, le bouton désarmé à zéro et l'absence de
requête `/charges` pendant le crédit local.

**Ce qu'elle n'établit pas.** Le comportement concurrent n'est prouvé qu'au niveau
`consumeCharge`, pas sur deux `POST /api/v1/tickets` HTTP réels ; l'état zéro du banc est une
interception, pas un carnet vidé par le serveur ; les cas de spec qui mutent `game_config` ne
sont pas isolés du reste de la suite (base unique, pas de schéma par worker) ; la boucle de
`tickets.spec.ts:504` reste à exactement six générations, sans marge ; et `env()` n'est pas en
cause ici, mais le flaky `mobile — la cible « Plus » fait au moins 44 px` observé une fois
(passe 3/3 en isolation) reste une instabilité de session non liée aux charges. Enfin, le
démarrage avec une clé `game_config` absente n'est pas testé : le `503` est vérifié à la lecture,
pas au boot.
