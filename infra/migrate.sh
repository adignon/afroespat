#!/bin/sh
# Le conteneur `migrate` : applique les migrations, puis — si ROOT_ADMIN_EMAIL est défini — crée le premier compte
# d'équipe (SUPER_ADMIN) à partir de ROOT_ADMIN_EMAIL, ROOT_ADMIN_PASSWORD et ROOT_ADMIN_DISPLAY_NAME (facultatif).
#
# Une migration Prisma est du SQL pur : elle ne peut pas lire l'environnement ni hacher un mot de passe (argon2id).
# L'amorçage passe donc par `staff-bootstrap` (le même code que `pnpm staff:bootstrap`), qui garde ses règles :
#   · il ne crée le compte QUE sur une base sans aucun compte d'équipe (code de sortie 3 = « déjà fait », sans effet),
#     donc rejouer ce script à chaque déploiement n'est pas une porte dérobée ;
#   · le mot de passe n'est ni journalisé ni stocké en clair.
# Un amorçage qui échoue (mot de passe trop court…) ne bloque PAS le déploiement : il est signalé, les migrations restent.
set -e
pnpm exec prisma migrate deploy

if [ -n "${ROOT_ADMIN_EMAIL:-}" ]; then
  cd /app/apps/api
  set +e
  STAFF_BOOTSTRAP_EMAIL="$ROOT_ADMIN_EMAIL" \
  STAFF_BOOTSTRAP_PASSWORD="${ROOT_ADMIN_PASSWORD:-}" \
  STAFF_BOOTSTRAP_DISPLAY_NAME="${ROOT_ADMIN_DISPLAY_NAME:-Administrateur}" \
    node -r @swc-node/register src/modules/admin/staff-bootstrap.cli.ts
  code=$?
  set -e
  case "$code" in
    0) echo "Administrateur racine créé : ${ROOT_ADMIN_EMAIL}" ;;
    3) echo "Administrateur racine : un compte d'équipe existe déjà, rien à faire." ;;
    *) echo "ATTENTION : l'administrateur racine n'a PAS été créé (code $code) — voir le message ci-dessus." ;;
  esac
fi
