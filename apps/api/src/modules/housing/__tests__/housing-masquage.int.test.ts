import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { hideHousingFromSchema } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { HousingService } from '../housing.service';

/**
 * Logement — « masquer l'annonce à un membre » (10 §2.3, §6.1 :
 * `POST /housing/:id/hide-from`).
 *
 * La règle : un blocage LÉGER et LOCAL. Pour le membre masqué, CETTE annonce
 * n'existe pas (liste, détail, contact) ; ses autres annonces, la messagerie et le
 * profil de l'auteur ne bougent pas. Éprouvé en retirant le filtre de `list` : le
 * test « la liste ne la rend plus » tombe.
 */
describe('logement — masquer une annonce à un membre (10 §2.3)', () => {
  let prisma: PrismaService;
  let housing: HousingService;

  const createdUsers: string[] = [];
  const createdAssets: string[] = [];
  const createdConversations: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let counter = 0;

  async function member(level: 'L0' | 'L1' | 'L2' = 'L2'): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `hm${counter}${id.slice(-8)}`,
        displayName: `Membre ${counter}`,
        phase: 'RECENT_ARRIVAL',
        verificationLevel: level,
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return id;
  }

  async function listing(authorUserId: string): Promise<string> {
    const assetId = newId();
    await prisma.mediaAsset.create({
      data: {
        id: assetId,
        ownerUserId: authorUserId,
        kind: 'HOUSING',
        storageKey: `test/housing/${assetId}.jpg`,
        mime: 'image/jpeg',
        sizeBytes: BigInt(1024),
        status: 'READY',
      },
    });
    createdAssets.push(assetId);
    const created = await housing.create(authorUserId, {
      kind: 'RENT',
      title: 'Studio meublé proche centre',
      description:
        'Studio lumineux au calme, cuisine équipée, proche des transports et des commerces. Visite possible en semaine et le samedi matin.',
      cityId,
      priceCents: 65_000,
      photoAssetIds: [assetId],
    });
    return created.id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    housing = new HousingService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
    );
    originCountryId = (
      await prisma.country.findFirstOrThrow({
        where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
        select: { id: true },
      })
    ).id;
    cityId = (await prisma.city.findFirstOrThrow({ where: { mergedIntoCityId: null }, select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.moderationCase.deleteMany({ where: { subjectAuthorUserId: { in: createdUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: createdAssets } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversations } } });
    await prisma.$disconnect();
  });

  it('le corps de la route attend un `userId` et rien d’autre', () => {
    expect(hideHousingFromSchema.safeParse({ userId: newId() }).success).toBe(true);
    expect(hideHousingFromSchema.safeParse({}).success).toBe(false);
    expect(hideHousingFromSchema.safeParse({ userId: newId(), extra: 1 }).success).toBe(false);
  });

  it('l’annonce n’apparaît plus dans la liste du membre masqué, mais reste visible des autres', async () => {
    const author = await member();
    const hidden = await member();
    const other = await member();
    const id = await listing(author);

    await housing.hideFrom(id, author, hidden);

    const forHidden = await housing.list({ scope: 'all', sort: 'date', limit: 50, radiusKm: 30 }, hidden);
    const forOther = await housing.list({ scope: 'all', sort: 'date', limit: 50, radiusKm: 30 }, other);
    expect(forHidden.items.map((c) => c.id)).not.toContain(id);
    expect(forOther.items.map((c) => c.id)).toContain(id);
  });

  it('le détail répond 404 au membre masqué, et l’auteur la voit toujours', async () => {
    const author = await member();
    const hidden = await member();
    const id = await listing(author);
    await housing.hideFrom(id, author, hidden);

    await expect(housing.detail(id, hidden)).rejects.toMatchObject({ status: 404 });
    expect((await housing.detail(id, author)).id).toBe(id);
  });

  it('le membre masqué ne peut pas contacter l’auteur par cette annonce (404)', async () => {
    const author = await member();
    const hidden = await member('L1');
    const id = await listing(author);
    await housing.hideFrom(id, author, hidden);
    await expect(housing.contact(id, hidden)).rejects.toMatchObject({ status: 404 });
  });

  it('ne masque que CETTE annonce : les autres annonces de l’auteur restent visibles', async () => {
    const author = await member();
    const hidden = await member();
    const masked = await listing(author);
    const kept = await listing(author);
    await housing.hideFrom(masked, author, hidden);

    expect((await housing.detail(kept, hidden)).id).toBe(kept);
  });

  it('est idempotent', async () => {
    const author = await member();
    const hidden = await member();
    const id = await listing(author);
    expect(await housing.hideFrom(id, author, hidden)).toEqual({ hiddenFromCount: 1 });
    expect(await housing.hideFrom(id, author, hidden)).toEqual({ hiddenFromCount: 1 });
  });

  it('seul l’auteur peut masquer (404 sinon), et pas à lui-même (400)', async () => {
    const author = await member();
    const stranger = await member();
    const target = await member();
    const id = await listing(author);

    await expect(housing.hideFrom(id, stranger, target)).rejects.toMatchObject({ status: 404 });
    await expect(housing.hideFrom(id, author, author)).rejects.toMatchObject({ status: 400 });
  });

  it('un membre inconnu rend 404 (la route ne sonde pas les identifiants)', async () => {
    const author = await member();
    const id = await listing(author);
    await expect(housing.hideFrom(id, author, newId())).rejects.toMatchObject({ status: 404 });
  });
});
