import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_ENUMS } from '@app/shared';
import { PrismaClient } from '../../generated/client/index.js';

/**
 * Parité des enums entre PostgreSQL, le schéma Prisma et @app/shared.
 *
 * 00-fondations.md §6.1 exige des enums PostgreSQL natifs « réexportés vers le
 * code partagé ». @app/shared est généré depuis le schéma Prisma ; ce test ferme
 * la boucle en interrogeant la base réelle. Une dérive devient donc impossible :
 * soit les trois concordent, soit la CI échoue.
 */

interface PgEnum {
  name: string;
  values: string[];
}

// Interrogée par le client, pas par `docker exec` : le test doit tourner
// identiquement en local et en CI, où la base est un service et non un conteneur nommé.
const prisma = new PrismaClient();

async function readEnumsFromDatabase(): Promise<PgEnum[]> {
  const rows = await prisma.$queryRaw<{ name: string; values: string[] }[]>`
    SELECT t.typname AS name,
           array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `;
  return rows;
}

describe('parité des enums base ↔ schéma ↔ code partagé', () => {
  let pgEnums: PgEnum[] = [];

  beforeAll(async () => {
    pgEnums = await readEnumsFromDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('la base et le code partagé déclarent le même nombre d’enums', () => {
    expect(pgEnums.length).toBe(Object.keys(ALL_ENUMS).length);
  });

  it('chaque enum de la base existe dans le code partagé, avec les mêmes valeurs dans le même ordre', () => {
    const shared = ALL_ENUMS as Record<string, readonly string[]>;
    const mismatches: string[] = [];

    for (const { name, values } of pgEnums) {
      const sharedValues = shared[name];
      if (sharedValues === undefined) {
        mismatches.push(`${name} : absent de @app/shared`);
        continue;
      }
      if (sharedValues.join(',') !== values.join(',')) {
        mismatches.push(`${name} : base [${values.join(', ')}] ≠ partagé [${sharedValues.join(', ')}]`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('aucun enum du code partagé n’est absent de la base', () => {
    const pgNames = new Set(pgEnums.map((e) => e.name));
    const orphans = Object.keys(ALL_ENUMS).filter((n) => !pgNames.has(n));
    expect(orphans).toEqual([]);
  });
});
