---
objective: "Le Cadastre tient ses filtres (catégorie, rareté, département, recherche) dans l'URL seule, un lien profond les restaure à l'identique, le retour défait le dernier filtre, et la virtualisation de fenêtre mesure les mêmes hauteurs qu'avant."
status: pending
---

# Plan: Phase 36 — Le Cadastre filtrable

Source: `.docs/07-roadmap-v2.md` §4 « Phase 36 — Le Cadastre filtrable », brief de session
(paramètres phase 36), `.docs/01-architecture.md` §2.6/§4.5/§4.9, `apps/web/src/routes/collection.tsx`.

## Phases

| #   | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1   | Module pur d'URL + spec rouge | [`phase-1.md`](./phase-1.md) | none |
| 2   | Libellés français | [`phase-2.md`](./phase-2.md) | none |
| 3   | La salle : panneau, URL, virtualiseur | [`phase-3.md`](./phase-3.md) | 1, 2 |
| 4   | Banc E2E du Cadastre | [`phase-4.md`](./phase-4.md) | 3 |

## External sources

| URL | What it settled |
| --- | --- |
| none | — |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | `apps/web/src/routes/collection.tsx` remplace trois `useState` de filtre (`globalFilter`, `columnFilters`, `applyColumnFilter`) par une lecture unique de `Route.useSearch()`. Risque nommé : la mesure de ligne du virtualiseur. | 3 |
| regression | Deux cas de `packages/e2e/tests/atlas.spec.ts` assertent la forme exacte de l'URL d'arrivée (`?departement=E2E-D1$`, `?commune=E2E-C-…`). La normalisation de la phase les change. Réalignement assumé et expliqué (voir Décisions 4). | 4 |
| regression | **Recherche faite, aucun autre lien profond `/collection?` dans le dépôt** : `grep -r "collection\?" --include=*.ts --include=*.tsx` ne rend rien hors `atlas.spec.ts` (échappé en `\/collection\?`) et `atlas.tsx` (qui passe `search={{ departement }}` / `{{ commune }}`, jamais une chaîne). Les autres specs (`second-account`, `mobile`, `design-system`, `core-loop`, `pwa`) appellent `goto('/collection')` **sans paramètre**, donc aucune n'est affectée par le validateur. | 4 |
| architecture | Aucune. Aucune route d'API, aucune migration, aucune dépendance ajoutée. Le contrat de données est intact. | none |
| documentation | Le journal de session (`journal.md`) consigne deux frictions contrat/fixture ; `DESIGN_SYSTEM.md` n'est pas touché (aucune salle nouvelle, aucun jeton nouveau). | 4 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `.docs/01-architecture.md` §4.9 — « une ligne de liste reçoit sa hauteur de son contenu » | BUG-008 : aucune ligne virtualisée ne déclare `h-*` ni `min-h-*`. Un filtre qui rapetisse une ligne reproduit le défaut. |
| `.docs/01-architecture.md` §4.5 — TanStack Query pour l'état serveur, libellés dans `apps/web/src/content/`, routeur file-based | La salle ne fetche pas autrement, et aucun libellé n'est écrit dans le JSX. |
| `AGENTS.md` règle 9 — aucun test ignoré, aucun échec laissé derrière | La suite complète et le banc E2E sont joués, y compris les cas d'Atlas que cette phase déplace. |
| `AGENTS.md` — tout passe par Docker | `ci:check` et Playwright sont lancés dans les conteneurs, jamais sur l'hôte. |

## Decisions

| Decision | Why |
| --- | --- |
| **Deux représentations, pas une.** `CollectionFilters` (domaine : `categorie: Category[]`, `rarete: Rarity[]`, `departement: string \| null`, `q: string`) et `CollectionSearchWire` (transport : quatre clés optionnelles de chaînes). `serializeCollectionSearch` est le seul pont. | TanStack Router sérialise un tableau en **paramètre répété** (`categorie=A&categorie=B`), ce qui viole la décision 2 du brief (« listes séparées par des virgules, pas de paramètre répété »). En ne rendant au routeur que des chaînes déjà jointes, la forme de l'URL est décidée par nous, pas par le sérialiseur du routeur. L'idempotence exigée (`parse(serialize(x)) === x`) devient démontrable dans les deux sens. |
| **`validateSearch = serialize ∘ parse`.** Le validateur rend la forme de transport, donc Router réécrit l'URL normalisée à la navigation suivante ; aucun paramètre vide n'est émis (les clés absentes sont omises, jamais écrites `q=`). | Une URL normalisée est identique à la chaîne pour deux jeux équivalents ; c'est la condition du partage et du retour. |
| **Le tri est l'ordre du domaine, pas l'alphabétique** (`CATEGORY`, `RARITY` de `@hexamap/shared`). | L'ordre alphabétique ferait `COMMUNE, DEPARTEMENT, REGION, RUE` — illisible dans la barre d'adresse — et le domaine possède déjà son ordre. |
| **Le `departement` de l'Atlas (`E2E-D1`) est écarté par le validateur du contrat.** Le brief impose `^(\d{2,3}|2[AB])$` ; le référentiel E2E porte des codes synthétiques (`E2E-D1`). Conséquence assumée : le lien département → Cadastre du banc se normalise en `/collection` et affiche l'état vide filtré. Les deux cas d'Atlas sont réalignés, et le filtre département est éprouvé positivement avec un code réel (`29`) et avec la forme invalide. | Élargir la regex pour accepter `E2E-D1` contredirait une décision « déjà prise, ne la rediscute pas », et réécrire les codes du référentiel E2E sort du périmètre de la phase. Le conflit est signalé, pas masqué. |
| **`q` cherche dans `nom` OU `refCode`**, insensible à la casse et aux accents. | C'est la seule façon pour que `?commune=<code INSEE>` versé dans `q` produise un état observable : le code INSEE n'apparaît dans aucun nom de carte. Sans cela, le critère 4 ne serait démontrable qu'en constatant zéro ligne. |
| **Le filtre département est une dérivation, pas une jointure.** Une carte appartient au département `D` si `DEPARTEMENT` et `refCode === D`, ou `COMMUNE` et `refCode.startsWith(D)`. | Le code INSEE commence par le code département, y compris `2A`/`2B`. Aucune autre catégorie n'est attribuable sans référentiel côté navigateur, et aucune requête serveur nouvelle n'est autorisée. |
| **Decision 8 du brief est tenue en gardant une seule clé de requête.** Aucun filtre n'entre dans `collectionQueryKey` : entrer les filtres dans la clé déclencherait un appel réseau par case cochée, alors que `GET /api/v1/cards` n'offre aucun filtre serveur. La chaîne reste filtre → clé unique → données filtrées → `measure()` → remise à zéro conditionnelle. | Refetcher à chaque filtre serait un coût réseau et un état serveur dupliqué. Le contrat interdit une route d'API nouvelle : le filtrage est donc client, sur un jeu déjà chargé. |
| **La remise à zéro du défilement est conditionnée à un changement de longueur**, comparée à la longueur précédente dans un `useRef`. | Critère 3 : « le défilement ne saute pas au-delà du nécessaire ». Un filtre qui garde la même longueur ne doit pas déplacer la vue. |
| **`?commune=` reste dans le schéma validé le temps d'un `replace`.** | Sans lui dans le schéma, le validateur l'efface avant que le composant puisse lire sa valeur : l'information serait perdue, pas consommée. Il est ensuite retiré par une navigation `replace: true`. |
