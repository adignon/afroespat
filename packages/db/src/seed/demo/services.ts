import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { JOUR, incr, type Contexte } from './types.js';

/**
 * LES SERVICES — annonces de logement et d'emploi, fiches de professionnels de la communauté, profils de chercheurs
 * d'emploi. Les employeurs nommés sont génériques (« boulangerie du quartier ») : aucune enseigne réelle.
 */

type TypeLogement = 'RENT' | 'FLATSHARE' | 'SUBLET' | 'TEMPORARY' | 'SEEKING_HOUSING' | 'SEEKING_FLATMATE';

const LOGEMENTS: readonly { kind: TypeLogement; titre: string; description: string; prix: [number, number] | null; meuble: boolean | null; quartier: string; mois: number | null }[] = [
  { kind: 'FLATSHARE', titre: 'Chambre en colocation, ambiance calme', description: 'Chambre de 12 m² dans un appartement partagé avec deux étudiants. Cuisine équipée, internet inclus. Proche des transports. Dépôt de garantie classique, bail de neuf mois possible.', prix: [38000, 52000], meuble: true, quartier: 'Centre', mois: 9 },
  { kind: 'RENT', titre: 'Studio meublé proche du tramway', description: 'Studio de 20 m² avec coin cuisine, salle d’eau, rangements. Idéal pour une personne. Charges comprises. Visite possible en semaine après 18 h.', prix: [55000, 72000], meuble: true, quartier: 'Gare', mois: null },
  { kind: 'SUBLET', titre: 'Sous-location de juin à août', description: 'Je pars pour l’été et sous-loue ma chambre dans une résidence. Tout est meublé, le propriétaire est d’accord. Contrat écrit fourni.', prix: [30000, 42000], meuble: true, quartier: 'Campus', mois: 3 },
  { kind: 'TEMPORARY', titre: 'Hébergement temporaire pour nouvel arrivant', description: 'Je propose un canapé-lit pour quelques semaines à une personne qui arrive et cherche un logement. Participation symbolique aux charges.', prix: [0, 15000], meuble: true, quartier: 'Quartier sud', mois: 1 },
  { kind: 'SEEKING_HOUSING', titre: 'Étudiante cherche une chambre pour la rentrée', description: 'Étudiante en master, sérieuse, non fumeuse. Je cherche une chambre ou une colocation proche des transports, budget limité. Dossier complet disponible.', prix: null, meuble: null, quartier: 'Tous quartiers', mois: 10 },
  { kind: 'SEEKING_FLATMATE', titre: 'Cherche colocataire pour grand appartement', description: 'Trois chambres, il en reste une. On cherche une personne calme et respectueuse. Visite sur rendez-vous, charges partagées à parts égales.', prix: [40000, 50000], meuble: false, quartier: 'Faubourg', mois: 12 },
  { kind: 'RENT', titre: 'T2 lumineux, deuxième étage', description: 'Appartement de 40 m², séjour, chambre séparée, cuisine ouverte. Chauffage collectif. Pas de frais d’agence, bail classique.', prix: [68000, 92000], meuble: false, quartier: 'Parc', mois: null },
  { kind: 'FLATSHARE', titre: 'Colocation de quatre, une chambre se libère', description: 'Maison avec jardin, quatre chambres, cuisine commune. Esprit convivial, repas partagés le dimanche. Loyer charges comprises.', prix: [42000, 56000], meuble: false, quartier: 'Périphérie calme', mois: 12 },
];

const EMPLOIS: readonly { kind: 'JOB' | 'INTERNSHIP' | 'APPRENTICESHIP' | 'GIG'; titre: string; entreprise: string | null; contrat: string; secteur: string; description: string }[] = [
  { kind: 'JOB', titre: 'Serveur·se en restauration, week-ends', entreprise: 'Restaurant du centre-ville', contrat: 'CDI temps partiel', secteur: 'Restauration', description: 'Service en salle les vendredis, samedis et dimanches. Débutant accepté, formation sur place. Horaires compatibles avec des études.' },
  { kind: 'JOB', titre: 'Aide-soignant·e en maison de retraite', entreprise: 'Résidence pour personnes âgées', contrat: 'CDD', secteur: 'Santé', description: 'Accompagnement quotidien des résidents, travail en équipe. Diplôme exigé. Planning par roulement, matin et après-midi.' },
  { kind: 'INTERNSHIP', titre: 'Stage assistant·e en développement web', entreprise: 'Agence numérique locale', contrat: 'Stage 6 mois', secteur: 'Numérique', description: 'Vous participez au développement de sites et d’outils web au sein d’une petite équipe. Gratification légale, tuteur dédié.' },
  { kind: 'APPRENTICESHIP', titre: 'Alternance en comptabilité', entreprise: 'Cabinet comptable de quartier', contrat: 'Contrat d’apprentissage', secteur: 'Comptabilité', description: 'Saisie, rapprochements, préparation des déclarations. Rythme d’alternance défini avec l’école. Poste évolutif.' },
  { kind: 'GIG', titre: 'Soutien scolaire à domicile', entreprise: null, contrat: 'Missions ponctuelles', secteur: 'Enseignement', description: 'Aider des collégiens en maths et en français, deux fois par semaine. Rémunération à l’heure, déplacements pris en compte.' },
  { kind: 'JOB', titre: 'Agent·e de propreté en horaires décalés', entreprise: 'Entreprise de nettoyage locale', contrat: 'CDI', secteur: 'Services', description: 'Entretien de bureaux tôt le matin ou en soirée. Équipement fourni. Idéal en complément d’études ou d’une autre activité.' },
  { kind: 'JOB', titre: 'Vendeur·se en boulangerie', entreprise: 'Boulangerie du quartier', contrat: 'CDI', secteur: 'Commerce', description: 'Accueil, vente, encaissement. Prise de poste à 6 h ou 14 h selon la semaine. Sens du contact apprécié.' },
  { kind: 'GIG', titre: 'Livraison de repas à vélo', entreprise: null, contrat: 'Indépendant', secteur: 'Livraison', description: 'Livraisons en centre-ville aux heures de repas. Vélo personnel nécessaire. Statut d’indépendant requis, renseignez-vous avant de vous lancer.' },
  { kind: 'INTERNSHIP', titre: 'Stage en gestion de projet associatif', entreprise: 'Association d’aide aux étudiants', contrat: 'Stage 4 mois', secteur: 'Associatif', description: 'Organisation d’événements, suivi des bénévoles, communication. Une belle première expérience pour comprendre l’associatif.' },
];

const PROS: readonly { metier: string; nom: string; description: string; prix: string | null }[] = [
  { metier: 'Coiffeur', nom: 'Coiffure du quartier', description: 'Coiffure et tresses, spécialiste des cheveux crépus. Sur rendez-vous, à domicile ou en salon.', prix: 'À partir de 25 €' },
  { metier: 'Traiteur', nom: 'Cuisine du pays à emporter', description: 'Plats cuisinés pour vos repas de famille et vos événements. Commande trois jours à l’avance.', prix: 'Devis gratuit' },
  { metier: 'Plombier', nom: 'Dépannage plomberie', description: 'Fuites, chauffe-eau, sanitaires. Déplacement rapide dans l’agglomération, devis écrit avant chaque intervention.', prix: 'Devis gratuit' },
  { metier: 'Électricien', nom: 'Installations électriques', description: 'Mises aux normes, tableaux, prises, éclairage. Respect strict des règles de sécurité.', prix: 'Devis gratuit' },
  { metier: 'Traducteur assermenté', nom: 'Traductions officielles', description: 'Actes d’état civil, diplômes, documents administratifs. Français, anglais, langues d’Afrique de l’Ouest sur demande.', prix: 'Selon le document' },
  { metier: 'Professeur particulier', nom: 'Soutien en mathématiques', description: 'Cours à domicile ou en ligne, du collège à la licence. Méthode claire, premier échange offert.', prix: '25 € / heure' },
  { metier: 'Photographe', nom: 'Photographie d’événements', description: 'Mariages, baptêmes, portraits. Livraison des photos retouchées sous dix jours.', prix: 'Sur devis' },
  { metier: 'Déménageur', nom: 'Petits déménagements', description: 'Un utilitaire et deux bras pour votre déménagement en ville. Réservation la veille possible selon disponibilité.', prix: 'À l’heure' },
  { metier: 'Couturier', nom: 'Atelier de couture', description: 'Retouches et créations en wax. Tenues de cérémonie, ajustements, travail soigné.', prix: 'Sur devis' },
  { metier: 'Comptable', nom: 'Aide aux démarches comptables', description: 'Comptabilité des petites activités, déclarations, conseils de gestion. Rendez-vous en ligne possible.', prix: 'Premier rendez-vous gratuit' },
];

export async function genererServices(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const membres = c.membres;
  let logements = 0;
  let emplois = 0;

  // ── Logements : deux à trois annonces par grande ville.
  for (const ville of c.villes) {
    const habitants = membres.filter((m) => m.cityId === ville.id);
    if (habitants.length === 0) continue;
    for (const l of rng.sample(LOGEMENTS, rng.int(2, 3))) {
      const auteur = rng.pick(habitants);
      const id = newId();
      const prix = l.prix === null ? null : rng.int(l.prix[0] / 1000, l.prix[1] / 1000) * 1000;
      const creeLe = ilYa(now, rng.int(0, 25), rng);
      await tx.housingListing.create({
        data: {
          id,
          createdAt: creeLe,
          authorUserId: auteur.id,
          kind: l.kind,
          title: l.titre,
          description: l.description,
          cityId: ville.id,
          district: l.quartier,
          ...(prix === null ? {} : { priceCents: prix }),
          ...(l.meuble === null ? {} : { isFurnished: l.meuble }),
          availableFrom: new Date(now.getTime() + rng.int(5, 60) * JOUR),
          ...(l.mois === null ? {} : { durationMonths: l.mois }),
          status: 'ACTIVE',
          moderationStatus: 'CLEARED',
          expiresAt: new Date(creeLe.getTime() + 45 * JOUR),
          viewCount: rng.int(8, 160),
          contactCount: rng.int(0, 12),
        },
      });
      logements += 1;
      c.aIndexer.push({ sujet: 'HOUSING', id, titre: l.titre, texte: l.description, cityId: ville.id, communityId: null });
    }
  }

  // ── Emplois : une à deux offres par ville.
  for (const ville of c.villes) {
    const habitants = membres.filter((m) => m.cityId === ville.id && m.ancien);
    if (habitants.length === 0) continue;
    for (const e of rng.sample(EMPLOIS, rng.int(1, 2))) {
      const auteur = rng.pick(habitants);
      const id = newId();
      const creeLe = ilYa(now, rng.int(0, 20), rng);
      await tx.jobListing.create({
        data: {
          id,
          createdAt: creeLe,
          authorUserId: auteur.id,
          kind: e.kind,
          title: e.titre,
          description: e.description,
          ...(e.entreprise === null ? {} : { companyName: e.entreprise }),
          cityId: ville.id,
          contractType: e.contrat,
          sector: e.secteur,
          status: 'ACTIVE',
          expiresAt: new Date(creeLe.getTime() + 40 * JOUR),
        },
      });
      emplois += 1;
      c.aIndexer.push({ sujet: 'JOB', id, titre: e.titre, texte: e.description, cityId: ville.id, communityId: null });
    }
  }

  // ── Professionnels : dix fiches, chacune dans une ou deux villes.
  const metiers = new Map((await tx.profession.findMany({ select: { id: true, nameFr: true } })).map((p) => [p.nameFr, p.id]));
  let pros = 0;
  // Un membre n'a qu'une fiche professionnelle (clé unique) : des titulaires DISTINCTS.
  const titulaires = rng.shuffle(membres.filter((m) => m.ancien));
  for (const [i, p] of PROS.entries()) {
    const professionId = metiers.get(p.metier);
    if (professionId === undefined) continue;
    const titulaire = titulaires[i];
    if (titulaire === undefined) continue;
    const id = newId();
    await tx.proProfile.create({
      data: {
        id,
        createdAt: ilYa(now, rng.int(5, 90), rng),
        userId: titulaire.id,
        professionId,
        businessName: p.nom,
        description: p.description,
        ...(p.prix === null ? {} : { priceHint: p.prix }),
        contactMethod: 'PLATFORM_MESSAGE',
        verificationStatus: 'APPROVED',
        tier: 'FREE',
        status: 'ACTIVE',
        viewCount: rng.int(10, 220),
      },
    });
    const villesPro = [...new Set([titulaire.cityId, ...(rng.chance(0.4) ? [rng.pick(c.villes).id] : [])])];
    await tx.proProfileCity.createMany({ data: villesPro.map((cityId) => ({ proProfileId: id, cityId })) });
    pros += 1;
    c.aIndexer.push({ sujet: 'PRO', id, titre: p.nom, texte: p.description, cityId: titulaire.cityId, communityId: null });
  }

  // ── Profils de chercheurs d'emploi.
  let chercheurs = 0;
  for (const m of rng.sample(membres.filter((x) => x.phase !== 'SETTLED'), 10)) {
    await tx.jobSeekerProfile.create({
      data: {
        userId: m.id,
        headline: rng.pick(['Étudiant·e en recherche de stage', 'Disponible pour un job à temps partiel', 'Jeune diplômé·e, ouvert·e à tout secteur', 'En recherche d’alternance']),
        sectors: rng.sample(['Restauration', 'Numérique', 'Santé', 'Commerce', 'Enseignement', 'Services'], 2),
        contractTypes: rng.sample(['Stage', 'CDD', 'CDI', 'Alternance', 'Temps partiel'], 2),
        isVisible: true,
      },
    });
    chercheurs += 1;
  }

  incr(c, 'annonces de logement', logements);
  incr(c, 'offres d’emploi', emplois);
  incr(c, 'fiches de professionnels', pros);
  incr(c, 'profils de chercheurs d’emploi', chercheurs);
  c.log(`  services : ${logements} logements, ${emplois} emplois, ${pros} professionnels, ${chercheurs} profils de chercheurs`);
}
