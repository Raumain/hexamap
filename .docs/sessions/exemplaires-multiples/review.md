# Revue hostile — phase 47, les exemplaires multiples

Relecture du diff complet `feat/v2-retours-wave-1...HEAD` (11 fichiers) faite comme si un autre
auteur l'avait écrit. **Verdict : prêt à livrer.** Aucun défaut *deal-breaker* ; quatre points
notés, aucun ne demande de retoucher le contrat.

## Contrôles

| # | Contrôle | Résultat |
| :-- | :--- | :--- |
| 1 | Une seule fonction publique, sans React ni routeur | ✅ `packages/shared/src/exemplaires.ts` n'importe que `craftGroupKey` et le type `Rarity`. Une seule fonction exportée : `groupExemplaires`. |
| 2 | Clé = `(category, refCode, rarity)` | ✅ la clé est littéralement `craftGroupKey(...)`. Aucune occurrence de comptage sur `(category, refCode)` dans le diff. |
| 3 | Une seule conversion `ref_code` → `refCode` | ✅ l'objet `{ category, refCode, rarity }` n'existe qu'à un endroit, dans le module. Les composants passent des cartes déjà en camelCase. |
| 4 | Trois identiques → une ligne ×3 | ✅ spec (cas 1) + E2E « trois identiques font une ligne… » (110/110). |
| 5 | Deux éditions → deux lignes | ✅ spec (cas 2) + E2E `toHaveCount(2)`. |
| 6 | Le Cartel dit le même nombre | ✅ même module, même `collectionQueryOptions` ; le Cartel lit `groups.find(...).count`, il ne recompte pas. |
| 7 | Le tiroir dit le même nombre, sans second calcul | ✅ `groupExemplaires(items)` une fois puis `Map<key, count>` ; le badge lit la Map. |
| 8 | Aucune surface ne recompte | ✅ `grep` des `filter`/`reduce`/`length` de comptage hors module : rien d'ajouté. Seul `CollectionCounters` compte, mais par catégorie, code préexistant non modifié. |
| 9 | `total`, `aria-live`, virtualisation cohérents | ✅ `aria-live` = « X cartes affichées sur Y cartes · Z groupes » ; le total visible reste « N cartes au total » (vérité serveur) ; la virtualisation compte `rows.length` = groupes. Aucun total de groupes n'est annoncé sur une page bornée. |
| 10 | Hauteur de ligne = contenu | ✅ aucun `h-*`/`min-h-*` ajouté sur une ligne virtualisée. Cas `cadastre.spec.ts:178-200` **rejoué sans modification** : **213 px / 213 px**. |
| 11 | Budget ≤ 18 nœuds non-SVG | ✅ aucun composant de planche touché ; le badge vit dans l'habillage de la ligne. `design-system.spec.ts` vert. |
| 12 | Libellés français dans `content/` | ✅ `exemplairesMark`, `exemplairesCountLabel`, `collectionGroupsLabel` (`content/collection.ts`) et `CARD_DETAIL.exemplairesLabel` (`content/card-detail.ts`). Aucun texte visible sous 10 px. |
| 13 | Aucune spec existante réécrite | ✅ `packages/spec` ne reçoit que `exemplaires.spec.ts`. |
| 14 | Aucun cas E2E affaibli | ✅ `cadastre.spec.ts` : 79 lignes ajoutées en fin de fichier, une seule ligne du haut modifiée (ajout d'un import). Le cas de mesure est intact. |
| 15 | Aucune route, migration, champ, dépendance | ✅ `git diff --name-only` : uniquement `apps/web`, `packages/shared`, `packages/spec`, `packages/e2e` et les `.docs` de session. Aucun fichier de `packages/db/migrations`, aucun `apps/api`. |
| 16 | Aucun `skip`, `.fixme`, délai relâché | ✅ aucun. |
| 17 | Le compteur inclut `locked` | ✅ le module ne lit jamais `locked` ; le compteur additionne le groupe entier. |

## Points notés

1. **Le Cartel d'une carte d'autrui annonce le nombre du spectateur, pas du propriétaire.**
   `GET /cards` est scopé au joueur connecté. C'est la seule source permise (pas de route
   nouvelle), et pour une carte qu'on possède le chiffre est exact. **Gravité : suggestion** —
   à trancher côté produit si le Cartel public doit taire le chiffre pour une carte qui n'est pas
   la sienne. Non corrigé : le corriger demanderait une source serveur, exactement ce que le
   brief interdit.

2. **`×3` dans le tiroir alors qu'un exemplaire sur trois est en vente.** Le compteur suit la
   décision 7 (tous les exemplaires), alors que le tiroir écarte les candidats `locked` : deux
   candidates restent proposées et portent `×3`. **Gravité : suggestion**, et c'est le contrat
   écrit ; signalé pour que la contradiction ne soit pas découverte à l'écran.

3. **Pas de rouge conservé pour la spec.** Spec et module sont dans le même commit (`040d2ec`) :
   la discipline « spec d'abord » n'est pas prouvable par l'historique. La spec passe seule
   (6/6) et n'est pas décorative (elle couvre clé, représentant, non-mutation, rang, catégorie).
   **Gravité : suggestion de procédure**, sans effet sur le comportement livré.

4. **Lookup de clé dans deux composants.** Le Cartel et le tiroir appellent `craftGroupKey(card)`
   pour retrouver le groupe d'une carte. C'est la même fonction partagée, pas une conversion
   recopiée ; le brief impose « une seule fonction publique », donc le lookup ne peut pas être
   caché dans le module. **Gravité : sans objet.**

## Ce que la revue ne prouve pas

- Aucune relecture humaine d'une capture : les trois surfaces sont constatées par Playwright
  (rôles, textes, `×3`, compteur, hauteurs), pas à l'œil.
- Le banc E2E a été joué une fois vert (110 cas). Une instabilité connue du cas « market — un
  double-appui n'achète qu'une fois » n'a pas été observée sur ce passage.

## Verdict

**Prêt à livrer.** Les huit critères d'acceptation sont tenus et chacun a sa preuve ; les deux
écarts assumés (Cartel d'autrui, `locked` dans le tiroir) sont écrits au journal et dans la PR,
pas dissimulés.
