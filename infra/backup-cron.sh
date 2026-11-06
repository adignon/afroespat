#!/bin/bash
# Planification de la sauvegarde dans le conteneur `backup` : une exécution par jour à BACKUP_HOUR (UTC, défaut 03:00),
# plus une exécution au démarrage si la dernière réussite date de plus de 24 h. Un échec est journalisé et RÉESSAYÉ
# une heure plus tard ; la sonde de santé du compose (voir `.last-success`) passe au rouge si rien n'a réussi en 26 h.
set -uo pipefail

HEURE="${BACKUP_HOUR:-03:00}"
DIR="${BACKUP_DIR:-/backups}"

lancer() {
  if bash /app/infra/backup-db.sh; then
    return 0
  fi
  echo "ÉCHEC de la sauvegarde ($(date -u +%FT%TZ)) — nouvel essai dans une heure." >&2
  return 1
}

mkdir -p "$DIR"
if [ -z "$(find "$DIR" -maxdepth 1 -name .last-success -mmin -1440 2> /dev/null)" ]; then
  lancer || true
fi

while true; do
  maintenant=$(date -u +%s)
  prochaine=$(date -u -d "$(date -u +%F) $HEURE:00" +%s)
  [ "$prochaine" -le "$maintenant" ] && prochaine=$((prochaine + 86400))
  echo "Prochaine sauvegarde : $(date -u -d "@$prochaine" +%FT%TZ)"
  sleep $((prochaine - maintenant))
  until lancer; do
    sleep 3600
  done
done
