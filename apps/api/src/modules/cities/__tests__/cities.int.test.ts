import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { CITY_COUNT_PRIVACY_THRESHOLD, NEWCOMER_WINDOW_DAYS, createCityTipSchema } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { CitiesService, isPaperworkSubject } from '../cities.service';

/**
 * Villes et membres — 09-villes-agenda.md §2 et §10.
 *
 * Le premier bloc est la RÈGLE DURE du §2.1, et c'est celle qui compte : « la
 * carte ne renvoie jamais un compteur inférieur à 3 pour un filtre pays ». Elle a
 * été éprouvée en la cassant — seuil ramené à 0 — et le test tombe.
 *
 * Les villes du référentiel sont INACTIVES au lancement (02 §2.2) : les tests
 * activent la leur le temps de l'exécution et la rendent à son état d'origine,
 * sinon la fiche ville et la carte n'auraient rien à montrer.
 */
describe('villes et membres (09 §2)', () => {
  let prisma: PrismaService;
  let cities: CitiesService;

  const createdUsers: string[] = [];
  const createdTips: string[] = [];
  const createdStories: string[] = [];
  const createdCommunities: string[] = [];

  let cityId: string;
  let citySlug: string;
  let otherCountryId: string;
  let mainCountryId: string;
  /** Un pays d'origine que SEUL le test du seuil peuple : un membre, et un seul. */
  let lonelyCountryId: string;
  let counter = 0;

  async function member(options: {
    countryId?: string;
    phase?: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED';
    arrivalDate?: Date | null;
    isPublic?: boolean;
    availableToHelp?: boolean;
    cityId?: string | null;
    createdAt?: Date;
  } = {}): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `vil${counter}${id.slice(-8)}`,
        displayName: `Voisin ${counter}`,
        phase: options.phase ?? 'SETTLED',
        verificationLevel: 'L1',
        originCountryId: options.countryId ?? mainCountryId,
        plan: 'FREE',
        status: 'ACTIVE',
        cityId: options.cityId === undefined ? cityId : options.cityId,
        ...(options.arrivalDate === undefined ? {} : { arrivalDate: options.arrivalDate }),
        ...(options.createdAt === undefined ? {} : { createdAt: options.createdAt }),
      },
    });
    createdUsers.push(id);

    if (options.isPublic !== undefined || options.availableToHelp !== undefined) {
      await prisma.userProfile.create({
        data: {
          userId: id,
          occupationStatus: 'OTHER',
          availableToHelp: options.availableToHelp ?? false,
          isPublic: options.isPublic ?? false,
        },
      });
    }
    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    cities = new CitiesService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
    );

    const countries = await prisma.country.findMany({
      where: { kind: { in: ['ORIGIN', 'BOTH'] } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
      take: 3,
    });
    const [first, second, third] = countries;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Trois pays d’origine requis au référentiel.');
    }
    mainCountryId = first.id;
    otherCountryId = second.id;
    lonelyCountryId = third.id;

    // On prend une ville SANS membre pour que les compteurs du test soient les
    // siens : partir d'une ville peuplée rendrait les seuils inobservables.
    const city = await prisma.city.findFirstOrThrow({
      where: { mergedIntoCityId: null, memberCount: 0 },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true },
    });
    cityId = city.id;
    citySlug = city.slug;
    await prisma.city.update({ where: { id: cityId }, data: { isActive: true } });
  });

  afterAll(async () => {
    if (createdTips.length > 0) {
      await prisma.cityTip.deleteMany({ where: { id: { in: createdTips } } });
    }
    if (createdStories.length > 0) {
      await prisma.story.deleteMany({ where: { id: { in: createdStories } } });
    }
    if (createdCommunities.length > 0) {
      await prisma.community.deleteMany({ where: { id: { in: createdCommunities } } });
    }
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    // La ville retrouve son état : une ville laissée active fausserait la carte
    // de tout le monde, y compris les tests des autres modules.
    await prisma.city.update({ where: { id: cityId }, data: { isActive: false } });
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE §10 · le seuil de 3 ════════════════════════════════════════

  describe('rule: la carte ne renvoie jamais un compteur inférieur à 3 pour un filtre pays', () => {
    it('renvoie « moins de 3 » pour 1 et 2 membres, le compte à partir de 3', async () => {
      const seen: { count: number | null; belowThreshold: boolean }[] = [];

      for (let total = 1; total <= 3; total += 1) {
        await member({ countryId: otherCountryId });
        const map = await cities.map(otherCountryId);
        const row = map.items.find((item) => item.id === cityId);
        if (row === undefined) throw new Error('La ville active doit figurer sur la carte.');
        seen.push({ count: row.count, belowThreshold: row.belowThreshold });
      }

      // 1 membre : surtout PAS « 1 ». Ce compteur-là désigne une personne.
      expect(seen[0]).toEqual({ count: null, belowThreshold: true });
      expect(seen[1]).toEqual({ count: null, belowThreshold: true });
      // 3 : le seuil est atteint, l'agrégat ne désigne plus personne.
      expect(seen[2]).toEqual({ count: CITY_COUNT_PRIVACY_THRESHOLD, belowThreshold: false });
    });

    it('ne laisse fuir aucun compteur sous le seuil dans la réponse entière', async () => {
      await member({ countryId: otherCountryId });
      const map = await cities.map(otherCountryId);
      // Sérialisation complète : un compteur brut glissé dans un champ voisin
      // (`raw`, `memberCount`…) contournerait le seuil sans qu'on le voie.
      for (const item of map.items) {
        if (item.belowThreshold) {
          expect(item.count).toBeNull();
          expect(JSON.stringify(item)).not.toMatch(/:\s*[12]\b/);
        }
      }
    });

    it('applique le même seuil à la répartition par pays de la fiche ville', async () => {
      // Un pays RÉSERVÉ à ce test, avec exactement UN membre : l'assertion peut
      // alors être stricte. Réutiliser un pays déjà peuplé par les tests
      // précédents donnerait un compteur au-dessus du seuil, et le test passerait
      // sans rien vérifier — c'est ce que la mutation du seuil a montré.
      const unique = await member({ countryId: lonelyCountryId });
      const profile = await cities.profile(citySlug, unique);
      const row = profile.city.byCountry.find((c) => c.countryId === lonelyCountryId);

      expect(row).toBeDefined();
      // Strictement « moins de 3 » : jamais « 1 ».
      expect(row?.count).toBeNull();
      expect(row?.belowThreshold).toBe(true);
      expect(JSON.stringify(row)).not.toMatch(/:\s*1\b/);
      // Le pays reste LISTÉ : le faire disparaître dirait « personne », ce qui est
      // faux et se recoupe avec le total de la ville.
      expect(profile.city.byCountry.some((c) => c.countryId === lonelyCountryId)).toBe(true);
      // Et le seuil partagé est bien celui de la spec.
      expect(CITY_COUNT_PRIVACY_THRESHOLD).toBe(3);
    });

    it('ne montre pas les villes inactives', async () => {
      const inactive = await prisma.city.findFirstOrThrow({
        where: { isActive: false, mergedIntoCityId: null },
        select: { id: true, slug: true },
      });
      const map = await cities.map(undefined);
      expect(map.items.map((i) => i.id)).not.toContain(inactive.id);
      // Et sa fiche n'existe pas non plus (§2.3).
      await expect(cities.profile(inactive.slug, null)).rejects.toMatchObject({
        code: 'CITY_INACTIVE',
      });
    });
  });

  // ══ Nouveaux arrivants (§2.4) ═════════════════════════════════════════════

  describe('nouveaux arrivants (§2.4)', () => {
    it('retient les 14 derniers jours, et retombe sur created_at', async () => {
      const recent = await member({
        phase: 'RECENT_ARRIVAL',
        arrivalDate: new Date(Date.now() - 3 * 86_400_000),
      });
      const old = await member({
        phase: 'RECENT_ARRIVAL',
        arrivalDate: new Date(Date.now() - (NEWCOMER_WINDOW_DAYS + 5) * 86_400_000),
      });
      // Sans date d'arrivée : c'est `created_at` qui sert (§2.4).
      const noDate = await member({ phase: 'RECENT_ARRIVAL', arrivalDate: null });
      // Installé de longue date : jamais un « nouvel arrivant ».
      const settled = await member({ phase: 'SETTLED' });

      const viewer = await member();
      const profile = await cities.profile(citySlug, viewer);
      const handles = profile.newcomers.map((n) => n.handle);

      const handleOf = async (id: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id }, select: { handle: true } })).handle;

      expect(handles).toContain(await handleOf(recent));
      expect(handles).toContain(await handleOf(noDate));
      expect(handles).not.toContain(await handleOf(old));
      expect(handles).not.toContain(await handleOf(settled));
    });

    it('cache un arrivant bloqué, dans les deux sens', async () => {
      const arrival = await member({
        phase: 'RECENT_ARRIVAL',
        arrivalDate: new Date(Date.now() - 86_400_000),
      });
      const viewer = await member();
      const handle = (
        await prisma.user.findUniqueOrThrow({ where: { id: arrival }, select: { handle: true } })
      ).handle;

      expect((await cities.profile(citySlug, viewer)).newcomers.map((n) => n.handle)).toContain(
        handle,
      );

      // C'est l'ARRIVANT qui bloque le lecteur : il doit tout de même disparaître
      // de la liste de celui-ci (08 §4, la séparation vaut dans les deux sens).
      await prisma.block.create({
        data: { id: newId(), blockerUserId: arrival, blockedUserId: viewer },
      });
      expect(
        (await cities.profile(citySlug, viewer)).newcomers.map((n) => n.handle),
      ).not.toContain(handle);
    });

    it('n’expose hors connexion que les profils publics', async () => {
      const hidden = await member({
        phase: 'RECENT_ARRIVAL',
        arrivalDate: new Date(Date.now() - 86_400_000),
        isPublic: false,
      });
      const shown = await member({
        phase: 'RECENT_ARRIVAL',
        arrivalDate: new Date(Date.now() - 86_400_000),
        isPublic: true,
      });

      const anonymous = await cities.profile(citySlug, null);
      const handles = anonymous.newcomers.map((n) => n.handle);
      const handleOf = async (id: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id }, select: { handle: true } })).handle;

      expect(handles).toContain(await handleOf(shown));
      expect(handles).not.toContain(await handleOf(hidden));
    });
  });

  // ══ Annuaire (§2.2) ═══════════════════════════════════════════════════════

  describe('annuaire des membres (§2.2)', () => {
    it('place les membres disponibles pour aider en tête', async () => {
      const older = await member({
        availableToHelp: false,
        createdAt: new Date('2020-01-01T00:00:00Z'),
      });
      const helper = await member({
        availableToHelp: true,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      });

      const page = await cities.members(
        { cityId, radiusKm: 0, limit: 20, availableToHelp: undefined },
        helper,
      );
      const handles = page.items.map((i) => i.handle);
      const handleOf = async (id: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id }, select: { handle: true } })).handle;

      const helperHandle = await handleOf(helper);
      const olderHandle = await handleOf(older);
      // `helper` est plus RÉCENT : s'il n'arrive pas devant, le tri du §2.2 n'est
      // pas appliqué. C'est le piège du tri sur une jointure externe — les
      // membres sans profil remonteraient en tête.
      expect(handles.indexOf(helperHandle)).toBeLessThan(handles.indexOf(olderHandle));
      expect(page.items[0]?.availableToHelp).toBe(true);
    });

    it('inclut les membres sans profil, et les met après les disponibles', async () => {
      const noProfile = await member();
      const helper = await member({ availableToHelp: true });

      const page = await cities.members({ cityId, radiusKm: 0, limit: 50 }, helper);
      const handleOf = async (id: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id }, select: { handle: true } })).handle;

      const handles = page.items.map((i) => i.handle);
      // L'écran 5 de l'onboarding est passable : un membre sans profil existe
      // bel et bien, et l'annuaire ne doit pas l'oublier.
      expect(handles).toContain(await handleOf(noProfile));
      expect(handles.indexOf(await handleOf(helper))).toBeLessThan(
        handles.indexOf(await handleOf(noProfile)),
      );
    });

    it('pagine sans perdre ni répéter de membre', async () => {
      const viewer = await member();
      for (let index = 0; index < 5; index += 1) {
        await member({ availableToHelp: index % 2 === 0 });
      }

      const first = await cities.members({ cityId, radiusKm: 0, limit: 3 }, viewer);
      expect(first.items).toHaveLength(3);
      expect(first.nextCursor).not.toBeNull();

      const second = await cities.members(
        { cityId, radiusKm: 0, limit: 3, cursor: first.nextCursor ?? undefined },
        viewer,
      );
      // Une page complète, et AUCUN doublon : c'est là que la pagination d'un
      // tri composite se casse d'ordinaire.
      const firstHandles = first.items.map((i) => i.handle);
      const secondHandles = second.items.map((i) => i.handle);
      expect(secondHandles.some((h) => firstHandles.includes(h))).toBe(false);
      expect(second.items.length).toBeGreaterThan(0);
    });

    it('n’expose hors connexion que les profils publics', async () => {
      const priv = await member({ isPublic: false });
      const pub = await member({ isPublic: true });
      const handleOf = async (id: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id }, select: { handle: true } })).handle;

      const page = await cities.members({ cityId, radiusKm: 0, limit: 50 }, null);
      const handles = page.items.map((i) => i.handle);
      expect(handles).toContain(await handleOf(pub));
      expect(handles).not.toContain(await handleOf(priv));
    });

    it('n’expose jamais l’identifiant technique d’un membre', async () => {
      const userId = await member({ isPublic: true });
      const page = await cities.members({ cityId, radiusKm: 0, limit: 50 }, null);
      // Le handle est l'identité publique (01 §2.6) : exposer l'UUID d'un membre
      // donnerait une clé stable de corrélation que rien n'exige. Celui de la
      // VILLE, lui, est déjà public (`/places/cities`) — d'où la cible précise.
      const serialized = JSON.stringify(page.items);
      expect(serialized).not.toContain(userId);
      for (const created of createdUsers) expect(serialized).not.toContain(created);
      expect(page.items.some((item) => item.handle.length > 0)).toBe(true);
    });

    it('garde `isPublic` quand un autre filtre de profil s’ajoute', async () => {
      // BOGUE trouvé ici : deux clés `profile:` dans le même objet `where`, et la
      // seconde écrasait la première. Filtrer par statut d'occupation faisait
      // tomber la condition `isPublic: true` — l'annuaire anonyme rendait alors
      // des profils privés. Le test vise la COMBINAISON, seul cas fautif.
      const priv = await member({ isPublic: false });
      await prisma.userProfile.update({
        where: { userId: priv },
        data: { occupationStatus: 'STUDENT' },
      });
      const pub = await member({ isPublic: true });
      await prisma.userProfile.update({
        where: { userId: pub },
        data: { occupationStatus: 'STUDENT' },
      });

      const page = await cities.members(
        { cityId, radiusKm: 0, limit: 50, occupationStatus: 'STUDENT' } as never,
        null,
      );
      const handles = page.items.map((i) => i.handle);
      const handleOf = async (id: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id }, select: { handle: true } })).handle;

      expect(handles).toContain(await handleOf(pub));
      expect(handles).not.toContain(await handleOf(priv));
    });

    it('filtre sur le pays d’origine et la disponibilité', async () => {
      const helper = await member({ countryId: otherCountryId, availableToHelp: true });
      await member({ countryId: mainCountryId, availableToHelp: true });
      const handleOf = async (id: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id }, select: { handle: true } })).handle;

      const filtered = await cities.members(
        { cityId, radiusKm: 0, limit: 50, originCountryId: otherCountryId, availableToHelp: true },
        helper,
      );
      expect(filtered.items.map((i) => i.handle)).toContain(await handleOf(helper));
      expect(filtered.items.every((i) => i.country?.iso2 !== undefined)).toBe(true);
      expect(filtered.items.every((i) => i.availableToHelp)).toBe(true);
    });
  });

  // ══ Contenus de la fiche ville (§2.3) ═════════════════════════════════════

  describe('contenus communautaires (§2.3)', () => {
    async function tip(
      authorUserId: string,
      kind: 'TIP' | 'SHOP' | 'BUDGET' | 'TESTIMONY',
      body: string,
      amountCents?: number,
    ) {
      const created = await cities.createTip(citySlug, authorUserId, {
        kind,
        body,
        ...(amountCents === undefined ? {} : { amountCents }),
      });
      createdTips.push(created.id);
      return created;
    }

    it('publie une contribution et émet `city_tip.published`', async () => {
      const author = await member();
      const created = await tip(author, 'TIP', 'Le marché du samedi matin est bien moins cher.');

      expect(created.kind).toBe('TIP');
      const emitted = await prisma.domainEvent.findMany({
        where: { aggregateId: created.id, type: 'city_tip.published' },
      });
      expect(emitted).toHaveLength(1);
      expect(emitted[0]?.payload).toMatchObject({ kind: 'TIP', authorUserId: author });
    });

    it('calcule la MÉDIANE des budgets, pas la moyenne', async () => {
      const author = await member();
      // 400, 500, 10 000 € : la moyenne serait absurde (3 633 €), la médiane dit 500.
      await tip(author, 'BUDGET', 'Chambre en coloc', 40_000);
      await tip(author, 'BUDGET', 'Studio en périphérie', 50_000);
      await tip(author, 'BUDGET', 'Appartement de standing', 1_000_000);

      const profile = await cities.profile(citySlug, author);
      expect(profile.budgetMedianCents).toBe(50_000);

      const page = await cities.listTips(citySlug, { kind: 'BUDGET', limit: 20 } as never, author);
      expect(page.meta).toMatchObject({ medianCents: 50_000 });
    });

    it('respecte les longueurs par kind, et le montant réservé au budget', () => {
      const base = { kind: 'TIP' as const, body: 'x'.repeat(501) };
      expect(createCityTipSchema.safeParse(base).success).toBe(false);
      expect(createCityTipSchema.safeParse({ ...base, body: 'x'.repeat(500) }).success).toBe(true);
      // Un témoignage va jusqu'à 1 000 (§2.3).
      expect(
        createCityTipSchema.safeParse({ kind: 'TESTIMONY', body: 'x'.repeat(1000) }).success,
      ).toBe(true);
      // Un budget SANS montant n'a pas de sens, et un montant hors budget non plus.
      expect(createCityTipSchema.safeParse({ kind: 'BUDGET', body: 'Coloc' }).success).toBe(false);
      expect(
        createCityTipSchema.safeParse({ kind: 'TIP', body: 'Un bon plan ici', amountCents: 100 })
          .success,
      ).toBe(false);
    });

    it('trie par utilité puis par date', async () => {
      const author = await member();
      const plain = await tip(author, 'TIP', 'Une astuce ordinaire, sans vote.');
      const useful = await tip(author, 'TIP', 'Une astuce que tout le monde trouve utile.');
      await prisma.cityTip.update({ where: { id: useful.id }, data: { helpfulCount: 7 } });

      const page = await cities.listTips(citySlug, { kind: 'TIP', limit: 20 } as never, author);
      const ids = page.items.map((i) => i.id);
      expect(ids.indexOf(useful.id)).toBeLessThan(ids.indexOf(plain.id));
    });

    it('n’accepte une story convertie que de son auteur, et seulement DECOUVERTE', async () => {
      const author = await member();
      const other = await member();

      const storyId = newId();
      await prisma.story.create({
        data: {
          id: storyId,
          authorUserId: author,
          type: 'DECOUVERTE',
          body: 'Une épicerie qui vend du gari.',
          textStyle: 'BOLD',
          cityId,
          category: 'PRODUIT',
          placeLabel: 'Épicerie Awa',
          expiresAt: new Date(Date.now() + 86_400_000),
          audience: 'CITY',
          allowMessages: true,
          status: 'ACTIVE',
          moderationStatus: 'CLEARED',
        },
      });
      createdStories.push(storyId);

      // Un autre membre ne garde pas la découverte d'autrui : ce serait
      // s'attribuer sa trouvaille (§2.3, « gardée par son auteur »).
      await expect(
        cities.createTip(citySlug, other, {
          kind: 'SHOP',
          body: 'Épicerie Awa, 4 rue du Marché',
          sourceStoryId: storyId,
        } as never),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      const created = await cities.createTip(citySlug, author, {
        kind: 'SHOP',
        body: 'Épicerie Awa, 4 rue du Marché',
        sourceStoryId: storyId,
      } as never);
      createdTips.push(created.id);
      expect(created.sourceStoryId).toBe(storyId);

      // La story garde la trace de sa conversion (04 §2.6).
      const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId } });
      expect(story.convertedToId).toBe(created.id);
      expect(story.convertedToType).toBe('city_tip');
    });

    it('ne laisse modifier ou retirer qu’à l’auteur, en 404', async () => {
      const author = await member();
      const intruder = await member();
      const created = await tip(author, 'TIP', 'Une astuce qui m’appartient bien.');

      await expect(
        cities.updateTip(created.id, intruder, { body: 'Texte détourné par un autre.' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(cities.deleteTip(created.id, intruder)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      await cities.updateTip(created.id, author, { body: 'Un texte que je corrige moi-même.' });
      await cities.deleteTip(created.id, author);
      // Suppression LOGIQUE : §9 conserve les tips, anonymisés.
      const row = await prisma.cityTip.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.deletedAt).not.toBeNull();
      expect(row.body).toBe('Un texte que je corrige moi-même.');

      const page = await cities.listTips(citySlug, { kind: 'TIP', limit: 50 } as never, author);
      expect(page.items.map((i) => i.id)).not.toContain(created.id);
    });

    it('garde les contributions ANONYMISÉES visibles malgré un blocage', async () => {
      // BOGUE trouvé ici : `author_user_id NOT IN (…)` vaut NULL — donc FAUX — pour
      // une ligne sans auteur. §9 conserve les tips d'un membre supprimé,
      // anonymisés ; le filtre de visibilité les faisait disparaître de la fiche
      // ville dès que le LECTEUR avait un seul blocage, sans rapport avec eux.
      const author = await member();
      const reader = await member();
      const blocked = await member();
      const orphan = await tip(author, 'TIP', 'Une astuce dont l’auteur a fermé son compte.');
      // Ce que fait la suppression de compte (§9) : l'auteur passe à NULL.
      await prisma.cityTip.update({
        where: { id: orphan.id },
        data: { authorUserId: null },
      });
      // Et le lecteur a UN blocage, sans lien avec cette contribution.
      await prisma.block.create({
        data: { id: newId(), blockerUserId: reader, blockedUserId: blocked },
      });

      const listed = await cities.listTips(citySlug, { kind: 'TIP', limit: 50 } as never, reader);
      expect(listed.items.map((i) => i.id)).toContain(orphan.id);

      const profile = await cities.profile(citySlug, reader);
      expect(profile.tips['TIP']?.map((t) => t.id)).toContain(orphan.id);
    });

    it('cache les contributions d’un membre bloqué', async () => {
      const author = await member();
      const reader = await member();
      const created = await tip(author, 'TIP', 'Une astuce de quelqu’un que je bloque.');

      expect(
        (await cities.listTips(citySlug, { kind: 'TIP', limit: 50 } as never, reader)).items.map(
          (i) => i.id,
        ),
      ).toContain(created.id);

      await prisma.block.create({
        data: { id: newId(), blockerUserId: reader, blockedUserId: author },
      });
      expect(
        (await cities.listTips(citySlug, { kind: 'TIP', limit: 50 } as never, reader)).items.map(
          (i) => i.id,
        ),
      ).not.toContain(created.id);
    });
  });

  // ══ Guichets du jour (§2.3) ═══════════════════════════════════════════════

  describe('guichets du jour (§2.3)', () => {
    async function information(
      authorUserId: string,
      placeLabel: string,
      body: string,
      options: {
        category?: string;
        expired?: boolean;
        positive?: number;
        negative?: number;
        /** La ville par défaut est celle du fichier ; un test qui doit s'isoler du cache en donne une autre. */
        cityId?: string;
      } = {},
    ): Promise<string> {
      const id = newId();
      await prisma.story.create({
        data: {
          id,
          authorUserId,
          type: 'INFORMATION',
          body,
          textStyle: 'BOLD',
          cityId: options.cityId ?? cityId,
          category: options.category ?? 'démarches',
          placeLabel,
          expiresAt: new Date(Date.now() + (options.expired === true ? -3_600_000 : 86_400_000)),
          audience: 'CITY',
          allowMessages: true,
          positiveCount: options.positive ?? 0,
          negativeCount: options.negative ?? 0,
          status: options.expired === true ? 'EXPIRED' : 'ACTIVE',
          moderationStatus: 'CLEARED',
        },
      });
      createdStories.push(id);
      return id;
    }

    it('agrège par lieu la dernière information, ses confirmations et ses signalements', async () => {
      const author = await member();
      await information(author, 'Préfecture', 'Guichet fermé le matin.', { positive: 2 });
      // Plus récente pour le même lieu : c'est celle-ci qui doit sortir.
      await new Promise((resolve) => setTimeout(resolve, 20));
      await information(author, 'Préfecture', 'File dès 7 h, ouverture à 9 h.', {
        positive: 5,
        negative: 1,
      });
      await information(author, 'CAF', 'Rendez-vous obligatoire.', { positive: 1 });

      const desks = await cities.desks(citySlug, author);
      const items = desks.items as {
        placeLabel: string;
        lastInformation: string;
        confirmations: number;
        changedReports: number;
      }[];

      const prefecture = items.find((i) => i.placeLabel === 'Préfecture');
      expect(prefecture?.lastInformation).toBe('File dès 7 h, ouverture à 9 h.');
      // Les compteurs s'additionnent sur le lieu : « 2 membres confirment » porte
      // sur le guichet, pas sur une seule story.
      expect(prefecture?.confirmations).toBe(7);
      expect(prefecture?.changedReports).toBe(1);
      expect(items.some((i) => i.placeLabel === 'CAF')).toBe(true);
    });

    /**
     * ═══ RÈGLE DURE ═══
     *
     * Le cache de la fiche ville ne fait pas franchir un blocage.
     *
     * CE QUE CE TEST EXISTE POUR EMPÊCHER DE REVENIR. `desks()` filtrait les
     * auteurs séparés du lecteur, PUIS mettait le résultat filtré en cache sous la
     * seule clé `city.id` — pendant cinq minutes, la réponse calculée pour un
     * lecteur était resservie à tous les autres.
     *
     * L'ordre des deux appels ci-dessous est le cœur du test, et c'est la moitié
     * GRAVE du défaut : celui qui NE bloque PAS interroge d'abord, donc le cache se
     * remplit SANS filtre ; puis celui qui a bloqué l'auteur interroge à son tour et
     * reçoit l'entrée toute prête. Le blocage est contourné par un cache, sans qu'une
     * seule ligne de la logique de blocage soit fausse.
     *
     * (L'autre moitié est symétrique et bénigne : un lecteur qui bloque remplit le
     * cache avec son propre filtre et fait disparaître du contenu pour des gens qui
     * n'ont rien demandé.)
     */
    it('[RÈGLE DURE] le cache ne sert pas à un lecteur la réponse calculée pour un autre', async () => {
      /**
       * SA PROPRE VILLE, et ce n'est pas une précaution de confort.
       *
       * Le cache vit dans le service et TRAVERSE les tests : écrit sous la clé de
       * la ville partagée par un test antérieur dont le lecteur n'avait aucun
       * blocage, il serait resservi ici — mon premier jet a justement reçu
       * `['CAF', 'Préfecture']`, l'entrée d'un autre test. Le test aurait alors
       * mesuré la persistance du cache en croyant mesurer le blocage.
       */
      const autreVille = await prisma.city.findFirstOrThrow({
        where: { mergedIntoCityId: null, memberCount: 0, id: { not: cityId } },
        orderBy: { name: 'desc' },
        select: { id: true, slug: true },
      });

      // La fiche ville refuse une ville fermée : l'activer fait partie du décor,
      // pas de ce que le test éprouve.
      await prisma.city.update({ where: { id: autreVille.id }, data: { isActive: true } });

      const auteur = await member();
      const bloqueur = await member();
      const neutre = await member();

      await information(auteur, 'Trésor public', 'Le guichet ouvre à 8 h 30.', {
        cityId: autreVille.id,
      });

      await prisma.block.create({
        data: { id: newId(), blockerUserId: bloqueur, blockedUserId: auteur },
      });

      // Le lecteur NEUTRE d'abord : il voit l'information, et il remplit le cache.
      const vueNeutre = await cities.desks(autreVille.slug, neutre);
      expect(
        (vueNeutre.items as { placeLabel: string }[]).map((i) => i.placeLabel),
        'le lecteur sans blocage doit voir l’information',
      ).toContain('Trésor public');

      // Puis celui qui a bloqué l'auteur. Il ne doit pas hériter de la vue du premier.
      const vueBloqueur = await cities.desks(autreVille.slug, bloqueur);
      expect(
        (vueBloqueur.items as { placeLabel: string }[]).map((i) => i.placeLabel),
        'le cache a fait franchir un blocage : la story d’un auteur bloqué est servie',
      ).not.toContain('Trésor public');
    });

    it('écarte les informations expirées et les autres sujets', async () => {
      const author = await member();
      await information(author, 'OFII', 'Convocation reçue sous 3 semaines.', { expired: true });
      await information(author, 'Marché', 'Le marché est déplacé ce samedi.', {
        category: 'sorties',
      });

      const desks = await cities.desks(citySlug, author);
      const labels = (desks.items as { placeLabel: string }[]).map((i) => i.placeLabel);
      // §2.3 ne retient que les informations ACTIVES de sujet démarches.
      expect(labels).not.toContain('OFII');
      expect(labels).not.toContain('Marché');
    });

    it('reconnaît le sujet « démarches » quelle que soit son écriture', () => {
      // `stories.category` est du texte libre côté module 04 : la comparaison ne
      // peut pas dépendre d'une casse ni d'un accent.
      for (const value of ['démarches', 'DEMARCHES', 'Démarches', 'demarche']) {
        expect(isPaperworkSubject(value)).toBe(true);
      }
      for (const value of ['sorties', 'LIEU', null, '']) {
        expect(isPaperworkSubject(value)).toBe(false);
      }
    });
  });

  // ══ Réseau de la ville (§2.3) ═════════════════════════════════════════════

  it('rattache le réseau de ville à la fiche', async () => {
    const owner = await member();
    const id = newId();
    await prisma.community.create({
      data: {
        id,
        kind: 'CITY',
        cityId,
        name: 'Réseau de la ville',
        slug: `reseau-ville-${id.slice(-8)}`,
        visibility: 'PUBLIC',
        createdByUserId: owner,
        status: 'ACTIVE',
        lastActivityAt: new Date(),
      },
    });
    createdCommunities.push(id);

    const profile = await cities.profile(citySlug, owner);
    expect(profile.network?.id).toBe(id);
  });
});
