import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { BlocksService } from '../blocks.service';

/**
 * Blocage et visibilité — 08 §4.
 *
 * Ce que ces tests protègent n'est pas le blocage lui-même mais la RÈGLE que six
 * modules de contenu vont appliquer : la séparation vaut DANS LES DEUX SENS.
 * Une implémentation à sens unique laisserait celui qui a bloqué retrouver
 * l'autre dans une liste — et le défaut ne se verrait que sur un écran, bien
 * plus tard, dans un module qui n'a rien fait de mal.
 */
describe('blocage et visibilité (08 §4)', () => {
  let prisma: PrismaService;
  let blocks: BlocksService;
  let visibility: VisibilityService;
  const created: string[] = [];

  async function member(suffix: string): Promise<{ id: string; handle: string }> {
    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    const id = newId();
    const handle = `bloc${suffix}${id.slice(-6)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: 'Test',
        phase: 'PRE_DEPARTURE',
        verificationLevel: 'L0',
        originCountryId: country.id,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    created.push(id);
    return { id, handle };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    blocks = new BlocksService(prisma, new OutboxService(prisma), new AuditService(prisma));
    visibility = new VisibilityService(prisma);
  });

  afterAll(async () => {
    if (created.length > 0) await prisma.user.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('sépare dans les DEUX sens', async () => {
    const a = await member('a');
    const b = await member('b');

    await blocks.block(a.id, b.handle);

    // Celui qui a bloqué ne retrouve pas l'autre…
    expect(await visibility.separatedFrom(a.id)).toContain(b.id);
    // …et le bloqué ne retrouve pas celui qui l'a bloqué. C'est la règle du §4
    // et de `01` §4.4 : un blocage est une séparation, pas un filtre.
    expect(await visibility.separatedFrom(b.id)).toContain(a.id);
    expect(await visibility.isSeparated(b.id, a.id)).toBe(true);
  });

  it('lève NOT_FOUND — et jamais FORBIDDEN — sur un membre séparé', async () => {
    const a = await member('c');
    const b = await member('d');
    await blocks.block(b.id, a.handle);

    // T4 §3 : révéler qu'un contenu existe mais est inaccessible en dit trop.
    await expect(visibility.assertVisible(a.id, b.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('ne sépare pas un membre de lui-même', async () => {
    const a = await member('e');
    expect(await visibility.isSeparated(a.id, a.id)).toBe(false);
  });

  it('ne filtre rien pour un visiteur anonyme', async () => {
    const a = await member('f');
    // Une lecture publique n'a pas de blocages à appliquer, et lui en inventer
    // ferait disparaître des contenus sans raison.
    expect(await visibility.separatedFrom(null)).toEqual([]);
    await expect(visibility.assertVisible(null, a.id)).resolves.toBeUndefined();
  });

  it('bloquer deux fois n’est pas une erreur', async () => {
    const a = await member('g');
    const b = await member('h');

    await blocks.block(a.id, b.handle);
    // Idempotent : c'est le même état, et refuser ferait échouer un double clic.
    await expect(blocks.block(a.id, b.handle)).resolves.toEqual({ blockedUserId: b.id });
    expect(await prisma.block.count({ where: { blockerUserId: a.id } })).toBe(1);
  });

  it('refuse de se bloquer soi-même', async () => {
    const a = await member('i');
    await expect(blocks.block(a.id, a.handle)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('émet `user.blocked` avec les DEUX identifiants', async () => {
    const a = await member('j');
    const b = await member('k');
    await blocks.block(a.id, b.handle);

    const event = await prisma.domainEvent.findFirst({
      where: { type: 'user.blocked', aggregateId: a.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(event).not.toBeNull();
    // Un consommateur doit pouvoir nettoyer les deux côtés : une conversation,
    // un contact, un parcours partagé.
    expect(JSON.stringify(event?.payload)).toContain(b.id);
    expect(JSON.stringify(event?.payload)).toContain(a.id);
  });

  it('le déblocage retire la séparation, dans les deux sens', async () => {
    const a = await member('l');
    const b = await member('m');
    await blocks.block(a.id, b.handle);
    await blocks.unblock(a.id, b.id);

    expect(await visibility.separatedFrom(a.id)).not.toContain(b.id);
    expect(await visibility.separatedFrom(b.id)).not.toContain(a.id);
  });

  it('un blocage inexistant se débloque sans erreur', async () => {
    const a = await member('n');
    const b = await member('o');
    await expect(blocks.unblock(a.id, b.id)).resolves.toBeUndefined();
  });

  it('liste les bloqués avec leur pseudo', async () => {
    const a = await member('p');
    const b = await member('q');
    await blocks.block(a.id, b.handle);

    const list = await blocks.list(a.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.handle).toBe(b.handle);
    // Le blocage est à SENS unique dans cette liste : b n'a rien bloqué.
    expect(await blocks.list(b.id)).toHaveLength(0);
  });
});
