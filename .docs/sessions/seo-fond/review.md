# Revue — phase 54, Le fond SEO

Relecture hostile du diff de `feat/v2-54-seo-fond` contre `feat/v2-idees-wave-2`.
Verdict : **prêt à livrer**, avec les écarts et les idées listés plus bas. Aucun
défaut *deal-breaker* n'a été trouvé.

## Ce qui est livré, et où le lire

| Livrable | Fichier |
| :--- | :--- |
| `GET /robots.txt`, `GET /sitemap.xml` | `apps/api/src/routes/seo.ts` |
| Montage avant blasons et SPA | `apps/api/src/app.ts` (`seoRoutes()` avant `blasonRoutes`) |
| `PUBLIC_ORIGIN` | `apps/api/src/env.ts`, `.env.example` |
| Table des métadonnées, canonique, `noindex` | `apps/web/src/lib/seo.ts` |
| Application au `document.head` | `apps/web/src/components/seo-head.tsx`, `apps/web/src/routes/__root.tsx` |
| Titre nominatif de la vitrine | `apps/web/src/routes/players.$playerId.tsx` |
| JSON-LD `Organization` + `WebSite` | `apps/web/index.html` |
| Spécifications | `packages/spec/src/seo.spec.ts` (6 cas) |
| Banc navigateur | `packages/e2e/tests/seo.spec.ts` (5 cas) + `PUBLIC_ORIGIN` dans `docker-compose.e2e.yml` |

## Défauts trouvés, et leur état

### Deal-breaker trouvé par le banc, corrigé

**Le sitemap de production ne listait aucune vitrine.** La requête faisait une
jointure **interne** sur `user_profiles`, alors que §2.9 pose « la vitrine est
publique par défaut » : la règle de `loadPlayerProfile` est
`profileRow?.profile_public === false`, donc une ligne **absente** vaut public —
et la quasi-totalité des joueurs n'ouvre jamais l'écran de réglages. La
spécification ne l'a pas vu parce qu'elle semait une ligne pour chaque compte :
elle encodait l'implémentation au lieu du contrat.

Le défaut n'a été visible qu'en interrogeant le déploiement réel
(`wget http://api:3000/sitemap.xml` dans l'image de production du banc), où le
document ne contenait que les quatre pages fixes. Corrigé par une jointure
externe et un filtre `profile_public is null or profile_public = true`, plus un
troisième compte de spec **sans ligne de réglages** — le cas nominal, désormais
asserté présent. Le tri est passé à
`updated_at desc nulls last, user.id asc` : total, donc la borne de 5 000 garde
toujours le même sous-ensemble.

C'est exactement ce que la règle 10 paie : le contrôle compilait, la spec était
verte, et la seule chose qui a parlé est la route servie.

### Suggestions restantes

Trois `suggestion`, de gravité moyenne :

1. **`/` figure au sitemap alors qu'il porte `noindex`** (gravité moyenne).
   Le brief demande les deux explicitement : décision 6 liste `/` dans le
   sitemap, décision 7 met Le Relevé en `noindex`. Les deux sont implémentés
   tels quels, mais un moteur qui reçoit l'URL puis lit `noindex` la rejette :
   l'entrée ne sert à rien et signale un plan mal tenu. **Recommandation** :
   trancher dans une phase ultérieure — soit retirer `/` du sitemap (le jeu est
   derrière session), soit l'indexer comme page d'accueil publique. Non tranché
   ici parce que ce serait changer une décision du contrat en silence.
2. **`/home` est indexable mais absent du sitemap** (gravité moyenne).
   `/home` est la seule page de marque réellement publique et rédigée : elle
   porte un titre et une description propres, et `index, follow`. Le brief
   énumère les pages fixes du sitemap sans elle, donc elle n'y est pas. C'est un
   oubli probable du contrat, pas du code. **Recommandation** : l'ajouter, avec
   `/login` et `/register` si l'exploitant les veut indexées.
3. **`PUBLIC_ORIGIN` non déclarée en production retombe sur
   `http://localhost:8080`** (gravité moyenne). Le brief impose ce défaut
   documenté ; le risque est un déploiement qui publie silencieusement une
   origine fausse dans son sitemap. **Recommandation** : un avertissement au
   démarrage quand `NODE_ENV=production` et que la variable est absente, comme
   `FRONTEND_URL` est déjà obligatoire. Non fait ici : le contrat dit
   « optionnelle ».

`correct` vérifiés, pour mémoire : aucune URL absolue en dur (`grep` sur
`apps/web/src` : zéro ; côté API, seul le défaut documenté de `env.ts`) ; aucune
vitrine privée ni URL `/api/` au sitemap (asserté) ; aucune table, colonne ni
migration ; `rarete.tsx` non modifié ; `packages/db`, `scripts/import` et
`components/layout/` intacts.

## Écarts assumés

1. **Pas d'option `head()` de TanStack Router — une table et un applicateur.**
   Le brief la prescrivait. Deux faits l'ont écartée : aucune route ne monte
   `<HeadContent />` (`apps/web/src/main.tsx` ne rend que `RouterProvider`), donc
   `head()` n'aurait aucun effet ; et en monter un ferait hoister un second
   `<title>` à côté de celui d'`index.html`, que le brief **exige** comme repli —
   `document.title` lit le premier `<title>` du document, donc le repli
   l'emporterait sur le titre de la page. L'application se fait donc une fois,
   explicitement, contre `document.head`. Le résultat observable est celui du
   contrat (titres distincts, canonique absolue, `noindex`) et il est vérifié
   dans un navigateur. Bénéfice second : zéro modification dans les seize routes
   de salle, donc zéro conflit avec les sessions parallèles.
2. **`rarete.tsx` n'a en réalité aucun `head`.** Le brief interdit de le toucher
   en affirmant que « son titre est déjà posé » : le fichier ne porte que
   `component`. La consigne est respectée (fichier intact) et son titre vient de
   la table, d'où « Les raretés — Hexamap ». Aucune contradiction de contrat,
   seulement une phrase de brief inexacte — signalée, pas corrigée en silence.
3. **Le JSON-LD n'a ni `url` ni `@id`.** Un fichier statique ne connaît pas
   l'origine canonique, et en inventer une est explicitement interdit. Le graphe
   porte donc `@context`, `@type`, `name`, `inLanguage` et `description` — ce que
   le critère 5 demande — et rejoindra l'origine le jour où le prérendu la
   connaîtra côté serveur.
4. **`robots.txt` ne liste pas les salles privées en `Disallow`.** Un moteur qui
   ne peut pas lire une page ne peut pas lire son `noindex` : l'écarter du
   `robots.txt` la rendrait indexable par ses liens entrants. Le refus est porté
   par la balise `robots`, et seules les ressources non paginables
   (`/api/`, `/blasons/`) sont écartées du plan.
5. **La canonique vient de `window.location.origin`, pas d'une constante de
   build.** Choix le plus simple et le seul sans double maintenance de
   `PUBLIC_ORIGIN`. Conséquence écrite : le jour où le prérendu arrive, la
   canonique devra venir de `PUBLIC_ORIGIN` — c'est exactement l'idée ci-dessous.

## Idées ouvertes (hors périmètre, non implémentées)

- **Prérendu des pages publiques.** Il demande une seconde chaîne de rendu, et
  doit rester compatible avec `registerType: 'prompt'`, `skipWaiting: false` et
  `navigateFallback: '/index.html'` (§4.10). Implémenté à moitié, il produirait
  soit un worker qui masque un déploiement, soit un shell divergent du statique.
  C'est la seule voie qui rende `/players/:id` réellement indexable : aujourd'hui
  la page redirige un visiteur anonyme vers `/login`, donc son HTML utile
  n'existe qu'après session. **À planifier comme une phase**, pas comme une
  retouche.
- **`BreadcrumbList`.** Aucune page publique profonde n'existe : `/players/:id`
  est le seul niveau 2 et n'a pas d'ancêtre navigable. Une hiérarchie inventée
  serait pire qu'absente.
- **`SearchAction`.** Aucune recherche publique d'URL adressable : les filtres du
  Cadastre sont derrière session.
- **Redirection `www` / IP vers l'origine canonique.** Décision d'exploitation
  (bordure HTTP), pas de code applicatif. `PUBLIC_ORIGIN` lui donne sa cible.
- **Index de sitemaps au-delà de 5 000 vitrines.** Borne assumée et écrite dans
  `routes/seo.ts`.
- **Open Graph, Twitter Card, image de partage.** Hors périmètre v2, hors
  périmètre de cette phase ; `title`/`description`/`canonical` n'en sont pas.

## Preuves

### `ci:check` (Docker, base `hexamap_test_54`)

```
[hexamap] ✓ 1/5 Lint
[hexamap] ✓ 2/5 Typecheck
[hexamap] ✓ 3/5 Base de données
 578 pass
 0 fail
 3353 expect() calls
Ran 578 tests across 32 files.
[hexamap] ✓ 4/5 Spécifications
[hexamap] ✓ 5/5 Mesure de charge   (p95 du résumé d'Atlas = 23,3 ms)
```

### Banc E2E complet (image de production, HTTPS `hexamap.test`)

`130 passed (3.4m)` — chromium, pwa, Pixel 7, iPhone 13. Les six cas SEO en
détail :

```
✓ I-005 — deux salles publiques portent des titres différents
✓ I-005 — la racine porte une canonique absolue et unique
✓ I-005 — une salle derrière session porte noindex
✓ I-005 — la table des métadonnées ne fige aucune origine
✓ I-005 — le sitemap est servi par l’API de production, sur l’origine publique
✓ I-005 — index.html porte le JSON-LD de la marque
6 passed (28.1s)
```

### Sorties HTTP de l'image de production

```text
$ wget -S -qO- http://api:3000/robots.txt
  HTTP/1.1 200 OK
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=3600
  Content-Length: 168

User-agent: *
Allow: /

# Ressources de l’API et images de blasons : jamais des pages.
Disallow: /api/
Disallow: /blasons/

Sitemap: https://hexamap.test/sitemap.xml
```

```text
$ wget -S -qO- http://api:3000/sitemap.xml
  HTTP/1.1 200 OK
  Content-Type: application/xml; charset=utf-8
  Cache-Control: public, max-age=3600
  Content-Length: 1255

<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://hexamap.test/</loc></url>
  <url><loc>https://hexamap.test/rarete</loc></url>
  <url><loc>https://hexamap.test/mentions-legales</loc></url>
  <url><loc>https://hexamap.test/confidentialite</loc></url>
  <url><loc>https://hexamap.test/players/2WlTLeKIIs6mDZigAVeatr3L8KpTqdaV</loc></url>
  … 11 vitrines publiques, aucune vitrine privée, aucune URL /api/ …
</urlset>
```

### `<head>` d'une route publique (asserté par le banc)

```html
<title>Les raretés — Hexamap</title>
<meta name="description" content="Les six paliers de rareté d’Hexamap, leurs poids de tirage, et les formules de score des communes et des rues.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://hexamap.test/rarete">
```

```html
<!-- /collection : salle derrière session -->
<title>Le Cadastre — Hexamap</title>
<meta name="robots" content="noindex, nofollow">
<!-- aucune link[rel=canonical] -->
```

### Un incident d'outillage, consigné

Le volume E2E nommé `hexamap_e2e_pgdata` est **global** : une session parallèle
y a appliqué `0022_postal_code`, absente de cette branche, et le banc a refusé
de démarrer (`corrupted migrations`). Le banc a été lancé sous un nom de projet
dédié avec un volume renommé, sans toucher à la base des autres phases.
**Recommandation d'outillage** : dériver le nom du volume de
`${COMPOSE_PROJECT_NAME}`.
