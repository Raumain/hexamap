# Revue — phase 52, agrandir une case grattée

Relecture du diff `feat/v2-52-agrandir-case` au-dessus de `v2` (`7f114fb`), faite **après** la
passe d'assertions, comme une seconde passe et non comme une formalité.

## Verdict

**Prêt à livrer.**

Trois défauts trouvés en revue, tous corrigés avant la mesure finale. Aucun *deal-breaker*
restant. Le diff ne touche ni le contrat de données, ni le canvas de grattage, ni la coquille.

## Défauts trouvés et corrigés

| # | Gravité | Défaut | Correction |
| - | - | - | - |
| D-1 | **deal-breaker** | Le dialogue d'un panneau rendait `description` **puis** `detail` : « Station-service / +2 grattages. / +2 coups de grattoir sur ce ticket. ». Deux phrases pour un seul effet, et deux mots différents (« grattages » / « coups de grattoir ») pour la même règle. | Le dialogue ne rend plus que `detail`, le texte complet de `.docs/01-architecture.md` §2.6 ; `description` reste la ligne courte de la case. Le cas E2E cherche désormais le vocabulaire de `detail` (`/coups de grattoir\|case adjacente\|palier de rareté/`). |
| D-2 | **haute** | La restitution du focus était assertée par `page.getByRole('button', { name: accessibleName })`. Deux cases peuvent porter le même nom — deux exemplaires de la même carte dans un même bordereau — et Playwright lève alors une violation de mode strict : le cas échouerait au hasard du tirage. | L'assertion réutilise le localisateur `opener` (`/^Agrandir la case \d+/` + `.first()`), unique par construction et stable après fermeture. |
| D-3 | **moyenne** | `expect(apiRequests).toEqual([])` capturait **toute** requête `/api/`. La cloche du Guichet resynchronise son compteur toutes les 60 s (`apps/web/src/lib/notifications.ts:99,108`) : un battement tombant dans la fenêtre de ~2 s du pas faisait échouer la preuve « aucune requête » sans que la modale y soit pour rien. | La garde exclut explicitement `/api/v1/notifications`, avec le motif écrit en commentaire. Le critère visé — l'ouverture n'émet rien — est conservé, la pulsation de fond ne dépend pas de l'ouverture. |
| D-4 | **basse** | Une case `revealed` dont `kind` et `card` sont nuls montait quand même le bouton : elle ouvrait un dialogue au titre générique et au corps vide. | `canOpen` garde le bouton ; une case sans contenu rendu n'est plus une cible. |
| D-5 | **basse** | Le dialogue n'avait pas de défilement : sur un viewport court, un Cartel plus haut que l'écran serait sorti du cadre sans moyen d'y accéder. | `overflow-y-auto` sur la toile de fond. |

## Points examinés, jugés sains

- **Le DOM de la case ne bouge pas.** La racine reste la `<div>` `aspect-[3/5]` ; le bouton est un
  enfant superposé (`absolute inset-0 z-10`). C'est ce qui garde vrais
  `mobile.spec.ts:428` (`plate.locator('xpath=../..')` — la case est la grand-mère de la planche)
  et `mobile.spec.ts:392` / `core-loop.spec.ts:75` (comptage des `article`), tous verts.
- **Aucun `<article>` dans un `<button>`.** `DetailedPlate` rend un `<article>`
  (`detailed-plate.tsx:209`) ; l'imbriquer dans la racine aurait produit un HTML invalide et un
  nom accessible avalant tout le texte de la planche. C'est la raison du bouton superposé, écrite
  dans `plan.md`.
- **Aucune case non révélée n'est cliquable.** `ScratchCell` et `LockedCell` ne reçoivent aucun
  gestionnaire, et l'ancêtre (`<fieldset>`) non plus. Le tap de fin de grattage ne peut pas
  ouvrir : la route remplace l'élément après la réponse du serveur, et la case révélée est un
  autre composant.
- **Aucune requête, aucun champ nouveau.** La modale ne lit que `TicketCell`, déjà rendu par
  `maskedCellSchema` (`apps/api/src/routes/tickets.ts:59-69`). Rien n'a été ajouté au contrat, donc
  aucune surface d'exposition nouvelle — `userCardId` reste absent.
- **Pas de géométrie ajoutée.** Aucun `h-*` ni `min-h-*` sur la case (BUG-008) ; le bandeau reste
  `h-4`.
- **Ni `filter`, ni `backdrop-filter`, ni `mix-blend-mode`** autour du canvas. Le bouton ne
  traverse pas `scratch-cell.tsx`, qui n'est pas modifié.
- **`onClose` est stable** (`useCallback` dans la route) : l'effet de la modale ne se rejoue pas,
  donc le focus n'est pas volé à chaque rendu du parent.
- **Aucun cas de `packages/spec` modifié**, aucun `skip`, aucun délai relâché.

## Suggestions non appliquées, assumées

1. **Pas de piège de focus.** Tabuler depuis « Fermer » sort du dialogue. La modale de Pépite
   déjà livrée (`tickets.$ticketId.tsx:368-413`) n'en a pas non plus, et le brief ne demande que
   le focus initial et sa restitution : ajouter un piège ici créerait deux dialogues de la même
   salle avec deux comportements. WCAG 2.1.2 (aucun piège clavier) est satisfait.
2. **Le dialogue n'a pas de surface propre.** Le titre, le contenu et le bouton flottent sur la
   toile de fond `bg-cabinet/85`, comme la modale de Pépite. Sur mobile, l'en-tête du dialogue
   passe visuellement au-dessus du panneau « Ce bordereau est soldé. » assombri. C'est lisible
   (vérifié en capture à 390 px), et c'est le vocabulaire existant de la salle.
3. **`'Carte'` en repli dans `revealed-cell.tsx:49`** duplique la valeur de
   `TICKET.cellDialogCardFallback`. Deux littéraux identiques, aucun risque : la constante a été
   ajoutée pour la modale, et toucher le repli de la case élargirait le diff sans nécessité.

## Vérifications

| Preuve | Résultat |
| - | - |
| `ci:check` (Docker, `hexamap_test_52`) | **544 spécifications, 29 fichiers, 0 échec** ; lint, typecheck, base de test (21 migrations) et mesure de charge verts (`p95` du résumé d'Atlas à **22,0 ms** pour un seuil de 200 ms) |
| `core-loop.spec.ts` sur `chromium` | **3 passés** |
| Banc E2E **complet** | **118 passés**, 0 échec — `chromium`, `pwa`, `Pixel 7`, `iPhone 13` |
| Vérification visuelle (règle 10) | Sonde Playwright temporaire sur le banc, **retirée du dépôt** : carte avec attribution, panneau Belvédère, rendu mobile 390 px ; dialogue hors de `<main>`, `transform` de `<main>` = `none`, focus rendu à la case à la fermeture |

Ce que la sonde visuelle a montré, mot pour mot, dans le dialogue :

- carte : `DÉTAIL DE LA CASE / Commune E2E COMMUNE 0 / COMMUNE / E2E-C-COMMUNE-0 / INSEE
  E2E-C-COMMUNE-0 / LA VUE / 100 PTS / COMMUNE / CC0 · Fixture E2E · Hexamap` — nom, catégorie,
  code de référence, rareté, score, blason et attribution ;
- panneau : `DÉTAIL DE LA CASE / Belvédère / Une carte Commune et la révélation gratuite d'une
  case adjacente.` — et une seule phrase, sans doublon.

## Reste hors périmètre

`.docs/03-active-task.md` n'est pas touché (interdit par le préambule de campagne) ;
`.docs/01-architecture.md` non plus, `.docs/10-retours-v2.md` n'exigeant aucune écriture de
mémoire pour I-004. Le journal de la phase vit dans `.docs/sessions/agrandir-case/journal.md`.
