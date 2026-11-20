#!/bin/sh
# Sauvegarde de la pile de production : la base ET les volumes que le dump ne
# contient pas.
#
#   ./scripts/backup.sh                          # pile locale (`name:` du fichier)
#   ./scripts/backup.sh -p <projet>              # pile déployée par Dokploy
#   ./scripts/backup.sh --project-name <projet>
#   ./scripts/backup.sh -h                       # aide
#
# Un `pg_dump` seul ne suffit pas (constat A5 de `ROADMAP.md` §2.A) : les blasons
# SVG et l'état de l'import Open Data vivent dans deux volumes Docker, pas dans
# PostgreSQL. Les perdre casse l'affichage de toutes les cartes sans qu'aucune
# sauvegarde de base ne s'en aperçoive.
#
# Le script ne modifie jamais la pile : il lit la base et les volumes, rien de
# plus. Il n'écrit aucun secret, ni sur la sortie standard ni dans les fichiers.
#
# Le nom de projet : `docker-compose.prod.yml` porte un `name:` (`hexamap-prod`),
# que `docker compose` préfère à `COMPOSE_PROJECT_NAME`. Sous Dokploy, la pile
# tourne sous un nom généré par la plateforme : sans `-p`, `docker compose ps`
# ne voit aucun service et le garde-fou ci-dessous échoue alors que la pile
# tourne. `docker compose ls` donne le nom réel sur le VPS.
#
# Variables reconnues :
#   COMPOSE_FILE             fichier compose (défaut : docker-compose.prod.yml)
#   COMPOSE_PROJECT_NAME     repli de `-p` (ignoré si `-p` est fourni)
#   BACKUP_DIR               destination (défaut : ./backups)
#   BACKUP_RETENTION_DAYS    purge des fichiers plus anciens (défaut : 7)
#   POSTGRES_USER            rôle PostgreSQL (défaut : hexamap)
#   POSTGRES_DB              base à sauvegarder (défaut : hexamap)
#   BLASONS_VOLUME           défaut : hexamap_prod_blasons
#   IMPORT_STATUS_VOLUME     défaut : hexamap_prod_importstatus
#
# Restauration : voir `.docs/05-deploiement.md` §3.

set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
POSTGRES_USER="${POSTGRES_USER:-hexamap}"
POSTGRES_DB="${POSTGRES_DB:-hexamap}"
BLASONS_VOLUME="${BLASONS_VOLUME:-hexamap_prod_blasons}"
IMPORT_STATUS_VOLUME="${IMPORT_STATUS_VOLUME:-hexamap_prod_importstatus}"
PROJET="${COMPOSE_PROJECT_NAME:-}"

# Les fichiers de sauvegarde contiennent toute la base : lisibles par le seul
# propriétaire, jamais par le groupe ni par les autres.
umask 077

erreur() {
	printf '%s\n' "ERREUR : $1" >&2
	shift
	for ligne in "$@"; do
		printf '%s\n' "         $ligne" >&2
	done
	exit 1
}

aide() {
	cat <<'EOF'
Usage : ./scripts/backup.sh [-p <projet>] [--project-name <projet>]

Sauvegarde la base PostgreSQL et les deux volumes de la pile de production
(blasons, état de l'import Open Data) dans BACKUP_DIR, puis purge les archives
plus anciennes que BACKUP_RETENTION_DAYS jours.

  -p, --project-name <projet>  nom de projet Compose de la pile à sauvegarder.
                               Obligatoire quand la pile n'est pas celle du
                               `name:` du fichier compose (cas de Dokploy, qui
                               génère le sien). Sur le VPS : `docker compose ls`
                               affiche la colonne NAME.
  -h, --help                   affiche cette aide.

Variables : COMPOSE_FILE, COMPOSE_PROJECT_NAME (repli de -p), BACKUP_DIR,
BACKUP_RETENTION_DAYS, POSTGRES_USER, POSTGRES_DB, BLASONS_VOLUME,
IMPORT_STATUS_VOLUME. Voir l'en-tête du script.

Restauration : .docs/05-deploiement.md §3.
EOF
}

while [ "$#" -gt 0 ]; do
	case "$1" in
		-p | --project-name)
			[ "$#" -ge 2 ] || erreur "$1 attend un nom de projet." \
				"Exemple : ./scripts/backup.sh -p <projet>"
			PROJET="$2"
			shift 2
			;;
		-p?*)
			PROJET="${1#-p}"
			shift
			;;
		--project-name=*)
			PROJET="${1#--project-name=}"
			shift
			;;
		-h | --help)
			aide
			exit 0
			;;
		*)
			erreur "argument inconnu : $1" "Voir : ./scripts/backup.sh -h"
			;;
	esac
done

# Toute invocation Compose passe par ici : `-p` doit être posé partout, sinon le
# garde-fou interroge une pile et le dump en lit une autre.
compose() {
	if [ -n "$PROJET" ]; then
		docker compose -p "$PROJET" -f "$COMPOSE_FILE" "$@"
	else
		docker compose -f "$COMPOSE_FILE" "$@"
	fi
}

# --- 1. La pile de production doit tourner -----------------------------------
# Sans ce garde-fou, `docker compose exec` échouerait sur un message Docker
# obscur, et la sauvegarde pourrait sembler réussie avec un fichier vide.
services_running="$(compose ps --status running --services 2>/dev/null || true)"
if ! printf '%s\n' "$services_running" | grep -qx 'db'; then
	erreur "le service « db » de la pile de production n'est pas démarré." \
		"Fichier compose : ${COMPOSE_FILE}" \
		"Projet Compose : ${PROJET:-<name: du fichier compose>}" \
		"Lister les piles : docker compose ls" \
		"Démarrez la pile avec : docker compose ${PROJET:+-p ${PROJET} }-f ${COMPOSE_FILE} up -d"
fi

# --- 2. Préparation de la destination ----------------------------------------
mkdir -p "$BACKUP_DIR"
horodatage="$(date -u +%Y%m%dT%H%M%SZ)"
base="${BACKUP_DIR}/hexamap-${horodatage}"

# --- 3. La base --------------------------------------------------------------
# Format `-Fc` (custom) : compressé, restaurable table par table avec
# `pg_restore`. `-T` évite d'allouer un TTY dans un script.
printf '%s\n' "→ pg_dump ${POSTGRES_DB} vers ${base}.dump"
compose exec -T db \
	pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "${base}.dump"

if [ ! -s "${base}.dump" ]; then
	erreur "le dump de la base est vide : ${base}.dump" \
		"Vérifiez les droits du rôle ${POSTGRES_USER} et l'état de ${POSTGRES_DB}."
fi

# --- 4. Les volumes que la base ne contient pas ------------------------------
# Un conteneur jetable monte le volume en lecture seule et écrit l'archive sur sa
# sortie standard ; il ne faut donc aucun binaire de plus sur l'hôte, et le
# volume n'est jamais modifié.
sauver_volume() {
	volume="$1"
	nom="$2"

	if ! docker volume inspect "$volume" >/dev/null 2>&1; then
		printf '%s\n' "  ⚠ volume absent, ignoré : ${volume}" >&2
		return 0
	fi

	printf '%s\n' "→ archive du volume ${volume}"
	docker run --rm \
		-v "${volume}:/data/source:ro" \
		alpine:3 \
		sh -c 'tar -czf - -C /data/source .' > "${base}-${nom}.tar.gz"

	if [ ! -s "${base}-${nom}.tar.gz" ]; then
		erreur "l'archive du volume ${volume} est vide." \
			"Sauvegarde partielle : ${base}.dump est intact, ${base}-${nom}.tar.gz ne l'est pas."
	fi
}

sauver_volume "$BLASONS_VOLUME" blasons
sauver_volume "$IMPORT_STATUS_VOLUME" importstatus

# --- 5. Purge des sauvegardes trop anciennes ---------------------------------
# `-mtime +N` supprime ce qui a dépassé N jours révolus. Les deux sortes de
# fichiers d'un même horodatage portent le même préfixe et partent ensemble.
purges="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hexamap-*' \
	-mtime "+${BACKUP_RETENTION_DAYS}" -print)"
if [ -n "$purges" ]; then
	printf '%s\n' "→ purge des sauvegardes de plus de ${BACKUP_RETENTION_DAYS} jours"
	printf '%s\n' "$purges" | while IFS= read -r fichier; do
		printf '%s\n' "  supprimé : ${fichier}"
		rm -f "$fichier"
	done
fi

printf '%s\n' "Sauvegarde terminée dans ${BACKUP_DIR} :"
printf '%s\n' "  ${base}.dump"
printf '%s\n' "  ${base}-blasons.tar.gz        (si le volume existait)"
printf '%s\n' "  ${base}-importstatus.tar.gz   (si le volume existait)"
