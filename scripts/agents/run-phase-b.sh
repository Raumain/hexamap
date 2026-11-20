#!/usr/bin/env bash
# Lance le plan Phase B (La Boutique) avec le runner existant.
#
#   ./scripts/agents/run-phase-b.sh --dry-run --allow-dirty   # vérifier le graphe
#   ./scripts/agents/run-phase-b.sh --allow-dirty             # exécuter
#
# Le préfixe de vague isole cette chaîne de l'ancien plan : agents/boutique-wave-1..4,
# jamais agents/wave-*. La dernière branche d'accumulation se remonte vers main à la main.

set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

export PLAN="$SCRIPT_DIR/phases-b.tsv"
export WAVE_PREFIX="agents/boutique-wave"

exec "$SCRIPT_DIR/run.sh" "$@"
