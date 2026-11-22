# Journal — phase 46, retrait de la page CGV

Branche `feat/v2-46-retrait-cgv`, base `chore/v2-retours-campagne`. Retour traité : **R-004**.
Aucune migration.

## 1. Test d'abord, et vu rouge

`packages/e2e/tests/not-found.spec.ts` portait un cas qui asserait le contraire de ce que la phase
demande : « conditions générales — la page légale est publiée » (`/cgv`, `<h1>` « Conditions
générales de vente »). Ce cas est **inversé**, pas supprimé : il asserte maintenant que `/cgv`
rend « Cette salle n’existe pas » et qu'aucun `<h1>` CGV n'est présent.

Deux cas ajoutés :

- « pieds de page — deux liens légaux, et plus de CGV » — sur `/home` (pied de l'accueil) et
  `/mentions-legales` (pied de la coquille), la navigation « Informations légales » porte
  exactement 2 liens et aucun « CGV » ;
- « pages légales restantes — mentions légales et confidentialité sont publiées ».

**Rouge constaté avant toute suppression**, banc E2E monté sur l'ancien code :

```
2 failed
  [chromium] › tests/not-found.spec.ts:47:3 › conditions générales — la page n’est plus publiée
  [chromium] › tests/not-found.spec.ts:63:3 › pieds de page — deux liens légaux, et plus de CGV
4 passed (55.1s)
```

Première version du cas « pieds de page » : `page.locator('footer')` — **9 éléments** sur `/home`,
parce que les planches de carte portent leur propre `<footer>`. Corrigé en visant la navigation par
son nom accessible (`getByRole('navigation', { name: 'Informations légales' })`), puis rejoué seul
pour vérifier que le rouge venait bien de `toHaveCount(2)` reçu `3` — la CGV encore présente.

## 2. Le retrait

| Fichier | Geste |
| :--- | :--- |
| `apps/web/src/routes/cgv.tsx` | supprimé |
| `apps/web/src/content/legal.ts` | entrée `{ to: '/cgv', label: 'CGV' }` retirée ; bloc `CGV_LEGAL` (95 lignes, douze sections) retiré ; trois commentaires « trois documents » corrigés en « deux » ; mention du retrait dans le commentaire de `LEGAL_LINKS` |
| `apps/web/src/components/layout/nav-items.ts` | `'/cgv': 'Conditions de vente',` retiré |
| `apps/web/src/routeTree.gen.ts` | **régénéré** par `tsr generate` (que lance `bun run --cwd apps/web typecheck`) |

`LEGAL_PAGES_ENABLED` reste `true`. `home.tsx` et `app-shell.tsx` sont **inchangés** : ils itèrent
`LEGAL_LINKS`, donc la suppression de l'entrée suffit à faire passer les deux pieds de trois liens à
deux, et aucun des deux ne code `/cgv` en dur.

Constantes vérifiées après retrait, aucune orpheline : `PUBLISHER` (`legal.ts:6`), `EDITOR` (`:23`,
consommée `:61` et `:126`), `CONSUMER_MEDIATOR` (`:19`, consommée `:111`), `LAST_UPDATED` (`:21`,
consommée `:206`).

## 3. État de `routeTree.gen.ts` après régénération

21 lignes supprimées, **toutes** des occurrences de `cgv` et rien d'autre :

```
 apps/web/src/routeTree.gen.ts | 21 ---------------------
```

`git diff` : `CgvRouteImport` (import), `CgvRoute` (`update`), trois entrées d'interface
(`FileRoutesByFullPath`, `FileRoutesByTo`, `FileRoutesById`), trois unions de chemins de
`FileRouteTypes`, `CgvRoute` dans `RootRouteChildren`, le bloc `/cgv` du `declare module`, et
`CgvRoute` dans `rootRouteChildren`. Aucun autre fichier de route n'a bougé.

## 4. La recherche sur `SHOP_REQUIRE_TOS_CONSENT` (critère 5)

```console
$ grep -rn "SHOP_REQUIRE_TOS_CONSENT" apps packages .env.example
apps/api/src/env.ts:49:    SHOP_REQUIRE_TOS_CONSENT: z
apps/api/src/services/stripe-payments.ts:70:  if (env.SHOP_REQUIRE_TOS_CONSENT === true) {
.env.example:89:# SHOP_REQUIRE_TOS_CONSENT=false
```

Trois occurrences, **aucune ne désigne une route du jeu**. Le drapeau ne fait que poser
`params.consent_collection = { terms_of_service: 'required' }` dans la session Checkout ; l'URL des
conditions générales est un réglage du **Dashboard Stripe** (Settings → Business → Public details),
pas un chemin servi par l'application. Éteint par défaut, il n'émet donc aucune référence à `/cgv`.

Et la recherche des pointeurs résiduels vers la route, `routeTree.gen.ts` exclu :

```console
$ grep -rn "/cgv" apps packages --include='*.ts' --include='*.tsx' --exclude='routeTree.gen.ts'
packages/e2e/tests/not-found.spec.ts:50:    // **supprimée**, pas seulement déliée : `/cgv` est donc une URL inconnue et doit
packages/e2e/tests/not-found.spec.ts:52:    await page.goto('/cgv', { waitUntil: 'domcontentloaded' });
```

Les deux seules occurrences restantes sont le cas E2E qui constate l'absence. La logique du drapeau
n'a **pas** été remaniée.

## 5. Mémoire projet touchée

- **`.docs/05-deploiement.md` §7** — l'item `[juridique]` ne liste plus que « Mentions légales,
  politique de confidentialité et information sur les cookies », cite `mentions-legales` et
  `confidentialite` au lieu de trois URL, et ajoute que la page CGV a été retirée de l'interface.
  L'item `[hôte]` sur le Dashboard Stripe ne dit plus d'enregistrer « l'URL publique des CGV » comme
  une page du jeu : la CGV n'existant plus dans l'interface, le document devrait être publié
  ailleurs, et l'interrupteur reste éteint en attendant.
- **`.docs/06-cadre-juridique.md` §4** — note d'état en tête de section : le cadre décrit les
  obligations du jour où une vente serait encaissée, il ne décrit **aucune page actuellement en
  ligne**.

`.docs/01-architecture.md`, `.docs/02-database.md` et `.docs/03-active-task.md` : **non touchés**.

## 6. Ce que la phase laisse en dette, écrit et non corrigé

- `apps/web/src/content/legal.ts:111` — les mentions légales renvoient encore « aux conditions
  générales de vente ». Ce n'est pas un lien, c'est de la prose juridique des mentions légales, que
  le brief interdit de toucher. Signalé dans la PR.
- `.docs/05-deploiement.md` §7 décrit encore des repères `[À COMPLÉTER — …]` et un bandeau « Texte
  provisoire » que `legal-document.tsx` ne rend plus. Antérieur, hors R-004.
- `.docs/06-cadre-juridique.md` §14 affirme que les packs restent disponibles à l'achat alors que la
  boutique est fermée. Antérieur, hors R-004.

## 7. Mesures

| Étape | Résultat |
| :--- | :--- |
| `ci:check` (lint, typecheck, base, spécifications, charge) | **549 spécifications, 28 fichiers, 0 échec** — « Gatekeeper vert » |
| Banc E2E complet, `chromium` + projets mobiles | **109 cas, 0 échec** (2,6 min) |
| Cas E2E `not-found.spec.ts` avant retrait | 2 rouges, 4 verts |
