import { Injectable } from '@nestjs/common';
import { type Prisma, newId } from '@app/db';
import type { ConsentType } from '@app/shared';
import { ApiError } from '../../common/api-error';
import { PrismaService } from '../../common/prisma.service';

/**
 * Consentements — 01-identite.md §2.10.
 *
 * La table est en AJOUT SEUL par construction : `consents` n'a ni `updated_at`
 * ni suppression. C'est ce qui en fait une preuve — un consentement retiré
 * s'enregistre comme une NOUVELLE ligne `granted: false`, et l'historique reste
 * lisible. Modifier la ligne existante détruirait la seule chose qu'on cherche à
 * conserver.
 *
 * Le consentement porte toujours une VERSION de document. Sans elle, on sait que
 * le membre a accepté quelque chose, mais pas quoi — et §2.10 prévoit justement
 * qu'« une nouvelle version des CGU redemande le consentement à la prochaine
 * connexion ».
 */

/** Le document que chaque type de consentement référence (§2.10). */
const CONSENT_DOCUMENTS: Partial<Record<ConsentType, string>> = {
  TERMS: 'cgu',
  PRIVACY: 'confidentialite',
};

/** Les deux recueillis à l'inscription, écran 1 (§5). */
export const SIGNUP_CONSENTS: readonly ConsentType[] = ['TERMS', 'PRIVACY'];

export interface ConsentState {
  readonly type: ConsentType;
  readonly granted: boolean;
  readonly version: string;
  readonly at: Date;
  /** Une version plus récente du document existe : à redemander (§2.10). */
  readonly outdated: boolean;
}

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** La version publiée d'un document, ou `null` s'il n'existe pas. */
  async publishedVersion(slug: string): Promise<string | null> {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug },
      select: { version: true, publishedAt: true },
    });
    if (page === null || page.publishedAt === null) return null;
    return page.version;
  }

  /**
   * L'état courant de chaque type.
   *
   * La DERNIÈRE ligne par type fait foi — d'où le tri décroissant et le premier
   * trouvé. Compter les lignes `granted: true` donnerait un consentement encore
   * accordé après son retrait.
   */
  async current(userId: string): Promise<ConsentState[]> {
    const rows = await this.prisma.consent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { type: true, granted: true, version: true, createdAt: true },
    });

    const latest = new Map<ConsentType, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latest.has(row.type)) latest.set(row.type, row);
    }

    const states: ConsentState[] = [];
    for (const [type, row] of latest) {
      const slug = CONSENT_DOCUMENTS[type];
      const published = slug === undefined ? null : await this.publishedVersion(slug);
      states.push({
        type,
        granted: row.granted,
        version: row.version,
        at: row.createdAt,
        // `outdated` seulement si le consentement a été ACCORDÉ sur une version
        // dépassée : un refus n'a pas à être redemandé à chaque publication.
        outdated: row.granted && published !== null && published !== row.version,
      });
    }
    return states;
  }

  /**
   * Ce qu'il reste à (re)demander : jamais donné, refusé, ou donné sur une
   * version périmée.
   *
   * §2.10 est explicite : redemander « sans bloquer la lecture ». Le front s'en
   * sert pour afficher une invitation, pas pour fermer l'application.
   */
  async outstanding(userId: string): Promise<ConsentType[]> {
    const states = await this.current(userId);
    const byType = new Map(states.map((s) => [s.type, s]));

    const pending: ConsentType[] = [];
    for (const type of SIGNUP_CONSENTS) {
      const state = byType.get(type);
      if (state === undefined || !state.granted || state.outdated) pending.push(type);
    }
    return pending;
  }

  /**
   * Enregistre un consentement. L'IP est la PREUVE (§5) : sans elle, la trace ne
   * vaut pas grand-chose devant une autorité.
   *
   * La version est vérifiée contre le document publié. Accepter celle que le
   * client annonce ferait enregistrer un consentement sur une version qui n'a
   * jamais existé — et une preuve fausse est pire qu'une preuve absente.
   */
  async record(
    writer: PrismaService | Prisma.TransactionClient,
    input: {
      userId: string;
      type: ConsentType;
      granted: boolean;
      version?: string;
      ip?: string | undefined;
    },
  ): Promise<void> {
    const slug = CONSENT_DOCUMENTS[input.type];
    let version = input.version ?? '0';

    if (slug !== undefined) {
      const published = await this.publishedVersion(slug);
      if (published === null) {
        // Aucun document publié : on refuse d'enregistrer une preuve qui ne
        // référence rien.
        throw ApiError.transverse('CONFLICT', { reason: 'DOCUMENT_NOT_PUBLISHED', slug });
      }
      if (input.version !== undefined && input.version !== published) {
        // Le client a affiché une autre version : il doit recharger, pas voir sa
        // valeur enregistrée telle quelle.
        throw ApiError.transverse('CONFLICT', {
          reason: 'DOCUMENT_VERSION_STALE',
          slug,
          expected: published,
        });
      }
      version = published;
    }

    await writer.consent.create({
      data: {
        id: newId(),
        userId: input.userId,
        type: input.type,
        version,
        granted: input.granted,
        ip: input.ip ?? null,
      },
    });
  }

  /** Les deux consentements de l'inscription, dans la transaction de création. */
  async recordSignupConsents(
    writer: PrismaService | Prisma.TransactionClient,
    userId: string,
    ip: string | undefined,
  ): Promise<void> {
    for (const type of SIGNUP_CONSENTS) {
      await this.record(writer, { userId, type, granted: true, ip });
    }
  }
}
