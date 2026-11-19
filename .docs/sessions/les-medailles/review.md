# Revue — Phase 27, Les Médailles (succès → écus)

Relecture hostile du diff complet, puis corrections. Verdict final : **PRÊT À LIVRER**.

## Défauts trouvés et traités

### Bloquants

| # | Défaut | Correction |
| :-: | :--- | :--- |
| B1 | `routes/achievements.tsx` : pastille d'état en `text-[9px]`, sous le plancher de 10 px de `.docs/01-architecture.md` §4.9 | passé à `text-[10px]` ; `grep` sur `text-[` confirme qu'aucun autre texte ne descend sous 10 px |
| B2 | Aucune preuve de `ci:check` consignée au moment de la relecture | `journal.md` écrit après le premier passage vert, puis preuve rejouée après corrections : `ci:check` vert, 218 spécifications, 12 fichiers |

### Suggestions traitées

| # | Défaut | Correction |
| :-: | :--- | :--- |
| S-1 | `uniqueRue` balayait `ref_odonymes` (~450 000 lignes, sans index) à chaque appel | lecture des `ref_code` `RUE` du joueur, puis recherche bornée sur l'index primaire |
| S-2 | `collectMetrics` tournait deux fois par évaluation (~24 requêtes) | une seule collecte, projection pure réutilisée |
| S-3 | série d'assiduité chargeait tout l'historique de tickets | borne de 400 jours (le seuil du catalogue est 30) |
| S-4 | interrupteur fail-open : `value !== false` laissait le robinet ouvert sur une valeur inattendue | test strict `value === true` |
| S-6 | pastille de solde de la coquille non resynchronisée après un versement | invalidation de `sessionQueryKey` après réception des médailles |
| S-7 | `family: t.String()` perdait la liste fermée des familles | union de littéraux TypeBox |
| S-8 | `countAcceptedFriends` annoncée par le plan mais absente | fonction pure ajoutée et testée |
| S-9 | preuves manquantes : tickets distincts, Pépite, ventes/achats | trois cas d'intégration ajoutés |
| S-11 | plan et phases restés en `status: pending` | passés à `status: done` |

### Suggestions non traitées, assumées

| # | Point | Raison |
| :-: | :--- | :--- |
| S-5 | `GET /achievements` écrit (versement) au lieu d'un `POST /evaluate` séparé | c'est le contrat de la phase : l'évaluation se déclenche à la lecture, ce qui suffit à l'idempotence et évite d'alourdir les mutations du jeu. Le passage en `POST` demanderait de changer le contrat d'API ; à rouvrir en phase 30 si un cache intermédiaire devient possible |
| S-10 | « Les Médailles » n'est pas nommée dans `DESIGN_SYSTEM.md` | la consigne de session interdit d'éditer les documents de mémoire hors `.docs/02-database.md` §2. La salle est nommée là où le code en a besoin (`nav-items.ts`, `salonForPath`) ; la nomenclature design reste à consolider par le lanceur |

## Vérification finale

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_27' \
  dev bun run ci:check

✓ 1/4 Lint             173 fichiers, aucune correction
✓ 2/4 Typecheck        six workspaces
✓ 3/4 Base de données  PostgreSQL joignable
✓ 4/4 Spécifications   218 pass, 0 fail, 1272 expect() calls, 12 fichiers
```

## Écarts de contrat signalés (non corrigés)

1. **`"user".currency`** — `.docs/01-architecture.md` §2.8 interdit une écriture directe sur la
   colonne, mais le marché ne lit qu'elle (`market.ts:407`). Le versement écrit le grand-livre
   **et** la colonne dans la même transaction, comme l'achat existant. Trancher la contradiction
   exige d'éditer §2.8, interdit dans cette session.
2. **Médailles sociales** — `friendships` n'existe pas sur cette base ; les cinq médailles
   sociales sont déclarées et verrouillées (`friendsAccepted: null`), conformément au ROADMAP
   §2 (« declared and locked »). Le comptage `ACCEPTED` existe et est testé, mais n'est pas
   branché.

## Ce qui n'est pas prouvé

- Aucun passage navigateur : l'absence de défilement horizontal à 390 px est structurelle, non
  mesurée.
- Le cycle `down`/`up` de la migration 0011 n'a pas été rejoué (pas de commande `down` au runner).
