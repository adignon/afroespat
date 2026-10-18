import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

/**
 * Les EFFETS de la modération sur les contenus — 13 §6 et §10.
 *
 * ── POURQUOI CE SERVICE EXISTE (lot G) ──────────────────────────────────────
 *
 * Le pipeline émet `moderation.content_hidden`, `…_restored` et `…_removed` pour
 * treize types de sujet, et la règle de ce module est de n'écrire dans AUCUNE
 * table de contenu : chaque module s'abonne et applique l'effet chez lui. Seul
 * le fil l'avait fait. Un guide, une annonce de logement, une offre d'emploi, une
 * fiche pro, une astuce de ville ou un sujet de réseau « masqués » par l'équipe,
 * ou par l'analyse IA (priorité 1), restaient visibles : le dossier se fermait
 * sur un contenu que tout le monde continuait de lire. C'était la lacune.
 *
 * Plutôt que six abonnements éparpillés dans six services (dont la moitié ne
 * connaissent pas l'événement), les effets sont réunis ICI, en un seul tableau
 * lisible. L'écriture reste de la forme que chaque module reconnaît déjà comme
 * « masqué » — son propre champ de statut, jamais une colonne inventée.
 *
 * ── L'ÉTAT D'AVANT (`moderation_hides`) ─────────────────────────────────────
 *
 * Masquer note l'état à remettre ; rétablir le remet, et NE FAIT RIEN s'il n'y a
 * pas de note. Sans cela, `DISMISS` — qui émet lui aussi `content_restored` —
 * ressusciterait un contenu que son auteur avait supprimé lui-même, et un
 * rétablissement lèverait un blocage posé par une autre règle (le risque d'une
 * annonce de logement, par exemple).
 *
 * ── CE QUI N'EST PAS ICI ────────────────────────────────────────────────────
 *
 *   · `POST`, `STORY`, `COMMENT` : leur MASQUAGE appartient au fil
 *     (`FeedService.handleContentHidden`, déjà abonné et testé). Leur
 *     rétablissement et leur retrait, eux, sont ici — le fil n'avait pas de
 *     consommateur pour ces deux événements.
 *   · `HELP_RESPONSE`, `EVENT`, `MESSAGE`, `USER`, `COMMUNITY` : pas de champ de
 *     masquage dans leur table (schéma figé), ou un autre mécanisme (sanction).
 *     Ils sont ignorés SANS lever — lever ferait rejouer dix fois un travail qui
 *     n'est pas le nôtre.
 */

export type ModerationEffect = 'hidden' | 'restored' | 'removed';

/** Les types de sujet portés par la table `moderation_hides`. */
type HideSubject = 'GUIDE' | 'HOUSING' | 'JOB' | 'PRO' | 'CITY_TIP' | 'TOPIC' | 'HELP_REQUEST';

const HIDE_SUBJECTS: readonly string[] = [
  'GUIDE',
  'HOUSING',
  'JOB',
  'PRO',
  'CITY_TIP',
  'TOPIC',
  'HELP_REQUEST',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ModerationEffectsService {
  private readonly logger = new Logger(ModerationEffectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Le point d'entrée des trois abonnements. Idempotent. */
  async apply(effect: ModerationEffect, payload: unknown): Promise<{ changed: number }> {
    const subject = readSubject(payload);
    if (subject === null) {
      this.logger.warn(`moderation.content_${effect} : charge utile illisible, ignorée`);
      return { changed: 0 };
    }
    const { subjectType, subjectId } = subject;

    if (subjectType === 'POST' || subjectType === 'STORY' || subjectType === 'COMMENT') {
      // Le masquage est au fil ; ici, le rétablissement et le retrait.
      if (effect === 'hidden') return { changed: 0 };
      return { changed: await this.applyFeed(effect, subjectType, subjectId) };
    }
    if (!HIDE_SUBJECTS.includes(subjectType)) return { changed: 0 };
    return { changed: await this.applyTracked(effect, subjectType as HideSubject, subjectId, subject.caseId) };
  }

  // ── Fil : rétablir et retirer ─────────────────────────────────────────────

  private async applyFeed(
    effect: 'restored' | 'removed',
    subjectType: 'POST' | 'STORY' | 'COMMENT',
    id: string,
  ): Promise<number> {
    if (subjectType === 'POST') {
      const r = await this.prisma.post.updateMany({
        // Rétablir ne touche qu'un contenu MASQUÉ : un `REMOVED` est définitif et
        // un `PUBLISHED` n'a rien à retrouver.
        where: effect === 'restored' ? { id, status: 'HIDDEN' } : { id, status: { not: 'REMOVED' } },
        data:
          effect === 'restored'
            ? { status: 'PUBLISHED', moderationStatus: 'CLEARED' }
            : { status: 'REMOVED', moderationStatus: 'FLAGGED' },
      });
      return r.count;
    }
    if (subjectType === 'STORY') {
      const r = await this.prisma.story.updateMany({
        where: effect === 'restored' ? { id, status: 'HIDDEN' } : { id, status: { not: 'REMOVED' } },
        data:
          effect === 'restored'
            ? { status: 'ACTIVE', moderationStatus: 'CLEARED' }
            : { status: 'REMOVED', moderationStatus: 'FLAGGED' },
      });
      return r.count;
    }
    const r = await this.prisma.comment.updateMany({
      where: effect === 'restored' ? { id, status: 'HIDDEN' } : { id, status: { not: 'REMOVED' } },
      data: { status: effect === 'restored' ? 'PUBLISHED' : 'REMOVED' },
    });
    return r.count;
  }

  // ── Les autres modules : masquer, rétablir, retirer ───────────────────────

  private async applyTracked(
    effect: ModerationEffect,
    subjectType: HideSubject,
    id: string,
    caseId: string | null,
  ): Promise<number> {
    const key = { subjectType_subjectId: { subjectType, subjectId: id } } as const;

    if (effect === 'restored') {
      const note = await this.prisma.moderationHide.findUnique({ where: key });
      // Aucune note : ce n'est pas la modération qui a masqué ce contenu.
      if (note === null) return 0;
      const changed = await this.write(subjectType, id, 'restore', note.priorState);
      await this.prisma.moderationHide.deleteMany({ where: { subjectType, subjectId: id } });
      return changed;
    }

    if (effect === 'removed') {
      const changed = await this.write(subjectType, id, 'remove', null);
      await this.prisma.moderationHide.deleteMany({ where: { subjectType, subjectId: id } });
      return changed;
    }

    // hidden : noter l'état d'avant, une seule fois (un rejeu garde la première
    // note — la seconde lirait l'état DÉJÀ masqué et le rétablissement
    // « rétablirait » un contenu masqué).
    const prior = await this.readState(subjectType, id);
    if (prior === null) return 0;
    const existing = await this.prisma.moderationHide.findUnique({ where: key });
    if (existing === null) {
      await this.prisma.moderationHide.create({
        data: { subjectType, subjectId: id, priorState: prior, caseId },
      });
    }
    return this.write(subjectType, id, 'hide', null);
  }

  /** L'état visible actuel, tel que `write(..., 'restore', état)` saura le remettre. */
  private async readState(subjectType: HideSubject, id: string): Promise<string | null> {
    switch (subjectType) {
      case 'GUIDE': {
        const r = await this.prisma.guide.findUnique({ where: { id }, select: { status: true } });
        // Un brouillon ou un guide déjà dépublié n'a rien à masquer.
        return r !== null && (r.status === 'PUBLISHED' || r.status === 'FLAGGED') ? r.status : null;
      }
      case 'HOUSING': {
        const r = await this.prisma.housingListing.findUnique({
          where: { id },
          select: { moderationStatus: true, status: true },
        });
        return r !== null && r.status !== 'REMOVED' ? r.moderationStatus : null;
      }
      case 'JOB': {
        const r = await this.prisma.jobListing.findUnique({ where: { id }, select: { status: true } });
        return r !== null && r.status !== 'REMOVED' ? r.status : null;
      }
      case 'PRO': {
        const r = await this.prisma.proProfile.findUnique({ where: { id }, select: { status: true } });
        return r !== null && r.status !== 'REMOVED' ? r.status : null;
      }
      case 'CITY_TIP': {
        const r = await this.prisma.cityTip.findUnique({ where: { id }, select: { status: true } });
        return r !== null && r.status === 'PUBLISHED' ? r.status : null;
      }
      case 'TOPIC': {
        const r = await this.prisma.topic.findUnique({ where: { id }, select: { deletedAt: true } });
        return r !== null && r.deletedAt === null ? 'VISIBLE' : null;
      }
      case 'HELP_REQUEST': {
        const r = await this.prisma.helpRequest.findUnique({
          where: { id },
          select: { moderationStatus: true, deletedAt: true },
        });
        return r !== null && r.deletedAt === null ? r.moderationStatus : null;
      }
    }
  }

  private async write(
    subjectType: HideSubject,
    id: string,
    action: 'hide' | 'restore' | 'remove',
    prior: string | null,
  ): Promise<number> {
    const now = new Date();
    switch (subjectType) {
      case 'GUIDE': {
        if (action === 'hide') {
          return (
            await this.prisma.guide.updateMany({
              where: { id, status: { in: ['PUBLISHED', 'FLAGGED'] } },
              data: { status: 'UNPUBLISHED' },
            })
          ).count;
        }
        if (action === 'restore') {
          return (
            await this.prisma.guide.updateMany({
              where: { id, status: 'UNPUBLISHED' },
              data: { status: prior === 'FLAGGED' ? 'FLAGGED' : 'PUBLISHED' },
            })
          ).count;
        }
        return (
          await this.prisma.guide.updateMany({
            where: { id, status: { not: 'ARCHIVED' } },
            data: { status: 'ARCHIVED' },
          })
        ).count;
      }
      case 'HOUSING': {
        // Masquer = « en vérification » : les lectures écartent déjà `PENDING`
        // pour les autres membres, et l'auteur voit `UNDER_REVIEW`.
        if (action === 'hide') {
          return (
            await this.prisma.housingListing.updateMany({
              where: { id, status: { not: 'REMOVED' } },
              data: { moderationStatus: 'PENDING' },
            })
          ).count;
        }
        if (action === 'restore') {
          return (
            await this.prisma.housingListing.updateMany({
              where: { id, moderationStatus: 'PENDING' },
              data: { moderationStatus: prior === 'PENDING' ? 'PENDING' : 'CLEARED' },
            })
          ).count;
        }
        return (
          await this.prisma.housingListing.updateMany({
            where: { id, status: { not: 'REMOVED' } },
            data: { status: 'REMOVED', deletedAt: now },
          })
        ).count;
      }
      case 'JOB': {
        if (action === 'restore') {
          return (
            await this.prisma.jobListing.updateMany({
              where: { id, status: 'REMOVED' },
              data: { status: prior === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE', deletedAt: null },
            })
          ).count;
        }
        return (
          await this.prisma.jobListing.updateMany({
            where: { id, status: { not: 'REMOVED' } },
            data: { status: 'REMOVED', deletedAt: now },
          })
        ).count;
      }
      case 'PRO': {
        if (action === 'restore') {
          return (
            await this.prisma.proProfile.updateMany({
              where: { id, status: 'REMOVED' },
              data: { status: prior === 'PAUSED' ? 'PAUSED' : 'ACTIVE' },
            })
          ).count;
        }
        return (
          await this.prisma.proProfile.updateMany({
            where: { id, status: { not: 'REMOVED' } },
            data: { status: 'REMOVED' },
          })
        ).count;
      }
      case 'CITY_TIP': {
        if (action === 'restore') {
          return (
            await this.prisma.cityTip.updateMany({
              where: { id, status: 'HIDDEN' },
              data: { status: 'PUBLISHED' },
            })
          ).count;
        }
        return (
          await this.prisma.cityTip.updateMany({
            where: { id, status: { not: 'REMOVED' } },
            data: { status: action === 'hide' ? 'HIDDEN' : 'REMOVED' },
          })
        ).count;
      }
      case 'TOPIC': {
        if (action === 'restore') {
          return (
            await this.prisma.topic.updateMany({
              where: { id, deletedAt: { not: null } },
              data: { deletedAt: null },
            })
          ).count;
        }
        return (
          await this.prisma.topic.updateMany({
            where: { id, deletedAt: null },
            data: { deletedAt: now },
          })
        ).count;
      }
      case 'HELP_REQUEST': {
        if (action === 'restore') {
          return (
            await this.prisma.helpRequest.updateMany({
              where: { id, moderationStatus: 'FLAGGED' },
              data: { moderationStatus: prior === 'PENDING' ? 'PENDING' : 'CLEARED' },
            })
          ).count;
        }
        if (action === 'hide') {
          return (
            await this.prisma.helpRequest.updateMany({
              where: { id, deletedAt: null },
              data: { moderationStatus: 'FLAGGED' },
            })
          ).count;
        }
        return (
          await this.prisma.helpRequest.updateMany({
            where: { id, deletedAt: null },
            data: { moderationStatus: 'FLAGGED', deletedAt: now },
          })
        ).count;
      }
    }
  }
}

function readSubject(
  payload: unknown,
): { subjectType: string; subjectId: string; caseId: string | null } | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const subjectType = record['subjectType'];
  const subjectId = record['subjectId'];
  if (typeof subjectType !== 'string' || typeof subjectId !== 'string') return null;
  if (!UUID.test(subjectId)) return null;
  const caseId = typeof record['caseId'] === 'string' && UUID.test(record['caseId']) ? record['caseId'] : null;
  return { subjectType, subjectId, caseId };
}
