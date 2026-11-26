---
status: done
---

# Instruction: Retirer l'état de vérification de l'écran et des libellés

## Architecture projection

```txt
.
├── apps/web/src/routes/compte.tsx        ✏️ pastille, textes de confirmation, désactivation
└── apps/web/src/content/account.ts       ✏️ clés de vérification supprimées
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | session ouverte sur `/compte` | la salle s'affiche | browser |
| Happy path | lire la section Courriel | aucun texte « Vérifiée / Non vérifiée » | browser |
| Edge case | saisir une adresse et soumettre | le champ accepte la saisie, aucun blocage client | browser |
| Teardown | navigation hors de la salle | rien à défaire | browser |

## Wireframe

```txt
┌ Courriel ──────────────────────────────────┐
│ Adresse actuelle                            │
│ joueur@exemple.fr                           │
│                                             │
│ [ Nouvelle adresse            ]             │
│ ( Changer d'adresse )                       │
└─────────────────────────────────────────────┘
```

## Tasks to do

### `1)` Retirer la pastille et les textes de confirmation

1. Supprimer le bloc `user.emailVerified ? … : …` (pastille + phrase) de `EmailSection`.

### `2)` Ouvrir le formulaire en permanence

1. Retirer la prop `verificationOpen` de `EmailSection` et de son appel.
2. Retirer `canSubmit && verificationOpen`, le `disabled` du champ et le paragraphe conditionnel.

### `3)` Nettoyer les libellés

1. Supprimer `verified`, `unverified`, `verifiedHint`, `unverifiedHint`, `disabled`, `hint`.
2. Réécrire `description`, `submit`, `success` sans aucune mention de confirmation.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Aucun nœud de la salle ne contient « Vérifiée » ni « Non vérifiée » |
| 2 | `getByLabel('Nouvelle adresse')` n'est ni `disabled` ni `readOnly` |
| 3 | Aucun libellé orphelin : `grep` ne trouve plus les clés supprimées |
