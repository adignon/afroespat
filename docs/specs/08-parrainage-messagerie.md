# 08 — Parrainage, contacts et messagerie

> Dépend de : `00`, `01`, `03`. Tables : `mentor_profiles`, `mentorships`, `mentorship_reviews`, `connections`, `connection_requests`, `blocks`, `conversations`, `conversation_members`, `messages`.

---

## 1. Périmètre

Parrainage borné (3 mois, 2 filleuls), contacts issus d'interactions réelles, blocage, messagerie volontairement minimale (directe, groupe de parcours, parrainage).

---

## 2. Parrainage

### 2.1 Devenir parrain

- Capacité `mentor.become` (**L2**) → `mentor_profiles` : bio, types de parcours connus, `max_mentees` (défaut 2, maximum 3), `is_available`.
- Un parrain doit avoir **au moins un parcours COMPLETED** ou être `SETTLED` depuis 12 mois. Sinon `MENTOR_NOT_ELIGIBLE`.
- Statut visible : « Disponible » (`active_mentee_count < max_mentees` et `is_available`) ou « Complet ».
- Un parrain peut se désactiver à tout moment ; ses parrainages en cours continuent.

### 2.2 Demander un parrain

- Capacité `mentorship.request` (**L0**) — le pré-départ doit pouvoir demander avant l'avion.
- Liste des parrains filtrable : ville (du membre ou cible), langue, type de parcours, pays d'origine (priorité au même, sans exclusivité), ancienneté. Tri : disponibles d'abord, puis note moyenne, puis parrainages menés.
- Demande avec **message obligatoire** (50–1 000 caractères) et `journey_id` facultatif. **Une seule demande `REQUESTED` à la fois** par membre. Le parrain accepte ou refuse **sans motif** ; sans réponse sous 7 jours, la demande expire et le membre peut en faire une autre.
- Un membre ne peut pas demander un parrain qu'il a bloqué ou qui l'a bloqué.

### 2.3 Parrainage actif

À l'acceptation : `status = ACTIVE`, `accepted_at`, `ends_at = accepted_at + 90 jours`, `active_mentee_count++`, création d'une `conversation` MENTORSHIP, notification, et si `journey_id` : le parrain devient `SUPPORTER` du parcours (module 03).

Pendant : rien d'imposé. Le parrain voit le parcours (rôle SUPPORTER), reçoit les demandes privées du filleul, échange dans la conversation.

### 2.4 Fin

| Motif | Déclencheur |
|---|---|
| `COMPLETED` | `ends_at` atteint (tâche) ou clôture anticipée d'accord commun (les deux cliquent « Terminer ») |
| `MENTOR_LEFT` / `MENTEE_LEFT` | L'un des deux termine unilatéralement ; l'autre est notifié, sans motif affiché |
| `BLOCKED` | Blocage entre les deux |
| `ADMIN` | Décision de modération |

À `COMPLETED` : `reputation_events` MENTORSHIP_COMPLETED pour le parrain, contact automatique (`origin = MENTORSHIP`), **évaluation mutuelle** proposée (`mentorship_reviews`, note 1–5 + commentaire facultatif, visible seulement une fois les deux évaluations déposées ou après 14 jours), `completed_count++`, `avg_rating` recalculée. Le parrain reste SUPPORTER du parcours sauf retrait.

Prolongation : les deux peuvent prolonger de 90 jours, une fois.

**[RÈGLE DURE]** Le parrainage n'implique jamais d'argent. Le guide du parrain le dit ; la modération IA marque `MONEY_REQUEST` dans la conversation de parrainage avec priorité 1. **Livré** : sur `message.sent` d'une conversation `MENTORSHIP`, les règles locales de modération (IBAN, carte, liens de paiement, demande de versement) ouvrent un dossier de priorité 1 sur le message (`modules/mentorship/mentorship-money.guard.ts`) ; le message n'est ni masqué ni sanctionné (un humain décide).

**Capacité** : la table `capabilities.ts` fait foi — `mentorship.request` est **L1** (et non L0 comme écrit en §2.2) ; un membre L0 qui tente reçoit `LEVEL_REQUIRED` et l'écran ouvre la fenêtre de niveau.

---

## 3. Contacts

### 3.1 Origines

| Origine | Création | Réciproque |
|---|---|---|
| `HELP_VALIDATED` | Événement `help_request.resolved` | Automatique |
| `MENTORSHIP` | Événement `mentorship.ended` motif COMPLETED | Automatique |
| `EVENT` | Les deux ont `checked_in = true` au même événement → **suggestion** (pas de création) | Sur acceptation |
| `GUIDE` | Proposition acceptée → **suggestion** entre auteur et contributeur | Sur acceptation |
| `MANUAL` | `connection_requests` : L1, **tout membre** (la condition de même ville ou de ville cible est levée à la demande du porteur, octobre 2026), message obligatoire 20–500 caractères | Sur acceptation |

Une suggestion est une notification « Ajouter X à vos contacts ? » ; accepter crée la `connection`. Une demande manuelle expire à 30 jours. Pas plus de 10 demandes manuelles envoyées par jour, 3 vers le même membre sur 30 jours.

### 3.2 Ce que débloque un contact

- Messagerie directe sans restriction (sinon : un membre L1 ne peut écrire qu'à un contact, ou en « réponse privée » à une demande d'entraide, ou à un parrain).
- Coordonnées : **rien de plus en V1** (le téléphone n'est jamais exposé) ; l'entrée reste pour de futurs champs de profil « visibles par mes contacts ».
- Recommandation professionnelle (module 10 : `pro_recommendations.connection_id`).
- Réseau de 2ᵉ degré : sur un profil, une annonce, une fiche pro → « Connecté·e à N de vos contacts » avec les handles. Calculé à la requête, mis en cache 1 h.

Retrait d'un contact : par l'un des deux, sans notification. Suppression automatique sur blocage.

**[RÈGLE DURE]** Aucun compteur public de contacts. Le nombre n'est visible que de soi-même.

---

## 4. Blocage

- Depuis un profil, une publication, un message. Non notifié.
- Effets immédiats (transaction) : `connections` retirée ; `connection_requests` en attente expirées ; `mentorships` actif → `ENDED` motif BLOCKED, dossier de modération ouvert (priorité 2) ; `journey_members` retiré dans les deux sens ; `event_attendees` : impossibilité de RSVP aux événements de l'autre ; `conversation_members.left_at` sur les conversations DIRECT entre les deux.
- Effets de lecture : les deux ne se voient plus (profils `404`, contenus exclus des listes, réponses masquées). Dans un réseau ou une conversation de groupe commune : contenus masqués mutuellement, les deux restent membres.
- Liste des bloqués dans Compte → Confidentialité, déblocage possible (les contacts ne sont pas restaurés).
- **Anti-abus** : plus de 20 blocages en 30 jours par un même membre → `moderation_cases` source AUTO_RULE, priorité 3.

---

## 5. Messagerie

### 5.1 Kinds

| Kind | Membres | Création |
|---|---|---|
| `DIRECT` | 2 | À la première écriture ; unique par paire |
| `JOURNEY` | Propriétaire + SUPPORTER + parrain | À la création du parcours ; membres synchronisés avec `journey_members` |
| `MENTORSHIP` | 2 | À l'acceptation du parrainage |

**Pas de groupe libre.** La messagerie n'est pas une entrée de navigation : icône en barre haute, accès depuis les profils, annonces, demandes.

### 5.2 Qui peut écrire à qui

| Émetteur | Peut ouvrir une DIRECT avec |
|---|---|
| L0 | Personne (sauf conversation MENTORSHIP et JOURNEY dont il fait partie) |
| L1 / L2 | Un contact · l'auteur d'une demande d'entraide (« réponse privée ») · l'auteur d'une annonce ou fiche pro (module 10, quota pro) · un nouvel arrivant via « Saluer » · n'importe qui **une fois** (premier message = demande de conversation, l'autre accepte ou ignore ; sans réponse, pas de second message) |

Un blocage ferme la conversation (`left_at`). Signalement d'un message possible ; la modération peut lire la conversation signalée (chiffrement au repos, pas de bout en bout — voir `00` §8.1).

### 5.3 Messages

Texte 1–4 000 caractères, une image facultative (pipeline média), `sent_at`. Suppression logique par l'émetteur (« message supprimé »). Accusés de lecture : `last_read_at` par membre, affiché « Vu ». Temps réel par WebSocket ; repli en polling 15 s. Limite : 60 messages/minute, 20 nouvelles conversations/jour.

Pas de recherche dans les messages en V1.

---

## 6. Données — compléments

| Table | Précision |
|---|---|
| `mentorships.extended_once` | **Ajoutée**, bool — livrée (migration `20261017040000`), reprise de l'existant par la déduction qu'elle remplace |
| `mentorships.expires_at` | **Ajoutée** — livrée ; posée à la demande (+ 7 jours), index `(status, expires_at)` ; une ligne sans échéance retombe sur `created_at + 7 jours` |
| `connection_requests.expires_at` | **Ajoutée** |
| `conversations.pending_from_user_id` | **Ajoutée**, facultatif — DIRECT non encore acceptée par le destinataire |
| `messages.kind` | **Ajoutée**, enum `TEXT`, `IMAGE`, `SYSTEM` (ex. « Sandra a rejoint le parcours ») |

---

## 7. API

### 7.1 Parrainage

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/mentors` | Filtres `cityId`, `languageId`, `templateCode`, `countryId` | |
| GET | `/mentors/:handle` | Fiche parrain | |
| GET | `/me/mentor-profile` | **Livrée** — mon profil et le diagnostic des trois conditions (`identity`, `phone`, `experience`) | |
| PUT | `/me/mentor-profile` · DELETE | Devenir / cesser | `LEVEL_REQUIRED`, `MENTOR_NOT_ELIGIBLE` |
| POST | `/mentorships` | `mentorHandle`, `message`, `journeyId?` | `MENTOR_FULL`, `PENDING_REQUEST_EXISTS`, `BLOCKED_RELATIONSHIP` |
| POST | `/mentorships/:id/accept` · `/decline` | Par le parrain | `MENTOR_FULL` |
| POST | `/mentorships/:id/end` · `/extend` | Par l'un des deux | `ALREADY_EXTENDED` |
| POST | `/mentorships/:id/review` | `rating`, `comment?` | `REVIEW_WINDOW_CLOSED` |
| GET | `/me/mentorships` | Comme parrain et comme filleul ; chaque ligne porte `extended`, `canExtend`, `expiresAt` (colonnes), `canReview` | |

### 7.2 Contacts et blocage

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/me/connections` | Mes contacts |
| DELETE | `/me/connections/:userId` | Retrait |
| POST | `/connection-requests` | `toHandle`, `message` — `REQUEST_LIMIT` (plus de `SAME_CITY_REQUIRED`) |
| POST | `/connection-requests/:id/accept` · `/decline` | |
| GET | `/me/connection-suggestions` | Suggestions EVENT / GUIDE |
| GET | `/users/:handle/mutual-connections` | 2ᵉ degré, avec les réseaux partagés (`sharedCommunities`) ; le profil public d'un autre membre porte aussi `relation` (contact, demande envoyée, demande reçue, aucune) |
| POST | `/blocks` · DELETE `/blocks/:userId` · GET `/me/blocks` | |

### 7.3 Messagerie

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/conversations` | Mes conversations, non-lus, dernière ligne |
| POST | `/conversations/direct` | `toHandle`, `firstMessage` — `LEVEL_REQUIRED`, `PENDING_CONVERSATION`, `BLOCKED_RELATIONSHIP` |
| POST | `/conversations/:id/accept` | Destinataire d'une DIRECT en attente |
| GET | `/conversations/:id/messages` | Paginé, marque lu |
| POST | `/conversations/:id/messages` | `body`, `mediaId?` |
| DELETE | `/messages/:id` | |
| WS | `/ws` | Événements `message.new`, `message.read`, `conversation.updated` |

---

## 8. Écrans

| Écran | Détail |
|---|---|
| Entraide → Parrainage | Liste des parrains (filtres), fiche, bouton Demander avec message ; Mes parrainages (en cours, passés, évaluations) |
| Devenir parrain | Conditions, formulaire, rappel du guide du parrain (jamais d'argent, jamais de garantie) |
| Contacts (Compte) | Liste, suggestions, demandes reçues et envoyées, bloqués |
| Messages | Panneau latéral ou page : liste, conversation, demandes en attente, badge non-lus. Conversation de parcours nommée par le titre du parcours (visible de ses membres seuls) |

---

## 9. Événements

| Émis | Consommateurs |
|---|---|
| `mentorship.requested` / `accepted` / `declined` / `ended` / `extended` | notifications, journeys, reputation, connections, messaging |
| `connection.created` / `removed` / `requested` / `suggested` | notifications, pros |
| `user.blocked` / `unblocked` | tous les modules de contenu, journeys, events, mentorship |
| `message.sent` | notifications (push), moderation (échantillonnage + signalements) |
| **Consommés** : `help_request.resolved`, `event.checked_in`, `guide.proposal_accepted`, `journey.created`, `journey.member_joined` | |

## 10. Tâches

| Tâche | Fréquence |
|---|---|
| `mentorship.end_due` | quotidienne |
| `mentorship.expire_requests` | quotidienne (7 jours) |
| `connection.expire_requests` | quotidienne (30 jours) |
| `mentor.rating_recompute` | quotidienne |

## 11. Gestionnaire de suppression

Profil parrain : supprimé ; parrainages actifs → `ENDED` motif ADMIN avec notification au filleul et réorientation vers la liste ; évaluations reçues par les autres : conservées anonymisées. Contacts : supprimés. Demandes : expirées. Blocages : **conservés** (l'autre partie garde sa protection) avec l'identifiant anonymisé. Messages : supprimés pour le membre ; dans les conversations de l'autre, remplacés par « Message d'un membre supprimé » (le corps est effacé, la ligne reste pour la cohérence du fil).

## 12. Tests des règles dures

- `rule: un parrain à max_mentees refuse toute nouvelle acceptation`
- `rule: un L0 peut demander un parrain mais ne peut pas ouvrir de conversation directe`
- `rule: le blocage retire contact, parrainage, appartenance au parcours et ferme la conversation directe en une transaction`
- `rule: le nombre de contacts n'est jamais renvoyé sur le profil d'un autre membre`
- `rule: la demande de contact manuelle exige un message, pas la même ville`
- `rule: un premier message non accepté n'autorise pas de second message`

## 13. Messagerie vivante — ce qui est livré (lot F)

- **Temps réel.** `WS /ws` (socket.io, jeton d'accès) pousse `message.new`, `message.read`, `conversation.updated`, `notification.new` et `conversation.typing` (éphémère, jamais stocké, limité par socket). Les charges ne portent jamais de contenu : le client relit par l'API. Les noms d'événements et les bornes vivent dans `@app/shared` (`validation/realtime.ts`). Le navigateur n'ouvre **qu'une** connexion par onglet (`lib/temps-reel.ts`), reprend la session à chaque refus de jeton et retombe sur le polling de 15 s (§5.3) si la socket est coupée.
- **« Vu ».** `GET /conversations/:id/messages` rend `meta.seenAt` : la lecture (`last_read_at`) des autres membres, la plus ancienne à plusieurs ; `null` tant que l'un n'a rien lu (une demande non acceptée ne marque pas lu). L'écran l'écrit une fois, sous ma dernière bulle non supprimée lue.
- **Demande de conversation.** `POST /conversations/:id/accept` (existant) et **`POST /conversations/:id/ignore`** : ignorer pose `left_at` sur la ligne du destinataire, sans rien annoncer à l'initiateur, qui reste « en attente » et ne peut pas relancer (§5.2, règle dure). Limite : le destinataire qui a ignoré ne peut plus écrire dans ce fil (`CONVERSATION_CLOSED`) ; une colonne `ignored_at` serait plus juste.
- **Par message.** « Supprimer » (`DELETE /messages/:id`, confirmation) et « Signaler » (`POST /reports`, `subjectType: MESSAGE`). Le serveur exige d'être membre de la conversation (404 sinon) et refuse de signaler son propre message.
- **Contacts suggérés.** `connection.suggested` est émis (dans les deux sens) par les gestionnaires de `event.checked_in` et de `guide.proposal_accepted`, et devient la notification « Ajouter X à vos contacts ? » qui mène au profil.

## 14. Messagerie vivante — suite (lot F2)

- **Conversation bloquée, « Débloquer ».** `GET /conversations` rend `blockedByMe` (DIRECT dont l'interlocuteur figure dans **mes** blocages) et garde cette conversation **listée pour moi seul**, fermée, sans non-lu ; celui qui a été bloqué ne la voit plus. Les écrans M01BLOQUE (1440 et 390) sont choisis sur cette donnée — plus sur `?etat=bloque`, ignoré. « Débloquer » appelle `DELETE /blocks/:userId` : le serveur **rouvre** la DIRECT fermée par le blocage (`left_at >= block.created_at`, pas si l'autre m'a aussi bloqué, pas une demande ignorée avant) ; les contacts, eux, ne reviennent pas (§4). `handleUserBlocked` ne ferme rien si le blocage a déjà été levé (livraison tardive). Bloquer depuis le menu laisse sur la conversation (menu fermé) au lieu de renvoyer à la liste.
- **Messages système.** Colonnes `messages.system_kind` / `system_ref` (migration `messages_systeme`, `(conversation_id, system_ref)` unique). `journey.member_joined` (« X a rejoint le parcours »), `journey.member_removed` (« X ne fait plus partie du parcours », pas pour un retrait par blocage), `journey.step_completed` (« X a terminé l'étape « … » ») et `journey.completed` s'écrivent dans la conversation JOURNEY ; `kind: 'SYSTEM'` côté API. Idempotent (une ligne par événement d'outbox). Un message système n'est ni non-lu, ni supprimable, ni signalable, et ne notifie personne ; l'écran le centre dans le vert pâle du bandeau de demande. Aucune entrée n'est ajoutée au vocabulaire d'événements.
- **Contenus masqués.** Un message d'un membre séparé (`body: null`) ne fait plus de bulle vide dans le fil.
- **Cloche entre onglets.** Voir `11-recherche-12-notifications.md` §14.

