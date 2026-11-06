import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { incr, paquets, type Contexte } from './types.js';

/**
 * LES RÉSEAUX D'INTÉRÊT — six, créés par des anciens (ils en sont propriétaires), avec leurs membres, des sujets de
 * discussion, des réponses et quelques annonces. Les réseaux de ville et de pays, eux, viennent de `membres.ts`.
 */

interface Reseau {
  readonly nom: string;
  readonly slug: string;
  readonly categorie: string;
  readonly description: string;
  readonly visibilite: 'PUBLIC' | 'ON_REQUEST';
  readonly regles: readonly string[];
  readonly sujets: readonly (readonly [string, string])[];
  readonly annonce?: readonly [string, string];
}

const RESEAUX: readonly Reseau[] = [
  {
    nom: 'Cuisine du pays',
    slug: 'cuisine-du-pays',
    categorie: 'Cuisine',
    description: 'Recettes, adresses pour trouver les bons ingrédients, repas partagés. Tout le monde cuisine, tout le monde goûte.',
    visibilite: 'PUBLIC',
    regles: ['Respect et bienveillance.', 'Pas de publicité.', 'Les recettes partagées sont celles de votre famille ou citées avec leur source.'],
    sujets: [
      ['Où trouver du piment frais et de l’huile rouge ?', 'Je cherche une adresse fiable en ville. Un marché, une épicerie ? Merci pour vos retours.'],
      ['Le secret d’un bon riz au gras', 'On échange nos méthodes ? Je commence : le bouillon doit être bien réduit avant d’ajouter le riz.'],
    ],
    annonce: ['Repas partagé ce mois-ci', 'Un repas partagé est prévu dans le mois. Dites-nous ce que vous apporteriez dans les commentaires.'],
  },
  {
    nom: 'Entrepreneuriat de la diaspora',
    slug: 'entrepreneuriat-diaspora',
    categorie: 'Entrepreneuriat',
    description: 'Pour celles et ceux qui lancent une activité en France : statut, démarches, clients, entraide entre porteurs de projet.',
    visibilite: 'PUBLIC',
    regles: ['Partagez vos expériences, pas de démarchage.', 'Une question à la fois.'],
    sujets: [
      ['Choisir un statut pour une petite activité', 'Micro-entreprise ou autre ? Je démarre une activité de service à temps partiel, je compare les options.'],
      ['Trouver ses premiers clients', 'Qu’est-ce qui a marché pour vous : bouche à oreille, réseaux, marchés ? Je cherche des idées concrètes.'],
    ],
    annonce: ['Apéro réseau le mois prochain', 'Une rencontre entre entrepreneurs est en préparation. Réponses attendues cette semaine.'],
  },
  {
    nom: 'Étudiants en ingénierie',
    slug: 'etudiants-ingenierie',
    categorie: 'Études',
    description: 'Cours, stages, alternance, concours : un coin pour s’entraider entre étudiants et jeunes ingénieurs.',
    visibilite: 'PUBLIC',
    regles: ['Pas de partage de sujets d’examen.', 'Soyez clairs sur votre école et votre niveau pour qu’on puisse vous répondre.'],
    sujets: [
      ['Trouver un stage de fin d’études', 'Comment avez-vous cherché ? Candidatures spontanées, forums, réseau d’anciens ?'],
      ['Alternance : démarches et employeurs', 'Je veux passer en alternance l’an prochain. Par où commencer, à quelle période ?'],
    ],
  },
  {
    nom: 'Football du dimanche',
    slug: 'football-du-dimanche',
    categorie: 'Sport',
    description: 'On se retrouve pour jouer, simplement. Tous niveaux, bonne humeur obligatoire.',
    visibilite: 'PUBLIC',
    regles: ['Fair-play.', 'Prévenez si vous ne venez pas.'],
    sujets: [['Un terrain pour dimanche prochain ?', 'On cherche un terrain libre en fin de matinée. Des idées près du centre ?']],
    annonce: ['Match de dimanche', 'Rendez-vous à 10 h 30, on tire les équipes sur place.'],
  },
  {
    nom: 'Soignants de la diaspora',
    slug: 'soignants-diaspora',
    categorie: 'Santé',
    description: 'Infirmier·ères, aides-soignant·es, médecins, pharmacien·nes : reconnaissance des diplômes, emploi, formation.',
    visibilite: 'ON_REQUEST',
    regles: ['Aucune information de santé personnelle.', 'Réseau ouvert aux professionnels et étudiants du secteur.'],
    sujets: [['Faire reconnaître son diplôme de soins infirmiers', 'Quelles démarches avez-vous suivies, et combien de temps tout cela a-t-il pris ?']],
  },
  {
    nom: 'Musique et danse',
    slug: 'musique-et-danse',
    categorie: 'Culture',
    description: 'Musiciens, danseurs et curieux : répétitions, scènes ouvertes, soirées. Débutants bienvenus.',
    visibilite: 'PUBLIC',
    regles: ['Respect des voisins : on prévient pour les répétitions.', 'Partagez vos dates à l’avance.'],
    sujets: [
      ['Où répéter sans déranger les voisins ?', 'On cherche un local abordable pour répéter le soir. Des pistes ?'],
      ['Scène ouverte ce mois-ci', 'Quelqu’un connaît une scène ouverte où l’on peut présenter un morceau de 10 minutes ?'],
    ],
    annonce: ['Soirée musique d’Afrique de l’Ouest', 'La date est fixée, voyez l’agenda de la ville pour les détails.'],
  },
];

const REPONSES = [
  'Bonne question, je suis aussi preneur de vos adresses.',
  'Chez moi ça a marché en passant par le réseau de la ville.',
  'Je peux t’en dire plus en message si tu veux.',
  'Merci pour le partage, c’est utile.',
  'On pourrait en parler lors de la prochaine rencontre.',
];

export async function genererReseaux(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const anciens = c.membres.filter((m) => m.ancien);
  if (anciens.length < 2) return;
  let sujets = 0;
  let reponses = 0;
  let adhesions = 0;

  for (const r of RESEAUX) {
    // Un réseau du même identifiant existe déjà : on ne le double pas (l'identifiant d'adresse est unique).
    if ((await tx.community.findUnique({ where: { slug: r.slug }, select: { id: true } })) !== null) continue;
    const proprio = rng.pick(anciens);
    const mod = rng.pick(anciens.filter((m) => m.id !== proprio.id));
    const creeLe = ilYa(now, rng.int(30, 140), rng);
    const id = newId();
    const effectif = rng.int(10, 26);
    const autres = rng.sample(c.membres.filter((m) => m.id !== proprio.id && m.id !== mod.id), effectif);
    await tx.community.create({
      data: {
        id,
        createdAt: creeLe,
        kind: 'INTEREST',
        name: r.nom,
        slug: r.slug,
        description: r.description,
        category: r.categorie,
        createdByUserId: proprio.id,
        visibility: r.visibilite,
        status: 'ACTIVE',
        memberCount: effectif + 2,
        lastActivityAt: new Date(now.getTime() - rng.int(1, 6) * 86_400_000),
        rules: [...r.regles],
      },
    });
    const lignes = [
      { id: newId(), communityId: id, userId: proprio.id, role: 'OWNER' as const, status: 'ACTIVE' as const, joinedAt: creeLe },
      { id: newId(), communityId: id, userId: mod.id, role: 'MODERATOR' as const, status: 'ACTIVE' as const, joinedAt: creeLe },
      ...autres.map((m) => ({
        id: newId(),
        communityId: id,
        userId: m.id,
        role: 'MEMBER' as const,
        status: 'ACTIVE' as const,
        joinedAt: new Date(creeLe.getTime() + rng.int(1, 60) * 86_400_000),
      })),
    ];
    for (const lot of paquets(lignes)) await tx.communityMember.createMany({ data: lot });
    adhesions += lignes.length;

    for (const [titre, corps] of r.sujets) {
      const auteur = rng.pick([...autres, proprio]);
      const topicId = newId();
      const nb = rng.int(1, 4);
      const quand = ilYa(now, rng.int(3, 40), rng);
      await tx.topic.create({
        data: { id: topicId, createdAt: quand, communityId: id, authorUserId: auteur.id, title: titre, body: corps, status: 'OPEN', pinKind: 'NONE', replyCount: nb, lastReplyAt: new Date(quand.getTime() + nb * 3_600_000) },
      });
      const repondants = rng.sample(autres, nb);
      await tx.comment.createMany({
        data: repondants.map((m, k) => ({
          id: newId(),
          createdAt: new Date(quand.getTime() + (k + 1) * 3_600_000),
          subjectType: 'TOPIC' as const,
          subjectId: topicId,
          authorUserId: m.id,
          body: rng.pick(REPONSES),
          status: 'PUBLISHED' as const,
        })),
      });
      sujets += 1;
      reponses += nb;
      c.aIndexer.push({ sujet: 'TOPIC', id: topicId, titre, texte: corps, cityId: null, communityId: id });
    }
    if (r.annonce !== undefined) {
      await tx.communityAnnouncement.create({
        data: { id: newId(), createdAt: ilYa(now, rng.int(1, 10), rng), communityId: id, authorUserId: proprio.id, title: r.annonce[0], body: r.annonce[1] },
      });
    }
  }

  incr(c, 'réseaux d’intérêt', RESEAUX.length);
  incr(c, 'adhésions aux réseaux d’intérêt', adhesions);
  incr(c, 'sujets de discussion', sujets);
  incr(c, 'réponses de discussion', reponses);
  c.log(`  réseaux d’intérêt : ${RESEAUX.length} (${adhesions} adhésions, ${sujets} sujets, ${reponses} réponses)`);
}
