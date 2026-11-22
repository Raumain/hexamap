# Revue — Phase 35, L'Atlas

**Verdict : prêt à livrer.**

Revue faite en deux passes : une lecture du diff complet, puis une relecture hostile après
correctifs. Les quatre défauts trouvés en première passe sont corrigés et rejoués ; les points
écartés le sont avec leur raison.

## Ce qui a été vérifié, et comment

| Point | Preuve |
| --- | --- |
| `apps/web/src/components/layout/` inchangé | `git diff --stat HEAD -- apps/web/src/components/layout` vide ; aucun fichier du dossier dans `git status` |
| `apps/api/**` et `packages/spec/**` intacts | absents de `git diff --stat` et de `git status` |
| Aucun état React par mouvement de pointeur | `grep onPointer\|onMouse\|onTouch\|onHover\|addEventListener` dans `atlas.tsx` : aucun résultat ; le SVG ne porte ni `tabIndex` ni gestionnaire |
| Aucune couleur littérale | `grep '#…\|rgb(\|oklch('` sur les fichiers ajoutés : aucun ; seuls des jetons (`fill-vellum-2`, `stroke-brass`, `stroke-veil-strong`) |
| `routeTree.gen.ts` non édité à la main | diff = insertion unique de `/atlas`, 21 lignes, produite par `tsr generate` |
| Aucun `skip`, `fixme`, `retries`, `timeout:` ajouté | grep sur `atlas.spec.ts` : le seul `skipped` est la liste de balises ignorées par le parcours de police |
| Table équivalente complète | cas E2E 1 : parité `tbody tr` / `svg path[data-entity-code]`, trois cellules par ligne, SVG sans texte ni `title`/`desc` |
| 320 px sans débordement | cas E2E 6 sur `viewport 320×640` |
| Aucun texte sous 10 px | même cas, parcours de `main` |
| Contraste AA du filet de laiton | cas E2E 8, ratio WCAG ≥ 3 entre `stroke` calculé et fond du `figure` |
| Mouvement réduit | cas E2E 7 sous `emulateMedia({ reducedMotion: 'reduce' })` : `transition-property: none` |

## Défauts trouvés, puis corrigés

| # | Défaut | Gravité | Correction |
| - | ------ | ------- | ---------- |
| 1 | `apps/web/src/lib/france-outline.ts` devenait du code mort : la décision 4 du brief en fait le repli de chargement et d'absence de `pathD`, et la salle ne l'importait pas | **deal-breaker** | `AtlasMap` rend le contour métropole + Corse quand la liste d'entités est vide, et le niveau national affiche ce contour pendant `isPending` ; les deux tracés n'ont volontairement pas de `data-entity-code`, donc la parité table/tracés reste vraie |
| 2 | `emptyNational` affirmait « vos cartes n'ont encore rien dessiné » : une carte nationale vide dit que le **référentiel** est vide, pas que le joueur ne possède rien | **deal-breaker** (mensonge visible) | Phrase remplacée par « Aucun contour n'est disponible : le référentiel de la carte est vide. » |
| 3 | Deux assertions E2E de navigation non ancrées (`/departement=E2E-D1/`, `/\/collection\?commune=E2E-C-/`) : elles passaient même si l'on restait sur `/atlas` | **deal-breaker** (test qui ne prouve rien) | Ancrées en `/\/collection\?departement=E2E-D1$/` et `/\/collection\?commune=E2E-C-[^&]+$/` |
| 4 | L'assertion de la zone `aria-live` figeait `Département Département E2E A`, doublon produit par le gabarit `Département <nom>` et par le nom de la fixture | suggestion | L'assertion vérifie désormais trois faits : le nom du département, `6 communes`, et un décompte de communes couvertes. Le gabarit produit reste inchangé, il est correct avec un vrai nom (« Finistère ») |

## Points signalés puis écartés, avec la raison

1. **« 0 couverte »** : le gabarit pluralise à `> 1`, donc zéro prend le singulier. C'est la règle
   française (« zéro faute »). Aucun changement.
2. **`retry: false` sur les deux requêtes** : c'est la convention de tous les modules de requête du
   dépôt (`achievements.ts`, `player-profile.ts`). La règle « une lecture de session en échec n'est
   pas une déconnexion » est portée par `useSessionState()` et `SessionUnavailable`, que la salle
   applique à l'identique.
3. **Garde `'regions' in data`** : redondante avec le typage Eden, mais elle transforme une charge
   malformée en message d'erreur plutôt qu'en plantage de rendu. Même choix que
   `achievements.ts`. Conservée.
4. **`.first()` sur le lien commune** : le cas vérifie la navigation, pas l'exhaustivité des liens ;
   le nombre de lignes est déjà asserté à 6 par le cas 2, et chaque ligne porte le même composant
   de lien. Risque résiduel : un lien cassé sur la deuxième ligne ne serait pas vu. Assumé.
5. **Le repli de chargement n'est pas observé en E2E** : il se résout avant la première assertion.
   Il est prouvé par le typecheck, par le lint et par le chemin partagé `entities.length === 0`
   (que le cas 8 traverse quand une entité n'a pas de `pathD`). Écrit ici plutôt que coché.
6. **`packages/shared/src/atlas.ts`** : un **commentaire** seulement (`salle L'Assemblage` →
   `salle L'Atlas`). Aucun type, aucun champ, aucun contrat modifié.

## Ce que la phase ne fait pas, et qui est dit

- **Le Cadastre ne filtre pas encore.** `/collection?departement=…` et `?commune=…` survivent au
  routage — c'est l'exception bornée du brief, six lignes de `validateSearch` sans aucune logique —
  mais la salle du Cadastre ignore les deux paramètres. La phase 36 (vague 5) les consommera.
  Assumé, écrit, et testé dans cet état précis.
- **`nav-items.ts` annonce encore « L'Assemblage ».** Le fichier appartient à la phase 39 ; la
  salle s'intitule « L'Atlas », le lien de la feuille mobile garde son ancien libellé et mène
  correctement à la nouvelle salle (cas E2E réécrit dans `mobile.spec.ts`). Dette de la phase 39.
- **`DESIGN_SYSTEM.md` ne nommait pas la salle** : la ligne `/atlas` → **L'Atlas** est ajoutée au
  §2, aucune occurrence d'« Assemblage » n'existait à renommer. C'est une addition, pas un
  renommage, et le journal le dit.
- **Le niveau régional ne s'ouvre pas** : l'API de la phase 34 n'a pas de route par région. La
  descente est donc département → commune, et les régions sont lues dans la table (nom, possession,
  couverture) sans être interactives. Contrat respecté, pas contourné.

## Reprise — revue du 2026-11-22 (passe hostile)

**Résultat de la table de constats.** Aucun **deal-breaker** après l'annulation du renommage de
`nav-items.ts` et le retrait de la classe inerte `atlas-entity`. Une **suggestion** :
`L'Assemblage` / `L'Atlas` — la coquille annonce encore l'ancien nom alors que la salle s'intitule
« L'Atlas ». Renvoyé à la phase 39, qui possède `components/layout/`.

**Confirmations, avec leur preuve.**

| Point | Preuve |
| --- | --- |
| `components/layout/` hors du diff de la phase | `git diff --stat feat/v2-wave-3..HEAD -- apps/web/src/components/layout/` : vide |
| `collection.tsx` limité à l'exception du brief | diff = `validateSearch` avec deux paramètres optionnels, aucune logique, aucun filtrage ; la salle du Cadastre ignore les deux paramètres |
| Aucune couleur littérale dans les lignes ajoutées | seuls des jetons (`fill-vellum-2`, `stroke-brass`, `stroke-veil-strong`) et deux nombres en style en ligne (`fillOpacity`, `strokeWidth`) |
| Aucun gestionnaire de pointeur ni de survol dans `atlas.tsx` | `grep onPointer\|onMouse\|onTouch\|onHover\|addEventListener` : aucun résultat ; ni `tabIndex` sur un tracé |
| Aucun `skip`, aucun `fixme` | grep sur les cas E2E de la phase : aucun |
| Aucun texte sous 10 px | chaque `text-[…]` ajouté vaut **10 px** ou **15 px** |
| SVG purement décoratif | `aria-hidden="true"` + `role="presentation"` + `focusable="false"` |

**Verdict : prêt à livrer**, la dette de la phase 39 nommée ci-dessus (libellé « L'Assemblage » de
la coquille, à basculer en phase 39, et non un défaut de cette phase).
