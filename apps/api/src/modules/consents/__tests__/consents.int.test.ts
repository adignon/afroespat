import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../../../common/prisma.service';
import { ConsentsService } from '../consents.service';

/**
 * Consentements — 01-identite.md §2.10 et §5.
 *
 * Ce que ces tests protègent est une PREUVE RGPD. Une erreur ici ne casse pas un
 * écran : elle produit une trace qui ne vaut rien devant une autorité, et on ne
 * s'en aperçoit que le jour où on en a besoin.
 *
 * D'où l'insistance sur trois points : la table reste en ajout seul, la version
 * du document est vérifiée et non crue, et une nouvelle version redemande le
 * consentement.
 */
describe('consentements (01 §2.10)', () => {
  let prisma: PrismaService;
  let consents: ConsentsService;
  const created: string[] = [];
  let originalCguVersion = '0';

  async function member(): Promise<string> {
    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `cons${id.slice(-8)}`,
        displayName: 'Test',
        phase: 'PRE_DEPARTURE',
        verificationLevel: 'L0',
        originCountryId: country.id,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    created.push(id);
    return id;
  }

  /** Publie une version des CGU, et rend de quoi la remettre en place. */
  async function setCguVersion(version: string): Promise<void> {
    await prisma.staticPage.update({ where: { slug: 'cgu' }, data: { version } });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    consents = new ConsentsService(prisma);
    const page = await prisma.staticPage.findUniqueOrThrow({ where: { slug: 'cgu' } });
    originalCguVersion = page.version;
  });

  afterAll(async () => {
    // La version est remise telle quelle : la laisser modifiée redemanderait le
    // consentement à tous les comptes de développement, pour rien.
    await setCguVersion(originalCguVersion);
    if (created.length > 0) await prisma.user.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('enregistre les deux consentements de l’inscription, avec l’IP', async () => {
    const userId = await member();
    await consents.recordSignupConsents(prisma, userId, '203.0.113.42');

    const rows = await prisma.consent.findMany({ where: { userId } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.type).sort()).toEqual(['PRIVACY', 'TERMS']);
    // L'IP est la preuve (§5) : sans elle la trace ne vaut pas grand-chose.
    for (const row of rows) expect(row.ip).toBe('203.0.113.42');
  });

  it('refuse une version que le document n’a pas', async () => {
    const userId = await member();
    // Une preuve qui référence une version inexistante est pire qu'une preuve
    // absente : elle a l'air valide.
    await expect(
      consents.record(prisma, { userId, type: 'TERMS', granted: true, version: '99' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('redemande le consentement quand une nouvelle version paraît', async () => {
    const userId = await member();
    await consents.recordSignupConsents(prisma, userId, undefined);
    expect(await consents.outstanding(userId)).toEqual([]);

    await setCguVersion('1');

    // §2.10 : « une nouvelle version des CGU redemande le consentement à la
    // prochaine connexion ».
    expect(await consents.outstanding(userId)).toEqual(['TERMS']);
    const states = await consents.current(userId);
    expect(states.find((s) => s.type === 'TERMS')?.outdated).toBe(true);
    // La confidentialité n'a pas changé : elle ne doit PAS être redemandée.
    expect(states.find((s) => s.type === 'PRIVACY')?.outdated).toBe(false);

    await consents.record(prisma, { userId, type: 'TERMS', granted: true, version: '1' });
    expect(await consents.outstanding(userId)).toEqual([]);

    await setCguVersion(originalCguVersion);
  });

  it('un retrait s’AJOUTE, il n’écrase pas', async () => {
    const userId = await member();
    await consents.recordSignupConsents(prisma, userId, undefined);
    await consents.record(prisma, { userId, type: 'TERMS', granted: false });

    const rows = await prisma.consent.findMany({
      where: { userId, type: 'TERMS' },
      orderBy: { createdAt: 'asc' },
    });
    // Deux lignes, pas une modifiée : l'historique EST la preuve. Écraser
    // détruirait la seule chose qu'on cherche à conserver.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.granted)).toEqual([true, false]);

    // Et l'état courant est le RETRAIT : compter les lignes accordées donnerait
    // un consentement encore valide après sa révocation.
    const state = (await consents.current(userId)).find((s) => s.type === 'TERMS');
    expect(state?.granted).toBe(false);
    expect(await consents.outstanding(userId)).toContain('TERMS');
  });

  it('ne redemande pas un consentement REFUSÉ à chaque publication', async () => {
    const userId = await member();
    await consents.record(prisma, { userId, type: 'TERMS', granted: false });
    await setCguVersion('1');

    const state = (await consents.current(userId)).find((s) => s.type === 'TERMS');
    // `outdated` ne concerne qu'un consentement ACCORDÉ sur une version dépassée.
    // Un refus n'a pas à être marqué périmé : il n'a jamais été donné.
    expect(state?.outdated).toBe(false);
    // Il reste évidemment à demander, mais pour la bonne raison.
    expect(await consents.outstanding(userId)).toContain('TERMS');

    await setCguVersion(originalCguVersion);
  });

  it('ne rend que l’état COURANT de chaque type', async () => {
    const userId = await member();
    await consents.record(prisma, { userId, type: 'MARKETING_EMAIL', granted: true, version: '1' });
    await consents.record(prisma, { userId, type: 'MARKETING_EMAIL', granted: false, version: '1' });
    await consents.record(prisma, { userId, type: 'MARKETING_EMAIL', granted: true, version: '1' });

    const marketing = (await consents.current(userId)).filter(
      (s) => s.type === 'MARKETING_EMAIL',
    );
    expect(marketing).toHaveLength(1);
    expect(marketing[0]?.granted).toBe(true);
  });
});
