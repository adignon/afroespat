import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../generated/client/index.js';
import { genererDemo, purgerDonneesDeDepart } from '../seed/demo/index.js';

/**
 * Le générateur de données de départ et sa purge, contre la base de développement.
 *
 * Préalable : `pnpm --filter @app/db seed` (pays, villes, modèles). Le test refuse de tourner si des comptes de départ
 * existent déjà (il purgerait un jeu de données que quelqu'un regarde) ; il laisse la base comme il l'a trouvée.
 */
const prisma = new PrismaClient();
const env = { CONTENT_ENCRYPTION_KEY: randomBytes(32).toString('base64'), CONTENT_ENCRYPTION_KEY_ID: '1' };
const silence = (): void => undefined;

describe('données de départ : génération et purge', () => {
  let avant = 0;

  beforeAll(async () => {
    avant = await prisma.user.count({ where: { origin: 'SEED' } });
    if (avant > 0) throw new Error('Des comptes de départ existent : purgez-les avant de lancer ce test.');
  });
  afterAll(async () => {
    await purgerDonneesDeDepart(prisma, { fermerVilles: false });
    await prisma.$disconnect();
  });

  it('un aperçu écrit tout puis annule : rien ne reste', async () => {
    const r = await genererDemo(prisma, { env, log: silence, simulation: true });
    expect(r.apercu).toBe(true);
    expect(r.compte['membres']).toBe(120);
    expect(await prisma.user.count({ where: { origin: 'SEED' } })).toBe(0);
  });

  it('génère de quoi franchir les seuils de la page d’accueil, et tout est signé par un compte de départ', async () => {
    const r = await genererDemo(prisma, { env, log: silence });
    expect(r.compte['membres']).toBeGreaterThanOrEqual(100);
    expect(await prisma.user.count({ where: { origin: 'SEED', status: 'ACTIVE' } })).toBeGreaterThanOrEqual(100);
    expect(await prisma.guide.count({ where: { status: 'PUBLISHED' } })).toBeGreaterThanOrEqual(10);
    expect(await prisma.helpRequest.count({ where: { author: { is: { origin: 'SEED' } } } })).toBeGreaterThanOrEqual(20);
    // Aucun contenu n'a d'auteur « inscrit par lui-même » : la suppression en lot retire tout.
    expect(await prisma.post.count({ where: { author: { is: { origin: 'MEMBER' } } } })).toBe(0);
    expect(await prisma.event.count({ where: { organizer: { is: { origin: 'MEMBER' } } } })).toBe(0);
    // Aucun numéro de téléphone : ces comptes ne se connectent pas.
    expect(await prisma.phoneNumber.count({ where: { user: { is: { origin: 'SEED' } } } })).toBe(0);
    // Une seconde génération est refusée.
    await expect(genererDemo(prisma, { env, log: silence })).rejects.toThrow(/existent déjà/);
  });

  it('la purge retire tout, y compris ce que la cascade ne voit pas', async () => {
    const apercu = await purgerDonneesDeDepart(prisma, { simulation: true });
    expect(apercu.apercu).toBe(true);
    expect(apercu.comptes).toBe(120);
    expect(await prisma.user.count({ where: { origin: 'SEED' } })).toBe(120);

    const r = await purgerDonneesDeDepart(prisma, {});
    expect(r.comptes).toBe(120);
    expect(await prisma.user.count({ where: { origin: 'SEED' } })).toBe(0);
    expect(await prisma.guide.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.bookmark.count()).toBe(0);
    expect(await prisma.moderationCase.count()).toBe(0);
    expect(await prisma.searchDocument.count()).toBe(0);
    expect(await prisma.conversation.count()).toBe(0);
  });
});
