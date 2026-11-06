import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { incr, paquets, type Contexte } from './types.js';

/**
 * LE FIL — publications, commentaires, réactions, stories (vingt-quatre heures) et conseils de ville. Tout est écrit
 * par des comptes de départ ; rien n'est modéré en attente (`CLEARED`) puisque la modération ne tournera pas dessus.
 */

/** Les fonds autorisés pour une story (recopiés de STORY_BACKGROUND_COLORS dans @app/shared : le paquet de base ne dépend pas d'elle). */
const STORY_BACKGROUND_COLORS = ['#1B4332', '#2D6A4F', '#B7791F', '#9C2A2A', '#1D3557', '#5B3A70', '#22333B'] as const;

type TypePost = 'VICTORY' | 'QUESTION' | 'INFO' | 'DISCUSSION';

const POSTS: readonly (readonly [TypePost, string])[] = [
  ['VICTORY', 'Ça y est, mon titre de séjour est arrivé ! Merci à celles et ceux qui m’ont aidé à préparer le dossier. Courage à toutes les personnes qui attendent encore.'],
  ['VICTORY', 'J’ai signé mon premier bail aujourd’hui. Trois mois de recherche, beaucoup de refus, et finalement une petite chambre lumineuse. Ne lâchez rien.'],
  ['VICTORY', 'Première semaine de stage terminée. Je ne pensais pas qu’on m’accueillerait aussi bien. Merci au réseau pour les conseils sur le CV.'],
  ['VICTORY', 'Mon compte en banque est enfin ouvert, carte reçue ! Si vous bloquez, demandez l’attestation d’hébergement, ça a débloqué mon dossier.'],
  ['VICTORY', 'J’ai validé mon visa en ligne du premier coup. J’avais préparé toutes les pièces la veille avec la liste du guide.'],
  ['VICTORY', 'Premier entretien d’embauche passé hier. Stressant mais bien passé, on me rappelle en début de semaine. Je vous tiens au courant.'],
  ['QUESTION', 'Quelqu’un sait si la carte étudiante donne droit au tarif réduit dans les musées de la ville ? Je n’ose pas demander à l’accueil.'],
  ['QUESTION', 'Je cherche un bon médecin généraliste dans le quartier. Si vous avez une adresse où l’on est bien reçu, je prends.'],
  ['QUESTION', 'Comment faites-vous pour garder le contact avec la famille sans forfait coûteux ? Je cherche des astuces simples.'],
  ['QUESTION', 'Quelle assurance habitation avez-vous prise pour une chambre en colocation ? Je compare, je suis perdu·e.'],
  ['QUESTION', 'Y a-t-il une épicerie du pays ouverte le dimanche près de la gare ? J’ai invité des amis et il me manque deux ingrédients.'],
  ['QUESTION', 'Pour un premier job étudiant, vaut-il mieux la restauration, la livraison ou le soutien scolaire ? Vos retours m’intéressent.'],
  ['INFO', 'Rappel utile : conservez toujours le récépissé de votre demande de titre de séjour. Il prouve que vos démarches sont en cours.'],
  ['INFO', 'La bibliothèque municipale propose un accès gratuit à des ordinateurs et à l’impression pour les démarches en ligne. Pratique si votre imprimante vous lâche.'],
  ['INFO', 'Plusieurs communes proposent une aide pour les abonnements de transport des étudiants. Renseignez-vous auprès de votre mairie avant d’acheter à plein tarif.'],
  ['INFO', 'Attention aux annonces de location qui demandent un paiement avant la visite. Il y en a beaucoup en ce moment, signalez-les ici.'],
  ['INFO', 'Les associations d’aide aux étrangers tiennent des permanences gratuites. Appelez avant pour connaître les jours et les documents à apporter.'],
  ['INFO', 'Pensez à déclarer votre changement d’adresse après un déménagement : cela évite de rater un courrier important de la préfecture.'],
  ['DISCUSSION', 'Vous, la première chose qui vous a surpris en arrivant ? Pour moi, c’est le silence dans les transports.'],
  ['DISCUSSION', 'Le plat qui vous rappelle le plus la maison, et où vous trouvez les ingrédients. Je commence : le riz au gras, et un marché le samedi.'],
  ['DISCUSSION', 'Étudier et travailler en même temps : comment vous organisez-vous ? Je n’arrive pas à tenir le rythme.'],
  ['DISCUSSION', 'On pourrait organiser un repas partagé un dimanche du mois prochain ? Dites-moi si ça vous dit et je lance un événement.'],
  ['DISCUSSION', 'Quelle application utilisez-vous pour suivre vos échéances administratives ? Je veux arrêter de tout noter sur des papiers.'],
  ['DISCUSSION', 'Vos meilleurs conseils pour les premiers hivers, pour ceux qui n’avaient jamais connu le froid ?'],
];

const COMMENTAIRES = [
  'Bravo, et merci d’avoir partagé !',
  'Merci pour l’info, je ne le savais pas.',
  'Pareil pour moi, ça m’a pris des semaines. Courage.',
  'Je peux t’envoyer une adresse en message si tu veux.',
  'Super nouvelle, félicitations !',
  'Bonne question, je suis aussi preneur de vos retours.',
  'Chez nous c’était pareil. Garde bien tous les justificatifs.',
  'Je confirme, ça a marché pour moi aussi.',
  'Tu peux demander aussi à la permanence de la mairie, ils sont très disponibles.',
  'Merci, c’est exactement ce dont j’avais besoin ce matin.',
  'Je suis partant·e pour le repas partagé !',
  'Bienvenue dans la ville, n’hésite pas à poser tes questions ici.',
];

const REACTIONS = ['BRAVO', 'USEFUL', 'SUPPORT', 'LIKE'] as const;

const HISTOIRES: readonly { type: 'CONSEIL' | 'INFORMATION' | 'DECOUVERTE'; corps: string; categorie: string; lieu?: string }[] = [
  { type: 'CONSEIL', corps: 'Pour le logement, visitez toujours avant de payer et demandez l’état des lieux par écrit.', categorie: 'LOGEMENT' },
  { type: 'CONSEIL', corps: 'Gardez une pochette plastique avec tous vos originaux. Le jour du rendez-vous, vous gagnez dix minutes.', categorie: 'DEMARCHES' },
  { type: 'INFORMATION', corps: 'La bibliothèque universitaire ouvre ses salles de travail le dimanche pendant les examens.', categorie: 'ETUDES' },
  { type: 'DECOUVERTE', corps: 'Une épicerie du pays a ouvert près de la gare : piment, attiéké, farine de maïs.', categorie: 'LIEU', lieu: 'Épicerie près de la gare' },
  { type: 'DECOUVERTE', corps: 'Un salon qui travaille les cheveux crépus sans rendez-vous le samedi. Accueil chaleureux.', categorie: 'LIEU', lieu: 'Salon du quartier' },
  { type: 'INFORMATION', corps: 'Le marché couvert est ouvert le mardi et le vendredi, côté des producteurs.', categorie: 'PRODUIT', lieu: 'Marché couvert' },
  { type: 'CONSEIL', corps: 'Pour appeler le pays, une connexion normale suffit pour un appel vidéo. Inutile de prendre un forfait cher.', categorie: 'VIE_QUOTIDIENNE' },
  { type: 'DECOUVERTE', corps: 'Un tournoi de football amical chaque dimanche après-midi, tout le monde peut venir jouer.', categorie: 'SORTIE', lieu: 'Terrain de quartier' },
  { type: 'INFORMATION', corps: 'Pensez à demander l’abonnement de transport à tarif réduit : il n’est pas appliqué tout seul.', categorie: 'TRANSPORT' },
  { type: 'CONSEIL', corps: 'Avant de signer un bail, relisez les charges et la durée. Une question posée avant évite un regret après.', categorie: 'LOGEMENT' },
  { type: 'INFORMATION', corps: 'Les permanences d’aide aux démarches reprennent le jeudi après-midi à la maison de quartier. Venez avec vos originaux.', categorie: 'DEMARCHES', lieu: 'Maison de quartier' },
  { type: 'CONSEIL', corps: 'Pour trouver un job étudiant, passez par le service emploi de votre établissement : les offres y sont vérifiées.', categorie: 'EMPLOI' },
  { type: 'DECOUVERTE', corps: 'Un café associatif propose des cours de français gratuits le mardi soir, ouverts à tous.', categorie: 'ETUDES', lieu: 'Café associatif' },
  { type: 'INFORMATION', corps: 'Un médecin généraliste du centre accepte de nouveaux patients cette semaine. Pensez à prendre rendez-vous en ligne.', categorie: 'SANTE' },
  { type: 'CONSEIL', corps: 'Gardez toujours une copie numérique de vos documents importants, dans un dossier protégé accessible depuis votre téléphone.', categorie: 'DEMARCHES' },
  { type: 'DECOUVERTE', corps: 'Un traiteur du quartier prépare des plats du pays sur commande, livraison le samedi.', categorie: 'LIEU', lieu: 'Traiteur du quartier' },
];

const CONSEILS_VILLE: readonly { kind: 'TIP' | 'SHOP' | 'BUDGET' | 'TESTIMONY'; corps: string; montant?: number; lieu?: string }[] = [
  { kind: 'TIP', corps: 'Le marché du matin est bien moins cher que le supermarché pour les légumes et les épices.' },
  { kind: 'TIP', corps: 'La mairie annexe prend moins de monde en fin de semaine : y aller le jeudi plutôt que le lundi.' },
  { kind: 'SHOP', corps: 'Épicerie du pays, accueil très agréable, produits frais le mercredi.', lieu: 'Épicerie du pays' },
  { kind: 'SHOP', corps: 'Boulangerie où l’on trouve du pain sans surprise sur les prix, ouverte tard.', lieu: 'Boulangerie du centre' },
  { kind: 'BUDGET', corps: 'Mon budget mensuel hors loyer : courses, transport, téléphone, petites dépenses.', montant: 38000 },
  { kind: 'BUDGET', corps: 'Un loyer de chambre en colocation, charges comprises, dans un quartier bien desservi.', montant: 46000 },
  { kind: 'TESTIMONY', corps: 'Mon premier hiver ici a été dur, mais le réseau de la ville m’a vraiment porté. Ne restez pas seul·e.' },
  { kind: 'TESTIMONY', corps: 'J’ai trouvé un stage grâce à un échange dans ce réseau. Parlez de votre recherche autour de vous.' },
];

export async function genererFil(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const membres = c.membres;
  if (membres.length < 10) return;

  // ── Publications : trente-cinq par ville comptée au prorata, avec des commentaires et des réactions.
  const nbPosts = 64;
  const posts: { id: string; auteurId: string; cityId: string }[] = [];
  for (let i = 0; i < nbPosts; i++) {
    const [type, corps] = POSTS[i % POSTS.length] as readonly [TypePost, string];
    const auteur = rng.pick(membres);
    const quand = ilYa(now, rng.int(0, 60), rng);
    const id = newId();
    posts.push({ id, auteurId: auteur.id, cityId: auteur.cityId });
    await tx.post.create({
      data: { id, createdAt: quand, authorUserId: auteur.id, type, body: corps, cityId: auteur.cityId, status: 'PUBLISHED', moderationStatus: 'CLEARED' },
    });
  }
  let nbCommentaires = 0;
  let nbReactions = 0;
  for (const p of posts) {
    const nbC = rng.chance(0.7) ? rng.int(1, 5) : 0;
    const quiC = rng.sample(membres, nbC);
    const lignesC = quiC.map((m) => ({
      id: newId(),
      createdAt: new Date(now.getTime() - rng.int(0, 40 * 24 * 60) * 60_000),
      subjectType: 'POST' as const,
      subjectId: p.id,
      authorUserId: m.id,
      body: rng.pick(COMMENTAIRES),
      status: 'PUBLISHED' as const,
    }));
    for (const lot of paquets(lignesC)) await tx.comment.createMany({ data: lot });
    const quiR = rng.sample(membres.filter((m) => m.id !== p.auteurId), rng.int(1, 18));
    const lignesR = quiR.map((m) => ({ id: newId(), postId: p.id, userId: m.id, kind: rng.pick(REACTIONS) }));
    for (const lot of paquets(lignesR)) await tx.postReaction.createMany({ data: lot });
    await tx.post.update({ where: { id: p.id }, data: { commentCount: lignesC.length, reactionCount: lignesR.length } });
    nbCommentaires += lignesC.length;
    nbReactions += lignesR.length;
  }

  // ── Stories : actives vingt-quatre heures, à compter de maintenant.
  const lignesStories = HISTOIRES.map((h, i) => {
    const auteur = rng.pick(membres);
    return {
      id: newId(),
      createdAt: new Date(now.getTime() - rng.int(10, 600) * 60_000),
      authorUserId: auteur.id,
      type: h.type,
      body: h.corps,
      backgroundColor: STORY_BACKGROUND_COLORS[i % STORY_BACKGROUND_COLORS.length] as string,
      textStyle: rng.pick(['BOLD', 'SERIF'] as const),
      cityId: auteur.cityId,
      category: h.categorie,
      ...(h.lieu === undefined ? {} : { placeLabel: h.lieu }),
      expiresAt: new Date(now.getTime() + rng.int(3, 23) * 3_600_000),
      audience: 'ALL' as const,
      allowMessages: true,
      status: 'ACTIVE' as const,
      moderationStatus: 'CLEARED' as const,
    };
  });
  for (const lot of paquets(lignesStories)) await tx.story.createMany({ data: lot });

  // ── Conseils de ville.
  let nbConseils = 0;
  for (const ville of c.villes) {
    for (const t of rng.sample(CONSEILS_VILLE, 3)) {
      const auteurs = membres.filter((m) => m.cityId === ville.id);
      if (auteurs.length === 0) continue;
      const auteur = rng.pick(auteurs);
      const id = newId();
      await tx.cityTip.create({
        data: {
          id,
          createdAt: ilYa(now, rng.int(1, 80), rng),
          cityId: ville.id,
          authorUserId: auteur.id,
          kind: t.kind,
          body: t.corps,
          ...(t.montant === undefined ? {} : { amountCents: t.montant }),
          ...(t.lieu === undefined ? {} : { venueName: t.lieu }),
          helpfulCount: rng.int(0, 12),
          status: 'PUBLISHED',
          quotable: t.kind === 'TESTIMONY',
        },
      });
      nbConseils += 1;
    }
  }

  incr(c, 'publications', posts.length);
  incr(c, 'commentaires du fil', nbCommentaires);
  incr(c, 'réactions du fil', nbReactions);
  incr(c, 'stories', lignesStories.length);
  incr(c, 'conseils de ville', nbConseils);
  c.log(`  fil : ${posts.length} publications, ${nbCommentaires} commentaires, ${nbReactions} réactions, ${lignesStories.length} stories, ${nbConseils} conseils de ville`);
}
