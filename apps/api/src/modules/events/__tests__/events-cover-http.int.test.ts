import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AppModule } from '../../../app.module';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { FakeSmsProvider, SMS_PROVIDER } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';

/**
 * COUVERTURE D'ÉVÉNEMENT — les CODES DE RETOUR, mesurés par HTTP.
 *
 * ═══ POURQUOI CE FICHIER EXISTE À CÔTÉ DE `events.int.test.ts` ═════════════
 *
 * `events.int.test.ts` dit, et il a raison, que les règles du §3 se vérifient sur
 * le SERVICE : la capacité est l'affaire du garde, et un jeton par cas
 * n'ajouterait rien aux règles elles-mêmes.
 *
 * Mais la règle posée ici n'est pas seulement « ce rattachement est refusé » :
 * c'est « il est refusé par un **404** quand le genre ou le propriétaire ne va
 * pas, et par un **400** quand seul le statut ne va pas ». Or un test de service
 * ne voit QUE le code applicatif de l'`ApiError` (`NOT_FOUND`,
 * `VALIDATION_FAILED`). La correspondance vers le code HTTP vit ailleurs — dans
 * le catalogue d'erreurs et `ApiErrorFilter` — et n'est donc pas éprouvée par
 * lui. Le choix du 404 est tout l'argument « l'identifiant ne doit pas devenir un
 * oracle d'existence » ; non mesuré sur le fil, il n'est pas tenu.
 *
 * C'est donc la MATRICE DES CODES DE RETOUR qui est mesurée ici, et rien d'autre.
 */

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

describe('couverture d’événement — codes de retour HTTP (09 §3.1, 00 §8.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let sms: FakeSmsProvider;

  const createdUsers: string[] = [];
  const createdEvents: string[] = [];
  const createdMediaIds: string[] = [];
  let cityId = '';
  let counter = 0;

  /** Un numéro distinct par appel : les limites d'OTP sont PAR NUMÉRO. */
  const nextPhone = (): string => {
    counter += 1;
    return `9${String(Date.now()).slice(-6)}${String(counter).padStart(2, '0')}`;
  };

  /**
   * Un membre L1 avec un jeton FRAIS.
   *
   * Les deux temps ne sont pas décoratifs : une inscription naît L0, et
   * `event.create` demande L1. Promouvoir APRÈS avoir émis le jeton le rendrait
   * périmé (`assertTokenFresh` → `TOKEN_STALE`), et les appels partiraient en 401
   * — un échec qui ressemblerait à un refus de couverture sans en être un. On
   * promeut donc, PUIS on reprend une session.
   *
   * Deux OTP par numéro au total, pour une limite de service à trois par heure.
   */
  async function memberL1(): Promise<{ userId: string; accessToken: string }> {
    const phone = nextPhone();
    const first = await auth.requestOtp({
      phone,
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const signup = await auth.verifyOtp({
      challengeId: first.challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    createdUsers.push(signup.userId);

    await prisma.user.update({
      where: { id: signup.userId },
      data: { verificationLevel: 'L1', cityId },
    });

    const again = await auth.requestOtp({
      phone,
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'LOGIN',
      ip: undefined,
    });
    const session = await auth.verifyOtp({
      challengeId: again.challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    return { userId: signup.userId, accessToken: session.accessToken };
  }

  async function asset(
    ownerUserId: string,
    kind: 'EVENT_COVER' | 'PROOF',
    status: 'READY' | 'REJECTED' = 'READY',
  ): Promise<string> {
    const row = await prisma.mediaAsset.create({
      data: {
        id: newId(),
        ownerUserId,
        kind,
        storageKey: `test/evt-http/${newId()}.jpg`,
        mime: 'image/jpeg',
        sizeBytes: BigInt(4096),
        status,
        exifStripped: true,
      },
    });
    createdMediaIds.push(row.id);
    return row.id;
  }

  const body = (coverAssetId: string) => ({
    type: 'PICNIC',
    title: 'Pique-nique du dimanche',
    cityId,
    addressText: 'Parc de la Tête d’Or, entrée nord',
    startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    coverAssetId,
  });

  beforeAll(async () => {
    sms = new FakeSmsProvider();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use(cookieParser());
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();

    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    if (createdEvents.length > 0) {
      await prisma.event.deleteMany({ where: { id: { in: createdEvents } } });
    }
    if (createdUsers.length > 0) {
      await prisma.event.deleteMany({ where: { organizerUserId: { in: createdUsers } } });
      if (createdMediaIds.length > 0) {
        await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
      }
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await app.close();
  });

  it('rend 201 · 404 · 404 · 400 selon le propriétaire, le genre et le statut', async () => {
    const me = await memberL1();
    const other = await memberL1();
    const bearer = `Bearer ${me.accessToken}`;

    // ── PRÉMISSE : la couverture licite est ACCEPTÉE, et 201 ────────────────
    //
    // Sans cette ligne, les trois refus qui suivent seraient aussi obtenus par
    // une route qui refuse TOUTE couverture, ou qui répond 401 pour une raison
    // d'authentification.
    const mine = await asset(me.userId, 'EVENT_COVER');
    const created = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', bearer)
      .send(body(mine))
      .expect(201);
    createdEvents.push((created.body as { id: string }).id);
    expect((created.body as { coverAssetId?: string }).coverAssetId ?? mine).toBe(mine);

    // ── LE MÉDIA D'UN AUTRE MEMBRE : 404 ───────────────────────────────────
    //
    // C'était le trou le plus large : le propriétaire n'était pas vérifié du tout.
    const hers = await asset(other.userId, 'EVENT_COVER');
    const foreign = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', bearer)
      .send(body(hers))
      .expect(404);
    expect((foreign.body as ErrorBody).error.code).toBe('NOT_FOUND');

    // ── SON PROPRE JUSTIFICATIF : 404, et NON 403 ──────────────────────────
    //
    // 00 §8.1 : « accès équipe uniquement, jamais affiché ». Un 403 « mauvais
    // genre » apprendrait qu'un justificatif existe sous cet identifiant ; le
    // genre étant le premier segment de la clé de stockage, il daterait même son
    // dépôt. Le refus est donc indistinguable d'un identifiant inconnu.
    const proof = await asset(me.userId, 'PROOF');
    const wrongKind = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', bearer)
      .send(body(proof))
      .expect(404);
    expect((wrongKind.body as ErrorBody).error.code).toBe('NOT_FOUND');

    // Et un identifiant qui n'existe NULLE PART rend exactement la même chose :
    // c'est la preuve que les deux refus sont indiscernables de l'extérieur.
    const unknown = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', bearer)
      .send(body(newId()))
      .expect(404);
    expect((unknown.body as ErrorBody).error.code).toBe('NOT_FOUND');
    expect((unknown.body as ErrorBody).error.message).toBe(
      (wrongKind.body as ErrorBody).error.message,
    );

    // ── UN MÉDIA REFUSÉ PAR L'ANTIVIRUS : 400, et non 404 ──────────────────
    //
    // Celui-là, le membre vient de l'envoyer et sait qu'il existe. Sa clé est
    // réservée SANS OCTETS DESSOUS, donc l'accepter donnerait un bandeau
    // introuvable ; mais lui répondre 404 l'enverrait chercher un identifiant
    // perdu. Le genre et le propriétaire sont bons : seul le statut refuse.
    const rejected = await asset(me.userId, 'EVENT_COVER', 'REJECTED');
    const notReady = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', bearer)
      .send(body(rejected))
      .expect(400);
    expect((notReady.body as ErrorBody).error.code).toBe('VALIDATION_FAILED');
    expect((notReady.body as ErrorBody).error.details).toMatchObject({
      fields: [{ path: 'coverAssetId', code: 'MEDIA_NOT_READY' }],
    });
  });

  it('applique la même matrice à la MODIFICATION (PATCH), second point de rattachement', async () => {
    const me = await memberL1();
    const other = await memberL1();
    const bearer = `Bearer ${me.accessToken}`;

    const mine = await asset(me.userId, 'EVENT_COVER');
    const created = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', bearer)
      .send(body(mine))
      .expect(201);
    const eventId = (created.body as { id: string }).id;
    createdEvents.push(eventId);

    const patch = (coverAssetId: string) =>
      request(httpServer(app))
        .patch(`/v1/events/${eventId}`)
        .set('authorization', bearer)
        .send({ coverAssetId });

    await patch(await asset(other.userId, 'EVENT_COVER')).expect(404);
    await patch(await asset(me.userId, 'PROOF')).expect(404);
    await patch(await asset(me.userId, 'EVENT_COVER', 'REJECTED')).expect(400);

    // La couverture d'origine est INTACTE après les trois refus : un refus ne
    // doit pas avoir écrit à moitié.
    const row = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { coverAssetId: true },
    });
    expect(row.coverAssetId).toBe(mine);

    // Et le remplacement LICITE passe toujours, en 200 : sans quoi tout ce qui
    // précède serait obtenu en refusant simplement toute modification.
    const second = await asset(me.userId, 'EVENT_COVER');
    await patch(second).expect(200);
    const after = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { coverAssetId: true },
    });
    expect(after.coverAssetId).toBe(second);
  });
});
