import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { type AccessClaims, TokenService } from '../../../common/token.service';
import { ProviderError } from '../../../providers/http';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { ConsentsService } from '../../consents/consents.service';
import { AuthService } from '../auth.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';
import { enFormatInternational } from '@app/shared';

/**
 * LE FORMAT INTERNATIONAL VIENT DE LA BIBLIOTHÈQUE, PAS D'UN COLLAGE.
 *
 * Ces bancs écrivaient `+229` suivi du numéro privé de ses zéros de tête. C'est
 * la règle FRANÇAISE : le « 0 » y est un préfixe interurbain, et il tombe. Au
 * BÉNIN il fait PARTIE du numéro — `+229 01 9…` — et libphonenumber le garde.
 * MESURÉ : l'attendu disait `+229196833223` là où le serveur stocke
 * `+2290196833223`, et le banc accusait le serveur.
 */

/**
 * Authentification — les règles dures de 01-identite.md §2.1.
 *
 * Chacun de ces tests correspond à un défaut RÉEL trouvé en exerçant le flux,
 * et non à une relecture du code :
 *
 *   · la détection de rejeu ne se déclenchait jamais, parce que la rotation
 *     écrasait le hachage et que l'ancien jeton ne correspondait alors plus à
 *     aucune ligne — indiscernable d'un jeton inconnu ;
 *   · le numéro n'était jamais chiffré en base (un tampon vide), ce qui rendait
 *     son masquage impossible à jamais ;
 *   · le pays du compte prenait le PREMIER pays actif au tri, et non celui que
 *     le membre avait choisi, alors que ce choix n'est modifiable qu'une fois.
 *
 * Les trois étaient silencieux : l'API répondait 200, et deux d'entre eux
 * renvoyaient même l'erreur attendue pour la mauvaise raison.
 */
describe('authentification (01 §2.1)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  let crypto: CryptoService;
  const sms = new FakeSmsProvider();
  const createdUserIds: string[] = [];

  /** Un numéro distinct par test : les limites de débit sont par numéro. */
  let counter = 0;
  const nextPhone = (): string => numeroDEpreuve(counter++);

  async function signIn(phone: string, iso2 = 'BJ') {
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: iso2,
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const code = sms.lastCodeSent();
    expect(code).not.toBeNull();
    const session = await auth.verifyOtp({
      challengeId,
      code: code as string,
      ip: undefined,
      userAgent: undefined,
    });
    createdUserIds.push(session.userId);
    return session;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    crypto = new CryptoService();
    auth = new AuthService(
      prisma,
      crypto,
      new OutboxService(prisma),
      new TokenService(),
      new ConsentsService(prisma),
      sms,
      new FakeCaptchaProvider(),
    );
  });

  afterAll(async () => {
    // Les comptes créés partent avec leurs dépendances (cascade sur user_id).
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  // ── Le pays choisi ────────────────────────────────────────────────────────

  describe('panne du fournisseur SMS', () => {
    const fournisseur = (appels: { n: number }, echecs: number, retryable: boolean) => ({
      send: () => {
        appels.n += 1;
        return appels.n <= echecs
          ? Promise.reject(new ProviderError('twilio', retryable ? 503 : 400, 'HTTP', retryable))
          : Promise.resolve({ providerRef: 'x' });
      },
    });
    const service = (sender: { send: () => Promise<{ providerRef: string }> }) =>
      new AuthService(prisma, crypto, new OutboxService(prisma), new TokenService(), new ConsentsService(prisma),
        sender as never, new FakeCaptchaProvider());

    it('une panne transitoire est réessayée UNE fois, et le code part', async () => {
      const appels = { n: 0 };
      const out = await service(fournisseur(appels, 1, true)).requestOtp({
        phone: numeroDEpreuve(7001), countryIso2: 'BJ', captchaToken: 't', purpose: 'SIGNUP', ip: undefined,
      });
      expect(appels.n).toBe(2);
      expect(out.challengeId).toBeTruthy();
    });

    it('un échec définitif lève SMS_SEND_FAILED ET supprime le défi (pas de quota consommé pour rien)', async () => {
      const appels = { n: 0 };
      const phone = numeroDEpreuve(7002);
      const fp = crypto.phoneFingerprint(enFormatInternational(phone, 'BJ') ?? phone);
      const avant = await prisma.otpChallenge.count({ where: { phoneHmac: fp } });
      await expect(
        service(fournisseur(appels, 5, true)).requestOtp({
          phone, countryIso2: 'BJ', captchaToken: 't', purpose: 'SIGNUP', ip: undefined,
        }),
      ).rejects.toMatchObject({ code: 'SMS_SEND_FAILED' });
      expect(appels.n).toBe(2); // un envoi + un réessai, pas plus
      expect(await prisma.otpChallenge.count({ where: { phoneHmac: fp } })).toBe(avant);
    });

    it('une erreur non réessayable (400) n’est pas rejouée', async () => {
      const appels = { n: 0 };
      await expect(
        service(fournisseur(appels, 5, false)).requestOtp({
          phone: numeroDEpreuve(7003), countryIso2: 'BJ', captchaToken: 't', purpose: 'SIGNUP', ip: undefined,
        }),
      ).rejects.toMatchObject({ code: 'SMS_SEND_FAILED' });
      expect(appels.n).toBe(1);
    });
  });

  it('retient le pays SÉLECTIONNÉ, et non le premier de la liste', async () => {
    const { userId } = await signIn(nextPhone(), 'BJ');

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { originCountry: { select: { iso2: true } } },
    });

    expect(user.originCountry.iso2).toBe('BJ');

    // Le test ne vaut que si BJ n'est PAS le premier au tri : sinon il passerait
    // aussi avec le bug. On le vérifie, plutôt que de le supposer.
    const first = await prisma.country.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { iso2: true },
    });
    expect(first.iso2).not.toBe('BJ');
  });

  // ── RÈGLE DURE : le numéro n'est jamais en clair ───────────────────────────

  it('stocke le numéro chiffré, et récupérable — pas un tampon vide', async () => {
    const phone = nextPhone();
    const { userId } = await signIn(phone);

    const stored = await prisma.phoneNumber.findFirstOrThrow({ where: { userId } });

    expect(stored.phoneEncrypted.length).toBeGreaterThan(16);
    // Le chiffrement ne sert à rien si on ne peut plus lire : c'est ce qui
    // permet de masquer le numéro à son propriétaire (§2.1).
    expect(crypto.decryptPhone(stored.phoneEncrypted)).toBe(
      enFormatInternational(phone, 'BJ'),
    );
    expect(Buffer.from(stored.phoneEncrypted).toString('utf8')).not.toContain(
      phone.replace(/^0+/, ''),
    );
  });

  it('ne laisse aucun numéro lisible dans le défi OTP', async () => {
    const phone = nextPhone();
    const { challengeId } = await auth.requestOtp({
      phone,
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });

    const challenge = await prisma.otpChallenge.findUniqueOrThrow({ where: { id: challengeId } });
    const bytes = Buffer.from(challenge.phoneEncrypted ?? new Uint8Array()).toString('utf8');
    expect(bytes).not.toContain(phone.replace(/^0+/, ''));
    expect(challenge.phoneHmac).not.toContain(phone.replace(/^0+/, ''));
  });

  // ── RÈGLE DURE : `is_destination` se DÉRIVE de `countries.kind` ────────────

  /**
   * LE DÉFAUT HISTORIQUE DE CE CHEMIN, ET LA RAISON DE CES DEUX TESTS.
   *
   * `phone_numbers.is_destination` était CODÉ EN DUR à `false` à la création du
   * compte. Conséquence : un membre s'inscrivant avec un numéro français restait
   * à L1 POUR TOUJOURS — jamais L2 — sans message ni recours, puisque
   * `VerificationLevelService` cherche un numéro `isDestination: true` sous un
   * pays actif et n'en trouvait aucun. Rien ne cassait, rien ne le disait.
   *
   * Mesuré en reposant le défaut : remettre `const isDestination = false;` ici ne
   * faisait tomber qu'UN test, et pour une raison accidentelle (une précondition
   * de fixture sur les doublons de numéro). La montée L1 → L2 restait verte,
   * parce qu'elle passe par `POST /me/phones` — un AUTRE site d'écriture, dans
   * `phones.service.ts`. Le chemin de l'INSCRIPTION n'était donc pas gardé, et
   * c'est exactement celui où le défaut avait vécu.
   *
   * D'où ces deux tests, qui portent sur la COLONNE et non sur le niveau : ils
   * disent que la valeur est DÉRIVÉE, dans les deux sens. Un seul des deux ne
   * suffirait pas — `true` partout et `false` partout passent chacun la moitié.
   */
  it('pose `is_destination` sur un numéro de pays DESTINATION, à l’inscription', async () => {
    const { userId } = await signIn(nextPhone(), 'FR');

    const stored = await prisma.phoneNumber.findFirstOrThrow({
      where: { userId },
      select: { isDestination: true, country: { select: { iso2: true, kind: true } } },
    });

    // La valeur n'est pas recopiée d'ailleurs : elle vient de `countries.kind`.
    expect(stored.country.iso2).toBe('FR');
    expect(stored.country.kind).toBe('DESTINATION');
    expect(
      stored.isDestination,
      'Un numéro d’un pays DESTINATION doit porter `is_destination`. Sans lui, le ' +
        'membre reste à L1 pour toujours, sans message ni recours — le défaut ' +
        'historique de ce chemin.',
    ).toBe(true);
  });

  it('ne le pose PAS sur un numéro de pays d’ORIGINE', async () => {
    const { userId } = await signIn(nextPhone(), 'BJ');

    const stored = await prisma.phoneNumber.findFirstOrThrow({
      where: { userId },
      select: { isDestination: true, country: { select: { iso2: true, kind: true } } },
    });

    expect(stored.country.iso2).toBe('BJ');
    expect(stored.country.kind).toBe('ORIGIN');
    /**
     * 00 §7.2 : L2 veut dire « personne réelle PRÉSENTE SUR LE TERRITOIRE ». Un
     * numéro béninois n'atteste aucune présence en France — c'est précisément ce
     * que le passage du Bénin en `BOTH` avait cassé.
     */
    expect(
      stored.isDestination,
      'Un numéro d’un pays d’ORIGINE ne doit pas porter `is_destination` : il ' +
        'ferait prouver une présence en France à qui n’y est pas.',
    ).toBe(false);
  });

  // ── RÈGLE DURE : révocation de la chaîne en cas de réutilisation ───────────

  describe('rotation et rejeu du jeton de rafraîchissement', () => {
    it('fait tourner le jeton à chaque usage', async () => {
      const { refreshToken } = await signIn(nextPhone());
      const rotated = await auth.refresh(refreshToken, undefined);

      expect(rotated.refreshToken).not.toBe(refreshToken);
      // Même chaîne, génération suivante.
      expect(rotated.refreshToken.split('.')[0]).toBe(refreshToken.split('.')[0]);
      expect(Number(rotated.refreshToken.split('.')[1])).toBe(
        Number(refreshToken.split('.')[1]) + 1,
      );
    });

    it('refuse le jeton qui vient d’être échangé', async () => {
      const { refreshToken } = await signIn(nextPhone());
      await auth.refresh(refreshToken, undefined);

      await expect(auth.refresh(refreshToken, undefined)).rejects.toMatchObject({
        code: 'SESSION_REVOKED',
      });
    });

    /**
     * LE test qui manquait. Un jeton de plusieurs générations en arrière doit
     * être reconnu comme un rejeu — c'est précisément le cas que l'ancienne
     * implémentation ne pouvait pas voir, et celui qui compte : un attaquant
     * qui a volé un jeton continue de faire tourner la chaîne, et c'est le
     * porteur légitime qui rejoue un vieux jeton bien plus tard.
     */
    it('reconnaît un rejeu de PLUSIEURS générations en arrière', async () => {
      const first = await signIn(nextPhone());
      const g1 = await auth.refresh(first.refreshToken, undefined);
      const g2 = await auth.refresh(g1.refreshToken, undefined);

      await expect(auth.refresh(first.refreshToken, undefined)).rejects.toMatchObject({
        code: 'SESSION_REVOKED',
      });

      // Et la CHAÎNE est coupée : le jeton courant meurt avec elle. Sans cela,
      // la détection ne servirait à rien — l'attaquant garderait la session.
      await expect(auth.refresh(g2.refreshToken, undefined)).rejects.toMatchObject({
        code: 'SESSION_REVOKED',
      });
    });

    it('révoque la chaîne concernée, et elle seule', async () => {
      const phone = nextPhone();
      const a = await signIn(phone);
      // Deuxième appareil, même compte.
      const { challengeId } = await auth.requestOtp({
        phone,
        countryIso2: 'BJ',
        captchaToken: 'test',
        purpose: 'LOGIN',
        ip: undefined,
      });
      const b = await auth.verifyOtp({
        challengeId,
        code: sms.lastCodeSent() as string,
        ip: undefined,
        userAgent: undefined,
      });
      expect(b.userId).toBe(a.userId);
      expect(b.isNewUser).toBe(false);

      const a1 = await auth.refresh(a.refreshToken, undefined);
      await expect(auth.refresh(a.refreshToken, undefined)).rejects.toMatchObject({
        code: 'SESSION_REVOKED',
      });
      // a1 est mort avec sa chaîne…
      await expect(auth.refresh(a1.refreshToken, undefined)).rejects.toMatchObject({
        code: 'SESSION_REVOKED',
      });
      // …mais le second appareil n'a rien à voir là-dedans (§2.1 dit « la
      // chaîne », pas « toutes les sessions »).
      const b1 = await auth.refresh(b.refreshToken, undefined);
      expect(b1.accessToken.length).toBeGreaterThan(0);
    });

    it('refuse une génération jamais émise', async () => {
      const { refreshToken } = await signIn(nextPhone());
      const [chainId] = refreshToken.split('.');

      await expect(auth.refresh(`${chainId}.99.nimportequoi`, undefined)).rejects.toMatchObject({
        code: 'SESSION_REVOKED',
      });
    });

    it('refuse une chaîne mal formée sans erreur serveur', async () => {
      // `chain_id` est une colonne uuid : une valeur mal formée atteignant la
      // requête ferait lever Postgres, donc un 500 pour un simple jeton invalide.
      await expect(auth.refresh('pas-un-uuid.0.secret', undefined)).rejects.toMatchObject({
        code: 'SESSION_REVOKED',
      });
    });
  });

  // ── Le pays fermé, avant tout envoi ───────────────────────────────────────

  it('refuse un pays non ouvert AVANT d’envoyer le moindre SMS', async () => {
    const before = sms.sentCount();

    await expect(
      auth.requestOtp({
        phone: nextPhone(),
        countryIso2: 'ZZ',
        captchaToken: 'test',
        purpose: 'SIGNUP',
        ip: undefined,
      }),
    ).rejects.toMatchObject({ code: 'COUNTRY_NOT_SUPPORTED' });

    // Un SMS coûte de l'argent : le refus doit précéder l'envoi, pas le suivre.
    expect(sms.sentCount()).toBe(before);
  });

  // ── Limites de débit ──────────────────────────────────────────────────────

  it('s’arrête à 3 envois par numéro et par heure', async () => {
    const phone = nextPhone();
    for (let i = 0; i < 3; i += 1) {
      await auth.requestOtp({
        phone,
        countryIso2: 'BJ',
        captchaToken: 'test',
        purpose: 'SIGNUP',
        ip: undefined,
      });
    }

    await expect(
      auth.requestOtp({
        phone,
        countryIso2: 'BJ',
        captchaToken: 'test',
        purpose: 'SIGNUP',
        ip: undefined,
      }),
      // §4.1 attribue `RATE_LIMITED` à l'ENVOI et `OTP_ATTEMPTS_EXCEEDED` à la
      // VÉRIFICATION. Le message compte : « demandez un nouveau code » n'a aucun
      // sens quand c'est précisément d'en demander un qui vient d'être refusé.
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('épuise les 5 tentatives, puis exige un nouveau défi', async () => {
    const { challengeId } = await auth.requestOtp({
      phone: nextPhone(),
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const good = sms.lastCodeSent() as string;
    const wrong = good === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i += 1) {
      await expect(
        auth.verifyOtp({ challengeId, code: wrong, ip: undefined, userAgent: undefined }),
      ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    }

    // Le BON code ne passe plus : cinq tentatives, puis nouveau défi (§2.1).
    await expect(
      auth.verifyOtp({ challengeId, code: good, ip: undefined, userAgent: undefined }),
    ).rejects.toMatchObject({ code: 'OTP_ATTEMPTS_EXCEEDED' });
  });

  it('consomme le défi : un code valide ne sert qu’une fois', async () => {
    const { challengeId } = await auth.requestOtp({
      phone: nextPhone(),
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const code = sms.lastCodeSent() as string;

    const session = await auth.verifyOtp({
      challengeId,
      code,
      ip: undefined,
      userAgent: undefined,
    });
    createdUserIds.push(session.userId);

    await expect(
      auth.verifyOtp({ challengeId, code, ip: undefined, userAgent: undefined }),
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  // ── Sessions ──────────────────────────────────────────────────────────────

  it('ne renvoie jamais l’IP dans la liste des appareils', async () => {
    const { userId, accessToken } = await signIn(nextPhone());
    const claims = new TokenService().verify(accessToken);
    expect(claims).not.toBeNull();
    const sid = (claims as AccessClaims).sid;

    const sessions = await auth.listSessions(userId, sid);

    expect(sessions.length).toBeGreaterThan(0);
    // §8.1 ne collecte aucune position plus fine que la ville, et une IP en est
    // une approximation : elle sert aux limites de débit, jamais à l'affichage.
    for (const session of sessions) {
      expect(Object.keys(session)).not.toContain('ip');
      expect(Object.keys(session)).not.toContain('userAgent');
    }
    expect(sessions.some((s) => s.isCurrent)).toBe(true);
  });
});
