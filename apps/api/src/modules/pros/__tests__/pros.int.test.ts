import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  FREE_PRO_CONTACTS_PER_MONTH,
  PRO_FEATURED_LABEL,
  PRO_FEATURED_SLOTS,
  PRO_RECIPROCAL_CASE_PRIORITY,
  containsForbiddenWord,
  proTextIsAllowed,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { ProsService } from '../pros.service';

/**
 * Annuaire professionnel — 10-services.md §4 et §11.
 *
 * Trois des sept règles dures du §11 vivent ici, et chacune a son test, éprouvé en
 * cassant la règle dans le service :
 *   · « une recommandation pro exige une connexion existante » ;
 *   · « le quota de 3 contacts pro par mois est appliqué côté serveur » ;
 *   · « le téléphone n'est jamais stocké ni renvoyé sur une fiche pro ».
 *
 * S'y ajoute la règle dure 01 §1.2 — le mot « certifié » nulle part — vérifiée à
 * l'entrée (le schéma refuse) ET à la sortie (aucune réponse ne l'emploie).
 *
 * `approve()` écrit `verification_status` DIRECTEMENT en base : §4.1 en fait une
 * décision humaine, et les routes d'administration relèvent du module 15, qui n'existe
 * pas. C'est la seule entorse du fichier, et elle est là pour pouvoir tester ce qui
 * vient APRÈS la validation.
 */
describe('annuaire professionnel (10 §4)', () => {
  let prisma: PrismaService;
  let pros: ProsService;

  const createdUsers: string[] = [];
  const createdAssets: string[] = [];
  const createdConversations: string[] = [];
  const createdCases: string[] = [];

  let originCountryId: string;
  let destinationCountryId: string;
  let cityId: string;
  let otherCityId: string;
  let professionId: string;
  let immigrationProfessionId: string;
  let counter = 0;

  async function member(
    options: { level?: 'L1' | 'L2'; plan?: 'FREE' | 'PREMIUM' } = {},
  ): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `pr${counter}${id.slice(-8)}`,
        displayName: `Membre ${counter}`,
        phase: 'SETTLED',
        verificationLevel: options.level ?? 'L2',
        originCountryId,
        cityId,
        plan: options.plan ?? 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return id;
  }

  async function proof(ownerUserId: string): Promise<string> {
    const id = newId();
    await prisma.mediaAsset.create({
      data: {
        id,
        ownerUserId,
        kind: 'PROOF',
        storageKey: `test/proof/${id}.pdf`,
        mime: 'application/pdf',
        sizeBytes: BigInt(2048),
        status: 'READY',
      },
    });
    createdAssets.push(id);
    return id;
  }

  async function registerPro(
    userId: string,
    overrides: Partial<Parameters<ProsService['putProfile']>[1]> = {},
  ): Promise<string> {
    await pros.putProfile(userId, {
      professionId,
      businessName: 'Cabinet du coin',
      description: 'Accompagnement des démarches du quotidien, en français et en fon.',
      contactMethod: 'PLATFORM_MESSAGE',
      cityIds: [cityId],
      proofAssetId: await proof(userId),
      ...overrides,
    });
    const row = await prisma.proProfile.findUniqueOrThrow({
      where: { userId },
      select: { id: true },
    });
    return row.id;
  }

  /** La validation humaine du §4.1 — module 15. Écrite en base, faute de route. */
  async function approve(proProfileId: string): Promise<void> {
    await prisma.proProfile.update({
      where: { id: proProfileId },
      data: { verificationStatus: 'APPROVED' },
    });
  }

  /**
   * Un contact entre deux membres.
   *
   * La paire est ORDONNÉE : `connections` porte une contrainte `connections_ordered_pair`
   * qui impose `user_a_id < user_b_id`. Découvert en écrivant ce test — et c'est une
   * bonne nouvelle pour le service, dont la recherche de contact interroge les deux
   * ordres et reste donc juste quel que soit le sens du geste.
   */
  async function connect(a: string, b: string): Promise<string> {
    const id = newId();
    const [userAId, userBId] = a < b ? [a, b] : [b, a];
    await prisma.connection.create({
      data: { id, userAId, userBId, origin: 'MANUAL' },
    });
    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    pros = new ProsService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
    );

    const origin = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = origin.id;
    const destination = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['DESTINATION', 'BOTH'] } },
      select: { id: true },
    });
    destinationCountryId = destination.id;

    const cities = await prisma.city.findMany({
      where: { mergedIntoCityId: null },
      select: { id: true },
      orderBy: { slug: 'asc' },
      take: 2,
    });
    cityId = (cities[0] as { id: string }).id;
    otherCityId = (cities[1] as { id: string }).id;

    const profession = await prisma.profession.findFirstOrThrow({
      where: { isActive: true, nameFr: 'Comptable' },
      select: { id: true },
    });
    professionId = profession.id;
    const immigration = await prisma.profession.findFirstOrThrow({
      where: { nameFr: { startsWith: 'Conseiller en immigration' } },
      select: { id: true },
    });
    immigrationProfessionId = immigration.id;
  });

  afterAll(async () => {
    await prisma.moderationCase.deleteMany({
      where: { OR: [{ id: { in: createdCases } }, { subjectAuthorUserId: { in: createdUsers } }] },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: createdAssets } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversations } } });
    await prisma.$disconnect();
  });

  // ── RÈGLE DURE : le mot « certifié » nulle part (01 §1.2) ─────────────────

  it('rule: le mot « certifié » est refusé dans tous les textes d’une fiche pro', async () => {
    // LES TROIS champs, un par un : businessName seul aurait laissé passer la
    // description, qui est justement l'endroit où la phrase est la plus tentante.
    for (const field of ['businessName', 'description', 'priceHint'] as const) {
      const user = await member();
      const base = {
        professionId,
        contactMethod: 'PLATFORM_MESSAGE' as const,
        cityIds: [cityId],
        businessName: 'Cabinet honnête',
        description: 'Accompagnement des démarches du quotidien.',
        priceHint: '60 € la consultation',
        proofAssetId: await proof(user),
      };
      await expect(
        pros.putProfile(user, {
          ...base,
          [field]: field === 'priceHint' ? 'Tarif certifié 60 €' : 'Comptable certifié à Lyon',
        }),
        `${field} accepte « certifié »`,
      ).rejects.toMatchObject({ response: { error: { code: 'FORBIDDEN_WORD' } } });
      // Aucune fiche n'a été créée au passage.
      expect(await prisma.proProfile.count({ where: { userId: user } })).toBe(0);
    }

    // Le commentaire d'une recommandation est soumis à la même règle.
    expect(proTextIsAllowed('Comptable certifié, je recommande')).toBe(false);
    expect(proTextIsAllowed('Il m’a aidée à obtenir mon certificat de travail')).toBe(true);
  });

  it('« certificat » reste accepté : c’est un document réel que les membres doivent pouvoir nommer', async () => {
    const user = await member();
    const profile = await pros.putProfile(user, {
      professionId,
      businessName: 'Cabinet Aïcha',
      description: 'Je vous aide à réunir un certificat de travail et les attestations utiles.',
      contactMethod: 'PLATFORM_MESSAGE',
      cityIds: [cityId],
      proofAssetId: await proof(user),
    });
    expect(profile?.description).toContain('certificat');
  });

  it('aucun libellé renvoyé par l’annuaire n’emploie un mot interdit', async () => {
    const user = await member();
    const id = await registerPro(user);
    await approve(id);
    const detail = await pros.detail(id, null);
    expect(containsForbiddenWord(JSON.stringify(detail))).toBe(false);
    const list = await pros.list({ limit: 20 }, null);
    expect(containsForbiddenWord(JSON.stringify(list))).toBe(false);
    expect(containsForbiddenWord(PRO_FEATURED_LABEL)).toBe(false);
  });

  it('la mention obligatoire du métier voyage avec la fiche', async () => {
    const user = await member();
    const id = await registerPro(user, { professionId: immigrationProfessionId });
    await approve(id);
    const detail = await pros.detail(id, null);
    expect(detail.profession.nameFr).toContain('ne se substitue pas à un avocat');
  });

  // ── RÈGLE DURE : le téléphone jamais stocké ni renvoyé (§11) ──────────────

  it('rule: le téléphone n’est jamais stocké ni renvoyé sur une fiche pro', async () => {
    const user = await member();
    // Le membre A un numéro vérifié — c'est ce qui lui donne le L2. La fiche n'en
    // sait rien, et « sur demande » ne le fait pas apparaître.
    await prisma.phoneNumber.create({
      data: {
        id: newId(),
        userId: user,
        countryId: destinationCountryId,
        phoneEncrypted: Buffer.from('chiffré'),
        phoneHmac: `hmac-${newId()}`,
        isPrimary: true,
        isDestination: true,
        verifiedAt: new Date(),
      },
    });

    const id = await registerPro(user, { contactMethod: 'PHONE_ON_REQUEST' });
    await approve(id);

    const detail = await pros.detail(id, null);
    const serialized = JSON.stringify(detail);

    // Aucun champ de téléphone dans la fiche.
    expect(Object.keys(detail).some((key) => /phone/i.test(key))).toBe(false);
    for (const forbidden of ['phoneEncrypted', 'phoneHmac', 'phoneNumber', 'chiffré']) {
      expect(serialized).not.toContain(forbidden);
    }
    // `contactHint` est une EXPLICATION, pas un numéro : aucune suite de chiffres.
    expect(detail.contactHint).toBeTruthy();
    expect(/\d{6,}/.test(detail.contactHint as string)).toBe(false);

    // Et la colonne n'existe pas : `pro_profiles` ne porte aucun champ de téléphone.
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'pro_profiles'
    `;
    expect(columns.some((c) => /phone|tel/i.test(c.column_name))).toBe(false);
  });

  it('le justificatif n’est jamais renvoyé, même à son propriétaire', async () => {
    const user = await member();
    const assetId = await proof(user);
    await pros.putProfile(user, {
      professionId,
      contactMethod: 'PLATFORM_MESSAGE',
      cityIds: [cityId],
      proofAssetId: assetId,
    });
    const mine = await pros.myProfile(user);
    expect(JSON.stringify(mine)).not.toContain(assetId);
    // Le titulaire sait seulement qu'un justificatif est déposé.
    expect((mine as { hasProof: boolean }).hasProof).toBe(true);
  });

  // ── Référencement (§4.1) ──────────────────────────────────────────────────

  it('une fiche pro exige L2 et un justificatif', async () => {
    const l1 = await member({ level: 'L1' });
    await expect(
      pros.putProfile(l1, {
        professionId,
        contactMethod: 'PLATFORM_MESSAGE',
        cityIds: [cityId],
        proofAssetId: await proof(l1),
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'LEVEL_REQUIRED' } } });

    const l2 = await member();
    await expect(
      pros.putProfile(l2, {
        professionId,
        contactMethod: 'PLATFORM_MESSAGE',
        cityIds: [cityId],
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'PROOF_REQUIRED' } } });
  });

  it('un justificatif qui n’appartient pas au membre est refusé', async () => {
    const user = await member();
    const stranger = await member();
    await expect(
      pros.putProfile(user, {
        professionId,
        contactMethod: 'PLATFORM_MESSAGE',
        cityIds: [cityId],
        proofAssetId: await proof(stranger),
      }),
    ).rejects.toMatchObject({ response: { error: { code: 'VALIDATION_FAILED' } } });
  });

  it('une fiche en attente de validation est invisible pour tout le monde sauf son titulaire', async () => {
    const owner = await member();
    const reader = await member();
    const id = await registerPro(owner);

    await expect(pros.detail(id, reader)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
    const list = await pros.list({ limit: 50 }, reader);
    expect(list.items.map((item) => item.id)).not.toContain(id);

    // Le titulaire, lui, voit sa fiche et son statut.
    const mine = await pros.detail(id, owner);
    expect(mine.verificationStatus).toBe('PENDING');

    await approve(id);
    const visible = await pros.list({ limit: 50 }, reader);
    expect(visible.items.map((item) => item.id)).toContain(id);
  });

  it('modifier une fiche déjà validée ne la renvoie pas en file d’attente', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    await pros.putProfile(owner, {
      professionId,
      businessName: 'Cabinet du coin, nouvelle adresse',
      contactMethod: 'EMAIL',
      cityIds: [cityId, otherCityId],
      priceHint: '80 € la consultation',
    });
    const row = await prisma.proProfile.findUniqueOrThrow({
      where: { id },
      select: { verificationStatus: true, contactMethod: true, cities: { select: { cityId: true } } },
    });
    expect(row.verificationStatus).toBe('APPROVED');
    expect(row.contactMethod).toBe('EMAIL');
    expect(row.cities).toHaveLength(2);
  });

  it('déposer un nouveau justificatif relance la relecture', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    await pros.submitProof(owner, await proof(owner));
    const row = await prisma.proProfile.findUniqueOrThrow({
      where: { id },
      select: { verificationStatus: true },
    });
    expect(row.verificationStatus).toBe('PENDING');
  });

  // ── RÈGLE DURE : classement jamais purement payant (§4.2) ─────────────────

  it('rule: au plus deux fiches mises en avant, signalées, et le classement naturel n’est jamais payant', async () => {
    const professionForTest = await prisma.profession.findFirstOrThrow({
      where: { isActive: true, nameFr: 'Avocat' },
      select: { id: true },
    });

    // Trois fiches payantes, une fiche gratuite très recommandée.
    const paidIds: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const owner = await member();
      const id = await registerPro(owner, { professionId: professionForTest.id });
      await approve(id);
      await prisma.proProfile.update({
        where: { id },
        data: {
          tier: 'PRO',
          tierUntil: new Date(Date.now() + 30 * 86_400_000),
          recommendationCount: 1,
        },
      });
      paidIds.push(id);
    }
    const freeOwner = await member();
    const freeId = await registerPro(freeOwner, { professionId: professionForTest.id });
    await approve(freeId);
    await prisma.proProfile.update({
      where: { id: freeId },
      data: { recommendationCount: 50 },
    });

    const list = await pros.list({ limit: 20, professionId: professionForTest.id }, null);

    // Deux emplacements, pas trois, et chacun SIGNALÉ.
    expect(list.featured).toHaveLength(PRO_FEATURED_SLOTS);
    for (const card of list.featured) {
      expect(card.isFeatured).toBe(true);
      expect(card.featuredLabel).toBe(PRO_FEATURED_LABEL);
    }
    // Aucun doublon entre la tête et le corps.
    for (const card of list.featured) {
      expect(list.items.map((item) => item.id)).not.toContain(card.id);
    }
    // Le classement naturel est celui des RECOMMANDATIONS : la fiche gratuite la plus
    // recommandée (50) passe devant la fiche payante qui déborde (1 recommandation).
    // C'est le cœur de « jamais purement payant » : payer ne déclasse pas le mérite.
    expect(list.items[0]?.id).toBe(freeId);
    expect(list.items[0]?.isFeatured).toBe(false);
    // La troisième fiche payante — celle qui n'a pas eu d'emplacement — est bien dans
    // le corps de liste, et n'y est plus signalée comme mise en avant.
    const featuredIds = list.featured.map((card) => card.id);
    const overflow = paidIds.filter((id) => !featuredIds.includes(id));
    expect(overflow).toHaveLength(1);
    expect(list.items.map((item) => item.id)).toContain(overflow[0]);
    expect(list.items.find((item) => item.id === overflow[0])?.isFeatured).toBe(false);
  });

  it('un palier échu ne donne plus d’emplacement mis en avant, même si la colonne dit le contraire', async () => {
    const professionForTest = await prisma.profession.findFirstOrThrow({
      where: { isActive: true, nameFr: 'Notaire' },
      select: { id: true },
    });
    const owner = await member();
    const id = await registerPro(owner, { professionId: professionForTest.id });
    await approve(id);
    await prisma.proProfile.update({
      where: { id },
      data: { tier: 'PRO_PLUS', tierUntil: new Date(Date.now() - 86_400_000) },
    });

    const list = await pros.list({ limit: 20, professionId: professionForTest.id }, null);
    expect(list.featured).toHaveLength(0);
    const card = list.items.find((item) => item.id === id);
    // §4.1 : « Un abonnement expiré rétrograde en FREE sans supprimer la fiche. »
    expect(card?.tier).toBe('FREE');
    expect(card?.isFeatured).toBe(false);

    expect(await pros.expireTiers()).toBeGreaterThanOrEqual(1);
    const row = await prisma.proProfile.findUniqueOrThrow({
      where: { id },
      select: { tier: true },
    });
    expect(row.tier).toBe('FREE');
  });

  /**
   * LOT A — `GET /me/pro-profile` rendait TOUJOURS `isFeatured: false` : `toCard`
   * recevait sans son troisième argument. Le titulaire d'une fiche payante ne voyait
   * donc jamais « mise en avant » sur sa propre fiche, que la liste publique
   * affichait pourtant.
   */
  it('ma fiche payante est « mise en avant », ma fiche gratuite ou échue ne l’est pas', async () => {
    const professionForTest = await prisma.profession.findFirstOrThrow({
      where: { isActive: true, nameFr: 'Avocat' },
      select: { id: true },
    });
    const owner = await member();
    const id = await registerPro(owner, { professionId: professionForTest.id });
    await approve(id);

    expect((await pros.myProfile(owner))?.isFeatured).toBe(false);

    await prisma.proProfile.update({
      where: { id },
      data: { tier: 'PRO', tierUntil: new Date(Date.now() + 30 * 86_400_000) },
    });
    const payante = await pros.myProfile(owner);
    expect(payante?.isFeatured).toBe(true);
    expect(payante?.featuredLabel).toBe(PRO_FEATURED_LABEL);

    await prisma.proProfile.update({
      where: { id },
      data: { tierUntil: new Date(Date.now() - 86_400_000) },
    });
    expect((await pros.myProfile(owner))?.isFeatured).toBe(false);
  });

  it('le filtre de ville et le blocage s’appliquent ENSEMBLE', async () => {
    const reader = await member();
    const blockedOwner = await member();
    const visibleOwner = await member();
    const professionForTest = await prisma.profession.findFirstOrThrow({
      where: { isActive: true, nameFr: 'Traducteur assermenté' },
      select: { id: true },
    });

    const hidden = await registerPro(blockedOwner, {
      professionId: professionForTest.id,
      cityIds: [cityId],
    });
    const shown = await registerPro(visibleOwner, {
      professionId: professionForTest.id,
      cityIds: [cityId],
    });
    await approve(hidden);
    await approve(shown);

    await prisma.block.create({
      data: { id: newId(), blockerUserId: blockedOwner, blockedUserId: reader },
    });

    const list = await pros.list(
      { limit: 50, professionId: professionForTest.id, cityId },
      reader,
    );
    const ids = list.items.map((item) => item.id);
    expect(ids).toContain(shown);
    expect(ids).not.toContain(hidden);
    expect(list.featured.map((card) => card.id)).not.toContain(hidden);
  });

  // ── RÈGLE DURE : quota de contact (§4.4, §11) ─────────────────────────────

  it('rule: le quota de 3 contacts pro par mois est appliqué côté serveur', async () => {
    const visitor = await member({ level: 'L1', plan: 'FREE' });
    const ids: string[] = [];
    for (let index = 0; index < FREE_PRO_CONTACTS_PER_MONTH + 1; index += 1) {
      const owner = await member();
      const id = await registerPro(owner);
      await approve(id);
      ids.push(id);
    }

    for (let index = 0; index < FREE_PRO_CONTACTS_PER_MONTH; index += 1) {
      const result = await pros.contact(ids[index] as string, visitor);
      createdConversations.push(result.conversationId);
      expect(result.quota).toEqual({ used: index + 1, max: FREE_PRO_CONTACTS_PER_MONTH });
    }

    // La quatrième fiche DISTINCTE est refusée, avec l'invitation Premium.
    await expect(pros.contact(ids[3] as string, visitor)).rejects.toMatchObject({
      response: {
        error: {
          code: 'PLAN_LIMIT_REACHED',
          details: { limit: 'proContactsPerMonth', max: FREE_PRO_CONTACTS_PER_MONTH },
        },
      },
    });

    // §4.4 : « Recontacter un pro déjà contacté ce mois-ci ne consomme pas », et la
    // conversation existante reste ouverte même au-delà de la limite.
    const again = await pros.contact(ids[0] as string, visitor);
    expect(again.quota.used).toBe(FREE_PRO_CONTACTS_PER_MONTH);
    const logs = await prisma.proContactLog.count({
      where: { userId: visitor, proProfileId: ids[0] as string },
    });
    expect(logs).toBe(1);

    // Le refus n'a laissé AUCUNE trace : ni journal, ni compteur avancé.
    const refused = await prisma.proContactLog.count({
      where: { userId: visitor, proProfileId: ids[3] as string },
    });
    expect(refused).toBe(0);
    const counter = await prisma.usageCounter.findFirstOrThrow({
      where: { userId: visitor, metric: 'PRO_CONTACTS' },
      select: { count: true },
    });
    expect(counter.count).toBe(FREE_PRO_CONTACTS_PER_MONTH);
  });

  it('Premium contacte sans limite, et sans compteur qui monte pour rien', async () => {
    const visitor = await member({ level: 'L1', plan: 'PREMIUM' });
    for (let index = 0; index < FREE_PRO_CONTACTS_PER_MONTH + 2; index += 1) {
      const owner = await member();
      const id = await registerPro(owner);
      await approve(id);
      const result = await pros.contact(id, visitor);
      createdConversations.push(result.conversationId);
      expect(result.quota.max).toBeNull();
    }
    const counter = await prisma.usageCounter.count({
      where: { userId: visitor, metric: 'PRO_CONTACTS' },
    });
    expect(counter).toBe(0);
  });

  it('on ne contacte pas sa propre fiche', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    await expect(pros.contact(id, owner)).rejects.toMatchObject({
      response: { error: { code: 'OWN_PROFILE' } },
    });
  });

  // ── RÈGLE DURE : recommandation conditionnée au contact (§4.3, §11) ───────

  it('rule: une recommandation pro exige une connexion existante', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    const visitor = await member({ level: 'L1' });

    await expect(
      pros.recommend(id, visitor, { comment: 'Travail sérieux et tarifs clairs.' }),
    ).rejects.toMatchObject({ response: { error: { code: 'CONNECTION_REQUIRED' } } });
    expect(await prisma.proRecommendation.count({ where: { proProfileId: id } })).toBe(0);

    const connectionId = await connect(visitor, owner);
    const created = await pros.recommend(id, visitor, {
      comment: 'Travail sérieux et tarifs clairs.',
    });
    expect(created.id).toBeTruthy();

    // La recommandation PORTE le contact : c'est ce que §4.3 appelle « vérifié ».
    const row = await prisma.proRecommendation.findUniqueOrThrow({
      where: { id: created.id },
      select: { connectionId: true },
    });
    expect(row.connectionId).toBe(connectionId);

    const detail = await pros.detail(id, visitor);
    expect(detail.recommendationCount).toBe(1);
    // §4.3 : « Affichées avec le handle du recommandeur. »
    expect(detail.recommendations[0]?.handle).toBeTruthy();

    // Une seule par membre et par fiche.
    await expect(pros.recommend(id, visitor, {})).rejects.toMatchObject({
      response: { error: { code: 'ALREADY_RECOMMENDED' } },
    });
  });

  it('un pro ne se recommande pas lui-même', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    await expect(pros.recommend(id, owner, {})).rejects.toMatchObject({
      response: { error: { code: 'OWN_PROFILE' } },
    });
  });

  it('retirer sa recommandation décrémente le compteur sans le rendre négatif', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    const visitor = await member({ level: 'L1' });
    await connect(visitor, owner);
    await pros.recommend(id, visitor, {});

    expect(await pros.unrecommend(id, visitor)).toEqual({ deleted: true });
    const row = await prisma.proProfile.findUniqueOrThrow({
      where: { id },
      select: { recommendationCount: true },
    });
    expect(row.recommendationCount).toBe(0);
    await expect(pros.unrecommend(id, visitor)).rejects.toMatchObject({
      response: { error: { code: 'NOT_FOUND' } },
    });
  });

  it('une recommandation réciproque dans les sept jours est acceptée mais marquée pour revue', async () => {
    const proA = await member();
    const proB = await member();
    const idA = await registerPro(proA);
    const idB = await registerPro(proB);
    await approve(idA);
    await approve(idB);
    await connect(proA, proB);

    const first = await pros.recommend(idB, proA, { comment: 'Excellent professionnel.' });
    expect(first.flaggedForReview).toBe(false);

    const second = await pros.recommend(idA, proB, { comment: 'Je recommande également.' });
    expect(second.flaggedForReview).toBe(true);

    const moderation = await prisma.moderationCase.findFirstOrThrow({
      where: { subjectType: 'PRO', subjectId: idA, source: 'AUTO_RULE' },
      select: { id: true, priority: true, aiLabels: true },
    });
    createdCases.push(moderation.id);
    expect(moderation.priority).toBe(PRO_RECIPROCAL_CASE_PRIORITY);
    expect(moderation.aiLabels).toContain('RECIPROCAL_RECOMMENDATION');

    // Acceptée : les deux recommandations existent bel et bien.
    expect(await prisma.proRecommendation.count({ where: { proProfileId: idA } })).toBe(1);
    expect(await prisma.proRecommendation.count({ where: { proProfileId: idB } })).toBe(1);
  });

  // ── Gestionnaires d'événements (§8) ───────────────────────────────────────

  it('un contact retiré emporte la recommandation qu’il fondait, et le rejeu ne casse rien', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    const visitor = await member({ level: 'L1' });
    const connectionId = await connect(visitor, owner);
    await pros.recommend(id, visitor, { comment: 'Très bon accompagnement.' });

    await pros.handleConnectionRemoved(connectionId);
    await pros.handleConnectionRemoved(connectionId);

    expect(await prisma.proRecommendation.count({ where: { proProfileId: id } })).toBe(0);
    const row = await prisma.proProfile.findUniqueOrThrow({
      where: { id },
      select: { recommendationCount: true },
    });
    // Recalculé et non décrémenté : un rejeu ne peut pas le faire plonger.
    expect(row.recommendationCount).toBe(0);
  });

  it('un blocage retire la recommandation entre les deux membres, dans les deux sens', async () => {
    const owner = await member();
    const id = await registerPro(owner);
    await approve(id);
    const visitor = await member({ level: 'L1' });
    await connect(visitor, owner);
    await pros.recommend(id, visitor, { comment: 'Rendez-vous rapide et clair.' });

    // Le PRO bloque le recommandeur : la séparation vaut dans les deux sens.
    await pros.handleUserBlocked(owner, visitor);
    await pros.handleUserBlocked(owner, visitor);

    expect(await prisma.proRecommendation.count({ where: { proProfileId: id } })).toBe(0);
    const row = await prisma.proProfile.findUniqueOrThrow({
      where: { id },
      select: { recommendationCount: true },
    });
    expect(row.recommendationCount).toBe(0);
  });

  // ── Suppression de compte (§10) ───────────────────────────────────────────

  it('la suppression d’un compte détruit la fiche, son justificatif et ses recommandations', async () => {
    const owner = await member();
    const assetId = await proof(owner);
    await pros.putProfile(owner, {
      professionId,
      contactMethod: 'PLATFORM_MESSAGE',
      cityIds: [cityId],
      proofAssetId: assetId,
    });
    const profile = await prisma.proProfile.findUniqueOrThrow({
      where: { userId: owner },
      select: { id: true },
    });
    await approve(profile.id);

    const visitor = await member({ level: 'L1' });
    await connect(visitor, owner);
    await pros.recommend(profile.id, visitor, { comment: 'Aide précieuse pour mon dossier.' });
    const contact = await pros.contact(profile.id, visitor);
    createdConversations.push(contact.conversationId);

    await pros.handleUserDeleted(owner);
    await pros.handleUserDeleted(owner);

    expect(await prisma.proProfile.count({ where: { id: profile.id } })).toBe(0);
    expect(await prisma.proRecommendation.count({ where: { proProfileId: profile.id } })).toBe(0);
    // Le justificatif est DÉTRUIT : `onDelete: SetNull` l'aurait laissé en place.
    expect(await prisma.mediaAsset.count({ where: { id: assetId } })).toBe(0);
    // Le journal de contact de l'AUTRE membre a disparu avec la fiche, mais son
    // compteur mensuel — qui porte son propre identifiant — reste juste.
    const counter = await prisma.usageCounter.count({
      where: { userId: visitor, metric: 'PRO_CONTACTS' },
    });
    expect(counter).toBe(1);
  });
});
