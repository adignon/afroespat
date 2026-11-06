# Service `backup` du compose de production : pg_dump + chiffrement age + envoi S3 facultatif, une fois par nuit.
# Même version majeure de client que le serveur (postgres:16). Construit depuis la racine du dépôt :
#   docker build -f infra/backup.Dockerfile -t disaporyplus-backup .
FROM postgres:16-alpine
RUN apk add --no-cache bash coreutils age aws-cli tzdata
COPY infra/backup-db.sh infra/backup-cron.sh /app/infra/
RUN chmod +x /app/infra/*.sh
WORKDIR /app
ENV BACKUP_DIR=/backups
# Le script d'origine fait `cd "$(dirname "$0")/.."` : /app/infra/backup-db.sh -> /app.
CMD ["bash", "/app/infra/backup-cron.sh"]
