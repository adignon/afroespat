# 09 — Villes et agenda

> Dépend de : `00`, `01`, `02`, `07`, `08`. Tables : `city_tips`, `events`, `event_attendees`.

---

## 1. Périmètre

Carte de France avec compteurs, annuaire des membres, fiche ville communautaire, nouveaux arrivants ; événements physiques locaux avec RSVP, rappels et présence. L'agenda est le **convertisseur en ligne → réel** ; la présence physique est l'indicateur clé du projet.

---

## 2. Villes et membres

### 2.1 Carte

- Composant unique réutilisé (accueil, réseau, admin) : fond de carte vectoriel léger (France métropolitaine, sans tuiles externes — **aucune requête vers un service de cartes tiers**), un cercle par ville active, taille proportionnelle à `member_count`, libellé « Lyon · 340 ».
- Filtre par pays d'origine : « Tous » / un pays → compteurs recalculés (`Lyon · 85 Bénin`).
- Clic sur une ville → fiche ville. Villes inactives non affichées.
- **[RÈGLE DURE]** Aucune position individuelle ; la carte ne montre que des agrégats par ville, et jamais en dessous de **3 membres** pour un filtre pays (sinon « moins de 3 »), pour ne pas identifier une personne.

### 2.2 Annuaire des membres

Liste filtrable : ville (+ 30 km), pays d'origine, phase, statut, compétence, langue, `available_to_help`. Tri : disponibilité pour aider d'abord, puis ancienneté. Exclut les profils `is_public = false` hors connexion, les bloqués, les désactivés. Résultats paginés, 20 par page.

### 2.3 Fiche ville

Une page par ville active : en-tête (nom, région, `member_count`, répartition par pays), réseau de la ville (lien), événements à venir, **nouveaux arrivants** (14 jours), puis les contenus communautaires `city_tips` :

| Kind | Libellé | Règles |
|---|---|---|
| `TIP` | Bons plans | Texte ≤ 500 |
| `SHOP` | Où trouver les produits du pays | Nom + adresse texte + note |
| `BUDGET` | Budgets réels | Libellé + `amount_cents` (« Chambre en coloc : 480 € ») — l'agrégat (médiane) s'affiche en tête |
| `TESTIMONY` | Témoignages | Texte ≤ 1 000 |

**Guichets du jour** : en tête de la fiche, l'agrégat des stories `INFORMATION` actives de la ville dont le sujet est démarches et qui portent un `place_label` (préfecture, OFII, CAF, CPAM, banque…) : par lieu, la dernière information, l'heure, le nombre de confirmations, le nombre de signalements « ça a changé ». Calculé à la requête, cache 5 minutes. Rien n'est stocké au-delà des stories elles-mêmes.

Une story `DECOUVERTE` gardée par son auteur devient un `city_tips` (`SHOP` ou `TIP`) avec `source_story_id` — la fiche ville se remplit sans ressaisie.

Capacité `post.create` (L1). Vote « utile » (réutilise `helpful_count`, une table de votes légère `city_tip_votes` — **ajoutée** : `city_tip_id`, `user_id`, unique). Tri par utilité puis date. Signalable. Aucune donnée éditoriale : coût de la vie, transports, universités ne sont pas modélisés.

### 2.4 Nouveaux arrivants

Membres `RECENT_ARRIVAL` de la ville avec `arrival_date` dans les 14 derniers jours (ou `created_at` si absent), qui n'ont pas désactivé l'option `show_as_newcomer` (**colonne ajoutée** à `user_profiles`, défaut vrai). Bouton « Saluer » → conversation directe pré-adressée (L1).

---

## 3. Agenda

### 3.1 Création

- Capacité `event.create` (L1). Limite de plan : **1 par mois en gratuit** (`usage_counters` EVENTS_CREATED), illimité en Premium. Un événement annulé dans l'heure ne compte pas.
- Champs : type, titre 5–120, description ≤ 3 000, ville, lieu (`venue_name`, `address_text` libre — **jamais géocodé**), début, fin facultative, capacité facultative, couverture facultative, `community_id` facultatif (réservé au réseau).
- Début ≥ maintenant + 2 h ; au plus 6 mois à l'avance.
- Modération à la publication (comme un post). Modifiable par l'organisateur jusqu'au début ; les participants sont notifiés d'un changement de date, d'heure ou de lieu.

### 3.2 RSVP

- Capacité `event.attend` (L1). Statuts `GOING`, `MAYBE`, `DECLINED`. Si `capacity` atteinte : `WAITLIST`, promotion automatique en `GOING` à la première désinscription (notification).
- Impossible de RSVP à l'événement d'un membre bloqué.
- L'organisateur voit la liste ; les participants voient les avatars des `GOING` et le compteur.

### 3.3 Rappels et présence

- Notifications : J−1 et H−2 aux `GOING` (push si activé, sinon in-app). Résumé à l'organisateur H−24 (« 23 inscrits, 4 peut-être »).
- **Présence** : après le début, l'organisateur coche les présents (`checked_in`) — c'est la donnée qui alimente l'indicateur « 30 % des inscrits participent à un événement physique en 3 mois ». Un participant peut aussi se déclarer présent pendant l'événement (bouton « Je suis là », actif de H−0 à H+6). Deux `checked_in` au même événement → suggestion de contact (module 08).
- `EVENT_ORGANIZED` en réputation : événement `DONE` avec **≥ 3 présents cochés**. Pas de réputation pour un événement sans présence enregistrée — évite les événements fantômes.
- Passage à `DONE` : automatique 12 h après `ends_at` (ou `starts_at` + 4 h).

### 3.4 Annulation

Par l'organisateur, motif facultatif, notification à tous les inscrits. Un événement annulé reste visible 7 jours barré, puis masqué.

### 3.5 Agenda : calendrier vertical

- Le panneau Agenda est un **calendrier vertical** : jours groupés par semaine sur 6 semaines glissantes (2 passées, 4 à venir), chaque jour avec le titre du premier événement, un point vert s'il y a des événements près de moi (ville + 30 km + mes réseaux), un **point terre cuite si j'y participe** (GOING ou WAITLIST). Jours sans événement présents mais atténués. Navigation par mois.
- La page affiche les événements du jour sélectionné : **mes participations en tête**, marquées, puis les autres. Chips : Tous · Mes participations · Mes organisations. Ouverture sur aujourd'hui, ou sur le prochain jour avec événement si aujourd'hui est vide.
- Mobile : bande horizontale de dates défilante sous le titre.
- Colonne droite de l'accueil : 3 prochains.
- Aucun événement en ligne / visio en V1 : l'agenda est physique par définition (`address_text` obligatoire). Le type `CONFERENCE` reste physique.

---

## 4. Données — compléments

| Table | Précision |
|---|---|
| `city_tips.venue_name`, `address_text` | **Ajoutées** pour `SHOP` |
| `city_tip_votes` | **Table ajoutée** (socle `append`) : `city_tip_id`, `user_id`, unique |
| `user_profiles.show_as_newcomer` | **Ajoutée** |
| `events.cancelled_at`, `cancel_reason` | **Ajoutées** |
| `events.checked_in_count` | **Ajoutée**, dénormalisée |
| `event_attendees.waitlist_position` | **Ajoutée** |

---

## 5. API

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/cities/map` | Villes actives + compteurs, `countryId?` (seuil 3) | |
| GET | `/cities/:slug` | Fiche : en-tête, réseau, événements, nouveaux arrivants, tips par kind | |
| GET | `/cities/:slug/desks` | Guichets du jour (agrégat des informations actives) | |
| GET | `/members` | Annuaire filtrable | |
| GET/POST | `/cities/:slug/tips` | Liste par `kind` ; création | `LEVEL_REQUIRED` |
| PUT/DELETE | `/tips/:id/vote` | | |
| PATCH/DELETE | `/tips/:id` | Auteur | |
| GET | `/events/calendar` | `from`, `to` (≤ 62 jours) → un objet par jour : `date`, `total`, `attending`, `firstTitle`. Cache 5 min par (membre, ville) | |
| GET | `/events` | `date` (jour) ou `from`/`to`, `scope` (all/mine/organized), `cityId`, `radiusKm`, `type`, `cursor` — les participations du membre en tête | |
| GET | `/events/:id` | Détail, mon RSVP, participants (avatars) | `404` si réservé à un réseau dont je ne suis pas membre |
| POST | `/events` | Création | `PLAN_LIMIT_REACHED`, `TOO_SOON`, `TOO_FAR` |
| PATCH | `/events/:id` | Organisateur | `EVENT_STARTED` |
| POST | `/events/:id/cancel` | | |
| PUT | `/events/:id/rsvp` | `status` | `BLOCKED_RELATIONSHIP`, `EVENT_FULL` (→ waitlist automatique) |
| DELETE | `/events/:id/rsvp` | | |
| GET | `/events/:id/attendees` | Organisateur : complet ; autres : avatars GOING | |
| POST | `/events/:id/check-in` | `userIds[]` (organisateur) ou soi-même | `CHECKIN_WINDOW_CLOSED` |

---

## 6. Écrans

| Écran | Détail |
|---|---|
| Villes et Membres | Carte + filtre pays · onglet Annuaire (filtres) · liste des villes |
| Fiche ville | En-tête, **Guichets du jour**, nouveaux arrivants (Saluer), événements, sections Bons plans / Produits du pays / Budgets (médiane en tête) / Témoignages, bouton Contribuer |
| Panneau Agenda | Carte du haut : mois, flèches, aujourd'hui · CALENDRIER : colonne de jours par semaine avec titre, point vert, point terre cuite · bloc du bas : Créer un événement, quota du mois |
| Page Agenda | Titre du jour sélectionné, chips Tous · Mes participations · Mes organisations, cartes (bloc de date, titre, lieu, compteur, type, réseau si réservé), mes participations en tête avec marque terre cuite |
| Événement | Couverture, infos, RSVP (Je viens / Peut-être / Je ne viens pas), participants, organisateur, bouton « Je suis là » pendant l'événement, actions organisateur (modifier, annuler, cocher les présents) |
| Créer | Formulaire, rappel de la limite gratuite et du compteur du mois |

---

## 7. Événements

| Émis | Consommateurs |
|---|---|
| `event.published` / `updated` / `cancelled` / `done` | notifications, search, communities |
| `event.rsvp_changed` | notifications (waitlist), analytics |
| `event.checked_in` | connections (suggestion), reputation (à DONE), analytics **(indicateur clé)** |
| `city_tip.published` / `voted` | search, moderation |
| **Consommés** : `user.blocked`, `city.merged`, `subscription.changed` | |

## 8. Tâches

| Tâche | Fréquence |
|---|---|
| `event.reminders` | 15 min — J−1, H−2, résumé organisateur H−24 |
| `event.mark_done` | horaire |
| `event.hide_cancelled` | quotidienne (7 jours) |
| `event.waitlist_promote` | à la désinscription (immédiat, pas planifié) |

## 9. Gestionnaire de suppression

Événements organisés à venir : annulés avec notification ; passés : conservés anonymisés (« Organisé par un membre supprimé »). RSVP : supprimés. Présences : conservées anonymisées (l'indicateur d'impact ne doit pas être effacé). Tips : conservés anonymisés ; votes supprimés.

## 10. Tests des règles dures

- `rule: la carte ne renvoie jamais un compteur inférieur à 3 pour un filtre pays`
- `rule: aucune adresse d'événement n'est envoyée à un service de géocodage`
- `rule: la limite d'un événement par mois est appliquée côté serveur en gratuit`
- `rule: EVENT_ORGANIZED n'est crédité qu'avec au moins 3 présents cochés`
- `rule: un événement réservé à un réseau n'est pas renvoyé à un non-membre`

## 11. Précisions de mise en œuvre (lot E)

- **Annulation d'un événement** : `events.cancelled_at` et `events.cancel_reason` (colonnes). `event.hide_cancelled` lit `cancelled_at` (repli sur `updated_at` pour les lignes antérieures). L'organisateur annule avec un motif ; l'événement apparaît « annulé » pendant 7 jours.
- **Vote utile sur une contribution** : table `city_tip_votes` (unique `city_tip_id` + `user_id`), `PUT/DELETE /tips/:id/vote` (idempotents, capacité `comment.create`), événement `city_tip.voted`. On ne vote pas sa propre contribution (409). `helpful_count` est tenu dans la même transaction.
- **Contributions** : `city_tips.venue_name` (obligatoire pour un commerce) et `address_text` (texte libre, jamais géocodé). Les budgets sont **anonymes** : l'auteur n'est jamais renvoyé. Pas de catégorie ni de photo : un filtre sans colonne ment.
- **Arrivants** : `user_profiles.show_as_newcomer` (défaut vrai) ; un membre qui le retire disparaît de « Arrivés récemment ».
- **Carte** : SVG local, sans iframe ni service tiers ; le seuil `CITY_COUNT_PRIVACY_THRESHOLD` (3) est appliqué par le serveur et affiché « moins de 3 ».
- **Droits** : `event.attend` et `event.create` exigent L2 côté serveur (la matrice de §3 dit L1 : écart à arbitrer). Le front ne lit jamais le niveau : il tente, le serveur répond `LEVEL_REQUIRED`.
- **Suppression de compte** : abonnés `user.deleted` des modules `events` (annule les événements à venir de l'organisateur, retire ses RSVP, promeut la file d'attente) et `cities` (retire ses votes, décrémente `helpful_count`).
