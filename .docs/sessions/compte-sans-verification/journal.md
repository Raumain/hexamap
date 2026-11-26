# Journal — Le compte sans confirmation d'adresse (phase 44, R-001)

## Ce qui a été constaté sur `sendVerificationEmail`

**Appelants, exhaustivement.** `apps/api/src/auth.ts:82` est le **seul** branchement de
`sendVerificationEmail`. Son unique consommateur est le flux `changeEmail` de Better Auth, déclenché
par `auth.api.changeEmail` dans `apps/api/src/services/account.ts:96` (route
`POST /api/v1/account/email`). Il n'est **pas** partagé avec la réinitialisation de mot de passe :
`sendResetPassword` n'existe nulle part dans le dépôt, `sendChangeEmailVerification` non plus, et
`requireEmailVerification` est absent — la vérification n'est jamais exigée pour se connecter ou
jouer. `apps/api/src/lib/mailer.ts` n'envoie rien sur le réseau : il journalise, garde 50 messages en
mémoire, et écrit un fichier JSON `0o600` quand `MAIL_OUTBOX_DIR` est défini. `MAIL_OUTBOX_DIR` est
le **seul** réglage de courriel (`apps/api/src/env.ts:64-67`), et c'est lui que
`mailTransportConfigured()` lit.

**Décision : le branchement reste, et c'est un constat, pas un oubli.** Le flux qu'il sert est
encore celui que `packages/spec/src/account.spec.ts:352` (« le changement n'écrit rien avant la
vérification ») gèle, et `:437` (« sans transport de courriel, la demande répond 503 ») gèle sa
garde. Le débrancher laisserait `POST /api/v1/account/email` sans aucun chemin d'application et le
cas `:352` rouge — exactement ce que la phase interdit. La justification est écrite dans le
commentaire de `auth.ts`, à côté du branchement.

## Décision sur le drapeau `emailVerification`

**Il reste dans la charge utile et vaut `false`, toujours.**
`packages/spec/src/account.spec.ts:462` exerce la capacité et asserte la forme exacte
`{ deletion, emailVerification }` par `toEqual` : retirer la clé casserait une attente gelée.
Le produit n'a aucun transport de courriel réel — le « mailer » écrit des fichiers —, donc la
capacité est **éteinte**, pas supprimée : `apps/api/src/routes/account.ts` rend désormais le
littéral `false` au lieu de `mailTransportConfigured()`. Aucun écran ne décide plus en fonction
d'elle : `apps/web/src/routes/compte.tsx` ne lit plus la clé, et `apps/web/src/lib/account.ts` ne
fait que la transporter, avec le commentaire qui dit qu'elle est toujours fausse.

## Attente de spec touchée

**Aucune attente existante n'a été réécrite.** Un cas a été **ajouté** à
`packages/spec/src/account.spec.ts`, dans le `describe` des capacités :
`Comptes §2.9 — la vérification reste annoncée et vaut toujours faux`. Il pose `MAIL_OUTBOX_DIR`
(ce que le cas `:462` ne fait pas) et asserte `{ deletion: false, emailVerification: false }`.
Vu **rouge** avant le correctif :

```text
error: expect(received).toEqual(expected)
  {
    "deletion": false,
-   "emailVerification": false,
+   "emailVerification": true,
  }
(fail) Comptes §2.9 — la vérification reste annoncée et vaut toujours faux [413.25ms]
```

Vert après, et les cas `:475` et `:481` restent verts **sans être modifiés**.

## Contradiction relevée, non tranchée en silence

`account.spec.ts:352` asserte qu'« aucun changement n'est écrit avant la vérification » : le flux
serveur reste donc **à lien signé**. La demande de R-001 (« le changement d'adresse est simplement
autorisé ») est tenue **à l'interface** — plus aucune condition ne ferme le formulaire, plus aucune
pastille ne reproche l'absence de confirmation —, mais l'application effective du changement exige
toujours un transport de courriel, et `:437` répond encore `503 EMAIL_VERIFICATION_DISABLED` quand
`MAIL_OUTBOX_DIR` est absent. Rendre le changement immédiat demanderait de réécrire `:352` **et**
`:437`, ce que la phase interdit explicitement. Le critère 1 est donc coché pour sa partie
« éditable, ni `disabled`, ni `readOnly`, ni masqué », et la limite serveur est écrite dans la PR.

## Interface

- Pastille « Vérifiée / Non vérifiée », ses deux phrases et la classe `border-oxide` : supprimées.
- `verificationOpen` : supprimé de `EmailSection`, de son appel, de `canSubmit` et du champ.
- Libellés `verified`, `unverified`, `verifiedHint`, `unverifiedHint`, `hint`, `disabled` :
  supprimés de `apps/web/src/content/account.ts`. `description`, `submit` et `success` réécrits
  sans aucune mention de confirmation (`Changer d'adresse`, « Votre demande de changement
  d'adresse est enregistrée. »).
- `emailVerified` n'est plus lu par l'écran ; la colonne reste dans `"user"`, dans
  `packages/db/src/schema.ts` et dans le DDL de `.docs/02-database.md`. Aucune migration.

## Banc E2E

`packages/e2e/tests/account.spec.ts:463-474` assertait exactement ce que R-001 retire : la pastille
« Vérifiée / Non vérifiée » (`toHaveCount(1)`), `getByLabel('Nouvelle adresse')` **désactivé**, et
le texte « Le changement d'adresse n'est pas encore ouvert ». Le cas est **inversé**, jamais
relâché : la pastille passe à `toHaveCount(0)`, le champ passe à `toBeEnabled()`, il reçoit une
saisie réelle (`fill`) dont la valeur est relue, et le bouton `Changer d'adresse` est asserté
actif.

## Mesures

- `ci:check` (base `hexamap_test_44`) : **549 spécifications, 28 fichiers, 0 échec**. La base en
  portait 548 avant l'ajout du cas.
- Banc E2E complet, sur la pile HTTPS du banc : **106 cas, 106 passés, 0 échec** (5,3 min). Rejoué
  seul pour la preuve nominative :
  `✓ [chromium] › tests/account.spec.ts:427:3 › Le registre, session ouverte › compte — la salle
  s'ouvre, annonce son état réel et n'écrit aucune erreur (1.8s)`.
- Ce que le banc regarde jouer, et qu'aucun contrôle de compilation ne dirait : le champ
  `Nouvelle adresse` est **actif**, il accepte `sans-verification@hexamap.test` et le relit
  (`toHaveValue`), le bouton `Changer d'adresse` est actif, aucune pastille « Vérifiée /
  Non vérifiée » n'existe plus et le texte « Le changement d'adresse n'est pas encore ouvert » a
  disparu.
