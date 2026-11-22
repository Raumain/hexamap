# Revue — Phase 40, Le Troc

Relecture hostile du diff complet, passe séparée. Verdict : **prêt à livrer**.

## Défauts trouvés en revue, et corrigés

| Gravité | Défaut | Correction |
| :--- | :--- | :--- |
| **Deal-breaker** | Le premier jet du cas E2E proposait une carte du **compte principal** et demandait celle du **second compte du banc** — or ces deux comptes portent les fixtures de La Planche et de la Vitrine. Le troc consommait donc une carte dont `vitrine-fixture.ownedCard` a besoin : `vitrine.spec.ts` rougissait (`ne possède aucune carte COMMUNE E2E-C-RARE-0`). Trouvé en jouant le banc **complet**, pas le fichier seul. | Fixture dédiée `packages/e2e/fixtures/trade-fixture.ts` : un receveur inscrit par le test et deux communes (`E2E-C-LEGENDAIRE-1`, `E2E-C-MYTHIQUE-1`) que personne d'autre n'emploie. Le banc complet repasse à 93/93. |
| **Deal-breaker** | Le dialogue du troc héritait des encre `ink-*` sur `bg-cabinet-raised` : texte presque noir sur fond de cabinet, illisible. | Jetons inversés (`text-vellum`, `text-vellum/70`, `text-vellum/55`), comme `more-sheet.tsx`. |
| Majeur | « Proposer un troc » s'affichait sur une carte **verrouillée**, c'est-à-dire en vente : bouton présent, action toujours refusée par `409 CARD_LOCKED`. Un bouton qui ne peut pas marcher. | Le bouton n'est rendu que si la carte n'est pas verrouillée ; une carte en vente garde son seul achat. |
| Majeur | `decline` et `cancel` ne balayaient pas les offres expirées : refuser une offre morte l'écrivait `DECLINED`, alors que l'expiration avait déjà tranché. | Le balayage précède les deux réponses ; la spec verrouille `EXPIRED` + `409 TRADE_OFFER_NOT_PENDING`. |
| Mineur | L'annulation notifiait le destinataire avec `TRADE_DECLINED` sans distinguer un retrait d'un refus. | Charge utile `withdrawn: true` et libellé dédié dans Le Guichet ; aucun `kind` inventé. |

## Points audités, jugés conformes

- **Atomicité.** `acceptTrade` : `FOR UPDATE` sur la ligne d'offre, puis sur les deux `user_cards`
  **dans l'ordre de leur identifiant** (`orderBy('id')`), vérification de possession des deux
  côtés, transfert des deux `user_id`, statut, `responded_at`, notifications — une transaction.
  Une seconde acceptation attend le verrou, relit `ACCEPTED` et rend `409` ; les cartes ne bougent
  pas. Vérifié par spec.
- **Exclusivité.** Les deux index partiels sont la seule autorité : une course entre deux
  propositions est arbitrée par la base, et `23505` est traduit en `409 CARD_ALREADY_IN_TRADE`
  plutôt que de fuir en `500`.
- **`locked`.** Jamais écrit par le troc. Les deux gardes (`CARD_LOCKED`, `CARD_IN_TRADE`) sont
  symétriques et testées dans les deux sens.
- **Aucune monnaie.** Le module ne touche ni `user.currency` ni `currency_ledger`. Aucun motif
  nouveau, aucune table de jonction, aucun lot, aucun prix — le N ↔ N n'est pas préparé.
- **Non-exposition.** La charge utile de notification ne porte que `offerId`, `playerId`, `pseudo`,
  `withdrawn`. Ni `grid`, ni `treasure_index`, ni solde, ni collection d'un tiers.
- **`GET /cards/:id`.** L'extension de visibilité est bornée : viewer ∈ {proposer, receiver} **et**
  offre `PENDING` **et** carte de l'offre. Une carte d'autrui hors de ces trois conditions reste
  `403 CARD_NOT_VISIBLE`.
- **Expiration.** `expireOffersForUser` est bornée à l'utilisateur, idempotente (le `UPDATE` ne
  touche que `PENDING`), et n'émet qu'une fois par offre et par camp (clé `TRADE_EXPIRED:<id>` +
  index unique `(user_id, dedupe_key)`).
- **Front.** TanStack Query uniquement, aucune requête dans `useEffect`, invalidation après chaque
  mutation, pas de couleur littérale, `aria-live` sur les retours, dialogue `role="dialog"` +
  `aria-modal` + `aria-labelledby` + fermeture par Échap, rendu par `OverlayPortal` (aucun ancêtre
  transformé ne peut le déformer).
- **Migrations.** Une seule, `0017_trade_offers`, en fin de liste dans `migrator.ts` et en fin de
  bloc dans `schema.ts`. Rejouée deux fois de suite sans erreur.
- **Aucun `skip`, aucun délai relâché, aucun cas existant réécrit.** `market.spec.ts`,
  `second-account.spec.ts` et `vitrine.spec.ts` sont intacts.

## Limites assumées, écrites et non cachées

1. **Aucune journalisation anti-collusion** au-delà de `trade_offers` elle-même. On relit la paire,
   les cartes et les dates ; on ne détecte pas une ferme de comptes. Écrit au journal, ici, et dans
   la PR.
2. **Pas de découverte.** Aucun annuaire de joueurs n'existe : la première proposition ne peut pas
   naître d'une navigation seule. Le mécanisme est complet, la découverte ne l'est pas.
3. **Une carte ne peut être demandée que par une offre à la fois.** Simplification assumée, elle
   protège l'acceptation.

## Défaut préexistant, hors périmètre, signalé

`packages/db/migrations/0014_ref_integrity.ts` n'est **pas rejouable** : trois `create trigger`
sans `drop trigger if exists`, donc `42710` dès que la table de suivi est supprimée et la séquence
rejouée — c'est le test que `.docs/02-database.md` §8 prescrit. Constaté en cherchant à prouver la
rejouabilité de `0017`. Non corrigé : autre phase, fichier partagé par plusieurs sessions. La
rejouabilité de `0017` a été prouvée isolément.

## Ce que je n'ai pas pu prouver

- Le rendu visuel réel du dialogue et du panneau n'a pas été regardé sur capture : le banc E2E les
  traverse (le panneau est cliqué, l'acceptation vérifiée), mais aucune mesure de contraste
  automatisée n'existe dans le dépôt. Les jetons employés sont ceux des autres overlays.
- L'ordre spec-d'abord n'a pas produit de rouge : la spec a été écrite avant d'être lancée, après
  l'implémentation. Déclaré au journal.

## Preuves

```
ci:check  ✓ 1/4 Lint  ✓ 2/4 Typecheck  ✓ 3/4 Base de données
          ✓ 4/4 Spécifications   435 pass, 0 fail, 24 fichiers
banc E2E (pile isolée)              93 passed
```
