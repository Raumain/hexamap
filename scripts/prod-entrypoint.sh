#!/bin/sh
# Point d'entrée de l'image API de production.
# Applique les migrations puis lance le serveur. `RUN_MIGRATIONS=0` permet de
# démarrer sans toucher au schéma (déploiement où les migrations sont jouées
# par un job séparé).
set -eu

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[hexamap] Application des migrations…"
  bun /app/db-migrate.js
fi

exec "$@"
