import { reglerMonetisation } from '../../../common/__tests__/monetisation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  FREE_SPONSORED_JOBS_PER_MONTH,
  JOB_LIFETIME_DAYS,
  JOB_SPONSORED_DAYS,
  JOB_SPONSORED_HEAD_SLOTS,
  JOB_SPONSORED_LABEL,
  containsForbiddenWord,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { JobsService } from '../jobs.service';

/**
 * Emploi — 10-services.md §3 et §11.
 *
 * La règle dure du §11 qui concerne ce module — « une offre sponsorisée porte toujours
 * la pastille et n'occupe jamais plus de 2 emplacements de tête » — a deux moitiés, et
 * chacune a son test : la BORNE (trois offres mises en avant, deux emplacements) et la
 * PASTILLE (celle qui déborde la garde quand même). Les deux ont été éprouvées en
 * cassant la règle dans le service.
 */
describe('emploi (10 §3)', () => {
  let prisma: PrismaService;
  let jobs: JobsService;

  const createdUsers: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let counter = 0;

  async function member(
    options: { level?: 'L1' | 'L2'; plan?: 'FREE' | 'PREMIUM' } = {},
  ): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `jb${counter}${id.slice(-8)}`,
        displayName: `Membre ${counter}`,
        phase: 'RECENT_ARRIVAL',
        verificationLevel: options.level ?? 'L1',
        originCountryId,
        cityId,
        plan: options.plan ?? 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return id;
  }

  const description =
    'Poste à pourvoir dans une équipe de cinq personnes, formation interne assurée, mutuelle et titres restaurant.';

  async function offer(
    authorUserId: string,
    overrides: Partial<Parameters<JobsService['create']>[1]> = {},
  ) {
    return jobs.create(authorUserId, {
      kind: 'JOB',
      title: 'Développeuse web expérimentée',
      description,
      companyName: 'Atelier Numérique',
      cityId,
      sector: 'Informatique',
      ...overrides,
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    // Lot A : ces bancs vérifient les quotas des plans, donc les plans s'appliquent.
    await reglerMonetisation(prisma, true);
    jobs = new JobsService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
    );

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = country.id;
    const city = await prisma.city.findFirstOrThrow({
      where: { mergedIntoCityId: null },
      select: { id: true },
    });
    cityId = city.id;
  });

  afterAll(async () => {
    await prisma.moderationCase.deleteMany({ where: { subjectAuthorUserId: { in: createdUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await reglerMonetisation(prisma, null);
    await prisma.$disconnect();
  });

  // ── RÈGLE DURE : pastille toujours visible, 2 emplacements au maximum ─────

  it('rule: une offre sponsorisée porte toujours la pastille et n’occupe jamais plus de 2 emplacements de tête', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const sector = `Secteur-${newId().slice(-8)}`;

    const sponsoredIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const job = await offer(author, { title: `Offre mise en avant ${index + 1}`, sector });
      await jobs.sponsor(job.id, author);
      sponsoredIds.push(job.id);
    }
    const plain = await offer(author, { title: 'Offre ordinaire du même secteur', sector });

    const list = await jobs.list({ limit: 20, scope: 'all', sector }, null);

    // La BORNE : deux emplacements de tête, pas trois.
    expect(list.sponsored).toHaveLength(JOB_SPONSORED_HEAD_SLOTS);
    // Aucune offre en double entre la tête et le corps : un doublon serait un
    // troisième emplacement déguisé.
    const headIds = list.sponsored.map((card) => card.id);
    for (const id of headIds) expect(list.items.map((item) => item.id)).not.toContain(id);

    // La PASTILLE : la troisième sponsorisée est dans le corps de liste, et elle la
    // porte quand même. C'est la moitié de la règle qu'on oublie.
    const overflow = list.items.find((item) => sponsoredIds.includes(item.id));
    expect(overflow).toBeDefined();
    expect(overflow?.isSponsored).toBe(true);
    expect(overflow?.sponsoredLabel).toBe(JOB_SPONSORED_LABEL);

    // Et TOUTE carte sponsorisée, où qu'elle soit, porte la pastille.
    for (const card of [...list.sponsored, ...list.items]) {
      expect(card.isSponsored ? card.sponsoredLabel : null).toBe(
        card.isSponsored ? JOB_SPONSORED_LABEL : null,
      );
    }
    const ordinary = list.items.find((item) => item.id === plain.id);
    expect(ordinary?.isSponsored).toBe(false);
    expect(ordinary?.sponsoredLabel).toBeNull();
  });

  it('[lot E2] meta.total compte la recherche entière — tête sponsorisée comprise, sans décroître de page en page', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const sector = `Total-${newId().slice(-8)}`;
    const ids: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      ids.push((await offer(author, { title: `Offre comptée ${index + 1}`, sector })).id);
    }
    await jobs.sponsor(ids[0]!, author);

    const premiere = await jobs.list({ limit: 2, scope: 'all', sector }, null);
    // 1 en tête + 2 dans la page, mais le total est celui de la RECHERCHE : 5.
    expect(premiere.sponsored).toHaveLength(1);
    expect(premiere.meta.total).toBe(5);
    expect(premiere.nextCursor).not.toBeNull();

    // La page suivante ne fait pas baisser le total (keyset exclu du comptage).
    const seconde = await jobs.list(
      { limit: 2, scope: 'all', sector, cursor: premiere.nextCursor as string },
      null,
    );
    expect(seconde.meta.total).toBe(5);

    // Un autre secteur ne compte pas ; une offre retirée ne compte plus.
    expect((await jobs.list({ limit: 2, scope: 'all', sector: 'Inconnu-xyz' }, null)).meta.total).toBe(0);
    await jobs.remove(ids[4]!, author);
    expect((await jobs.list({ limit: 2, scope: 'all', sector }, null)).meta.total).toBe(4);

    // « Mes annonces » compte les offres de l'auteur, expirées comprises, hors retirées.
    expect((await jobs.list({ limit: 2, scope: 'mine', sector }, author)).meta.total).toBe(4);
  });

  it('la tête n’existe que sur la première page : une page suivante n’offre pas deux emplacements de plus', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const sector = `Secteur-${newId().slice(-8)}`;
    for (let index = 0; index < 2; index += 1) {
      const job = await offer(author, { title: `Mise en avant ${index + 1}`, sector });
      await jobs.sponsor(job.id, author);
    }
    for (let index = 0; index < 3; index += 1) {
      await offer(author, { title: `Offre ordinaire ${index + 1}`, sector });
    }

    const first = await jobs.list({ limit: 2, scope: 'all', sector }, null);
    expect(first.sponsored).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await jobs.list(
      { limit: 2, scope: 'all', sector, cursor: first.nextCursor as string },
      null,
    );
    expect(second.sponsored).toHaveLength(0);
  });

  it('une mise en avant échue cesse d’être annoncée, même si la colonne dit encore le contraire', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const job = await offer(author);
    await jobs.sponsor(job.id, author);

    // La tâche `sponsored.expire` a du retard : `is_sponsored` reste vrai.
    await prisma.jobListing.update({
      where: { id: job.id },
      data: { sponsoredUntil: new Date(Date.now() - 1000) },
    });

    const detail = await jobs.detail(job.id, null);
    expect(detail.isSponsored).toBe(false);
    expect(detail.sponsoredLabel).toBeNull();

    const list = await jobs.list({ limit: 20, scope: 'all', sector: 'Informatique' }, null);
    expect(list.sponsored.map((card) => card.id)).not.toContain(job.id);

    // Et la tâche, quand elle passe, nettoie sans rien changer à l'affichage.
    expect(await jobs.expireSponsorships()).toBeGreaterThanOrEqual(1);
    const row = await prisma.jobListing.findUniqueOrThrow({
      where: { id: job.id },
      select: { isSponsored: true },
    });
    expect(row.isSponsored).toBe(false);
  });

  // ── Mise en avant : plan et quota (§3.1) ──────────────────────────────────

  it('la mise en avant est réservée à Premium ; publier reste gratuit', async () => {
    const free = await member({ plan: 'FREE' });
    const job = await offer(free);
    // Publier a fonctionné : c'est la MISE EN AVANT qui est payante, pas l'offre.
    expect(job.id).toBeTruthy();
    expect(job.sharedBy).toContain('Partagée par');

    await expect(jobs.sponsor(job.id, free)).rejects.toMatchObject({
      response: { error: { code: 'PLAN_LIMIT_REACHED', details: { max: 0 } } },
    });
  });

  it('[TOUT GRATUIT] un membre gratuit met une offre en avant', async () => {
    await reglerMonetisation(prisma, false);
    try {
      const free = await member({ plan: 'FREE' });
      const job = await offer(free);
      await expect(jobs.sponsor(job.id, free)).resolves.toBeDefined();
    } finally {
      await reglerMonetisation(prisma, true);
    }
  });

  it('au plus cinq mises en avant par membre et par mois', async () => {
    const author = await member({ plan: 'PREMIUM' });
    for (let index = 0; index < FREE_SPONSORED_JOBS_PER_MONTH; index += 1) {
      const job = await offer(author, { title: `Offre à mettre en avant ${index + 1}` });
      await jobs.sponsor(job.id, author);
    }

    const extra = await offer(author, { title: 'Offre au-delà du quota mensuel' });
    await expect(jobs.sponsor(extra.id, author)).rejects.toMatchObject({
      response: {
        error: { code: 'SPONSORED_LIMIT', details: { max: FREE_SPONSORED_JOBS_PER_MONTH } },
      },
    });
  });

  it('remettre en avant une offre déjà mise en avant est refusé', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const job = await offer(author);
    await jobs.sponsor(job.id, author);
    await expect(jobs.sponsor(job.id, author)).rejects.toMatchObject({
      response: { error: { code: 'ALREADY_SPONSORED' } },
    });
  });

  it('la mise en avant dure quatorze jours et émet job.sponsored avec sa cible', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const job = await offer(author, { sector: 'Restauration' });
    const sponsored = await jobs.sponsor(job.id, author);

    const expected = Date.now() + JOB_SPONSORED_DAYS * 86_400_000;
    expect(Math.abs((sponsored.sponsoredUntil as Date).getTime() - expected)).toBeLessThan(60_000);

    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { type: 'job.sponsored', aggregateId: job.id },
      select: { payload: true },
    });
    expect(event.payload).toMatchObject({ sector: 'Restauration', cityId });
  });

  // ── Cycle de vie (§3.1) ───────────────────────────────────────────────────

  it('une offre vit quarante-cinq jours et ne se renouvelle pas tout de suite', async () => {
    const author = await member();
    const job = await offer(author);
    const expected = Date.now() + JOB_LIFETIME_DAYS * 86_400_000;
    expect(Math.abs(job.expiresAt.getTime() - expected)).toBeLessThan(60_000);

    await expect(jobs.renew(job.id, author)).rejects.toMatchObject({
      response: { error: { code: 'RENEW_TOO_SOON' } },
    });

    await prisma.jobListing.update({
      where: { id: job.id },
      data: { expiresAt: new Date(Date.now() + 5 * 86_400_000) },
    });
    const renewed = await jobs.renew(job.id, author);
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(job.expiresAt.getTime());
  });

  it('la tâche d’expiration est idempotente', async () => {
    const author = await member();
    const job = await offer(author);
    await prisma.jobListing.update({
      where: { id: job.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await jobs.expireDueJobs()).toBeGreaterThanOrEqual(1);
    await jobs.expireDueJobs();
    const row = await prisma.jobListing.findUniqueOrThrow({
      where: { id: job.id },
      select: { status: true },
    });
    expect(row.status).toBe('EXPIRED');
    // Une offre expirée n'est plus lisible par un tiers.
    await expect(jobs.detail(job.id, null)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
  });

  it('l’offre d’un membre bloqué disparaît, et le filtre de secteur ne la ramène pas', async () => {
    const reader = await member();
    const blockedAuthor = await member();
    const sector = `Secteur-${newId().slice(-8)}`;
    const hidden = await offer(blockedAuthor, { sector, title: 'Offre d’un membre bloqué' });
    const visibleAuthor = await member();
    const shown = await offer(visibleAuthor, { sector, title: 'Offre visible du secteur' });

    await prisma.block.create({
      data: { id: newId(), blockerUserId: blockedAuthor, blockedUserId: reader },
    });

    const list = await jobs.list({ limit: 20, scope: 'all', sector }, reader);
    const ids = list.items.map((item) => item.id);
    expect(ids).toContain(shown.id);
    expect(ids).not.toContain(hidden.id);
    await expect(jobs.detail(hidden.id, reader)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
  });

  it('la recherche plein texte et le blocage s’appliquent ENSEMBLE', async () => {
    const reader = await member();
    const blockedAuthor = await member();
    const visibleAuthor = await member();
    const token = `Boulangerie${newId().slice(-6)}`;

    const hidden = await offer(blockedAuthor, { title: `Vendeur ${token} matin` });
    const shown = await offer(visibleAuthor, { title: `Pâtissier ${token} soir` });

    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader, blockedUserId: blockedAuthor },
    });

    const list = await jobs.list({ limit: 20, scope: 'all', q: token }, reader);
    const ids = list.items.map((item) => item.id);
    expect(ids).toEqual([shown.id]);
    expect(ids).not.toContain(hidden.id);
  });

  it('une offre qui demande des frais d’inscription ouvre un dossier de priorité 1', async () => {
    const author = await member();
    const job = await offer(author, {
      description:
        'Poste ouvert à tous. Des frais d’inscription de 80 euros sont demandés à la signature, formation payante obligatoire ensuite.',
    });

    const moderation = await prisma.moderationCase.findFirstOrThrow({
      where: { subjectType: 'JOB', subjectId: job.id },
      select: { priority: true, aiLabels: true, source: true },
    });
    expect(moderation).toMatchObject({ priority: 1, source: 'AI' });
    expect(moderation.aiLabels).toContain('MONEY_REQUEST');

    // Un second passage (modification) ne duplique pas le dossier.
    await jobs.update(job.id, author, { title: 'Poste ouvert à tous, débutants acceptés' });
    const count = await prisma.moderationCase.count({
      where: { subjectType: 'JOB', subjectId: job.id },
    });
    expect(count).toBe(1);
  });

  it('[11 §2.5] chaque modification, renouvellement et retrait émet job.updated pour la réindexation', async () => {
    const author = await member();
    const job = await offer(author, {});
    await jobs.update(job.id, author, { title: 'Titre corrigé pour la recherche' });
    const events = await prisma.domainEvent.findMany({
      where: { type: 'job.updated', aggregateId: job.id },
      select: { payload: true },
    });
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0]?.payload)).toContain('title');

    await jobs.remove(job.id, author);
    expect(await prisma.domainEvent.count({ where: { type: 'job.updated', aggregateId: job.id } })).toBe(2);
  });

  // ── Profils disponibles (§3.2) ────────────────────────────────────────────

  it('un profil de recherche invisible n’apparaît pour personne, filtre compris', async () => {
    const seeker = await member();
    const reader = await member();
    await jobs.putJobSeekerProfile(seeker, {
      headline: 'Développeuse web, disponible septembre',
      sectors: ['Informatique'],
      contractTypes: ['CDI'],
      isVisible: false,
    });

    const list = await jobs.listJobSeekers({ limit: 50, sector: 'Informatique' }, reader);
    expect((list.items as { id: string }[]).map((item) => item.id)).not.toContain(seeker);

    await jobs.putJobSeekerProfile(seeker, {
      headline: 'Développeuse web, disponible septembre',
      sectors: ['Informatique'],
      contractTypes: ['CDI'],
      isVisible: true,
    });
    const visible = await jobs.listJobSeekers({ limit: 50, sector: 'Informatique' }, reader);
    expect((visible.items as { id: string }[]).map((item) => item.id)).toContain(seeker);
  });

  it('aucun champ de CV n’existe sur un profil de recherche (§3.2)', async () => {
    const seeker = await member();
    const profile = await jobs.putJobSeekerProfile(seeker, {
      headline: 'Cuisinier, disponible immédiatement',
      sectors: ['Restauration'],
      contractTypes: ['CDD'],
      isVisible: true,
    });
    const serialized = JSON.stringify(profile).toLowerCase();
    for (const forbidden of ['cv', 'resume', 'assetid']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('le profil d’un membre bloqué n’apparaît pas dans les profils disponibles', async () => {
    const seeker = await member();
    const reader = await member();
    await jobs.putJobSeekerProfile(seeker, {
      headline: 'Aide-soignante, disponible en octobre',
      sectors: ['Santé'],
      contractTypes: ['CDI'],
      isVisible: true,
    });
    await prisma.block.create({
      data: { id: newId(), blockerUserId: seeker, blockedUserId: reader },
    });
    const list = await jobs.listJobSeekers({ limit: 50, sector: 'Santé' }, reader);
    expect((list.items as { id: string }[]).map((item) => item.id)).not.toContain(seeker);
  });

  // ── Recommander un membre (§3.3) ──────────────────────────────────────────

  it('recommander un membre le compte sur son profil, sans effet de réputation', async () => {
    const author = await member();
    const recommender = await member();
    const recommended = await prisma.user.findUniqueOrThrow({
      where: { id: await member() },
      select: { id: true, handle: true },
    });
    const job = await offer(author, { title: 'Poste à pourvoir, recommandations bienvenues' });

    const created = await jobs.recommendMember(recommender, {
      toHandle: recommended.handle,
      jobId: job.id,
      comment: 'Nous avons travaillé ensemble pendant deux ans, très fiable.',
    });
    expect(created.id).toBeTruthy();

    const profile = await jobs.recommendationsFor(recommended.handle, null);
    expect(profile.count).toBe(1);

    // §3.3 : « Aucun effet de réputation en V1. »
    const reputation = await prisma.reputationEvent.count({
      where: { userId: recommended.id },
    });
    expect(reputation).toBe(0);

    // L'auteur de l'offre est la cible de la notification, portée par l'événement.
    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { type: 'member.recommended', aggregateId: created.id },
      select: { payload: true },
    });
    expect(event.payload).toMatchObject({ notifyUserId: author });

    // Deux fois pour la même offre : refusé.
    await expect(
      jobs.recommendMember(recommender, { toHandle: recommended.handle, jobId: job.id }),
    ).rejects.toMatchObject({ response: { error: { code: 'ALREADY_RECOMMENDED' } } });
  });

  it('on ne se recommande pas soi-même, et pas un membre dont on est séparé', async () => {
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: await member() },
      select: { id: true, handle: true },
    });
    await expect(
      jobs.recommendMember(me.id, { toHandle: me.handle }),
    ).rejects.toMatchObject({ response: { error: { code: 'SELF_RECOMMENDATION' } } });

    const other = await prisma.user.findUniqueOrThrow({
      where: { id: await member() },
      select: { id: true, handle: true },
    });
    await prisma.block.create({
      data: { id: newId(), blockerUserId: other.id, blockedUserId: me.id },
    });
    await expect(
      jobs.recommendMember(me.id, { toHandle: other.handle }),
    ).rejects.toMatchObject({ response: { error: { code: 'NOT_FOUND' } } });
  });

  it('les recommandations d’un membre bloqué ne s’affichent pas sur le profil', async () => {
    const reader = await member();
    const recommender = await member();
    const subject = await prisma.user.findUniqueOrThrow({
      where: { id: await member() },
      select: { id: true, handle: true },
    });
    await jobs.recommendMember(recommender, {
      toHandle: subject.handle,
      comment: 'Collègue sérieux et ponctuel, je le recommande.',
    });

    expect((await jobs.recommendationsFor(subject.handle, reader)).count).toBe(1);
    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader, blockedUserId: recommender },
    });
    expect((await jobs.recommendationsFor(subject.handle, reader)).count).toBe(0);
  });

  it('aucune réponse du module n’emploie un mot interdit (règle dure 01 §1.2)', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const job = await offer(author);
    await jobs.sponsor(job.id, author);
    const list = await jobs.list({ limit: 20, scope: 'all' }, author);
    expect(containsForbiddenWord(JSON.stringify(list))).toBe(false);
  });

  // ── Suppression de compte (§10) ───────────────────────────────────────────

  it('la suppression d’un compte retire offres, profil de recherche et recommandations', async () => {
    const author = await member();
    const peer = await prisma.user.findUniqueOrThrow({
      where: { id: await member() },
      select: { id: true, handle: true },
    });
    const job = await offer(author);
    await jobs.putJobSeekerProfile(author, {
      headline: 'Serveur, disponible le week-end',
      sectors: ['Restauration'],
      contractTypes: ['Extra'],
      isVisible: true,
    });
    await jobs.recommendMember(author, {
      toHandle: peer.handle,
      comment: 'Très bon contact, je recommande sans réserve.',
    });

    await jobs.handleUserDeleted(author);
    await jobs.handleUserDeleted(author);

    expect(await prisma.jobListing.count({ where: { id: job.id } })).toBe(0);
    expect(await prisma.jobSeekerProfile.count({ where: { userId: author } })).toBe(0);
    expect(await prisma.memberRecommendation.count({ where: { fromUserId: author } })).toBe(0);
  });
});
