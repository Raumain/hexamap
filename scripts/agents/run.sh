#!/usr/bin/env bash
# Lance une session OpenCode par phase du plan, chacune sur sa branche et son worktree.
#
# Le graphe des phases vit dans scripts/agents/phases.tsv, le préambule commun dans
# scripts/agents/prompts/_commun.md, et le brief de chaque phase dans prompts/<n>.md.
#
# Les branches sont EMPILÉES : une vague part de la branche d'accumulation de la vague
# précédente, jamais de `main`. Une phase dont le brief dit « la phase X est fusionnée »
# la voit donc réellement dans son arbre.
#
#   main ──┬─ feat/phase-26 ─┐
#          └─ feat/phase-28 ─┴─ agents/wave-1 ── feat/phase-27 ── agents/wave-2 ── …
#
# Chaque PR de phase cible la branche de sa vague parente. La dernière branche
# d'accumulation est celle qui remonte vers `main`. Ce script ne fusionne rien dans `main`.

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
PUSH=1
ONLY_WAVE=""
ONLY_PHASE=""

log()  { printf '[hexamap] %s\n' "$*"; }
warn() { printf '[hexamap] ⚠ %s\n' "$*" >&2; }
die()  { printf '[hexamap] ✗ %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'TXT'
Usage : scripts/agents/run.sh [options]

  --wave N        Ne joue que la vague N et les suivantes
  --phase N       Ne joue qu'une phase (implique sa vague)
  --parallel N    Sessions simultanées dans une vague (défaut 2)
  --dry-run       Affiche les commandes sans rien lancer
  --keep          Conserve les worktrees après exécution
  --allow-dirty   Autorise un arbre de travail non propre
  --no-auto       N'ajoute pas `opencode run --auto` (approbations manuelles)
  --no-push       Ne pousse pas les branches d'accumulation
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
    --no-push)     PUSH=0; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             die "option inconnue : $1" ;;
  esac
done

dc() { docker compose "$@" </dev/null; }
wave_branch()   { printf 'agents/wave-%s' "$1"; }
# La vague 1 part de BASE ; les suivantes partent de l'accumulation précédente.
parent_branch() { if [ "$1" -eq 1 ]; then printf '%s' "$BASE"; else wave_branch "$(( $1 - 1 ))"; fi; }

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
  local phase=$1 branch=$2 base=$3 wt
  wt=$(worktree_path "$phase")

  if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    log "branche $branch déjà présente : reprise"
    if [ "$DRY_RUN" -eq 0 ]; then
      git -C "$ROOT" worktree add -q "$wt" "$branch" 2>/dev/null \
        || git -C "$ROOT" worktree add -q -B "$branch" "$wt" "$base"
    fi
  else
    log "worktree + branche $branch depuis $base"
    if [ "$DRY_RUN" -eq 0 ]; then
      git -C "$ROOT" worktree add -q -b "$branch" "$wt" "$base"
    fi
  fi

  seed_worktree "$wt"
}

# ---------------------------------------------------------------- prompt

substitute() {
  local file=$1 slug=$2 branch=$3 migration=$4 test_db=$5 parent=$6
  sed -e "s|{{SLUG}}|$slug|g" \
      -e "s|{{BRANCH}}|$branch|g" \
      -e "s|{{MIGRATION}}|$migration|g" \
      -e "s|{{TEST_DB_URL}}|$(db_url "$test_db")|g" \
      -e "s|{{PARENT}}|$parent|g" \
      "$file"
}

build_prompt() {
  local phase=$1 slug=$2 branch=$3 migration=$4 test_db=$5 parent=$6 out=$7

  {
    substitute "$PROMPTS/_commun.md" "$slug" "$branch" "$migration" "$test_db" "$parent"
    printf '\n---\n\n'
    substitute "$PROMPTS/$phase.md" "$slug" "$branch" "$migration" "$test_db" "$parent"
    cat <<PARAMS

---

## Paramètres de ta session

- Phase : $phase ($slug)
- Branche à pousser : \`$branch\`
- **PR en brouillon : base \`$parent\`, jamais \`main\`.**
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
  local phase=$1 slug=$2 branch=$3 migration=$4 test_db=$5 parent=$6
  local wt prompt logfile
  wt=$(worktree_path "$phase")
  prompt="$LOGDIR/prompt-$phase-$slug.md"
  logfile="$LOGDIR/session-$phase-$slug.log"

  build_prompt "$phase" "$slug" "$branch" "$migration" "$test_db" "$parent" "$prompt"

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

# ---------------------------------------------------------------- accumulation de vague

# Fusionne les branches de la vague dans `agents/wave-<n>`, partie de la branche
# parente, puis vérifie l'ensemble. C'est cette branche que la vague suivante prend
# comme base, et c'est elle qui remonte vers `main` à la fin de la chaîne.
build_wave() {
  local wave=$1 parent=$2
  shift 2
  local -a branches=("$@")
  local branch wt
  branch=$(wave_branch "$wave")
  wt="$WT_ROOT/integration-$wave"

  ensure_db "hexamap_test_wave$wave"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] $branch = $parent + ${branches[*]}, puis ci:check, puis push"
    return 0
  fi

  git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  rm -rf "$wt"
  # -B réinitialise l'accumulation : une reprise de vague ne doit pas empiler deux fois.
  git -C "$ROOT" worktree add -q -B "$branch" "$wt" "$parent"
  seed_worktree "$wt"

  local b conflicted
  for b in "${branches[@]}"; do
    if ! git -C "$wt" merge --no-ff --no-edit -m "agents: intégrer $b dans $branch" "$b" >/dev/null 2>&1; then
      conflicted=$(git -C "$wt" diff --name-only --diff-filter=U)
      # `routeTree.gen.ts` est généré : on ne le fusionne jamais à la main, on le régénère.
      if [ "$conflicted" = "apps/web/src/routeTree.gen.ts" ]; then
        warn "conflit généré sur routeTree.gen.ts : résolu par régénération"
        git -C "$wt" checkout --ours -- apps/web/src/routeTree.gen.ts
        git -C "$wt" add apps/web/src/routeTree.gen.ts
        git -C "$wt" commit -q --no-edit
      else
        warn "conflit réel en intégrant $b dans $branch :"
        printf '%s\n' "$conflicted" >&2
        warn "rien n'est résolu automatiquement. Corrige à la main dans $wt, puis relance."
        return 1
      fi
    fi
  done

  log "ci:check sur $branch (${branches[*]})"
  if ! ( cd "$wt" && dc --profile tools run --rm -e "TEST_DATABASE_URL=$(db_url "hexamap_test_wave$wave")" \
        dev bun run ci:check ); then
    warn "ci:check échoue sur $branch : la vague suivante ne partira pas de là."
    return 1
  fi

  if [ "$PUSH" -eq 1 ]; then
    log "push de $branch"
    git -C "$ROOT" push -u origin "$branch" >>"$LOGDIR/push.log" 2>&1 \
      || warn "push de $branch impossible : les PR ne pourront pas la cibler en ligne."
  fi

  # Le worktree doit disparaître, la branche reste : la vague suivante en part.
  git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  rm -rf "$wt"
  return 0
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
    printf '  %-22s %s\n' "$label" "$status"
  done
  printf '\n'
  log "Branches de phase :"
  git -C "$ROOT" branch --list 'feat/phase-*' --format='  %(refname:short)'
  log "Branches d'accumulation :"
  git -C "$ROOT" branch --list 'agents/wave-*' --format='  %(refname:short)'
  printf '\n'
  log "Journaux : $LOGDIR"
  log "Worktrees : $WT_ROOT (supprimés sauf --keep)"
  printf '\n'
  log "Étape suivante, à la main :"
  printf "  1. relire les PR de phase, chacune ciblant la branche de sa vague parente\n"
  printf "  2. consolider .docs/sessions/*/journal.md dans .docs/03-active-task.md\n"
  printf "  3. fusionner la DERNIÈRE branche agents/wave-* dans main\n"
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
  for wt in "$WT_ROOT"/phase-* "$WT_ROOT"/integration-*; do
    [ -d "$wt" ] || continue
    git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  done
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

    local parent
    parent=$(parent_branch "$wave")
    if [ "$DRY_RUN" -eq 0 ] && ! git -C "$ROOT" show-ref --verify --quiet "refs/heads/$parent"; then
      die "la branche parente '$parent' est absente : rejoue la vague précédente."
    fi

    log "vague $wave : ${batch[*]} — base $parent (parallèle max $MAX_PARALLEL)"

    local -a pids=()
    local i p s b m
    for i in "${!batch[@]}"; do
      p=${batch[$i]}; s=${batch_slugs[$i]}
      b=${batch_branches[$i]}; m=${batch_migrations[$i]}
      ensure_db "hexamap_test_$p"
      prepare_worktree "$p" "$b" "$parent"
      if [ "$DRY_RUN" -eq 0 ]; then
        launch "$p" "$s" "$b" "$m" "hexamap_test_$p" "$parent" &
        pids+=("$!")
      else
        launch "$p" "$s" "$b" "$m" "hexamap_test_$p" "$parent"
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

    # Une chaîne trouée ne peut pas continuer : la vague suivante partirait d'un
    # arbre qui ne contient pas ce que son brief lui promet.
    if [ "$rc" -ne 0 ]; then
      warn "vague $wave incomplète : la chaîne s'arrête ici, rien n'est accumulé."
      results+=("vague $wave|chaîne interrompue")
      break
    fi

    if build_wave "$wave" "$parent" "${batch_branches[@]}"; then
      results+=("vague $wave|accumulée dans $(wave_branch "$wave")")
    else
      results+=("vague $wave|NON accumulée")
      break
    fi
  done

  report "${results[@]}"
  cleanup
}

trap 'die "interrompu"' INT TERM
main "$@"
