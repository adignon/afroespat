# 05 — Guides et Démarches

> Dépend de : `00`, `01`, `02`, `04` (commentaires). Tables : `guides`, `guide_versions`, `guide_votes`, `guide_revision_proposals`, `guide_contributors`, `guide_outdated_flags`.

---

## 1. Périmètre

Guides rédigés par les membres, versionnés, votés par utilité, classés par fraîcheur, corrigés par propositions validées par le créateur, signalés comme obsolètes, dépubliés automatiquement si non corrigés, anonymisés à la suppression du compte. **Aucune rédaction interne** : l'équipe modère, elle n'écrit pas.

---

## 2. Règles métier

### 2.1 Création et publication

- Capacité `guide.write` (L1). Titre 10–120 caractères, corps 300–20 000 caractères en Markdown restreint (titres de niveau 2 et 3 autorisés ici, en plus du sous-ensemble standard).
- Catégorie obligatoire ; `scope` UNIVERSAL ou COUNTRY (alors `origin_country_id` obligatoire) ; ville facultative.
- Brouillon (`DRAFT`) enregistré côté serveur, visible du seul auteur. Publication → `PUBLISHED`, `guide_versions` v1, `last_content_update_at = now`.
- Slug généré depuis le titre, unique, suffixé si conflit, **jamais modifié** après publication.
- Modération à la publication comme pour un post. Limite : 3 guides publiés par jour.
- **[RÈGLE DURE]** Le mot « certifié » et ses dérivés sont rejetés par validation dans le titre et dans les libellés d'interface (pas dans le corps, qui peut citer un document officiel).

### 2.2 Vote

- Un vote par membre et par guide, L1. `HELPFUL` incrémente `helpful_count` et crée un `reputation_events` GUIDE_HELPFUL_VOTE pour l'auteur (et pour chaque contributeur au prorata ? **Non** : pour l'auteur seul ; les contributeurs sont crédités à l'acceptation de leur proposition).
- `NOT_HELPFUL` ne décrémente rien et n'affecte pas le classement. À 5 votes négatifs en 7 jours, un `moderation_cases` source AUTO_RULE est ouvert (priorité 4). L'auteur n'est pas notifié des votes négatifs.
- Retrait du vote : suppression de la ligne et du `reputation_event`.

### 2.3 Classement par fraîcheur

`freshness_score = helpful_count × coeff(âge de last_content_update_at)`

| Âge | Coefficient |
|---|---|
| < 6 mois | 1,0 |
| 6–12 mois | 0,7 |
| 12–24 mois | 0,4 |
| > 24 mois | 0,2 |

Recalcul chaque nuit (`guide.freshness_recompute`). Au-delà de 24 mois, bandeau « À vérifier — dernière mise à jour il y a N mois » en tête du guide. Une proposition acceptée remet `last_content_update_at` à jour et fait remonter le guide.

Onglets : **Les plus utiles** (freshness_score desc) · **Récents** (published_at desc) · **À vérifier** (guides FLAGGED ou > 24 mois, par ancienneté). Filtres : catégorie, pays, ville. Un guide UNIVERSAL apparaît pour tous ; un guide COUNTRY n'apparaît par défaut que pour les membres de ce pays d'origine (filtre modifiable).

### 2.4 Propositions de mise à jour

- Capacité `guide.propose_revision` (L1). Le proposant sélectionne un passage (`target_excerpt`, copié tel quel depuis la version courante), saisit le remplacement et un motif obligatoire (20 caractères minimum), une source facultative.
- Vérification serveur : `target_excerpt` doit exister exactement une fois dans `guide_versions.body` de `base_version_id`. Sinon `EXCERPT_NOT_FOUND` (la version a changé entre-temps).
- Limite : 3 propositions `PENDING` par membre et par guide. Pas de proposition sur son propre guide (on édite directement).
- Le créateur reçoit une notification avec avant/après côte à côte. Actions : **Accepter** (nouvelle version, `source_proposal_id`, contributeur crédité, `reputation_events` GUIDE_CONTRIBUTION), **Accepter en modifiant** (`AMENDED` : le créateur ajuste le texte, contributeur crédité quand même), **Refuser** (motif obligatoire, proposant notifié).
- `escalate_at = created_at + 14 jours`. Passé ce délai sans décision : `ESCALATED`, dossier de modération ouvert (priorité 3), l'équipe accepte ou refuse à la place du créateur.
- Si le guide est `maintained_by_community` : les propositions vont directement en file de modération, sans passer par le créateur.

### 2.5 Maintenu par la communauté

Bascule `maintained_by_community = true` quand : l'auteur n'a pas eu de session depuis 6 mois (`guide.author_inactivity`, hebdomadaire) **ou** le compte est supprimé (anonymisation). L'auteur reste crédité (sauf anonymisation) ; le guide affiche « Maintenu par la communauté ». Réversible si l'auteur revient et le demande.

### 2.6 Obsolescence

- Signalement « L'information a changé » (`guide_outdated_flags`), un par membre et par guide, commentaire facultatif. Distinct du signalement d'abus.
- À **3 signalements** : `status = FLAGGED`, bandeau d'alerte en tête (« Des membres signalent que cette information a changé »), `unpublish_deadline_at = now + 30 jours`, notification au créateur et aux contributeurs, entrée dans « À vérifier ».
- Une proposition **acceptée** pendant le délai : retour à `PUBLISHED`, signalements archivés, `outdated_flag_count = 0`.
- Délai dépassé sans correction : `UNPUBLISHED` (`guide.outdated_unpublish`), conservé en brouillon pour l'auteur, retiré de la recherche. L'auteur peut republier après modification.
- **[RÈGLE DURE]** Un guide `UNPUBLISHED` ou `FLAGGED` depuis plus de 30 jours n'est jamais renvoyé dans les listes publiques ni lié depuis une étape de parcours (l'étape affiche alors « guide en cours de vérification »).

### 2.7 Versions

Chaque acceptation crée une `guide_versions` ; l'auteur peut aussi éditer directement (nouvelle version, `created_by_user_id` = auteur). Historique public : liste des versions avec date, auteur de la version, résumé. **Retour arrière** par l'auteur ou l'équipe : crée une nouvelle version dont le corps est celui de la version choisie (jamais de suppression d'historique).

### 2.8 Conversion depuis un parcours

Depuis un parcours `COMPLETED` (module 03) : « Écrire un guide à partir de mon parcours ». Pré-remplit un brouillon : titre proposé, catégorie déduite, corps = squelette avec une section par étape franchie, durée réelle, et les activités HELP_RECEIVED. Le membre rédige. Rien n'est publié sans son action.

---

## 3. Données — compléments

| Table | Précision |
|---|---|
| `guides.published_at` | **Ajoutée** |
| `guides.view_count` | **Ajoutée**, compteur approximatif (incrément Redis, flush horaire) |
| `guides.source_journey_id` | **Ajoutée**, facultatif — trace de la conversion |
| `guide_versions.revert_of_version_id` | **Ajoutée**, facultatif |

---

## 4. API

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/guides` | `tab` (helpful/recent/review), `category`, `countryId`, `cityId`, `cursor` | |
| GET | `/guides/:slug` | Guide, version courante, contributeurs, mon vote, mon signalement, bandeaux | |
| GET | `/guides/:slug/versions` · `/versions/:id` | Historique | |
| POST | `/guides` | Brouillon | `LEVEL_REQUIRED` |
| PATCH | `/guides/:id` | Brouillon ou édition directe par l'auteur (`body`, `title` si DRAFT, `category`, `scope`, `cityId`) | `FORBIDDEN_WORD` |
| POST | `/guides/:id/publish` | | `CONTENT_BLOCKED` |
| POST | `/guides/:id/unpublish` | Par l'auteur | |
| POST | `/guides/:id/revert` | `versionId` | |
| PUT | `/guides/:id/vote` · DELETE | `value` | `OWN_GUIDE` |
| POST | `/guides/:id/outdated` · DELETE | Signalement d'obsolescence | `ALREADY_FLAGGED` |
| POST | `/guides/:id/proposals` | `targetExcerpt`, `replacement`, `reason`, `sourceUrl?` | `EXCERPT_NOT_FOUND`, `PROPOSAL_LIMIT`, `OWN_GUIDE` |
| GET | `/guides/:id/proposals` | Pour l'auteur : en attente ; pour tous : acceptées | |
| POST | `/proposals/:id/accept` · `/amend` (`replacement`) · `/reject` (`reason`) | Par le créateur | `NOT_AUTHOR`, `ALREADY_DECIDED` |
| GET | `/me/guides` · `/me/proposals` | Mes guides (tous statuts), mes propositions | |
| POST | `/journeys/:id/to-guide` | Pré-remplissage (module 03) | `JOURNEY_NOT_COMPLETED` |

Admin : `/v1/admin/guides` (liste par statut, forcer FLAGGED/UNPUBLISHED/PUBLISHED, traiter les propositions escaladées, retour arrière, basculer « maintenu par la communauté »).

---

## 5. Écrans

| Écran | Détail |
|---|---|
| Liste | Onglets · filtres · cartes : titre, catégorie, pays/ville, auteur + badge, **date de mise à jour aussi visible que le titre**, « N ont trouvé utile », bandeau À vérifier si applicable |
| Guide | Titre, métadonnées, bandeaux (À vérifier / signalé / maintenu par la communauté), corps, contributeurs, vote (« Ce guide vous a-t-il aidé ? Oui / Non »), « Proposer une correction » (sélection de texte → feuille), « L'information a changé », commentaires (module 04), versions |
| Éditeur | Markdown avec aperçu, catégorie, portée, brouillon auto-sauvegardé, bouton Publier avec rappel des règles |
| Proposer une correction | Passage sélectionné (non modifiable), remplacement, motif, source, envoi |
| Mes propositions reçues (auteur) | Avant/après côte à côte, trois boutons, délai restant avant escalade |
| Admin | File des propositions escaladées, guides signalés, actions |

---

## 6. Événements

| Émis | Consommateurs |
|---|---|
| `guide.published` / `unpublished` / `flagged` / `restored` | search, journeys (lien d'étape), notifications |
| `guide.voted` / `vote_removed` | reputation |
| `guide.proposal_created` / `accepted` / `rejected` / `escalated` | notifications, reputation, moderation |
| `guide.version_created` | search |
| **Consommés** : `user.deleted` (anonymisation, bascule communauté), `moderation.content_hidden` | |

## 7. Tâches

| Tâche | Fréquence |
|---|---|
| `guide.freshness_recompute` | quotidienne |
| `guide.proposal_escalation` | quotidienne |
| `guide.outdated_unpublish` | quotidienne |
| `guide.author_inactivity` | hebdomadaire |
| `guide.view_count_flush` | horaire |

## 8. Gestionnaire de suppression

Guides publiés : **conservés**, `author_user_id = null`, `maintained_by_community = true`, versions conservées avec `created_by_user_id = null` sur celles du membre. Brouillons : supprimés. Votes : supprimés (compteurs décrémentés, réputation des auteurs concernés ajustée). Propositions en attente : `REJECTED` motif « compte supprimé » ; acceptées : conservées, `proposer_user_id = null`, ligne `guide_contributors` conservée anonymisée. Signalements d'obsolescence : conservés anonymisés.

## 9. Tests des règles dures

- `rule: un guide FLAGGED depuis plus de 30 jours ou UNPUBLISHED n'est renvoyé dans aucune liste publique`
- `rule: le vote négatif ne modifie ni helpful_count ni freshness_score`
- `rule: une proposition sans décision à 14 jours est escaladée`
- `rule: l'acceptation d'une proposition crée une version et crédite le contributeur`
- `rule: le mot certifié est rejeté dans un titre de guide`
- `rule: la suppression du compte anonymise les guides publiés au lieu de les supprimer`
- `rule: la date de dernière mise à jour est renvoyée sur chaque guide de liste`

## Livré — lot G (guides)

- **A06** : zéro, une ou N propositions (plus d'emplacements fixes), onglets En attente / Acceptées / Refusées réels, diff avant/après mot à mot. La route ne rend pas les refusées ni le nom de section.
- **A05** : « Partir d'un parcours » — choix du parcours terminé source (`POST /journeys/:id/to-guide`), puis ouverture du brouillon pré-rempli.
- **`guides.view_count`** : conservé sans lecteur, par décision (§5 exige colonne et tâche `guide.view_count_flush`, 00 §1.2 interdit de l'exposer).
- Les guides passent par le pipeline de modération (13 §14) : règles locales à la publication, analyse IA asynchrone après `guide.published`.
