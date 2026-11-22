# Journal — Phase 36, Le Cadastre filtrable

Branche `feat/v2-36-cadastre`, base `feat/v2-wave-4`. Aucune migration, aucune route d'API, aucune
dépendance nouvelle : la phase est entièrement côté web, plus deux fichiers de test.

## Ce qui est livré

| Fichier | Nature |
| :--- | :--- |
| `apps/web/src/lib/collection-search.ts` | ✅ module pur : `parseCollectionSearch`, `serializeCollectionSearch`, `parseCollectionWire`, `isDepartementCode`, `normalizeSearchText`, `collectionCardMatches`, `filterCollectionCards`, `EMPTY_COLLECTION_FILTERS`. Ni routeur, ni React, ni DOM. |
| `apps/web/src/lib/search-params.ts` | ✅ module pur : `stringifySearch` / `parseSearch`, installés sur le routeur. |
| `apps/web/src/main.tsx` | ✏️ trois lignes : le routeur reçoit `stringifySearch` et `parseSearch`. |
| `apps/web/src/routes/collection.tsx` | ✏️ `validateSearch`, panneau à quatre `fieldset`, effet unique de normalisation, ordre filtre → clé de requête → données → mesure → remise à zéro conditionnelle. |
| `apps/web/src/content/collection.ts` | ✏️ `COLLECTION_FILTERS`, `COLLECTION_FILTERED_EMPTY`, `filteredCardsLabel`, `departementHint`. |
| `packages/spec/src/collection-search.spec.ts` | ✅ 34 cas, dont la forme de transport de l'URL. |
| `packages/e2e/tests/cadastre.spec.ts` | ✅ 8 cas. |
| `packages/e2e/tests/atlas.spec.ts` | ✏️ deux assertions d'URL réalignées. |

`Route.useSearch()` est appelé **une fois**. Aucun filtre ne vit dans un `useState` : seuls la
saisie anti-ré-bondie (250 ms) et l'ouverture du panneau restent locaux. Aucun `localStorage`.

## Le format d'URL retenu, et pourquoi

`?categorie=COMMUNE,RUE&rarete=RARE,EPIQUE&departement=75&q=paris`

Listes **séparées par des virgules, triées dans l'ordre du domaine, dédoublonnées**, clés dans
l'ordre `categorie, rarete, departement, q`. Une forme normalisée fait que deux URL équivalentes
sont **identiques à la chaîne** : le partage et le retour se comparent sans tri côté client.

Le tri suit `CATEGORY` et `RARITY` de `@hexamap/shared`, pas l'alphabétique : `COMMUNE,
DEPARTEMENT, REGION, RUE` se lirait mal dans une barre d'adresse, et le domaine possède déjà son
ordre.

Une valeur inconnue est **écartée, jamais une erreur** : `?rarete=ANANAS` disparaît, le reste
s'applique, et l'adresse est réécrite normalisée par un `replace: true`.

| Geste | Historique |
| :--- | :--- |
| Catégorie, rareté, département | **pousse** — le retour défait le dernier filtre |
| Recherche libre | **remplace**, 250 ms après la dernière frappe — le retour ne défait jamais une frappe |
| Normalisation de l'URL, consommation de `commune` | **remplace** |

`?commune=` est un point d'entrée, jamais un état : le code INSEE est versé dans `q` et le
paramètre disparaît. Une même information ne vit jamais deux fois dans l'URL.

## Les deux frictions contrat / référentiel, signalées et non masquées

**1. `departement` n'accepte pas les codes du banc.** Le contrat impose
`^(\d{2,3}|2[AB])$` ; le référentiel E2E porte `E2E-D1`. Le validateur l'écarte donc, et un lien
« Voir les cartes au Cadastre » depuis un département du banc arrive sur le Cadastre **nu**. Élargir
la regex aurait contredit une décision « déjà prise, ne la rediscute pas », et réécrire les codes du
référentiel E2E sortait du périmètre. Les deux cas d'`atlas.spec.ts` sont réalignés — le cas commune
est renforcé, le cas département porte un commentaire disant pourquoi l'URL finale est nue. Le
filtre département est éprouvé positivement avec un code réel bien formé et absent des données
(`?departement=99`, qui rend zéro ligne et l'état vide filtré).

**2. Le module d'URL vit côté web, pas dans `packages/shared`.** `packages/spec` l'importe par
chemin relatif (`../../../apps/web/src/lib/collection-search`). C'est légal et vérifié :
`packages/spec/tsconfig.json` n'a ni `rootDir`, ni `composite`, ni `references`, il est en
`noEmit`, et `moduleResolution: bundler` suit l'import. Le module reste pur — il n'importe que
`@hexamap/shared` — donc il typecheck avec la `lib` `ES2023` du paquet de spec, sans DOM. Il vit
côté web parce que le brief l'y place et parce qu'il décrit une forme d'URL qui n'appartient qu'à
cette salle ; il est couvert par 34 cas dans `packages/spec`, pas seulement par le banc.

## Les trois bugs que le travail a réellement trouvés

**Le sérialiseur par défaut du routeur décode en JSON.** `?departement=99` arrivait dans
`validateSearch` en `number` `99`, donc le validateur — qui n'accepte que du texte — l'écartait, et
le `<select>` restait vide. C'est ce qui a imposé `parseSearch` maison, où **toute valeur relue est
une chaîne**.

**`stringifySearch` doit rendre son `?`.** Le routeur concatène (`href = pathname + searchStr`) et
ne préfixe rien. Un sérialiseur qui rend `categorie=REGION` produit `/collectioncategorie=REGION`,
que le routeur lit comme un chemin inconnu : la salle entière disparaît à chaque clic de filtre.
Le banc l'a montré en faisant expirer `global-setup.ts` sur le deuxième onglet de catégorie. La
règle est désormais écrite dans le module et verrouillée par un cas de spec.

**`global-setup.ts` se sert du Cadastre pour recenser les catégories possédées.** Il clique chaque
onglet de catégorie puis un bouton « Toutes » pour réinitialiser. Le panneau de la phase avait
supprimé ce bouton : tout le banc mourait. La puce « Toutes » a été rétablie dans le `fieldset`
Catégorie, en tête, avec `aria-pressed` — ce n'était pas une concession au test, c'est l'affordance
qui manquait.

## La virtualisation, et la preuve qu'elle n'a pas bougé

Ordre contractuel tenu : filtre → clé de requête (inchangée, aucun filtre dedans) → données
filtrées → `count: rows.length` → `measure()` → remise à zéro **seulement** si la longueur a
changé (`useRef`). `estimateSize` (`isDesktop ? 220 : 192`), `getItemKey` et le gabarit de ligne
sont inchangés au caractère près ; aucun `h-*` ni `min-h-*` n'a été ajouté à une ligne.

Preuve mesurée : la ligne « Département E2E A » vaut **213 px** sous `?rarete=RARE` comme sous
`?categorie=DEPARTEMENT&rarete=RARE` (écart observé 6 × 10⁻⁵ px, bruit de sous-pixel du moteur ;
l'assertion tolère 0,5 px et garde les deux nombres dans son message). Les deux jeunes jeux
contiennent la ligne, sinon la mesure n'aurait plus d'objet. C'est le chiffre du corps de la PR.

## Vérification (Docker uniquement, rejouée après le dernier correctif)

```
ci:check
  1/4 Lint              ✓ (302 fichiers)
  2/4 Typecheck         ✓ (6 workspaces)
  3/4 Base de données   ✓ — base de test prête, 16 migrations, dans l'ordre
  4/4 Spécifications    ✓ — 452 pass, 0 fail, 2 740 expect(), 24 fichiers

banc E2E (chromium 21 · pwa 7 · Pixel 7 20 · iPhone 13 20, plus 8 Cadastre + 2 Atlas réalignés)
  100 exécutés — 100 passés, 0 échoué, 0 ignoré, 0 flaky
  base avant la phase : 92 — la phase ajoute 8 cas

cadastre.spec.ts --project=chromium --repeat-each=5 --retries=0
  40 / 40
```

Le banc E2E n'est pas parallélisable (`name: hexamap-e2e` et volume `hexamap_e2e_pgdata` fixes).
Une autre session tournait sur le même projet et y avait appliqué `0017_trade_offers`, ce qui
faisait échouer les migrations de cette branche en `corrupted migrations`. La session a donc joué
son banc sur un projet et un volume isolés (`-p hexamap36`, volume `hexamap_e2e_pgdata_36`, via un
fichier d'override hors dépôt). Le volume partagé n'a pas été modifié par cette phase.

## Écarts assumés

- **Un sérialiseur de recherche global dans `main.tsx`.** Inévitable : le décodeur par défaut cassait
  `?departement=99` et le sérialiseur par défaut percent-encodait les virgules. Portée vérifiée sur
  les trois routes qui déclarent un `validateSearch` et sur la redirection `search: true` de
  `/assemblage`. Effet de bord à connaître : pour toute route future, un paramètre numérique
  arrivera désormais en chaîne. **Le brief interdit de modifier `.docs/01-architecture.md`, donc
  cette règle n'y est pas écrite** — elle est ici, et dans le corps de la PR, pour que le lanceur
  la remonte.
- `isDesktop` est remonté de `CollectionTable` à `CollectionBody` : le panneau a besoin du même
  point de rupture et le brief interdit d'ajouter un second hook média.
- `filteredCardsLabel` délègue à `cardsShownLabel` au lieu d'en recopier la phrase : même pluriel,
  aucune divergence possible.
- `q` cherche dans `nom` **ou** dans le code de référence, mais seulement pour les régions,
  départements et communes. Pour une rue, `refCode` est `ref_odonymes.id`, un identifiant interne
  jamais affiché : le rendre fouillable faisait matcher des rues au hasard sur des aiguilles
  courtes. Trouvé en relecture, corrigé, verrouillé par un cas de spec.
- Le filtre département n'attribue ni région ni rue, faute de référentiel dans le navigateur. C'était
  silencieux ; une ligne d'aide sous le `select`, reliée par `aria-describedby`, le dit maintenant.

## Ce que cette session n'a pas fait

- Aucun fichier de `apps/web/src/components/layout/` touché (phase 39 propriétaire).
- `apps/web/src/routeTree.gen.ts` régénéré par `tsr generate`, jamais édité à la main.
- `.docs/03-active-task.md`, `ROADMAP.md`, `.docs/01-architecture.md` et `.docs/02-database.md`
  intacts.
- Aucune table, colonne, index ni motif `currency_ledger`.
