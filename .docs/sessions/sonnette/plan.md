# Phase 43 — La Sonnette : plan

Branche `feat/v2-43-sonnette`, base `feat/v2-wave-7`, migration `0020_push`.

## Périmètre

Un seul événement poussé : **le retour d'une charge** quand le carnet est vide.
Aucune poussée de vente, de médaille ni de troc.

## Décisions tranchées (imposées par le brief, à écrire dans la PR)

| Question | Décision |
| :--- | :--- |
| Qui génère et stocke les clés VAPID ? | **L'exploitant.** `bun run --cwd apps/api vapid:generate` imprime une paire sur la sortie standard et n'écrit aucun fichier. La paire va dans `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` du magasin de secrets du déploiement. Jamais en base, jamais dans le dépôt, jamais dans un fichier commité (`.env.example` ne porte que des commentaires). Sans clés : `pushEnabled = false`, `GET /api/v1/push/config` rend `{ enabled: false }`, l'abonnement répond `503 PUSH_DISABLED`, l'ordonnanceur n'est pas démarré, **aucun échec au boot**. |
| Forme des préférences | **Deuxième table `push_preferences`**, clé `user_id`. Une préférence survit au désabonnement parce qu'elle n'est pas sur la ligne supprimée. Aucune clé nouvelle dans `game_config`. |
| Quota quotidien | Colonne `push_subscriptions.last_sent_on date` — portée par la base, un redémarrage ne double pas l'envoi. |
| Anti-doublon pour la même charge | Colonne `push_subscriptions.last_notified_charge_at timestamptz` : on n'annonce pas deux fois le même instant de régénération. |
| Coût d'un battement | Deux `SELECT` (une ligne de `game_config`, zéro ligne candidate au repos) et **zéro ligne** lue en base pour les abonnements. Une seule requête de candidats, jamais une par utilisateur. |
| Verrou de l'ordonnanceur | `pg_try_advisory_lock(2147483043)` sur la connexion dédiée du battement. Verrou non pris → battement abandonné, aucune attente, aucune file. |
| Service worker | `injectManifest` + `src/sw.ts` écrit à la main. Règles de cache du §4.10 recopiées à l'identique : cinq `NetworkOnly` sur `/api/`, `/blasons/` en `StaleWhileRevalidate` (200 entrées, 30 j), `index.html` dans le précache, `navigateFallback` par `NavigationRoute`. |
| Bibliothèque de push | `web-push` (voir « Dépendances »). |

## Fichiers touchés

### Contrat et mémoire

1. `.docs/02-database.md` — §2 statut, nouveau §4.12 `push_subscriptions` + `push_preferences`, index de balayage noté en §4.7, §6 types Kysely.
2. `.docs/01-architecture.md` §4.10 — `injectManifest`, gestionnaires nommés, phrase « les règles de cache sont inchangées ».

### Base

3. `packages/db/migrations/0020_push.ts` — deux tables, trois index, rejouable.
4. `packages/db/src/migrator.ts` — `import` + clé **à la fin**.
5. `packages/db/src/schema.ts` — deux interfaces **à la fin**, deux entrées `Database` **à la fin**.

### Domaine partagé

6. `packages/shared/src/push.ts` — pur : `classifyPushEndpoint`, `isPrivateAddress`, `isQuietHour`, `utcDay`, `pushDecision`, `pushNotificationMessage`, détection iOS.
7. `packages/shared/src/index.ts` — `export * from './push';`

### API

8. `apps/api/src/env.ts` — `VAPID_*` optionnelles, `PUSH_SWEEP_INTERVAL_MS` (60 000 par défaut).
9. `apps/api/src/lib/vapid.ts` — lecture des clés, `pushEnabled`, configuration de `web-push`.
10. `apps/api/src/lib/push-endpoint.ts` — validation d'`endpoint` (https, hôte absolu, refus privé + résolution DNS injectable).
11. `apps/api/src/services/push.ts` — abonnement, désabonnement, préférences, `runPushSweep`.
12. `apps/api/src/services/push-sender.ts` — `PushSender` injectable, implémentation `web-push`, `404`/`410` → `GONE`.
13. `apps/api/src/services/push-scheduler.ts` — battement de 60 s, `stop()`.
14. `apps/api/src/routes/push.ts` — `GET /push/config`, `POST|DELETE /push/subscribe`, `GET|PUT /push/preferences`.
15. `apps/api/src/app.ts` — montage de `pushRoutes` dans le groupe protégé.
16. `apps/api/src/index.ts` — démarrage/arrêt de l'ordonnanceur.
17. `apps/api/src/scripts/vapid.ts` — génération d'une paire, stdout seulement.
18. `apps/api/package.json` — `web-push`, `@types/web-push`, script `vapid:generate`.

### Front

19. `apps/web/vite.config.ts` — `injectManifest`, `srcDir: 'src'`, `filename: 'sw.ts'`.
20. `apps/web/src/sw.ts` — précache, navigation, cinq `NetworkOnly`, `/blasons/`, `push`, `notificationclick`.
21. `apps/web/tsconfig.json` — exclut `src/sw.ts`.
22. `apps/web/tsconfig.sw.json` — `lib: ["ES2023", "WebWorker"]`.
23. `apps/web/package.json` — `workbox-*` en devDependencies, typecheck augmenté.
24. `apps/web/src/lib/push-client.ts` — état réel (supporté, accordé, refusé, iOS).
25. `apps/web/src/content/push.ts` — textes français.
26. `apps/web/src/components/account/push-optin.tsx` — bascule et messages.
27. `apps/web/src/routes/compte.tsx` — monte la section.

### Preuves

28. `packages/spec/src/push.spec.ts` — endpoint non https, adresse privée, quota, heures calmes, `404`/`410`, désabonnement, redémarrage.
29. `packages/e2e/tests/pwa.spec.ts` — cas 4 réécrit pour `injectManifest`, **toujours sept cas**.
30. `packages/e2e/tests/mobile.spec.ts` — un cas : iOS non installé rend un message explicite.

## Ordre des étapes

1. Contrat `.docs/02-database.md` (statut **Contrat**).
2. Migration `0020_push`, `migrator.ts`, `schema.ts`.
3. `packages/shared/src/push.ts` + spec **unitaires vues rouges**, puis vertes.
4. Service worker `injectManifest` + `vite.config.ts` + tsconfigs — le risque n° 1 du brief, traité tôt.
5. `pwa.spec.ts` cas 4 réécrit, banc rejoué sur le projet `pwa`.
6. API : env, vapid, endpoint, service, sender, scheduler, routes, montage, index.
7. Spec d'intégration : quota, heures calmes, `404`/`410`, désabonnement.
8. Front : client, contenu, section `/compte`.
9. `.docs/01-architecture.md` §4.10, `.docs/02-database.md` statut **Migrée**.
10. `bun install` (Docker), `ci:check`, banc E2E complet.

## Vérification de chaque critère

| Critère | Preuve |
| :--- | :--- |
| 1. `pwa.spec.ts` vert, sept cas, sans affaiblissement | `--project=pwa`, 7/7 ; le cas 4 asserte toujours cinq `NetworkOnly` par méthode |
| 2. Aucune notification en double | spec : deux `runPushSweep` sur le même instant de charge → un envoi (`ALREADY_NOTIFIED`) |
| 3. Désabonnement | spec : `unsubscribe` supprime la ligne, `runPushSweep` n'envoie plus |
| 4. Endpoint refusé | spec : `http:`, `https://127.0.0.1`, `::1`, RFC 1918, lien-local, `fc00::/7`, nom qui résout privé |
| 5. `404`/`410` | spec : sender `GONE` → ligne supprimée |
| 6. Heures calmes | spec : `QUIET_HOURS`, `last_sent_on` reste `NULL` |
| 7. Cache du §4.10 intact | `pwa.spec.ts` cas 4, 5, 6 |
| 8. iOS non installé | `mobile.spec.ts` sur le projet `iPhone 13`, message français |
| 9. `ci:check` vert | lint + typecheck + base + specs, base `hexamap_test_43` |

## Dépendances ajoutées, et pourquoi

| Paquet | Où | Justification |
| :--- | :--- | :--- |
| `web-push` | `apps/api` | Implémentation de référence du protocole Web Push : JWT VAPID ES256 et chiffrement `aes128gcm` (RFC 8291). Réécrire ce chiffrement à la main serait un risque cryptographique qu'aucun banc ne peut couvrir — le banc n'a pas de service de push réel. Ce n'est **pas** une dépendance de messagerie : aucune SSE, aucun websocket. |
| `@types/web-push` | `apps/api` | Types du précédent. |
| `workbox-core`, `workbox-expiration`, `workbox-precaching`, `workbox-routing`, `workbox-strategies` | `apps/web` | `injectManifest` remplace la génération automatique : le worker importe ces modules directement au lieu de les recevoir préassemblés par `workbox-build`. Même version majeure que `workbox-build` déjà présent (`^7.4.1`). |
