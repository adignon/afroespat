import {
  meResponseSchema,
  myPaymentsResponseSchema,
  paymentViewSchema,
  plansResponseSchema,
} from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiShapeError } from '../errors';
import { memberApi } from '../member';
import { clearSession, setAccessToken } from '../session';
import { fakeServer, fakeToken, type FakeServer } from './harness';

/**
 * ─── LES DEUX RÈGLES DURES DU MODULE COMPTE, ÉPROUVÉES À LA FRONTIÈRE ───────
 *
 * `e2e/compte.spec.ts` les éprouve À L'ÉCRAN, contre l'API qui tourne. C'est
 * nécessaire et ce n'est pas suffisant, et la raison est mesurée, pas supposée :
 *
 * LA MUTATION QUI A MOTIVÉ CE FICHIER. On ajoute `last4: '4242'` à la ligne de
 * paiement du service de facturation — une donnée de carte, exactement ce que
 * 14 §4.1 interdit de faire transiter. Le test de bout en bout qui balaie le corps
 * des trois routes de facturation reste VERT. Pas parce qu'il est mal écrit : parce
 * qu'un membre neuf n'a aucun paiement. `items` est vide, il n'y a rien à trouver,
 * et le test passe en ne regardant rien.
 *
 * Un test qui ne peut pas échouer sur le défaut qu'il prétend garder est creux.
 * Celui-ci l'était à moitié — la moitié qui compte. Les cas ci-dessous éprouvent
 * donc le CONTRAT et non l'échantillon : ils ne dépendent d'aucune donnée en base,
 * et ils échouent dès que le schéma cesse de refuser.
 *
 * Ils sont écrits ici, à côté des autres épreuves du socle, parce que ce qu'ils
 * gardent est une propriété du socle : une réponse de forme inattendue LÈVE.
 */

describe('14 §4.1 — aucune donnée de carte ne peut traverser la frontière', () => {
  /** Une ligne de paiement valide : le point de départ de chaque cas. */
  const paiement = {
    id: '01a0f136-fa93-7000-af7b-2cf7a8808a8d',
    amount: { amountCents: 400, currency: 'EUR' },
    provider: 'STRIPE',
    method: 'CARD',
    status: 'SUCCEEDED',
    invoiceNumber: 'F-2026-001',
    paidAt: '2026-08-01T10:00:00.000Z',
    createdAt: '2026-08-01T09:59:00.000Z',
  } as const;

  it('la ligne de paiement telle que l’API l’envoie est acceptée', () => {
    expect(paymentViewSchema.safeParse(paiement).success).toBe(true);
  });

  /**
   * `method: 'CARD'` RESTE PERMIS, et c'est une distinction de fond, pas une
   * tolérance. §4.1 interdit les DONNÉES de carte, pas le canal : la maquette
   * dessine « Carte » à côté de « Mobile Money », et c'est ce que le membre a
   * choisi. Un schéma qui refuserait le canal rendrait l'écran d'abonnement
   * impossible tout en ne protégeant rien.
   */
  it('le CANAL « carte » reste permis : c’est l’instrument qui est interdit', () => {
    expect(paymentViewSchema.safeParse({ ...paiement, method: 'CARD' }).success).toBe(true);
    /**
     * `MTN_MOMO` et `MOOV_MONEY`, et NON `MOBILE_MONEY` : ce dernier est un
     * FOURNISSEUR (`PaymentProviderKind`), pas un moyen. Cette ligne a d'abord été
     * écrite avec le mauvais et le cas a rougi — ce qui est exactement le service
     * que rend une énumération générée depuis le schéma plutôt que recopiée. La
     * maquette écrit d'ailleurs les deux bons noms : « MTN ou Moov ».
     */
    expect(paymentViewSchema.safeParse({ ...paiement, method: 'MTN_MOMO' }).success).toBe(true);
    expect(paymentViewSchema.safeParse({ ...paiement, method: 'MOOV_MONEY' }).success).toBe(true);
  });

  /**
   * LES SIX NOMS SOUS LESQUELS UNE DONNÉE DE CARTE ARRIVERAIT.
   *
   * Chacun est refusé, et le test le dit un par un : un `expect` global sur un objet
   * qui les porterait tous passerait si le schéma n'en refusait qu'un seul.
   */
  for (const [champ, valeur] of [
    ['last4', '4242'],
    ['fingerprint', 'aZ9kQ2'],
    ['expMonth', 12],
    ['expYear', 2030],
    ['cardNumber', '4242424242424242'],
    ['brand', 'visa'],
  ] as const) {
    it(`une ligne de paiement portant « ${champ} » est REFUSÉE`, () => {
      const resultat = paymentViewSchema.safeParse({ ...paiement, [champ]: valeur });
      expect(resultat.success, `« ${champ} » a été accepté : la règle 14 §4.1 ne tient plus`).toBe(
        false,
      );
    });
  }

  /**
   * ET LE REFUS REMONTE JUSQU'À L'APPEL, en `ApiShapeError`.
   *
   * Le cas précédent éprouve le schéma ; celui-ci éprouve ce que le SOCLE en fait.
   * Sans lui, on saurait que le schéma refuse sans savoir si l'appelant l'apprend :
   * un schéma qui refuse dans un `safeParse` que personne ne lit ne protège rien.
   *
   * `ApiShapeError` et non `ApiError` : un contrat cassé est un incident, et il ne
   * doit pas pouvoir être attrapé par un `catch` qui cherche une règle métier.
   */
  describe('le socle en fait un incident, pas un message métier', () => {
    let server: FakeServer;

    afterEach(() => {
      server.restore();
      clearSession();
    });

    it('`GET /me/payments` qui porte « last4 » lève ApiShapeError', async () => {
      server = fakeServer(() => ({
        status: 200,
        json: { items: [{ ...paiement, last4: '4242' }], nextCursor: null },
      }));
      setAccessToken(fakeToken());

      await expect(memberApi.get('/me/payments', myPaymentsResponseSchema)).rejects.toBeInstanceOf(
        ApiShapeError,
      );
    });

    it('la même route sans donnée de carte passe : le refus est CIBLÉ', async () => {
      server = fakeServer(() => ({
        status: 200,
        json: { items: [paiement], nextCursor: null },
      }));
      setAccessToken(fakeToken());

      const page = await memberApi.get('/me/payments', myPaymentsResponseSchema);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.method).toBe('CARD');
    });
  });
});

/**
 * ─── 01 §2.1 — AUCUN NUMÉRO EN CLAIR ───────────────────────────────────────
 *
 * « Aucun numéro de téléphone en clair, jamais ; seulement un masque, et seulement
 * à son propriétaire. »
 *
 * Ici encore, l'écran ne suffit pas à le garantir. Le rempart est que `meResponseSchema`
 * ne DÉCRIT aucun champ de numéro en clair : `phones[].masked` est le seul. Ce qui
 * se vérifie, c'est donc ce que le schéma fait d'une réponse qui en porterait un.
 *
 * ET IL NE LE REFUSE PAS AUJOURD'HUI — il le DÉPOUILLE. `meResponseSchema` n'est pas
 * `.strict()`, donc `e164` arriverait, serait retiré, et l'écran resterait propre.
 * La différence avec le cas des cartes est réelle et vaut d'être dite plutôt que
 * cachée derrière un test qui passerait : pour le téléphone, la garantie tenue par
 * ce fichier est que la donnée N'ATTEINT PAS L'ÉCRAN ; qu'elle ait transité se
 * vérifie sur le corps HTTP, ce que fait `e2e/compte.spec.ts` sur la vraie route —
 * et cette mutation-là, elle, rougit.
 *
 * Rendre `meResponseSchema` strict serait le geste cohérent. Ce n'est PAS fait ici,
 * et c'est délibéré : ce schéma est employé par toute l'application et par l'API
 * elle-même, et le resserrer dans un lot qui branche dix écrans ferait tomber des
 * routes que ce lot n'éprouve pas. Signalé au porteur comme un geste à faire, pas
 * pris de sa propre initiative.
 */
describe('01 §2.1 — le numéro en clair n’atteint pas l’écran', () => {
  const me = {
    user: {
      id: '01a0f136-fa93-7000-af7b-2cf7a8808a8d',
      handle: 'amina-d',
      displayName: 'Amina Diallo',
      avatarUrl: null,
      phase: 'RECENT_ARRIVAL',
      verificationLevel: 'L0',
      plan: 'FREE',
      status: 'ACTIVE',
      originCountryId: '01a0e1b0-03eb-7000-8568-a65c501769f6',
      cityId: null,
      arrivalDate: null,
      originCountryLocked: false,
    },
    profile: null,
    phones: [{ id: '01a0f136-951d-7000-9b22-ca9eb4a1f467', masked: '+229 •• •• •• 43', isDestination: false }],
    kyc: null,
    stats: null,
    consents: { outstanding: [] },
    onboarding: { step: 1, complete: false },
  } as const;

  it('le masque est la SEULE forme de numéro que le schéma décrive', () => {
    const analyse = meResponseSchema.parse(me);
    const telephone = analyse.phones[0];
    expect(telephone).toBeDefined();
    expect(Object.keys(telephone ?? {}).sort()).toEqual(['id', 'isDestination', 'masked']);
    expect(telephone?.masked).toContain('•');
  });

  it('un `e164` ajouté par l’API n’arrive PAS jusqu’à l’appelant', () => {
    const avecClair = {
      ...me,
      phones: [{ ...me.phones[0], e164: '+22997000043' }],
    };
    const analyse = meResponseSchema.parse(avecClair);
    expect(JSON.stringify(analyse)).not.toContain('+22997000043');
    expect(Object.keys(analyse.phones[0] ?? {})).not.toContain('e164');
  });
});

/**
 * LE PRIX N'EST JAMAIS UNE CONSTANTE DU FRONT.
 *
 * `packages/shared` porte `PREMIUM_MONTH_PRICE_CENTS`, et c'est une valeur
 * d'AMORÇAGE de la table `plans`, modifiable en back-office (15 §3). Un écran
 * d'abonnement qui l'afficherait mentirait le jour où le porteur change de tarif —
 * sur l'écran précisément où le membre s'engage à payer.
 *
 * Ce cas garde la forme du contrat : les DEUX devises arrivent toujours, parce que
 * « le membre peut être béninois en France, ou français au Bénin » et que le serveur
 * n'en choisit pas une.
 */
describe('14 §7.1 — les deux devises arrivent toujours ensemble', () => {
  it('un plan sans prix en francs CFA est refusé', () => {
    const sansXof = {
      items: [
        {
          code: 'PREMIUM',
          nameFr: 'Premium',
          month: { eur: { amountCents: 400, currency: 'EUR' } },
          year: { eur: { amountCents: 4000, currency: 'EUR' } },
          limits: {},
        },
      ],
    };
    expect(plansResponseSchema.safeParse(sansXof).success).toBe(false);
  });
});
