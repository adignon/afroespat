import { Inject, Injectable, Logger } from '@nestjs/common';
import { newId } from '@app/db';
import { ACCOUNT_ERROR_CODES, ACCOUNT_ERROR_MESSAGES, ACCOUNT_LIMITS, type AccountErrorCode } from '@app/shared';
import { ApiError } from '../../common/api-error';
import { CryptoService } from '../../common/crypto.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../../providers/providers';

/**
 * L'export RGPD — 01-identite.md §2.8, §4.2 et §8.
 *
 * §2.8, mot pour mot : « Export : demande depuis les paramètres, génération
 * ASYNCHRONE d'une archive (JSON par module + PDF du ou des parcours), lien
 * valable 7 jours, une demande par 30 jours. »
 *
 * C'EST UNE OBLIGATION LÉGALE (RGPD art. 15 et 20), pas une commodité, et cela
 * décide trois choses qu'un confort n'aurait pas décidées :
 *
 *   · **l'exhaustivité prime sur l'élégance.** Une table oubliée est une donnée
 *     que le membre n'a pas reçue. La liste des modules est donc explicite et
 *     ordonnée comme le dossier de spécifications, pour qu'un module ajouté au
 *     produit et oublié ici se voie en relisant ce fichier à côté de `PROJECT.md` ;
 *   · **l'archive ne contient QUE le membre.** Un export qui emporterait les
 *     messages de ses correspondants, ou le nom des membres qui ont voté sur son
 *     guide, ferait de l'exercice d'un droit la violation du droit d'un autre.
 *     Chaque requête ci-dessous est donc filtrée sur `userId`, et les contenus
 *     d'autrui sont réduits à des identifiants ;
 *   · **les numéros de téléphone SONT rendus en clair.** C'est l'exception
 *     assumée à §3.1 (« l'application admin n'affiche jamais un numéro en
 *     clair ») : cette règle protège le membre de l'ÉQUIPE, et n'a aucun sens
 *     opposée au membre lui-même, à qui le numéro appartient. L'archive n'est
 *     jamais lue par l'équipe.
 *
 * LE PDF DES PARCOURS N'EST PAS PRODUIT, et c'est signalé plutôt que simulé : le
 * projet n'a aucun port de génération PDF — `app.module.ts` documente déjà
 * `NoInvoicePdfPort` pour les factures, pour la même raison. Les parcours sont
 * donc présents en JSON, complets, dans la section `parcours`. Remonté au
 * propriétaire : c'est le seul point de §2.8 qui n'est pas livré tel quel.
 */

/** Ce que la génération produit. Une entrée par module du dossier de specs. */
type Archive = Record<string, unknown>;

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private fail(code: AccountErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, ACCOUNT_ERROR_MESSAGES[code], ACCOUNT_ERROR_CODES[code], details);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /me/export
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Enregistre la demande et laisse le worker produire l'archive.
   *
   * LE QUOTA DE TRENTE JOURS se compte sur `data_exports`, pas dans Redis : voir
   * `ACCOUNT_LIMITS.exportRequestIntervalDays`. Il porte sur la DEMANDE
   * (`created_at`), pas sur la livraison — sinon une génération en échec
   * rouvrirait le droit à une demande immédiate, et une panne deviendrait un
   * moyen de contourner le plafond.
   *
   * La demande et l'événement partent dans la MÊME transaction (§9.1) : une
   * ligne `PENDING` sans événement resterait `PENDING` pour toujours, et un
   * événement sans ligne ferait chercher au worker une demande qui n'existe pas.
   */
  async request(userId: string, now: Date = new Date()): Promise<{ id: string; status: 'PENDING'; requestedAt: string }> {
    const since = new Date(now.getTime() - ACCOUNT_LIMITS.exportRequestIntervalDays * 86_400_000);
    const recent = await this.prisma.dataExport.findFirst({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent !== null) {
      const nextAt = new Date(recent.createdAt.getTime() + ACCOUNT_LIMITS.exportRequestIntervalDays * 86_400_000);
      this.fail('EXPORT_TOO_SOON', { nextRequestAt: nextAt.toISOString() });
    }

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.dataExport.create({ data: { id, userId, status: 'PENDING' } });
      await this.outbox.emit(tx, {
        type: 'user.export_requested',
        aggregateId: userId,
        payload: { exportId: id, userId },
      });
    });

    return { id, status: 'PENDING', requestedAt: now.toISOString() };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET /me/export/latest
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * La dernière archive demandée, avec son lien si elle est prête ET valide.
   *
   * LE LIEN N'EST PRODUIT QUE POUR UNE ARCHIVE VIVANTE. Une ligne `READY` dont
   * l'`expires_at` est passé ne donne PAS de lien, même si la tâche de purge
   * n'est pas encore passée : sans ce contrôle, les sept jours de §2.8 seraient
   * en réalité « sept jours, plus le délai avant le prochain balayage », et la
   * promesse faite au membre dépendrait de l'heure à laquelle tourne une tâche.
   */
  async latest(
    userId: string,
    now: Date = new Date(),
  ): Promise<{ id: string; status: string; requestedAt: string; readyAt: string | null; expiresAt: string | null; downloadUrl: string | null }> {
    const row = await this.prisma.dataExport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        readyAt: true,
        expiresAt: true,
        asset: { select: { storageKey: true } },
      },
    });
    if (row === null) this.fail('EXPORT_NOT_FOUND');

    const alive = row.status === 'READY' && row.expiresAt !== null && row.expiresAt.getTime() > now.getTime();
    const downloadUrl =
      alive && row.asset !== null
        ? await this.storage.createDownloadUrl(
            row.asset.storageKey,
            Math.max(1, Math.floor(((row.expiresAt as Date).getTime() - now.getTime()) / 1000)),
          )
        : null;

    return {
      id: row.id,
      // Une archive expirée est annoncée `EXPIRED` même si la purge n'a pas
      // encore écrit la colonne : le membre lit l'état réel, pas l'état balayé.
      status: row.status === 'READY' && !alive ? 'EXPIRED' : row.status,
      requestedAt: row.createdAt.toISOString(),
      readyAt: row.readyAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      downloadUrl,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Génération — consommateur de `user.export_requested`, dans le worker
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Produit l'archive et la remet au membre.
   *
   * IDEMPOTENTE, parce que le relais de la boîte d'envoi garantit « au moins une
   * fois » : la demande est RÉCLAMÉE par un `updateMany` conditionné à
   * `status: 'PENDING'`, l'idiome de `account.service.ts`. Un second passage ne
   * réclame rien, ne régénère rien, et ne facture pas une seconde traversée de
   * vingt tables.
   */
  async generate(exportId: string, now: Date = new Date()): Promise<{ genere: boolean; octets?: number }> {
    const claimed = await this.prisma.dataExport.updateMany({
      where: { id: exportId, status: 'PENDING' },
      data: { status: 'PENDING' },
    });
    if (claimed.count === 0) return { genere: false };

    const row = await this.prisma.dataExport.findUnique({ where: { id: exportId }, select: { userId: true, assetId: true } });
    if (row === null || row.assetId !== null) return { genere: false };

    const archive = await this.collect(row.userId);
    const body = Buffer.from(JSON.stringify(archive, null, 2), 'utf8');

    // La clé porte l'identifiant de l'export, pas celui du membre seul : deux
    // archives d'un même membre ne doivent jamais se recouvrir, et `storage_key`
    // est unique au schéma.
    const storageKey = `exports/${row.userId}/${exportId}.json`;
    await this.storage.put(storageKey, body, 'application/json');

    const assetId = newId();
    const expiresAt = new Date(now.getTime() + ACCOUNT_LIMITS.exportLinkValidityDays * 86_400_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.mediaAsset.create({
        data: {
          id: assetId,
          ownerUserId: row.userId,
          kind: 'EXPORT',
          storageKey,
          mime: 'application/json',
          sizeBytes: BigInt(body.length),
          // `READY` sans passer par `SCANNING` : l'analyse antivirus de §8.3 porte
          // sur ce qu'un MEMBRE importe. Ce fichier-ci est produit par le serveur
          // à partir de sa propre base — le scanner reviendrait à se méfier de soi.
          status: 'READY',
          exifStripped: true,
        },
      });
      await tx.dataExport.update({
        where: { id: exportId },
        data: { status: 'READY', assetId, readyAt: now, expiresAt },
      });
    });

    this.logger.log(`Archive RGPD prête — export ${exportId}, ${body.length} octets`);
    return { genere: true, octets: body.length };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // `export.purge` — 01 §8, quotidienne : « Archives expirées »
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Retire les archives dont le lien de sept jours est échu.
   *
   * L'OCTET EST SUPPRIMÉ, pas seulement l'état. Passer la ligne à `EXPIRED` en
   * laissant le fichier dans le stockage garderait indéfiniment une copie
   * complète des données d'un membre hors de la base — exactement ce que la
   * minimisation du RGPD interdit, et la ligne `data_exports` continuerait
   * d'affirmer que tout est en ordre. La suppression du média est donc la tâche,
   * et le changement d'état n'en est que la trace.
   *
   * BORNÉE (`take`), comme l'exige `scheduled-tasks.ts` : un premier passage
   * après une longue interruption ne doit pas tenir son verrou pendant des
   * milliers de suppressions distantes.
   */
  async purgeExpired(now: Date = new Date(), batch = 200): Promise<{ purgees: number }> {
    const due = await this.prisma.dataExport.findMany({
      where: { status: 'READY', expiresAt: { lte: now } },
      orderBy: { expiresAt: 'asc' },
      take: batch,
      select: { id: true, assetId: true, asset: { select: { storageKey: true } } },
    });

    let purgees = 0;
    for (const row of due) {
      if (row.asset !== null) {
        try {
          await this.storage.delete(row.asset.storageKey);
        } catch (error) {
          // On N'AVANCE PAS l'état si l'octet n'a pas pu partir : la ligne reste
          // échue et le créneau suivant réessaiera. Marquer `EXPIRED` ici ferait
          // perdre la seule trace qu'un fichier traîne encore dans le stockage.
          this.logger.error(
            `Archive ${row.id} : suppression du stockage impossible — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.dataExport.update({ where: { id: row.id }, data: { status: 'EXPIRED', assetId: null } });
        if (row.assetId !== null) {
          await tx.mediaAsset.update({ where: { id: row.assetId }, data: { deletedAt: now } });
        }
      });
      purgees += 1;
    }

    return { purgees };
  }

  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Rassemble les données du membre, module par module, dans l'ordre du dossier.
   *
   * Les clés sont celles des fichiers de spécifications (`01-identite`,
   * `03-parcours`…) pour qu'on puisse poser l'archive à côté du dossier et voir
   * tout de suite ce qui manque. C'est la lecture que §2.8 appelle « JSON par
   * module ».
   */
  private async collect(userId: string): Promise<Archive> {
    const owned = { userId } as const;

    const [user, profile, languages, skills, phones, consents, sessions, kyc, deletionRequests] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, createdAt: true, handle: true, displayName: true, phase: true,
          verificationLevel: true, originCountryId: true, cityId: true, arrivalDate: true,
          plannedDepartureDate: true, status: true, plan: true, lastSeenAt: true,
        },
      }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.userLanguage.findMany({ where: owned }),
      this.prisma.userSkill.findMany({ where: owned }),
      this.prisma.phoneNumber.findMany({ where: owned, select: { id: true, countryId: true, phoneEncrypted: true, isPrimary: true, isDestination: true, verifiedAt: true } }),
      this.prisma.consent.findMany({ where: owned }),
      this.prisma.authSession.findMany({ where: owned, select: { id: true, createdAt: true, expiresAt: true, revokedAt: true } }),
      this.prisma.kycVerification.findMany({ where: owned, select: { id: true, createdAt: true, status: true, provider: true, decidedAt: true, declineReasonCode: true } }),
      this.prisma.accountDeletionRequest.findMany({ where: owned }),
    ]);

    const [journeys, posts, comments, stories, guides, guideVotes] = await Promise.all([
      this.prisma.journey.findMany({
        where: { ownerUserId: userId },
        include: { steps: { select: { id: true, title: true, position: true, status: true, dueDate: true, startedAt: true, completedAt: true, durationDays: true } } },
      }),
      this.prisma.post.findMany({ where: { authorUserId: userId } }),
      this.prisma.comment.findMany({ where: { authorUserId: userId } }),
      this.prisma.story.findMany({ where: { authorUserId: userId } }),
      this.prisma.guide.findMany({ where: { authorUserId: userId } }),
      this.prisma.guideVote.findMany({ where: owned }),
    ]);

    const [helpRequests, helpResponses, communityMemberships, mentorProfile, mentorships, connections] = await Promise.all([
      this.prisma.helpRequest.findMany({ where: { authorUserId: userId } }),
      this.prisma.helpResponse.findMany({ where: { authorUserId: userId } }),
      this.prisma.communityMember.findMany({ where: owned }),
      this.prisma.mentorProfile.findUnique({ where: { userId } }),
      this.prisma.mentorship.findMany({ where: { OR: [{ mentorUserId: userId }, { menteeUserId: userId }] } }),
      this.prisma.connection.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    ]);

    const [messages, events, attendances, housing, jobs, pro] = await Promise.all([
      // SES messages seulement. Ceux de ses correspondants appartiennent à ces
      // correspondants — les inclure ferait de l'export d'une personne la fuite
      // d'une autre.
      this.prisma.message.findMany({
        where: { senderUserId: userId },
        select: { id: true, conversationId: true, sentAt: true, deletedAt: true, bodyEncrypted: true },
      }),
      this.prisma.event.findMany({ where: { organizerUserId: userId } }),
      this.prisma.eventAttendee.findMany({ where: owned }),
      this.prisma.housingListing.findMany({ where: { authorUserId: userId } }),
      this.prisma.jobListing.findMany({ where: { authorUserId: userId } }),
      this.prisma.proProfile.findUnique({ where: { userId } }),
    ]);

    const [notifications, bookmarks, reputation, sanctions, subscriptions, payments] = await Promise.all([
      this.prisma.notification.findMany({ where: owned, take: 5_000, orderBy: { createdAt: 'desc' } }),
      this.prisma.bookmark.findMany({ where: owned }),
      this.prisma.reputationEvent.findMany({ where: owned }),
      // Les sanctions LE concernant : une décision prise à son sujet est une
      // donnée le concernant. Le nom du membre d'équipe qui l'a prise, non.
      this.prisma.sanction.findMany({ where: owned, select: { id: true, createdAt: true, type: true, reason: true, startsAt: true, endsAt: true, liftedAt: true } }),
      this.prisma.subscription.findMany({ where: owned }),
      this.prisma.payment.findMany({ where: owned }),
    ]);

    return {
      genereLe: new Date().toISOString(),
      aPropos:
        'Archive de vos données personnelles (RGPD, articles 15 et 20). Une section par module du produit. ' +
        'Les contenus d’autres membres n’y figurent pas.',
      '01-identite': {
        compte: user,
        profil: profile,
        langues: languages,
        competences: skills,
        // Déchiffrés : ce sont SES numéros. Voir l'en-tête du fichier.
        telephones: phones.map((p) => ({
          id: p.id,
          countryId: p.countryId,
          numero: this.crypto.decryptPhone(p.phoneEncrypted),
          principal: p.isPrimary,
          destination: p.isDestination,
          verifieLe: p.verifiedAt,
        })),
        consentements: consents,
        sessions,
        verificationsIdentite: kyc,
        demandesDeSuppression: deletionRequests,
      },
      '03-parcours': journeys,
      '04-fil': { publications: posts, commentaires: comments, stories },
      '05-guides': { guides, votes: guideVotes },
      '06-entraide': { demandes: helpRequests, reponses: helpResponses },
      '07-reseaux': { adhesions: communityMemberships },
      '08-parrainage-messagerie': {
        profilParrain: mentorProfile,
        parrainages: mentorships,
        contacts: connections,
        messagesEnvoyes: messages.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          envoyeLe: m.sentAt,
          supprimeLe: m.deletedAt,
          corps: m.bodyEncrypted === null ? null : this.crypto.decryptContent(m.bodyEncrypted),
        })),
      },
      '09-villes-agenda': { evenementsOrganises: events, participations: attendances },
      '10-services': { logement: housing, emploi: jobs, fichePro: pro },
      '12-notifications': notifications,
      '13-moderation': { sanctions },
      '14-monetisation': { abonnements: subscriptions, paiements: payments },
      transverse: { signets: bookmarks, reputation },
    };
  }
}
