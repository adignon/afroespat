import { reglerMonetisation } from '../../../common/__tests__/monetisation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  HOUSING_LIFETIME_DAYS,
  HOUSING_RENEW_INTERVAL_DAYS,
  HOUSING_SAFETY_BANNER,
  MAX_ACTIVE_HOUSING_LISTINGS,
  containsForbiddenWord,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { HousingService } from '../housing.service';

/**
 * Logement — 10-services.md §2 et §11.
 *
 * Les cinq règles dures du §11 qui concernent le logement ont chacune leur test, et
 * chacun a été éprouvé en CASSANT la règle dans le service : un test qui passe aussi
 * avec le bogue ne protège rien. Ce qui a été trouvé ainsi est noté dans le rapport.
 *
 * Les tests appellent le SERVICE et non HTTP : la capacité `housing.publish` est
 * l'affaire du garde, vérifiée par capability-coverage.int.test.ts. Le service
 * REVÉRIFIE le niveau, et c'est ce contrôle-là — celui qui tient même sans
 * décorateur — que le premier test éprouve.
 */
describe('logement (10 §2)', () => {
  let prisma: PrismaService;
  let housing: HousingService;

  const createdUsers: string[] = [];
  const createdAssets: string[] = [];
  const createdConversations: string[] = [];

  let originCountryId: string;
  let cityId: string;
  let otherCityId: string;
  let counter = 0;

  async function member(
    options: { level?: 'L0' | 'L1' | 'L2'; plan?: 'FREE' | 'PREMIUM'; createdAt?: Date } = {},
  ): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `hs${counter}${id.slice(-8)}`,
        displayName: `Membre ${counter}`,
        phase: 'RECENT_ARRIVAL',
        verificationLevel: options.level ?? 'L2',
        originCountryId,
        cityId,
        plan: options.plan ?? 'FREE',
        status: 'ACTIVE',
        ...(options.createdAt === undefined ? {} : { createdAt: options.createdAt }),
      },
    });
    createdUsers.push(id);
    return id;
  }

  /** Un média de logement appartenant au membre — sans quoi la publication refuse. */
  async function photo(ownerUserId: string): Promise<string> {
    const id = newId();
    await prisma.mediaAsset.create({
      data: {
        id,
        ownerUserId,
        kind: 'HOUSING',
        storageKey: `test/housing/${id}.jpg`,
        mime: 'image/jpeg',
        sizeBytes: BigInt(1024),
        status: 'READY',
      },
    });
    createdAssets.push(id);
    return id;
  }

  /** Une description propre : ni lien, ni email, ni numéro, ni terme d'arnaque. */
  const cleanDescription =
    'Studio lumineux au calme, cuisine équipée, proche des transports et des commerces. Visite possible en semaine et le samedi matin.';

  async function publish(
    authorUserId: string,
    overrides: Partial<Parameters<HousingService['create']>[1]> = {},
  ) {
    return housing.create(authorUserId, {
      kind: 'RENT',
      title: 'Studio meublé proche centre',
      description: cleanDescription,
      cityId,
      priceCents: 65_000,
      photoAssetIds: [await photo(authorUserId)],
      ...overrides,
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    // Lot A : ces bancs vérifient les quotas des plans, donc les plans s'appliquent.
    await reglerMonetisation(prisma, true);
    housing = new HousingService(
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

    const cities = await prisma.city.findMany({
      where: { mergedIntoCityId: null },
      select: { id: true, slug: true },
      orderBy: { slug: 'asc' },
      take: 2,
    });
    if (cities.length < 2) throw new Error('Référentiel de villes trop pauvre.');
    cityId = (cities[0] as { id: string }).id;
    otherCityId = (cities[1] as { id: string }).id;
  });

  afterAll(async () => {
    // Les annonces, photos, alertes et adhésions de conversation partent en cascade
    // avec les membres ; les dossiers de modération (SetNull) et les conversations
    // (sans clé vers users) ne partent pas, donc on les retire explicitement.
    await prisma.moderationCase.deleteMany({ where: { subjectAuthorUserId: { in: createdUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: createdAssets } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversations } } });
    await reglerMonetisation(prisma, null);
    await prisma.$disconnect();
  });

  // ── RÈGLE DURE : publication réservée au L2 (§2.1, §11) ───────────────────

  it('rule: une annonce logement ne peut être créée qu’en L2', async () => {
    for (const level of ['L0', 'L1'] as const) {
      const user = await member({ level });
      await expect(publish(user)).rejects.toMatchObject({
        response: { error: { code: 'LEVEL_REQUIRED' } },
      });
    }

    const verified = await member({ level: 'L2' });
    const listing = await publish(verified);
    expect(listing.id).toBeTruthy();
  });

  it('une RECHERCHE de logement exige aussi L2 — « on ne met en relation que des personnes présentes »', async () => {
    const user = await member({ level: 'L1' });
    await expect(
      publish(user, { kind: 'SEEKING_HOUSING', priceCents: null, photoAssetIds: [] }),
    ).rejects.toMatchObject({ response: { error: { code: 'LEVEL_REQUIRED' } } });
  });

  it('l’explication du refus accompagne le 403 : un refus sans explication n’aide personne', async () => {
    const user = await member({ level: 'L1' });
    await expect(publish(user)).rejects.toMatchObject({
      response: {
        error: {
          code: 'LEVEL_REQUIRED',
          details: { requiredLevel: 'L2', capability: 'housing.publish' },
        },
      },
    });
  });

  // ── RÈGLE DURE : le bandeau de sécurité (§2.2, §11) ───────────────────────

  it('rule: le bandeau de sécurité est présent dans chaque réponse de liste et de détail logement', async () => {
    const author = await member();
    const listing = await publish(author);

    const list = await housing.list({ limit: 20, radiusKm: 30, sort: 'date', scope: 'all' }, null);
    expect(list.meta?.['safetyBanner']).toBe(HOUSING_SAFETY_BANNER);

    const detail = await housing.detail(listing.id, null);
    expect(detail.safetyBanner).toBe(HOUSING_SAFETY_BANNER);

    // Même sur une liste VIDE : c'est le cas où l'on oublie le plus facilement le
    // bandeau, et c'est aussi celui où un membre arrive en premier sur la section.
    const empty = await housing.list(
      { limit: 20, radiusKm: 0, sort: 'date', scope: 'all', cityId: otherCityId },
      null,
    );
    expect(empty.items).toHaveLength(0);
    expect(empty.meta?.['safetyBanner']).toBe(HOUSING_SAFETY_BANNER);
  });

  it('le bandeau et l’explication de niveau n’emploient aucun mot interdit (règle dure 01 §1.2)', async () => {
    const author = await member();
    const listing = await publish(author);
    const detail = await housing.detail(listing.id, null);
    expect(containsForbiddenWord(JSON.stringify(detail))).toBe(false);

    const list = await housing.list({ limit: 20, radiusKm: 30, sort: 'date', scope: 'all' }, null);
    expect(containsForbiddenWord(JSON.stringify(list.meta))).toBe(false);
  });

  // ── RÈGLE DURE : score ≥ 0,7 jamais publié (§2.2, §11) ────────────────────

  it('rule: une annonce à score ≥ 0,7 n’est jamais publiée sans décision humaine', async () => {
    const author = await member();
    const reader = await member();

    // 0,1 (première annonce) + 0,2 (L2 récent) + 0,4 (termes d'arnaque) = 0,7.
    const scam =
      'Bel appartement libre tout de suite. Réservation par virement d’un acompte de deux mois, remise des clés sans visite préalable.';

    let listingId: string | undefined;
    await expect(
      publish(author, { description: scam }).catch((error: unknown) => {
        const body = (error as { response?: { error?: { details?: { listingId?: string } } } })
          .response?.error?.details;
        listingId = body?.listingId;
        throw error;
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'LISTING_UNDER_REVIEW' } } });

    expect(listingId).toBeTruthy();
    const row = await prisma.housingListing.findUniqueOrThrow({
      where: { id: listingId as string },
      select: { moderationStatus: true, riskScore: true, riskFlags: true },
    });
    // L'annonce EXISTE (§2.2 : dossier de modération, auteur informé) mais n'est pas
    // publiée : c'est `moderation_status` qui porte la retenue, faute de statut dédié.
    expect(row.moderationStatus).toBe('PENDING');
    expect(Number(row.riskScore)).toBeGreaterThanOrEqual(0.7);
    expect(row.riskFlags).toContain('SCAM_TERMS');

    // Invisible pour un autre lecteur, en liste comme en détail.
    const list = await housing.list({ limit: 50, radiusKm: 30, sort: 'date', scope: 'all' }, reader);
    expect(list.items.map((item) => item.id)).not.toContain(listingId);
    await expect(housing.detail(listingId as string, reader)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });

    // Un dossier de modération de priorité 1 attend un humain (§2.2).
    const moderation = await prisma.moderationCase.findFirstOrThrow({
      where: { subjectType: 'HOUSING', subjectId: listingId as string },
      select: { priority: true, source: true, aiVerdict: true },
    });
    expect(moderation).toMatchObject({ priority: 1, source: 'RISK_SCORE', aiVerdict: 'BLOCK' });

    // Et AUCUN `housing.published` : sans quoi l'indexation et les alertes
    // proposeraient une annonce que personne n'a relue.
    const published = await prisma.domainEvent.count({
      where: { type: 'housing.published', aggregateId: listingId as string },
    });
    expect(published).toBe(0);
  });

  it('l’auteur voit sa propre annonce retenue, marquée « en vérification »', async () => {
    const author = await member();
    const scam =
      'Chambre disponible immédiatement, aucun dossier demandé. Envoyez un acompte par mandat pour bloquer la place, sans visite.';
    await expect(publish(author, { description: scam })).rejects.toMatchObject({
      response: { error: { code: 'LISTING_UNDER_REVIEW' } },
    });

    const mine = await housing.list(
      { limit: 20, radiusKm: 30, sort: 'date', scope: 'mine' },
      author,
    );
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]?.reviewState).toBe('UNDER_REVIEW');
  });

  it('modifier une annonce retenue ne la libère pas — sinon il suffirait d’éditer une virgule', async () => {
    const author = await member();
    let listingId = '';
    await publish(author, {
      description:
        'Studio à saisir, paiement de l’acompte par virement avant la remise des clés, sans visite possible cette semaine.',
    }).catch((error: unknown) => {
      listingId =
        (error as { response: { error: { details: { listingId: string } } } }).response.error.details
          .listingId;
    });
    expect(listingId).toBeTruthy();

    // Une description parfaitement propre : le score retombe sous 0,4…
    await housing.update(listingId, author, { description: cleanDescription });
    const row = await prisma.housingListing.findUniqueOrThrow({
      where: { id: listingId },
      select: { moderationStatus: true, riskScore: true },
    });
    // …mais la retenue reste : seule une décision humaine la lève.
    expect(Number(row.riskScore)).toBeLessThan(0.4);
    expect(row.moderationStatus).toBe('PENDING');
  });

  it('un score entre 0,4 et 0,7 publie l’annonce, avec un rappel renforcé et un dossier de priorité 2', async () => {
    const author = await member();
    // 0,1 + 0,2 + 0,2 (numéro dans la description) = 0,5.
    const withPhone = `${cleanDescription} Vous pouvez me joindre au 06 12 34 56 78.`;
    const listing = await publish(author, { description: withPhone });

    expect(listing.cautionLevel).toBe('REINFORCED');
    const detail = await housing.detail(listing.id, null);
    expect(detail.id).toBe(listing.id);

    const moderation = await prisma.moderationCase.findFirstOrThrow({
      where: { subjectType: 'HOUSING', subjectId: listing.id },
      select: { priority: true, aiVerdict: true },
    });
    expect(moderation).toMatchObject({ priority: 2, aiVerdict: 'QUEUE' });
  });

  it('un score sous 0,4 publie sans rappel renforcé ni dossier', async () => {
    const author = await member();
    const first = await publish(author);
    // La première annonce porte 0,1 + 0,2 (L2 récent) = 0,3 : publiée, rappel standard.
    expect(first.cautionLevel).toBe('STANDARD');
    const cases = await prisma.moderationCase.count({
      where: { subjectType: 'HOUSING', subjectId: first.id },
    });
    expect(cases).toBe(0);
  });

  it('ni le score, ni les drapeaux, ni les compteurs ne sortent de l’API (règle dure 01 §1.2)', async () => {
    const author = await member();
    const listing = await publish(author);
    await housing.detail(listing.id, author);
    const detail = await housing.detail(listing.id, author);
    const serialized = JSON.stringify(detail);

    for (const forbidden of ['riskScore', 'riskFlags', 'viewCount', 'contactCount']) {
      expect(serialized).not.toContain(forbidden);
    }
    // Le compteur de vues a bien été incrémenté en base : il existe, il est interne.
    const row = await prisma.housingListing.findUniqueOrThrow({
      where: { id: listing.id },
      select: { viewCount: true },
    });
    expect(row.viewCount).toBeGreaterThanOrEqual(2);
  });

  // ── Quota et cycle de vie (§2.1) ──────────────────────────────────────────

  it('trois annonces actives au maximum, et une annonce « trouvée » libère un créneau', async () => {
    const author = await member();
    const ids: string[] = [];
    for (let index = 0; index < MAX_ACTIVE_HOUSING_LISTINGS; index += 1) {
      const listing = await publish(author, { title: `Annonce numéro ${index + 1} à louer` });
      ids.push(listing.id);
    }

    await expect(publish(author)).rejects.toMatchObject({
      response: { error: { code: 'MAX_ACTIVE_LISTINGS', details: { max: 3 } } },
    });

    await housing.setStatus(ids[0] as string, author, 'TAKEN');
    const fourth = await publish(author, { title: 'Quatrième annonce après libération' });
    expect(fourth.id).toBeTruthy();
  });

  it('une annonce retenue en vérification occupe quand même un créneau', async () => {
    const author = await member();
    await publish(author, { title: 'Première annonce de ce membre' });
    await publish(author, { title: 'Deuxième annonce de ce membre' });
    await expect(
      publish(author, {
        title: 'Troisième annonce suspecte',
        // 0,2 (L2 récent) + 0,4 (termes d'arnaque) + 0,2 (numéro dans la description)
        // = 0,8. `FIRST_LISTING` ne compte plus : ce n'est pas la première.
        description:
          'Logement libre, acompte par virement demandé avant toute visite, remise des clés sans visite. Appelez le 06 12 34 56 78.',
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'LISTING_UNDER_REVIEW' } } });

    await expect(publish(author, { title: 'Quatrième annonce refusée' })).rejects.toMatchObject({
      response: { error: { code: 'MAX_ACTIVE_LISTINGS' } },
    });
  });

  it('renouveler trop tôt est refusé, et possible une fois la fenêtre ouverte', async () => {
    const author = await member();
    const listing = await publish(author);

    // Fraîchement publiée : expiration à +60 j, donc bien au-delà des 30 j de marge.
    expect(listing.canRenew).toBe(false);
    await expect(housing.renew(listing.id, author)).rejects.toMatchObject({
      response: { error: { code: 'RENEW_TOO_SOON' } },
    });

    // On rapproche l'expiration : c'est ainsi qu'on simule une annonce vieille de
    // 35 jours, `renewed_at` n'existant pas dans le schéma figé.
    const soon = new Date(Date.now() + 10 * 86_400_000);
    await prisma.housingListing.update({ where: { id: listing.id }, data: { expiresAt: soon } });

    const renewed = await housing.renew(listing.id, author);
    const expectedMs = Date.now() + HOUSING_LIFETIME_DAYS * 86_400_000;
    expect(Math.abs(renewed.expiresAt.getTime() - expectedMs)).toBeLessThan(60_000);
    // Et la fenêtre se referme aussitôt : un renouvellement par 30 jours, pas deux.
    await expect(housing.renew(listing.id, author)).rejects.toMatchObject({
      response: { error: { code: 'RENEW_TOO_SOON' } },
    });
    expect(HOUSING_RENEW_INTERVAL_DAYS).toBe(30);
  });

  it('une annonce expirée redevient active en se renouvelant ; une annonce en pause reste en pause', async () => {
    const author = await member();
    const listing = await publish(author);
    await prisma.housingListing.update({
      where: { id: listing.id },
      data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 86_400_000) },
    });
    const renewed = await housing.renew(listing.id, author);
    expect(renewed.status).toBe('ACTIVE');

    const paused = await publish(author, { title: 'Annonce mise en pause ensuite' });
    await housing.setStatus(paused.id, author, 'PAUSED');
    await prisma.housingListing.update({
      where: { id: paused.id },
      data: { expiresAt: new Date(Date.now() + 5 * 86_400_000) },
    });
    const renewedPaused = await housing.renew(paused.id, author);
    expect(renewedPaused.status).toBe('PAUSED');
  });

  it('la tâche d’expiration est idempotente et émet housing.expired', async () => {
    const author = await member();
    const listing = await publish(author);
    await prisma.housingListing.update({
      where: { id: listing.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await housing.expireDueListings()).toBeGreaterThanOrEqual(1);
    const events = await prisma.domainEvent.count({
      where: { type: 'housing.expired', aggregateId: listing.id },
    });
    expect(events).toBe(1);

    // Second passage : plus rien à faire, et surtout pas un second événement.
    await housing.expireDueListings();
    const again = await prisma.domainEvent.count({
      where: { type: 'housing.expired', aggregateId: listing.id },
    });
    expect(again).toBe(1);
  });

  // ── Contact (§2.3) ────────────────────────────────────────────────────────

  it('un L0 ne peut pas contacter, et l’erreur l’oriente vers le parrainage', async () => {
    const author = await member();
    const listing = await publish(author);
    const predeparture = await member({ level: 'L0' });

    await expect(housing.contact(listing.id, predeparture)).rejects.toMatchObject({
      response: { error: { code: 'LEVEL_REQUIRED', details: { suggestMentorship: true } } },
    });
    // …mais il peut LIRE (§2.3).
    const detail = await housing.detail(listing.id, predeparture);
    expect(detail.id).toBe(listing.id);
  });

  it('contacter ouvre une conversation unique, et recontacter la réutilise', async () => {
    const author = await member();
    const listing = await publish(author);
    const reader = await member({ level: 'L1' });

    const first = await housing.contact(listing.id, reader);
    createdConversations.push(first.conversationId);
    const second = await housing.contact(listing.id, reader);
    expect(second.conversationId).toBe(first.conversationId);

    const members = await prisma.conversationMember.findMany({
      where: { conversationId: first.conversationId },
      select: { userId: true },
    });
    expect(members.map((m) => m.userId).sort()).toEqual([author, reader].sort());

    const row = await prisma.housingListing.findUniqueOrThrow({
      where: { id: listing.id },
      select: { contactCount: true },
    });
    expect(row.contactCount).toBe(2);
    expect(first.safetyBanner).toBe(HOUSING_SAFETY_BANNER);
  });

  it('un blocage, dans un sens ou l’autre, rend l’annonce inexistante', async () => {
    const author = await member();
    const listing = await publish(author);
    const reader = await member({ level: 'L1' });

    // Le BLOQUÉ bloque : la séparation vaut dans les deux sens (08 §4).
    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader, blockedUserId: author },
    });

    await expect(housing.detail(listing.id, reader)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
    await expect(housing.contact(listing.id, reader)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
    const list = await housing.list({ limit: 50, radiusKm: 30, sort: 'date', scope: 'all' }, reader);
    expect(list.items.map((item) => item.id)).not.toContain(listing.id);
  });

  // ── Recherche : la COMBINAISON des filtres (§2.4) ─────────────────────────

  /**
   * Le piège que deux modules ont payé cher : deux diffusions conditionnelles qui
   * posent la MÊME clé `OR`, la seconde écrasant la première en silence. Ici trois
   * filtres emploient `OR` — la visibilité, le budget et la disponibilité — et un
   * seul test par filtre les aurait tous vus passer.
   */
  it('budget, disponibilité et blocage s’appliquent ENSEMBLE, sans s’écraser', async () => {
    const reader = await member({ level: 'L1' });
    const blockedAuthor = await member();
    // Un auteur par annonce : le quota de trois annonces actives (§2.1) est une vraie
    // règle, et la contourner en base pour peupler un test de recherche aurait masqué
    // sa présence.
    const visibleAuthor = await member();
    const secondAuthor = await member();
    const thirdAuthor = await member();

    // Cinq annonces dans la même ville, toutes candidates par le prix.
    const cheap = await housing.create(visibleAuthor, {
      kind: 'RENT',
      title: 'Petit studio abordable ici',
      description: cleanDescription,
      cityId,
      priceCents: 55_000,
      availableFrom: new Date('2026-01-01T00:00:00.000Z'),
      photoAssetIds: [await photo(visibleAuthor)],
    });
    const free = await housing.create(secondAuthor, {
      kind: 'TEMPORARY',
      title: 'Hébergement solidaire gratuit',
      description: cleanDescription,
      cityId,
      priceCents: null,
      availableFrom: new Date('2026-01-01T00:00:00.000Z'),
      photoAssetIds: [await photo(secondAuthor)],
    });
    const expensive = await housing.create(thirdAuthor, {
      kind: 'RENT',
      title: 'Grand appartement familial',
      description: cleanDescription,
      cityId,
      priceCents: 250_000,
      availableFrom: new Date('2026-01-01T00:00:00.000Z'),
      photoAssetIds: [await photo(thirdAuthor)],
    });
    const hidden = await housing.create(blockedAuthor, {
      kind: 'RENT',
      title: 'Studio d’un membre bloqué',
      description: cleanDescription,
      cityId,
      priceCents: 60_000,
      availableFrom: new Date('2026-01-01T00:00:00.000Z'),
      photoAssetIds: [await photo(blockedAuthor)],
    });
    // Disponible bien plus tard : hors du filtre de date.
    const later = await housing.create(secondAuthor, {
      kind: 'RENT',
      title: 'Disponible seulement plus tard',
      description: cleanDescription,
      cityId,
      priceCents: 58_000,
      availableFrom: new Date('2027-06-01T00:00:00.000Z'),
      photoAssetIds: [await photo(secondAuthor)],
    });

    await prisma.block.create({
      data: { id: newId(), blockerUserId: blockedAuthor, blockedUserId: reader },
    });

    const list = await housing.list(
      {
        limit: 50,
        radiusKm: 0,
        sort: 'date',
        scope: 'all',
        cityId,
        maxPriceCents: 100_000,
        availableFrom: '2026-03-01',
      },
      reader,
    );
    const ids = list.items.map((item) => item.id);

    // Le budget garde l'annonce SANS prix (temporaire gratuite)…
    expect(ids).toContain(free.id);
    expect(ids).toContain(cheap.id);
    // …écarte la trop chère…
    expect(ids).not.toContain(expensive.id);
    // …et la trop tardive…
    expect(ids).not.toContain(later.id);
    // …et le blocage reste appliqué malgré les deux autres filtres. C'est CE point
    // qu'un test par filtre ne voit pas : un `OR` écrasé par le suivant ramène
    // l'annonce du membre bloqué avec un budget parfaitement valide.
    expect(ids).not.toContain(hidden.id);
  });

  it('le filtre de type et le blocage s’appliquent ENSEMBLE', async () => {
    const reader = await member({ level: 'L1' });
    const blockedAuthor = await member();
    const visibleAuthor = await member();

    const wanted = await housing.create(visibleAuthor, {
      kind: 'FLATSHARE',
      title: 'Colocation trois chambres ici',
      description: cleanDescription,
      cityId,
      priceCents: 45_000,
      photoAssetIds: [await photo(visibleAuthor)],
    });
    const blocked = await housing.create(blockedAuthor, {
      kind: 'FLATSHARE',
      title: 'Colocation d’un membre bloqué',
      description: cleanDescription,
      cityId,
      priceCents: 46_000,
      photoAssetIds: [await photo(blockedAuthor)],
    });

    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader, blockedUserId: blockedAuthor },
    });

    const list = await housing.list(
      { limit: 50, radiusKm: 0, sort: 'date', scope: 'all', cityId, kind: 'FLATSHARE' },
      reader,
    );
    const ids = list.items.map((item) => item.id);
    expect(ids).toContain(wanted.id);
    expect(ids).not.toContain(blocked.id);
    expect(list.items.every((item) => item.kind === 'FLATSHARE')).toBe(true);
  });

  it('le tri par prix pagine sans perdre ni répéter une annonce, prix absents en dernier', async () => {
    const reader = await member({ level: 'L1' });
    const expected: string[] = [];
    // Un auteur par annonce, pour rester sous le quota de trois annonces actives.
    for (const price of [90_000, 70_000, null, 80_000, null]) {
      const author = await member();
      const listing = await housing.create(author, {
        kind: 'TEMPORARY',
        title: `Hébergement temporaire à ${price ?? 'titre gracieux'}`,
        description: cleanDescription,
        cityId: otherCityId,
        priceCents: price,
        photoAssetIds: [await photo(author)],
      });
      expected.push(listing.id);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    const prices: (number | null)[] = [];
    for (let page = 0; page < 6; page += 1) {
      const result = await housing.list(
        {
          limit: 2,
          radiusKm: 0,
          sort: 'price',
          scope: 'all',
          cityId: otherCityId,
          ...(cursor === undefined ? {} : { cursor }),
        },
        reader,
      );
      for (const item of result.items) {
        seen.push(item.id);
        prices.push(item.priceCents);
      }
      if (result.nextCursor === null) break;
      cursor = result.nextCursor;
    }

    expect([...seen].sort()).toEqual([...expected].sort());
    expect(new Set(seen).size).toBe(seen.length);
    // Croissant, puis les annonces sans prix à la fin.
    const withPrice = prices.filter((p): p is number => p !== null);
    expect(withPrice).toEqual([...withPrice].sort((a, b) => a - b));
    expect(prices.slice(withPrice.length).every((p) => p === null)).toBe(true);
  });

  it('une photo qui n’appartient pas au membre est refusée', async () => {
    const author = await member();
    const stranger = await member();
    await expect(
      housing.create(author, {
        kind: 'RENT',
        title: 'Annonce avec photo volée',
        description: cleanDescription,
        cityId,
        priceCents: 60_000,
        photoAssetIds: [await photo(stranger)],
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'VALIDATION_FAILED' } } });
  });

  // ── Alertes (§2.4) ────────────────────────────────────────────────────────

  it('[TOUT GRATUIT] un membre gratuit crée une alerte, et la liste dit isPremium', async () => {
    await reglerMonetisation(prisma, false);
    try {
      const free = await member({ level: 'L1', plan: 'FREE' });
      const alert = await housing.createAlert(free, {
        kind: 'HOUSING',
        criteria: { cityId },
        isActive: true,
      });
      expect(alert.isActive).toBe(true);
      expect((await housing.listAlerts(free)).meta['isPremium']).toBe(true);
    } finally {
      await reglerMonetisation(prisma, true);
    }
  });

  it('une alerte est réservée à Premium, et se désactive sans l’être', async () => {
    const free = await member({ level: 'L1', plan: 'FREE' });
    await expect(
      housing.createAlert(free, { kind: 'HOUSING', criteria: { cityId }, isActive: true }),
    ).rejects.toMatchObject({ response: { error: { code: 'PLAN_REQUIRED' } } });

    const premium = await member({ level: 'L1', plan: 'PREMIUM' });
    const alert = await housing.createAlert(premium, {
      kind: 'HOUSING',
      criteria: { cityId, maxPriceCents: 80_000 },
      isActive: true,
    });
    expect(alert.isActive).toBe(true);

    // Rétrogradé : il peut encore désactiver et supprimer — on ne retient personne.
    await prisma.user.update({ where: { id: premium }, data: { plan: 'FREE' } });
    const off = await housing.updateAlert(alert.id, premium, { isActive: false });
    expect(off.isActive).toBe(false);
    await expect(
      housing.updateAlert(alert.id, premium, { isActive: true }),
    ).rejects.toMatchObject({ response: { error: { code: 'PLAN_REQUIRED' } } });
    expect(await housing.deleteAlert(alert.id, premium)).toEqual({ deleted: true });
  });

  it('l’alerte d’un autre membre est introuvable, jamais « interdite »', async () => {
    const owner = await member({ level: 'L1', plan: 'PREMIUM' });
    const other = await member({ level: 'L1', plan: 'PREMIUM' });
    const alert = await housing.createAlert(owner, {
      kind: 'JOB',
      criteria: { sector: 'Informatique' },
      isActive: true,
    });
    await expect(housing.deleteAlert(alert.id, other)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
  });

  // ── Suppression de compte (§10) ───────────────────────────────────────────

  it('la suppression d’un compte retire ses annonces et ses alertes, et se rejoue sans dommage', async () => {
    const author = await member({ plan: 'PREMIUM' });
    const listing = await publish(author);
    await housing.createAlert(author, { kind: 'HOUSING', criteria: { cityId }, isActive: true });

    await housing.handleUserDeleted(author);
    await housing.handleUserDeleted(author);

    expect(await prisma.housingListing.count({ where: { id: listing.id } })).toBe(0);
    expect(await prisma.savedAlert.count({ where: { userId: author } })).toBe(0);
  });
});
