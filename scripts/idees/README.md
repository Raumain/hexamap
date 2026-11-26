# Idées — lancer une session par idée en attente

`.docs/09-idees.md` est le coin calme du produit : six idées non urgentes, déposées sans
réponse. Ce dossier les transforme en travail : une idée par session OpenCode autonome, une
branche, un worktree, une porte. Le contrat de chaque idée est son entrée dans
`.docs/09-idees.md` ; le brief de la phase la traduit en fichiers et en critères.

```
scripts/idees/
  run.sh              le wrapper (BASE, PLAN, PROMPTS, WAVE_PREFIX, WT_ROOT, LOGDIR)
  plan.tsv            le graphe : vague, phase, slug, branche, migration, statut
  prompts/_commun.md  le préambule des six sessions
  prompts/51..56.md   un brief par idée
```

## Idée ↔ phase

| Phase | Idée | Objet | Migration |
| :--- | :--- | :--- | :--- |
| 51 | I-001 | vendre une carte depuis une planche, plus depuis une `<select>` | — |
| 52 | I-004 | agrandir une case grattée dans une modale | — |
| 53 | I-003 | la salle des raretés : expliquer les paliers et les scores | — |
| 54 | I-005 | le fond SEO : titres, canonique, `robots.txt`, `sitemap.xml` | — |
| 55 | I-002 | trier les cartes par code postal | `0022_postal_code` |
| 56 | I-006 | une région, six éditions — et la spec qui le verrouille | — |

## Pourquoi les vagues sont séquentielles

Une vague ne part pas de `v2` mais de la branche d'accumulation de la précédente : la 54 voit
donc réellement la salle créée par la 53 dans son arbre, et la 56 complète une page qui existe.
`WAVE_PREFIX` vaut `feat/v2-idees-wave` — brancher sur `feat/v2-wave` ou
`feat/v2-retours-wave` écraserait une campagne précédente.

| Vague | Phases | Raison du regroupement |
| :--- | :--- | :--- |
| 1 | 51 · 52 | Deux surfaces web disjointes : `routes/market.mine.tsx` contre `routes/tickets.$ticketId.tsx`. Ni migration, ni coquille. |
| 2 | 53 | Seule propriétaire de `components/layout/` : elle inscrit la salle dans le rail et la feuille. |
| 3 | 54 · 55 | Le SEO touche `static.ts`, `app.ts`, `__root.tsx` et les routes ; le code postal touche `packages/db`, `scripts/import`, `cards.ts` et `collection.tsx`. Un seul propriétaire par fichier, et une seule migration (`0022`). |
| 4 | 56 | Complète la page de la 53 et ajoute une attente gelée à `packages/spec/src/tickets.spec.ts`. |

## Lancement

```sh
./scripts/idees/run.sh --parallel 2             # toutes les vagues, dans l'ordre
./scripts/idees/run.sh --wave 1 --dry-run       # ce que la vague 1 ferait
./scripts/idees/run.sh --phase 55 --keep        # reprendre une seule idée
```

La porte est la même que pour la v2 : `ci:check` dans le worktree de chaque phase avec sa base
de test, puis le banc Playwright sur la branche d'accumulation, puis une PR en brouillon par
phase vers la branche de sa vague parente. Rien n'est fusionné automatiquement : la dernière
branche `feat/v2-idees-wave-*` se relit et se fusionne à la main dans `v2`.

## Deux idées qui ne sont pas des phases

- **I-005 (SEO)** tel que `.docs/09-idees.md` le décrit contient un volet *rendu serveur des
  pages publiques*. Il n'est **pas** planifié ici, et la phase 54 le dit dans sa revue : le
  prérendu demande une seconde chaîne de rendu et doit rester compatible avec
  `skipWaiting: false` et `navigateFallback: '/index.html'`. La phase livre les métadonnées, la
  canonique, `robots.txt`, `sitemap.xml` et les données structurées ; le prérendu se planifie
  comme une phase propre quand ces fondations sont mesurables.
- **I-002 (code postal)** choisit un code **principal** par commune. `geo.api.gouv.fr` publie
  `codesPostaux` en tableau et n'en désigne aucun : la règle retenue (le premier code à cinq
  chiffres non vide) est une décision produit, écrite dans `packages/shared/src/postal.ts` et
  verrouillée par `packages/spec`. Le tableau complet n'est pas stocké dans cette phase.
