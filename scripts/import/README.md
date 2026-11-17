# Import Open Data — Hexamap

Pipeline one-shot (rejouable) qui peuple les tables de référence :
`ref_regions`, `ref_departements`, `ref_communes`, `ref_odonymes`, `commune_odonymes`.

## Sources et attribution

| Donnée | Source | Licence / attribution |
| :--- | :--- | :--- |
| Régions, départements, communes, population, centroïde | [`geo.api.gouv.fr`](https://geo.api.gouv.fr) (API Découpage administratif) | Etalab 2.0 — « © Etalab, base des codes officiels géographiques » |
| Voies et adresses (odonymes) | [Base Adresse Nationale](https://adresse.data.gouv.fr) — fichier `adresses-france.csv` | Etalab 2.0 — « © Base Adresse Nationale (BAN) / IGN / Etalab » |
| Blasons (armoiries) | [Wikidata](https://www.wikidata.org) (propriété P94) puis recherche ciblée sur [Wikimedia Commons](https://commons.wikimedia.org) | Licences Commons hétérogènes — attribution dans `blason_credit` |
| Contours et formes de secours (communes, départements, régions) | [IGN Admin Express](https://geoservices.ign.fr/documentation/diffusion/telechargement-donnees-libres.html#admin-express) (WFS) | Licence Ouverte 2.0 — « © IGN » |

## Commandes

```sh
# Import complet (toutes les régions, BAN nationale téléchargée et décompressée en streaming)
docker compose --profile tools run --rm dev bun run --cwd scripts/import start

# Mode développement : Bretagne uniquement (code région 53).
# Télécharge les 4 CSV départementaux (~50 Mo), pas le fichier national.
docker compose --profile tools run --rm dev bun run --cwd scripts/import start --lite

# Ne fait rien si le référentiel est déjà complet (utilisable dans un script de démarrage)
docker compose --profile tools run --rm dev bun run --cwd scripts/import start --lite --if-empty

# API Gouv seulement (rapide, sans la BAN)
docker compose --profile tools run --rm dev bun run --cwd scripts/import start --lite --skip-ban

# Rejouer la BAN sur les communes déjà en base
docker compose --profile tools run --rm dev bun run --cwd scripts/import start --lite --skip-gouv

# CSV BAN local (gzip accepté) au lieu du téléchargement
docker compose --profile tools run --rm dev bun run --cwd scripts/import start --lite \
  --ban-file=data/adresses-france.csv.gz
```

Options : `--lite`, `--regions=53,94`, `--ban-file=<chemin>`, `--ban-url=<url>`,
`--skip-ban`, `--skip-gouv`, `--if-empty`, `--help`.

## Import des blasons et contours

Pipeline dédié (`bun run --cwd scripts/import blasons`) qui :

1. Interroge Wikidata (SPARQL) pour associer `code` ↔ fichier d'armoiries (propriété P94) pour
   les communes (`Q484170`), les départements (`Q6465`) et les régions (`Q36784`).
2. Résout licence, auteur, type MIME et page source via l'API Wikimedia Commons (par lots de 50 titres).
3. **Cascade de secours** pour les entités sans `P94` (régions et départements) : recherche
   `intitle:"<nom>" intitle:blason` sur Commons, avec un score strict qui écarte `famille`,
   `ville`, `commune`, `proposition`, `branche`, `empire` et toute entité homonyme.
   La propriété `P18` n'est **jamais** utilisée : elle renvoie des photos (tour Eiffel pour
   l'Île-de-France, vue Landsat pour la Martinique).
4. Télécharge et écrit le fichier :
   - SVG → assaini (`sanitizeSvg`) sans dépendance, écrit `{code}.svg` ;
   - tout autre format → redimensionné à **320 px de large** et converti en **WebP q80**
     (`sharp`), écrit `{code}.webp`.
5. Génère une **forme de secours** pour ce qui reste sans image : contour IGN pour les communes,
   agrégation des communes en un seul `<path>` pour les départements et régions. Il n'y a donc
   jamais de carte sans visuel.

### Arborescence

`BLASONS_DIR` (défaut `/data/blasons`) :

```text
{BLASONS_DIR}/communes/{code_insee}.svg        (ou .webp)
{BLASONS_DIR}/departements/{code}.svg          (ou .webp)
{BLASONS_DIR}/regions/{code}.svg               (ou .webp)
{BLASONS_DIR}/contours/communes/{code_insee}.svg
{BLASONS_DIR}/contours/departements/{code}.svg
{BLASONS_DIR}/contours/regions/{code}.svg
```

L'API sert ces fichiers sous `/blasons/communes/{code}.svg` (ou `.webp`), etc. Les chemins
relatifs sont stockés en base (`blason_url`, `contour_url`).

### Commande

```sh
# Import complet (communes + départements + régions)
docker compose --profile tools run --rm dev bun run --cwd scripts/import blasons

# Développement : 20 communes, contours de repli et réécriture forcée
docker compose --profile tools run --rm dev bun run --cwd scripts/import blasons \
  --only=communes --limit=20 --contours --force

# Reprise ciblée des contours manquants (ne touche jamais à blason_url, idempotent)
docker compose --profile tools run --rm dev bun run --cwd scripts/import blasons --contours-only
```

Options : `--only=communes|departements|regions`, `--limit=<n>`, `--contours`,
`--contours-only`, `--force`, `--help`.

### Attribution

Les licences Commons sont hétérogènes (CC-BY-SA, CC0, domaine public, etc.). L'attribution est
obligatoire et stockée dans `blason_credit` au format
`<licence> · <auteur> · <url de la page du fichier>` — l'URL permet de vérifier l'attribution,
ce que ne permettait pas la simple mention « Wikimedia Commons ». Les contours et formes IGN
relèvent de la Licence Ouverte 2.0 (« © IGN »).

### Pourquoi pas de vectorisation des PNG ?

Un PNG d'armoiries est converti en WebP 320 px (5 à 15 Ko), pas en SVG. Un tracé automatique
(potrace & co) sur une image matricielle produit 30 à 100 Ko de chemins approximatifs, avec des
artefacts sur les hachures et les frontières internes : plus lourd et moins fidèle qu'un WebP de
quelques kilo-octets, pour un rendu identique à la taille d'une carte (≤ 112 px). Le SVG n'est
utilisé que lorsqu'une source vectorielle existe réellement.

## Quand lancer l'import ?

Jamais au démarrage de l'API : les données persistent dans le volume PostgreSQL `pgdata`.

- `./scripts/bootstrap.sh` et `./dev.sh --fresh` lancent `--lite --if-empty` automatiquement.
- `--if-empty` sort en code 0 sans rien faire si `ref_communes` (et `ref_odonymes` quand la BAN est
  demandée) est déjà rempli ; sinon il (ré)importe.
- Le script est idempotent : il `TRUNCATE` les tables de référence avant d'insérer.
- En mode `--lite`/`--regions`, la BAN est lue via les CSV **par département** ; sans filtre de
  région, le fichier national est utilisé.

## Contraintes techniques

- **Streaming obligatoire.** Le CSV BAN (~35 M lignes) n'est jamais chargé en mémoire :
  flux `readable` → `gunzip` → `readline`. Seule une
  `Map<nom_normalise, Set<code_insee>>` reste en RAM (≈ 200 Mo pour la France entière).
- **Insertions par lots de 2 000 lignes** pour rester sous la limite de variables
  paramétrées de PostgreSQL (~65 000).
- **Idempotent.** Le script `TRUNCATE ... RESTART IDENTITY CASCADE` les tables de
  référence avant l'import.
- **Normalisation** (`src/normalize.ts`) : minuscules, accents et ligatures retirés,
  tirets/apostrophes/ponctuation remplacés par des espaces, espaces compactés.
  Le libellé original est conservé dans `nom_affichage`.
- `rarete`, `score_base`, `nb_communes` et `draw_bucket` sont calculés à l'import via
  `@hexamap/shared` (formules GDD §3.A / §3.B).

## Vérifications

```sh
docker compose --profile tools run --rm dev bun run --cwd scripts/import typecheck
docker compose --profile tools run --rm dev bun x biome check scripts/import
```
