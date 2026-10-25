# 03 — Parcours

> Dépend de : `00`, `01`, `02`. Tables : `journey_templates`, `journey_template_versions`, `step_definitions`, `template_steps`, `step_dependencies`, `journeys`, `journey_steps`, `journey_step_checklist_items`, `journey_members`, `journey_activities`, `blocker_requests`, `template_correction_proposals`.

Le parcours est la colonne vertébrale : il ne crée aucun contenu par lui-même, il **orchestre** les autres modules.

---

## 1. Périmètre

Modèles de parcours versionnés (équipe), parcours instanciés (membres), étapes et états, rétro-planning, checklist de documents, équipe du parcours, « Je suis bloqué », partage de jalon, parcours publics, journal, relance d'inactivité, conversion en guide.

---

## 2. Modèles — côté équipe

### 2.1 Structure

```
journey_template (Études)
 └─ journey_template_version (v3, publiée, pays = Bénin)
     ├─ template_step #1 → step_definition CHOOSE_PROGRAM
     ├─ template_step #2 → step_definition CAMPUS_FRANCE_FILE
     ├─ …
     └─ step_dependencies (#4 visa dépend de #3 admission)
```

- Une **définition d'étape** est réutilisable entre types (« Ouvrir un compte bancaire » sert à Études et Travail). Elle porte le guide lié, la cible du bouton « Je suis bloqué », le gabarit, la checklist de documents, le caractère « jalon majeur » et « à risque ».
- Une **version** assemble et ordonne des définitions, fixe les dépendances et les décalages de rétro-planning. Elle est générique (`origin_country_id` null) ou déclinée par pays d'origine.
- **Résolution** à la création d'un parcours : version publiée la plus récente pour (type, pays d'origine du membre), sinon version générique. Un type sans version publiée n'est pas proposé.

### 2.2 Cycle de vie d'une version

| État | Règles |
|---|---|
| `DRAFT` | Éditable librement, prévisualisable, non visible des membres |
| `PUBLISHED` | Figée. Les nouveaux parcours la prennent. **Une seule version publiée** par (type, pays) |
| `ARCHIVED` | Plus proposée. Les parcours existants continuent dessus |

Publier une nouvelle version : l'ancienne passe `ARCHIVED`, les parcours en cours **restent sur leur version** et reçoivent une notification « la procédure a évolué » avec un lien vers le résumé des changements (`changelog`). Un membre peut **migrer** manuellement son parcours : les étapes de même `step_definition` gardent leur état, les nouvelles arrivent en `TODO`, les supprimées sont conservées en `is_custom = true`.

**[RÈGLE DURE]** Publier une version ne modifie jamais un `journey` existant.

### 2.3 Rétro-planning

- `template_steps.days_before_arrival` : nombre de jours avant la date d'arrivée cible auquel l'étape doit être franchie.
- À la saisie ou modification de `journeys.target_arrival_date`, chaque étape non franchie reçoit `due_date = target_arrival_date − days_before_arrival` (si la valeur est définie). Une `due_date` saisie à la main par le membre n'est pas écrasée (`due_date_manual`, **colonne ajoutée** à `journey_steps`, booléen).
- **Alerte d'incompatibilité** : si une étape A dépend de B et que `due_date(A) < due_date(B) + durée indicative de B`, l'interface affiche « Cette échéance est trop proche : B prend en général N jours ». Pas de blocage, une alerte.
- Notifications : J−14, J−7, J−1 sur les étapes avec échéance (tâche `journey.reminders`).

### 2.4 Corrections proposées par les membres

Formulaire « Signaler une erreur dans ce modèle » sur toute étape → `template_correction_proposals`. Traitement en back-office : accepter (l'équipe modifie le brouillon de la version suivante), rejeter avec motif. Le membre est notifié.

---

## 3. Parcours — côté membre

### 3.1 Création

- Depuis l'onboarding (écran 4) ou depuis Parcours → « Créer un parcours ».
- Choix du type → résolution de la version → copie des `template_steps` en `journey_steps` (titre, description, position, checklist copiée dans `journey_step_checklist_items`).
- `title` proposé = nom du type ; le membre le modifie librement. C'est ce titre qui apparaît dans la navigation.
- `destination_city_id` = ville du membre ; `origin_country_id` = pays du membre.
- Création du `conversation` de type JOURNEY (module 08) → `group_conversation_id`.
- **Limite de plan** : un seul parcours `ACTIVE` ou `PAUSED` en gratuit. Créer un second → `PLAN_LIMIT_REACHED` avec invitation Premium. Les parcours `COMPLETED`, `ABANDONED`, `ARCHIVED` ne comptent pas.

### 3.2 Étapes et états

| Transition | Effets |
|---|---|
| `TODO → IN_PROGRESS` | `started_at`. `journeys.current_step_id` = cette étape si aucune autre en cours |
| `IN_PROGRESS → DONE` | `completed_at`, `duration_days` = jours depuis `started_at` (ou depuis la clôture de l'étape précédente si jamais démarrée). Événement `journey.step_completed`. Recalcul `progress_pct`. Si `is_major_milestone` : proposition de partage (§3.6). Si dernière étape : `journeys.status = COMPLETED` |
| `IN_PROGRESS → PAUSED` | `paused_at`. Aucune connotation d'échec dans l'interface : « mise en pause » |
| `PAUSED → IN_PROGRESS` | efface `paused_at` |
| `DONE → IN_PROGRESS` | Autorisé (« rouvrir »). Efface `completed_at`, décrémente la progression |

**[RÈGLE DURE]** Aucun état ni libellé d'échec n'existe, ni en base ni à l'écran.

`progress_pct` = étapes `DONE` / étapes non optionnelles × 100, arrondi.

Le membre peut **ajouter** une étape (`is_custom = true`, sans définition), **supprimer** toute étape (suppression logique), **renommer**, **réordonner** (glisser-déposer, `position` recalculées). Les dépendances ne s'appliquent qu'aux étapes issues du modèle.

### 3.3 Checklist de documents

Libellés cochables, copiés depuis `step_definitions.document_checklist` puis modifiables (ajouter, supprimer, cocher). **Aucun fichier** attaché en V1 — l'interface le dit clairement : « Cochez ce que vous avez réuni. Les documents restent chez vous. »

### 3.4 Équipe du parcours

| Rôle | Peut | Ne peut pas |
|---|---|---|
| `OBSERVER` | Voir les étapes et leur état, la progression | Commenter, voir les notes, la checklist, la discussion |
| `SUPPORTER` | Tout ce que voit l'observateur + participer à la discussion du parcours + recevoir les demandes privées | Modifier les étapes |

- Invitation par handle ou depuis les contacts. Le membre invité reçoit une notification et accepte ou refuse. Un parrain actif (module 08) devient `SUPPORTER` automatiquement.
- Retrait à tout moment par le propriétaire. Un blocage retire automatiquement.
- Maximum 10 membres par parcours.
- Le co-porteur n'existe pas en V1.

### 3.5 « Je suis bloqué »

Flux en quatre temps, sans jamais publier automatiquement :

1. **Clic** sur l'étape → création d'un `blocker_requests` en `DRAFT`, `target` = `step_definitions.blocker_target` (ou `HELP` pour une étape personnalisée).
2. **Pré-remplissage** : le gabarit (`blocker_template`) est rendu avec `{ville}`, `{echeance}`, `{etape}`, `{parcours}`. Exemple : « Je suis bloqué à l'étape *Logement* de mon parcours *Études* à *Lyon*, échéance dans *9 jours*. » Le membre complète.
3. **Choix de la portée** : public (section cible) ou **privé** (`is_private = true` : envoi aux `SUPPORTER` et au parrain via la discussion du parcours, rien de public).
4. **Validation** : bouton « Publier » → création de l'objet cible (`help_requests` avec `origin_journey_step_id` et `origin_blocker_id` ; ou `housing_listings` de type SEEKING ; ou `job_seeker_profiles` mis à jour ; ou `mentorships` REQUESTED), `blocker_requests.status = PUBLISHED`, `published_ref_*` renseignés, `journey_activities` BLOCKER_PUBLISHED. « Annuler » → `CANCELLED`.

**[RÈGLE DURE]** L'objet cible n'est créé qu'à l'appel explicite de la route de publication, avec le texte tel que renvoyé par le client. Le brouillon n'est jamais promu sans cet appel.

Quand la demande d'entraide issue d'un blocage est résolue (module 06), l'étape reçoit une activité `HELP_RECEIVED` et l'interface propose « Marquer l'étape comme franchie ? ».

### 3.6 Partage de jalon

À `step_completed` sur toute étape : proposition « Donner un conseil sur cette étape ? » (story `CONSEIL`, étape présélectionnée — module 04 §2.6). Sur une étape `is_major_milestone` : proposition « Partager cette victoire ? » avec un champ de texte **vide** (pas de texte pré-rédigé — c'est le membre qui écrit) et un aperçu de l'encart « Étape franchie · N sur M ». Publier → `posts` type VICTORY avec `journey_step_id`. Décliner → `share_prompt_dismissed_at`, plus jamais reproposé pour cette étape. Le membre peut partager plus tard depuis l'étape.

### 3.7 Parcours publics

- `journeys.visibility` : `PRIVATE` (défaut) · `SHARED` (invités) · `PUBLIC`. Le passage en PUBLIC est **proposé à la première étape franchie**, pas à la création, et enregistre le consentement `JOURNEY_VISIBILITY`. Réversible à tout moment.
- **Ce que voit un membre connecté** sur un parcours public : handle, avatar, badge de niveau, type de parcours, ville de destination, pays d'origine, étape en cours, étapes franchies avec leur durée réelle, progression. **Jamais** : titre personnel, notes, checklist, équipe, discussion, motifs de pause, demandes privées, dates cibles.
- **[RÈGLE DURE]** Un parcours `PAUSED` ou `ABANDONED` n'apparaît jamais comme public, même si `visibility = PUBLIC`. Un parcours public n'est jamais visible hors connexion ni indexé par la recherche.
- **Panneau Parcours → PARCOURS PUBLICS** : 5 parcours publics d'autres membres, même `journey_templates.code` en priorité, même ville de destination puis même pays d'origine ; tri : avancement proche du mien d'abord, puis aboutis. Page « Parcours publics » : liste complète, filtres type, ville, avancement.
- Actions depuis un parcours public : « Écrire » (messagerie, L1) · « Proposer comme parrain » si le membre est parrain disponible.

### 3.8 Journal

`journey_activities` enregistre chaque événement du parcours. Affiché en chronologie inversée dans l'onglet « Historique ». Exporté dans le PDF du parcours (module 01, export) et proposé comme base à la conversion en guide.

### 3.9 Inactivité et fin de parcours

- **60 jours sans activité** sur un parcours `ACTIVE` : une notification unique « Où en êtes-vous ? » avec trois réponses : *je continue* (rien), *j'ai mis en pause* (`PAUSED`), *j'ai fini* (`COMPLETED`), *j'ai abandonné* (`ABANDONED`). Aucune relance ensuite.
- **`COMPLETED`** : écran de félicitations, puis les trois propositions : devenir parrain (si L2), écrire un guide à partir de l'étape la plus longue, organiser un événement. Le parcours reste consultable, exportable, et reste visible s'il est public.
- Un parcours terminé ne compte plus dans la limite du plan gratuit.

---

## 4. Données — compléments

| Table | Précision |
|---|---|
| `journey_steps.due_date_manual` | **Ajoutée**, bool — échéance saisie par le membre, non écrasée par le rétro-planning |
| `journeys.visibility` | Enum étendu : `PRIVATE` · `SHARED` · `PUBLIC` — la colonne `similar_visible` n'existe plus |
| `journeys.last_viewed_at` | **Ajoutée** — pour « le plus récemment consulté » dans la carte du panneau Accueil |
| `journeys.migrated_from_version_id` | **Ajoutée**, facultatif |
| `journey_members` | Le parrain actif est inséré avec `role = SUPPORTER`, `invited_by_user_id` = propriétaire |

---

## 5. API

### 5.1 Membres

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/journey-templates` | Types proposés au membre (résolus pour son pays) | |
| GET | `/journeys` | Mes parcours + ceux où je suis membre | |
| POST | `/journeys` | `templateId`, `title`, `targetArrivalDate?`, `variant?` (REGULARIZATION · STATUS_CHANGE · RENEWAL, type « Régulariser » seulement — refusé ailleurs) | `PLAN_LIMIT_REACHED`, `TEMPLATE_UNAVAILABLE` |
| GET | `/journeys/:id` | Parcours complet : étapes, checklist, membres, progression, prochaine échéance | `403` si ni propriétaire ni membre |
| PATCH | `/journeys/:id` | `title`, `targetArrivalDate`, `status` (PAUSED/ACTIVE/ABANDONED), `visibility` (PRIVATE/SHARED/PUBLIC) | |
| POST | `/journeys/:id/migrate` | Vers la version publiée courante | `ALREADY_CURRENT` |
| POST | `/journeys/:id/steps` | Étape personnalisée | |
| PATCH | `/journeys/:id/steps/:stepId` | `title`, `description`, `status`, `dueDate`, `notes` | `INVALID_TRANSITION` |
| PUT | `/journeys/:id/steps/order` | Liste ordonnée d'identifiants | |
| DELETE | `/journeys/:id/steps/:stepId` | | |
| PUT | `/journeys/:id/steps/:stepId/checklist` | Liste complète (remplace) | |
| POST | `/journeys/:id/members` | `userHandle`, `role` | `MAX_MEMBERS`, `BLOCKED_RELATIONSHIP` |
| DELETE | `/journeys/:id/members/:userId` | | |
| GET | `/journeys/invitations` | Les invitations qui attendent ma réponse (sans le titre personnel) | |
| POST | `/journeys/:id/members/accept` · `/decline` | Par l'invité | |
| POST | `/journeys/:id/steps/:stepId/blocker` | Crée le brouillon, renvoie le texte pré-rempli et la cible | |
| POST | `/blockers/:id/publish` | `text`, `isPrivate`, champs propres à la cible | `BLOCKER_ALREADY_PUBLISHED` |
| POST | `/blockers/:id/cancel` | | |
| POST | `/journeys/:id/steps/:stepId/share` | `text` → crée le post VICTORY | `NOT_A_MILESTONE`, `STEP_NOT_DONE` |
| POST | `/journeys/:id/steps/:stepId/dismiss-share` | | |
| GET | `/journeys/public` | Parcours publics (§3.7) : `templateCode`, `cityId`, `progressNear`, `limit` — exclut PAUSED/ABANDONED, exclut les bloqués | |
| GET | `/journeys/public/:id` | Vue publique d'un parcours (champs §3.7 seulement) | `404` si non public, en pause, arrêté ou bloqué |
| GET | `/journeys/:id/activities` | Journal, paginé | |
| POST | `/journeys/:id/inactivity-response` | `answer` | |
| POST | `/journeys/:id/report-template-error` | `stepId?`, `message` | |

### 5.2 Administration (`/v1/admin/journey-templates/*`, rôle `CONTENT_ADMIN`)

| Route | Rôle |
|---|---|
| CRUD `/templates` | Types |
| CRUD `/step-definitions` | Bibliothèque d'étapes |
| POST `/templates/:id/versions` | Nouveau brouillon (copie de la version publiée ou vide) |
| PUT `/versions/:id/steps` | Composition ordonnée + dépendances + décalages |
| GET `/versions/:id/preview` | Rendu tel que vu par un membre |
| POST `/versions/:id/publish` | Vérifie : au moins une étape, pas de cycle dans les dépendances, une seule publiée par (type, pays). Archive la précédente, notifie les parcours concernés |
| POST `/versions/:id/archive` | |
| GET/POST `/correction-proposals` | File et traitement |

---

## 6. Écrans

| Écran | Contenu et états |
|---|---|
| Panneau Parcours | Carte du haut : sélecteur si plusieurs, nom, %, barre, étape en cours, bouton Je suis bloqué·e · MON PARCOURS : Vue d'ensemble, Étape en cours, Discussion (compteur), Équipe (compteur), Checklist de documents, Historique, Réglages · PARCOURS PUBLICS : 5 parcours d'autres membres (avatar, nom, type · ville, mini-barre), Voir tous · RAPPELS en bas |
| Page parcours | En-tête (titre, pastille de statut, sous-titre origine → destination · date cible, barre terre cuite N/M). Timeline verticale : étapes franchies **repliées** derrière « N étapes franchies », étape en cours dépliée (carte terre cuite : description, échéance, tuiles guide + section cible, avatars « N membres ont franchi cette étape », bouton **Je suis bloqué**), étapes à venir en gris. Un encart partenaire au maximum sous l'étape en cours (module 14) |
| Je suis bloqué | Feuille en trois volets : texte pré-rempli éditable → portée (public/privé) → aperçu et bouton Publier. Jamais de publication en un clic |
| Partager un jalon | Aperçu de l'encart, champ vide, boutons Publier / Plus tard |
| Parcours publics | Liste (avatar, nom, type · ville, étape en cours, mini-timeline des étapes franchies avec durées), filtres type/ville/avancement, actions Écrire · Proposer comme parrain ; encart d'activation si mon parcours n'est pas public |
| Réglages | Titre, date cible, visibilité en trois choix (Privé / Partagé / Public, avec l'explication exacte de ce qui est visible et invisible en public), migration de version, mettre en pause, arrêter |
| Historique | Chronologie, export |
| Fin de parcours | Félicitations + trois propositions |
| Admin — éditeur de version | Liste ordonnée d'étapes glisser-déposer, panneau de propriétés par étape, graphe des dépendances, prévisualisation, bouton Publier avec récapitulatif des parcours impactés |

États communs : sans parcours (invitation), chargement, erreur, plan atteint.

---

## 7. Événements

| Émis | Consommateurs |
|---|---|
| `journey.created` | analytics, messaging (conversation), notifications |
| `journey.step_started` / `step_completed` / `step_paused` | activities, analytics (durées réelles), feed (proposition de partage), user (phase → arrivée) |
| `journey.completed` / `abandoned` / `paused` | notifications, analytics, mentorship |
| `journey.member_invited` / `member_joined` / `member_removed` | notifications, messaging |
| `blocker.published` | help / housing / jobs / mentorship selon cible, activities |
| `journey.template_version_published` | notifications (parcours concernés) |
| **Consommés** : `help_request.resolved` (→ HELP_RECEIVED), `mentorship.accepted` (→ parrain SUPPORTER), `user.blocked` (→ retrait), `subscription.changed` (→ limites) | |

## 8. Tâches

| Tâche | Fréquence | Action |
|---|---|---|
| `journey.reminders` | horaire | Notifications J−14, J−7, J−1 sur `due_date` |
| `journey.inactivity_check` | quotidienne | Relance unique à 60 jours sans activité |
| `journey.progress_recompute` | quotidienne | Sécurité : recalcule `progress_pct` et `current_step_id` |

## 9. Gestionnaire de suppression

Supprime physiquement les `journeys` du membre et tout leur contenu (étapes, checklist, activités, blocages, notes). Retire le membre des `journey_members` d'autres parcours. Les `template_correction_proposals` sont anonymisées.

## 10. Tests des règles dures

- `rule: publier une version ne modifie aucun parcours existant`
- `rule: aucun état d'échec n'existe sur une étape`
- `rule: un blocage n'est promu en contenu public que par l'appel explicite de publication`
- `rule: le texte publié est celui envoyé par le client, pas le gabrit`
- `rule: un parcours en pause ou arrêté n'est jamais renvoyé comme public`
- `rule: la vue publique d'un parcours ne contient ni titre personnel, ni notes, ni checklist, ni équipe`
- `rule: un parcours public n'est pas accessible hors connexion`
- `rule: la limite d'un parcours actif en gratuit est appliquée côté serveur`
- `rule: les notes et la checklist ne sont jamais renvoyées à un observateur`

---

## 11. Livré par le lot « parcours vivant » (écarts et précisions)

**Back.**
- `POST /journeys/:id/migrate` : les étapes de même définition (les trois variantes de « Régulariser » forment une seule case) gardent état, dates, notes et checklist et sont rattachées à la nouvelle ligne de version ; les étapes du modèle absentes de la nouvelle version deviennent personnelles (`is_custom`) ; les nouvelles arrivent `TODO` avec checklist et échéance rétro-planifiée ; l'ordre est celui de la nouvelle version, puis les étapes personnelles. `journeys.migrated_from_version_id` est écrit, une activité `TEMPLATE_MIGRATED` rejoint le journal. Refus : `ALREADY_CURRENT`, `JOURNEY_STATE` (arrêté/archivé), `TEMPLATE_UNAVAILABLE`. `GET /journeys/:id` rend `journey.newerVersion` (propriétaire seul).
- Variante de régularisation : le choix remplace la définition de la première étape (REGULARIZATION) par celle choisie.
- Invitation : notification `JOURNEY_TEAM` (`journey.invitation`) à l'invité, sans le titre personnel, et `journey.invitation_accepted` au propriétaire ; un refus ne notifie personne. Un invité ne peut pas encore ouvrir le parcours (403) ; il répond depuis « Mes parcours ».
- `POST /blockers/:id/publish` publie aussi HOUSING (annonce SEEKING, niveau du logement), JOBS (profil de recherche, `post.create`) et MENTORSHIP (demande de parrainage rattachée au parcours, parrain choisi par `mentorHandle`). Le titre est exigé par le serveur selon la cible.
- Alerte §2.3 : `deadlineAlert` sur l'étape (propriétaire seul), à partir de `step_dependencies`.
- Quota : reprendre un parcours arrêté ou terminé (`PATCH status = ACTIVE`) repasse par la limite du plan gratuit.
- `journey.inactivityPromptPending` : la relance §3.9 attend une réponse tant que rien n'a été fait depuis son envoi.
- Détail : `helpReceivedCount` (J10), `peers` sur l'étape en cours (agrégat de la même ville ; avatars des seuls parcours publics), `guide` lié.
- Gestionnaire `user.deleted` (§9) : parcours supprimés avec leur contenu, équipes quittées, journal des autres parcours privé de son auteur, corrections de modèle anonymisées (message effacé, `REJECTED` si en attente — `user_id` est NOT NULL et la ligne `users` reste).
- Livré (lot F2) : la notification « la procédure a évolué » (`journey.template_version_published`) part à la publication d'une version, à chaque propriétaire de parcours concerné.

**Front.** Les écrans J01 à J11 gardent le chrome transcodé (rail, barre haute, carte « Mon parcours », barre basse mobile) ; leur contenu est rendu par `apps/web/src/components/parcours/` (AJOUTS hors maquette, branchés par `tools/adaptations/parcours-vivant.mjs`). Écarts à la maquette : glisser-déposer remplacé par des flèches haut/bas ; feuilles J03/J04/J05I/J07X/J08A/J01M rendues par `FeuillesParcours` — **depuis le lot « feuilles dessinées » (2026-10-24), ce sont les planches de la maquette qui s'affichent** (J03 : trois volets 1 · Votre message / 2 · Portée / 3 · Aperçu, ordinateur et mobile ; J04 : carte « ÉTAPE FRANCHIE · N sur M » ; J05 invitation, J07 export, J08 arrêt et J01M « Mes parcours » : feuilles mobiles), branchées par `tools/adaptations/feuilles-dessinees.mjs` (texte, champs, contacts, cartes de portée et boutons remplacés nœud par nœud par `FVal`/`FAct`/`FLien`/`FSlot`) ; la maquette ne dessine pas de fenêtre d'ordinateur pour J05/J07/J08/J01M, qui gardent le panneau centré. J07 ne dessine plus « Réservé à Premium » (paiement hors périmètre, tout est gratuit) : la carte annonce l'export, le bouton l'ouvre. J03 ajoute sous les cartes de portée les champs que la publication exige selon la cible (titre, secteurs, contrats, pseudo du parrain). Le garde-fou `screens/__tests__/planches-montees.test.ts` échoue si une planche générée n'est importée par aucune route ; export J07 = page imprimable `/parcours/:id/export` (PDF par le navigateur) ; ajouts « Où en êtes-vous ? », « La procédure a évolué », « Signaler une erreur dans ce modèle », invitations (en tête de « Mes parcours »), route `/parcours/:id/etapes`. « Proposer comme parrain » est un message (il n'existe pas de route d'offre de parrainage : le parrainage part du filleul).
