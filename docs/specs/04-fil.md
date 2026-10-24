# 04 — Fil d'actualité

> Dépend de : `00`, `01`, `02`, `03`. Tables : `posts`, `post_media`, `post_reactions`, `comments`, `stories`, `story_reactions`, `story_views`.

---

## 1. Périmètre

Publications typées du fil global et des fils de réseaux, réactions au vocabulaire variable, commentaires (polymorphes, partagés avec sujets, guides, événements), **stories à durée de vie limitée** (conseil, découverte, information) en bandeau, déplacement d'une question vers un réseau, colonne droite de l'accueil.

---

## 2. Règles métier

### 2.1 Types et vocabulaire

| Type | Pastille | Compteur | Action | Réaction stockée |
|---|---|---|---|---|
| `VICTORY` | Victoire | « N félicitations » | Bravo | `BRAVO` |
| `QUESTION` | Question | « N réponses » (= commentaires) | Soutenir | `SUPPORT` |
| `INFO` | Info | « N réactions » | J'ai vu | `LIKE` |
| `DISCUSSION` | Discussion | « N réactions » | J'aime | `LIKE` |

Le **conseil n'est pas un type de publication** : c'est une story (§2.6). Le type est choisi **avant** la rédaction (chips au-dessus du composeur). Modifiable jusqu'à la publication, pas après. Une réaction par membre et par publication ; cliquer à nouveau la retire.

### 2.2 Contexte

Chaque publication porte une ligne de contexte construite côté serveur et renvoyée prête à afficher : `« Parcours Études · Lyon · il y a 2 h »`. Composants : `journey_id` → nom du type de parcours (jamais le titre personnel), `city_id` → ville, `journey_step_id` → encart « Étape franchie · N sur M ».

**[RÈGLE DURE]** Le titre personnel d'un parcours (`journeys.title`) n'est jamais exposé dans le fil ; seul le nom du type l'est.

### 2.3 Tri et portée

- Fil global : chronologique inverse, avec **remontée locale** : les publications de la ville du membre et des villes à moins de 30 km sont affichées en premier dans chaque tranche de 24 h. Pas de score d'engagement.
- Filtres facultatifs : type, ville, phase de l'auteur. Aucun filtre n'est appliqué par défaut.
- Fil de réseau : `community_id` renseigné, visible des membres du réseau seulement. Tri chronologique pur.
- Une publication du fil global de type QUESTION dépassant **5 commentaires** affiche à son auteur « Déplacer vers un réseau ? » → création d'un `topic` (module 07) avec le corps et les commentaires copiés, `posts.moved_to_topic_id` renseigné, la publication reste avec un lien « Suite dans le réseau X ». Non automatique.

### 2.4 Composeur

- Capacité `post.create` (L1). Un L0 voit le composeur grisé avec l'invitation à monter de niveau.
- Corps : 1 à 3 000 caractères, Markdown restreint. Jusqu'à 4 images (`post_media`), passées par le pipeline média (EXIF, antivirus).
- Liens sortants rendus `rel="noopener nofollow ugc"` ; aperçu de lien non généré en V1.
- Limite : 10 publications par heure, 30 par jour.
- Modération : passage en file IA à la publication (`moderation_status = PENDING`) ; la publication est **visible immédiatement** sauf verdict `BLOCK` synchrone sur les motifs à blocage automatique (module 13). Un verdict `QUEUE` la laisse visible et ouvre un dossier.
- Modification : 15 minutes après publication, puis figée (mention « modifié »). Suppression logique à tout moment par l'auteur.

### 2.5 Commentaires

Table polymorphe partagée : `subject_type` ∈ POST, TOPIC, GUIDE, EVENT. Une profondeur de réponse (`parent_comment_id` non nul → pas de réponse à une réponse). 1 à 1 000 caractères. Capacité `comment.create` (L0). Limite 60/heure. Modification 15 minutes, suppression logique. Un commentaire sur une QUESTION incrémente `comment_count` qui sert de « N réponses ».

### 2.6 Stories

Le haut du fil est un **bandeau de stories** : contenus courts, plein écran à la lecture, qui vivent **24 heures**. Trois types, un seul composant.

| | `CONSEIL` | `DECOUVERTE` | `INFORMATION` |
|---|---|---|---|
| Contenu | Une recommandation | Un lieu, un produit, une sortie | Un fait daté qui change quelque chose |
| Rattachement obligatoire | Une `step_definition` **ou** un sujet | Ville + catégorie (`LIEU` · `PRODUIT` · `SORTIE`) + `place_label` | Ville + sujet + `place_label` facultatif + `valid_until` facultatif |
| Boutons (réaction positive · négative) | **Utile** · Pas utile | **À voir** · J'y suis allé·e | **Je confirme** · Ça a changé |
| Classement dans le bandeau | Par `score`, boosté à la lecture si lié à l'étape en cours du membre | Par « À voir » | Par fraîcheur |
| Expiration | 24 h | 24 h | 24 h, ou `valid_until` si plus tôt |
| Alimente | La carte de l'étape dans le parcours (« N conseils · le plus utile : … ») | La fiche ville (module 09) si l'auteur la garde : `city_tips.source_story_id` | « Guichets du jour » de la fiche ville si sujet = démarches |

**Création** (capacité `post.create`, L1) en trois étapes côté client, un seul appel API :
1. **Écrire** — éditeur plein écran, texte ≤ 280 caractères, fond couleur (palette de 7) ou image (pipeline média, EXIF supprimées), style de texte (`BOLD` · `SERIF` · `MONO`), sélecteur de type en haut.
2. **Rattacher** — feuille : pour un conseil, les étapes de mon parcours d'abord (l'étape que je viens de franchir présélectionnée) puis les sujets ; pour une découverte, catégorie et lieu ; pour une information, sujet, lieu, date de validité.
3. **Publier** — aperçu, audience (`ALL` · `CITY`), `allow_messages`, rappel « pas de lien, de numéro ni de montant ».

Limite : 3 stories par jour. Modération : même pipeline que les publications ; une `INFORMATION` de sujet démarches ouvre un dossier priorité 2 si verdict `QUEUE`.

**Lecture** : bandeau horizontal, une bulle par auteur ayant des stories actives (pastille du type sous l'avatar, légende, compteur positif), anneau vert = non vue (`story_views`), grise = vue. Première bulle : « Créer une story ». Ordre par défaut : informations, puis conseils, puis découvertes ; chips pour filtrer par type. Plein écran : barres de progression, en-tête (auteur, contexte, pastille, expiration), corps, ligne d'état (« 1er des conseils Logement aujourd'hui · 31 trouvent utile » / « ajoutée aux produits du pays » / « 2 membres confirment »), deux boutons de vote **avec leur compteur**, « Écrire à … » si `allow_messages`, signet. Tap → story suivante ; glisser → auteur suivant.

**Votes** : une réaction par membre et par story, modifiable ; le service refuse un `kind` qui n'appartient pas au type. `score = positive_count − negative_count` recalculé toutes les 15 minutes. Le vote négatif n'a aucun effet de masquage ; à 10 négatifs pour moins de 3 positifs : dossier de modération priorité 4.

**Conversion** : avant expiration, l'auteur peut garder une story — un conseil ou une information de sujet démarches devient une demande d'entraide (`help_requests`, `converted_to`) ; une découverte devient un `city_tips` de kind `SHOP` ou `TIP`. Jamais automatique.

**Expiration** : `story.expire` toutes les 5 minutes → `status = EXPIRED`, retrait du bandeau. Une story expirée reste lisible **pour son auteur** (historique 30 jours) et **pour les membres qui l'ont enregistrée** (signet, tant que le signet existe). `story.purge_history` supprime le reste à 30 jours.

**[RÈGLE DURE]** Aucun compteur de vues, pour personne. Une story expirée n'est renvoyée qu'à son auteur et aux membres qui l'ont enregistrée. Une story ne contient ni lien, ni numéro, ni email (même filtre que partout).

Le bandeau de jalons n'existe plus : « Partager un jalon » reste proposé depuis le parcours (module 03 §3.6) et produit une publication Victoire.

### 2.7 Colonne droite de l'accueil

Quatre blocs, tous calculés : Événements dans ma ville (module 09, 3 prochains) · Nouveaux arrivants (membres `RECENT_ARRIVAL` de ma ville, 14 derniers jours, 3 max, bouton « Saluer » = message privé pré-adressé, si L1) · Alerte vigilance (module 13, `scam_alerts` épinglée pour ma ville ou mon pays) · Parrains et contacts en ligne (contacts avec `last_seen_at` < 10 min).

---

## 3. Données — compléments

| Table | Précision |
|---|---|
| `posts.edited_at` | **Ajoutée** |
| `posts.context_city_distance_km` | Non stockée : calculée à la requête |
| `comments.edited_at` | **Ajoutée** |

---

## 4. API

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/feed` | Fil global. Paramètres `type`, `cityId`, `phase`, `cursor` | |
| GET | `/stories` | Bandeau : `type?`, `cityId`. Renvoie les auteurs avec leurs stories actives et l'état vu/non vu | |
| GET | `/stories/:id` | Story complète ; marque vue | `404` si expirée et ni auteur ni enregistrée |
| POST | `/stories` | `type`, `body`, `backgroundColor` ou `backgroundAssetId`, `textStyle`, `stepDefinitionId` ou `category`, `placeLabel?`, `validUntil?`, `audience`, `allowMessages` | `LEVEL_REQUIRED`, `STORY_LIMIT`, `INVALID_ATTACHMENT`, `CONTENT_BLOCKED` |
| PUT | `/stories/:id/reaction` · DELETE | `kind` | `KIND_NOT_ALLOWED_FOR_TYPE` |
| POST | `/stories/:id/convert` | `target` (HELP_REQUEST · CITY_TIP) | `STORY_EXPIRED`, `ALREADY_CONVERTED` |
| DELETE | `/stories/:id` | | |
| GET | `/me/stories` | Historique 30 jours avec votes reçus | |
| GET | `/feed/sidebar` | Les 4 blocs de la colonne droite | |
| POST | `/posts` | `type` (VICTORY · QUESTION · INFO · DISCUSSION), `body`, `mediaIds[]`, `communityId?`, `journeyId?` | `LEVEL_REQUIRED`, `RATE_LIMITED`, `CONTENT_BLOCKED` |
| GET | `/posts/:id` | Publication + 20 premiers commentaires | `404` si masquée ou auteur bloqué |
| PATCH | `/posts/:id` | `body` (15 min) | `EDIT_WINDOW_CLOSED` |
| DELETE | `/posts/:id` | | |
| PUT | `/posts/:id/reaction` · DELETE | Réaction (le serveur déduit le `kind` du type) | |
| POST | `/posts/:id/move-to-topic` | `communityId` | `NOT_A_QUESTION`, `NOT_ENOUGH_REPLIES`, `NOT_COMMUNITY_MEMBER` |
| GET | `/comments?subjectType&subjectId&cursor` | | |
| POST | `/comments` | `subjectType`, `subjectId`, `body`, `parentCommentId?` | `DEPTH_EXCEEDED` |
| PATCH / DELETE | `/comments/:id` | | |

Toute lecture exclut les auteurs bloqués dans un sens ou l'autre (module 08) et les contenus `HIDDEN`/`REMOVED`.

---

## 5. Écrans

| Écran | Détail |
|---|---|
| Accueil / Fil | Bandeau de stories (bulles par auteur, pastille de type, anneau vu/non vu, « Créer une story ») · composeur (chips Victoire · Question · Info · Discussion, champ, images, Publier) · liste de cartes · colonne droite. États : L0 (composeur grisé), fil vide (« Soyez le premier à Lyon »), chargement, fin de liste |
| Carte de publication | Avatar, nom + badge, pastille de type, ligne de contexte, corps, images, encart d'étape si jalon, compteur au vocabulaire du type, barre d'actions (réaction du type · Commenter · Partager = copier le lien) |
| Détail | Publication + commentaires, réponse à un commentaire (une profondeur) |
| Déplacer vers un réseau | Choix parmi mes réseaux, aperçu, confirmation |
| Story — lecture | Plein écran, barres de progression, en-tête, corps sur fond couleur ou image, ligne d'état, deux boutons avec compteurs, « Écrire à … », signet |
| Story — création | Trois étapes : Écrire (sélecteur de type, éditeur, palette, Aa, Photo, flèche) → Rattacher (feuille) → Publier (aperçu, audience, messages) |

---

## 6. Événements

| Émis | Consommateurs |
|---|---|
| `post.published` | moderation (analyse), search, notifications (mentions futures) |
| `post.reacted` | notifications (regroupées), reputation (aucun effet — les réactions ne comptent pas) |
| `post.commented` | notifications (auteur), journeys (aucun) |
| `post.moved_to_topic` | communities |
| `story.published` / `expired` / `reacted` / `converted` | moderation, journeys (carte d'étape), cities (guichets du jour, tips), help, notifications (`allow_messages`) |
| **Consommés** : `journey.step_completed` (encart), `user.blocked` (exclusion), `moderation.content_hidden` (statut) | |

## 7. Tâches

| Tâche | Fréquence |
|---|---|
| `story.expire` | 5 min |
| `story.score_recompute` | 15 min |
| `story.purge_history` | quotidienne — 30 jours après expiration, sauf enregistrées |

La colonne droite est calculée à la requête avec cache Redis de 5 minutes par ville.

## 8. Gestionnaire de suppression

Publications, images et stories : supprimées (les signets des autres membres affichent « Contenu retiré »). Commentaires : conservés, anonymisés (`author_user_id = null`, affichage « Membre supprimé ») s'ils portent sur un GUIDE ou un TOPIC ; supprimés s'ils portent sur un POST ou un EVENT. Réactions : supprimées, compteurs décrémentés.

## 9. Tests des règles dures

- `rule: le titre personnel d'un parcours n'apparaît jamais dans le fil`
- `rule: le vocabulaire de réaction renvoyé correspond au type de publication`
- `rule: un L0 ne peut pas publier mais peut commenter et réagir`
- `rule: le fil n'applique aucun score d'engagement au tri`
- `rule: le déplacement vers un réseau n'est jamais automatique`
- `rule: une publication d'un membre bloqué n'est jamais renvoyée`
- `rule: une réaction dont le kind n'appartient pas au type de la story est refusée`
- `rule: une story expirée n'est renvoyée qu'à son auteur et aux membres qui l'ont enregistrée`
- `rule: aucune réponse de story ne contient de compteur de vues`
- `rule: une story contenant un lien ou un numéro est refusée`

## Livré — lot G (fil, stories)

- **A02** : la vraie publication (`GET /posts/:id`) à la place de la publication de la maquette ; répondre, modifier (15 min) et supprimer son commentaire (`PATCH`/`DELETE /comments/:id`), réagir, enregistrer, signaler ; « Choisir un réseau » (`POST /posts/:id/move-to-topic`, offert selon `canMoveToTopic`) et « Suite dans le réseau X » ; guides liés et « Lier un guide » (`PATCH /posts/:id`) ; états « contenu en vérification » / « contenu retiré ».
- **A01** : états chargement / erreur / « fil vide » ; `maxLength` sur le composeur et les commentaires (`FEED_LIMITS`) ; poids d'image contrôlé avant l'envoi (`MEDIA_MAX_IMAGE_BYTES`).
- **Stories** : « Mes stories » (`/stories/mes-stories`, `GET /me/stories`, historique 30 jours), « Garder » (`POST /stories/:id/convert`) et « Supprimer » (`DELETE /stories/:id`) depuis la lecture et l'historique.

## Livré — lot W2A (données vives)

- **A01, colonne de droite** : « ÉVÉNEMENTS À {ville du membre} » (`GET /me`) ; la carte « ALERTE VIGILANCE » affiche `scamAlert` de `GET /feed/sidebar` (titre, puis détail) et **n'existe pas** quand le serveur n'en publie aucune ; à 390 px, la carte « Mon parcours » est le parcours actif réel (titre, avancement, étape courante, « Continuer »), ou « Aucun parcours en cours » + « Commencer » comme à 1 440 px.
- Le repli « Lyon » du composeur de story est remplacé : l'onglet de ville porte la ville du membre (`GET /me`), à défaut « Ma ville seulement ».
