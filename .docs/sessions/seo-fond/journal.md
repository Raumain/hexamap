# Journal — phase 54, Le fond SEO

> Branche `feat/v2-54-seo-fond`, base `feat/v2-idees-wave-2`, migration :
> aucune.

## 2026-11-25 — Ouverture

Retour traité : **I-005** de `.docs/09-idees.md` (« SEO au fond : exister sur
« Hexamap » »), **sans son volet rendu serveur** (prérendu/SSR), qui reste hors
périmètre et est consigné comme idée dans `review.md`.

### État constaté avant d'écrire

- Aucune route web ne pose de `head()` : le shell `apps/web/public/index.html`
  porte un `<title>` et une `meta[name=description]` uniques pour tout le site
  (vérifié par recherche sur `apps/web/src/routes/`).
- `apps/api/src/static.ts` ne sert que les extensions de sa liste blanche :
  `xml` n'y figure pas, donc `sitemap.xml` ne peut pas venir d'un fichier de
  `WEB_DIST_DIR` — il doit être une route.
- `packages/spec/src/static.spec.ts` fournit le patron de test (`createApp`
  construit une fois, `app.handle(new Request(...))`).
- `.docs/10-retours-v2.md` ne porte pas d'entrée I-005 : l'idée est dans
  `.docs/09-idees.md`, que le brief nomme comme source du retour.

### Deux constats qui ont changé l'implémentation

1. **`rarete.tsx` n'a pas de `head`.** Le brief interdit de le toucher en
   affirmant que « son titre est déjà posé » : c'est faux, le fichier ne porte
   que `component`. La consigne est respectée à la lettre (le fichier n'est pas
   modifié), et son titre vient de la table de `lib/seo.ts` — donc sans conflit
   avec la phase 53.
2. **Aucune route ne monte `<HeadContent />`.** `apps/web/src/main.tsx` ne rend
   que `RouterProvider` ; une option `head` de TanStack Router n'aurait donc
   aucun effet. En monter une ferait hoister un second `<title>` à côté du repli
   statique qu'`index.html` doit conserver, et `document.title` lit le premier
   `<title>` : le repli l'emporterait. Les métadonnées sont donc appliquées une
   fois, dans `document.head`, depuis la table de `lib/seo.ts`.

### Spec d'abord

`packages/spec/src/seo.spec.ts` écrite avant `routes/seo.ts`, vue **rouge** au
typecheck (`Cannot find module '@hexamap/api/env'` — le sous-chemin n'était pas
exporté), puis verte avec 6 cas. La spec lit une base réelle : deux comptes, une
vitrine publique, une privée.

### Le volume E2E est global, et cela a cassé le banc

Premier `up` du banc : l'API sort en code 1, `corrupted migrations: previously
executed migration 0022_postal_code is missing`. La cause n'est pas le diff : le
volume nommé `hexamap_e2e_pgdata` (`docker-compose.e2e.yml`) est **commun à
toutes les phases**, et une session parallèle y a appliqué `0022_postal_code`,
absente de mon arbre. Le banc n'est donc pas isolé par worktree.

Plutôt que de détruire ce volume sous une autre session, le banc est lancé sous
un nom de projet dédié avec une surcharge qui renomme le volume
(`hexamap_e2e_pgdata_54`, fichier hors dépôt). **À corriger dans l'outillage** :
le nom du volume devrait être dérivé du projet (`${COMPOSE_PROJECT_NAME}`).

### Le défaut que seule la route servie a montré

Premier passage du banc vert (130 cas), mais `wget http://api:3000/sitemap.xml`
dans l'image de production ne rendait **que** les quatre pages fixes : la
requête faisait une jointure **interne** sur `user_profiles`, donc tout compte
n'ayant jamais ouvert l'écran de réglages — la quasi-totalité — était exclu,
alors que §2.9 pose la vitrine publique par défaut et que `loadPlayerProfile`
traite une ligne absente comme publique. Le `ci:check` était vert, la spec
aussi : elle semait une ligne `user_profiles` pour chaque compte et encodait
donc l'implémentation au lieu du contrat.

Corrigé par une jointure externe et le filtre `profile_public is not false`,
avec un troisième compte de spec **sans** ligne de réglages — le cas nominal.
Deux erreurs de typage découvertes au passage : `eb.or` sur un `is null` et
`orderBy(..., 'desc nulls last')` ne passent pas le typecheck de Kysely de ce
dépôt ; le tri reste total avec `updated_at desc, id asc`.

Le cas « toutes les vitrines fermées » asserte désormais sur **mes** trois
identifiants : la base de test est partagée par les fichiers de spec exécutés en
parallèle, donc une assertion d'absence globale y est fausse par construction.
