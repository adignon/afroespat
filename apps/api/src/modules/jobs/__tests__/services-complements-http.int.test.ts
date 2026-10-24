import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  jobSeekersListResponseSchema,
  myJobSeekerProfileResponseSchema,
  rsvpResponseSchema,
  servicesCountsResponseSchema,
} from '@app/shared';
import { AppModule } from '../../../app.module';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';
import { FakeSmsProvider, SMS_PROVIDER } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';

/**
 * LOT E2 — ce que les écrans Services attendent des routes, mesuré PAR HTTP.
 *
 * Trois choses, chacune avec son code de retour (que seul le fil vérifie : un test de
 * service ne voit que le code applicatif) :
 *
 *   · `GET /services/counts` — les compteurs du panneau de gauche : publics, `mine`
 *     seulement avec une session, et identiques aux totaux des listes ;
 *   · `GET|PUT|DELETE /me/job-seeker-profile` — l'onglet « Mon profil de recherche »
 *     de S04. MESURÉ : sans profil, `GET` répond `200` au corps VIDE (pas `null`) ;
 *     `PUT` est une publication, donc L1 (`post.create`) ;
 *   · `PUT /events/:id/rsvp` — la position en liste d'attente voyage dans la réponse,
 *     et `event.attend` est L1 : un L1 s'inscrit, un L0 reçoit `403 LEVEL_REQUIRED`, et créer
 *     un événement (`event.create`) reste L2. Décision du porteur du 2026-10-24
 *     (« L1 pour s'inscrire, L2 pour créer »). Ce cas figeait l'inverse — « un L1 reçoit
 *     403 » — depuis l'arbitrage du 2026-10-09 (« N2 : faire tout le reste ») ; c'est le test
 *     qu'on corrige, la matrice L1 de 09 §3.2 était la bonne pour l'inscription.
 */

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

describe('services — compléments du lot E2 (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let sms: FakeSmsProvider;
  let cityId = '';
  let counter = 100;
  const createdUsers: string[] = [];
  const createdEvents: string[] = [];

  /** Un membre au niveau demandé, avec un jeton FRAIS (voir `events-cover-http`). */
  async function membre(niveau: 'L0' | 'L1' | 'L2'): Promise<{ userId: string; bearer: string }> {
    counter += 1;
    const phone = numeroDEpreuve(counter);
    const first = await auth.requestOtp({ phone, countryIso2: 'BJ', captchaToken: 'test', purpose: 'SIGNUP', ip: undefined });
    const signup = await auth.verifyOtp({
      challengeId: first.challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    createdUsers.push(signup.userId);
    if (niveau === 'L0') return { userId: signup.userId, bearer: `Bearer ${signup.accessToken}` };

    await prisma.user.update({ where: { id: signup.userId }, data: { verificationLevel: niveau, cityId } });
    const again = await auth.requestOtp({ phone, countryIso2: 'BJ', captchaToken: 'test', purpose: 'LOGIN', ip: undefined });
    const session = await auth.verifyOtp({
      challengeId: again.challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    return { userId: signup.userId, bearer: `Bearer ${session.accessToken}` };
  }

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
    if (createdEvents.length > 0) await prisma.event.deleteMany({ where: { id: { in: createdEvents } } });
    await prisma.event.deleteMany({ where: { organizerUserId: { in: createdUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await app.close();
  });

  // ── GET /services/counts ──────────────────────────────────────────────────

  it('GET /services/counts : public, `mine` seulement avec une session, totaux = ceux des listes', async () => {
    // `job.publish` est L2 (« tout le reste », refonte des niveaux du 2026-10-09).
    const { bearer } = await membre('L2');

    const anonyme = await request(httpServer(app)).get('/v1/services/counts').expect(200);
    expect(servicesCountsResponseSchema.parse(anonyme.body).mine).toBeNull();

    // Le compteur retrouve exactement ce que la liste affiche.
    const [logements, offres] = await Promise.all([
      request(httpServer(app)).get('/v1/housing?limit=1').expect(200),
      request(httpServer(app)).get('/v1/jobs?limit=1').expect(200),
    ]);
    expect(anonyme.body).toMatchObject({
      housing: (logements.body as { meta: { total: number } }).meta.total,
      jobs: (offres.body as { meta: { total: number } }).meta.total,
    });

    const avant = servicesCountsResponseSchema.parse(
      (await request(httpServer(app)).get('/v1/services/counts').set('authorization', bearer).expect(200)).body,
    );
    expect(avant.mine).toBe(0);

    // Une offre publiée (gratuit) entre dans « Mes annonces » ET dans le total des offres.
    await request(httpServer(app))
      .post('/v1/jobs')
      .set('authorization', bearer)
      .send({
        kind: 'JOB',
        title: 'Comptable junior',
        description: 'Poste à pourvoir dans une équipe de cinq personnes, formation interne assurée, mutuelle.',
        cityId,
      })
      .expect(201);
    const apres = servicesCountsResponseSchema.parse(
      (await request(httpServer(app)).get('/v1/services/counts').set('authorization', bearer).expect(200)).body,
    );
    expect(apres.mine).toBe(1);
    expect(apres.jobs).toBe(avant.jobs + 1);
  });

  // ── /me/job-seeker-profile ────────────────────────────────────────────────

  it('profil de recherche : GET vide = 200 sans corps, PUT est L1, valide, relu, listé, retiré', async () => {
    const l0 = await membre('L0');
    const l1 = await membre('L1');
    const profil = { headline: 'Assistante RH · alternance', sectors: ['RH'], contractTypes: ['Alternance'], isVisible: true };

    // Sans profil : 200 et corps VIDE (le front l'accepte explicitement).
    const vide = await request(httpServer(app)).get('/v1/me/job-seeker-profile').set('authorization', l1.bearer).expect(200);
    expect(vide.text).toBe('');

    // Un L0 lit (content.read) mais ne publie pas : 403 LEVEL_REQUIRED, avec la capacité.
    await request(httpServer(app)).get('/v1/me/job-seeker-profile').set('authorization', l0.bearer).expect(200);
    const refus = await request(httpServer(app)).put('/v1/me/job-seeker-profile').set('authorization', l0.bearer).send(profil).expect(403);
    expect((refus.body as ErrorBody).error.code).toBe('LEVEL_REQUIRED');
    expect((refus.body as ErrorBody).error.details).toMatchObject({ capability: 'post.create' });

    // Le schéma est partagé : un titre trop court, un champ de CV, trop d'entrées → 400.
    await request(httpServer(app)).put('/v1/me/job-seeker-profile').set('authorization', l1.bearer).send({ ...profil, headline: 'abc' }).expect(400);
    await request(httpServer(app)).put('/v1/me/job-seeker-profile').set('authorization', l1.bearer).send({ ...profil, cvAssetId: 'x' }).expect(400);
    await request(httpServer(app))
      .put('/v1/me/job-seeker-profile')
      .set('authorization', l1.bearer)
      .send({ ...profil, sectors: Array.from({ length: 11 }, (_, i) => `Secteur ${i}`) })
      .expect(400);

    // PUT crée, GET relit, la liste publique le montre (visible), la forme est celle du schéma.
    const cree = await request(httpServer(app)).put('/v1/me/job-seeker-profile').set('authorization', l1.bearer).send(profil).expect(200);
    expect(myJobSeekerProfileResponseSchema.parse(cree.body)).toMatchObject(profil);
    const relu = await request(httpServer(app)).get('/v1/me/job-seeker-profile').set('authorization', l1.bearer).expect(200);
    expect(myJobSeekerProfileResponseSchema.parse(relu.body)).toMatchObject({ headline: profil.headline });
    const handle = (await prisma.user.findUniqueOrThrow({ where: { id: l1.userId }, select: { handle: true } })).handle;
    const liste = jobSeekersListResponseSchema.parse((await request(httpServer(app)).get('/v1/job-seekers?limit=50').expect(200)).body);
    expect(liste.items.map((i) => i.member.handle)).toContain(handle);

    // PUT remplace (un seul profil) ; masqué, il disparaît de la liste.
    await request(httpServer(app)).put('/v1/me/job-seeker-profile').set('authorization', l1.bearer).send({ ...profil, isVisible: false }).expect(200);
    const masque = jobSeekersListResponseSchema.parse((await request(httpServer(app)).get('/v1/job-seekers?limit=50').expect(200)).body);
    expect(masque.items.map((i) => i.member.handle)).not.toContain(handle);
    expect(await prisma.jobSeekerProfile.count({ where: { userId: l1.userId } })).toBe(1);

    // DELETE le retire ; une seconde fois, il n'y avait plus rien.
    expect((await request(httpServer(app)).delete('/v1/me/job-seeker-profile').set('authorization', l1.bearer).expect(200)).body).toEqual({ deleted: true });
    expect((await request(httpServer(app)).delete('/v1/me/job-seeker-profile').set('authorization', l1.bearer).expect(200)).body).toEqual({ deleted: false });
    expect((await request(httpServer(app)).get('/v1/me/job-seeker-profile').set('authorization', l1.bearer).expect(200)).text).toBe('');
  });

  // ── PUT /events/:id/rsvp ──────────────────────────────────────────────────

  it('RSVP : la position en liste d’attente voyage dans la réponse ; event.attend est L1 (un L0 reçoit 403, un L1 ne peut pas créer)', async () => {
    const organisateur = await membre('L2');
    const a = await membre('L1');
    const b = await membre('L1');
    const l1 = await membre('L1');
    const l0 = await membre('L0');

    const cree = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', organisateur.bearer)
      .send({
        type: 'PICNIC',
        title: 'Pique-nique du dimanche',
        cityId,
        addressText: 'Parc de la Tête d’Or, entrée nord',
        startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        capacity: 2,
      })
      .expect(201);
    const eventId = (cree.body as { id: string }).id;
    createdEvents.push(eventId);

    // La décision du porteur (2026-10-24) : s'inscrire est L1, créer reste L2.
    const refus = await request(httpServer(app)).put(`/v1/events/${eventId}/rsvp`).set('authorization', l0.bearer).send({ status: 'GOING' }).expect(403);
    expect((refus.body as ErrorBody).error.code).toBe('LEVEL_REQUIRED');
    expect((refus.body as ErrorBody).error.details).toMatchObject({ capability: 'event.attend', requiredLevel: 'L1', currentLevel: 'L0' });
    const refusCreation = await request(httpServer(app))
      .post('/v1/events')
      .set('authorization', l1.bearer)
      .send({ type: 'PICNIC', title: 'Pique-nique refusé', cityId, addressText: 'Parc de la Tête d’Or, entrée nord', startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })
      .expect(403);
    expect((refusCreation.body as ErrorBody).error.details).toMatchObject({ capability: 'event.create', requiredLevel: 'L2' });
    // `a` et `b` sont L1 : leurs RSVP ci-dessous (200) prouvent qu'un L1 s'inscrit.

    // Capacité 2, l'organisateur occupe une place : `a` est confirmé, `b` attend en 1re position.
    const rsvpA = await request(httpServer(app)).put(`/v1/events/${eventId}/rsvp`).set('authorization', a.bearer).send({ status: 'GOING' }).expect(200);
    expect(rsvpResponseSchema.parse(rsvpA.body)).toEqual({ status: 'GOING', waitlistPosition: null, attendeeCount: 2 });
    const rsvpB = await request(httpServer(app)).put(`/v1/events/${eventId}/rsvp`).set('authorization', b.bearer).send({ status: 'GOING' }).expect(200);
    expect(rsvpResponseSchema.parse(rsvpB.body)).toEqual({ status: 'WAITLIST', waitlistPosition: 1, attendeeCount: 2 });

    // Le client ne peut pas se mettre lui-même en liste d'attente.
    await request(httpServer(app)).put(`/v1/events/${eventId}/rsvp`).set('authorization', b.bearer).send({ status: 'WAITLIST' }).expect(400);

    // Le détail dit la même position que la réponse.
    const detail = await request(httpServer(app)).get(`/v1/events/${eventId}`).set('authorization', b.bearer).expect(200);
    expect((detail.body as { myWaitlistPosition: number | null }).myWaitlistPosition).toBe(1);

    // `a` se retire : `b` est promu, sa position disparaît.
    await request(httpServer(app)).delete(`/v1/events/${eventId}/rsvp`).set('authorization', a.bearer).expect(200);
    const promu = await request(httpServer(app)).get(`/v1/events/${eventId}`).set('authorization', b.bearer).expect(200);
    expect(promu.body).toMatchObject({ myStatus: 'GOING', myWaitlistPosition: null });
  });
});
