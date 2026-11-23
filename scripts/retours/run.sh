#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)

# Une session par retour produit, une vague par retour, empilées dans l'ordre de
# `.docs/10-retours-v2.md` : la vague 1 porte trois retours d'interface disjoints,
# les suivantes en portent un chacune. `--parallel 1` est la façon de les jouer
# « les unes à la suite des autres ».
export BASE=${BASE:-v2}
export PLAN=${PLAN:-"$SCRIPT_DIR/plan.tsv"}
export PROMPTS=${PROMPTS:-"$SCRIPT_DIR/prompts"}
export WAVE_PREFIX=${WAVE_PREFIX:-feat/v2-retours-wave}
export WT_ROOT=${WT_ROOT:-"$ROOT/../hexamap-retours-agents"}
export LOGDIR=${LOGDIR:-"$ROOT/../hexamap-retours-agents-logs"}
export SESSION_TIMEOUT=${SESSION_TIMEOUT:-5400}

exec "$ROOT/scripts/agents/run.sh" --gate --pr --e2e "$@"
