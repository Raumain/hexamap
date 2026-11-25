# Journal — phase 52, agrandir une case grattée

Branche : `feat/v2-52-agrandir-case` · Base : `v2` (`7f114fb`) · Migration : aucune.

## 2026-11-25 — Ouverture

Session démarrée sur le worktree `phase-52`, arbre propre, branche déjà positionnée sur
`feat/v2-52-agrandir-case` au-dessus de `v2` (`7f114fb`, merge de `feat/v2-cadastre-epure`).

Lecture faite : `AGENTS.md`, `.docs/01-architecture.md`, `.docs/02-database.md`,
`.docs/10-retours-v2.md`, `apps/web/AGENTS.md`. `.docs/03-active-task.md` volontairement non lu
(interdit par le préambule de campagne).

Retour traité : **I-004** de `.docs/09-idees.md` (lignes 76-96) — une case révélée d'un ticket
rend la planche en `grid-cols-4` / `aspect-[3/5]`, et sous 110 px `.plate-optional` efface tout
ce qui n'est pas l'identité. Le joueur ne lit ni le Cartel, ni le blason, ni le code de
référence, ni le texte d'un panneau. Demande : rendre une case **révélée** cliquable et ouvrir
une modale détaillée, sans aucune requête.

## 2026-11-25 — Plan (01-plan)

`.docs/sessions/agrandir-case/plan.md` et `phase-1.md` écrits, `validate-plan.cjs` rend **VALID**
(exécuté dans Docker, `node` sur le script de la skill monté en lecture seule).

Constat d'exploration, vérifié dans le code :

- `apps/web/src/components/revealed-cell.tsx` est une `<div>` `relative flex aspect-[3/5]`, avec
  `CellStrip` (bandeau `h-4`) puis soit `Card` (planche compacte), soit l'icône + le libellé + la
  `description` d'un panneau. C'est bien ici que vit l'affichage, pas dans la route.
- `apps/web/src/routes/tickets.$ticketId.tsx` rend `<RevealedCell key cell />` à la ligne 298 et
  possède déjà une modale de Pépite (lignes 368-413) montée dans `<OverlayPortal>`, avec la même
  forme que celle qu'on ajoute : `role="dialog"`, `aria-modal`, `onPointerDown` sur le fond,
  Échap sur `document`, focus rendu à la grille au démontage.
- `apps/web/src/components/ui/Card.tsx` : `variant="detailed"` délègue à `DetailedPlate`, dont la
  racine est un `<article>` (`detailed-plate.tsx:209`). **C'est le point de conception** : un
  `<button>` ne peut contenir que du contenu phrasé, donc remplacer la racine `<div>` de la case
  par un `<button>` aurait imbriqué un `<article>` dans un bouton — invalide, et le nom accessible
  du bouton aurait avalé tout le texte de la planche.
- Deux cas E2E verrouillent la forme du DOM : `mobile.spec.ts:428` localise la planche par
  `plate.locator('xpath=../..')` (la case est la **grand-mère** de la planche) et
  `mobile.spec.ts:392` / `core-loop.spec.ts:75` comptent les `article` de la grille.

**Décision de plan, écrite dans `plan.md`** : la cible cliquable est un `<button type="button">`
superposé (`absolute inset-0 z-10`) en dernier enfant de la case. Le DOM de la case ne gagne ni
ne perd aucun niveau, la géométrie ne bouge pas (aucun `h-*`/`min-h-*`, BUG-008), les `xpath=../..`
et les `article` restent vrais, et aucun `<article>` n'est imbriqué dans un bouton.

Seconde décision : le texte long d'un panneau est un champ `detail` **ajouté** à `PANEL_CONTENT`,
jamais une réécriture de `description` (rendu `line-clamp-3` dans la case). `detail` reprend la
lettre de §2.6, où le Belvédère gagne « une carte Commune » que la case omet aujourd'hui.

Aucune écriture de mémoire projet : `.docs/10-retours-v2.md` n'exige rien pour I-004, et le
préambule refuse tout diff de mémoire qu'on ne peut pas rattacher à une phrase du contrat.

## 2026-11-25 — Implémentation (02-implement)

Déléguée avec le contenu verbatim des quatre fichiers et le cas E2E rédigé à l'avance.
Livré : `PanelContent.detail` + les trois `detail` de §2.6, trois clés `TICKET.cellDialog*`,
`revealedCellLabel`, `components/revealed-cell-modal.tsx`, le bouton superposé dans
`revealed-cell.tsx`, `openCell`/`closeCell` dans la route, et le `test.step` dans
`core-loop.spec.ts`. Aucun cas de `packages/spec` touché, aucune migration, aucun champ d'API.

## 2026-11-25 — Assertions (03-assert)

`ci:check` dans Docker sur `hexamap_test_52` : **544 spécifications, 29 fichiers, 0 échec**, lint
et typecheck verts, base de test à 21 migrations, mesure de charge à `p95` **22,0 ms**.

Banc E2E du banc (`docker-compose.e2e.yml`) : image `api` reconstruite — la sonde
`grep -rl 'Agrandir la case' /app/public/assets` a d'abord été posée pour éviter le piège du
bundle périmé rencontré par la session précédente. `core-loop.spec.ts` sur `chromium` : 3 passés.
Banc **complet** : **118 passés, 0 échec** (`chromium`, `pwa`, `Pixel 7`, `iPhone 13`).

## 2026-11-25 — Revue hostile (05-review)

Cinq défauts trouvés, tous corrigés avant la mesure finale :

1. **Deal-breaker** — le dialogue d'un panneau rendait `description` **et** `detail` : « +2
   grattages. » puis « +2 coups de grattoir sur ce ticket. ». Deux phrases, deux vocabulaires,
   pour une seule règle. Le dialogue ne rend plus que `detail` ; le cas E2E cherche le
   vocabulaire de `detail`.
2. **Haute** — la restitution du focus était assertée par nom accessible. Deux exemplaires de la
   même carte donnent deux boutons homonymes, donc une violation de mode strict au hasard du
   tirage. L'assertion réutilise le localisateur `opener`.
3. **Moyenne** — `expect(apiRequests).toEqual([])` capturait aussi la pulsation de la cloche du
   Guichet (`notifications.ts:99,108`, toutes les 60 s), qui aurait fait échouer la preuve sans
   rapport avec la modale. `/api/v1/notifications` est exclu, avec le motif en commentaire.
4. **Basse** — une case révélée sans `kind` ni `card` ouvrait un dialogue vide : `canOpen` garde
   le bouton.
5. **Basse** — pas de défilement sur la toile de fond : `overflow-y-auto`.

Verdict dans `review.md` : **prêt à livrer**, trois suggestions assumées (pas de piège de focus,
pas de surface propre au dialogue, `'Carte'` dupliqué en repli).

## 2026-11-25 — Vérification visuelle (règle 10)

Sonde Playwright temporaire contre le banc, **retirée du dépôt** avant commit
(`packages/e2e/tests/zz-visual-probe.spec.ts` supprimé, `test-results/` et `playwright-report/`
nettoyés). Elle s'inscrit son propre compte, draine les charges et ouvre chaque case révélée.

Ce qu'elle a montré, lu dans le dialogue lui-même :

```text
PANNEAU     = Agrandir la case 4 — Commune E2E COMMUNE 0
              DÉTAIL DE LA CASE
              Belvédère
              Une carte Commune et la révélation gratuite d'une case adjacente.
              FERMER

ATTRIBUTION = Agrandir la case 8 — Commune E2E COMMUNE 0
              DÉTAIL DE LA CASE
              Commune E2E COMMUNE 0 · COMMUNE · E2E-C-COMMUNE-0
              INSEE E2E-C-COMMUNE-0 · LA VUE · 100 PTS · COMMUNE
              CC0 · Fixture E2E · Hexamap
              FERMER

CARTE       = hors main = true | transform main = none | focus rendu = true
```

Captures relues : 1280 px pour la carte et le panneau, 390 × 844 pour la même modale en mobile
(la planche Rue tient dans le cadre, `FERMER` atteignable, aucun débordement horizontal).
Une seule phrase pour le panneau — le doublon du défaut 1 n'est plus là.

## 2026-11-25 — Mesure finale sur l'arbre commité

`ci:check` rejoué après commits, sur le contenu exact commité : **544 spécifications, 29
fichiers, 0 échec**. Aucun `skip`, aucun `.fixme`, aucun délai relâché.

