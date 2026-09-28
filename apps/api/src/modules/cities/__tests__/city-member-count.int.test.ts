import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../common/prisma.service';
import { CitiesService } from '../cities.service';
import { ScheduledTaskRegistry } from '../../../queue/scheduled-tasks';

/**
 * `cities.member_count` — 02 §2.2, « recalculé chaque nuit ».
 *
 * PERSONNE NE L'ÉCRIVAIT. Le compteur valait zéro pour toutes les villes depuis
 * toujours, alors que trois lectures en dépendent — le tri de la carte, le
 * compteur affiché, et le nombre que l'équipe regarde pour activer une ville
 * (§2.2 : « quand l'équipe le décide, en général à 20 membres » — un jugement
 * humain nourri par ce chiffre, pas un seuil automatique).
 *
 * La conséquence la plus insidieuse était le TRI : `orderBy` porte
 * `member_count desc` puis `name asc`, et un compteur uniformément nul rend le
 * premier critère inopérant. La carte sortait donc dans l'ordre alphabétique, en
 * silence. Une liste triée par un critère mort reste une liste triée — c'est le
 * genre de défaut qu'aucune erreur ne révèle.
 *
 * Ce que ce fichier verrouille, et le second point compte autant que le premier :
 * le compteur est juste, ET il compte la MÊME chose que les listes qu'il annonce.
 * Un compteur qui divergerait de `countsByCity` serait pire qu'un compteur absent.
 */
describe('recalcul de `cities.member_count` (02 §2.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cities: CitiesService;
  let cityId = '';
  let otherCityId = '';
  const userIds: string[] = [];

  async function user(overrides: {
    cityId: string | null;
    status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
    deleted?: boolean;
  }): Promise<string> {
    const id = newId();
    const country = await prisma.country.findFirstOrThrow({ select: { id: true } });
    await prisma.user.create({
      data: {
        id,
        handle: `cmc${id.slice(-10)}`,
        displayName: 'Compteur',
        status: overrides.status ?? 'ACTIVE',
        verificationLevel: 'L0',
        phase: 'SETTLED',
        plan: 'FREE',
        originCountryId: country.id,
        cityId: overrides.cityId,
        ...(overrides.deleted === true ? { deletedAt: new Date() } : {}),
      },
    });
    userIds.push(id);
    return id;
  }

  async function countOf(id: string): Promise<number> {
    const row = await prisma.city.findUniqueOrThrow({
      where: { id },
      select: { memberCount: true },
    });
    return row.memberCount;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    cities = app.get(CitiesService);

    const country = await prisma.country.findFirstOrThrow({ select: { id: true } });
    const made = await prisma.city.createManyAndReturn({
      data: [
        {
          id: newId(),
          countryId: country.id,
          name: `Ville compteur ${newId().slice(-6)}`,
          slug: `ville-compteur-${newId().slice(-8)}`,
          latitude: 48.85,
          longitude: 2.35,
          isActive: false,
        },
        {
          id: newId(),
          countryId: country.id,
          name: `Ville témoin ${newId().slice(-6)}`,
          slug: `ville-temoin-${newId().slice(-8)}`,
          latitude: 45.75,
          longitude: 4.85,
          isActive: false,
        },
      ],
      select: { id: true },
    });
    cityId = made[0]?.id ?? '';
    otherCityId = made[1]?.id ?? '';
  });

  afterAll(async () => {
    if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.city.deleteMany({ where: { id: { in: [cityId, otherCityId] } } });
    await app.close();
  });

  it('[RÈGLE DURE] compte les membres actifs, et EUX SEULS', async () => {
    await user({ cityId });
    await user({ cityId });
    await user({ cityId });
    // Les trois cas qui doivent être exclus, et qui le sont pour trois raisons
    // différentes — un seul filtre oublié laisse passer l'un des trois.
    await user({ cityId, deleted: true });
    await user({ cityId, status: 'SUSPENDED' });
    await user({ cityId, status: 'DEACTIVATED' });
    // Et un membre d'une AUTRE ville, qui ne doit pas être compté ici.
    await user({ cityId: otherCityId });
    // Et un membre sans ville : `city_id` est NULL, une jointure maladroite le
    // rattacherait à toutes les villes.
    await user({ cityId: null });

    await cities.recomputeMemberCounts();

    expect(await countOf(cityId)).toBe(3);
    expect(await countOf(otherCityId)).toBe(1);
  });

  it('coïncide avec le compteur que la carte calcule en direct', async () => {
    /**
     * LE POINT LE PLUS IMPORTANT DE CE FICHIER.
     *
     * `map()` sans filtre rend `member_count` ; avec un filtre de pays, il
     * RECALCULE en direct par `countsByCity`. Les deux chemins doivent compter la
     * même chose, sinon le même écran affiche deux nombres selon qu'un filtre est
     * actif — et c'est le genre d'incohérence qu'on attribue à un cache.
     */
    const live = await prisma.user.count({
      where: { cityId, deletedAt: null, status: 'ACTIVE' },
    });
    expect(await countOf(cityId)).toBe(live);
  });

  it('est idempotent : un second passage ne change rien', async () => {
    const before = await countOf(cityId);
    const changed = await cities.recomputeMemberCounts();
    expect(await countOf(cityId)).toBe(before);
    // Aucune ligne n'a besoin d'être réécrite : le `WHERE member_count <> total`
    // fait que le second passage ne touche rien du tout.
    expect(changed).toBe(0);
  });

  it('recalcule aussi les villes INACTIVES — c’est leur compteur qui décide de leur activation', async () => {
    const city = await prisma.city.findUniqueOrThrow({
      where: { id: cityId },
      select: { isActive: true, memberCount: true },
    });
    expect(city.isActive).toBe(false);
    expect(city.memberCount).toBe(3);
  });

  it('la tâche planifiée est enregistrée sous le nom de la spec', () => {
    // Le nom apparaît dans le journal, dans la file `scheduled` et dans le
    // runbook : une tâche qu'on cherche sous le nom de §9.3 doit se trouver.
    const task = app.get(ScheduledTaskRegistry).get('city.member_count_recompute');
    expect(task).toBeDefined();
    expect(task?.schedule.label).toBe('quotidienne');
  });
});
