---
objective: "La vitrine publique expose les quatre planches du meilleur tableau, en identité seule, résolues en une seule instruction SQL, sans aucune donnée privée."
status: done
---

# Plan : La Vitrine, la planche montrée (phase 38)

Source : `.docs/07-roadmap-v2.md` §4 « Phase 38 », brief de session, et
`.docs/01-architecture.md` §2.9 / §4.9. Contrat déjà figé : ne rien renégocier.

## État des lieux vérifié (lu, pas supposé)

| Fait | Preuve |
| :--- | :--- |
| `GET /api/v1/players/:id` ne rend que `bestTableau { id, name, score, multiplier, links }` | `apps/api/src/routes/players.ts:18-27`, `apps/api/src/services/profile.ts:407-413` |
| `loadBestTableau` **jette** les quatre `CardRow` après le calcul du score | `services/profile.ts:299-303` puis `:407-413` |
| Un tableau incomplet est **purement ignoré** (`continue`) | `services/profile.ts:378-385` |
| `loadBestTableau` rend `null` si le joueur n'a aucune carte résolue | `services/profile.ts:295-297` |
| `blasonOf` est l'unique propriétaire du repli `blason_url ?? contour_url` | `apps/api/src/services/draw.ts:397-406` |
| `profile.ts` n'importe de `draw.ts` que le type `Executor` | `services/profile.ts:9` |
| La vitrine privée et le compte inconnu partagent `404 PLAYER_NOT_FOUND` | `routes/players.ts:61-66`, `services/profile.ts:457-465` |
| `Card` est purement présentationnel, 13 props optionnelles, `variant` défaut `compact` | `apps/web/src/components/ui/Card.tsx:9-43` |
| La page ne rend **aucune planche** aujourd'hui | `apps/web/src/routes/players.$playerId.tsx:183-208` |
| Les libellés vivent dans `apps/web/src/content/player-profile.ts`, `CATEGORY_LABELS` dans `content/tickets.ts` | fichiers lus |
| `packages/spec/src/profile.spec.ts` couvre déjà la vitrine (7 cas, `FORBIDDEN_KEYS`, `collectKeys`) | fichier lu |
| **Aucun cas E2E** ne couvre `/players/:id` | `packages/e2e/tests/` listé |
| **Aucune ligne `tableaux` n'est semée** par le banc E2E | `packages/e2e/fixtures/tableau-fixture.ts` (cartes seules) |
| `createDb(url)` n'accepte aucune option, donc aucun journal SQL exploitable | `packages/db/src/index.ts:12-17` |

## Décisions d'implémentation

1. **Un seul fichier de service modifié** : `apps/api/src/services/profile.ts`. La route
   `routes/players.ts` ne gagne que son schéma TypeBox — pas de second module.
2. **Une seule instruction SQL pour les quatre emplacements.** Une requête brute `sql`
   (précédent établi dans le même fichier : `isBlocked`, `loadFriendCount`,
   `loadAchievements`) construit les quatre positions par
   `cross join (values (0),(1),(2),(3)) as s(n)` + `left join user_cards` par `case s.n`,
   et résout nom et blason par quatre `left join` sur les référentiels. Le nom du CTE est
   `showcase_slots` : il sert d'ancre lisible au cas de spec qui compte les instructions.
   `blasonOf` reste appelé côté TS sur les trois colonnes brutes — le repli n'est pas réécrit
   en SQL.
3. **`category` vient de la position, jamais de `user_cards.category`.** Le contrat dit que
   l'index est la vérité ; dériver `category` de `s.n` rend la cohérence vraie **par
   construction** (critère 6), y compris si une ligne corrompue range une carte dans la
   mauvaise colonne.
4. **Un tableau incomplet cesse d'être ignoré.** `bestTableau` reste `null` **seulement** si le
   joueur n'a aucun tableau (décision 5 du brief, étape 3 de la feuille de route). Un tableau
   troué garde donc sa place et rend ses `null`. Un tableau complet garde l'avantage : un
   emplacement manquant vaut 0 point et abaisse le multiplicateur, donc `>` suffit.
5. **Le compteur de requêtes se mesure avec un client journalisé.** `createDb` gagne un
   second paramètre **optionnel** `{ log }` transmis à Kysely (`packages/db/src/index.ts`).
   Aucun changement de comportement pour les appelants existants, aucune dépendance nouvelle.
   La spec appelle `loadPlayerProfile` sur ce client et compte les événements `query`.
6. **La page rend quatre cellules fixes**, dérivées d'une constante d'ordre
   (`REGION, DEPARTEMENT, COMMUNE, RUE`) et non de la longueur du tableau reçu : quatre
   positions quoi qu'il arrive, `null` compris.
7. **La feuille « Meilleur tableau » passe en pleine largeur.** Quatre planches en demi-
   colonne descendraient sous 120 px, seuil sous lequel une planche ne rend plus son texte
   (`.docs/01-architecture.md` §4.9). Compteurs et complétude restent appariés ; médailles et
   meilleur tableau passent chacun en pleine largeur.

## Étapes, dans l'ordre

### 1. Spec d'abord — `packages/spec/src/profile.spec.ts`

Ajouts **uniquement** (aucun cas existant réécrit) :

- Amorçage d'un référentiel préfixé (`ref_regions`, `ref_departements`, `ref_communes`,
  `ref_odonymes`, `commune_odonymes`) dans le `beforeAll` existant, nettoyage dans `afterAll`
  avant la suppression des comptes. La région porte `blason_url` et pas `contour_url` ; la
  commune l'inverse ; la rue n'a aucune image.
- `Profil §2.9 — le meilleur tableau expose ses quatre planches` : `slots` de longueur 4,
  catégories `REGION, DEPARTEMENT, COMMUNE, RUE` dans cet ordre, `nom` non vide, `rarity`,
  `score`, `blasonUrl` = `contour_url` de la commune (donc `blasonOf` a bien replié),
  `blasonUrl` nul pour la rue.
- `Profil §2.9 — un tableau troué rend quatre positions dont des nulles` : un tableau dont
  seule la commune est posée ; `slots` de longueur 4, `slots[0]`, `slots[1]`, `slots[3]`
  nuls, `slots[2]` non nul, `bestTableau` non nul.
- `Profil §2.9 — sans tableau, le meilleur tableau reste nul` : `bestTableau === null`.
- `Profil §2.9 — la planche ne porte aucune donnée privée` : `collectKeys` sur la charge utile
  d'un joueur **avec** tableau complet (le cas existant tourne sur un joueur sans tableau,
  donc sans `slots`) ; aucun de `locked`, `currency`, `email`, `session`, `grid`,
  `treasure_index`, `userid`.
- `Profil §2.9 — les quatre emplacements coûtent une seule instruction` : client journalisé,
  appel direct à `loadPlayerProfile`, comptage des événements dont le SQL contient
  `showcase_slots` — exactement 1, pour un tableau complet comme pour un tableau à une carte.

Le cas « vitrine privée → 404, jamais 403 » **existe déjà** et n'est pas dupliqué.

Vérification : ces cas doivent être **rouges** avant l'étape 2 (le champ `slots` n'existe pas
encore ; TypeBox `additionalProperties: false` le supprime à la sérialisation).

### 2. API — `apps/api/src/services/profile.ts` et `apps/api/src/routes/players.ts`

- `PlayerBestTableau` gagne `slots: (PlayerBestTableauSlot | null)[]` avec
  `PlayerBestTableauSlot { category, refCode, rarity, score, nom, blasonUrl }`.
- Nouvelle fonction `loadBestTableauSlots(exec, tableauId)` : la requête unique décrite en
  décision 2, quatre lignes garanties, `blasonOf` appliqué par ligne.
- `loadBestTableau` : suppression du `continue` sur tableau incomplet, suppression du retour
  `null` quand `cardIds` est vide, puis un appel à `loadBestTableauSlots` pour le tableau
  retenu.
- `routes/players.ts` : `raritySchema`, `bestTableauSlotSchema`, et `slots` ajouté à
  `bestTableauSchema` en `t.Array(t.Union([slot, t.Null()]), { minItems: 4, maxItems: 4 })`.

### 3. Libellés — `apps/web/src/content/player-profile.ts`

`bestTableauCardsLabel`, `bestTableauSlotEmpty`, et l'aide
`bestTableauLinksLabel(links)` (pluriel français). Aucun texte en dur dans le JSX.

### 4. Page — `apps/web/src/routes/players.$playerId.tsx`

- `SLOT_ORDER = ['REGION','DEPARTEMENT','COMMUNE','RUE'] as const`.
- `BestTableauSheet` : bloc de quatre cellules `grid-cols-2 md:grid-cols-4`, chaque cellule
  rendant soit `Card variant="compact"` (nom, score, `refCode`, `blasonUrl` ; jamais `locked`,
  jamais `blasonCredit`), soit une case vide explicite portant `CATEGORY_LABELS[category]` et
  `bestTableauSlotEmpty`. Aucune requête, aucune planche réécrite.
- Déplacement de `BestTableauSheet` hors de la grille à deux colonnes.

### 5. Banc E2E — `packages/e2e/fixtures/vitrine-fixture.ts` (nouveau) et
`packages/e2e/tests/vitrine.spec.ts` (nouveau)

- La fixture insère deux lignes `tableaux` : une complète pour le compte principal (les quatre
  cartes du combo `E2E-R1 / E2E-D1 / E2E-C-RARE-0 / e2e-rue-inhabituelle-0`), une trouée pour
  `e2e-second` (sa seule carte, la commune). Idempotente, avec `clearVitrineTableaux()`.
- Le fichier de spec s'exécute **après** `tableau.spec.ts` (ordre alphabétique, `workers: 1`) et
  supprime ses lignes en `afterAll`, donc il ne perturbe aucun autre cas.
- Cas 1 : quatre planches visibles sur la vitrine du compte principal, avec leurs noms.
- Cas 2 : un emplacement vide explicite sur la vitrine trouée du second compte.
- Cas 3 : budget de ≤ 18 nœuds non-SVG sur chacune des quatre planches de la vitrine, avec la
  même formule que `design-system.spec.ts:360-374`.

### 6. Vérification

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_38' \
  dev bun run ci:check
```

puis le banc E2E complet. Objectif : lint, typecheck, ping, spécifications vertes ; E2E vert
sans `skip` ajouté.

## Impact

| Catégorie | Verdict et preuve | Traité en |
| :--- | :--- | :--- |
| Runtime | Un champ de réponse en plus ; aucune nouvelle route, aucune migration, aucun index | étape 2 |
| Régression | `bestTableau` devient non nul pour un joueur dont tous les tableaux sont troués — comportement voulu par l'étape 3 de la feuille de route ; aucun cas de spec existant ne l'assertait | étape 2 |
| Architecture | Une instruction SQL pour quatre emplacements, `blasonOf` reste le seul propriétaire du repli ; `Card.tsx` et `cards/` intouchés | étapes 2 et 4 |
| Documentation | Aucun `.docs` de mémoire modifié (interdit) ; journal de session dans `.docs/sessions/vitrine-planche/` | journal |
| Base de données | Aucune migration, `packages/db/src/schema.ts` intouché ; seul `packages/db/src/index.ts` gagne un paramètre **optionnel** de journalisation | étape 5 |

## Règles du projet qui gouvernent cette phase

| Règle | Pourquoi elle s'applique |
| :--- | :--- |
| Serveur autoritaire, aucune donnée privée exposée | `locked`, solde et session ne doivent pas sortir ; un cas lit les clés rendues |
| `blasonOf` unique propriétaire du repli blason/contour | Quatre planches, donc quatre replis : une seule règle |
| Budget de ≤ 18 nœuds non-SVG par planche | Quatre planches rendues sur une page publique |
| Tout s'exécute dans Docker | Aucun `bun`, `tsc` ou `vite` sur l'hôte |
| Spec-first, aucune spec existante affaiblie | Les cas neufs sont écrits et vus rouges avant le code |

## Décisions à assumer en revue

1. **« Une seule requête pour la page entière »** (critère 4) n'est pas littéralement
   atteignable : `loadPlayerProfile` émet déjà 10 à 14 instructions (session Better Auth
   exclue) et la phase n'a pas le droit de changer la forme des compteurs déjà servis. Ce qui
   est tenu et mesuré : **les quatre emplacements coûtent exactement une instruction**,
   invariante au nombre de cartes — c'est la décision 7 du brief et le risque nommé par la
   feuille de route. Le total de la page est **inchangé + 1** et sera donné dans la PR.
2. **Les planches n'affichent ni population ni nombre d'occurrences.** La décision 3 du brief
   fixe six champs et n'inclut ni l'un ni l'autre ; la planche rend `—` à ces endroits, ce que
   `formatNumber(null)` fait déjà. Ajouter un champ serait une extension de contrat.
3. **`apps/web/src/content/tickets.ts` est réutilisé** pour `CATEGORY_LABELS` plutôt que
   dupliqué dans `player-profile.ts`.

## Fichiers touchés

| Fichier | Nature |
| :--- | :--- |
| `packages/db/src/index.ts` | paramètre optionnel `{ log }` sur `createDb` |
| `apps/api/src/services/profile.ts` | `slots`, requête unique, tableau troué conservé |
| `apps/api/src/routes/players.ts` | schéma TypeBox de `slots` |
| `apps/web/src/content/player-profile.ts` | libellés et aide de pluriel |
| `apps/web/src/routes/players.$playerId.tsx` | quatre cellules, pleine largeur |
| `packages/spec/src/profile.spec.ts` | 5 cas neufs + amorçage référentiel |
| `packages/e2e/fixtures/vitrine-fixture.ts` | nouveau |
| `packages/e2e/tests/vitrine.spec.ts` | nouveau |
| `.docs/sessions/vitrine-planche/{plan,review,journal}.md` | nouveau |

Interdits respectés : aucune migration, aucun fichier de `packages/db/src/schema.ts`, aucun
`apps/web/src/components/ui/Card.tsx` ni `cards/`, aucun `.docs/03-active-task.md`, aucune
dépendance, aucun `skip`, aucune écriture sur `main`.
