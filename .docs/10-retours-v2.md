# 10 — Retours sur la v2

> **Retours produit sur la v2 livrée, à traiter en priorité.**
> Ce fichier n'est pas lu en début de session : il ne fait pas partie des ordres du jour.
> Chaque entrée porte **la preuve** (fichier + ligne) constatée le 2026-11-22 sur `v2`, **ce qui
> est demandé**, et **les pièges** — spec gelée, cas E2E, contrat de données — pour qu'aucun ne
> soit découvert en cours de route.
> Les idées non urgentes restent dans `.docs/09-idees.md`.
> Aucune de ces entrées n'est implémentée : elles sont notées, pas traitées.

| # | Sujet | Zone | Touche le contrat DB |
| :--- | :--- | :--- | :--- |
| R-001 | Retirer la confirmation d'adresse électronique | `routes/compte.tsx`, `routes/account.ts`, `auth.ts` | non |
| R-002 | ~~Retirer La Sonnette de `/compte`~~ — **sans objet, décision du 2026-11-22** | — | non |
| R-003 | Lien vers la vitrine depuis `/friends` | `routes/friends.tsx` | non |
| R-004 | Retirer la page CGV de l'interface | `routes/cgv.tsx`, `content/legal.ts` | non |
| R-005 | Atlas : distinguer régions / départements, zoom, contours | `routes/atlas.tsx` | non |
| R-006 | Atlas : départements d'outre-mer — **route B décidée** | `scripts/import/`, `atlas.tsx`, migration | **oui** : `view_box` sur les trois tables de référentiel |
| R-007 | Exemplaires multiples lisibles + place de L'Atelier | `routes/collection.tsx`, `routes/cards.ts` | non (agrégation calculable) |

---

## R-001 — La confirmation d'adresse électronique n'a plus lieu d'être

**Constat.** La page compte exige une vérification d'adresse que le produit ne veut pas.
`apps/web/src/routes/compte.tsx:260-274` affiche une pastille « vérifié / non vérifié »
(`ACCOUNT_ROOM.email.verified|unverified`, classe `border-oxide` si non vérifié), et le formulaire
de courriel (`compte.tsx:278-308`) est **désactivé** quand `verificationOpen` est faux
(`compte.tsx:244,296`). Le drapeau vient du serveur : `apps/api/src/routes/account.ts:229` rend
`{ deletion, emailVerification }`, alimenté par `apps/api/src/auth.ts:79-82`
(`emailVerification` + `sendVerificationEmail`), et transporté par
`apps/web/src/lib/account.ts:159,174`.

**Demandé.** Aucune confirmation : on autorise simplement le changement d'adresse. Donc
disparaissent : la pastille d'état, le texte qui explique qu'il faut confirmer, et la condition qui
ferme le formulaire. Le champ reste éditable en permanence.

**Pièges.**
- Le drapeau `emailVerification` est une **capacité rendue par l'API** : `packages/spec/src/account.spec.ts`
  exerce probablement les deux états. Si la capacité disparaît de la charge utile, la spec tombe —
  et une PR d'implémentation ne réécrit pas une attente de spec pour la faire passer. Décider :
  soit la capacité reste (valeur toujours `false` sans transport de courriel), soit elle est
  retirée **avec** la spec correspondante, dans une PR qui le dit.
- `sendVerificationEmail` dans `auth.ts` sert aussi à autre chose (réinitialisation ?) : vérifier
  avant de débrancher.
- `emailVerified` survit dans `"user"` (colonne Better Auth) : on ne la supprime pas, on cesse de
  la montrer et de la conditionner.

---

## R-002 — ~~La Sonnette de la page `/compte` disparaît~~ — **sans objet**

**Décision du titulaire, 2026-11-22 : La Sonnette reste dans `/compte`.** La section n'est pas
retirée ; le retour venait d'une lecture incomplète de l'écran. Aucun code à changer.

Ce qui suit est conservé comme mémoire du point d'entrée unique, utile le jour où l'abonnement
devra bouger :

**Constat.** `apps/web/src/routes/compte.tsx:93-95` monte `<PushOptIn />`
(`apps/web/src/components/push/push-optin.tsx`, import ligne 7) dans une section titrée par
`PUSH_ROOM.title` / `PUSH_ROOM.description` (`apps/web/src/content/push.ts`). C'est le **seul**
point d'entrée de l'abonnement aux notifications poussées : le retirer rendrait la phase 43
inatteignable (`push_subscriptions`, `push_preferences` de `0020_push`, `push-scheduler`, routes
`/api/v1/push/*` et gestionnaires `push` du service worker resteraient sans abonné).

---

## R-003 — Un ami n'a pas de lien vers sa vitrine

**Constat.** `apps/web/src/routes/friends.tsx` rend le pseudo d'un ami dans un `<span>` non
cliquable (`friends.tsx:344-345`, composant `EntryRow`). `entry.player.id` existe déjà et sert
seulement aux actions accepter / retirer / bloquer (`friends.tsx:220,270,279,293`). Aucun `Link`,
aucun `players/` dans le fichier.

**Demandé.** Depuis `/friends`, pouvoir ouvrir la vitrine publique d'un ami.

**Piège.** Une vitrine privée répond **404 par dessein** (`.docs/01-architecture.md` §2.9), et la
même section impose de **ne pas proposer un lien mort** — la règle est déjà écrite pour Le
Palmarès : n'offrir le lien que lorsque `profile_public` est vrai. Or on ne sait pas encore si la
charge utile de `/friends` porte ce drapeau : à vérifier côté `apps/api/src/services/friends.ts`.
Sans lui, on produit un lien qui mène à un 404 silencieux — pire que l'absence de lien.
Deuxième piège : le libellé du lien doit être le pseudo, pas « voir le profil » (un lien sur un
pseudo est la convention du web, et le banc E2E sélectionne par rôle et libellé).

---

## R-004 — La page CGV sort de l'interface

**Constat.** La route existe (`apps/web/src/routes/cgv.tsx`, contenu dans
`apps/web/src/content/legal.ts`), et elle est liée depuis **deux** endroits seulement, tous deux
générés par une constante unique `LEGAL_LINKS` (`content/legal.ts:39-43`) :
- `apps/web/src/routes/home.tsx:261-266` (pied de l'accueil) ;
- `apps/web/src/components/layout/app-shell.tsx:82-87` (pied de toutes les salles).

Les deux rendus sont conditionnés par `LEGAL_PAGES_ENABLED` (`content/legal.ts:17`, aujourd'hui
`true`). `components/layout/nav-items.ts:135-137` ne déclare que des **titres** de salle
(« Conditions de vente », « Mentions légales », « Confidentialité »), pas des liens de navigation.
Aucun lien depuis Le Seuil (`routes/login.tsx`) ni depuis `/compte`.

**Demandé.** Retirer la page CGV de l'interface : elle ne sert plus, la boutique étant retirée
(`SHOP_ENABLED = false`).

**Pièges.**
- Retirer l'entrée de `LEGAL_LINKS` suffit à faire disparaître le lien des **deux** pieds de page,
  mais laisse `routes/cgv.tsx` accessible par URL. Décider : route supprimée, ou route conservée
  hors interface. Le plus propre est la suppression complète (fichier + entrée + titre dans
  `nav-items.ts:135`).
- **`mentions-legales` et `confidentialite` restent** : la confidentialité est un préalable écrit
  à la publication de la suppression de compte (`.docs/03-active-task.md`, « Ce qui reste » §4).
  Ne pas les emporter avec la CGV.
- `SHOP_REQUIRE_TOS_CONSENT` (§2.8 de `.docs/01-architecture.md`) référence des CGV : le réglage
  est éteint par défaut et la boutique est fermée, mais `.docs/05-deploiement.md` et
  `.docs/06-cadre-juridique.md` mentionnent la page — ces deux documents doivent suivre, sinon la
  mémoire projet décrit une interface qui n'existe plus.

---

## R-005 — Atlas : régions et départements se ressemblent, et le zoom manque

**Constat, vérifié ligne à ligne dans `apps/web/src/routes/atlas.tsx`.**
- Régions et départements sont poussés dans **la même** liste `MapEntity` (`nationalMapEntities`,
  régions l.233-245, départements l.246-258) et rendus par **la même** boucle (`entities.map`,
  l.310-323). Le seul discriminant de style est `entity.possessed` : `stroke-brass` contre
  `stroke-veil-strong`, `strokeWidth` 2 contre 0,75 (l.319-321), et `fillOpacity` de
  `0.06 + 0.39 × coverageRatio` pour les deux (l.239-242 et l.252-255). **Aucun traitement
  différencié par catégorie** : mêmes aplats, même filet.
- Le remplissage est `fill-vellum-2` pour tout le monde (l.319), l'opacité portée par
  `fillOpacity={entity.fillOpacity}` (l.316).
- Les communes possédées reçoivent un aplat plus dense (`(hasCommuneCard ? 0.45 : 0.06)`, l.270),
  pas un contour.
- Le SVG est `aria-hidden`, `role="presentation"`, **sans aucun gestionnaire de pointeur**
  (l.285-291) : l'interaction vit dans la table équivalente, par choix (phase 35).
- Un seul SVG par niveau, avec `openDepartement` pour le niveau départemental (l.155 et suivants).

**Demandé.**
1. Les **régions** portent un **contour** (pas d'aplat).
2. Les **départements** portent un **fond coloré**, pour qu'on les distingue des régions.
3. Cliquer un **département** l'agrandit avec plus de détail — donc le niveau départemental devient
   atteignable **depuis la carte**, pas seulement depuis la table.
4. Les **communes possédées** sont marquées par un **contour**, pas par un aplat.

**Pièges.**
- **Le SVG décoratif est une décision d'accessibilité, pas un hasard.** Ajouter un `onClick` sur un
  `<path>` est permis (aucun état React par mouvement de pointeur, seule la règle du §4.6 est en
  jeu), mais la table doit rester le chemin accessible : un `<path>` cliquable doit être
  `role="button"`/`<a>` focusable, ou l'interaction reste doublée dans la table. Le plus simple et
  le plus sûr : garder le SVG `aria-hidden` et rendable, et faire du département un élément de la
  table **et** une zone cliquable déléguée à la même action.
- **Un aplat par défaut sur 96 départements** coûte peu, mais l'échelle de couleur doit rester
  celle du domaine : `fillOpacity` est aujourd'hui une couverture de collection, pas une rareté.
  Décider ce que le fond coloré **signifie** (couverture ? rareté ? neutre ?) avant de le peindre —
  sinon la carte raconte deux choses à la fois.
- Les quatre changements touchent `packages/e2e/tests/` : le banc vérifie déjà la carte (le cas
  d'accessibilité et la table). Un nouveau cas doit asserter que régions et départements n'ont
  **pas** le même style, sinon la règle n'est tenue par rien.

---

## R-006 — Les départements d'outre-mer manquent dans l'Atlas — **route B retenue**

**Constat, et la cause est géométrique, pas un oubli d'affichage.** Le référentiel est projeté dans
un `viewBox` **métropolitain** (`0 0 1000 1000`, lon `[−5,5 ; 9,9]`, lat `[41,2 ; 51,3]`). Toute
géométrie dont la bbox est disjointe de ce cadre est classée **`out_of_viewbox`** :
`scripts/import/src/atlas-projection.ts:379` et `:423` (retour `{ verdict: 'out_of_viewbox', rings: [] }`),
verdict consommé par `scripts/import/src/atlas.ts:32` et `:221`, qui laisse **`path_d = NULL`**.
Aucun code ne cite `971`/`974` : ce n'est pas une liste d'exclusion, c'est la projection.
Bilan mesuré en phase 33 : **13 régions sur 18**, **96 départements sur 101**.

**Ce que la mesure du 2026-11-22 dit, et elle change la conclusion.**

```sql
regions      (01 02 03 04 06)           5 lignes · geom 5   · path_d 0
departements (971 972 973 974 976)      5 lignes · geom 5   · path_d 0
communes     (dép. 971..976)          129 lignes · geom 129 · path_d 0
```

**Les géométries d'outre-mer sont déjà en base.** Il n'y a **aucun réimport à faire** : ce qui
manque est le `path_d` dérivé de 139 lignes qui portent déjà leur `geom`. La première version de
cette entrée annonçait un réimport — c'était une extrapolation, corrigée ici. Il n'y a pas non
plus de « trous de référentiel » à combler : la phase 33 les avait déjà classés `out_of_viewbox`,
pas absents.

**Deux routes étaient possibles, aucune ne demandait un réimport. Décision du titulaire,
2026-11-22 : route B.**

### Route A — écartée le 2026-11-22

Les tracés d'outre-mer auraient pu être générés une fois hors ligne depuis les `geom` déjà présents,
versionnés comme les blasons, et rendus dans un encart. Zéro migration, zéro contrat touché. Elle
a été **écartée** parce que deux propriétaires de formes (la base pour la métropole, le dépôt pour
l'outre-mer) divergent au premier changement d'import, et parce que le niveau commune — ouvrir un
département d'outre-mer sur ses communes, cf. R-005 — demanderait de toute façon une géométrie
cohérente entre une commune et ses voisines, donc une donnée, pas un asset par entité.

### Route B — retenue

On ajoute une colonne de cadre aux trois tables de référentiel, et un **backfill ciblé** des 139
lignes calcule `path_d` dans leur propre cadre. Aucune réécriture des ~35 000 lignes
métropolitaines, aucun import.

**Le piège de conception, à trancher avant la migration : un cadre se partage, il ne se dérive pas
par entité.** Si chaque commune recevait son propre `view_box` (la bbox de sa géométrie), les 129
communes d'un même département porteraient 129 cadres différents et **ne pourraient pas s'assembler**
en une carte départementale : chacune occuperait tout le cadre et elles se superposeraient. Le cadre
appartient donc au **groupe** — le DROM — et se recopie sur la région, son département et ses
communes :

```text
un cadre par DROM (5 au total), calculé sur la bbox de l'ensemble région + département + communes,
puis écrit à l'identique sur toutes les lignes du groupe.
métropole : le cadre reste celui d'aujourd'hui — `0 0 1000 1000`, valeur par défaut de la colonne.
```

**Ce que ça demande, dans l'ordre.**
1. `.docs/02-database.md` **d'abord** : la colonne (`view_box text not null default '0 0 1000 1000'`
   sur `ref_regions`, `ref_departements`, `ref_communes`), sa sémantique, et le type Kysely
   correspondant. Aucune autre colonne, aucune table.
2. Une **nouvelle** migration dans `packages/db/migrations/` (jamais toucher `0015_atlas_paths`),
   rejouable : `add column if not exists`, en SQL brut (Kysely 0.29 n'expose pas
   `ifNotExists()` sur les colonnes, §1 de `.docs/02-database.md`).
3. Un **script de backfill idempotent** (`scripts/import`) qui, pour chaque DROM : calcule la bbox
   du groupe, écrit le même `view_box` partout, puis `path_d` pour la région, le département et
   les 129 communes. Rejouable : une seconde passe doit réécrire **zéro** tracé — c'est le critère
   qu'utilise déjà l'étape atlas de la phase 33.
4. L'API de l'Atlas rend le cadre avec le tracé ; les **schémas `response` sont fermés** (TypeBox),
   donc un champ nouveau se déclare dans le modèle partagé, et les cas d'`atlas.spec.ts` qui
   asserte la forme de la charge utile doivent être lus avant d'écrire, pas après.
5. Côté web, un **encart par DROM** (petits cadres empilés à côté de la métropole, la convention des
   cartes de France), chaque encart consommant le `view_box` de son groupe. Le clic d'ouverture d'un
   département (R-005) fonctionne alors à l'identique : même route, même table, même code.

**Ce que ça ne coûte pas.** Les 5 entités n'aggravent pas les mesures déjà fragiles de l'Atlas — le
test `p95 ≤ 200 ms` et le plafond de charge utile par département (`.docs/03-active-task.md`,
« Ce qui reste » §5) portent sur la métropole ; le champ `view_box` ajoute quelques octets par ligne.

---

## R-007 — Les exemplaires multiples ne se lisent pas, et L'Atelier semble posé là

**Constat A — les doublons sont invisibles.** `GET /cards`
(`apps/api/src/routes/cards.ts:164-186`) fait un `selectAll` sur les `user_cards` de l'utilisateur,
**une ligne par carte**, triée par `acquired_at desc`, sans `groupBy` et sans champ `count` par
carte. Le Cadastre (`apps/web/src/routes/collection.tsx`) affiche donc trois fois la même planche
pour trois exemplaires, sans jamais dire « ×3 ». Les seuls `count` de `cards.ts` sont des agrégats
de statistiques (`{ rarity, count }` l.58, `{ category, count }` l.62, calculés l.229-242) —
des totaux par rareté et par catégorie, pas un nombre d'exemplaires. Aucune trace d'`occurrence`,
`exemplaire` ou `doublon` dans `collection.tsx` (hors un commentaire l.257).

**Ce qui existe déjà et qu'il faut réutiliser.** L'Atelier a résolu exactement ce problème de
regroupement : `craftGroupKey` (`packages/shared/src/atelier.ts`, consommé par
`apps/web/src/lib/atelier.ts` et `craftableGroups`) définit la clé de fusion — et cette clé est la
bonne, puisqu'elle distingue **trois exemplaires identiques** de **deux exemplaires de même
`ref_code` mais d'éditions différentes** (voir I-006 : une région peut exister en six raretés).
La clé de comptage doit être `(category, ref_code, rarity)`, jamais `(category, ref_code)`.

**Constat B — L'Atelier apparaît et disparaît.** `CraftPanel`
(`apps/web/src/components/atelier/craft-panel.tsx`) est rendu **dans Le Cadastre**, en section
(`apps/web/src/routes/collection.tsx:324`, import l.24), sous un `<section aria-labelledby="atelier-title">`
(`craft-panel.tsx:38-41`), et **rend `null`** quand aucun groupe n'est fusible et qu'aucune fusion
n'a eu lieu (`craft-panel.tsx:35`). Il n'a **aucune entrée de navigation**
(`components/layout/nav-items.ts` n'en porte pas). D'où l'impression, exacte, qu'il est « posé là
au hasard » : il n'apparaît qu'à certaines conditions, au milieu d'une autre salle, sans annonce.

**Demandé.** Que le nombre d'exemplaires possédés apparaisse sur les cartes, et que L'Atelier ait
une place qui se tienne.

**Pièges.**
- **Deux présentations, une seule vérité.** « ×3 » sur la planche et un compteur de groupe doivent
  venir du même calcul. Une agrégation client sur les lignes déjà reçues suffit (les lignes portent
  `category`, `ref_code`, `rarity`) : pas de nouvelle route, pas de changement de contrat. En
  revanche `total` et la virtualisation (`estimateSize`, une ligne à 213 px mesurée par le banc)
  parlent aujourd'hui de **lignes = cartes** : passer à **lignes = groupes** change ces deux
  chiffres, et le cas E2E qui mesure 213 px doit être rejoué, pas ajusté.
- **Le Cartel et le tiroir de La Planche** doivent suivre : proposer « ×3 » dans une liste mais pas
  dans le tiroir de composition produirait deux lectures du même inventaire.
- **Décider ce que l'Atelier devient** : une salle à part entière (entrée de navigation, état vide
  qui explique la règle des trois exemplaires) ou une section **stable** du Cadastre, toujours
  visible quel que soit le nombre de groupes fusibles — un composant qui disparaît quand il n'a
  rien à faire ne peut pas être trouvé. Dans les deux cas, la règle « 3 identiques → palier +1,
  jamais `MYTHIQUE` » (`packages/shared/src/atelier.ts`) doit être **écrite dans l'interface** :
  aujourd'hui le joueur la découvre en cliquant.
- L'Atelier refusant les cartes engagées (`409 CARD_ENGAGED` : dans un tableau, une annonce
  ouverte, une offre `PENDING`), le panneau doit dire **pourquoi** une grappe n'est pas fusible —
  sinon le compteur « ×3 » et l'absence de bouton se contredisent à l'écran.

---

## Ordre de traitement proposé

1. **R-001, R-003, R-004** — petites, toutes côté interface, aucune migration. À faire en un seul
   lot pour ne pas payer trois fois la mise en route.
2. **R-007** — le plus gros gain de lisibilité pour le joueur, sans changement de contrat ; à
   découper entre l'agrégation (Cadastre, Cartel, tiroir) et la place de L'Atelier.
3. **R-005** — purement web, réversible, mais change ce que la carte raconte.
4. **R-006** — en dernier, et sans réimport : **route B décidée** (cadre par groupe en base,
   backfill ciblé des 139 lignes). Commence par `.docs/02-database.md`, pas par le code.

Rien de tout ceci n'est engagé. Chaque PR devra être mesurée dans Docker (`ci:check` + banc E2E)
et la mémoire projet mise à jour dans le même geste.
