/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE VILLE ACTIVE QUE L'ÉPREUVE CRÉE ELLE-MÊME — JAMAIS CELLE DE LA BASE    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Lot W4A, phase 6 « qualité ». Plusieurs fichiers d'intégration commençaient par
 * `prisma.city.findFirstOrThrow({ where: { isActive: true } })` : ils réussissaient
 * sur la base de développement, où l'équipe avait activé Lyon et Paris à la main,
 * et ÉCHOUAIENT sur une base fraîche migrée et semée — le seed charge les villes,
 * toutes inactives, parce que l'ouverture d'une ville est une décision d'équipe.
 * MESURÉ : 5 échecs sur 1 185 cas dans `media.int`, `scheduled-new-tasks.int` et
 * `billing.int`, tous de la forme « No City found ».
 *
 * La règle qui en sort : une épreuve ne suppose JAMAIS qu'une ville (ou un pays, ou
 * un membre) préexiste. Elle crée la sienne, avec un nom qui la désigne.
 *
 * ── IDEMPOTENTE, ET SANS EFFACEMENT ───────────────────────────────────────────
 *
 * La ville porte un `slug` fixe (`ville-de-test-w4a`) : appelée vingt fois, par vingt
 * fichiers, elle n'en crée qu'UNE (`upsert`). On ne la supprime pas en fin de
 * fichier — annonces, événements et parcours que d'autres épreuves y rattachent la
 * tiennent par des clés `RESTRICT`, et un nettoyage d'un fichier casserait le
 * nettoyage d'un autre. Elle reste dans la base d'épreuve, active, SANS membre
 * réel : aucune requête de production ne la verrait sans la chercher par son nom.
 */
import { newId } from '@app/db';
import type { PrismaService } from '../prisma.service';

export const SLUG_VILLE_DE_TEST = 'ville-de-test-w4a';

/** Le pays de destination sous lequel la ville est rangée : la France, que le seed pose toujours. */
async function paysDestination(prisma: PrismaService): Promise<string> {
  const pays = await prisma.country.findUniqueOrThrow({ where: { iso2: 'FR' }, select: { id: true } });
  return pays.id;
}

/** L'identifiant d'une ville ACTIVE, propre aux épreuves. Crée au besoin, réactive au besoin. */
export async function villeActiveDeTest(prisma: PrismaService): Promise<string> {
  const countryId = await paysDestination(prisma);
  const ville = await prisma.city.upsert({
    where: { slug: SLUG_VILLE_DE_TEST },
    create: {
      id: newId(),
      countryId,
      name: 'Ville de test W4A',
      slug: SLUG_VILLE_DE_TEST,
      latitude: 45.75,
      longitude: 4.85,
      isActive: true,
      activatedAt: new Date(),
      memberCount: 0,
    },
    update: { isActive: true, mergedIntoCityId: null },
    select: { id: true },
  });
  return ville.id;
}
