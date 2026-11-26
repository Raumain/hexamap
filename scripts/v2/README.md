# Le chantier v2 — lancer les phases

Les douze phases de la v2 (32 à 43, voir `.docs/07-roadmap-v2.md`) se jouent par
`scripts/v2/run.sh`, qui n'est qu'un réglage de `scripts/agents/run.sh` : plan v2, base `v2`,
préfixe `feat/v2-wave-`, porte et PR activées.

```sh
scripts/v2/run.sh --wave 1 --dry-run   # ce que la vague ferait
scripts/v2/run.sh --wave 1             # la joue et accumule feat/v2-wave-1
scripts/v2/run.sh --wave 2             # part de feat/v2-wave-1
```

Une seule vague par invocation est acceptée. Une chaîne de huit branches lancée d'un bloc
produirait une PR finale illisible et un coût de contexte non maîtrisé.

## Le graphe, et pourquoi ces regroupements

```text
v2 ── w1 : 32 ── w2 : 33 · 38 ── w3 : 34 · 37 ── w4 : 35 · 39
   ── w5 : 36 · 40 ── w6 : 41 ── w7 : 42 ── w8 : 43
```

Chaque vague part de la branche d'accumulation de la précédente : le graphe est une chaîne, et
les phases d'une même vague sont les seules à courir en parallèle.

| Vague | Phases | Raison du regroupement |
| :--- | :--- | :--- |
| 1 | 32 Le Socle | Rien d'autre ne peut partir avant : découpage, 404, bugs, second compte. Seule, donc sans conflit possible. Migration `0014` : intégrité de `user_cards.ref_code` (BUG-002 et BUG-003). |
| 2 | 33 données · 38 vitrine | La donnée de la carte et la planche montrée ne touchent pas les mêmes fichiers : `scripts/import` d'un côté, `apps/web` de l'autre. `0015` porte les `path_d` de l'Atlas ; la vitrine n'en prend aucune. |
| 3 | 34 API · 37 comptes | Deux surfaces serveur disjointes : `routes/atlas.ts` contre `routes/profile.ts`. Aucune coquille, aucune migration. |
| 4 | 35 salle · 39 guichet | Une seule migration pour deux : la salle n'en prend pas, le Guichet porte `0016`. Les deux touchent `apps/web`, mais pas la même coquille. |
| 5 | 36 Cadastre · 40 Troc | Le premier modifie `routes/collection.tsx`, le second `routes/market.*` et une table neuve (`0017`). Un seul propriétaire par fichier. |
| 6 | 41 Atelier | Migration `0018` seule, et la fusion de doublons touche `user_cards` : elle ne voisine avec rien. |
| 7 | 42 Palmarès | Migration `0019`, calcul de score figé : dépend du Troc et de l'Atelier, donc après eux. |
| 8 | 43 Sonnette | Migration `0020`, et la poussée a besoin du Guichet : dernière. |

Deux règles décident vraiment du découpage, et elles sont écrites en tête de
`scripts/v2/plan.tsv` :

1. **Une seule migration par vague.** `packages/db/src/migrator.ts` et `packages/db/src/schema.ts`
   sont partagés et ne s'éditent qu'en ajout en fin de liste. Deux phases d'une même vague qui
   migrent se marcheraient dessus.
2. **Un seul propriétaire de la coquille par vague.** `apps/web/src/components/layout/` est le
   même fichier pour tout le monde.

Les numéros de migration de `plan.tsv` sont indicatifs ; le brief de la phase fait foi.

## La chaîne, et ce qu'elle empile

Chaque phase part de la branche d'accumulation de sa vague, jamais de `v2`. Chaque PR de phase
est en **brouillon** et cible la branche de sa vague parente : la vague 1 vers `v2`, la vague N
vers `feat/v2-wave-(N-1)`. Une PR qui viserait `v2` afficherait le diff de ses dépendances au
lieu du sien.

Une vague de trois phases avec `--parallel 2` joue deux lots (2 puis 1), et les trois branches
finissent dans la même branche d'accumulation. Ce script ne fusionne jamais rien dans `v2` :
c'est un geste manuel.

## La porte — ce que le lanceur vérifie à ta place

- **Par phase (`ci:check`)** : après chaque session, `ci:check` est rejoué dans le worktree de
  la phase, avec sa base de test `hexamap_test_<phase>`. Si la porte échoue, la session est en
  échec, la chaîne s'arrête, rien n'est accumulé.
- **Par vague (banc E2E)** : sur la branche d'accumulation, après `ci:check` et avant le push,
  `docker compose -f docker-compose.e2e.yml` monte `db api proxy` puis joue Playwright. Si le
  banc échoue, la vague n'est pas accumulée.

Une session qui échoue arrête la chaîne : la vague suivante partirait d'un arbre qui ne contient
pas ce que son brief lui promet.

## Les gestes qui restent à la main

1. Relire les PR de phase, chacune ciblant la branche de sa vague parente.
2. Consolider `.docs/sessions/<slug>/journal.md` dans `.docs/03-active-task.md` (et archiver
   l'entrée close dans `.docs/08-journal.md`).
3. Fusionner la dernière branche `feat/v2-wave-*` dans `v2`, puis ouvrir la PR de la vague
   suivante si elle n'existe pas.
4. Ne jamais toucher `main` : une release fusionne `v2` dans `main`, sur demande explicite.

## Limites connues

- **Le banc E2E n'est pas parallélisable.** `docker-compose.e2e.yml` porte `name: hexamap-e2e` :
  deux vagues simultanées s'écraseraient l'une l'autre. Le banc tourne donc une fois par vague,
  et une seule vague à la fois.
- **`--auto` donne accès au `.env` copié dans le worktree.** Le lanceur y copie le `.env` de la
  racine pour que Docker puisse démarrer ; une session peut donc lire des secrets de
  développement. `--no-auto` n'y change rien, seul le périmètre des permissions change.
- **Aucune reprise automatique.** Une phase interrompue se relance à la main
  (`--phase 32`, par exemple) ; une branche déjà présente est reprise, pas réinitialisée.
- **Une porte aveugle au réel.** `ci:check` ne prouve pas qu'un écran est juste : un contrôle qui
  compile n'est pas un contrôle qui marche, et le journal de la session doit dire ce qui n'a pas
  été regardé.
