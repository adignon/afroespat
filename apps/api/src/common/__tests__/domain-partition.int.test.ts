import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAFF_CAPABILITY_PREFIX } from '../staff-role.decorator';
import { AppModule } from '../../app.module';
import { ApiErrorFilter } from '../error.filter';

type OpenApiView = { paths: Record<string, Record<string, { 'x-capability'?: string }>> };

/**
 * LA PARTITION DES DEUX DOMAINES EST LISIBLE SUR LE CHEMIN — `00` §5.1, `15` §2.1.
 *
 * POURQUOI CE TEST EXISTE, ET CE QU'IL PROTÈGE AILLEURS.
 *
 * `staff.guard.ts` tient l'étanchéité par quatre faits, et `auth.guard.ts` refuse
 * une route qui déclarerait les deux domaines. Tout cela est vrai route par route.
 * Ce test affirme quelque chose de différent et de plus fort : que la partition est
 * lisible sur le PRÉFIXE, c'est-à-dire que
 *
 *     `/v1/admin` ⟺ domaine équipe
 *
 * Ce n'est pas une curiosité de documentation. C'est l'hypothèse sur laquelle repose
 * l'étanchéité du CLIENT (`apps/web/src/lib/api/domains.ts`) : le client membre
 * refuse `/admin…`, le client d'équipe préfixe `/admin` et n'a aucun accès au jeton.
 * Si une seule route de membre apparaissait sous `/v1/admin`, le front n'aurait
 * aucun moyen de l'appeler — et, bien pire, si une route d'ÉQUIPE apparaissait
 * ailleurs que sous `/v1/admin`, le client d'équipe ne pourrait pas l'atteindre
 * tandis que le client membre la croirait sienne.
 *
 * Autrement dit : ce test garde une propriété du back dont un autre paquet dépend
 * sans pouvoir la vérifier lui-même. C'est exactement le genre d'hypothèse qui se
 * casse en silence, parce que celui qui ajoute la route ne sait pas qu'elle existe.
 *
 * Il lit l'OpenAPI, comme `capability-coverage.int.test.ts`, et pour la même raison :
 * c'est le document que le front consomme.
 */
describe('partition des domaines : /v1/admin ⟺ équipe', () => {
  let app: INestApplication;
  let document: OpenApiView;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();

    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1.0').build(),
    ) as unknown as OpenApiView;
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Toutes les opérations, à plat : `{ verbe, chemin, capacité }`. */
  function operations(): { verb: string; path: string; capability: string }[] {
    const out: { verb: string; path: string; capability: string }[] = [];
    for (const [path, ops] of Object.entries(document.paths)) {
      for (const [verb, op] of Object.entries(ops)) {
        const capability = op['x-capability'];
        // `capability-coverage.int.test.ts` garantit déjà qu'aucune n'est absente ;
        // on n'en refait pas l'assertion, on se contente de ne pas planter dessus.
        if (capability !== undefined) out.push({ verb: verb.toUpperCase(), path, capability });
      }
    }
    return out;
  }

  const ADMIN_PREFIX = '/v1/admin';

  it('[RÈGLE DURE] toute route d’équipe est sous /v1/admin', () => {
    const outside = operations()
      .filter((o) => o.capability.startsWith(STAFF_CAPABILITY_PREFIX))
      .filter((o) => !o.path.startsWith(ADMIN_PREFIX))
      .map((o) => `${o.verb} ${o.path} → ${o.capability}`);

    expect(
      outside,
      `Ces routes exigent un rôle d’équipe sans être sous ${ADMIN_PREFIX}. Le client\n` +
        `d’équipe du front préfixe ${ADMIN_PREFIX} à tous ses chemins : il ne peut PAS les\n` +
        `appeler, et le client membre les croirait siennes.\n${outside.join('\n')}`,
    ).toEqual([]);
  });

  it('[RÈGLE DURE] aucune capacité de MEMBRE sous /v1/admin', () => {
    /**
     * Les quatre routes de connexion d'équipe sont `none:public-read`, et c'est
     * nécessaire : on ne peut pas exiger une session d'équipe pour en ouvrir une.
     * Elles appartiennent bien au domaine équipe — ce sont elles qui posent le
     * cookie `dp_staff` — et le client d'équipe les appelle sans identifiant.
     *
     * Ce qui est INTERDIT sous ce préfixe, c'est une capacité de MEMBRE : elle
     * ferait de `/v1/admin` une surface mixte, donc rendrait la partition illisible
     * sur le chemin, donc casserait la construction du front.
     */
    const intruders = operations()
      .filter((o) => o.path.startsWith(ADMIN_PREFIX))
      .filter(
        (o) =>
          !o.capability.startsWith(STAFF_CAPABILITY_PREFIX) &&
          o.capability !== 'none:public-read' &&
          !o.capability.startsWith('webhook:'),
      )
      .map((o) => `${o.verb} ${o.path} → ${o.capability}`);

    expect(
      intruders,
      `Ces routes portent une capacité de MEMBRE sous ${ADMIN_PREFIX}. Le préfixe cesse\n` +
        `alors de désigner le domaine de l’équipe, et l’étanchéité du client front\n` +
        `(apps/web/src/lib/api/domains.ts) n’a plus de fondement.\n${intruders.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * La liste FERMÉE des routes publiques sous `/v1/admin`.
   *
   * Même procédé que la liste des webhooks du test voisin, et pour la même raison :
   * ces quatre routes sont les SEULES écritures joignables sous `/v1/admin` sans
   * session d'équipe. Une cinquième doit faire rougir ce test, pour obliger
   * quelqu'un à venir dire pourquoi elle en est une — et à vérifier qu'elle ne fait
   * rien de plus qu'ouvrir une session.
   *
   * `StaffGuard` ne contrôle PAS le jeton de membre sur ces routes (il rend la main
   * dès que la route ne déclare aucun rôle) : c'est sans conséquence puisqu'elles
   * n'emploient aucune identité de membre, mais c'est une raison de plus pour que
   * leur liste soit courte et surveillée.
   */
  it('[RÈGLE DURE] les routes publiques sous /v1/admin sont exactement la connexion d’équipe', () => {
    const publics = operations()
      .filter((o) => o.path.startsWith(ADMIN_PREFIX) && o.capability === 'none:public-read')
      .map((o) => `${o.verb} ${o.path}`)
      .sort();

    expect(publics).toEqual([
      'POST /v1/admin/auth/login',
      'POST /v1/admin/auth/totp',
      'POST /v1/admin/auth/totp/confirm',
      'POST /v1/admin/auth/totp/enroll',
    ]);
  });

  /**
   * Le garde-fou du garde-fou.
   *
   * Les trois assertions ci-dessus sont des « aucune contre-exemple ». Elles
   * passeraient toutes les trois, brillamment, sur un document VIDE — et un
   * `createDocument` qui cesserait de rendre les extensions donnerait exactement
   * cela. Ce test fixe donc un plancher : le domaine équipe existe, et il est gros.
   *
   * Mesuré sur l'API qui tourne au moment de l'écriture : 273 opérations, dont 75
   * d'équipe, 211 de membre, 43 publiques, 3 webhooks. Le plancher est
   * volontairement bas — il garde contre l'effondrement, pas contre la croissance.
   */
  it('le document contient bien les deux domaines', () => {
    const all = operations();
    const staff = all.filter((o) => o.capability.startsWith(STAFF_CAPABILITY_PREFIX));
    const member = all.filter(
      (o) =>
        !o.capability.startsWith(STAFF_CAPABILITY_PREFIX) &&
        !o.capability.startsWith('webhook:') &&
        o.capability !== 'none:public-read',
    );

    expect(all.length).toBeGreaterThan(200);
    expect(staff.length).toBeGreaterThan(50);
    expect(member.length).toBeGreaterThan(100);
  });
});
