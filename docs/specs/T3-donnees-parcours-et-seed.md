# Données de parcours et données de départ

> Contenu à charger au premier déploiement. Deux parties : les **modèles de parcours** (définitions d'étapes et composition des quatre types, version 1, déclinaison Bénin → France) et les **référentiels** (pays, villes, langues, compétences, métiers). C'est de la donnée, pas du code ; elle est administrée ensuite en back-office.

---

# Partie A — Modèles de parcours

## A.1 Bibliothèque des définitions d'étapes

Conventions : `code` unique · `cat` = PRE_DEPARTURE / ARRIVAL / SETTLEMENT · `durée` indicative en jours · `cible` du bouton « Je suis bloqué » · `jalon` = jalon majeur · `risque` = étape à fort blocage. Les guides liés sont référencés par slug prévu ; ils n'existent pas au lancement — l'étape affiche « guide à venir » et invite à en écrire un.

| Code | Nom | Cat. | Durée | Cible | Jalon | Risque | Checklist de documents |
|---|---|---|---|---|---|---|---|
| `CHOOSE_PROGRAM` | Choisir sa formation | PRE | 21 | HELP | | | — |
| `CAMPUS_FRANCE_FILE` | Constituer le dossier Campus France | PRE | 42 | HELP | | ✓ | Passeport valide · relevés de notes · diplômes · lettre de motivation · CV · photo d'identité |
| `CAMPUS_FRANCE_INTERVIEW` | Passer l'entretien Campus France | PRE | 14 | HELP | | | Convocation · dossier imprimé |
| `ADMISSION` | Obtenir l'admission | PRE | 30 | HELP | ✓ | | Lettre d'admission |
| `FIND_JOB_OFFER` | Trouver une offre et signer un contrat | PRE | 60 | JOBS | ✓ | ✓ | CV français · contrat ou promesse d'embauche |
| `WORK_PERMIT` | Obtenir l'autorisation de travail | PRE | 30 | HELP | | ✓ | Contrat · demande de l'employeur |
| `FAMILY_FILE` | Déposer le dossier de regroupement familial | PRE | 30 | HELP | | ✓ | Actes d'état civil · justificatifs du regroupant |
| `FAMILY_INQUIRY` | Enquête logement et ressources | PRE | 90 | HELP | | ✓ | Bail · fiches de paie · attestation de surface |
| `FAMILY_DECISION` | Recevoir la décision | PRE | 60 | MENTORSHIP | ✓ | | — |
| `VISA` | Obtenir le visa | PRE | 28 | HELP | ✓ | ✓ | Passeport · admission ou contrat · justificatif de ressources · assurance · hébergement · photos · formulaire |
| `HEALTH_INSURANCE` | Souscrire l'assurance santé du visa | PRE | 3 | NONE | | | Attestation d'assurance |
| `PROOF_OF_FUNDS` | Réunir le justificatif de ressources | PRE | 30 | HELP | | ✓ | Attestation bancaire ou prise en charge |
| `HOUSING_BEFORE` | Trouver un logement avant l'arrivée | PRE | 45 | HOUSING | ✓ | ✓ | Dossier locatif · garantie Visale · attestation d'hébergement |
| `FLIGHT` | Réserver le billet | PRE | 7 | NONE | | | Billet |
| `PREPARE_DEPARTURE` | Préparer le départ | PRE | 14 | HELP | | | Documents originaux et copies · ordonnances · argent des premiers jours |
| `ARRIVAL` | Arriver en France | ARR | 1 | MENTORSHIP | ✓ | | — |
| `OFII_VALIDATION` | Valider le visa (OFII) | ARR | 30 | HELP | | ✓ | Visa · adresse · timbre |
| `HOUSING_AFTER` | Trouver un logement stable | ARR | 45 | HOUSING | ✓ | ✓ | Dossier locatif · Visale |
| `BANK_ACCOUNT` | Ouvrir un compte bancaire | ARR | 14 | HELP | | ✓ | Passeport · visa · justificatif de domicile ou attestation |
| `PHONE_PLAN` | Prendre un forfait mobile | ARR | 2 | NONE | | | RIB |
| `SOCIAL_SECURITY` | S'inscrire à la sécurité sociale | ARR | 60 | HELP | | | Acte de naissance traduit · passeport · titre · RIB |
| `CAF` | Demander l'aide au logement (CAF) | ARR | 30 | HELP | | | Bail · RIB · attestation de loyer |
| `SCHOOL_ENROLL` | Inscrire les enfants à l'école | ARR | 14 | HELP | | | Carnet de santé · justificatif de domicile · livret de famille |
| `RESIDENCE_PERMIT` | Obtenir la carte de séjour | SET | 90 | HELP | ✓ | ✓ | Titre précédent · justificatifs · photos · timbre |
| `STATUS_CHANGE` | Changer de statut | SET | 120 | HELP | ✓ | ✓ | Contrat · diplôme · titre |
| `REGULARIZATION` | Régulariser sa situation | SET | 180 | MENTORSHIP | ✓ | ✓ | Preuves de présence · fiches de paie · attestations |
| `DIPLOMA_RECOGNITION` | Faire reconnaître son diplôme | SET | 90 | HELP | | | Diplôme · relevés · traductions |
| `FIND_JOB_AFTER` | Trouver un emploi | SET | 90 | JOBS | ✓ | ✓ | CV français · lettre · titre |
| `LOCAL_INTEGRATION` | S'intégrer localement | SET | 90 | MENTORSHIP | | | — |
| `RENEWAL` | Renouveler le titre de séjour | SET | 60 | HELP | | ✓ | Titre · justificatifs · photos |

Gabarits de « Je suis bloqué » (variables `{etape}`, `{parcours}`, `{ville}`, `{echeance}`) :

- Cible HELP : « Je suis bloqué·e à l'étape **{etape}** de mon parcours **{parcours}** ({ville}, échéance {echeance}). Voici où j'en suis : »
- Cible HOUSING : « Je cherche un logement à **{ville}** pour {echeance}, dans le cadre de mon parcours **{parcours}**. Budget, durée, quartiers souhaités : »
- Cible JOBS : « Je cherche une offre pour l'étape **{etape}** de mon parcours **{parcours}** à **{ville}**. Domaine, disponibilité, type de contrat : »
- Cible MENTORSHIP : « J'aimerais être accompagné·e pour **{etape}** ({parcours}, {ville}). Ce que j'attends d'un parrain : »

Messages d'étape à risque (`risk_message`) : « Beaucoup de membres ont eu besoin d'aide ici. Regardez les guides les plus utiles avant de commencer, et n'hésitez pas à demander. »

## A.2 Composition des types — version 1

`avant` = `days_before_arrival` (rétro-planning). `opt` = étape optionnelle. Dépendances notées « ← ».

### STUDIES — Étudier en France (12 étapes)

| # | Étape | avant | opt | ← |
|---|---|---|---|---|
| 1 | CHOOSE_PROGRAM | 240 | | |
| 2 | CAMPUS_FRANCE_FILE | 200 | | 1 |
| 3 | CAMPUS_FRANCE_INTERVIEW | 170 | | 2 |
| 4 | ADMISSION | 120 | | 3 |
| 5 | PROOF_OF_FUNDS | 100 | | |
| 6 | VISA | 60 | | 4, 5 |
| 7 | HEALTH_INSURANCE | 50 | | 6 |
| 8 | HOUSING_BEFORE | 30 | | 6 |
| 9 | FLIGHT | 21 | | 6 |
| 10 | ARRIVAL | 0 | | 9 |
| 11 | OFII_VALIDATION | −30 | | 10 |
| 12 | BANK_ACCOUNT | −21 | | 10 |
| 13 | SOCIAL_SECURITY | −60 | | 12 |
| 14 | CAF | −45 | ✓ | 8 ou HOUSING_AFTER |
| 15 | RESIDENCE_PERMIT | −270 | | 11 |

(15 étapes en réalité ; le document de projet en citait 12 par simplification.)

### WORK — Travailler en France (11 étapes)

| # | Étape | avant | opt | ← |
|---|---|---|---|---|
| 1 | FIND_JOB_OFFER | 150 | | |
| 2 | WORK_PERMIT | 90 | | 1 |
| 3 | VISA | 60 | | 2 |
| 4 | HEALTH_INSURANCE | 50 | | 3 |
| 5 | HOUSING_BEFORE | 30 | ✓ | 3 |
| 6 | FLIGHT | 21 | | 3 |
| 7 | ARRIVAL | 0 | | 6 |
| 8 | OFII_VALIDATION | −30 | | 7 |
| 9 | BANK_ACCOUNT | −14 | | 7 |
| 10 | SOCIAL_SECURITY | −60 | | 9 |
| 11 | RESIDENCE_PERMIT | −270 | | 8 |

### FAMILY — Rejoindre ma famille (9 étapes)

| # | Étape | avant | opt | ← |
|---|---|---|---|---|
| 1 | FAMILY_FILE | 300 | | |
| 2 | FAMILY_INQUIRY | 210 | | 1 |
| 3 | FAMILY_DECISION | 120 | | 2 |
| 4 | VISA | 60 | | 3 |
| 5 | FLIGHT | 21 | | 4 |
| 6 | ARRIVAL | 0 | | 5 |
| 7 | OFII_VALIDATION | −30 | | 6 |
| 8 | SCHOOL_ENROLL | −14 | ✓ | 6 |
| 9 | SOCIAL_SECURITY | −60 | | 6 |

### SETTLEMENT — Régulariser ma situation (déjà en France, 7 étapes, sans rétro-planning)

| # | Étape | opt | ← |
|---|---|---|---|
| 1 | REGULARIZATION ou STATUS_CHANGE ou RENEWAL (le membre choisit à la création ; les deux autres sont supprimées) | | |
| 2 | HOUSING_AFTER | ✓ | |
| 3 | BANK_ACCOUNT | ✓ | |
| 4 | SOCIAL_SECURITY | ✓ | |
| 5 | DIPLOMA_RECOGNITION | ✓ | |
| 6 | FIND_JOB_AFTER | ✓ | 1 |
| 7 | LOCAL_INTEGRATION | | |

## A.3 Déclinaison Bénin → France

Version `origin_country = BJ` de STUDIES et WORK : identiques à la version générique, avec des surcharges de description (`overrides`) sur `CAMPUS_FRANCE_FILE` (plateforme Études en France, Espace Campus France Bénin, calendrier), `VISA` (TLS/VFS à Cotonou, délais observés), `PROOF_OF_FUNDS` (montant mensuel de référence, banques acceptées). Les montants et délais ne sont **pas** inscrits en dur dans les descriptions : ils renvoient aux guides communautaires, seuls à être mis à jour.

---

# Partie B — Référentiels

## B.1 Pays

| ISO | Nom | Indicatif | Kind | Actif au lancement |
|---|---|---|---|---|
| FR | France | +33 | DESTINATION | ✓ |
| BJ | Bénin | +229 | ORIGIN | ✓ |
| TG | Togo | +228 | ORIGIN | |
| CI | Côte d'Ivoire | +225 | ORIGIN | |
| SN | Sénégal | +221 | ORIGIN | |
| CM | Cameroun | +237 | ORIGIN | |
| BF | Burkina Faso | +226 | ORIGIN | |
| ML | Mali | +223 | ORIGIN | |
| NE | Niger | +227 | ORIGIN | |
| GN | Guinée | +224 | ORIGIN | |
| GA | Gabon | +241 | ORIGIN | |
| CG | Congo | +242 | ORIGIN | |
| CD | RD Congo | +243 | ORIGIN | |
| MG | Madagascar | +261 | ORIGIN | |
| MA · DZ · TN | Maroc · Algérie · Tunisie | +212 · +213 · +216 | ORIGIN | |

Les pays inactifs sont chargés pour être activables en un clic.

## B.2 Villes (France) — toutes inactives au lancement sauf la ville pilote

Paris · Lyon · Marseille · Toulouse · Lille · Bordeaux · Nantes · Strasbourg · Montpellier · Rennes · Grenoble · Nice · Rouen · Reims · Le Havre · Saint-Étienne · Toulon · Angers · Dijon · Nîmes · Villeurbanne · Clermont-Ferrand · Le Mans · Aix-en-Provence · Brest · Tours · Amiens · Limoges · Metz · Besançon · Orléans · Caen · Mulhouse · Nancy · Poitiers · Pau · La Rochelle · Créteil · Nanterre · Saint-Denis · Cergy · Évry · Versailles.

Chacune avec région, latitude, longitude du centre. Villeurbanne, Créteil, Nanterre, Saint-Denis, Cergy, Évry, Versailles restent des villes distinctes (rayon de 30 km pour « près de chez moi »). **La ville pilote est activée à la main le jour du lancement.**

## B.3 Langues

Français · Anglais · Fon · Yoruba · Goun · Mina (Gen) · Bariba · Dendi · Éwé · Wolof · Bambara · Dioula · Baoulé · Lingala · Kikongo · Swahili · Peul (Fulfulde) · Haoussa · Arabe · Portugais · Espagnol · Allemand · Malgache · Kabyle.

## B.4 Compétences (extrait — 70 entrées, par catégorie)

- **Numérique** : développement web, développement mobile, données, réseaux et systèmes, cybersécurité, design, gestion de produit, marketing numérique
- **Gestion** : comptabilité, finance, ressources humaines, gestion de projet, administration, logistique, achats
- **Santé** : soins infirmiers, aide-soignant, pharmacie, kinésithérapie, médecine, petite enfance
- **Enseignement** : enseignement primaire, secondaire, supérieur, formation professionnelle, soutien scolaire, langues
- **Droit** : droit des étrangers, droit du travail, droit des affaires, notariat
- **Bâtiment** : maçonnerie, électricité, plomberie, peinture, menuiserie, chauffage
- **Commerce** : vente, restauration, hôtellerie, coiffure, esthétique, couture
- **Transport** : conduite, livraison, mécanique
- **Culture** : musique, audiovisuel, journalisme, traduction, événementiel
- **Sciences** : ingénierie, chimie, agronomie, environnement, recherche
- **Social** : travail social, animation, médiation, interprétariat

## B.5 Sujets et catégories de stories

- **Sujets** (conseil, information) : démarches · logement · banque · santé · emploi & études · transports · vie quotidienne · famille
- **Catégories de découverte** : lieu · produit · sortie
- **Lieux suggérés pour une information** (par ville, extensibles) : préfecture · sous-préfecture · OFII · CAF · CPAM · Pôle emploi / France Travail · banque · gare · mairie · université

## B.6 Métiers de l'annuaire (40)

Avocat · Comptable · Expert-comptable · Notaire · Traducteur assermenté · Interprète · Conseiller en immigration (mention : ne se substitue pas à un avocat) · Agent immobilier · Courtier en assurance · Conseiller bancaire indépendant · Coiffeur · Esthéticienne · Couturier · Restaurateur · Traiteur · Épicier (produits africains) · Plombier · Électricien · Peintre · Menuisier · Chauffagiste · Mécanicien · Chauffeur VTC · Déménageur · Développeur · Designer · Photographe · Vidéaste · Musicien / DJ · Organisateur d'événements · Professeur particulier · Formateur · Coach · Infirmier libéral · Kinésithérapeute · Psychologue · Sage-femme · Auxiliaire de vie · Garde d'enfants · Agent de nettoyage.

---

# Partie C — Paramètres système initiaux

| Clé | Valeur |
|---|---|
| `community.interest_threshold_members` | 50 |
| `community.min_invites` | 5 |
| `community.archive_days` | 60 |
| `geo.near_radius_km` | 30 |
| `map.min_count_per_country` | 3 |
| `mentorship.duration_days` | 90 |
| `mentorship.max_mentees_default` | 2 |
| `mentorship.request_expiry_days` | 7 |
| `guide.proposal_escalation_days` | 14 |
| `guide.outdated_threshold` | 3 |
| `guide.unpublish_days` | 30 |
| `guide.author_inactivity_months` | 6 |
| `journey.inactivity_days` | 60 |
| `journey.reminder_days` | [14, 7, 1] |
| `help.archive_open_days` | 45 |
| `help.archive_resolved_days` | 90 |
| `housing.listing_days` | 60 |
| `housing.risk_block_threshold` | 0.7 |
| `housing.risk_queue_threshold` | 0.4 |
| `job.listing_days` | 45 |
| `job.sponsored_days` | 14 |
| `moderation.sla_hours` | 24 |
| `moderation.sla_p1_hours` | 4 |
| `moderation.block_abuse_threshold` | 20 |
| `plan.premium_price_eur_cents` | 400 |
| `plan.premium_price_xof` | 2600 |
| `plan.trial_days` | 14 |
| `billing.mobile_money_grace_days` | 3 |
| `account.deletion_delay_days` | 7 |
| `account.deactivated_purge_months` | 6 |
| `story.daily_limit` | 3 |
| `story.max_chars` | 280 |
| `story.history_days` | 30 |
| `story.negative_review_threshold` | { "negative": 10, "positive_below": 3 } |
| `bookmark.max_per_user` | 500 |
| `handle.reserved` | ["admin","support","afroexpates","aide","moderation","accueil","parcours","entraide","services","agenda","compte"] |
