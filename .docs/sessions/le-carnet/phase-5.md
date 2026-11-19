---
status: done
---

# Instruction: Le Relevé

## Architecture projection

```txt
apps/web/src/
  lib/charges.ts               ✅ client Eden, clé et options de requête
  content/tickets.ts           ✏️ libellés du carnet, ajoutés en fin de fichier
  components/charges-meter.tsx ✅ six points + compte à rebours local
  routes/index.tsx             ✏️ le carnet au-dessus du bouton, bouton désarmé à zéro
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | session ouverte, `GET /charges` = `{charges: 4, cap: 6, nextChargeAt: T, regenMs}` | quatre points pleins | browser |
| Happy path | attente d'une seconde | le compte à rebours se décrémente **sans requête réseau** | browser |
| Happy path | clic sur « Obtenir un ticket » | navigation vers le ticket, le carnet affiche un point de moins et un compte à rebours | browser |
| Edge case | `charges: 0` | bouton désarmé, libellé « Aucune charge disponible », compte à rebours affiché | browser |
| Edge case | `nextChargeAt` dépassé pendant l'affichage | le point est crédité localement, le solde ne dépasse jamais `cap` | browser |
| Teardown | aucun | aucun solde écrit dans le cache du service worker | system |

## Wireframe

```txt
┌ Le Relevé (1)─────────────────────────────────────┐
│  SALLE I · LE RELEVÉ                              │
│  Le relevé topographique                          │
│                                                   │
│  Chaque bordereau porte seize cases…              │
│  Bienvenue, {pseudo}.                             │
│                                                   │
│  CARNET DE CHARGES (2)                            │
│  ● ● ● ● ○ ○        4 charges sur 6  (3)          │
│  Prochaine charge dans 12:34   (4)                │
│  ┌──────────────────────────────────────┐         │
│  │  Obtenir un ticket          (5)      │         │
│  └──────────────────────────────────────┘         │
│  ⚠ Aucune charge disponible (état zéro)  (6)      │
└───────────────────────────────────────────────────┘

1. La salle du Relevé, route `/`.
2. Le carnet, monté au-dessus de l'action de génération.
3. Les points : `cap` au total, `charges` pleins, le reste vide ; libellé accessible obligatoire.
4. Le compte à rebours local, rendu depuis `nextChargeAt` et `regenMs`, absent au plafond.
5. L'action de génération, désarmée quand le carnet est vide.
6. Le motif du désarmement, affiché seulement à zéro charge.
```

## Tasks to do

### `1)` Le client

1. `apps/web/src/lib/charges.ts`: `chargesQueryKey`, `fetchCharges`, `chargesQueryOptions` sur le modèle de `lib/tickets.ts` (même extraction d'erreur Eden).
2. `staleTime: 0`, aucun `refetchInterval`, `retry: false` : chaque montage du Relevé relit une fois le carnet, la mutation resynchronise, et rien ne sonde.
3. Le type de la réponse vient d'Eden (`GET /charges` a un schéma `response` depuis la phase 4) — jamais d'interface écrite à la main.

### `2)` Le carnet

1. `apps/web/src/components/charges-meter.tsx`: reçoit `charges`, `cap`, `nextChargeAt` (chaîne ISO ou `null`), `regenMs`; rend `cap` points (pleins en `brass`, vides en `vellum-edge`), le libellé accessible « n charges sur cap », et un compte à rebours `mm:ss`.
2. **Source du tic**: un unique `setInterval(…, 1 000)` sur l'horloge du navigateur, posé dans un `useEffect` et nettoyé par son retour — jamais une requête, jamais un `requestAnimationFrame`.
3. Le décompte local appelle `chargesAt` de `@hexamap/shared` — jamais une division réécrite dans le composant.
4. Le composant ne crédite jamais au-delà de `cap` et n'affiche jamais de compte à rebours quand `nextChargeAt` est `null`.
5. `role="timer"`, `aria-live="off"`, texte en `tabular-nums`. Aucune couleur littérale, aucun `transition-all`.

### `3)` Le Relevé

1. `routes/index.tsx`: `CurrentTicketCta` lit `chargesQueryOptions`, rend `<ChargesMeter>` au-dessus de l'action.
2. Bouton « Obtenir un ticket » désarmé quand `charges === 0`, avec la raison visible et `aria-disabled` cohérent.
3. `createMutation` invalide `chargesQueryKey` en succès **et** en erreur — c'est la resynchronisation prévue, il n'y a pas d'autre appel.
4. Libellés dans `apps/web/src/content/tickets.ts`, ajoutés en fin de fichier sous `CHARGES`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Aucun `refetchInterval` vers `/charges` : une seule requête par affichage, plus celle de la mutation. |
| 2 | Le compte à rebours ne déclenche aucune requête réseau pendant une minute d'observation. |
| 2 | Les points sont lisibles sans couleur seule (libellé « n charges sur cap »). |
| 3 | À zéro charge, le bouton est inerte et le motif affiché. |
| 3 | Aucun texte visible sous 10 px, aucun jeton `@theme` ajouté. |
