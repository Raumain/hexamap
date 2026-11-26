# Retours — lancer une session par retour produit

Les douze phases de la v2 sont fusionnées dans `v2`. Sept retours produit restent à traiter :
`.docs/10-retours-v2.md` est leur contrat, une entrée par retour, et ce dossier le joue comme une
suite de sessions OpenCode autonomes — une session par retour, une branche, un worktree.

```
scripts/retours/
  run.sh              le wrapper (BASE, PLAN, PROMPTS, WAVE_PREFIX, WT_ROOT, LOGDIR)
  plan.tsv            le graphe : vague, phase, slug, branche, migration, statut
  prompts/_commun.md  le préambule des sept sessions
```

## Phase ↔ retour

| Phase | Retour | Objet |
| :--- | :--- | :--- |
| 44 | R-001 | un compte sans vérification d'adresse |
| 45 | R-003 | la vitrine depuis les amis |
| 46 | R-004 | le retrait des CGV |
| 47 | R-007 | les exemplaires multiples |
| 48 | R-007 | L'Atelier place ses cartes |
| 49 | R-005 | L'Atlas distingue ses niveaux |
| 50 | R-006 | l'outre-mer (`0021_view_box`, seule migration) |

R-002 est sans objet par décision du titulaire : il n'est pas planifié.

## Pourquoi les vagues sont séquentielles

Une vague ne part pas de `v2` mais de la branche d'accumulation de la vague précédente : la
phase 45 voit donc réellement le travail de la 44 dans son arbre. `--parallel 1` les joue les
unes à la suite des autres, et `WAVE_PREFIX` reste `feat/v2-retours-wave` — brancher sur
`feat/v2-wave` écraserait les branches de la campagne précédente.

## Lancement

```sh
./scripts/retours/run.sh --parallel 1
```

## Reprendre une seule phase

```sh
./scripts/retours/run.sh --phase 44 --parallel 1 --keep
```
