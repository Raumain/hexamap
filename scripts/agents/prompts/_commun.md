# Préambule commun — session d'agent Hexamap

Tu exécutes **une** phase du plan, seul, dans un worktree git dédié. D'autres sessions
travaillent en parallèle sur d'autres branches : tu ne les vois pas, tu ne les attends pas, et tu
ne touches à rien hors de ton périmètre.

## Lecture obligatoire, dans cet ordre

1. `AGENTS.md` (racine) — les règles non négociables du dépôt.
2. `.docs/01-architecture.md` — GDD, stack, règles d'architecture.
3. `.docs/02-database.md` — contrat SQL et types Kysely.
4. `.docs/03-active-task.md` — l'entrée de ta phase : contrat déjà figé, étapes, critères.
5. `ROADMAP.md` §2 — ta phase, sa place dans l'ordre, et ses dépendances.

## Le contrat est déjà écrit — ne le re-découvre pas

Le modèle de données est figé dans `.docs/01-architecture.md` §2.6, §2.8, §2.9 et
`.docs/02-database.md` §4.1, §4.6 à §4.9, §6, §7.1. Tu implémentes ce contrat, tu ne le
négocies pas. Si l'implémentation révèle une contradiction, **arrête-toi et signale-la** dans
ton rapport : tu n'as pas le droit de changer le contrat en silence.

## La séquence de travail — obligatoire, dans cet ordre

1. **`01-plan`** — charge la skill, produis le plan de la phase, écris-le dans
   `.docs/sessions/<slug>/plan.md`. Le plan nomme les fichiers touchés, l'ordre des étapes, et
   la façon de vérifier chaque critère.
2. **`02-implement`** — charge la skill, implémente le plan. **Spec d'abord** : un cas de
   `packages/spec` écrit et vu **rouge** avant le code qui le rend vert. Une PR d'implémentation
   ne modifie jamais un cas de spécification existant pour le faire passer.
3. **`03-assert`** — charge la skill, fais tourner les assertions du projet jusqu'au vert.
4. **`05-review`** — charge la skill et **relis ton propre diff comme un relecteur hostile**.
   C'est une passe séparée, pas une formalité. Écris le verdict dans
   `.docs/sessions/<slug>/review.md` : « prêt à livrer » ou « bloqué », avec la liste des
   défauts et leur gravité. Un défaut *deal-breaker* se corrige, puis tu rejoues 3 et 4.
5. **`01-commit`** — charge la skill. Commits atomiques, format
   `type(scope): impératif en français`.
6. **`02-pull-request`** — charge la skill, ouvre une **PR en brouillon** vers `main`.

Les skills se chargent avec l'outil `skill`, par identifiant. Si une skill ne se charge pas,
applique ses étapes à la main et dis-le dans le rapport — ne saute pas l'étape.

## Exception explicite à la règle 8 d'`AGENTS.md`

`AGENTS.md` interdit de commiter sans demande explicite. **La demande est ici** : le lanceur a
demandé une branche par session. Tu dois donc commiter, pousser ta branche et ouvrir la PR. Ce
n'est pas une interprétation, c'est l'instruction de la session.

## Interdits — un commit qui les viole est rejeté en revue

- Ne jamais toucher à `main` : ni commit, ni `push`, ni `rebase` dessus.
- Jamais de `git push --force`, jamais de réécriture d'historique.
- **Ne pas modifier `.docs/03-active-task.md`.** Ton journal va dans
  `.docs/sessions/<slug>/journal.md` ; le lanceur consolide après la vague, précisément pour
  éviter que deux sessions en parallèle écrivent le même fichier.
- Ne pas modifier `ROADMAP.md`, ni `.docs/01-architecture.md`, ni `.docs/02-database.md`,
  **sauf** pour passer le statut de *ta* table de **Contrat** à **Migrée**
  (`.docs/02-database.md` §2) — ce que ta phase doit faire.
- Ne pas éditer `apps/web/src/routeTree.gen.ts` à la main : il est généré par `tsr generate`,
  que lance `bun run --cwd apps/web typecheck`.
- Ne pas éditer `packages/db/src/types.generated.ts` à la main.
- Ne pas inventer de table, de colonne, d'index, ni de motif `currency_ledger` hors du contrat.
- Ne pas exécuter `bun`, `npm`, `tsc` ou `vite` sur l'hôte. **Tout passe par Docker.**
- Ne pas ajouter de dépendance sans la justifier dans le rapport.

## Fichiers partagés — la règle qui évite les conflits

D'autres sessions écrivent dans les mêmes fichiers. Sans exception :

- **Migration** : ta phase possède **un seul** numéro, donné dans ton brief. Tu n'en prends pas
  d'autre et tu ne renumérotes rien.
- **`packages/db/src/migrator.ts`** : ajoute ton `import` et ta clé **à la fin** de la liste,
  jamais au milieu.
- **`packages/db/src/schema.ts`** : ajoute tes interfaces **à la fin** du bloc concerné, et ton
  entrée `Database` **à la fin** de la liste.
- **`apps/web/src/styles.css`** : n'ajoute un jeton `@theme` que s'il est indispensable, et
  ajoute-le **à la fin** de son groupe.
- **`packages/spec`** : tu ne crées que tes fichiers de spec, tu ne réordonnes pas l'existant.

## Vérification — la seule preuve acceptée

```sh
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='{{TEST_DB_URL}}' \
  dev bun run ci:check
```

Quatre étapes, arrêt à la première en échec : lint, typecheck, ping PostgreSQL, spécifications.
Tant que ce n'est pas vert, la phase n'est pas faite. Ne rapporte jamais « fait » sur la foi d'un
typecheck seul, et ne cite pas un chiffre de spécifications que tu n'as pas vu passer.

## Ce que tu rends

1. La branche poussée et la PR en brouillon ouverte.
2. `.docs/sessions/<slug>/` : `plan.md`, `review.md`, `journal.md`.
3. Un rapport final de dix lignes maximum : ce qui est livré, ce qui ne l'est pas, les écarts
   assumés, et le résultat exact de `ci:check` (nombre de spécifications, nombre de fichiers).

Si un critère d'acceptation ne peut pas être tenu, **ne le coche pas**. Un critère non coché et
expliqué vaut mieux qu'un critère coché à tort.
