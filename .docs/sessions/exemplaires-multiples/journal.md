# Journal — phase 47, les exemplaires multiples se lisent

Branche `feat/v2-47-exemplaires-multiples`, base `feat/v2-retours-wave-1`. Retour traité :
**R-007, constat A** (`.docs/10-retours-v2.md:238-284`). **Aucune migration, aucune route,
aucun champ de réponse, aucun index.** L'agrégation est entièrement côté client.

## 1. Le module d'agrégation

`packages/shared/src/exemplaires.ts`, exporté par `packages/shared/src/index.ts`
(`export * from './exemplaires';`, inséré à sa place alphabétique). Il ne dépend ni de React ni du
routeur, n'a **aucun état** et **une seule fonction publique** : `groupExemplaires(cards)`, qui rend
`{ key, representative, count, rank }[]`.

- **La clé** est `craftGroupKey({ category, refCode, rarity })` de
  `packages/shared/src/atelier.ts` — donc `(category, refCode, rarity)`, exactement la clé de
  L'Atelier depuis la phase 41. Jamais `(category, refCode)` : deux exemplaires de même `ref_code`
  et de raretés différentes restent deux groupes.
- **Un point unique de conversion** : le module construit l'objet
  `{ category, refCode, rarity }` une fois. La réponse de `GET /cards` est déjà en camelCase
  (`apps/api/src/routes/cards.ts:191`), il n'y a donc pas de `ref_code` à réécrire côté web ;
  aucun composant ne recopie ce mapping.
- **Représentant** : l'exemplaire le plus récent (`acquiredAt` ISO le plus grand), à défaut le
  premier rencontré. La réponse serveur est triée `acquired_at desc`, donc l'ordre d'affichage est
  conservé et aucune lecture supplémentaire n'est faite. Le lien du Cartel pointe sur l'`id` réel
  du représentant.
- **`locked` compris** : le compteur additionne tous les exemplaires du groupe, y compris ceux en
  vente (`locked`), conformément à la décision 7 du brief. Scinder sur `locked` produirait deux
  lignes de même clé.
- **Entrée jamais mutée** : seuls les objets de groupe créés par le module sont écrits ; les cartes
  reçues sont lues.

## 2. La spec

`packages/spec/src/exemplaires.spec.ts`, **fichier nouveau**, aucun cas existant touché. Six cas :
trois identiques → un groupe de 3 ; deux éditions de même `refCode` → deux groupes ; représentant
le plus récent sans tri d'entrée ; entrée non mutée (`structuredClone` + JSON) ; rang d'apparition ;
même `refCode` en catégories différentes → deux groupes.

Jouée **seule** dans Docker : `6 pass, 0 fail, 16 expect()`.

**Écart de procédure assumé.** L'historique git ne conserve pas de rouge : la spec et le module
sont arrivés dans le **même** commit (`040d2ec`), donc il n'existe pas de commit où la spec échoue.
La porte ne peut donc pas prouver le « spec d'abord » ; elle prouve seulement que la spec passe
seule et que les attentes existantes n'ont pas bougé (`packages/spec` n'a reçu qu'un fichier
nouveau, `git diff --name-only` le montre).

## 3. Les trois surfaces — une seule agrégation, trois lectures

| Surface | Calcul | Affichage |
| :--- | :--- | :--- |
| Le Cadastre (`routes/collection.tsx`) | `groupExemplaires(visible)` une fois, dans `CollectionBody` | une ligne par groupe ; badge `×N` dans la cellule de la ligne quand `count > 1` ; `total`, compteur `aria-live` et virtualisation sur `rows.length` (groupes) |
| Le Cartel (`routes/card.$cardId.tsx`) | `groupExemplaires(collectionQuery.data.items)` puis lecture `groups.find(key === craftGroupKey(card)).count` | ligne « Exemplaires » dans la fiche du Cartel |
| Tiroir de composition (`routes/tableau.tsx`) | `groupExemplaires(items)` une fois, puis `Map<key, count>` | badge `×N` sur chaque candidate quand `count > 1` |

Aucune surface n'a de `filter`/`reduce` de comptage : elles lisent toutes le `count` du groupe ou
la table construite à partir de lui. `CollectionCounters` continue de compter les cartes brutes
par catégorie (totaux de catégorie préexistants, pas des nombres d'exemplaires) et n'a pas été
modifié.

## 4. La marque « ×N » vit dans l'habillage de la ligne, pas dans la planche

Choix retenu : **le badge est dans la cellule de la ligne** (Cadastre) et dans la ligne du bouton
candidat (tiroir), jamais dans `components/ui/cards/`. Raisons :

- le budget de ≤ 18 nœuds non-SVG par planche de `design-system.spec.ts` n'est pas retouché ;
- la planche `w-14` du tiroir et `w-[120px]/md:w-[140px]` du Cadastre garde sa composition, et la
  hauteur de ligne reste celle du contenu — le badge est en ligne, `text-[11px]` (Cadastre) /
  `text-[10px]` (tiroir), jamais sous 10 px.

## 5. Ce que le `total` compte

`GET /cards` borne sa réponse (`limit` max 5000, `apps/api/src/routes/cards.ts:153`). Un total de
groupes ne peut donc pas être exact si la charge est bornée. La ligne visible reste
**« N cartes au total »** (`collectionTotalLabel`), vérité serveur. Le compteur `aria-live` devient
**« X cartes affichées sur Y cartes · Z groupes »** (`collectionGroupsLabel`) : il dit séparément
les cartes et les groupes, sans jamais annoncer un total de groupes qu'une page bornée ne
permettrait pas de connaître. Le préfixe « X cartes affichées », exigé par
`cadastre.spec.ts:144`, est conservé.

La virtualisation, elle, compte des **lignes = groupes** (`count: rows.length`), et
`getItemKey` utilise l'`id` du représentant. `estimateSize` reste une **estimation d'avant-mesure**
(220/192), pas une hauteur déclarée ; `measureElement` reste l'autorité.

## 6. Mesures

| Étape | Résultat exact |
| :--- | :--- |
| `ci:check` (lint, typecheck, ping PostgreSQL, spécifications, mesure de charge) | **555 spécifications, 29 fichiers, 0 échec** ; mesure de charge **2 tests, 1 fichier, 0 échec** ; « Gatekeeper vert » |
| Spec nouvelle seule | **6 tests, 1 fichier, 0 échec** |
| Banc E2E complet (`docker compose -f docker-compose.e2e.yml`) | **110 cas, 0 échec** |
| Hauteur de ligne, cas `cadastre.spec.ts:178-200` **rejoué inchangé** | **213 px** sous `rarete=RARE`, **213 px** sous `categorie=DEPARTEMENT&rarete=RARE` |

Le cas à 213 px n'a été ni réécrit, ni ajusté, ni relâché : il est passé tel quel, dans son commit
d'origine. La mesure après coup (spec jetable supprimée aussitôt) confirme **213 / 213**, identique
à la valeur de référence.

## 7. Ce que la phase laisse en dette, écrit et non corrigé

- **Le Cartel d'une carte d'autrui** lit le compteur du **spectateur**, pas du propriétaire :
  `GET /cards` est scopé au joueur connecté. C'est la seule source autorisée par le brief (aucune
  route nouvelle), et pour une carte possédée la réponse est juste. Le libellé reste
  « Exemplaires », sans prétendre dire « possédés par le propriétaire ». À trancher côté produit si
  le Cartel public doit taire le chiffre.
- **Tiroir et `locked`** : le compteur inclut les exemplaires en vente (décision 7), alors que le
  tiroir exclut les candidats `locked`. Un groupe de 3 dont 1 en vente affiche donc `×3` sur les
  deux candidates disponibles. C'est le contrat, mais les deux informations se lisent ensemble.
- **`filteredCardsLabel` supprimé** de `apps/web/src/content/collection.ts` : remplacé par
  `collectionGroupsLabel`, il n'avait plus aucun appelant (vérifié par `grep`). Une seule fonction
  de compteur plutôt que deux.

## 8. Mémoire projet

`.docs/01-architecture.md`, `.docs/02-database.md`, `.docs/03-active-task.md` : **non touchés**.
Aucun contrat de données ne change, aucune migration n'est prise.
