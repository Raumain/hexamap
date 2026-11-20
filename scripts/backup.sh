#!/bin/sh
# Sauvegarde de la pile de production : la base ET les volumes que le dump ne
# contient pas.
#
#   ./scripts/backup.sh
#
# Un `pg_dump` seul ne suffit pas (constat A5 de `ROADMAP.md` §2.A) : les blasons
# SVG et l'état de l'import Open Data vivent dans deux volumes Docker, pas dans
# PostgreSQL. Les perdre casse l'affichage de toutes les cartes sans qu'aucune
# sauvegarde de base ne s'en aperçoive.
#
# Le script ne modifie jamais la pile : il lit la base et les volumes, rien de
# plus. Il n'écrit aucun secret, ni sur la sortie standard ni dans les fichiers.
#
# Variables reconnues :
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

# --- 1. La pile de production doit tourner -----------------------------------
# Sans ce garde-fou, `docker compose exec` échouerait sur un message Docker
# obscur, et la sauvegarde pourrait sembler réussie avec un fichier vide.
services_running="$(docker compose -f "$COMPOSE_FILE" ps --status running --services 2>/dev/null || true)"
if ! printf '%s\n' "$services_running" | grep -qx 'db'; then
	erreur "le service « db » de la pile de production n'est pas démarré." \
		"Fichier compose : ${COMPOSE_FILE}" \
		"Démarrez la pile avec : docker compose -f ${COMPOSE_FILE} up -d"
fi

# --- 2. Préparation de la destination ----------------------------------------
mkdir -p "$BACKUP_DIR"
horodatage="$(date -u +%Y%m%dT%H%M%SZ)"
base="${BACKUP_DIR}/hexamap-${horodatage}"

# --- 3. La base --------------------------------------------------------------
# Format `-Fc` (custom) : compressé, restaurable table par table avec
# `pg_restore`. `-T` évite d'allouer un TTY dans un script.
printf '%s\n' "→ pg_dump ${POSTGRES_DB} vers ${base}.dump"
docker compose -f "$COMPOSE_FILE" exec -T db \
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
