# Revue — Phase 33 « L'Assemblage, la donnée »

Relecture hostile du diff `feat/v2-wave-1..feat/v2-33-assemblage-data`, faite par un lecteur
distinct du producteur, puis corrigée.

## Verdict

**Prêt à livrer.** Aucun défaut *deal-breaker*. Les dix points non négociables du brief sont tenus,
`ci:check` est vert, l'import a été rejoué deux fois sans dérive d'empreinte, et aucune écriture
hors périmètre n'a été trouvée.

**Un critère d'acceptation n'est pas tenu : le critère 2.** Il est documenté plus bas et **n'est
pas coché**. Ce n'est pas un défaut d'implémentation mais une incompatibilité arithmétique du brief.

## Contrôle du contrat

| # | Point non négociable | Verdict |
| :--- | :--- | :--- |
| 1 | `path_d text` nullable sur les trois tables, sans index ni `CHECK` ni `NOT NULL`, migration `0015_atlas_paths` unique et rejouable, `down()` qui retire les trois colonnes | **tenu** |
| 2 | Un seul `viewBox` documenté et partagé `0 0 1000 1000`, Mercator sphérique EPSG:3857 cadré métropole | **tenu** |
| 3 | L'outre-mer vaut `path_d = NULL`, décidé géométriquement | **tenu** |
| 4 | Douglas-Peucker, tolérances en unités de viewBox (0,6 / 0,35 / 0,2), anneau sous 3 points conservé, commune > 700 points → epsilon doublé, aucune tolérance en degrés | **tenu** |
| 5 | Arrondi à deux décimales, `-0` normalisé | **tenu** |
| 6 | Module de projection pur, sans entrée-sortie ni dépendance | **tenu** |
| 7 | Écriture idempotente, `path_d` non nul jamais recalculé | **tenu** |
| 8 | `geom` invalide ou vide ne fait pas échouer l'import, compteur non nul | **tenu** |
| 9 | Aucun `apps/`, aucun cas de spec existant modifié, aucune migration autre que `0015`, aucune géométrie au runtime, aucun `path_d` en degrés, aucun `geom` exposé | **tenu** |
| 10 | `migrator.ts` et `schema.ts` édités en ajout, en fin de liste | **tenu** |

## Défauts relevés, et leur traitement

### Corrigés avant livraison

| Gravité | Fichier | Défaut | Correctif appliqué |
| :--- | :--- | :--- | :--- |
| suggestion forte | `packages/spec/src/atlas.spec.ts` | Aucune assertion ne figeait une **valeur** : une inversion de `y` aurait livré une France à l'envers avec une spec verte. | Cinq cas ajoutés — `le nord est en haut`, `l'est est à droite`, `un tracé gelé` (chaîne exacte `M506.64 276.06L513.13 276.06L513.13 266.19L506.64 266.19Z`), `les niveaux ne rendent pas le même tracé`, `un sommet au pôle est invalide`. |
| suggestion forte | `scripts/import/src/atlas-ign.ts` | `startIndex` avançait du nombre de features **filtrées** : une entrée non-objet décalait le parcours et trouait le référentiel. | `WfsPage.rawCount` conserve la longueur brute ; la boucle avance dessus et teste `rawCount < PAGE_SIZE`. |
| suggestion | `scripts/import/src/atlas-ign.ts` | `totalFeatures = 0` et un serveur ignorant `STARTINDEX` faisaient boucler le parcours national indéfiniment, en silence. | `MAX_PAGES = ceil(40 000 / 500) + 4`, garde `ATLAS_IGN_PAGINATION_LOOP`. |
| suggestion | `scripts/import/src/atlas-projection.ts` | `lat = ±90` rendait `±Infinity`, donc une entité classée `out_of_viewbox` (« outre-mer ») au lieu de `invalid` : compteur faux. | `Math.abs(lat) >= 90` refusé dans la validation des positions. |
| suggestion | `scripts/import/src/atlas.ts` | `path_d = ''` était traité comme « déjà calculé » et n'était jamais réparé. | `row.path_d !== null && row.path_d.length > 0`. |
| suggestion | `packages/spec/src/atlas.spec.ts` | `expect(second.written).toBe(0)` était une assertion **globale**, fragile sous fichiers de spec parallèles. | Identité à l'octet sur la ligne possédée, `alreadySet >= 1`, `written <= premier.written`. |
| suggestion | `scripts/import/src/args.ts` | L'aide de `--limit` laissait croire que le téléchargement était borné. | Formulation corrigée : seul le **calcul** est borné. |
| suggestion | `packages/spec/src/atlas.spec.ts` | Commentaire d'en-tête renvoyant à « une seconde passe » inexistante. | Corrigé. |

### Assumés, non corrigés

| Fichier | Défaut | Pourquoi il reste |
| :--- | :--- | :--- |
| `scripts/import/src/atlas-ign.ts` | Le module le plus risqué (réseau, pagination, `::text::jsonb`) n'a **aucun test unitaire** ; sa signature ne permet pas d'en écrire un sans HTTP réel. | Il a été exercé **en vrai** sur le référentiel national complet (35 052 lignes, 34 848 géométries écrites) et rejoué à l'identique. Injecter un `fetchPage` serait un refactor que la phase n'exige pas ; c'est noté ici comme dette. |
| `scripts/import/src/atlas-projection.ts` | Le plafond de 700 points sort silencieusement après `MAX_EPSILON_DOUBLINGS` au lieu de tenir par construction. | Faire lever l'import sur une commune pathologique violerait le critère 6 (« un `geom` invalide ne fait pas échouer l'import »). Le parcours national réel rend `0 invalide` : le cas ne s'est pas produit. |
| `scripts/import/src/atlas.ts` | `classifyGeometry` puis `geometryToPathD` projettent deux fois la même géométrie. | Coût mesuré acceptable sur 35 000 communes ; refondre l'API du module pur pour cela n'apporte rien à la phase. |
| `scripts/import/src/atlas-ign.ts` | Une panne WFS en cours de parcours laisse les niveaux suivants non exécutés (le `throw` remonte avant `runAtlas`). | Le rejeu rattrape (`geom is null`), et l'état demi-écrit est sain. Le message d'erreur a été corrigé pour le dire. |

## Ce que le code ne prouve pas

- **Aucun écran.** Cette phase ne livre que de la donnée ; rien dans `apps/` ne la lit encore. La
  vérification visuelle est donc impossible par construction, et c'est le seul cas où le journal
  de session peut le déclarer sans réserve : la salle de la phase 35 n'existe pas.
- Le banc E2E n'a **pas** été rejoué dans cette session : il ne touche ni `path_d`, ni l'import, et
  le semis E2E (seule fixture concernée) a été contrôlé directement en SQL (`12/12/12`, aucune
  coordonnée hors viewBox).

## Critère d'acceptation non tenu

**Critère 2 — « la charge utile nationale complète reste sous 250 Ko avant compression ».**

Mesuré : **8 925 691 octets ≈ 8,51 Mio** (régions 304 730 + départements 530 120 + communes
8 090 841). Le plafond est dépassé **35,7 fois**.

L'incompatibilité est arithmétique, pas une question d'implémentation : à deux décimales de
`viewBox`, 250 Ko pour ≈ 34 700 communes laisseraient 7,2 octets par entité — moins qu'un
triangle. Même en retirant les communes du total, régions + départements pèsent **834 850 octets**,
soit 3,3 fois le plafond, avec les tolérances que la décision 6 impose.

Deux issues, aucune n'appartenant à cette session : relever le budget de la phase 34/35, ou
grossir les tolérances d'un facteur ≈ 10 à 35 — ce qui changerait la décision 6, donc le contrat.

Le chiffre utile pour arbitrer : la charge utile **réellement chargée** par la phase 35 est celle
du résumé régions + départements (≈ 815 Kio), les communes se chargeant par département
(`GET /api/v1/atlas/departements/:code`).
