# Journal — Phase 34, L'Assemblage, l'API

Branche `feat/v2-34-assemblage-api`, base `feat/v2-wave-2`. Aucune migration (réservée : `-`).

## Ce qui est livré

| Fichier | Nature |
| :--- | :--- |
| `packages/shared/src/atlas.ts` | **créé** — `ATLAS_VIEWBOX = '0 0 1000 1000'` et les cinq types de charge utile. Module pur, zéro import. |
| `packages/shared/src/index.ts` | modifié — `export * from './atlas';` entre `./achievements` et `./charges`. |
| `apps/api/src/services/atlas.ts` | **créé** — `loadAtlasSummary` / `loadAtlasDepartement`, une instruction SQL chacune. |
| `apps/api/src/routes/atlas.ts` | **créé** — `GET /api/v1/atlas/summary`, `GET /api/v1/atlas/departements/:code`, schémas `response` fermés. |
| `apps/api/src/app.ts` | modifié — `atlasRoutes` monté dans `buildProtectedRoutes`, après `shopCheckoutRoutes`. |
| `packages/spec/src/atlas-api.spec.ts` | **créé** — 14 cas. |
| `.docs/sessions/assemblage-api/{plan,phase-1,phase-2,phase-3,review,journal}.md` | **créés**. |

Aucune dépendance ajoutée. Aucun test existant modifié. `packages/spec/src/atlas.spec.ts`
(phase 33) intact.

## Preuves mesurées

`ci:check`, ma propre exécution, arbre final :

```
 385 pass
 0 fail
 2354 expect() calls
Ran 385 tests across 21 files. [23.87s]
[hexamap] ✓ 4/4 Spécifications
[hexamap] ✓ Gatekeeper vert.
```

Étapes `1/4 Lint`, `2/4 Typecheck`, `3/4 Base de données` vertes avant `4/4`. Le premier passage
avait échoué à l'étape 1 sur le formatage Biome du cas ajouté en revue (une ligne trop longue) ;
corrigé par `bunx biome check --write` sur le seul fichier de spec, puis rejoué vert. Le producteur
avait lui aussi vu **384 pass / 21 fichiers** avant mon ajout de cas, ce qui est cohérent.

| Mesure | Valeur | Méthode |
| :--- | ---: | :--- |
| Instructions SQL du résumé | **1** | `createDb(url, { log })` collecte `level === 'query'` autour d'un appel ; `toHaveLength(1)`. |
| Instructions SQL du détail | **1** (×2 pour deux appels, dont un code inconnu) | idem. |
| p95 du résumé, 2 000 cartes, 20 appels | **30,0 ms** (`ci:check`) ; 16,4 / 23,8 / 30,1 / 41,2 ms selon les passages | `performance.now()` autour de `authFetch`, 20 échantillons triés, index `ceil(20×0,95)−1`. Seuil asserté : ≤ 200 ms. |
| Charge d'un département de 900 communes | **337 527 octets** | `TextEncoder().encode(text).byteLength` sur la réponse HTTP réelle. |
| Département 62 réel (887 communes) | **166 715 octets** de `path_d` seul | `docker compose exec -T db psql`, `sum(length(path_d))` groupé par département. |

Base semée par le test lui-même : deux régions, quatre départements (un sans `path_d`, un de
200 communes pour la mesure de temps, un de 900 communes pour la mesure de taille), quatre
communes nommées, 2 000 cartes insérées en **une** instruction par `generate_series`. Tout est
supprimé en `afterAll` par préfixe `crypto.randomUUID().slice(0, 8)`.

## Écarts assumés

1. **Un fichier de spec neuf, `atlas-api.spec.ts`, au lieu de `atlas.spec.ts`.** Le brief nommait
   `atlas.spec.ts`, mais ce fichier existe depuis la phase 33 (457 lignes, projection et écriture
   idempotente de `path_d`) et est gelé. Le dépôt a déjà ce découpage (`tableau.spec.ts` et
   `tableaux.spec.ts` coexistent). Écrire dedans exposait à réécrire un cas gelé.
2. **Le SQL des deux services est du `sql` brut composé dans un `selectNoFrom` Kysely.** Cela
   dévie de `apps/api/AGENTS.md` (« Pas de SQL brut dans les services ») et de
   `.docs/02-database.md` §1.7. C'est le prix du critère 1 : `json_build_object` et `json_agg` ne
   s'expriment pas dans le constructeur typé, et une seconde instruction rouvrirait le N+1
   interdit. Aucun `executeQuery`, aucun `db.raw` : la requête reste portée par Kysely.
3. **`404` sur `ref_departements.path_d is null`, sans liste de codes d'outre-mer en dur.** C'est
   le seul signal serveur produit par la classification `out_of_viewbox` de la phase 33 (vérifié
   en base : 971, 972, 974 sont `null` ; 2A, 75, 06 ne le sont pas). Conséquence : le `200` du
   critère 4 est prouvé sur un département **tracé** sans aucune carte, pas sur un département
   sans géométrie.
4. **`hasCommuneCard` vaut `ownedCards > 0`.** Une carte de commune porte le code INSEE dans
   `ref_code` : posséder la carte, c'est posséder la commune. Le champ du contrat est servi sans
   seconde requête.

## Contradictions relevées, non corrigées

1. **Le plafond de 60 Ko par département est hors d'atteinte.** La décision 6 du brief le prévoyait
   et prescrivait d'écrire le chiffre sans paginer. Mesures : 166 715 octets de `path_d` pour le
   département 62 (887 communes), 233 octets de moyenne nationale par commune, 337 527 octets pour
   la fixture de 900 communes. **Critère 6 non coché.**
2. **« La phase 33 tient la charge nationale sous 250 Ko » est faux d'un facteur ~35** : la somme
   nationale de `path_d` est de 8 925 691 octets (8,5 Mio). Corriger cela demande un epsilon plus
   grand ou un plafond de points plus bas **à l'import** — phase 33, hors périmètre ici.
3. **`ATLAS_VIEWBOX` est un homonyme.** `scripts/import/src/atlas-projection.ts:28` exporte déjà
   `ATLAS_VIEWBOX = 1000` (nombre) ; le contrat impose `'0 0 1000 1000'` (chaîne) dans
   `packages/shared`. Aucun fichier n'importe les deux aujourd'hui, donc aucun conflit de
   compilation, mais l'ambiguïté reste à trancher.

## Ce que la session n'a pas prouvé

- **`ci:check` n'a pas été rejoué commit par commit.** Il l'a été deux fois sur l'arbre final
  (dont une après l'ajout du cas de possession). Les quatre commits sont des tranches additives
  dont l'arbre intermédiaire est un sous-ensemble strict de l'arbre vérifié — types seuls, puis
  service et routes, puis spec, puis documentation —, mais un rejeu isolé aurait exigé un second
  projet Compose sur la base `hexamap_test_34`, ce qui crée une pile neuve et vide.
- **La vérification navigateur n'a pas lieu d'être** : cette phase ne livre aucun écran. La salle
  est la phase 35 ; les deux routes ont été exercées par `app.handle`, pas par un navigateur.
- **Le banc E2E n'a pas été rejoué** : il ne connaît aucune route d'atlas, et la phase n'ajoute
  aucun comportement visible. Les 68 cas du banc restent ceux de la vague.
- **La mesure de temps est celle d'un conteneur de CI**, pas d'une machine de production. Elle
  établit un ordre de grandeur (30 ms pour un seuil de 200 ms), pas une garantie de latence.
