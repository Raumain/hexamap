#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
fi

mkdir -p node_modules

echo "[hexamap] Installation des dépendances dans le conteneur..."
docker compose --profile tools run --rm dev bun install

echo "[hexamap] Démarrage de PostgreSQL..."
docker compose up -d db

echo "[hexamap] Application des migrations..."
docker compose --profile tools run --rm dev bun run db:migrate

echo "[hexamap] Construction et démarrage de l'API et du web..."
docker compose up -d --build

echo "[hexamap] Prêt : web http://localhost:5174 — API http://localhost:3000"
