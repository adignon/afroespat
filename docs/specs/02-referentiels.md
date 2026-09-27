# 02 — Référentiels

> Dépend de : `00-fondations.md`. Tables : `countries`, `cities`, `languages`, `skills`, `professions`.

---

## 1. Périmètre

Données de référence administrées par l'équipe et lues par tous les modules : pays, villes, langues, compétences, métiers. Aucune écriture par les membres. Ce module porte aussi la logique **mono-pays au lancement**.

---

## 2. Règles métier

### 2.1 Pays

| Règle | Détail |
|---|---|
| `kind` | `ORIGIN` (pays d'origine possible), `DESTINATION` (pays d'installation), `BOTH` |
| `is_active` | Un pays inactif n'apparaît nulle part côté membres : ni à l'inscription, ni dans les filtres, ni sur la carte. Son indicatif est refusé à l'OTP |
| Lancement | Un seul pays `ORIGIN` actif et un seul `DESTINATION` actif (France). Activer un second pays d'origine est une décision produit, prise en back-office, sans déploiement |
| Effet de l'activation | Création automatique du `community` COUNTRY, apparition dans les filtres, éligibilité des indicatifs. Rien n'est rétroactif sur les membres existants |
| Désactivation | Interdite si des membres ont ce pays d'origine ; on masque (`is_active = false`) sans supprimer |

### 2.2 Villes

| Règle | Détail |
|---|---|
| Rattachement | Une ville appartient à un pays `DESTINATION` ou `BOTH`. Les villes du pays d'origine ne sont pas modélisées en V1 |
| Activation | Une ville inactive est sélectionnable à l'inscription (le membre doit pouvoir indiquer où il vit) mais n'a ni réseau, ni carte, ni fiche. Elle passe active quand l'équipe le décide, en général à 20 membres |
| Réseau automatique | À l'activation : création du `community` CITY. Les membres déjà rattachés y sont inscrits par événement |
| Fusion | `merged_into_city_id` redirige tous les membres et contenus vers la ville cible ; l'ancienne devient invisible. Irréversible |
| Coordonnées | Latitude/longitude du centre-ville, saisies à la main. Servent au tri par proximité (haversine) et aux compteurs « à moins de 30 km » |
| `member_count` | Recalculé chaque nuit : membres actifs avec `city_id` = cette ville. Utilisé par la carte |
| Distance | « Près de chez vous » = même ville, puis villes dans un rayon de 30 km, puis même région |

### 2.3 Langues, compétences, métiers

- Listes fermées, administrées. Un membre ne peut pas créer une valeur ; il peut la **suggérer** (formulaire libre envoyé à l'équipe, sans stockage structuré — simple email/ticket).
- `skills` : 60 à 80 entrées de départ, catégorisées (numérique, santé, commerce, artisanat, enseignement, droit, finance, restauration…).
- `professions` : liste de l'annuaire pro, plus restreinte que `skills` (40 métiers), avec catégorie.
- Une entrée `is_active = false` reste affichée sur les profils qui l'ont déjà, mais n'est plus proposée.

---

## 3. Données — compléments

| Table | Précision |
|---|---|
| `cities.postal_prefix` | **Colonne ajoutée**, texte, facultatif — aide à la saisie |
| `cities.activated_at` | **Colonne ajoutée** |
| `countries.default_city_id` | **Colonne ajoutée** — ville proposée par défaut à l'onboarding pour ce pays de destination |

---

## 4. API

### 4.1 Membres (lecture seule, mise en cache 1 h)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/ref/countries` | Pays actifs, avec `kind`, `dialCode`, `iso2`. Paramètre `kind` |
| GET | `/ref/cities` | Villes actives d'un pays. Paramètres `countryId`, `q` (préfixe, insensible aux accents), `nearCityId` + `radiusKm` |
| GET | `/ref/cities/:slug` | Ville + `memberCount` + `communityId` + compteurs par pays d'origine |
| GET | `/ref/languages` · `/ref/skills` · `/ref/professions` | Listes actives |
| POST | `/ref/suggestions` | Suggestion libre (`kind`, `label`) → notification équipe, limite 5/jour |

### 4.2 Administration (`/v1/admin/ref/*`, rôle `CONTENT_ADMIN`)

| Méthode | Route | Rôle |
|---|---|---|
| CRUD | `/countries`, `/cities`, `/languages`, `/skills`, `/professions` | Création, modification, activation/désactivation |
| POST | `/cities/:id/merge` | `targetCityId` — fusion, confirmation explicite, journal d'audit |
| POST | `/cities/:id/activate` | Crée le réseau, inscrit les membres |
| POST | `/countries/:id/activate` | Idem pour un pays |
| POST | `/cities/import` | CSV (nom, région, lat, lon, pays) |

Chaque écriture admin → `audit_logs`.

---

## 5. Écrans

**Membres :** sélecteurs de pays et de ville (recherche par préfixe, villes actives en tête, inactives en gris avec la mention « bientôt »). Carte de France (module 09) consommant `/ref/cities`.

**Admin :** liste des pays avec statut et compteurs ; liste des villes avec `member_count`, statut, actions (activer, fusionner, éditer) ; import CSV ; listes langues/compétences/métiers avec réordonnancement.

---

## 6. Événements

| Émis | Consommateurs |
|---|---|
| `country.activated` | communities (réseau pays) |
| `city.activated` | communities (réseau ville), notifications (membres de la ville) |
| `city.merged` | users, communities, listings, events, search (réécriture des `city_id`) |

## 7. Tâches

| Tâche | Fréquence |
|---|---|
| `city.member_count_recompute` | quotidienne |
| `city.activation_suggest` | hebdomadaire — signale à l'équipe les villes inactives à plus de 20 membres |

## 8. Suppression de compte

Aucune donnée membre dans ce module. Pas de gestionnaire.

## 9. Tests des règles dures

- `rule: un pays inactif n'est proposé nulle part et son indicatif est refusé`
- `rule: la fusion de villes réécrit toutes les références et rend l'ancienne invisible`
- `rule: l'activation d'une ville crée son réseau et y inscrit les membres existants`
