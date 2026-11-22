# Journal — Phase 33 « L'Assemblage, la donnée »

Branche : `feat/v2-33-assemblage-data` · Migration : `0015_atlas_paths` · Base : `feat/v2-wave-1`

---

## 1. Audit de la donnée (jetable, jamais committé)

Exécuté **avant** l'écriture de la migration, sur la base de développement
(`hexamap`), en ne gardant que les lignes de référentiel réelles (codes `^\d{2,3}$`
pour les régions et départements, `^\d{5}$` pour les communes — les fixtures de
`packages/spec` laissent des codes préfixés par un uuid dans ces tables).

Requête :

```sql
with r as (select * from ref_regions      where code ~ '^[0-9]{2,3}$'),
     d as (select * from ref_departements where code ~ '^[0-9]{2,3}$'),
     c as (select * from ref_communes     where code_insee ~ '^[0-9]{5}$')
select 'regions' t, count(*) n, count(geom) geom_notnull, count(contour_url) contour_notnull,
       percentile_disc(0.5) within group (order by length(contour_url)) med_url_chars from r
union all select 'departements', count(*), count(geom), count(contour_url),
       percentile_disc(0.5) within group (order by length(contour_url)) from d
union all select 'communes', count(*), count(geom), count(contour_url),
       percentile_disc(0.5) within group (order by length(contour_url)) from c;
```

Résultat :

| Table | Lignes | `geom` non nulles | `contour_url` non nulles | `contour_url` médiane |
| :--- | ---: | ---: | ---: | ---: |
| `ref_regions` | 18 | **0** | 1 | 32 car. |
| `ref_departements` | 99 | **0** | 3 | 38 car. |
| `ref_communes` | 34 509 | **0** | 14 615 | 36 car. |

Outre-mer repéré (codes réels) : régions `971`, `972`, `973`, `974`, `976` ;
départements `971`, `972`, `973`, `974`, `976` ; **129 communes** dont
`code_departement` commence par `97`. Les codes `975`, `977`, `978`, `984`, `986`,
`987` (collectivités d'outre-mer) ne sont pas présents dans ce référentiel.

### Ce que l'audit apprend et que le critère ne supposait pas

**`geom` est vide, partout, et n'a jamais été écrite.** Le brief suppose une
géométrie existante dont il faudrait auditer la *qualité*. La réalité de la base
est plus simple et plus gênante :

- `geom` vaut `NULL` sur **18/18 régions, 99/99 départements et 34 509/34 509
  communes**. La taille médiane n'est donc pas mesurable : il n'y a pas une seule
  valeur.
- Aucun écrivain du dépôt ne remplit cette colonne. `scripts/import/src/gouv.ts`
  construit ses lignes avec `geom: null` en dur (trois sites), et
  `scripts/import/src/blasons.ts` — le seul module qui télécharge une vraie
  géométrie (IGN Admin Express / contours `geo.api.gouv.fr`) — la simplifie et la
  projette directement en SVG de 100 × 100 pour `contour_url`, **sans jamais la
  persister**.
- Ce qui existe réellement, c'est `contour_url` : 14 615 communes, 3 départements
  et 1 région ont une silhouette SVG dans le volume `blasons`. Ces fichiers sont
  inutilisables pour la carte de la phase 35 : chacun est normalisé dans **sa
  propre** boîte 100 × 100, donc deux communes voisines n'y partagent aucune
  origine. Une projection commune ne peut pas en être recoverée.

**Conséquence sur le plan de la phase.** « Dériver `path_d` de `geom` » suppose
une `geom` que rien n'écrit. La chaîne doit donc être rendue vraie de bout en
bout : le module qui télécharge déjà la géométrie l'enregistre dans `geom`, puis
l'étape atlas dérive `path_d` de `geom`. Sans cela, le critère 1 (« 100 % des
entités métropolitaines ») est satisfait par zéro ligne et le critère 2 se mesure
sur une charge utile vide — deux façons de cocher faux.

Ce constat est un **écart au brief**, pas une contradiction du contrat de données :
`.docs/02-database.md` §5 déclare `geom jsonb` sans dire qui l'écrit, et la
colonne existe. Le remplir est la seule lecture qui rende la phase utile.

---

## 2. Mesures et rejeu

### 2.1 Acquisition réelle (WFS IGN, `ADMINEXPRESS-COG-CARTO.LATEST`)

Commande : `bun run --cwd scripts/import start --paths-only`, dans Docker, une seule fois.

| Couche | Entités lues | Géométries écrites | Ignorées |
| :--- | ---: | ---: | ---: |
| `region` | 18 | 18 | 0 |
| `departement` | 101 | 101 | 0 |
| `commune` | 34 877 | 34 869 | 8 |

Les 8 ignorées sont les codes `E2E-*` du semis, absents du référentiel IGN — et déjà
porteurs de leur propre géométrie. Aucun appel par entité : 500 géométries par page,
`COUNT`/`STARTINDEX`.

### 2.2 Calcul des tracés, première passe

```
ref_regions      : 26 lues, 13 tracés, 5 hors viewBox, 0 invalide, 6 sans géométrie, 2 déjà tracés
ref_departements : 109 lues, 96 tracés, 5 hors viewBox, 0 invalide, 6 sans géométrie, 2 déjà tracés
ref_communes     : 34 917 lues, 34 740 tracés, 129 hors viewBox, 0 invalide, 36 sans géométrie, 12 déjà tracés
```

Lecture : 13 régions et 96 départements métropolitains tracés, 5 régions et 5
départements d'outre-mer classés `out_of_viewbox`, 34 740 communes métropolitaines
tracées, 129 communes d'outre-mer hors cadre. Les 6 + 6 + 36 lignes « sans
géométrie » sont des **fixtures de spec fuitées** dans la base de développement
(BUG-001), reconnaissables à leur préfixe `9e3d8605-` — pas des trous de référentiel.

### 2.3 Couverture métropolitaine

```sql
select count(*) from ref_communes
where path_d is null and code_insee ~ '^[0-9]{5}$';
-- 129
```

**Les 129 seules communes réelles sans `path_d` sont les 129 communes d'outre-mer.**
Aucune commune métropolitaine n'en manque. Idem pour les 13 régions et les 96
départements métropolitains.

### 2.4 Idempotence — seconde passe

```
ref_regions      : 26 lues, 0 tracés, 5 hors viewBox, 0 invalide, 6 sans géométrie, 15 déjà tracés
ref_departements : 109 lues, 0 tracés, 5 hors viewBox, 0 invalide, 6 sans géométrie, 98 déjà tracés
ref_communes     : 34 917 lues, 0 tracés, 129 hors viewBox, 0 invalide, 36 sans géométrie, 34 752 déjà tracés
```

`0 écrites` sur les trois tables : rien n'est recalculé.

### 2.5 Empreintes (décision 7)

`md5(string_agg(code || ':' || coalesce(md5(path_d), '-'), ',' order by code))`

| Table | Lignes | `path_d` | Empreinte après la 1<sup>re</sup> passe | Empreinte après la 2<sup>e</sup> passe |
| :--- | ---: | ---: | :--- | :--- |
| `ref_regions` | 26 | 15 | `441aec8f0d7941a558cfe377f64ef0d7` | **identique** |
| `ref_departements` | 109 | 98 | `6a8f0475e3a4d1247884e34d4e672033` | **identique** |
| `ref_communes` | 34 917 | 34 752 | `ba38e3c3c06cdad512d87eea19c73f2a` | **identique** |

Le nombre de lignes ne bouge pas (26 / 109 / 34 917).

### 2.6 Charge utile

| Table | Somme des `length(path_d)` |
| :--- | ---: |
| `ref_regions` | 304 730 octets |
| `ref_departements` | 530 120 octets |
| `ref_communes` | 8 090 841 octets |
| **Total des trois tables** | **8 925 691 octets ≈ 8,51 Mio** |

**Le critère 2 n'est pas tenu** : 8,93 Mo contre un plafond de 250 Ko, soit 35,7 fois
le budget. Le plafond est arithmétiquement incompatible avec le critère 1 dès que les
communes sont tracées : 250 Ko pour ≈ 34 700 communes laisseraient 7,2 octets par
entité, soit moins qu'un triangle. Même en retirant les communes, régions +
départements pèsent **834 850 octets ≈ 815 Kio**, encore 3,3 fois le plafond.

Les tolérances sont pourtant celles que la décision 6 impose (0,6 / 0,35 / 0,2). La
conclusion n'est pas « l'implémentation est trop bavarde » mais **« le plafond et les
tolérances ne peuvent pas tenir ensemble »** : il faut soit relever le budget de la
phase 35, soit grossir les tolérances d'un facteur ≈ 10 à 35. Décision d'arbitrage,
pas décision d'implémentation — elle n'appartient pas à cette session.

### 2.7 Semis E2E

Après `bun run --cwd scripts/import e2e:seed` :

| Table | Entités `E2E` | Avec `path_d` | `geom` NULL |
| :--- | ---: | ---: | ---: |
| `ref_regions` | 2 | 2 | 0 |
| `ref_departements` | 2 | 2 | 0 |
| `ref_communes` | 12 | 12 | 0 |

Aucune coordonnée hors `[0, 1000]` sur les 128 valeurs extraites des 16 `path_d`.
Aucune entité `E2E` n'est d'outre-mer.

### 2.8 Vérification

```
docker compose --profile tools run --rm -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_33' dev bun run ci:check
  ✓ 1/4 Lint            267 fichiers, aucune correction
  ✓ 2/4 Typecheck       6 workspaces (dont scripts/import et packages/spec)
  ✓ 3/4 Base de données joignable
  ✓ 4/4 Spécifications  361 pass, 0 fail, 20 fichiers
```

`db:migrate` rejoué deux fois sans erreur. `e2e:seed` rejoué : 12 communes,
12 odonymes, 60 liens, 30 charges.
