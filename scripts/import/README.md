# Import Open Data — Hexamap

Pipeline one-shot (rejouable) qui peuple les tables de référence :
`ref_regions`, `ref_departements`, `ref_communes`, `ref_odonymes`, `commune_odonymes`.

## Sources et attribution

| Donnée | Source | Licence / attribution |
| :--- | :--- | :--- |
| Régions, départements, communes, population, centroïde | [`geo.api.gouv.fr`](https://geo.api.gouv.fr) (API Découpage administratif) | Etalab 2.0 — « © Etalab, base des codes officiels géographiques » |
| Voies et adresses (odonymes) | [Base Adresse Nationale](https://adresse.data.gouv.fr) — fichier `adresses-france.csv` | Etalab 2.0 — « © Base Adresse Nationale (BAN) / IGN / Etalab » |

Les blasons et les géométries simplifiées (Wikidata / IGN) ne sont pas importés à ce stade.

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
