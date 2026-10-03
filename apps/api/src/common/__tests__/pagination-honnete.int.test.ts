import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { OutboxService } from '../outbox.service';
import { ReferentialsService } from '../../modules/referentials/referentials.service';
import { CommunitiesService } from '../../modules/communities/communities.service';
import { BillingService } from '../../modules/billing/billing.service';
import { PlanService } from '../../modules/billing/plan.service';
import { PartnersService } from '../../modules/partners/partners.service';
import { VisibilityService } from '../visibility.service';
import { CryptoService } from '../crypto.service';
import { BookmarksService } from '../../modules/bookmarks/bookmarks.service';

/**
 * LA TRONCATURE MUETTE — 00-fondations.md §5.3.
 *
 * « Par curseur, jamais par décalage. Chaque liste renvoie `items` et
 *   `nextCursor` (null en fin). Limite par défaut 20, maximum 50. »
 *
 * CINQ ROUTES posaient `take: query.limit` puis écrivaient `nextCursor: null` EN
 * DUR. Mesuré : `GET /admin/ref/cities` rendait 50 villes sur 65 en base, avec une
 * enveloppe qui AFFIRMAIT la fin de liste. L'écran affichait 50 sur 65 sans
 * pouvoir le savoir, et une boucle de suivi de curseur côté client était défaite
 * par la route — le curseur qu'elle attendait n'était jamais émis.
 *
 * ═══ CE QUE CE FICHIER VÉRIFIE, ET POURQUOI C'EST CETTE FORME ═════════════
 *
 * Il ne regarde pas « nextCursor est-il non nul » sur une page : cela passerait
 * encore si le curseur était émis mais faux. Il SUIT LE CURSEUR JUSQU'AU BOUT et
 * compare l'ensemble parcouru à l'ensemble que la même requête rend sans
 * pagination. Trois défauts distincts tombent alors :
 *
 *   · la troncature (il manque des lignes) ;
 *   · la répétition (une ligne vue deux fois, signe d'un ordre non total) ;
 *   · la boucle (un curseur qui ne progresse pas).
 *
 * LES DONNÉES SONT LES NÔTRES ET ON NE COMPTE QUE LES NÔTRES. La base de
 * développement est PARTAGÉE — six agents y écrivent — et deux tests du dépôt ont
 * déjà rougi pour avoir affirmé un total global. Chaque jeu porte donc un marqueur
 * unique, les filtres s'y restreignent quand la route le permet, et les comptes
 * attendus sont ceux des lignes écrites ici.
 */

/** Suit le curseur jusqu'à `nextCursor: null`, et rend ce qu'on a vu. */
async function suivre<T extends { id: string }>(
  page: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const result = await page(cursor);
    pages += 1;
    ids.push(...result.items.map((item) => item.id));
    cursor = result.nextCursor ?? undefined;
    // Un curseur qui n'avance pas tournerait sans fin : on borne, et on laisse le
    // test échouer sur le COMPTE plutôt que sur un délai d'attente, qui n'apprend
    // rien sur la cause.
    if (pages > 50) break;
  } while (cursor !== undefined);
  return { ids, pages };
}

describe('pagination honnête : aucune route ne tronque en silence (§5.3)', () => {
  let prisma: PrismaService;
  let ref: ReferentialsService;
  let billing: BillingService;
  let partners: PartnersService;

  const marker = `PAG-${newId().slice(-12)}`;
  const createdCityIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdPartnerIds: string[] = [];
  const createdPlacementIds: string[] = [];
  const createdSubscriptionIds: string[] = [];
  const createdUserIds: string[] = [];

  let countryId: string;
  let memberId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const bookmarks = new BookmarksService(prisma);
    const communities = new CommunitiesService(prisma, outbox, audit, visibility);
    void bookmarks;
    ref = new ReferentialsService(prisma, audit, outbox, communities);

    const plans = new PlanService(prisma);
    billing = new BillingService(prisma, plans, outbox, audit);
    partners = new PartnersService(prisma, plans, audit);
    void new CryptoService();

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = country.id;

    // ── 17 VILLES à nous, repérables par un préfixe de nom unique ───────────
    //
    // 17 et non 3 : avec une limite de 5 cela fait quatre pages, donc le curseur
    // doit se reprendre plusieurs fois. Trois lignes et une page unique ne
    // vérifieraient rien de la reprise.
    for (let i = 0; i < 17; i += 1) {
      const id = newId();
      await prisma.city.create({
        data: {
          id,
          countryId,
          // Le nom porte le marqueur : `listCities` filtre sur `name contains`,
          // ce qui isole NOS lignes des 65 villes de la base partagée.
          name: `${marker} ville ${String(i).padStart(2, '0')}`,
          slug: `${marker.toLowerCase()}-ville-${i}`,
          latitude: 48.85,
          longitude: 2.35,
          // La MOITIÉ actives : le tri est `is_active` décroissant PUIS le nom, et
          // le curseur doit franchir la frontière entre les deux blocs. Avec un
          // seul bloc, une clé de reprise fausse sur `is_active` passerait.
          isActive: i % 2 === 0,
          memberCount: 0,
        },
      });
      createdCityIds.push(id);
    }

    // ── un membre et 13 paiements ───────────────────────────────────────────
    memberId = newId();
    await prisma.user.create({
      data: {
        id: memberId,
        handle: `pag${memberId.slice(-10)}`,
        displayName: 'Membre pagination',
        phase: 'SETTLED',
        verificationLevel: 'L1',
        originCountryId: countryId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUserIds.push(memberId);

    for (let i = 0; i < 13; i += 1) {
      const id = newId();
      await prisma.payment.create({
        data: {
          id,
          userId: memberId,
          amountCents: 900 + i,
          currency: 'EUR',
          provider: 'STRIPE',
          method: 'CARD',
          status: 'SUCCEEDED',
          providerRef: `${marker}-pay-${i}`,
          paidAt: new Date(),
          /**
           * TROIS LIGNES AU MÊME `created_at`, DÉLIBÉRÉMENT.
           *
           * C'est le cas que la clé de reprise doit départager : un curseur qui ne
           * porterait que `created_at` répéterait ou sauterait ces trois lignes, et
           * un jeu de données aux dates toutes distinctes ne le montrerait jamais.
           * Un import, une migration ou un seed produisent exactement cela.
           */
          ...(i < 3 ? { createdAt: new Date('2026-01-01T00:00:00.000Z') } : {}),
        },
      });
      createdPaymentIds.push(id);
    }

    // ── 9 partenaires et 9 encarts, sur une étape à nous ────────────────────
    const step = await prisma.stepDefinition.findFirstOrThrow({ select: { id: true } });
    for (let i = 0; i < 9; i += 1) {
      const partnerId = newId();
      await prisma.partner.create({
        data: {
          id: partnerId,
          name: `${marker} partenaire ${i}`,
          category: 'BANK',
          affiliateUrlTemplate: 'https://exemple.test/?c={click_id}',
          payoutModel: 'CPA',
          isActive: true,
          ...(i < 3 ? { createdAt: new Date('2026-01-01T00:00:00.000Z') } : {}),
        },
      });
      createdPartnerIds.push(partnerId);

      const placementId = newId();
      await prisma.partnerPlacement.create({
        data: {
          id: placementId,
          partnerId,
          stepDefinitionId: step.id,
          headline: `${marker} encart ${i}`,
          ctaLabel: 'Voir',
          // INACTIFS : §5.1 n'autorise qu'UN encart actif par étape et par
          // combinaison de pays, et la liste d'équipe les rend tous.
          isActive: false,
          ...(i < 3 ? { createdAt: new Date('2026-01-01T00:00:00.000Z') } : {}),
        },
      });
      createdPlacementIds.push(placementId);
    }

    // ── 7 abonnements, chacun sur son membre ───────────────────────────────
    const plan = await prisma.plan.findFirstOrThrow({
      where: { code: { not: 'FREE' } },
      select: { id: true },
    });
    for (let i = 0; i < 7; i += 1) {
      const userId = newId();
      await prisma.user.create({
        data: {
          id: userId,
          handle: `pgs${userId.slice(-10)}`,
          displayName: `Abonné ${i}`,
          phase: 'SETTLED',
          verificationLevel: 'L1',
          originCountryId: countryId,
          plan: 'FREE',
          status: 'ACTIVE',
        },
      });
      createdUserIds.push(userId);

      const subscriptionId = newId();
      await prisma.subscription.create({
        data: {
          id: subscriptionId,
          userId,
          planId: plan.id,
          status: 'PAST_DUE',
          provider: 'MOBILE_MONEY',
          providerRef: `${marker}-sub-${i}`,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
          cancelAtPeriodEnd: false,
          ...(i < 3 ? { createdAt: new Date('2026-01-01T00:00:00.000Z') } : {}),
        },
      });
      createdSubscriptionIds.push(subscriptionId);
    }
  });

  afterAll(async () => {
    if (createdPlacementIds.length > 0) {
      await prisma.partnerPlacement.deleteMany({ where: { id: { in: createdPlacementIds } } });
    }
    if (createdPartnerIds.length > 0) {
      await prisma.partner.deleteMany({ where: { id: { in: createdPartnerIds } } });
    }
    if (createdPaymentIds.length > 0) {
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdSubscriptionIds.length > 0) {
      await prisma.subscription.deleteMany({ where: { id: { in: createdSubscriptionIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdCityIds.length > 0) {
      await prisma.city.deleteMany({ where: { id: { in: createdCityIds } } });
    }
    await prisma.$disconnect();
  });

  /**
   * LA ROUTE MESURÉE : 50 villes rendues sur 65, `nextCursor: null`.
   *
   * MUTATION TÉMOIN — remettre `nextCursor: null` en dur dans `listCities` fait
   * échouer ce test sur le compte (5 au lieu de 17) ET sur le nombre de pages.
   */
  it('[§5.3] GET /admin/ref/cities : le curseur parcourt TOUT, sans doublon', async () => {
    const limit = 5;
    const { ids, pages } = await suivre((cursor) =>
      ref.listCities({ limit, q: marker, ...(cursor === undefined ? {} : { cursor }) }),
    );

    expect(new Set(ids).size, 'une ville vue deux fois = ordre de tri non total').toBe(ids.length);
    expect(ids).toHaveLength(17);
    expect(new Set(ids)).toEqual(new Set(createdCityIds));
    // 17 lignes par pages de 5 : 4 pages. Un curseur qui n'avancerait pas en
    // ferait beaucoup plus, et un `take` qui tronque beaucoup moins.
    expect(pages).toBe(4);
  });

  /**
   * `meta.total` EST L'AUTRE MOITIÉ DU DÉFAUT : l'écran doit pouvoir écrire
   * « 5 sur 17 ». Sans lui, une première page de 5 ne dit rien du reste, même
   * avec un curseur juste.
   */
  it('[§5.3] GET /admin/ref/cities rend meta.total, pour que l’écran sache ce qu’il ne montre pas', async () => {
    const first = await ref.listCities({ limit: 5, q: marker });
    expect(first.items).toHaveLength(5);
    expect(first.nextCursor).not.toBeNull();
    expect(first.meta).toEqual({ total: 17 });
  });

  /**
   * LE TRI EST COMPOSITE (`is_active` décroissant, puis le nom) et le curseur doit
   * franchir la frontière entre le bloc actif et le bloc inactif.
   *
   * Ce test éprouve l'ORDRE, pas seulement l'ensemble : une clé de reprise fausse
   * sur `is_active` peut rendre les 17 bonnes lignes dans le mauvais ordre, et le
   * test précédent passerait.
   */
  it('[§5.3] l’ordre paginé est EXACTEMENT celui de la requête non paginée', async () => {
    const complet = await ref.listCities({ limit: 50, q: marker });
    expect(complet.items).toHaveLength(17);
    const attendu = complet.items.map((c) => c.id);

    const { ids } = await suivre((cursor) =>
      ref.listCities({ limit: 3, q: marker, ...(cursor === undefined ? {} : { cursor }) }),
    );
    expect(ids).toEqual(attendu);

    // Et la frontière existe bien : 9 actives puis 8 inactives.
    const actives = complet.items.filter((c) => c.isActive).length;
    expect(actives).toBe(9);
    expect(complet.items.slice(0, actives).every((c) => c.isActive)).toBe(true);
    expect(complet.items.slice(actives).every((c) => !c.isActive)).toBe(true);
  });

  /**
   * `GET /me/payments` — DOMAINE MEMBRE, et des FACTURES.
   *
   * MUTATION TÉMOIN — remettre `take: query.limit` (sans la ligne excédentaire)
   * dans `myPayments` fait échouer ce test : 4 lignes au lieu de 13.
   */
  it('[§5.3] GET /me/payments : les 13 paiements du membre sont tous atteignables', async () => {
    const { ids } = await suivre((cursor) =>
      billing.myPayments(memberId, { limit: 4, ...(cursor === undefined ? {} : { cursor }) }),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(createdPaymentIds));

    // Les trois lignes au MÊME `created_at` sont dans le lot, et une seule fois :
    // c'est l'`id` de la clé de reprise qui les départage.
    const memeInstant = createdPaymentIds.slice(0, 3);
    for (const id of memeInstant) expect(ids.filter((seen) => seen === id)).toHaveLength(1);
  });

  it('[§5.3] GET /admin/billing/subscriptions : rien ne manque, et meta.total le dit', async () => {
    const filtre = { status: 'PAST_DUE' as const, provider: 'MOBILE_MONEY' as const };
    const { ids } = await suivre((cursor) =>
      billing.listSubscriptions({ limit: 3, ...filtre, ...(cursor === undefined ? {} : { cursor }) }),
    );
    expect(new Set(ids).size).toBe(ids.length);
    // Le filtre est le nôtre, mais la base est partagée : on vérifie l'INCLUSION
    // de nos lignes, pas un total global.
    for (const id of createdSubscriptionIds) expect(ids).toContain(id);

    const first = await billing.listSubscriptions({ limit: 3, ...filtre });
    expect(first.meta?.total).toBe(ids.length);
  });

  /**
   * MUTATION TÉMOIN — remettre `nextCursor: null` en dur dans `listPartners` fait
   * échouer ce test : 4 partenaires au lieu de 9.
   */
  it('[§5.3] GET /admin/billing/partners : les 9 partenaires sont tous atteignables', async () => {
    const { ids } = await suivre((cursor) =>
      partners.listPartners({ limit: 4, category: 'BANK', ...(cursor === undefined ? {} : { cursor }) }),
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of createdPartnerIds) expect(ids).toContain(id);
  });

  it('[§5.3] GET /admin/billing/placements : les 9 encarts sont tous atteignables', async () => {
    const { ids } = await suivre((cursor) =>
      partners.listPlacements({ limit: 4, ...(cursor === undefined ? {} : { cursor }) }),
    );
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of createdPlacementIds) expect(ids).toContain(id);
  });

  /**
   * L'ENVELOPPE DE §5.3 EST OBLIGATOIRE, même sur une liste complète.
   *
   * Quatre routes rendaient `{ items }` SANS `nextCursor` — découvert parce qu'un
   * `pageSchema()` du front a refusé la charge. `null` y est honnête : elles
   * rendent l'ensemble complet, sans `take`. C'est la différence exacte avec les
   * cinq routes ci-dessus, qui posaient un `take` puis affirmaient la fin.
   */
  it('[§5.3] les listes complètes portent nextCursor: null — jamais ABSENT', async () => {
    const plansAdmin = await billing.adminPlans();
    expect(plansAdmin).toHaveProperty('nextCursor');
    expect(plansAdmin.nextCursor).toBeNull();

    const revenue = await billing.revenue({});
    expect(revenue).toHaveProperty('nextCursor');
    expect(revenue.nextCursor).toBeNull();

    const affiliate = await partners.affiliateDashboard();
    expect(affiliate).toHaveProperty('nextCursor');
    expect(affiliate.nextCursor).toBeNull();
  });

  /**
   * LES AUTRES `nextCursor: null` DU DÉPÔT SONT HONNÊTES, et on ne les touche pas.
   *
   * `listSimple` (langues, compétences, métiers) et `listCountries` n'appliquent
   * AUCUNE limite : elles rendent tout, donc « il n'y a pas de suite » est un
   * fait. Ce test le FIXE — sans lui, quelqu'un ajouterait un `take` à la
   * prochaine plainte de lenteur, et la troncature muette renaîtrait là.
   */
  it('[§5.3] les listes sans limite rendent bien TOUT (elles n’ont pas de curseur à émettre)', async () => {
    const professions = await ref.listSimple('professions', {});
    const enBase = await prisma.profession.count();
    expect(professions.items).toHaveLength(enBase);
    expect(professions.nextCursor).toBeNull();

    const langues = await ref.listSimple('languages', {});
    expect(langues.items).toHaveLength(await prisma.language.count());
    expect(langues.nextCursor).toBeNull();
  });

  /**
   * UN CURSEUR NE VAUT QUE POUR LA REQUÊTE QUI L'A PRODUIT.
   *
   * Sans la vérification de portée, rejouer le curseur d'une liste filtrée sur une
   * autre liste rendrait une page silencieusement fausse — des lignes sautées
   * sans erreur. Mieux vaut un refus clair qu'une liste trouée.
   */
  it('[§5.3] un curseur rejoué sur un autre filtre ou une autre route est REFUSÉ', async () => {
    const first = await ref.listCities({ limit: 2, q: marker });
    // `String(...)` et non `as string` : un `nextCursor` codé en dur à `null`
    // RÉDUIRAIT le type de retour à `null`, et un `as string` ferait alors
    // échouer la COMPILATION du test au lieu de son exécution. Un mutant qui ne
    // compile pas ne prouve rien sur ce que le test garde.
    const cursor = String(first.nextCursor);
    expect(first.nextCursor).not.toBeNull();

    await expect(
      ref.listCities({ limit: 2, q: marker, active: 'true', cursor }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await expect(partners.listPartners({ limit: 2, cursor })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    // Signature falsifiée : la portée est la bonne, la signature non.
    const falsifie = `${cursor.slice(0, -1)}X`;
    await expect(
      ref.listCities({ limit: 2, q: marker, cursor: falsifie }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
