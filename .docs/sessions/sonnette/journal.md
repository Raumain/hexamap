# Journal — La Sonnette (phase 43)

Branche `feat/v2-43-sonnette`, base `feat/v2-wave-7`, migration `0020_push`.

## Ce qui est livré

| Pièce | Fichier |
| :--- | :--- |
| Contrat de données | `.docs/02-database.md` §4.12, §4.7 (index de balayage), §6 (types), §7.1 (invariants) ; statut **Migrée** |
| Migration | `packages/db/migrations/0020_push.ts`, `migrator.ts`, `schema.ts` |
| Domaine pur | `packages/shared/src/push.ts` |
| API | `lib/vapid.ts`, `lib/push-endpoint.ts`, `services/push.ts`, `services/push-sender.ts`, `services/push-scheduler.ts`, `routes/push.ts`, `scripts/vapid.ts` |
| Service worker | `apps/web/src/sw.ts`, `vite.config.ts` (`injectManifest`), `tsconfig.sw.json` |
| Interface | `lib/push-client.ts`, `content/push.ts`, `components/push/push-optin.tsx`, monté dans `/compte` |
| Spécifications | `packages/spec/src/push.spec.ts`, 42 cas |

## Décisions tranchées, et pourquoi

**Qui génère et stocke les clés VAPID.** L'exploitant. `bun run --cwd apps/api
vapid:generate` imprime la paire sur la sortie standard et **n'écrit aucun fichier** ; la paire
va dans `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` du magasin de secrets du
déploiement. Rien en base, rien dans le dépôt, `.env.example` ne portant que la marche à suivre.
La lecture est faite **à l'appel** (`lib/vapid.ts`) et non au chargement du module : c'est ce qui
permet à la sonnette de s'éteindre proprement — `GET /push/config` rend `{ enabled: false }`,
l'abonnement répond `503 PUSH_DISABLED`, l'ordonnanceur n'est pas démarré, le boot ne casse
pas — et au banc d'exercer les deux états dans un même processus. `docker-compose.prod.yml`
transmet les trois variables **sans `:?`**, contrairement aux six clés Stripe : une paire absente
éteint la fonctionnalité, elle n'empêche pas la pile de démarrer.

**La forme des préférences.** Une seconde table, `push_preferences`, clé `user_id`. Le
désabonnement **supprime** la ligne de `push_subscriptions` (c'est ce qu'exige un `404`/`410`, et
la seule façon d'arrêter l'envoi) ; une préférence posée sur cette ligne disparaîtrait avec elle.
`quiet_start`/`quiet_end` vivent donc à part et **survivent** au désabonnement. Aucune clé
nouvelle dans `game_config` : les défauts (22 → 8, UTC) vivent dans `packages/shared` et dans les
défauts SQL.

**Le quota et l'anti-doublon sont deux colonnes distinctes**, `last_sent_on` (jour UTC) et
`last_notified_charge_at` (instant de régénération annoncé). La première protège du harcèlement,
la seconde du doublon pour la même charge. `last_sent_on` est un `text` `YYYY-MM-DD` et non un
`date` : le driver `pg` relit un `date` en `Date` à minuit **local**, ce qui ferait dériver le
quota d'un jour aux bords.

**Un envoi tenté consomme le jour.** Erreur trouvée en relisant le diff : un abonnement
durablement cassé (`400` permanent) était réessayé toutes les 60 s, indéfiniment. Le quota est
désormais écrit sur `FAILED` aussi, mais **pas** `last_notified_charge_at` : la même charge
redevient éligible le lendemain, quand le quota se remet à zéro.

## Le coût d'un battement — mesuré, pas supposé

Un battement émet **deux `SELECT`**, quel que soit le nombre de comptes : une ligne de
`game_config`, puis les candidats en une seule jointure bornée à 200 lignes. Il n'y a jamais une
requête par utilisateur.

Mesures sur `hexamap_test_43`, avec des lignes de sonde supprimées après coup :

| Jeu | Plan | Lignes lues | Buffers | Durée |
| :--- | :--- | ---: | ---: | ---: |
| 200 abonnements, 1 carnet vide | `Seq Scan` des deux côtés (tables trop petites pour un index) | 400 parcourues, 1 retenue | 6 | 0,33 ms |
| 20 000 abonnements, 20 carnets vides | `Index Scan user_scratch_charges_empty_idx` **puis** `Index Scan push_subscriptions_user_idx` | **21** | 85 | **0,15 ms** |

Le premier jeu explique pourquoi l'index partiel n'apparaît pas à l'échelle du banc : les deux
tables y tiennent dans une page. Le second est le régime réel, et il montre que
`user_scratch_charges_empty_idx` (partiel sur `charges = 0`) **est** le point d'entrée du
balayage, `push_subscriptions_user_idx` conduisant la jointure inverse. Au repos — aucun carnet
vide — la seconde lecture rend zéro ligne.

## Écart assumé : `packages/spec/src/palmares.spec.ts`

Le cas « 0019 rétro-remplit la colonne rejouée sur une base vivante » retirait la ligne de
`0019_tableau_score` de `kysely_migration`, puis appelait `runMigrations`. Dès qu'une
`0020_push` existe, la liste exécutée n'est plus le préfixe de l'ordre du code : Kysely lève
`corrupted migrations` **avant** toute réapplication, le cas devient impossible, et il laisse la
base de test corrompue pour les 27 autres fichiers — ce qui s'est produit au premier `ci:check`
de cette session (`9 fail`, `0019` absente de `kysely_migration`).

Le rejeu appelle désormais `up()` du module `0019_tableau_score`, importé directement.
**Aucune assertion n'est perdue ni relâchée** : les trois `readTableauScore`, le `is_nullable`,
le `finally` et la preuve que le score figé ne dépend plus des cartes sont inchangés. La seule
alternative aurait été de renoncer à `0020_push`, ce que le contrat de la phase interdit.
L'écart est consigné ici, dans `.docs/sessions/sonnette/review.md` et dans le corps de la PR.

## Le service worker — le risque n° 1, traité en premier

`generateSW` produisait un worker aveugle : il ne savait pas recevoir de poussée. Le passage à
`injectManifest` casse l'assertion structurelle du cas 4 de `pwa.spec.ts`, qui cherchait
`NetworkOnly` dans le `/sw.js` **généré**. Le worker écrit à la main est minifié par le build : la
classe devient `Oe`, et les méthodes sont passées par une boucle, donc la forme
`NetworkOnly),"GET"` n'existe plus.

Le cas 4 a été **réécrit, jamais relâché**. Il asserte maintenant : une lecture **et** une
écriture d'API en ligne, l'absence de toute URL `/api/` dans les caches après ces deux appels,
l'échec réseau hors ligne, puis la **forme** qui porte la garantie — une boucle qui parcourt
exactement les cinq méthodes et enregistre, pour chacune, une route sur `/api/` avec un
gestionnaire neuf et **sans nom de cache**, le bloc étant isolé de la route des blasons qui suit.

Les règles de cache sont recopiées à l'identique : cinq `NetworkOnly` sur `/api/`, `/blasons/` en
`StaleWhileRevalidate` (200 entrées, 30 j), `index.html` dans le précache, `NavigationRoute` avec
`denylist` sur `/api/` et `/blasons/`, aucune `skipWaiting`/`clients.claim`. Les cas 3, 5 et 6
prouvent que rien n'a bougé.

`src/sw.ts` vit dans `self`, pas dans `window` : il est compilé par un second programme,
`apps/web/tsconfig.sw.json` (`lib: ["ES2023", "WebWorker"]`), exclu du `tsconfig.json` principal
sinon les globales `lib.dom` et `lib.webworker` entrent en collision. `typecheck` et `build`
enchaînent les deux.

## Vérifications réellement passées

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_43' \
  dev bun run ci:check
  ✓ 1/4 Lint            345 fichiers, aucune correction
  ✓ 2/4 Typecheck       6 workspaces (dont tsconfig.sw.json)
  ✓ 3/4 Base de données joignable et préparée
  ✓ 4/4 Spécifications  548 pass, 0 fail, 28 fichiers
```

```
docker compose -f docker-compose.e2e.yml up -d --build --force-recreate api
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  105 exécutés — 105 passés, 0 échoué, 0 ignoré

docker compose -f docker-compose.e2e.yml run --rm playwright \
  npx --no-install playwright test --project=pwa
  7 exécutés — 7 passés
```

Le cas iOS de La Sonnette passe sur **les deux** projets tactiles : sur `iPhone 13`
(agent utilisateur iOS 15, non installé) l'écran rend `data-push-state="ios-requires-install"` et
le message nomme l'écran d'accueil ; sur `Pixel 7`, le serveur sans paire VAPID rend `disabled`.
Aucun cas n'est sauté — la branche est décidée par l'agent utilisateur que le navigateur s'attribue.

## Ce que la session ne prouve pas

- **La livraison réelle d'une poussée.** Le banc n'a pas de service de push : `PushSender` est
  injecté dans les spécifications et la production utilise `web-push`. Un vrai appareil abonné
  n'a pas été notifié. C'est la seule chose que la session ne peut pas montrer.
- **La détection de rebinding DNS.** L'hôte est résolu à l'abonnement, pas à l'envoi ; une
  réassociation ultérieure n'est pas détectée. La borner demanderait d'épingler l'adresse et
  d'ouvrir la connexion sur elle, ce que `web-push` ne permet pas. Écrit dans le module.
- **L'application réelle des heures calmes à un fuseau.** Elles sont en UTC par contrat, et
  l'écran le dit ; aucune conversion locale n'est faite.

## Dépendances ajoutées

| Paquet | Où | Pourquoi |
| :--- | :--- | :--- |
| `web-push` + `@types/web-push` | `apps/api` | Protocole Web Push : JWT VAPID ES256 et chiffrement `aes128gcm` (RFC 8291). Le réécrire à la main serait un risque cryptographique qu'aucun banc ne peut couvrir, faute de service de push réel. Ce n'est **pas** une dépendance de messagerie. |
| `workbox-core`, `workbox-expiration`, `workbox-precaching`, `workbox-routing`, `workbox-strategies` | `apps/web` | `injectManifest` remplace la génération automatique : le worker importe ces modules au lieu de les recevoir préassemblés. Même majeure que `workbox-build` déjà présent. |

## Portée

35 fichiers, +3 178 / −65. `.docs/03-active-task.md`, `ROADMAP.md`, `main`,
`routeTree.gen.ts` et `types.generated.ts` ne sont pas touchés. Aucune table, colonne, index
ni motif `currency_ledger` hors du contrat.
