# Phase 46 — Retrait de la page CGV : plan

Branche : `feat/v2-46-retrait-cgv` · Base : `chore/v2-retours-campagne` · Migration : aucune.

## Constat établi en lecture

| Fait | Source vérifiée |
| :--- | :--- |
| La route existe et est un fichier de 13 lignes | `apps/web/src/routes/cgv.tsx:1-13` |
| Elle est liée depuis **deux** pieds, tous deux générés par `LEGAL_LINKS` | `home.tsx:266`, `app-shell.tsx:87` |
| Les deux pieds sont conditionnés par `LEGAL_PAGES_ENABLED` (`true`) | `home.tsx:261`, `app-shell.tsx:82`, `legal.ts:17` |
| Le titre de salle vit dans `SALON_TITLES` | `nav-items.ts:135` |
| `LAST_UPDATED` sert aussi à la confidentialité (`legal.ts:301`) | `legal.ts:301` |
| `CONSUMER_MEDIATOR` sert aussi aux mentions légales (`legal.ts:206`) | `legal.ts:206` |
| `EDITOR` sert aux trois documents | `legal.ts:62`, `156`, `221` |
| **Un cas E2E asserte la publication de `/cgv`** | `packages/e2e/tests/not-found.spec.ts:47-61` |
| `SHOP_REQUIRE_TOS_CONSENT` n'a **aucun** pointeur vers `/cgv` | `apps/api/src/env.ts:49`, `services/stripe-payments.ts:70` |
| `/cgv` n'apparaît dans aucune autre source web | `rg` complet du dépôt |

Conséquence : supprimer le fichier casse le cas 3 de `not-found.spec.ts`. Ce cas **doit** changer,
sinon le banc reste rouge — c'est une assertion à inverser (la page ne doit plus être publiée),
pas une assertion à relâcher. `packages/e2e` est explicitement dans le périmètre mémoire autorisé
par le préambule.

## Fichiers touchés

| # | Fichier | Nature du changement |
| :-- | :--- | :--- |
| 1 | `apps/web/src/routes/cgv.tsx` | **supprimé** |
| 2 | `apps/web/src/content/legal.ts` | entrée `LEGAL_LINKS` retirée, bloc `CGV_LEGAL` retiré, deux commentaires « trois documents » → « deux » |
| 3 | `apps/web/src/components/layout/nav-items.ts` | `'/cgv': 'Conditions de vente',` retiré |
| 4 | `packages/e2e/tests/not-found.spec.ts` | cas « conditions générales — la page légale est publiée » remplacé par l'assertion inverse + contrôle des deux pages qui restent |
| 5 | `.docs/05-deploiement.md` | §7 : `CGV` et `/cgv` retirés du constat juridique ; item Stripe reformulé (plus d'URL `/cgv`) |
| 6 | `.docs/06-cadre-juridique.md` | §4 : note d'état du produit (la page CGV n'est plus publiée) |
| 7 | `apps/web/src/routeTree.gen.ts` | **régénéré** par `tsr generate` (via `bun run --cwd apps/web typecheck`), jamais édité |

`home.tsx` et `app-shell.tsx` : **inchangés**. Ils itèrent `LEGAL_LINKS` ; retirer l'entrée suffit,
et les deux liens restants continuent de se rendre. Aucun des deux ne code `/cgv` en dur
(vérifié : les seules occurrences de `/cgv` y sont absentes du `rg`).

## Ce qui n'est **pas** touché

- `mentions-legales.tsx`, `confidentialite.tsx`, leurs entrées `LEGAL_LINKS`, leurs titres.
- `LEGAL_PAGES_ENABLED` reste `true`.
- `apps/api/src/env.ts`, `services/stripe-payments.ts`, `.env.example` : la logique de
  `SHOP_REQUIRE_TOS_CONSENT` n'est pas remaniée.
- `apps/web/src/content/legal.ts:206` (mentions légales, « Les conditions de vente et la procédure
  de réclamation figurent dans les conditions générales de vente. ») : c'est de la **prose
  juridique des mentions légales**, pas du contenu CGV. Le brief interdit de toucher aux mentions
  légales et un texte juridique se corrige sur décision du titulaire. **Signalé dans la PR**, non
  corrigé en silence.

## Ordre des étapes

1. **Test d'abord.** Réécrire le cas 3 de `not-found.spec.ts` pour qu'il asserte l'**inverse** :
   `/cgv` rend la page introuvable, et `/mentions-legales` + `/confidentialite` restent publiées.
   Le jouer seul, avant toute suppression → doit être **rouge** (sur la première assertion).
2. Supprimer `apps/web/src/routes/cgv.tsx`.
3. `content/legal.ts` : retirer l'entrée CGV de `LEGAL_LINKS` et le bloc `CGV_LEGAL`, corriger les
   deux commentaires « trois documents ».
4. `nav-items.ts` : retirer la ligne 135.
5. `bun run --cwd apps/web typecheck` dans Docker → `tsr generate` régénère `routeTree.gen.ts`.
   Vérifier que le diff de ce fichier ne contient **rien d'autre** que le retrait de `/cgv`.
6. Mémoire : `.docs/05-deploiement.md`, `.docs/06-cadre-juridique.md`.
7. `ci:check` complet.
8. Banc E2E complet, puis vérification visuelle des deux pieds de page.

## Comment chaque critère se vérifie

| Critère | Preuve |
| :--- | :--- |
| 1 — aucune URL `/cgv` | `rg` post-diff : plus aucune occurrence de `/cgv` hors `.docs/08-journal.md` (archive), `scripts/retours/` et le journal de session ; cas E2E qui clique `/cgv` et obtient « Cette salle n’existe pas » |
| 2 — aucun lien mort dans les deux pieds | E2E : compter 2 liens dans chaque pied, cliquer chacun, aucun 404 |
| 3 — mentions légales et confidentialité intacts | E2E : les deux routes rendent leur `<h1>`, les deux liens existent dans les deux pieds |
| 4 — mémoire projet à jour | `git diff --stat .docs/05… .docs/06…` non vide, lignes citées dans la PR |
| 5 — aucun pointeur sous `SHOP_REQUIRE_TOS_CONSENT` éteint | `rg -n "SHOP_REQUIRE_TOS_CONSENT"` + `rg -n "/cgv"` : sortie citée dans la PR |
| 6 — `routeTree.gen.ts` régénéré | date de modification + `git diff` limité au retrait du bloc `/cgv` |
| 7 — aucune migration / route d'API | `git diff --name-only` ne contient ni `packages/db/migrations` ni `apps/api/src/routes` |
| 8 — `ci:check` vert | sortie exacte du conteneur, nombre de spécifications et de fichiers |
