# 13 — Modération et sécurité

> Dépend de : `00`, `01`, `15`. Tables : `reports`, `moderation_cases`, `moderation_actions`, `sanctions`, `scam_alerts`, `ai_moderation_checks`.

---

## 1. Périmètre

Signalements des membres, pré-filtrage IA à la publication, dossiers priorisés avec délai de traitement, actions et sanctions à décision humaine, alertes arnaques, règles automatiques, journal. La modération protège d'abord le segment pré-départ, cible privilégiée des arnaques.

---

## 2. Pipeline à la publication

Tout contenu textuel créé par un membre (post, commentaire, guide, demande, réponse, sujet, annonce, offre, fiche pro, tip, événement, message signalé) passe par `ModerationService.check()` :

1. **Règles locales synchrones** (regex, listes) : coordonnées bancaires (IBAN, numéro de carte), montants + verbes de paiement en contexte de démarche, liens vers des plateformes de paiement. Résultat `BLOCK` immédiat → contenu non publié, `code: CONTENT_BLOCKED` avec motif générique, dossier priorité 1.
2. **Masquage** (`redactForModeration`) : numéros de téléphone, emails, noms propres détectés (dictionnaire de prénoms + majuscules hors début de phrase) remplacés par des jetons `[TEL]`, `[EMAIL]`, `[NOM]`.
3. **Analyse IA asynchrone** (file `moderation`, modèle léger, température 0) avec un prompt de classification renvoyant des étiquettes parmi : `SCAM`, `MONEY_REQUEST`, `HARASSMENT`, `HATE`, `SEXUAL`, `SPAM`, `SELF_HARM`, `OFF_TOPIC`, `OK` et un score 0–1. Verdict : `ALLOW` (score < 0,3), `QUEUE` (0,3–0,8 → dossier, contenu visible), `BLOCK` (> 0,8 sur SCAM, MONEY_REQUEST, HATE, SEXUAL → contenu masqué `HIDDEN`, dossier priorité 1, auteur informé « en vérification »).
4. Trace dans `ai_moderation_checks` (texte masqué **non stocké**, seulement étiquettes, score, latence).

**[RÈGLE DURE]** L'IA ne suspend jamais un compte et ne supprime jamais définitivement un contenu. Elle masque et met en file ; un humain tranche.

**[RÈGLE DURE]** Le texte envoyé à l'API IA est toujours passé par `redactForModeration`. Un test vérifie qu'un numéro de téléphone et un email ne quittent pas le serveur.

`SELF_HARM` : pas de blocage, dossier priorité 1 avec consigne « bienveillance », et affichage automatique à l'auteur d'un encart vers la page de ressources professionnelles (module 15, `static_pages/ressources`). Aucune autre action automatique.

---

## 3. Signalements

- Un clic sur tout contenu et tout profil. Motifs : `SCAM`, `MONEY_REQUEST`, `HARASSMENT`, `SPAM`, `INAPPROPRIATE`, `OTHER` (+ détails ≤ 500). Un signalement par membre et par sujet.
- Le signalement d'un **message privé** joint la conversation au dossier (les modérateurs peuvent alors la lire — c'est pourquoi il n'y a pas de chiffrement de bout en bout).
- Un signalement crée ou rejoint le `moderation_cases` du sujet (un dossier par sujet ouvert). Priorité initiale selon motif et type de sujet :

| Priorité | Cas |
|---|---|
| 1 | Arnaque ou demande d'argent sur logement, parrainage, entraide ; contenu bloqué par l'IA ; `SELF_HARM` |
| 2 | Harcèlement ; annonce logement à score moyen ; blocage pendant un parrainage ; story `INFORMATION` de sujet démarches en verdict `QUEUE` |
| 3 | Spam ; propositions de guide escaladées ; abus de blocage |
| 4 | Inapproprié, hors sujet, votes négatifs répétés |
| 5 | Autre |

Le signaleur reçoit une confirmation, puis une notification quand le dossier est clos (« Merci, nous avons traité votre signalement » — sans détail de la décision).

Abus de signalement : un membre dont 10 signalements consécutifs sont classés `DISMISSED` voit ses signalements suivants rétrogradés en priorité 5 et un dossier AUTO_RULE ouvert.

---

## 4. Dossiers et traitement

### 4.1 File

Une file unique, triée par priorité puis `sla_due_at`. `sla_due_at = created_at + 24 h` (priorité 1 : 4 h). Assignation à un modérateur (`assigned_staff_id`) ; un dossier assigné depuis 2 h sans action revient en file.

### 4.2 Actions

| Action | Effet |
|---|---|
| `KEEP` / `DISMISS` | Contenu conservé ou rétabli ; signalements `DISMISSED` |
| `HIDE` / `UNHIDE` | `status = HIDDEN` sur le contenu (invisible sauf pour l'auteur, avec mention) |
| `REMOVE` | `status = REMOVED`, auteur notifié avec motif |
| `WARN` | `sanctions` WARNING, notification avec règle enfreinte |
| `SUSPEND_USER` | `sanctions` SUSPENSION avec durée (1, 7, 30 jours) ; `users.status = SUSPENDED` ; sessions révoquées ; capacités d'écriture retirées ; contenus conservés |
| `BAN_USER` | `SUPER_ADMIN` seulement ; `sanctions` BAN ; compte désactivé définitivement ; numéros conservés en liste noire (empreinte HMAC) pour empêcher la réinscription |
| `NOTE` | Note interne |

Chaque action → `moderation_actions` + `audit_logs`. Une suspension ou un bannissement exige un **motif d'au moins 20 caractères**.

### 4.3 Recours

Le membre sanctionné peut contester une fois (formulaire, ≤ 1 000 caractères) → rouvre le dossier en priorité 3 pour un **autre** modérateur. Décision finale non contestable.

### 4.4 Règles automatiques (AUTO_RULE)

| Règle | Seuil | Effet |
|---|---|---|
| Abus de blocage | 20 blocages / 30 jours | Dossier priorité 3 |
| Votes négatifs répétés sur un guide | 5 / 7 jours | Dossier priorité 4 |
| Story à 10 votes négatifs pour moins de 3 positifs | — | Dossier priorité 4 |
| Recommandations pro réciproques | 2 dans les 7 jours | Dossier priorité 4 |
| Annonce logement à risque | score 0,4–0,7 | Dossier priorité 2 ; ≥ 0,7 → priorité 1 + non publiée |
| Abus de signalement | 10 rejets consécutifs | Dossier priorité 3 |
| Nouveau compte à forte activité | 20 publications le premier jour | Dossier priorité 3 |

Seuils dans `system_settings`, modifiables sans déploiement.

---

## 5. Alertes arnaques

Rédigées par l'équipe (`scam_alerts`) : titre, corps, gravité, ville ou pays cible (ou global), épinglée ou non, expiration. Une alerte épinglée apparaît dans la colonne droite de l'accueil, en tête de la section Logement si elle concerne le logement, et en tête des guides « Alertes arnaques ». Liée facultativement au dossier qui l'a motivée. Historique public des alertes (page dédiée).

---

## 6. Modérateurs bénévoles

Membres nommés par l'équipe sur un réseau ou une ville (`community_members.role = MODERATOR`). Ils peuvent masquer et épingler dans leur périmètre, retirer un membre d'un réseau d'intérêt, et **signaler avec priorité +1** vers l'équipe. Ils ne voient pas la file de modération, ne sanctionnent pas, n'accèdent pas aux messages privés. Leurs actions sont journalisées avec `actor_type = MEMBER`.

---

## 7. Données — compléments

| Table | Précision |
|---|---|
| `moderation_cases.appeal_text`, `appealed_at`, `appeal_reviewer_staff_id` | **Ajoutées** |
| `moderation_cases.conversation_id` | **Ajoutée** — jointe si le sujet est un message |
| `sanctions.appealed` | **Ajoutée** |
| `banned_phone_hashes` | **Table ajoutée** (socle `append`) : `phone_hmac`, `sanction_id` |
| `reports.dismissed_streak` | Non stockée : calculée |

---

## 8. API

### 8.1 Membres

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/reports` | `subjectType`, `subjectId`, `reason`, `details?` — `ALREADY_REPORTED` |
| GET | `/me/sanctions` | Mes avertissements et suspensions, avec règle enfreinte |
| POST | `/sanctions/:id/appeal` | `text` — `ALREADY_APPEALED` |
| GET | `/scam-alerts?cityId&countryId` | Alertes actives |

### 8.2 Équipe (`/v1/admin/moderation/*`, rôle `MODERATOR` sauf mention)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/cases?status&priority&assigned&subjectType` | File |
| GET | `/cases/:id` | Dossier : sujet (contenu complet), signalements, analyse IA, historique de l'auteur (sanctions, dossiers), conversation si jointe |
| POST | `/cases/:id/assign` · `/release` | |
| POST | `/cases/:id/actions` | `action`, `reason`, `duration?` — BAN réservé SUPER_ADMIN |
| GET | `/users/:id/moderation-history` | |
| CRUD | `/scam-alerts` | `CONTENT_ADMIN` |
| GET/PUT | `/settings` | Seuils des règles automatiques |
| GET | `/stats` | Délai moyen, dossiers par priorité, respect du SLA |

---

## 9. Écrans

| Écran | Détail |
|---|---|
| Signaler (membre) | Feuille : motif, détails, confirmation. Sur un message : mention que la conversation sera visible des modérateurs |
| Mes sanctions | Liste, règle, contestation |
| Contenu masqué (auteur) | Mention « Ce contenu est en vérification » sur ses propres contenus HIDDEN |
| File (admin) | Tableau trié, filtres, indicateur SLA (vert/ambre/dépassé), assignation en un clic |
| Dossier (admin) | Trois colonnes : contenu · contexte de l'auteur · actions avec motif obligatoire ; conversation dépliable si jointe |
| Alertes arnaques (admin) | Éditeur, ciblage, épinglage, aperçu |
| Réglages (admin) | Seuils, poids du score de risque logement, listes de termes |

---

## 10. Événements

| Émis | Consommateurs |
|---|---|
| `moderation.content_hidden` / `restored` / `removed` | tous les modules de contenu (statut), search |
| `moderation.user_suspended` / `banned` / `reinstated` | users (statut, sessions), notifications |
| `moderation.case_opened` / `resolved` | notifications (signaleur, auteur), analytics |
| `scam_alert.published` | notifications (ville/pays), feed |
| **Consommés** : tout `*.published` (analyse), `user.blocked` (règle), `guide.voted` (règle), `pro.recommended` (règle), `housing.published` (score) | |

## 11. Tâches

| Tâche | Fréquence |
|---|---|
| `moderation.sla_alert` | 15 min — alerte équipe (email) si un dossier priorité 1 dépasse 4 h |
| `moderation.release_stale` | horaire — dossiers assignés sans action depuis 2 h |
| `sanctions.expire` | horaire — fin de suspension → `ACTIVE` + notification |
| `scam_alerts.expire` | quotidienne |
| `moderation.purge_reports` | quotidienne (3 ans) |

## 12. Gestionnaire de suppression

Signalements émis : conservés anonymisés. Dossiers où le membre est l'auteur : conservés anonymisés (obligation de traçabilité). Sanctions : conservées anonymisées ; `banned_phone_hashes` conservée (un banni supprimé reste banni). Contestations : conservées anonymisées.

## 13. Tests des règles dures

- `rule: un numéro de téléphone et un email ne sont jamais envoyés à l'API IA`
- `rule: l'IA ne peut ni suspendre un compte ni supprimer définitivement un contenu`
- `rule: une suspension ou un bannissement exige un staff et un motif`
- `rule: un dossier priorité 1 a un SLA de 4 heures`
- `rule: une contestation est traitée par un modérateur différent`
- `rule: un numéro banni ne peut pas se réinscrire`
- `rule: un modérateur bénévole ne peut pas lire une conversation privée`

## 14. Livré — le pipeline couvre tous les contenus publiés (lot G)

- **Un seul pipeline.** `ModerationService.handleContentPublished` relit le texte depuis sa table pour : publications, commentaires (fil, réponses de sujet de réseau, guides, événements), stories, guides (titre + pages), annonces logement, offres d'emploi, fiches pro, astuces de ville, sujets de réseau, demandes et événements (déjà là). Abonnements : `post.published`, `post.commented`, `story.published`, `guide.published`, `housing.published`, `job.published`, `pro.registered`, `city_tip.published`, `community.topic_created`.
- **Étape 1 synchrone, une seule source.** Les règles locales sont `matchLocalRule` (`@app/shared`) ; les copies du fil et de l'entraide ont disparu. Les modules qui refusent à la création : fil, entraide, guides (`ModerationService.gate`, dossier priorité 1), logement, emploi, fiches pro, astuces, sujets et annonces de réseau (`assertLocalRules`). Les guides n'appellent plus le fournisseur d'IA : l'analyse passe par `guide.published`.
- **Effets** (`ModerationEffectsService`) : `moderation.content_hidden / restored / removed` sont appliqués sur chaque type (guide `UNPUBLISHED`, annonce `moderation_status = PENDING`, offre/fiche `REMOVED`, astuce `HIDDEN`, sujet `deleted_at`, entraide `FLAGGED`, fil via `FeedService`). Table `moderation_hides` : l'état d'avant, pour qu'un rétablissement ne ressuscite jamais un contenu supprimé par son auteur ni ne lève un blocage de risque.
- **Types de sujet ajoutés** : `STORY`, `CITY_TIP` (`ReportSubjectType`).
- **Auteur** : `GET /posts/:id` rend `moderationState` — `IN_REVIEW` (« contenu en vérification ») ou `REMOVED` (« contenu retiré », corps vide) — à l'auteur seul ; `404` pour les autres.
- **`moderation.sla_alert`** écrit une `staff_alerts` par compte équipe actif (MODERATOR, CONTENT_ADMIN, SUPER_ADMIN) et par dossier prioritaire hors délai ; routes `GET /admin/moderation/alerts`, `POST /admin/moderation/alerts/:id/read`.
- **Non touché** : le cas MONEY_REQUEST des conversations de parrainage (lot D).
