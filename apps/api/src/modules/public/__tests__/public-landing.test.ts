import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../common/prisma.service';
import { ECHANTILLON_DEMANDES, FENETRE_ENTRAIDE_JOURS, PublicLandingService } from '../public-landing.service';

/**
 * LA PAGE D'ACCUEIL PUBLIQUE — les requêtes que le service envoie, sans base de données.
 *
 * Trois garanties : la lecture des demandes d'entraide est BORNÉE (fenêtre de 90 jours, `take`), seuls les événements
 * PUBLICS (`community_id` nul, 09 §3.1) sont exposés, et chaque ville porte le réseau public à ouvrir.
 */
function service() {
  const evenement = { findMany: vi.fn().mockResolvedValue([]) };
  const demande = { findMany: vi.fn().mockResolvedValue([]) };
  const ville = {
    count: vi.fn().mockResolvedValue(1),
    findMany: vi.fn().mockImplementation(() =>
      Promise.resolve([{ id: 'ville-1', slug: 'lyon', name: 'Lyon', memberCount: 3, country: { iso2: 'FR', nameFr: 'France', sortOrder: 1 } }]),
    ),
  };
  const communaute = { findMany: vi.fn().mockResolvedValue([{ id: 'reseau-1', cityId: 'ville-1' }]) };
  const prisma = {
    user: { count: vi.fn().mockResolvedValue(5), groupBy: vi.fn().mockResolvedValue([]) },
    country: { findMany: vi.fn().mockResolvedValue([]) },
    city: ville,
    helpRequest: demande,
    helpResponse: { groupBy: vi.fn().mockResolvedValue([]) },
    guide: { count: vi.fn().mockResolvedValue(0) },
    event: evenement,
    community: communaute,
    impactQuote: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { svc: new PublicLandingService(prisma as unknown as PrismaService), evenement, demande, communaute };
}

describe('PublicLandingService.landing', () => {
  const now = new Date('2026-11-06T10:00:00Z');

  it('borne la lecture des demandes d’entraide : 90 jours et un nombre maximal', async () => {
    const { svc, demande } = service();
    await svc.landing(now);
    const appel = demande.findMany.mock.calls[0]?.[0] as { where: { createdAt: { gte: Date } }; take: number };
    expect(appel.take).toBe(ECHANTILLON_DEMANDES);
    expect(appel.where.createdAt.gte.getTime()).toBe(now.getTime() - FENETRE_ENTRAIDE_JOURS * 86_400_000);
  });

  it('n’expose que les événements publics : jamais ceux d’un réseau, même public', async () => {
    const { svc, evenement } = service();
    await svc.landing(now);
    const appel = evenement.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(appel.where['communityId']).toBeNull();
    expect(appel.where).not.toHaveProperty('OR');
  });

  it('donne à chaque ville le réseau public à ouvrir', async () => {
    const { svc, communaute } = service();
    const l = await svc.landing(now);
    expect(l.cities).toEqual([{ slug: 'lyon', name: 'Lyon', memberCount: null, communityId: 'reseau-1' }]);
    const appel = communaute.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> };
    expect(appel.where).toMatchObject({ kind: 'CITY', visibility: 'PUBLIC', status: 'ACTIVE', createdByUserId: null });
  });
});
