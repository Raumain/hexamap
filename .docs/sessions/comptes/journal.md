# Journal — Phase 37 « Les Comptes »

Branche `feat/v2-37-comptes`, base `feat/v2-wave-2`. Migration : aucune.

## 1. Prérequis légal : NON tenu, constaté avant la première ligne

```sh
rg -n "LEGAL_PAGES_ENABLED|PUBLISHER|CONSUMER_MEDIATOR|provisoire" apps/web/src/content/legal.ts
```

Sortie (extraits, valeurs exactes) :

```ts
export const PUBLISHER = {
  name: '[NOM À COMPLÉTER]',
  firstName: '[PRÉNOM À COMPLÉTER]',
  address: '[ADRESSE À COMPLÉTER]',
  phone: '[TÉLÉPHONE À COMPLÉTER]',
  email: '[ADRESSE ÉLECTRONIQUE À COMPLÉTER]',
  siren: '[SIREN À COMPLÉTER]',
} as const;

export const LEGAL_PAGES_ENABLED = false;

const CONSUMER_MEDIATOR = '[MÉDIATEUR DE LA CONSOMMATION À COMPLÉTER — nom, adresse et site]';

export const LEGAL_BANNER =
  'Texte provisoire — les mentions d’identité (nom, prénoms, domicile, téléphone, SIREN) seront complétées à l’immatriculation de l’éditeur, avant la mise en vente.';
```

`apps/web/src/routes/confidentialite.tsx` fait `if (!LEGAL_PAGES_ENABLED) throw notFound();` : la
politique de confidentialité répond **404**. Le corps des trois documents est rédigé et complet,
mais l'identité de l'éditeur est encore en repères `[…]`.

**Conséquence appliquée** : la suppression est implémentée et testée, mais **éteinte par défaut**
— `DELETE /api/v1/account` répond `503 ACCOUNT_DELETION_DISABLED`, et le `beforeDelete` de Better
Auth refuse aussi `POST /api/auth/delete-user`, pour que l'endpoint natif ne contourne pas
l'interrupteur. Le critère d'acceptation « suppression » **n'est pas coché** dans la PR. Le banc
E2E allume l'interrupteur (`docker-compose.e2e.yml`, service `api`) parce qu'un banc n'est pas une
mise en ligne ; la production et le développement restent éteints.

Aucune page légale, aucun `.env` et aucun document de mémoire n'a été modifié pour « débloquer »
la phase : ce serait une décision produit prise à la place du titulaire.

## 2. Ce qui a été livré

| Élément | Fichier |
| :--- | :--- |
| Validateur de pseudo unique (serveur + client) | `packages/shared/src/pseudo.ts`, exporté par `index.ts` |
| Cinq routes de compte, schémas TypeBox complets | `apps/api/src/routes/account.ts` |
| Pseudo, courriel, mot de passe, export, suppression | `apps/api/src/services/account.ts` |
| Interrupteur de suppression, lu à chaque appel | `apps/api/src/lib/account-switch.ts` |
| Transport de courriel de vérification (capture + journal) | `apps/api/src/lib/mailer.ts` |
| Vérification Better Auth, changement de courriel, `deleteUser` | `apps/api/src/auth.ts` |
| Lecture des réglages de vitrine (complète la paire existante) | `GET /api/v1/profile` |
| `/compte`, six sections, privée | `apps/web/src/routes/compte.tsx`, `content/account.ts`, `lib/account.ts` |
| Spec neuve (19 cas) | `packages/spec/src/account.spec.ts` |
| Banc E2E à deux comptes (6 cas) | `packages/e2e/tests/account.spec.ts` |

## 3. Décisions et écarts assumés

- **Un seul validateur** : `validatePseudo` est importé par le hook de création Better Auth, par la
  route de changement et par le formulaire. Aucune regex n'est recopiée. Les bornes 3–24 et
  l'unicité `lower(pseudo)` de `profile.spec.ts` sont préservées : la spec existante n'a pas bougé
  et reste verte.
- **Unicité par la base** : le `UPDATE … SET pseudo` attrape `23505` ; deux changements simultanés
  ne peuvent pas produire deux fois le même pseudo, et le second reçoit `409 PSEUDO_TAKEN`.
- **Interrupteur lu à chaque appel** (`process.env`, pas `env.ts`) : la spec doit exercer les deux
  états dans le même processus. Tout le reste des réglages reste dans `env.ts`, figé à l'import.
- **Transport de courriel absent du dépôt.** Better Auth est le seul propriétaire du jeton et de la
  vérification ; `sendVerificationEmail` est branché sur `lib/mailer.ts`, qui journalise et capture
  en mémoire bornée (50 messages, jamais exposés par une route). **Aucun courriel réel n'est
  envoyé.** C'est un écart de déploiement, pas de contrat : brancher un transport (SMTP ou API) est
  un préalable à l'ouverture publique du changement d'adresse. Le jeton n'est pas journalisé.
- **`GET /api/v1/profile` ajouté** : le front lisait `GET /account/export` pour afficher la bio et
  la visibilité. L'export est une pièce jointe lourde, pas une lecture de réglages ; la décision 6
  demandait de compléter la paire existante, pas d'en créer une seconde.
- **Banc E2E** : Better Auth plafonne l'inscription à 3 par fenêtre et par IP, et `global-setup.ts`
  en consomme déjà 2. Le témoin du cas de suppression est donc le **second compte réel du banc**
  (`e2e-second`), pas un troisième compte jetable. Le cas reste à deux comptes : l'un est supprimé,
  l'autre est vérifié intact (ligne `user`, carte, session revalidée).

## 4. Risque tranché par écrit : `market_listings.buyer_id`

`market_listings.buyer_id` est `references "user"("id") on delete set null`
(`.docs/02-database.md` §4.5). Constat, tel que le schéma le produit :

- Une annonce **vendue** dont l'acheteur supprime son compte devient une ligne `SOLD` avec
  `buyer_id = NULL`, `price` et `sold_at` conservés. L'historique de la carte chez le vendeur et le
  montant de la transaction restent donc lisibles ; l'identité de l'acheteur disparaît, ce qui est
  le comportement attendu d'une suppression.
- Les annonces **ouvertes** du vendeur supprimé partent en cascade avec le compte (et sont de
  toute façon annulées par le service avant l'appel à Better Auth).
- Le **grand-livre**, lui, perd toutes ses lignes par cascade (`currency_ledger.user_id` est
  `on delete cascade`). C'est la partie qui a une conséquence si la boutique rouvre : un
  remboursement Stripe (`charge.refunded`) arrivé **après** la suppression écrirait
  `PURCHASE_REFUND:<session>` pour un `user_id` qui n'existe plus — l'insertion violerait la clé
  étrangère et le webhook répondrait en erreur. Aucun correctif de schéma n'est proposé ici (le
  contrat l'interdit) : la boutique est éteinte (`SHOP_ENABLED = false`), donc le cas est
  aujourd'hui inatteignable, mais **le jour où elle rouvre, le webhook de remboursement devra
  tolérer un compte disparu** (ignorer la ligne et journaliser) au lieu de supposer que le
  `user_id` existe encore. À porter au dossier de réouverture de la boutique.
- Aucune donnée de carte ne devient orpheline : `user_cards` part en cascade, et les
  `tableaux.*_card_id` / `ticket_reveals.card_user_id` en `set null` appartiennent à des lignes
  elles-mêmes supprimées.

## 5. Vérification — sorties exactes

`ci:check` sur `postgres://hexamap:hexamap@db:5432/hexamap_test_37` :

```text
✓ 1/4 Lint            Checked 280 files in 192ms. No fixes applied.
✓ 2/4 Typecheck       6 workspaces (shared, db, api, web, spec, e2e)
✓ 3/4 Base de données [hexamap] Base de données joignable.
✓ 4/4 Spécifications  394 pass · 0 fail · 2406 expect() calls · 21 fichiers
✓ Gatekeeper vert.
```

Banc E2E complet, tous projets :

```text
docker compose -f docker-compose.e2e.yml up -d db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  82 passed (2.5m)   — chromium · pwa · Pixel 7 · iPhone 13
```

`packages/spec/src/account.spec.ts` seul : **23 pass, 0 fail**, 177 `expect()` ;
`packages/e2e/tests/account.spec.ts` : **7 pass, 0 fail**.

Rappel : la spec est d'abord passée **rouge** (`Cannot find module '@hexamap/api/lib/mailer'`,
0 pass / 1 fail) avant la première ligne de la phase 3. Le cas d'ordre de la suppression
(`Comptes §2.9 — la réauthentification précède la confirmation du pseudo`) est lui aussi passé
**rouge** avant son correctif : `400` reçu, `401` attendu, 0 pass / 1 fail.

PR : https://github.com/Raumain/hexamap/pull/63 (brouillon, base `feat/v2-wave-2`).

## 6. Revue

Verdict et défauts dans `.docs/sessions/comptes/review.md`.

## 7. Reprise — l'ordre de la suppression aligné sur le contrat

Constaté à la relecture de reprise : `deleteAccount` vérifiait la **confirmation du pseudo avant**
le mot de passe, alors que la décision 8 du brief ordonne « réauthentification par mot de passe,
saisie du pseudo en confirmation ». Deux champs faux rendaient donc `400 CONFIRMATION_MISMATCH`
au lieu de `401 INVALID_PASSWORD`, et une session volée apprenait le pseudo du compte sans
connaître le mot de passe.

Correctif : `verifyPassword` remonté avant toute lecture de compte dans
`apps/api/src/services/account.ts`. Cas neuf écrit d'abord et **vu rouge** (`400` reçu, `401`
attendu, 0 pass / 1 fail), puis vert. Aucun cas existant modifié — les trois cas de suppression
déjà présents restent verts sans retouche.

Rejoué après correctif : `ci:check` vert (**394 spécifications, 21 fichiers, 0 échec**) et banc
E2E complet **82 passés, 0 échoué, 0 ignoré**.
