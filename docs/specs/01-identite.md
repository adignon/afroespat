# 01 — Identité et compte

> Dépend de : `00-fondations.md` (§6 modèle, §7 autorisations, §8 sécurité). Tables : `users`, `phone_numbers`, `otp_challenges`, `auth_sessions`, `kyc_verifications`, `user_profiles`, `user_languages`, `user_skills`, `user_stats`, `consents`, `account_deletion_requests`, `data_exports`.

---

## 1. Périmètre

Inscription et connexion par téléphone (OTP), sessions, vérification d'identité (Didit), calcul des niveaux L0/L1/L2, profil, onboarding, phase, réputation (lecture), désactivation, suppression, export RGPD.

Hors périmètre : mots de passe pour les membres (il n'y en a pas), connexion sociale (pas en V1).

---

## 2. Règles métier

### 2.1 Inscription et connexion

| Règle | Détail |
|---|---|
| Identifiant unique | Le numéro de téléphone. Un numéro = un compte. Un compte peut avoir plusieurs numéros (origine + destination) |
| Pays autorisés | Indicatifs des `countries` actifs (ORIGIN, DESTINATION ou BOTH). Tout autre indicatif est refusé avant l'envoi du SMS, avec le message « Nous n'ouvrons pas encore dans ce pays » |
| OTP | 6 chiffres, valable 10 minutes, 5 tentatives, puis nouveau défi obligatoire. 3 envois maximum par numéro et par heure, 10 par IP et par heure |
| Captcha | Turnstile obligatoire avant tout envoi d'OTP |
| Session | Jeton d'accès court (15 min) + jeton de rafraîchissement long (30 jours, rotation à chaque usage, révocation de la chaîne en cas de réutilisation) |
| Appareils | Un membre voit ses sessions actives et peut en révoquer une ou toutes |
| **[RÈGLE DURE]** | Le numéro n'est jamais renvoyé par l'API en clair après sa saisie ; seul un masque (`+229 •• •• •• 42`) est exposé, et seulement à son propriétaire |

### 2.2 Phase

| Phase | Attribution | Passage |
|---|---|---|
| `PRE_DEPARTURE` | Choisie à l'onboarding | → `RECENT_ARRIVAL` quand le membre déclare son arrivée (bouton « Je suis arrivé » ou étape « Arrivée » franchie dans un parcours) |
| `RECENT_ARRIVAL` | Choisie à l'onboarding ou déclarée | → `SETTLED` automatiquement 6 mois après `arrival_date` (tâche `user.phase_progression`) |
| `SETTLED` | Choisie à l'onboarding ou automatique | Terminal. Modifiable manuellement dans le profil |

Le membre peut corriger sa phase manuellement à tout moment ; l'automatisme n'écrase jamais une correction manuelle faite après lui.

### 2.3 Vérification d'identité (Didit)

- Déclenchée par le membre depuis « Compte → Vérification », ou proposée contextuellement quand une capacité L1 est refusée.
- Le serveur crée une session Didit avec le workflow configuré, renvoie l'URL de vérification, le membre la suit (page hébergée par Didit). Le résultat arrive par **webhook signé** ; le client peut aussi interroger l'état.
- Statuts conservés : ceux de `kyc_verifications.status`. `is_adult` est le seul attribut dérivé conservé. **Aucune autre donnée du webhook n'est stockée** (pas de nom, pas de date de naissance, pas de document).
- Un membre mineur (`is_adult = false`) : compte **désactivé** avec message explicite. La plateforme est réservée aux majeurs.
- Nouvelle tentative possible après `DECLINED` (délai 24 h, 3 tentatives maximum sur 30 jours) ou `EXPIRED`.
- `IN_REVIEW` : le membre est informé que la vérification est en cours, sans délai promis.

### 2.4 Niveaux

Calcul et effets : voir `00-fondations.md` §7.2. Événements déclencheurs : `kyc.status_changed`, `phone.added`, `phone.removed`. À chaque recalcul : mise à jour de `users.verification_level`, `auth_sessions.level_refresh_required = true` sur toutes les sessions actives, événement `user.level_changed`.

### 2.5 Ajout du numéro de destination (passage L2)

- Uniquement depuis un compte L1.
- Même flux OTP, `purpose = ADD_PHONE`. Le numéro doit avoir l'indicatif d'un pays `DESTINATION` ou `BOTH` actif.
- Un numéro déjà lié à un autre compte est refusé (`PHONE_ALREADY_USED`) sans révéler à quel compte.
- Le membre peut retirer un numéro s'il en garde au moins un. Retirer le numéro de destination fait retomber à L1.

### 2.6 Handle

- 3 à 30 caractères, `[a-z0-9_-]`, ne commence pas par un chiffre, pas de séparateurs consécutifs, insensible à la casse.
- Généré à l'onboarding depuis `display_name` (translittéré, suffixe numérique si pris). Modifiable 1 fois par 30 jours.
- Mots réservés : `admin`, `support`, `afroexpates`, `aide`, `moderation`, noms des sections et toute chaîne listée dans `system_settings.reserved_handles`.
- Un handle libéré n'est réutilisable qu'après 90 jours.

### 2.7 Profil

Champs éditables : `display_name`, avatar, `bio`, `occupation_status`, `available_to_help` + `help_types`, langues, compétences, ville, dates, `is_public`. Le pays d'origine est modifiable **une fois** (correction), puis figé — il pilote les réseaux automatiques et les modèles de parcours.

Profil vu par un autre membre : handle, display_name, avatar, phase, ville, pays (drapeau), statut, langues, compétences, disponibilité, badge de niveau, compteurs de réputation, ancienneté, réseaux communs, contacts communs. **Jamais** : téléphone, email, dates de naissance, notes, parcours privés.

### 2.8 Désactivation et suppression

Voir le document de projet §8.9. Précisions :

- **Désactivation** : `users.status = DEACTIVATED`, sessions révoquées, contenus conservés mais l'auteur apparaît comme « Membre désactivé », parrainages actifs interrompus avec notification au filleul. Réactivation par simple connexion OTP dans les 6 mois ; au-delà, suppression automatique.
- **Suppression** : `status = DELETION_PENDING`, ligne `account_deletion_requests`, confirmation par OTP `purpose = DELETE_ACCOUNT`, sessions révoquées immédiatement. Pendant 7 jours, une connexion OTP annule la demande. Puis la tâche `account.deletion_execute` appelle tous les gestionnaires de suppression des modules dans une transaction, puis `status = DELETED`, `handle` remplacé par `deleted_<uuid court>`, `display_name = "Membre supprimé"`, tout le reste vidé. La ligne `users` reste (clé étrangère des contenus anonymisés) sans aucune donnée personnelle.
- **Export** : demande depuis les paramètres, génération asynchrone d'une archive (JSON par module + PDF du ou des parcours), lien valable 7 jours, une demande par 30 jours.

### 2.9 Enregistrés (signets)

Une action « Enregistrer » sur tout contenu (`bookmarks`, table transverse) et un écran unique Compte → Enregistrés : liste chronologique, chips par type, et pour chaque ligne **l'état actuel du contenu** — story « expirée, gardée pour vous », demande « résolue », événement « passé », annonce « plus disponible », guide « mis à jour le … », contenu « retiré » si supprimé par l'auteur ou la modération. Privé : aucun compteur d'enregistrements nulle part. Limite 500. Raccourci : après « Utile » sur une story, un guide ou une réponse, invitation en une ligne. Routes : `GET /me/bookmarks?type&cursor`, `PUT /me/bookmarks` (`subjectType`, `subjectId`), `DELETE /me/bookmarks/:type/:id`, `GET /me/bookmarks/states` (états en lot). Notifications de suivi : catégorie `BOOKMARK` (module 12).

### 2.10 Consentements

Enregistrés à l'onboarding (`TERMS`, `PRIVACY`), à l'activation du partage de parcours (`JOURNEY_VISIBILITY`), à l'opt-in email marketing. Une nouvelle version des CGU redemande le consentement à la prochaine connexion, sans bloquer la lecture.

---

## 3. Données — compléments au modèle

Aucune table nouvelle. Précisions :

| Table | Précision |
|---|---|
| `users.origin_country_locked_at` | **Colonne ajoutée** : date du premier changement de pays ; non nul = figé |
| `users.handle_changed_at` | **Colonne ajoutée** : pour la limite d'un changement par 30 jours |
| `users.phase_set_manually_at` | **Colonne ajoutée** : l'automatisme ne s'applique pas si postérieur à `arrival_date` |
| `otp_challenges.purpose` | `SIGNUP`, `LOGIN`, `ADD_PHONE`, `DELETE_ACCOUNT`, `REACTIVATE` |
| `kyc_verifications` | Une ligne par session Didit ; la dernière fait foi |

---

## 4. API

Préfixe `/v1`. Toutes les routes sauf `auth/*` exigent un jeton.

### 4.1 Authentification

| Méthode | Route | Corps | Réponse | Erreurs |
|---|---|---|---|---|
| POST | `/auth/otp/request` | `phone`, `countryIso2`, `captchaToken`, `purpose` | `challengeId`, `expiresAt` | `COUNTRY_NOT_SUPPORTED`, `RATE_LIMITED`, `CAPTCHA_FAILED` |
| POST | `/auth/otp/verify` | `challengeId`, `code` | `accessToken`, `refreshToken`, `isNewUser`, `user` | `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED` |
| POST | `/auth/refresh` | cookie | `accessToken`, nouveau cookie | `SESSION_REVOKED` |
| POST | `/auth/logout` | — | 204 | — |
| GET | `/auth/sessions` | — | liste des sessions actives | — |
| DELETE | `/auth/sessions/:id` | — | 204 | — |
| DELETE | `/auth/sessions` | — | 204 (toutes sauf courante) | — |

Sur `SIGNUP` avec un numéro existant, le serveur bascule silencieusement en `LOGIN` (ne pas révéler l'existence d'un compte avant la vérification du code).

### 4.2 Compte

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/me` | Compte complet du membre courant : `user`, `profile`, `stats`, `level`, `phase`, `plan`, `phones` (masqués), `kyc` (statut) |
| PATCH | `/me` | `displayName`, `handle`, `cityId`, `arrivalDate`, `plannedDepartureDate`, `phase`, `timezone` |
| PATCH | `/me/profile` | `bio`, `occupationStatus`, `availableToHelp`, `helpTypes`, `languageIds`, `skillIds`, `isPublic` |
| PUT | `/me/avatar` | multipart → `media_assets` |
| POST | `/me/arrived` | Déclare l'arrivée : `arrivalDate` ; passe en `RECENT_ARRIVAL` |
| POST | `/me/phones` | Démarre l'ajout d'un numéro (renvoie un `challengeId`) |
| POST | `/me/phones/verify` | Confirme, crée `phone_numbers` |
| DELETE | `/me/phones/:id` | Refus si dernier numéro (`LAST_PHONE`) |
| GET | `/me/consents` · POST `/me/consents` | Lecture et enregistrement |
| POST | `/me/deactivate` | Confirmation par OTP |
| POST | `/me/deletion` · DELETE `/me/deletion` | Demander / annuler |
| POST | `/me/export` · GET `/me/export/latest` | Export RGPD |

### 4.3 Vérification d'identité

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/me/kyc/session` | Crée une session Didit, renvoie `verificationUrl`, `sessionId`. Erreurs : `KYC_ALREADY_APPROVED`, `KYC_RETRY_TOO_SOON`, `KYC_MAX_ATTEMPTS` |
| GET | `/me/kyc` | Statut courant |
| POST | `/webhooks/didit` | Webhook signé (en-tête HMAC). Idempotent sur `provider_session_id` + statut |

### 4.4 Membres

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/users/:handle` | Profil public (champs §2.7). `404` si désactivé, supprimé, ou bloqué dans un sens ou l'autre |
| GET | `/users/:handle/stats` | Compteurs de réputation |

Limites de débit : `otp/request` 3/h par numéro · `PATCH /me` 20/h · `kyc/session` 3 par 30 jours.

---

## 5. Onboarding

Six écrans, tous « passables » sauf le téléphone. L'état d'avancement est stocké côté serveur (`users.onboarding_step`, **colonne ajoutée**, entier 0–6) pour reprendre là où le membre s'est arrêté.

| # | Écran | Écrit |
|---|---|---|
| 1 | Téléphone + OTP | `users`, `phone_numbers`, session |
| 2 | « Où en êtes-vous ? » | `phase` |
| 3 | Pays d'origine + ville (cible si pré-départ) | `origin_country_id`, `city_id` → adhésion automatique aux `communities` CITY et COUNTRY (événement `user.onboarded_location`) |
| 4 | « Quel est votre objectif ? » | Si un type de parcours : création du `journey` (module 03) avec `title` proposé = nom du type ; sinon rien |
| 5 | Profil : pseudo, statut, compétences, langues, disponibilité | `display_name`, `handle` généré, `user_profiles` |
| 6 | Atterrissage | Avec parcours → première étape ; sans → réseau de la ville, 3 événements, 1 parrain suggéré |

Consentements `TERMS` et `PRIVACY` recueillis à l'écran 1 (case à cocher obligatoire).

**[RÈGLE DURE — écran 3, précisée au lot W1A]** « Continuer » est refusé tant qu'aucune ville n'est choisie : le front prévient (message « Choisissez votre ville pour continuer. » et ouverture du sélecteur) et le serveur décide — `POST /me/onboarding` avec `step = 3` répond `409 LOCATION_REQUIRED` si `users.city_id` est nul, sans rien enregistrer. « Passer cette étape » reste permis (c'est un lien, il n'appelle pas la route) ; le parcours de l'écran 4 est alors refusé par `POST /journeys` (`409 LOCATION_REQUIRED`, la ville est la destination du parcours). La ville est enregistrée par `PATCH /me { cityId }` au « Continuer », **avant** l'avancement : c'est ce qui permet à l'écran 4 de créer le parcours.

Villes proposées à l'écran 3 : celles du pays où le membre vit, déduit de sa phase — pays d'**origine** choisi s'il n'est pas encore parti (`PRE_DEPARTURE`), pays de **destination** sinon. `GET /places/cities` rend `countryId` pour cela ; si le filtre ne laisse aucune ville, tout le catalogue est proposé (le membre n'est jamais enfermé).

**Écran 6 — atterrissage.** « Aller à l'accueil » vérifie la session puis ouvre `/accueil`. La variante **sans parcours** lit l'API et n'affiche aucune valeur de maquette : la ville (`GET /me` + `GET /places/cities`), le réseau et la coche « rejoint » (`GET /communities`, `mine`), les trois prochains événements (`GET /events?cityId=…&from=…`) — ou « Aucun événement annoncé dans votre ville pour le moment. » —, et un parrain suggéré (`GET /mentors?cityId=…`, premier disponible qui n'est pas le membre) dont la carte **disparaît** quand il n'y en a aucun. « Demander » mène à la fiche du parrain (`/parrainage/:handle`), où la demande se rédige (message de 50 à 1 000 caractères, niveau L1) : aucun message n'est envoyé à la place du membre.

**[RÈGLE DURE]** L'écran 4 propose « M'intégrer, rencontrer du monde » et « Aider les autres » comme choix de même rang que les types de parcours. Le parcours n'est jamais imposé.

---

## 6. Écrans

| Écran | États à prévoir |
|---|---|
| Connexion / inscription | saisie, envoi, attente du code, code invalide, trop de tentatives, pays non couvert |
| Compte → Vérification | non commencée, en cours (lien vers Didit), en revue, approuvée, refusée (motif générique + délai de nouvelle tentative), mineur |
| Compte → Niveaux | explication des trois niveaux, ce que chacun débloque, action suivante |
| Compte → Téléphones | liste masquée, ajout, retrait, dernier numéro non retirable |
| Compte → Sessions | liste, révocation |
| Compte → Profil | édition, aperçu « vu par les autres » |
| Compte → Données | export, désactivation, suppression avec avertissement détaillé (ce qui est perdu, ce qui est anonymisé) |
| Compte → Enregistrés | liste, chips par type, état actuel de chaque contenu, retrait |
| Invitation à monter de niveau | Composant réutilisé partout où `LEVEL_REQUIRED` est renvoyé : explique le niveau manquant et lance l'action |

---

## 7. Événements

| Émis | Quand | Consommateurs |
|---|---|---|
| `user.registered` | Fin de l'écran 1 | analytics |
| `user.onboarded` | Fin de l'écran 6 | notifications (bienvenue), analytics |
| `user.onboarded_location` | Écran 3 | communities (adhésions auto), cities (compteur) |
| `user.level_changed` | Recalcul | notifications, sessions |
| `kyc.status_changed` | Webhook | users (recalcul), notifications |
| `phone.added` / `phone.removed` | | users (recalcul) |
| `user.phase_changed` | Manuel ou automatique | journeys, feed, communities |
| `user.deactivated` / `user.reactivated` | | mentorship, communities, search |
| `user.deletion_requested` / `user.deleted` | | tous les modules |

---

## 8. Tâches planifiées

| Tâche | Fréquence | Action |
|---|---|---|
| `user.phase_progression` | quotidienne | `RECENT_ARRIVAL` → `SETTLED` si `arrival_date` + 6 mois et pas de réglage manuel postérieur |
| `account.deletion_execute` | horaire | Exécute les suppressions dont `execute_after` est dépassé et non annulées |
| `account.deactivated_purge` | quotidienne | Suppression des comptes désactivés depuis plus de 6 mois |
| `kyc.expire_sessions` | quotidienne | `IN_PROGRESS` → `EXPIRED` après 48 h sans résultat |
| `otp.purge` | horaire | Défis expirés depuis plus de 24 h |
| `export.purge` | quotidienne | Archives expirées |

---

## 9. Gestionnaire de suppression

Ce module est **appelé en dernier** par la tâche de suppression, après tous les autres. Il vide `phone_numbers`, `auth_sessions`, `kyc_verifications`, `user_profiles`, `user_languages`, `user_skills`, `consents` (conservés 3 ans comme preuve, sans lien exploitable), `data_exports`, `bookmarks`, l'avatar ; anonymise `users` comme décrit en §2.8.

---

## 10. Tests des règles dures

- `rule: le numéro de téléphone n'apparaît jamais en clair dans une réponse API`
- `rule: un indicatif hors pays actif est refusé avant envoi de SMS`
- `rule: un KYC refusé ou expiré ramène à L0 même avec un numéro français`
- `rule: un membre mineur est désactivé et ne peut pas se reconnecter`
- `rule: aucune donnée d'identité du webhook Didit n'est persistée`
- `rule: la suppression appelle tous les gestionnaires enregistrés et anonymise users`
- `rule: l'onboarding propose les deux choix sans parcours au même rang`

---

## 11. Précisions de mise en œuvre (lot W2A — données vives)

Règle de la phase : une valeur affichée vient de l'API ou du compte connecté ; sinon un état vide honnête — jamais un nom, une ville ou un chiffre de maquette. Un test (`apps/web/src/screens/__tests__/donnees-vives.test.ts`) lit les écrans générés montés et refuse la liste noire (Lyon, noms de la maquette, « 58 % », « 1 400 membres », dates d'exemple).

- **`GET /me`** rend en plus `user.cityName` et `user.cityCountryId` (la ville courante et son pays, `null` sans ville) et `user.handleChangedAt` (horodatage du dernier changement de pseudo, `null` s'il n'a jamais changé). L'accueil écrit « ÉVÉNEMENTS À ÉVRY » (« ÉVÉNEMENTS » sans ville) ; K01 écrit « Modifié le … · prochain changement possible le … » avec `HANDLE_CHANGE_INTERVAL_DAYS` (30, §2.6, constante partagée lue aussi par le refus serveur).
- **K01** : la ligne « Déjà modifié une fois… » n'existe que si `originCountryLocked` ; « Apparaître dans les nouveaux arrivants » dit « Pendant 14 jours après votre arrivée » (`NEWCOMER_WINDOW_DAYS`, 09 §2.4 — la maquette écrivait trois mois) et, si l'arrivée est connue, la date de fin ; la liste « Ville » est celle du pays de la ville courante (sans ville : premier pays de destination), la ville courante y figurant toujours.
- **K08** : les délais (lien d'archive 7 jours, réactivation 6 mois, rétractation 7 jours) sont composés depuis `ACCOUNT_LIMITS` (`lib/textes-delais.ts`). La promesse « sous 48 h » est retirée : rien ne la tient (la génération est asynchrone, le membre est prévenu).
- **K05 à 390 px** : la liste est celle des contacts (`GET /me/connections`) ; demandes reçues, suggestions et bloqués s'empilent dessous (AJOUT, `components/compte/sections-contacts-mobile.tsx`), chaque liste avec son état vide.
- **Compteurs** : `cities.member_count` suit la ville du membre dans la transaction de `PATCH /me` (la tâche nocturne `city.member_count_recompute` reste le filet pour la désactivation, la suppression et le bannissement) ; `communities.member_count` suit l'adhésion et le départ. Migration de rattrapage idempotente `20261017140000_compteurs_membres_rattrapage`.
