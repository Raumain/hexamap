# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

# La feuille de route v2

## Statut

- **Phase** : hors phase numérotée — planification de la v2
- **État** : planification et outillage écrits ; aucun fichier de `apps/`, de `packages/spec` ni
  de migration touché ; `ci:check` vert et banc E2E complet **68 passés, 0 échoué, 0 ignoré** ; le
  lanceur de la v2 est en place, jamais exercé sur une vraie phase
- **Priorité** : P1
- **Mis à jour** : 2026-11-22
- **Branche** : `v2`
- **Livraison** : cinq commits sur `v2`, poussés

## Objectif

La v1 est en production et son périmètre est clos. Quatre demandes restent ouvertes côté produit —
voir sa collection sur une carte, être prévenu de ce qui arrive, gérer son compte, échanger avec
un autre joueur — et l'une d'elles est déjà à moitié construite : la salle `/assemblage` existe
avec son teaser et son contour de France, sans donnée joueur derrière. La v2 est donc planifiée
avant d'être codée, pour que l'ordre des phases soit une décision et non une conséquence.

## Décisions

1. **Carte à trois niveaux dès la v2.0** — régions, départements, communes —, en descente guidée,
   sans déplacement ni zoom libre.
2. **Notifications : cloche et salle « Le Guichet ».**
3. **Notifications poussées en v2.1**, après le centre de notifications.
4. **Périmètre retenu** : Le Troc, L'Atelier (fusion de doublons), les filtres du Cadastre
   alimentés par la carte, Le Palmarès. **Écartés** : enchères, guildes, objectifs hebdomadaires,
   partage d'image et Open Graph, rues sur la carte, comparaison inter-joueurs, chat, SSE et
   websockets.

## Ce qui a changé

| Fichier | Changement |
| :--- | :--- |
| `.docs/07-roadmap-v2.md` | **Nouveau.** Les douze phases (32 à 43), les deux jalons, le contrat de données à venir, les décisions ouvertes, le hors-périmètre et la définition de terminé. |
| `AGENTS.md` | La section « Git et publication » vise `v2` comme branche de base : `main` ne reçoit plus que des merges de release. `.docs/07-roadmap-v2.md` entre dans la lecture obligatoire et dans le tableau de mémoire. |
| `ROADMAP.md` | Un renvoi en tête de fichier : la v2 vit ailleurs, ce document ne suit plus que les restes de la v1, et le track C est absorbé par les phases 33 à 35. |
| `.docs/03-active-task.md` | Cette entrée. |
| `.docs/08-journal.md` | **Nouveau.** L'archive des 3 804 lignes d'historique retirées de `03`, avec son en-tête. |
| `scripts/agents/run.sh` | Réparé : `COMPOSE_PROJECT`, lots de vague, régénération de `routeTree.gen.ts`, options `--gate`, `--pr`, `--e2e`. |
| `scripts/v2/` | **Nouveau.** `plan.tsv` (huit vagues, douze phases), `run.sh` (garde-fou et valeurs de la v2), `README.md`. |
| `scripts/agents/prompts/32.md` | **Nouveau.** Le brief de la phase 32. |

## Ce qui reste

Par ordre de dépendance :

1. **Track A2 — levé le 2026-11-22.** Référentiel importé manuellement en production (déclaration
   du titulaire, non revérifiée depuis cette machine). Il reste que la donnée vit dans les volumes :
   un volume neuf exige un réimport.
2. **Pages légales** — `LEGAL_PAGES_ENABLED = true` avec le texte définitif avant la phase 37 : on
   ne publie pas une suppression de compte dont la politique de confidentialité répond `404`.
3. **Phase 32 — Le Socle** : découpage par route, fermeture de BUG-001, BUG-002 et BUG-003,
   fixture E2E de second compte.
4. **Phase 33 → 35 — L'Assemblage**, dans cet ordre et sans parallélisme possible.
5. **Le Troc (phase 40) peut remonter en v2.0** si la carte et les comptes sortent tôt. C'est la
   seule permutation prévue.
6. **Les six décisions ouvertes** du §6 de `.docs/07-roadmap-v2.md` : nom de la salle, contenu de
   la carte, forme du troc, Atelier aléatoire ou déterministe, Palmarès figé ou instantané, jeu de
   caractères du pseudo.

## Vérification (Docker uniquement)

```
docker compose --profile tools run --rm dev bun run ci:check
  ✓ 1/4 Lint            253 fichiers, aucune correction
  ✓ 2/4 Typecheck       6 workspaces
  ✓ 3/4 Base de données joignable
  ✓ 4/4 Spécifications  343 pass, 0 fail, 18 fichiers
```

Quatre passages consécutifs ont rendu **1 977**, **1 983**, **1 986** puis **1 982** `expect()` pour
343 tests et 18 fichiers : le compte d'assertions n'est pas un invariant, certaines vivant dans une
boucle sur le référentiel. Les chiffres stables sont **343 spécifications** et **18 fichiers**.

```
docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  68 exécutés — 68 passés, 0 échoué, 0 ignoré
  chromium  21 · pwa 7 · Pixel 7  20 · iPhone 13  20
```

Le cas `mobile — la boutique n'est plus offerte ni atteignable` a été **réécrit** : le produit a
retiré la boutique (`SHOP_ENABLED = false`), donc il n'asserte plus son fonctionnement mais son
absence — aucune entrée « La Boutique » dans la feuille, aucun titre de salle, aucun bouton
« Acheter » ni message `SHOP_DISABLED` sur `/boutique`. Ce n'est pas un test affaibli : l'ancien
cas exigeait quatre planches et un `503`, c'est-à-dire un produit qui n'existe plus ; le nouveau
exige la disparition de tout cela, ce qui échoue si la boutique revient sans décision. Rejoué seul
en `--repeat-each=3` sur les deux projets : **6/6 vert** en 25 s.

Le `notFound()` de la route ne rend **aucun** composant français : `apps/web/src/main.tsx` crée le
routeur sans `defaultNotFoundComponent`, donc c'est la page par défaut de TanStack Router, en
anglais. Le cas n'asserte donc pas ce texte — l'écart de langue est consigné ici, pas corrigé.

## Journal

### 2026-11-22 — La v2 est cadrée sur le papier, pas encore dans le code

**Ce qui a été vérifié dans le code, et non supposé.** Le profil public existe déjà
(`apps/web/src/routes/players.$playerId.tsx`, `GET /api/v1/players/:id` adossé à `user_profiles`)
et rend le score du meilleur tableau sans ses cartes — c'est ce qui fait de la phase 38 une petite
phase et non une fonctionnalité. À l'inverse, aucune page de compte n'existe :
`apps/api/src/routes/profile.ts` ne sait qu'écrire `bio` et `profile_public`, et il n'y a ni
changement de pseudo, ni courriel vérifié, ni suppression. Aucun code de notification n'existe
dans `apps/`. La carte n'a qu'un teaser : `apps/web/src/routes/assemblage.tsx` et
`apps/web/src/lib/france-outline.ts`, aucun `path_d` nulle part, aucun endpoint d'atlas.

**Le déclencheur CI, constaté et non modifié.** `.github/workflows/ci.yml` déclenche sur `push`
limité à `branches: [main]` et sur `pull_request` **sans filtre de branche**. Une PR vers `v2` est
donc vérifiée ; un `push` direct sur `v2` ne l'est pas. Le fichier n'a pas été touché : la
constatation est écrite en phase 32 pour que la première livraison ne se demande pas pourquoi rien
n'a tourné.

**Pourquoi deux jalons, et pas un.** Douze phases d'un bloc auraient retardé la carte — le chemin
critique, trois phases dépendantes qui ne se parallélisent pas — derrière le troc et le palmarès,
dont personne n'a besoin pour jouer. La v2.0 s'arrête donc au Guichet (phases 32 à 39) et la v2.1
porte l'échange (phases 40 à 43).

**Les deux bloqueurs, écrits pour ne pas être découverts en cours de route.** Le track A2 — le
référentiel importé en production — est **levé le 2026-11-22** : le titulaire déclare l'avoir
importé manuellement en production ; non revérifié depuis cette machine. La donnée vit dans les
volumes, pas dans l'image, donc un volume neuf exige un réimport. Reste les pages légales, qui
répondent `404` depuis `chore/retrait-boutique-et-pages-legales` : la phase 37 ne peut pas publier
de suppression de compte avant le texte définitif.

**Ce que cette session a mesuré, et ce qu'elle n'a pas prouvé.** Aucun fichier de `apps/`, de
`packages/spec` ni de migration n'a été modifié ; seul le cas E2E de la boutique retirée a changé,
parce que le banc l'a trouvé faux. Aucune table n'est créée ici — le §5
de `.docs/07-roadmap-v2.md` annonce six migrations, et `.docs/02-database.md` reste intact jusqu'à
la phase qui les portera. Les deux vérifications ont été jouées dans Docker après l'écriture du
document : `ci:check` vert (**343 spécifications, 18 fichiers, 0 échec**), et le banc E2E — qui a
d'abord trouvé deux échecs réels sur le cas de la boutique, réécrit dans cette même session, voir
la section de vérification ci-dessous — rend **68 exécutés, 68 passés, 0 échoué, 0 ignoré**.
Aucun build n'a été mesuré pendant cette session : les chiffres de bundle du §2 de la feuille de
route restent ceux du dépôt au 2026-11-22. La branche `v2` est créée localement depuis `main` et
n'a pas été poussée.

**Portée** : `.docs/07-roadmap-v2.md` (nouveau), `AGENTS.md`, `ROADMAP.md`, `.docs/05-deploiement.md`,
`packages/e2e/tests/mobile.spec.ts` (le cas de la boutique retirée, réécrit) et ce fichier. Aucune
migration, aucun changement de schéma ni de contrat d'API, aucune dépendance nouvelle, aucun
fichier de `apps/` ni de `packages/spec` touché.

**Mise à jour du 2026-11-22 — A2 levé.** Le titulaire déclare avoir importé le référentiel
manuellement en production ; non revérifié depuis cette machine. La phase 33 n'est donc plus
bloquée : son audit porte sur la **qualité** des `geom` (couverture, `null`, taille, outre-mer), pas
sur leur présence. La donnée vit dans les volumes `blasons` et dans la base, jamais dans l'image :
un volume neuf ou une restauration exige un réimport, et `scripts/backup.sh` (A5) couvre déjà ces
volumes. Ports et zones réseau inchangés. Aucun fichier d'exécution touché, aucun banc rejoué : un
document ne change pas un comportement observable. `ci:check` rejoué après ces corrections : vert
(**343 spécifications, 18 fichiers, 0 échec**).

### 2026-11-22 — Le lanceur de la v2, et le journal découpé

**Ce qui a été mesuré avant de coder.** `.docs/03-active-task.md` faisait **3 962 lignes**, et
`AGENTS.md` impose sa lecture à chaque session : avec `01`, `02`, `07` et `AGENTS.md`, environ
80 000 tokens de contexte par phase, près d'un million sur la v2 avant la première ligne de code.
`03` garde donc 158 lignes et les 3 804 autres partent dans `08` — la somme est vérifiée, aucune
ligne perdue.

**Le défaut qui aurait bloqué la première exécution.** Aucun `COMPOSE_PROJECT_NAME` n'existe dans
le dépôt : lancé depuis un worktree, Compose dérive le nom du projet du dossier, crée une pile
neuve et un `db` vide. La base `hexamap_test_<phase>` créée dans la pile principale était donc
injoignable, et le premier `ci:check` aurait échoué pour une raison sans rapport avec la phase.
`dc()` porte désormais `-p "$COMPOSE_PROJECT"`, sans jamais exporter `COMPOSE_PROJECT_NAME` — cela
écraserait le `name: hexamap-e2e` du banc.

**Trois autres défauts corrigés.** Une vague de plus de deux phases ouvrait un second lot et
`build_wave` réinitialisait la branche d'accumulation : le premier lot était perdu en silence. Le
conflit sur `routeTree.gen.ts` était résolu par `checkout --ours` puis committé **sans
régénération** — le commentaire disait le contraire. Et le lanceur n'ouvrait aucune PR : une
session qui oubliait la sienne ne laissait rien derrière elle.

**Le graphe, et pourquoi il est si séquentiel.** Huit vagues, deux sessions au plus. Le schéma est
le vrai goulot : `migrator.ts` et `schema.ts` sont partagés, donc **une seule migration par
vague** — ce qui sérialise les phases 41, 42 et 43. La coquille (`components/layout/`) est le
second fichier partagé, d'où un seul propriétaire par vague.

**Décisions de process, prises avec le titulaire.** Chaîne empilée comme la phase B : la PR d'une
phase cible la branche de sa vague parente, la vague 1 cible `v2`. Aucun merge automatique. Une
seule vague par invocation, refusée sans `--wave`.

**Ce que cette session ne prouve pas, et qui est écrit comme tel.** Le lanceur n'a **jamais**
exécuté une vraie phase : seuls des `--dry-run` ont tourné, comme pour la phase B. `--auto` donne
à la session l'accès au `.env` copié dans le worktree, donc à tous les secrets. Le banc E2E n'est
pas parallélisable (`name` et volume fixes) et tourne une fois par vague. Aucune reprise
automatique n'existe. Un nettoyage de `--dry-run` a supprimé `../hexamap-agents-logs`, qui portait
les transcripts de la phase B — logs et prompts uniquement, hors versionnement.

**Portée** : `scripts/agents/run.sh`, `scripts/v2/{plan.tsv,run.sh,README.md}`,
`scripts/agents/prompts/32.md`, `.docs/08-journal.md` (nouveau), `.docs/03-active-task.md`,
`.docs/07-roadmap-v2.md`, `AGENTS.md`. Aucune migration, aucun changement de schéma ni de contrat
d'API, aucune dépendance nouvelle.

---

