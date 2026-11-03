import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AppModule } from '../../../app.module';
import { ApiError } from '../../../common/api-error';
import { PrismaService } from '../../../common/prisma.service';
import { PublicLandingService } from '../public-landing.service';

/**
 * LA PAGE D'ACCUEIL PUBLIQUE — ce qu'un visiteur sans compte peut lire.
 *
 * La règle qui compte : SEUL un réseau de ville PUBLIC créé AUTOMATIQUEMENT (sans créateur) est exposé. Un réseau
 * privé, sur demande, de pays, ou créé par un membre répond comme un réseau qui n'existe pas (404) : l'existence d'un
 * réseau privé ne se devine pas depuis l'extérieur.
 */
describe('lecture publique : réseaux de ville et recherche', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: PublicLandingService;
  let cityId = '';
  let userId = '';
  const run = Math.random().toString(36).slice(2, 8);
  const communityIds: string[] = [];

  async function community(options: {
    suffix: string;
    kind?: 'CITY' | 'COUNTRY';
    visibility?: 'PUBLIC' | 'ON_REQUEST' | 'INVITE_ONLY';
    createdByUserId?: string | null;
  }): Promise<string> {
    const id = newId();
    await prisma.community.create({
      data: {
        id,
        kind: options.kind ?? 'CITY',
        cityId,
        name: `Réseau ${run} ${options.suffix}`,
        slug: `pl-${run}-${options.suffix}`,
        visibility: options.visibility ?? 'PUBLIC',
        status: 'ACTIVE',
        lastActivityAt: new Date(),
        ...(options.createdByUserId === undefined || options.createdByUserId === null
          ? {}
          : { createdByUserId: options.createdByUserId }),
      },
    });
    communityIds.push(id);
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    service = app.get(PublicLandingService);

    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
    const country = await prisma.country.findFirstOrThrow({ select: { id: true } });
    userId = newId();
    await prisma.user.create({
      data: {
        id: userId,
        handle: `pl${userId.slice(-10)}`,
        displayName: 'Créateur Public',
        status: 'ACTIVE',
        verificationLevel: 'L0',
        phase: 'SETTLED',
        plan: 'FREE',
        originCountryId: country.id,
        cityId,
      },
    });
  });

  afterAll(async () => {
    await prisma.community.deleteMany({ where: { id: { in: communityIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('expose la fiche « À propos » d’un réseau de ville public créé automatiquement', async () => {
    const id = await community({ suffix: 'auto' });
    const a = await service.communityAbout(id);
    expect(a).toMatchObject({ id, name: `Réseau ${run} auto`, moderators: [] });
    // Sous le seuil de membres, le compteur n'est pas montré.
    expect(a.memberCount).toBeNull();
  });

  it('refuse tout autre réseau comme s’il n’existait pas (privé, sur demande, de pays, créé par un membre)', async () => {
    const refuses = [
      await community({ suffix: 'demande', visibility: 'ON_REQUEST' }),
      await community({ suffix: 'invite', visibility: 'INVITE_ONLY' }),
      await community({ suffix: 'pays', kind: 'COUNTRY' }),
      await community({ suffix: 'membre', createdByUserId: userId }),
    ];
    for (const id of refuses) {
      await expect(service.communityAbout(id)).rejects.toBeInstanceOf(ApiError);
    }
    await expect(service.communityAbout(newId())).rejects.toBeInstanceOf(ApiError);
  });

  it('la recherche ne rend que les réseaux publics de ville', async () => {
    await community({ suffix: 'visible' });
    await community({ suffix: 'cache', visibility: 'ON_REQUEST' });
    const res = await service.search({ q: `Réseau ${run}` });
    const noms = res.communities.map((c) => c.name);
    expect(noms).toContain(`Réseau ${run} visible`);
    expect(noms).not.toContain(`Réseau ${run} cache`);
  });

  it('la page d’accueil ne montre aucun compteur sous le seuil de membres', async () => {
    const l = await service.landing(new Date());
    const membres = await prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } });
    if (membres < 100) {
      expect(l.stats).toMatchObject({ members: null, cities: null, countries: null, countryNames: [] });
    } else {
      expect(l.stats.members).toBe(membres);
    }
  });
});
