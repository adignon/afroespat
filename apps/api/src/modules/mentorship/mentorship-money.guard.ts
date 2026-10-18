import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { matchLocalRule } from '@app/shared';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { EventHandlerRegistry } from '../../queue/event-handlers';
import { ModerationService } from '../moderation/moderation.service';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « JAMAIS D'ARGENT » DANS LA CONVERSATION DE PARRAINAGE — 08 §2.4          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 08 §2.4 : « Le parrainage n'implique jamais d'argent. Le guide du parrain le
 * dit ; la modération IA marque `MONEY_REQUEST` dans la conversation de parrainage
 * avec priorité 1. » Le commentaire de `mentorship.service.ts` l'affirmait, et
 * RIEN ne le faisait : `message.sent` n'avait pour lecteurs que les notifications
 * et le temps réel, donc un parrain qui écrivait « envoie-moi 200 € sur mon
 * compte » à son filleul ne laissait aucune trace côté modération.
 *
 * ── CE QUE CE FICHIER FAIT, ET CE QU'IL NE FAIT PAS ───────────────────────
 *
 * Sur `message.sent`, pour une conversation de genre `MENTORSHIP` SEULEMENT, il
 * relit le message, le déchiffre, applique les RÈGLES LOCALES du module de
 * modération (`matchLocalRule` : IBAN, numéro de carte, liens de paiement, verbe de
 * versement dont la cible est le membre) et, si l'une joue, ouvre un dossier de
 * priorité 1 sur le message (`MESSAGE`).
 *
 * Il ne MASQUE pas le message et ne SANCTIONNE personne : §2 pose que seul un
 * humain suspend, et un dossier de priorité 1 a un délai de 4 h (13 §4.1). Il
 * n'envoie rien à l'IA non plus — le texte brut ne doit jamais la quitter sans
 * masquage, et ce chemin n'en a pas besoin : les règles locales suffisent à dire
 * « demande de versement ».
 *
 * LE LOT « MODÉRATION » ÉTEND CETTE DÉTECTION AUX AUTRES CONTENUS. Ce fichier est
 * volontairement séparé de `modules/moderation` pour ne pas le restructurer ; le
 * jour où `check()` prendra les messages, il disparaîtra avec son seul
 * abonnement.
 *
 * ── POURQUOI LE CORPS N'EST PAS DANS L'ÉVÉNEMENT ──────────────────────────
 *
 * `messaging.service.ts` n'y met AUCUN corps : `domain_events` est une table en
 * clair et §8.1 chiffre les messages au repos. On relit donc le message par son
 * identifiant, et on le déchiffre ici, en mémoire, le temps d'un `test()`.
 *
 * ── IDEMPOTENCE ───────────────────────────────────────────────────────────
 *
 * La livraison est « au moins une fois ». `openCase` dédoublonne sur le sujet
 * (un dossier ouvert par message), donc un rejeu n'empile rien.
 *
 * L'ABONNEMENT SE FAIT ICI et non dans `event-subscriptions.service.ts` : ce
 * fichier-là est partagé par tous les modules, et le registre accepte plusieurs
 * lecteurs pour un même type (les notifications et le temps réel écoutent déjà
 * `message.sent`).
 */
@Injectable()
export class MentorshipMoneyGuard implements OnModuleInit {
  private readonly logger = new Logger(MentorshipMoneyGuard.name);

  constructor(
    private readonly registry: EventHandlerRegistry,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly moderation: ModerationService,
  ) {}

  onModuleInit(): void {
    this.registry.on('message.sent', 'mentorship-money', async (job) => {
      await this.inspect(job.payload);
    });
  }

  /**
   * Inspecte un message envoyé. Rend `true` quand un dossier a été ouvert (ou
   * retrouvé), `false` sinon — la valeur sert aux tests, pas à l'abonnement.
   *
   * Une charge qui n'a pas la forme attendue est IGNORÉE sans lever : lever ferait
   * rejouer l'événement dix fois pour rien.
   */
  async inspect(payload: unknown): Promise<boolean> {
    if (typeof payload !== 'object' || payload === null) return false;
    const { kind, messageId } = payload as { kind?: unknown; messageId?: unknown };
    // Le genre voyage dans la charge (`messaging.service.ts`) : on évite de
    // relire la conversation pour les messages directs, qui sont l'immense majorité.
    if (kind !== 'MENTORSHIP' || typeof messageId !== 'string') return false;

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { senderUserId: true, bodyEncrypted: true, deletedAt: true },
    });
    // Supprimé avant d'être lu : son corps est vide, il n'y a rien à juger.
    if (message === null || message.deletedAt !== null) return false;

    const rule = matchLocalRule(this.crypto.decryptContent(message.bodyEncrypted));
    if (rule === null) return false;

    this.logger.warn(`Demande d'argent présumée en parrainage (règle ${rule}) : dossier ouvert.`);
    await this.moderation.openCase({
      subjectType: 'MESSAGE',
      subjectId: messageId,
      subjectAuthorUserId: message.senderUserId,
      source: 'AUTO_RULE',
      // 08 §2.4 : « avec priorité 1 ».
      priority: 1,
      labels: ['MONEY_REQUEST'],
      note: `Règle locale ${rule} dans une conversation de parrainage (08 §2.4).`,
    });
    return true;
  }
}
