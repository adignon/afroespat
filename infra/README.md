# Exploitation — images, sauvegarde, restauration, rotation des clés

Ce dossier tient ce qui n'est pas du code applicatif. Le runbook général (incidents,
astreinte) reste `docs/specs/T4-api-runbook-decisions.md` ; ici, les procédures
techniques que le code suppose.

## 1. Images (`Dockerfile` à la racine)

| cible | rôle | commande |
|---|---|---|
| `migrate` | `prisma migrate deploy`, une fois par déploiement, AVANT api et worker | `docker run --env-file prod.env disaporyplus-migrate` |
| `api` | HTTP, `APP_ROLE=api`, sonde `/v1/ready` (base **et** Redis) | `docker run -p 3001:3001 --env-file prod.env disaporyplus-api` |
| `worker` | files, tâches planifiées, relais de la boîte d'envoi, `APP_ROLE=worker` | `docker run --env-file prod.env disaporyplus-worker` |
| `web` | Next.js (`NEXT_PUBLIC_*` fixées **au build**) | `docker build --target web --build-arg NEXT_PUBLIC_API_URL=… .` |

Règles : **une seule** instance de `migrate` à la fois ; `api` et `worker` partagent
la même base et le même Redis ; aucun secret dans l'image (variables d'environnement
de l'orchestrateur ; modèle : `.env.example`) ; `NODE_ENV=production` fait refuser
tout fournisseur fictif — sauf le paiement, qui reste fictif tant que tout est gratuit.

Les services tiers à joindre en production : Postgres 16, Redis 7 (`appendonly yes`),
un stockage S3 **en région UE**, ClamAV (`clamd` sur `ANTIVIRUS_HOST:ANTIVIRUS_PORT`).

### Première construction

Les images n'ont pas été construites au moment de leur écriture (environnement sans
Docker). À la première construction, vérifier : (1) que `pnpm install --frozen-lockfile`
passe avec le cache de montage ; (2) que `apps/worker` démarre bien depuis `dist/main.js`
(il importe `@app/api`, dont `dist/` doit exister : l'étape `build` le produit) ;
(3) la taille — les images finales reprennent l'arbre de build complet, y compris les
dépendances de développement ; l'amincir (`pnpm deploy --prod`) est la première
optimisation, à faire une fois la construction validée.

## 2. Sauvegarde

Ce qui doit être sauvegardé, par ordre de gravité de la perte :

1. **Postgres** — tout l'état métier. Sauvegarde logique quotidienne + archivage WAL
   (RPO visé : 15 min).
2. **Les clés de chiffrement** (`PHONE_ENCRYPTION_KEY`, `CONTENT_ENCRYPTION_KEY`,
   `*_KEYS_PREVIOUS`, `PHONE_HMAC_KEY`) — **dans un coffre, séparément de la base**.
   Une sauvegarde de base sans ses clés est inutilisable : téléphones, adresses email,
   notes et messages sont illisibles. Perdre `PHONE_HMAC_KEY` rend en plus les numéros
   introuvables (empreintes) et invalide les codes en cours.
3. **Le stockage S3** — versionnement activé sur le seau + réplication vers un second
   seau de la même zone UE. Les octets servis par `/media/*` en dépendent.
4. **Redis** — *non critique* : files et compteurs. Perdre Redis perd les travaux en
   attente (le relais de la boîte d'envoi réémet les événements non consommés) et
   remet les limites de débit à zéro ; aucune donnée membre n'y vit.

### Postgres : sauvegarde logique

```sh
# format « custom » : compressé, restaurable table par table
pg_dump --format=custom --no-owner --file=app-$(date +%F).dump "$DATABASE_URL"
# contrôle : la liste doit se lire sans erreur
pg_restore --list app-$(date +%F).dump | head
```

Conservation conseillée : 7 quotidiennes, 4 hebdomadaires, 12 mensuelles — **chiffrées**
(`age` ou `gpg`) avant de quitter le serveur, stockées en région UE. Les journaux
d'audit (`audit_logs`) sont en ajout seul par déclencheur : la restauration les
reprend tels quels.

## 3. Restauration

À répéter **chaque trimestre sur une base vide** — une sauvegarde jamais restaurée est
une hypothèse.

1. Arrêter `api` et `worker` (sinon le relais réémet des événements pendant la reprise).
2. Créer une base vide et restaurer :
   ```sh
   createdb app_restore
   pg_restore --no-owner --dbname=app_restore --jobs=4 app-AAAA-MM-JJ.dump
   ```
3. Si la restauration est partielle ou plus ancienne que le code déployé, appliquer les
   migrations manquantes : `prisma migrate deploy` (additives et idempotentes).
4. Vérifier : `select count(*) from users;`, la dernière ligne de `domain_events`,
   et `select count(*) from audit_logs;` ; puis **`pnpm --filter @app/api rotate-keys --dry-run`**
   — il doit rapporter `illisibles 0` sur toutes les colonnes (preuve que les clés
   restaurées correspondent aux données).
5. Pointer `DATABASE_URL` sur la base restaurée, redémarrer `worker` puis `api`, contrôler
   `/v1/ready` (200, `database` et `redis` à `true`).
6. Redis repart vide : normal. Les sessions restent valides (jetons en base).
7. Média : si le seau est perdu, restaurer depuis la réplique ; les lignes `media_assets`
   survivent aux octets (`GET /media/*` rend 404 pour un octet absent, sans erreur).

Après une restauration datée : les codes OTP et les sessions créés après la sauvegarde
n'existent plus — les membres se reconnectent. Les emails/SMS partis depuis ne sont pas
rejoués (`outbound_messages` restauré les croit non envoyés : purger les `QUEUED`
postérieurs à l'incident avant de redémarrer le worker).

## 4. Rotation des clés de chiffrement

Le format scellé porte l'identifiant de la clé (`apps/api/src/common/crypto.service.ts`) ;
l'ancien format sans identifiant reste lisible. Procédure, **sans arrêt de service** :

1. Générer : `openssl rand -base64 32`.
2. Dans l'environnement : mettre la clé neuve dans `PHONE_ENCRYPTION_KEY` (ou
   `CONTENT_ENCRYPTION_KEY`) avec un identifiant **neuf** (`*_KEY_ID=2`), et déplacer
   l'ancienne dans `*_KEYS_PREVIOUS=1:<ancienne clé base64>` (l'ancienne porte
   l'identifiant qu'elle avait, `1` par défaut pour les données historiques).
3. Redémarrer `api` et `worker` : les écritures nouvelles utilisent la clé 2, les
   anciennes données restent lisibles.
4. Simuler : `pnpm --filter @app/api rotate-keys --dry-run`.
5. Réécrire : `pnpm --filter @app/api rotate-keys`. Idempotent, reprenable, lots de 200,
   mise à jour conditionnelle (une note modifiée pendant le script n'est pas écrasée).
6. Quand le rapport dit `réécrits 0` partout, **retirer** l'ancienne clé de
   `*_KEYS_PREVIOUS`. Garder la clé retirée dans le coffre aussi longtemps que des
   sauvegardes antérieures à la rotation doivent rester restaurables.

`PHONE_HMAC_KEY` ne se fait pas tourner de cette façon : c'est une empreinte
déterministe (unicité des numéros), pas un chiffrement. Y toucher oblige à recalculer
`phone_numbers.phone_hmac` pour chaque ligne en déchiffrant chaque numéro — opération
à planifier à part.

## 5. Journaux et supervision

- Journaux JSON sur stdout (`pino`), niveau `LOG_LEVEL`. Une ligne par requête (méthode,
  chemin **sans** chaîne de requête, statut, durée, `x-request-id`) ; jamais d'en-têtes ni
  de corps. Rétention 90 jours chez l'agrégateur (00 §8.4).
- `SENTRY_DSN` (facultatif) active le suivi d'erreurs ; absent, rien ne change. Les
  événements sont expurgés (cookies, en-têtes, corps, requête, utilisateur).
- Sondes : `GET /v1/health` (vivacité), `GET /v1/ready` (base + Redis, 503 sinon).
