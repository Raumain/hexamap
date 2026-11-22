# Registre des bugs

Bugs constatés en jeu, à corriger plus tard. Un bug par entrée, dans l'ordre de
découverte. Ne pas supprimer une entrée : la passer en `Corrigé` avec le numéro
de la PR qui la ferme.

| ID | Titre | Gravité | Statut |
| :--- | :--- | :--- | :--- |
| BUG-001 | Données de test de `packages/spec` présentes dans la base de développement | Haute | Ouvert — cause corrigée, données à nettoyer |
| BUG-002 | Une carte de collection peut référencer un référentiel inexistant | Moyenne | Corrigé (branche `feat/v2-32-socle`) |
| BUG-003 | `ref_regions` n'a aucune protection contre une donnée non réelle | Basse | Corrigé (branche `feat/v2-32-socle`) |
| BUG-004 | La modale de trouvaille ne se ferme jamais et recouvre Le Relevé | Haute | Corrigé — PR à ouvrir sur `feat/phase-15-cartel` |
| BUG-005 | Sur mobile, Les Planches et Mes Offres sont inatteignables | Moyenne | Corrigé — PR à ouvrir sur `fix/bug-005-salles-secondaires-mobile` |
| BUG-006 | Les planches sont illisibles en petit format (case grattée, Cadastre) | Moyenne | Corrigé — branche fix/bug-006-plates-illegibles |
| BUG-007 | Le tiroir de sélection s'ouvre au bas de la page, hors écran | Moyenne | Corrigé (PR à ouvrir sur `fix/bug-007-overlays-viewport`) |
| BUG-008 | Les planches du tiroir se chevauchent | Basse | Corrigé (branche `fix/bug-008-tiroir-lignes`) |
| BUG-009 | Un jumelé peut dépasser la rareté RARE | Haute | Corrigé sur `fix/pre-deploy-blockers` |
| BUG-010 | Les médailles sociales sont inatteignables | Moyenne | Corrigé sur `fix/pre-deploy-blockers` |

Gravités : `Haute` (donnée utilisateur fausse ou perte de données), `Moyenne`
(comportement incorrect sans perte), `Basse` (robustesse, hygiène).

---

## BUG-001 — Données de test de `packages/spec` présentes dans la base de développement

- **Gravité** : Haute
- **Statut** : Ouvert — la cause est corrigée en Phase 12, les données sont
  toujours présentes et doivent être nettoyées.
- **Constaté le** : 2026-11-18
- **Zone** : `packages/spec`, base de développement

### Symptôme observé

Une carte « Région ee368bb0 B » apparaît dans une collection utilisateur. Cette
région n'existe pas.

### Cause racine

`packages/spec/src/tickets.spec.ts` (`seedReference()`) insère un jeu de
référence préfixé par `crypto.randomUUID().slice(0, 8)` :

- `ref_regions` : `<prefix>-R1`, `<prefix>-R2` (`Région <prefix> A` / `B`) ;
- `ref_departements` : `<prefix>-D1`, `<prefix>-D2` ;
- `ref_communes` : 12 lignes `<prefix>-C-<rareté>-<n>`.

Le nettoyage est fait dans un `afterAll` manuel, sans transaction englobante.
Tant que la suite tournait sur `DATABASE_URL` — c'est-à-dire sur la base de
développement — et que le test `Plan §5.6 — un référentiel totalement vide reste
une erreur explicite` dépassait le délai de 5 s de `bun:test`, l'`afterAll`
expirait à son tour : **aucune ligne n'était supprimée**.

Le tirage de région (`apps/api/src/services/draw.ts`, `drawRegion`) sélectionne
uniformement dans `ref_regions`. Il a donc pu tirer `ee368bb0-R2` et en faire une
carte réelle pour l'utilisateur.

### Preuve

Trois exécutions de la suite ont fui dans la base de développement, avec des
préfixes `9e3d8605`, `ee368bb0` et `fe52d8a6` :

| Table | Lignes de test restantes |
| :--- | :--- |
| `ref_regions` | 6 (`<préfixe>-R1` / `-R2` pour les 3 préfixes) |
| `ref_departements` | 6 (`<préfixe>-D1` / `-D2`) |
| `ref_communes` | 24 (`ee368bb0` : 12, `fe52d8a6` : 12 ; `9e3d8605` déjà purgé) |
| `ref_odonymes` | 36 (`<préfixe> Rue <rareté> <n>`, 12 par préfixe) |

L'état est **partiel et incohérent** (les communes d'un préfixe ont disparu, mais
pas ses régions ni ses départements) : signature d'un `afterAll` interrompu au
milieu de ses suppressions.

Une seule carte utilisateur est concernée :

```sql
select uc.id, uc.category, uc.ref_code, uc.rarity, uc.score, r.nom
from user_cards uc
join ref_regions r on r.code = uc.ref_code
where uc.category = 'REGION' and uc.ref_code !~ '^[0-9]+$';
-- 1 ligne : ee368bb0-R2 / COMMUNE / 200 / « Région ee368bb0 B »
```

Requêtes de contrôle — elles doivent toutes renvoyer `0` après nettoyage :

```sql
select count(*) from ref_regions      where code !~ '^[0-9]+$';
select count(*) from ref_departements where code !~ '^[0-9]+$' and code not in ('2A', '2B');
select count(*) from ref_communes     where code_insee !~ '^[0-9]';
select count(*) from ref_odonymes     where nom_affichage ~ '^[0-9a-f]{8} Rue';
```

### Correction proposée

1. **Prévention (déjà livrée en Phase 12)** : `bun run ci:check` refuse de lancer
   la spec si `TEST_DATABASE_URL` est absente ou identique à `DATABASE_URL`. La
   suite ne peut plus viser la base de développement.
2. **Nettoyage des données** — script de réparation à écrire (ne pas improviser en
   SQL à la main sur une base contenant de vraies collections) :
   - supprimer les `user_cards` dont le `ref_code` pointe vers ces lignes ;
   - supprimer les lignes `ref_*` préfixées ;
   - vérifier au préalable qu'aucune autre table ne les référence
     (`commune_odonymes`, `ticket_reveals`).
3. **Durcissement de la spec** : rendre `seedReference()` atomique (une seule
   transaction) ou déplacer le nettoyage dans un `afterAll` qui ne peut pas être
   annulé par un timeout de test.

---

## BUG-002 — Une carte de collection peut référencer un référentiel inexistant

- **Gravité** : Moyenne
- **Statut** : Corrigé (branche `feat/v2-32-socle`)
- **Constaté le** : 2026-11-18
- **Zone** : `packages/db` (schéma), `scripts/import`, `apps/api/src/services/draw.ts`

### Description

`user_cards.ref_code` est une simple colonne texte : elle n'a **aucune clé
étrangère** vers `ref_regions`, `ref_departements`, `ref_communes` ou
`ref_odonymes`, et `category` n'est pas contrainte à correspondre à la table
référencée.

Conséquences :

- si une ligne de référentiel est supprimée ou remplacée (réimport, correction
  d'un nom, nettoyage comme celui de BUG-001), les cartes déjà possédées
  deviennent orphelines : `apps/api/src/routes/cards.ts:114` résout le nom par
  `noms.get(...) ?? ''`, donc la carte s'affiche **sans nom** dans la collection ;
- rien n'empêche d'insérer une carte `REGION` pointant vers un code d'odonyme.

### Correction proposée

À trancher, car une FK stricte rendrait un réimport destructeur :

- soit une FK `(category, ref_code)` composite par table, avec `ON DELETE RESTRICT`,
  et une procédure de réimport qui ne supprime jamais une ligne référencée ;
- soit aucune FK (choix actuel assumé) mais un contrôle au moment du tirage et un
  écran d'administration signalant les cartes orphelines.

La première option est la plus sûre pour l'intégrité des collections ; la seconde
est moins invasive. Décision à prendre avant d'écrire la migration.

### Correction livrée (2026-11-22)

**La clé étrangère `(category, ref_code)` a été écartée, et la raison est mesurée, pas
supposée.** Elle est inatteignable dans le périmètre de la phase, parce que la suite de
spécifications est gelée et fabrique volontairement des données hors référentiel :

| Fixture existante | Ce qu'elle fait | Ce qu'une FK lui ferait |
| :--- | :--- | :--- |
| `achievements.spec.ts:295-306` | carte `COMMUNE` avec `ref_code = '<préfixe>-<uuid8>'`, **sans aucun référentiel semé** | rejet `23503` à l'insertion |
| `cards.spec.ts:97`, `charges.spec.ts:128`, `market.spec.ts:78`, `tableaux.spec.ts:134,184`, `tickets.spec.ts:219,997` | sèment des `ref_regions` aux codes `<préfixe>-R1` | rejet `23514` par le `CHECK` de BUG-003 |
| `tickets.spec.ts:345-363` et `afterAll` équivalents | suppriment les `ref_*` **avant** `"user"`, donc pendant que des cartes les citent | rejet `23503` → chaque nettoyage en échec |

Réécrire ces fixtures est interdit (`.docs/01-architecture.md` §4.8). La correction porte donc
sur **les deux chemins qui produisent réellement l'orphelin** :

1. **Le chemin destructeur est fermé.** `packages/db/migrations/0014_ref_integrity.ts` pose
   `ref_truncate_guard()` et trois triggers `BEFORE TRUNCATE` : vider `ref_regions`,
   `ref_departements` ou `ref_communes` lève `23503` dès qu'une carte de la catégorie
   correspondante existe. C'était exactement l'opération de l'import
   (`truncateReferenceTables`). **`ref_odonymes` n'est pas gardée** : deux cas gelés de
   `tickets.spec.ts` la vident volontairement pour éprouver la robustesse du tirage ; les cartes
   de rue ne sont donc protégées que par le point 2.
2. **Le réimport ne casse plus une collection.** `scripts/import` gagne `--merge` : upsert
   (`on conflict … do update set`) puis élagage par
   `pruneUnreferencedReferenceRows` (`packages/db/src/reference-integrity.ts`), qui ne supprime
   une ligne périmée que si **aucune** carte ne la cite. Le mode sans `--merge` reste la remise à
   zéro d'un référentiel vierge, et bute désormais sur la garde s'il y a des collections.
3. **L'orphelin devient visible.** `orphan_user_cards()` rend les cartes sans référentiel, là où
   `apps/api/src/routes/cards.ts:114` les affichait sans nom sans que rien ne puisse les compter.

**Preuve, rouge avant et verte après** — `packages/spec/src/ref-integrity.spec.ts` :

- `attemptTruncateRegions()` rendait `'VIDAGE_ACCEPTE'` avant la migration, rend `'23503'` après ;
- `orphanUserCards(db)` rend la carte fabriquée hors référentiel ;
- `pruneUnreferencedReferenceRows(db, 'REGION', keep)` supprime la ligne périmée
  (`deleted = 1`) et **conserve** celle qu'une carte cite (`preserved = 1`).

**Ce qui reste ouvert, et qui est écrit ici plutôt que passé sous silence.** Une insertion
directe en SQL d'une carte pointant vers un code inexistant reste acceptée : `ref_code` n'a
toujours pas de clé étrangère. Aucun chemin applicatif ne peut la produire (`drawRegion`,
`drawDepartement`, `drawCommune`, `drawRue` lisent tous leur `ref_code` dans la table qu'ils
citent), mais le verrou n'est pas déclaratif. `orphan_user_cards()` est le filet qui rend une
telle ligne trouvable au lieu de la laisser s'afficher sans nom.

---

## BUG-003 — `ref_regions` n'a aucune protection contre une donnée non réelle

- **Gravité** : Basse
- **Statut** : Corrigé (branche `feat/v2-32-socle`)
- **Constaté le** : 2026-11-18
- **Zone** : `scripts/import`, `packages/shared`, `packages/db`

### Description

Rien n'empêche d'insérer dans `ref_regions` une ligne dont le code n'est pas un
code de région français — la table contient aujourd'hui `01, 02, 03, 04, 06, 11,
24, 27, 28, 32, 44, 52, 53, 75, 76, 84, 93, 94`. C'est ce qui a rendu BUG-001
invisible : la donnée de test était structurellement acceptable.

### Correction proposée

Contrainte `CHECK` sur le format du code, ou validation dans le pipeline d'import
(`scripts/import`) avec échec explicite. À faire en même temps que BUG-002, dans
la même migration.

### Correction livrée (2026-11-22)

**La seconde voie a été retenue, et c'est le bug lui-même qui l'autorisait.** Un `CHECK` de
table sur `ref_regions.code` est incompatible avec les fixtures que cette phase n'a pas le droit
de réécrire : cinq fichiers de `packages/spec` sèment des régions aux codes `<préfixe>-R1` et
`scripts/import/src/e2e-seed.ts` sème `E2E-R1` / `E2E-R2`. Le `CHECK` aurait rendu la suite de
spécifications et le banc entier rouges.

1. **`packages/shared/src/reference-codes.ts`** porte la seule autorité : `FRENCH_REGION_CODES`
   (les 18 codes officiels — métropole et outre-mer) et `isFrenchRegionCode()`. Le domaine est
   partagé, donc la spec et l'import regardent la même liste.
2. **`scripts/import` refuse avant d'écrire.** `assertFrenchRegionCodes()` s'exécute juste après
   `loadGouvReferenceData` et avant `insertRegions` : un code hors liste lève
   `REFERENCE_CODE_INVALID` en nommant les codes fautifs, et **aucune ligne de région n'est
   écrite**. La garde est donc plus tôt que le `CHECK` (rien n'entre, même transitoirement).
3. **Preuve** — `packages/spec/src/ref-integrity.spec.ts` : les 18 codes officiels sont acceptés,
   et `'99'`, `'2A'`, `'R1'`, `'E2E-R1'`, `'<préfixe>-R1'`, `''`, `'53 '` (espace final) et
   `'53\n'` sont refusés. Le cas nomme explicitement `E2E-R1` et le préfixe de spec : si
   quelqu'un réintroduit un référentiel synthétique dans l'import, le refus est visible.

**Écart assumé, écrit ici.** La table elle-même n'a toujours pas de contrainte : c'est une garde
de frontière, pas un verrou déclaratif. Elle couvre le seul chemin qui écrit `ref_regions` en
masse ; elle ne couvre pas un `INSERT` manuel. Le prix d'un `CHECK` de table était la réécriture
de sept fixtures gelées, et il a été jugé plus élevé que ce qu'il apportait.

---

---

## BUG-004 — La modale de trouvaille ne se ferme jamais et recouvre Le Relevé

- **Gravité** : Haute
- **Statut** : Corrigé — PR à ouvrir sur `feat/phase-15-cartel`
- **Constaté le** : 2026-11-19
- **Zone** : `apps/web/src/routes/tickets.$ticketId.tsx`,
  `apps/api/src/services/ticket.ts`

> Gravité Haute par exception à la définition de ce registre : il n'y a ni donnée
> fausse ni perte, mais le joueur perd l'accès à la boucle de jeu tant que le
> ticket troué reste `ACTIVE`. Une modale qui ne se ferme pas n'est pas un simple
> « comportement incorrect ».

### Symptôme observé

Après avoir révélé une Pépite, l'écran de grattage est entièrement recouvert par
une modale « Pépite découverte » qui affiche la planche, sans bouton de fermeture.
Changer de salle puis revenir sur le ticket — ou cliquer « Reprendre mon ticket »
depuis Le Relevé — ramène la même modale. La grille est inatteignable, donc plus
aucun coup de grattoir n'est possible ; et comme le ticket est toujours `ACTIVE`,
Le Relevé ne propose pas non plus « Obtenir un ticket ».

### Cause racine

Deux défauts se cumulent.

1. **La modale est dérivée d'un état serveur persistant, jamais d'un événement.**
   `apps/web/src/routes/tickets.$ticketId.tsx:156-157` retrouve la case Pépite dans
   `ticket.cells`, et `:291` affiche la modale dès que `ticket.treasureFound` est
   vrai. Or `treasureFound` est **recalculé à chaque lecture** par
   `maskTicket` (`apps/api/src/services/ticket.ts:178-208`) à partir de
   `ticket_reveals` : dès que la case Pépite figure dans les révélations, l'indicateur
   reste vrai pour toute la vie du ticket. Aucun chemin d'écriture ne le remet à
   faux — ce n'est pas une colonne, c'est une dérivation. La modale revient donc
   obligatoirement à chaque visite, y compris après rechargement complet.
2. **La modale n'a aucune sortie autre qu'un lien de navigation.**
   `tickets.$ticketId.tsx:292-318` : `role="dialog"` en `fixed inset-0 z-50`
   (`:296`), sans bouton de fermeture, sans gestionnaire `Escape`, sans clic
   extérieur, sans état local « vue ». La seule affordance est le lien
   « Ranger dans le cadastre » (`:310-315`), qui quitte la salle. Elle recouvre
   aussi le bouton « Nouveau ticket » d'un ticket épuisé (`:264-285`), qui devient
   donc inatteignable.

L'hypothèse « j'ai cliqué sur une case déjà découverte » est écartée par le code :
une case révélée est rendue par `RevealedCell`, un simple `<div>` sans gestionnaire
(`apps/web/src/components/revealed-cell.tsx:24`), et la route ne monte `ScratchCell`
que pour les cases non révélées (`tickets.$ticketId.tsx:201-215`). Un envoi
accidentel serait de toute façon refusé en `409 CELL_ALREADY_REVEALED`
(`apps/api/src/routes/tickets.ts:248-256`).

La Pépite peut en revanche être révélée **sans que le joueur la vise** : une case
Belvédère révèle une case orthogonale tirée au hasard
(`apps/api/src/routes/tickets.ts:361-370`), qui peut être la Pépite. C'est le
scénario le plus probable ici.

### Preuve

1. Gratter jusqu'à révéler la case `kind === 'TREASURE'`, directement ou par
   cascade Belvédère.
2. La modale s'affiche et ne propose que « Ranger dans le cadastre ».
3. Naviguer vers `/collection`, puis revenir sur `/` : le bouton affiché est
   « Reprendre mon ticket » (le ticket est toujours `ACTIVE`).
4. Cliquer dessus réaffiche la modale : `GET /tickets/current` renvoie
   `treasureFound: true`, recalculé depuis `ticket_reveals`.
5. `POST /tickets` répondrait `409 TICKET_ALREADY_ACTIVE`
   (`apps/api/src/routes/tickets.ts:123-132`, index partiel
   `tickets_one_active_per_user`), donc aucun nouveau bordereau n'est ouvrable.

### Correction proposée

1. **Rendre la modale dismissable** : état local initialisé par identifiant de
   ticket, bouton « Fermer », gestionnaire `Escape`, clic sur le fond, et focus
   rendu à la grille à la fermeture (`aria-modal` exige déjà la gestion du focus).
2. **Ne plus dériver une modale d'un état persistant** : déclencher l'annonce sur
   la réponse de grattage (`effects.includes('TREASURE_FOUND')`), et rendre le cas
   persistant avec la ligne non bloquante déjà prévue à `:228-232`. Une découverte
   est un événement, pas un état.
3. **Ne pas couvrir les actions de sortie** : le lien « Ranger dans le cadastre »
   et le bouton « Nouveau ticket » doivent rester atteignables tant que la modale
   est ouverte.
4. **Test de non-régression** : parcours Playwright qui révèle la Pépite via une
   cascade Belvédère, ferme la modale, revient sur la grille, puis ouvre un nouveau
   bordereau après épuisement.

À ne pas faire : masquer la modale en vidant `ticket_reveals` ou en ajoutant une
colonne « déjà vue ». Le défaut est côté client (état dérivé + aucune sortie), pas
dans la persistance du tirage.

### Correction livrée

Corrigé le 2026-11-19, uniquement côté web. Aucun changement d'API, de
`ticket_reveals` ni de la dérivation `treasureFound` : le serveur reste
autoritaire et `maskTicket` est intact.

1. **La modale est un événement, plus un état.** `tickets.$ticketId.tsx:47` ajoute
   `celebration` (`useState<TicketCell | null>`) ; il n'est alimenté que par
   `onSuccess` de la mutation de grattage, quand `data.effects` contient
   `TREASURE_FOUND` (`:73-77`). `ticket.treasureFound` n'ouvre plus rien.
2. **Sorties et accessibilité.** `role="dialog"` + `aria-modal` +
   `aria-labelledby` vers le nom de la planche (`:322-326`), bouton « Fermer »
   (`:353-361`), `Escape` (`:50-60`), clic sur le fond via `onPointerDown` gardé
   par `event.target === event.currentTarget` (`:328-330`). À l'ouverture le focus
   va au bouton de fermeture ; à la fermeture, le nettoyage de l'effet le rend à
   la grille (`ref` sur le `fieldset`, `:221`). Le lien « Ranger dans le cadastre »
   ferme aussi la modale avant de naviguer.
3. **Trace non bloquante.** La ligne « Pépite trouvée » s'affiche dès qu'une case
   `TREASURE` est révélée et qu'aucune modale n'est ouverte (`:251-261`) ; elle
   porte le lien « Voir dans le cadastre » et ne recouvre plus le bouton
   « Nouveau ticket ».
4. **Libellés centralisés.** `apps/web/src/content/tickets.ts:63-67` :
   `treasureFoundLink`, `treasureEyebrow`, `treasureFallbackName`,
   `treasureModalLink`, `closeModal`.

Vérifié dans Docker : `bun run lint`, `bun run typecheck`,
`bun test packages/spec` (140 pass, 0 fail), `bun run build`.

---

## BUG-005 — Sur mobile, Les Planches et Mes Offres sont inatteignables

- **Gravité** : Moyenne
- **Statut** : Corrigé — PR à ouvrir sur `fix/bug-005-salles-secondaires-mobile`
- **Constaté le** : 2026-11-19
- **Zone** : `apps/web/src/components/layout/nav-items.ts`,
  `bottom-tab-bar.tsx`, `sidebar.tsx`, `app-shell.tsx`

### Symptôme observé

Sur téléphone, un joueur peut composer une planche depuis **La Planche** (`/tableau`),
mais aucun chemin ne mène à la liste de celles qu'il a créées (**Les Planches**,
`/tableaux`) ni à **Mes Offres** (`/market/mine`). Les deux salles n'existent que dans
le rail de bureau, qui n'est pas rendu sous `md`. Le joueur peut donc écrire sans
jamais pouvoir relire.

### Cause racine

`PRIMARY_NAV` porte quatre salles (`nav-items.ts:21-46`) et `SECONDARY_NAV` en porte
trois autres (`nav-items.ts:49-73`) : *Les Planches*, *Mes Offres*, *Les Archives`.
Or la barre basse n'itère que `PRIMARY_NAV` (`bottom-tab-bar.tsx:31`) et le rail est
masqué sous 768 px (`sidebar.tsx:36` — `hidden … md:flex`). Aucun autre point d'entrée
n'existe : l'en-tête mobile (`app-shell.tsx:16-36`) ne contient que le titre de la
salle, le solde et la déconnexion.

S'y ajoute une confusion de nommage qui rend le manque invisible : **La Planche**
(singulier, composer une planche) est une salle principale, **Les Planches** (pluriel,
les relire) une salle secondaire. Rien dans l'interface ne signale que la seconde
existe.

### Preuve

À 390 px de large, la barre basse expose exactement quatre liens (Relevé, Cadastre,
Planche, Comptoir). `/tableaux` et `/market/mine` restent accessibles uniquement en
saisissant l'URL.

### Correction

Le cinquième contrôle l'a emporté sur le menu de compte : l'en-tête mobile ne porte aucune
affordance de compte (seulement la bourse), un menu serait donc à inventer, et sortir d'une
barre de navigation est plus découvrable que de cacher trois salles derrière un contrôle de
compte. Trois fichiers :

- `apps/web/src/components/layout/nav-items.ts` : `MORE_SHEET` (les libellés « Plus »,
  « Autres salles », « Fermer ») et `isSecondaryRoom(pathname)`, bâti sur l'égalité stricte
  d'`isNavItemActive`, inchangée — c'est elle qui distingue déjà `/tableau` de `/tableaux`.
- `apps/web/src/components/layout/more-sheet.tsx` (créé) : `OverlayPortal` → voile
  `bg-cabinet/80` → `role="dialog" aria-modal="true"`, géométrie reprise de `CardDrawer`
  (`rounded-t-panel`, `border-t border-brass/30`, `bg-cabinet-raised`, `p-5`,
  `shadow-lifted`, `max-h-[76vh]`), poignée `aria-hidden`, titre nommé par `useId()`, bouton
  de fermeture `aria-label="Fermer"`, écoute d'Échap avec nettoyage, trois entrées de
  `SECONDARY_NAV` à `min-h-[44px]`, `aria-current="page"` sur la salle courante seulement.
- `apps/web/src/components/layout/bottom-tab-bar.tsx` : cinquième `<button>` (et non un
  `Link` : il ouvre, il ne navigue pas), `aria-haspopup="dialog"`, `aria-expanded`, filet
  de laiton quand `isSecondaryRoom(pathname)`, et le retour de focus au contrôle à la
  fermeture.

**La découverte de la correction : une asymétrie de visibilité.** `sidebar.tsx` enveloppe
**tout** son bloc de navigation — principal et secondaire — dans un `{user ? … : « Le
cabinet ouvre ses tiroirs… »}`, alors que la barre basse se rend sans condition. Afficher la
feuille à un visiteur anonyme aurait donc exposé trois salles que le rail lui cache. Le
cinquième contrôle est monté derrière `useSession()`, et la parité est verrouillée par un cas
anonyme.

**Deux écarts connus, non traités ici.**

1. `DESIGN_SYSTEM.md` §9.1 rend **Les Archives** `/import-status` conditionnelle (« si
   l'utilisateur y a droit »), mais rien n'applique cette condition : ni le rail ni la feuille
   ne portent le contrôle de droit. La feuille garde la parité avec le rail.
2. Le cas e2e anonyme est **vert par construction**, pas par observation rouge : il vérifie
   l'absence du cinquième contrôle, que le code n'a jamais monté. Il garde la règle, il ne
   prouve pas une régression corrigée.

---

## BUG-006 — Les planches sont illisibles en petit format

- **Gravité** : Moyenne
- **Statut** : Corrigé — branche `fix/bug-006-plates-illegibles`
- **Constaté le** : 2026-11-19
- **Zone** : `apps/web/src/components/ui/cards/*`,
  `components/revealed-cell.tsx`, `routes/collection.tsx`

### Symptôme observé

Dans la grille de grattage, les planches révélées se chevauchent et sont coupées :
on ne distingue ni le nom, ni la rareté, ni le score. Dans Le Cadastre, la miniature
est lisible pour les communes, mais le blason ou le contour est à peine visible pour
les **Régions** et les **Départements**, et la planche **Rue** paraît écrasée.

### Cause racine

Cinq mécanismes se cumulent.

1. **Les minima de `clamp()` sont en pixels fixes.** Titre ≥ 10–13 px
   (`region-card.tsx:92`, `departement-card.tsx:104`, `commune-card.tsx:123`,
   `rue-card.tsx:79`), étiquettes d'en-tête 7 px, score 10 px, blason 18 px. Sous
   ~150 px de large, ce sont les minima qui s'appliquent : le contenu ne rétrécit plus,
   il déborde, et `overflow-hidden` (`card-shell.ts:43`, puis une seconde couche dans
   chaque gabarit) le coupe silencieusement.
2. **L'écu du Département a un plancher plus haut que la case.** Bouclier
   `h-[clamp(46px,42cqi,88px)] w-[clamp(40px,37cqi,76px)]`
   (`departement-card.tsx:94`) : 46 px de haut à lui seul, pour une zone de contenu
   d'environ 44 px dans une case grattée. Le nom et le score sont donc rognés.
3. **La case grattée n'accorde que 64 × 50 px à la planche.** `revealed-cell.tsx:24-31`
   retire 12 px de `p-1.5`, 2 px de bordure et une ligne de distance de 10 px ; puis
   `h-full w-full` (`:37`) écrase l'`aspect-[5/7]` de `card-shell.ts:44`. Sur 50 px de
   haut : en-tête (7 px) + titre sur deux lignes (21 px) + pied (≈ 13 px) = 41 px pour
   44 px disponibles, sans marge pour le sceau.
4. **La case grattée ne transmet aucune donnée d'illustration.**
   `revealed-cell.tsx:32-38` ne passe ni `blasonUrl`, ni `refCode`, ni `population`,
   ni `occurrenceCount` : `Card.tsx:32,43` retombe sur `null` / `'—'`. La planche d'une
   case grattée **ne peut donc afficher aucun blason, pour aucune catégorie**, et
   affiche `—` à la place de la population ou du nombre d'occurrences.
5. **Le gabarit Rue ne rend aucune image, par construction.**
   `rue-card.tsx:69-76` n'affiche que deux étiquettes texte ; il n'existe pas
   d'emplacement de blason. Une rue ne montrera donc jamais ni armoiries ni contour,
   quelle que soit la taille.

Le point 4 explique l'écart observé au Cadastre : la Commune est la **seule**
catégorie dont l'image est garantie (`contour_url` n'est rempli que pour les communes
sans armoiries, `.docs/02-database.md` §5), donc la seule qui « rend bien ». Une
Région ou un Département sans blason Wikidata n'a rien à afficher, et son repli est une
étiquette de code, pas une silhouette.

### Preuve

À 390 px de large, la grille `grid-cols-4 gap-2` de `tickets.$ticketId.tsx:223` donne
des cases d'environ 78 px. La zone de contenu de la planche mesure alors 64 px de large
sur 50 px de haut, pour un contenu dont le plancher structurel est de 41 px de texte
plus un écu de 46 px selon la catégorie.

### Correction proposée

1. **Agrandir la planche dans la case grattée** : trois colonnes sous `sm` (piste écartée, voir
   le correctif : elle découple la grille affichée de la distance de Manhattan), et déplacer
   la distance de Manhattan dans une pastille absolue en coin plutôt que sur une ligne
   réservée. Le budget tactile de 44 px reste tenu.
2. **Un vrai gabarit miniature.** `card-shell.ts` accepte déjà `decorative` (art seul,
   `aspect-[4/5]`), mais aucun appelant ne l'utilise. Rendre, dans la case et dans le
   registre, la variante décorative avec le nom, la rareté et le score **sous** la
   planche, hors du cadre : plus rien ne peut se chevaucher.
3. **Transmettre les données d'illustration à `revealed-cell`.** Vérifier d'abord que la
   charge utile de révélation porte bien `blasonUrl` et `refCode` ; si non, l'ajouter
   côté `packages/spec` avant l'implémentation (spec-first), puis dans le select et le
   type Eden. Sans cette étape, aucune correction de gabarit ne fera apparaître un blason.
4. **Registre du Cadastre** : miniature à 120 px sur mobile et 140 px sur bureau, ou
   bascule sur la variante décorative avec légende.
5. **Rue** : décider d'un emplacement d'image (contour du département d'appartenance)
   ou assumer l'absence et remonter le nom d'un cran typographique.

À ne pas faire : descendre un texte sous 10 px, supprimer le sceau de rareté (la rareté
ne doit jamais reposer sur la seule couleur) ou réduire la case sous 44 px de côté.

### Correctif (2026-11-19)

- **La case grattée rend la planche entière.** Elle ne monte plus la miniature décorative : la
  planche garde sa structure complète — en-tête, nom, pied, sceau de rareté et score — et c'est
  elle qui porte la lecture, exactement comme au Cadastre. Un **bandeau de 16 px** la surmonte,
  à l'intérieur de la case : marque `Jumelé` à gauche sur les cases `TWIN`, distance de Manhattan
  à droite, les deux en `text-[10px]`. Plus rien ne recouvre la gravure.
- **La grille du ticket reste `grid-cols-4` à toute largeur**, et les trois sortes de cases
  (`ScratchCell`, `LockedCell`, case révélée) plus les placeholders de chargement partagent
  `aspect-[3/5]` : aucune ligne irrégulière, et la case donne à la planche une largeur et une
  hauteur de carte.
- **La ligne « Bordereau <id> » et l'astuce clavier ont été retirées** à la demande de
  l'utilisateur : la promesse « sélectionnez une case et appuyez sur Entrée ou Espace » ne tenait
  pas sur téléphone. Le compteur de coups en quatre points reste, aligné à droite, et le
  gestionnaire `onKeyDown` reste avec son anneau `focus-visible` — `packages/e2e/global-setup.ts`
  gratte ses fixtures par `focus()` puis `press('Enter')`.
- **La tentative en trois colonnes a été annulée.** Elle découplait la grille affichée de la
  distance de Manhattan : à 390 px le tableau se rendait 3 + 3 + 3 + 3 + 3 + 1, et trois colonnes
  visibles valent quatre colonnes logiques. Les cases reprennent de la hauteur plutôt que la
  grille des colonnes.
- **La charge utile de révélation gagne `blasonUrl` et `blasonCredit`.** `refCode` y était
  déjà : le défaut tenait à `revealed-cell.tsx`, qui ne le transmettait pas, d'où l'écu
  Département imprimant le repli `'—'` de `Card.tsx:43`. Le repli
  `blason_url ?? contour_url` n'a plus qu'un propriétaire, l'aide `blasonOf`, partagée par
  `resolveCardAssets` et `resolveCardMeta` ; les deux constructeurs remplissent la charge
  utile — `routes/tickets.ts` pour la réponse de grattage, `loadMaskedTicket` de
  `services/ticket.ts` pour la lecture persistée.
- **Le Cadastre agrandit sa planche** au lieu de basculer en légende : 84/96 px deviennent
  **120/140 px**, la première piste de grille passe de 96 à 140 px et la foulée du virtualiseur
  de 152/142 à **220/192**, pour que `measureElement` et l'estimation s'accordent.
- **La Rue garde son absence d'image.** `ref_odonymes` n'a aucune colonne de blason,
  `resolveCardAssets` rend `null` pour `RUE` (`draw.ts:437-440`), et emprunter le contour du
  département d'appartenance coûterait une recherche supplémentaire pour un ornement que le nom
  porte déjà.
- **La planche Rue a été complétée, parce qu'elle est désormais la seule surface de lecture.**
  Son pied affiche le score — il imprimait auparavant l'ornement « Rue de France » et aucun
  score, donc une rue révélée n'en montrait aucun —, son plancher typographique du nom descend de
  13 à **10 px** (`clamp(10px,8.6cqi,21px)`), et son bloc « Occurrences » rejoint la densité
  seconde.
- **`.plate-optional` efface la densité seconde sous 110 px.** La règle vit dans
  `apps/web/src/styles.css`, sous `@container (max-width: 110px)` : elle masque l'unité `pts`, le
  code de référence d'une région ou d'une commune, et le bloc d'occurrences d'une rue. Sans elle,
  le pied poussait le sceau de rareté hors de la planche sur un écran de 390 px — le banc a
  attrapé un débordement de 10 px du sceau avant livraison.
- **Le banc vérifie la proportion.** La boîte de la planche révélée doit garder
  `hauteur / largeur` à 0,06 près de `7 / 5` : « La planche doit garder sa proportion de carte,
  sinon elle redevient une vignette. » Le plancher de 60 px de large s'écrit
  `Math.min(60, cellBox.width - 16)`, parce que 60 px n'est pas atteignable à 390 px.

Deux corrections ont été **imposées par le banc, pas choisies**. La rangée de pastilles du
Cadastre a reçu `flex-wrap` — l'élargissement de la planche faisait apparaître un débordement
horizontal de **2 px** à 320 px, attrapé par un test existant — et son étiquette `text-[9px]`
est remontée à `text-[10px]`. Par ailleurs `design-system.spec.ts`, cas « canvas — aucun
filtre… », interrogeait `count()` avant que la requête du ticket n'ait répondu : défaut
preexistant, révélé par le ticket actif que le nouveau cas laisse derrière lui, corrigé par un
localisateur `.or()` patient. Deux miniatures décoratives portaient enfin un texte fixe sous
10 px (`departement-card.tsx:44`, `text-[8px]` ; `rue-card.tsx:52`, `text-[9px]`), toutes deux
passées à `text-[10px]`.

**La règle qui reste** : le tableau se montre **4 × 4 à toute largeur** — les quatre colonnes sont
la géométrie du domaine (`index = ligne * 4 + colonne`), jamais un choix de mise en page, car la
pastille de distance annonce une distance calculée sur cette grille et mentirait sur un plateau
redessiné. **La lecture vit sur la planche elle-même** : un plateau de téléphone n'a aucune largeur
à céder, donc une planche n'est jamais rétrécie pour faire de la place à un texte hors d'elle —
elle reçoit la case et c'est sa densité seconde qui tombe. Aucun texte visible sous **10 px** ; le
budget de ≤ 18 nœuds non-SVG reste mesuré sur `article.exhibit`, qui rend désormais sa structure
complète sans qu'aucune légende ne soit ajoutée.

---

## BUG-007 — Le tiroir de sélection s'ouvre au bas de la page, hors écran

- **Gravité** : Moyenne
- **Statut** : Corrigé (PR à ouvrir sur `fix/bug-007-overlays-viewport`)
- **Constaté le** : 2026-11-19
- **Zone** : `apps/web/src/styles.css` (`.enter-salon`),
  `apps/web/src/components/layout/app-shell.tsx`,
  `apps/web/src/routes/tableau.tsx`

### Symptôme observé

Sur téléphone, choisir un emplacement de La Planche ouvre le tiroir de sélection **sous
le contenu de la page** : il faut faire défiler vers le bas pour le découvrir. Sur
bureau le défaut est moins visible, parce que la page tient souvent dans la fenêtre.

### Cause racine

Le tiroir est bien `fixed inset-x-0 bottom-0` (`tableau.tsx:477-482`), mais **son
ancêtre `<main>` crée un bloc conteneur**, donc `fixed` se résout contre la boîte de
`main` — aussi haute que le contenu — et non contre la fenêtre.

- `app-shell.tsx:55-58` : `<main class="enter-salon …">`.
- `styles.css:285-287` : `.enter-salon { animation: enter-salon 180ms var(--ease-cabinet) both; }`.
- `styles.css:319-327` : les keyframes se terminent par `transform: translateY(0);`.

Le `fill-mode: both` **conserve l'état final** après l'animation. Un `transform`
calculé différent de `none` — et `translateY(0)` en est un — fait de `<main>` le bloc
conteneur des descendants en `position: fixed`. Le tiroir est donc ancré en bas de la
page, pas en bas de l'écran.

Sous `prefers-reduced-motion: reduce`, `styles.css:351-363` ne fait que raccourcir
`animation-duration` à 1 ms pour `.enter-salon` ; le `transform: none` de `:361` ne vise que
`.exhibit` / `.exhibit:hover`. Avec `fill-mode: both`, une animation de 1 ms remplit encore sa
dernière image clé : le défaut est donc **permanent à tous les réglages de mouvement**, jamais
intermittent.

**Le même défaut frappe la modale de Pépite** (`tickets.$ticketId.tsx`, `fixed inset-0
z-50`, également enfant de `main`) : son voile couvre le contenu, pas la fenêtre,
quand la page est défilée.

### Preuve

À 390 × 844, ouvrir un emplacement vide de La Planche. Dans l'inspecteur, `main`
porte `transform: translateY(0)` et le tiroir est positionné à la hauteur totale du
document ; `main.getBoundingClientRect().height` dépasse `innerHeight`.

### Correction proposée

1. **Rendre au `main` son `transform: none` une fois l'animation finie** : remplacer
   `fill-mode: both` par `backwards` dans `.enter-salon` (`styles.css:286`). L'état
   final des keyframes est déjà la position naturelle ; le `transform` disparaît donc
   après 180 ms et `main` cesse d'être un bloc conteneur. Correction d'un mot, qui vaut
   pour **tous** les overlays `fixed` de l'application.
2. **Alternative durable** : rendre tiroirs et modales dans un portail
   (`createPortal(document.body)`), ce qui les rend insensibles à tout futur ancêtre
   transformé. À préférer si d'autres animations doivent un jour transformer `main`.
3. Test Playwright mobile : ouvrir le tiroir après avoir fait défiler la page, et
   vérifier que sa boîte est à moins de `innerHeight` du haut de la fenêtre.

À ne pas faire : passer le tiroir en `absolute` (il suivrait alors le défilement) ou
supprimer l'animation d'entrée (elle porte l'identité de la salle).

### Correction livrée

Corrigé le 2026-11-19, uniquement côté web. Aucune migration, aucun changement de schéma,
aucune évolution du contrat d'API, aucune dépendance nouvelle.

1. **`fill-mode: backwards` sur `.enter-salon`.** `styles.css:286` passe de `both` à
   `backwards`, un mot. L'animation est visuellement identique : la dernière image clé vaut
   déjà l'état naturel de `main` (`transform: translateY(0)`, `opacity: 1`). Avec `backwards`,
   `main` ne porte plus de `transform` après les 180 ms et cesse d'être un bloc conteneur pour
   les descendants `position: fixed`. Les keyframes `enter-salon` et le bloc
   `prefers-reduced-motion` sont inchangés.
2. **`components/ui/overlay-portal.tsx`.** Nouveau composant :
   `createPortal(children, document.body)`. Les deux overlays appartenant à une route y sont
   rendus — le tiroir de La Planche (`routes/tableau.tsx`) et la modale de Pépite
   (`routes/tickets.$ticketId.tsx`) — en enveloppant uniquement la racine retournée : ni
   `aria-*`, ni focus, ni état, ni classe modifiés. Les deux overlays deviennent insensibles à
   tout futur ancêtre transformé.
3. **Décalage de bureau corrigé.** `md:left-[232px]` du tiroir s'ajoutait au `md:pl-[232px]`
   de `main` (≈ 464 px de décalage sur bureau) ; ancré sur `document.body`, il dégage désormais
   correctement le rail de 232 px.

**Preuve rouge, avant correction**

- `mobile.spec.ts`, nouveau cas, deux projets tactiles :
  `expect(box.y).toBeGreaterThanOrEqual(0)` → `Expected: >= 0, Received: -27.25`.
- `design-system.spec.ts`, cas `<main>` :
  `Expected "none", Received "matrix(1, 0, 0, 1, 0, 0)"`.
- `design-system.spec.ts`, cas portail : `expect(inMain).toBe(false)` → `Received: true`.

**Preuve verte, après correction**

- `mobile.spec.ts` + `design-system.spec.ts` : 29 passed, 3 skipped.
- Banc complet (chromium, pwa, Pixel 7, iPhone 13) : **39 passed, 3 skipped** — chromium
  12 → 14, Pixel 7 8 → 9, iPhone 13 8 → 9, pwa 7 inchangé.
- `bun run ci:check` : lint, typecheck, ping PostgreSQL, 158 spécifications, 792 `expect()` —
  vert.

Nouveaux cas : « mobile — le tiroir de sélection reste dans la fenêtre après défilement »,
« design system — main ne conserve aucun transform après l'entrée en salle », « bureau — le
tiroir est rendu hors de main et dégage le rail ». Ils ouvrent le tiroir par un unique
localisateur patient —
`getByRole('button', { name: /Emplacement libre/ }).or(getByRole('button', { name: 'Modifier' })).first()` :
`count()` n'attend pas et courait contre la requête de collection.

**Ce qui n'a pas changé** : `.enter-plate` conserve `both` (ornement de feuille, jamais ancêtre
d'un élément `fixed`) ; le rail, la barre d'onglets et l'invitation de mise à jour sont frères de
`<main>` et n'ont jamais été concernés. BUG-004 reste corrigé : sa modale de Pépite retrouve
simplement sa géométrie de fenêtre par la même cause racine, et ses sorties (`Escape`, clic sur
le fond, focus rendu à la grille) sont intactes.

---

## BUG-008 — Les planches du tiroir se chevauchent

- **Gravité** : Basse
- **Statut** : Corrigé
- **Constaté le** : 2026-11-19
- **Zone** : `apps/web/src/routes/tableau.tsx`

### Symptôme observé

Dans le tiroir de sélection, les planches se touchent et se chevauchent : le contenu
paraît comprimé, sans respiration entre les lignes.

### Cause racine

La hauteur de ligne et la hauteur de la planche sont incohérentes.

- Ligne virtualisée (`tableau.tsx:526-535`) : `h-16`, soit **64 px**, et
  `estimateSize: () => 64` (`:459`) fixe le pas de défilement à 64 px.
- Planche (`:547`) : `className="w-14 shrink-0"` avec `decorative`, donc
  `aspect-[4/5]` (`card-shell.ts:44`) → 56 × 5/4 = **70 px** de haut.
- `items-center` centre la planche dans la ligne, elle dépasse donc de ~3 px en haut et
  en bas ; la ligne suivante commençant à `translateY(64px)`, deux planches voisines se
  recouvrent de ~6 px.

`measureElement` mesure le bouton (64 px), pas la planche : le virtualiseur conserve
donc le pas de 64 px et le chevauchement est systématique.

### Preuve

Dans le tiroir ouvert, `getBoundingClientRect().height` d'une planche vaut 70 px pour
des lignes espacées de 64 px. `document.querySelectorAll` sur les lignes donne des
`top` successifs séparés de 64.

### Correction proposée

1. **Aligner les deux mesures** : soit `h-[76px]` et `estimateSize: () => 76`, soit
   réduire la planche (`w-12`, 48 px → 60 px de haut) pour tenir dans 64 px.
   La première option garde la planche lisible, la seconde garde la densité.
2. **Vérifier le budget tactile** : la ligne entière est un `<button>`, elle reste
   au-dessus de 44 px dans les deux cas.
3. Test Playwright mobile : ouvrir le tiroir, comparer la hauteur d'une planche au pas
   vertical entre deux lignes, et exiger un écart positif.

À ne pas faire : retirer `aspect-[4/5]` de la planche décorative — c'est ce ratio qui
la distingue des planches de collection.

### Correction livrée

- **La ligne ne déclare plus sa hauteur.** `apps/web/src/routes/tableau.tsx` : `h-16` retiré du
  `<button>` de ligne, remplacé par `py-2`. La ligne est désormais dimensionnée par sa planche —
  `w-14`, `decorative`, donc `aspect-[4/5]`, soit 70 px — plus 16 px de respiration, soit
  **86 px**. `items-center`, `measureElement`, `data-index` et `overscan: 8` sont inchangés : la
  mesure porte enfin sur un élément dont la hauteur est celle du contenu.
- **Le pas suit la mesure.** `estimateSize: () => 64` devient
  `estimateSize: () => DRAWER_ROW_ESTIMATE`, constante déclarée juste au-dessus de `CardDrawer`
  et documentée : elle ne sert qu'à l'estimation d'avant-mesure du virtualiseur, et doit valoir la
  mesure pour que le défilement ne saute pas au premier passage.
- **Ce qui n'a pas changé.** `aspect-[4/5]`, `w-14`, `variant="compact"`, `gap-3`,
  `transition-colors` (aucun `transition-all`) et le budget DOM de ≤ 18 nœuds non-SVG.

**Preuve rouge, avant correction.**
`packages/e2e/tests/mobile.spec.ts`, cas « mobile — deux planches du tiroir ne se recouvrent
pas », joué sur `Pixel 7` contre l'image de production reconstruite depuis le code d'avant
correction :

```
Error: La ligne du tiroir doit être plus haute que sa planche, sinon elle la laisse déborder.
expect(received).toBeGreaterThanOrEqual(expected)
Expected: >= 74
Received:    64
```

La planche mesurant 70 px (`w-14` × 5/4) et la ligne 64 px, le pas du virtualiseur valait 64 :
deux planches voisines se recouvraient de 6 px.

**Preuve verte, après correction.** Le même cas sur les deux projets tactiles, puis le banc
complet :

```
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/mobile.spec.ts
  34 passed, 2 skipped
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  58 tests, 56 passed, 2 skipped, aucun flaky
```

Le cas ne se contente pas de constater l'absence de recouvrement : il exige
`row.height >= plate.height + 4`, `pitch >= row.height`, un écart compris entre 4 et 32 px, et
une ligne d'au moins 44 px. Une nouvelle dérive de la hauteur de planche ou du pas sera donc vue.

Le compte E2E ne possède pas forcément les quatre catégories : le cas parcourt les quatre
emplacements et tolère un tiroir vide (« Aucune carte éligible pour cet emplacement. »), puis
mesure le premier qui propose au moins deux planches.

**À ne pas faire.** Redéclarer une hauteur fixe sur la ligne (`h-16`, `h-[76px]`) : c'est ce
doublon hauteur déclarée / hauteur dérivée qui a produit le défaut, et une constante de plus ne
le corrigerait qu'une fois. Et ne pas retirer `aspect-[4/5]` de la planche décorative : c'est ce
ratio qui la distingue des planches de collection.

**Vérification.** `bun run ci:check` : `1/4 Lint`, `2/4 Typecheck`, `3/4 Base de données`,
`4/4 Spécifications` — **159 spécifications, 11 fichiers**. Aucune migration, aucun changement
de schéma ni de contrat d'API, aucune dépendance nouvelle.

---

## Modèle d'entrée

```md
## BUG-NNN — Titre court à l'impératif

- **Gravité** : Haute | Moyenne | Basse
- **Statut** : Ouvert | En cours | Corrigé (PR #NNN)
- **Constaté le** : AAAA-MM-JJ
- **Zone** : fichiers ou modules concernés

### Symptôme observé

Ce que l'utilisateur voit.

### Cause racine

Le mécanisme, avec `fichier:ligne`.

### Preuve

Requête SQL, extrait de log ou scénario de reproduction.

### Correction proposée

Les étapes, et ce qu'il ne faut pas faire.
```

---

## BUG-009 — Un jumelé peut dépasser la rareté RARE

- **Gravité** : Haute
- **Statut** : Corrigé sur `fix/pre-deploy-blockers`
- **Constaté le** : 2026-11-20
- **Zone** : `apps/api/src/services/ticket.ts`

### Symptôme observé

Un ticket peut révéler une case « Lieu jumelé » portant une carte MYTHIQUE, ÉPIQUE ou
LÉGENDAIRE. La règle du GDD (§2.6) limite les jumelés à INHABITUELLE ou RARE : la case livre
donc une carte dont la rareté ne correspond pas à sa nature.

### Cause racine

Le service cherchait le second jumelé dans deux viviers. Le premier, filtré par `rarete`,
respectait la règle. Le second, `communesWithOdonymeAny`, ne portait **aucun prédicat de
rareté** : il rendait n'importe quelle commune partageant l'odonyme, rareté comprise. Dans la
branche RUE, c'était la seule source consultée, donc un odonyme dont une commune est MYTHIQUE
suffisait à produire un jumelé hors règles.

### Preuve

`packages/spec/src/tickets.spec.ts`, cas « un jumelé ne dépasse jamais la rareté RARE, même
quand la Pépite est une rue », avant correction :

```
Expected to contain "MYTHIQUE"
Received: ["INHABITUELLE","RARE"]
```

### Correction livrée

`communesWithOdonymeAny` est supprimée, ainsi que son appel dans la branche RUE. Le vivier
national filtré fournit toujours le second jumelé, et la garde `503` qui refuse un ticket de
moins de deux jumelés est intacte. Le même cas est vert après le correctif.

---

## BUG-010 — Les médailles sociales sont inatteignables

- **Gravité** : Moyenne
- **Statut** : Corrigé sur `fix/pre-deploy-blockers`
- **Constaté le** : 2026-11-20
- **Zone** : `apps/api/src/services/achievements.ts`

### Symptôme observé

Un joueur peut accumuler des amitiés acceptées sans jamais débloquer `SOCIAL_FIRST_FRIEND`
ni `SOCIAL_FRIENDS_10` : les trois médailles de la famille sociale ne frappent jamais.

### Cause racine

`collectMetrics` rendait `friendsAccepted: null` en dur, quelle que soit la base. Le calcul
des primes comparait donc un seuil à `null`, ce qui ne satisfait aucune condition. La table
`friendships` n'était jamais interrogée pendant l'évaluation.

### Preuve

`packages/spec/src/achievements.spec.ts`, avant correction :

```
Expected: 10
Received: null
```

### Correction livrée

`collectMetrics` compte désormais les lignes `friendships` au statut `ACCEPTED`, dans les
deux sens (demandeur ou destinataire), dans la même transaction que le versement de la prime.
Deux cas verrouillent le comportement : dix amitiés `ACCEPTED` débloquent
`SOCIAL_FIRST_FRIEND` et `SOCIAL_FRIENDS_10` une seule fois, avec exactement une ligne de
`currency_ledger` par prime ; des relations `PENDING` ou `DECLINED` ne débloquent rien.
`profileComplete` reste `null` : aucune médaille n'en dépend, et l'inventer sans seuil aurait
été une seconde vérité.
