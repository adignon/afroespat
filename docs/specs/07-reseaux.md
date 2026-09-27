# 07 — Réseaux

> Dépend de : `00`, `01`, `02`, `04` (posts, commentaires), `09` (événements). Tables : `communities`, `community_members`, `topics`, `community_announcements`, `polls`, `poll_options`, `poll_votes`, `albums`, `album_photos`.

---

## 1. Périmètre

Réseaux automatiques (ville, pays d'origine) et réseaux d'intérêt créés par les membres. Chaque réseau contient : un fil libre, des sujets persistants (structure forum, affichage cartes), des événements réservés, une carte et une liste des membres, des épinglés, un album, des sondages, des annonces du créateur, des rôles, une confidentialité, et un archivage automatique.

---

## 2. Règles métier

### 2.1 Réseaux automatiques

| Kind | Création | Adhésion | Sortie |
|---|---|---|---|
| `CITY` | À l'activation de la ville (module 02) | Automatique pour tout membre dont `city_id` = ville ; changement de ville = changement de réseau | Impossible (on peut le mettre en sourdine) |
| `COUNTRY` | À l'activation du pays | Automatique selon `origin_country_id` | Impossible |

Pas de créateur ; modérateurs = modérateurs bénévoles nommés par l'équipe (`role = MODERATOR`). Visibilité `PUBLIC`. Jamais archivés.

### 2.2 Réseaux d'intérêt

- Capacité `community.create` (L1). Nom 3–60, description ≤ 500, catégorie parmi une liste (cuisine, sport, entrepreneuriat, parents, étudiants, numérique, musique, lecture, sorties, foi, autre), photo de couverture facultative.
- **Condition de création** : le créateur doit inviter **au moins 5 membres** à la création (handles ou contacts). Le réseau est créé en `ACTIVE` ; les invités reçoivent une notification. C'est le garde-fou contre les réseaux vides.
- **Seuil de proposition** : le bouton « Créer un réseau d'intérêt » n'apparaît que si la ville du membre compte **50 membres actifs** ou plus. En dessous, un message : « Les réseaux d'intérêt ouvrent à partir de 50 membres à Lyon (34 aujourd'hui). » Ce seuil est un `system_settings`.
- Rôles : `OWNER` (créateur, unique), `MODERATOR` (nommés par le propriétaire), `MEMBER`. Le propriétaire peut transférer la propriété.
- Visibilité : `PUBLIC` (tout membre rejoint), `ON_REQUEST` (demande, `status = PENDING`, acceptée par propriétaire ou modérateur), `INVITE_ONLY` (invisible dans la découverte, adhésion par invitation seulement).
- **Archivage** : 60 jours sans activité (publication, sujet, réponse, événement) → `ARCHIVED`, lecture seule, retiré de la découverte. Le propriétaire reçoit un avertissement à 45 jours. Réactivable par le propriétaire.

### 2.3 Contenu d'un réseau

| Élément | Règles |
|---|---|
| **Fil** | `posts` avec `community_id`. Tous les types autorisés, sans restriction de thème. Membres seulement (L1 pour publier, L0 commente et réagit) |
| **Sujets** | `topics` : titre 10–120, corps, état `OPEN` / `RESOLVED` (par l'auteur) / `ARCHIVED` (90 jours sans réponse). Réponses via `comments` (subject TOPIC). Recherchables. `pin_kind` : `RULES`, `RESOURCE`, `WELCOME` — épinglés en tête, 5 maximum, posés par propriétaire ou modérateur |
| **Événements** | `events` avec `community_id` : visibles des membres seulement, dans l'agenda du réseau et dans l'agenda personnel du membre |
| **Carte des membres** | Compteurs par ville des membres du réseau (module 09, même composant que la carte de France) |
| **Liste** | Membres avec rôle, phase, ville ; recherche par handle |
| **Annonces** | Propriétaire et modérateurs ; notification à tous les membres non en sourdine ; 2 par semaine maximum |
| **Sondages** | Question, 2–8 options, choix unique ou multiple, clôture facultative. Un vote par membre (modifiable jusqu'à clôture). Résultats visibles après vote ou clôture |
| **Album** | Photos liées ou non à un événement ; tout membre ajoute (L1), propriétaire et modérateurs suppriment ; pipeline média |

### 2.4 Modération de réseau

Propriétaire et modérateurs peuvent : masquer une publication ou un sujet du réseau, retirer un membre (`BANNED` : ne peut plus rejoindre), épingler, clore un sujet. Ils ne peuvent pas suspendre un compte — ils **signalent** à l'équipe. Toute action de modération de réseau est journalisée (`audit_logs`, `actor_type = MEMBER`).

### 2.5 Sourdine et notifications

Un membre peut mettre un réseau en sourdine (`community_members.muted`, **colonne ajoutée**) : plus de notifications, le réseau reste dans sa liste.

---

## 3. Données — compléments

| Table | Précision |
|---|---|
| `community_members.muted` | **Ajoutée**, bool |
| `community_members.invited_by_user_id` | **Ajoutée** |
| `communities.rules_topic_id` | Non nécessaire : `pin_kind = RULES` suffit |
| `communities.warning_sent_at` | **Ajoutée** — avertissement d'archivage à 45 jours |

---

## 4. API

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/communities` | Mes réseaux (section haute) + découverte (`kind`, `category`, `cityId`, `q`) | |
| GET | `/communities/:slug` | En-tête, mon rôle, compteurs, épinglés | `404` si INVITE_ONLY et non membre |
| POST | `/communities` | `name`, `description`, `category`, `visibility`, `inviteHandles[]` (≥ 5) | `CITY_THRESHOLD`, `NOT_ENOUGH_INVITES`, `LEVEL_REQUIRED` |
| PATCH | `/communities/:id` | Propriétaire | |
| POST | `/communities/:id/join` · `/leave` | | `INVITE_ONLY`, `AUTO_COMMUNITY` (sortie impossible) |
| POST | `/communities/:id/invite` | `handles[]` | |
| POST | `/communities/:id/requests/:userId/accept` · `/reject` | Demandes d'adhésion | |
| GET | `/communities/:id/members` | Liste, recherche | |
| PATCH | `/communities/:id/members/:userId` | `role`, `status` (BANNED), `muted` (soi-même) | |
| POST | `/communities/:id/transfer` | `toUserId` | |
| GET | `/communities/:id/feed` | Posts du réseau | |
| GET/POST | `/communities/:id/topics` | Sujets ; création `title`, `body` | |
| PATCH | `/topics/:id` | `status`, `pinKind` (modérateur), `title`/`body` (auteur, 15 min) | |
| GET/POST | `/communities/:id/announcements` | | `ANNOUNCEMENT_LIMIT` |
| GET/POST | `/communities/:id/polls` · POST `/polls/:id/vote` · `/close` | | `POLL_CLOSED` |
| GET/POST | `/communities/:id/albums` · POST `/albums/:id/photos` · DELETE | | |
| GET | `/communities/:id/map` | Compteurs par ville | |
| POST | `/communities/:id/reactivate` | Propriétaire, réseau archivé | |

Admin : nommer des modérateurs bénévoles sur un réseau automatique, archiver/désarchiver, changer le seuil de 50, fusionner deux réseaux d'intérêt.

---

## 5. Écrans

| Écran | Détail |
|---|---|
| Panneau Accueil → Réseaux ▾ | Entrée dépliable listant mes réseaux (pastille + compteur de non-lus) ; en tête « Découvrir » |
| Réseaux | Mes réseaux · Découvrir (filtres kind/catégorie/ville) · bouton Créer (ou message de seuil) |
| Réseau | Couverture, nom, compteur de membres, mon rôle, bouton Rejoindre/Quitter/Sourdine · onglets : Fil · Sujets · Événements · Membres · Album · Sondages · À propos (épinglés, règles) |
| Sujet | Titre, état, corps, réponses (une profondeur), bouton Résolu pour l'auteur, épingler pour modérateurs |
| Créer un réseau | Nom, description, catégorie, visibilité, **invitation d'au moins 5 membres** avec compteur |
| Gestion (propriétaire) | Membres et rôles, demandes, bannis, transfert, réactivation |

---

## 6. Événements

| Émis | Consommateurs |
|---|---|
| `community.created` / `archived` / `reactivated` | search, notifications |
| `community.member_joined` / `left` / `banned` | notifications, cities |
| `community.topic_created` / `replied` / `resolved` | search, notifications |
| `community.announcement_published` | notifications (membres non en sourdine) |
| `community.activity` (tout événement ci-dessus) | met à jour `last_activity_at` |
| **Consommés** : `city.activated`, `country.activated` (création auto), `user.onboarded_location`, `user.city_changed` (réaffectation), `post.published` avec `community_id`, `post.moved_to_topic`, `user.blocked` (masquage réciproque dans les listes) | |

## 7. Tâches

| Tâche | Fréquence |
|---|---|
| `community.archive_inactive` | quotidienne — avertissement à 45 jours, archivage à 60 |
| `community.topic_archive` | quotidienne — sujets sans réponse depuis 90 jours |
| `community.member_count_recompute` | quotidienne |

## 8. Gestionnaire de suppression

Adhésions : supprimées. Réseaux d'intérêt dont le membre est propriétaire : transférés au plus ancien modérateur, sinon au plus ancien membre actif, sinon archivés. Sujets : conservés anonymisés. Sondages créés : conservés anonymisés ; votes supprimés. Photos d'album : supprimées. Annonces : conservées anonymisées.

## 9. Tests des règles dures

- `rule: un réseau d'intérêt ne peut pas être créé sans 5 invitations`
- `rule: le bouton de création est refusé sous le seuil de membres de la ville`
- `rule: on ne peut pas quitter un réseau automatique`
- `rule: un réseau d'intérêt sans activité depuis 60 jours est archivé, jamais un réseau automatique`
- `rule: le contenu d'un réseau INVITE_ONLY n'est jamais renvoyé à un non-membre ni indexé pour lui`
