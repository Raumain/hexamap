# Review : La Sonnette

- Rounds : 1
- Started : 2026-11-22

## Round 1 · r-3f9c

- Date : 2026-11-22
- By : Raumain
- Diff : `feat/v2-wave-7`...`feat/v2-43-sonnette` (409822a...9db0d4f)
- Axes : code, functional, relevancy
- Verdict : **prêt à livrer**
- Score : 9/9 critères tenus, 0 non tenu, 1 non vérifié à l'exécution, 0 hors diff

### Critères

- [x] **1. `pwa.spec.ts` reste vert sans affaiblissement, 7 cas** — 7/7 sur le projet `pwa` seul
  (`docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  --project=pwa`), et `packages/e2e/tests/pwa.spec.ts` porte toujours sept `test(`. Le cas 4 est
  **réécrit** (lecture **et** écriture d'API en ligne, absence de toute URL `/api/` dans les
  caches, échec réseau hors ligne, puis la forme du worker écrit à la main) : aucun cas supprimé,
  aucun délai relâché.
- [x] **2. Aucune notification en double pour la même charge ; quota porté par la base** —
  `packages/spec/src/push.spec.ts` « envoie une fois, puis se tait pour la même charge » ;
  `push_subscriptions.last_sent_on` + `last_notified_charge_at` (migration `0020_push`).
- [x] **3. Le désabonnement supprime la ligne et arrête l'envoi** — « supprime la ligne au
  désabonnement et arrête l'envoi » ; la ligne est absente après `unsubscribe`, et le battement
  suivant n'envoie rien.
- [x] **4. Un point de terminaison non `https` ou privé est refusé avant stockage** — quatre cas :
  protocole, douze littéraux privés (boucle locale, RFC 1918, lien-local, CGNAT, `fc00::/7`,
  `fe80::/10`, `localhost`), nom qui résout vers `127.0.0.1`, nom qui ne résout pas. La route
  refuse aussi, et la ligne n'existe pas après le refus.
- [x] **5. Un `404` ou un `410` supprime l'abonnement** — « supprime l'abonnement qu'un service de
  push déclare disparu » ; « garde l'abonnement quand le service de push échoue » prouve la
  symétrie.
- [x] **6. Les heures calmes reportent sans consommer le quota, et la décision est écrite** —
  « ne consomme pas le quota pendant les heures calmes, puis envoie après » : `last_sent_on` et
  `last_notified_charge_at` restent `NULL` à 23 h 30, l'envoi part à 8 h 30.
- [x] **7. Les règles de cache du §4.10 sont intactes** — `pwa.spec.ts` cas 3 (coquille
  précachée), 4 (cinq routes `NetworkOnly`, jamais de cache pour `/api/`), 5 (repli de
  navigation), 6 (aucune URL `/api/` dans aucune cache).
- [x] **8. iOS non installé rend un message explicite, pas un bouton inerte** —
  `packages/e2e/tests/mobile.spec.ts` « compte — la bascule suit le support réel », vert sur les
  projets `iPhone 13` **et** `Pixel 7` ; sur iPhone, `data-push-state="ios-requires-install"`,
  le message nomme l'écran d'accueil et iOS 16.4, et `Activer la Sonnette` n'existe pas.
- [x] **9. `ci:check` vert** — `548 pass, 0 fail`, 28 fichiers, base
  `postgres://hexamap:hexamap@db:5432/hexamap_test_43`.

- Non vérifié à l'exécution : **la livraison réelle d'une poussée** jusqu'à un navigateur. Le banc
  n'a pas de service de push ; `PushSender` est injecté dans les spécifications et la production
  utilise `web-push`. Ce qu'un essai montrerait : un vrai appareil abonné reçoit la notification
  au premier battement suivant sa charge, et `404`/`410` purgent la ligne.

### Findings

- `packages/spec/src/palmares.spec.ts:690` : le rejeu de `0019` retirait sa ligne de
  `kysely_migration` puis appelait `runMigrations`. Depuis qu'une `0020_push` existe, la liste
  exécutée n'est plus le préfixe de l'ordre du code et Kysely lève `corrupted migrations` — le
  cas devenait impossible, et il laissait la base de test corrompue pour les 27 autres fichiers.
  Le rejeu appelle désormais `up()` du module de migration. **Aucune assertion n'est perdue ni
  relâchée** : les trois `readTableauScore`, le `is_nullable`, le `finally` et la preuve que le
  score ne dépend plus des cartes sont inchangés. → rien à corriger : l'alternative serait de
  refuser `0020_push`, ce que le contrat de la phase interdit. — 🟡 major, `architecture`
  (**écart assumé**, voir le journal).
- `apps/api/src/routes/push.ts:119` : `DELETE /push/subscription` répond `200 { subscribed: false }`
  là où la convention locale (`apps/api/AGENTS.md`) réserve `204` aux suppressions. → laissé
  tel quel : le corps confirme au client l'état qu'il affiche, et un `204` ne porterait rien. —
  🟢 minor, `standards`
- `apps/api/src/lib/vapid.ts:20` : les clés sont lues dans `process.env` **puis** dans `env`, deux
  sources pour la même valeur. → assumé et commenté : c'est ce qui permet à la sonnette de
  s'éteindre proprement sans clés et au banc d'exercer les deux états dans un même processus. —
  🟢 minor, `architecture`
- `apps/web/src/components/push/push-optin.tsx:236` : le formulaire d'heures calmes reste affiché
  quand la sonnette est éteinte sur ce navigateur. → intentionnel : la préférence survit au
  désabonnement (contrat §4.12), la régler avant d'activer est le geste attendu. — 🟢 minor,
  `frontend`
- `apps/api/src/lib/push-endpoint.ts:23` : le DNS est résolu à l'abonnement, pas à l'envoi ; une
  réassociation ultérieure (rebinding) n'est pas détectée. → documenté dans le module ; la borner
  demanderait d'épingler l'adresse et d'ouvrir la connexion sur elle, ce que `web-push` ne permet
  pas. — 🟢 minor, `security`

### Ce que la passe a corrigé avant ce verdict

Deux défauts trouvés en relisant le diff, tous deux fermés et couverts par une spécification :

1. Un abonnement durablement cassé (`400` permanent) était réessayé **toutes les 60 s,
   indéfiniment**, puisque le quota n'était écrit qu'en cas de succès. Un envoi **tenté** consomme
   désormais le jour ; l'anti-doublon, lui, n'est pas consommé, donc la même charge redevient
   éligible le lendemain. Couvert par « garde l'abonnement quand le service de push échoue, sans
   le réessayer sans fin ».
2. `PUT /push/preferences` acceptait `quietStart: 24` : la violation du `CHECK` serait remontée en
   `500` alors que la faute est dans le corps. Les bornes sont désormais dans le schéma TypeBox,
   et un cas asserte le `422`.
