#!/usr/bin/env bash
# Hexamap — lance la pile complète (PostgreSQL + API + web) et suit les logs.
# Ctrl+C arrête proprement tous les services. Le volume de données PostgreSQL est conservé.
#
#   ./dev.sh              # (re)construit puis démarre
#   ./dev.sh --no-build   # démarre sans reconstruire les images
#   ./dev.sh --fresh      # repart d'une base vide (supprime pgdata), migre puis démarre
set -euo pipefail

cd "$(dirname "$0")"

API_URL="http://localhost:3000"
WEB_URL="http://localhost:5174"

BUILD="--build"
FRESH=0
case "${1:-}" in
  --no-build) BUILD="" ;;
  --fresh) FRESH=1 ;;
  "") ;;
  *) echo "Usage : $0 [--no-build|--fresh]" >&2; exit 1 ;;
esac

STOPPED=0
cleanup() {
  [ "$STOPPED" -eq 1 ] && return
  STOPPED=1
  printf '\n'
  echo "[hexamap] Arrêt des services…"
  docker compose down --remove-orphans
  echo "[hexamap] Services arrêtés (données PostgreSQL conservées)."
}
trap cleanup EXIT INT TERM

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[hexamap] .env créé depuis .env.example"
fi
mkdir -p node_modules

if [ "$FRESH" -eq 1 ]; then
  echo "[hexamap] Suppression de la base existante…"
  docker compose down --volumes --remove-orphans
  docker compose up -d db
  docker compose --profile tools run --rm dev bun run db:migrate
fi

echo "[hexamap] Démarrage de la pile…"
docker compose up -d $BUILD --remove-orphans

printf "[hexamap] Attente de l'API"
for _ in $(seq 1 60); do
  curl -fsS "$API_URL/api/v1/health" >/dev/null 2>&1 && break
  printf '.'
  sleep 1
done
printf '\n'

# Première IPv4 LAN (192.168.*) détectée, pour l'accès depuis une autre machine.
LAN_IP="$(hostname -I 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i ~ /^192\.168\./) {print $i; exit}}')"
[ -z "$LAN_IP" ] && LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) {print $i; exit}}')"

echo "[hexamap] Web  : $WEB_URL"
echo "[hexamap] API  : $API_URL  (OpenAPI : $API_URL/api/docs)"
if [ -n "$LAN_IP" ]; then
  echo "[hexamap] LAN  : http://$LAN_IP:5174  (web + API relayés par Vite)"
fi
echo "[hexamap] Ctrl+C pour tout arrêter."
echo

docker compose logs -f --tail=20
