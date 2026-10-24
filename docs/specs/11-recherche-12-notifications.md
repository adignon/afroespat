# 11 — Recherche

> Dépend de : `00`, tous les modules de contenu. Tables : `search_documents`, `search_zero_results`.

---

## 1. Périmètre

Recherche globale transverse (barre haute), insensible aux accents, avec regroupement par type, filtres, suggestions, et transformation d'une recherche infructueuse en demande d'entraide. Index PostgreSQL full-text, alimenté par événements.

---

## 2. Règles

### 2.1 Périmètre indexé

| `subject_type` | Source | Titre | Corps | Visibilité |
|---|---|---|---|---|
| `GUIDE` | guides PUBLISHED / FLAGGED < 30 j | titre | corps de la version courante | PUBLIC |
| `TOPIC` | topics non archivés | titre | corps + 3 premières réponses | COMMUNITY (réseau) ou PUBLIC si réseau PUBLIC |
| `HELP_REQUEST` | OPEN + RESOLVED < 90 j | titre | corps | PUBLIC |
| `HOUSING` | ACTIVE | titre | description | PUBLIC |
| `JOB` | ACTIVE | titre + entreprise | description | PUBLIC |
| `EVENT` | SCHEDULED | titre | description + lieu | PUBLIC ou COMMUNITY |
| `USER` | ACTIVE, `is_public` | handle + display_name | bio + compétences + langues | PUBLIC |
| `CITY` | actives | nom + région | — | PUBLIC |
| `PRO` | APPROVED, ACTIVE | nom + métier | description | PUBLIC |

**Jamais indexés** : parcours (même publics), stories (24 h), signets, messages, publications du fil (elles sont éphémères par nature ; les questions durables ont été déplacées en sujets), notes, checklists, réseaux INVITE_ONLY (ni leurs sujets ni leurs événements).

**[RÈGLE DURE]** Une requête ne renvoie jamais un document `COMMUNITY` d'un réseau dont le demandeur n'est pas membre, ni un document dont l'auteur est bloqué dans un sens ou l'autre.

### 2.2 Traitement du texte

- Configuration `french` + dictionnaire `unaccent` : « sécurité sociale » = « securite sociale ». Stemming français.
- Index GIN sur `tsv` ; index trigram sur `title` pour les suggestions par préfixe et la tolérance aux fautes.
- Pondération : titre A, corps B ; boost de fraîcheur léger (documents de moins de 30 jours) ; boost local (même ville) appliqué au classement, pas au filtrage.

### 2.3 Requête

- Minimum 2 caractères. Suggestions dès 3 caractères (titres par préfixe, 6 max, mis en cache).
- Résultats groupés par type, onglet « Tout » avec les 3 meilleurs de chaque type et compteurs, puis onglets par type paginés.
- Filtres transverses : ville (+ rayon), pays d'origine, type, période (7 j / 30 j / tout), état (ouvert / résolu pour l'entraide et les sujets).
- Recherches récentes : côté client uniquement (stockage local du navigateur), 10 dernières, effaçables.

### 2.4 Recherche infructueuse

Zéro résultat (après suppression des mots vides) → `search_zero_results` incrémenté (requête normalisée, ville, jour — **sans identifiant de membre**) et proposition : « Aucun résultat. Posez la question à la communauté ? » → composeur d'entraide pré-rempli avec les termes en titre (module 06). L'agrégat sert au produit (quels guides manquent) et à l'admin.

### 2.5 Indexation

Abonné aux événements `*.published`, `*.updated`, `*.unpublished`, `*.archived`, `*.hidden`, `user.profile_updated`, `user.blocked` (pas de réindexation, exclusion à la requête). File `search-index`, traitement asynchrone, délai cible < 30 s. Réindexation complète disponible en admin (par type).

---

## 3. API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/search?q&type&cityId&radiusKm&countryId&period&state&cursor` | Résultats groupés ou paginés par type |
| GET | `/search/suggest?q` | Suggestions |
| POST | `/search/zero` | Signale un zéro résultat (appelé par le client après affichage) |

Admin : `/v1/admin/search/reindex` (type), `/v1/admin/search/zero-results` (top requêtes sans résultat par semaine et par ville).

## 4. Écrans

Barre haute : champ, suggestions déroulantes, raccourci clavier. Page de résultats : onglets par type avec compteurs, filtres, cartes du type concerné (mêmes composants que les sections), état vide avec le bouton « Poser la question ».

## 5. Suppression de compte

Documents `USER` supprimés ; les autres documents de l'auteur suivent le sort de leur source (réindexés anonymisés ou supprimés).

## 6. Tests des règles dures

- `rule: un document COMMUNITY n'est pas renvoyé à un non-membre`
- `rule: un document d'un auteur bloqué n'est pas renvoyé`
- `rule: la recherche est insensible aux accents`
- `rule: les parcours et les messages ne sont jamais indexés`
- `rule: search_zero_results ne contient aucun identifiant de membre`

---
---

# 12 — Notifications

> Dépend de : `00`, `01`. Tables : `notifications`, `notification_preferences`, `push_subscriptions`, `outbound_messages`.

---

## 1. Périmètre

Notifications in-app, push PWA, email ; préférences par catégorie ; résumé hebdomadaire ; regroupement ; heures calmes. Trois canaux, trois usages distincts.

---

## 2. Règles

### 2.1 Catégories et canaux par défaut

| Catégorie | Exemples | In-app | Push | Email |
|---|---|---|---|---|
| `JOURNEY_DEADLINE` | échéance d'étape J−14/7/1, échéance critique | ✓ | ✓ | ✓ (J−1 seulement) |
| `JOURNEY_TEAM` | invitation, membre rejoint, demande privée | ✓ | ✓ | — |
| `HELP` | réponse à ma demande, « ça m'a aidé », vous pouvez aider | ✓ | ✓ (réponse) | — |
| `MENTORSHIP` | demande reçue, acceptation, fin, évaluation | ✓ | ✓ | ✓ (demande reçue) |
| `MESSAGE` | nouveau message, demande de conversation | ✓ | ✓ | — |
| `SOCIAL` | réactions, commentaires, contact suggéré | ✓ (regroupé) | — | — |
| `GUIDE` | proposition reçue, décision, escalade, signalé obsolète | ✓ | — | ✓ (proposition reçue) |
| `COMMUNITY` | annonce, invitation, adhésion acceptée | ✓ | annonce | — |
| `EVENT` | rappels, changement, liste d'attente | ✓ | ✓ | — |
| `SERVICES` | alerte logement/emploi, fiche pro validée, contact | ✓ | ✓ (alerte) | — |
| `BOOKMARK` | guide enregistré mis à jour, demande enregistrée résolue, parrain enregistré redevenu disponible, événement enregistré demain, annonce enregistrée modifiée ou expirée | ✓ | ✓ (événement) | — |
| `ACCOUNT` | niveau, KYC, sécurité, suppression | ✓ | ✓ | ✓ |
| `MODERATION` | contenu masqué, avertissement, sanction | ✓ | — | ✓ |
| `DIGEST` | résumé hebdomadaire | — | — | ✓ |

**[RÈGLE DURE]** Aucun email n'est jamais envoyé pour la catégorie `SOCIAL`. C'est ce qui protège la délivrabilité et évite le désabonnement massif.

### 2.2 Préférences

Par catégorie et par canal, dans `notification_preferences` (json `{ "HELP": { "push": true, "email": false } }`). Certaines ne sont pas désactivables : `ACCOUNT` sécurité (in-app + email), `MODERATION`. Désabonnement email en un clic depuis chaque email (lien signé, sans connexion). **Heures calmes** : plage par défaut 22 h–8 h (fuseau du membre) pendant laquelle les push sont différés, sauf `ACCOUNT` sécurité.

### 2.3 Regroupement

`SOCIAL` : une notification par publication et par heure (« Sandra et 4 autres ont réagi »). `HELP` « vous pouvez aider » : au plus une par jour. `SERVICES` alertes : une par heure et par alerte. Les regroupements sont calculés dans la file `notifications` avec une fenêtre Redis.

### 2.4 Push

Web Push (VAPID). Demande de permission **uniquement** après une action explicite : bouton « Activer les notifications » dans les réglages, ou proposition contextuelle après la première demande d'entraide ou le premier RSVP — jamais au premier chargement. Un abonnement qui échoue 5 fois est supprimé. Charge utile minimale (titre, corps court, lien) ; jamais de contenu de message privé dans le push, seulement « Nouveau message de Sandra ».

### 2.5 Email

Fournisseur Brevo via interface. Modèles : bienvenue, échéance J−1, demande de parrainage reçue, proposition de guide reçue, résumé hebdomadaire, sécurité (nouvel appareil, suppression), modération, facture. Expéditeur unique, texte + HTML simple, désinscription en pied. Trace dans `outbound_messages` avec statut du fournisseur (rebonds → adresse marquée invalide après 2 rebonds durs).

### 2.6 Résumé hebdomadaire

Lundi 8 h, fuseau du membre, si activé (défaut oui) et si activité pertinente : mon parcours (prochaine échéance), mes demandes ouvertes, événements de ma ville cette semaine, 3 guides les plus utiles publiés, 2 nouveaux arrivants. Pas de résumé si rien à dire.

### 2.7 In-app

Cloche en barre haute avec compteur de non-lus, panneau déroulant, page complète. Marquer lu individuellement ou tout. Conservation 90 jours. Temps réel par WebSocket.

---

## 3. Données — compléments

| Table | Précision |
|---|---|
| `notifications.category` | **Ajoutée**, enum ci-dessus |
| `notifications.group_key` | **Ajoutée** — clé de regroupement |
| `notification_preferences.quiet_hours` | `{ start: "22:00", end: "08:00" }` |
| `users.email_encrypted` · `users.email_verified_at` | **Livré** (migration `20261017020000_email_membre`) : facultative, chiffrée comme le téléphone (même clé, format scellé à identifiant de clé), jamais renvoyée en clair (seul un masque `j•••••••@gmail.com`), **vérifiée par un code à 6 chiffres** reçu par email (15 min, 5 essais, renvoi après 60 s) — et non par lien : la route exige la session du membre et le code se saisit sur l'écran des réglages. Sans email vérifié, pas de canal email. Une vérification en cours vit dans `email_verifications` (une par membre) ; un changement garde l'ancienne adresse active jusqu'à confirmation |

---

## 4. API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/notifications?cursor&unread` | Liste |
| POST | `/notifications/read` | `ids[]` ou `all` |
| GET/PUT | `/me/notification-preferences` | |
| POST | `/me/push-subscriptions` · DELETE `/:id` | |
| GET · POST · DELETE | `/me/email` | État masqué · ajout/changement (envoie le code) · retrait |
| POST | `/me/email/verify` | `{ code }` — confirme l'adresse |
| GET | `/me/push-subscriptions` | Clé publique VAPID et appareils abonnés (sans `endpoint` ni clés) |
| GET | `/unsubscribe?token` | Lien signé (public) |
| WS | événement `notification.new` | |

## 5. Écrans

Cloche et panneau · page Notifications (filtres par catégorie) · Réglages → Notifications (grille catégorie × canal, heures calmes, email, résumé) · bandeau contextuel « Activer les notifications » après une action.

## 6. Tâches

| Tâche | Fréquence |
|---|---|
| `notifications.weekly_digest` | lundi 8 h par fuseau (exécutions horaires avec filtre de fuseau) |
| `notifications.quiet_hours_flush` | horaire — envoie les push différés |
| `notifications.purge` | quotidienne (90 jours) |
| `push.cleanup` | quotidienne (abonnements en échec) |

## 7. Suppression de compte

Notifications, préférences, abonnements push, email : supprimés. `outbound_messages` : conservés 90 jours anonymisés puis purgés.

## 8. Tests des règles dures

- `rule: aucun email n'est envoyé pour une notification SOCIAL`
- `rule: la permission push n'est jamais demandée au premier chargement`
- `rule: un push MESSAGE ne contient jamais le corps du message`
- `rule: les catégories ACCOUNT sécurité et MODERATION ne sont pas désactivables`
- `rule: le lien de désabonnement fonctionne sans connexion`

## 13. Recherche, notifications — ce qui est livré (lot F)

- **Notifications.** Colonne `notifications.url` (migration `notifications_cible`) : chemin relatif du front, posé par les gestionnaires d'événements (slugs résolus pour réseaux et guides). Les lignes de X02 mènent à leur cible ; « Tout marquer lu » = `POST /notifications/read { all: true }` ; le compteur de non-lues est affiché et suit `notification.new` en direct. `channels_sent` peut contenir `PUSH_DEFERRED` (heures calmes) : le schéma partagé l'accepte — son absence faisait échouer toute la page pendant la plage calme. Heures calmes (`quietHours`) et résumé hebdomadaire (`weeklyDigest`) sont éditables dans K07.
- **Recherche.** Filtres ville, rayon, pays, période, état (`?ville=&rayon=&pays=&periode=&etat=`, validés par les schémas partagés). `SearchHit.subline` : le fait écrit sous le titre de la carte (« 84 utiles », « 14 réponses · Ouverte · Lyon », « 620 € · Lyon »), composé par le serveur. `POST /search/zero` part une fois par requête restée sans résultat ; recherches récentes dans le navigateur (`localStorage`).
- **Indexation.** `user.profile_updated` (émis par `PATCH /me` et `PATCH /me/profile`) réindexe la fiche USER ; `job.updated` (modification, renouvellement, retrait) l'offre ; `post.commented` sur un sujet et `post.moved_to_topic` réindexent le sujet, dont le document porte désormais les trois premières réponses de **toutes** origines (commentaires compris).
- **Débit.** `GET /search` 30/min, `GET /search/suggest` 60/min, `POST /search/zero` 10/min, par membre (`SEARCH_RATE_LIMITS`).

## 14. Recherche, notifications — suite (lot F2)

- **« Poser la question ».** Sur une recherche sans résultat, le lien mène à `/entraide/nouveau?titre=<helpTitle>` ; le composeur d'entraide lit `?titre=` (borné à `HELP_LIMITS.titleMax`, ne remplace jamais une saisie).
- **Recherches récentes.** Éprouvées avec résultats (contenu indexé par le worker) : la requête est mémorisée dans le navigateur uniquement quand elle a donné des résultats.
- **Cloche entre onglets.** Marquer lu dans un onglet met à jour le compteur des autres onglets **du même navigateur** : `BroadcastChannel` (repli : événement `storage`), uniquement les deux nombres. La liste fermée `REALTIME_EVENTS` n'a pas d'événement « lu » (`notification.new` signifie l'inverse) et n'est pas étendue ; un autre navigateur ou appareil est rattrapé par la relecture périodique.
- **« La procédure a évolué » (03 §2.2, §7).** La publication d'une version de modèle (`POST /admin/journey-templates/versions/:id/publish`) émet `journey.template_version_published` dans sa transaction (seulement si des parcours ACTIVE/PAUSED restent sur la version archivée). Consommateur `notifications` : une notification par **propriétaire** et par version, type `journey.template_version_published`, catégorie `JOURNEY_DEADLINE` (la liste de §2.1 est fermée ; c'est celle des rappels de parcours : in-app + push, pas de courriel), lien `/parcours/:id` (ou `/parcours` s'il a plusieurs parcours visés), déduplication sur `(membre, type, version)`. L'équipe du parcours n'est pas prévenue. `journeysNotified` de la réponse de publication = nombre de parcours visés.
- **Tests.** `destinations.int.test.ts` crée sa propre ville active ; le cas « Contacter les modérateurs » de `notifications.int.test.ts` crée son propre réseau : plus de dépendance au seed.

