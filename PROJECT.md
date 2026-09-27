# afroexpates.com — Dossier de spécifications

**Plan de construction : `docs/PLAN.md`** — décisions à trancher, socle technique (lot 0), méthode de portage des maquettes, séquence des 12 lots corrigée, garde-fous, risques.

Lire dans cet ordre. Chaque fichier suppose les précédents.
Tous les fichiers sont dans le dosssier docs/
| Fichier | Contenu |
|---|---|
| `specs/00-fondations.md` | Produit, stack, architecture, conventions, **modèle relationnel complet** (105 tables, diagrammes), autorisations, sécurité, événements, front, CI, ordre de construction |
| `specs/schema-viewer.html` | Le modèle relationnel en canevas interactif (tables déplaçables, relations qui suivent) |
| `specs/01-identite.md` | OTP, sessions, KYC Didit, niveaux, profil, onboarding, désactivation, suppression, export |
| `specs/02-referentiels.md` | Pays, villes, langues, compétences, métiers ; lancement mono-pays |
| `specs/03-parcours.md` | Modèles versionnés, parcours membre, rétro-planning, checklist, équipe, « Je suis bloqué », jalons, parcours similaires |
| `specs/04-fil.md` | Publications typées, réactions à vocabulaire variable, commentaires, stories 24 h (conseil · découverte · information) |
| `specs/05-guides.md` | Versions, votes, fraîcheur, propositions, obsolescence, anonymisation |
| `specs/06-entraide.md` | Demandes et offres, clôture « ça m'a aidé », « vous pouvez aider » |
| `specs/07-reseaux.md` | Réseaux automatiques et d'intérêt, sujets, sondages, albums, archivage |
| `specs/08-parrainage-messagerie.md` | Parrainage, contacts, blocage, messagerie minimale |
| `specs/09-villes-agenda.md` | Carte, annuaire, fiche ville, événements, présence (indicateur clé) |
| `specs/10-services.md` | Logement (L2, score de risque), emploi, annuaire pro, alertes |
| `specs/11-recherche-12-notifications.md` | Recherche globale ; notifications trois canaux |
| `specs/13-moderation.md` | Signalements, pipeline IA masqué, dossiers, sanctions, alertes arnaques |
| `specs/14-monetisation.md` | Premium, Pro, Stripe, Mobile Money, quotas, partenaires, affiliation |
| `specs/15-administration.md` | Application admin, rôles, audit, membres, pages, flags, pilotage, rapport d'impact |
| `specs/T1-design-system.md` | Jetons, navigation, composants, états obligatoires |
| `specs/T2-textes-interface.md` | Ton, mots interdits, libellés de référence |
| `specs/T3-donnees-parcours-et-seed.md` | Définitions d'étapes, composition des 4 types, référentiels, paramètres initiaux |
| `specs/T4-api-runbook-decisions.md` | Conventions d'API, exploitation, journal des décisions |
| `specs/T5-pages-et-prompts.md` | Inventaire des 81 écrans et un prompt de génération par écran |

Tous les templates sont déjà réalisés dans docs/template.

Gabarit commun des modules 01 à 15 : périmètre → règles métier → compléments au modèle → API → écrans et états → événements → tâches planifiées → gestionnaire de suppression → tests des règles dures.

