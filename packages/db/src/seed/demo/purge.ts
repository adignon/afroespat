import type { Prisma } from '../../../generated/client/index.js';

/**
 * LA PURGE — retire TOUT ce que le générateur a produit, c'est-à-dire tout ce qui appartient à un compte `origin = SEED`.
 * Elle fait, en une transaction, ce que « Supprimer définitivement le membre et ses contenus » de l'administration fait
 * compte par compte (`AdminMemberActionsService.removeMemberAndContent`) : mêmes liens polymorphes nettoyés, mêmes
 * contenus que la cascade laisserait (guides, conseils de ville, conversations, réseaux créés), mêmes compteurs
 * recalculés. Le compte, lui, emporte le reste par cascade.
 *
 * NE TOUCHE PAS aux comptes inscrits par un vrai membre, ni aux contenus qu'ils ont écrits, ni à l'équipe.
 */
export interface RapportPurge {
  readonly comptes: number;
  readonly retire: Readonly<Record<string, number>>;
}

type Tx = Prisma.TransactionClient;

export async function purgerDemo(tx: Tx, options: { readonly fermerVilles?: boolean } = {}): Promise<RapportPurge> {
  const retire: Record<string, number> = {};
  const compter = (nom: string, n: number): void => {
    if (n > 0) retire[nom] = (retire[nom] ?? 0) + n;
  };

  const comptes = await tx.user.findMany({ where: { origin: 'SEED' }, select: { id: true, cityId: true } });
  const ids = comptes.map((u) => u.id);
  if (ids.length === 0) return { comptes: 0, retire };
  const villes = [...new Set(comptes.map((u) => u.cityId).filter((x): x is string => x !== null))];
  const de = { in: ids };
  const liste = (l: readonly { id: string }[]) => l.map((x) => x.id);

  // ── Les identifiants des contenus, avant que quoi que ce soit ne disparaisse.
  const posts = liste(await tx.post.findMany({ where: { authorUserId: de }, select: { id: true } }));
  const guides = liste(await tx.guide.findMany({ where: { authorUserId: de }, select: { id: true } }));
  const evenements = liste(await tx.event.findMany({ where: { organizerUserId: de }, select: { id: true } }));
  const entraide = liste(await tx.helpRequest.findMany({ where: { authorUserId: de }, select: { id: true } }));
  const logements = liste(await tx.housingListing.findMany({ where: { authorUserId: de }, select: { id: true } }));
  const emplois = liste(await tx.jobListing.findMany({ where: { authorUserId: de }, select: { id: true } }));
  const pros = liste(await tx.proProfile.findMany({ where: { userId: de }, select: { id: true } }));
  const histoires = liste(await tx.story.findMany({ where: { authorUserId: de }, select: { id: true } }));
  const parcours = liste(await tx.journey.findMany({ where: { ownerUserId: de }, select: { id: true } }));
  const sujetsMembres = liste(await tx.topic.findMany({ where: { authorUserId: de }, select: { id: true } }));

  // Les réseaux créés par un compte de départ, supprimés s'ils n'ont aucun autre membre qu'un compte de départ.
  const crees = liste(await tx.community.findMany({ where: { createdByUserId: de }, select: { id: true } }));
  const autres = await tx.communityMember.findMany({
    where: { communityId: { in: crees }, userId: { notIn: ids } },
    select: { communityId: true },
  });
  const gardes = new Set(autres.map((a) => a.communityId));
  const reseaux = crees.filter((id) => !gardes.has(id));
  const sujetsReseaux = liste(await tx.topic.findMany({ where: { communityId: { in: reseaux } }, select: { id: true } }));
  const sujets = [...sujetsMembres, ...sujetsReseaux];

  // ── Les liens polymorphes (aucune clé étrangère ne s'en charge).
  const parSujet = (paires: readonly (readonly [string, string[]])[]) =>
    paires.filter(([, l]) => l.length > 0).map(([subjectType, l]) => ({ subjectType, subjectId: { in: l } }));
  const sujetsDocs = parSujet([
    ['GUIDE', guides],
    ['TOPIC', sujets],
    ['HELP_REQUEST', entraide],
    ['HOUSING', logements],
    ['JOB', emplois],
    ['EVENT', evenements],
    ['PRO', pros],
  ]);
  if (sujetsDocs.length > 0) {
    compter('documents de recherche', (await tx.searchDocument.deleteMany({ where: { OR: sujetsDocs as Prisma.SearchDocumentWhereInput[] } })).count);
  }
  const commentaires = parSujet([
    ['POST', posts],
    ['TOPIC', sujets],
    ['GUIDE', guides],
    ['EVENT', evenements],
  ]);
  if (commentaires.length > 0) {
    compter('commentaires', (await tx.comment.deleteMany({ where: { OR: commentaires as Prisma.CommentWhereInput[] } })).count);
  }
  const favoris = parSujet([
    ['POST', posts],
    ['GUIDE', guides],
    ['EVENT', evenements],
    ['HELP_REQUEST', entraide],
    ['HOUSING', logements],
    ['JOB', emplois],
    ['PRO', pros],
    ['STORY', histoires],
  ]);
  if (favoris.length > 0) await tx.bookmark.deleteMany({ where: { OR: favoris as Prisma.BookmarkWhereInput[] } });
  const signales = parSujet([
    ['POST', posts],
    ['TOPIC', sujets],
    ['GUIDE', guides],
    ['EVENT', evenements],
    ['HELP_REQUEST', entraide],
    ['HOUSING', logements],
    ['JOB', emplois],
    ['PRO', pros],
    ['STORY', histoires],
  ]);
  if (signales.length > 0) await tx.report.deleteMany({ where: { OR: signales as Prisma.ReportWhereInput[] } });
  compter(
    'dossiers de modération',
    (await tx.moderationCase.deleteMany({ where: { OR: [{ subjectAuthorUserId: de }, ...(signales as Prisma.ModerationCaseWhereInput[])] } })).count,
  );

  // ── Les contenus que la cascade laisserait (relations SetNull).
  compter('guides', (await tx.guide.deleteMany({ where: { id: { in: guides } } })).count);
  compter('conseils de ville', (await tx.cityTip.deleteMany({ where: { authorUserId: de } })).count);
  const aDeux = await tx.conversation.findMany({ where: { members: { some: { userId: de } } }, select: { id: true, _count: { select: { members: true } } } });
  compter(
    'conversations',
    (
      await tx.conversation.deleteMany({
        where: {
          OR: [
            { openedByUserId: de },
            { journeyId: { in: parcours } },
            { communityId: { in: reseaux } },
            { id: { in: aDeux.filter((c) => c._count.members <= 2).map((c) => c.id) } },
          ],
        },
      })
    ).count,
  );
  compter('réseaux d’intérêt', (await tx.community.deleteMany({ where: { id: { in: reseaux } } })).count);
  await tx.outboundMessage.deleteMany({ where: { userId: de } });

  compter('publications', posts.length);
  compter('événements', evenements.length);
  compter('demandes d’entraide', entraide.length);
  compter('annonces de logement', logements.length);
  compter('offres d’emploi', emplois.length);
  compter('fiches de professionnels', pros.length);
  compter('stories', histoires.length);
  compter('parcours', parcours.length);

  // ── Les comptes : la cascade emporte profils, adhésions, votes, réactions, notifications, messages, etc.
  compter('comptes', (await tx.user.deleteMany({ where: { id: de } })).count);

  // ── Compteurs : recalculés sur ce qui reste (les mêmes valeurs que la tâche nocturne).
  for (const cityId of villes) {
    const restants = await tx.user.count({ where: { cityId, status: 'ACTIVE', deletedAt: null } });
    await tx.city.update({ where: { id: cityId }, data: { memberCount: restants } });
  }
  const reseauxRestants = await tx.community.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
  for (const r of reseauxRestants) {
    const n = await tx.communityMember.count({ where: { communityId: r.id, status: 'ACTIVE' } });
    await tx.community.update({ where: { id: r.id }, data: { memberCount: n } });
  }

  // ── Option : refermer les villes que la génération a ouvertes, si plus personne n'y vit.
  if (options.fermerVilles === true) {
    for (const cityId of villes) {
      const habitants = await tx.user.count({ where: { cityId } });
      if (habitants > 0) continue;
      await tx.community.deleteMany({ where: { kind: 'CITY', cityId, createdByUserId: null, members: { none: {} } } });
      await tx.city.update({ where: { id: cityId }, data: { isActive: false, activatedAt: null, memberCount: 0 } });
      compter('villes refermées', 1);
    }
  }
  return { comptes: comptes.length, retire };
}
