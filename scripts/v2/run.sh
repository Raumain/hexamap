#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)

# Une seule vague par invocation : une chaîne de huit branches lancée d'un bloc
# produirait une PR finale illisible et un coût de contexte non maîtrisé.
if [[ " $* " != *" --wave "* && " $* " != *" --phase "* ]]; then
  printf 'Usage : scripts/v2/run.sh --wave N [options]\n' >&2
  printf 'Vagues :\n' >&2
  cut -f1,2,3 "$SCRIPT_DIR/plan.tsv" | grep -v '^#' | sed 's/^/  /' >&2
  exit 2
fi

export BASE=${BASE:-v2}
export PLAN=${PLAN:-"$SCRIPT_DIR/plan.tsv"}
export WAVE_PREFIX=${WAVE_PREFIX:-feat/v2-wave}
export WT_ROOT=${WT_ROOT:-"$ROOT/../hexamap-v2-agents"}
export LOGDIR=${LOGDIR:-"$ROOT/../hexamap-v2-agents-logs"}
export SESSION_TIMEOUT=${SESSION_TIMEOUT:-3600}

exec "$ROOT/scripts/agents/run.sh" --gate --pr --e2e "$@"
