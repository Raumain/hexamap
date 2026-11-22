# Revue hostile — phase 44, Le compte sans confirmation d'adresse

Passe séparée, relue comme un relecteur qui n'a pas écrit le code. Diff relu :
`git diff 84368d7` (7 fichiers, +55/−52), plus les cinq documents de session.

## Verdict : prêt à livrer, avec un écart assumé et nommé

## Défauts trouvés, par gravité

### Bloquants

Aucun.

### Suggestion

1. **La capacité dit « impossible » alors qu'un transport de banc la rend possible.**
   `GET /account/capabilities` rend `emailVerification: false` en dur, alors que
   `POST /account/email` répond encore `200` et émet un lien quand `MAIL_OUTBOX_DIR` est posé.
   C'est la décision 5 du brief qui l'impose (« elle reste et vaut toujours `false` : le produit n'a
   aucun transport de courriel »), et `MAIL_OUTBOX_DIR` est un témoin de banc, pas un transport.
   Assumé, écrit dans le commentaire de la route et dans le journal. La contradiction serait levée
   en supprimant la clé — ce qu'une attente gelée (`account.spec.ts:462`) interdit.

2. **Le message de succès est inatteignable en production.** Sans transport,
   `POST /account/email` répond `503 EMAIL_VERIFICATION_DISABLED` ; le texte
   « Votre demande de changement d'adresse est enregistrée. » ne s'affiche donc que dans un
   environnement qui configure `MAIL_OUTBOX_DIR`. Un message neutre reste plus honnête qu'un
   message qui annoncerait un lien que le produit n'envoie pas.

3. **`description` promet « vous pouvez la changer à tout moment ».** Vrai de l'interface (le champ
   n'est plus fermé), faux du parcours complet tant que le transport manque. Le critère 2 interdit
   de nommer la vérification, donc la phrase ne peut pas être plus précise. Consigné.

### Correct

- La pastille, ses deux phrases et la classe `border-oxide` ont disparu ; aucun libellé orphelin ne
  subsiste (`grep` sur `email.verified|email.unverified|email.hint|email.disabled` : zéro
  occurrence hors `.docs` et brouillon de brief).
- `verificationOpen` a disparu du composant, de l'appel, de `canSubmit` et du champ : le critère
  « ni `disabled`, ni `readOnly`, ni masqué par une condition » est tenu littéralement.
- `emailVerified` n'est plus lu nulle part dans `apps/web/src` ; la colonne reste dans `"user"`,
  dans `packages/db/src/schema.ts:14` et dans `.docs/02-database.md:71,816`.
- Aucune migration, aucune table, aucune route nouvelle : `git diff --stat` ne touche ni
  `packages/db/migrations/`, ni `packages/db/src/migrator.ts`, ni `packages/db/src/schema.ts`.
- Les trois attentes gelées (`:352`, `:437`, `:462`) sont **intactes** ; le seul changement dans
  `packages/spec/src/account.spec.ts` est un `it` ajouté, vu rouge avant le correctif.
- Le cas E2E est **inversé**, pas relâché : `toHaveCount(1) → toHaveCount(0)`, `toBeDisabled() →
  toBeEnabled()` plus une saisie réelle relue par `toHaveValue`.

## Écart assumé, nommé pour la PR

**Le changement d'adresse s'applique toujours par lien signé côté serveur.**
`account.spec.ts:352` (« le changement n'écrit rien avant la vérification ») et `:437` (« sans
transport, 503 ») gèlent ce flux. Rendre le changement immédiat — ce que « simplement autorisé »
peut laisser entendre — demanderait de réécrire ces deux cas, ce que le brief interdit
explicitement (« elle passe par l'ajout d'un cas, pas par la modification d'un cas gelé »).
Le critère 1 est donc coché pour sa partie observable dans l'interface, et cette limite serveur est
écrite ici et dans la PR plutôt que corrigée en silence.

## Mesures

- `ci:check` (base `hexamap_test_44`) : **549 spécifications, 28 fichiers, 0 échec**.
- Banc E2E complet : **106 cas, 106 passés, 0 échec** (5,3 min), et le cas de la salle rejoué seul
  pour la preuve nominative (1,8 s) : le champ est actif, accepte une saisie réelle, et aucune
  pastille de vérification ne subsiste.
