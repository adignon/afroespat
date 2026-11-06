import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { incr, type Contexte } from './types.js';

/**
 * L'ACTIVITÉ AUTOUR DES CONTENUS — signalements et dossiers de modération (la file de l'équipe a de quoi travailler),
 * citations d'impact approuvées (celles de la landing), notifications des membres, favoris.
 */

/** « 2026-T3 » : le dernier trimestre CLOS (le format de `impact.service.ts`). */
export function dernierTrimestreClos(now: Date): string {
  const t = Math.floor(now.getUTCMonth() / 3) + 1;
  return t === 1 ? `${now.getUTCFullYear() - 1}-T4` : `${now.getUTCFullYear()}-T${t - 1}`;
}

const MOTIFS: readonly { reason: 'SCAM' | 'SPAM' | 'INAPPROPRIATE' | 'MONEY_REQUEST' | 'HARASSMENT' | 'OTHER'; details: string }[] = [
  { reason: 'SPAM', details: 'Ressemble à une publicité répétée.' },
  { reason: 'INAPPROPRIATE', details: 'Le ton me paraît déplacé dans cette discussion.' },
  { reason: 'MONEY_REQUEST', details: 'La personne demande de l’argent à l’avance.' },
  { reason: 'OTHER', details: 'Je ne suis pas sûr·e que cette information soit exacte.' },
];

const CITATIONS = [
  'Grâce à ce guide, j’ai évité un aller-retour inutile à la préfecture. Tout était dans l’ordre, avec les bonnes pièces.',
  'Je suis arrivée sans connaître personne. Ce guide m’a donné une liste claire, et le réseau de la ville a fait le reste.',
  'Voir les démarches expliquées simplement, par quelqu’un qui est passé par là, ça change tout.',
  'J’ai relu ce guide la veille de mon rendez-vous. Je n’ai rien oublié.',
];

const NOTIFICATIONS: readonly { category: string; type: string; titre: string; url: string }[] = [
  { category: 'HELP', type: 'help.response_received', titre: 'Un membre a répondu à votre demande', url: '/entraide' },
  { category: 'SOCIAL', type: 'social.post_reacted', titre: 'Plusieurs personnes ont réagi à votre publication', url: '/accueil' },
  { category: 'SOCIAL', type: 'social.post_commented', titre: 'Un membre a commenté votre publication', url: '/accueil' },
  { category: 'MENTORSHIP', type: 'mentorship.request_received', titre: 'Vous avez reçu une demande de parrainage', url: '/parrainage' },
  { category: 'EVENT', type: 'event.reminder', titre: 'Un événement que vous suivez approche', url: '/agenda' },
  { category: 'SOCIAL', type: 'social.connection_requested', titre: 'Un membre souhaite se connecter avec vous', url: '/reseau' },
];

export async function genererActivite(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;

  // ── Signalements et dossiers de modération, sur des publications de départ.
  const posts = await tx.post.findMany({ where: { author: { is: { origin: 'SEED' } } }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, authorUserId: true } });
  let signalements = 0;
  let dossiers = 0;
  for (const [i, p] of posts.entries()) {
    const motif = MOTIFS[i % MOTIFS.length] as (typeof MOTIFS)[number];
    const auteur = rng.pick(c.membres.filter((m) => m.id !== p.authorUserId));
    const caseId = newId();
    const priorite = rng.int(2, 4);
    await tx.moderationCase.create({
      data: {
        id: caseId,
        createdAt: ilYa(now, rng.int(0, 4), rng),
        subjectType: 'POST',
        subjectId: p.id,
        subjectAuthorUserId: p.authorUserId,
        source: 'REPORT',
        priority: priorite,
        status: 'OPEN',
        aiLabels: [],
        slaDueAt: new Date(now.getTime() + (priorite <= 2 ? 24 : 72) * 3_600_000),
      },
    });
    await tx.report.create({
      data: { id: newId(), reporterUserId: auteur.id, subjectType: 'POST', subjectId: p.id, reason: motif.reason, details: motif.details, status: 'ATTACHED', caseId },
    });
    dossiers += 1;
    signalements += 1;
  }
  incr(c, 'dossiers de modération', dossiers);
  incr(c, 'signalements', signalements);

  // ── Citations d'impact approuvées : exigent un compte d'équipe (l'approbateur).
  let citations = 0;
  const equipe = await tx.staffUser.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } });
  const citables = await tx.guide.findMany({ where: { quotable: true, author: { is: { origin: 'SEED' } } }, select: { id: true }, take: 4 });
  if (equipe === null) {
    c.log('  citations d’impact : aucun compte d’équipe pour les approuver — non générées (créez d’abord le premier administrateur, puis purgez et régénérez)');
  } else {
    const trimestre = dernierTrimestreClos(now);
    for (const [i, g] of citables.entries()) {
      await tx.impactQuote.create({
        data: { id: newId(), quarter: trimestre, guideId: g.id, quote: CITATIONS[i % CITATIONS.length] as string, approvedByStaffId: equipe.id },
      });
      citations += 1;
    }
  }
  incr(c, 'citations d’impact', citations);

  // ── Notifications : deux à quatre par membre actif, certaines déjà lues.
  const lignes = c.membres.flatMap((m) =>
    rng.sample(NOTIFICATIONS, rng.int(2, 4)).map((n) => {
      const quand = ilYa(now, rng.int(0, 14), rng);
      return {
        id: newId(),
        createdAt: quand,
        userId: m.id,
        type: n.type,
        title: n.titre,
        url: n.url,
        category: n.category,
        channelsSent: ['PUSH'],
        readAt: rng.chance(0.45) ? new Date(quand.getTime() + rng.int(5, 600) * 60_000) : null,
      };
    }),
  );
  for (let i = 0; i < lignes.length; i += 500) await tx.notification.createMany({ data: lignes.slice(i, i + 500) });
  incr(c, 'notifications', lignes.length);

  // ── Favoris : guides et événements.
  const guides = await tx.guide.findMany({ where: { author: { is: { origin: 'SEED' } } }, select: { id: true }, take: 14 });
  const evenements = await tx.event.findMany({ where: { organizer: { is: { origin: 'SEED' } }, status: 'SCHEDULED' }, select: { id: true }, take: 10 });
  const favoris = new Map<string, { id: string; userId: string; subjectType: 'GUIDE' | 'EVENT'; subjectId: string }>();
  for (const m of rng.sample(c.membres, 36)) {
    for (const g of rng.sample(guides, rng.int(1, 3))) favoris.set(`${m.id}:G:${g.id}`, { id: newId(), userId: m.id, subjectType: 'GUIDE', subjectId: g.id });
    for (const e of rng.sample(evenements, rng.int(0, 2))) favoris.set(`${m.id}:E:${e.id}`, { id: newId(), userId: m.id, subjectType: 'EVENT', subjectId: e.id });
  }
  await tx.bookmark.createMany({ data: [...favoris.values()] });
  incr(c, 'favoris', favoris.size);

  c.log(`  activité : ${dossiers} dossiers de modération, ${citations} citations d’impact, ${lignes.length} notifications, ${favoris.size} favoris`);
}
