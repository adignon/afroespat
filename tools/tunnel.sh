#!/usr/bin/env bash
# Ouvre le site de développement à distance via ngrok, Mac maintenu éveillé.
#
#   NGROK_EMAIL=moi@gmail.com tools/tunnel.sh      # accès limité à ce compte Google
#   NGROK_URL=xxx.ngrok-free.app …                 # + ton domaine statique ngrok
#
# Le navigateur n'appelle que le site (port 3000) ; Next relaie /v1 vers l'API
# (voir API_PROXY dans apps/web/next.config.mjs). L'API et Docker doivent tourner.
set -euo pipefail
cd "$(dirname "$0")/.."

WEB_PORT_TUNNEL="${WEB_PORT_TUNNEL:-3000}"
API_URL="${API_URL:-http://localhost:3001}"

if [[ -z "${NGROK_EMAIL:-}" && "${NGROK_PUBLIC:-}" != 1 ]]; then
  echo "NGROK_EMAIL manquant : sans lui, le site de dev serait ouvert à tout internet." >&2
  echo "Pose NGROK_EMAIL=ton@gmail.com (ou NGROK_PUBLIC=1 si c'est voulu)." >&2
  exit 1
fi

if ! curl -s -o /dev/null --max-time 3 "$API_URL/v1"; then
  echo "L'API ne répond pas sur $API_URL — lance-la d'abord (pnpm --filter api dev)." >&2
  exit 1
fi

# -i : pas de veille système ; -s : pas de veille sur secteur. L'écran peut s'éteindre.
caffeinate -is -w $$ &

(cd apps/web && API_PROXY="$API_URL" NEXT_PUBLIC_API_URL=/v1 \
  npx next dev -p "$WEB_PORT_TUNNEL") &
WEB_PID=$!
trap 'kill $WEB_PID 2>/dev/null' EXIT

args=(http "$WEB_PORT_TUNNEL")
[[ -n "${NGROK_URL:-}" ]] && args+=(--url "$NGROK_URL")
[[ -n "${NGROK_EMAIL:-}" ]] && args+=(--oauth google --oauth-allow-email "$NGROK_EMAIL")
ngrok "${args[@]}"
