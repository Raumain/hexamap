#!/bin/sh
set -eu

if [ ! -d /app/node_modules/.bin ]; then
  echo "[hexamap] Installation des dépendances dans le conteneur..."
  bun install
fi

exec "$@"
