import { newId } from '../../uuid.js';
import { dansJours } from './prng.js';
import { JOUR, incr, paquets, type Contexte } from './types.js';

/**
 * LES ÉVÉNEMENTS — quatorze à venir (de 2 à 45 jours) et cinq passés (terminés, avec présences). Lieux et adresses sont
 * génériques (« salle associative du centre ») : le produit ne géocode jamais, et on n'invente pas d'adresse réelle.
 */

type Type = 'PICNIC' | 'SPORT' | 'CV_WORKSHOP' | 'COOKING' | 'NETWORKING' | 'OUTING' | 'CONFERENCE' | 'OTHER';

interface Modele {
  readonly titre: string;
  readonly type: Type;
  readonly lieu: string;
  readonly description: string;
  readonly heure: number;
  readonly capacite: number | null;
}

const MODELES: readonly Modele[] = [
  { titre: 'Café des nouveaux arrivants', type: 'NETWORKING', lieu: 'Café associatif du centre', description: 'Un café pour se rencontrer, poser ses questions et repartir avec deux contacts utiles. Ouvert à tous, gratuit.', heure: 17, capacite: 30 },
  { titre: 'Atelier CV et lettre de motivation', type: 'CV_WORKSHOP', lieu: 'Salle de la maison des associations', description: 'On relit ensemble vos CV, un par un, avec des membres qui ont recruté ou été recrutés ici. Apportez le vôtre sur clé ou en papier.', heure: 18, capacite: 20 },
  { titre: 'Repas partagé du dimanche', type: 'COOKING', lieu: 'Salle polyvalente du quartier', description: 'Chacun apporte un plat du pays. On goûte, on échange les recettes, on s’installe sans pression.', heure: 12, capacite: 40 },
  { titre: 'Pique-nique au parc', type: 'PICNIC', lieu: 'Grande pelouse du parc municipal', description: 'Un après-midi au grand air avec des jeux pour les enfants. Prévoyez de quoi partager.', heure: 13, capacite: null },
  { titre: 'Tournoi de football amical', type: 'SPORT', lieu: 'Terrain de quartier', description: 'Équipes tirées au sort sur place pour que tout le monde joue avec tout le monde. Chaussures de sport conseillées.', heure: 15, capacite: 28 },
  { titre: 'Soirée musique d’Afrique de l’Ouest', type: 'OUTING', lieu: 'Salle associative', description: 'Une soirée avec des musiciens amateurs et une piste de danse. Entrée libre, participation au chapeau.', heure: 19, capacite: 80 },
  { titre: 'Rencontre : réussir sa première année d’études', type: 'CONFERENCE', lieu: 'Amphithéâtre prêté par une association étudiante', description: 'Des étudiants plus avancés racontent les pièges de la première année et répondent à vos questions.', heure: 18, capacite: 60 },
  { titre: 'Atelier cuisine : le gombo, du marché à l’assiette', type: 'COOKING', lieu: 'Cuisine partagée de la maison de quartier', description: 'On prépare le plat ensemble, étape par étape, puis on le partage. Places limitées.', heure: 11, capacite: 14 },
  { titre: 'Permanence démarches : on remplit les formulaires ensemble', type: 'OTHER', lieu: 'Permanence de la maison de quartier', description: 'Des membres vous accompagnent pour comprendre un formulaire ou préparer un dossier. Venez avec vos papiers.', heure: 14, capacite: 25 },
  { titre: 'Apéro réseau : entrepreneurs de la diaspora', type: 'NETWORKING', lieu: 'Salle de coworking', description: 'Une rencontre simple entre personnes qui lancent ou font tourner une activité. Chacun présente son projet en une minute.', heure: 19, capacite: 45 },
  { titre: 'Balade découverte de la ville', type: 'OUTING', lieu: 'Rendez-vous devant la mairie', description: 'Une promenade pour repérer les lieux utiles : marché, bibliothèque, services publics, bonnes adresses.', heure: 10, capacite: 25 },
  { titre: 'Journée du sport en famille', type: 'SPORT', lieu: 'Gymnase municipal', description: 'Parcours pour les enfants, matchs pour les grands, buvette à prix libre.', heure: 10, capacite: null },
  { titre: 'Conférence : droits et démarches des étudiants étrangers', type: 'CONFERENCE', lieu: 'Salle de conférence de la mairie annexe', description: 'Une juriste présente les principales démarches de la première à la dernière année, avec un temps de questions.', heure: 18, capacite: 100 },
  { titre: 'Soirée jeux de société et thé', type: 'OTHER', lieu: 'Ludothèque associative', description: 'Une soirée tranquille pour rencontrer du monde autour d’un jeu. Aucun niveau requis.', heure: 19, capacite: 24 },
];

export async function genererEvenements(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const organisateurs = c.membres.filter((m) => m.ancien);
  if (organisateurs.length === 0) return;
  const total = 19;
  const aVenir = 14;
  let inscriptions = 0;
  const organises = new Map<string, number>();

  for (let i = 0; i < total; i++) {
    const m = MODELES[i % MODELES.length] as Modele;
    const orga = rng.pick(organisateurs);
    const ville = c.villes.find((v) => v.id === orga.cityId);
    if (ville === undefined) continue;
    const futur = i < aVenir;
    const jours = futur ? rng.int(2, 45) : -rng.int(5, 70);
    const debut = dansJours(now, jours, m.heure, rng.pick([0, 0, 30]));
    const fin = new Date(debut.getTime() + rng.pick([2, 3, 4]) * 3_600_000);
    const id = newId();
    const titre = `${m.titre} · ${ville.name}`;

    const ville2 = ville;
    const invites = rng.sample(
      c.membres.filter((x) => x.cityId === ville2.id && x.id !== orga.id),
      rng.int(5, Math.min(m.capacite ?? 40, 36)),
    );
    const presents = invites.filter(() => rng.chance(0.82));

    await tx.event.create({
      data: {
        id,
        createdAt: new Date(Math.min(debut.getTime(), now.getTime()) - rng.int(5, 25) * JOUR),
        organizerUserId: orga.id,
        type: m.type,
        title: titre,
        description: m.description,
        cityId: ville.id,
        venueName: m.lieu,
        startsAt: debut,
        endsAt: fin,
        ...(m.capacite === null ? {} : { capacity: m.capacite }),
        attendeeCount: presents.length,
        status: futur ? 'SCHEDULED' : 'DONE',
      },
    });
    const lignes = invites.map((x) => ({
      id: newId(),
      eventId: id,
      userId: x.id,
      status: presents.includes(x) ? ('GOING' as const) : rng.pick(['MAYBE', 'DECLINED'] as const),
      respondedAt: new Date(now.getTime() - rng.int(1, 20) * JOUR),
      checkedIn: !futur && presents.includes(x) && rng.chance(0.85),
    }));
    for (const lot of paquets(lignes)) await tx.eventAttendee.createMany({ data: lot });
    inscriptions += lignes.length;
    organises.set(orga.id, (organises.get(orga.id) ?? 0) + 1);
    c.aIndexer.push({ sujet: 'EVENT', id, titre, texte: m.description, cityId: ville.id, communityId: null });
  }
  for (const [userId, n] of organises) await tx.userStats.updateMany({ where: { userId }, data: { eventsOrganized: n } });
  incr(c, 'événements', total);
  incr(c, 'inscriptions aux événements', inscriptions);
  c.log(`  événements : ${aVenir} à venir + ${total - aVenir} passés, ${inscriptions} inscriptions`);
}
