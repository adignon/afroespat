# syntax=docker/dockerfile:1.7
#
# Images de production — api, worker, web, migrate (une cible par image).
#
#   docker build --target api    -t disaporyplus-api .
#   docker build --target worker -t disaporyplus-worker .
#   docker build --target migrate -t disaporyplus-migrate .
#   docker build --target web    -t disaporyplus-web \
#                --build-arg NEXT_PUBLIC_API_URL=https://api.exemple.fr/v1 \
#                --build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x… .
#
# ── CE QUI A ÉTÉ VÉRIFIÉ, ET CE QUI NE L'A PAS ÉTÉ ──────────────────────────
# Ce fichier a été écrit dans un environnement SANS Docker : aucune de ces images
# n'a été construite ici. Les commandes qu'il contient (installation gelée,
# `prisma generate`, builds `tsc`) sont celles du dépôt, lancées une à une ; mais la
# première construction réelle peut demander un ajustement (voir infra/README.md,
# « Première construction »).
#
# ── CHOIX ───────────────────────────────────────────────────────────────────
#   · multi-étapes : l'étape `build` porte les outils de compilation, les images
#     finales repartent d'une base propre et ne reçoivent que ce qu'elles lancent ;
#   · utilisateur non root (`node`) ;
#   · les secrets ne sont JAMAIS cuits dans une image : seules les variables
#     publiques `NEXT_PUBLIC_*` le sont, parce que Next les inline dans le JS du
#     navigateur au moment du build (elles sont publiques par nature) ;
#   · `NODE_ENV=production` à l'exécution : `loadEnv` refuse alors tout fournisseur
#     fictif (hors paiement) et ne charge aucun `.env`.

ARG NODE_VERSION=22

# ── Base : Node + pnpm (version épinglée par `packageManager`) ───────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Dépendances : seulement les manifestes, pour que le cache survive aux sources ─
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ── Build : client Prisma, paquets partagés, API, worker ─────────────────────
FROM deps AS build
COPY . .
RUN pnpm --filter @app/db generate \
 && pnpm --filter @app/shared build \
 && pnpm --filter @app/db build \
 && pnpm --filter @app/api build \
 && pnpm --filter @app/worker build

# ── Migrations : à lancer UNE fois par déploiement, avant api et worker ──────
FROM build AS migrate
ENV NODE_ENV=production
USER node
WORKDIR /app/packages/db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ── API ─────────────────────────────────────────────────────────────────────
FROM build AS api
ENV NODE_ENV=production APP_ROLE=api
USER node
WORKDIR /app/apps/api
EXPOSE 3001
# `/v1/ready` : base ET Redis (503 sinon).
HEALTHCHECK --interval=15s --timeout=4s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/v1/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# ── Worker : même code, processeurs de files actifs, pas de serveur HTTP ────
FROM build AS worker
ENV NODE_ENV=production APP_ROLE=worker
USER node
WORKDIR /app/apps/worker
# `@app/api` a pour entrée `src/index.ts` (TypeScript) : Node ne peut pas le charger
# depuis `dist/`. Comme en développement, le worker passe par @swc-node/register.
CMD ["node", "-r", "@swc-node/register", "src/main.ts"]

# ── Web : Next.js ───────────────────────────────────────────────────────────
FROM deps AS web-build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY} \
    NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm --filter @app/shared build && pnpm --filter @app/web build

FROM web-build AS web
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "-p", "3000"]
