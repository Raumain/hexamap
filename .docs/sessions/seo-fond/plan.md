# Plan — phase 54, Le fond SEO

Retour : **I-005** (`.docs/09-idees.md`), **sans** son volet rendu serveur.
Base : `feat/v2-idees-wave-2`. Branche : `feat/v2-54-seo-fond`. Migration : aucune.

## Ce que la phase livre

Quatre fondations mesurables, et rien de plus :

1. **`robots.txt`** et **`sitemap.xml`** servis par l'API (`apps/api/src/routes/seo.ts`),
   construits depuis le contenu public réel, sur `PUBLIC_ORIGIN`.
2. **`PUBLIC_ORIGIN`** dans `apps/api/src/env.ts` + `.env.example` (optionnelle, défaut
   `http://localhost:${WEB_HOST_PORT:-8080}`).
3. **Aides pures `apps/web/src/lib/seo.ts`** — `publicHead()` / `noindexHead()` — puis
   `head()` sur les routes : titre et description propres aux salles **publiques**,
   `noindex, nofollow` sur **toutes** les salles derrière session.
4. **JSON-LD `Organization` + `WebSite`** statique dans `apps/web/index.html`.

## Ce que la phase ne livre pas (et pourquoi)

- **Prérendu / SSR.** Il demande une seconde chaîne de rendu, doit rester compatible avec
  `registerType: 'prompt'`, `skipWaiting: false` et `navigateFallback: '/index.html'`
  (§4.10). L'implémenter à moitié produirait soit un worker qui masque un déploiement,
  soit un second shell divergent. Consigné comme idée dans `review.md`.
- **Open Graph / Twitter Card / image de partage.** Hors périmètre v2, et I-005 le dit
  explicitement (§ « Points de vigilance »). `title`/`description`/`canonical` ne sont pas
  de l'Open Graph.
- **`BreadcrumbList`.** Aucune page publique profonde n'existe encore (`/players/:id` est
  le seul niveau 2 et il n'a pas d'ancêtre navigable). Une hiérarchie inventée serait pire
  qu'absente. Consigné.
- **`SearchAction`.** Aucune recherche publique d'URL adressable (le Cadastre est derrière
  session). Consigné.
- **Redirection `www`/IP.** C'est une décision d'exploitation (bordure HTTP), pas du code
  applicatif ; `.env.example` porte `PUBLIC_ORIGIN`, la bordure redirige.

## Décisions techniques

### D1 — `PUBLIC_ORIGIN` : une seule origine, lue une seule fois

`z.url()` optionnelle, `.transform((v) => new URL(v).origin)` (normalise : pas de slash
final, pas de chemin). Défaut calculé **dans `env.ts`** à partir de `WEB_HOST_PORT`, pour
qu'il n'y ait qu'un propriétaire. `seo.ts` ne lit que `env.PUBLIC_ORIGIN` ; aucune route
ne recompose une origine.

### D2 — Deux routes Elysia, montées avant `blasonRoutes` et `webRoutes`

`static.ts` refuse toute extension hors liste blanche (`xml` n'y est pas) et n'aurait donc
servi ni `/sitemap.xml` ni un fichier déposé dans `WEB_DIST_DIR` — un fichier statique
serait de toute façon faux dès la première nouvelle vitrine et écrasé au build. Les deux
routes vivent dans `apps/api/src/routes/seo.ts`, montées sur `base` **avant**
`blasonRoutes`, donc présentes même quand `SERVE_WEB` est faux (le banc E2E tape le proxy,
la spécification tape `app.handle`).

`Cache-Control: public, max-age=3600` sur les deux. Types explicites :
`text/plain; charset=utf-8` et `application/xml; charset=utf-8`.

### D3 — Le sitemap ne lit que du public

- Routes fixes : `/`, `/rarete`, `/mentions-legales`, `/confidentialite`.
- Vitrines : `user_profiles.profile_public = true` **joint** à `"user".pseudo` non nul.
  Une seule requête, bornée (`limit 5000`), triée par `updated_at desc` pour que la borne
  soit déterministe. `lastmod` = `user_profiles.updated_at` en `YYYY-MM-DD` (W3C accepte la
  date seule).
- **Aucune** colonne hors de : `user.id`, `user.pseudo`, `user_profiles.updated_at`,
  `user_profiles.profile_public`. Ni courriel, ni solde, ni `grid`, ni `treasure_index`.
- Une erreur de la base ne casse pas la route : le sitemap se dégrade aux routes fixes
  (une vitrine manquante n'est pas un `500`, et un sitemap partiel reste valide).

### D4 — Origine de la canonique côté navigateur

`window.location.origin`, lu **au rendu** dans `apps/web/src/lib/seo.ts`, avec repli sur la
chaîne vide si `window` est absent (aucun SSR aujourd'hui ; le garde évite seulement une
exception le jour où il arrive). Aucune URL absolue en dur, aucune constante de build à
maintenir en double de `PUBLIC_ORIGIN`. C'est le choix le plus simple : le routeur est
purement client, `head()` s'exécute dans le navigateur, et la canonique désigne donc
toujours l'origine réellement servie.

Conséquence assumée, écrite dans la PR : l'API et le navigateur ne partagent pas la valeur,
mais partagent la **règle** (origine servie). Le jour où le prérendu arrive, la canonique
devra venir de `PUBLIC_ORIGIN` — c'est noté dans l'idée de revue.

### D5 — Quelles routes sont publiques

| Route | Titre | robots |
| :--- | :--- | :--- |
| `/login`, `/register` (Le Seuil) | « Se connecter — Hexamap » / « Créer un compte — Hexamap » | `index` |
| `/rarete` | déjà livré par la phase 53 — **non touché** | `index` |
| `/mentions-legales` | « Mentions légales — Hexamap » | `index` |
| `/confidentialite` | « Politique de confidentialité — Hexamap » | `index` |
| `/players/:id` | « La collection de <pseudo> — Hexamap » | `index` |
| `/` | « Hexamap — Cabinet de cartographie » | `noindex` (salle de jeu, session) |
| `/collection`, `/tableau`, `/tableaux`, `/market`, `/market/mine`, `/friends`, `/guichet`, `/achievements`, `/atlas`, `/palmares`, `/boutique`, `/boutique/succes`, `/compte`, `/card/:id`, `/tickets/:id`, `/assemblage` | titre de salle | `noindex, nofollow` |

Le brief liste « Le Relevé » parmi les salles `noindex` et demande `index` sur « Le Seuil » :
`/` est Le Relevé, `/login` et `/register` sont Le Seuil. La canonique de `/` est donc
posée **avec** `noindex` — les deux ne s'excluent pas, et le critère 3 (« la canonique de
`/` est absolue et unique ») est tenu sans indexer une salle de jeu.

`/players/:id` : le titre nomme le **pseudo** ; il ne porte ni courriel, ni solde, ni
compteur de cartes. Une vitrine privée répond `404` côté API, donc la route web n'a rien à
masquer de plus — elle ne peut pas obtenir les données.

### D6 — `noindex` par défaut, `index` par exception

`__root.tsx` ne pose **rien** (le shell statique reste le repli). Chaque route de salle
déclare `head: noindexHead`. C'est explicite à chaque site plutôt qu'un héritage : un
`noindex` par défaut dans la racine serait plus sûr mais `head()` de la racine est fusionné
avec celui des enfants, et TanStack Router **remplace** les `meta` de même `name` — un
enfant qui veut `index` devrait donc réécrire, ce qui est exactement ce que font les routes
publiques. Le choix retenu (déclaration par route) rend chaque salle lisible d'un coup
d'œil et évite de dépendre de l'ordre de fusion. Les routes publiques posent `index`
explicitement, donc une future route oubliée ne peut pas hériter d'un `index` par accident
— elle n'aura simplement pas de `meta robots`, ce que la revue signale.

## Fichiers touchés

| Fichier | Nature |
| :--- | :--- |
| `apps/api/src/routes/seo.ts` | **neuf** — `robots.txt`, `sitemap.xml` |
| `apps/api/src/app.ts` | montage de `seoRoutes` avant `blasonRoutes` |
| `apps/api/src/env.ts` | `PUBLIC_ORIGIN` |
| `.env.example` | `PUBLIC_ORIGIN` commentée |
| `apps/web/src/lib/seo.ts` | **neuf** — `publicHead`, `noindexHead`, `cardTitle` |
| `apps/web/index.html` | JSON-LD `Organization` + `WebSite` |
| `apps/web/src/routes/login.tsx`, `register.tsx`, `mentions-legales.tsx`, `confidentialite.tsx`, `players.$playerId.tsx`, `index.tsx` | `head` public / canonique |
| `apps/web/src/routes/{collection,tableau,tableaux,market.index,market.mine,friends,guichet,achievements,atlas,palmares,boutique.index,boutique.succes,compte,card.$cardId,tickets.$ticketId,assemblage}.tsx` | `head` noindex |
| `packages/spec/src/seo.spec.ts` | **neuf** |
| `packages/e2e/tests/seo.spec.ts` | **neuf** |

**Non touchés** : `apps/web/src/routes/rarete.tsx` (phase 53), `packages/db`,
`scripts/import`, `components/layout/`, `apps/web/public/{robots.txt,sitemap.xml}`.

## Ordre des étapes

1. **Spec d'abord** — `packages/spec/src/seo.spec.ts` :
   - `robots.txt` : `200`, `text/plain`, `Sitemap:` absolu sur `PUBLIC_ORIGIN`.
   - `sitemap.xml` : `200`, `application/xml`, contient `<loc>{origine}/</loc>`, contient
     une vitrine publique semée, **ne contient pas** la vitrine privée semée, **aucune**
     `loc` sous `/api/`.
   - Le sitemap reste valide quand la table des profils est vide (dégradation).
   **Vu rouge** avant d'écrire `seo.ts`.
2. `apps/api/src/env.ts` (`PUBLIC_ORIGIN`) → `apps/api/src/routes/seo.ts` → `app.ts`.
   Rejouer la spec : verte.
3. `apps/web/src/lib/seo.ts` + `head` sur toutes les routes listées ci-dessus.
   `bun run --cwd apps/web typecheck` régénère `routeTree.gen.ts` (jamais édité à la main).
4. `apps/web/index.html` : JSON-LD statique ; vérifié par un cas de spec qui lit le fichier
   et parse le JSON (`@context`, `@type`, `name`).
5. `packages/e2e/tests/seo.spec.ts` :
   - deux salles publiques (`/login` et `/rarete`) ont des `document.title` différents ;
   - `/` porte un `link[rel=canonical]` absolu ;
   - `/collection` porte `meta[name=robots]` contenant `noindex`.
6. `ci:check` puis banc E2E complet ; `curl` sur la pile de dev ; captures du `<head>`.

## Vérification de chaque critère

| Critère | Preuve |
| :--- | :--- |
| 1 `robots.txt` | `seo.spec.ts` + `curl -i` |
| 2 `sitemap.xml` | `seo.spec.ts` (publique présente, privée absente, aucune `/api/`) + `curl` |
| 3 titres distincts + canonique | `packages/e2e/tests/seo.spec.ts` |
| 4 `noindex` sur `/collection` | `packages/e2e/tests/seo.spec.ts` |
| 5 JSON-LD valide | cas de spec qui parse `apps/web/index.html` |
| 6 aucune URL absolue en dur | relecture + `grep -rn 'https://hexamap'` |
| 7 aucune migration | `git diff --stat` sur `packages/db` |
| 8 `ci:check` + 2 cas E2E | sortie collée dans la PR |

## Risques identifiés

- **Ordre de montage Elysia.** `/sitemap.xml` doit gagner sur `/*`. Vérifié par la spec ;
  si le routeur préfère le joker, le révèle immédiatement (404 JSON au lieu de XML).
- **Fusion des `meta` par TanStack Router.** Les `meta` de même `name` sont remplacées par
  l'enfant ; chaque route déclare donc son `robots` complètement, jamais partiellement.
- **`head()` et données de route.** Le titre d'une vitrine dépend de données chargées : le
  `loader` doit exposer le pseudo, sinon `head()` lit un état vide au premier rendu. Le cas
  E2E sur la vitrine est hors périmètre (`/login` et `/rarete` suffisent au critère 3) ;
  si le `loader` ne peut pas fournir le pseudo proprement, le titre reste « La Vitrine —
  Hexamap » et c'est écrit dans la revue plutôt que deviné.
