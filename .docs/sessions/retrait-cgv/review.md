# Revue hostile — phase 46 (retrait de la page CGV)

Relecture du diff complet (`HEAD~3..HEAD`, 7 fichiers, +79 / −157) faite comme si un autre
auteur l'avait écrite. Verdict : **prêt à livrer**, aucun défaut *deal-breaker*.

## Ce que je vérifie, et ce que je trouve

| # | Contrôle | Résultat |
| :-- | :--- | :--- |
| 1 | `apps/web/src/routes/cgv.tsx` supprimé, pas neutralisé | ✅ `ls` : absent. Aucune route ne rend `null`. |
| 2 | `/cgv` ne répond plus une page CGV | ✅ cas E2E « conditions générales — la page n’est plus publiée » : `<h1>` « Cette salle n’existe pas » visible, `<h1>` « Conditions générales de vente » à 0. |
| 3 | L'entrée CGV est retirée de `LEGAL_LINKS`, pas le tableau entier | ✅ `legal.ts:41-44` : deux entrées, `mentions-legales` et `confidentialite`. |
| 4 | Le contenu CGV est retiré du fichier | ✅ plus aucune occurrence de `CGV_LEGAL`, ni du titre, ni des douze sections. `CGV` ne survit que dans un commentaire explicatif. |
| 5 | Aucune constante orpheline | ✅ `PUBLISHER`, `CONSUMER_MEDIATOR`, `LAST_UPDATED`, `EDITOR` restent tous consommés par les deux documents restants (vérifié par `grep`). |
| 6 | `LEGAL_PAGES_ENABLED` non basculé | ✅ `legal.ts:17` vaut toujours `true`. |
| 7 | Les deux pieds rendent deux liens | ✅ cas E2E « pieds de page — deux liens légaux, et plus de CGV » : sur `/home` **et** `/mentions-legales`, la navigation « Informations légales » porte **2** liens, aux `href` `/mentions-legales` et `/confidentialite`, et **aucun** lien « CGV ». |
| 8 | `home.tsx` et `app-shell.tsx` inchangés | ✅ `git diff` : absents. Les deux itèrent `LEGAL_LINKS` ; aucun ne code `/cgv` en dur. |
| 9 | Titre de salle retiré, les deux autres conservés | ✅ `nav-items.ts` : `'/cgv'` absent, `'/mentions-legales'` et `'/confidentialite'` présents. |
| 10 | `mentions-legales` et `confidentialite` publiées | ✅ cas E2E « pages légales restantes » : les deux `<h1>` visibles. |
| 11 | `routeTree.gen.ts` régénéré, pas édité | ✅ `git diff` : 21 lignes supprimées, toutes des occurrences de `cgv` (import, route, interfaces, union de chemins, children, module `declare`). Aucune autre ligne touchée. Régénéré par `tsr generate` via `bun run --cwd apps/web typecheck`. |
| 12 | Aucun pointeur vers `/cgv` sous `SHOP_REQUIRE_TOS_CONSENT` | ✅ les seules occurrences de `/cgv` restantes dans le code sont dans le cas E2E qui constate l'absence. Le drapeau ne fait que poser `consent_collection.terms_of_service = 'required'` ; l'URL est un réglage du Dashboard Stripe, pas une route du jeu. |
| 13 | Aucune migration, aucune table, aucune route d'API | ✅ diff limité à `apps/web`, `packages/e2e/tests/not-found.spec.ts` et deux `.docs`. Aucun fichier de `packages/db`, aucun `apps/api/src/routes`. |
| 14 | Aucun `skip`, `.fixme`, délai relâché | ✅ aucun ajout ; le cas E2E remplacé est **inversé**, pas affaibli (il asserte en plus le comptage des liens, absent avant). |
| 15 | Aucun cas de `packages/spec` réécrit | ✅ `packages/spec` n'est pas touché. |

## Défauts trouvés, et pourquoi ils ne sont pas corrigés ici

1. **`apps/web/src/content/legal.ts:111` — renvoi textuel mort.** Les mentions légales disent
   encore : « Les conditions de vente et la procédure de réclamation figurent dans les conditions
   générales de vente. » La page qu'elles citent n'existe plus.
   **Gravité : suggestion.** Ce n'est pas un lien (aucun `href`), et le brief interdit explicitement
   de toucher aux mentions légales ; une phrase de prose juridique ne se réécrit pas en silence.
   **Signalé dans la PR** pour arbitrage par le titulaire.

2. **`.docs/05-deploiement.md` §7 — constat juridique périmé au-delà de la CGV.** L'item parle
   encore de repères `[À COMPLÉTER — …]` et d'un bandeau « Texte provisoire » que
   `legal-document.tsx` ne rend plus depuis la rédaction des documents.
   **Gravité : suggestion.** Antérieur à cette phase et sans rapport avec le retour R-004 ; le
   corriger élargirait le diff au-delà de ce que le contrat autorise.

3. **`.docs/06-cadre-juridique.md` §14 — « les packs d'écus restent disponibles à l'achat »** alors
   que la boutique est fermée. **Gravité : suggestion**, même raison : décision de boutique, pas
   le retour R-004.

4. **Le cas E2E de `/cgv` n'asserte pas `<main>`.** Une URL inconnue rend bien la coquille complète
   (cas 1 le prouve déjà pour `/salle-inconnue`) ; l'asserter une seconde fois aurait dupliqué une
   assertion existante sans rien couvrir de neuf. **Gravité : sans objet.**

## Ce que la revue ne prouve pas

- Aucune vérification visuelle humaine : les deux pieds sont constatés **par Playwright** (rôle
  `navigation`, nom accessible, nombre de liens, `href`), pas par une capture relue à l'œil.
- Le cas E2E `market — un double-appui n'achète qu'une fois`, notoirement instable, est passé sur
  ce passage ; son instabilité n'est pas expliquée par cette phase.

## Verdict

**Prêt à livrer.** Les huit critères d'acceptation sont tenus ; le critère 5 est tenu et sa preuve
est citée dans la PR ; aucun critère n'est coché à tort.
