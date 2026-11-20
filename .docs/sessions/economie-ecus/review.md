# Revue — phase 30.0 (Économie des écus et catalogue des packs)

Relecture hostile du diff complet : `packages/shared/src/{achievements,packs,index}.ts`,
`packages/spec/src/{achievements,packs}.spec.ts`, `.docs/01-architecture.md` §2.8.

## Verdict

**Prêt à livrer.** Aucun défaut *deal-breaker*. Trois observations de gravité faible à moyenne,
toutes documentées ci-dessous, aucune ne justifie un blocage.

## Ce qui a été vérifié à la main, pas supposé

- **Les 37 montants.** Chaque `payout` du diff correspond ligne à ligne au tableau du brief.
  Somme recalculée à la main par famille : SCRATCH 1 140, COLLECTION 2 440, TABLEAU 775,
  MARKET 575, SOCIAL 730, ATTENDANCE 340 → **6 000**. Le chiffre « 2 440 » inscrit dans
  `.docs/01-architecture.md` §2.8 est donc exact.
- **Rien d'autre n'a bougé dans la table.** Le diff ne touche que les lignes `payout:` : ni
  `key`, ni `family`, ni `metric`, ni `threshold`, ni `label`, ni `description`. Les médailles
  déjà obtenues ne sont pas recalculées (aucun `UPDATE`, aucune migration).
- **`packs.ts` est pur.** Aucun import, aucun `process.env` lu, aucun accès réseau, aucun import
  de `achievements.ts` (pas de cycle). Il ne contient aucun `price_…`, seulement des noms de
  variables `STRIPE_PRICE_*`.
- **Ratio écus/€ strictement croissant** : 100,20 → 120,12 → 125,06 → 133,36. La spec l'assert
  par accumulateur, pas par indexation.
- **Aucune migration, aucun schéma, aucune route, aucun texte UI.** `git status --porcelain`
  ne montre que les cinq fichiers de code/doc attendus, plus `.docs/sessions/economie-ecus/`.
  `ROADMAP.md`, `.docs/02-database.md` et `.docs/03-active-task.md` sont intacts.
- **Aucun montant en dur ailleurs.** `grep 'payout:\s*\d+'` ne rend que les 37 lignes de
  `packages/shared/src/achievements.ts`. `apps/api/src/services/achievements.ts` consomme
  `ACHIEVEMENTS`, et `apps/web/src/content/achievements.ts:48` affiche
  `ACHIEVEMENT_PAYOUT_TOTAL` — les deux suivent la table sans valeur propre.
- **`ci:check` vert** — 4/4, 279 spécifications, 16 fichiers, base `hexamap_test_300`.

## Défauts et observations

### O1 — La spec d'intégration affaiblit un cas de bord (gravité : faible)

`packages/spec/src/achievements.spec.ts` : le prix d'annonce des deux cas d'achat passe de
`100` à `25`, parce que la prime du premier ticket vaut désormais 25. Conséquence : l'acheteur
dépense **exactement** tout son solde, et le cas « un joueur avec une médaille peut acheter »
ne distingue plus « assez d'écus » de « juste assez ». Un décalage d'un écu passerait.

*Pourquoi ce n'est pas bloquant* : le montant est une **donnée d'intégration dérivée** de la
prime, pas une assertion de structure — le cas continue de prouver que l'égalité stricte passe
(`25 − 25 = 0`) et que le débit/crédit sont symétriques. Relever le prix aurait exigé d'inventer
une source d'écus que la phase 30.0 n'a pas le droit de créer. À rouvrir si un cas de bord sur
le solde devient nécessaire (phase 30.8).

### O2 — L'export de `packs` n'est pas « à la fin » de `index.ts` (gravité : nulle)

La consigne de fichiers partagés demandait d'ajouter l'export **à la fin** de la liste. Il est
en position alphabétique (`charges`, `packs`, `rarity`), parce que `biome check` refuse un export
non trié et que `ci:check` s'arrêterait à `1/4 Lint`. Le linter gagne sur la commodité de
fusion : c'est un écart assumé, pas un oubli.

### O3 — Deux documents portent encore l'ancien total (gravité : nulle pour cette phase)

- `ROADMAP.md:79` dit toujours « ~66 000 écus catalogue ».
- `.docs/sessions/les-medailles/phase-1.md:34,53` et `journal.md:10` citent 65 950.

Aucun n'est modifiable ici : `ROADMAP.md` est hors périmètre (interdit), et
`.docs/sessions/les-medailles/` est l'archive d'une autre session. `phase-1.md:53` est
particulièrement trompeuse si rejouée un jour, mais elle décrit un état passé, pas un contrat
vivant. À consolider par le lanceur.

## Réserves explicites

- La modification des montants dans `packages/spec/src/achievements.spec.ts` contrevient
  littéralement à la règle « une PR d'implémentation ne modifie pas un test de spec ». Elle est
  **mandatée par le brief** : le tableau des primes *est* le sujet de la phase. Les assertions de
  structure (37 entrées, clés, familles, seuils, unicité, idempotence, concurrence, interrupteur)
  sont intactes — seule la valeur monétaire change, et son total reste verrouillé par deux specs.
- Rien n'a été vérifié sur le rendu visuel : la phase n'ajoute aucun composant.

## Conclusion

Le diff fait ce que le brief demande, rien de plus. Livrable en brouillon.
