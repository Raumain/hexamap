# Revue hostile — Phase 29 · La Vitrine (deuxième passe)

**Verdict : prêt à livrer.** Les trois défauts bloquants de la première passe sont **soldés, et
vérifiés dans le code, pas sur parole** : la migration reprend les doublons avant de créer
l'index, la sonde ne mémorise plus un échec et échoue fermé sur `blocks`, et le `catch` global
qui transformait toute erreur SQL en `404` a disparu. Il reste onze suggestions ouvertes
— aucune ne bloque —, dont **trois défauts nouveaux introduits par la correction elle-même**,
listés ci-dessous avec les autres.

Ce qui n'a pas bougé depuis la première passe, et qui reste la meilleure nouvelle : **aucune
fuite de données**. Projection liste blanche, schéma fermé aux quatre niveaux, `404` unique.

---

## État des défauts

| État | Gravité | Fichier:ligne | Constat | Suite |
| :--- | :--- | :--- | :--- | :--- |
| **corrigé** | deal-breaker → soldé | `packages/db/migrations/0012_profiles.ts:35-48` | La reprise des doublons précède bien `create unique index`. Elle partitionne sur `lower(pseudo)`, ordonne sur `"createdAt", id` (colonne Better Auth `camelCase`, correctement citée), laisse `rang = 1` — donc **le plus ancien** — garder son pseudo et suffixe les autres en `left(pseudo,18) || '-' || rang`. `left()` compte des caractères et non des octets : aucun pseudo accentué n'est coupé au milieu d'un point de code. Le commentaire (l. 16-22) explique le risque de boucle de redémarrage. | Solder. |
| **corrigé** | deal-breaker → soldé | `apps/api/src/services/profile.ts:80-102` | Sonde tri-état : `Map<OptionalTable, boolean>` (l. 69) ne contient **que des mesures** (l. 91), `null` sur échec (l. 93-96) et n'est jamais mémorisé. `to_regclass(${table})` reçoit le nom **nu** (l. 88), donc `search_path` et le schéma par worker de §4.8 continuent de fonctionner. Le `console.warn` (l. 94) est présent. | Solder. |
| **corrigé** | deal-breaker → soldé | `apps/api/src/services/profile.ts:447-455` | Fail closed **réel** : `probeTable(exec, 'blocks')`, puis `if (blocksPresent === null) return null;` — une sonde en erreur ne rend pas la vitrine. Le commentaire (l. 443-446) dit pourquoi. | Solder. |
| **corrigé** | deal-breaker → soldé | `apps/api/src/services/profile.ts:431-518` | Plus aucun `try/catch` englobant : la fonction n'en contient aucun, et une erreur SQL remonte jusqu'à Elysia. Les `null` restants sont explicites et localisés : inconnu (l. 437-439), blocage (l. 453), privé (l. 463-465), plus le fail-closed (l. 449-451). | Solder. |
| **corrigé** | suggestion | `apps/api/src/services/profile.ts:104-140` | Cache des dénominateurs par processus, **seulement sur un résultat effectif** (l. 138), avec un commentaire honnête (l. 109-114) qui nomme le coût évité, la stabilité entre deux imports et le fait qu'une erreur remonte. | Solder. |
| **corrigé** | suggestion | `apps/web/src/routes/collection.tsx:23`, `market.index.tsx:6`, `market.mine.tsx:5` | Plus aucune définition locale : les trois constantes locales ont disparu du diff, les imports pointent sur `components/ui/button-classes`. La classe partagée porte `disabled:cursor-not-allowed disabled:opacity-40` (outline) et `disabled:opacity-60` (primaire). | Solder, sous réserve du point de géométrie ci-dessous. |
| **corrigé (partiel)** | suggestion | `apps/web/src/routes/card.$cardId.tsx:493-527` | La vitrine est désormais atteignable depuis Le Cartel, uniquement dans `BuyPanel` — donc depuis une annonce d'autrui. `viewerId && card.owner.id !== viewerId` (l. 516) exclut explicitement le lien vers soi ; `aria-label="Voir la vitrine de …"` contient le texte visible, donc WCAG 2.5.3 est respecté. **Reste ouvert** : un joueur sans annonce ouverte n'est toujours atteignable que par URL (voir tableau des suggestions). | Solder côté marché ; suivi pour le reste. |
| **suggestion ouverte** | suggestion | `.docs/03-active-task.md` | Toujours aucune entrée de phase 29 (le fichier n'apparaît pas dans `git status`), alors que `AGENTS.md` l'impose et que `ROADMAP.md` n'est pas à jour non plus. | Ajouter statut + journal + preuves avant la PR. |
| **suggestion ouverte** | suggestion | `apps/api/src/auth.ts:86-97` | Course `select`/`insert` non traitée : deux inscriptions concurrentes avec le même pseudo passent le contrôle, l'index rejette la seconde en `23505`, et le client reçoit un `500` au lieu du `400 « Ce pseudo est déjà pris »`. Le cas de spec (`profile.spec.ts:197-208`) ne couvre que le séquentiel. | Convertir `23505` sur `user_pseudo_lower_idx` en `APIError('BAD_REQUEST')`. |
| **suggestion ouverte** | suggestion | `packages/db/migrations/0012_profiles.ts:42` | La reprise peut **recréer** un doublon : si un compte s'appelle déjà littéralement `bob-2` et que deux `Bob`/`bob` existent, le suffixe produit lui-même une collision et `create unique index` échoue encore (l. 47-48). Risque très rare, mais exactement le mode de défaillance que le correctif prétend fermer. | Après la reprise, contrôler le retour de l'index ou suffixer avec un fragment d'`id` en cas de conflit résiduel (`left(pseudo,14) || '-' || left(id,6)`). |
| **suggestion ouverte** | suggestion | `packages/db/migrations/0012_profiles.ts:42` | Les pseudos repris changent **silencieusement** : aucun journal, aucune trace. Un joueur verra son identité publique modifiée sans explication, et l'exploitant ne saura pas qui a été renommé. | Écrire la liste des renommages dans une table d'audit ou, à défaut, `raise notice` par compte concerné. |
| **suggestion ouverte** | suggestion | `packages/db/migrations/0012_profiles.ts:38` | La comparaison porte sur `lower(pseudo)` sans `btrim` : `'Jean'` et `'Jean '` restent deux identités valides et visuellement identiques dans l'interface (les nouveaux pseudos sont, eux, `trim`és en `auth.ts:87`). | Ajouter `btrim(pseudo)` au partitionnement, et une reprise de `update "user" set pseudo = btrim(pseudo)` avant l'index. |
| **suggestion ouverte** | suggestion | `apps/api/src/services/profile.ts:100-102` | Fail closed appliqué à `blocks` seulement : `tableExists` écrase un `null` en `false`, donc une sonde en échec sur `friendships` rend `friendCount: 0` **comme une mesure**. Le compteur affiche un fait faux au lieu de se taire. | Rendre le compteur conditionnel (`friendCount: number \| null`) et ne pas l'afficher sur `null`, ou marquer la valeur comme indisponible. |
| **suggestion ouverte** | suggestion | `apps/api/src/services/profile.ts:94` | `console.warn` non limité : pendant une panne de base, le fail-closed rend `null` à la première sonde, donc une ligne d'avertissement par requête de vitrine. Correct pour le diagnostic, bruyant pour l'exploitation. | Journaliser une fois par intervalle (ou au changement d'état) plutôt qu'à chaque appel. |
| **suggestion ouverte** | suggestion | `apps/api/src/services/profile.ts:421-424` | Le commentaire de `loadPlayerProfile` annonce « les trois cas sémantiques seulement », mais il y a désormais **quatre** sorties `null` : le fail-closed (l. 449-451) s'ajoute. Le commentaire du bloc de blocage l'explique, celui d'en-tête non. | Aligner l'en-tête sur les quatre cas. |
| **suggestion ouverte** | suggestion | `apps/api/src/routes/players.ts:93-96` | Depuis la suppression du `catch`, le `500` est un chemin porteur : il n'est déclaré ni dans la carte `response` (seuls `200` et `404`), ni typé pour Eden. Le client retombe sur son message générique, sans code stable. | Ajouter `500: errorSchema` et vérifier que le `onError` global rend bien la forme `{ code, message }`. |
| **suggestion ouverte** | suggestion | `apps/api/src/services/profile.ts:220-221` | « Meilleur tableau » ne considère que les 50 tableaux les plus récents : au-delà, la valeur est fausse et rien dans le contrat ne le dit. | Calculer sur l'ensemble, ou renommer/documenter la borne. |
| **suggestion ouverte** | suggestion | `apps/api/src/services/profile.ts:52-55` | `EDITION_TOTALS` (18, 101) en dur alors que les deux autres catégories sont comptées : deux sources de vérité pour une même notion. | Compter les quatre, ou déplacer la constante dans `packages/shared`. |
| **suggestion ouverte** | suggestion | `apps/api/src/services/profile.ts:502, 507` | `pseudo = user.pseudo ?? user.name` : `name` est libre et non validé, donc un compte ancien publie une chaîne arbitraire hors de la règle 3-24 comme identité. Et `displayName` recopie `pseudo` à l'identique : un des deux champs est du poids mort dans le contrat. | Repli neutre, ou migration de rattrapage ; supprimer `displayName` ou lui donner un sens propre. |
| **suggestion ouverte** | suggestion | `apps/api/src/services/profile.ts:447` | Le blocage n'est vérifié que si `viewerId !== null` : un visiteur anonyme voit la vitrine de qui l'a bloqué. La salle web exige une session (`players.$playerId.tsx:39`), l'API non — deux politiques pour une règle. | Trancher et l'écrire dans §2.9 : route publique assumée, ou session exigée côté API. |
| **suggestion ouverte** | suggestion | `apps/web/src/routes/players.$playerId.tsx:239-252` | Contrôle d'ami `disabled` (l. 245) dont l'explication tient dans un `title` (l. 246) : un bouton désactivé n'est pas focusable, donc l'explication est inatteignable au clavier et par lecteur d'écran. | `aria-disabled` + texte visible, ou ne pas monter le contrôle avant la phase 28. |
| **suggestion ouverte** | suggestion | `apps/web/src/routes/players.$playerId.tsx:212-217` | Médailles rendues en **clés brutes** (`FIRST_TICKET`…) : identifiants anglais visibles, contre §4.1. `DESIGN_SYSTEM.md` §8.8 décrit « médailles en clés nues », donc doc et code s'accordent — et contredisent tous deux la règle de langue. | Libellé français du catalogue (phase 27), et marquer la clé nue comme provisoire dans la doc. |
| **suggestion ouverte** | suggestion | `apps/web/src/routes/players.$playerId.tsx:169` | `text-vellum/45` sur le dénominateur `/ 101` : information utile sous le plancher `/55` consigné en phase 14. | `/55` minimum. |
| **suggestion ouverte** | suggestion | `apps/web/src/routes/players.$playerId.tsx:84` | `router.history.back()` : un visiteur arrivé par lien direct — le cas normal d'une vitrine partagée — sort de l'application. | Lien typé de repli. |
| **suggestion ouverte** | suggestion | `apps/web/src/lib/player-profile.ts:17-34` | Cinquième copie de `toApiErrorInfo` (`card-detail.ts:17`, `collection.ts:20`, `market.ts:18`, `tableaux.ts:25`). Fidèle au dépôt, donc pas une régression. | Extraire `lib/api-error.ts`. |
| **suggestion ouverte** | suggestion | `packages/spec/src/profile.spec.ts:111-147` | Le cas « aucun champ interdit » reste une liste noire : il prouve l'absence de huit clés, pas la forme du payload. | Ajouter l'ensemble **exact** des clés de `body.player` et de `completeness[0]`. |
| **défaut nouveau (correction)** | suggestion | `apps/web/src/routes/card.$cardId.tsx:521` | `underline-offset-4` **sans `underline`** : la classe est inerte, et le lien ne se distingue que par sa couleur (`text-brass`) dans un paragraphe en `text-vellum/60` — 1.4.1 de WCAG (ne pas signaler un lien par la couleur seule). | `underline` dans la classe (l'intention était visible) ou un soulignement explicite. |
| **défaut nouveau (correction)** | suggestion | `apps/web/src/routes/market.index.tsx:6`, `market.mine.tsx:5`, `collection.tsx:23` | **Géométrie changée sans que ce soit demandé** : les trois écrans perdent leur `outlineButtonClass` locale et héritent de `min-h-11 px-4 tracking-[0.14em]`. Concrètement — Le Comptoir et Mes Offres passent de `min-h-9` (36 px) à `min-h-11` (44 px) et de `px-3` à `px-4` ; Le Cadastre passe de `min-h-10` à `min-h-11` ; le primaire de Mes Offres passe de `min-h-10 px-4` à `min-h-11 px-5` et gagne `shadow-brass` + `active:translate-y-px` ; le `tracking` du Cadastre glisse de `0.16em` à `0.14em`. **Ce n'est pas une régression de cible tactile** : 44 px est la cible de §4.9 et la phase 16, 36 px ne l'était pas — c'est même une correction. C'est une régression **d'annonce** : +8 px de haut et +8 px de large sur des lignes de cartes que le banc mesure à 320 px pour l'absence de débordement, et le banc n'a pas été rejoué. | Rejouer la vérification de débordement à 320 px, ou conserver localement les deux tailles compactes et limiter le module aux deux définitions de référence. |
| **défaut nouveau (correction)** | suggestion | `apps/api/src/services/profile.ts:431-518` | Conséquence directe de la suppression du `catch` : le `500` devient un chemin réellement emprunté, et il n'est ni déclaré dans la route (voir `players.ts:93-96`) ni couvert par un cas de spec. | Déclarer `500` et ajouter le cas « la base échoue ⇒ 500, pas 404 ». |
| **correct (revérifié)** | — | `apps/api/src/services/profile.ts:431-518` | Sur les trois fichiers de routes/écrans retouchés (`collection`, `market.index`, `market.mine`), le diff ne contient **que** l'import ajouté et les constantes locales supprimées : aucune requête, aucun libellé, aucun comportement déplacé. `services/profile.ts` (non suivi, donc sans diff) a été relu intégralement : à part la sonde, le cache et les quatre sorties `null`, les requêtes, les tris et les projections sont identiques à la première passe. | — |
| **correct (inchangé)** | — | `apps/api/src/services/profile.ts:376-380, 457-461, 264-273, 299-303` | Sélections explicites, aucun `selectAll`, y compris sur `"user"`. | — |
| **correct (inchangé)** | — | `apps/api/src/routes/players.ts:15, 26, 53, 94` | `additionalProperties: false` sur les quatre niveaux du schéma de réponse. | — |
| **correct (inchangé)** | — | `apps/api/src/routes/players.ts:61-66` | Un seul code `PLAYER_NOT_FOUND`, aucun `403`, corps identique dans les trois cas — y compris le fail-closed. | — |
| **correct (inchangé)** | — | `packages/spec/src/*.spec.ts` (5 fichiers) | Toujours **seul** le littéral de pseudo modifié, aucune assertion affaiblie. | — |

---

## Les sept points, vérifiés dans le code

1. **Reprise des doublons** — oui : `0012_profiles.ts:35-45` avant l'index de la l. 47. Ordonnée
   sur `"createdAt", id` (l. 38), le plus ancien conserve son pseudo (`rang = 1`), les autres
   reçoivent `-<rang>`. Le résultat tient en 18 + 1 + chiffres, soit **24 au plus** pour tout rang
   inférieur à 100 000. `down` cohérent : `drop index` puis `drop table` (l. 51-54).
   Réserve : la collision avec un pseudo déjà suffixé n'est pas détectée (suggestion ouverte).
2. **Sonde** — oui : plus de mise en cache d'un échec (`Map<..., boolean>` l. 69, écriture l. 91),
   `null` tri-état (l. 95), `console.warn` (l. 94), `to_regclass(${table})` en nom nu (l. 88).
   Fail closed **effectif** sur `blocks` : l. 448-451 rend `null`, donc `404`, et aucune lecture
   de contenu n'est lancée.
3. **`catch` global** — disparu : aucun `try` dans `loadPlayerProfile`. Les `null` sont les trois
   cas sémantiques plus le fail-closed, tous explicites. Une erreur SQL remonte à Elysia : plus
   rien ne la rabat.
4. **Dénominateurs** — cache par processus sur résultat effectif seulement (l. 116-140), erreur
   non mémorisée, commentaire qui dit le coût, la stabilité et le retry.
5. **Lien vers la vitrine** — rendu dans l'en-tête de `BuyPanel`, là où le vendeur est nommé ;
   libellé accessible explicite qui contient le texte visible ; condition `card.owner.id !==
   viewerId` qui exclut le lien vers soi. Défaut nouveau : `underline-offset-4` sans `underline`.
6. **Boutons** — plus aucune définition locale (le diff ne contient que des suppressions et un
   import par fichier) ; la classe partagée porte bien `disabled:*` sur les deux variantes.
   **Le changement de taille n'est pas une régression de cible tactile** (36/40 → 44 px, la cible
   exigée), mais c'est un changement de géométrie non annoncé sur trois écrans, non rejoué à
   320 px : à vérifier, c'est le seul point de cette passe que je ne peux pas trancher par lecture.
7. **Régression ailleurs** — rien d'autre n'a bougé : les trois routes web ne changent que leurs
   classes, et le service n'a vu que la sonde, le cache et les sorties `null`.

---

## Ce qui reste non prouvé

- **Banc E2E non rejoué.** Le débordement horizontal à 320 px du Comptoir et de Mes Offres après
  le passage à `min-h-11 px-4` n'est mesuré par personne. C'est le seul risque de cette passe.
- **Fail-closed sans cas de spécification.** Aucun test ne force `probeTable` en erreur : la
  branche `blocksPresent === null` (l. 449-451) n'est couverte que par lecture. Elle est juste,
  mais elle n'est pas verrouillée — une refonte de la sonde pourrait la supprimer sans rouge.
- **Cache par worker.** `tablePresence` (l. 69) et `referenceTotals` (l. 116) sont des modules de
  processus : ils sont partagés par toutes les connexions d'un worker, pas par worker isolé. Avec
  le schéma par worker de §4.8, deux workers ont deux caches — cohérent — mais un même worker qui
  changerait de `search_path` en cours de route lirait une mesure périmée. Non exercé aujourd'hui.
- **Blocage, médailles et amitiés restent non exerçables** dans cette branche (tables 27/28
  absentes) : la garde de confidentialité la plus importante de la phase part sans preuve, comme
  la première passe l'avait noté. Le plan l'assume ; c'est toujours une dette.
- **`ci:check` et banc non relancés par moi** (chiffres du lanceur : vert, 166 spécifications,
  12 fichiers). Ma revue est statique.
