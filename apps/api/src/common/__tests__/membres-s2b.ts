/**
 * Fabriques d'épreuve de l'étape 2 (fiabilité des données) : un membre et sa ville, créés
 * directement en base — sans passer par l'OTP, qui n'a rien à prouver ici.
 */
import { newId } from '@app/db';
import type { PrismaService } from '../prisma.service';

export async function creerMembre(
  prisma: PrismaService,
  over: { cityId?: string | null; level?: 'L0' | 'L1' | 'L2'; plan?: 'FREE' | 'PREMIUM' } = {},
): Promise<string> {
  const id = newId();
  const country = await prisma.country.findFirstOrThrow({ select: { id: true } });
  await prisma.user.create({
    data: {
      id,
      handle: `s2b${id.slice(-12)}`,
      displayName: 'Membre S2B',
      status: 'ACTIVE',
      verificationLevel: over.level ?? 'L1',
      phase: 'SETTLED',
      plan: over.plan ?? 'FREE',
      originCountryId: country.id,
      cityId: over.cityId ?? null,
    },
  });
  return id;
}

/** Une ville active neuve (les épreuves qui comptent ou fusionnent ne partagent pas la leur). */
export async function creerVille(prisma: PrismaService, active = true): Promise<string> {
  const id = newId();
  const country = await prisma.country.findUniqueOrThrow({ where: { iso2: 'FR' }, select: { id: true } });
  await prisma.city.create({
    data: {
      id,
      countryId: country.id,
      name: `Ville S2B ${id.slice(-6)}`,
      slug: `s2b-${id.slice(-12)}`,
      latitude: 45.1,
      longitude: 4.1,
      isActive: active,
      ...(active ? { activatedAt: new Date() } : {}),
    },
  });
  return id;
}

/** Supprime les membres créés (cascade sur leurs contenus) — à appeler en `afterAll`. */
export async function purgerMembres(prisma: PrismaService, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.user.deleteMany({ where: { id: { in: [...ids] } } });
}
