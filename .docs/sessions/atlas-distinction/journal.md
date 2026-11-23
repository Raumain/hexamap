# Journal — Phase 49 · L'Atlas distingue ses niveaux

## Sens retenu pour la couleur

**Le fond coloré des départements porte la couverture de collection** (part des communes
couvertes), pas la rareté ni la possession : `fillOpacity` était déjà une couverture, la légende
« Remplissage : part des communes couvertes » reste donc vraie, et la carte ne raconte qu'une
chose. La teinte `verdigris` ne sert qu'à séparer le niveau départemental du niveau régional, qui
n'a plus d'aplat du tout.

## Raisons

- `fillOpacity` signifiait déjà une couverture ; le faire porter deux sens (rareté + couverture)
  aurait fait raconter deux choses à la carte. R-005 ne demande aucune rareté, la charge utile de
  l'Atlas ne porte d'ailleurs que `communesOwned`/`communesTotal`.
- La région est un **contour** (`fill="none"`, filet `foil-hi`, laiton 2 px si carte possédée) :
  elle dessine la frontière, elle ne remplit plus.
- Le département est le seul niveau à porter un **fond** (`fill-verdigris`, opacité 0,06 → 0,45
  selon la couverture) : la distinction avec la région tient même à couverture nulle, puisque
  l'une n'a aucun aplat.
- La commune possédée passe du **contour** `verdigris` 2 px au lieu de l'aplat 0,45 : la
  possession cesse d'être une densité de remplissage et ne se confond pas avec la frontière de
  région (`foil-hi`).

## Journal

- Cas E2E écrits **avant** le code : « atlas — une région et un département n'ont pas le même
  style » et « atlas — le clic d'un département fait ce que fait sa ligne de table ».
- Aucun jeton nouveau : `veil-strong`, `foil-hi`, `verdigris`, `vellum-2`, `brass` existent déjà
  dans `apps/web/src/styles.css`.
