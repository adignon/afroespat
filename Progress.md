# Progress — DiasporyPlus

Dernière mise à jour : 2026-11-06 (commit « Audit complet », `870ba2e`).

Ce fichier suit l'**avancement réel** et le **plan de correction** issus de l'audit complet du 06/11/2026
(backend, frontend membre, administration, landing, infra). Il remplace `docs/PLAN.md` comme point d'entrée
pour savoir « où on en est ».

## Décisions du porteur prises pendant l'audit

- **Tout est gratuit pour le moment.** Aucun paiement réel (ni Stripe, ni Mobile Money) n'est implémenté.
- Les **moyens de paiement**, les **plans** et les **options payantes** sont activables/désactivables depuis
  l'administration (écran Revenus, SUPER_ADMIN). Tout est désactivé par défaut.
- Le **blog** attend une spécification : voir `docs/specs/16-blog.md` (décisions à trancher).

## État mesuré (après le commit `870ba2e`)

| Contrôle | Résultat |
|---|---|
| Typecheck (tous les paquets) | 0 erreur |
| Lint (tous les paquets) | 0 erreur |
| Tests unitaires | shared 446 · web 698 · api 266 · db 32 · ui 16 · worker 2 : verts |
| Garde-fous | `check-duplicate-spread-keys` et `generate-screens` verts ; `@app/shared` et `@app/config` encore rouges (voir ci-dessous) |
| Tests d'intégration et e2e | **Non lancés** (base de données requise) : à exécuter avant déploiement |

## Plan et étapes d'évolution

### Étape 0 — Faite (commit `870ba2e`)

- Backend : chaînes d'événements réparées (`connection.removed`, `pro.approved/rejected`, `scam_alert.published`,
  `post.commented`), outbox transactionnelle, 409 sur conflit d'unicité, verrous (RSVP, blocage, conversations DIRECT),
  compteurs de réputation, KYC (transitions d'état, horodatage signé), helper d'IP client, durcissement de la
  configuration de production.
- RGPD : suppression de compte (e-mail, médias), export complété, signets, référentiels, suggestions libres.
- Paiements : interrupteurs d'administration, champ `paiementsDisponibles` côté membre.
- Frontend : « Voir plus » sur 6 listes, ouverture fiable des conversations, pages d'erreur, session expirée, noindex
  des pages membres, SEO de la landing, confirmations et accessibilité de l'administration.
- Infra : Dockerfile, sauvegarde planifiée, healthchecks, CI. Documentation : `README.md`, `docs/PLAN.md`.
- Deux migrations : `20261106090000_paiement_plan_periode_fiche`, `20261106100000_export_rgpd_etats_generation`.

### Étape 1 — Avant tout déploiement (P0)

1. Lancer les **tests d'intégration et e2e** avec une base ; corriger ce qui casse.
2. Vérifier ce que le lot infra a réellement produit : `docker compose -f docker-compose.prod.yml build`, puis
   relire `infra/` (sauvegarde chiffrée hors serveur, restauration testée).
3. **Attention au déploiement :** la configuration de production refuse désormais certains réglages
   (`OTP_TEST_PHONES=*`, secrets de développement, origines `localhost`, limite de débit coupée). Un `prod.env`
   existant qui les utilise ne démarrera plus tant que `ALLOW_INSECURE_LAUNCH=true` n'est pas posé
   (à n'utiliser que de façon transitoire). `CAPTCHA_PROVIDER=off` et `AI_MODERATION_PROVIDER=off` restent
   acceptés avec avertissement.
4. Appliquer les 2 migrations (`infra/migrate.sh`) sur une copie de la base avant la production.
5. Publier les pages légales (CGU, confidentialité, cookies) depuis l'administration : contenu juridique à rédiger.
6. `git rm --cached .claude/scheduled_tasks.lock` (déjà dans `.gitignore`, mais encore suivi).

### Étape 2 — Fiabilité des données (P1)

- Recherche : abonner les villes (`city.*`), indexer les demandes d'aide modifiées/supprimées, route admin
  `/v1/admin/search/zero-results`, purge des tables zéro-résultat, suggestions sans auteurs bloqués.
- Notifications : résumé hebdomadaire (filtre des réseaux privés, pagination, adresse vérifiée), relance des envois
  restés en file, push avec reprise sur panne transitoire, exclusion des comptes désactivés.
- Entraide / connexions / temps réel : quotas atomiques, `acceptRequest` conditionnel, caches bornés.
- Quota d'offres sponsorisées sous verrou, capacité de mentorat atomique, dossiers de modération pour les textes de
  mentorat/recommandation/emploi, ouverture d'un dossier si la file de modération est absente.
- Fusion de villes : migrer tous les contenus ; changement de ville : réaffecter les réseaux.

### Étape 3 — Produit et ergonomie (P2)

- Pagination restante : réseaux, mes demandes/réponses, notifications, enregistrés, agenda, recherche, profils publics.
- Administration — **faite** (lot s3b) : confirmations sur tous les gestes destructeurs ou visibles des membres
  (dossier de modération, publication de page/annonce, proposition de guide, « maintenu par la communauté », durée
  d'étape, seuils de modération, en plus de celles de l'étape 0) ; garde de route par rôle alignée sur l'API
  (« Alertes d'équipe » : pas le support) ; fiche membre complète (compteurs `counts`, sanctions en cours/historique,
  « Lever le bannissement », SUPER_ADMIN) ; onglets pays/langues/compétences/métiers ; filtre de période du tableau de
  bord (`GET /admin/dashboard?period=current|7d|30d|90d`) ; journal d'audit déjà filtrable (acteur, action, cible,
  dates) et paginé ; piège du focus testé (`fenetre.test.tsx`) ; écran Revenus : tout éteint par défaut (formules
  payantes inactives au seed, encarts partenaires éteints), chaque bascule avec motif et confirmation.
- Landing : état d'erreur avec « Réessayer », accessibilité des superpositions, points de rupture CSS, photos de villes.
- Boutons encore inertes : « Découvrir Premium » (J11, E03), « Je suis bloqué·e » (J09), « Aider le suivant » (J01e).
- Garde-fou **mouvement** (`@app/config`) : trancher entre exemptions (spinners, marquee) et correction ; le contrôle
  lit aussi `.35s` comme `35s`.
- Garde-fou **enums** (`@app/shared`) : l'énumération `DataExportStatus` est régénérée (`GENERATING`, `FAILED`) ;
  il passera au vert une fois les fichiers générés commités.

### Étape 4 — Fonctionnalités différées (P3)

- Blog : spécifier (`docs/specs/16-blog.md`) puis implémenter (modèle, API publique, `/blog`, SEO, newsletter).
- Paiements réels : choisir l'agrégateur Mobile Money (D4), implémenter Stripe et Mobile Money, brancher l'écran
  d'abonnement (K06), facture PDF, avantages Premium, funnel Pro/Pro+ de bout en bout. Aligner les prix du code
  (25 € / 40 €) sur la spec (9 € / 19 €) ou l'inverse.

### Étape 5 — Dette continue (P4)

- Découper les plus gros services (`feed.service.ts` 4271 lignes, `communities`, `guides`, `journeys`, `moderation`).
- Couverture de tests mesurée, `pnpm audit`, supervision externe, rotation des logs.
- Rendre `API_LOG` disponible en CI pour les 4 tests e2e conditionnels.

## Limites connues de cet état

- Plusieurs chantiers ont été **interrompus** en cours de route (arrêt des agents) : les parties livrées sont
  vérifiées par typecheck, lint et tests unitaires, mais **pas par des tests d'intégration ou en navigateur**.
- Les écarts de nommage et décisions détaillées sont à consigner dans `docs/decisions.md` (non modifié pendant l'audit).
