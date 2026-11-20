---
objective: "Le catalogue des 37 médailles vaut exactement 6 000 écus et quatre packs purs verrouillent le ratio écus/€ dans packages/shared."
status: doing
---

# Plan: Phase 30.0 — Économie des écus et catalogue des packs

Source: brief de session `phase-300` (`Phase 30.0`), `.docs/01-architecture.md` §2.8, `ROADMAP.md` §2.B,
`packages/shared/src/achievements.ts`, `packages/spec/src/achievements.spec.ts`.

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Rebaser les 37 primes | `packages/shared/src/achievements.ts` | none |
| 2   | Verrouiller le total dans la spec existante | `packages/spec/src/achievements.spec.ts` | 1 |
| 3   | Créer le catalogue des packs | `packages/shared/src/packs.ts` | none |
| 4   | Exporter les packs | `packages/shared/src/index.ts` | 3 |
| 5   | Spec des packs | `packages/spec/src/packs.spec.ts` | 3, 4, 2 |
| 6   | Documenter la règle et le tableau | `.docs/01-architecture.md` §2.8 | 1, 3 |

Ordre d'exécution : **spec d'abord**. Les cas de `packs.spec.ts` et le total de
`achievements.spec.ts` sont écrits et vus **rouges** avant que `achievements.ts` et `packs.ts`
ne soient modifiés — sauf `packs.spec.ts`, qui ne peut pas être rouge autrement qu'en échouant
à l'import du module absent (c'est le rouge attendu), et le total de `achievements.spec.ts`, qui
passe de 65 950 à 6 000 avant la table.

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | `apps/api/src/services/achievements.ts:246` construit `payouts` depuis `ACHIEVEMENTS` : la valeur lue est celle de la table, aucun montant n'est en dur ailleurs. `apps/web/src/content/achievements.ts:48` affiche `ACHIEVEMENT_PAYOUT_TOTAL`, donc le total affiché suit automatiquement. | 1 |
| regression | `packages/spec/src/achievements.spec.ts` porte un `CATALOGUE` local qui duplique les 37 montants : il doit suivre, sinon la spec échoue sur « aucune clé hors catalogue ». Les 37 clés, familles, métriques et seuils ne changent pas. | 2 |
| architecture | Nouveau module pur `packages/shared/src/packs.ts` : types, table ordonnée, `packByKey`, `ecusPerEuro`. Aucune dépendance, aucun `process.env`, aucun accès réseau, aucun texte français. Pas de cycle : `packs.ts` n'importe pas `achievements.ts`. | 3, 4, 5 |
| documentation | `.docs/01-architecture.md` §2.8 gagne la règle « catalogue complet = un `PACK_6000` » et le tableau des quatre packs. `.docs/02-database.md` **n'est pas touché** (phase 30.1). `ROADMAP.md` non plus. | 6 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Ne pas modifier `.docs/03-active-task.md` | Propriété du lanceur ; le journal va dans `.docs/sessions/economie-ecus/journal.md`. |
| Ne toucher ni `currency_ledger`, ni `user.currency`, ni aucune migration | Un historique de solde n'est pas une table de configuration ; aucune migration réservée (`-`). |
| Aucun texte français dans `packages/shared` | Les libellés vivent dans `apps/web/src/content/` (phase 30.4). |
| Aucune dépendance nouvelle | Le module est composé de constantes et d'une fonction pure. |
| Tout passe par Docker | `ci:check` est la seule preuve acceptée. |
| Aucun seuil, aucune clé, aucune famille, aucune métrique modifiés | La phase 27 les a verrouillés ; les médailles déjà obtenues ne sont pas recalculées. |

## Decisions

| Decision | Why |
| -------- | ----- |
| `packs.ts` ne calcule pas son total depuis `achievements.ts` | Un import croisé créerait un cycle ; c'est `packages/spec` qui verrouille `PACK_6000.ecus === ACHIEVEMENT_PAYOUT_TOTAL`. |
| `ACHIEVEMENT_PAYOUT_TOTAL` reste un `reduce` | Le brief l'exige : jamais de total écrit à la main, sinon deux vérités à réconcilier. |
| `stripePriceEnv` porte un **nom** de variable, jamais un identifiant `price_…` | Aucun prix Stripe en dur dans le code source. |

## Vérification

| Critère | Moyen |
| ------- | ----- |
| `ACHIEVEMENTS.length === 37` | `achievements.spec.ts`, bloc « 37 entrées » |
| Total `6 000` | `achievements.spec.ts` (`ACHIEVEMENT_PAYOUT_TOTAL`) + `packs.spec.ts` |
| `PACKS.length === 4`, ratio strictement croissant | `packs.spec.ts` |
| `PACK_6000.ecus === 6000` et égal au total des médailles | `packs.spec.ts` |
| Aucune migration / route / schéma / texte UI | `git status --porcelain` du diff livré |
| `ci:check` vert | `docker compose --profile tools run --rm -e TEST_DATABASE_URL=… dev bun run ci:check` |
