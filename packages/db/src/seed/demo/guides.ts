import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { incr, paquets, type Contexte } from './types.js';

/**
 * LES GUIDES — quatorze, publiés, de la catégorie « avant le départ » à l'alerte arnaque. Textes en Markdown, écrits au
 * ras de ce qu'un membre installé raconterait ; ils renvoient aux sites officiels plutôt que de recopier des montants
 * ou des délais qui changent (la règle de `seed/journeys.ts` : « les montants et les délais renvoient aux guides, seuls
 * à être mis à jour »).
 */

type Categorie = 'PRE_DEPARTURE' | 'ARRIVAL' | 'HOUSING' | 'DAILY_LIFE' | 'WORK_STUDIES' | 'SCAM_ALERTS';

interface GuideSource {
  readonly titre: string;
  readonly categorie: Categorie;
  readonly ville?: string;
  readonly corps: string;
  readonly v2?: string;
  readonly citable?: boolean;
}

const GUIDES: readonly GuideSource[] = [
  {
    titre: 'Préparer son départ : la liste des démarches, dans l’ordre',
    categorie: 'PRE_DEPARTURE',
    corps: `## Commencer par les documents

Avant toute chose, vérifiez que votre passeport est valide longtemps après la date d’arrivée prévue. Un passeport qui expire dans l’année complique la plupart des démarches.

## Le visa et les justificatifs

Chaque situation (études, travail, famille) a sa procédure. Le site officiel du ministère de l’Intérieur et celui de France-Visas disent quelles pièces fournir. Gardez une copie numérique de chaque document, et un exemplaire papier dans votre bagage à main.

## Le logement d’arrivée

Même provisoire, ayez une adresse pour les premières semaines : elle vous servira pour l’ouverture du compte, la sécurité sociale et la mairie.

## Ce qu’on oublie souvent

- L’assurance voyage pour le premier mois.
- Un moyen de paiement utilisable dès l’arrivée.
- Les coordonnées d’une personne de confiance sur place.

Prenez les étapes une par une : la liste de votre parcours les range dans l’ordre, avec des échéances.`,
    v2: 'Mise à jour : ajout de la liste des oublis fréquents.',
    citable: true,
  },
  {
    titre: 'Obtenir un visa étudiant : pièces, délais, erreurs fréquentes',
    categorie: 'PRE_DEPARTURE',
    corps: `## Le principe

Le visa étudiant s’appuie sur l’admission dans un établissement et sur la preuve que vous pourrez vivre pendant vos études. Le dossier se prépare plusieurs mois à l’avance.

## Les pièces qui reviennent toujours

Lettre d’admission, justificatif de ressources, hébergement prévu, assurance, photos conformes. La liste exacte dépend de votre pays : référez-vous à la page de votre consulat, qui fait foi.

## Les erreurs qu’on voit souvent

Un nom écrit différemment d’un document à l’autre, une traduction non conforme, un justificatif trop ancien. Relisez chaque pièce avec le passeport sous les yeux.

## Après l’obtention

Photographiez le visa, notez sa date de fin et la démarche à faire à l’arrivée pour le valider : c’est une étape à part entière dans votre parcours.`,
  },
  {
    titre: 'Ouvrir un compte bancaire quand on vient d’arriver',
    categorie: 'ARRIVAL',
    corps: `## Ce que demande une banque

Une pièce d’identité, un justificatif de domicile et, selon les cas, un justificatif de statut (carte étudiante, contrat). Si vous n’avez pas encore de justificatif de domicile, une attestation d’hébergement accompagnée de la pièce d’identité de l’hébergeur est souvent acceptée.

## Banque classique ou banque en ligne

Les banques en ligne ouvrent un compte vite mais demandent parfois un premier virement depuis un autre compte. Les agences prennent plus de temps mais permettent de parler à quelqu’un, ce qui aide quand on découvre le système.

## Les frais à surveiller

Comparez les frais de tenue de compte, de carte et de virement vers l’étranger. Demandez ces trois lignes par écrit avant de signer.

## Envoyer de l’argent au pays

Comparez les services de transfert : le taux de change compte autant que les frais affichés.`,
    v2: 'Mise à jour : précision sur l’attestation d’hébergement.',
    citable: true,
  },
  {
    titre: 'La première semaine : le programme qui évite les oublis',
    categorie: 'ARRIVAL',
    corps: `## Jour 1 à 3 : se poser

Dormir, manger, acheter une carte SIM, prévenir ses proches. Repérer la mairie, la station de transport, la pharmacie la plus proche.

## Jour 3 à 5 : l’administratif de base

Validation du visa si elle est demandée, ouverture d’un compte, adresse postale fiable. Gardez un classeur : tout y entre.

## Jour 5 à 7 : s’ancrer

Inscrivez-vous au réseau de votre ville, repérez un lieu où retrouver des gens du pays, et demandez un parrain si vous le souhaitez. Se sentir entouré·e change la suite.`,
  },
  {
    titre: 'Titre de séjour : préparer sa première demande et son renouvellement',
    categorie: 'ARRIVAL',
    corps: `## Anticiper

Les rendez-vous en préfecture se prennent à l’avance et les délais varient selon la ville. Commencez à rassembler vos pièces dès que vous connaissez la date de fin de votre visa ou de votre titre.

## Constituer un dossier propre

Une chemise par catégorie (identité, ressources, logement, situation), des copies lisibles, des originaux à portée de main.

## Si l’on vous demande une pièce de plus

Notez par écrit ce qui est demandé et à quelle date. Vous pouvez demander de l’aide à un membre qui est passé par là : posez la question dans l’entraide, en précisant votre préfecture.

## À retenir

Les règles changent. Vérifiez toujours sur le site officiel de votre préfecture avant d’agir.`,
    citable: true,
  },
  {
    titre: 'Trouver une chambre ou un studio : par où commencer',
    categorie: 'HOUSING',
    ville: 'paris',
    corps: `## Les sources

Résidences étudiantes, annonces entre particuliers, colocations, agences. Chaque source a son rythme : les résidences se remplissent tôt, les colocations se décident vite.

## Le dossier locataire

Pièce d’identité, justificatifs de ressources, parfois un garant. Si vous n’avez pas de garant en France, renseignez-vous sur les dispositifs de garantie proposés par les organismes publics.

## Les questions à poser à la visite

Charges comprises ou non, durée du bail, état des lieux, chauffage, voisinage. Prenez des photos de l’état des lieux d’entrée.

## Ne jamais payer avant de visiter

Voir le guide sur les arnaques au logement.`,
    v2: 'Mise à jour : rappel sur l’état des lieux d’entrée.',
  },
  {
    titre: 'Se loger à Lyon : quartiers, transports, bons réflexes',
    categorie: 'HOUSING',
    ville: 'lyon',
    corps: `## Les quartiers

Les quartiers proches du métro ou du tramway sont les plus faciles pour un étudiant ou un nouvel arrivant. Comparez le temps de trajet plutôt que la distance.

## Les transports

L’abonnement jeune ou étudiant réduit nettement le budget transport. Renseignez-vous auprès de l’opérateur local pour les conditions.

## Les bons réflexes

Visitez de jour et de soir, parlez à un voisin, vérifiez le niveau de bruit. Le réseau de la ville est un bon endroit pour demander l’avis d’un membre du quartier.`,
  },
  {
    titre: 'Comprendre un bail et un état des lieux',
    categorie: 'HOUSING',
    corps: `## Les mentions importantes

Durée, loyer, charges, dépôt de garantie, conditions de préavis. Lisez chaque ligne : un bail signé engage.

## L’état des lieux

Il décrit l’état du logement à l’entrée et à la sortie. Notez tout défaut, même petit, et prenez des photos datées.

## Le dépôt de garantie

Il vous est rendu à la sortie sous conditions. Conservez l’état des lieux d’entrée et vos échanges avec le propriétaire.

## En cas de désaccord

Parlez-en d’abord par écrit, puis rapprochez-vous d’une association d’aide aux locataires.`,
  },
  {
    titre: 'S’inscrire à l’assurance maladie et choisir un médecin traitant',
    categorie: 'DAILY_LIFE',
    corps: `## S’affilier

Selon votre situation (étudiant, salarié), l’inscription passe par des organismes différents. Le site officiel de l’Assurance Maladie guide pas à pas.

## La carte et l’attestation

Dès l’affiliation, demandez une attestation : elle sert avant la réception de la carte.

## Le médecin traitant

Déclarer un médecin traitant améliore vos remboursements. Prenez un médecin proche de chez vous et demandez les délais de rendez-vous avant de choisir.

## La complémentaire

Elle complète les remboursements. Comparez les offres pour étudiants et jeunes actifs.`,
    citable: true,
  },
  {
    titre: 'Se déplacer sans se ruiner : abonnements, vélo, covoiturage',
    categorie: 'DAILY_LIFE',
    corps: `## Les abonnements

Les réseaux de transport proposent presque toujours un tarif réduit pour les jeunes, les étudiants ou les demandeurs d’emploi. Demandez-le : il n’est pas toujours appliqué automatiquement.

## Le vélo

Beaucoup de villes proposent des vélos en libre-service ou en location longue durée à prix doux. C’est souvent le moyen le plus rapide en centre-ville.

## Le covoiturage

Pratique pour les trajets longs. Vérifiez le profil de la personne et ne payez qu’à bord, via la plateforme.`,
  },
  {
    titre: 'Chercher un stage ou un premier emploi : CV, entretien, réseau',
    categorie: 'WORK_STUDIES',
    corps: `## Le CV à la française

Une page, des rubriques claires, pas de photo obligatoire. Mettez en avant ce que vous savez faire, avec des exemples concrets.

## La lettre

Courte, personnalisée, adressée à une personne si possible. Dites pourquoi cette entreprise et ce que vous apportez.

## L’entretien

Préparez trois exemples de situations vécues. Posez une question sur l’équipe : cela montre l’intérêt.

## Le réseau

Beaucoup d’offres ne sont jamais publiées. Parlez de votre recherche autour de vous, et proposez des échanges courts avec des personnes de votre secteur.`,
    v2: 'Mise à jour : conseils pour l’entretien.',
  },
  {
    titre: 'Études en France : inscription, bourse, logement universitaire',
    categorie: 'WORK_STUDIES',
    corps: `## L’inscription

Les procédures varient selon le niveau et la filière. Lisez attentivement le calendrier de votre établissement, et ne laissez pas passer une date limite.

## Les aides

Selon votre profil, des aides existent (bourses, aides au logement, restauration à prix réduit). Elles se demandent : rien n’est versé automatiquement.

## Le logement universitaire

Déposez la demande tôt. Si vous n’obtenez rien, passez par les annonces sérieuses et les associations d’étudiants de votre ville.`,
    citable: true,
  },
  {
    titre: 'Arnaques au logement : les signaux qui doivent vous arrêter',
    categorie: 'SCAM_ALERTS',
    corps: `## Les signaux

- On vous demande de payer avant de visiter.
- Le propriétaire est « à l’étranger » et envoie les clés par courrier.
- Le prix est très en dessous du marché.
- On vous presse de décider, d’envoyer des copies de papiers ou de payer par un moyen qui ne laisse pas de trace.

## Les bons réflexes

Visitez toujours avant de payer. Ne versez rien par mandat ou transfert à une personne que vous n’avez jamais rencontrée. En cas de doute, demandez à la communauté : plusieurs membres connaissent ces schémas.

## Si vous avez été victime

Conservez toutes les preuves, déposez plainte et signalez l’annonce sur la plateforme concernée. Signalez-la aussi ici.`,
    citable: true,
  },
  {
    titre: 'Envoyer de l’argent au pays : comparer sans se faire piéger',
    categorie: 'DAILY_LIFE',
    corps: `## Comparer le coût réel

Un service qui affiche « zéro frais » peut se rattraper sur le taux de change. Comparez le montant que recevra vraiment la personne.

## La sécurité

N’envoyez de l’argent qu’à des personnes que vous connaissez, et par des services agréés. Méfiez-vous des intermédiaires qui promettent un taux « spécial ».

## Garder une trace

Conservez les reçus : ils servent en cas de litige et pour votre propre budget.`,
  },
];

/** Les deux premiers guides sont écrits par des anciens de longue date ; les autres sont répartis. */
export async function genererGuides(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const auteurs = c.membres.filter((m) => m.ancien);
  if (auteurs.length === 0) return;
  const villes = new Map(c.villes.map((v) => [v.slug, v]));
  const idPaysBj = c.membres.find((m) => m.originIso2 === 'BJ')?.countryId;
  const votants = c.membres;
  const slugs = new Set<string>();
  let votes = 0;

  for (const [i, g] of GUIDES.entries()) {
    const id = newId();
    const pageId = newId();
    const v1 = newId();
    const v2 = g.v2 === undefined ? null : newId();
    const auteur = rng.pick(auteurs);
    const creeLe = ilYa(now, rng.int(20, 150), rng);
    const maj = g.v2 === undefined ? creeLe : ilYa(now, rng.int(2, 18), rng);
    let slug = g.titre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70);
    while (slugs.has(slug)) slug += '-2';
    slugs.add(slug);
    const pourPays = g.categorie === 'PRE_DEPARTURE' && i === 1 && idPaysBj !== undefined;
    const ville = g.ville === undefined ? undefined : villes.get(g.ville);

    const nbVotes = rng.int(6, Math.min(votants.length - 1, 70));
    const electeurs = rng.sample(votants.filter((m) => m.id !== auteur.id), nbVotes);
    const utiles = electeurs.filter(() => rng.chance(0.9));

    await tx.guide.create({
      data: {
        id,
        createdAt: creeLe,
        authorUserId: auteur.id,
        title: g.titre,
        slug,
        category: g.categorie,
        scope: pourPays ? 'COUNTRY' : 'UNIVERSAL',
        ...(pourPays ? { originCountryId: idPaysBj } : {}),
        ...(ville === undefined ? {} : { cityId: ville.id }),
        status: 'PUBLISHED',
        helpfulCount: utiles.length,
        freshnessScore: utiles.length * 0.9,
        lastContentUpdateAt: maj,
        viewCount: utiles.length * rng.int(6, 14),
        revision: g.v2 === undefined ? 0 : 1,
        quotable: g.citable === true,
      },
    });
    await tx.guidePage.create({ data: { id: pageId, guideId: id, position: 1, title: g.titre, slug: 'principal' } });
    await tx.guideVersion.create({ data: { id: v1, createdAt: creeLe, guideId: id, pageId, version: 1, body: g.corps, summary: 'Première version', createdByUserId: auteur.id } });
    let courante = v1;
    if (v2 !== null && g.v2 !== undefined) {
      await tx.guideVersion.create({ data: { id: v2, createdAt: maj, guideId: id, pageId, version: 2, body: `${g.corps}\n\n> ${g.v2}`, summary: g.v2, createdByUserId: auteur.id } });
      courante = v2;
    }
    await tx.guidePage.update({ where: { id: pageId }, data: { currentVersionId: courante } });
    await tx.guide.update({ where: { id }, data: { currentVersionId: courante } });
    for (const lot of paquets(electeurs)) {
      await tx.guideVote.createMany({
        data: lot.map((m) => ({ id: newId(), guideId: id, userId: m.id, value: utiles.includes(m) ? ('HELPFUL' as const) : ('NOT_HELPFUL' as const) })),
      });
    }
    votes += electeurs.length;
    await tx.guideContributor.create({ data: { guideId: id, userId: auteur.id, acceptedCount: 1, firstAt: creeLe } });
    c.aIndexer.push({ sujet: 'GUIDE', id, titre: g.titre, texte: g.corps, cityId: ville?.id ?? null, communityId: null });
  }
  incr(c, 'guides', GUIDES.length);
  incr(c, 'votes sur les guides', votes);
  c.log(`  guides : ${GUIDES.length} publiés (versions, votes d’utilité)`);
}
