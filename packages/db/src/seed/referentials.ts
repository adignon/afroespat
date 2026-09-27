/**
 * Données de départ — référentiels (T3 partie B).
 *
 * « C'est de la donnée, pas du code ; elle est administrée ensuite en
 * back-office. » Ce fichier ne sert qu'au premier déploiement et aux
 * environnements de développement.
 *
 * Lancement mono-pays (02 §2.1) : un seul pays d'origine actif (Bénin) et un
 * seul pays de destination actif (France). Les autres sont chargés INACTIFS,
 * pour être activables en un clic — activer un pays est une écriture en
 * back-office, jamais un déploiement.
 *
 * Toutes les villes sont inactives : « la ville pilote est activée à la main le
 * jour du lancement » (T3 B.2). Une carte vide partout tue la confiance.
 */

export interface CountrySeed {
  iso2: string;
  nameFr: string;
  dialCode: string;
  kind: 'ORIGIN' | 'DESTINATION' | 'BOTH';
  isActive: boolean;
  sortOrder: number;
}

export const COUNTRIES: CountrySeed[] = [
  { iso2: 'FR', nameFr: 'France', dialCode: '+33', kind: 'DESTINATION', isActive: true, sortOrder: 0 },
  { iso2: 'BJ', nameFr: 'Bénin', dialCode: '+229', kind: 'ORIGIN', isActive: true, sortOrder: 1 },
  { iso2: 'TG', nameFr: 'Togo', dialCode: '+228', kind: 'ORIGIN', isActive: false, sortOrder: 2 },
  { iso2: 'CI', nameFr: "Côte d'Ivoire", dialCode: '+225', kind: 'ORIGIN', isActive: false, sortOrder: 3 },
  { iso2: 'SN', nameFr: 'Sénégal', dialCode: '+221', kind: 'ORIGIN', isActive: false, sortOrder: 4 },
  { iso2: 'CM', nameFr: 'Cameroun', dialCode: '+237', kind: 'ORIGIN', isActive: false, sortOrder: 5 },
  { iso2: 'BF', nameFr: 'Burkina Faso', dialCode: '+226', kind: 'ORIGIN', isActive: false, sortOrder: 6 },
  { iso2: 'ML', nameFr: 'Mali', dialCode: '+223', kind: 'ORIGIN', isActive: false, sortOrder: 7 },
  { iso2: 'NE', nameFr: 'Niger', dialCode: '+227', kind: 'ORIGIN', isActive: false, sortOrder: 8 },
  { iso2: 'GN', nameFr: 'Guinée', dialCode: '+224', kind: 'ORIGIN', isActive: false, sortOrder: 9 },
  { iso2: 'GA', nameFr: 'Gabon', dialCode: '+241', kind: 'ORIGIN', isActive: false, sortOrder: 10 },
  { iso2: 'CG', nameFr: 'Congo', dialCode: '+242', kind: 'ORIGIN', isActive: false, sortOrder: 11 },
  { iso2: 'CD', nameFr: 'RD Congo', dialCode: '+243', kind: 'ORIGIN', isActive: false, sortOrder: 12 },
  { iso2: 'MG', nameFr: 'Madagascar', dialCode: '+261', kind: 'ORIGIN', isActive: false, sortOrder: 13 },
  { iso2: 'MA', nameFr: 'Maroc', dialCode: '+212', kind: 'ORIGIN', isActive: false, sortOrder: 14 },
  { iso2: 'DZ', nameFr: 'Algérie', dialCode: '+213', kind: 'ORIGIN', isActive: false, sortOrder: 15 },
  { iso2: 'TN', nameFr: 'Tunisie', dialCode: '+216', kind: 'ORIGIN', isActive: false, sortOrder: 16 },
];

export interface CitySeed {
  name: string;
  slug: string;
  region: string;
  latitude: number;
  longitude: number;
}

/**
 * Villes de France. Coordonnées du centre-ville, saisies à la main : elles
 * servent au tri par proximité (haversine) et au compteur « à moins de 30 km ».
 * Pas de PostGIS, pas de géocodage — aucune position individuelle n'est
 * collectée (décision T4).
 *
 * Villeurbanne, Créteil, Nanterre, Saint-Denis, Cergy, Évry et Versailles
 * restent DISTINCTES de leur métropole : le rayon de 30 km les rapproche déjà,
 * et les fusionner effacerait une appartenance que les membres revendiquent.
 */
export const CITIES: CitySeed[] = [
  { name: 'Paris', slug: 'paris', region: 'Île-de-France', latitude: 48.8566, longitude: 2.3522 },
  { name: 'Lyon', slug: 'lyon', region: 'Auvergne-Rhône-Alpes', latitude: 45.764, longitude: 4.8357 },
  { name: 'Marseille', slug: 'marseille', region: "Provence-Alpes-Côte d'Azur", latitude: 43.2965, longitude: 5.3698 },
  { name: 'Toulouse', slug: 'toulouse', region: 'Occitanie', latitude: 43.6047, longitude: 1.4442 },
  { name: 'Lille', slug: 'lille', region: 'Hauts-de-France', latitude: 50.6292, longitude: 3.0573 },
  { name: 'Bordeaux', slug: 'bordeaux', region: 'Nouvelle-Aquitaine', latitude: 44.8378, longitude: -0.5792 },
  { name: 'Nantes', slug: 'nantes', region: 'Pays de la Loire', latitude: 47.2184, longitude: -1.5536 },
  { name: 'Strasbourg', slug: 'strasbourg', region: 'Grand Est', latitude: 48.5734, longitude: 7.7521 },
  { name: 'Montpellier', slug: 'montpellier', region: 'Occitanie', latitude: 43.6108, longitude: 3.8767 },
  { name: 'Rennes', slug: 'rennes', region: 'Bretagne', latitude: 48.1173, longitude: -1.6778 },
  { name: 'Grenoble', slug: 'grenoble', region: 'Auvergne-Rhône-Alpes', latitude: 45.1885, longitude: 5.7245 },
  { name: 'Nice', slug: 'nice', region: "Provence-Alpes-Côte d'Azur", latitude: 43.7102, longitude: 7.262 },
  { name: 'Rouen', slug: 'rouen', region: 'Normandie', latitude: 49.4432, longitude: 1.0993 },
  { name: 'Reims', slug: 'reims', region: 'Grand Est', latitude: 49.2583, longitude: 4.0317 },
  { name: 'Le Havre', slug: 'le-havre', region: 'Normandie', latitude: 49.4944, longitude: 0.1079 },
  { name: 'Saint-Étienne', slug: 'saint-etienne', region: 'Auvergne-Rhône-Alpes', latitude: 45.4397, longitude: 4.3872 },
  { name: 'Toulon', slug: 'toulon', region: "Provence-Alpes-Côte d'Azur", latitude: 43.1242, longitude: 5.928 },
  { name: 'Angers', slug: 'angers', region: 'Pays de la Loire', latitude: 47.4784, longitude: -0.5632 },
  { name: 'Dijon', slug: 'dijon', region: 'Bourgogne-Franche-Comté', latitude: 47.322, longitude: 5.0415 },
  { name: 'Nîmes', slug: 'nimes', region: 'Occitanie', latitude: 43.8367, longitude: 4.3601 },
  { name: 'Villeurbanne', slug: 'villeurbanne', region: 'Auvergne-Rhône-Alpes', latitude: 45.7719, longitude: 4.8902 },
  { name: 'Clermont-Ferrand', slug: 'clermont-ferrand', region: 'Auvergne-Rhône-Alpes', latitude: 45.7772, longitude: 3.087 },
  { name: 'Le Mans', slug: 'le-mans', region: 'Pays de la Loire', latitude: 48.0061, longitude: 0.1996 },
  { name: 'Aix-en-Provence', slug: 'aix-en-provence', region: "Provence-Alpes-Côte d'Azur", latitude: 43.5297, longitude: 5.4474 },
  { name: 'Brest', slug: 'brest', region: 'Bretagne', latitude: 48.3904, longitude: -4.4861 },
  { name: 'Tours', slug: 'tours', region: 'Centre-Val de Loire', latitude: 47.3941, longitude: 0.6848 },
  { name: 'Amiens', slug: 'amiens', region: 'Hauts-de-France', latitude: 49.8941, longitude: 2.2958 },
  { name: 'Limoges', slug: 'limoges', region: 'Nouvelle-Aquitaine', latitude: 45.8336, longitude: 1.2611 },
  { name: 'Metz', slug: 'metz', region: 'Grand Est', latitude: 49.1193, longitude: 6.1757 },
  { name: 'Besançon', slug: 'besancon', region: 'Bourgogne-Franche-Comté', latitude: 47.238, longitude: 6.0243 },
  { name: 'Orléans', slug: 'orleans', region: 'Centre-Val de Loire', latitude: 47.9029, longitude: 1.909 },
  { name: 'Caen', slug: 'caen', region: 'Normandie', latitude: 49.1829, longitude: -0.3707 },
  { name: 'Mulhouse', slug: 'mulhouse', region: 'Grand Est', latitude: 47.7508, longitude: 7.3359 },
  { name: 'Nancy', slug: 'nancy', region: 'Grand Est', latitude: 48.6921, longitude: 6.1844 },
  { name: 'Poitiers', slug: 'poitiers', region: 'Nouvelle-Aquitaine', latitude: 46.5802, longitude: 0.3404 },
  { name: 'Pau', slug: 'pau', region: 'Nouvelle-Aquitaine', latitude: 43.2951, longitude: -0.3708 },
  { name: 'La Rochelle', slug: 'la-rochelle', region: 'Nouvelle-Aquitaine', latitude: 46.1603, longitude: -1.1511 },
  { name: 'Créteil', slug: 'creteil', region: 'Île-de-France', latitude: 48.7904, longitude: 2.4556 },
  { name: 'Nanterre', slug: 'nanterre', region: 'Île-de-France', latitude: 48.8924, longitude: 2.2069 },
  { name: 'Saint-Denis', slug: 'saint-denis', region: 'Île-de-France', latitude: 48.9362, longitude: 2.3574 },
  { name: 'Cergy', slug: 'cergy', region: 'Île-de-France', latitude: 49.0355, longitude: 2.0602 },
  { name: 'Évry', slug: 'evry', region: 'Île-de-France', latitude: 48.6238, longitude: 2.4295 },
  { name: 'Versailles', slug: 'versailles', region: 'Île-de-France', latitude: 48.8014, longitude: 2.1301 },
];

/** T3 B.3 — langues du profil, dont les langues nationales du Bénin et de la région. */
export const LANGUAGES: { code: string; nameFr: string }[] = [
  { code: 'fr', nameFr: 'Français' },
  { code: 'en', nameFr: 'Anglais' },
  { code: 'fon', nameFr: 'Fon' },
  { code: 'yo', nameFr: 'Yoruba' },
  { code: 'goun', nameFr: 'Goun' },
  { code: 'gej', nameFr: 'Mina (Gen)' },
  { code: 'bba', nameFr: 'Bariba' },
  { code: 'ddn', nameFr: 'Dendi' },
  { code: 'ee', nameFr: 'Éwé' },
  { code: 'wo', nameFr: 'Wolof' },
  { code: 'bm', nameFr: 'Bambara' },
  { code: 'dyu', nameFr: 'Dioula' },
  { code: 'bci', nameFr: 'Baoulé' },
  { code: 'ln', nameFr: 'Lingala' },
  { code: 'kg', nameFr: 'Kikongo' },
  { code: 'sw', nameFr: 'Swahili' },
  { code: 'ff', nameFr: 'Peul (Fulfulde)' },
  { code: 'ha', nameFr: 'Haoussa' },
  { code: 'ar', nameFr: 'Arabe' },
  { code: 'pt', nameFr: 'Portugais' },
  { code: 'es', nameFr: 'Espagnol' },
  { code: 'de', nameFr: 'Allemand' },
  { code: 'mg', nameFr: 'Malgache' },
  { code: 'kab', nameFr: 'Kabyle' },
];

/** T3 B.4 — compétences du profil, par catégorie. */
export const SKILLS: { nameFr: string; category: string }[] = [
  ...['Développement web', 'Développement mobile', 'Données', 'Réseaux et systèmes', 'Cybersécurité', 'Design', 'Gestion de produit', 'Marketing numérique'].map((n) => ({ nameFr: n, category: 'Numérique' })),
  ...['Comptabilité', 'Finance', 'Ressources humaines', 'Gestion de projet', 'Administration', 'Logistique', 'Achats'].map((n) => ({ nameFr: n, category: 'Gestion' })),
  ...['Soins infirmiers', 'Aide-soignant', 'Pharmacie', 'Kinésithérapie', 'Médecine', 'Petite enfance'].map((n) => ({ nameFr: n, category: 'Santé' })),
  ...['Enseignement primaire', 'Enseignement secondaire', 'Enseignement supérieur', 'Formation professionnelle', 'Soutien scolaire', 'Langues'].map((n) => ({ nameFr: n, category: 'Enseignement' })),
  ...['Droit des étrangers', 'Droit du travail', 'Droit des affaires', 'Notariat'].map((n) => ({ nameFr: n, category: 'Droit' })),
  ...['Maçonnerie', 'Électricité', 'Plomberie', 'Peinture', 'Menuiserie', 'Chauffage'].map((n) => ({ nameFr: n, category: 'Bâtiment' })),
  ...['Vente', 'Restauration', 'Hôtellerie', 'Coiffure', 'Esthétique', 'Couture'].map((n) => ({ nameFr: n, category: 'Commerce' })),
  ...['Conduite', 'Livraison', 'Mécanique'].map((n) => ({ nameFr: n, category: 'Transport' })),
  ...['Musique', 'Audiovisuel', 'Journalisme', 'Traduction', 'Événementiel'].map((n) => ({ nameFr: n, category: 'Culture' })),
  ...['Ingénierie', 'Chimie', 'Agronomie', 'Environnement', 'Recherche'].map((n) => ({ nameFr: n, category: 'Sciences' })),
  ...['Travail social', 'Animation', 'Médiation', 'Interprétariat'].map((n) => ({ nameFr: n, category: 'Social' })),
];

/**
 * T3 B.6 — les 40 métiers de l'annuaire professionnel.
 *
 * « Conseiller en immigration » porte sa mention obligatoire : la plateforme ne
 * vérifie aucun dossier et le mot « certifié » n'apparaît nulle part (règle dure §1.2).
 */
export const PROFESSIONS: { nameFr: string; category: string }[] = [
  ...['Avocat', 'Comptable', 'Expert-comptable', 'Notaire', 'Traducteur assermenté', 'Interprète', 'Conseiller en immigration (ne se substitue pas à un avocat)'].map((n) => ({ nameFr: n, category: 'Droit et chiffre' })),
  ...['Agent immobilier', 'Courtier en assurance', 'Conseiller bancaire indépendant'].map((n) => ({ nameFr: n, category: 'Immobilier et finance' })),
  ...['Coiffeur', 'Esthéticienne', 'Couturier', 'Restaurateur', 'Traiteur', 'Épicier (produits africains)'].map((n) => ({ nameFr: n, category: 'Commerce et services' })),
  ...['Plombier', 'Électricien', 'Peintre', 'Menuisier', 'Chauffagiste', 'Mécanicien'].map((n) => ({ nameFr: n, category: 'Bâtiment et artisanat' })),
  ...['Chauffeur VTC', 'Déménageur'].map((n) => ({ nameFr: n, category: 'Transport' })),
  ...['Développeur', 'Designer', 'Photographe', 'Vidéaste', 'Musicien / DJ', "Organisateur d'événements"].map((n) => ({ nameFr: n, category: 'Numérique et création' })),
  ...['Professeur particulier', 'Formateur', 'Coach'].map((n) => ({ nameFr: n, category: 'Enseignement' })),
  ...['Infirmier libéral', 'Kinésithérapeute', 'Psychologue', 'Sage-femme', 'Auxiliaire de vie', "Garde d'enfants", 'Agent de nettoyage'].map((n) => ({ nameFr: n, category: 'Santé et aide à la personne' })),
];
