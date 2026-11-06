import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { JOUR, incr, type Contexte, type Membre } from './types.js';

/**
 * L'ENTRAIDE — des demandes (et quelques offres) sur les quatre-vingt-dix derniers jours, avec des réponses datées d'un
 * délai réaliste (de quelques minutes à quelques heures : c'est ce que le délai médian de l'accueil mesure), dont une
 * partie marquée « ça m'a aidé » — ce qui crée aussi la connexion (`HELP_VALIDATED`), comme le produit.
 */

type TypeAide = 'PAPERWORK' | 'HOUSING' | 'JOB' | 'WELCOME' | 'SERVICE' | 'RIDE' | 'MATERIAL' | 'OTHER';

interface Modele {
  readonly type: TypeAide;
  readonly titre: string;
  readonly corps: string;
}

const DEMANDES: readonly Modele[] = [
  { type: 'PAPERWORK', titre: 'Quelqu’un a déjà validé son visa en ligne ?', corps: 'Je viens d’arriver et le site me demande une validation dans les trois mois. Quelles pièces faut-il avoir sous la main avant de commencer ?' },
  { type: 'PAPERWORK', titre: 'Rendez-vous en préfecture : comment faire quand il n’y a aucun créneau ?', corps: 'Je rafraîchis la page tous les jours depuis deux semaines et rien ne s’affiche. Des astuces qui ont marché pour vous ?' },
  { type: 'PAPERWORK', titre: 'Attestation d’hébergement : quels documents joindre ?', corps: 'Je suis hébergé chez un ami le temps de trouver mieux. Que doit fournir la personne qui m’héberge pour que l’attestation soit acceptée ?' },
  { type: 'PAPERWORK', titre: 'Traduction assermentée de mon acte de naissance', corps: 'Je cherche un traducteur de confiance pour un acte béninois. Vous avez des adresses ou des tarifs à me donner ?' },
  { type: 'HOUSING', titre: 'Colocation ou résidence étudiante : que choisir pour une première année ?', corps: 'J’ai les deux options mais je n’arrive pas à trancher. Budget, ambiance, démarches : ce qui vous a servi ?' },
  { type: 'HOUSING', titre: 'Je cherche une chambre pour septembre, des pistes ?', corps: 'Je suis étudiante, budget serré. J’ai peur des annonces trop belles pour être vraies. Où chercher de façon sûre ?' },
  { type: 'HOUSING', titre: 'Garant : que faire quand on n’en a pas ?', corps: 'Les agences me demandent toutes un garant en France. Existe-t-il une solution pour un étudiant arrivé de l’étranger ?' },
  { type: 'HOUSING', titre: 'Dépôt de garantie non rendu après mon départ', corps: 'Mon ancien propriétaire ne répond plus depuis deux mois. J’ai l’état des lieux de sortie. Quelle est la marche à suivre ?' },
  { type: 'JOB', titre: 'Un CV à la française : quelqu’un peut relire le mien ?', corps: 'Je cherche un stage. J’ai écrit mon CV mais je ne sais pas s’il convient au format attendu ici. Merci d’avance pour un œil extérieur.' },
  { type: 'JOB', titre: 'Faire reconnaître mon diplôme du pays', corps: 'J’ai un diplôme d’ingénieur obtenu au pays. Par quelle démarche passer pour qu’il soit reconnu auprès d’un employeur ?' },
  { type: 'JOB', titre: 'Job étudiant compatible avec les heures autorisées', corps: 'Je voudrais travailler quelques heures par semaine. Où trouver des offres fiables, et comment compter ses heures ?' },
  { type: 'WELCOME', titre: 'Accueil à l’arrivée : quelqu’un à la gare ?', corps: 'J’arrive samedi en fin d’après-midi, c’est ma première fois. Je serais rassuré de croiser un visage du pays à la descente du train.' },
  { type: 'WELCOME', titre: 'Où trouver des produits du pays près de chez moi ?', corps: 'Gari, piment, huile rouge, attiéké… Une épicerie ou un marché où l’on en trouve de façon fiable ?' },
  { type: 'SERVICE', titre: 'Bon coiffeur pour cheveux crépus dans le quartier', corps: 'Je cherche une adresse qui sait travailler les cheveux crépus, avec des prix raisonnables. Des recommandations ?' },
  { type: 'SERVICE', titre: 'Médecin qui prend de nouveaux patients', corps: 'Mon médecin traitant précédent est parti. Est-ce que quelqu’un sait où l’on prend encore des nouveaux patients dans le coin ?' },
  { type: 'RIDE', titre: 'Covoiturage pour le week-end de rencontre', corps: 'Je cherche une place (ou j’en propose) pour rejoindre le rassemblement de samedi. Départ possible en milieu de matinée.' },
  { type: 'MATERIAL', titre: 'Don de matériel de cuisine pour un nouvel arrivant', corps: 'Je déménage et j’ai casseroles, vaisselle et une bouilloire à donner. Je peux les apporter à quelqu’un qui s’installe.' },
  { type: 'MATERIAL', titre: 'Je cherche un petit bureau et une chaise', corps: 'J’emménage dans une chambre sans meuble. Si vous avez un bureau à donner ou à petit prix, je viens le chercher.' },
  { type: 'OTHER', titre: 'Comment appeler le pays sans exploser le forfait ?', corps: 'Je voudrais parler à ma famille chaque semaine. Quelles applications ou forfaits utilisez-vous ?' },
  { type: 'OTHER', titre: 'Assurance habitation obligatoire : laquelle choisir ?', corps: 'Mon bail exige une attestation d’assurance. Entre les offres en ligne et en agence, vous recommandez quoi pour un petit logement ?' },
  { type: 'PAPERWORK', titre: 'Carte de transport à tarif réduit : quels justificatifs ?', corps: 'Je voudrais l’abonnement étudiant. Il faut la carte étudiante ou le certificat de scolarité suffit ?' },
  { type: 'PAPERWORK', titre: 'Déclarer mes revenus la première année', corps: 'Je n’ai jamais fait de déclaration ici. Est-ce obligatoire pour un étudiant avec un petit job, et comment s’y prendre ?' },
];

const REPONSES: Readonly<Record<TypeAide, readonly string[]>> = {
  PAPERWORK: [
    'J’ai fait la même démarche l’an dernier. Prépare le passeport, le visa et l’attestation d’arrivée, et garde bien les accusés de réception : on te les redemande.',
    'Le site officiel détaille la liste des pièces. Si un document manque, ne laisse pas passer la date limite : écris-leur et garde la trace de ton message.',
    'Pose la question au guichet de ta mairie ou à une permanence d’association : ils connaissent les cas particuliers de ta préfecture.',
    'Fais des copies de tout et classe-les dans une chemise. Ça m’a évité un deuxième rendez-vous.',
  ],
  HOUSING: [
    'Pour la sécurité, vérifie toujours en visite avant de payer. Les résidences sont plus stables ; la colocation est plus souple mais prépare un dossier complet.',
    'Des dispositifs publics de garantie existent pour les étudiants sans garant : renseigne-toi auprès du service logement de ton établissement.',
    'Garde l’état des lieux et tes échanges écrits. Une lettre recommandée avec accusé de réception relance souvent la situation.',
    'Je peux t’indiquer deux quartiers bien desservis où j’ai cherché. Dis-moi ton budget.',
  ],
  JOB: [
    'Une page, des rubriques claires, des verbes d’action. Envoie-le-moi, je te dis ce que je changerais.',
    'Le centre de reconnaissance des diplômes peut délivrer une attestation de comparabilité. C’est le point de départ.',
    'Beaucoup d’offres passent par le réseau. Dis autour de toi que tu cherches, tu seras surpris·e.',
  ],
  WELCOME: [
    'Je serai là ! Je te mets un message avec mon numéro dans nos échanges.',
    'Il y a une épicerie du pays près de la gare, ouverte tard. Je te donne l’adresse en message.',
    'Bienvenue ! Je te préviens, on va t’inviter à manger avant la fin de la semaine.',
  ],
  SERVICE: [
    'Je connais quelqu’un de très bien, je te passe ses coordonnées par message.',
    'Demande dans le réseau de ta ville, plusieurs membres sont allés chez le même.',
  ],
  RIDE: ['Je pars à 10 h, il reste une place. Je te réponds dans la messagerie.', 'On peut faire le trajet ensemble, je te dis où je passe.'],
  MATERIAL: ['Je suis intéressé·e, je peux passer ce week-end.', 'Merci pour le geste, je viens le chercher quand tu veux.'],
  OTHER: [
    'J’utilise une application gratuite pour les appels vidéo, ça tient très bien sur une connexion normale.',
    'Compare les offres : certaines incluent déjà l’international, ça change le prix.',
  ],
};

interface LigneDemande {
  readonly id: string;
  readonly createdAt: Date;
  readonly authorUserId: string;
  readonly kind: 'REQUEST' | 'OFFER';
  readonly type: TypeAide;
  readonly title: string;
  readonly body: string;
  readonly cityId: string;
  readonly status: 'OPEN' | 'RESOLVED' | 'ARCHIVED';
  readonly responseCount: number;
  readonly resolvedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly retenue: string | null;
}

interface LigneReponse {
  readonly id: string;
  readonly createdAt: Date;
  readonly helpRequestId: string;
  readonly authorUserId: string;
  readonly body: string;
  readonly markedHelpful: boolean;
  readonly markedAt: Date | null;
}

export async function genererEntraide(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const auteurs = c.membres.filter((m) => !m.ancien || rng.chance(0.3));
  const aidants = c.membres.filter((m) => m.ancien);
  if (auteurs.length === 0 || aidants.length === 0) return;

  const demandes: LigneDemande[] = [];
  const reponses: LigneReponse[] = [];
  const connexions = new Map<string, { a: string; b: string; ref: string }>();
  let resolues = 0;

  const total = 36;
  for (let i = 0; i < total; i++) {
    const modele = DEMANDES[i % DEMANDES.length] as Modele;
    const auteur: Membre = rng.pick(auteurs);
    const ouvertLe = ilYa(now, rng.int(0, 88), rng);
    const id = newId();
    const offre = modele.type === 'MATERIAL' && rng.chance(0.4);
    const statut = rng.weighted<'OPEN' | 'RESOLVED' | 'ARCHIVED'>([
      ['RESOLVED', 55],
      ['OPEN', 38],
      ['ARCHIVED', 7],
    ]);

    const nb = statut === 'OPEN' && rng.chance(0.25) ? 0 : rng.int(1, 4);
    const repondants = rng.sample(aidants.filter((m) => m.id !== auteur.id), nb);
    let retenue: string | null = null;
    let retenueDe: Membre | null = null;
    let nbRetenues = 0;
    for (const [k, r] of repondants.entries()) {
      // La première réponse arrive vite ; les suivantes s'étalent sur quelques jours.
      const delai = k === 0 ? rng.int(4, 6 * 60) : rng.int(30, 3 * 24 * 60);
      const quand = new Date(ouvertLe.getTime() + delai * 60_000);
      if (quand > now) continue;
      const rid = newId();
      const choisie = statut === 'RESOLVED' && retenue === null && (k === repondants.length - 1 || rng.chance(0.5));
      if (choisie) {
        retenue = rid;
        retenueDe = r;
      }
      reponses.push({
        id: rid,
        createdAt: quand,
        helpRequestId: id,
        authorUserId: r.id,
        body: rng.pick(REPONSES[modele.type]),
        markedHelpful: choisie,
        markedAt: choisie ? new Date(quand.getTime() + rng.int(20, 600) * 60_000) : null,
      });
      nbRetenues += 1;
    }

    const resolue = statut === 'RESOLVED' && retenue !== null;
    if (resolue) resolues += 1;
    demandes.push({
      id,
      createdAt: ouvertLe,
      authorUserId: auteur.id,
      kind: offre ? 'OFFER' : 'REQUEST',
      type: modele.type,
      title: offre ? modele.titre.replace('Je cherche', 'Je propose') : modele.titre,
      body: modele.corps,
      cityId: auteur.cityId,
      // Une demande « résolue » sans réponse retenue reste ouverte : l'état doit dire vrai.
      status: statut === 'RESOLVED' && !resolue ? 'OPEN' : statut,
      responseCount: nbRetenues,
      resolvedAt: resolue ? new Date(ouvertLe.getTime() + rng.int(1, 5) * JOUR) : null,
      archivedAt: statut === 'ARCHIVED' ? new Date(ouvertLe.getTime() + 30 * JOUR) : null,
      retenue,
    });
    if (resolue && retenueDe !== null) {
      const autre = retenueDe.id;
      const [a, b] = auteur.id < autre ? [auteur.id, autre] : [autre, auteur.id];
      connexions.set(`${a}:${b}`, { a, b, ref: id });
    }
    c.aIndexer.push({ sujet: 'HELP_REQUEST', id, titre: modele.titre, texte: modele.corps, cityId: auteur.cityId, communityId: null });
  }

  // Les demandes d'abord, les réponses ensuite, puis la réponse retenue (clé étrangère croisée).
  for (const d of demandes) {
    const { retenue: _retenue, ...donnees } = d;
    void _retenue;
    await tx.helpRequest.create({ data: { ...donnees, moderationStatus: 'CLEARED' } });
  }
  for (const r of reponses) await tx.helpResponse.create({ data: r });
  for (const d of demandes) {
    if (d.retenue !== null) await tx.helpRequest.update({ where: { id: d.id }, data: { resolvedByResponseId: d.retenue } });
  }
  for (const k of connexions.values()) {
    const deja = await tx.connection.findUnique({ where: { userAId_userBId: { userAId: k.a, userBId: k.b } }, select: { id: true } });
    if (deja === null) {
      await tx.connection.create({
        data: { id: newId(), userAId: k.a, userBId: k.b, origin: 'HELP_VALIDATED', originRefType: 'HELP_REQUEST', originRefId: k.ref },
      });
    }
  }

  incr(c, 'demandes d’entraide', demandes.length);
  incr(c, 'réponses d’entraide', reponses.length);
  incr(c, 'connexions nées d’une entraide', connexions.size);
  c.log(`  entraide : ${demandes.length} demandes (${resolues} résolues), ${reponses.length} réponses, ${connexions.size} connexions`);
}
