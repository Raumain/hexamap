# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 3 — Import Open Data (geo.api.gouv.fr & BAN)
- **État** : **Terminé** (pipeline API Gouv + BAN opérationnel, vérifié en base)
- **Priorité** : P0
- **Mis à jour** : 2026-11-15
- **Branche conseillée** : `feat/phase-3-open-data-import`

---

## Objectif

Créer un script Bun (`scripts/import/index.ts`) robuste et performant pour télécharger, parser et insérer les données géographiques françaises dans les tables de référence PostgreSQL (`ref_regions`, `ref_departements`, `ref_communes`, `ref_odonymes`, `commune_odonymes`).

À la fin de cette tâche :
- Les 5 tables de références sont peuplées.
- Les scores (`score_base`), raretés (`rarete`) et buckets de tirage (`draw_bucket`) sont pré-calculés lors de l'insertion.
- Le script accepte un flag `--lite` pour n'importer que 2 régions (ex: Bretagne & Corse) afin d'accélérer les tests.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Section 5.3 et 5.4 pour les formules de score et rareté).
2. Le schéma Kysely généré lors de la Phase 2.
3. Les utilitaires de scoring (s'ils ont été créés dans `packages/shared/src/scoring.ts` lors de la Phase 1).

---

## Étapes

### 1. Structure du script
- [x] Créer `scripts/import/index.ts` avec la gestion des arguments CLI (`--lite`).
      → entrée réelle : `scripts/import/src/index.ts` (convention du package) + shim
      `scripts/import/index.ts` qui délègue à `main()`.
- [x] Initialiser la connexion Kysely.
- [x] Vider les tables de référence existantes (`TRUNCATE ... CASCADE`) au début du script pour le rendre idempotent.

### 2. Import API Gouv (Régions, Départements, Communes)
- [x] Fetcher `https://geo.api.gouv.fr/regions` et insérer dans `ref_regions`.
- [x] Fetcher `https://geo.api.gouv.fr/departements` et insérer dans `ref_departements`.
- [x] Fetcher `https://geo.api.gouv.fr/communes?fields=nom,code,codeDepartement,codeRegion,population,centre` (filtrer pour exclure celles sans population).
- [x] Calculer `rarete`, `score_base` (via les formules) et `draw_bucket` (random 0-255) pour chaque commune.
- [x] Insérer les communes par lots (chunks de 2000) pour ne pas bloquer PostgreSQL.

### 3. Import Base Adresse Nationale (Rues)
- [x] Télécharger le fichier CSV des adresses (URL officielle BAN par défaut, ou `--ban-file` local / gzip).
- [x] Utiliser un lecteur en streaming (`createReadStream`/`fetch` → `gunzip` → `readline`), sans dépendance CSV externe.
- [x] Maintenir une `Map<string, Set<string>>` en mémoire : `nom_normalise` (clé, en minuscules sans accents) -> `Set(code_insee)`.
- [x] Ignorer les adresses n'appartenant pas aux communes conservées.
- [x] Une fois le stream terminé, calculer la rareté/score des odonymes selon la taille de leur `Set`.
- [x] Insérer dans `ref_odonymes` en chunks (`RETURNING id, nom_normalise`).
- [x] Insérer les relations dans `commune_odonymes` en chunks, immédiatement après chaque lot d'odonymes (pas d'accumulation des ~2,2 M de liens en RAM).

### 4. Qualité
- [x] `bun run typecheck` (`scripts/import` : tsc strict, 0 erreur)
- [x] `bun run lint` (`biome check scripts/import` : 0 erreur)

---

## Critères d'acceptation

1. [x] L'exécution avec `--lite` prend moins de 30 secondes.
       → `--lite --skip-ban` : **16,3 s** (1 202 communes bretonnes).
2. [x] Le script complet ne déclenche pas d'erreur `Out of Memory` dans Bun (gestion via streams et chunks).
       → aucune lecture complète du CSV, Map seule en RAM, lots de 2 000.
3. [x] Les scores et raretés sont correctement renseignés en base.
       → vérifié : `rue de l eglise` (N=2) => `LEGENDAIRE` / 2 306 ; N=1 => `MYTHIQUE` / 3 000 ;
       communes bretonnes `score_base` ∈ [352, 2877].
4. [x] Les noms de rues sont bien regroupés (un odonyme = plusieurs communes possibles).
       → « Rue de l'Église » (Rennes) + « rue de l eglise » (Quimper) fusionnent en 1 odonyme,
       2 liens `commune_odonymes`.

---

## Commandes
```sh
docker compose --profile tools run --rm dev bun run scripts/import/index.ts --lite
```

Variantes utiles :
```sh
--skip-ban                        # API Gouv seule (rapide)
--skip-gouv                       # BAN seule, sur les communes déjà en base
--ban-file=data/adresses-france.csv.gz
--regions=53,94
```

## Interdits
- Ne JAMAIS lire l'intégralité du CSV de la BAN en mémoire avec Bun.file().text() ou fs.readFileSync.
- Ne pas appeler d'API externe (geo.api.gouv) pour chaque rue (utiliser le CSV officiel).
- Ne pas complexifier l'import avec des géométries complètes (GeoJSON) pour le moment : garder uniquement le point central (lat/lon) de la commune si disponible dans l'API gouv.

---

## Journal

### 2026-11-15 — Phase 3 implémentée

**Fichiers créés** (sous `scripts/import/`) :

| Fichier | Rôle |
| :--- | :--- |
| `index.ts` | Point d'entrée demandé par la tâche, délègue à `src/index.ts`. |
| `src/index.ts` | Orchestration : args, TRUNCATE, API Gouv, BAN, insertions, logs. |
| `src/args.ts` | Parsing CLI (`--lite`, `--regions`, `--ban-file`, `--ban-url`, `--skip-ban`, `--skip-gouv`). |
| `src/gouv.ts` | Fetchers geo.api.gouv.fr + construction des lignes typées. |
| `src/ban.ts` | Lecture streaming du CSV BAN + regroupement `Map<nom_normalise, Set<code_insee>>`. |
| `src/normalize.ts` | `normalizeStreetName`, `splitCsvLine` (CSV `;` avec guillemets), `chunkArray`. |
| `src/db.ts` | Connexion Kysely, `INSERT_CHUNK_SIZE = 2000`, TRUNCATE. |
| `README.md` | Usage + attribution des sources (Etalab / BAN-IGN). |

**Décisions** :

1. **Entrée** : le package déclarait déjà `bun src/index.ts` et `tsconfig` incluait `src/**/*.ts`.
   L'implémentation vit donc dans `src/`, et `scripts/import/index.ts` (chemin cité dans la tâche)
   reste un shim de 3 lignes. Les deux chemins fonctionnent.
2. **Normalisation** : minuscules + suppression des accents/ligatures, tirets, apostrophes et
   ponctuation remplacés par des espaces, espaces compactés. La tâche demandait « minuscules »,
   `.docs/01-architecture.md` §4.7 mentionnait « majuscules » : on retient les minuscules
   (également ce que demande la tâche active) ; l'unicité de `nom_normalise` est préservée et
   le libellé original est stocké dans `nom_affichage`.
3. **Aucune dépendance CSV ajoutée** : parseur de ligne minimal gérant les guillemets et les `;`
   échappés, pour éviter d'alourdir le workspace.
4. **`--lite`** = région **53 (Bretagne)** seule, comme demandé ; `--regions=53,94` permet d'élargir.
5. **Mémoire** : les liens `commune_odonymes` ne sont jamais accumulés globalement ; ils sont
   insérés lot par lot juste après l'insertion du lot d'odonymes correspondant.
6. **`draw_bucket`** : entier aléatoire 0–255 calculé à l'import (colonne `Generated<number>`).
7. **Population des départements** : valeur API, sinon somme des populations de ses communes.

**Vérifications exécutées** (dans Docker) :

```text
bun run --cwd scripts/import typecheck      → OK
bun x biome check scripts/import            → OK
bun run db:migrate                          → OK
start --lite --skip-ban                     → 1 région / 4 dép. / 1 202 communes, 16,3 s
start --lite --skip-gouv --ban-file=…       → 3 odonymes / 4 liens, regroupement et scores conformes
```

**Reste hors périmètre de cette phase** : géométries simplifiées (`geom`), blasons Wikidata
(`blason_url`), et l'import complet national (à lancer une fois sur un volume neuf).

### 2026-11-15 — Exécution : one-shot, jamais au démarrage

**Décision** : l'import reste un batch one-shot. Il n'est pas branché sur le démarrage de
l'API (règle « aucun appel externe au runtime ») ; les données vivent dans le volume `pgdata`
et survivent aux redémarrages.

**Ajouts** :

1. `--if-empty` : lit `count(ref_communes)` (et `count(ref_odonymes)` si la BAN est demandée)
   et sort en code 0 si le référentiel est déjà complet. Permet de chaîner le script sans risque.
2. **BAN par département en mode `--lite`/`--regions`** : au lieu du fichier national
   (plusieurs Go), le script télécharge `adresses-<dep>.csv.gz` pour les départements réellement
   importés. Bretagne = 4 fichiers (~50 Mo), 1,75 M de lignes, ~20 s au total.
3. `scripts/bootstrap.sh` et `dev.sh --fresh` lancent `--lite --if-empty` ; un échec réseau
   n'interrompt pas le bootstrap (message + commande de relance).

**Mesures sur `--lite`** : 1 202 communes · 115 178 odonymes · 179 991 liens · 19,8 s.
Distribution : 32 `INHABITUELLE`, 559 `RARE`, 3 095 `EPIQUE`, 12 393 `LEGENDAIRE`,
99 099 `MYTHIQUE` (pas de rue à plus de 500 communes à l'échelle d'une seule région).
Second lancement `--if-empty` : « Référentiel déjà présent — import ignoré », exit 0.

