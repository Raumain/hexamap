#!/usr/bin/env bash
# Lance une session OpenCode par phase du plan, chacune sur sa branche et son worktree.
#
# Le graphe des phases vit dans scripts/agents/phases.tsv, le préambule commun dans
# scripts/agents/prompts/_commun.md, et le brief de chaque phase dans prompts/<n>.md.
#
# Ce script NE fusionne rien dans `main`. Il produit des branches, il ouvre des PR en
# brouillon, et il vérifie que la vague fusionnée passe `ci:check`. La revue reste humaine.

set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
PROMPTS="$SCRIPT_DIR/prompts"
PLAN="$SCRIPT_DIR/phases.tsv"

BASE=${BASE:-main}
WT_ROOT=${WT_ROOT:-$ROOT/../hexamap-agents}
LOGDIR=${LOGDIR:-$ROOT/../hexamap-agents-logs}
MAX_PARALLEL=${MAX_PARALLEL:-2}
SESSION_TIMEOUT=${SESSION_TIMEOUT:-10800}
PG_USER=${POSTGRES_USER:-hexamap}
PG_PASS=${POSTGRES_PASSWORD:-hexamap}

DRY_RUN=0
KEEP=0
ALLOW_DIRTY=0
AUTO=1
ONLY_WAVE=""
ONLY_PHASE=""

log()  { printf '[hexamap] %s\n' "$*"; }
warn() { printf '[hexamap] ⚠ %s\n' "$*" >&2; }
die()  { printf '[hexamap] ✗ %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'TXT'
Usage : scripts/agents/run.sh [options]

  --wave N        Ne joue que la vague N
  --phase N       Ne joue qu'une phase (implique sa vague)
  --parallel N    Sessions simultanées dans une vague (défaut 2)
  --dry-run       Affiche les commandes sans rien lancer
  --keep          Conserve les worktrees après exécution
  --allow-dirty   Autorise un arbre de travail non propre
  --no-auto       N'ajoute pas `opencode run --auto` (approbations manuelles)
  -h, --help      Ce texte

Variables : BASE, WT_ROOT, LOGDIR, MAX_PARALLEL, SESSION_TIMEOUT.
TXT
}

while [ $# -gt 0 ]; do
  case "$1" in
    --wave)        ONLY_WAVE=${2:?}; shift 2 ;;
    --phase)       ONLY_PHASE=${2:?}; shift 2 ;;
    --parallel)    MAX_PARALLEL=${2:?}; shift 2 ;;
    --dry-run)     DRY_RUN=1; shift ;;
    --keep)        KEEP=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --no-auto)     AUTO=0; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             die "option inconnue : $1" ;;
  esac
done

dc() { docker compose "$@" </dev/null; }

# ---------------------------------------------------------------- préalables

preflight() {
  local missing=0 bin
  for bin in opencode git docker jq timeout; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      warn "binaire absent : $bin"
      missing=1
    fi
  done
  [ "$missing" -eq 0 ] || die "installe les binaires manquants avant de relancer."

  [ -f "$ROOT/.env" ] || die ".env absent à la racine : copie .env.example puis renseigne-le."
  [ -f "$PLAN" ]     || die "plan introuvable : $PLAN"

  git -C "$ROOT" show-ref --verify --quiet "refs/heads/$BASE" \
    || die "la branche de base '$BASE' n'existe pas."

  if [ "$ALLOW_DIRTY" -eq 0 ] && [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
    git -C "$ROOT" status --short >&2
    die "arbre de travail non propre : commit ou stash avant de lancer (ou --allow-dirty)."
  fi

  dc exec -T db pg_isready -U "$PG_USER" -q >/dev/null 2>&1 \
    || die "PostgreSQL ne répond pas : docker compose up -d db."

  if [ "$AUTO" -eq 1 ]; then
    warn "--auto est actif : les permissions non explicitement refusées sont approuvées."
    warn "Une session ne peut donc pas être arrêtée à mi-parcours par un refus manuel."
  fi
}

# ---------------------------------------------------------------- bases de test

ensure_db() {
  local name=$1
  if dc exec -T db psql -U "$PG_USER" -d postgres -tAc \
      "select 1 from pg_database where datname = '$name'" | grep -qx 1; then
    log "base de test existante : $name"
    return 0
  fi
  log "création de la base de test : $name"
  if [ "$DRY_RUN" -eq 0 ]; then
    dc exec -T db createdb -U "$PG_USER" "$name"
  fi
}

db_url() { printf 'postgres://%s:%s@db:5432/%s' "$PG_USER" "$PG_PASS" "$1"; }

# ---------------------------------------------------------------- worktrees

worktree_path() { printf '%s/phase-%s' "$WT_ROOT" "$1"; }

seed_worktree() {
  local wt=$1
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] amorçage de $wt (.env, node_modules, bun install)"
    return 0
  fi
  # `.env` et `node_modules` sont gitignored : sans eux, Docker crée des dossiers vides
  # appartenant à root dans le worktree, et la session échoue en permission.
  cp "$ROOT/.env" "$wt/.env"
  mkdir -p "$wt/node_modules"

  log "installation des dépendances dans $wt"
  ( cd "$wt" && dc --profile tools run --rm dev bun install ) >>"$LOGDIR/install.log" 2>&1 \
    || die "bun install a échoué dans $wt (voir $LOGDIR/install.log)."
}

prepare_worktree() {
  local phase=$1 branch=$2 wt
  wt=$(worktree_path "$phase")

  if git -C "$ROOT" worktree list --porcelain | grep -qx "worktree $wt"; then
    log "worktree réutilisé : $wt"
  elif git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    log "worktree sur la branche existante $branch"
    if [ "$DRY_RUN" -eq 0 ]; then
      git -C "$ROOT" worktree add -q "$wt" "$branch"
    fi
  else
    log "worktree + branche $branch depuis $BASE"
    if [ "$DRY_RUN" -eq 0 ]; then
      git -C "$ROOT" worktree add -q -b "$branch" "$wt" "$BASE"
    fi
  fi

  seed_worktree "$wt"
}

# ---------------------------------------------------------------- prompt

substitute() {
  local file=$1 slug=$2 branch=$3 migration=$4 test_db=$5
  sed -e "s|{{SLUG}}|$slug|g" \
      -e "s|{{BRANCH}}|$branch|g" \
      -e "s|{{MIGRATION}}|$migration|g" \
      -e "s|{{TEST_DB_URL}}|$(db_url "$test_db")|g" \
      "$file"
}

build_prompt() {
  local phase=$1 slug=$2 branch=$3 migration=$4 test_db=$5 out=$6

  {
    substitute "$PROMPTS/_commun.md" "$slug" "$branch" "$migration" "$test_db"
    printf '\n---\n\n'
    substitute "$PROMPTS/$phase.md" "$slug" "$branch" "$migration" "$test_db"
    cat <<PARAMS

---

## Paramètres de ta session

- Phase : $phase ($slug)
- Branche à pousser : \`$branch\`
- Migration réservée : \`$migration\` — tu n'en prends aucune autre.
- Base de test : \`$(db_url "$test_db")\`
- Worktree : \`$(worktree_path "$phase")\` — tu y es déjà, ne sors pas.
- Journal, plan, revue : \`.docs/sessions/$slug/\`

Rappel : \`main\` est en lecture seule, et \`.docs/03-active-task.md\` n'est pas à toi.
PARAMS
  } >"$out"
}

# ---------------------------------------------------------------- session

launch() {
  local phase=$1 slug=$2 branch=$3 migration=$4 test_db=$5
  local wt prompt logfile
  wt=$(worktree_path "$phase")
  prompt="$LOGDIR/prompt-$phase-$slug.md"
  logfile="$LOGDIR/session-$phase-$slug.log"

  build_prompt "$phase" "$slug" "$branch" "$migration" "$test_db" "$prompt"

  local -a args=(run --archived --title "Hexamap · phase $phase · $slug")
  if [ "$AUTO" -eq 1 ]; then
    args+=(--auto)
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] (cd $wt && opencode ${args[*]} \"\$(cat $prompt)\") > $logfile"
    return 0
  fi

  log "session $phase ($slug) → $logfile"
  ( cd "$wt" && timeout "$SESSION_TIMEOUT" opencode "${args[@]}" "$(cat "$prompt")" ) \
    >"$logfile" 2>&1
}

# ---------------------------------------------------------------- vérification de vague

verify_wave() {
  local wave=$1
  shift
  local -a branches=("$@")
  local wt="$WT_ROOT/integration"
  local test_db="hexamap_test_wave$wave"

  ensure_db "$test_db"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] intégration de ${branches[*]} sur $BASE, puis ci:check"
    return 0
  fi

  git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  rm -rf "$wt"
  git -C "$ROOT" worktree add -q -B agents/integration "$wt" "$BASE"
  seed_worktree "$wt"

  local b conflicted
  for b in "${branches[@]}"; do
    if ! git -C "$wt" merge --no-ff --no-edit -m "agents: intégration $b" "$b" >/dev/null 2>&1; then
      conflicted=$(git -C "$wt" diff --name-only --diff-filter=U)
      # `routeTree.gen.ts` est généré : on ne le fusionne jamais à la main, on le régénère.
      if [ "$conflicted" = "apps/web/src/routeTree.gen.ts" ]; then
        warn "conflit généré sur routeTree.gen.ts : résolu par régénération"
        git -C "$wt" checkout --ours -- apps/web/src/routeTree.gen.ts
        git -C "$wt" add apps/web/src/routeTree.gen.ts
        git -C "$wt" commit -q --no-edit
      else
        warn "conflit réel en intégrant $b :"
        printf '%s\n' "$conflicted" >&2
        warn "rien n'est résolu automatiquement. Corrige à la main dans $wt, puis relance."
        return 1
      fi
    fi
  done

  log "ci:check sur la vague $wave (${branches[*]})"
  ( cd "$wt" && dc --profile tools run --rm -e "TEST_DATABASE_URL=$(db_url "$test_db")" \
      dev bun run ci:check )
}

# ---------------------------------------------------------------- rapport

report() {
  local -a rows=("$@")
  local row label status
  printf '\n'
  log "Bilan"
  for row in "${rows[@]}"; do
    label=${row%%|*}
    status=${row#*|}
    printf '  %-18s %s\n' "$label" "$status"
  done
  printf '\n'
  log "Branches :"
  git -C "$ROOT" branch --list 'feat/phase-*' --format='  %(refname:short)'
  printf '\n'
  log "Journaux : $LOGDIR"
  log "Worktrees : $WT_ROOT (supprimés sauf --keep)"
  printf '\n'
  log "Étape suivante, à la main :"
  printf "  1. relire les PR en brouillon (gh pr list --author @me)\n"
  printf "  2. consolider .docs/sessions/*/journal.md dans .docs/03-active-task.md\n"
  printf "  3. fusionner les PR dans l'ordre des vagues\n"
}

cleanup() {
  if [ "$KEEP" -eq 1 ]; then
    log "worktrees conservés dans $WT_ROOT"
    return 0
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    return 0
  fi
  local wt
  for wt in "$WT_ROOT"/phase-* "$WT_ROOT/integration"; do
    [ -d "$wt" ] || continue
    git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  done
  git -C "$ROOT" branch -D agents/integration >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------- boucle

main() {
  preflight
  mkdir -p "$LOGDIR"

  local -a results=()
  local -A seen=()
  local -a rows=()
  local wave phase slug branch migration status

  # Le plan est lu en une fois : une commande qui hériterait du stdin de la boucle
  # (`docker compose exec`, un `psql` interactif) ne peut pas en avaler la suite.
  while IFS= read -r line || [ -n "$line" ]; do
    rows+=("$line")
  done <"$PLAN"

  local idx jdx
  for idx in "${!rows[@]}"; do
    IFS=$'\t' read -r wave phase slug branch migration status <<<"${rows[$idx]}"
    case "$wave" in ''|'#'*) continue ;; esac
    if [ -n "$ONLY_WAVE" ] && [ "$wave" != "$ONLY_WAVE" ]; then continue; fi
    if [ -n "$ONLY_PHASE" ] && [ "$phase" != "$ONLY_PHASE" ]; then continue; fi

    if [ "$status" = "blocked" ]; then
      warn "phase $phase ($slug) bloquée hors du code : ignorée"
      results+=("phase $phase|bloquée")
      continue
    fi

    if [ -n "${seen[$phase]:-}" ]; then
      continue
    fi

    local -a batch=() batch_slugs=() batch_branches=() batch_migrations=()
    batch+=("$phase"); batch_slugs+=("$slug")
    batch_branches+=("$branch"); batch_migrations+=("$migration")
    seen[$phase]=1

    local w2 p2 s2 b2 m2 st2
    for jdx in "${!rows[@]}"; do
      IFS=$'\t' read -r w2 p2 s2 b2 m2 st2 <<<"${rows[$jdx]}"
      case "$w2" in ''|'#'*) continue ;; esac
      if [ "$w2" != "$wave" ]; then continue; fi
      if [ -n "${seen[$p2]:-}" ]; then continue; fi
      if [ "$st2" = "blocked" ]; then continue; fi
      if [ "${#batch[@]}" -ge "$MAX_PARALLEL" ]; then break; fi
      batch+=("$p2"); batch_slugs+=("$s2")
      batch_branches+=("$b2"); batch_migrations+=("$m2")
      seen[$p2]=1
    done

    log "vague $wave : ${batch[*]} (parallèle max $MAX_PARALLEL)"

    local -a pids=()
    local i p s b m
    for i in "${!batch[@]}"; do
      p=${batch[$i]}; s=${batch_slugs[$i]}
      b=${batch_branches[$i]}; m=${batch_migrations[$i]}
      ensure_db "hexamap_test_$p"
      prepare_worktree "$p" "$b"
      if [ "$DRY_RUN" -eq 0 ]; then
        launch "$p" "$s" "$b" "$m" "hexamap_test_$p" &
        pids+=("$!")
      else
        launch "$p" "$s" "$b" "$m" "hexamap_test_$p"
        pids+=("0")
      fi
    done

    local rc=0
    for i in "${!pids[@]}"; do
      if [ "${pids[$i]}" -eq 0 ]; then
        results+=("phase ${batch[$i]}|dry-run")
        continue
      fi
      if wait "${pids[$i]}"; then
        results+=("phase ${batch[$i]}|session ok")
      else
        results+=("phase ${batch[$i]}|session en échec")
        rc=1
      fi
    done

    if [ "$DRY_RUN" -eq 0 ] && [ "$rc" -eq 0 ]; then
      if verify_wave "$wave" "${batch_branches[@]}"; then
        results+=("vague $wave|vérifiée")
      else
        results+=("vague $wave|NON vérifiée")
      fi
    fi
  done

  report "${results[@]}"
  cleanup
}

trap 'die "interrompu"' INT TERM
main "$@"
