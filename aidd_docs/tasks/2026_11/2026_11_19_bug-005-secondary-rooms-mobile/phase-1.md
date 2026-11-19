---
status: pending
---

# Instruction: Le filet rouge (cas e2e de la barre basse)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── packages/e2e/tests/mobile.spec.ts   ✏️ modify
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `page.goto('/')` avec le `storageState` du `global-setup` (session déjà ouverte) | Le Relevé est rendu, la barre basse visible | browser |
| Happy path   | Depuis `/`, appui sur le contrôle « Plus » puis sur « Les Planches » | `page.url()` se termine par `/tableaux` et un `h1` est visible — deux appuis, aucun autre | browser |
| Edge case    | Depuis `/tableau`, ouvrir la feuille | Le lien « Les Planches » n'a pas `aria-current="page"` ; depuis `/tableaux`, il l'a | browser |
| Edge case    | Ouvrir la feuille puis `Escape` | La `dialog` disparaît et le contrôle « Plus » porte le focus | browser |
| Teardown     | Aucun état serveur touché : les cas ne créent ni ticket, ni carte, ni annonce | Base du banc inchangée | system |

## Tasks to do

### `1)` Les sélecteurs partagés

> Nommer la barre, le contrôle et la feuille une seule fois, en haut du fichier.

1. Ajouter à côté de `CABINET_NAV` une constante `MORE_CONTROL = 'Plus'` et `MORE_SHEET = 'Autres salles'`.
2. Ajouter une fonction `openMoreSheet(page)` qui appuie sur `page.getByRole('button', { name: MORE_CONTROL })` et attend `page.getByRole('dialog', { name: MORE_SHEET })`.

### `2)` La salle atteinte en deux appuis

> Prouver le seul critère d'acceptation du roadmap.

1. Écrire `test('mobile — les salles secondaires sont atteintes en deux appuis')`.
2. Boucler sur `[['Les Planches', '/tableaux'], ['Mes Offres', '/market/mine']]` : `page.goto('/')`, un appui sur le contrôle, un appui sur le lien dans la feuille, puis `await expect(page).toHaveURL(new RegExp(`${path}$`))` et `await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()`.
3. Dans le même cas, depuis `/`, ouvrir la feuille et vérifier que les trois `SECONDARY_NAV` sont listés — « Les Archives » inclus — sans les suivre.

### `3)` La cible de 44 px

> Le cas existant n'itère que les liens : le contrôle ajouté lui échappe.

1. Écrire `test('mobile — la cible « Plus » fait au moins 44 px')`.
2. Mesurer `boundingBox()` du bouton et exiger `height >= 44`, comme le cas des liens.

### `4)` Le garde de préfixe

> `/tableau` et `/tableaux` partagent un préfixe ; l'entrée secondaire ne doit pas s'allumer sur la première.

1. Écrire `test('mobile — « Les Planches » ne s’allume pas sur La Planche')`.
2. Sur `/tableau`, ouvrir la feuille et exiger que `dialog.getByRole('link', { name: 'Les Planches' })` n'ait pas l'attribut `aria-current`.
3. Sur `/tableaux` (navigué par URL, la route existe déjà), ouvrir la feuille et exiger `toHaveAttribute('aria-current', 'page')`.

### `5)` La sortie de la feuille

> Échap ferme, et le focus revient au déclencheur.

1. Écrire `test('mobile — la feuille se ferme par Échap et rend le focus')`.
2. Ouvrir la feuille, `page.keyboard.press('Escape')`, attendre la disparition de la `dialog`, puis `await expect(page.getByRole('button', { name: MORE_CONTROL })).toBeFocused()`.

### `6)` Le visiteur anonyme

> La barre basse est rendue sans condition alors que le rail cache toute sa navigation sans session.

1. Écrire `test('mobile — sans session, aucune salle secondaire n’est offerte')`.
2. Poser `test.use({ storageState: { cookies: [], origins: [] } })` dans un `describe` dédié.
3. `page.goto('/')` puis `await expect(page.getByRole('button', { name: MORE_CONTROL, exact: true })).toHaveCount(0)`.

Ce cas est **vert dès aujourd'hui**, et c'est arithmétiquement inévitable : `toHaveCount(0)` sur un bouton qui n'existe nulle part tient forcément. Ce n'est donc pas une observation rouge mais un **garde** : il ne devient significatif qu'en phase 2, où il doit rester à zéro alors que le contrôle existe pour un joueur connecté. Le compter comme une preuve du défaut serait malhonnête.

`exact: true` est obligatoire sur ce localisateur : sans lui, `getByRole` apparie les noms par sous-chaîne et le bouton « Plus tard » de `pwa-update-prompt.tsx` devient un second candidat.

### `7)` Observer le rouge

> Le filet ne vaut que si l'échec dit la bonne cause.

1. Lancer `docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/mobile.spec.ts --project="Pixel 7"`.
2. Vérifier que les cas 2 à 5 échouent sur l'absence du contrôle « Plus » (ou de la `dialog` qui en dépend), que le cas 6 passe, et que les cas 1 à 10 du fichier existant restent verts ou ignorés comme avant.
3. Consigner la sortie rouge dans `.docs/03-active-task.md` au moment de la phase 3.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | Les cas compilent et n'emploient que les libellés français de l'interface ; les aides et constantes existantes sont intactes. |
| 2 | Le cas échoue aujourd'hui parce qu'aucun bouton « Plus » n'existe, et il nomme `/tableaux` et `/market/mine`. |
| 3 | Le cas mesure une boîte et échoue sur l'absence du bouton, pas sur une mesure fausse. |
| 4 | Le cas distingue explicitement `/tableau` de `/tableaux`. |
| 5 | Le cas exige le retour de focus, pas seulement la fermeture. |
| 6 | Le cas passe aujourd'hui pour la raison documentée ci-dessus, et n'emprunte pas la session du `global-setup`. |
| 7 | La sortie rouge est citée ligne par ligne dans le journal de la phase 3 : quatre cas en échec pour la cause attendue, aucun cas existant régressé. |
