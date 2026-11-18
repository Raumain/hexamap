# Registre des bugs

Bugs constatés en jeu, à corriger plus tard. Un bug par entrée, dans l'ordre de
découverte. Ne pas supprimer une entrée : la passer en `Corrigé` avec le numéro
de la PR qui la ferme.

| ID | Titre | Gravité | Statut |
| :--- | :--- | :--- | :--- |
| BUG-001 | Données de test de `packages/spec` présentes dans la base de développement | Haute | Ouvert — cause corrigée, données à nettoyer |
| BUG-002 | Une carte de collection peut référencer un référentiel inexistant | Moyenne | Ouvert |
| BUG-003 | `ref_regions` n'a aucune protection contre une donnée non réelle | Basse | Ouvert |

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
