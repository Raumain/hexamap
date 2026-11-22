# Revue — phase 38, La Vitrine, la planche montrée

Relecture hostile de mon propre diff, sur les cinq axes : contrat, données privées, requêtes,
budget DOM, accessibilité et cohérence des specs. Verdict en fin de document.

## Ce qui a été relu, et contre quoi

| Axe | Référence |
| :--- | :--- |
| Contrat de charge utile | brief, décisions 2 à 6 ; `.docs/01-architecture.md` §2.9 |
| Non-exposition | §2.9, liste `FORBIDDEN_KEYS` de `packages/spec/src/profile.spec.ts` |
| Requêtes | décision 7 et risque nommé, `.docs/07-roadmap-v2.md` §4 phase 38 |
| Budget DOM | `.docs/01-architecture.md` §4.9, ≤ 18 nœuds non-SVG |
| Règles de dossier | `apps/api/AGENTS.md` (Kysely, pas de SQL brut) |

## Défauts trouvés et traités pendant la revue

### R-1 — `t.Array` avec un item `null` répondait `422` — **corrigé, vérifié**

Le plan prévoyait `t.Array(t.Union([slot, t.Null()]), { minItems: 4, maxItems: 4 })`. Un tableau
**complet** passait ; un tableau **troué** — trois emplacements `null` — faisait répondre `422`.
La revue ne s'est pas contentée du rapport de l'implémenteur : le schéma a été remis en `t.Array`
et la spec rejouée.

```
(fail) Profil §2.9 — un tableau troué rend quatre positions dont des nulles
  Expected: 200
  Received: 422
```

Le tuple de quatre `anyOf` est donc **nécessaire**, pas une préférence : il exprime le même
contrat (« exactement quatre positions ») et sérialise correctement. Le commentaire du schéma dit
maintenant pourquoi, avec la mesure.

### R-2 — la fixture E2E choisissait un compte périmé — **corrigé, vérifié**

La résolution du compte principal ne regardait que `E2E-R1`, `E2E-D1` et `E2E-C-RARE-0`, puis
prenait le premier identifiant trié. Or `e2e:seed` réécrit `ref_odonymes` à chaque démarrage de la
pile : les identifiants d'odonyme **changent d'un run à l'autre**, et un compte laissé par un run
précédent possède encore les trois codes stables avec une carte de rue pointant sur un odonyme
disparu. Observé en rejouant le banc sur une base déjà utilisée :

```
Error: [e2e] 7BfxVcv5… ne possède aucune carte RUE 75 : rejouez le seed E2E…
```

Le défaut ne se voyait pas sur une base neuve — il aurait attendu le premier rejeu. La résolution
exige désormais le combo **entier, odonyme courant compris**, apparié sur `(category, ref_code)`,
et retient le compte **le plus récent** (`"user".createdAt`), c'est-à-dire celui que
`global-setup` vient d'inscrire. Le nettoyage garde la résolution large, pour effacer les lignes
laissées par un run interrompu.

## Défauts trouvés et **non** corrigés — assumés, avec la raison

### R-3 — SQL brut dans un service — *suggestion*

`apps/api/AGENTS.md` réserve le SQL brut aux health checks et aux imports massifs. La requête des
quatre emplacements est un `sql` de Kysely. Trois raisons, aucune décisive seule :

1. le brief **demande** cette forme (« quatre `left join lateral`, ou quatre blocs d'une même
   `union all` rabattue par catégorie ») ;
2. le pivot « quatre positions quoi qu'il arrive » exige une table de valeurs
   (`cross join (values (0),(1),(2),(3))`) que Kysely n'exprime pas sans fragment brut ;
3. `apps/api/src/services/profile.ts` emploie déjà `sql` trois fois (`isBlocked`,
   `loadFriendCount`, `loadAchievements`) : la règle est déjà franchie dans ce fichier.

Une version 100 % Kysely à douze `left join` est possible — une ligne, quatre jeux d'alias — mais
elle perd le nom de CTE sur lequel la spec s'ancre et gagne en verbosité sans gagner en
correction. **Décision** : conserver, et l'écrire ici pour que le titulaire puisse trancher.
Aucun impact sur le comportement observable.

### R-4 — les planches montrent `—` pour la population et les occurrences — *suggestion*

La décision 3 fixe six champs (`category`, `refCode`, `rarity`, `score`, `nom`, `blasonUrl`) et
n'inclut ni `population` ni `occurrenceCount`. `Card` les reçoit donc `null`, et
`formatNumber(null)` rend `—`. La planche d'une Commune affiche « POPULATION — » et celle d'une
Rue « OCCURRENCES — » au-dessus de 110 px de large.

Ce n'est pas un oubli : ajouter un champ serait une extension du contrat, et masquer la ligne
demanderait de toucher `components/ui/cards/`, interdit par le brief. **Décision** : accepter le
tiret, qui dit « non transmis » plutôt que de mentir. À trancher en phase 39 ou 40, soit en
transmettant les deux mesures, soit en apprenant aux planches à disparaître quand la mesure
manque.

### R-5 — deux cas de spec dépendent de l'ordre des cas — *suggestion*

`Profil §2.9 — la planche ne porte aucune donnée privée` et `… les quatre emplacements coûtent une
seule instruction` réutilisent les joueurs semés par les deux cas précédents. Bun exécute les
`it` d'un fichier dans l'ordre de déclaration, donc c'est correct — et chaque cas garde un
`expect(…).not.toBeNull()` explicite plutôt qu'un `!`. En revanche `bun test -t "<cas>"` isolé
échouerait. **Décision** : garder ; la dépendance est nommée dans le message d'erreur, et
ressemer un joueur par cas coûterait quatre inscriptions de plus.

### R-6 — « une seule requête pour la page entière » n'est pas littéralement tenu — *assumé*

Critère 4. Mesuré, client journalisé, sur un tableau complet :

```
instructions: 17 | dont showcase_slots: 1     # premier appel du processus
instructions: 10 | dont showcase_slots: 1     # tableau troué
```

Les quatre emplacements coûtent **exactement une instruction**, invariante au nombre de cartes :
c'est la décision 7 du brief et le risque nommé par la feuille de route, et c'est prouvé deux
fois par la spec. Le total de la page, lui, était de 14 instructions avant la phase ; il est de 17
au premier appel parce que la sonde `to_regclass` (×3) et les deux comptages de référentiel sont
mémoïsés une fois par processus, soit 12 en régime établi — la phase ajoute donc **1**.

Atteindre « une seule requête » au sens littéral supposerait de réécrire `loadPlayerProfile`
entier, donc de changer la forme des compteurs déjà servis, ce que le brief interdit. Le critère
est donc coché au sens de la décision 7, et son écart littéral est écrit ici et dans la PR.

## Points vérifiés sans défaut

- **Aucune donnée privée.** Aucun `locked`, `currency`, `email`, `session`, `grid`,
  `treasure_index`, `userId` dans la charge utile ; `locked` n'est pas filtré mais **jamais
  sélectionné**. Le cas lit les clés rendues sur un joueur **avec** tableau complet — le cas
  historique tournait sur un joueur sans tableau, donc sans `slots`, et ne prouvait rien de neuf.
- **`blasonOf` reste seul propriétaire du repli.** La requête remonte `blason_url`, `contour_url`
  et `blason_credit` bruts, et c'est `blasonOf` qui replie côté TypeScript. Prouvé par la spec :
  la commune n'a qu'un `contour_url` et rend `/blasons/contours/communes/x.svg` ; la rue rend
  `null`.
- **La catégorie vient de la position**, jamais de `user_cards.category` : la cohérence du
  critère 6 est vraie par construction, y compris sur une ligne corrompue.
- **Vitrine privée → `404`**, jamais `403` : le cas existant passe toujours, et la phase n'a pas
  touché `routes/players.ts` sur ce point.
- **Budget DOM inchangé** : `Card.tsx` et `components/ui/cards/` ne sont pas dans le diff. Mesuré
  sur les quatre planches réelles de la vitrine : Région 15, Département 16, Commune 15, Rue 17.
- **Une planche ne rend du texte qu'à partir de 120 px** : la feuille du meilleur tableau est
  passée en pleine largeur, quatre colonnes à partir de `md`, deux en dessous ; sur 320 px chaque
  cellule fait ~146 px.
- **Aucun texte visible sous 10 px** dans le code ajouté (`text-[10px]`, `text-[11px]`).
- **Aucun `skip` ajouté, aucun délai relâché, aucune spec existante affaiblie** : le diff de
  `profile.spec.ts` ne contient que des ajouts, et les deux `it` existants touchés par l'amorçage
  du référentiel n'assertent que des totaux fixes (18, 101).

## Verdict

**Prêt à livrer.**

- Deal-breaker : aucun. Les deux défauts qui en étaient (R-1, R-2) sont corrigés et leur correction
  est mesurée.
- Suggestion : R-3, R-4, R-5 — écrites, non corrigées, avec la raison.
- Écart assumé : R-6, la portée exacte du critère 4.

`ci:check` vert — **353 spécifications, 19 fichiers, 0 échec, 2 091 assertions**.
Banc E2E complet vert — **75 exécutés, 75 passés, 0 échoué, 0 ignoré**, deux fois de suite, la
seconde après le durcissement de la fixture.
