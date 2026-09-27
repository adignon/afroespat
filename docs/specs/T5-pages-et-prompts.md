# Pages à construire et prompts

> 78 écrans, par section, avec un prompt par écran. Chaque prompt se colle **après le préambule commun** (§0). Le préambule fixe le design system et la navigation une fois ; le prompt de page ne décrit que le contenu, les composants et les états.

Lot = ordre de construction (`00-fondations.md` §12). Priorité : les lots 1 à 4 forment le produit testable dans une ville.

---

## 0. Préambule commun — à coller en tête de chaque prompt

> Tu construis un écran de **afroexpates.com**, plateforme communautaire pour la diaspora africaine en France. Tout le texte est en français, vouvoiement, phrases courtes.
>
> **Design system** : fond de page `#F2F4F3`, cartes blanches `#FFFFFF` avec bordure 1 px `#E0E5E3`, rayon 14 px (cartes), 10 px (boutons, pastilles), 16 px (grandes cartes). Aucune ombre portée. Police Plus Jakarta Sans ; corps 14–15 px, titres de page 25–30 px graisse 800, libellés de section 11 px majuscules interlettrées, pastilles 10,5–11 px majuscules graisse 700. Texte `#16211D`, secondaire `#5D6B66`, tertiaire `#8A958F`.
>
> **Couleurs** : primaire vert `#16785E` (actions, éléments actifs, badge de vérification), vert fort `#0F5C48` (rail, survol, titres), vert doux `#E3F0EB` (fonds de pastille, encarts). **Terre cuite `#E0733A` réservé au parcours** : étape en cours, jalons, échéances, barres de progression, badge Premium, compteurs d'entraide non lus ; fond `#FBE3D4`, texte `#B4581F`. Succès `#1F7A55`. **Jamais de rouge.** Icônes Lucide trait 1,7 px. **Aucun emoji dans l'interface.** Cible tactile 44 px.
>
> **Navigation ordinateur (1440 px)** : rail vertical 76 px à gauche, fond `#0F5C48` — Accueil, Parcours, Entraide, Services, Agenda ; l'icône active a une pastille claire arrondie, un bouton réglages en bas. À sa droite, un panneau de section de 264 px, fond `#F2F4F3`, composé de cartes blanches empilées : **une carte contextuelle en haut, des sections titrées (libellé 11 px majuscules) avec des items de 44 px et des compteurs en pastille terre cuite, un bloc en bas.** Puis le contenu (max 660 px) et une colonne droite de 300 px. **Ne jamais mettre les icônes de navigation en haut.**
>
> Les cinq panneaux :
> - **Accueil** — carte profil (avatar, nom, « Voir mon profil public ») ; carte **Mon parcours** vert foncé (nom donné par le membre, %, barre terre cuite, « Étape 7 : Logement », bouton Continuer) ; section COMMUNAUTÉ : Fil d'actualité, Guides & Démarches, Fil d'entraide `n`, Réseaux, Parrainage, Villes & Membres, Événements `n` ; bloc VOS RACCOURCIS : mes réseaux (pastille carrée, nom, membres), lien Modifier. Les compteurs y sont des **nouveautés depuis la dernière visite**.
> - **Parcours** — carte du haut : sélecteur si plusieurs, nom, %, barre, étape en cours, bouton terre cuite **Je suis bloqué·e** ; section MON PARCOURS : Vue d'ensemble, Étape en cours, Discussion `n`, Équipe `n`, Checklist de documents, Historique, Réglages ; section PARCOURS PUBLICS : 5 parcours d'autres membres (avatar, nom, « Études · Lyon », mini-barre), Voir tous ; bloc RAPPELS : échéances (puce terre cuite ou grise).
> - **Entraide** — carte du haut **Ma réputation** (grand chiffre « 23 entraides validées », ligne « 4 guides utiles · 2 parrainages · 6 événements ») ; section ENTRAIDE : Toutes les demandes `n`, Vous pouvez aider `n`, Mes demandes, Mes réponses ; section PARRAINAGE : Trouver un parrain, Mes parrainages `n`, Devenir parrain ; bloc du bas : encart terre cuite doux avec la règle « Aucun versement entre membres pour une démarche administrative » et un lien Signaler.
> - **Services** — carte du haut **Mes quotas du mois** (« 2 contacts pro sur 3 », barre, lien Premium) ; section SERVICES : Annonces logement `n`, Bourses & emploi `n`, Annuaire professionnel ; section MON ESPACE : Mes annonces `n`, Mes alertes `PREMIUM`, Ma fiche pro (état) ; bloc du bas : encart vert doux « Vous exercez un métier ? » avec bouton « Créer ma fiche pro ».
> - **Agenda** — carte du haut : mois en cours avec flèches ‹ ›, aujourd'hui en évidence ; section CALENDRIER : **colonne verticale de jours groupés par semaine** — chaque ligne `SAM 21` + titre du premier événement, point vert si événements près de moi, **point terre cuite si j'y participe**, jours vides présents mais atténués, jour sélectionné en fond vert doux ; bloc du bas : bouton plein « Créer un événement » et « 1 sur 1 ce mois-ci ». Dans les panneaux de section, les compteurs sont des **totaux**.
>
> **Mobile (390 px)** : barre d'onglets basse à 5 entrées (Accueil, Parcours, Entraide, Services, Compte) ; le panneau de section devient une barre d'onglets horizontale sous le titre — pour l'Agenda, une bande horizontale de dates défilante.
>
> **Règles** : le mot « certifié » n'apparaît jamais ; aucun compteur de vues nulle part ; tout contenu porte une icône signet « Enregistrer » ; aucun état « échoué » (une étape se met « en pause ») ; les pastilles d'état sont toujours texte + fond ; chaque écran de liste prévoit les états chargement (squelettes), vide (message + action), erreur, et **permission insuffisante** (un encart explicatif avec bouton, jamais une simple erreur). Les membres sont rendus par un composant unique : avatar rond, nom, coche verte de vérification, phase, ville.
>
> Produis l'écran demandé ci-dessous, en ordinateur et en mobile, avec ses états.

---

## 1. Inventaire

| ID | Écran | Route | Lot |
|---|---|---|---|
| **Public et accès** | | | |
| P01 | Connexion / inscription | `/connexion` | 1 |
| P02 | Code OTP | `/connexion/code` | 1 |
| P03 | Page statique | `/p/:slug` | 1 |
| **Onboarding** | | | |
| O01 | Où en êtes-vous ? | `/bienvenue/phase` | 1 |
| O02 | Pays et ville | `/bienvenue/lieu` | 1 |
| O03 | Objectif | `/bienvenue/objectif` | 2 |
| O04 | Profil | `/bienvenue/profil` | 1 |
| O05 | Atterrissage | `/bienvenue/fin` | 2 |
| **Accueil** | | | |
| A01 | Fil d'actualité | `/accueil` | 3 |
| A02 | Publication | `/publications/:id` | 3 |
| A13 | Story — lecture plein écran | `/stories/:id` | 3 |
| A14 | Story — création en trois étapes | `/stories/nouvelle` | 3 |
| A03 | Guides — liste | `/guides` | 6 |
| A04 | Guide — lecture | `/guides/:slug` | 6 |
| A05 | Guide — éditeur | `/guides/nouveau`, `/guides/:slug/modifier` | 6 |
| A06 | Guide — propositions (feuille + reçues) | `/guides/:slug/propositions` | 6 |
| A07 | Réseaux | `/reseaux` | 7 |
| A08 | Réseau | `/reseaux/:slug` | 7 |
| A09 | Sujet | `/reseaux/:slug/sujets/:id` | 7 |
| A10 | Créer un réseau | `/reseaux/nouveau` | 7 |
| A11 | Villes et Membres | `/villes` | 8 |
| A12 | Fiche ville | `/villes/:slug` | 8 |
| **Parcours** | | | |
| J01 | Parcours | `/parcours/:id` | 2 |
| J02 | Créer un parcours | `/parcours/nouveau` | 2 |
| J03 | Je suis bloqué (feuille) | — | 4 |
| J04 | Partager un jalon (feuille) | — | 3 |
| J05 | Équipe | `/parcours/:id/equipe` | 2 |
| J06 | Checklist de documents | `/parcours/:id/documents` | 2 |
| J07 | Historique | `/parcours/:id/historique` | 2 |
| J08 | Réglages | `/parcours/:id/reglages` | 2 |
| J09 | Parcours publics | `/parcours/publics`, `/parcours/publics/:id` | 7 |
| J10 | Fin de parcours | `/parcours/:id/abouti` | 2 |
| J11 | Mes parcours | `/parcours` | 2 |
| **Entraide** | | | |
| H01 | Demandes — liste | `/entraide` | 4 |
| H02 | Demande — détail | `/entraide/:id` | 4 |
| H03 | Publier une demande | `/entraide/nouveau` | 4 |
| H04 | Vous pouvez aider | `/entraide/aider` | 4 |
| H05 | Parrains — liste | `/parrainage` | 7 |
| H06 | Parrain — fiche et demande | `/parrainage/:handle` | 7 |
| H07 | Mes parrainages | `/parrainage/mes-parrainages` | 7 |
| H08 | Devenir parrain | `/parrainage/devenir` | 7 |
| **Services** | | | |
| S01 | Logement — liste | `/services/logement` | 9 |
| S02 | Annonce — détail | `/services/logement/:id` | 9 |
| S03 | Publier une annonce | `/services/logement/nouveau` | 9 |
| S04 | Emploi — liste | `/services/emploi` | 9 |
| S05 | Offre — détail et publication | `/services/emploi/:id`, `/nouveau` | 9 |
| S06 | Annuaire — liste | `/services/annuaire` | 9 |
| S07 | Fiche pro | `/services/annuaire/:id` | 9 |
| S08 | Créer ma fiche pro | `/services/annuaire/ma-fiche` | 9 |
| S09 | Mes annonces | `/services/mes-annonces` | 9 |
| S10 | Mes alertes | `/services/alertes` | 11 |
| **Agenda** | | | |
| E01 | Agenda | `/agenda` | 8 |
| E02 | Événement | `/agenda/:id` | 8 |
| E03 | Créer un événement | `/agenda/nouveau` | 8 |
| E04 | Présence (organisateur) | `/agenda/:id/presence` | 8 |
| **Compte** | | | |
| K01 | Mon profil | `/compte/profil` | 1 |
| K02 | Profil d'un membre | `/@:handle` | 1 |
| K03 | Vérification et niveaux | `/compte/verification` | 5 |
| K04 | Téléphones et sessions | `/compte/securite` | 1 |
| K05 | Contacts | `/compte/contacts` | 7 |
| K06 | Abonnement et Premium | `/compte/abonnement`, `/premium` | 11 |
| K07 | Réglages des notifications | `/compte/notifications` | 10 |
| K08 | Mes données | `/compte/donnees` | 1 |
| K09 | Sanctions | `/compte/sanctions` | 5 |
| K10 | Enregistrés | `/compte/enregistres` | 3 |
| **Messages et transverse** | | | |
| M01 | Messagerie | `/messages`, `/messages/:id` | 7 |
| X01 | Recherche | `/recherche` | 10 |
| X02 | Notifications | panneau + `/notifications` | 10 |
| X03 | Signaler (feuille) | — | 5 |
| X04 | Encarts de refus (niveau, plan) | composants | 1 |
| **Administration** | | | |
| D01 | Connexion admin | `admin/connexion` | 1 |
| D02 | Tableau de bord | `admin/` | 12 |
| D03 | Membres | `admin/membres`, `/:id` | 1 |
| D04 | Modération — file | `admin/moderation` | 5 |
| D05 | Modération — dossier | `admin/moderation/:id` | 5 |
| D06 | Modèles de parcours | `admin/parcours`, `/versions/:id` | 2 |
| D07 | Bibliothèque d'étapes | `admin/etapes` | 2 |
| D08 | Référentiels | `admin/referentiels` | 1 |
| D09 | Guides | `admin/guides` | 6 |
| D10 | Services | `admin/services` | 9 |
| D11 | Alertes arnaques | `admin/alertes` | 5 |
| D12 | Pages et annonces | `admin/contenu` | 1 |
| D13 | Partenaires | `admin/partenaires` | 11 |
| D14 | Abonnements et revenus | `admin/revenus` | 11 |
| D15 | Réglages | `admin/reglages` | 1 |
| D16 | Rapport d'impact | `admin/impact` | 12 |

---

## 2. Prompts — Public et accès

### P01 — Connexion / inscription
> Écran plein, sans rail (le membre n'est pas connecté). Logo en haut à gauche, formulaire centré 420 px : titre « Votre numéro de téléphone », sélecteur de pays (drapeau + indicatif, liste des pays actifs uniquement), champ de numéro, texte d'aide « Nous vous envoyons un code par SMS. Votre numéro n'est jamais affiché aux autres membres. », case à cocher d'acceptation des conditions et de la confidentialité (liens), bouton primaire « Recevoir le code ». Sous le formulaire : trois lignes rassurantes (identité vérifiée, jamais de paiement pour l'aide, données hébergées en Europe). États : pays non couvert (« Nous n'ouvrons pas encore dans ce pays »), trop de tentatives, captcha invisible.

### P02 — Code OTP
> Même cadre que P01. Titre « Entrez le code reçu », numéro masqué (« +229 •• •• •• 42 »), six cases de saisie auto-avançantes, minuteur « Nouveau code dans 0:45 », lien « Renvoyer », lien « Changer de numéro ». États : code invalide (cases en bordure terre cuite douce, message), code expiré, cinq tentatives dépassées.

### P03 — Page statique
> Page de lecture large (760 px), sans colonne droite : titre, date et version, sommaire latéral collant sur ordinateur, corps Markdown (titres, listes, liens). Variante « Ressources » : cartes de contacts professionnels (nom, description, numéro, horaires), bandeau calme en tête. Pied : « Dernière mise à jour le … ».

---

## 3. Prompts — Onboarding

Cadre commun : plein écran, barre de progression en six segments en haut, bouton retour, numéro d'étape « 3/6 », bouton « Continuer » fixé en bas et lien « Passer cette étape » sous lui (sauf O01 sur mobile, où le téléphone est déjà validé).

### O01 — Où en êtes-vous ?
> Titre 29 px, sous-titre d'aide. Trois grandes cartes-boutons (62 px, icône dans un carré vert doux à gauche, titre gras, sous-titre) : « Je prépare mon départ », « Je viens d'arriver (moins de 6 mois) », « Je suis installé·e ». Sélection : bordure verte 2 px + fond vert doux + coche à droite.

### O02 — Pays et ville
> Deux blocs : « D'où venez-vous ? » (sélecteur de pays, actifs seulement, drapeau) et « Où allez-vous ? » ou « Où vivez-vous ? » selon la phase (recherche de ville avec suggestions, villes actives en tête, inactives en gris avec « bientôt »). Texte : ces informations vous rattachent au réseau de votre ville et de votre pays.

### O03 — Objectif
> Titre « Quel est votre objectif ? », aide. Quatre cartes-boutons pour les types de parcours (Étudier, Travailler, Rejoindre ma famille, Régulariser ma situation), chacune avec le nombre d'étapes en sous-titre. Séparateur « sans créer de parcours ». Deux cartes plus légères : « M'intégrer, rencontrer du monde », « Aider les autres ». Les deux groupes ont le même rang visuel de choix.

### O04 — Profil
> Pseudo (avec suggestion générée, vérification de disponibilité en direct), nom d'affichage, avatar (facultatif, cercle avec bouton), statut (chips), compétences (sélecteur multi, recherche), langues (idem), interrupteur « Je suis disponible pour aider » avec types d'aide qui apparaissent. Tout facultatif sauf pseudo et nom.

### O05 — Atterrissage
> Deux variantes. **Avec parcours** : carte de félicitations, nom du parcours (éditable en ligne), première étape en carte terre cuite avec bouton « Commencer ». **Sans parcours** : « Bienvenue à Lyon », carte du réseau de la ville (rejoint automatiquement), trois prochains événements, un parrain suggéré avec bouton « Demander ». Bouton « Aller à l'accueil ».

---

## 4. Prompts — Accueil

### A01 — Fil d'actualité
> Rail sur Accueil, panneau Accueil du préambule (Fil d'actualité actif ; compteurs = nouveautés depuis la dernière visite, par exemple `12` sur Fil d'entraide et `3` sur Événements ; carte Mon parcours avec **le nom donné par le membre**, variante « Créer mon parcours », variante plusieurs parcours). Contenu : **bandeau « Stories du jour »** — une bulle par auteur (avatar dans un anneau vert épais si non vu, gris fin si vu), pastille du type sous l'avatar (CONSEIL · DÉCOUVERTE · INFORMATION, ou le sujet), légende de deux mots, compteur positif en vert (« 31 utile », « 14 à voir », « 2 confirment ») ; première bulle en pointillé « Créer une story » ; chips au-dessus pour filtrer par type ; ordre : informations, conseils, découvertes — puis le composeur (avatar, champ, chips **Victoire · Question · Info · Discussion**, bouton Publier — variante L0 grisée avec encart de niveau), cartes de publication : avatar, nom + coche, pastille de type colorée, ligne « Parcours Études · Lyon · il y a 2 h », corps, encart vert « Étape franchie · 4 sur 12 » sur une Victoire liée à une étape, compteur au vocabulaire du type (« 42 félicitations », « 19 mentions utiles », « 11 réponses »), barre Bravo/Utile/Soutenir · Commenter · Partager. Colonne droite : Événements à Lyon (blocs de date), Nouveaux arrivants (avatars, « Saluer »), Alerte vigilance (carte terre cuite douce), Parrains et contacts en ligne (points verts). États : fil vide (« Rien encore à Lyon. Soyez la première personne à publier. »), chargement.

### A02 — Publication
> Carte de publication complète, puis les commentaires (avatar, nom, texte, horodatage, « Répondre » — une profondeur de réponse), champ de commentaire en bas collant. Pour une Question à plus de 5 réponses, l'auteur voit un encart « Cette question intéresse du monde. La déplacer vers un réseau ? » avec bouton.

### A13 — Story — lecture plein écran
> Écran plein, un seul composant pour les trois types. Fond : couleur de la palette choisie par l'auteur (vert `#16785E`, vert fort `#0F5C48`, terre cuite, bleu nuit, brun, noir, violet) **ou** photo plein écran avec un voile sombre sur les 60 % du bas. En haut : barres de progression (une par story de l'auteur), avatar avec cercle blanc, nom + coche, ligne « Lyon · il y a 3 h · expire dans 21 h », pastille blanche du type et du sujet (« CONSEIL · LOGEMENT »), croix. Corps centré (ou en bas sur photo) : libellé du type en petites majuscules, **texte en 28–30 px graisse 800**, ligne d'état dans un bloc translucide (« 1er des conseils Logement aujourd'hui · 31 trouvent utile » / « Ajoutée aux produits du pays de la fiche Lyon · 14 veulent y aller » / avatars + « 2 membres confirment · dans Guichets du jour »). Bas : **deux boutons ronds avec leur compteur à côté du libellé** — selon le type : Utile · Pas utile / À voir · J'y suis allé·e / Je confirme · Ça a changé — le premier blanc plein, le second contour ; puis « Écrire à Sandra… » avec **l'icône signet** à droite ; ligne d'aide « Touchez pour passer au suivant · glissez pour changer de membre ». Aucun compteur de vues.

### A14 — Story — création en trois étapes
> Façon statut WhatsApp. **Étape 1 « Écrire »** : plein écran sur la couleur choisie, en haut croix · indicateur d'étape (trois points) · alignement · **Aa** · palette ; sous l'indicateur, un sélecteur segmenté **Conseil · Découverte · Information** ; au centre le texte en 30 px avec curseur, compteur « 118 / 280 » ; en bas une bande de sept pastilles de couleur (la sélectionnée cerclée de blanc), un bouton « Photo » pour passer en fond image, une ligne d'aide, et **la flèche blanche ronde** en bas à droite. Variante photo : image plein écran, texte dans un cadre pointillé déplaçable à quatre poignées, boutons Changer · Recadrer · Assombrir le bas. **Étape 2 « Rattacher »** : l'aperçu assombri derrière une feuille du bas blanche : « Ce conseil concerne… », aide, recherche, section MON PARCOURS · ÉTUDES avec l'étape que je viens de franchir présélectionnée (coche verte, fond vert doux), puis SUJETS ; pour une découverte : catégorie (Lieu · Produit · Sortie) et lieu ; pour une information : sujet, lieu suggéré (préfecture, OFII, CAF…), « valable jusqu'à ». Bouton Continuer. **Étape 3 « Publier »** : fond clair, titre « Prêt à publier », miniature 132 × 234 de la story, deux cartes (SUJET, VISIBLE 24 heures « puis gardé par ceux qui l'enregistrent »), QUI LE VOIT (Tous les membres / Lyon seulement), interrupteur « Autoriser les messages », encart terre cuite doux « Pas de lien, de numéro ni de montant précis », boutons Modifier · **Publier**.

### A03 — Guides — liste
> Titre « Guides et Démarches », onglets Les plus utiles · Récents · À vérifier, filtres (catégorie, pays, ville), bouton « Écrire un guide ». Cartes : titre, catégorie, portée (universel / drapeau du pays), auteur + coche, **« Mis à jour le 12 mars » aussi visible que le titre**, « 84 ont trouvé utile », bandeau ambre « À vérifier » si applicable. Colonne droite : « Guides manquants » (top des recherches sans résultat), alerte arnaque.

### A04 — Guide — lecture
> En-tête : titre, catégorie, portée, auteur + contributeurs (avatars), date de mise à jour en évidence, bandeau selon état (À vérifier / Des membres signalent que cette information a changé / Maintenu par la communauté). Corps Markdown 760 px. Barre latérale collante : « Ce guide vous a-t-il aidé ? Oui / Non », « Proposer une correction », « L'information a changé », « Signaler », historique des versions. Bas : commentaires. Sélection de texte dans le corps → bulle « Proposer une correction sur ce passage ».

### A05 — Guide — éditeur
> Deux colonnes : éditeur Markdown à gauche, aperçu à droite (empilés sur mobile). Champs : titre, catégorie, portée (universel / pays), ville facultative. Brouillon auto-enregistré (indicateur). Bouton Publier avec récapitulatif des règles (pas de mot « certifié », pas de coordonnées). Variante « à partir de mon parcours » : corps pré-rempli d'une section par étape.

### A06 — Guide — propositions
> Feuille « Proposer une correction » : passage sélectionné en lecture seule (fond gris), champ de remplacement, motif obligatoire (« Pourquoi cette correction ? »), source facultative, bouton Envoyer, note « L'auteur a 14 jours pour répondre ». Page « Propositions reçues » (auteur) : liste, chaque proposition en avant/après côte à côte avec surlignage, motif, proposant, délai restant, trois boutons Accepter · Accepter en modifiant · Refuser (motif).

### A07 — Réseaux
> Deux sections : « Mes réseaux » (cartes avec pastille carrée, nom, compteur de membres, non-lus, sourdine) et « Découvrir » (filtres Ville · Pays · Intérêt · catégorie, cartes avec couverture, description, membres, bouton Rejoindre / Demander). Bouton « Créer un réseau d'intérêt » — ou, sous le seuil, message « Les réseaux d'intérêt ouvrent à partir de 50 membres à Lyon (34 aujourd'hui) ».

### A08 — Réseau
> Couverture, nom, compteur, mon rôle, boutons Rejoindre / Quitter (désactivé « Réseau automatique » pour ville et pays) / Sourdine. Onglets : Fil (composeur + publications) · Sujets (épinglés en tête avec icône, puis liste : titre, état Ouvert/Résolu, réponses, dernier message) · Événements · Membres (recherche, rôles) · Album (grille) · Sondages · À propos. Barre d'actions du propriétaire : Annonce, Épingler, Gérer.

### A09 — Sujet
> Titre, pastille d'état, épinglé si applicable, auteur, corps, réponses (une profondeur), bouton « Marquer résolu » pour l'auteur, actions modérateur (épingler, clore, masquer). Champ de réponse collant.

### A10 — Créer un réseau
> Formulaire : nom, description, catégorie, visibilité (public / sur demande / sur invitation, avec explication), couverture. Bloc **« Invitez au moins 5 membres »** : recherche par pseudo + suggestions parmi mes contacts, compteur « 3 sur 5 », bouton Créer désactivé tant que le seuil n'est pas atteint.

### A11 — Villes et Membres
> Onglets Carte · Annuaire. **Carte** : carte de France vectorielle (pas de tuiles), un cercle par ville actif proportionnel au nombre de membres avec libellé « Lyon · 340 », filtre « Pays d'origine : Tous ▾ », clic → fiche. **Annuaire** : filtres (ville + rayon, pays, phase, statut, compétence, langue, disponible pour aider), cartes membre (avatar, nom, coche, phase, ville, compétences, badge « Disponible pour aider »).

### A12 — Fiche ville
> En-tête : nom, région, membres, répartition par pays (barres), lien vers le réseau. Sections : Nouveaux arrivants (avatars + Saluer), Événements à venir, puis quatre onglets de contenu communautaire — Bons plans, Produits du pays (nom + adresse), Budgets réels (médiane en tête, liste « Chambre en coloc : 480 € »), Témoignages. Chaque contribution : auteur, vote utile, signaler. Bouton « Contribuer ».

---

## 5. Prompts — Parcours

### J01 — Parcours
> Rail sur Parcours ; panneau Parcours du préambule (Vue d'ensemble actif, section PARCOURS PUBLICS peuplée de 5 parcours, RAPPELS en bas). En-tête blanc : « PARCOURS ÉTUDES », pastille PRIVÉ, titre = nom du parcours (30 px), sous-titre « Cotonou → Lyon · départ prévu le 12 septembre », barre terre cuite « 7 / 12 étapes », boutons Modifier les étapes · Inviter. Timeline verticale : bouton « 6 étapes franchies » (replié, dépliable, points pleins verts, durée réelle), **étape en cours** : anneau terre cuite 5 px et carte à bordure terre cuite claire — titre, EN COURS, « Échéance dans 9 jours » en terre cuite, description, deux tuiles (Guide : obtenir Visale / 12 annonces à Lyon), avatars empilés « 8 membres de Lyon ont franchi cette étape » + « Leur écrire », bouton terre cuite **Je suis bloqué·e** ; sous la carte, au plus un encart partenaire en pointillé avec mention « Partenaire ». Étapes à venir : points creux gris, texte atténué, date. Colonne droite : Équipe (avatars, rôles, bouton Discussion), Visibilité (cadenas, « Projet privé — vous et 3 invités »), Partager un jalon (si une étape majeure non partagée). Glisser-déposer des étapes en mode « Modifier ». Mobile : en-tête compact, timeline, bouton bloqué pleine largeur.

### J02 — Créer un parcours
> Quatre cartes de type avec nombre d'étapes et description courte ; champ « Donnez un nom à votre parcours » pré-rempli ; date d'arrivée cible (facultative, avec explication du rétro-planning) ; aperçu des étapes. Variante Régulariser : choix entre régularisation / changement de statut / renouvellement. État plan atteint : encart « Vous avez déjà un parcours actif » avec bouton Premium, sans bloquer la lecture.

### J03 — Je suis bloqué (feuille)
> Feuille du bas (mobile) ou modale (ordinateur), trois volets avec indicateur : **1.** texte pré-rempli éditable (« Je suis bloqué·e à l'étape Logement de mon parcours Études à Lyon, échéance dans 9 jours. Voici où j'en suis : »), aide « Relisez et complétez. Rien n'est publié sans votre accord. » ; **2.** portée : « Publier dans Annonces logement » ou « Envoyer seulement à mon équipe et mon parrain » ; **3.** aperçu de la carte telle qu'elle apparaîtra, boutons Publier / Annuler. Jamais de publication en un clic.

### J04 — Partager un jalon (feuille)
> Aperçu de l'encart « Étape franchie · 4 sur 12 — Visa étudiant », **champ vide** « Racontez-la avec vos mots », aide « Cela encourage ceux qui préparent leur départ », boutons Publier · Plus tard.

### J05 — Équipe
> Liste des membres (avatar, nom, rôle en pastille, date), rôles expliqués (Observateur — voit la progression ; Accompagnant — peut échanger et recevoir vos demandes privées), bouton Inviter (recherche par pseudo + contacts), retrait, invitations en attente. Le parrain apparaît avec la mention « Parrain ».

### J06 — Checklist de documents
> Par étape (accordéon), cases à cocher, ajout d'un libellé, suppression, progression par étape. Encart calme : « Cochez ce que vous avez réuni. Les documents restent chez vous. »

### J07 — Historique
> Chronologie inversée : icône par type d'activité, texte, date, lien vers l'objet. Bouton « Exporter mon parcours (PDF) » (Premium sinon encart). Bouton « Écrire un guide à partir de ce parcours » si abouti.

### J08 — Réglages
> Nom, date d'arrivée cible, **visibilité en trois cartes-boutons** : Privé (vous seul·e) · Partagé (vous et vos invités) · Public (les membres connectés voient votre progression) — sous Public, l'explication exacte : « Ils verront vos étapes franchies et leur durée. Jamais vos notes, vos documents, votre équipe ni votre discussion. Un parcours en pause n'est jamais affiché. » ; migration de version (encart si une version plus récente existe, avec résumé des changements), mettre en pause, arrêter (confirmation sans vocabulaire d'échec).

### J09 — Parcours publics
> Page « Parcours publics » : titre, sous-titre « 14 membres suivent un parcours Études vers Lyon », filtres type · ville · avancement. Cartes : avatar, nom, coche, « Études · Lyon », étape en cours, mini-timeline horizontale des étapes franchies avec durée (« Visa · 4 sem. »), progression. Boutons Écrire · Proposer comme parrain si disponible. Encart d'activation si mon parcours n'est pas public (« Rendre mon parcours public ? Cela encourage ceux qui suivent le même chemin »). Vue d'un parcours public : en-tête (membre, type, ville, progression), timeline en lecture seule — étapes franchies avec durées, étape en cours — **aucun titre personnel, aucune note, aucune checklist, aucune équipe, aucune discussion**.

### J10 — Fin de parcours
> Plein écran calme : « Vous y êtes arrivé·e ! », récapitulatif (durée totale, étapes, aides reçues), puis « Aidez le suivant » avec trois cartes : Devenir parrain, Écrire un guide à partir de mon parcours, Organiser une rencontre. Lien « Voir mon parcours ».

### J11 — Mes parcours
> Liste de cartes (nom, type, statut, progression, dernière activité), parcours aboutis en section séparée, bouton Créer, encart plan si limite.

---

## 6. Prompts — Entraide

### H01 — Demandes — liste
> Rail sur Entraide ; panneau Entraide du préambule (Ma réputation en haut, Toutes les demandes actif avec `41`, Vous pouvez aider `4`, section PARRAINAGE, règle en bas). Titre « Fil d'entraide », sous-titre « 41 demandes ouvertes à Lyon · 178 résolues ce mois-ci », bouton « Publier une demande ». Chips : Tout · Démarches · Service · Trajet · Matériel · Autre | Lyon · Ouvertes. **Bandeau permanent** terre cuite doux : « Aucun versement entre membres pour une démarche administrative. Si on vous demande de l'argent, signalez. » Cartes : pastilles (type ; « Depuis un parcours » avec bordure terre cuite et ligne de contexte d'étape ; « Résolue » grisée), horodatage, titre, corps tronqué, auteur + coche + phase, « 3 réponses », bouton Répondre. Carte résolue : encart vert « Sandra M. a été marqué·e « ça m'a aidé » — contact créé ». Colonne droite : règle, « Vous pouvez aider » (3 demandes), « Ma réputation » (grand nombre + détail).

### H02 — Demande — détail
> Demande complète avec contexte de parcours, réponses (auteur, texte, date), pour l'auteur : bouton « Ça m'a aidé » sur chaque réponse, « Résolu sans réponse », modifier ; pour les autres : champ de réponse, « Répondre en privé ». Après résolution : encart de clôture, proposition « Marquer l'étape comme franchie ? » si liée à un parcours.

### H03 — Publier une demande
> Segment Demande / Offre (Offre grisée en L0 avec encart), type (chips), titre, corps, ville, échéance facultative. Encart : « Pour un logement ou un emploi, utilisez Services ». Rappel de la règle. Bouton Publier.

### H04 — Vous pouvez aider
> Liste de demandes avec, sur chaque carte, la raison : « Vous avez franchi l'étape Logement » ou « Correspond à vos types d'aide ». Tri par échéance.

### H05 — Parrains — liste
> Rail sur Entraide, item « Trouver un parrain » actif. Titre « Parrainage », explication en deux lignes, filtres (ville, langue, type de parcours, pays), cartes : avatar, nom, coche L2, ville, types de parcours connus, « 4 parrainages menés · 4,8 », pastille Disponible / Complet, bouton Demander. Encart « Devenir parrain » en colonne droite (avec conditions).

### H06 — Parrain — fiche et demande
> Fiche : bio, parcours connus, langues, évaluations (note, commentaires anonymisés au prénom), parrainages menés. Feuille de demande : message obligatoire « Présentez-vous et dites ce que vous attendez », choix du parcours à lier, rappel « Un parrainage n'implique jamais d'argent ni de garantie », envoi → « Demande envoyée. X a 7 jours pour répondre. »

### H07 — Mes parrainages
> Deux onglets : Comme filleul · Comme parrain. Cartes : personne, parcours lié, date de fin « dans 42 jours », boutons Discussion · Prolonger · Terminer ; terminés : évaluation à déposer ou déposée. Demandes en attente (reçues, avec Accepter / Refuser ; envoyées, avec délai).

### H08 — Devenir parrain
> Conditions (identité + numéro français vérifiés, parcours abouti ou 12 mois d'installation) avec coches d'éligibilité, formulaire (bio, types de parcours, nombre de filleuls 1–3, disponibilité), guide du parrain en encart (ce qu'on fait, ce qu'on ne fait jamais), bouton Activer.

---

## 7. Prompts — Services

### S01 — Logement — liste
> Rail sur Services ; panneau Services du préambule (Mes quotas du mois en haut, Annonces logement actif avec `12`, MON ESPACE, encart fiche pro en bas). Titre, sous-titre « 12 annonces à Lyon · publication réservée aux profils vérifiés », bouton Publier (grisé sous L2 avec l'explication : « Publier un logement demande un numéro français vérifié — c'est ce qui protège tout le monde des fausses annonces »). Chips (Tout · Colocation · Location · Temporaire | Lyon · Budget). **Bandeau de sécurité** permanent. Grille 3 colonnes : photo, pastille de kind, prix, titre, détail (meublé · disponible le · durée), auteur + coche L2. Pied : un encart partenaire en pointillé au maximum.

### S02 — Annonce — détail
> Galerie, kind, prix, titre, détails, description, quartier, auteur (avec « Connecté·e à 2 de vos contacts »), boutons Contacter · Signaler, rappel de prudence (renforcé si l'annonce est à risque moyen : « Soyez particulièrement prudent·e avec cette annonce »). État L0 : Contacter remplacé par « Pour contacter cette personne, demandez d'abord un parrain ».

### S03 — Publier une annonce
> Kind (offre / recherche), titre, description, ville, quartier, prix (facultatif si temporaire gratuit), meublé, disponible à partir de, durée, photos (1–8, glisser-déposer). Bouton Publier. État après envoi si vérification : « Votre annonce est en vérification. Vous serez prévenu·e. »

### S04 — Emploi — liste
> Onglets Offres · Profils disponibles · Mon profil de recherche. Offres : sponsorisées en tête avec pastille « Sponsorisée » toujours visible, puis chronologique ; cartes : kind, titre, entreprise, ville ou « Télétravail », contrat, secteur, « Partagée par Sandra M. ». Profils : titre, secteurs, contrats, ville, bouton Contacter. Bouton Publier une offre.

### S05 — Offre — détail et publication
> Détail : tout, lien externe avec avertissement (« Vous quittez la plateforme »), Recommander un membre (feuille : recherche, commentaire), Signaler. Publication : formulaire, option « Sponsoriser 14 jours » (Premium, compteur 5/mois).

### S06 — Annuaire — liste
> Recherche métier + ville, chips de métiers fréquents, **fiches mises en avant** (2 max, en tête, libellé « Fiche mise en avant »), puis liste : avatar, nom, métier, villes couvertes, langues, « Recommandé·e par 7 membres », bouton Voir. Compteur de quota en haut : « 2 contacts sur 3 ce mois-ci ».

### S07 — Fiche pro
> Nom, métier, badge Pro si abonné, description, tarifs indicatifs, villes, langues, recommandations (avatar + commentaire, « Vous pouvez recommander un professionnel avec qui vous avez déjà interagi » sinon), « Connecté·e à N de vos contacts », bouton Contacter (quota), Signaler.

### S08 — Créer ma fiche pro
> Conditions (L2 + justificatif), formulaire (métier, nom commercial, description, tarifs, villes 1–10, méthode de contact), dépôt du justificatif avec note « Il n'est jamais affiché », choix de formule (Gratuite / Pro / Pro+ avec avantages), statut « en attente de validation » après envoi.

### S09 — Mes annonces
> Onglets Logement · Emploi. Cartes avec statut (Active, En pause, Trouvé, Expirée, En vérification), actions Renouveler · Pause · Logement trouvé · Supprimer, compteur de vues et contacts.

### S10 — Mes alertes
> Liste d'alertes (kind, critères résumés, actif, dernier envoi), créer (formulaire de critères), badge Premium ; sans Premium : encart explicatif.

---

## 8. Prompts — Agenda

### E01 — Agenda
> Rail sur Agenda ; panneau Agenda du préambule : carte du mois, **calendrier vertical** (semaines empilées, chaque jour sur une ligne : `SAM 21`, titre du premier événement, point vert = événements près de moi, point terre cuite = j'y participe ; jours vides atténués ; jour sélectionné en fond vert doux), bouton Créer en bas avec le quota. Page : titre du jour sélectionné (« Samedi 21 février »), chips Tous · Mes participations · Mes organisations, puis les cartes du jour — **celles où je participe en tête**, marquées d'une pastille terre cuite « Vous y allez », puis les autres près de chez moi et dans mes réseaux (bloc de date, titre, type, lieu, compteur, réseau si réservé). Sans sélection : aujourd'hui, ou le prochain jour avec événement. État vide du jour : « Rien ce jour-là près de chez vous » + lien vers le prochain jour. Mobile : bande horizontale de dates défilante sous le titre, même page dessous. Colonne droite : « Ce week-end » et rappel de la carte de la ville.

### E02 — Événement
> Couverture, type, titre, date et heure, lieu (nom + adresse texte), organisateur, description, compteur, avatars des participants, boutons RSVP (Je viens · Peut-être · Je ne viens pas) — liste d'attente si complet —, bouton « Je suis là » actif pendant l'événement, Signaler. Organisateur : Modifier, Annuler, Cocher les présents.

### E03 — Créer un événement
> Type (chips), titre, description, ville, lieu, adresse (texte libre, note « jamais géolocalisée »), date/heure de début et fin, capacité, réservé à un réseau (sélecteur), couverture. Encart de quota « 1 événement sur 1 ce mois-ci » en gratuit.

### E04 — Présence
> Liste des inscrits avec cases « Présent·e », recherche, compteur « 18 présents sur 23 inscrits », bouton Enregistrer. Note : « La présence alimente l'indicateur de la plateforme et crée des suggestions de contact. »

---

## 9. Prompts — Compte

### K01 — Mon profil
> Rail : réglages en bas (ou onglet Compte sur mobile). Onglets Profil · Vérification · Sécurité · Contacts · Abonnement · Notifications · Données. Profil : aperçu tel que vu par les autres (carte), puis formulaire (avatar, nom, pseudo avec date de dernier changement, bio, phase, ville, dates, statut, compétences, langues, disponibilité pour aider + types, « Apparaître dans les nouveaux arrivants », « Profil visible hors connexion »). Pays d'origine : modifiable une fois, puis grisé avec explication.

### K02 — Profil d'un membre
> Couverture neutre, avatar, nom, pseudo, coche et niveau, phase, ville, pays (drapeau), ancienneté, bio, compétences, langues, « Disponible pour aider » avec types, réputation (quatre compteurs : entraides validées, guides utiles, parrainages, événements), « Connecté·e à N de vos contacts », réseaux communs, boutons Écrire · Ajouter aux contacts (avec motif) · Recommander · Bloquer · Signaler. Guides publiés. **Aucun compteur de contacts.**

### K03 — Vérification et niveaux
> Trois cartes de niveau en colonne : « Compte créé », « Identité vérifiée », « Présence en France vérifiée » — chacune avec état (acquise / à faire), ce qu'elle débloque (liste), et l'action (Vérifier mon identité → explication Didit, deux minutes, pièce d'identité ; Ajouter mon numéro français). États KYC : en cours, en revue, refusée avec délai, mineur.

### K04 — Téléphones et sessions
> Numéros masqués avec pays et rôle (principal / destination), Ajouter, Retirer (dernier non retirable), sessions actives (appareil, ville approximative, dernière activité, Révoquer), « Révoquer toutes les autres ».

### K05 — Contacts
> Onglets Mes contacts · Demandes (reçues avec message et Accepter/Refuser, envoyées) · Suggestions (« Vous étiez à la même rencontre ») · Bloqués (Débloquer). Cartes membre avec origine du contact (« Entraide », « Parrainage », « Rencontre »).

### K06 — Abonnement et Premium
> Plan actuel, quotas en barres (parcours, événements, contacts pro), essai en cours, factures (liste, PDF), Annuler / Reprendre. Page Premium : comparatif Gratuit / Premium en deux colonnes, prix « 4 €/mois » ou « 2 600 F/mois » selon le pays, mensuel / annuel, choix Carte / Mobile Money (MTN, Moov), puis flux Mobile Money : numéro, opérateur, attente 5 min avec animation calme, succès. Rappel : ce qui reste gratuit pour tous.

### K07 — Réglages des notifications
> Grille catégorie × canal (in-app, push, email) avec interrupteurs ; catégories non désactivables grisées avec explication ; heures calmes (plage) ; email (ajouter / vérifier) ; résumé hebdomadaire ; bouton « Activer les notifications » (push).

### K08 — Mes données
> Trois blocs : Télécharger mes données (délai, lien 7 jours) · Désactiver mon compte (explication 6 mois) · Supprimer mon compte (écran de confirmation détaillé : ce qui est supprimé, ce qui est conservé sans nom, délai de 7 jours, confirmation par code SMS).

### K09 — Sanctions
> Liste (type, règle, dates), bouton Contester (formulaire une fois), statut de la contestation.

### K10 — Enregistrés
> Compte → Enregistrés. Titre, compteur « 14 enregistrés », chips par type : Tout · Stories · Guides · Entraide · Événements · Annonces · Parrains · Membres · Réseaux · Villes. Liste chronologique de cartes compactes (même composant que dans leur section, en hauteur réduite), chacune avec la date d'enregistrement et **une pastille d'état** : « Expiré, gardé pour vous » (story), « Résolue », « Passé », « Plus disponible », « Mis à jour le 12 mars », « Contenu retiré » (grisé, non ouvrable). Icône signet pleine pour retirer. État vide : « Vous n'avez rien enregistré. Touchez le signet sur un contenu pour le retrouver ici. » Aucun compteur public, aucune notion de partage.

---

## 10. Prompts — Messages et transverse

### M01 — Messagerie
> Deux volets sur ordinateur (liste 320 px + conversation), pages séparées sur mobile. Liste : avatar, nom, dernière ligne, horodatage, non-lus, section « Demandes » (premiers messages non acceptés). Conversation : en-tête (nom, coche, lien profil ; pour un parcours : nom du parcours et membres), bulles, « Vu », image, champ de saisie, message système (« Sandra a rejoint le parcours »). État demande en attente : « Premier message envoyé. Vous pourrez continuer quand X aura répondu. » Bloquer et Signaler dans le menu.

### X01 — Recherche
> Barre haute avec suggestions dès 3 caractères. Page : onglets Tout · Guides · Sujets · Entraide · Logement · Emploi · Événements · Membres · Villes · Pros avec compteurs ; filtres (ville, pays, période, état) ; cartes du type. État vide : « Aucun résultat. Posez la question à la communauté ? » avec bouton.

### X02 — Notifications
> Panneau déroulant depuis la cloche (10 dernières, Tout marquer lu, Voir tout) ; page complète avec filtres par catégorie, lignes : icône, texte regroupé (« Sandra et 4 autres ont réagi »), horodatage, non-lu en fond vert doux.

### X03 — Signaler (feuille)
> Motifs en liste (Arnaque, Demande d'argent, Harcèlement, Indésirable, Inapproprié, Autre), détails, note sur les messages (« La conversation sera visible des modérateurs »), Envoyer, confirmation « Merci. Nous regardons sous 24 heures. »

### X04 — Encarts de refus (composants)
> Deux composants réutilisés partout. **Niveau** : carte vert doux, icône, titre (« Cette action demande une identité vérifiée »), corps, bouton d'action, lien « Voir les niveaux ». **Plan** : carte terre cuite douce, « 1 événement sur 1 ce mois-ci — réinitialisé le 1er octobre », bouton « Découvrir Premium », lien fermer. Ni l'un ni l'autre ne bloque la navigation.

---

## 11. Prompts — Administration

Préambule complémentaire pour l'admin : *application séparée, plus dense, tableau plutôt que cartes, même palette, rail d'icônes admin (Tableau de bord, Membres, Modération, Parcours, Contenu, Référentiels, Services, Revenus, Réglages), pas de colonne droite, largeur pleine.*

### D01 — Connexion admin
> Email, mot de passe, puis code TOTP (six cases), enrôlement forcé si absent (QR code + code de secours à télécharger). Verrouillage après 5 échecs.

### D02 — Tableau de bord
> En tête : **indicateur clé** « % de membres présents à au moins un événement sur 90 jours » par ville, courbe hebdomadaire, objectif 30 % en ligne pointillée. Alertes (SLA dépassé, justificatifs en attente, villes à activer). Blocs : Membres (inscrits, actifs, par phase, par niveau), Parcours (créés, actifs, aboutis, en pause), Entraide (ouvertes, résolues, délai médian), Guides, Parrainage, Événements, Réseaux, Services, Modération, Revenus (MRR, Mobile Money vs carte, affiliation). Filtres période et ville.

### D03 — Membres
> Recherche (pseudo, nom, numéro saisi → recherche par empreinte, jamais affiché). Fiche : identité, niveau et détail (numéros masqués, statut KYC, dates), phase, ville, plan, compteurs, sanctions, dossiers, sessions, consentements, notes internes ; actions avec motif obligatoire (rétrograder, corriger phase/ville, révoquer sessions, désactiver, supprimer maintenant, générer un export). **Aucun numéro en clair.**

### D04 — Modération — file
> Tableau trié priorité puis SLA : priorité (pastille 1–5), sujet (type + extrait), auteur, source (signalement / IA / règle), signalements, assigné, SLA (vert / ambre / dépassé), Prendre. Filtres statut, priorité, type, assigné.

### D05 — Modération — dossier
> Trois colonnes : **contenu** (intégral, images, conversation dépliable si jointe) · **contexte** (auteur, historique de sanctions et dossiers, signalements reçus avec motifs, verdict IA et étiquettes) · **actions** (Conserver, Masquer, Retirer, Avertir, Suspendre 1/7/30 j, Bannir [super-admin], Note) avec motif obligatoire ≥ 20 caractères. Contestation affichée si présente.

### D06 — Modèles de parcours
> Liste des types avec versions (brouillon / publiée / archivée, pays). Éditeur de version : liste ordonnée d'étapes glisser-déposer (chaque ligne : définition, position, optionnel, jours avant l'arrivée), panneau de propriétés à droite (surcharges), graphe des dépendances, prévisualisation membre, bouton Publier avec récapitulatif « 142 parcours en cours seront notifiés ».

### D07 — Bibliothèque d'étapes
> Tableau des définitions (code, nom, catégorie, durée, cible du blocage, jalon, risque, guide lié) ; éditeur : tous les champs, gabarit avec variables, checklist de documents (liste éditable), message de risque. Statistiques : délai réel médian observé, taux de blocage, avec bouton « Appliquer comme durée indicative ».

### D08 — Référentiels
> Onglets Pays (statut, activer avec confirmation), Villes (nom, région, membres, statut, Activer, Fusionner, import CSV), Langues, Compétences, Métiers (réordonnancement).

### D09 — Guides
> Onglets : Propositions escaladées (avant/après, décider), Signalés obsolètes (délai avant dépublication), Tous (statut, forcer). Basculer « maintenu par la communauté », retour arrière.

### D10 — Services
> Justificatifs pro en attente (aperçu du document, approuver / rejeter avec motif) ; annonces logement à risque (score, drapeaux, aperçu, publier / retirer) ; réglage des bornes de prix par ville.

### D11 — Alertes arnaques
> Liste, éditeur (titre, corps, gravité, ciblage ville/pays/global, épinglée, expiration, dossier lié), aperçu tel qu'affiché aux membres.

### D12 — Pages et annonces
> Pages : liste, éditeur Markdown, versions, publier (avertissement « redemande de consentement » pour CGU et confidentialité). Annonces : éditeur, ciblage (villes, pays, phases, plans), période, aperçu du bandeau.

### D13 — Partenaires
> Partenaires (fiche, logo, catégorie, modèle de rémunération, contrat) ; placements par étape : tableau étape × pays avec l'encart résolu, ajout refusé si un placement actif existe ; import CSV de conversions ; statistiques clics / conversions / revenus.

### D14 — Abonnements et revenus
> Plans (prix EUR/XOF, limites — super-admin), abonnés (statut, fournisseur, période, échecs), remboursements, courbes MRR et affiliation.

### D15 — Réglages
> Onglets Feature flags (clé, activé, pourcentage, conditions), Paramètres système (clé, valeur, description, dernier changement), Équipe (comptes, rôles, TOTP, dernier accès), Journal d'audit (filtres acteur/action/cible/période, export).

### D16 — Rapport d'impact
> Sélecteur de trimestre, aperçu paginé (membres accompagnés, parcours aboutis, présences, entraides, guides, parrainages, répartitions, témoignages citables), bouton Exporter en PDF.
