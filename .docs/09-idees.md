# 09 — Idées en attente

> **Coin calme.** Ce fichier ne se lit pas en début de session et ne fait partie d'aucun ordre du
> jour. On y dépose une idée, on n'y répond pas. Une idée n'entre dans le travail qu'en passant
> par `.docs/03-active-task.md` ou `.docs/07-roadmap-v2.md`, jamais d'ici directement.
> Créé le 2026-11-22, pendant la planification de la v2.
>
> Les **retours prioritaires sur la v2 livrée** ne vivent pas ici : ils sont dans
> `.docs/10-retours-v2.md` (R-001 → R-007). Ici, uniquement le non urgent.

---

## I-001 — Mettre une carte en vente : mieux que la liste déroulante

**Constat.** Le formulaire d'annonce (`apps/web/src/routes/comptoir*`,
`apps/api/src/routes/market.ts`) demande de choisir la carte dans un menu déroulant qui énumère
*toutes* les cartes possédées. Avec quelques centaines de lignes, c'est illisible et illisible
surtout sur mobile : une `<select>` native ne rend pas une planche, ne se parcourt pas au pouce,
et n'affiche ni la rareté, ni la commune, ni le département.

**Piste.** Remplacer la sélection par un parcours de type tiroir de La Planche (celui de
`routes/tableau.tsx` : `TABLEAU_CANDIDATE_LINKS`, `rankCardsByCompatibility`, liste
virtualisée de planches) — filtres par catégorie et par rareté, recherche par nom, ligne =
planche + nom + libellé de lieu, puis un bouton « Mettre en vente » avec le champ prix au-dessus
du clavier. Aucune nouvelle table : le contrat de données ne bouge pas.

**À trancher plus tard.** Un seul écran (choix + prix) ou deux (`/comptoir/vendre` dédié, plus
profond mais plus clair sur mobile).

---

## I-002 — Trier les cartes par code postal (surtout les communes, dans les planches)

**Constat.** Les listes de cartes (`routes/cadastre*`, le tiroir de La Planche, la vitrine) se
trient aujourd'hui par rareté ou par date. Pour un joueur qui pense « ma collection autour de
chez moi », le tri naturel est le code postal — et il manque.

**Obstacle réel, à ne pas découvrir en cours de route.** `ref_communes`
(`.docs/02-database.md` §5) ne porte **aucune** colonne de code postal : elle a `code_insee`,
`nom`, `code_departement`, `code_region`, `population`, `latitude`, `longitude`, `rarete`,
`score_base`, `draw_bucket`, `geom`, blasons. Le code postal n'est donc pas une simple option
d'affichage : c'est une évolution du contrat de données (colonne + import `geo.api.gouv.fr` /
BAN, qui publie `codesPostaux` en tableau — une commune en a souvent plusieurs, dont un
`codePostal` principal).

**Piste.** Ajouter `ref_communes.code_postal` (le principal, celui que l'INSEE nomme ainsi) en
plus d'un éventuel tableau, puis un tri par `code_postal` et un filtre « par tranche » dans les
listes. Attention : une commune peut avoir plusieurs codes postaux ; choisir *un* code principal
est une décision produit, pas un détail d'import. Toute évolution commence par
`.docs/02-database.md`, puis une migration.

---

## I-003 — Montrer le calcul de rareté quelque part dans l'app

**Constat.** Les règles sont écrites (`.docs/01-architecture.md` §2.2 et §2.4) et implémentées
(`packages/shared/src/scoring.ts`, `rarity.ts`) : un joueur n'a aucun endroit où lire *pourquoi*
telle commune est « Peu commune » et telle rue est mythique. La rareté inversée des rues (§2.7)
est une mécanique jubilatoire qui reste invisible.

**Piste.** Une salle ou un panneau « Comment se calcule une rareté » : les six paliers, les
tableaux de population d'une commune et de nombre de communes d'une rue, les deux formules de
score, les exemples normatifs déjà écrits dans `.docs/01-architecture.md` §2.4. Aucun calcul
n'est refait côté client : on affiche les constantes de `packages/shared` et des exemples figés,
verrouillés par `packages/spec`.

**À trancher plus tard.** Salle dédiée, section de la page d'aide, ou panneau contextuel ouvert
depuis un sceau de rareté.

**Sous-produit de I-006** : la règle des régions/départements (« le lieu ne fixe pas la rareté,
c'est le palier tiré ») doit y figurer, sinon la page explique les communes et laisse le joueur
croire qu'une région qui change d'édition est un bug.

---

## I-004 — Agrandir une case grattée d'un ticket

**Constat.** `apps/web/src/routes/tickets.$ticketId.tsx` rend chaque case révélée en `grid-cols-4`
avec `aspect-[3/5]`, et la planche y est volontairement réduite (`.docs/01-architecture.md`
§4.9 : sous 110 px, `.plate-optional` efface tout ce qui n'est pas l'identité). Résultat : la
carte est lisible en nom et en score, mais le Cartel (`variant="detailed"`), le blason, le code
de référence et le texte d'un bonus (Station-Service, Belvédère, Rénovation) restent
inaccessibles.

**Piste.** Une case révélée devient un bouton (`aria-haspopup="dialog"`) qui ouvre une modale
rendue par `components/ui/overlay-portal.tsx` — même mécanisme que la modale de Pépite déjà en
place dans ce fichier, et hors de `<main>` comme l'exige §4.9 (BUG-007). Deux contenus selon la
case : la planche `variant="detailed"` en grand pour une carte, le texte du panneau pour un
bonus. La modale ne fait aucune requête : la charge utile de révélation porte déjà tout
(`blasonUrl`, `blasonCredit`), et elle ne révèle rien de plus que le serveur a déjà accordé.

**Point de vigilance.** La case grattée est aussi une surface de grattage ; il faut que le tap
de fin de geste ne déclenche pas l'ouverture, et que l'ouverture reste possible après révélation
seulement. Les cases non révélées ne doivent jamais être cliquables — le serveur reste seul juge.

---

## I-005 — SEO au fond : exister sur « Hexamap »

**Constat.** « Hexamap » est un nom déjà porté par plusieurs services (dont des outils de
cartographie et des produits de niche) : sans travail propre, la recherche du seul nom de marque
renvoie autre chose. Et la pile complique le sujet : en production l'API sert elle-même le SPA
(`apps/api/src/static.ts`, `SERVE_WEB=true`) et **toutes** les routes reçoivent le même
`apps/web/public/index.html` — un shell sans titre ni description propres à la salle visitée. Le
`manifest.webmanifest` et l'`index.html` sont statiques, `routeTree.gen.ts` est généré, et rien
dans le dépôt ne produit de `robots.txt`, de `sitemap.xml` ni de métadonnées par route.

**Pistes, dans l'ordre de rendement.**

1. **Identité de marque d'abord.** Un titre et une description uniques par route (TanStack Router
   `head`), un `canonical` par route, un nom de marque écrit de façon constante (`Hexamap`), et
   une origine canonique définie une fois pour toutes (`https://<domaine>`), avec redirection
   depuis l'alternative `www`/IP : Google ne classe pas deux origines pour une même page.
2. **Contenu réellement indexable.** Le shell SPA est rendu par Google, mais mal et tard. Le
   chemin sûr est de rendre le HTML initial côté serveur pour les routes publiques (Le Seuil, la
   page d'aide/rareté, les vitrines `/players/:id`) : ce sont précisément les pages qui ont un
   intérêt hors session. Les salles derrière authentification (`Le Relevé`, `Le Cadastre`, `La
   Planche`, `Le Comptoir`, `La Boutique`) n'ont aucun intérêt SEO et doivent porter `noindex`.
3. **`robots.txt` + `sitemap.xml` servis par l'API.** Ils tombent aujourd'hui dans le repli
   statique : `static.ts` a déjà la liste blanche d'extensions et la garde anti-`..` ; il faut y
   ajouter ces deux chemins et un `sitemap` généré depuis le contenu public réel (pas une liste
   figée à la main).
4. **Données structurées.** JSON-LD `Organization`/`WebSite` (+ `SearchAction` si une recherche
   publique existe), et `BreadcrumbList` sur les pages publiques profondes.
5. **Vitrines publiques = le vrai gisement.** `/players/:id` est la seule famille de pages qui
   grandit avec les joueurs. Elle doit rester publique par défaut, porter un titre utile (« la
   collection de X — Hexamap »), et ne jamais exposer ce que §2.9 interdit.
6. **Mesure.** Google Search Console (propriété vérifiée, sitemap soumis), suivi du rang sur la
   requête « Hexamap » et sur « Hexamap carte » / « Hexamap jeu », et une page de marque qui dise
   en une phrase ce qu'est le produit — c'est ce que Google associe à une entité de marque.

**Points de vigilance.**

- **Open Graph et partage d'image sont hors périmètre v2** (`.docs/07-roadmap-v2.md`, décisions) :
  le SEO ne les réintroduit pas par la porte de derrière. Un `title`/`description` propre n'est
  pas un travail Open Graph.
- **Le service worker ne doit jamais mettre une page en cache de travers** : `navigateFallback`
  sert `index.html` en précache, donc une page mise en cache peut masquer un déploiement. Une
  stratégie SEO qui prerend des pages doit être compatible avec `prompt`/`skipWaiting: false`
  (§4.10).
- **Rien de ceci ne touche le contrat de données** : aucune table, aucune migration. En revanche
  cela touche `apps/api/src/static.ts`, `apps/web/index.html` et le routeur : à planifier comme
  une phase, pas comme une retouche.

---

## I-006 — Expliquer qu'une même région peut exister en six raretés

**Le cas réel, posé tel quel.** Un joueur reçoit la Guadeloupe en **Mythique** (3 500 pts), puis
la Guadeloupe en **Peu commune** (400 pts) quelques tickets plus tard. Rien dans l'app ne dit
pourquoi : les deux cartes ont le même nom, le même blason, le même cadre. Sans explication, c'est
une réclamation de bug — et une perte de confiance dans le tirage.

**La règle, telle que le code la porte déjà.** Une région et un département **n'ont pas de rareté
intrinsèque** (`ref_regions` et `ref_departements` n'ont aucune colonne `rarete`, contrairement à
`ref_communes.rarete` et `ref_odonymes.rarete`). Le serveur tire la catégorie, puis le palier, puis
une entité uniforme dans ce palier, et **écrit le palier sur la carte** :
`apps/api/src/services/draw.ts`, `drawRegion` / `drawDepartement` reçoivent `rarity` en paramètre
et posent `score = editionScore(rarity)`. Une commune, elle, garde sa rareté de référentiel pour
toujours. C'est ce contraste qu'il faut rendre lisible : **le lieu est une coquille, l'édition est
la carte**.

**Ce qu'il faut écrire dans l'interface, en clair et en français.**

1. **Sur La Planche / le Cartel d'une carte Région ou Département** : une ligne du type
   « Édition <palier> — une région peut être tirée dans les six éditions ; sa valeur est celle de
   l'édition, pas du lieu. » Un lien vers l'explication complète.
2. **Dans la page de rareté (I-003)** : un bloc dédié « Régions et départements : six éditions »,
   avec le tableau `EDITION_SCORE` (200 → 3 500) et la phrase qui tue le malentendu — *posséder
   deux fois la même région dans deux éditions n'est pas un doublon, c'est deux cartes*.
3. **Au moment du tirage, dans la case révélée** : la carte porte déjà son sceau ; le bandeau de
   16 px (`routes/tickets.$ticketId.tsx`) pourrait nommer l'édition (« Édition mythique ») plutôt
   que seulement la rareté, ce que le sceau fait déjà visuellement.
4. **Ne pas promettre une probabilité qu'on ne tiendrait pas** : si un chiffre est affiché, il
   vient de `RARITY_WEIGHTS` / `TREASURE_RARITIES` de `packages/shared`, jamais recopié à la main.
   Une Pépite ne sort que `RARE` → `MYTHIQUE` (`TREASURE_RARITIES`), une Route communale que
   `COMMUNE` ou `INHABITUELLE` (`CARD_RARITIES`) : c'est précisément ce qui explique qu'une
   deuxième Guadeloupe « Peu commune » ne peut pas venir d'une Pépite.

**Le vrai piège à éviter.** Parler de « deux exemplaires de la même carte » sans distinguer
l'édition. Le marché, L'Atelier et Le Troc manipulent des `user_cards.id`, pas des `ref_code` :
deux Guadeloupe de raretés différentes sont deux objets sans lien, et une interface qui les
présente comme un doublon ferait naître une demande de remboursement imaginaire.

**Trou de contrat constaté en vérifiant cette règle (2026-11-22).** Aucune spécification
n'asserte `region.card.rarity === palier tiré`, alors que c'est la règle du GDD
(`.docs/01-architecture.md` §2.1) et le comportement de `drawRegion`.
`packages/spec/src/tickets.spec.ts` couvre explicitement le cas **inverse** pour les communes
(« dessine une carte d'un palier voisin quand le palier demandé est vide »). Le comportement n'est
donc verrouillé que par le code et, indirectement, par `scoring.spec.ts` sur `editionScore`. Un
test à ajouter, pas un bug — une page d'explication qui s'appuie sur une règle qu'aucun test ne
tient finira par mentir au premier refactor.

