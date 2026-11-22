# Review: Phase 36 — Le Cadastre filtrable

- Rounds: 2
- Started: 2026-11-22

## Round 1 · r-4b1e

- Date: 2026-11-22
- By: Raumain
- Diff: arbre de travail sur `phase-36` (non commité) — quatre fichiers suivis modifiés
  (`apps/web/src/content/collection.ts`, `apps/web/src/main.tsx`,
  `apps/web/src/routes/collection.tsx`, `packages/e2e/tests/atlas.spec.ts`) et quatre nouveaux
  (`apps/web/src/lib/search-params.ts`, `apps/web/src/lib/collection-search.ts`,
  `packages/e2e/tests/cadastre.spec.ts`, `packages/spec/src/collection-search.spec.ts`) — plus
  `.docs/sessions/cadastre-filtres/` (non versionné)
- Axes: code, functional, relevancy
- **Verdict : bloqué** — quatre majors, aucun critique. (Rubric : `changes-requested`.)
- Score: 8/8 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

Je n'ai pas écrit ce diff et je ne l'ai pas corrigé. Les deux seules vérifications qui ne sont
pas de moi sont celles fournies à la dispatch et **non rejouées** : `ci:check` → 451
spécifications / 24 fichiers / 0 échec, et le banc E2E → 100 passés / 0 échoué (base 92, +8).
Tout le reste ci-dessous vient de la lecture du code, fichier et ligne cités.

### Criteria

- [x] **1. Un lien profond restaure le même jeu de filtres ; l'URL rechargée est identique** —
      `packages/e2e/tests/cadastre.spec.ts:69-100` : `goto('/collection?rarete=EPIQUE,RARE&categorie=RUE,COMMUNE')`,
      URL réécrite en `?categorie=COMMUNE,RUE&rarete=RARE,EPIQUE` (ordre du domaine), contrôles
      assertés un par un, puis `reload()` avec la même URL et le même nombre de lignes. Le
      mécanisme sous-jacent est verrouillé par
      `packages/spec/src/collection-search.spec.ts:160-202` (`parse ∘ serialize` inverse).
- [x] **2. Le retour défait le dernier filtre, jamais une frappe** —
      `packages/e2e/tests/cadastre.spec.ts:102-118` (deux filtres → `goBack()` rend un filtre,
      encore sur `/collection`, puis `goBack()` rend l'URL nue) et `:120-131` (depuis `/tableau`,
      une frappe de 250 ms puis `goBack()` rend `/tableau`, donc aucune entrée d'historique n'a
      été créée). `replace: true` uniquement pour la recherche : `collection.tsx:377-384`.
- [x] **3. La virtualisation tient : hauteur de ligne stable, défilement au plus juste** —
      `estimateSize` (`collection.tsx:584`) et `getItemKey` (`:586`) sont **inchangés** (le diff
      ne les touche pas) ; le `<tr>` (`:652`) ne porte aucune `h-*`/`min-h-*`, `gridTemplate`
      (`:152-153`) non plus — les seules `min-h-*` du fichier sont sur des boutons (`:159`,
      `:166`, `:314`) ; la remise à zéro du défilement est **conditionnée** à une longueur
      différente (`collection.tsx:593-598`) ; la mesure est prouvée par
      `cadastre.spec.ts:174-196` (même ligne `Département E2E A` sous deux jeux de filtres,
      écart < 0,5 px, hauteur > 0). La seconde moitié du critère (« ne saute pas au-delà du
      nécessaire ») est étayée par le code, pas par une mesure — c'est écrit ici pour ne pas
      surclamer.
- [x] **4. Un `?departement=`/`?commune=` entrant produit l'état attendu ; `commune` disparaît** —
      `cadastre.spec.ts:133-144` (`?departement=99` → `select` à `99`, option injectée,
      `aria-live` à zéro carte, état vide filtré) et `:146-158` (`?commune=E2E-C-RARE-0` →
      `?q=E2E-C-RARE-0`, `searchbox` porte le code, la ligne est visible). La consommation est
      `collection.tsx:260` (`q: commune ?? filters.q`) et la disparition vient de
      `collection-search.ts:89-94` + `collection.tsx:270-276`.
- [x] **5. Une valeur inconnue est écartée sans erreur, l'URL est réécrite normalisée** —
      `cadastre.spec.ts:160-172` (`?rarete=ANANAS&categorie=COMMUNE` → `?categorie=COMMUNE`,
      aucun `role="alert"`, même nombre de lignes qu'en allant directement à l'URL normalisée) ;
      unitairement `packages/spec/src/collection-search.spec.ts:88-118`.
- [x] **6. E2E : lien depuis L'Atlas, changement de filtre, retour, rechargement** —
      `cadastre.spec.ts:198-224` (Atlas → Cadastre, `?categorie=COMMUNE`, `goBack()` → URL nue,
      `reload()`), et les deux cas d'Atlas réalignés (`atlas.spec.ts:113-119`, `:130-136`).
- [x] **7. Aucun état serveur dans l'URL** — `serializeCollectionSearch`
      (`apps/web/src/lib/collection-search.ts:79-87`) n'écrit que `categorie`, `rarete`,
      `departement`, `q` ; ni score, ni nom, ni total, ni identifiant de carte. `commune` est le
      seul cinquième champ, et il ne survit pas à la normalisation (`collection.tsx:270-276`).
- [x] **8. `ci:check` et le banc verts** — enregistrement de la dispatch : `ci:check` → **451
      spécifications, 0 échec, 24 fichiers**, gatekeeper vert ; E2E → **100 passés, 0 échoué**
      (base 92, +8). Non rejoué par moi.

### Findings

- `apps/web/src/routes/collection.tsx:239,260-276` : la normalisation compare **deux instantanés
  différents** de l'état du routeur — `canonical` dérive de `search` (la valeur validée passée en
  prop, `:239`), `current` dérive de `state.location.searchStr` (`:267`). Le garde
  `routerStatus !== 'idle'` (`:274`) ne couvre que la phase `pending` ; dès que le routeur
  repasse `idle` avec `searchStr` en avance sur `search`, `current` porte la nouvelle adresse
  quand `canonical` porte encore l'ancienne, et la navigation `replace` écrase le filtre qui vient
  d'être posé. C'est exactement la panne observée (« clic → filtré, puis immédiatement effacé ») ;
  le garde la rend rare, il ne la supprime pas, et aucun test ne l'isole. → Dériver `target` de
  `parseCollectionSearch(parseSearch(searchStr))` — **le même instantané que `current`** — au lieu
  de la prop `search` ; les deux côtés sont alors calculés dans la même tranche d'état et
  l'incohérence devient structurellement impossible. Le garde `status` reste, en ceinture et
  bretelles, mais n'est plus la preuve. — 🟡 major, correctness (course d'état)
- `apps/web/src/routes/collection.tsx:370-376` : `useEffect(() => setPending(filters.q), [filters.q])`
  réécrit la saisie **sans condition** à chaque changement de `q` validé, y compris le `q` que
  l'anti-ré-bond vient lui-même d'écrire. Une frappe tapée pendant la fenêtre entre le
  déclenchement du minuteur et l'atterrissage de la navigation est écrasée : `pending` vaut
  `e2ex`, l'URL arrive avec `e2e`, l'effet remet `e2e`, le second effet ne trouve plus rien à
  committer (`pending === filters.q`) et le `x` disparaît du champ. → Réaligner seulement quand
  `filters.q` diffère de la dernière valeur **émise** (un `useRef` du dernier `q` commité), ou
  seulement si le champ n'a pas le focus ; le retour arrière reste ainsi couvert, la frappe non.
  — 🟡 major, correctness (perte de saisie)
- `apps/web/src/lib/collection-search.ts:118` : `q` cherche aussi dans `refCode`
  (`normalizeSearchText(card.refCode).includes(needle)`). Pour une `RUE`, `refCode` est
  l'identifiant `ref_odonymes.id` sérialisé — un entier interne qu'aucun écran n'affiche et que
  le joueur ne peut pas connaître. Une aiguille courte (`2`, `75`, `1`) retient donc des rues au
  hasard de leur identifiant de base, et le champ s'intitule pourtant « Nom ou code de carte »
  (`content/collection.ts:46`). La justification du plan ne demande que la `COMMUNE`. → Limiter
  la comparaison par code aux catégories dont le `refCode` **est** un code public (`REGION`,
  `DEPARTEMENT`, `COMMUNE`), la rue retombant sur son seul nom. — 🟡 major, relevancy
- `apps/web/src/lib/collection-search.ts:97-101` + aucune chaîne dans
  `apps/web/src/content/collection.ts` : sous un filtre département, les cartes `REGION` et `RUE`
  sont **silencieusement** exclues (`return false`), et rien dans l'interface ne le dit. Une
  collection de 200 cartes tombe à 12 avec pour seule explication « 12 cartes affichées sur 200
  cartes » ; l'état vide parle de « ces filtres » sans nommer celui qui coupe. C'est une
  dérivation défendable techniquement (le navigateur n'a pas `commune_odonymes`), pas une
  dérivation explicite pour le joueur. → Une ligne de teneur sous le `select`, tirée de
  `content/collection.ts` : « Le filtre département ne s'applique qu'aux cartes de département et
  de commune. » — 🟡 major, UX (règle invisible)
- `apps/web/src/content/collection.ts:12-15` : `searchLabel`, `searchPlaceholder`, `rarityLabel`
  et `categoryLabel` ne sont plus lus nulle part (seul `allValues` survit, utilisé
  `collection.tsx:408`) — vérifié par `grep -rn` sur `apps/web/src` hors `content/collection.ts`.
  Le panneau a ses propres clés dans `COLLECTION_FILTERS`. → Supprimer les quatre clés mortes.
  — 🟢 minor, dette
- `apps/web/src/content/collection.ts:55-58` : `filteredCardsLabel` est un alias d'une ligne de
  `cardsShownLabel`, avec un commentaire qui promet une différence de formulation qui n'existe
  pas. → Appeler `cardsShownLabel` directement, ou faire dire quelque chose de propre au compte
  filtré. — 🟢 minor, dette
- `.docs/sessions/cadastre-filtres/phase-4.md` (ligne d'acceptation) vs le diff : le document
  annonce « **sept** cas » et « le total exécuté augmente **de sept**, ni plus ni moins », et
  attribue au cas département d'Atlas la preuve de « l'état vide filtré ». Le fichier livré porte
  **huit** `test()` (`cadastre.spec.ts:69,102,120,133,146,160,174,198`) et le banc a crû de
  **huit** (92 → 100) ; l'arrivée après `E2E-D1` écarté est le Cadastre **non filtré**, pas l'état
  vide filtré, et les deux fichiers l'assertent correctement (`atlas.spec.ts:135-136` assert le
  `h1`, `cadastre.spec.ts:212-213` aussi). Le commentaire du test est juste, le tableau
  d'acceptation est faux. → Corriger le document (sept → huit, « état vide filtré » → « Cadastre
  nu »), ne pas toucher aux tests. — 🟢 minor, contrat/documentation
- `apps/web/src/routes/collection.tsx:436` : `<select id="collection-departement">` porte un `id`
  qu'aucun `htmlFor` ne référence, à côté d'un `aria-label`. Le `fieldset`/`legend` juste au-dessus
  donne déjà le nom. → Retirer l'`id`, ou le remplacer par un vrai `<label htmlFor>`.
  — 🟢 minor, propreté
- `apps/web/src/routes/collection.tsx:~319` : `CollectionCounters` reçoit `items` (la collection
  **entière**) alors que la liste affichée reçoit `visible` (filtrée). Deux comptages de portées
  différentes cohabitent à l'écran sans que rien ne les distingue. → Passer `visible`, ou
  intituler le bloc « sur toute la collection ». — 🟢 minor, cohérence
- `packages/spec/src/collection-search.spec.ts:15-16` : la spec importe par chemin relatif à
  travers la frontière de workspace (`../../../apps/web/src/lib/…`). C'est ce qui rend le module
  testable sans le dupliquer, mais un déplacement du module casse la spec à la résolution, sans
  que le compilateur du workspace ne le voie. → À garder si c'est le style de la maison ; sinon
  exposer le module depuis `packages/shared`. — 🟢 minor, structure
- `apps/web/src/content/collection.ts:39-48` : `'Recherche'`, `'Catégorie'`, `'Rareté'` existent
  désormais en double (`COLLECTION.columns`, `TABLEAU.searchLabel`,
  `content/tableau.ts:24-25`), et le texte d'invite diverge entre deux champs de recherche de la
  même application (« Nom ou code de carte » ici, « Rechercher une carte… » au Tableau). Aucune
  règle du dépôt n'interdit la duplication de libellés entre salles ; c'est signalé, pas blâmé.
  — 🟢 minor, cohérence
- `apps/web/src/routes/collection.tsx:409` : `role="checkbox"` sur un `<button>` coûte un
  `biome-ignore lint/a11y/useSemanticElements`. Le plan impose `aria-checked` (phase-3, tâche 3.2),
  donc la suppression est contractuelle et non un contournement de confort — mais `aria-pressed`,
  déjà employé trois lignes plus haut pour la catégorie, l'aurait évitée. — 🟢 minor, accessibilité

Aucun défaut critique : rien ici ne peut corrompre une donnée, une session ou un paiement. Les
quatre majors sont des défauts d'exactitude et de lisibilité dans la salle, pas des risques
systémiques.

### Écarts assumés

| Écart | Jugement |
| :--- | :--- |
| **Sérialiseur global** (`main.tsx:19-20`) : `stringifySearch`/`parseSearch` installés sur le routeur entier au lieu de la seule route `/collection`. | **Recevable, avec une réserve écrite.** Blast radius mesuré : trois routes seulement déclarent un `validateSearch` (`boutique.index.tsx:15`, `boutique.succes.tsx:15`, `collection.tsx:187`) et toutes trois ne lisent que des chaînes ; `/atlas` n'en déclare aucun et ne reçoit sa recherche que par héritage (`assemblage.tsx:6`, `search: true`). `undefined` est toujours écarté (`search-params.ts:25`, verrouillé par `collection-search.spec.ts:318-320`), donc `{ session_id: undefined }` (`boutique.succes.tsx:66,141`) continue de rendre une URL vide. Les valeurs numériques deviennent des chaînes pour **toutes** les routes : aucune ne les consomme aujourd'hui, mais c'est un changement de contrat global qu'aucun test d'intégration ne couvre — les deux routes boutique sont de toute façon inertes (`SHOP_ENABLED = false` → `notFound`). Un futur `?page=2` typé `number` arrivera en `'2'` et le type mentira. À écrire dans `.docs/01-architecture.md` §4.5, sinon la prochaine salle le redécouvrira. |
| **`stringifySearch(search: object)`** et non `Record<string, unknown>` (`search-params.ts:21`). | **Justifié.** `CollectionSearchWire` est une interface sans signature d'index ; `Record<string, unknown>` l'aurait refusée et forcé un cast, ce que les règles interdisent. `Object.entries` sur `object` est sûr et la fonction reste pure. Le commentaire `:17-19` dit exactement pourquoi. |
| **`isDesktop` remonté de `CollectionTable` à `CollectionBody`** (`collection.tsx:228-237`). | **Nécessaire et correct.** Le `<details open={isDesktop}>` du panneau et l'`estimateSize` de la table doivent lire le même booléen ; deux `matchMedia` séparés auraient pu diverger d'une frame. `CollectionTable` le reçoit en prop (`:551`) et `estimateSize` (`:584`) est inchangé. Le hook média n'est pas dupliqué. |
| **`q` cherche aussi dans `refCode`** (`collection-search.ts:118`, décision du plan). | **Recevable dans son intention, fautif dans son extension.** L'intention est bonne : sans elle, `?commune=<code INSEE>` transporté dans `q` ne produirait aucun état observable, et le critère 4 ne serait démontrable qu'en constatant zéro ligne. L'extension aux `RUE` ne l'est pas — elle rend cherchables des identifiants internes jamais affichés (voir major 3). La décision du plan n'a pas à être rediscutée ; son périmètre d'application, si. |
| **Réalignement des cas d'Atlas** (`atlas.spec.ts:113-119`, `:130-136`). | **Le cas commune est renforcé, le cas département est affaibli sans être vidé — et le commentaire est exact.** Commune : l'assertion d'URL devient `?q=…`, et deux assertions s'y ajoutent (le code INSEE survit, `searchbox` le porte) ; c'est plus fort qu'avant. Département : l'ancienne assertion `?departement=E2E-D1$` ne pouvait plus passer, `E2E-D1` n'étant pas un code français ; la nouvelle prouve l'arrivée dans la salle et l'affichage du `h1`, mais **plus** que le code a été transporté — ce qu'elle ne peut pas, le validateur l'ayant écarté. Le commentaire `:130-134` dit vrai et prévient explicitement de ne pas « corriger » l'URL. Ce n'est pas un test affaibli par confort : c'est un test dont la fixture est incompatible avec un contrat déjà pris, et l'écart est déclaré aux deux endroits (ici et `plan.md`, table des décisions). Reste que le §2 « Impact » du plan parle d'un « état vide filtré » qui n'existe pas à l'arrivée : c'est la seule imprécision, relevée en 🟢 ci-dessus. |
| **`?commune=` conservé dans le schéma validé le temps d'un `replace`** (`collection-search.ts:89-94`). | **Nécessaire, et borné.** Sans la clé dans le schéma, le validateur l'effacerait avant que quiconque la lise : l'information serait perdue, pas consommée. Elle ne survit jamais à la navigation (`collection.tsx:270-276`) et le critère 4 le vérifie en navigateur (`cadastre.spec.ts:151`). |

---

## Round 2 · r-9c2f

- Date: 2026-11-22
- By: session de la phase 36 (auteur du diff, sur les quatre majors du tour 1)
- Axes: code, functional
- **Verdict : prêt à livrer.** Les quatre majors sont fermés, aucun nouveau défaut majeur.

Le tour 1 était un vrai tour de relecture, pas une formalité : il a trouvé une course que le banc
vert masquait, un champ de recherche qui exposait un identifiant interne, et deux bugs de saisie et
d'affichage que j'avais écrits.

### Les quatre majors, et ce qui a changé

| Major du tour 1 | Correctif | Preuve |
| :--- | :--- | :--- |
| **1.** La normalisation comparait deux instantanés différents du routeur (`search` validé contre `state.location.searchStr`) : après un clic, un `replace` pouvait défaire le filtre posé. | La cible de comparaison est désormais dérivée **du même instantané** (`parseSearch(searchStr)` → `liveFilters` → `liveTarget`), donc la course est impossible par construction et non seulement étroite. L'affichage garde `Route.useSearch()` comme lecture unique. | `collection.tsx` : `liveSearch` / `liveFilters` / `liveCommune` / `liveTarget` / `current` / `canonical`, effet gardé par `current === canonical`. Banc 100/100. |
| **2.** Le réalignement de la saisie était inconditionnel (`setPending(filters.q)`), donc une frappe tapée entre le minuteur et l'atterrissage de la navigation était avalée. | `lastEmitted` en `useRef` : on ne réaligne que si le `q` de l'URL diffère de ce que **nous** venons d'émettre. | `collection.tsx` (panneau) ; cas de frappe E2E vert. |
| **3.** `q` cherchait dans `refCode` pour toutes les catégories, donc dans `ref_odonymes.id` pour une rue : un identifiant interne, jamais affiché, devenait fouillable (« 2 », « 75 » matchaient des rues au hasard) alors que le champ dit « Nom ou code de carte ». | `CODE_SEARCHABLE_CATEGORIES = {REGION, DEPARTEMENT, COMMUNE}` ; une rue n'est cherchée que dans son nom. | `collection-search.ts` + nouveau cas de spec : une `RUE` de `refCode: '12345'` ne répond plus à `q: '12345'` ; une `COMMUNE` du même code répond toujours. |
| **4.** Le filtre département écartait silencieusement les cartes `REGION` et `RUE`. | `COLLECTION_FILTERS.departementHint`, rendu sous le `select` et relié par `aria-describedby` (10 px, jamais moins). | `content/collection.ts`, `collection.tsx`. |

### Le défaut trouvé par le banc, après le tour 1

Le banc a rendu **99 passés, 1 flaky** sur « une valeur inconnue est écartée et l'URL réécrite ».
Ce n'était ni la normalisation ni le routeur : `expect(await collectionRows(page).count())`
échantillonnait **une fois** pendant que la SPA chargeait encore session et collection, quand la
table n'existe pas. `toHaveURL` rendait la main immédiatement (l'URL était déjà canonique), donc
rien n'attendait le rendu. Le correctif est côté test et garde le sens : `toHaveCount(withUnknown)`
auto-réessaie, et les deux comptages réellement utilisés comme nombres attendent d'abord
`collectionRows(page).first()` visible. Aucune valeur attendue, aucune expression d'URL, aucun
délai n'a été relâché, et aucun `skip`/`fixme` n'a été ajouté.

Preuve de déterminisme : `--repeat-each=5 --retries=0` sur `cadastre.spec.ts` → **40/40**.
Sans `--retries`, un flake serait une chute, pas un succès.

### Vérification finale (rejouée après tous les correctifs)

```
ci:check                                  452 spécifications · 24 fichiers · 0 échec
                                          1/4 Lint ✓  2/4 Typecheck ✓  3/4 Base de données ✓ (16 migrations)  4/4 Spécifications ✓
banc E2E (4 projets)                      100 exécutés · 100 passés · 0 échoué · 0 ignoré · 0 flaky
                                          (base 92 avant la phase, +8 : les huit cas du Cadastre)
cadastre.spec.ts --repeat-each=5 --retries=0   40/40
```

### Ce qui reste assumé, et pourquoi

- **`apps/web/src/main.tsx` porte désormais un `stringifySearch`/`parseSearch` global.** C'était
  nécessaire : le décodeur par défaut de TanStack passe chaque valeur par `JSON.parse`, donc
  `?departement=99` arrivait en `number` et le validateur du contrat l'écartait, et le sérialiseur
  par défaut encode les virgules en `%2C` alors que le contrat veut des virgules littérales.
  Portée vérifiée : seules trois routes déclarent un `validateSearch`, toutes lisent des chaînes,
  `undefined` reste omis, la redirection `search: true` de `/assemblage` est intacte. Effet de
  bord réel : pour toute route future, un paramètre numérique arrivera désormais en chaîne.
  **Non documenté dans `.docs/01-architecture.md` : le brief de la phase interdit d'y toucher.**
  C'est consigné dans le journal et dans le corps de la PR, à remonter par le lanceur.
- **`stringifySearch` prend `object` et non `Record<string, unknown>`** : les formes de transport
  déclarées en interface n'ont pas de signature d'index. Type seulement, aucune perte de sûreté
  aux points d'appel.
- **`q` cherche aussi dans le code de référence** des régions, départements et communes. Sans cela,
  un lien `?commune=<code INSEE>` versé dans `q` ne pouvait rien rendre : le code n'apparaît dans
  aucun nom.
- **Le filtre département est une dérivation** — égalité pour `DEPARTEMENT`, préfixe du code INSEE
  pour `COMMUNE` (correct pour `2A`/`2B` et l'outre-mer). Les régions et les rues n'y sont pas
  attribuables sans référentiel côté navigateur ; c'est maintenant écrit à l'écran.
- **Deux cas de `atlas.spec.ts` sont réalignés.** Le cas commune est **renforcé** (trois assertions
  au lieu d'une). Le cas département est plus faible mais honnête : `E2E-D1` n'est pas un code de
  département français et le validateur du contrat l'écarte, donc l'arrivée est le Cadastre nu.
  Un commentaire dans le cas dit pourquoi, pour qu'aucune session ne « répare » l'URL.
