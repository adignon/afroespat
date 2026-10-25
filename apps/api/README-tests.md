# Tests de l'API

## Unitaires
`cd apps/api && npx vitest run` (aucune base requise).

## Intégration (74 fichiers, 1185 cas, ~4 min 20 s)
Prérequis : Postgres et Redis démarrés, `@app/shared` et `@app/db` construits
(`cd packages/shared && npm run build` ; `cd packages/db && npx prisma generate && npm run build`).

Base fraîche (JAMAIS `migrate reset` sur autre chose que la base de l'agent) :

    cd packages/db
    DATABASE_URL=postgresql://app:app@localhost:5460/app_w4a npx prisma migrate deploy
    DATABASE_URL=... npm run seed

Lancement, d'un seul tenant :

    cd apps/api
    DATABASE_URL=postgresql://app:app@localhost:5460/app_w4a \
    REDIS_URL=redis://localhost:6379/4 RATE_LIMIT_ENABLED=false \
    npx vitest run --config vitest.int.config.ts [dossier ou fichier]

* Variables : `DATABASE_URL`, `REDIS_URL` (un numéro de base Redis par agent), `RATE_LIMIT_ENABLED=false`.
* Parallélisme : AUCUN, par construction (`fileParallelism: false`, un fork isolé par fichier) :
  la base et Redis sont partagés. Ne pas lancer deux suites sur la même base en même temps.
* Ordre : indifférent. Aucune ligne `system_settings` posée à la main n'est requise
  (en particulier pas `community_city_threshold`).

## Règles d'isolation
* Le seed fournit les RÉFÉRENTIELS (pays, villes inactives, métiers, modèles de parcours) ; il ne fournit
  ni membre, ni ville active, ni réseau. Une épreuve crée ses membres, réseaux, événements...
* Besoin d'une ville active : `villeActiveDeTest(prisma)` (`src/common/__tests__/villes-de-test.ts`),
  ou créer la sienne (voir `analytics.int.test.ts`) quand on compte ses membres.
* Une épreuve qui lit un réglage (`system_settings`) le pose et le rétablit elle-même (`admin.int.test.ts`).
* Les épreuves qui rejouent des tâches à des dates futures (`scheduled-idempotence`, `analytics`) retirent en
  fin de fichier les `metric_snapshots` et `impact_report_snapshots` datés du futur.
