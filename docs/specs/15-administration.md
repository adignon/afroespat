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

**[RÈGLE DURE]** Toute écriture depuis l'application admin passe par `AuditService.record()` avant validation de la transaction : acteur, action, cible, `metadata` avant/après (champs modifiés uniquement, valeurs sensibles masquées), IP. Page « Journal d'audit » filtrable par acteur, action, cible, période ; export CSV. Aucune suppression possible ; rétention 5 ans.

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
| `guides.quotable`, `city_tips.quotable` | **Ajoutées**, bool — accord de citation pour le rapport |

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
| `audit.retention` | quotidienne (5 ans) |

## 11. Gestionnaire de suppression

`member_notes` : supprimées. `audit_logs` : conservés, `target_id` gardé (référence anonymisée) — obligation de traçabilité. `metric_snapshots` : agrégats, non concernés.

## 12. Tests des règles dures

- `rule: toute route admin non-GET écrit une ligne d'audit dans la même transaction`
- `rule: un compte équipe ne peut pas s'authentifier sur l'API membres`
- `rule: la connexion admin échoue sans TOTP enrôlé et valide`
- `rule: aucun numéro de téléphone en clair dans une réponse admin`
- `rule: le rapport d'impact ne contient aucune donnée nominative`
- `rule: un SUPER_ADMIN ne peut pas retirer le dernier SUPER_ADMIN`

---

## 13. État de la livraison (relevé au navigateur, 1440 px et 390 px)

Cette section dit ce qui est LIVRÉ et ce qui s'écarte du texte ci-dessus. Les écrans sont ceux
de `docs/template/10 Administration` (D01 à D16) ; l'application d'équipe vit sous `/admin/*`
du front (groupe de routes `(admin)`), pas dans une application `apps/admin` séparée, et tient
l'étanchéité des deux domaines par le client `staffApi` (cookie `dp_staff` seul, jamais le jeton
de membre — voir `lib/api/domains.ts`).

### 13.1 Livré, écran par écran

| Écran | Livré | Gestes d'écriture éprouvés |
|---|---|---|
| D01 Connexion | e-mail + mot de passe, TOTP, **enrôlement forcé avec code QR rendu localement** (`qrcode-generator`, SVG en ligne : le secret ne sort pas du navigateur), clé en texte et lien `otpauth://` en secours | connexion, enrôlement, première session |
| D02 Tableau de bord | cinq cartes liées (membres, parcours, entraide, guides, services) lues de `GET /admin/dashboard` ; **base sans instantané = tirets et « Pas encore de mesure », jamais une erreur** ; les sept cartes sans source n'affichent plus les nombres d'exemple de la maquette | lecture |
| D03 à D05 | membres, file de modération, dossier | (lot précédent) |
| D06 Parcours | modèles et versions, éditeur d'étapes, aperçu, publication (la précédente est archivée), corrections proposées, parcours restés sur une version archivée | nouveau brouillon, édition, ordre, enregistrement, aperçu, publication |
| D08 Référentiels | villes : activer, fermer, fusionner (irréversible, confirmation par le slug) ; cartes sur mobile | les trois gestes, avec motif tracé |
| D09 Guides | propositions escaladées (accepter, refuser avec motif), signalés obsolètes, tous les guides, forçage de statut, retour arrière (la version actuelle n'est pas proposée), « maintenu par la communauté » | tous |
| D10 Services | justificatifs pro, annonces logement à risque (publier / retirer), bornes de prix | bornes de prix, classement d'un dossier |
| D11 Alertes arnaques | création, édition, retrait, ciblage ville / pays, aperçu membre | création, édition, retrait |
| D12 Pages et annonces | pages versionnées ; annonces (ciblage villes et phases, période) | publication d'une annonce |
| D13 Partenaires | partenaires, encarts par étape, import CSV des conversions (validé ligne à ligne côté écran, revalidé par le serveur) ; cartes sur mobile | création, bascule, encart (refus du doublon affiché), import |
| D15 Réglages | feature flags, paramètres (registre fermé), seuils de modération, équipe, journal d'audit paginé (« Voir plus ») avec export CSV | création / modification de flag, paramètre, seuils, compte équipe, export |
| D16 Impact | agrégats par ville et pays, impression | lecture |

**Bandeau d'annonce (§4.2)** : une annonce publiée en D12 s'affiche en tête de l'accueil du
membre ciblé ; la fermeture est mémorisée dans `localStorage` par identifiant d'annonce ; le
drapeau `annonces.bandeau` le coupe (absent, il est ouvert). Éprouvé : annonce créée par l'écran,
vue par un membre, fermée, absente après rechargement, absente quand le drapeau est coupé.

### 13.2 Écarts avec le texte de ce module

- **Pas de PDF d'impact** : `GET /admin/impact/export` rend un CSV (`indicateur;tranche;valeur`),
  tracé à l'audit ; « Imprimer / PDF » ouvre la boîte d'impression du navigateur, qui enregistre
  en PDF (rail, barre et boutons masqués à l'impression). Aucune bibliothèque de rendu PDF n'est
  dans l'API.
- **Pas de sélecteur de trimestre** : l'API ne garde que le dernier calcul par indicateur.
- **Pas de témoignages** (`guides.quotable`, `city_tips.quotable` non livrés) : citer sans accord
  est ce que ces colonnes existent pour empêcher.
- **D02** : le bandeau d'alertes (SLA dépassé, justificatifs, villes à activer), l'indicateur clé
  par ville, les revenus, le parrainage, les événements du mois et les réseaux ne sont pas liés
  (aucune route d'équipe ne sert tous leurs nombres sans exiger un rôle plus fort que ce que le
  tableau de bord autorise) ; ils affichent un tiret.
- **Ciblage des annonces** : l'écran propose villes et phases ; pays et plans sont acceptés par le
  serveur mais n'ont pas de commande à l'écran.
- **`docs/flags.md`** (liste des flags) n'existe pas ; la liste vit à l'écran D15.
- **Restriction IP** : portée par `StaffGuard` (`admin_allowed_cidrs`), modifiable en D15.
- **Corrections de parcours (D06)** et **fiches pro en attente (D10)** : écrans rendus, geste
  d'acceptation non éprouvé faute de donnée de membre correspondante dans la base d'essai.

### 13.3 Défauts trouvés au navigateur, corrigés

Le journal d'audit tombait en erreur dès qu'une ligne n'avait pas d'acteur ou de cible (actions
système) ; la file de modération et les annonces à risque tombaient sur `aiVerdict` nul (dossier
ouvert par signalement, sans passage IA) ; les validations d'écran (D13, D15) affichaient
« Une erreur est survenue » au lieu du champ à corriger ; les messages de succès étaient effacés
à la fermeture des fenêtres (D08, D09) ou perdus au remontage du formulaire (D11, D12) ; le
bandeau d'annonce était recouvert par la barre haute fixe à 1440 px ; D02, D08, D13, D15 et D06
débordaient ou perdaient leurs gestes à 390 px.
