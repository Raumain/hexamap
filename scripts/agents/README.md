# Agents — lancer une session par phase

Ce dossier fait tourner le plan de `ROADMAP.md` §2 comme une suite de sessions OpenCode
autonomes : une session par phase, une branche par session, un worktree par session.

```
scripts/agents/
  run.sh            le lanceur
  phases.tsv        le graphe : vague, phase, branche, numéro de migration
  prompts/_commun.md  le préambule partagé (règles, séquence de skills, interdits)
  prompts/<n>.md      le brief propre à chaque phase
```

## Le graphe, et pourquoi il est si peu parallèle

| Vague | Phases | Raison |
| :--- | :--- | :--- |
| 1 | **26 ∥ 28** | Domaines disjoints : 26 est le rythme de grattage (`tickets`, `game_config`, Le Relevé), 28 est la relation (`friendships`, `blocks`, la navigation). Aucune table, aucune route, aucun service en commun. |
| 2 | **27** | Le robinet d'écus vient **après** la cadence : sinon on règle l'économie deux fois et les joueurs subissent un nerf. Et les médailles sociales lisent `friendships`, donc après 28. |
| 3 | **29** | Lit le catalogue de 27 et le compte d'amis de 28. |
| 4 | 30 | Parquée sur le droit, pas sur le code. Le lanceur la refuse et l'écrit. |

C'est une parallélisation à deux, pas à cinq. Les domaines sont disjoints, le **dépôt** ne
l'est pas : `migrator.ts`, `schema.ts`, `routeTree.gen.ts`, `nav-items.ts` et
`03-active-task.md` sont touchés par plusieurs phases. D'où les garde-fous ci-dessous.

## Branches empilées

Une phase ne part jamais de `main` : elle part de la branche d'accumulation de sa vague
parente. C'est ce qui rend vrai le paragraphe « la phase X est déjà fusionnée » des briefs.

```
main ──┬─ feat/phase-26 ─┐
       └─ feat/phase-28 ─┴─ agents/wave-1 ── feat/phase-27 ── agents/wave-2 ── feat/phase-29 ── agents/wave-3
```

- **PR de phase** → la branche de sa vague parente (vague 1 : `main`, ou `BASE`).
- **`agents/wave-N`** = la base parente + toutes les branches de la vague N, fusionnées et
  vérifiées par un `ci:check`. C'est une vraie branche, poussée, pas un worktree jetable.
- **La dernière `agents/wave-*`** est celle qui remonte vers `main`. Une seule PR à relire en
  dernier, et elle contient tout.

Une vague dont une session échoue n'accumule rien : la chaîne s'arrête là plutôt que de
faire partir la vague suivante d'un arbre qui ne contient pas ce que son brief lui promet.

**La branche de base est garantie avant le départ.** `gh pr create --base` échoue si la
branche n'est pas sur l'origine, et le repli naturel est de viser `main` — ce qui casserait la
chaîne. Le lanceur vérifie donc `git ls-remote` sur la branche parente avant de lancer la
moindre session, et la pousse si elle n'existe qu'en local. Côté agent, le préambule impose la
même vérification avec une attente bornée (2 minutes, 5 fois) et un refus explicite plutôt
qu'un repli sur `main`.



## Ce que fait le lanceur

1. **Préalable** : binaires présents, `.env` là, PostgreSQL répond, arbre de travail propre,
   sinon il refuse.
2. **Une base de test par phase** (`hexamap_test_26`, `hexamap_test_28`, …). Deux `ci:check`
   simultanés sur la même base sont un générateur de flakiness : `ci-check.ts` n'isole pas par
   processus, seulement par worker.
3. **Un worktree par phase** (`../hexamap-agents/phase-26`), avec `.env` copié et `node_modules`
   créé **avant** tout `docker compose`. Sans cette précaution Docker crée des dossiers vides
   appartenant à root, et la session échoue en permission — c'est exactement pourquoi
   `scripts/bootstrap.sh` fait `mkdir -p node_modules`.
4. **Une session** : `opencode run --auto --archived --title …` avec le prompt composé
   (préambule + brief + paramètres). `--archived` garde les runs scriptés hors de la liste des
   sessions.
5. **Une branche d'accumulation par vague** : `agents/wave-N` part de la branche parente,
   fusionne les branches de la vague, puis passe `ci:check`. C'est la vraie preuve : elle porte
   sur la **combinaison**, pas sur chaque branche séparément. Elle est poussée, et la vague
   suivante en part.

Il ne fusionne jamais dans `main`, et il n'ouvre pas les PR lui-même : la skill
`02-pull-request` le fait dans chaque session.

## Utilisation

```sh
# Tout, en commençant par la vague 1
./scripts/agents/run.sh

# Une seule phase (utile pour rejouer un échec)
./scripts/agents/run.sh --phase 26 --keep

# Voir les commandes sans rien lancer
./scripts/agents/run.sh --dry-run --allow-dirty

# Tout en série, pour comparer
./scripts/agents/run.sh --parallel 1
```

Variables : `BASE` (`main`), `WT_ROOT`, `LOGDIR`, `MAX_PARALLEL` (2), `SESSION_TIMEOUT`
(3 h), `POSTGRES_USER`, `POSTGRES_PASSWORD`.

## La séquence imposée à chaque session

`01-plan` → `02-implement` → `03-assert` → `05-review` → `01-commit` → `02-pull-request`

La revue est une passe **séparée** et hostile, pas une formalité : son verdict est écrit dans
`.docs/sessions/<slug>/review.md`. Une session ne se déclare pas finie sans `ci:check` vert et
sans ce fichier.

Le préambule lève explicitement la règle 8 d'`AGENTS.md` (« ne pas commiter sans demande ») :
la demande est la raison d'être du lanceur. Sans cette phrase, chaque session s'arrête
proprement à « modifications prêtes, aucun commit » et tu récupères quatre branches qui
n'existent pas.

## Les conflits, et ce qui est fait pour les éviter

| Fichier | Mitigation |
| :--- | :--- |
| `packages/db/src/migrator.ts` | Un numéro de migration réservé par phase ; ajout **à la fin** de la liste |
| `packages/db/src/schema.ts` | Ajout **à la fin** des blocs et de `Database` |
| `apps/web/src/routeTree.gen.ts` | Interdit à la main ; le lanceur le résout par régénération |
| `apps/web/src/styles.css` | Jetons ajoutés à la fin de leur groupe, uniquement si nécessaires |
| `.docs/03-active-task.md` | **Interdit aux sessions** ; chacune écrit `.docs/sessions/<slug>/`, la consolidation est manuelle |

## Limites assumées

- **Le lanceur ne teste pas son propre chemin nominal** : `--dry-run` est vérifié, un run réel
  ne l'est pas. La première exécution doit être surveillée (`--keep` pour inspecter les
  worktrees si une session échoue).
- **Il pousse `agents/wave-N`.** C'est un écart assumé à « ne rien pousser sans demande » : sans
  cette branche sur l'origine, aucune PR de phase ne peut la cibler. `--no-push` l'annule, au
  prix de PR locales impossibles.
- **Un conflit non généré arrête la vague.** Si deux branches touchent la même ligne de
  `migrator.ts`, rien n'est résolu automatiquement : le lanceur imprime les fichiers en conflit
  et s'arrête. C'est volontaire — une résolution devinée serait pire qu'un arrêt.
- **`--auto` est une vraie permission.** Il approuve tout ce qui n'est pas explicitement refusé.
  Pour réduire la surface, ajoute un bloc `permission` avec des `deny` dans ta configuration
  OpenCode ; `--auto` les respecte. `--no-auto` existe mais rend le run inutilisable sans
  quelqu'un devant l'écran.
- **Le coût.** Quatre sessions de phase complète, pas quatre questions. C'est un run de nuit,
  pas un run de café.

## Après le lancement, à la main

1. Relire les PR en brouillon : `gh pr list --author @me`. Chacune cible la branche de sa
   vague parente.
2. Consolider `.docs/sessions/*/journal.md` dans `.docs/03-active-task.md`.
3. Fusionner **la dernière** `agents/wave-*` dans `main` — une seule PR, et elle contient tout.
