import type { SmsProvider } from './providers';
import { callProviderJson, type HttpOptions } from './http';

/**
 * SMS réel — Twilio, API **Messages** (`POST /2010-04-01/Accounts/{sid}/Messages.json`).
 *
 * ── POURQUOI MESSAGES ET PAS VERIFY ──────────────────────────────────────────
 *
 * Le dépôt TIRE le code lui-même (`AuthService.requestOtp`), le stocke HACHÉ, compte
 * les tentatives et le lie à un `purpose` (`LOGIN`, `DELETE_ACCOUNT`, `ADD_PHONE`).
 * Ce dernier lien est une protection : sans lui, le code de connexion qu'un membre
 * vient de recevoir confirmerait aussi la suppression de son compte.
 *
 * Twilio Verify tire SON code et garde la vérification chez lui (`VerificationCheck`).
 * L'adopter voudrait dire soit doubler la vérité (son code et notre défi), soit
 * déplacer chez un tiers la règle du `purpose` et le compteur de tentatives — et
 * réécrire les six appelants de `consumeChallenge`. Messages ne fait que porter un
 * texte : le design actuel reste entier, et changer de transporteur demain reste
 * un fichier.
 *
 * Le prix de ce choix est assumé : la délivrabilité par pays (expéditeur
 * alphanumérique, enregistrement 10DLC…) se règle dans la console Twilio, sur le
 * service de messagerie (`TWILIO_MESSAGING_SERVICE_SID`), plutôt que d'être portée
 * par Verify.
 *
 * Le numéro n'apparaît dans AUCUNE erreur : `ProviderError` ne recopie que le
 * statut et un extrait de la réponse, jamais le corps envoyé (§8.1).
 */
export interface TwilioConfig {
  readonly accountSid: string;
  readonly authToken: string;
  readonly from?: string | undefined;
  readonly messagingServiceSid?: string | undefined;
  readonly baseUrl?: string | undefined;
}

export class TwilioSmsProvider implements SmsProvider {
  constructor(
    private readonly config: TwilioConfig,
    private readonly http: HttpOptions = {},
  ) {
    if (config.from === undefined && config.messagingServiceSid === undefined) {
      throw new Error('Twilio : TWILIO_FROM ou TWILIO_MESSAGING_SERVICE_SID est requis.');
    }
  }

  async send(to: string, body: string): Promise<{ providerRef: string }> {
    const form = new URLSearchParams({ To: to, Body: body });
    // Le service de messagerie d'abord : il choisit l'expéditeur par pays.
    if (this.config.messagingServiceSid !== undefined) {
      form.set('MessagingServiceSid', this.config.messagingServiceSid);
    } else if (this.config.from !== undefined) {
      form.set('From', this.config.from);
    }

    const base = this.config.baseUrl ?? 'https://api.twilio.com';
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
    const result = await callProviderJson<{ sid?: string }>(
      'twilio',
      `${base}/2010-04-01/Accounts/${encodeURIComponent(this.config.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
      this.http,
    );
    return { providerRef: result.sid ?? 'twilio-sans-sid' };
  }
}
