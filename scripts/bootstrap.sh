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

echo "[hexamap] Démarrage de la base, de l'API et du web..."
docker compose up -d --build db api web

echo "[hexamap] Réinitialisation du statut d'import..."
docker compose --profile tools run --rm dev rm -f /data/import-status/status.json

echo "[hexamap] Suivi en direct : http://localhost:5174/import-status"

echo "[hexamap] Import du référentiel géographique complet (régions, départements, communes, voies)."
echo "[hexamap] Les tables de référence sont vidées puis rechargées : l'étape est rejouable."
echo "[hexamap] Étape BAN incluse : plusieurs heures possibles (téléchargements Open Data + BAN)."
if [ "${SKIP_BAN:-0}" = "1" ]; then
  echo "[hexamap] BAN ignorée (SKIP_BAN=1) : régions, départements et communes uniquement."
  docker compose --profile tools run --rm dev bun run scripts/import/index.ts --skip-ban || {
    echo "[hexamap] Import initial ignoré (sources Open Data injoignables ?)."
    echo "[hexamap] Relance manuelle : docker compose --profile tools run --rm dev bun run scripts/import/index.ts --skip-ban"
  }
else
  docker compose --profile tools run --rm dev bun run scripts/import/index.ts || {
    echo "[hexamap] Import initial ignoré (sources Open Data injoignables ?)."
    echo "[hexamap] Relance manuelle : docker compose --profile tools run --rm dev bun run scripts/import/index.ts"
  }
fi

if [ "${SKIP_BLASONS:-0}" = "1" ]; then
  echo "[hexamap] Import des blasons ignoré (SKIP_BLASONS=1)."
else
  echo "[hexamap] Import des blasons (Wikidata / Commons) — plusieurs heures possibles..."
  docker compose --profile tools run --rm dev bun run --cwd scripts/import blasons || {
    echo "[hexamap] Import des blasons ignoré (réseau injoignable ?)."
    echo "[hexamap] Relance manuelle : docker compose --profile tools run --rm dev bun run --cwd scripts/import blasons"
  }

  echo "[hexamap] Import des contours IGN des communes sans blason..."
  docker compose --profile tools run --rm dev bun run --cwd scripts/import blasons --contours-only || {
    echo "[hexamap] Import des contours ignoré (réseau injoignable ?)."
    echo "[hexamap] Relance manuelle : docker compose --profile tools run --rm dev bun run --cwd scripts/import blasons --contours-only"
  }
fi

echo "[hexamap] Conteneurs à jour (migrations déjà appliquées) : pas de second build."
docker compose up -d api web

echo "[hexamap] Prêt : web http://localhost:5174 — API http://localhost:3000"
echo "[hexamap] Suivi de l'import : http://localhost:5174/import-status"
