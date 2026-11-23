# Revue — phase 48, L'Atelier a une place

Relecture hostile de mon propre diff, après `ci:check` vert et banc E2E vert.

**Verdict : prêt à livrer**, après correction d'un défaut *deal-breaker* trouvé pendant cette
passe (détaillé ci-dessous).

## Diff relu

- `apps/web/src/components/atelier/craft-panel.tsx` — supprime le retour `null`, ajoute la règle
  permanente, l'état vide annoncé, et rattache la raison d'un refus à la grappe tentée.
- `apps/web/src/content/collection.ts` — `ATELIER.intro` remplacé par `atelierRuleLabel()` et
  `atelierEmptyHint()`, dérivés de `CRAFT_THRESHOLD` / `nextCraftRarity` / `RARITY_LABELS`.
- `packages/e2e/tests/atelier.spec.ts` — deux `describe` ajoutés, aucun cas existant modifié.

## Défauts

### Deal-breaker — corrigé

**Le bouton « Annuler » laissait la raison d'un refus à l'écran, et la faisait changer de place.**
Après un `409 CARD_ENGAGED`, `mutation.error` restait vivant. « Annuler » ne remettait que
`confirmingKey` à `null` : `groupHasError` devenait alors faux, donc `panelError` reprenait le
message et l'alerte remontait de la grappe vers le haut du panneau. Le joueur refermait une
confirmation et voyait une erreur se déplacer au lieu de disparaître. Corrigé : « Annuler »
appelle désormais `mutation.reset()`, vide `attemptedKey` et `confirmingKey`. La raison ne
survit pas à un abandon.

### Suggestions (assumées, non corrigées)

1. `groupHasError` nomme « l'erreur appartient à une grappe encore affichée » ; le nom est
   imprécis mais le commentaire le dit. Renommer coûterait un diff sans gain de comportement.
2. `atelierRuleLabel()` recalcule son texte à chaque rendu. Six paliers, deux `flatMap` — le coût
   est nul à côté d'un rendu React ; une mémoïsation ajouterait une dépendance pour rien.
3. Si la grappe disparaît entre le clic et la réponse (rafraîchissement concurrent), la raison
   s'affiche au niveau du panneau. C'est le comportement voulu : mieux vaut un message mal placé
   qu'un message perdu.

## Vérifications du contrat, point par point

| Critère | Preuve |
| --- | --- |
| 1. Trouvable sans doublon | Cas E2E sur `e2e-second` (1 carte, 0 grappe) : région visible. |
| 2. Règle lisible dans l'état vide | Même cas : « exemplaires identiques », « palier suivant », « Légendaire », « Mythique » assertés. |
| 3. Aucun chemin ne rend `null` | `git diff` : le `return null` a disparu ; la `<section>` est le seul retour. |
| 4. Raison `CARD_ENGAGED` affichée | Cas E2E « carte engagée » : alerte = message serveur exact, compteur « 3 × … » intact. |
| 5. Pas de second regroupement, pas de `+ 1` | `craftableGroups` est le seul regroupement ; la seule lecture de palier est `nextCraftRarity`. |
| 6. Cas existants inchangés | `git diff` : le cas de fusion n'a pas une ligne modifiée ; il passe (3/3 dans le fichier). |
| 7. Coquille intacte | `git status` : aucun fichier de `apps/web/src/components/layout/`. |
| 8. `ci:check` + banc E2E | 555 spécifications / 29 fichiers ; 112 cas E2E. |

## Ce que la revue n'a pas pu prouver

- Aucun texte visible n'a été mesuré au pixel : le panneau ne descend pas sous `text-[10px]`
  (jetons existants), mais aucune assertion de taille n'a été ajoutée — la phase n'en demande pas.
- L'état bloqué n'est éprouvé que par la **vente** (`locked`), pas par un tableau ni un troc :
  la fixture du banc ne produit pas ces deux engagements sans écrire de données de jeu à la main,
  ce que le brief interdit. Les trois messages serveur restent néanmoins rendus tels quels par
  `atelierErrorMessage` (branche `CARD_ENGAGED` → `error.message`), et la vente est le premier des
  trois refus, donc le chemin d'affichage est le même.
