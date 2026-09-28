import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { PrismaService } from '../../../common/prisma.service';
import { SMS_PROVIDER, type FakeSmsProvider } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { AdminService } from '../../admin/admin.service';
import { ModerationService } from '../moderation.service';

/**
 * « Un banni ne peut pas se réinscrire » — 13 §4.2 et §11.
 *
 * C'est une DÉCISION du porteur du projet, prise contre l'état du schéma : la table
 * `banned_phone_hashes` que §4.2 exige mot pour mot n'existait pas, et la règle
 * n'était donc tenue qu'à moitié. Ce fichier délimite les deux moitiés, parce que
 * c'est la seconde qui était fausse :
 *
 *   · le compte banni EXISTE ENCORE → `phone_numbers.phone_hmac` est unique, une
 *     réinscription retombe sur lui, et `resumeAccount` refuse. Déjà couvert
 *     ailleurs, et déjà éprouvé par mutation.
 *   · le compte banni est SUPPRIMÉ → la cascade vide `phone_numbers`, l'empreinte
 *     redevient libre, et le banni revient avec le même téléphone. **C'était le
 *     trou**, vérifié en base avant d'écrire la table, et c'est ce que ces tests
 *     ferment.
 *
 * La règle traverse trois modules — la modération écrit la liste, l'authentification
 * la lit, l'administration l'efface — d'où un fichier à elle plutôt qu'une section
 * dans l'un des trois.
 */
describe('liste noire des numéros bannis (13 §4.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let auth: AuthService;
  let moderation: ModerationService;
  let admin: AdminService;
  let sms: FakeSmsProvider;

  const run = String(Date.now()).slice(-6);
  let counter = 0;
  let countryId = '';
  let franceId = '';
  let staffId = '';
  let moderatorId = '';
  const createdUsers: string[] = [];
  const createdHashes: string[] = [];

  /** Un numéro français distinct par test : l'empreinte est unique en base. */
  const nextPhone = (): string => `06${run}${String(counter++).padStart(2, '0')}`;

  /**
   * L'EMPREINTE PORTE SUR L'E.164, et ma première version l'a oublié.
   *
   * `CryptoService.phoneFingerprint` prend un numéro international ; l'inscription
   * normalise « 06… » en « +336… » avant de hacher (`AuthService.toE164`, privé).
   * Ma fixture stockait l'empreinte du format NATIONAL : les deux hachages
   * différaient, la liste noire ne correspondait jamais, et le test échouait en
   * accusant le code alors que c'était lui qui mesurait la mauvaise chose.
   *
   * Conséquence à connaître au-delà de ce fichier : toute fixture qui écrit un
   * `phone_hmac` à la main doit passer par l'E.164, sinon elle fabrique une ligne
   * que l'application ne retrouvera jamais. Le test d'administration a le même motif
   * — il ne s'en est pas aperçu parce qu'il ne croise jamais le chemin d'OTP.
   */
  const fingerprintOf = (nationalPhone: string): string =>
    crypto.phoneFingerprint(`+33${nationalPhone.replace(/^0+/, '')}`);

  async function member(): Promise<{ id: string; phone: string }> {
    const id = newId();
    const phone = nextPhone();
    await prisma.user.create({
      data: {
        id,
        handle: `bp${run}${counter}${id.slice(-6)}`,
        displayName: 'Membre banni',
        phase: 'SETTLED',
        verificationLevel: 'L2',
        plan: 'FREE',
        status: 'ACTIVE',
        originCountryId: countryId,
      },
    });
    createdUsers.push(id);
    await prisma.phoneNumber.create({
      data: {
        id: newId(),
        userId: id,
        countryId: franceId,
        phoneEncrypted: crypto.encryptPhone(phone),
        phoneHmac: fingerprintOf(phone),
        isPrimary: true,
        isDestination: true,
        verifiedAt: new Date(),
      },
    });
    createdHashes.push(fingerprintOf(phone));
    return { id, phone };
  }

  /** Bannit comme la modération le fait : un dossier, puis l'action. */
  async function ban(userId: string): Promise<string> {
    const caseId = newId();
    await prisma.moderationCase.create({
      data: {
        id: caseId,
        subjectType: 'POST',
        subjectId: newId(),
        subjectAuthorUserId: userId,
        source: 'REPORT',
        priority: 1,
        status: 'OPEN',
        slaDueAt: new Date(Date.now() + 86_400_000),
      },
    });
    await moderation.act({ staffId, role: 'SUPER_ADMIN' }, caseId, {
      action: 'BAN_USER',
      reason: 'Motif de bannissement suffisamment long pour le schéma de validation.',
    });
    const sanction = await prisma.sanction.findFirstOrThrow({
      where: { userId, type: 'BAN' },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return sanction.id;
  }

  async function staff(role: 'SUPER_ADMIN' | 'MODERATOR'): Promise<string> {
    const id = newId();
    await prisma.staffUser.create({
      data: {
        id,
        email: `bp-${role.toLowerCase()}-${run}@local`,
        displayName: `Équipe ${role}`,
        passwordHash: 'x',
        totpSecretEncrypted: new Uint8Array([0]),
        role,
        isActive: true,
      },
    });
    return id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    crypto = app.get(CryptoService);
    auth = app.get(AuthService);
    moderation = app.get(ModerationService);
    admin = app.get(AdminService);
    sms = app.get<FakeSmsProvider>(SMS_PROVIDER);

    const origin = await prisma.country.findFirstOrThrow({
      where: { kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = origin.id;
    franceId = (await prisma.country.findUniqueOrThrow({ where: { iso2: 'FR' } })).id;
    /**
     * Les comptes d'équipe ne sont PAS supprimés en fin de fichier : une
     * `moderation_actions` les référence, la table est en ajout seul, et le
     * déclencheur refuse l'`UPDATE` que la cascade `SetNull` exigerait.
     */
    staffId = await staff('SUPER_ADMIN');
    moderatorId = await staff('MODERATOR');
  });

  afterAll(async () => {
    if (createdHashes.length > 0) {
      await prisma.bannedPhoneHash.deleteMany({ where: { phoneHmac: { in: createdHashes } } });
    }
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    /**
     * LES DOSSIERS DE MODÉRATION NE SE SUPPRIMENT PAS, et ce n'est pas un oubli.
     *
     * Les effacer cascade sur `moderation_actions`, qui est en AJOUT SEUL : un
     * déclencheur en base refuse `DELETE` (§8.5). Ma première version le tentait, et
     * le résultat valait d'être vu — les six tests passaient, et le FICHIER était
     * marqué en échec sur un `PrismaClientUnknownRequestError` levé dans `afterAll`.
     * Un nettoyage qui échoue rend une suite rouge sans qu'aucune assertion ne soit
     * fausse, et l'on cherche alors le défaut dans le code éprouvé.
     *
     * Les comptes d'équipe restent pour la même raison : une action de modération
     * les référence, et la cascade `SetNull` est un `UPDATE` que le même déclencheur
     * refuse.
     */
    await app.close();
  });

  it('[RÈGLE DURE] bannir inscrit le numéro en liste noire, dans la transaction de la sanction', async () => {
    const target = await member();
    const sanctionId = await ban(target.id);

    const listed = await prisma.bannedPhoneHash.findUnique({
      where: { phoneHmac: fingerprintOf(target.phone) },
      select: { sanctionId: true },
    });
    expect(listed).not.toBeNull();
    // La sanction est tracée sur la ligne, et c'est par elle qu'on lève — la seule
    // façon de lever un bannissement dont le compte a été supprimé, puisque la
    // liste noire ne porte aucune référence au membre.
    expect(listed?.sanctionId).toBe(sanctionId);
  });

  it('[RÈGLE DURE] le banni ne se réinscrit pas, MÊME son compte supprimé', async () => {
    const target = await member();
    await ban(target.id);
    const fingerprint = fingerprintOf(target.phone);

    /**
     * On supprime le compte pour de vrai : c'est LE cas que la liste noire existe
     * pour couvrir. Sans elle, la cascade vide `phone_numbers` et l'empreinte
     * redevient libre.
     */
    await prisma.user.delete({ where: { id: target.id } });
    expect(await prisma.phoneNumber.count({ where: { phoneHmac: fingerprint } })).toBe(0);
    expect(await prisma.bannedPhoneHash.count({ where: { phoneHmac: fingerprint } })).toBe(1);

    const challenge = await auth.requestOtp({
      phone: target.phone,
      countryIso2: 'FR',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const code = sms.lastCodeSent();
    expect(code).not.toBeNull();

    await expect(
      auth.verifyOtp({
        challengeId: challenge.challengeId,
        code: code as string,
        ip: undefined,
        userAgent: undefined,
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_BANNED' });

    // Et AUCUN compte n'a été créé au passage : le refus arrive avant la création,
    // pas après.
    expect(await prisma.phoneNumber.count({ where: { phoneHmac: fingerprint } })).toBe(0);
  });

  it('un numéro jamais banni s’inscrit normalement', async () => {
    /**
     * La moitié qu'on oublie. Sans ce test, un contrôle qui refuserait TOUT
     * passerait les deux précédents — et personne ne pourrait plus s'inscrire.
     */
    const phone = nextPhone();
    const challenge = await auth.requestOtp({
      phone,
      countryIso2: 'FR',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const code = sms.lastCodeSent();
    const session = await auth.verifyOtp({
      challengeId: challenge.challengeId,
      code: code as string,
      ip: undefined,
      userAgent: undefined,
    });
    createdUsers.push(session.userId);
    createdHashes.push(fingerprintOf(phone));
    expect(session.isNewUser).toBe(true);
  });

  it('lever le bannissement retire le numéro, et le membre peut revenir', async () => {
    const target = await member();
    const sanctionId = await ban(target.id);
    const fingerprint = fingerprintOf(target.phone);

    const result = await admin.unbanMember(
      { staffId, role: 'SUPER_ADMIN', sessionId: newId(), ip: null },
      target.id,
      { reason: 'Après examen du recours, la sanction est disproportionnée.' },
    );
    expect(result.sanctionId).toBe(sanctionId);
    expect(result.phoneHashesCleared).toBe(1);
    expect(await prisma.bannedPhoneHash.count({ where: { phoneHmac: fingerprint } })).toBe(0);

    const sanction = await prisma.sanction.findUniqueOrThrow({
      where: { id: sanctionId },
      select: { liftedAt: true },
    });
    expect(sanction.liftedAt).not.toBeNull();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: { status: true },
    });
    expect(user.status).toBe('ACTIVE');
  });

  it('lever un bannissement inexistant est un conflit, pas un succès silencieux', async () => {
    const target = await member();
    await expect(
      admin.unbanMember(
        { staffId, role: 'SUPER_ADMIN', sessionId: newId(), ip: null },
        target.id,
        { reason: 'Motif suffisamment long pour passer le schéma de validation.' },
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('la levée est tracée sous son PROPRE nom, distinct d’une réactivation', async () => {
    const target = await member();
    await ban(target.id);
    await admin.unbanMember(
      { staffId, role: 'SUPER_ADMIN', sessionId: newId(), ip: null },
      target.id,
      { reason: 'Après examen du recours, la sanction est disproportionnée.' },
    );

    // « Qui a débanni ce membre, et quand » est la question qu'on posera. Confondre
    // la levée avec une réactivation rendrait la réponse introuvable.
    const trace = await prisma.auditLog.findFirst({
      where: { targetId: target.id, action: 'user.unbanned' },
      select: { actorId: true },
    });
    expect(trace?.actorId).toBe(staffId);
    expect(moderatorId).not.toBe('');
  });
});
