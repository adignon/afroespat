# Exploitation — images, sauvegarde, restauration, rotation des clés

Ce dossier tient ce qui n'est pas du code applicatif. Le runbook général (incidents,
astreinte) reste `docs/specs/T4-api-runbook-decisions.md` ; ici, les procédures
techniques que le code suppose.

## 0. Fichier d'environnement : `prod.env`

UN seul nom, partout (`docker-compose.prod.yml`, `infra/*.sh`, ce document) : **`prod.env`**, à la racine du dépôt
sur le serveur. Il est hors git (`.gitignore`) ; si votre copie locale s'appelle `.env.prod`, envoyez-la sous le nom
`prod.env`. Modèle : `.env.example`. Variables propres au compose de production :

| variable | rôle |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe de Postgres (obligatoire) |
| `REDIS_PASSWORD` | mot de passe Redis (obligatoire, hexadécimal : `openssl rand -hex 24`) ; le compose en déduit `REDIS_URL` pour api et worker, ne la posez pas à la main |
| `NEXT_PUBLIC_API_URL` | URL publique de l'API, figée au build du web |
| `BACKUP_AGE_RECIPIENT` | clé **publique** age pour chiffrer les sauvegardes (obligatoire, voir §2) |
| `KEEP_DAILY`, `KEEP_WEEKLY`, `KEEP_MONTHLY`, `BACKUP_HOUR`, `BACKUP_S3_*` | rétention, heure (UTC) et copie distante des sauvegardes |
| `ALLOW_INSECURE_LAUNCH`, `TRUST_PROXY_HOPS`, `OUTBOX_MAX_PENDING_AGE_SECONDS` | voir `.env.example` |

**Garde-fous au démarrage** (`apps/api/src/config/env.ts`, `NODE_ENV=production`) : l'API et le worker REFUSENT de démarrer
si `OTP_TEST_PHONES` contient `*` ou si `SMS_PROVIDER=testers` garde le code fixe `123456` (sauf
`ALLOW_INSECURE_LAUNCH=true`, choix explicite et journalisé) ; si `RATE_LIMIT_ENABLED=false` ; si `WEB_ORIGIN`, `ADMIN_ORIGIN`
ou `S3_ENDPOINT` pointent vers localhost ; si une `*_BASE_URL` est surchargée ; si un secret contient `dev-` ou
`change-me` ou vaut celui de `.env.example`. En production `ADMIN_ORIGIN` = `WEB_ORIGIN` (le front équipe est servi par le
même site). `CAPTCHA_PROVIDER=off` et `AI_MODERATION_PROVIDER=off` restent acceptés (usage volontaire) mais un avertissement
part au journal à chaque démarrage. `ROOT_ADMIN_PASSWORD` ne sert qu'à créer le premier administrateur : retirez-le de `prod.env`
ensuite.

**Adresse IP des clients** : Caddy est le seul relais devant l'API ; `TRUST_PROXY_HOPS=1` (défaut) fait déduire `req.ip` de
`X-Forwarded-For` en retirant un relais par la droite. Ne le changez que si la chaîne de relais change (ex. Cloudflare devant
Caddy : 2).

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

### Fournisseurs de démonstration (`pnpm demo:providers`)

Tant qu'aucun compte fournisseur n'existe, `apps/provider-demo` émule Twilio, Brevo, Didit, Turnstile,
S3, ClamAV, Web Push et Anthropic (mêmes routes, authentifications et erreurs) avec des clés de test :
`pnpm demo:providers`, puis l'API avec `PROVIDER_MODE=demo` (voir `.env.demo.example`). Les SMS et
e-mails « envoyés » se lisent sur `http://localhost:3077/__demo/inbox`. En production : retirer
`PROVIDER_MODE`, poser les vraies clés et supprimer les `*_BASE_URL` — aucun changement de code ;
`PROVIDER_MODE=demo` est refusé si `NODE_ENV=production`. Détail, liste des routes et limites de fidélité :
`docs/provider-demo.md`.

### Première construction

Les images n'ont pas été construites au moment de leur écriture (environnement sans
Docker) ; le job CI `docker` les construit désormais à chaque modification (étapes `api`, `worker`, `migrate`, `web`).
Chaque `package.json` de workspace doit être copié dans l'étape `deps` (garde-fou : `tools/__tests__/dockerfile-workspaces.test.mjs`). À la première construction, vérifier : (1) que `pnpm install --frozen-lockfile`
passe avec le cache de montage ; (2) que `apps/worker` démarre bien depuis `dist/main.js`
(il importe `@app/api`, dont `dist/` doit exister : l'étape `build` le produit) ;
(3) la taille — les images finales reprennent l'arbre de build complet, y compris les
dépendances de développement ; l'amincir (`pnpm deploy --prod`) est la première
optimisation, à faire une fois la construction validée.

**Pourquoi les images finales ne sont PAS amincies** (décision laissée telle quelle) : le worker et la commande `migrate` lancent du
TypeScript via `@swc-node/register` (`@app/api` a pour entrée `src/index.ts`) et `prisma migrate deploy` — des dépendances de
développement. Un `pnpm deploy --prod` ou un étage runtime sans elles casserait leur démarrage, et personne n'a pu le vérifier ici
(démon Docker indisponible). À tenter seulement avec une construction réelle sous la main : séparer l'image `web` (Next `standalone`)
est le gain le plus sûr et le plus gros.

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

### Sauvegarde planifiée (service `backup` du compose)

Le service `backup` (`infra/backup.Dockerfile`, `infra/backup-cron.sh`) lance `infra/backup-db.sh` chaque nuit à `BACKUP_HOUR`
(UTC, 03:00 par défaut), plus une fois au démarrage si la dernière réussite a plus de 24 h. Chaque exécution : `pg_dump`
au format custom, relecture (`pg_restore --list`) **avant** chiffrement, chiffrement par **age** avec la clé publique
`BACKUP_AGE_RECIPIENT`, rotation (7 quotidiennes, 4 du dimanche, 12 du 1er du mois — `KEEP_*`), copie facultative vers un
seau S3 **distinct** (`BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, identifiants
propres, jamais ceux des médias ; règle de cycle de vie du seau pour la rétention distante). Les archives sont dans
`./backups` sur l'hôte (`diasporyplus-AAAAMMJJ-HHMMSS.dump.age`). La sonde de santé du service passe au rouge si rien n'a réussi en
26 h (`docker compose ps`). À la main, hors compose : `bash infra/backup-db.sh` depuis le dépôt (même script, mode hôte).

Mise en place, une fois :
1. Sur VOTRE poste (pas sur le serveur) : `age-keygen -o diasporyplus-backup.key` ; la ligne `# public key: age1…` va dans
   `prod.env` (`BACKUP_AGE_RECIPIENT=age1…`). **La clé privée `diasporyplus-backup.key` va dans le coffre**, jamais sur le serveur.
2. `docker compose --env-file prod.env -f docker-compose.prod.yml up -d --build backup`.

**Sauvegarde des clés de chiffrement** (procédure, aucune valeur dans le dépôt) : à chaque création ou rotation de
`PHONE_ENCRYPTION_KEY`, `CONTENT_ENCRYPTION_KEY`, `*_KEYS_PREVIOUS`, `PHONE_HMAC_KEY` : (1) les copier depuis `prod.env` vers le coffre
(gestionnaire de mots de passe d'équipe, entrée « DiasporyPlus — clés de chiffrement », au moins deux détenteurs) ; (2) y joindre la
clé privée age ; (3) dater l'entrée et conserver les clés retirées aussi longtemps qu'une sauvegarde antérieure à leur
retrait doit rester restaurable ; (4) vérifier chaque trimestre, lors du test de restauration, que le coffre contient bien les
bonnes clés (`rotate-keys --dry-run` : « illisibles 0 »). Une sauvegarde de base ne se restaure utilement qu'avec ses clés.

### Postgres : sauvegarde logique manuelle

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

Scripts : `infra/restore-db.sh <archive> [base_cible]` (vers une base **à part**, refuse la base de production et une cible
existante ; archive `.age` : `BACKUP_AGE_IDENTITY=/chemin/diasporyplus-backup.key`).

### Test de restauration trimestriel (sans toucher à la production)

```sh
# 1. récupérer la dernière archive (copie S3 ou ./backups) et la clé privée age depuis le coffre
BACKUP_AGE_IDENTITY=~/diasporyplus-backup.key bash infra/restore-db.sh backups/diasporyplus-AAAAMMJJ-HHMMSS.dump.age app_restore_test
# 2. le script affiche users / dernier événement / audit_logs : comparer avec la production
# 3. lecture des colonnes chiffrées avec les clés du coffre (DATABASE_URL pointé sur app_restore_test) :
DATABASE_URL=postgresql://app:…@localhost:5432/app_restore_test pnpm --filter @app/api rotate-keys --dry-run   # « illisibles 0 »
# 4. nettoyer : docker compose --env-file prod.env -f docker-compose.prod.yml exec postgres psql -U app -d postgres -c 'drop database app_restore_test'
```

Noter la date, la durée et le résultat dans le registre d'exploitation. Une étape en échec = la sauvegarde ne vaut rien : corriger
avant la suivante.

### Reprise après sinistre

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
- Sondes : `GET /v1/health` (vivacité), `GET /v1/ready` (base + Redis + âge du plus ancien événement non publié de la boîte
  d'envoi, 503 sinon ; seuil `OUTBOX_MAX_PENDING_AGE_SECONDS`, 300 par défaut, 0 = désactivé ; la réponse porte
  `outbox.oldestPendingSeconds`). Healthchecks du compose : api (`/v1/ready`), worker (processus), web, caddy, backup.
- Journaux Docker : rotation `json-file` 10 Mo × 5 par conteneur (`x-logging` du compose).
