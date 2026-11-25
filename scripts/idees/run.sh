#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)

# Une session par idée de `.docs/09-idees.md`, une vague par lot d'idées disjointes,
# empilées dans l'ordre des dépendances (voir `scripts/idees/README.md`).
# `--parallel 2` joue les deux phases de la vague 1 et de la vague 3 en parallèle ;
# les vagues 2 et 4 n'en portent qu'une.
export BASE=${BASE:-v2}
export PLAN=${PLAN:-"$SCRIPT_DIR/plan.tsv"}
export PROMPTS=${PROMPTS:-"$SCRIPT_DIR/prompts"}
export WAVE_PREFIX=${WAVE_PREFIX:-feat/v2-idees-wave}
export WT_ROOT=${WT_ROOT:-"$ROOT/../hexamap-idees-agents"}
export LOGDIR=${LOGDIR:-"$ROOT/../hexamap-idees-agents-logs"}
export SESSION_TIMEOUT=${SESSION_TIMEOUT:-7200}

# `gh` n'est exigé que si l'on demande des PR : sans lui, on joue les phases et on
# laisse les branches sur l'origine sans brouillon, plutôt que d'échouer à la porte.
args=(--gate --e2e)
if command -v gh >/dev/null 2>&1; then
  args+=(--pr)
fi

exec "$ROOT/scripts/agents/run.sh" "${args[@]}" "$@"
