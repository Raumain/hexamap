# Registre des bugs

Bugs constatés en jeu, à corriger plus tard. Un bug par entrée, dans l'ordre de
découverte. Ne pas supprimer une entrée : la passer en `Corrigé` avec le numéro
de la PR qui la ferme.

| ID | Titre | Gravité | Statut |
| :--- | :--- | :--- | :--- |
| BUG-001 | Données de test de `packages/spec` présentes dans la base de développement | Haute | Ouvert — cause corrigée, données à nettoyer |
| BUG-002 | Une carte de collection peut référencer un référentiel inexistant | Moyenne | Ouvert |
| BUG-003 | `ref_regions` n'a aucune protection contre une donnée non réelle | Basse | Ouvert |
| BUG-004 | La modale de trouvaille ne se ferme jamais et recouvre Le Relevé | Haute | Corrigé — PR à ouvrir sur `feat/phase-15-cartel` |

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
- **Statut** : Ouvert
- **Constaté le** : 2026-11-18
- **Zone** : `packages/db` (schéma), `apps/api/src/services/draw.ts`

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

---

## BUG-003 — `ref_regions` n'a aucune protection contre une donnée non réelle

- **Gravité** : Basse
- **Statut** : Ouvert
- **Constaté le** : 2026-11-18
- **Zone** : `scripts/import`, `packages/db`

### Description

Rien n'empêche d'insérer dans `ref_regions` une ligne dont le code n'est pas un
code de région français — la table contient aujourd'hui `01, 02, 03, 04, 06, 11,
24, 27, 28, 32, 44, 52, 53, 75, 76, 84, 93, 94`. C'est ce qui a rendu BUG-001
invisible : la donnée de test était structurellement acceptable.

### Correction proposée

Contrainte `CHECK` sur le format du code, ou validation dans le pipeline d'import
(`scripts/import`) avec échec explicite. À faire en même temps que BUG-002, dans
la même migration.

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
