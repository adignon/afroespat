import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  authSessionsResponseSchema,
  connectionRequestsResponseSchema,
  connectionSuggestionsResponseSchema,
  kycStatusResponseSchema,
  meResponseSchema,
  myBlocksResponseSchema,
  myConnectionsResponseSchema,
  myPaymentsResponseSchema,
  mySanctionsResponseSchema,
  mySubscriptionResponseSchema,
  notificationPreferencesResponseSchema,
  paymentViewSchema,
  plansResponseSchema,
  publicProfileResponseSchema,
} from '../index.js';

/**
 * ─── LES SCHÉMAS DU MODULE COMPTE, ÉPROUVÉS SUR DES CHARGES RÉELLES ─────────
 *
 * Les treize fixtures de ce fichier ont été RELEVÉES OCTET POUR OCTET sur l'API qui
 * tourne, avec un membre créé pour l'occasion et son profil rempli. Aucun champ
 * n'est déduit du code d'un service.
 *
 * ── POURQUOI CE FICHIER EXISTE : UNE ERREUR QUE J'AI FAITE ──────────────────
 *
 * `myBlocksResponseSchema` a d'abord déclaré un TABLEAU NU, parce qu'il avait été
 * écrit en lisant `BlocksService.list()` — qui rend bien `blocks.map(…)`. C'est le
 * CONTRÔLEUR qui pose l'enveloppe, une ligne plus haut :
 * `return { items: await this.blocks.list(…) }`.
 *
 * Le défaut n'a été trouvé qu'au NAVIGATEUR : l'écran K05 restait sur son état
 * d'attente et trois tests de bout en bout ont rougi, sans qu'aucun d'eux ne nomme
 * la cause. Une fixture l'aurait dit en une seconde, à l'endroit exact.
 *
 * C'est la même leçon que le branchement d'A01 a tirée sur trois pièges que seule
 * une charge relevée pouvait montrer — un champ ABSENT plutôt que `null`, un objet
 * amputé de deux clés, une clé retirée avant l'envoi. Un schéma déduit du code
 * décrit ce que le code a l'air de faire ; une fixture décrit ce qu'il fait.
 *
 * ── CE QUE CHAQUE CAS AFFIRME ───────────────────────────────────────────────
 *
 * Deux choses, et la seconde compte autant que la première :
 *   1. le schéma ACCEPTE la charge réelle — sans quoi l'écran ne s'affiche pas ;
 *   2. il REFUSE une charge amputée d'un champ que l'écran lit — sans quoi il ne
 *      protège de rien et laisserait passer un `undefined` jusqu'au JSX.
 */

const FIXTURES = join(import.meta.dirname, 'fixtures');

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8'));

/**
 * Les treize routes que les dix écrans du module lisent.
 *
 * `ampute` nomme le chemin d'un champ que l'ÉCRAN affiche : le retirer doit faire
 * refuser la charge. Sans cette colonne, le fichier ne prouverait que la moitié
 * facile — un schéma qui n'exigerait plus rien accepterait toujours la vraie
 * réponse, et passerait ces cas sans protéger personne.
 */
const ROUTES = [
  { nom: 'compte_me', route: 'GET /me', schema: meResponseSchema, ampute: ['user', 'displayName'] },
  {
    nom: 'compte_profil_public',
    route: 'GET /users/:handle',
    schema: publicProfileResponseSchema,
    ampute: ['country'],
  },
  {
    nom: 'compte_sessions',
    route: 'GET /auth/sessions',
    schema: authSessionsResponseSchema,
    ampute: ['sessions'],
  },
  { nom: 'compte_kyc', route: 'GET /me/kyc', schema: kycStatusResponseSchema, ampute: ['status'] },
  {
    nom: 'compte_connections',
    route: 'GET /me/connections',
    schema: myConnectionsResponseSchema,
    ampute: ['meta'],
  },
  {
    nom: 'compte_connection_requests',
    route: 'GET /me/connection-requests',
    schema: connectionRequestsResponseSchema,
    ampute: ['items'],
  },
  {
    nom: 'compte_connection_suggestions',
    route: 'GET /me/connection-suggestions',
    schema: connectionSuggestionsResponseSchema,
    ampute: ['items'],
  },
  { nom: 'compte_blocks', route: 'GET /me/blocks', schema: myBlocksResponseSchema, ampute: ['items'] },
  {
    nom: 'compte_subscription',
    route: 'GET /me/subscription',
    schema: mySubscriptionResponseSchema,
    ampute: ['usage'],
  },
  { nom: 'compte_plans', route: 'GET /plans', schema: plansResponseSchema, ampute: ['items'] },
  {
    nom: 'compte_payments',
    route: 'GET /me/payments',
    schema: myPaymentsResponseSchema,
    ampute: ['nextCursor'],
  },
  {
    nom: 'compte_notification_preferences',
    route: 'GET /me/notification-preferences',
    schema: notificationPreferencesResponseSchema,
    ampute: ['quietHours'],
  },
  {
    nom: 'compte_sanctions',
    route: 'GET /me/sanctions',
    schema: mySanctionsResponseSchema,
    ampute: ['items'],
  },
] as const;

describe('les schémas du module Compte acceptent les charges RÉELLES de l’API', () => {
  for (const { nom, route, schema } of ROUTES) {
    it(`${route} — la charge relevée est acceptée`, () => {
      const resultat = schema.safeParse(charge(nom));
      const detail = resultat.success
        ? ''
        : JSON.stringify(resultat.error.issues.slice(0, 4), null, 2);
      expect(resultat.success, `${route} refuse sa propre réponse :\n${detail}`).toBe(true);
    });
  }

  for (const { nom, route, schema, ampute } of ROUTES) {
    it(`${route} — une charge privée de « ${ampute.join('.')} » est REFUSÉE`, () => {
      const corps = charge(nom) as Record<string, unknown>;
      const [tete, ...reste] = ampute;
      const copie = structuredClone(corps);
      if (reste.length === 0) {
        delete copie[tete];
      } else {
        const parent = copie[tete] as Record<string, unknown>;
        delete parent[reste[0] as string];
      }
      expect(
        schema.safeParse(copie).success,
        `${route} accepte une réponse sans « ${ampute.join('.')} » : le schéma ne protège rien`,
      ).toBe(false);
    });
  }
});

/**
 * ─── LES PIÈGES QUE SEULE UNE CHARGE RELEVÉE POUVAIT MONTRER ────────────────
 *
 * Trois faits de ces réponses ne se lisent dans aucun service, et chacun aurait
 * produit un schéma faux s'il avait été déduit du code.
 */
describe('ce que les charges relevées ont appris', () => {
  it('`GET /me/blocks` ENVELOPPE sa liste : le service la rend nue, le contrôleur l’enveloppe', () => {
    const corps = charge('compte_blocks') as Record<string, unknown>;
    expect(Array.isArray(corps)).toBe(false);
    expect(corps).toHaveProperty('items');
    // Et le schéma refuse la forme qu'on avait d'abord écrite en lisant le service.
    expect(myBlocksResponseSchema.safeParse([]).success).toBe(false);
  });

  it('`GET /me/connection-requests` n’a PAS de `nextCursor` : §5.3 n’est pas suivi ici', () => {
    const corps = charge('compte_connection_requests') as Record<string, unknown>;
    expect(Object.keys(corps)).toEqual(['items']);
    /**
     * L'écart est réel et remonté au porteur. Le schéma le DÉCRIT plutôt que de le
     * corriger poliment : un `pageSchema` refuserait la vraie réponse, et un
     * `nextCursor` facultatif ferait prendre une pagination muette pour une fin de
     * liste — exactement ce que le commentaire de `pageSchema` met en garde.
     */
    expect(connectionRequestsResponseSchema.safeParse(corps).success).toBe(true);
  });

  /**
   * `.strict()` SUR LE PROFIL PUBLIC — greffer une donnée d'identité doit ARRÊTER.
   *
   * C'est la même décision que le branchement d'A01 a prise sur les formes de
   * contenu, et pour la même raison mesurée là-bas : sans `.strict()`, un champ
   * greffé « passait la validation sans un mot ». Sur une route d'identité, ce mot
   * est celui qui manque le plus.
   */
  it('greffer un numéro de téléphone sur le profil public le fait REFUSER', () => {
    const corps = charge('compte_profil_public') as Record<string, unknown>;
    expect(publicProfileResponseSchema.safeParse(corps).success).toBe(true);
    expect(
      publicProfileResponseSchema.safeParse({ ...corps, phone: '+22997000043' }).success,
      'un numéro greffé sur le profil public est accepté : il aurait transité (01 §2.1)',
    ).toBe(false);
    expect(
      publicProfileResponseSchema.safeParse({ ...corps, birthDate: '1998-04-12' }).success,
      'une date de naissance greffée est acceptée : 00 §8.1 ne la collecte pas',
    ).toBe(false);
  });

  it('`GET /me/subscription` porte `usage` IMBRIQUÉ, et ses limites peuvent être nulles', () => {
    const corps = charge('compte_subscription') as {
      usage: { items: { metric: string; used: number; limit: number | null }[] };
    };
    expect(corps.usage.items.length).toBeGreaterThan(0);
    // `null` = illimité. L'écran affiche « illimité », jamais « 0 sur null ».
    const avecIllimite = structuredClone(corps);
    const premier = avecIllimite.usage.items[0];
    if (premier !== undefined) premier.limit = null;
    expect(mySubscriptionResponseSchema.safeParse(avecIllimite).success).toBe(true);
  });
});

/**
 * ─── 14 §4.1, SUR LA CHARGE RÉELLE ─────────────────────────────────────────
 *
 * La règle dure se vérifie ici sur ce que l'API ENVOIE vraiment, et non sur un objet
 * fabriqué pour le test. C'est la moitié que `apps/web/.../carte-interdite.test.ts`
 * ne peut pas couvrir : lui éprouve le contrat, celui-ci éprouve la charge.
 */
describe('14 §4.1 — les charges relevées ne portent aucune donnée de carte', () => {
  const CHAMPS = /last4|fingerprint|exp_?month|exp_?year|card_?number|cvc|"brand"/i;

  for (const nom of ['compte_payments', 'compte_subscription', 'compte_plans']) {
    it(`${nom}.json n’en porte aucune`, () => {
      expect(readFileSync(join(FIXTURES, `${nom}.json`), 'utf8')).not.toMatch(CHAMPS);
    });
  }

  it('greffer « last4 » sur une ligne de paiement réelle la fait REFUSER', () => {
    const corps = charge('compte_payments') as { items: unknown[] };
    /**
     * La charge relevée a `items: []` — un membre neuf n'a aucun paiement. C'est
     * précisément ce qui rendait creux le test de bout en bout : il balayait un
     * corps vide et passait sans rien regarder. On greffe donc une ligne VALIDE,
     * puis la même avec `last4`, et on exige que la seconde soit refusée.
     */
    expect(corps.items).toHaveLength(0);

    const ligne = {
      id: '01a0f136-fa93-7000-af7b-2cf7a8808a8d',
      amount: { amountCents: 400, currency: 'EUR' },
      provider: 'STRIPE',
      method: 'CARD',
      status: 'SUCCEEDED',
      invoiceNumber: 'F-2026-001',
      paidAt: '2026-08-01T10:00:00.000Z',
      createdAt: '2026-08-01T09:59:00.000Z',
    };
    expect(paymentViewSchema.safeParse(ligne).success).toBe(true);
    expect(paymentViewSchema.safeParse({ ...ligne, last4: '4242' }).success).toBe(false);
  });
});

/**
 * ─── 01 §2.1, SUR LA CHARGE RÉELLE ─────────────────────────────────────────
 *
 * La charge de `GET /me` relevée sur l'API ne porte qu'un MASQUE. C'est le fait
 * source de toute la règle : l'écran ne peut pas afficher ce que le serveur
 * n'envoie pas.
 */
describe('01 §2.1 — la charge de /me ne porte qu’un masque', () => {
  it('le téléphone relevé est masqué, et c’est son seul champ de numéro', () => {
    const corps = charge('compte_me') as {
      phones: { id: string; masked: string; isDestination: boolean }[];
    };
    expect(corps.phones.length).toBeGreaterThan(0);
    for (const telephone of corps.phones) {
      expect(Object.keys(telephone).sort()).toEqual(['id', 'isDestination', 'masked']);
      expect(telephone.masked).toContain('•');
      // Quatre chiffres au plus : les deux derniers et l'indicatif.
      expect((telephone.masked.match(/\d/g) ?? []).length).toBeLessThanOrEqual(5);
    }
  });
});
