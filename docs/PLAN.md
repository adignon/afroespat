# Plan d'intégration et de développement

> Lu après `PROJECT.md`. Ce document ne redéfinit rien : il ordonne la construction de ce que les specs ont figé, comble les trous du dossier et corrige l'ordre des lots là où il est infaisable en l'état.
>
> Source : `00-fondations.md` §12 (lots), `T5-pages-et-prompts.md` (écrans), `docs/template/` (maquettes).

---

## 1. État des lieux

### Ce qui est prêt

| Actif | Volume | Qualité |
|---|---|---|
| Spécifications fonctionnelles | 22 fichiers, ~1,2 Mo | Complètes, gabarit uniforme, 46 **[RÈGLE DURE]** nommées |
| Modèle relationnel | 105 tables, 16 modules, diagrammes Mermaid + canevas interactif | Source de vérité, indépendant de l'ORM |
| Surface d'API décrite | ~226 routes réparties sur 24 modules | Conventions, erreurs, pagination, idempotence figées |
| Maquettes | 88 écrans dans 14 fichiers `.dc.html`, variantes mobile 390 px incluses sauf admin | Haute fidélité, pixel-exactes |
| Bibliothèque UI maquettée | `Bibliothèque UI v2.dc.html`, 7 sections | Sert de référence de portage |
| Données de départ | 30 définitions d'étapes, 4 types de parcours, référentiels | Prêtes à charger |
| Exploitation | Runbook, supervision, incidents, sauvegardes | Rédigé avant le code, rare et précieux |

### Ce qui n'existe pas encore

Aucune ligne de code. Pas de dépôt Git (`git init` reste à faire). Pas de `docs/decisions.md`, pourtant référencé comme obligatoire par `00-fondations.md` §0.5 et §12.2. Pas de `docs/restores.md` (runbook §3). Le dossier décrit un produit ; il ne décrit pas son socle technique — c'est l'objet du **lot 0** ci-dessous, qui n'est pas dans les 12 lots de la spec.

### Le chiffrage réel du chantier

105 tables · 226 routes · 86 écrans à l'inventaire (+ 2 maquettés hors inventaire) × 2 tailles · 24 modules API · 22 tâches planifiées · 46 règles dures à couvrir par un test dédié · 9 fournisseurs externes à abstraire et à simuler. Ce n'est pas un MVP : c'est une V1 large. Le plan ci-dessous existe pour qu'elle sorte par tranches livrables plutôt qu'en un bloc.

---

## 2. Décisions à prendre avant la première ligne de code

Cinq points bloquent ou coûtent cher plus tard. Trois sont déjà signalés comme ouverts dans le journal de `T4` ; deux sont des contradictions internes du dossier que le code va rencontrer immédiatement.

| # | Décision | Recommandation | Pourquoi maintenant |
|---|---|---|---|
| D1 | **ORM** (laissé ouvert par `T4`) | Prisma + migrations SQL écrites à la main pour les parties que Prisma exprime mal (enums natifs, `tsvector`, index partiels, `citext`). Alternative sérieuse : Drizzle, plus proche du SQL, moins de friction sur les 105 tables | Conditionne `packages/db`, donc tout |
| D2 | **Jetons de design : v1 des specs ou v2 des maquettes** | Retenir **v2** et réécrire `T1-design-system.md` §2 en conséquence | Contradiction ouverte, voir §2.1 |
| D3 | **Nom affiché du produit** | Trancher entre le wordmark « Diaspora » des maquettes et « afroexpates » des specs | Apparaît dans le rail, les emails, le manifeste PWA, les CGU |
| D4 | **Agrégateur Mobile Money** (laissé ouvert par `T4`) | Décidable plus tard : l'interface `MobileMoneyProvider` suffit jusqu'au lot 11. Critères déjà fixés (MTN MoMo + Moov Money Bénin, webhooks signés, remboursement) | Seule décision qui peut attendre |
| D5 | **Hébergeur UE + gestionnaire de secrets** | À arrêter au lot 0 : la CI déploie en staging dès la fin du lot 0 | Règle dure §8.2 : base, fichiers, sauvegardes, journaux en UE |

### 2.1 La contradiction de design à trancher (D2)

`T1-design-system.md` ouvre par « quand ce document et une maquette divergent, ce document gagne ». `docs/template/CLAUDE.md` dit l'inverse et nomme les divergences : « ignorer les specs visuelles contraires des prompts (ex. rayon 14 px des cartes, fond #F2F4F3) ». Les deux ne peuvent pas être vrais.

Les valeurs divergent réellement :

| Jeton | `T1` (specs) | Maquettes v2 |
|---|---|---|
| Fond de page | `#F2F4F3` | `#F6F8F7` |
| Bordure | `#E0E5E3` | `#E6EBE9` |
| Rayons | 10 / 14 / 16 px | 14 / 18 / 22 px + pilules `999px` |
| Colonne de navigation | rail 76 px + panneau 264 px bordé | colonne 352 px, rail en carte arrondie 22 px, panneau en cartes blanches |
| Barre haute | 62 px | sans bordure, recherche pilule `#EEF2F0` |
| Surfaces tonales | non décrites | `#F2F5F4`, `#EAEEEC`, `#FAFBFB` |

**Recommandation : v2 gagne.** Les maquettes v2 sont l'itération la plus récente, elles couvrent 88 écrans de façon cohérente, et `docs/template/CLAUDE.md` est explicite. Porter les maquettes vers les jetons v1 signifierait relire 88 écrans à la main. L'action concrète est donc : réécrire `T1` §2.1 et §2.3 et le préambule de `T5` §0 avec les valeurs v2, puis supprimer la phrase de préséance de `T1` au profit d'une règle unique — **`packages/ui` est la source de vérité, dérivée de la Bibliothèque UI v2**.

Ce qui ne change pas et reste non négociable quelle que soit l'issue : le vert primaire `#16785E`, le vert fort `#0F5C48`, le terre cuite `#E0733A` réservé au parcours, l'absence de rouge, l'absence d'ombre portée, l'absence d'emoji, la cible tactile de 44 px.

### 2.2 Écarts mineurs à corriger dans le dossier

- **Décompte des écrans.** `PROJECT.md` annonce 81 écrans, l'en-tête de `T5` en annonce 78, l'inventaire de `T5` en liste **86**. Retenir 86.
- **Deux écrans maquettés absents de l'inventaire** : `H09 Mes demandes` et `H10 Mes réponses` existent dans `05 Entraide.dc.html` mais pas dans `T5` §1, alors que le panneau Entraide les référence. Les ajouter à l'inventaire (lot 4).
- **Décision contradictoire sur les jalons.** Le journal de `T4` contient à la fois « bandeau de jalons persistant, pas de stories » et, plus bas, « stories 24 h en trois types ». `00-fondations.md` §10.1 tranche : « le bandeau de jalons n'existe plus ». Marquer la première ligne comme remplacée, conformément à la règle du journal.
- **`T3` A.2 STUDIES** annonce 12 étapes dans son titre et en liste 15, ce que le document reconnaît lui-même. Corriger le titre.

Aucun de ces écarts ne bloque : les noter dans `docs/decisions.md` au lot 0 suffit.

---

## 3. Méthode d'intégration des maquettes

Les `.dc.html` ne sont pas du code de production : styles en ligne, boucles `<sc-for>`, interpolations `{{ }}`, dépendance à `support.js`. Ce sont des **références visuelles exactes**, et c'est leur valeur : elles suppriment toute ambiguïté d'interprétation. La conversion est mécanique et doit être industrialisée, pas improvisée écran par écran.

### La chaîne de portage

1. **Extraire les jetons.** Parcourir les 14 fichiers, relever toutes les couleurs, rayons, tailles de police, espacements. Les figer dans `packages/config` (preset Tailwind + variables CSS). `gen-helpers.js` est le raccourci : ses fonctions `card`, `pill`, `btn`, `bar`, `field`, `tog`, `chips`, `lbl`, `av` sont déjà l'expression compacte du système — chacune devient un composant de `packages/ui`.
2. **Porter la coquille d'abord.** `Fil d'actualité v2.dc.html` est la référence de navigation imposée par `docs/template/CLAUDE.md` : en sortent `IconRail`, `SectionPanel`, `PanelItem`, `TopBar`, `MobileTabBar`, `JourneyPanelCard`. Une fois la coquille juste, les 86 écrans ne sont plus que du contenu.
3. **Porter la Bibliothèque UI v2** en composants, par section (fondations, navigation, publications, parcours, entraide, services, communs), avec un Storybook qui rejoue chaque variante et chaque état.
4. **Puis chaque écran**, en lisant en parallèle sa maquette et son prompt `T5`. Le prompt donne les états attendus, la maquette donne les pixels.
5. **Verrouiller.** Tests de régression visuelle Playwright sur les écrans principaux, en 1440 px et 390 px. C'est ce qui empêche la dérive lente par rapport aux maquettes sur douze lots.

### Ce que les maquettes ne donnent pas

Les états `chargement` / `vide` / `erreur` / `permission insuffisante` / `hors ligne` sont exigés sur chaque écran par `T1` §5 mais ne sont maquettés que partiellement. Les traiter comme des **variantes de composant** définies une fois (`Skeleton`, `EmptyState`, `LevelUpPrompt`, `PlanLimitPrompt`, bandeau hors ligne) et appliquées par convention, jamais réinventées par écran. L'admin n'a aucune variante mobile — c'est cohérent, l'application équipe reste bureau.

---

## 4. Lot 0 — socle technique

Absent des 12 lots de la spec, indispensable. Rien de fonctionnel n'est livré ; tout ce qui suit en dépend. Critère de sortie : **une route triviale traverse toute la chaîne** — CI verte, migration appliquée, déploiement staging automatique, un événement de domaine émis, consommé et tracé.

### 0.1 Dépôt et outillage
`git init`. Monorepo pnpm + Turborepo selon l'arborescence de §3.2. `packages/config` : ESLint, tsconfig strict, preset Tailwind. La CI échoue sur un avertissement — poser cette règle au premier commit, jamais après. `docker-compose.yml` : PostgreSQL 16 avec `unaccent`, `pg_trgm`, `citext`, Redis, S3 local, boîte mail locale, antivirus.

### 0.2 Base de données
`packages/db` : les 105 tables de §6, enums PostgreSQL natifs, UUID v7 générés par l'application, `created_at` / `updated_at` / `deleted_at` selon les règles de §6.1, index sur **toutes** les colonnes de filtre et de tri. Les colonnes ajoutées par les modules (`journey_steps.due_date_manual`, `users.origin_country_locked_at`, `users.handle_changed_at`, `users.phase_set_manually_at`, `cities.postal_prefix`, `cities.activated_at`, `countries.default_city_id`, `notifications.category`…) entrent dès la première migration : elles sont déjà connues, il n'y a aucune raison de les ajouter plus tard.

> Écrire les 105 tables d'un coup est le bon choix ici, contre l'intuition habituelle. Le modèle est figé et complet, les modules n'ont pas le droit de le renommer (§0.2), et un schéma partiel forcerait à rejouer les clés étrangères à chaque lot.

### 0.3 Noyau de l'API
Squelette NestJS, `/v1` et `/v1/admin`, validation à la frontière, format d'erreur à trois champs, pagination par curseur opaque signé, `Idempotency-Key`, limites de débit. `packages/shared` : schémas zod, enums réexportés, codes d'erreur, **matrice des capacités** de §7.3. Génération OpenAPI 3.1 avec `x-capability` et `x-rate-limit`, et génération du client typé pour le front — une route sans schéma fait échouer la CI.

### 0.4 Les briques transverses que tous les lots consomment
C'est le cœur du lot 0, et la raison pour laquelle il existe.

| Brique | Pourquoi dès maintenant |
|---|---|
| **Boîte d'envoi** `domain_events` + relais 1 s | Aucun effet de bord ne passe autrement (§3.3). Tout lot ultérieur l'utilise |
| **Files BullMQ** : `events`, `notifications`, `email`, `sms`, `push`, `moderation`, `search-index`, `media`, `scheduled` | Les créer vides coûte une heure ; les rétro-ajouter coûte un refactor |
| **`apps/worker`** avec `APP_ROLE` | Même code racine que l'API, processeurs actifs, HTTP coupé |
| **Planificateur** avec verrou Redis et garantie d'idempotence | 22 tâches vont s'y brancher |
| **Interfaces fournisseurs + doublures** : `SmsProvider`, `EmailProvider`, `PushProvider`, `KycProvider`, `PaymentProvider`, `MobileMoneyProvider`, `AiModerationProvider`, `StorageProvider`, `CaptchaProvider` | §11.3 l'exige, et cela rend toute la CI hermétique. OTP à code fixe journalisé, page KYC locale pour choisir le résultat, paiement en succès immédiat |
| **`AuditService.record()`** | Règle dure §7.4 : toute action admin écrit une ligne. Plus tard = trous dans le journal |
| **`FeatureFlagService`** | Le runbook §2 impose un flag par section, activable par ville |
| **`media_assets` + worker média** : type réel par octets magiques, suppression EXIF, antivirus, variantes sharp | Nécessaire dès l'avatar du lot 1 |
| **Chiffrement** : téléphones (AES-256-GCM + empreinte HMAC), notes d'étape, messages | Change le schéma si rétro-ajouté |
| **`bookmarks`** + `GET /me/bookmarks/states` | Chaque contenu porte un signet dès son apparition (§2.9 de `01`) |
| **`reputation_events` + `user_stats`** | Unicité (membre, type, source), compteurs par type, jamais de score unique |
| **`SearchService`** derrière son interface | L'indexation doit partir avec le premier contenu, sinon il faut une reprise |
| **`NotificationService`** : catégories, canaux, préférences, regroupement | Voir §5 : sans lui, le lot 2 est déjà en dette |
| **`ModerationService.check()`** avec ses règles locales synchrones et `redactForModeration` | Voir §5 : sans lui, les lots 3 et 4 publient sans filtre |

### 0.5 Front
`apps/web` et `apps/admin` en Next.js App Router, coquille de navigation portée depuis `Fil d'actualité v2.dc.html`, `packages/ui` amorcé depuis la Bibliothèque UI v2, TanStack Query sur le client généré, react-hook-form + zod sur les schémas partagés, i18n par module avec **aucune chaîne en dur**, PWA Serwist (manifeste, coquille en cache, page hors ligne, aucune donnée personnelle en cache persistant).

### 0.6 Qualité et exploitation
Vitest, Supertest + Testcontainers, Playwright, axe-core. Pipeline : installation → lint → types → unitaires → intégration → migrations à jour → build → bout en bout. Sentry, journaux pino JSON sans PII. Déploiement automatique en staging sur `main` verte, production manuelle depuis un tag. Sauvegardes et restauration mensuelle tracée dans `docs/restores.md`. Créer `docs/decisions.md` amorcé avec le journal de `T4` et les décisions D1 à D5.

### 0.7 Les garde-fous automatisés
À écrire au lot 0, une fois, pour tenir douze lots :

1. **Toute route non-GET déclare une capacité** — test d'intégration qui parcourt les routes (règle dure §7.3).
2. **Le terre cuite `journey-*` est interdit hors des sept composants autorisés** — lint Tailwind (`T1` §2.1).
3. **Le mot « certifié » est absent des fichiers de traduction et des titres** — test sur les catalogues i18n.
4. **Aucun rouge dans les jetons ni dans les classes** — lint.
5. **Aucune chaîne en dur dans les composants** — lint i18n.
6. **`redactForModeration` retire téléphone et email avant tout appel IA** — test dédié (règle dure `13` §2).
7. **Aucun `*_view_count` exposé par une réponse d'API** — test sur le schéma OpenAPI (règle dure §1.2).
8. **Aucun numéro de téléphone en clair dans une réponse** — test sur `UserSummary` et sur les journaux.
9. **Aucune route de module d'aide ne lit `users.plan`** — test statique sur les modules `help`, `guides`, `mentorship`, `communities`, `events` (règle dure `14` §2).
10. **Un fichier `docs/decisions.md` couvre chaque hypothèse** — revue, pas automatisable.

Effort indicatif : **4 à 6 semaines** pour une personne expérimentée, moins à deux.

---

## 5. Réordonnancement des lots

L'ordre des 12 lots de `00-fondations.md` §12.1 est bon dans son intention — valeur d'abord, revenus ensuite — mais il contient **cinq inversions de dépendance** qui bloquent à l'exécution. Le tableau dit quoi remonter ; le lot 0 ci-dessus en absorbe déjà l'essentiel.

| # | Inversion | Où ça casse | Correction |
|---|---|---|---|
| I1 | **Notifications** en lot 10, alors que les lots 2 à 9 en émettent | `journey.reminders` J−14/J−7/J−1 est une tâche du lot 2 ; les invitations d'équipe (`JOURNEY_TEAM`) aussi | Noyau notifications en **lot 0** ; les catégories, les préférences fines, le résumé hebdomadaire et l'écran X02 restent en lot 10 |
| I2 | **Messagerie** en lot 7, alors que la création d'un parcours crée une `conversation` de type JOURNEY | `03` §3.1 exige `group_conversation_id` dès la création ; l'écran « J01 Discussion » est maquetté en lot 2 | Remonter **`conversations` + `conversation_members` + `messages`** au lot 2, limités à la discussion de parcours. La messagerie 1-à-1, les demandes de contact et le blocage restent en lot 7 |
| I3 | **Modération** en lot 5, après le fil (lot 3) et l'entraide (lot 4) | `13` §2 : « tout contenu textuel » passe par `ModerationService.check()`. Publier deux lots sans filtre, c'est ouvrir une bêta à des arnaques sur le segment pré-départ, le plus exposé | Règles locales synchrones + masquage + file `moderation` en **lot 0** ; l'analyse IA, les dossiers, le SLA, les sanctions et les écrans D04/D05 restent en lot 5 |
| I4 | **Recherche** en lot 10, alors que l'indexation part au lot 3 | `search_documents` s'alimente par événements ; sans consommateur, il faut une reprise complète | Worker `search-index` branché dès le **lot 0** ; les écrans, les filtres et le classement restent en lot 10. Prévoir de toute façon la réindexation complète du runbook §7 |
| I5 | **Villes** en lot 8, alors que le lot 4 filtre l'entraide par ville | Le panneau Entraide affiche « Toutes les demandes `ouvertes ville` » ; « près de chez vous » = même ville puis 30 km (haversine) | Les tables `countries` / `cities` et le calcul de proximité sont déjà en lot 1 (module 02). Ne remonter que le **helper de proximité**, pas la carte ni les fiches ville |

Deux points mineurs à garder en tête, sans réordonnancement : l'essai Premium de 14 jours se déclenche à la première étape franchie (lot 2) mais n'est facturable qu'au lot 11 — le poser comme flag dormant ; et les compteurs de réputation affichés par le panneau Entraide dès le lot 4 viennent de `reputation_events`, déjà au lot 0.

### Séquence retenue

```
Lot 0  Socle technique + briques transverses                          4–6 sem.
Lot 1  Accès, identité, profil, référentiels, admin minimal           5–7 sem.   P01-P03 O01-O05 K01 K02 K04 K08 X04 D01 D03 D08 D12 D15
Lot 2  Parcours : modèles, back-office, parcours membre, discussion   7–9 sem.   J01-J11 O03 O05 D06 D07
Lot 3  Fil, stories, commentaires, réactions, jalons, signets         5–6 sem.   A01 A02 A13 A14 K10
Lot 4  Entraide + « Je suis bloqué » branché                          3–4 sem.   H01-H04 H09 H10
Lot 5  Confiance : KYC Didit, modération complète, sanctions          4–5 sem.   K03 K09 X03 D04 D05 D11
Lot 6  Guides : versions, votes, fraîcheur, propositions              4–5 sem.   A03-A06 D09
Lot 7  Lien : réseaux, parrainage, contacts, messagerie complète      6–8 sem.   A07-A10 H05-H08 K05 M01 J09
Lot 8  Local : villes, carte, agenda, présence                        4–5 sem.   A11 A12 E01-E04
Lot 9  Services : logement, emploi, annuaire pro                      6–7 sem.   S01-S09 D10
Lot 10 Transverse : recherche, notifications, résumé hebdomadaire     3–4 sem.   X01 X02 K07
Lot 11 Revenus : Premium, Stripe, Mobile Money, partenaires           4–5 sem.   K06 S10 D13 D14
Lot 12 Pilotage : tableaux de bord, rapport d'impact                  2–3 sem.   D02 D16
```

Les fourchettes supposent une personne expérimentée par lot, avec le front et le back tenus par la même personne — c'est ce que la génération d'écrans depuis les maquettes rend possible. Elles n'incluent pas la relecture produit ni la rédaction du contenu éditorial (guides de départ, pages statiques, CGU, politique de confidentialité), qui sont un chantier parallèle à mener par le porteur.

Total indicatif : **58 à 74 semaines-personne**. À trois personnes en parallèle sur les lots parallélisables, un premier lancement en une ville est atteignable au bout des lots 0 à 5, soit environ **7 à 9 mois**.

### Ce qui se parallélise

Les lots 0 à 4 sont séquentiels : ils construisent la colonne vertébrale, et le lot 2 est le plus gros morceau du produit. À partir du lot 5, trois pistes avancent séparément parce qu'elles ne partagent que le socle :

- **Piste confiance et savoir** — lots 5 puis 6.
- **Piste lien et local** — lots 7 puis 8.
- **Piste services et revenus** — lots 9 puis 11.

Le lot 10 se branche quand les trois pistes ont produit du contenu à indexer et à notifier. Le lot 12 vient en dernier : il n'a de sens qu'avec des données réelles.

---

## 6. Ce que chaque lot doit livrer

Le gabarit ne change pas d'un lot à l'autre : **données → service → API → interface → tâches planifiées → tests**, et les onze cases de la définition de « terminé » (§12.2) cochées. Ci-dessous, seulement ce qui est propre à chaque lot et facile à sous-estimer.

### Lot 1 — Accès et identité
Le chemin critique est l'OTP : indicatifs des pays actifs seulement, 6 chiffres, 10 minutes, 5 tentatives, 3 envois par numéro et par heure, 10 par IP, Turnstile obligatoire avant tout envoi. Jeton d'accès 15 min portant `sub`, `level`, `plan`, `status`, `sid` ; rafraîchissement 30 jours en cookie `SameSite=Strict` avec rotation et révocation de chaîne en cas de réutilisation. Le mécanisme `level_refresh_required` → `401 TOKEN_STALE` → rejeu doit fonctionner dès ce lot, sinon les niveaux du lot 5 seront faux.

Les cinq écrans d'onboarding conditionnent tout le funnel — les traiter comme du produit, pas comme de la plomberie. Le handle, la phase, les consentements, l'export et la suppression différée à 7 jours avec exécution de tous les gestionnaires de suppression dans une transaction unique : le mécanisme est à poser ici même s'il ne supprime encore presque rien, parce que chaque lot suivant vient y brancher son gestionnaire.

Admin minimal : connexion équipe séparée avec argon2id + TOTP obligatoire, membres en lecture, référentiels, pages statiques, réglages.

*Sortie :* parcours critique 1 de §11.4 vert de bout en bout — inscription OTP → onboarding → arrivée sur l'application.

### Lot 2 — Parcours
Le lot le plus lourd, et celui qui porte la valeur du produit. Quatre sous-chantiers à ne pas mélanger :

1. **Modèles versionnés** : `DRAFT` / `PUBLISHED` / `ARCHIVED`, une seule version publiée par (type, pays), résolution à la création, migration manuelle qui préserve l'état des étapes de même définition. Règle dure : publier une version ne touche aucun `journey` existant.
2. **Rétro-planning** : `due_date = target_arrival_date − days_before_arrival`, jamais écrasée si `due_date_manual`, alerte d'incompatibilité sur les dépendances sans blocage.
3. **Moteur d'étapes** : quatre états seulement — à faire, en cours, franchie, en pause. Aucun état ni libellé d'échec, ni en base ni à l'écran. Réouverture autorisée. `progress_pct` sur les étapes non optionnelles.
4. **« Je suis bloqué »** : les quatre temps, et surtout la règle dure — l'objet cible n'est créé qu'à l'appel explicite de publication, avec le texte tel que renvoyé par le client. Au lot 2, seule la cible `MENTORSHIP` manque encore de destination ; les cibles `HELP`, `HOUSING`, `JOBS` s'ouvrent aux lots 4, 9 et 9.

Charger les données de `T3` : 30 définitions d'étapes, les 4 compositions, les gabarits de blocage, le message d'étape à risque.

*Sortie :* parcours critique 2 de §11.4, moins la partie entraide qui arrive au lot 4.

### Lot 3 — Fil
Publications typées avec réactions à vocabulaire variable, commentaires à une seule profondeur, jalons liés à une étape. Les stories sont un sous-produit complet à elles seules : trois types, 24 h, quatre tâches planifiées (`story.expire` 5 min, `story.score_recompute` 15 min, `story.purge_history`, plus l'expiration), et la règle dure qui interdit lien, numéro et email dans une story et n'en renvoie l'historique qu'à l'auteur et aux membres qui l'ont enregistrée. Le titre personnel d'un parcours n'apparaît jamais dans le fil — seul le nom du type.

### Lot 4 — Entraide
Le plus petit lot, et celui qui referme la boucle du produit : blocage → demande → réponse → « ça m'a aidé » → contact créé → réputation incrémentée → proposition de marquer l'étape franchie. Le bandeau de non-paiement est permanent sur chaque page de la section, renvoyé par l'API. Ajouter H09 et H10 à l'inventaire.

*Sortie :* parcours critiques 2 et 3 de §11.4 verts. **À ce stade le produit est testable en vrai dans une ville** — c'est le premier jalon de lancement réel, avec la confiance du lot 5.

### Lot 5 — Confiance
Didit en sessions hébergées, webhook signé, aucune donnée conservée hors statut et `is_adult`, mineur → compte désactivé. Pipeline de modération complet : l'IA masque et met en file, un humain tranche, jamais de sanction automatique. File unique triée par priorité puis SLA (4 h en priorité 1, 24 h sinon), désassignation après 2 h d'inaction. Alertes arnaques. Sanctions.

*Sortie :* parcours critiques 4, 5 et 6 de §11.4.

### Lots 6 à 9
Chacun est un module autonome posé sur le socle, sans surprise architecturale. Les points à surveiller : la fraîcheur et l'obsolescence des guides (quatre tâches planifiées, anonymisation à la suppression de compte plutôt que suppression) ; le score de risque et la file de logement au lot 9 ; l'agrégation par ville jamais en dessous de 3 membres au lot 8 ; et le justificatif d'activité pro, stocké, accès équipe uniquement, jamais affiché.

### Lots 10 à 12
Recherche : `tsvector` + `unaccent` + `pg_trgm`, avec la règle dure qui interdit de renvoyer un document d'un réseau dont le demandeur n'est pas membre ou dont l'auteur est bloqué dans un sens ou l'autre. Notifications : les catégories, les trois canaux, et la règle dure — jamais d'email pour `SOCIAL`. Revenus : aucune donnée de carte sur le serveur, Mobile Money par périodes sans récurrence avec 3 jours de grâce, et les trois règles dures qui isolent l'aide de tout paiement. Pilotage : aucune statistique de réussite ou d'échec exposée côté membres.

---

## 7. Risques

| Risque | Mesure |
|---|---|
| **Le lot 2 dérape.** C'est 30 routes, un moteur de versions, un rétro-planning et un flux en quatre temps — le tiers de la complexité du produit | Le découper en quatre livraisons internes (§6). Ne pas commencer le lot 3 avant que le parcours critique 2 passe |
| **Les 46 règles dures s'effritent** sur douze lots, silencieusement | Les dix garde-fous du lot 0 §0.7, et la case « test de chaque règle dure » dans la définition de terminé. Une règle sans test n'est pas une règle |
| **Les maquettes et le code divergent** lentement | Régression visuelle Playwright en 1440 px et 390 px sur les écrans principaux, dès le lot 1 |
| **Le mono-pays devient du code en dur** alors que l'architecture est multi-pays | Aucun `if (country === 'BJ')`. Activer un pays est une écriture en back-office, jamais un déploiement (`02` §2.1) |
| **Dette de traduction** : une chaîne en dur passe, puis cent | Lint i18n bloquant dès le lot 0, pas au lot 10 |
| **L'agrégateur Mobile Money se révèle inadapté** au lot 11 | L'interface est posée au lot 0 ; faire un essai réel de bout en bout au lot 5, sans attendre le lot 11, pour valider webhooks signés et remboursement |
| **Le contenu éditorial manque au lancement** : aucun guide n'existe, et les étapes affichent « guide à venir » | Chantier parallèle du porteur, à démarrer dès le lot 2. Une ville sans guides et sans membres installés ne retient personne |
| **La CI devient lente**, l'équipe la contourne | Testcontainers en parallèle, bout en bout seulement sur les 7 parcours critiques, cache Turborepo |

---

## 8. Les trois prochaines actions

1. **Trancher D1, D2, D3, D5** (ORM, jetons v1/v2, nom affiché, hébergeur). Une demi-journée de décisions, et `docs/decisions.md` est amorcé.
2. **Corriger le dossier** sur les quatre écarts de §2.2, et réécrire `T1` §2 avec les jetons retenus. Une demi-journée.
3. **Lancer le lot 0** en commençant par `git init`, le monorepo, la CI et les 105 tables — dans cet ordre, parce que chaque brique suivante s'y appuie.
