# 06 — Fil d'entraide

> Dépend de : `00`, `01`, `02`, `03`, `08` (contacts). Tables : `help_requests`, `help_responses`.

---

## 1. Périmètre

Demandes et offres ponctuelles, typées, à résolution rapide, avec état ouvert/résolu/archivé, clôture « ça m'a aidé » créant un contact et créditant la réputation. Section à part entière avec sa page, ses filtres et ses onglets — jamais un bouton du composeur du fil.

---

## 2. Règles métier

### 2.1 Kinds et types

| `kind` | Capacité | Sens |
|---|---|---|
| `REQUEST` | `help.ask` (L0) | Je cherche de l'aide |
| `OFFER` | `help.offer` (L1) | Je propose quelque chose (un trajet, du matériel, un service) |

Types : `PAPERWORK` (démarches), `SERVICE`, `RIDE` (trajet), `MATERIAL` (matériel), `OTHER`. **Le logement et l'emploi ne sont pas des types d'entraide** : ils vivent dans Services (module 10). Le composeur affiche un rappel : « Pour un logement ou un emploi, utilisez Services ».

Un L0 peut poser une question mais pas proposer une offre — c'est la protection du segment pré-départ contre le démarchage : il ne peut pas être approché par une offre déguisée, et il ne peut pas non plus servir de compte-relais pour en publier.

### 2.2 Cycle de vie

| État | Règles |
|---|---|
| `OPEN` | Visible, réponses possibles. Titre 10–120, corps 20–2 000 caractères, ville obligatoire |
| `RESOLVED` | Clôturée par l'auteur via « ça m'a aidé » sur une réponse, ou « Résolu sans réponse ». Plus de nouvelles réponses. Reste visible 90 jours puis archivée |
| `ARCHIVED` | Automatique : `OPEN` sans réponse depuis 45 jours, ou `RESOLVED` depuis 90 jours. Invisible dans les listes, accessible par lien direct et recherche |

L'auteur peut rouvrir une demande `RESOLVED` dans les 7 jours (erreur de clic).

### 2.3 Réponses

- Réponse publique (`help_responses`) : L0 peut répondre à une REQUEST (un pré-départ aide un autre pré-départ) — capacité `comment.create`. Corps 10–2 000 caractères. Limite 30/heure.
- Réponse privée : bouton « Répondre en privé » → messagerie (L1 requis). Non comptée dans `response_count`.
- L'auteur d'une demande ne peut pas y répondre (il commente en modifiant sa demande, ou dans les réponses aux réponses — pas de fil imbriqué ici : une réponse = une réponse).

### 2.4 « Ça m'a aidé »

Action de l'auteur de la demande sur **une** réponse :
1. `help_responses.marked_helpful = true`, `marked_at`.
2. `help_requests.status = RESOLVED`, `resolved_at`, `resolved_by_response_id`.
3. Événement `help_request.resolved` → `reputation_events` HELP_VALIDATED pour l'auteur de la réponse ; **connexion automatique** entre les deux (module 08, `origin = HELP_VALIDATED`), sauf si un blocage existe ; notification à l'aidant ; si `origin_journey_step_id` : activité HELP_RECEIVED sur l'étape (module 03).

Une seule réponse peut être marquée. Marquer une autre réponse désmarque la première (réputation et connexion ajustées). **Impossible de se marquer soi-même** (une réponse de l'auteur n'existe pas).

### 2.5 Demandes issues d'un parcours

`origin_journey_step_id` renseigné → pastille « Depuis un parcours », bordure terre cuite, et une ligne de contexte « Étape *Logement* du parcours *Études* · échéance dans N jours » construite depuis l'étape (type de parcours, jamais le titre personnel). `due_date` héritée. À la résolution : proposition dans le parcours de marquer l'étape comme franchie.

### 2.6 « Vous pouvez aider »

Liste calculée pour le membre : demandes `OPEN` de sa ville (puis 30 km) dont le type correspond à ses `help_types` déclarés, **ou** dont `origin_journey_step_id` porte une `step_definition` que le membre a franchie dans un de ses parcours. Tri : échéance proche d'abord. Encadré en colonne droite de la section et onglet dédié.

### 2.7 Règle affichée

**[RÈGLE DURE]** Chaque page de la section affiche en permanence : « Aucun versement entre membres pour une démarche administrative. Si on vous demande de l'argent, signalez. » La modération IA (module 13) marque `MONEY_REQUEST` toute réponse contenant une demande de paiement ou des coordonnées bancaires → masquage automatique et dossier prioritaire.

### 2.8 Depuis une story

Une story `CONSEIL` ou `INFORMATION` peut être gardée par son auteur en demande d'entraide avant expiration (module 04 §2.6) : `help_requests` créée avec le corps de la story, `type` = démarches ou autre, ville de la story, marquée « Depuis une story ». Jamais automatique.

### 2.9 Offres

Une OFFER a le même cycle, mais la clôture est « Offre pourvue » (par l'auteur) sans marquage de réponse — la réputation n'est créditée que sur une demande résolue par un aidant, pas sur une offre. Cela évite de récompenser l'auto-promotion.

---

## 3. Données — compléments

| Table | Précision |
|---|---|
| `help_requests.reopened_at` | **Ajoutée** |
| `help_requests.archived_at` | **Ajoutée** |
| `help_requests.city_radius_km` | Non stockée : filtre de requête |

---

## 4. API

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/help` | `kind`, `type`, `cityId`, `radiusKm` (défaut 30), `status` (défaut OPEN), `phase`, `fromJourney` (bool), `cursor` | |
| GET | `/help/can-help` | « Vous pouvez aider » | |
| GET | `/help/mine` · `/help/my-responses` | Mes demandes / mes réponses | |
| GET | `/help/:id` | Demande + réponses + contexte de parcours si applicable | `404` si archivée et auteur bloqué |
| POST | `/help` | `kind`, `type`, `title`, `body`, `cityId`, `dueDate?` | `LEVEL_REQUIRED` (OFFER en L0), `USE_SERVICES` (type logement/emploi détecté), `CONTENT_BLOCKED` |
| PATCH | `/help/:id` | Auteur, tant que OPEN | |
| POST | `/help/:id/responses` | `body` | `REQUEST_CLOSED`, `OWN_REQUEST` |
| POST | `/help/:id/responses/:rid/helpful` | Marque « ça m'a aidé » | `NOT_AUTHOR` |
| POST | `/help/:id/resolve` | Sans réponse marquée | |
| POST | `/help/:id/reopen` | Dans les 7 jours | `REOPEN_WINDOW_CLOSED` |
| POST | `/help/:id/private-reply` | Ouvre ou récupère la conversation directe | `LEVEL_REQUIRED` |
| DELETE | `/help/:id` · `/help/:id/responses/:rid` | Suppression logique | |

Limites : 5 demandes par jour, 30 réponses par heure.

---

## 5. Écrans

| Écran | Détail |
|---|---|
| Panneau Entraide | Toutes les demandes · Mes demandes · Mes réponses · Vous pouvez aider · Parrainage (module 08) |
| Liste | Titre, sous-titre compteurs (« 41 ouvertes à Lyon · 178 résolues ce mois-ci »), bouton « Publier une demande », chips de type + ville + état, cartes. Colonne droite : règle de la plateforme (terre cuite), « Vous pouvez aider », « Ma réputation » |
| Carte | Pastilles (type, « Depuis un parcours », « Résolue »), horodatage, titre, corps tronqué, auteur + badge + phase, compteur de réponses, bouton Répondre. Résolue : fond grisé, encart « X a été marqué·e "ça m'a aidé" — contact créé » |
| Détail | Demande, contexte de parcours, réponses, actions de l'auteur (marquer, résoudre, modifier), « Répondre en privé » |
| Composeur | Kind (Demande / Offre), type, titre, corps, ville, échéance ; rappel Services ; règle de la plateforme |

---

## 6. Événements

| Émis | Consommateurs |
|---|---|
| `help_request.published` | moderation, search, notifications (« Vous pouvez aider » ciblé) |
| `help_request.responded` | notifications (auteur) |
| `help_request.resolved` | reputation, connections, journeys, notifications |
| `help_request.reopened` | reputation (retrait), connections (retrait si créée par cette résolution) |
| **Consommés** : `blocker.published` (création), `user.blocked`, `moderation.content_hidden` | |

## 7. Tâches

| Tâche | Fréquence |
|---|---|
| `help.archive` | quotidienne — 45 jours sans réponse, 90 jours après résolution |

## 8. Gestionnaire de suppression

Demandes : supprimées. Réponses : **conservées anonymisées** si `marked_helpful` (elles ont aidé quelqu'un), supprimées sinon. Contacts et réputation déjà créés chez l'autre membre : conservés.

## 9. Tests des règles dures

- `rule: un L0 peut publier une demande mais pas une offre`
- `rule: ça m'a aidé crée le contact et le crédit de réputation, une seule fois par demande`
- `rule: la règle de non-paiement est renvoyée dans la réponse de liste`
- `rule: une demande d'entraide de type logement ou emploi est refusée avec USE_SERVICES`
- `rule: l'auteur ne peut pas répondre à sa propre demande`
