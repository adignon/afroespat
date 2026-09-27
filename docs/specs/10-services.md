# 10 — Services : logement, emploi, annuaire professionnel

> Dépend de : `00`, `01`, `02`, `08`, `13`, `14`. Tables : `housing_listings`, `housing_photos`, `job_listings`, `job_seeker_profiles`, `member_recommendations`, `pro_profiles`, `pro_profile_cities`, `pro_recommendations`, `pro_contact_logs`, `saved_alerts`.

---

## 1. Périmètre

Annonces de logement (publication L2, score de risque), offres et recherches d'emploi, annuaire professionnel avec justificatif et recommandations conditionnées au contact réel, alertes personnalisées (Premium), quota de contact des fiches pro.

---

## 2. Logement

### 2.1 Publication

- Capacité `housing.publish` (**L2, sans exception**). Un L1 voit le formulaire grisé avec l'explication : « Publier un logement demande un numéro français vérifié — c'est ce qui protège tout le monde des fausses annonces. »
- Kinds offre : `RENT`, `FLATSHARE`, `SUBLET`, `TEMPORARY` ; kinds recherche : `SEEKING_HOUSING`, `SEEKING_FLATMATE`. Les recherches sont aussi L2 (cohérence : on ne met en relation que des personnes présentes).
- Champs : titre 10–120, description 50–3 000, ville, quartier libre, `price_cents` (obligatoire pour une offre, `null` accepté pour TEMPORARY gratuit), meublé, disponible à partir de, durée en mois, 1 à 8 photos (offre : au moins 1).
- Durée de vie 60 jours (`expires_at`), renouvelable par l'auteur (une fois par 30 jours, sans repasser en modération). Statuts : `ACTIVE`, `PAUSED`, `TAKEN` (« Logement trouvé »), `EXPIRED`, `REMOVED`.
- 3 annonces actives maximum par membre.

### 2.2 Score de risque

Calculé à la publication et à chaque modification, stocké dans `risk_score` (0–1) et `risk_flags` :

| Signal | Poids |
|---|---|
| Prix inférieur de 40 % à la médiane des annonces actives du même kind dans la ville (ou hors bornes absolues configurées) | 0,5 |
| Membre L2 depuis moins de 7 jours | 0,2 |
| Description contenant un lien externe, une adresse email ou un numéro | 0,2 |
| Termes détectés par la modération IA (acompte, virement, Western Union, mandat, « sans visite ») | 0,4 |
| Photos identiques à une autre annonce (empreinte perceptuelle) | 0,5 |
| Première annonce du membre | 0,1 |

- `≥ 0,7` : annonce **non publiée**, dossier de modération priorité 1, auteur informé « en vérification ».
- `0,4–0,7` : publiée avec dossier de modération priorité 2 ; l'interface ajoute un rappel de prudence renforcé sur l'annonce.
- `< 0,4` : publiée.

**[RÈGLE DURE]** Le bandeau « Aucun versement avant visite ou vérification. Si une annonce demande un acompte à distance, signalez-la. » est renvoyé par l'API sur chaque liste et chaque annonce, et affiché en permanence.

### 2.3 Contact

Bouton « Contacter » → conversation directe (L1 minimum pour écrire — un L0 pré-départ peut **lire** les annonces mais doit passer par un parrain ou un accompagnant pour contacter ; l'interface le dit et propose de demander un parrain). `contact_count++`. L'auteur peut masquer son annonce à un membre (blocage léger local, sans blocage global).

### 2.4 Recherche et alertes

Filtres : kind, ville (+ 30 km), budget max, meublé, disponible à partir de, durée. Tri : date, prix. `saved_alerts` kind HOUSING (**Premium**) : critères enregistrés, notification à chaque nouvelle annonce correspondante (regroupement : au plus une notification par heure).

---

## 3. Emploi

### 3.1 Offres

- Capacité `job.publish` (L1). Kinds : `JOB`, `INTERNSHIP`, `APPRENTICESHIP`, `GIG`. Champs : titre, description, entreprise, ville (facultative = national/télétravail), type de contrat, secteur, niveau d'études, lien externe facultatif. Durée 45 jours, renouvelable.
- Une offre partagée par un membre est **gratuite** et affichée comme telle (« Partagée par Sandra M. »).
- **Sponsorisée** (`is_sponsored`, Premium) : mise en avant en tête des listes pendant 14 jours, pastille « Sponsorisée » **toujours visible**, notification ciblée aux `job_seeker_profiles` correspondants (secteur, ville). Au plus 5 offres sponsorisées par membre et par mois.
- Les offres passent par la modération IA (arnaques à l'emploi : frais d'inscription, formation payante obligatoire → `MONEY_REQUEST`).

### 3.2 Profils disponibles

`job_seeker_profiles` : titre (« Développeuse web, disponible septembre »), secteurs, types de contrat, visible/invisible. Liste filtrable par ville, secteur. Contact via messagerie. Aucun CV stocké en V1 ; le membre l'envoie lui-même en message s'il le souhaite (image ou lien).

### 3.3 Recommander un membre

`member_recommendations` : depuis le profil d'un membre ou depuis une offre, « Recommander X pour cette offre » avec commentaire. Visible sur le profil du recommandé (« Recommandé·e par 3 membres ») et notifié à l'auteur de l'offre. Aucun effet de réputation en V1 (évite les recommandations de complaisance).

---

## 4. Annuaire professionnel

### 4.1 Référencement

- Capacité `pro.register` (**L2**) + **justificatif d'activité** (`proof_asset_id` : extrait SIRENE, attestation URSSAF, carte professionnelle — image ou PDF, accès équipe uniquement) + `siret` facultatif. `verification_status = PENDING` jusqu'à validation humaine (module 15) ; la fiche est invisible avant.
- Une seule fiche par membre. Champs : métier (`professions`), nom commercial, description ≤ 1 500, tarifs indicatifs libres, méthode de contact (`PLATFORM_MESSAGE`, `EMAIL`, `PHONE_ON_REQUEST` — le téléphone n'est **jamais** stocké ici ni affiché ; « sur demande » signifie que le pro le communique lui-même en message), langues (du profil), villes couvertes (1 à 10).
- `tier` : `FREE` (fiche simple), `PRO` (~25 €/mois), `PRO_PLUS` (~40 €/mois) — voir module 14. Un abonnement expiré rétrograde en `FREE` sans supprimer la fiche.

### 4.2 Classement

Tri par défaut : **pertinence puis recommandations**, jamais purement payant. Les fiches `PRO`/`PRO_PLUS` obtiennent un emplacement mis en avant **clairement signalé** (« Fiche mise en avant ») : au plus 2 fiches mises en avant en tête, puis le classement naturel. `PRO_PLUS` apparaît aussi dans les résultats de la recherche globale.

### 4.3 Recommandations

`pro_recommendations` : capacité L1, **uniquement si une `connection` existe** entre le membre et le pro (`connection_id` obligatoire, vérifié). Une par membre et par pro, commentaire ≤ 500. Affichées avec le handle du recommandeur. Retirable. Un pro ne peut pas recommander lui-même ni ses contacts « en boucle » (une recommandation réciproque dans les 7 jours est acceptée mais marquée pour revue AUTO_RULE priorité 4).

### 4.4 Contact et quota

Bouton « Contacter » → conversation directe. `pro_contact_logs` : **3 contacts distincts par mois en gratuit** (`usage_counters` PRO_CONTACTS), illimité en Premium. Recontacter un pro déjà contacté ce mois-ci ne consomme pas. Au-delà : `PLAN_LIMIT_REACHED` avec invitation Premium, et la conversation existante reste ouverte.

---

## 5. Données — compléments

| Table | Précision |
|---|---|
| `housing_listings.renewed_at`, `renew_count` | **Ajoutées** |
| `housing_listings.photo_hashes` | **Ajoutée**, text[] — empreintes perceptuelles |
| `housing_listings.hidden_from_user_ids` | **Ajoutée**, uuid[] — masquage local |
| `job_listings.renewed_at`, `sponsored_count_month` | **Ajoutées** |
| `pro_profiles.approved_at`, `approved_by_staff_id`, `rejection_reason` | **Ajoutées** |
| `saved_alerts.match_count` | **Ajoutée** |

---

## 6. API

### 6.1 Logement

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/housing` | Filtres + `safetyBanner` dans la réponse | |
| GET | `/housing/:id` | | `404` si non publiée ou bloqué |
| POST | `/housing` | | `LEVEL_REQUIRED` (L2), `MAX_ACTIVE_LISTINGS`, `LISTING_UNDER_REVIEW` (score ≥ 0,7) |
| PATCH | `/housing/:id` · POST `/renew` · `/pause` · `/taken` · DELETE | | `RENEW_TOO_SOON` |
| POST | `/housing/:id/contact` | Ouvre la conversation | `LEVEL_REQUIRED` (L0 → message d'orientation vers le parrainage) |
| POST | `/housing/:id/hide-from` | `userId` | |

### 6.2 Emploi

| Méthode | Route | Rôle |
|---|---|---|
| GET/POST | `/jobs` · GET/PATCH/DELETE `/jobs/:id` · POST `/renew` | `SPONSORED_LIMIT`, `LEVEL_REQUIRED` |
| POST | `/jobs/:id/sponsor` | Premium |
| GET/PUT | `/me/job-seeker-profile` · GET `/job-seekers` | |
| POST | `/recommendations/members` | `toHandle`, `jobId?`, `comment` |

### 6.3 Annuaire

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/pros` | `professionId`, `cityId`, `languageId`, `q` ; réponse avec `featured[]` (≤ 2) puis `items[]` | |
| GET | `/pros/:id` | Fiche, recommandations, mutual connections | |
| GET/PUT | `/me/pro-profile` · POST `/me/pro-profile/proof` | Création et justificatif | `LEVEL_REQUIRED`, `PROOF_REQUIRED` |
| POST | `/pros/:id/contact` | | `PLAN_LIMIT_REACHED` |
| POST/DELETE | `/pros/:id/recommend` | | `CONNECTION_REQUIRED`, `OWN_PROFILE` |

### 6.4 Alertes

| Méthode | Route |
|---|---|
| GET/POST/PATCH/DELETE | `/me/alerts` — `PLAN_REQUIRED` |

Admin : validation des justificatifs (`/v1/admin/pros/pending`, approuver/rejeter avec motif), file des annonces à risque, réglage des bornes de prix et des poids.

---

## 7. Écrans

| Écran | Détail |
|---|---|
| Panneau Services | Annonces logement · Bourses et emploi · Annuaire professionnel · Mes annonces · Mes alertes (badge Premium) · encart « Vous exercez un métier ? » |
| Logement — liste | Titre, sous-titre (« 12 annonces à Lyon · publication réservée aux profils vérifiés »), bouton Publier (grisé + explication si < L2), chips, **bandeau de sécurité**, grille de cartes (photo, kind, prix, titre, détail, auteur + badge), un encart partenaire au maximum en bas (module 14) |
| Logement — annonce | Galerie, infos, auteur, « Connecté·e à N de vos contacts », Contacter, Signaler, rappel de prudence (renforcé si score moyen) |
| Publier un logement | Formulaire, photos, aperçu du score de risque **non affiché** (interne), message « en vérification » si bloquée |
| Emploi | Liste (sponsorisées en tête, pastille), profils disponibles, mon profil de recherche, publier |
| Annuaire | Recherche par métier + ville, fiches mises en avant signalées, fiche pro (recommandations, contact avec compteur de quota) |
| Créer ma fiche pro | Conditions (L2 + justificatif), formulaire, dépôt du justificatif, statut « en attente de validation » |
| Mes alertes | Critères, activer/désactiver, badge Premium |

---

## 8. Événements

| Émis | Consommateurs |
|---|---|
| `housing.published` / `updated` / `expired` / `taken` | search, moderation (score), alerts |
| `housing.contacted` | analytics |
| `job.published` / `sponsored` | search, notifications (job seekers), moderation |
| `pro.registered` / `approved` / `rejected` / `tier_changed` | search, notifications, admin |
| `pro.contacted` | usage counters |
| `pro.recommended` | notifications |
| **Consommés** : `connection.created/removed` (recommandations), `subscription.changed` (tiers, quotas), `user.blocked`, `blocker.published` (SEEKING depuis un parcours) | |

## 9. Tâches

| Tâche | Fréquence |
|---|---|
| `listing.expire` | quotidienne — logement 60 j, emploi 45 j, rappel J−5 à l'auteur |
| `housing.price_median_recompute` | quotidienne par ville et kind |
| `alerts.dispatch` | horaire — regroupe les correspondances |
| `pro.tier_expire` | quotidienne |
| `sponsored.expire` | quotidienne (14 jours) |

## 10. Gestionnaire de suppression

Annonces logement et emploi : supprimées. Profil de recherche : supprimé. Fiche pro : supprimée, **justificatif détruit**, recommandations reçues supprimées ; recommandations données par le membre : supprimées. Alertes : supprimées. Journaux de contact : anonymisés (conservés pour les quotas des autres membres).

## 11. Tests des règles dures

- `rule: une annonce logement ne peut être créée qu'en L2`
- `rule: le bandeau de sécurité est présent dans chaque réponse de liste et de détail logement`
- `rule: une annonce à score ≥ 0,7 n'est jamais publiée sans décision humaine`
- `rule: une recommandation pro exige une connexion existante`
- `rule: le quota de 3 contacts pro par mois est appliqué côté serveur`
- `rule: une offre sponsorisée porte toujours la pastille et n'occupe jamais plus de 2 emplacements de tête`
- `rule: le téléphone n'est jamais stocké ni renvoyé sur une fiche pro`
