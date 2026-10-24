# 15 — Administration

> Dépend de : tous les modules. Tables : `staff_users`, `staff_sessions`, `audit_logs`, `feature_flags`, `static_pages`, `announcements`, `system_settings`. Application séparée `apps/admin` sur `admin.afroexpates.com`.

Les back-offices propres à chaque module (modèles de parcours, référentiels, modération, billing) sont spécifiés dans leur module. Ce fichier couvre : l'application admin elle-même, les comptes équipe, l'audit, le pilotage, les pages et paramètres, et le rapport d'impact.

---

## 1. Périmètre

Application admin, authentification renforcée, rôles, journal d'audit, gestion des membres (fiche, sanctions, RGPD), pages statiques, annonces, feature flags, paramètres système, tableaux de bord, statistiques de parcours, rapport d'impact pour les financeurs.

---

## 2. Application admin

### 2.1 Accès

- Domaine séparé, application Next.js séparée, **aucun code partagé avec le front membres** hors `packages/ui` et `packages/shared`.
- Connexion : email + mot de passe (argon2id, 12 caractères minimum, vérification contre les listes de mots de passe compromis) + **TOTP obligatoire** (enrôlement forcé à la première connexion). Sessions de 8 h, jeton dans un cookie `HttpOnly` `Strict`, renouvellement à l'activité, déconnexion à 30 min d'inactivité.
- Restriction IP facultative par `system_settings.admin_allowed_cidrs`.
- Tentatives : 5 échecs → verrouillage 15 minutes ; notification email à l'équipe `SUPER_ADMIN`.
- **[RÈGLE DURE]** Un compte équipe ne peut jamais se connecter à l'application membres avec ses identifiants, ni l'inverse.

### 2.2 Rôles

Voir `00` §7.4. Précisions :

| Action | SUPER_ADMIN | CONTENT_ADMIN | MODERATOR | SUPPORT |
|---|:-:|:-:|:-:|:-:|
| Gérer les comptes équipe et rôles | ✓ | | | |
| Prix, plans, paramètres de paiement | ✓ | | | |
| Bannir définitivement | ✓ | | | |
| Modèles de parcours, référentiels, pages, annonces, alertes arnaques, partenaires | ✓ | ✓ | | |
| File de modération, masquer, avertir, suspendre | ✓ | | ✓ | |
| Lire une fiche membre complète | ✓ | ✓ | ✓ | ✓ |
| Traiter export / suppression RGPD, remboursements | ✓ | | | ✓ |
| Valider les fiches pro (justificatif) | ✓ | ✓ | | ✓ |
| Nommer un modérateur bénévole | ✓ | ✓ | ✓ | |
| Tableaux de bord | ✓ | ✓ | ✓ | ✓ |
| Feature flags, paramètres système | ✓ | | | |

Un `SUPER_ADMIN` ne peut pas retirer son propre rôle ni supprimer son compte s'il est le dernier.

### 2.3 Audit

**[RÈGLE DURE]** Toute écriture depuis l'application admin passe par `AuditService.record()` avant validation de la transaction : acteur, action, cible, `metadata` avant/après (champs modifiés uniquement, valeurs sensibles masquées), IP. Page « Journal d'audit » filtrable par acteur, action, cible, période ; export CSV. **Aucune suppression possible, jamais** : décision du porteur (« on ne supprime jamais »), la rétention du journal est **illimitée**. Ni tâche, ni purge, ni cascade ne l'atteint (déclencheurs `audit_logs_append_only` et `audit_logs_no_truncate`, aucune clé étrangère) ; le test `audit-jamais-supprime.int.test.ts` échoue si une suppression apparaît.

---

## 3. Gestion des membres

### 3.1 Fiche membre

Recherche par handle, nom d'affichage, empreinte de téléphone (saisie du numéro → HMAC → recherche, le numéro n'est jamais affiché), email. Fiche : identité (handle, nom, avatar), niveau et détail (téléphones masqués, statut KYC, dates), phase, ville, pays, plan, ancienneté, dernière activité ; compteurs (publications, demandes, guides, parcours, événements, réputation) ; sanctions ; dossiers de modération ; sessions actives ; consentements ; exports et demandes de suppression.

**[RÈGLE DURE]** L'application admin n'affiche jamais un numéro de téléphone en clair, ni ne permet de lire une conversation privée hors d'un dossier de modération qui la joint.

### 3.2 Actions

| Action | Rôle | Effet |
|---|---|---|
| Rétrograder le niveau | MODERATOR | Marque le KYC `DECLINED` avec motif ; recalcul |
| Forcer une phase, une ville | SUPPORT | Correction à la demande du membre, tracée |
| Révoquer les sessions | SUPPORT | |
| Désactiver / réactiver | MODERATOR | |
| Exécuter une suppression immédiate | SUPPORT | Sur demande écrite du membre, saute le délai de 7 jours |
| Générer un export | SUPPORT | |
| Ajouter une note interne | tous | Visible équipe seulement, journalisée |

---

## 4. Contenu et paramètres

### 4.1 Pages statiques

`static_pages` : conditions, confidentialité, règles de la communauté, ressources professionnelles (santé, soutien, urgences), guide du parrain, transparence des partenaires, à propos. Markdown, prévisualisation, versionnées (`version` référencée par `consents.version`). Publier une nouvelle version des conditions ou de la confidentialité déclenche la redemande de consentement (module 01 §2.9).

### 4.2 Annonces

`announcements` : titre, corps, ciblage (villes, pays, phases, plans), période. Affichées en bandeau en tête de l'accueil, fermables par le membre (fermeture mémorisée côté client), 1 active par membre à la fois (la plus récente ciblée).

### 4.3 Feature flags

`feature_flags` : clé, activé, pourcentage de déploiement (hash stable du membre), conditions (villes, pays, phases, plans). Lus via `FlagService.isEnabled(key, user)` avec cache 1 min. Utilisés pour : ouvrir une section par ville, tester une variante, couper une fonctionnalité en incident. Liste des flags documentée dans `docs/flags.md`.

### 4.4 Paramètres système

`system_settings` (clé → json), tous avec valeur par défaut dans le code : seuils de modération, seuil de création de réseau (50), rayon « près de chez moi » (30 km), bornes de prix logement, durées (parrainage 90 j, archivage 60 j, grâce 3 j), handles réservés, CIDR admin, prix des plans, taux EUR/XOF. Modification tracée ; certains paramètres exigent `SUPER_ADMIN`.

---

## 5. Pilotage

### 5.1 Tableau de bord principal

Rafraîchi toutes les heures (vues matérialisées).

| Bloc | Indicateurs |
|---|---|
| Membres | Inscrits, actifs 7 j / 30 j, par phase, par niveau, par ville, par pays d'origine ; nouveaux par semaine |
| **Indicateur clé** | **% des membres d'une ville ayant été cochés présents à au moins un événement dans les 90 jours** — par ville, courbe hebdomadaire. Objectif : 30 % |
| Parcours | Créés, actifs, aboutis, en pause, abandonnés ; par type ; taux d'aboutissement à 6 et 12 mois |
| Entraide | Demandes ouvertes / résolues, délai médian de première réponse, taux de résolution |
| Guides | Publiés, votes, propositions acceptées, guides à vérifier |
| Parrainage | Parrains disponibles, parrainages actifs, menés à terme, note moyenne |
| Événements | Programmés, tenus, présents cochés, présents par événement |
| Réseaux | Actifs, archivés, sujets par semaine |
| Services | Annonces actives, taux de risque, fiches pro validées, contacts |
| Modération | Dossiers ouverts par priorité, respect du SLA, sanctions |
| Revenus | Premium actifs, MRR, Mobile Money vs carte, affiliation (clics, conversions, payout) |

### 5.2 Statistiques de parcours

Alimentent les modèles (module 03) :

- **Délais réels par étape** : médiane, quartiles, effectif, par `step_definition` et par pays d'origine → proposés comme `default_duration_days` à la prochaine version.
- **Étapes bloquantes** : nombre de `blocker_requests` (publiés + privés + annulés) par étape / nombre de parcours passés par l'étape → suggère `is_risky`.
- **Étapes sautées ou supprimées** par les membres → suggère de les rendre optionnelles.
- **Migration** : parcours restés sur une version archivée.

**[RÈGLE DURE]** Aucune statistique n'affiche un taux de réussite ou d'échec côté membres. Ces données restent dans l'admin.

### 5.3 Rapport d'impact

Page et export PDF trimestriel, pour les financeurs (subventions, fonds d'intégration) : membres accompagnés, parcours aboutis, présences aux événements, entraides résolues, guides produits, parrainages menés, répartition par ville et par pays, témoignages (extraits de guides ou de tips avec accord de l'auteur — case « autoriser la citation » sur le contenu). Toutes les données sont agrégées, jamais nominatives.

---

## 6. Données — compléments

| Table | Précision |
|---|---|
| `staff_users.failed_attempts`, `locked_until`, `totp_enrolled_at` | **Ajoutées** |
| `staff_users.created_by_staff_id` | **Ajoutée** |
| `member_notes` | **Table ajoutée** (`std`) : `user_id`, `staff_id`, `body` — notes internes |
| `announcements.plans` | Dans `target` |
| `metric_snapshots` | **Table ajoutée** (`append`) : `metric`, `dimension` (ville, type…), `value`, `period_start` — historique des indicateurs pour les courbes |
| `guides.quotable`, `city_tips.quotable` | **Ajoutées**, bool, faux par défaut — accord de l'auteur pour la citation dans le rapport |
| `impact_report_snapshots` | **Table ajoutée** : un instantané du rapport d'impact par trimestre ET par révision, jamais écrasé (décision « il faut tout conserver ») |
| `impact_quotes` | **Table ajoutée** : la citation approuvée par l'équipe pour un trimestre (extrait de guide ou de contribution de ville), sans nom ni identifiant d'auteur |

---

## 7. API (`/v1/admin/*`)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/login` · `/auth/totp` · `/auth/logout` | |
| POST | `/auth/totp/enroll` · `/auth/totp/confirm` | |
| CRUD | `/staff` | SUPER_ADMIN |
| GET | `/audit?actor&action&target&from&to` · `/audit/export` | |
| GET | `/users?q` · `/users/:id` | Fiche |
| POST | `/users/:id/{downgrade,phase,city,revoke-sessions,deactivate,reactivate,delete-now,export,note}` | Selon rôle |
| CRUD | `/pages` · POST `/pages/:id/publish` | CONTENT_ADMIN |
| CRUD | `/announcements` | CONTENT_ADMIN |
| CRUD | `/flags` | SUPER_ADMIN |
| GET/PUT | `/settings` · `/settings/:key` | SUPER_ADMIN (certaines clés CONTENT_ADMIN) |
| GET | `/dashboard` · `/dashboard/:block?from&to&cityId` | |
| GET | `/stats/steps` · `/stats/blockers` · `/stats/migrations` | |
| GET | `/impact?quarter` · `/impact/export` | |

Toutes les routes exigent une session équipe valide et vérifient le rôle. Toute route non-GET journalise.

---

## 8. Écrans

| Écran | Détail |
|---|---|
| Connexion | Email, mot de passe, code TOTP ; enrôlement TOTP forcé |
| Accueil admin | Tableau de bord principal, indicateur clé en tête, alertes (SLA dépassé, justificatifs en attente, villes à activer) |
| Membres | Recherche, fiche, actions avec motif, notes internes |
| Contenu | Pages (éditeur + versions + publication), annonces (éditeur + ciblage + aperçu) |
| Parcours | Éditeur de modèles (module 03), statistiques d'étapes, propositions de correction |
| Référentiels | Module 02 |
| Modération | Module 13 |
| Services | Justificatifs pro en attente, annonces à risque |
| Revenus | Module 14 |
| Réglages | Feature flags, paramètres système, comptes équipe, journal d'audit |
| Rapport d'impact | Sélection du trimestre, aperçu, export |

---

## 9. Événements

| Émis | Consommateurs |
|---|---|
| `staff.logged_in` / `login_failed` / `locked` | notifications équipe |
| `page.published` | users (redemande de consentement si TERMS/PRIVACY), search |
| `announcement.published` | feed |
| `flag.changed` / `setting.changed` | cache (invalidation) |
| **Consommés** : tous les événements de domaine (agrégation dans `metric_snapshots`) | |

## 10. Tâches

| Tâche | Fréquence |
|---|---|
| `metrics.refresh` | horaire — vues matérialisées et `metric_snapshots` |
| `metrics.key_indicator` | quotidienne — présence à 90 jours par ville |
| `stats.steps_recompute` | hebdomadaire |
| `impact.quarterly_prepare` | 1er jour du trimestre |
| `staff.session_cleanup` | horaire |
| ~~`audit.retention`~~ | **Retirée** : le journal d'audit est conservé sans limite (§2.3). |

## 11. Gestionnaire de suppression

`member_notes` : supprimées. `audit_logs` : conservés **sans limite de durée**, `target_id` gardé (référence anonymisée) — obligation de traçabilité. `metric_snapshots` : agrégats, non concernés.

## 12. Tests des règles dures

- `rule: toute route admin non-GET écrit une ligne d'audit dans la même transaction`
- `rule: un compte équipe ne peut pas s'authentifier sur l'API membres`
- `rule: la connexion admin échoue sans TOTP enrôlé et valide`
- `rule: aucun numéro de téléphone en clair dans une réponse admin`
- `rule: le rapport d'impact ne contient aucune donnée nominative`
- `rule: un SUPER_ADMIN ne peut pas retirer le dernier SUPER_ADMIN`

---

## 13. État de la livraison — état final (phase 5 « Administration », relevé au navigateur, 1440 px et 390 px)

Cette section dit ce qui est LIVRÉ et ce qui s'écarte du texte ci-dessus. Les écrans sont ceux
de `docs/template/10 Administration` (D01 à D16), plus un ajout, D17 (alertes d'équipe). L'application
d'équipe vit sous `/admin/*` du front (groupe de routes `(admin)`), pas dans une application `apps/admin`
séparée, et tient l'étanchéité des deux domaines par le client `staffApi` (cookie `dp_staff` seul, jamais
le jeton de membre — voir `lib/api/domains.ts`).

### 13.1 Livré, écran par écran

| Écran | Livré | Gestes d'écriture éprouvés |
|---|---|---|
| D01 Connexion | e-mail + mot de passe, TOTP, **enrôlement forcé avec code QR rendu localement**, clé en texte et lien `otpauth://` en secours | connexion, enrôlement, première session |
| D02 Tableau de bord | **entièrement branché** : indicateur clé (pourcentage, écart en points, objectif réglable `key_indicator_target`, courbe hebdomadaire, villes), bandeau d'alertes (SLA dépassé, justificatifs pro, villes à activer, alertes d'équipe non lues), file et respect du SLA de modération, note moyenne et parrainages en cours, événements et présences du mois, réseaux actifs et d'intérêt, plus les cinq cartes d'instantanés. Une mesure absente est « — » et « Pas encore de mesure ». Revenus : « — », « Tout est gratuit pour le moment » (le paiement est hors périmètre) | lecture (4 rôles) |
| D03 Membres | recherche, fiche, notes internes, actions avec motif ; **la confirmation du geste reste affichée après la fermeture de la fenêtre** | note, révocation, désactivation, réactivation, correction phase/ville |
| D04 Modération | file filtrable ; types « Story » et « Conseil de ville » nommés ; **à 390 px chaque ligne tient sans défilement et nomme ses colonnes** | prendre un dossier |
| D05 Dossier | contenu, contexte, verdict IA, actions | prendre, conserver avec motif |
| D06 Parcours | modèles et versions, éditeur d'étapes, aperçu, publication, **corrections proposées par les membres : accepter / refuser avec motif**, parcours restés sur une version archivée | brouillon, édition, publication, **acceptation et refus d'une correction (éprouvés avec des corrections déposées par de vrais membres)** |
| D07 Bibliothèque d'étapes | liste, éditeur ; colonnes nommées à 390 px | sélection, édition |
| D08 Référentiels | villes : activer, fermer, fusionner | les trois gestes |
| D09 Guides | propositions escaladées (accepter, refuser avec motif), signalés, forçage, retour arrière | tous |
| D10 Services | **fiches pro en attente : voir le justificatif (route d'équipe tracée), approuver, rejeter avec motif**, annonces logement à risque, bornes de prix | approbation, rejet avec motif, bornes, classement d'un dossier |
| D11 Alertes arnaques | création, édition, retrait, ciblage | création, édition, retrait |
| D12 Pages et annonces | pages versionnées ; annonces avec **ciblage par pays d'origine, villes, phases et plans** | publication d'une annonce ciblée |
| D13 Partenaires | partenaires, encarts, import CSV | création, bascule, encart, import |
| D14 Revenus | état « monétisation désactivée » | lecture |
| D15 Réglages | feature flags, paramètres (registre fermé, dont `key_indicator_target`), seuils, équipe, journal d'audit paginé avec export CSV | flags, paramètres, seuils, équipe, export |
| D16 Impact | **sélecteur de trimestre sur l'historique conservé**, recalcul (nouvelle révision, l'ancienne reste), **témoignages consentis et approuvés**, export CSV par trimestre, impression PDF (feuille d'impression propre) | recalcul, approbation et retrait d'une citation, export |
| D17 Alertes d'équipe (AJOUT) | `staff_alerts` : alertes de délai de modération et de **verrouillage de compte** (5 échecs, alerte aux autres SUPER_ADMIN), « Non lues / Toutes », « Marquer lu », « Tout marquer comme lu » | marquer lu |

**Bandeau d'annonce (§4.2)** : inchangé — l'annonce publiée en D12 s'affiche en tête de l'accueil du membre ciblé,
fermable, mémorisée dans `localStorage`, coupée par le drapeau `annonces.bandeau`.

### 13.2 Routes ajoutées ou changées

| Route | Rôles | Effet |
|---|---|---|
| `GET /admin/dashboard/overview` | les 4 | alertes, indicateur clé (objectif, écart, courbe, villes), modération et SLA, parrainage, événements du mois, réseaux |
| `GET /admin/impact?quarter=AAAA-TN` | les 4 | rapport d'un trimestre lu dans l'historique ; sans paramètre, le dernier trimestre **clos** conservé ; `quarters`, `temoignages` |
| `GET /admin/impact/export?quarter=` | les 4 | CSV du trimestre (tranches nommées, témoignages), tracé |
| `POST /admin/impact/recompute` | content | nouvelle révision d'un trimestre clos (409 `IMPACT_QUARTER_OPEN` sinon), tracée |
| `GET /admin/impact/testimonials` · `PUT /admin/impact/quotes` · `DELETE /admin/impact/quotes/:id` | content | les contenus consentis, l'approbation (20 à 300 caractères) et le retrait d'une citation, tracés |
| `PUT /guides/:id/quotable` · `PUT /tips/:id/quotable` | membre auteur | l'accord de citation (jamais l'équipe) |
| `GET /admin/pro-profiles/:id/proof` | SUPER_ADMIN, CONTENT_ADMIN, SUPPORT | le justificatif, en-têtes `sandbox`/`nosniff`, consultation tracée (`pro.proof_viewed`) |
| `GET /admin/moderation/alerts` | MODERATOR, CONTENT_ADMIN, SUPER_ADMIN | `unread` compté sur toute la table du compte, plus sur 50 lignes |

La tâche `impact.quarterly_prepare` pose la révision 1 du trimestre écoulé dans `impact_report_snapshots`
(idempotente) en plus des points de `metric_snapshots`.

### 13.3 Témoignages : trois conditions

1. l'auteur a coché « autoriser la citation » (`quotable`) ;
2. l'équipe a **approuvé l'extrait** (citation modérée) ;
3. l'accord tient **à chaque affichage** : `quotable` retiré, contenu dépublié ou supprimé → la citation disparaît du rapport.
Le rapport ne porte ni nom ni identifiant d'auteur.

### 13.4 Journal d'audit

Rétention **illimitée** (§2.3). Aucune tâche, purge ni cascade ; l'ancienne tâche `audit.retention` est retirée.

### 13.5 Écarts restants avec le texte de ce module

- **Pas de bibliothèque de rendu PDF dans l'API** : le PDF d'impact est celui de la boîte d'impression du navigateur ; l'export serveur est un CSV.
- **Revenus (D02, D14)** : « — » — le paiement est hors périmètre.
- **Le marqueur « consentement à la citation » côté membre** est servi par l'API (`PUT /guides/:id/quotable`, `PUT /tips/:id/quotable`) ; son interrupteur dans les écrans membres est laissé au lot qui tient ces écrans.
- **`docs/flags.md`** n'existe pas ; la liste vit à l'écran D15.
- **Restriction IP** : portée par `StaffGuard` (`admin_allowed_cidrs`), modifiable en D15.
- Les autres specs (`00` §8.4 « Journal d'audit : 5 ans ») portent encore l'ancienne durée : elles ne sont pas de ce lot.

### 13.6 Défauts trouvés au navigateur, corrigés

Lots précédents : journal d'audit en erreur sur une ligne sans acteur ni cible ; `aiVerdict` nul ; validations D13/D15 ;
messages de succès effacés (D08, D09, D11, D12) ; bandeau d'annonce recouvert ; débordements à 390 px (D02, D08, D13, D15, D06).
Phase 5 : D10 validait « à l'aveugle » (le justificatif n'était lisible que de son propriétaire) ; D03 n'annonçait pas
l'issue d'un geste une fois la fenêtre de motif fermée ; D04 écrivait « STORY » et « CITY_TIP » en clair et coupait le
geste « Prendre » hors écran à 390 px ; D07 cachait ses colonnes à 390 px ; l'indicateur « non lues » des alertes
d'équipe plafonnait à 50 ; le sélecteur de rapport d'impact aurait montré un trimestre non clos.
