# AGENTS.md — Import Open Data

Pipeline d'import exécuté **une fois** (ou de façon rejouable), jamais au runtime d'une requête joueur.

## Règles

- Aucun appel aux API gouvernementales depuis l'API ou le front.
- Import en streaming pour la BAN/FANTOIR. Ne pas charger des fichiers de plusieurs Go en mémoire.
- Import rejouable et reprenable : traiter par lots, journaliser la progression, éviter les doublons.
- Normalisation des odonymes : majuscules, suppression des accents, tirets/apostrophes remplacés par des espaces, espaces compactés.
- Conserver le nom d'affichage original pour la carte.
- Calculer `rarete`, `score_base`, `nb_communes` et `draw_bucket` à l'import.
- Utiliser `COPY` ou des insertions par lots pour les gros volumes.
- Prévoir un mode `--lite` pour le développement.
- Documenter l'attribution des sources (Etalab, IGN, Wikidata).
- Ne jamais écrire de données de jeu (`user_cards`, `tickets`, etc.) depuis ce pipeline.

## Vérifications

```sh
docker compose --profile tools run --rm dev bun run --cwd scripts/import typecheck
```
