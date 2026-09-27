import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppModule } from '../../app.module';

type OpenApiView = { paths: Record<string, Record<string, { 'x-capability'?: string }>> };

/** Le corps d'erreur de §5.2, typé : un test qui manipule du `any` ne vérifie rien. */
interface ErrorBody {
  error: { code: string; message: string; details?: { fields?: { path: string; code: string }[] } };
}

interface CountryList {
  items: { iso2: string; nameFr: string }[];
  nextCursor: string | null;
}

/** `getHttpServer()` renvoie `any` : on le ramène au type réel une seule fois. */
function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}
import { ApiErrorFilter } from '../error.filter';

/**
 * RÈGLE DURE (00-fondations.md §7.3) :
 *
 *   « Toute route d'écriture déclare une capacité requise. Un test d'intégration
 *     parcourt toutes les routes et échoue si une route non-GET n'en déclare pas. »
 *
 * Voici ce test. Il lit l'OpenAPI généré plutôt que les métadonnées Nest : c'est
 * le même document que consomme le client typé du front, donc si la capacité y
 * manque, elle manque partout.
 */
describe('couverture des capacités (règle dure §7.3)', () => {
  let app: INestApplication;
  /** Vue minimale de l'OpenAPI : seul `x-capability` nous intéresse ici. */
  let document: OpenApiView;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();

    // `as unknown as` : le type OpenAPIObject de Nest est plus large que la vue
    // dont ce test a besoin, et TypeScript refuse le rétrécissement direct.
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1.0').build(),
    ) as unknown as OpenApiView;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('toute route non-GET déclare une capacité', () => {
    const missing: string[] = [];
    for (const [path, operations] of Object.entries(document.paths)) {
      for (const [verb, op] of Object.entries(operations)) {
        if (verb.toLowerCase() === 'get') continue;
        if (op['x-capability'] === undefined) missing.push(`${verb.toUpperCase()} ${path}`);
      }
    }
    expect(
      missing,
      `Routes d'écriture sans @RequiresCapability :\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('toute route de lecture déclare une capacité ou se dit publique', () => {
    // Une omission doit toujours être une erreur, jamais « peut-être voulu ».
    const missing: string[] = [];
    for (const [path, operations] of Object.entries(document.paths)) {
      for (const [verb, op] of Object.entries(operations)) {
        if (op['x-capability'] === undefined) missing.push(`${verb.toUpperCase()} ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('aucune route n’expose un compteur de vues (règle dure §1.2)', () => {
    // Le schéma OpenAPI est le contrat : si viewCount y apparaît, il finira à l'écran.
    const serialized = JSON.stringify(document);
    expect(serialized).not.toMatch(/viewCount|view_count/);
  });
});

describe('conventions d’API (§5.2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('une route inconnue répond au format error { code, message }', async () => {
    const res = await request(httpServer(app)).get('/v1/nexistepas').expect(404);
    const body = res.body as ErrorBody;
    expect(body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(typeof body.error.message).toBe('string');
  });

  it('une validation échouée renvoie details.fields (T4 §3)', async () => {
    const res = await request(httpServer(app))
      .get('/v1/places/cities?countryId=pas-un-uuid')
      .expect(400);
    const body = res.body as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details?.fields?.[0]).toMatchObject({ path: 'countryId' });
  });

  it('les listes renvoient { items, nextCursor } (§5.3)', async () => {
    const res = await request(httpServer(app)).get('/v1/places/countries').expect(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('nextCursor');
  });

  // RÈGLE (02 §2.1) : un pays inactif n'apparaît nulle part côté membres.
  it('seuls les pays actifs sont exposés', async () => {
    const res = await request(httpServer(app)).get('/v1/places/countries').expect(200);
    const iso = (res.body as CountryList).items.map((c) => c.iso2);
    expect(iso).toContain('FR');
    expect(iso).toContain('BJ');
    // Le Togo est chargé mais inactif : il ne doit pas sortir.
    expect(iso).not.toContain('TG');
  });
});
