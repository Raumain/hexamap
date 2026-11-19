---
status: pending
---

# Instruction: La salle « Les Amis »

## Architecture projection

```txt
.
├── ✏️ DESIGN_SYSTEM.md
├── ✏️ apps/web/src/components/layout/nav-items.ts
├── ✅ apps/web/src/content/friends.ts
├── ✅ apps/web/src/lib/friends.ts
└── ✅ apps/web/src/routes/friends.tsx
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | session ouverte, base sans lien | la salle affiche trois sections vides | browser |
| Happy path | rechercher un pseudo, envoyer, accepter depuis l'autre compte | l'ami apparaît dans « Mes amis » des deux côtés | browser |
| Edge case | recherche inconnue, auto-demande, plafond atteint | message d'erreur français sous le formulaire | browser |
| Teardown | rien (aucun état local persistant) | — | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────┐
│ (1) En-tête de salle : « Les Amis » + chapô                  │
├──────────────────────────────────────────────────────────────┤
│ (2) Recherche : [ pseudo .................. ] [ Ajouter ]    │
│     (3) message d'erreur / de confirmation (aria-live)       │
├───────────────────────────────┬──────────────────────────────┤
│ (4) Demandes reçues           │ (6) Mes amis                 │
│  ┌──────────────────────────┐ │  ┌────────────────────────┐  │
│  │ pseudo   [Accepter]      │ │  │ pseudo                 │  │
│  │          [Refuser]       │ │  │ [Retirer] [Bloquer]    │  │
│  └──────────────────────────┘ │  └────────────────────────┘  │
│ (5) Demandes envoyées         │                              │
│  ┌──────────────────────────┐ │                              │
│  │ pseudo      [Annuler]    │ │                              │
│  └──────────────────────────┘ │                              │
└───────────────────────────────┴──────────────────────────────┘
```

1. En-tête : nom de la salle, cohérent avec `routes/tableaux.tsx`.
2. Formulaire de recherche : un champ `pseudo` et un bouton « Ajouter ».
3. Zone de retour : `aria-live="polite"`, message français d'erreur (code stable traduit) ou de succès.
4. Demandes reçues : une ligne par demande, `Accepter` et `Refuser`.
5. Demandes envoyées : une ligne par demande, `Annuler`.
6. Mes amis : une ligne par ami, `Retirer` et `Bloquer`.

## Tasks to do

### `1)` Client et libellés

> Calqué sur `lib/market.ts`, sans invention.

1. `apps/web/src/lib/friends.ts` : `FriendsApiError`, `friendsQueryKey = ['friends'] as const`, `fetchFriends`, `friendsQueryOptions` (`staleTime: 10_000`, `retry: false`), `sendRequest`, `acceptRequest`, `declineRequest`, `removeFriend`, `blockPlayer`, `friendsErrorMessage(error)` traduisant `SELF_FRIENDSHIP`, `PLAYER_NOT_FOUND`, `FRIENDSHIP_EXISTS`, `FRIENDSHIP_BLOCKED`, `FRIEND_REQUEST_REOPEN_TOO_SOON`, `FRIEND_REQUEST_CAP_REACHED`, `FRIENDSHIP_NOT_FOUND`, avec repli générique.
2. `apps/web/src/content/friends.ts` : tous les libellés de la salle, les noms de sections et les verbes d'action.

### `2)` La salle

1. `apps/web/src/routes/friends.tsx` : `createFileRoute('/friends')`, garde de session en trois états (`isPending` → ligne mono, `!user` → `Navigate to="/login"`, sinon corps), `useQuery(friendsQueryOptions)`, états chargement / erreur (`Réessayer`) / vide, puis le wireframe ci-dessus. Deux colonnes à partir de `lg`, une seule en dessous. `min-h-[44px]` sur chaque contrôle.
2. Chaque mutation invalide `friendsQueryKey` ; aucune mise à jour optimiste.

### `3)` La coquille

1. `apps/web/src/components/layout/nav-items.ts` : `'/friends'` ajouté à `SalonPath`, entrée `Les Amis` / `Amis` dans `SECONDARY_NAV` (après `Les Planches`), `SALON_TITLES['/friends'] = 'Les Amis'`. `PRIMARY_NAV` reste à quatre entrées.
2. `more-sheet.tsx`, `sidebar.tsx` et `bottom-tab-bar.tsx` itèrent déjà sur `SECONDARY_NAV` : aucune modification sauf si le type l'exige.
3. `DESIGN_SYSTEM.md` : une ligne dans le tableau §2, une sous-section `8.8 Les Amis`. Rien d'autre.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `lib/friends.ts` n'importe que des types d'Eden (`import type { App }`), aucun `any` |
| 2 | À 390 px : aucun défilement horizontal, chaque bouton mesure au moins 44 px, un seul `<main>` |
| 2 | Après acceptation, la liste se met à jour sans rechargement de page |
| 3 | La salle est atteignable en deux appuis depuis `/` sur mobile (barre basse puis « Plus ») et s'allume dans le rail |
| 3 | `bun run lint` et `bun run typecheck` propres (le typecheck lance `tsr generate`) |
