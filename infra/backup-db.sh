#!/bin/bash
# SAUVEGARDE DE LA BASE DE PRODUCTION — pg_dump « custom », chiffré (age), avec rotation et envoi S3 facultatif.
#
# Deux modes, choisis automatiquement :
#   · HÔTE (défaut) : lancé depuis le dépôt (là où se trouvent docker-compose.prod.yml et prod.env), le dump passe par
#       `docker compose exec postgres` :        cd /root/afroespat && bash infra/backup-db.sh
#   · CONTENEUR     : `PGHOST` défini (c'est le cas du service `backup` du compose, qui l'appelle chaque nuit) :
#       le dump est fait directement avec pg_dump (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
#
# Variables (toutes facultatives sauf mention) :
#   BACKUP_DIR              dossier des sauvegardes (hôte : /root/backups ; conteneur : /backups)
#   BACKUP_AGE_RECIPIENT    clé PUBLIQUE age (age1…) : l'archive est chiffrée avec elle, la clé privée n'est JAMAIS sur le
#                           serveur (voir infra/README.md). Sans elle le script REFUSE, sauf BACKUP_ALLOW_PLAINTEXT=true.
#   KEEP_DAILY=7 KEEP_WEEKLY=4 KEEP_MONTHLY=12   rétention : les N dernières quotidiennes, les N dernières du dimanche,
#                           les N dernières du 1er du mois ; le reste est supprimé.
#   BACKUP_S3_BUCKET        si défini, l'archive est aussi envoyée dans ce seau — DISTINCT de celui des médias, avec des
#                           identifiants distincts : BACKUP_S3_ENDPOINT, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY,
#                           BACKUP_S3_REGION (défaut eu-west-1), BACKUP_S3_PREFIX (défaut diasporyplus/). La rétention
#                           distante se règle par une règle de cycle de vie du seau (le script n'y supprime rien).
#
# Contrôles : le dump est relu par `pg_restore --list` AVANT chiffrement (un dump illisible n'est jamais envoyé), puis la
# taille est vérifiée. Le fichier `.last-success` du dossier sert à la sonde de santé du service `backup`.
#
# Cette sauvegarde protège d'une fausse manœuvre ; contre la perte de la machine, il faut la copie S3 (ou scp ailleurs).
# SAUVEGARDEZ AUSSI LES CLÉS DE CHIFFREMENT, séparément (infra/README.md §2) : sans elles, la base est illisible.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -n "${PGHOST:-}" ]; then
  MODE=conteneur
  DIR="${BACKUP_DIR:-/backups}"
else
  MODE=hote
  DIR="${BACKUP_DIR:-/root/backups}"
  COMPOSE=(docker compose --env-file prod.env -f docker-compose.prod.yml)
fi
KEEP_DAILY="${KEEP_DAILY:-${KEEP:-7}}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
RECIPIENT="${BACKUP_AGE_RECIPIENT:-}"

if [ -z "$RECIPIENT" ] && [ "${BACKUP_ALLOW_PLAINTEXT:-false}" != "true" ]; then
  echo "ERREUR : BACKUP_AGE_RECIPIENT (clé publique age) n'est pas défini : une sauvegarde en clair contient les données" >&2
  echo "personnelles des membres. Définissez-le, ou BACKUP_ALLOW_PLAINTEXT=true pour passer outre (déconseillé)." >&2
  exit 1
fi

mkdir -p "$DIR"
chmod 700 "$DIR"
BRUT="$DIR/.en-cours-$$.dump"
trap 'rm -f "$BRUT"' EXIT

NOM="diasporyplus-$(date -u +%Y%m%d-%H%M%S).dump"
SUFFIXE=""
[ -n "$RECIPIENT" ] && SUFFIXE=".age"
echo "Sauvegarde ($MODE) vers $DIR/$NOM$SUFFIXE …"

# `--no-owner --no-privileges` : l'archive se restaure sans dépendre des rôles du serveur d'origine.
if [ "$MODE" = conteneur ]; then
  pg_dump --format=custom --no-owner --no-privileges > "$BRUT"
else
  "${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$BRUT"
fi

TAILLE=$(stat -c %s "$BRUT")
if [ "$TAILLE" -lt 2048 ]; then
  echo "ERREUR : le dump est anormalement petit (${TAILLE} octets), abandon." >&2
  exit 1
fi
if [ "$MODE" = conteneur ]; then
  pg_restore --list "$BRUT" > /dev/null || { echo "ERREUR : le dump ne se relit pas (pg_restore --list), abandon." >&2; exit 1; }
else
  "${COMPOSE[@]}" exec -T postgres pg_restore --list < "$BRUT" > /dev/null || { echo "ERREUR : le dump ne se relit pas (pg_restore --list), abandon." >&2; exit 1; }
fi

if [ -n "$RECIPIENT" ]; then
  FINAL="$DIR/$NOM.age"
  age -r "$RECIPIENT" -o "$FINAL" "$BRUT"
else
  FINAL="$DIR/$NOM"
  mv "$BRUT" "$FINAL"
fi
chmod 600 "$FINAL"
if [ "$(stat -c %s "$FINAL")" -lt 2048 ]; then
  echo "ERREUR : l'archive finale est anormalement petite, supprimée." >&2
  rm -f "$FINAL"
  exit 1
fi

# Envoi facultatif vers un stockage S3 DISTINCT (identifiants propres à la sauvegarde).
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  : "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT manquant}" "${BACKUP_S3_ACCESS_KEY_ID:?BACKUP_S3_ACCESS_KEY_ID manquant}" "${BACKUP_S3_SECRET_ACCESS_KEY:?BACKUP_S3_SECRET_ACCESS_KEY manquant}"
  PREFIX="${BACKUP_S3_PREFIX:-diasporyplus/}"
  AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" \
  AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-eu-west-1}" \
    aws s3 cp --only-show-errors --endpoint-url "$BACKUP_S3_ENDPOINT" "$FINAL" "s3://$BACKUP_S3_BUCKET/$PREFIX$(basename "$FINAL")"
  echo "Copie distante : s3://$BACKUP_S3_BUCKET/$PREFIX$(basename "$FINAL")"
fi

# Rotation : on GARDE l'union des N dernières quotidiennes, des N dernières du dimanche et des N dernières du 1er du mois.
mapfile -t TOUS < <(ls -1 "$DIR" | grep -E '^diasporyplus-[0-9]{8}-[0-9]{6}\.dump(\.age)?$' | sort -r)
declare -A GARDER=()
i=0
for f in "${TOUS[@]}"; do
  [ "$i" -lt "$KEEP_DAILY" ] && GARDER[$f]=1
  i=$((i + 1))
done
w=0
m=0
for f in "${TOUS[@]}"; do
  jour="${f:12:8}"
  if [ "$(date -u -d "$jour" +%u 2> /dev/null || echo 0)" = 7 ] && [ "$w" -lt "$KEEP_WEEKLY" ]; then
    GARDER[$f]=1
    w=$((w + 1))
  fi
  if [ "${jour:6:2}" = 01 ] && [ "$m" -lt "$KEEP_MONTHLY" ]; then
    GARDER[$f]=1
    m=$((m + 1))
  fi
done
for f in "${TOUS[@]}"; do
  if [ -z "${GARDER[$f]:-}" ]; then
    rm -f "$DIR/$f"
    echo "Supprimée (rotation) : $f"
  fi
done

touch "$DIR/.last-success"
echo "OK : $FINAL ($(stat -c %s "$FINAL") octets). ${#GARDER[@]} sauvegarde(s) conservée(s)."
