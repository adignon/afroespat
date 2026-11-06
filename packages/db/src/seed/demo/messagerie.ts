import { newId } from '../../uuid.js';
import { sceller } from './scellement.js';
import { incr, type Contexte, type Membre } from './types.js';

/**
 * LES RELATIONS ET LA MESSAGERIE — connexions, demandes de connexion, parrainages (profils de parrain, demandes,
 * accompagnements en cours et terminés avec avis), conversations directes. Les messages sont CHIFFRÉS comme ceux du
 * produit (`CONTENT_ENCRYPTION_KEY`) ; sans cette clé, conversations et messages sont sautés (et on le dit).
 */

const SCENARIOS: readonly (readonly string[])[] = [
  ['Bonjour, j’ai vu ta réponse sur le dossier de préfecture. Merci, ça m’a aidé !', 'Avec plaisir. Tu as pu prendre ton rendez-vous ?', 'Oui, pour le mois prochain. Je prépare les pièces.', 'Parfait. Si tu veux, je relis ta liste avant le jour J.'],
  ['Salut ! Tu cherches toujours une chambre ?', 'Oui, toujours. Tu as une piste ?', 'Une colocation se libère près du tram. Je te transmets le contact.', 'Merci beaucoup, je l’appelle tout de suite.', 'N’oublie pas de visiter avant de verser quoi que ce soit.'],
  ['Bienvenue dans la ville ! Si tu as des questions sur le quartier, dis-moi.', 'Merci, c’est gentil. Où trouver des produits du pays ?', 'Il y a une épicerie près de la gare. Je t’envoie l’adresse.', 'Génial, j’y passe samedi.'],
  ['Bonjour, ton CV est très clair. Je changerais seulement l’ordre des expériences.', 'Merci pour ton retour. Tu penses que je dois mettre mes stages au pays ?', 'Oui, mais en une ligne chacun, avec ce que tu y as appris.', 'D’accord, je modifie et je te le renvoie.'],
  ['Salut, tu viens au repas partagé dimanche ?', 'Oui ! Je prépare un plat de riz au gras.', 'Super, j’apporte les boissons. À dimanche !'],
  ['Bonjour, as-tu l’adresse du traducteur dont tu parlais ?', 'Oui, je te l’envoie ici. Il est rapide et clair sur les tarifs.', 'Merci, je lui écris dès ce soir.'],
  ['Hello ! Comment s’est passé ton premier jour de stage ?', 'Très bien, tout le monde est accueillant. Je suis un peu fatigué mais content.', 'Normal les premiers jours. Tiens-moi au courant !'],
  ['Bonjour, je propose le covoiturage samedi matin. Tu viens ?', 'Avec plaisir. Rendez-vous où ?', 'Devant la gare, vers 10 h.', 'Parfait, à samedi.'],
];

const DEMANDES_PARRAINAGE = [
  'Bonjour, je viens d’arriver et je cherche quelqu’un qui pourrait m’accompagner pendant mes premiers mois. Ce serait un vrai soutien.',
  'Je prépare mon départ et j’aimerais être guidé·e sur le logement et les démarches. Seriez-vous disponible ?',
  'Je suis étudiant·e en première année et un peu perdu·e. Je cherche un parrain ou une marraine pour échanger régulièrement.',
];

const AVIS = [
  'Une aide précieuse, toujours disponible et à l’écoute. Merci pour ces mois d’accompagnement.',
  'Des conseils concrets et bienveillants. Je recommande sans hésiter.',
  'Très à l’écoute, il m’a fait gagner beaucoup de temps sur mes démarches.',
];

const ordre = (a: string, b: string): readonly [string, string] => (a < b ? [a, b] : [b, a]);

export async function genererRelations(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const membres = c.membres;

  // ── Connexions supplémentaires entre habitants d'une même ville.
  const existantes = new Set(
    (await tx.connection.findMany({ where: { userAId: { in: membres.map((m) => m.id) } }, select: { userAId: true, userBId: true } })).map((k) => `${k.userAId}:${k.userBId}`),
  );
  const paires: { a: Membre; b: Membre; cle: string }[] = [];
  for (const ville of c.villes) {
    const habitants = membres.filter((m) => m.cityId === ville.id);
    for (let i = 0; i < 6 && habitants.length > 2; i++) {
      const [a, b] = rng.sample(habitants, 2) as [Membre, Membre];
      const [x, y] = ordre(a.id, b.id);
      const cle = `${x}:${y}`;
      if (existantes.has(cle) || paires.some((p) => p.cle === cle)) continue;
      paires.push({ a, b, cle });
    }
  }
  for (const p of paires) {
    const [x, y] = ordre(p.a.id, p.b.id);
    await tx.connection.create({ data: { id: newId(), userAId: x, userBId: y, origin: rng.pick(['MANUAL', 'EVENT', 'GUIDE'] as const) } });
  }
  incr(c, 'connexions', paires.length);

  // ── Demandes de connexion en attente.
  let demandes = 0;
  for (const ville of c.villes.slice(0, 5)) {
    const habitants = membres.filter((m) => m.cityId === ville.id);
    if (habitants.length < 2) continue;
    const [de, vers] = rng.sample(habitants, 2) as [Membre, Membre];
    const lien = await tx.connection.findFirst({ where: { OR: [{ userAId: de.id, userBId: vers.id }, { userAId: vers.id, userBId: de.id }] }, select: { id: true } });
    const deja = await tx.connectionRequest.findFirst({ where: { fromUserId: de.id, toUserId: vers.id }, select: { id: true } });
    if (lien !== null || deja !== null) continue;
    await tx.connectionRequest.create({
      data: { id: newId(), fromUserId: de.id, toUserId: vers.id, message: 'Bonjour, nous sommes dans la même ville. Ce serait avec plaisir de rester en contact.', status: 'PENDING' },
    });
    demandes += 1;
  }
  incr(c, 'demandes de connexion', demandes);

  // ── Parrains : profils, demandes, accompagnements.
  const parrains = rng.sample(
    membres.filter((m) => m.ancien),
    Math.min(10, membres.filter((m) => m.ancien).length),
  );
  for (const p of parrains) {
    await tx.mentorProfile.create({
      data: {
        userId: p.id,
        isAvailable: true,
        maxMentees: rng.int(1, 3),
        bio: 'Je suis passé·e par là : je peux accompagner sur le logement, les démarches et les premiers mois.',
        journeyTemplateIds: [],
        enabledAt: new Date(now.getTime() - rng.int(10, 120) * 86_400_000),
      },
    });
  }
  incr(c, 'profils de parrain', parrains.length);

  let accompagnements = 0;
  let avis = 0;
  const filleuls = rng.sample(
    membres.filter((m) => m.phase !== 'SETTLED'),
    Math.min(9, membres.filter((m) => m.phase !== 'SETTLED').length),
  );
  for (const [i, f] of filleuls.entries()) {
    const parrain = parrains.find((p) => p.id !== f.id && p.cityId === f.cityId) ?? parrains.find((p) => p.id !== f.id);
    if (parrain === undefined) continue;
    const statut = i < 3 ? ('REQUESTED' as const) : i < 7 ? ('ACTIVE' as const) : ('ENDED' as const);
    const demandeLe = new Date(now.getTime() - rng.int(5, 100) * 86_400_000);
    const id = newId();
    await tx.mentorship.create({
      data: {
        id,
        createdAt: demandeLe,
        mentorUserId: parrain.id,
        menteeUserId: f.id,
        status: statut,
        requestMessage: rng.pick(DEMANDES_PARRAINAGE),
        ...(statut === 'REQUESTED' ? { expiresAt: new Date(now.getTime() + 5 * 86_400_000) } : { acceptedAt: new Date(demandeLe.getTime() + 86_400_000) }),
        ...(statut === 'ACTIVE' ? { endsAt: new Date(now.getTime() + rng.int(20, 80) * 86_400_000) } : {}),
        ...(statut === 'ENDED' ? { endsAt: new Date(now.getTime() - 20 * 86_400_000), endedAt: new Date(now.getTime() - 20 * 86_400_000), endReason: 'COMPLETED' as const } : {}),
      },
    });
    accompagnements += 1;
    if (statut === 'ENDED') {
      await tx.mentorshipReview.create({
        data: { id: newId(), mentorshipId: id, reviewerUserId: f.id, revieweeUserId: parrain.id, rating: rng.int(4, 5), comment: rng.pick(AVIS) },
      });
      await tx.mentorProfile.update({ where: { userId: parrain.id }, data: { completedCount: { increment: 1 } } });
      await tx.userStats.updateMany({ where: { userId: parrain.id }, data: { mentorshipsCompleted: { increment: 1 } } });
      avis += 1;
    }
    if (statut === 'ACTIVE') await tx.mentorProfile.update({ where: { userId: parrain.id }, data: { activeMenteeCount: { increment: 1 } } });
  }
  incr(c, 'parrainages', accompagnements);
  incr(c, 'avis de parrainage', avis);

  // ── Conversations directes : chiffrées, donc soumises à la clé de contenu.
  if (c.cleContenu === null) {
    c.log('  messagerie : CONTENT_ENCRYPTION_KEY absente — conversations et messages non générés');
    c.log(`  relations : ${paires.length} connexions, ${demandes} demandes, ${parrains.length} parrains, ${accompagnements} parrainages`);
    return;
  }
  const cle = c.cleContenu;
  const liens = await tx.connection.findMany({
    where: { userAId: { in: membres.map((m) => m.id) }, userBId: { in: membres.map((m) => m.id) } },
    select: { userAId: true, userBId: true },
  });
  let conversations = 0;
  let messages = 0;
  for (const lien of rng.sample(liens, Math.min(36, liens.length))) {
    const id = newId();
    const debut = new Date(now.getTime() - rng.int(1, 40) * 86_400_000);
    const script = rng.pick(SCENARIOS);
    await tx.conversation.create({ data: { id, createdAt: debut, kind: 'DIRECT', openedByUserId: lien.userAId, lastMessageAt: debut } });
    await tx.conversationMember.createMany({
      data: [
        { conversationId: id, userId: lien.userAId, joinedAt: debut, lastReadAt: rng.chance(0.7) ? now : debut },
        { conversationId: id, userId: lien.userBId, joinedAt: debut, lastReadAt: rng.chance(0.7) ? now : debut },
      ],
    });
    let dernier = debut;
    for (const [k, ligne] of script.entries()) {
      dernier = new Date(debut.getTime() + (k + 1) * rng.int(3, 90) * 60_000);
      await tx.message.create({
        data: {
          id: newId(),
          conversationId: id,
          senderUserId: k % 2 === 0 ? lien.userAId : lien.userBId,
          bodyEncrypted: sceller(ligne, cle),
          sentAt: dernier,
        },
      });
      messages += 1;
    }
    await tx.conversation.update({ where: { id }, data: { lastMessageAt: dernier } });
    conversations += 1;
  }
  incr(c, 'conversations', conversations);
  incr(c, 'messages', messages);
  c.log(`  relations : ${paires.length} connexions, ${demandes} demandes, ${parrains.length} parrains, ${accompagnements} parrainages, ${conversations} conversations (${messages} messages chiffrés)`);
}
