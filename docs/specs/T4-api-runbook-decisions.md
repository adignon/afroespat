# Conventions d'API

> Complète `00-fondations.md` §5. À lire avant d'écrire une route.

---

## 1. Forme

- Base `/v1` (membres) et `/v1/admin` (équipe). Une version majeure à la fois ; dépréciation annoncée 90 jours par en-tête `Deprecation` et `Sunset`.
- Ressources au pluriel, `kebab-case`, identifiants UUID v7 dans le chemin. Les profils publics sont adressés par `handle`, les villes et guides par `slug`.
- Verbes : `GET` lecture, `POST` création ou action (`/journeys/:id/migrate`), `PATCH` modification partielle, `PUT` remplacement d'une sous-ressource entière (checklist, réaction, RSVP), `DELETE`.
- Corps et réponses en JSON `camelCase`. Dates en ISO 8601 UTC. Montants `{ amountCents, currency }`.
- Réponse de création : `201` avec la ressource. Action sans retour : `204`. Liste : `{ items, nextCursor }`.

## 2. Authentification

- `Authorization: Bearer <accessToken>` (JWT, 15 min) portant `sub`, `level`, `plan`, `status`, `sid` (session). Le jeton de rafraîchissement est un cookie `HttpOnly` `Secure` `SameSite=Strict` sur `/v1/auth/refresh`.
- `level_refresh_required` → `401` `code: TOKEN_STALE` → le client rafraîchit et rejoue.
- Compte suspendu : `403` `ACCOUNT_SUSPENDED` sur toute écriture, lecture autorisée.
- Équipe : cookie de session distinct, jamais de JWT membre.

## 3. Erreurs

Objet `error { code, message, details }`. `code` stable, `message` en français affichable, `details` typé par code. Les codes transverses sont dans `00` §5.2 ; chaque module documente les siens. Validation : `400 VALIDATION_FAILED` avec `details.fields: [{ path, code }]`.

**Ne jamais** révéler l'existence d'un compte, d'un numéro ou d'un contenu bloqué : `404` plutôt que `403` quand la ressource ne doit pas être connue du demandeur.

## 4. Pagination, tri, filtres

- Curseur opaque signé, `limit` ≤ 50, tri par défaut documenté par route (en général `createdAt desc`).
- Filtres en query string, mêmes noms que les champs (`cityId`, `type`, `status`). Tableaux : `type=A&type=B`.
- Les réponses de liste incluent `meta` facultatif : compteurs (`{ open: 41, resolved: 178 }`), bandeau (`safetyBanner`), règle affichée.

## 5. Idempotence et limites

- `Idempotency-Key` sur `POST` de création sensible ; rejouer renvoie la même réponse (200/201) pendant 24 h.
- Limites de débit par route documentées ; dépassement `429` avec `Retry-After`.

## 6. Sérialisation des membres

Un membre est toujours renvoyé sous la même forme `UserSummary` : `{ id, handle, displayName, avatarUrl, level, phase, cityName, countryIso2, isMentor }`. Jamais de téléphone, email, dates de naissance, compteurs de contacts. Un membre bloqué ou désactivé est remplacé par `{ id, displayName: "Membre indisponible" }` sans handle.

## 7. Temps réel

WebSocket authentifié par le jeton d'accès à la connexion ; reconnexion avec rafraîchissement. Événements : `notification.new`, `message.new`, `message.read`, `conversation.updated`. Aucune donnée non demandée : le client s'abonne à ses conversations ouvertes.

## 8. Webhooks entrants

`/webhooks/didit`, `/webhooks/stripe`, `/webhooks/mobile-money` : signature vérifiée, corps brut journalisé 30 jours (sans PII), traitement idempotent par identifiant fournisseur, réponse `200` rapide et traitement en file.

## 9. Documentation

OpenAPI 3.1 générée depuis les schémas partagés ; chaque route porte `summary`, `x-capability`, `x-rate-limit`, ses codes d'erreur. Le client front est généré à chaque build ; une route sans schéma fait échouer la CI.

---
---

# Runbook

> Exploitation en production. Court, à jour, testé.

## 1. Environnements et accès

| Environnement | URL | Accès |
|---|---|---|
| Production | afroexpates.com · api.afroexpates.com · admin.afroexpates.com | Fournisseur UE ; accès infrastructure par clé SSH nominative + MFA ; liste dans le coffre |
| Staging | staging.afroexpates.com | Idem, données synthétiques |

Secrets dans un gestionnaire (pas dans le dépôt, pas dans les images). Rotation : jetons et clés de chiffrement des contenus tous les 12 mois ; clés de chiffrement des téléphones jamais (changement = réchiffrement complet, procédure §7).

## 2. Déploiement

- Branche `main` → déploiement automatique en staging après CI verte. Production : déploiement manuel depuis un tag, par une personne autorisée, en dehors des heures de pointe (avant 10 h ou après 22 h Europe/Paris).
- Migrations de base : exécutées **avant** le déploiement de l'API, toujours rétrocompatibles avec la version précédente (ajout de colonne nullable, jamais de suppression dans la même version). Suppression de colonne = deux versions.
- Retour arrière : redéploiement du tag précédent ; les migrations ne sont pas annulées (compatibles par construction).
- Feature flags pour tout lancement de section : activer par ville, observer, élargir.

## 3. Sauvegardes

- PostgreSQL : sauvegarde complète quotidienne + journaux de transactions continus (récupération à un instant donné sur 30 jours). Conservation 90 jours. Chiffrées, en UE, sur un compte de stockage distinct.
- Fichiers S3 : versionnement activé, réplication vers un second bucket UE.
- **Test de restauration mensuel** en staging, tracé (date, durée, résultat) dans `docs/restores.md`.

## 4. Supervision

- Sentry : erreurs front et API, alerte si taux d'erreur > 2 % sur 5 min.
- Métriques : latence p95 par route, files BullMQ (taille, âge du plus ancien job), taux d'échec des envois (SMS, email, push), délai d'indexation, dossiers de modération priorité 1 au-delà du SLA.
- Alertes vers un canal d'astreinte : API indisponible, base à 85 % de disque, file `events` > 10 000 ou job > 10 min, webhook Didit ou Stripe en échec répété, SLA modération dépassé, échec de sauvegarde.
- Journaux JSON centralisés, 90 jours, sans PII (numéros et emails masqués à l'écriture).

## 5. Incidents

| Situation | Action |
|---|---|
| API en panne | Page de maintenance (flag `maintenance`), diagnostic, redéploiement du tag précédent si lié à une livraison |
| Fuite ou soupçon de fuite de données | Isoler, révoquer les secrets concernés, préserver les journaux, évaluer le périmètre, notifier la CNIL sous 72 h si requis, informer les membres concernés |
| Vague d'arnaques | Activer une alerte arnaque ciblée, abaisser `housing.risk_queue_threshold`, renforcer la modération, couper temporairement la publication de logement par flag si nécessaire |
| Fournisseur SMS indisponible | Basculer sur le fournisseur secondaire (interface `SmsProvider`) ; communiquer sur la page de connexion |
| Compte équipe compromis | Révoquer les sessions, réinitialiser TOTP, auditer les actions des dernières 72 h |

Post-mortem écrit sous 5 jours pour tout incident de niveau 1, sans recherche de coupable.

## 6. Tâches récurrentes de l'équipe

| Fréquence | Tâche |
|---|---|
| Quotidienne | File de modération vidée (SLA), justificatifs pro traités |
| Hebdomadaire | Villes à activer, top des recherches sans résultat, propositions de correction de modèles |
| Mensuelle | Test de restauration, revue des accès, revue des flags actifs, factures fournisseurs |
| Trimestrielle | Rapport d'impact, revue des paramètres système, rotation des secrets échus, revue de la politique de confidentialité |

## 7. Procédures spéciales

- **Réchiffrement des téléphones** : script en deux passes (nouvelle colonne, migration par lots de 1 000, bascule, suppression de l'ancienne), en heures creuses, avec sauvegarde préalable.
- **Réindexation complète de la recherche** : par type, en file, sans interruption (l'index est reconstruit à côté puis basculé).
- **Activation d'un nouveau pays d'origine** : back-office → vérifier l'indicatif SMS avec le fournisseur → activer → créer la version de modèle déclinée si besoin → annonce ciblée.

---
---

# Journal des décisions

> Amorcé avec les décisions prises pendant la conception. L'IA qui construit ajoute ses hypothèses au même format. Une ligne par décision ; on ne réécrit pas l'historique, on ajoute une décision qui remplace.

| Date | Décision | Motif | Remplace |
|---|---|---|---|
| 2026-09 | Le parcours est gratuit ; un seul actif en gratuit | C'est l'entrée de funnel et le déclencheur de l'affiliation ; le pré-départ n'a pas de moyen de paiement européen | Idée initiale : projet payant |
| 2026-09 | Niveaux L0 téléphone, L1 KYC Didit, L2 numéro français, cumulatifs | Un pré-départ doit créer son parcours ; un numéro français prouve la présence, pas l'identité | L1 = tél. FR, L2 = KYC |
| 2026-09 | Pas de co-porteur en V1 | Rare, conflits d'édition ; observateur + accompagnant suffisent | — |
| 2026-09 | Pas de table `milestones` | Un jalon est une publication Victoire liée à une étape ; la table dupliquait trois autres | Modèle initial |
| 2026-09 | Bandeau de jalons persistant, pas de stories | Ce qui doit durer ne doit pas expirer ; risque de pression sociale | Stories proposées par un générateur |
| 2026-09 | Le mot « certifié » est banni de l'interface | La plateforme ne vérifie aucun dossier ; exposition juridique | — |
| 2026-09 | Aucun rouge, aucun état d'échec sur les étapes | Parcours migratoire : une étape se met en pause | — |
| 2026-09 | Aucun email pour l'activité sociale | Délivrabilité et désabonnement | — |
| 2026-09 | Entraide, guides, parrainage, réseaux jamais payants ; pas de publicité display | Mission ; volume insuffisant | — |
| 2026-09 | Recherche en PostgreSQL full-text, pas de moteur dédié | Volume V1 < 100 k documents ; une brique de moins ; interface abstraite pour migrer | — |
| 2026-09 | Pas de PostGIS, pas de géocodage, maille = ville | Aucune position individuelle collectée | — |
| 2026-09 | Messages chiffrés au repos, pas de bout en bout | La modération doit pouvoir lire un signalement | — |
| 2026-09 | KYC externalisé (Didit), aucune pièce stockée | RGPD, surface d'attaque | — |
| 2026-09 | Guides : anonymisés à la suppression du compte, pas supprimés | Mémoire collective ; conforme si non réidentifiable | — |
| 2026-09 | Réseaux d'intérêt : 5 invités à la création, seuil de 50 membres par ville, archivage à 60 jours | Un réseau vide décourage plus qu'il n'attire | — |
| 2026-09 | Parrainage : 90 jours, 2 filleuls, L2 requis, demande dès L0 | Protéger les parrains de la saturation ; créer le lien avant l'avion | — |
| 2026-09 | Modération IA : masquage des PII avant envoi, jamais de sanction automatique | RGPD, décision humaine | — |
| 2026-09 | Mobile Money par périodes, sans récurrence | Pas d'abonnement récurrent natif chez les agrégateurs UEMOA | — |
| 2026-09 | Essai Premium à la première étape franchie, pas à l'inscription | Le membre doit avoir vu la valeur | — |
| 2026-09 | Nom `afroexpates.com` retenu par le porteur ; réserve sur l'orthographe consignée | « expates » n'est pas un mot ; coût d'un changement après dépôt | — |
| 2026-09 | Lancement mono-pays, mono-ville ; architecture multi-pays dès le départ | Une carte vide partout tue la confiance | — |
| 2026-09 | Agrégateur Mobile Money non désigné | À choisir par le porteur (FedaPay, KKiaPay, PayDunya) | — |
| 2026-09 | ORM non désigné | Le modèle relationnel est indépendant ; choix à l'implémentation | Prisma évoqué |
| 2026-09 | Parcours publics en V1 : `visibility` PRIVATE · SHARED · PUBLIC ; `similar_visible` supprimé ; « public anonymisé » abandonné | Un seul mécanisme ; public = progression seule, membres connectés, jamais en pause, jamais indexé | Parcours similaires opt-in + public anonymisé v2 |
| 2026-09 | Panneau Agenda = calendrier vertical ; page = événements du jour, participations en tête | Lecture plus naturelle qu'une liste | Près de chez moi / Mes participations / Mes organisations en panneau |
| 2026-09 | Panneau Accueil conservé avec Fil d'entraide, Parrainage et Événements en plus des icônes du rail | Deux portes vers la même page | — |
| 2026-09 | Compteurs : nouveautés depuis la dernière visite dans Accueil, totaux dans les panneaux de section | Éviter deux chiffres différents pour la même entrée | — |
| 2026-09 | Libellé « Parrainage », pas « Parrainage d'accueil » | Le parrainage commence avant le départ | — |
| 2026-09 | Stories 24 h en trois types (conseil, découverte, information), deux votes par type avec compteurs affichés, classement selon le type | Le format story se justifie pour du contenu périssable ; le type impose l'utilité | Bandeau de jalons ; « En direct » ; type de publication Conseil |
| 2026-09 | Signet transverse « Enregistrer », privé, avec état du contenu | C'est le membre qui décide ce qui vaut la peine d'être gardé, pas un seuil | Garde automatique à 3 confirmations |
| 2026-09 | Aucun compteur de vues sur aucun contenu | Une réussite n'est pas une performance ; pas de pression sociale | — |
| 2026-09 | Création de story en trois étapes façon statut WhatsApp | Familiarité ; le texte est la story | Formulaire en une page |
