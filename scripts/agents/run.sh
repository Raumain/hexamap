#!/usr/bin/env bash
# Lance une session OpenCode par phase du plan, chacune sur sa branche et son worktree.
#
# Le graphe des phases vit dans un plan TSV : `scripts/agents/phases.tsv` par défaut, le plan
# de la v2 dans `scripts/v2/plan.tsv`. Le préambule commun est dans
# scripts/agents/prompts/_commun.md, et le brief de chaque phase dans prompts/<n>.md.
#
# Les branches sont EMPILÉES : une vague part de la branche d'accumulation de la vague
# précédente, jamais de la base. Une phase dont le brief dit « la phase X est fusionnée »
# la voit donc réellement dans son arbre.
#
#   BASE ──┬─ feat/phase-26 ─┐
#          └─ feat/phase-28 ─┴─ agents/wave-1 ── feat/phase-27 ── agents/wave-2 ── …
#
# Chaque PR de phase cible la branche de sa vague parente. La dernière branche
# d'accumulation est celle qui remonte vers la base. Ce script ne fusionne rien dans BASE.
#
# Tous les `docker compose` du lanceur portent `-p "$COMPOSE_PROJECT"` : lancé depuis un
# worktree, Compose dériverait sinon le nom du projet du nom du dossier, créerait une pile
# neuve et un `db` vide. `COMPOSE_PROJECT_NAME` n'est jamais exportée : elle écraserait le
# `name:` d'un fichier compose, et le banc e2e en porte un.

set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
PROMPTS="$SCRIPT_DIR/prompts"
PLAN=${PLAN:-"$SCRIPT_DIR/phases.tsv"}
# Nom de projet Compose stable, quel que soit le dossier courant (`hexamap`).
COMPOSE_PROJECT=${COMPOSE_PROJECT:-$(basename "$ROOT" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')}

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
GATE=0
PR=0
E2E=0
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
  --gate          Après chaque session, joue `ci:check` dans le worktree de la phase avec
                  sa base de test ; si la porte échoue, la chaîne s'arrête et rien n'est
                  accumulé (défaut : désactivée)
  --pr            Ouvre une PR en brouillon par phase réussie, vers la branche de la vague
                  parente ; sans effet si `gh` est absent (défaut : désactivée)
  --e2e           Joue le banc Playwright sur la branche d'accumulation de chaque vague,
                  après `ci:check` et avant le push (défaut : désactivée)
  --dry-run       Affiche les commandes sans rien lancer
  --keep          Conserve les worktrees après exécution
  --allow-dirty   Autorise un arbre de travail non propre
  --no-auto       N'ajoute pas `opencode run --auto` (approbations manuelles)
  --no-push       Ne pousse pas les branches d'accumulation
  -h, --help      Ce texte

Variables : BASE, PLAN, WAVE_PREFIX, WT_ROOT, LOGDIR, MAX_PARALLEL, SESSION_TIMEOUT,
            COMPOSE_PROJECT.
TXT
}

while [ $# -gt 0 ]; do
  case "$1" in
    --wave)        ONLY_WAVE=${2:?}; shift 2 ;;
    --phase)       ONLY_PHASE=${2:?}; shift 2 ;;
    --parallel)    MAX_PARALLEL=${2:?}; shift 2 ;;
    --gate)        GATE=1; shift ;;
    --pr)          PR=1; shift ;;
    --e2e)         E2E=1; shift ;;
    --dry-run)     DRY_RUN=1; shift ;;
    --keep)        KEEP=1; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --no-auto)     AUTO=0; shift ;;
    --no-push)     PUSH=0; shift ;;
    -h|--help)     usage; exit 0 ;;
    *)             die "option inconnue : $1" ;;
  esac
done

dc() { docker compose -p "$COMPOSE_PROJECT" "$@" </dev/null; }
wave_branch()   { printf '%s-%s' "${WAVE_PREFIX:-agents/wave}" "$1"; }
# La vague 1 part de BASE ; les suivantes partent de l'accumulation précédente.
parent_branch() { if [ "$1" -eq 1 ]; then printf '%s' "$BASE"; else wave_branch "$(( $1 - 1 ))"; fi; }

# ---------------------------------------------------------------- préalables

preflight() {
  local missing=0 bin
  local -a bins=(opencode git docker jq timeout)
  # `gh` n'est exigé que si l'on demande des PR : sans --pr il ne sert à rien.
  if [ "$PR" -eq 1 ]; then
    bins+=(gh)
  fi
  for bin in "${bins[@]}"; do
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

# ---------------------------------------------------------------- branche de base

# La PR d'une phase cible la branche de sa vague parente : elle doit exister sur
# l'origine *avant* que la session démarre, sinon `gh pr create --base` échoue et
# l'agent risque de se rabattre sur `main`, ce qui casse la chaîne.
ensure_remote_branch() {
  local branch=$1

  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] '$branch' doit exister en local puis sur l'origine (push si absente)"
    return 0
  fi

  if ! git -C "$ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    die "la branche '$branch' est absente en local : rejoue la vague précédente."
  fi

  if [ "$PUSH" -eq 0 ]; then
    warn "--no-push : '$branch' ne sera pas publiée, les PR de phase échoueront."
    return 0
  fi

  if git -C "$ROOT" ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
    log "branche de base publiée : $branch"
    return 0
  fi

  log "branche de base absente de l'origine : push de $branch"
  git -C "$ROOT" push -u origin "$branch" >>"$LOGDIR/push.log" 2>&1 \
    || die "push de '$branch' impossible : les PR de la vague ne pourraient pas la cibler."
}


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

# ---------------------------------------------------------------- PR de phase

# Une PR en brouillon par phase, vers la branche de sa vague parente. Idempotent : si une PR
# est déjà ouverte pour la branche, on la cite au lieu d'en créer une seconde.
ensure_pr() {
  local phase=$1 slug=$2 branch=$3 parent=$4

  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] PR brouillon de $branch vers $parent : gh pr create --draft --title \"Hexamap · phase $phase · $slug\""
    return 0
  fi

  local existing
  existing=$(gh pr list --head "$branch" --json number,url --jq '.[0] | "\(.number) \(.url)"' 2>/dev/null || true)
  if [ -n "$existing" ]; then
    log "PR déjà ouverte pour $branch : $existing"
    return 0
  fi

  if ( cd "$ROOT" && gh pr create --draft --base "$parent" --head "$branch" \
        --title "Hexamap · phase $phase · $slug" \
        --body "Phase $phase ($slug) de la v2. Base : $parent. Vérifications : voir le journal de session." \
     ) >>"$LOGDIR/pr.log" 2>&1; then
    log "PR brouillon ouverte : $branch → $parent"
  else
    warn "création de la PR impossible pour $branch (voir $LOGDIR/pr.log)"
  fi
}

# ---------------------------------------------------------------- accumulation de vague

# Fusionne les branches de la vague dans `agents/wave-<n>`, partie de la branche
# parente, puis vérifie l'ensemble. C'est cette branche que la vague suivante prend
# comme base, et c'est elle qui remonte vers `main` à la fin de la chaîne.
build_wave() {
  local wave=$1 parent=$2 reset=$3
  shift 3
  local -a branches=("$@")
  local branch wt
  branch=$(wave_branch "$wave")
  wt="$WT_ROOT/integration-$wave"

  ensure_db "hexamap_test_wave$wave"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] $branch = $parent + ${branches[*]}, puis ci:check$([ "$E2E" -eq 1 ] && printf ', puis banc e2e'), puis push"
    return 0
  fi

  git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  rm -rf "$wt"
  if [ "$reset" -eq 1 ]; then
    # -B réinitialise l'accumulation : une reprise de vague ne doit pas empiler deux fois.
    git -C "$ROOT" worktree add -q -B "$branch" "$wt" "$parent"
  else
    # Lot suivant de la MÊME vague : la branche d'accumulation existe et porte déjà le lot
    # précédent. `-B` la réinitialiserait sur le parent, donc le lot serait perdu.
    git -C "$ROOT" worktree add -q "$wt" "$branch"
  fi
  seed_worktree "$wt"

  local b conflicted
  for b in "${branches[@]}"; do
    if ! git -C "$wt" merge --no-ff --no-edit -m "agents: intégrer $b dans $branch" "$b" >/dev/null 2>&1; then
      conflicted=$(git -C "$wt" diff --name-only --diff-filter=U)
      # `routeTree.gen.ts` est généré : on ne le fusionne jamais à la main, on le régénère.
      if [ "$conflicted" = "apps/web/src/routeTree.gen.ts" ]; then
        warn "conflit généré sur routeTree.gen.ts : résolu par régénération"
        git -C "$wt" checkout --ours -- apps/web/src/routeTree.gen.ts
        # Le fichier est généré : le committer tel quel figerait le graphe d'une seule des
        # deux branches. On le régénère depuis les routes réellement fusionnées.
        if ! ( cd "$wt" && dc --profile tools run --rm dev bun run --cwd apps/web generate ) \
              >>"$LOGDIR/routeTree.log" 2>&1; then
          warn "régénération de routeTree.gen.ts impossible (voir $LOGDIR/routeTree.log)"
          return 1
        fi
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

  # Une fusion peut changer les `package.json` et le `bun.lock` : la phase 33 a ajouté
  # `@hexamap/import` aux dépendances de `packages/spec`, et `seed_worktree` a installé
  # AVANT la fusion. Sans ce second `bun install`, `packages/spec/node_modules` n'a pas le
  # lien, et le typecheck échoue en TS2307 sur un arbre pourtant complet (vague 2).
  log "installation des dépendances fusionnées dans $wt"
  if ! ( cd "$wt" && dc --profile tools run --rm dev bun install --frozen-lockfile ) \
        >>"$LOGDIR/install.log" 2>&1; then
    warn "bun install --frozen-lockfile échoue après fusion : bun.lock ne correspond plus aux package.json fusionnés (voir $LOGDIR/install.log)"
    return 1
  fi

  log "ci:check sur $branch (${branches[*]})"
  if ! ( cd "$wt" && dc --profile tools run --rm -e "TEST_DATABASE_URL=$(db_url "hexamap_test_wave$wave")" \
        dev bun run ci:check ); then
    warn "ci:check échoue sur $branch : la vague suivante ne partira pas de là."
    return 1
  fi

  # Le banc e2e n'est pas parallélisable (`name: hexamap-e2e` dans son fichier compose) :
  # il tourne donc une fois par vague, sur la branche d'accumulation, et avant le push.
  if [ "$E2E" -eq 1 ]; then
    log "banc e2e sur $branch"
    if ! ( cd "$wt" \
             && docker compose -f docker-compose.e2e.yml up -d --build db api proxy \
             && docker compose -f docker-compose.e2e.yml run --rm playwright \
                  npx --no-install playwright test ); then
      warn "banc e2e en échec sur $branch : la vague n'est pas accumulée."
      ( cd "$wt" && docker compose -f docker-compose.e2e.yml down -v ) >/dev/null 2>&1 || true
      return 1
    fi
    ( cd "$wt" && docker compose -f docker-compose.e2e.yml down -v ) >/dev/null 2>&1 || true
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
  git -C "$ROOT" branch --list 'feat/*' --format='  %(refname:short)'
  log "Branches d'accumulation :"
  git -C "$ROOT" branch --list "${WAVE_PREFIX:-agents/wave}-*" --format='  %(refname:short)'
  printf '\n'
  log "Journaux : $LOGDIR"
  log "Worktrees : $WT_ROOT (supprimés sauf --keep)"
  printf '\n'
  log "Étape suivante, à la main :"
  printf "  1. relire les PR de phase, chacune ciblant la branche de sa vague parente\n"
  printf "  2. consolider .docs/sessions/*/journal.md dans .docs/03-active-task.md\n"
  printf "  3. fusionner la DERNIÈRE branche ${WAVE_PREFIX:-agents/wave}-* dans %s\n" "$BASE"
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

  # Toutes les phases, groupées par vague, dans l'ordre du plan. Une vague est collectée
  # ENTIÈREMENT avant d'être découpée en lots : découper au fil de la lecture ouvrirait un
  # second lot pour la même vague, et `build_wave` réinitialise alors la branche
  # d'accumulation — donc le premier lot serait perdu.
  local -a waves=()
  local -A wave_rows=()
  local -A seen=()
  local -A seen_wave=()
  local wave phase slug branch migration status
  local row

  for row in "${rows[@]}"; do
    IFS=$'\t' read -r wave phase slug branch migration status <<<"$row"
    case "$wave" in ''|'#'*) continue ;; esac
    if [ -n "$ONLY_WAVE" ] && [ "$wave" != "$ONLY_WAVE" ]; then continue; fi
    if [ -n "$ONLY_PHASE" ] && [ "$phase" != "$ONLY_PHASE" ]; then continue; fi

    if [ "$status" = "blocked" ]; then
      warn "phase $phase ($slug) bloquée hors du code : ignorée"
      results+=("phase $phase|bloquée")
      continue
    fi

    if [ -n "${seen[$phase]:-}" ]; then continue; fi
    seen[$phase]=1

    if [ -z "${seen_wave[$wave]:-}" ]; then
      seen_wave[$wave]=1
      waves+=("$wave")
    fi
    wave_rows[$wave]+="$phase"$'\t'"$slug"$'\t'"$branch"$'\t'"$migration"$'\n'
  done

  local aborted=0 w
  for w in "${waves[@]}"; do
    local -a phases=() slugs=() branches=() migrations=()
    while IFS=$'\t' read -r phase slug branch migration; do
      [ -n "$phase" ] || continue
      phases+=("$phase"); slugs+=("$slug")
      branches+=("$branch"); migrations+=("$migration")
    done <<<"${wave_rows[$w]}"

    local parent
    parent=$(parent_branch "$w")
    ensure_remote_branch "$parent"

    # Une vague est découpée en lots de MAX_PARALLEL, tous accumulés dans la MÊME branche
    # de vague : le premier lot crée la branche, les suivants l'étendent.
    local total=${#phases[@]} offset=0 batch_no=0 rc i end reset
    while [ "$offset" -lt "$total" ]; do
      batch_no=$(( batch_no + 1 ))
      local -a batch=() batch_slugs=() batch_branches=() batch_migrations=()
      end=$(( offset + MAX_PARALLEL ))
      if [ "$end" -gt "$total" ]; then end=$total; fi
      for (( i = offset; i < end; i++ )); do
        batch+=("${phases[$i]}"); batch_slugs+=("${slugs[$i]}")
        batch_branches+=("${branches[$i]}"); batch_migrations+=("${migrations[$i]}")
      done
      offset=$end

      log "vague $w, lot $batch_no : ${batch[*]} — base $parent (parallèle max $MAX_PARALLEL)"

      local -a pids=()
      local p s b m
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

      rc=0
      for i in "${!pids[@]}"; do
        if [ "${pids[$i]}" -eq 0 ]; then
          results+=("phase ${batch[$i]}|dry-run")
          continue
        fi
        if wait "${pids[$i]}"; then
          results+=("phase ${batch[$i]}|session ok")
          if [ "$PR" -eq 1 ]; then
            ensure_pr "${batch[$i]}" "${batch_slugs[$i]}" "${batch_branches[$i]}" "$parent"
          fi
        else
          results+=("phase ${batch[$i]}|session en échec")
          rc=1
        fi
      done

      # La porte : `ci:check` rejoué par le lanceur dans le worktree de la phase, avec la
      # base de test de cette phase. Elle ne remplace pas la vérification de la session,
      # elle la contrôle avant que quoi que ce soit soit accumulé.
      if [ "$rc" -eq 0 ] && [ "$GATE" -eq 1 ]; then
        for i in "${!batch[@]}"; do
          p=${batch[$i]}
          if [ "$DRY_RUN" -eq 1 ]; then
            log "[dry-run] porte ci:check sur la phase $p (base de test hexamap_test_$p)"
            results+=("porte $p|dry-run")
            continue
          fi
          log "porte ci:check sur la phase $p (base de test hexamap_test_$p)"
          if ( cd "$(worktree_path "$p")" \
                 && dc --profile tools run --rm \
                      -e "TEST_DATABASE_URL=$(db_url "hexamap_test_$p")" \
                      dev bun run ci:check ); then
            results+=("porte $p|ok")
          else
            warn "porte ci:check en échec sur la phase $p : la chaîne s'arrête, rien n'est accumulé."
            results+=("porte $p|échec")
            rc=1
            break
          fi
        done
      fi

      # Une chaîne trouée ne peut pas continuer : la vague suivante partirait d'un
      # arbre qui ne contient pas ce que son brief lui promet.
      if [ "$rc" -ne 0 ]; then
        warn "vague $w incomplète : la chaîne s'arrête ici, rien n'est accumulé."
        results+=("vague $w|chaîne interrompue")
        aborted=1
        break
      fi

      reset=0
      if [ "$batch_no" -eq 1 ]; then reset=1; fi
      if build_wave "$w" "$parent" "$reset" "${batch_branches[@]}"; then
        results+=("vague $w lot $batch_no|accumulée dans $(wave_branch "$w")")
      else
        results+=("vague $w lot $batch_no|NON accumulée")
        aborted=1
        break
      fi
    done

    if [ "$aborted" -eq 1 ]; then break; fi
  done

  report "${results[@]}"
  cleanup
}

trap 'die "interrompu"' INT TERM
main "$@"
