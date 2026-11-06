#!/bin/bash
# RESTAURATION d'une sauvegarde produite par infra/backup-db.sh — TOUJOURS vers une base à part, jamais par-dessus la
# production. Procédure complète (arrêt de l'api, bascule, vérifications) : infra/README.md §3.
#
#     bash infra/restore-db.sh /root/backups/diasporyplus-AAAAMMJJ-HHMMSS.dump.age [base_cible]
#
# · `base_cible` : défaut `app_restore`. Le script REFUSE la base de production et refuse une cible qui existe déjà
#   (supprimez-la vous-même : `DROP DATABASE` n'a pas sa place dans un script de reprise).
# · Une archive `.age` se déchiffre avec la clé PRIVÉE, passée par BACKUP_AGE_IDENTITY=/chemin/cle.txt
#   (sur VOTRE poste ou depuis un coffre — pas conservée sur le serveur de production).
# · Mode hôte (défaut) : passe par `docker compose exec postgres` ; mode conteneur si PGHOST est défini.
# · Termine par des comptages : users, dernier domain_events, audit_logs — à comparer avec la production.
set -euo pipefail

FICHIER="${1:?usage : restore-db.sh <archive.dump|archive.dump.age> [base_cible]}"
CIBLE="${2:-app_restore}"
[ -f "$FICHIER" ] || { echo "ERREUR : $FICHIER introuvable." >&2; exit 1; }
cd "$(dirname "$0")/.."

if [ -n "${PGHOST:-}" ]; then
  psql_() { psql -v ON_ERROR_STOP=1 "$@"; }
  restaurer() { pg_restore --no-owner --no-privileges -d "$CIBLE"; }
  PROD_DB="${PGDATABASE:-app}"
else
  COMPOSE=(docker compose --env-file prod.env -f docker-compose.prod.yml)
  psql_() { "${COMPOSE[@]}" exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$@"' sh "$@"; }
  restaurer() { "${COMPOSE[@]}" exec -T postgres sh -c 'pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d "$1"' sh "$CIBLE"; }
  PROD_DB="app"
fi

if [ "$CIBLE" = "$PROD_DB" ]; then
  echo "ERREUR : la cible est la base de production ($PROD_DB). Restaurez vers une base à part, puis basculez (README §3)." >&2
  exit 1
fi
if [ "$(psql_ -d postgres -tAc "select 1 from pg_database where datname='$CIBLE'" | tr -d '[:space:]')" = 1 ]; then
  echo "ERREUR : la base « $CIBLE » existe déjà. Supprimez-la vous-même, ou choisissez un autre nom." >&2
  exit 1
fi

lire() {
  case "$FICHIER" in
    *.age)
      : "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY (clé privée age) manquant pour une archive .age}"
      age -d -i "$BACKUP_AGE_IDENTITY" "$FICHIER"
      ;;
    *) cat "$FICHIER" ;;
  esac
}

echo "Création de la base « $CIBLE » puis restauration de $FICHIER …"
psql_ -d postgres -c "create database \"$CIBLE\""
if ! lire | restaurer; then
  echo "ERREUR : la restauration a échoué ; la base « $CIBLE » est laissée en l'état pour examen." >&2
  exit 1
fi

echo "── Vérifications sur « $CIBLE » ──"
psql_ -d "$CIBLE" -c "select count(*) as users from users" \
  -c "select max(created_at) as dernier_evenement from domain_events" \
  -c "select count(*) as audit_logs from audit_logs"
echo "Suite (README §3) : pnpm --filter @app/api rotate-keys --dry-run sur cette base doit rapporter « illisibles 0 »."
