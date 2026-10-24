import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { VisibilityService } from '../../../common/visibility.service';
import {
  FakeCaptchaProvider,
  FakeEmailProvider,
  FakePushProvider,
  FakeSmsProvider,
} from '../../../providers/providers';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';
import { AuthService } from '../../auth/auth.service';
import { ConnectionsService } from '../../connections/connections.service';
import { ConsentsService } from '../../consents/consents.service';
import { FeedService } from '../../feed/feed.service';
import { HelpService } from '../../help/help.service';
import { HousingService } from '../../housing/housing.service';
import { JobsService } from '../../jobs/jobs.service';
import { JourneysService } from '../../journeys/journeys.service';
import { MentorshipService } from '../../mentorship/mentorship.service';
import { MessagingService } from '../../messaging/messaging.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../users.service';

/**
 * L'INSCRIPTION DE BOUT EN BOUT, CÔTÉ SERVEUR — W1A, phase 0.2.
 *
 * OTP → phase → lieu → objectif → profil → fin → accueil. Chaque étape appelle le
 * MÊME service que la route du produit et dans l'ordre où l'écran le fait
 * (`use-onboarding-flow.ts`). Le spec Playwright jetable rejoue la même chaîne
 * dans le navigateur ; ce fichier garde la moitié serveur, qui est celle où le
 * défaut a été mesuré :
 *
 *   · « Continuer » passait sans ville à l'écran du lieu ;
 *   · le parcours choisi à l'écran de l'objectif n'était pas créé
 *     (`409 LOCATION_REQUIRED`) et le membre arrivait à l'accueil sans parcours ;
 *   · la discussion de ce parcours n'existait pas (phase 0.5).
 *
 * MUTATIONS : retirer le `throw LOCATION_REQUIRED` de `advanceOnboarding` fait
 * tomber le second cas ; retirer `cityId` du `updateMe` du premier fait tomber
 * la création du parcours.
 */
describe('inscription complète (01 §5, 03 §3.1)', () => {
  let prisma: PrismaService;
  let users: UsersService;
  let journeys: JourneysService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();
  const createdUserIds: string[] = [];
  let counter = 0;
  let lyonId: string;
  let abomeyId: string;
  let studiesTemplateId: string;

  /** L'OTP, par le service : le code d'épreuve vient du fournisseur de SMS fictif. */
  async function otp(): Promise<string> {
    const { challengeId } = await auth.requestOtp({
      phone: numeroDEpreuve(counter++),
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const session = await auth.verifyOtp({
      challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    createdUserIds.push(session.userId);
    return session.userId;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const crypto = new CryptoService();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const consents = new ConsentsService(prisma);
    const connections = new ConnectionsService(prisma, outbox, audit, visibility);
    const messaging = new MessagingService(prisma, crypto, outbox, audit, visibility, connections);
    users = new UsersService(prisma, crypto, outbox, audit, consents);
    journeys = new JourneysService(
      prisma,
      outbox,
      audit,
      visibility,
      crypto,
      consents,
      new HelpService(prisma, outbox, audit, visibility),
      new FeedService(prisma, outbox, audit, visibility),
      messaging,
      new NotificationsService(prisma, new FakeEmailProvider(), new FakePushProvider()),
      new HousingService(prisma, outbox, audit, visibility),
      new JobsService(prisma, outbox, audit, visibility),
      new MentorshipService(prisma, outbox, audit, visibility, messaging),
    );
    auth = new AuthService(prisma, crypto, outbox, new TokenService(), consents, sms, new FakeCaptchaProvider());

    lyonId = (await prisma.city.findUniqueOrThrow({ where: { slug: 'lyon' }, select: { id: true } })).id;
    abomeyId = (await prisma.city.findFirstOrThrow({ where: { name: 'Abomey' }, select: { id: true } })).id;
    studiesTemplateId = (
      await prisma.journeyTemplate.findUniqueOrThrow({ where: { code: 'STUDIES' }, select: { id: true } })
    ).id;
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.conversation.deleteMany({ where: { journeyId: null, kind: 'JOURNEY' } });
    }
    await prisma.$disconnect();
  });

  it('un compte NEUF arrive à l’accueil avec un parcours et sa discussion', async () => {
    // 1. OTP — le compte naît, onboarding à l'étape 1.
    const userId = await otp();
    expect((await users.me(userId)).onboarding).toMatchObject({ step: 1, complete: false });

    // 2. Phase.
    await users.updateMe(userId, { phase: 'RECENT_ARRIVAL' });
    await users.advanceOnboarding(userId, 2);

    // 3. Lieu — la ville est ENREGISTRÉE avant d'avancer.
    await users.updateMe(userId, { cityId: lyonId });
    await users.advanceOnboarding(userId, 3);
    const apresLieu = await users.me(userId);
    expect(apresLieu.user.cityId).toBe(lyonId);
    expect(apresLieu.user.phase).toBe('RECENT_ARRIVAL');

    // 4. Objectif — le parcours choisi est créé, SANS 409.
    const created = await journeys.create({ userId, level: 'L0' }, { templateId: studiesTemplateId });
    await users.advanceOnboarding(userId, 4);
    expect(created.journey.destinationCity.id).toBe(lyonId);
    // 0.5 — et sa discussion existe tout de suite, sans worker.
    expect(created.journey.groupConversationId).not.toBeNull();

    // 5. Profil.
    await users.updateMe(userId, { displayName: 'Amina Test', handle: `amina${String(counter)}test` });
    await users.updateProfile(userId, { occupationStatus: 'STUDENT', availableToHelp: false, helpTypes: [] });
    await users.advanceOnboarding(userId, 5);

    // 6. Fin — l'onboarding est terminé.
    await users.advanceOnboarding(userId, 6);
    expect((await users.me(userId)).onboarding).toMatchObject({ step: 6, complete: true });

    // 7. Accueil — GET /journeys rend le parcours créé, actif, avec une étape en cours.
    const liste = await journeys.list(userId);
    expect(liste.items).toHaveLength(1);
    expect(liste.items[0]).toMatchObject({ id: created.journey.id, status: 'ACTIVE' });
    expect(liste.items[0]?.currentStep?.title).toEqual(expect.any(String));
  });

  it('sans ville : l’écran du lieu est refusé, et le parcours aussi', async () => {
    const userId = await otp();
    await users.updateMe(userId, { phase: 'SETTLED' });
    await users.advanceOnboarding(userId, 2);

    // Le serveur DÉCIDE : pas de ville, pas d'avancement.
    await expect(users.advanceOnboarding(userId, 3)).rejects.toMatchObject({
      code: 'LOCATION_REQUIRED',
    });
    // Et si le front fautait quand même, le parcours resterait refusé — c'est le
    // défaut mesuré, désormais impossible à atteindre par l'écran.
    await expect(
      journeys.create({ userId, level: 'L0' }, { templateId: studiesTemplateId }),
    ).rejects.toMatchObject({ code: 'LOCATION_REQUIRED' });
    expect((await journeys.list(userId)).items).toHaveLength(0);
  });

  it('une ville d’un pays d’origine est acceptée (le membre vit encore au pays)', async () => {
    const userId = await otp();
    await users.updateMe(userId, { phase: 'PRE_DEPARTURE' });
    await users.advanceOnboarding(userId, 2);
    await users.updateMe(userId, { cityId: abomeyId });
    await expect(users.advanceOnboarding(userId, 3)).resolves.toEqual({ step: 3 });
  });
});
