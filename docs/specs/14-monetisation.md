# 14 — Monétisation

> Dépend de : `00`, `01`, `03`, `10`. Tables : `plans`, `subscriptions`, `payments`, `usage_counters`, `partners`, `partner_placements`, `affiliate_clicks`.

---

## 1. Périmètre

Premium membre (4 €/mois), fiches professionnelles Pro et Pro+, paiement carte (Stripe) et Mobile Money (agrégateur UEMOA), quotas du plan gratuit, encarts partenaires contextuels, tracking d'affiliation, facturation. **Rien de ce qui relève de l'aide n'est payant.**

---

## 2. Principes non négociables

- **[RÈGLE DURE]** L'entraide, les guides, le parrainage, les réseaux, la participation aux événements ne sont jamais conditionnés à un plan. Aucune route de ces modules ne vérifie `users.plan`.
- **[RÈGLE DURE]** Un plan ne donne jamais de priorité dans l'affichage de l'entraide, du parrainage ni des guides.
- **[RÈGLE DURE]** Aucun encart partenaire dans le fil, l'entraide, les guides, les réseaux, la messagerie. Ils vivent uniquement sur une étape de parcours et en pied de la section Logement.
- Aucune publicité display. Aucune vente de données.

---

## 3. Plans

| Plan | Cible | Prix | Contenu |
|---|---|---|---|
| `FREE` | Tous | 0 | Tout, avec limites : 1 parcours actif, 1 événement créé/mois, 3 contacts pro/mois, encarts partenaires affichés |
| `PREMIUM` | Membre | 4 €/mois ou 40 €/an | Parcours illimités + export PDF + historique · événements illimités · contacts pro illimités · alertes logement/emploi · filtres de recherche avancés · profil mis en avant dans l'annuaire des membres · encarts partenaires masqués · offres d'emploi sponsorisées (5/mois) · badge soutien |
| `PRO` | Fiche pro | ~25 €/mois | Fiche mise en avant dans sa ville, photos, statistiques de vues et contacts, badge Pro |
| `PRO_PLUS` | Fiche pro | ~40 €/mois | Pro + plusieurs villes + mise en avant dans la recherche globale |

`plans.limits` est la source unique des quotas ; les modules lisent les limites via `PlanService.limitsFor(userId)` (cache Redis 5 min, invalidé sur `subscription.changed`). Prix en `system_settings` pour pouvoir tester des variantes sans déploiement.

**Essai** : 14 jours de Premium offerts **à la première étape franchie d'un parcours** (pas à l'inscription — le membre doit avoir vu la valeur). Sans moyen de paiement enregistré ; à la fin, retour en FREE sans coupure de service, les parcours excédentaires passent en lecture seule (jamais supprimés).

---

## 4. Paiement

### 4.1 Fournisseurs

| Canal | Fournisseur | Usage |
|---|---|---|
| Carte | Stripe Billing (abonnements récurrents, portail client, factures) | Membres en Europe |
| Mobile Money | Agrégateur UEMOA derrière `MobileMoneyProvider` (**à désigner** — candidats : FedaPay, KKiaPay, PayDunya ; critère : MTN MoMo + Moov Money au Bénin, webhooks signés, remboursement) | Membres en Afrique, paiement en XOF |

**[RÈGLE DURE]** Aucune donnée de carte ne transite par le serveur (Stripe Elements / Checkout). Aucun numéro Mobile Money stocké au-delà de la transaction (l'agrégateur le porte).

### 4.2 Mobile Money — spécificités

- Pas d'abonnement récurrent natif : le membre paie **par période** (1 mois ou 12 mois). `subscriptions.provider = MOBILE_MONEY`, `cancel_at_period_end = true` par construction. Rappels J−7 et J−1 avant `current_period_end` avec lien de renouvellement en un clic. Après expiration : 3 jours de grâce, puis `EXPIRED`.
- Prix affiché en XOF, converti au taux fixe EUR/XOF (parité fixe 655,957) : 4 € = 2 625 F arrondi à 2 600 F.
- Flux : choix du plan → saisie du numéro → notification USSD/push de l'opérateur → webhook de confirmation → activation. Timeout 5 minutes, statut `PENDING` visible.

### 4.3 Abonnement

- Une seule `subscription` `ACTIVE` par (membre, type de plan). Premium et Pro sont indépendants (un pro peut être Premium ou non).
- Changement mensuel ↔ annuel : au prochain renouvellement (Stripe gère le prorata, Mobile Money non — on attend la fin de période).
- Annulation : effet en fin de période, réversible jusqu'à la fin. `users.plan` reste `PREMIUM` jusqu'à `current_period_end`.
- `PAST_DUE` (carte refusée) : 3 tentatives Stripe sur 7 jours, notifications ; puis `EXPIRED`.
- Dégradation FREE : parcours excédentaires en lecture seule (le membre choisit lequel reste actif, sinon le plus récent) ; alertes désactivées ; fiches pro → FREE ; rien n'est supprimé.

### 4.4 Factures et remboursement

`payments` avec `invoice_number` séquentiel (préfixe année), PDF généré (`invoice_asset_id`), envoyé par email si email vérifié, téléchargeable depuis Compte → Abonnement. Remboursement : sous 14 jours sans usage significatif (aucun second parcours créé, aucune alerte déclenchée) — traité par `SUPPORT`, tracé dans `payments.status = REFUNDED`.

### 4.5 Quotas

`usage_counters` par (membre, métrique, mois) : `EVENTS_CREATED`, `PRO_CONTACTS`, `SPONSORED_JOBS`. Incrément atomique dans la transaction de l'action ; vérification **avant** l'action ; réponse `PLAN_LIMIT_REACHED` avec `details: { metric, limit, used, resetsAt }`. Le front affiche le compteur (« 1 événement sur 1 ce mois-ci »).

---

## 5. Partenaires et affiliation

### 5.1 Placement

`partner_placements` : un partenaire × une définition d'étape × (pays d'origine, pays de destination) facultatifs. **Contrainte d'unicité** : un seul placement actif par étape et par combinaison de pays → un seul encart par étape. Un second placement pour la même étape est refusé (`PLACEMENT_EXISTS`).

Résolution à l'affichage d'une étape : placement le plus spécifique (pays d'origine + destination > destination seule > générique), actif, dans sa période. Sinon aucun encart.

Second emplacement : pied de la section Logement (`step_definition_id` virtuel `HOUSING_SECTION`, même mécanisme).

### 5.2 Affichage

Encart en bordure pointillée, logo, titre, description, bouton d'action, mention **« Partenaire »** toujours visible, lien « Pourquoi cet encart ? » vers la page de transparence. Masqué pour les membres `PREMIUM` (`limits.hide_partners = true`) — ils peuvent le réactiver dans les réglages s'ils le souhaitent.

### 5.3 Tracking

Clic → `affiliate_clicks` (placement, membre, étape, horodatage) → redirection vers `affiliate_url_template` avec `{click_id}`. Conversion : webhook ou import CSV du partenaire → `converted_at`, `conversion_ref`, `payout_cents`. Tableau de bord : clics, conversions, taux, revenus par partenaire et par étape.

**[RÈGLE DURE]** Aucune donnée personnelle n'est transmise au partenaire dans le lien : seulement `click_id`. Le membre est identifiable dans la base, jamais dans l'URL.

---

## 6. Données — compléments

| Table | Précision |
|---|---|
| `subscriptions.trial_ends_at`, `is_trial` | **Ajoutées** |
| `subscriptions.grace_until` | **Ajoutée** (Mobile Money) |
| `subscriptions.period` | **Ajoutée**, enum MONTH / YEAR |
| `payments.exchange_rate` | **Ajoutée**, numeric — taux appliqué si XOF |
| `partners.transparency_text` | **Ajoutée** — affiché sur « Pourquoi cet encart ? » |
| `users.hide_partners_override` | **Ajoutée** (module 01), bool facultatif |

---

## 7. API

### 7.1 Membres

| Méthode | Route | Rôle | Erreurs |
|---|---|---|---|
| GET | `/plans` | Plans, prix (EUR et XOF), limites | |
| GET | `/me/subscription` | Abonnements, période, quotas du mois, essai | |
| POST | `/me/subscription/checkout` | `planCode`, `period`, `provider` → URL Stripe ou instruction Mobile Money (`paymentId`) | `ALREADY_SUBSCRIBED` |
| POST | `/me/subscription/cancel` · `/resume` | | |
| POST | `/me/subscription/change-period` | | |
| GET | `/me/subscription/portal` | Portail Stripe | `NOT_STRIPE` |
| GET | `/me/payments` · `/me/payments/:id/invoice` | Factures | |
| GET | `/me/usage` | Compteurs du mois | |
| POST | `/me/trial/start` | Déclenché par le serveur sur `journey.step_completed` (première fois) ; route pour le bouton « Activer mon essai » | `TRIAL_ALREADY_USED` |
| GET | `/placements?stepDefinitionId` | Encart résolu (ou vide) | |
| POST | `/placements/:id/click` | → redirection | |
| POST | `/webhooks/stripe` · `/webhooks/mobile-money` | Signés, idempotents | |

### 7.2 Équipe (`/v1/admin/billing/*`)

| Route | Rôle |
|---|---|
| GET/PUT `/plans` | Prix et limites (`SUPER_ADMIN`) |
| GET `/subscriptions?status&provider` | Liste, échecs |
| POST `/payments/:id/refund` | `SUPPORT` |
| CRUD `/partners` · `/placements` | `CONTENT_ADMIN` |
| POST `/affiliate/import` | CSV de conversions |
| GET `/revenue` | Abonnements, affiliation, par mois |

---

## 8. Écrans

| Écran | Détail |
|---|---|
| Compte → Abonnement | Plan actuel, quotas (barres), bouton Premium (prix EUR/XOF selon pays), essai, factures, annulation |
| Passer Premium | Comparatif Gratuit / Premium, choix mensuel/annuel, choix carte / Mobile Money, paiement, confirmation |
| Mobile Money | Numéro, opérateur, attente de confirmation (5 min), succès/échec, rappel de renouvellement |
| Quota atteint | Composant réutilisé : « 1 événement sur 1 ce mois-ci — réinitialisé le 1er octobre », bouton Premium, sans bloquer la navigation |
| Encart partenaire | Sur l'étape et en pied de Logement ; mention Partenaire ; lien transparence |
| Fiche pro → Formule | FREE / PRO / PRO+, avantages, paiement |
| Admin | Plans, abonnés, remboursements, partenaires, placements (vue par étape avec l'encart résolu), tableau de bord revenus |

---

## 9. Événements

| Émis | Consommateurs |
|---|---|
| `subscription.changed` (activation, expiration, changement de plan, essai) | users (`plan`), journeys (limites), pros (tier), services (alertes), notifications |
| `payment.succeeded` / `failed` / `refunded` | notifications, analytics |
| `affiliate.clicked` / `converted` | analytics |
| **Consommés** : `journey.step_completed` (essai), `user.deleted` | |

## 10. Tâches

| Tâche | Fréquence |
|---|---|
| `billing.expiry_reminders` | quotidienne — J−7, J−1 (Mobile Money), essai J−3 |
| `billing.expire_subscriptions` | horaire — fin de grâce → EXPIRED → dégradation |
| `billing.trial_end` | horaire |
| `usage.reset` | 1er du mois (les compteurs sont par `period_key`, donc rien à réinitialiser : simple purge à 13 mois) |
| `affiliate.reconcile` | quotidienne — import automatique si le partenaire expose une API |

## 11. Gestionnaire de suppression

Abonnements : annulés immédiatement chez le fournisseur ; lignes conservées anonymisées (obligation comptable), factures conservées 10 ans dans un stockage séparé référencé par `invoice_number`, `user_id` anonymisé. Clics d'affiliation : anonymisés. Compteurs : supprimés.

## 12. Tests des règles dures

- `rule: aucune route d'entraide, guides, parrainage, réseaux, événements (participation) ne lit users.plan`
- `rule: un second placement actif sur la même étape et les mêmes pays est refusé`
- `rule: aucun encart n'est résolu pour le fil, l'entraide, un guide, un réseau, une conversation`
- `rule: l'URL d'affiliation ne contient que click_id`
- `rule: la dégradation en FREE ne supprime aucun parcours`
- `rule: un webhook rejoué n'active pas deux fois un abonnement`
- `rule: aucune donnée de carte n'est reçue par l'API`
