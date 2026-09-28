import { createHmac, timingSafeEqual } from 'node:crypto';
import { Logger } from '@nestjs/common';

/**
 * Les frontières du module 14 qu'AUCUN fournisseur ne franchit encore.
 *
 * Trois interfaces existent déjà dans `providers/providers.ts` — `PaymentProvider`
 * (Stripe), `MobileMoneyProvider` (agrégateur UEMOA, NON DÉSIGNÉ, décision D4) et
 * leurs doublures de développement. Ce fichier porte les deux qui manquaient, et
 * il les porte sur le modèle de `EMAIL_ADDRESS` / `NoEmailAddressPort` : quand
 * rien n'est configuré, la doublure DIT QU'ELLE NE PEUT PAS, au lieu de rendre un
 * faux succès.
 *
 * La différence n'est pas académique. Une doublure de webhook qui accepterait
 * tout laisserait n'importe qui activer un abonnement Premium par une requête
 * HTTP ; une doublure de facture qui rendrait un PDF vide ferait croire à une
 * facture envoyée. Les deux défauts sont silencieux, et les deux se découvrent
 * chez le membre.
 *
 * Le jour où le prestataire arrive, UN SEUL fournisseur change dans
 * `app.module.ts`. Rien du service n'est à toucher.
 */

// ── Vérification de signature d'un webhook entrant (T4 §8) ──────────────────

export type SignatureCheck = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export interface WebhookVerifier {
  /** Pour le journal : « stripe (non configuré) », « mobile-money (hmac) ». */
  readonly describe: string;
  /**
   * Le corps BRUT et les en-têtes, tels que reçus.
   *
   * Brut et non l'objet analysé : une signature porte sur des octets. Recalculer
   * `JSON.stringify(body)` donnerait un ordre de clés et un espacement différents
   * de ceux du fournisseur, donc une signature toujours fausse — ou, pire, une
   * vérification qu'on finirait par désactiver pour « débloquer ».
   */
  verify(rawBody: Buffer | undefined, headers: Record<string, string | string[] | undefined>): SignatureCheck;
}

export const STRIPE_WEBHOOK_VERIFIER = Symbol('StripeWebhookVerifier');
export const MOBILE_MONEY_WEBHOOK_VERIFIER = Symbol('MobileMoneyWebhookVerifier');

/**
 * Le vérificateur par défaut : AUCUN secret, donc aucun webhook accepté.
 *
 * C'est le pendant exact de `NoEmailAddressPort`. Aucune clé Stripe n'existe et
 * l'agrégateur Mobile Money n'est pas désigné : il n'y a donc rien contre quoi
 * vérifier, et le seul comportement honnête est le REFUS. Un `return { ok: true }`
 * « en attendant » ferait de `/v1/webhooks/stripe` une route d'activation
 * d'abonnement ouverte à tous — et rien, dans les journaux, ne le dirait.
 */
export class UnconfiguredWebhookVerifier implements WebhookVerifier {
  private readonly logger = new Logger('WebhookVerifier');

  constructor(private readonly provider: string) {}

  get describe(): string {
    return `${this.provider} (aucun secret configuré — tout webhook est refusé)`;
  }

  verify(): SignatureCheck {
    this.logger.warn(
      `Webhook ${this.provider} refusé : aucun secret n'est configuré. ` +
        'Renseignez le secret du fournisseur pour activer la vérification.',
    );
    return { ok: false, reason: 'NO_SECRET' };
  }
}

/** L'en-tête que porte la signature. Un seul nom, pour les deux fournisseurs. */
export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';

/**
 * Vérification HMAC-SHA256 du corps brut, pour un secret partagé.
 *
 * `sha256=<hex>` dans `x-webhook-signature`. C'est le schéma le plus répandu et
 * celui qu'emploient FedaPay et PayDunya ; Stripe, lui, signe
 * `t=<horodatage>,v1=<hmac de "t.corps">`, et son adaptateur remplacera cette
 * classe sans rien changer au service — c'est tout l'intérêt du port.
 *
 * TROIS PROPRIÉTÉS, et chacune a sa raison :
 *
 *   · **corps brut obligatoire.** Sans lui, on ne peut RIEN vérifier :
 *     `rawBody === undefined` refuse, plutôt que de retomber sur une
 *     sérialisation reconstruite qui ne correspondrait à rien.
 *   · **comparaison à temps constant.** `timingSafeEqual`, et non `===` : une
 *     comparaison courte-circuitée laisse deviner la signature octet par octet.
 *   · **longueurs comparées d'abord.** `timingSafeEqual` LÈVE sur deux tampons de
 *     tailles différentes, ce qui transformerait une signature tronquée en 500 au
 *     lieu d'un refus.
 */
export class HmacWebhookVerifier implements WebhookVerifier {
  constructor(
    private readonly provider: string,
    private readonly secret: string,
  ) {}

  get describe(): string {
    return `${this.provider} (HMAC-SHA256 sur le corps brut)`;
  }

  verify(
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ): SignatureCheck {
    if (rawBody === undefined || rawBody.length === 0) return { ok: false, reason: 'NO_RAW_BODY' };

    const header = headers[WEBHOOK_SIGNATURE_HEADER];
    const provided = Array.isArray(header) ? header[0] : header;
    if (typeof provided !== 'string' || !provided.startsWith('sha256=')) {
      return { ok: false, reason: 'NO_SIGNATURE' };
    }

    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    const given = provided.slice('sha256='.length);
    if (given.length !== expected.length) return { ok: false, reason: 'BAD_SIGNATURE' };

    return timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'))
      ? { ok: true }
      : { ok: false, reason: 'BAD_SIGNATURE' };
  }
}

/** La signature qu'attend `HmacWebhookVerifier`. Employée par les tests et le runbook. */
export function signWebhookBody(secret: string, rawBody: Buffer | string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

// ── Facture PDF (§4.4) ──────────────────────────────────────────────────────

export interface InvoicePdfPort {
  /**
   * Rend la facture et renvoie l'identifiant du média créé, ou `null` si le rendu
   * n'est pas possible.
   */
  render(input: {
    paymentId: string;
    invoiceNumber: string;
    amountCents: number;
    currency: string;
  }): Promise<{ assetId: string } | null>;
}

export const INVOICE_PDF = Symbol('InvoicePdf');

/**
 * Aucun rendu de facture, et c'est une dépendance NON SATISFAITE.
 *
 * §4.4 demande un « PDF généré (`invoice_asset_id`), envoyé par email si email
 * vérifié ». Trois pièces manquent, aucune n'est de ce module :
 *
 *   · aucun moteur de rendu PDF n'est installé ;
 *   · `media_assets` n'a pas de pipeline d'écriture côté serveur (l'import est
 *     direct vers le stockage objet, par URL signée) ;
 *   · `users.email` n'existe pas dans le schéma figé, donc AUCUNE facture ne peut
 *     partir par email — c'est le même constat que `NoEmailAddressPort`.
 *
 * Le NUMÉRO de facture, lui, est bien attribué et séquentiel : l'obligation
 * comptable porte sur le numéro et sur la ligne de `payments`, pas sur le PDF. La
 * route de téléchargement répond donc `INVOICE_UNAVAILABLE` (503) — « pas encore
 * téléchargeable », et non 404 « n'existe pas », qui serait faux.
 */
export class NoInvoicePdfPort implements InvoicePdfPort {
  render(): Promise<null> {
    return Promise.resolve(null);
  }
}
