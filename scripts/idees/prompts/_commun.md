# Préambule commun — session d'agent Hexamap (campagne « retours v2 »)

Tu exécutes **un** retour produit de `.docs/10-retours-v2.md`, seul, dans un worktree git
dédié. D'autres sessions travaillent en parallèle sur d'autres branches : tu ne les vois pas, tu
ne les attends pas, et tu ne touches à rien hors de ton périmètre.

## Lecture obligatoire, dans cet ordre

1. `AGENTS.md` (racine) — les règles non négociables du dépôt.
2. `.docs/01-architecture.md` — GDD, stack, règles d'architecture.
3. `.docs/02-database.md` — contrat SQL et types Kysely.
4. **`.docs/10-retours-v2.md` — l'entrée de ta phase, qui fait foi.** Elle nomme le retour, ce
   qu'il demande, et ce qu'il autorise à changer.
5. Ton brief de phase — il t'est fourni dans le prompt de la session.

**`.docs/03-active-task.md` t'est interdit** : il n'est pas l'ordre du jour de cette campagne, et
plusieurs sessions l'écriraient en même temps. Ton journal va dans
`.docs/sessions/<slug>/journal.md`.

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
6. **`02-pull-request`** — charge la skill, ouvre une **PR en brouillon** vers la branche
   cible indiquée dans tes paramètres (`{{PARENT}}`) — **pas vers `main`**. Empiler une PR sur
   `main` casse la chaîne : ta phase contient le travail de ses dépendances, et la PR doit
   montrer ton diff, pas le leur.

Les skills se chargent avec l'outil `skill`, par identifiant. Si une skill ne se charge pas,
applique ses étapes à la main et dis-le dans le rapport — ne saute pas l'étape.

## Le tour se termine, la session meurt — committe avant d'attendre

`opencode run` rend la main **dès que ton tour s'achève**, et il ne reprend jamais : une session
interrompue ne se réveille pas, et tout ce qui n'est pas committé est perdu. Deux phases de la v2
l'ont payé — la salle L'Atlas entière, puis le Palmarès, écrits, vérifiés au vert, et jamais
committés, parce que le tour s'est terminé sur « j'attends le verdict ».

Deux règles, sans exception :

- **Ne termine jamais ton tour en attendant un sous-agent.** Si tu délègues, attends le verdict
  dans le même tour. Un sous-agent laissé en arrière-plan ne travaille pas pour toi : la session
  est déjà morte quand il rend sa réponse.
- **Committe à chaque étape vérifiée, jamais un seul commit à la fin.** Un `ci:check` vert est
  une raison de committer tout de suite, pas une raison d'attendre le suivant.

## Avant d'ouvrir la PR — la branche de base doit exister

Ta PR cible `{{PARENT}}`. `gh pr create --base` échoue si cette branche n'est pas sur
l'origine, et la tentation est alors de viser `main` : c'est la seule erreur qui casse toute la
chaîne, parce que la PR afficherait le diff de tes dépendances au lieu du tien.

```sh
git ls-remote --exit-code --heads origin '{{PARENT}}'
```

- **Code de sortie 0** — la branche est là : ouvre la PR.
- **Code de sortie 2** — elle manque : attends 2 minutes (`sleep 120`) et réessaie, **5 fois au
  maximum**, soit 10 minutes. C'est une course possible avec le push du lanceur, pas un état
  normal — ne boucle pas indéfiniment.
- **Toujours absente après 10 minutes** — n'ouvre **aucune** PR et ne la cible **pas** sur
  `main`. Écris le blocage dans `.docs/sessions/<slug>/review.md` avec la commande et sa sortie,
  laisse ta branche poussée, et arrête-toi. Le lanceur accumulera la vague quand la cause sera
  réparée.

Ne choisis jamais `main` « en attendant » : c'est exactement le défaut que l'empilement évite.

## Exception explicite à la règle 8 d'`AGENTS.md`

`AGENTS.md` interdit de commiter sans demande explicite. **La demande est ici** : le lanceur a
demandé une branche par session. Tu dois donc commiter, pousser ta branche et ouvrir la PR. Ce
n'est pas une interprétation, c'est l'instruction de la session.

## Mémoire projet — admise, avec parcimonie

Contrairement à la campagne v2, cette campagne **peut** mettre à jour la mémoire projet :
`.docs/01-architecture.md`, `.docs/02-database.md`, `.docs/05-deploiement.md`,
`.docs/06-cadre-juridique.md` et `packages/e2e` — **uniquement lorsque l'entrée de
`.docs/10-retours-v2.md` l'exige explicitement**. Toute autre modification de la mémoire est
refusée en revue. Le moindre doute se tranche dans le sens du refus : un diff de mémoire qu'on
ne peut pas rattacher à une phrase du contrat est un diff en trop.

## Interdits — un commit qui les viole est rejeté en revue

- Ne jamais toucher à `main` : ni commit, ni `push`, ni `rebase` dessus. `main` est en lecture
  seule pour cette campagne.
- Jamais de `git push --force`, jamais de réécriture d'historique.
- **Ne pas modifier `.docs/03-active-task.md`.** Ton journal va dans
  `.docs/sessions/<slug>/journal.md` ; le lanceur consolide après la vague, précisément pour
  éviter que deux sessions en parallèle écrivent le même fichier.
- Ne pas éditer `apps/web/src/routeTree.gen.ts` à la main : il est généré par `tsr generate`,
  que lance `bun run --cwd apps/web typecheck`.
- Ne pas éditer `packages/db/src/types.generated.ts` à la main.
- Ne pas inventer de table, de colonne, d'index, ni de motif `currency_ledger` hors du contrat.
- Ne pas exécuter `bun`, `npm`, `tsc` ou `vite` sur l'hôte. **Tout passe par Docker.**
- Ne pas ajouter de dépendance sans la justifier dans le rapport.
- **Aucun `skip`, aucun `.fixme`, aucun délai relâché pour faire passer le banc.** Un cas rouge
  se corrige, il ne se tait pas.
- **Aucun cas de `packages/spec` existant réécrit pour faire passer une implémentation.** La
  spécification est la source de vérité ; c'est le code qui s'y adapte.

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

Quand la phase touche une **surface visible**, la porte ne suffit pas : joue le banc E2E. Un
contrôle qui compile n'est pas un contrôle qui marche.

## Ce que tu rends

1. La branche poussée et la PR en brouillon ouverte.
2. `.docs/sessions/<slug>/` : `plan.md`, `review.md`, `journal.md`.
3. Un rapport final de dix lignes maximum : ce qui est livré, ce qui ne l'est pas, les écarts
   assumés, et le résultat exact de `ci:check` (nombre de spécifications, nombre de fichiers).

Si un critère d'acceptation ne peut pas être tenu, **ne le coche pas**. Un critère non coché et
expliqué vaut mieux qu'un critère coché à tort.
