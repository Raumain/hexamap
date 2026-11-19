---
objective: "Un compte ne génère plus un ticket à la demande : il dépense une charge dérivée de last_regen_at, plafonnée par game_config, et le Relevé affiche le carnet et son compte à rebours."
status: implemented
---

# Plan: Phase 26 — Le Carnet

Source: `.docs/03-active-task.md` (Phase 26), `.docs/01-architecture.md` §2.6, `.docs/02-database.md` §4.1 / §4.7 / §6 / §7.1

## Phases

| #   | Phase                                                        | File                         | Depends on |
| --- | ------------------------------------------------------------ | ---------------------------- | ---------- |
| 1   | La formule partagée (packages/shared + spec rouge)            | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Le carnet en base (migration 0009, schéma, migrator, docs)    | [`phase-2.md`](./phase-2.md) | none       |
| 3   | Le service des charges (config, dérivation, verrou)           | [`phase-3.md`](./phase-3.md) | 1, 2       |
| 4   | L'API (GET /charges, consommation à la génération)            | [`phase-4.md`](./phase-4.md) | 3          |
| 5   | Le Relevé (carnet, compte à rebours, bouton désarmé)          | [`phase-5.md`](./phase-5.md) | 4          |
| 6   | Preuve (ci:check, banc E2E, mémoire de session)               | [`phase-6.md`](./phase-6.md) | 1, 2, 3, 4, 5 |

## External sources

| URL | What it settled |
| --- | --------------- |
| none | Le contrat est interne : `.docs/01-architecture.md` §2.6 porte la formule normative, `.docs/02-database.md` §4.7 le DDL. Aucune source externe consultée. |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| runtime | La génération de ticket devient conditionnée à une charge : `POST /api/v1/tickets` peut désormais répondre `409 NO_CHARGE_LEFT`. Aucun autre parcours ne change. | 4 |
| runtime | `packages/e2e/global-setup.ts` génère jusqu'à `MAX_TICKETS = 8` tickets pour **un même compte**, sans fenêtre de régénération : au plafond de 6, le parcours de préparation du banc échoue. Le banc relève donc son plafond par `game_config` (phase 6), ce qui est aussi la preuve que le plafond n'est pas en dur. | 6 |
| regression | Mesuré dans `packages/spec/src/tickets.spec.ts` : chaque cas crée un compte neuf par ticket ; le maximum observé est **2** générations pour un même compte (lignes 700/717). Reste une boucle de reprise (lignes 498/505) dont le nombre d'essais n'a pas été établi : il est à vérifier en phase 4, et s'il dépasse le plafond le cas est signalé, jamais modifié en silence. `market.spec.ts` et `tableaux.spec.ts` ne génèrent aucun ticket. | 4 |
| architecture | Un service `charges` devient l'unique propriétaire de la formule côté serveur, `packages/shared/src/charges.ts` l'unique propriétaire de la formule pure (serveur et front). Aucune duplication. | 1, 3 |
| documentation | `.docs/02-database.md` §2 : `user_scratch_charges` passe de **Contrat** à **Migrée**. C'est la seule modification autorisée hors `.docs/sessions/`. | 2 |

## Rules

| Rule | Why it applies |
| --- | --- |
| Tout s'exécute dans Docker | Aucune commande `bun`/`tsc` sur l'hôte, y compris pour la preuve. |
| Spec-first | `packages/spec/src/charges.spec.ts` est écrit et vu **rouge** avant le code qui le rend vert. |
| Le plafond ne s'écrit pas dans un `CHECK` | `SCRATCH_CHARGE_CAP` est un réglage de jeu : le passer à 8 ne doit demander aucune migration. |
| `FOR UPDATE` sur la ligne de charges | Deux générations parallèles ne peuvent pas dépenser la même dernière charge. Un `if` ne suffit pas. |
| `last_regen_at` avance de `g × regen`, jamais jusqu'à `now` | Sinon chaque lecture avale la fraction de minute en cours et le carnet dérive. |
| Un seul numéro de migration : `0009_scratch_charges` | Le brief réserve ce numéro ; aucune autre migration n'est créée. |
| Ajouts en fin de liste dans `migrator.ts`, `schema.ts`, `styles.css` | D'autres sessions écrivent les mêmes fichiers en parallèle. |
| `.docs/03-active-task.md`, `ROADMAP.md`, `01-architecture.md` intacts | Le journal vit dans `.docs/sessions/le-carnet/`. |
| Français uniquement, libellés centralisés dans `apps/web/src/content/` | Aucune dépendance i18n. |
| Aucune dépendance nouvelle | La formule est arithmétique pure, le compte à rebours est un `setInterval` local. |

## Decisions

| Decision | Why |
| --- | --- |
| La formule pure vit dans `packages/shared/src/charges.ts` et rend aussi le nouvel état (`charges`, `lastRegenAt`), pas seulement l'affichage | Le serveur doit persister l'état dérivé ; sans cela la route recalculerait la formule, ce qui en ferait un second propriétaire. |
| Un second helper pur, `chargesAt`, porte le décompte local du front | Interdire la copie de la formule côté navigateur ne tient que si le front n'a pas à réécrire l'arithmétique du compte à rebours. |
| La génération consomme la charge **dans** la transaction qui insère le ticket | Un échec de `tickets_one_active_per_user` annule alors la dépense : aucune charge perdue sur un `23505`. |
| L'erreur de configuration est levée à la lecture, pas par un hook de démarrage | Aucune valeur par défaut silencieuse ; mais un `onStart` couplerait le boot de l'API à l'ordre des migrations en développement. **Écart assumé** avec `.docs/02-database.md` §4.1 (« exigées au démarrage ») : la clé manquante produit un `503 GAME_CONFIG_MISSING` explicite à la première lecture, jamais une valeur de repli. Consigné en revue et au journal. |
| `config.ts` ne lit que les trois clés `SCRATCH_*` | La disponibilité des charges ne doit pas dépendre d'une clé des phases 27 à 29 : une clé amie manquante ne peut pas fermer la génération de tickets. Les trois autres clés restent au contrat, lues par leurs phases. |
| La formule partagée compte en millisecondes epoch, la base en `timestamptz` | Conversion en un seul endroit, `services/charges.ts` (`date.getTime()` à l'entrée, `new Date(ms)` à la sortie). Aucun `number` ne franchit la frontière de la base. |
| Le pré-contrôle `TICKET_ALREADY_ACTIVE` reste hors transaction, la consommation est dedans | Le pré-contrôle évite de payer une charge pour un refus évident ; la course résiduelle (`23505` sur `tickets_one_active_per_user`) fait annuler la transaction, donc la dépense. Les deux comportements sont couverts par un cas. |
