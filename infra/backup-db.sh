#!/bin/bash
# SAUVEGARDE DE LA BASE DE PRODUCTION — pg_dump compressé, avec rotation.
#
# À lancer SUR LE SERVEUR, depuis le dépôt (là où se trouvent docker-compose.prod.yml et prod.env) :
#
#     cd /root/afroespat && bash infra/backup-db.sh
#
# Ce que ça fait :
#   · exécute pg_dump dans le conteneur `postgres` (utilisateur et base lus dans les variables du conteneur) ;
#   · écrit /root/backups/diasporyplus-AAAAMMJJ-HHMMSS.sql.gz (dossier modifiable : BACKUP_DIR=/autre/dossier) ;
#   · VÉRIFIE l'archive (gzip -t, taille non nulle) et refuse de continuer si elle est vide ou corrompue ;
#   · garde les 7 plus récentes (KEEP=14 pour en garder davantage) et supprime les plus anciennes.
#
# Pour restaurer (sur une base VIDE, après avoir arrêté api et worker) :
#
#     gunzip -c /root/backups/diasporyplus-AAAAMMJJ-HHMMSS.sql.gz \
#       | docker compose --env-file prod.env -f docker-compose.prod.yml exec -T postgres \
#         sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
#
# Cette sauvegarde reste SUR LE MÊME SERVEUR : elle protège d'une fausse manœuvre (génération, purge, migration), pas
# de la perte de la machine. Copiez-la ailleurs pour cela (scp, stockage objet).
set -euo pipefail

DIR="${BACKUP_DIR:-/root/backups}"
KEEP="${KEEP:-7}"
COMPOSE=(docker compose --env-file prod.env -f docker-compose.prod.yml)

cd "$(dirname "$0")/.."
mkdir -p "$DIR"
chmod 700 "$DIR"

FICHIER="$DIR/diasporyplus-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "Sauvegarde vers $FICHIER …"

# `--no-owner --no-privileges` : l'archive se restaure sans dépendre des rôles du serveur d'origine.
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' | gzip -9 > "$FICHIER"

if ! gzip -t "$FICHIER"; then
  echo "ERREUR : l'archive est corrompue, supprimée." >&2
  rm -f "$FICHIER"
  exit 1
fi
TAILLE=$(stat -c %s "$FICHIER")
if [ "$TAILLE" -lt 2048 ]; then
  echo "ERREUR : l'archive est anormalement petite (${TAILLE} octets), supprimée." >&2
  rm -f "$FICHIER"
  exit 1
fi
chmod 600 "$FICHIER"

# Rotation : on garde les $KEEP plus récentes.
ls -1t "$DIR"/diasporyplus-*.sql.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f --

echo "OK : $FICHIER ($((TAILLE / 1024)) Ko). Sauvegardes présentes :"
ls -1t "$DIR"/diasporyplus-*.sql.gz
