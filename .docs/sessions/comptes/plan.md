---
objective: "Le joueur gère son identité depuis /compte : pseudo unique et validé, courriel vérifié, mot de passe changeable, export RGPD à six familles, suppression réelle — cette dernière restant derrière un interrupteur tant que les pages légales ne sont pas définitives."
status: ready
---

# Plan : Phase 37 — Les Comptes

Source : brief de session (`phase-37`), `.docs/07-roadmap-v2.md` §4, `.docs/01-architecture.md`
§2.9/§4.5, `.docs/02-database.md` §4.5/§4.6/§4.9, code existant (`routes/profile.ts`,
`services/profile.ts`, `auth.ts`, `packages/spec/src/profile.spec.ts`).

## Constat préalable — prérequis légal NON tenu

`apps/web/src/content/legal.ts` porte encore six repères `[…]` (`PUBLISHER` : nom, prénom,
adresse, téléphone, courriel, SIREN), un `CONSUMER_MEDIATOR` en `[… À COMPLÉTER …]`, la bannière
`« Texte provisoire »`, et `LEGAL_PAGES_ENABLED = false` : `/confidentialite` jette `notFound()`.

⇒ La suppression est **livrée mais éteinte par défaut** (`503 ACCOUNT_DELETION_DISABLED`), le
critère « suppression » n'est **pas coché** dans la PR, et le constat est écrit dans
`journal.md` avec la sortie de vérification. Le banc E2E active l'interrupteur (voir phase 5)
pour prouver la cascade ; la production et le développement restent éteints.

## Phases

| # | Phase | Fichiers | Dépend de |
| - | ----- | -------- | --------- |
| 1 | Validation partagée du pseudo | `packages/shared/src/pseudo.ts`, `packages/shared/src/index.ts` | none |
| 2 | Spec neuve, vue rouge | `packages/spec/src/account.spec.ts` | 1 |
| 3 | API des comptes | `apps/api/src/services/account.ts`, `apps/api/src/routes/account.ts`, `apps/api/src/lib/mailer.ts`, `apps/api/src/auth.ts`, `apps/api/src/app.ts`, `apps/api/src/lib/http-error.ts` | 1, 2 |
| 4 | Route web `/compte` | `apps/web/src/content/account.ts`, `apps/web/src/routes/compte.tsx`, `apps/web/src/lib/account.ts`, `apps/web/src/components/layout/sidebar.tsx` (lien discret) | 3 |
| 5 | Banc E2E à deux comptes | `packages/e2e/tests/account.spec.ts`, `docker-compose.e2e.yml` (`ACCOUNT_DELETION_ENABLED: "true"` sur `api`) | 3 |
| 6 | Vérification et revue | `ci:check`, banc E2E, `review.md`, `journal.md` | 1–5 |

## Contrat d'API (figé ici, les phases 3 et 4 s'y conforment)

Groupe protégé `/api/v1`, `authPlugin` déjà monté, `errorSchema = { code, message }`.

| Méthode | Chemin | Corps | Succès | Erreurs stables |
| ------- | ------ | ----- | ------ | --------------- |
| `PATCH` | `/account/pseudo` | `{ pseudo: string }` | `200 { pseudo }` | `422 PSEUDO_INVALID`, `409 PSEUDO_TAKEN` |
| `POST` | `/account/email` | `{ newEmail: string }` | `200 { pending: true, email }` (l'ancien courriel, inchangé) | `400 EMAIL_ALREADY_EXISTS`, `503 EMAIL_VERIFICATION_DISABLED` |
| `POST` | `/account/password` | `{ currentPassword?: string, newPassword: string }` | `200 { status: true }` | `400 CURRENT_PASSWORD_REQUIRED`, `400 INVALID_PASSWORD`, `400 PASSWORD_TOO_SHORT` |
| `GET` | `/account/export` | — | `200` JSON, `Content-Disposition: attachment` | — |
| `DELETE` | `/account` | `{ password, confirmation }` | `200 { deleted: true, cascade }` | `503 ACCOUNT_DELETION_DISABLED`, `401 INVALID_PASSWORD`, `400 CONFIRMATION_MISMATCH` |

`PATCH /profile` (bio + visibilité) est conservé tel quel : `/compte` le consomme.

## Décisions techniques

- **Un seul validateur de pseudo** : `packages/shared/src/pseudo.ts`. Lettres Unicode (accents),
  chiffres, `-` et `_`, 3 à 24 caractères après `trim`, aucun espace. `auth.ts` (hook de création)
  et la route de changement l'importent. Les specs existantes (`Pseudo-<hex>`, `'ab'`,
  `'a'.repeat(25)`) restent satisfaites.
- **Unicité par la base**, pas par un `SELECT` : `UPDATE "user" SET pseudo = …` attrape `23505`
  sur `user_pseudo_lower_idx` → `409 PSEUDO_TAKEN`. Zéro course possible.
- **Better Auth fait le reste** : `changePassword` (exige `currentPassword`), `changeEmail`
  (JWT `verifyEmail`, aucun `pendingEmail` — l'ancien courriel reste en base tant que le lien
  n'est pas ouvert), `deleteUser` (mot de passe vérifié, sessions supprimées), `verifyPassword`
  (réauthentification avant suppression).
- **`user.deleteUser.enabled = true`** sinon Better Auth répond `404` ; l'interrupteur produit
  maison est un `beforeDelete` qui refuse quand `ACCOUNT_DELETION_ENABLED` n'est pas `'true'`,
  pour que `POST /api/auth/delete-user` ne contourne pas le `503`.
- **`emailVerification.sendVerificationEmail`** branché sur `apps/api/src/lib/mailer.ts` : capture
  bornée en mémoire (50 messages) + journal. Aucun transport réel n'existe dans le dépôt — c'est
  un écart assumé, écrit au journal, et la vérification elle-même reste entièrement Better Auth.
  `sendOnSignUp: false` : l'inscription ne change pas.
- **Export** : six clés de premier niveau exactement (`cards`, `tableaux`, `achievements`,
  `ledger`, `friendships`, `profile`), aucun habillage, `exportedAt` **dans** `profile`. Ni
  `session`, ni `account`, ni `rateLimit`, ni `currency` brut.
- **Suppression** : `verifyPassword` → annulation des annonces ouvertes (transaction) →
  `deleteUser` → `assertAccountPurged` (neuf tables, `count = 0`) → contrôle que la session ne
  répond plus. `market_listings.buyer_id` passe à `null` : consigné.
- **Interrupteur lu à chaque appel** (`process.env.ACCOUNT_DELETION_ENABLED === 'true'`) et non
  figé à l'import : la spec doit exercer les deux états dans le même processus. Justifié au
  journal ; le reste des réglages passe par `env.ts`.

## Vérification, critère par critère

| Critère | Preuve |
| ------- | ------ |
| 1 — 0 ligne après suppression | `account.spec.ts` : `assertAccountPurged` sur les 9 tables + contrôle d'un second compte intact ; `account.spec.ts` (E2E) si l'interrupteur y est actif |
| 2 — six familles exactement | `account.spec.ts` : `Object.keys(export).sort()` === les six, et `collectKeys` ne contient ni `session`, ni `currency`, ni `grid` |
| 3 — `409 PSEUDO_TAKEN` à la casse près | `account.spec.ts` (route) + E2E à deux comptes |
| 4 — mot de passe sans l'actuel refusé | `account.spec.ts` : `400 CURRENT_PASSWORD_REQUIRED`, puis `400 INVALID_PASSWORD` |
| 5 — `/compte` fermée sans session | E2E : contexte anonyme → redirection `/login` ; route absente de `/players/:id` et du rail |
| 6 — courriel non vérifié avant vérification | `account.spec.ts` : après `POST /account/email`, `email` inchangé et `emailVerified = false` ; après `verifyEmail(token)`, courriel changé |
| 7 — E2E deux comptes | `packages/e2e/tests/account.spec.ts` |
| 8 — risque `buyer_id` écrit | `journal.md` |
| 9 — `ci:check` vert | `docker compose --profile tools run --rm -e TEST_DATABASE_URL=… dev bun run ci:check` |

## Impact

| Catégorie | Verdict | Traité en |
| --------- | ------- | --------- |
| Runtime | `sendOnSignUp: false`, `user.deleteUser.enabled: true` : la connexion et l'inscription gardent leur comportement actuel | 3 |
| Régression | `profile.spec.ts` (validation du pseudo à l'inscription) doit rester vert : le validateur partagé reprend exactement ses bornes | 1, 3 |
| Architecture | Aucune migration, aucun schéma, `.docs/02-database.md` inchangé | — |
| Documentation | `journal.md` : prérequis légal, transport de courriel absent, `buyer_id` | 6 |

## Règles du dépôt qui gouvernent

| Règle | Pourquoi |
| ----- | -------- |
| Aucune table inventée | `user_profiles` et `"user"` suffisent ; pas de `pendingEmail` |
| Better Auth = seule identité | mot de passe, courriel, sessions et suppression passent par son API |
| Serveur autoritaire | l'export et la cascade sont calculés côté serveur |
| Tout en Docker | lint, typecheck, spec et E2E via `docker compose` |
