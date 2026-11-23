# Journal — phase 48, L'Atelier a une place

## Décision de forme

**Section stable du Cadastre**, pas de salle dédiée.

Justification en une ligne : le cas E2E existant cherche la région « L'Atelier » sur `/collection`
et doit passer inchangé ; une salle dédiée imposerait soit de dupliquer le panneau, soit de casser
ce cas, et ferait toucher `nav-items.ts`.

Conséquence directe : `apps/web/src/components/layout/` n'est **pas** modifié du tout
(`git status` ne montre que trois fichiers, aucun dans `layout/`).

## Ce qui est livré

- `CraftPanel` ne rend plus jamais `null`. La `<section aria-labelledby="atelier-title">` et son
  `<h2>` sont rendus quel que soit le nombre de grappes.
- La règle est **en permanence** sous le titre, et son texte est calculé depuis
  `packages/shared/src/atelier.ts` : `CRAFT_THRESHOLD` pour le seuil, `nextCraftRarity` pour le
  palier plafond (Légendaire) et pour le palier jamais produit (Mythique), `RARITY_LABELS` pour
  les noms. Aucun `3` ni `MYTHIQUE` n'est écrit dans le JSX, et la règle n'a pas de second module.
- L'état vide est une zone `role="status"` qui **explique** : « Aucune grappe à fusionner. » puis ce
  qu'il faut réunir (seuil lu dans `CRAFT_THRESHOLD`, même carte, même rareté).
- La raison d'un refus `409 CARD_ENGAGED` est rendue **dans la grappe tentée**, avec le message du
  serveur tel que `atelierErrorMessage` le rend. Aucune heuristique sur `locked`, aucune lecture de
  `tableaux`, d'annonces ou d'offres côté client ; en cas de disparition de la grappe entre le clic
  et la réponse, le message remonte au panneau plutôt que d'être perdu.

## Ordre de travail — spec d'abord

Aucun cas de `packages/spec` n'est requis ni modifié : cette phase n'ajoute **aucun calcul
partagé**, la règle de fusion est déjà verrouillée par `packages/spec/src/atelier.spec.ts`. La
preuve est donc le cas E2E, et il a été écrit **avant** le code : le banc construit sur le code
d'origine donnait

```text
1 failed
  [chromium] › tests/atelier.spec.ts:136:3 › L'Atelier d'un compte sans doublon
  › la section est trouvable et la règle est lisible sans grappe fusible
2 passed (48.8s)
```

— l'état vide était rouge précisément parce que la section n'existait pas sans grappe, et les deux
autres cas (fusion existante, grappe bloquée) passaient déjà. Après implémentation :
`3 passed (29.1s)`.

## Ce que la fixture du banc permettait de prouver

- **État vide honnête** : `packages/e2e/fixtures/second-account.ts` donne au compte `e2e-second`
  **exactement une carte** (`E2E-C-RARE-0`), supprimée puis réinsérée à chaque exécution. Aucun
  doublon n'est fabriqué pour arranger le test : le cas joue sur le compte secondaire, comme le
  brief le demande quand le compte principal a déjà des doublons.
- **État bloqué honnête, par la vente uniquement** : la fixture de L'Atelier
  (`E2E-C-RARE-1`, 3 × RARE) est mise en vente sur **une** de ses trois cartes par la vraie route
  `POST /api/v1/market/listings`, qui pose `locked = true`. La fusion répond alors
  « Une carte de ce groupe est verrouillée par une vente en cours. » — message du serveur, asserté
  tel quel.
- **Non prouvé** : les deux autres engagements (`CARD_ENGAGED` par un tableau, par une offre de
  troc `PENDING`). Les produire demanderait d'écrire des données de jeu à la main ou de composer un
  tableau complet, ce que la fixture ne fait pas ; le critère correspondant est donc **tenu pour la
  seule vente**, et le journal le dit plutôt que de le cocher à tort. Les trois raisons passent par
  la même branche (`atelierErrorMessage` → `error.message`), mais je ne l'ai vérifié qu'à l'écran
  pour la vente.

Nettoyage du cas bloqué : l'annonce est annulée (`DELETE /api/v1/market/listings/:id`) puis le
groupe est réellement fondu par `POST /api/v1/cards/craft`, dans un `finally` — le banc retrouve
l'état que laisse le cas de fusion existant (une carte Épique), et un rejeu repart d'une fixture
propre.

## Résultat exact de `ci:check`

Base `postgres://hexamap:hexamap@db:5432/hexamap_test_48`, dans Docker :

| Étape | Résultat |
| --- | --- |
| 1/5 Lint | vert |
| 2/5 Typecheck | vert |
| 3/5 Base de données | vert — base de test prête, **20 migrations**, dans l'ordre |
| 4/5 Spécifications | **555 pass, 0 fail**, 3 256 `expect()`, **29 fichiers** |
| 5/5 Mesure de charge | 2 pass — p95 du résumé Atlas **17,5 ms** (seuil 200), charge 337 527 octets (garde-fou 512 Kio) |
| Gatekeeper | vert |

Banc E2E complet, sur l'image de production reconstruite :

```text
112 passed (2.9m)
```

dont les trois cas de `packages/e2e/tests/atelier.spec.ts` (l'existant inchangé, la grappe bloquée,
le compte sans doublon).

## Écarts

- **Aucun fichier de mémoire projet modifié** : R-007 n'exige ni `01-architecture.md` ni
  `02-database.md`. Le journal de session est le seul document écrit.
- **Aucune route, aucune migration, aucun changement de contrat d'API** : la phase est
  exclusivement web, plus un test.
- La référence `apps/web/src/routes/collection.tsx:324` de R-007 est périmée (le montage est à la
  ligne 340 dans l'état courant) ; cela n'a rien changé à la décision, le panneau est bien monté
  inconditionnellement par Le Cadastre.
