import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { ConsentsService } from '../../consents/consents.service';
import { AuthService } from '../../auth/auth.service';
import { UsersService } from '../users.service';
import { newId } from '@app/db';
import { numeroDEpreuve, numeroFrancaisDEpreuve } from '../../../common/__tests__/numeros';

/**
 * Compte et profil — 01-identite.md §2.2, §2.6, §2.7 et §4.4.
 *
 * Les deux premiers tests correspondent à des bugs RÉELS trouvés en exerçant
 * l'API, pas en relisant le code :
 *
 *   · `PATCH /me` acceptait la France comme pays d'origine. Elle est active, donc
 *     le contrôle passait — mais elle est `DESTINATION` (02 §2.1), et le choix
 *     n'étant modifiable qu'une fois, le membre y restait figé ;
 *   · la création de compte prenait le pays du NUMÉRO comme pays d'origine. Un
 *     membre déjà installé en France, avec un numéro français, héritait donc de
 *     la France — le même piège, en pire, parce qu'il ne l'avait pas choisi.
 */
describe('compte et profil (01 §2.6, §2.7)', () => {
  let prisma: PrismaService;
  let users: UsersService;
  /** Une ville de la base de dev, pour franchir l'écran du lieu. */
  let lyonId: string;
  let auth: AuthService;
  const sms = new FakeSmsProvider();
  const createdUserIds: string[] = [];

  let counter = 0;
  const nextPhone = (): string => numeroDEpreuve(counter++);

  async function newMember(iso2 = 'BJ') {
    const phone = iso2 === 'FR' ? numeroFrancaisDEpreuve(counter++) : nextPhone();
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: iso2,
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
    lyonId = (await prisma.city.findUniqueOrThrow({ where: { slug: 'lyon' }, select: { id: true } })).id;
    const crypto = new CryptoService();
    const outbox = new OutboxService(prisma);
    users = new UsersService(prisma, crypto, outbox, new AuditService(prisma), new ConsentsService(prisma));
    auth = new AuthService(
      prisma,
      crypto,
      outbox,
      new TokenService(),
      new ConsentsService(prisma),
      sms,
      new FakeCaptchaProvider(),
    );
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  // ── Pays d'origine (§2.7 et 02 §2.1) ──────────────────────────────────────

  it('refuse un pays de DESTINATION comme pays d’origine', async () => {
    const userId = await newMember();
    const france = await prisma.country.findUniqueOrThrow({
      where: { iso2: 'FR' },
      select: { id: true, kind: true, isActive: true },
    });

    // Le test ne vaut que si la France est bien active et bien DESTINATION :
    // sinon il passerait pour la mauvaise raison.
    expect(france.isActive).toBe(true);
    expect(france.kind).toBe('DESTINATION');

    await expect(users.updateMe(userId, { originCountryId: france.id })).rejects.toMatchObject({
      code: 'COUNTRY_NOT_SUPPORTED',
    });
  });

  it('ne prend PAS le pays du numéro comme pays d’origine', async () => {
    // Numéro français, membre déjà installé : son pays d'origine n'est pas la
    // France, et rien dans l'écran 1 ne permet de le connaître.
    const userId = await newMember('FR');

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        originCountry: { select: { iso2: true, kind: true } },
        phoneNumbers: { include: { country: { select: { iso2: true } } } },
      },
    });

    expect(user.phoneNumbers[0]?.country.iso2).toBe('FR');
    expect(user.originCountry.kind).not.toBe('DESTINATION');
    // Et il n'est PAS figé : l'écran 3 de l'onboarding doit pouvoir le corriger,
    // et §2.7 accorde cette modification au membre — pas au système.
    expect(user.originCountryLockedAt).toBeNull();
  });

  it('ne laisse changer le pays d’origine qu’UNE fois', async () => {
    const userId = await newMember();

    // Au lancement, un seul pays ORIGIN est actif (02 §2.1) : il n'y a donc pas
    // de second pays vers lequel basculer. On pose le verrou comme un premier
    // changement l'aurait fait, puis on éprouve le refus — plutôt que de finir
    // sur un `update` brut qui n'affirmerait rien.
    await prisma.user.update({
      where: { id: userId },
      data: { originCountryLockedAt: new Date() },
    });

    const another = await prisma.country.findFirstOrThrow({
      where: { kind: { in: ['ORIGIN', 'BOTH'] } },
      orderBy: { sortOrder: 'desc' },
      select: { id: true },
    });
    const current = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { originCountryId: true },
    });

    // Une valeur IDENTIQUE passe : ce n'est pas un changement, et refuser un
    // formulaire renvoyé tel quel serait absurde.
    await expect(
      users.updateMe(userId, { originCountryId: current.originCountryId }),
    ).resolves.toBeDefined();

    if (another.id !== current.originCountryId) {
      await expect(users.updateMe(userId, { originCountryId: another.id })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    } else {
      // Un seul pays d'origine en base : on en crée un le temps du test, sinon la
      // règle du §2.7 ne serait vérifiée par rien.
      const temp = await prisma.country.create({
        data: {
          id: newId(),
          iso2: 'TG',
          nameFr: 'Togo (test)',
          dialCode: '+228',
          kind: 'ORIGIN',
          isActive: false,
          sortOrder: 999,
        },
      });
      try {
        await expect(users.updateMe(userId, { originCountryId: temp.id })).rejects.toMatchObject({
          code: 'FORBIDDEN',
        });
      } finally {
        await prisma.country.delete({ where: { id: temp.id } });
      }
    }
  });

  // ── Handle (§2.6) ─────────────────────────────────────────────────────────

  it('refuse les mots réservés', async () => {
    const userId = await newMember();
    for (const handle of ['admin', 'support', 'guides', 'moderation']) {
      await expect(users.updateMe(userId, { handle })).rejects.toMatchObject({ code: 'CONFLICT' });
    }
  });

  it('refuse un handle déjà pris, sans distinction de casse', async () => {
    const takenBy = await newMember();
    // Le handle est figé dans une CONSTANTE : `counter` avance à chaque
    // `newMember()`, et l'interpoler deux fois donnerait deux handles
    // différents — le test passerait alors sans rien vérifier.
    const handle = `occupe${Date.now().toString(36)}`;
    await users.updateMe(takenBy, { handle });

    const other = await newMember();
    // `handle` est une colonne citext : la casse ne doit pas suffire à contourner.
    // Le schéma n'accepte que des minuscules, donc c'est la BASE qu'on éprouve.
    await expect(users.updateMe(other, { handle })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    // `::citext` explicite : sans lui, le paramètre arrive en `text` et Postgres
    // résout `text = text`, qui est sensible à la casse. La sonde ne dirait alors
    // rien de la colonne qu'elle prétend éprouver.
    const upper = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE handle = ${handle.toUpperCase()}::citext`;
    expect(upper.length).toBe(1);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DEUX MEMBRES VISENT LE MÊME PSEUDO EN MÊME TEMPS                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le contrôle de disponibilité LIT avant d'écrire : deux requêtes simultanées
   * le passent toutes les deux, et c'est l'index unique qui tranche. MESURÉ sur
   * la suite d'épreuves du web, dont deux ouvriers inscrivaient un membre au même
   * instant : `PATCH /me` répondait `500 INTERNAL_ERROR`.
   *
   * Ce cas n'exige PAS que la course ait lieu — elle dépend de l'ordonnancement.
   * Il exige ce qui doit valoir dans les deux cas : un seul gagne, et le perdant
   * apprend que le pseudo est pris, jamais qu'une panne est survenue chez nous.
   */
  it('deux demandes simultanées du même handle : une passe, l’autre reçoit 409', async () => {
    const a = await newMember();
    const b = await newMember();
    const handle = `course${Date.now().toString(36)}`;

    const issues = await Promise.allSettled([
      users.updateMe(a, { handle }),
      users.updateMe(b, { handle }),
    ]);
    const tenus = issues.filter((r) => r.status === 'fulfilled');
    const refus = issues.filter((r) => r.status === 'rejected');
    expect(tenus).toHaveLength(1);
    expect(refus).toHaveLength(1);
    // Le refus NOMME la cause, et ce n'est pas une erreur interne.
    expect((refus[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'CONFLICT',
      details: { field: 'handle', reason: 'HANDLE_TAKEN' },
    });
  });

  it('n’autorise qu’un changement de handle par 30 jours', async () => {
    const userId = await newMember();
    await users.updateMe(userId, { handle: `premier${counter}` });

    await expect(users.updateMe(userId, { handle: `second${counter}` })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    // Le refus doit dire QUAND, sinon le front ne peut rien afficher d'utile.
    await users
      .updateMe(userId, { handle: `troisieme${counter}` })
      .then(() => expect.unreachable('le changement aurait dû être refusé'))
      .catch((error: { details?: Record<string, unknown> }) => {
        expect(error.details?.['nextChangeAllowedAt']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
  });

  it('génère un handle translittéré depuis le nom affiché', async () => {
    expect(await users.generateHandle('Aïcha Sègbédji')).toMatch(/^aicha-segbedji\d*$/);
    expect(await users.generateHandle('Jean-Baptiste  KOUASSI')).toMatch(
      /^jean-baptiste-kouassi\d*$/,
    );
    // Un nom sans aucun caractère utilisable ne doit pas produire un handle vide.
    const fallback = await users.generateHandle('한국어');
    expect(fallback.length).toBeGreaterThanOrEqual(3);
  });

  it('ne génère jamais un handle réservé', async () => {
    const handle = await users.generateHandle('Admin');
    expect(handle).not.toBe('admin');
  });

  // ── Phase (§2.2) ──────────────────────────────────────────────────────────

  it('horodate une correction MANUELLE de phase', async () => {
    const userId = await newMember();
    await users.updateMe(userId, { phase: 'SETTLED' });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phase: true, phaseSetManuallyAt: true },
    });
    expect(user.phase).toBe('SETTLED');
    // Sans cet horodatage, la tâche `user.phase_progression` écraserait la
    // correction six mois après l'arrivée — ce que §2.2 interdit.
    expect(user.phaseSetManuallyAt).not.toBeNull();
  });

  it('n’horodate PAS la déclaration d’arrivée', async () => {
    const userId = await newMember();
    await users.declareArrival(userId, '2026-01-15');

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phase: true, phaseSetManuallyAt: true, arrivalDate: true },
    });
    expect(user.phase).toBe('RECENT_ARRIVAL');
    expect(user.arrivalDate).not.toBeNull();
    // « Je suis arrivé » est une déclaration de FAIT, pas une correction : le
    // passage automatique à SETTLED six mois plus tard doit rester possible.
    expect(user.phaseSetManuallyAt).toBeNull();
  });

  it('refuse une date d’arrivée dans le futur', async () => {
    const userId = await newMember();
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    await expect(users.declareArrival(userId, future)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  // ── Onboarding (§5) ───────────────────────────────────────────────────────

  it('marque l’écran 1 franchi dès la vérification du téléphone', async () => {
    const userId = await newMember();
    const me = await users.me(userId);
    // Laisser 0 renverrait le membre sur l'écran qu'il vient de terminer.
    expect(me.onboarding.step).toBe(1);
    expect(me.onboarding.complete).toBe(false);
  });

  it('ne fait jamais RECULER l’avancement', async () => {
    const userId = await newMember();
    await users.advanceOnboarding(userId, 4);
    // Le membre revient corriger l'écran 2 : son avancement ne doit pas tomber.
    const back = await users.advanceOnboarding(userId, 2);
    expect(back.step).toBe(4);
  });

  it('émet `user.onboarded_location` à l’écran du LIEU, pas ailleurs', async () => {
    const userId = await newMember();

    await users.advanceOnboarding(userId, 2);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: userId, type: 'user.onboarded_location' },
      }),
    ).toBe(0);

    // L'écran du lieu ne se franchit qu'avec une ville (W1A, phase 0.2).
    await prisma.user.update({ where: { id: userId }, data: { cityId: lyonId } });
    await users.advanceOnboarding(userId, 3);
    const emitted = await prisma.domainEvent.findFirst({
      where: { aggregateId: userId, type: 'user.onboarded_location' },
    });

    /**
     * Cet événement était DÉCLARÉ au catalogue et émis par personne. Le module
     * réseaux l'attend pour inscrire le membre aux réseaux de sa ville et de son
     * pays : sans lui, l'écran du lieu ne tient pas sa promesse.
     */
    expect(emitted).not.toBeNull();
    // La charge porte les DEUX rattachements : le consommateur a besoin des deux
    // pour créer les deux adhésions.
    expect(JSON.stringify(emitted?.payload)).toContain('originCountryId');
    expect(JSON.stringify(emitted?.payload)).toContain('cityId');
  });

  /**
   * W1A, phase 0.2 — « Continuer » refusé tant qu'aucune ville n'est choisie.
   *
   * MUTATION : en retirant le `throw` de `advanceOnboarding`, l'écran 3 est
   * enregistré sans ville, et ce test tombe sur la première assertion.
   */
  it('refuse d’enregistrer l’écran du lieu sans ville, puis l’accepte avec', async () => {
    const userId = await newMember();
    await users.advanceOnboarding(userId, 2);

    await expect(users.advanceOnboarding(userId, 3)).rejects.toMatchObject({
      code: 'LOCATION_REQUIRED',
      status: 409,
    });
    // Rien n'a bougé : l'avancement reste à 2, et aucun réseau n'a été annoncé.
    expect((await users.me(userId)).onboarding.step).toBe(2);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: userId, type: 'user.onboarded_location' },
      }),
    ).toBe(0);

    await prisma.user.update({ where: { id: userId }, data: { cityId: lyonId } });
    await expect(users.advanceOnboarding(userId, 3)).resolves.toEqual({ step: 3 });
  });

  it('émet `user.onboarded` au dernier écran, et pas avant', async () => {
    const userId = await newMember();
    await users.advanceOnboarding(userId, 5);
    expect(
      await prisma.domainEvent.count({ where: { aggregateId: userId, type: 'user.onboarded' } }),
    ).toBe(0);

    await users.advanceOnboarding(userId, 6);
    expect(
      await prisma.domainEvent.count({ where: { aggregateId: userId, type: 'user.onboarded' } }),
    ).toBe(1);

    const me = await users.me(userId);
    expect(me.onboarding.complete).toBe(true);
  });

  // ── RÈGLE DURE : le numéro n'est jamais renvoyé en clair ───────────────────

  it('ne renvoie le numéro que MASQUÉ, dans `GET /me`', async () => {
    const phone = nextPhone();
    const { challengeId } = await auth.requestOtp({
      phone,
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

    const me = await users.me(session.userId);
    const national = phone.replace(/^0+/, '');

    expect(me.phones).toHaveLength(1);
    const masked = me.phones[0]?.masked ?? '';
    expect(masked).toContain('•');
    // Le numéro complet ne doit apparaître NULLE PART dans la réponse, pas
    // seulement dans le champ `masked`.
    expect(JSON.stringify(me)).not.toContain(national);
    // Les deux derniers chiffres seuls sont montrés (§2.1).
    expect(masked.endsWith(national.slice(-2))).toBe(true);
  });

  // ── Profil public (§2.7 et §4.4) ──────────────────────────────────────────

  it('ne publie que les champs autorisés par §2.7', async () => {
    const userId = await newMember();
    const handle = `public${counter}`;
    await users.updateMe(userId, { handle });
    await users.updateProfile(userId, { isPublic: true, bio: 'Bonjour.' });

    const profile = await users.publicProfile(handle, null);
    const keys = Object.keys(profile);

    for (const forbidden of ['phone', 'phones', 'email', 'phoneNumbers', 'notes']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(JSON.stringify(profile)).not.toContain('phoneEncrypted');
    expect(profile.handle).toBe(handle);
  });

  /**
   * `relation` — ce que le bouton « Ajouter aux contacts » du profil lit. Le
   * porteur : « même quand la demande est envoyée, le bouton affiche toujours
   * “Envoyer une demande” ». La relation est vue DES DEUX CÔTÉS d'une demande en
   * attente, puis disparaît pour un anonyme.
   */
  it('rend ma relation avec le membre : soi, aucune, demande envoyée ou reçue', async () => {
    const moi = await newMember();
    const lui = await newMember();
    const monPseudo = `relmoi${counter}`;
    const sonPseudo = `rellui${counter}`;
    await users.updateMe(moi, { handle: monPseudo });
    await users.updateMe(lui, { handle: sonPseudo });
    await users.updateProfile(lui, { isPublic: true });

    expect((await users.publicProfile(monPseudo, moi)).relation).toEqual({ status: 'SELF', requestId: null });
    expect((await users.publicProfile(sonPseudo, moi)).relation).toEqual({ status: 'NONE', requestId: null });
    expect((await users.publicProfile(sonPseudo, null)).relation).toBeNull();

    const demande = await prisma.connectionRequest.create({
      data: {
        id: newId(),
        fromUserId: moi,
        toUserId: lui,
        message: 'Bonjour, on se croise souvent au marché.',
        status: 'PENDING',
      },
    });
    expect((await users.publicProfile(sonPseudo, moi)).relation).toEqual({
      status: 'REQUEST_SENT',
      requestId: null,
    });
    await users.updateProfile(moi, { isPublic: true });
    expect((await users.publicProfile(monPseudo, lui)).relation).toEqual({
      status: 'REQUEST_RECEIVED',
      requestId: demande.id,
    });
    await prisma.connectionRequest.delete({ where: { id: demande.id } });
  });

  it('cache un profil non public à un visiteur anonyme', async () => {
    const userId = await newMember();
    const handle = `prive${counter}`;
    await users.updateMe(userId, { handle });
    await users.updateProfile(userId, { isPublic: false });

    await expect(users.publicProfile(handle, null)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // Mais un membre connecté le voit : §2.7 liste ce qu'un « autre membre » voit.
    const asMember = await users.publicProfile(handle, userId);
    expect(asMember.handle).toBe(handle);
  });

  it('renvoie 404 — et non 403 — sur un profil bloqué, dans les deux sens', async () => {
    const a = await newMember();
    const b = await newMember();
    const handleA = `bloqa${counter}`;
    const handleB = `bloqb${counter}`;
    await users.updateMe(a, { handle: handleA });
    await users.updateMe(b, { handle: handleB });

    await prisma.block.create({
      data: {
        id: newId(),
        blockerUserId: a,
        blockedUserId: b,
      },
    });

    // Celui qui a bloqué ne retrouve pas l'autre…
    await expect(users.publicProfile(handleB, a)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // …et le bloqué ne retrouve pas celui qui l'a bloqué (§4.4, « dans un sens
    // ou l'autre »). 404 et non 403 : T4 §3 interdit de révéler l'existence.
    await expect(users.publicProfile(handleA, b)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('cache un compte désactivé', async () => {
    const userId = await newMember();
    const handle = `desactive${counter}`;
    await users.updateMe(userId, { handle });
    await users.updateProfile(userId, { isPublic: true });
    await prisma.user.update({ where: { id: userId }, data: { status: 'DEACTIVATED' } });

    await expect(users.publicProfile(handle, null)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // ── Profil ────────────────────────────────────────────────────────────────

  it('crée le profil s’il n’existe pas encore', async () => {
    const userId = await newMember();
    // L'écran 5 de l'onboarding est passable : un membre qui l'a sauté n'a pas de
    // ligne `user_profiles`, et doit pouvoir la remplir plus tard.
    expect((await users.me(userId)).profile).toBeNull();

    const after = await users.updateProfile(userId, {
      bio: 'Étudiante en droit.',
      occupationStatus: 'STUDENT',
      availableToHelp: true,
      helpTypes: ['PAPERWORK'],
    });
    expect(after.profile?.occupationStatus).toBe('STUDENT');
    expect(after.profile?.helpTypes).toEqual(['PAPERWORK']);
  });

  it('remplace les langues et compétences au lieu de les cumuler', async () => {
    const userId = await newMember();
    const languages = await prisma.language.findMany({ take: 3, select: { id: true } });
    const first = languages.slice(0, 2).map((l) => l.id);
    const second = languages.slice(2, 3).map((l) => l.id);

    await users.updateProfile(userId, { languageIds: first });
    expect(await prisma.userLanguage.count({ where: { userId } })).toBe(first.length);

    await users.updateProfile(userId, { languageIds: second });
    // Un `createMany` sans suppression préalable aurait donné 3 : le membre qui
    // retire une langue de son profil doit la voir disparaître.
    expect(await prisma.userLanguage.count({ where: { userId } })).toBe(second.length);
  });

  it('[11 §2.5] modifier le profil ou la fiche émet user.profile_updated, sans les valeurs', async () => {
    const userId = await newMember();
    await users.updateProfile(userId, { bio: 'Une bio toute neuve et secrète' });
    await users.updateMe(userId, { displayName: 'Nouveau Nom' });
    const events = await prisma.domainEvent.findMany({
      where: { type: 'user.profile_updated', aggregateId: userId },
      select: { payload: true },
    });
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain('secrète');
    expect(JSON.stringify(events[0]?.payload)).toContain('bio');
  });

  it('journalise les champs modifiés, jamais leurs valeurs', async () => {
    const userId = await newMember();
    await users.updateMe(userId, { displayName: 'Aïcha Sègbédji', timezone: 'Africa/Porto-Novo' });

    const entry = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'user.profile_updated' },
      orderBy: { createdAt: 'desc' },
    });

    expect(entry).not.toBeNull();
    const metadata = JSON.stringify(entry?.metadata ?? {});
    expect(metadata).toContain('displayName');
    // Le journal est conservé cinq ans (§8.4) : il dit ce qui a changé, pas quoi.
    expect(metadata).not.toContain('Aïcha');
  });
  /**
   * LA DATE D'ARRIVÉE SORT DE `GET /me`.
   *
   * Elle était ÉCRIVABLE et pas LISIBLE : le champ « Arrivée » de K01 n'avait donc
   * aucune valeur à afficher, et serait parti vide à l'enregistrement suivant.
   */
  it('rend la date d’arrivée en date nue, pas en horodatage', async () => {
    const userId = await newMember();
    expect((await users.me(userId)).user.arrivalDate).toBeNull();
    const apres = await users.updateMe(userId, { arrivalDate: '2026-09-15' });
    expect(apres.user.arrivalDate).toBe('2026-09-15');
  });
  /**
   * LE NOM DE LA VILLE ET LA DATE DU DERNIER CHANGEMENT DE PSEUDO SORTENT DE
   * `GET /me` (lot W2A, phase 2.1/2.6/2.7).
   *
   * Sans eux, l'accueil écrivait « ÉVÉNEMENTS À LYON » et K01 « Modifié le 2
   * janvier » pour tout le monde. Un membre sans ville lit `null`, un membre qui
   * n'a jamais changé son pseudo lit `null` aussi — et c'est le front qui dit
   * « jamais modifié », pas le serveur qui invente une date.
   */
  it('rend le nom et le pays de ma ville, et la date de mon dernier changement de pseudo', async () => {
    const userId = await newMember();
    const avant = (await users.me(userId)).user;
    expect(avant.cityId).toBeNull();
    expect(avant.cityName).toBeNull();
    expect(avant.cityCountryId).toBeNull();
    expect(avant.handleChangedAt).toBeNull();

    const apres = (await users.updateMe(userId, { cityId: lyonId, handle: `date${counter}x` })).user;
    expect(apres.cityName).toBe('Lyon');
    const lyon = await prisma.city.findUniqueOrThrow({ where: { id: lyonId }, select: { countryId: true } });
    expect(apres.cityCountryId).toBe(lyon.countryId);
    expect(apres.handleChangedAt).not.toBeNull();
    expect(Date.now() - new Date(apres.handleChangedAt as string).getTime()).toBeLessThan(60_000);
  });

  /**
   * `cities.member_count` BOUGE AVEC LA VILLE DU MEMBRE, pas seulement la nuit.
   *
   * Mesuré : « 0 membre · vous avez rejoint ce réseau » à l'arrivée, parce que seul
   * le recalcul nocturne écrivait la colonne.
   */
  it('tient cities.member_count à jour quand le membre choisit puis change de ville', async () => {
    const autre = await prisma.city.findFirstOrThrow({
      where: { id: { not: lyonId }, mergedIntoCityId: null },
      select: { id: true },
    });
    const compte = async (id: string): Promise<number> =>
      (await prisma.city.findUniqueOrThrow({ where: { id }, select: { memberCount: true } })).memberCount;
    const lyonAvant = await compte(lyonId);
    const autreAvant = await compte(autre.id);

    const userId = await newMember();
    await users.updateMe(userId, { cityId: lyonId });
    expect(await compte(lyonId)).toBe(lyonAvant + 1);

    // Rejouer la même ville ne compte pas deux fois.
    await users.updateMe(userId, { cityId: lyonId, displayName: 'Autre nom' });
    expect(await compte(lyonId)).toBe(lyonAvant + 1);

    await users.updateMe(userId, { cityId: autre.id });
    expect(await compte(lyonId)).toBe(lyonAvant);
    expect(await compte(autre.id)).toBe(autreAvant + 1);

    // Le filet de la nuit : le recalcul retombe sur le même chiffre (la ville du
    // test est la seule à avoir bougé).
    await prisma.city.update({ where: { id: autre.id }, data: { memberCount: autreAvant } });
    await prisma.city.update({ where: { id: lyonId }, data: { memberCount: lyonAvant } });
  });
});
