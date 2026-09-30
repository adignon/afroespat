import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import type { StorageProvider } from '../../../providers/providers';
import { DataExportService } from '../data-export.service';

/**
 * L'export RGPD — 01-identite.md §2.8 et §8.
 *
 * TROIS RÈGLES DURES, et la deuxième est celle qui compte vraiment.
 *
 *   1. « une demande par 30 jours » ;
 *   2. **l'archive ne contient QUE le demandeur.** C'est l'obligation légale
 *      SYMÉTRIQUE de l'export : livrer à un membre les données d'un autre serait
 *      une violation de données, pas un droit d'accès. Elle est la plus facile à
 *      casser sans s'en apercevoir — il suffit d'oublier un `where` — et la plus
 *      coûteuse à découvrir tard ;
 *   3. « lien valable 7 jours », et la purge qui efface VRAIMENT l'octet.
 *
 * La doublure de stockage GARDE LES OCTETS en mémoire, au lieu de les jeter : un
 * `put` qui ne retiendrait rien laisserait ce fichier vert même si l'archive était
 * vide, et c'est exactement ce que ces tests existent pour empêcher.
 */
describe('export RGPD (01 §2.8)', () => {
  let prisma: PrismaService;
  let exports: DataExportService;
  let storage: RecordingStorage;

  const users: string[] = [];
  let mineId = '';
  let otherId = '';
  let countryId = '';

  class RecordingStorage implements StorageProvider {
    readonly puts = new Map<string, Buffer>();
    readonly deleted: string[] = [];
    createUploadUrl(key: string): Promise<{ url: string }> {
      return Promise.resolve({ url: `/up/${key}` });
    }
    createDownloadUrl(key: string): Promise<string> {
      return Promise.resolve(`/dl/${key}`);
    }
    put(key: string, body: Buffer): Promise<void> {
      this.puts.set(key, body);
      return Promise.resolve();
    }
    delete(key: string): Promise<void> {
      this.deleted.push(key);
      this.puts.delete(key);
      return Promise.resolve();
    }
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    storage = new RecordingStorage();
    exports = new DataExportService(prisma, new CryptoService(), new OutboxService(prisma), storage);

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = country.id;

    mineId = await makeUser('Moi');
    otherId = await makeUser('Autre');

    // Une donnée bien à MOI, et une bien à l'AUTRE, dans la même table : c'est ce
    // couple qui rend l'isolation éprouvable. Un signet suffit — il est privé par
    // construction (« aucun compteur nulle part », règle dure §1.2).
    await prisma.bookmark.createMany({
      data: [
        { id: newId(), userId: mineId, subjectType: 'CITY', subjectId: newId() },
        { id: newId(), userId: otherId, subjectType: 'GUIDE', subjectId: newId() },
      ],
    });
  });

  afterAll(async () => {
    if (users.length > 0) {
      await prisma.bookmark.deleteMany({ where: { userId: { in: users } } });
      await prisma.dataExport.deleteMany({ where: { userId: { in: users } } });
      await prisma.mediaAsset.deleteMany({ where: { ownerUserId: { in: users } } });
      await prisma.domainEvent.deleteMany({ where: { aggregateId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.$disconnect();
  });

  async function makeUser(name: string): Promise<string> {
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `ex${id.slice(-10)}`, displayName: name,
        phase: 'SETTLED', verificationLevel: 'L1', originCountryId: countryId,
        plan: 'FREE', status: 'ACTIVE',
      },
    });
    users.push(id);
    return id;
  }

  // ───────────────────────────────────────────────────────────────────────────

  describe('la demande', () => {
    it('crée la ligne PENDING et l’événement, dans la même transaction (§9.1)', async () => {
      const result = await exports.request(mineId);
      expect(result.status).toBe('PENDING');

      const row = await prisma.dataExport.findUniqueOrThrow({ where: { id: result.id } });
      expect(row.userId).toBe(mineId);
      expect(row.assetId).toBeNull();

      // Sans l'événement, la ligne resterait PENDING pour toujours : le worker
      // n'a pas d'autre déclencheur.
      const events = await prisma.domainEvent.findMany({ where: { aggregateId: mineId, type: 'user.export_requested' } });
      expect(events).toHaveLength(1);
      expect(events[0]?.payload).toMatchObject({ exportId: result.id });
    });

    it('refuse une seconde demande dans les 30 jours (§2.8)', async () => {
      await expect(exports.request(mineId)).rejects.toMatchObject({ code: 'EXPORT_TOO_SOON' });
    });

    it('la rouvre passé 30 jours', async () => {
      // On VIEILLIT la demande plutôt que d'attendre : la règle porte sur
      // `created_at`, donc la reculer de 31 jours est exactement le cas réel.
      await prisma.dataExport.updateMany({
        where: { userId: mineId },
        data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
      });
      const again = await exports.request(mineId);
      expect(again.status).toBe('PENDING');
      await prisma.dataExport.delete({ where: { id: again.id } });
    });
  });

  describe('l’archive', () => {
    it('contient les données du demandeur et AUCUNE de celles d’un autre membre', async () => {
      const pending = await prisma.dataExport.findFirstOrThrow({
        where: { userId: mineId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });

      const result = await exports.generate(pending.id);
      expect(result.genere).toBe(true);

      const key = `exports/${mineId}/${pending.id}.json`;
      const body = storage.puts.get(key);
      expect(body).toBeDefined();

      const text = (body as Buffer).toString('utf8');
      // Ma section identité porte bien MON identifiant…
      expect(text).toContain(mineId);
      // …et l'identifiant de l'autre membre n'apparaît NULLE PART. C'est la
      // règle 2, et c'est une assertion sur la chaîne entière plutôt que sur une
      // clé précise : une fuite peut arriver par n'importe quelle section.
      expect(text).not.toContain(otherId);

      const archive = JSON.parse(text) as Record<string, { compte?: { id?: string } }>;
      expect(archive['01-identite']?.compte?.id).toBe(mineId);
      // Une section par module du dossier — c'est la lecture de « JSON par module ».
      expect(Object.keys(archive)).toEqual(
        expect.arrayContaining(['01-identite', '03-parcours', '08-parrainage-messagerie', '13-moderation']),
      );

      const after = await prisma.dataExport.findUniqueOrThrow({ where: { id: pending.id } });
      expect(after.status).toBe('READY');
      expect(after.assetId).not.toBeNull();
      expect(after.expiresAt).not.toBeNull();
    });

    it('la génération est idempotente : rejouée, elle ne refait rien', async () => {
      const ready = await prisma.dataExport.findFirstOrThrow({ where: { userId: mineId, status: 'READY' } });
      const before = storage.puts.size;

      const again = await exports.generate(ready.id);

      expect(again.genere).toBe(false);
      expect(storage.puts.size).toBe(before);
    });
  });

  describe('le lien de sept jours et sa purge (§8)', () => {
    it('ne rend pas de lien pour une archive périmée, même avant le passage de la purge', async () => {
      const ready = await prisma.dataExport.findFirstOrThrow({ where: { userId: mineId, status: 'READY' } });
      await prisma.dataExport.update({
        where: { id: ready.id },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      const latest = await exports.latest(mineId);
      expect(latest.downloadUrl).toBeNull();
      // Annoncée EXPIRED alors que la colonne dit encore READY : le membre lit
      // l'état réel, pas l'état balayé.
      expect(latest.status).toBe('EXPIRED');
    });

    it('`export.purge` efface l’octet, pas seulement l’état', async () => {
      const ready = await prisma.dataExport.findFirstOrThrow({ where: { userId: mineId, status: 'READY' } });
      const key = `exports/${mineId}/${ready.id}.json`;
      expect(storage.puts.has(key)).toBe(true);

      const result = await exports.purgeExpired(new Date());

      expect(result.purgees).toBeGreaterThanOrEqual(1);
      // L'ARCHIVE A DISPARU DU STOCKAGE. Sans cette assertion, une purge qui se
      // contenterait de passer la ligne à EXPIRED laisserait une copie complète
      // des données d'un membre dans le stockage objet, indéfiniment.
      expect(storage.deleted).toContain(key);
      expect(storage.puts.has(key)).toBe(false);

      const after = await prisma.dataExport.findUniqueOrThrow({ where: { id: ready.id } });
      expect(after.status).toBe('EXPIRED');
      expect(after.assetId).toBeNull();
    });
  });
});
