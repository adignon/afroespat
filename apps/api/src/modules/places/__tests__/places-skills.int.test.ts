import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MEMBER_SKILLS_MAX, placesSkillSchema, placesSkillsResponseSchema } from '@app/shared';
import { newId } from '@app/db';
import { AppModule } from '../../../app.module';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { RATE_LIMIT_CONFIG } from '../../../common/rate-limit.guard';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';
import { FakeSmsProvider, SMS_PROVIDER } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';

/**
 * `POST /places/skills` — un membre ajoute une compétence au référentiel (le « free typing »).
 *
 * Décision du porteur : « Crée la route `POST /places/skills` (ajout d'une compétence au
 * référentiel par un membre) ». Les règles éprouvées ici sont celles de l'en-tête de la route :
 * forme, déduplication sans casse ni accent, collision d'un autre membre, compétence retirée,
 * plafond personnel, débit, et — surtout — la VISIBILITÉ : une compétence personnelle n'est
 * proposée qu'à son auteur tant que l'équipe ne l'a pas globalisée.
 *
 * La capacité est `content.read` (L0), comme les autres écritures de profil : l'inscription
 * appelle cette route avant qu'aucune vérification d'identité n'ait eu lieu.
 */

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

const serveur = (app: INestApplication): Server => app.getHttpServer() as Server;

describe('POST /places/skills', () => {
  let app: INestApplication;
  let limite: INestApplication;
  let prisma: PrismaService;
  const sms = new FakeSmsProvider();
  let counter = 700;
  const utilisateurs: string[] = [];
  /**
   * VAGUE 6 — LA MARQUE NE PORTE QUE DES LETTRES (hors du « É » initial). Elle était
   * `Épreuve` + les six derniers caractères d'un UUID, soit des chiffres hexadécimaux : dans
   * ~6 % des lancements les six sont des chiffres (`Épreuve048213`), et la règle « pas de
   * numéro de téléphone » du schéma (`\d{6,}` une fois les espaces ôtés) refusait alors
   * CHAQUE création en 400 — sept épreuves sur huit tombaient, sur n'importe quelle base,
   * au hasard du tirage. Chiffres remplacés par des lettres : le tirage reste unique.
   */
  const marque = `Épreuve${newId()
    .slice(-6)
    .replace(/\d/g, (c) => 'ghijklmnop'.charAt(Number(c)))}`;
  const nomsCrees: string[] = [];

  async function construire(config?: { enabled: boolean; requestsPerMinute: number; writesPerMinute: number }) {
    let builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms);
    if (config !== undefined) builder = builder.overrideProvider(RATE_LIMIT_CONFIG).useValue(config);
    const moduleRef = await builder.compile();
    const nest = moduleRef.createNestApplication();
    nest.setGlobalPrefix('v1');
    nest.use(cookieParser());
    nest.useGlobalFilters(new ApiErrorFilter());
    await nest.init();
    return nest;
  }

  /** Un membre L0 avec son jeton : la route n'exige que `content.read`. */
  async function membre(nest: INestApplication = app): Promise<{ userId: string; bearer: string }> {
    counter += 1;
    const auth = nest.get(AuthService);
    const first = await auth.requestOtp({ phone: numeroDEpreuve(counter), countryIso2: 'BJ', captchaToken: 'test', purpose: 'SIGNUP', ip: undefined });
    const signup = await auth.verifyOtp({
      challengeId: first.challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    utilisateurs.push(signup.userId);
    return { userId: signup.userId, bearer: `Bearer ${signup.accessToken}` };
  }

  const poster = (bearer: string, nameFr: unknown, nest: INestApplication = app) =>
    request(serveur(nest)).post('/v1/places/skills').set('authorization', bearer).send({ nameFr });

  const nom = (suffixe: string): string => {
    const n = `${marque} ${suffixe}`;
    nomsCrees.push(n);
    return n;
  };

  beforeAll(async () => {
    app = await construire();
    // Un budget de ROUTE réel, des budgets globaux larges : seule la règle de la route mord.
    limite = await construire({ enabled: true, requestsPerMinute: 500, writesPerMinute: 500 });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.skill.deleteMany({ where: { OR: [{ createdByUserId: { in: utilisateurs } }, { nameFr: { startsWith: marque } }] } });
    await prisma.user.deleteMany({ where: { id: { in: utilisateurs } } });
    await limite.close();
    await app.close();
  });

  it('crée une compétence à soi : normalisée, active, rattachée à son auteur, hors du référentiel des autres', async () => {
    const moi = await membre();
    const autre = await membre();
    const res = await poster(moi.bearer, `  ${nom('Soudure')}   TIG `).expect(201);
    const cree = placesSkillSchema.parse(res.body);
    expect(cree.nameFr).toBe(`${marque} Soudure TIG`);
    nomsCrees.push(cree.nameFr);
    expect(cree.category).toBeNull();

    const ligne = await prisma.skill.findUniqueOrThrow({ where: { id: cree.id } });
    expect(ligne).toMatchObject({ createdByUserId: moi.userId, isActive: true });

    // Je la vois dans le champ ; un autre membre et un anonyme, jamais.
    const mesCompetences = placesSkillsResponseSchema.parse(
      (await request(serveur(app)).get('/v1/places/skills').set('authorization', moi.bearer).expect(200)).body,
    );
    expect(mesCompetences.items.map((s) => s.id)).toContain(cree.id);
    for (const entete of [autre.bearer, undefined]) {
      const vue = request(serveur(app)).get('/v1/places/skills');
      const liste = placesSkillsResponseSchema.parse((await (entete === undefined ? vue : vue.set('authorization', entete)).expect(200)).body);
      expect(liste.items.map((s) => s.id), 'compétence personnelle visible par un autre').not.toContain(cree.id);
    }
  });

  it('ne crée pas de doublon : sans casse ni accent, la ligne existante est rendue (globale comme personnelle)', async () => {
    const moi = await membre();
    const globale = await prisma.skill.create({
      data: { id: newId(), nameFr: `${marque} Électricité générale`, category: 'Bâtiment', isActive: true, createdByUserId: null },
    });
    const avant = await prisma.skill.count({ where: { nameFr: { startsWith: marque } } });

    const sur = await poster(moi.bearer, `${marque.toLowerCase()}  electricite GENERALE`).expect(201);
    expect(placesSkillSchema.parse(sur.body)).toEqual({ id: globale.id, nameFr: globale.nameFr, category: 'Bâtiment' });

    // Personnelle : deux envois qui ne diffèrent que par la casse rendent la MÊME ligne.
    const premier = placesSkillSchema.parse((await poster(moi.bearer, nom('Couture wax')).expect(201)).body);
    const second = placesSkillSchema.parse((await poster(moi.bearer, nom('couture WAX').toLowerCase()).expect(201)).body);
    expect(second.id).toBe(premier.id);

    // Une seule ligne de plus (la couture), jamais de doublon.
    expect(await prisma.skill.count({ where: { nameFr: { startsWith: marque } } })).toBe(avant + 1);
  });

  it('une compétence que l’équipe a retirée des propositions n’est pas ressuscitée : 409 SKILL_RETIRED', async () => {
    const moi = await membre();
    await prisma.skill.create({ data: { id: newId(), nameFr: `${marque} Retirée`, category: null, isActive: false, createdByUserId: null } });
    const res = await poster(moi.bearer, `${marque} retirée`).expect(409);
    expect((res.body as ErrorBody).error.details).toMatchObject({ reason: 'SKILL_RETIRED' });
  });

  it('le nom exact de la compétence personnelle d’un autre membre est refusé (409), sans la lui rendre', async () => {
    const a = await membre();
    const b = await membre();
    const nomA = nom('Bijouterie Ashanti');
    const creee = placesSkillSchema.parse((await poster(a.bearer, nomA).expect(201)).body);
    const refus = await poster(b.bearer, nomA).expect(409);
    expect((refus.body as ErrorBody).error.details).toMatchObject({ reason: 'SKILL_NAME_TAKEN' });
    expect(JSON.stringify(refus.body)).not.toContain(creee.id);

    // Qui ne diffère que par la casse : B obtient SA ligne, distincte de celle d'A.
    const bis = placesSkillSchema.parse((await poster(b.bearer, nomA.toUpperCase()).expect(201)).body);
    nomsCrees.push(bis.nameFr);
    expect(bis.id).not.toBe(creee.id);
  });

  it('refuse ce qui n’est pas une compétence : trop court, lien, adresse, numéro, clé inconnue (400)', async () => {
    const moi = await membre();
    for (const mauvais of ['a', '123 456', 'j@ime.test', 'https://exemple.test', 'Appelez 06 12 34 56 78', 'Soudure <b>', '']) {
      const res = await poster(moi.bearer, mauvais).expect(400);
      expect((res.body as ErrorBody).error.code, mauvais).toBe('VALIDATION_FAILED');
    }
    await request(serveur(app)).post('/v1/places/skills').set('authorization', moi.bearer).send({ nameFr: nom('Valide'), createdByUserId: moi.userId }).expect(400);
    expect(await prisma.skill.count({ where: { createdByUserId: moi.userId } })).toBe(0);
  });

  it('plafonne les compétences personnelles : 409 SKILL_LIMIT au-delà de MEMBER_SKILLS_MAX', async () => {
    const moi = await membre();
    await prisma.skill.createMany({
      data: Array.from({ length: MEMBER_SKILLS_MAX }, (_, i) => ({
        id: newId(),
        nameFr: `${marque} Plafond ${i}`,
        category: null,
        isActive: true,
        createdByUserId: moi.userId,
      })),
    });
    const res = await poster(moi.bearer, nom('Une de trop')).expect(409);
    expect((res.body as ErrorBody).error.details).toMatchObject({ reason: 'SKILL_LIMIT', max: MEMBER_SKILLS_MAX });
    // Redemander une compétence qu'on a déjà ne coûte pas de place : la ligne existante est rendue.
    await poster(moi.bearer, `${marque} Plafond 3`).expect(201);
  });

  it('exige une session (401) — et seulement content.read : un L0 peut écrire sa compétence', async () => {
    await request(serveur(app)).post('/v1/places/skills').send({ nameFr: nom('Anonyme') }).expect(401);
    const l0 = await membre();
    await poster(l0.bearer, nom('Niveau zéro')).expect(201);
  });

  it('débit : dix créations par heure et par membre, la onzième est refusée (429)', async () => {
    const moi = await membre(limite);
    for (let i = 0; i < 10; i += 1) await poster(moi.bearer, nom(`Débit ${i}`), limite).expect(201);
    const onzieme = await poster(moi.bearer, nom('Débit onze'), limite);
    expect(onzieme.status).toBe(429);
    expect((onzieme.body as ErrorBody).error.code).toBe('RATE_LIMITED');
  });
});
