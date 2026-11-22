---
objective: "La salle /compte ne montre plus ni ne conditionne l'état de vérification du courriel : le champ reste éditable en permanence, la capacité emailVerification reste rendue et vaut toujours false, et le sort de sendVerificationEmail est tranché et écrit."
status: done
---

# Plan: Le compte sans confirmation d'adresse

Source: `.docs/10-retours-v2.md` §R-001 (source normative) + brief de phase 44.

## Phases

| #   | Phase | File | Depends on |
| --- | --- | --- | --- |
| 1   | Verrouiller la capacité `emailVerification` par une spec neuve, vue rouge | [`phase-1.md`](./phase-1.md) | none |
| 2   | Retirer l'état de vérification de l'écran et des libellés | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Éteindre la capacité côté API (`false` toujours) et documenter `sendVerificationEmail` | [`phase-3.md`](./phase-3.md) | 1 |
| 4   | Rejouer le banc E2E sur la salle, `ci:check` vert, PR brouillon | [`phase-4.md`](./phase-4.md) | 2, 3 |

## External sources

| URL | What it settled |
| --- | --- |
| none | — |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | `GET /account/capabilities` rend aujourd'hui `emailVerification: mailTransportConfigured()` (`apps/api/src/routes/account.ts:229`) ; le banc E2E allume `MAIL_OUTBOX_DIR` nulle part, donc l'écran se ferme. Constaté ligne à ligne. | 3 |
| regression | `packages/spec/src/account.spec.ts:352,437,462` gèlent le flux serveur (lien signé, `503` sans transport, capacité exercée à `false`). Aucune de ces trois attentes n'est touchée : le flux serveur reste celui de Better Auth. Conséquence assumée et écrite : le changement ne s'applique qu'au transport configuré. | 3, 4 |
| regression | `packages/e2e/tests/account.spec.ts:464,473-474` asserte la pastille et le champ **désactivé** : c'est exactement ce que R-001 supprime. Le cas doit suivre le produit, il est **inversé** en assertions positives (champ actif, aucune pastille), jamais relâché. | 4 |
| architecture | Aucune. Aucune migration, aucune table, aucune route nouvelle : `emailVerified` reste dans `"user"` et dans `packages/db/src/schema.ts:14`, seulement plus lu par l'écran. | 2, 3 |
| documentation | `.docs/01-architecture.md` et `.docs/02-database.md` n'exigent aucune mise à jour : R-001 ne modifie ni le GDD, ni le contrat SQL. Le journal de session porte la décision. | 4 |

## Rules

| Rule | Why it applies |
| --- | --- |
| `packages/spec` est la source de vérité ; un cas existant ne se réécrit pas | Trois cas de `account.spec.ts` gèlent le flux courriel ; la seule issue admise est l'**ajout** d'un cas |
| Aucun `skip`, aucun délai relâché | Le banc E2E asserte le comportement retiré ; il se corrige en assertant le nouveau |
| Français uniquement, libellés dans `src/content/` | Tous les textes de la salle vivent dans `apps/web/src/content/account.ts` |
| Aucun état React pour autre chose que l'affichage | Le formulaire reste piloté par TanStack Query + saisie locale |
| Tout passe par Docker | y compris `ci:check` et le banc E2E |

## Decisions

| Decision | Why |
| --- | --- |
| La capacité `emailVerification` **reste** dans la charge utile et vaut **toujours `false`** | `packages/spec/src/account.spec.ts:462` l'exerce et asserte sa présence par `toEqual` ; le produit n'a aucun transport de courriel réel (`apps/api/src/lib/mailer.ts` écrit des fichiers, n'envoie rien), donc la capacité est éteinte, pas supprimée |
| `sendVerificationEmail` **reste branché** | Vérifié : son unique consommateur est `auth.api.changeEmail` (Better Auth), pas la réinitialisation de mot de passe — `sendResetPassword` n'existe nulle part et aucune route de réinitialisation n'est montée. Le flux qu'il sert est celui que `account.spec.ts:352` gèle encore ; le débrancher rendrait cette route inopérante et le cas rouge |
| Le flux serveur du changement d'adresse n'est **pas** modifié | `account.spec.ts:352` (« le changement n'écrit rien avant la vérification ») et `:437` (« sans transport, 503 ») sont des attentes gelées ; les contredire demanderait de les réécrire, ce que la phase interdit |
