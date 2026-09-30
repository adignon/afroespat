import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import { newId } from '@app/db';
import { AppModule } from '../../app.module';
import { ApiErrorFilter } from '../error.filter';
import { PrismaService } from '../prisma.service';
import { TokenService } from '../token.service';
import { QueueService } from '../../queue/queue.service';
import { RATE_LIMIT_CONFIG, type RateLimitConfig } from '../rate-limit.guard';

/**
 * La limite de débit — 00-fondations.md §5.5.
 *
 * CE QUE CE FICHIER EXISTE POUR EMPÊCHER DE REVENIR.
 *
 * `@RateLimit(n)` a longtemps ne limité RIEN : la métadonnée était posée,
 * `x-rate-limit` était émis dans l'OpenAPI, et personne ne la lisait. Quinze
 * contrôleurs déclaraient une limite qui n'existait pas, dont l'envoi d'un code
 * par SMS. Un décorateur muet ne casse aucun test — il n'y en avait aucun.
 *
 * Le test le plus important de ce fichier est donc celui du BALAYAGE DE NUMÉROS :
 * il appelle `otp/request` avec un numéro DIFFÉRENT à chaque fois, ce qui évite
 * la limite par numéro que le service applique déjà, et ne laisse debout que la
 * limite par IP — exactement la protection qui manquait, et la seule qui arrête
 * quelqu'un qui essaie des numéros en série à nos frais.
 */
describe('limite de débit (§5.5)', () => {
  const server = (app: INestApplication): Server => app.getHttpServer() as Server;

  /** Budgets globaux serrés, pour que le refus arrive en quelques appels. */
  let tight: INestApplication;
  /** Budgets globaux larges : sert à éprouver le budget de ROUTE sans qu'un plafond global ne morde d'abord. */
  let loose: INestApplication;
  let prisma: PrismaService;
  let tokens: TokenService;
  const userIds: string[] = [];
  const phoneIds: string[] = [];

  async function build(config: RateLimitConfig): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Le vrai fournisseur lit `RATE_LIMIT_ENABLED`, que le dépôt coupe en
      // développement — sans quoi des dizaines de tests sans rapport échoueraient
      // en se partageant le budget d'une seule IP. Ici on l'ACTIVE, avec nos
      // propres chiffres : c'est toute la raison pour laquelle la configuration
      // est un fournisseur injecté et non un appel à `loadEnv()` dans le garde.
      .overrideProvider(RATE_LIMIT_CONFIG)
      .useValue(config)
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
    return app;
  }

  /** Un membre réel et son jeton, pour que l'identité du budget soit le MEMBRE. */
  async function member(): Promise<string> {
    const id = newId();
    const country = await prisma.country.findFirstOrThrow({ select: { id: true } });
    await prisma.user.create({
      data: {
        id,
        handle: `deb${id.slice(-10)}`,
        displayName: 'Débit',
        status: 'ACTIVE',
        verificationLevel: 'L0',
        phase: 'PRE_DEPARTURE',
        plan: 'FREE',
        originCountryId: country.id,
      },
    });
    userIds.push(id);
    return tokens.sign({
      sub: id,
      sid: newId(),
      level: 'L0',
      plan: 'FREE',
      status: 'ACTIVE',
      exp: Math.floor(Date.now() / 1000) + 900,
    });
  }

  beforeAll(async () => {
    tight = await build({ enabled: true, requestsPerMinute: 8, writesPerMinute: 3 });
    loose = await build({ enabled: true, requestsPerMinute: 500, writesPerMinute: 500 });
    prisma = tight.get(PrismaService);
    tokens = tight.get(TokenService);
  });

  /**
   * Les seaux de l'IP sont PARTAGÉS par tous les tests de ce fichier — c'est la
   * nature même d'une identité par adresse. On les efface donc entre les tests,
   * faute de quoi le second à s'exécuter hériterait du compteur du premier et
   * échouerait selon l'ordre. Les seaux par membre, eux, n'ont pas ce problème :
   * chaque test crée son propre membre.
   */
  beforeEach(async () => {
    const redis = tight.get(QueueService).redis;
    const keys = await redis.keys('rl-*ip-*');
    if (keys.length > 0) await redis.del(...keys);
  });

  afterAll(async () => {
    if (phoneIds.length > 0) {
      await prisma.phoneNumber.deleteMany({ where: { id: { in: phoneIds } } });
    }
    if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await tight.close();
    await loose.close();
  });

  it('[RÈGLE DURE] le balayage de numéros est arrêté par la limite de ROUTE, par IP', async () => {
    /**
     * 01 §2 : « 10 par IP et par heure ». Un numéro DIFFÉRENT à chaque appel, pour
     * que la limite par numéro (3/h, appliquée par le service) ne se déclenche pas
     * et ne masque pas ce qu'on mesure.
     *
     * Ce test échouait AVANT que le garde existe : les onze appels passaient, et
     * onze SMS partaient.
     */
    const statuses: number[] = [];
    for (let n = 0; n < 11; n += 1) {
      const response = await request(server(loose))
        .post('/v1/auth/otp/request')
        .send({ phone: `+3361234${String(5000 + n).padStart(4, '0')}`, countryIso2: 'FR', purpose: 'LOGIN' });
      statuses.push(response.status);
    }

    // Les dix premiers ne sont pas forcément 200 — un numéro peut être refusé pour
    // une autre raison — mais AUCUN ne doit être 429, et le onzième doit l'être.
    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses[10]).toBe(429);
  });

  /**
   * ═══ RÈGLE DURE ═══
   *
   * Le budget d'une route de CONNEXION ne se renouvelle pas en présentant un jeton.
   *
   * CE QUE CE TEST EXISTE POUR EMPÊCHER DE REVENIR, et c'était mesuré :
   * `@PublicRead()` n'empêche pas `AuthGuard` de poser `request.auth` quand un
   * jeton de membre valide accompagne la requête — il le pose, puis rend la main.
   * `identityOf` préférait alors ce membre à l'IP, si bien que CHAQUE COMPTE MEMBRE
   * APPORTAIT UN BUDGET NEUF sur `POST /admin/auth/login`. Relevé dans Redis :
   * trois seaux pour la même route, deux par membre et un par IP. Avec deux comptes
   * gratuits, 15 tentatives par minute depuis une seule adresse au lieu de 5.
   *
   * La route n'utilise aucune identité de membre pour décider quoi que ce soit —
   * il n'y avait donc pas de passerelle entre les domaines. Mais le verrou
   * anti-force-brute était affaibli d'un facteur égal au nombre de comptes que
   * l'attaquant se crée, et rien ne le disait.
   *
   * On ÉPUISE le budget sans jeton, puis on revient AVEC un jeton de membre, puis
   * avec celui d'un SECOND membre. Les deux doivent rester refusés : c'est l'IP qui
   * porte le budget, et elle ne change pas.
   *
   * Les identifiants envoyés sont faux à dessein. Ce qu'on mesure est le REFUS DE
   * DÉBIT (429), pas l'échec d'authentification (401) — et c'est précisément ce que
   * l'assertion distingue.
   */
  it('[RÈGLE DURE] présenter un jeton ne rouvre pas le budget d’une route de connexion', async () => {
    const login = () => request(server(loose)).post('/v1/admin/auth/login');
    const faux = { email: 'inconnu@example.test', password: 'mauvais-mot-de-passe' };

    // Cinq essais anonymes : le budget de route (5/min, par IP) est épuisé.
    for (let i = 0; i < 5; i += 1) await login().send(faux);
    const sixieme = await login().send(faux);
    expect(sixieme.status, 'le sixième essai anonyme doit être refusé par le débit').toBe(429);

    // Le même adversaire, muni d'un compte membre gratuit.
    const premier = await member();
    const avecJeton = await login().set('Authorization', `Bearer ${premier}`).send(faux);
    expect(
      avecJeton.status,
      'un jeton de membre a rouvert le budget de la connexion d’équipe',
    ).toBe(429);

    // Et d'un second, parce que s'en créer un de plus ne coûte rien.
    const second = await member();
    const avecAutreJeton = await login().set('Authorization', `Bearer ${second}`).send(faux);
    expect(
      avecAutreJeton.status,
      'un SECOND compte membre a rouvert le budget — le verrou se contourne en s’inscrivant',
    ).toBe(429);
  });

  it('le refus nomme le code du catalogue et porte `Retry-After`', async () => {
    for (let n = 0; n < 10; n += 1) {
      await request(server(loose))
        .post('/v1/auth/otp/request')
        .send({ phone: `+3362234${String(1000 + n).padStart(4, '0')}`, countryIso2: 'FR', purpose: 'LOGIN' });
    }
    const refused = await request(server(loose))
      .post('/v1/auth/otp/request')
      .send({ phone: '+33622349999', countryIso2: 'FR', purpose: 'LOGIN' });

    expect(refused.status).toBe(429);
    const body = refused.body as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    // L'en-tête normalisé : sans lui, un client réessaie en boucle et aggrave
    // précisément ce qu'on limite.
    const retryAfter = Number(refused.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    // Période d'une HEURE : la valeur doit dépasser la minute, sinon la période
    // déclarée par le décorateur n'a pas été lue.
    expect(retryAfter).toBeGreaterThan(60);
  });

  it('le budget est porté par le MEMBRE, pas par la connexion', async () => {
    const a = await member();
    const b = await member();

    const statuses: number[] = [];
    for (let n = 0; n < 9; n += 1) {
      const response = await request(server(tight))
        .get('/v1/notifications')
        .set('Authorization', `Bearer ${a}`);
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 8)).not.toContain(429);
    expect(statuses[8]).toBe(429);

    // Le membre B n'a rien consommé : son budget est intact, bien que la requête
    // vienne de la MÊME adresse. C'est ce que §5.5 veut dire par « par membre ».
    const other = await request(server(tight))
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${b}`);
    expect(other.status).not.toBe(429);
  });

  it('les écritures ont leur propre budget, plus serré que les lectures', async () => {
    const token = await member();

    const writes: number[] = [];
    for (let n = 0; n < 4; n += 1) {
      const response = await request(server(tight))
        .post('/v1/notifications/read')
        .set('Authorization', `Bearer ${token}`)
        .send({ all: true });
      writes.push(response.status);
    }
    // 3 écritures autorisées, la 4e refusée — alors que le plafond de 8 requêtes
    // n'est pas atteint. Les deux budgets sont donc bien distincts.
    expect(writes.slice(0, 3)).not.toContain(429);
    expect(writes[3]).toBe(429);
    const refused = await request(server(tight))
      .post('/v1/notifications/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ all: true });
    const body = refused.body as { error: { details: { scope: string } } };
    // Le refus NOMME le budget qui a mordu : sans cela, on ne saurait pas si c'est
    // le plafond des écritures ou celui des requêtes qui a refusé.
    expect(body.error.details.scope).toBe('écritures');
  });

  it('une lecture n’entame pas le budget d’écriture', async () => {
    const token = await member();
    for (let n = 0; n < 3; n += 1) {
      await request(server(tight)).get('/v1/notifications').set('Authorization', `Bearer ${token}`);
    }
    // Trois lectures faites ; les trois écritures doivent rester disponibles.
    for (let n = 0; n < 3; n += 1) {
      const response = await request(server(tight))
        .post('/v1/notifications/read')
        .set('Authorization', `Bearer ${token}`)
        .send({ all: true });
      expect(response.status).not.toBe(429);
    }
  });

  it('une panne Redis LAISSE PASSER, et le dit dans le journal', async () => {
    const token = await member();
    const queues = loose.get(QueueService);
    const broken = {
      eval: () => Promise.reject(new Error('Redis injoignable (simulé)')),
    } as unknown as ReturnType<() => typeof queues.redis>;
    const spy = vi.spyOn(queues, 'redis', 'get').mockReturnValue(broken);

    try {
      // Bien au-delà de tout budget : si le garde refusait en cas de panne, ceci
      // serait un 429. Refuser ferait d'un hoquet Redis une panne totale de l'API,
      // alors que la limite protège d'un abus, pas d'une faille.
      for (let n = 0; n < 12; n += 1) {
        const response = await request(server(loose))
          .get('/v1/notifications')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).not.toBe(429);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it('coupée, elle ne compte rien du tout', async () => {
    const off = await build({ enabled: false, requestsPerMinute: 1, writesPerMinute: 1 });
    try {
      const token = await member();
      for (let n = 0; n < 5; n += 1) {
        const response = await request(server(off))
          .get('/v1/notifications')
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).not.toBe(429);
      }
    } finally {
      await off.close();
    }
  });
});
