# Revue — Phase 37 « Les Comptes »

Passe séparée, faite par un relecteur hostile sans accès aux intentions de l'auteur (contexte
neuf), puis vérifiée sur pièces par l'orchestrateur. Verdict initial : **bloqué**, trois
deal-breakers. Tous corrigés, puis rejoués.

## Deal-breakers trouvés et corrigés

| # | Défaut | Preuve | Correctif | Rejoué |
| - | ------ | ------ | --------- | ------ |
| 1 | Le front annonçait « un lien de vérification vient d'être envoyé » alors qu'aucun transport de courriel n'existe : `emailVerified` serait resté faux à vie | `lib/mailer.ts` (journal seul), `content/account.ts` (message de succès) | `mailTransportConfigured()` + `503 EMAIL_VERIFICATION_DISABLED` sur `POST /account/email` sans transport ; le formulaire est annoncé indisponible, le message de succès ne s'affiche que sur 200 | `account.spec.ts` : 503 sans transport, courriel inchangé ; avec `MAIL_OUTBOX_DIR`, fichier `.json` écrit en `0o600` |
| 2 | La zone de suppression était montée inconditionnellement alors que l'interrupteur est éteint en production : un bouton de destruction qui ne peut que répondre 503 | `compte.tsx` (montage inconditionnel), `docker-compose.e2e.yml` (banc allumé, donc invisible du test) | `GET /account/capabilities` → `{ deletion, emailVerification }` ; la section n'est montée que si `deletion` est vrai et le pseudo de confirmation non vide | `account.spec.ts` : capacités 401/422/true ; E2E navigateur : section présente sur le banc (interrupteur allumé) |
| 3 | `ACCOUNT_DELETION_ENABLED` n'était déclarée nulle part (ni `env.ts`, ni `.env.example`, ni la doc) : aucun opérateur ne pouvait allumer la fonctionnalité | `grep` sur tout le dépôt | `env.ts` (défaut `false`), `.env.example`, `.docs/05-deploiement.md` §7 | `ci:check` vert, spec du défaut `{ deletion: false }` |

**Défaut réel trouvé par la vérification, pas par la lecture** : `z.enum([...]).transform(...).default('false')`
applique le défaut à la **sortie** en Zod 4 — il produisait donc le booléen `'false'`… c'est-à-dire
`true`, et la suppression était **ouverte par défaut**. Corrigé en `.default('false').transform(...)`.
C'est le seul défaut de la phase qui aurait été une faille si la spec n'avait pas exercé l'état
éteint.

## Suggestions fortes, appliquées

- `assertAccountPurged` **fait échouer** la suppression (`500 ACCOUNT_PURGE_INCOMPLETE`) au lieu de
  journaliser : une purge incomplète ne répond plus 200.
- `cancelOpenListings` remet `locked = false` sur les cartes concernées dans la même transaction :
  une suppression qui échoue après l'annulation ne laisse plus de cartes invendables.
- `buildAccountExport` lit sous `repeatable read` : un achat simultané ne peut plus produire un
  export incohérent.
- Confirmation du pseudo : une seule règle, **exacte après `trim`**, des deux côtés du réseau.
- `PASSWORD_MIN_LENGTH` remonte dans `packages/shared`.
- Commentaire faux de `pseudo.ts` corrigé (la vitrine se lit par identifiant de compte).
- Anneau `focus-visible` ajouté au lien du rail.
- Hook conditionnel de `compte.tsx` supprimé (le corps est extrait en `AccountRoom`), détecté par
  le lint.

## Suggestions assumées, non appliquées (écrites au journal)

| Sujet | Pourquoi elle n'est pas appliquée |
| ----- | --------------------------------- |
| Aucun limiteur de débit sur les deux routes qui vérifient un mot de passe | Ces routes appellent Better Auth en processus, donc son limiteur ne les voit pas. Ajouter un compteur est un chantier à part (stockage, fenêtre, réponse 429) ; la surface exige une session valide. Consigné comme risque. |
| `revokeOtherSessions: false` au changement de mot de passe | Passer à `true` peut invalider le cookie de la session courante, que la route ne réémet pas : l'utilisateur serait déconnecté au milieu de son changement. À trancher avec un test dédié. |
| Export à six familles seulement (ni ventes, ni révélations) | Le contrat de la phase fige exactement six familles. L'écart RGPD est consigné, pas corrigé unilatéralement. |
| Énumération d'adresses par `400 EMAIL_ALREADY_EXISTS` | Exigée par le contrat, derrière une session. Consignée. |
| Pseudo composé uniquement de `-` ou `_` (`___`) | Le contrat tel qu'il est écrit l'autorise. Consigné. |
| Filtre des erreurs console du cas navigateur (`/service ?worker\|SSL certificate error/i`) | Sous le projet `chromium`, l'enregistrement du service worker échoue sur le certificat de l'AC interne (documenté au §4.8) ; c'est un bruit du banc, pas de la salle. Les exceptions de page (`pageerror`) ne sont pas filtrées, et toute autre erreur console fait échouer le cas. |

## Ce qui a été vérifié, et comment

| Critère | Preuve |
| ------- | ------ |
| 1 — 0 ligne après suppression | `account.spec.ts` : 14 compteurs + `buyer_id` + `ticket_reveals` par `ticket_id` ; E2E : 11 tables à 0 |
| 2 — six familles exactement | `Object.keys().sort()` en spec et en E2E ; aucune clé `session`/`account`/`currency`/`grid` |
| 3 — `409 PSEUDO_TAKEN` | spec (route) + E2E (deux comptes) |
| 4 — mot de passe sans l'actuel | spec (400 `CURRENT_PASSWORD_REQUIRED`) + E2E |
| 5 — `/compte` fermée | E2E : anonyme → `/login`, aucun `a[href="/compte"]` sur `/`, `/login`, `/players/:id` |
| 6 — courriel non vérifié avant | spec : ancien courriel inchangé + `emailVerified === false` avant ; nouvel email après `verify-email` |
| 7 — E2E deux comptes | `packages/e2e/tests/account.spec.ts` |
| 8 — risque `buyer_id` | `journal.md` §4, avec la conséquence pour le webhook de remboursement |
| 9 — `ci:check` | voir la sortie ci-dessous |

## Verdict

**Prêt à livrer**, avec une réserve écrite : la suppression et le changement de courriel sont
livrés **derrière leurs interrupteurs**, éteints par défaut, parce que les pages légales ne sont
pas définitives et qu'aucun transport de courriel n'existe. Ces deux critères ne sont donc pas
cochés dans la PR.
