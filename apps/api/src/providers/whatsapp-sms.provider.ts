import type { SmsProvider } from './providers';
import { callProviderJson, ProviderError, type HttpOptions } from './http';

/**
 * Code de connexion par WhatsApp — API Cloud de Meta
 * (`POST https://graph.facebook.com/{version}/{phone_number_id}/messages`).
 *
 * ── POURQUOI UN MODÈLE, ET COMMENT LE CODE LUI ARRIVE ────────────────────────
 *
 * WhatsApp interdit d'écrire librement à quelqu'un qui n'a pas écrit dans les 24
 * dernières heures : le premier message doit être un MODÈLE approuvé par Meta. Pour
 * un code, c'est un modèle de catégorie « Authentication » : un corps à un seul
 * paramètre (le code) et, dans sa forme standard, un bouton « Copier le code » qui
 * reçoit le même paramètre (`otpButton`).
 *
 * `SmsProvider.send(to, body)` reçoit le texte déjà composé par le service
 * d'authentification (« Votre code de connexion : 482913 »), pas le code seul.
 * Plutôt que de changer le contrat de six appelants, l'adaptateur relit le code en
 * fin de texte. Si le texte n'en porte pas, il REFUSE d'envoyer : mieux vaut un
 * échec franc qu'un modèle vide.
 *
 * Le numéro n'apparaît dans AUCUNE erreur (§8.1) : `ProviderError` ne recopie que
 * le statut et un extrait de la réponse, jamais le corps envoyé.
 */
export interface WhatsAppConfig {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly templateName: string;
  readonly templateLanguage: string;
  /** Le modèle standard « Authentication » porte un bouton de copie qui veut le code. */
  readonly otpButton: boolean;
  readonly apiVersion?: string | undefined;
  readonly baseUrl?: string | undefined;
}

const CODE_EN_FIN = /(\d{4,8})\s*$/;

export class WhatsAppSmsProvider implements SmsProvider {
  constructor(
    private readonly config: WhatsAppConfig,
    private readonly http: HttpOptions = {},
  ) {}

  async send(to: string, body: string): Promise<{ providerRef: string }> {
    const code = CODE_EN_FIN.exec(body)?.[1];
    if (code === undefined) {
      throw new ProviderError('whatsapp', null, 'aucun code à envoyer dans le message', false);
    }

    const components: unknown[] = [{ type: 'body', parameters: [{ type: 'text', text: code }] }];
    if (this.config.otpButton) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: code }],
      });
    }

    const base = this.config.baseUrl ?? 'https://graph.facebook.com';
    const version = this.config.apiVersion ?? 'v21.0';
    const result = await callProviderJson<{ messages?: ReadonlyArray<{ id?: string }> }>(
      'whatsapp',
      `${base}/${version}/${encodeURIComponent(this.config.phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          // Meta veut le numéro en chiffres seuls : E.164 sans le « + ».
          to: to.replace(/^\+/, ''),
          type: 'template',
          template: {
            name: this.config.templateName,
            language: { code: this.config.templateLanguage },
            components,
          },
        }),
      },
      this.http,
    );
    return { providerRef: result.messages?.[0]?.id ?? 'whatsapp-sans-reference' };
  }
}
