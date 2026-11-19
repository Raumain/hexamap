---
objective: "Deux joueurs se lient par une demande acceptée, se retirent et se bloquent, avec une seule ligne par paire non ordonnée et une salle dédiée dans la coquille."
status: pending
---

# Plan: Phase 28 — Les Amis

Source : `scripts/agents/prompts/28.md`, `.docs/01-architecture.md` §2.9, `.docs/02-database.md` §4.1/§4.9/§7.1, `ROADMAP.md` §2 (phase 28).

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Cas rouges (`friends.spec.ts`) | [`phase-1.md`](./phase-1.md) | none |
| 2   | Contrat de données (migration `0010`, schéma, statut) | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Service et routes API | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | La salle « Les Amis » (web) | [`phase-4.md`](./phase-4.md) | 3 |
| 5   | Preuve, revue, livraison | [`phase-5.md`](./phase-5.md) | 4 |

## External sources

| URL | What it settled |
| --- | --------------- |
| none | Le contrat est local (`.docs/01-architecture.md` §2.9, `.docs/02-database.md` §4.9) |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | Nouvelles routes `/api/v1/friends*` et `/api/v1/blocks`, montées dans `protectedRoutes` de `apps/api/src/app.ts` ; aucune route existante modifiée | 3 |
| regression | `packages/db/src/migrator.ts` et `schema.ts` sont partagés avec les phases 26/27/29 : ajout **en fin de liste** uniquement. `PRIMARY_NAV` reste à 4 entrées ; `SECONDARY_NAV` passe de 3 à 4, ce que `packages/e2e/tests/mobile.spec.ts` tolère (inclusion, pas exhaustivité : `SECONDARY_LABELS` l.753) | 2, 4 |
| architecture | `friendships`/`blocks` passent de **Contrat** à **Migrée** dans `.docs/02-database.md` §2 — seule modification autorisée de ce document | 2 |
| documentation | `DESIGN_SYSTEM.md` §2 (ligne de salle) et §8 (nouvelle sous-section 8.8) : nommer la salle, rien d'autre | 4 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| AGENTS.md §1 — tout via Docker | `ci:check`, specs et migrations passent par `docker compose --profile tools run --rm dev` |
| AGENTS.md §2 — spec-first | `friends.spec.ts` est écrit et vu rouge avant la migration et les routes |
| AGENTS.md §4 — aucune table inventée | DDL strictement copié de `.docs/02-database.md` §4.9 |
| AGENTS.md §5 — serveur autoritaire | symétrie, plafond quotidien, délai de réouverture et blocage sont décidés côté serveur |
| Fichiers partagés | `migrator.ts`, `schema.ts` : ajouts en fin de liste ; un seul numéro de migration (0010) |

## Decisions

| Decision | Why |
| -------- | --- |
| `:id` des routes de demande est l'**identifiant du joueur homologue**, pas un identifiant de ligne | `friendships` n'a pas de clé de substitution : sa clé primaire est la paire `(requester_id, addressee_id)`. Inventer un id aurait exigé une colonne hors contrat |
| Un helper local `readGameConfigNumber` dans `services/friends.ts` | Aucun lecteur de `game_config` n'existe dans le dépôt (grep exhaustif) ; la phase 26 créera le sien. Un fichier partagé créerait un conflit d'écriture entre sessions |
| `FRIEND_REQUEST_DAILY_CAP` et `FRIEND_REQUEST_REOPEN_MS` semés par la migration 0010 en `ON CONFLICT DO NOTHING` | §4.1 exige les clés au démarrage, aucune migration ne les sème aujourd'hui ; `DO NOTHING` rend le semis idempotent face au semis des six clés de la phase 26 |
| La demande croisée est **absorbée en acceptation mutuelle** | « absorbée proprement » : deux consentements valent acceptation, et l'index de paire interdit la seconde ligne |
| Statut `429 FRIEND_REQUEST_CAP_REACHED` | Un plafond de débit est un 429, pas un 409 de conflit d'état |
| Pas de pastille de demandes dans la coquille | La pastille exigerait une requête permanente dans `app-shell` et changerait le nom accessible des liens (les sélecteurs E2E passent par `getByRole(..., { name })`). Le brief ne la liste pas dans « Ce que tu produis » ; écart consigné dans le rapport |
