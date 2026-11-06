import { Injectable } from '@nestjs/common';
import type { Prisma, SearchSubjectType } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS as ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  type AdminContentAction,
  type AdminContentActionResult,
  type AdminContentQuery,
  type AdminContentRow,
  type AdminContentType,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { loadEnv } from '../../config/env';
import { gestionEtendue, lireEtendu, nettoyerLiens, type Brut, type Gestion } from './admin-contents-types';

/** Un contenu tel que la liste le lit, avant d'y joindre l'auteur et la ville. */
const SUJET_DE_RECHERCHE: Partial<Record<AdminContentType, SearchSubjectType>> = {
  GUIDE: 'GUIDE',
  EVENT: 'EVENT',
  HELP_REQUEST: 'HELP_REQUEST',
  HOUSING: 'HOUSING',
  JOB: 'JOB',
  PRO: 'PRO',
};

class ApercuSuppression extends Error {
  constructor() {
    super('aperçu de suppression : transaction annulée');
  }
}

const contient = (q: string) => ({ contains: q, mode: 'insensitive' as const });

/**
 * La GESTION DES CONTENUS des membres par l'administration, hors dossier de modération (15 §4).
 *
 * Trois gestes, tous tracés au journal d'audit avec un motif :
 *   · RETIRER   — logique : `deleted_at` est renseigné, l'application ne montre plus le contenu, la ligne reste.
 *                 Réversible (RÉTABLIR). Un réseau n'a pas de retrait : il se supprime ou il reste.
 *   · RÉTABLIR  — vide `deleted_at`. L'index de recherche se reconstruit par la réindexation de l'administration.
 *   · SUPPRIMER — définitif, périmètre `erase` (SUPER_ADMIN), confirmé par le NOMBRE d'éléments.
 *
 * `dryRun` ne change rien : il dit combien d'éléments seraient touchés.
 */
@Injectable()
export class AdminContentsService {
  private readonly cursorSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.cursorSecret = loadEnv().CURSOR_SECRET;
  }

  // ── La liste ───────────────────────────────────────────────────────────────

  async list(query: AdminContentQuery) {
    const scope = [
      'admin:contents',
      query.type,
      query.q ?? '',
      query.origin ?? '',
      query.state,
      query.createdFrom ?? '',
      query.createdTo ?? '',
    ].join(':');

    const jour = 86_400_000;
    const depuis = query.createdFrom === undefined ? undefined : new Date(`${query.createdFrom}T00:00:00.000Z`);
    const avant =
      query.createdTo === undefined ? undefined : new Date(Date.parse(`${query.createdTo}T00:00:00.000Z`) + jour);
    const commun = {
      ...(query.cursor === undefined ? {} : { id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id } }),
      ...(depuis === undefined && avant === undefined
        ? {}
        : { createdAt: { ...(depuis === undefined ? {} : { gte: depuis }), ...(avant === undefined ? {} : { lt: avant }) } }),
    };
    const etat =
      query.state === 'active' ? { deletedAt: null } : query.state === 'removed' ? { deletedAt: { not: null } } : {};
    const q = query.q;
    const origin = query.origin;
    const take = query.limit + 1;
    const orderBy = { id: 'desc' as const };

    const brut = await this.lire(query.type, { commun, etat, q, origin, take, orderBy, state: query.state });

    const ids = <T>(f: (b: Brut) => T | null): T[] => [...new Set(brut.map(f).filter((x): x is T => x !== null))];
    const auteurs = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: ids((b) => b.authorUserId) } },
          select: { id: true, handle: true, origin: true },
        })
      ).map((u) => [u.id, u]),
    );
    const villes = new Map(
      (await this.prisma.city.findMany({ where: { id: { in: ids((b) => b.cityId) } }, select: { id: true, name: true } })).map(
        (c) => [c.id, c.name],
      ),
    );

    const rows: AdminContentRow[] = brut.map((b) => {
      const auteur = b.authorUserId === null ? undefined : auteurs.get(b.authorUserId);
      return {
        id: b.id,
        type: query.type,
        title: b.title,
        authorHandle: auteur?.handle ?? null,
        authorOrigin: auteur?.origin ?? null,
        cityName: b.cityId === null ? null : (villes.get(b.cityId) ?? null),
        createdAt: b.createdAt.toISOString(),
        removed: b.removed,
      };
    });
    return buildPage(rows, query.limit, scope, this.cursorSecret);
  }

  private async lire(
    type: AdminContentType,
    f: {
      readonly commun: Record<string, unknown>;
      readonly etat: Record<string, unknown>;
      readonly q: string | undefined;
      readonly origin: 'MEMBER' | 'SEED' | undefined;
      readonly take: number;
      readonly orderBy: { readonly id: 'desc' };
      readonly state: 'active' | 'removed' | 'all';
    },
  ): Promise<Brut[]> {
    const { commun, etat, q, origin, take, orderBy } = f;
    const texte = (champ: string) => (q === undefined ? {} : { [champ]: contient(q) });
    const deAuteur = (relation: string) => (origin === undefined ? {} : { [relation]: { is: { origin } } });
    const tronque = (t: string) => (t.length > 90 ? `${t.slice(0, 90)}…` : t);

    switch (type) {
      case 'GUIDE': {
        const r = await this.prisma.guide.findMany({
          where: { ...commun, ...etat, ...texte('title'), ...deAuteur('author') },
          orderBy,
          take,
          select: { id: true, title: true, authorUserId: true, cityId: true, createdAt: true, deletedAt: true },
        });
        return r.map((x) => ({ ...x, removed: x.deletedAt !== null }));
      }
      case 'EVENT': {
        const r = await this.prisma.event.findMany({
          where: { ...commun, ...etat, ...texte('title'), ...deAuteur('organizer') },
          orderBy,
          take,
          select: { id: true, title: true, organizerUserId: true, cityId: true, createdAt: true, deletedAt: true },
        });
        return r.map((x) => ({
          id: x.id,
          title: x.title,
          authorUserId: x.organizerUserId,
          cityId: x.cityId,
          createdAt: x.createdAt,
          removed: x.deletedAt !== null,
        }));
      }
      case 'POST': {
        const r = await this.prisma.post.findMany({
          where: { ...commun, ...etat, ...texte('body'), ...deAuteur('author') },
          orderBy,
          take,
          select: { id: true, body: true, authorUserId: true, cityId: true, createdAt: true, deletedAt: true },
        });
        return r.map((x) => ({
          id: x.id,
          title: tronque(x.body),
          authorUserId: x.authorUserId,
          cityId: x.cityId,
          createdAt: x.createdAt,
          removed: x.deletedAt !== null,
        }));
      }
      case 'HELP_REQUEST': {
        const r = await this.prisma.helpRequest.findMany({
          where: { ...commun, ...etat, ...texte('title'), ...deAuteur('author') },
          orderBy,
          take,
          select: { id: true, title: true, authorUserId: true, cityId: true, createdAt: true, deletedAt: true },
        });
        return r.map((x) => ({ ...x, removed: x.deletedAt !== null }));
      }
      case 'HOUSING': {
        const r = await this.prisma.housingListing.findMany({
          where: { ...commun, ...etat, ...texte('title'), ...deAuteur('author') },
          orderBy,
          take,
          select: { id: true, title: true, authorUserId: true, cityId: true, createdAt: true, deletedAt: true },
        });
        return r.map((x) => ({ ...x, removed: x.deletedAt !== null }));
      }
      case 'JOB': {
        const r = await this.prisma.jobListing.findMany({
          where: { ...commun, ...etat, ...texte('title'), ...deAuteur('author') },
          orderBy,
          take,
          select: { id: true, title: true, authorUserId: true, cityId: true, createdAt: true, deletedAt: true },
        });
        return r.map((x) => ({ ...x, removed: x.deletedAt !== null }));
      }
      case 'PRO': {
        const r = await this.prisma.proProfile.findMany({
          where: { ...commun, ...etat, ...texte('businessName'), ...deAuteur('user') },
          orderBy,
          take,
          select: { id: true, businessName: true, userId: true, createdAt: true, deletedAt: true },
        });
        return r.map((x) => ({
          id: x.id,
          title: x.businessName ?? 'Fiche professionnelle',
          authorUserId: x.userId,
          cityId: null,
          createdAt: x.createdAt,
          removed: x.deletedAt !== null,
        }));
      }
      case 'COMMUNITY': {
        // Un réseau n'a pas de `deleted_at` : « retiré » veut dire archivé.
        const archive =
          f.state === 'active' ? { archivedAt: null } : f.state === 'removed' ? { archivedAt: { not: null } } : {};
        const r = await this.prisma.community.findMany({
          where: { ...commun, ...archive, ...texte('name'), ...deAuteur('createdBy') },
          orderBy,
          take,
          select: { id: true, name: true, createdByUserId: true, cityId: true, createdAt: true, archivedAt: true },
        });
        return r.map((x) => ({
          id: x.id,
          title: x.name,
          authorUserId: x.createdByUserId,
          cityId: x.cityId,
          createdAt: x.createdAt,
          removed: x.archivedAt !== null,
        }));
      }
      default:
        return lireEtendu(this.prisma, type, f);
    }
  }

  // ── Les gestes ─────────────────────────────────────────────────────────────

  retirer(staff: StaffUser, input: AdminContentAction): Promise<AdminContentActionResult> {
    return this.executer(staff, input, 'retirer');
  }

  retablir(staff: StaffUser, input: AdminContentAction): Promise<AdminContentActionResult> {
    return this.executer(staff, input, 'retablir');
  }

  supprimer(staff: StaffUser, input: AdminContentAction): Promise<AdminContentActionResult> {
    return this.executer(staff, input, 'supprimer');
  }

  private gestion(db: Prisma.TransactionClient, type: AdminContentType): Gestion {
    const sujet = SUJET_DE_RECHERCHE[type];
    // Retirer ou supprimer sort le contenu de l'index ; rien d'autre ne le fait pour nous.
    const desindexer = async (ids: string[]) => {
      if (sujet !== undefined) await db.searchDocument.deleteMany({ where: { subjectType: sujet, subjectId: { in: ids } } });
    };
    const ceux = (l: readonly { id: string }[]) => l.map((x) => x.id);
    switch (type) {
      case 'GUIDE':
        return {
          existants: async (ids) => ceux(await db.guide.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          retirer: async (ids, now) => {
            await db.guide.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
            await desindexer(ids);
          },
          retablir: async (ids) => {
            await db.guide.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
          },
          supprimer: async (ids) => {
            await desindexer(ids);
            await db.guide.deleteMany({ where: { id: { in: ids } } });
          },
        };
      case 'EVENT':
        return {
          existants: async (ids) => ceux(await db.event.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          retirer: async (ids, now) => {
            await db.event.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
            await desindexer(ids);
          },
          retablir: async (ids) => {
            await db.event.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
          },
          supprimer: async (ids) => {
            await desindexer(ids);
            await db.event.deleteMany({ where: { id: { in: ids } } });
          },
        };
      case 'POST':
        return {
          existants: async (ids) => ceux(await db.post.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          retirer: async (ids, now) => {
            await db.post.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
          },
          retablir: async (ids) => {
            await db.post.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
          },
          supprimer: async (ids) => {
            await db.post.deleteMany({ where: { id: { in: ids } } });
          },
        };
      case 'HELP_REQUEST':
        return {
          existants: async (ids) => ceux(await db.helpRequest.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          retirer: async (ids, now) => {
            await db.helpRequest.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
            await desindexer(ids);
          },
          retablir: async (ids) => {
            await db.helpRequest.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
          },
          supprimer: async (ids) => {
            await desindexer(ids);
            await db.helpRequest.deleteMany({ where: { id: { in: ids } } });
          },
        };
      case 'HOUSING':
        return {
          existants: async (ids) => ceux(await db.housingListing.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          retirer: async (ids, now) => {
            await db.housingListing.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
            await desindexer(ids);
          },
          retablir: async (ids) => {
            await db.housingListing.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
          },
          supprimer: async (ids) => {
            await desindexer(ids);
            await db.housingListing.deleteMany({ where: { id: { in: ids } } });
          },
        };
      case 'JOB':
        return {
          existants: async (ids) => ceux(await db.jobListing.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          retirer: async (ids, now) => {
            await db.jobListing.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
            await desindexer(ids);
          },
          retablir: async (ids) => {
            await db.jobListing.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
          },
          supprimer: async (ids) => {
            await desindexer(ids);
            await db.jobListing.deleteMany({ where: { id: { in: ids } } });
          },
        };
      case 'PRO':
        return {
          existants: async (ids) => ceux(await db.proProfile.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          retirer: async (ids, now) => {
            await db.proProfile.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } });
            await desindexer(ids);
          },
          retablir: async (ids) => {
            await db.proProfile.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } });
          },
          supprimer: async (ids) => {
            await desindexer(ids);
            await db.proProfile.deleteMany({ where: { id: { in: ids } } });
          },
        };
      case 'COMMUNITY':
        return {
          existants: async (ids) => ceux(await db.community.findMany({ where: { id: { in: ids } }, select: { id: true } })),
          // Pas de retrait : un réseau se supprime ou il reste.
          supprimer: async (ids) => {
            const sujets = await db.topic.findMany({ where: { communityId: { in: ids } }, select: { id: true } });
            await db.searchDocument.deleteMany({ where: { subjectType: 'TOPIC', subjectId: { in: ceux(sujets) } } });
            // Leurs conversations (contacter l'équipe d'un réseau) survivraient sans réseau : `SetNull`.
            await db.conversation.deleteMany({ where: { communityId: { in: ids } } });
            await db.community.deleteMany({ where: { id: { in: ids } } });
          },
        };
      default:
        return gestionEtendue(db, type);
    }
  }

  private async executer(
    staff: StaffUser,
    input: AdminContentAction,
    geste: 'retirer' | 'retablir' | 'supprimer',
  ): Promise<AdminContentActionResult> {
    const dryRun = input.dryRun === true;
    // Les doublons ne comptent qu'une fois.
    const uniques = [...new Map(input.items.map((i) => [`${i.type}:${i.id}`, i])).values()];
    if (geste === 'supprimer' && !dryRun && input.confirmCount !== uniques.length) {
      throw new ApiError(
        'CONTENT_ERASE_COUNT',
        ADMIN_CONTENT_ERROR_MESSAGES.CONTENT_ERASE_COUNT,
        ADMIN_CONTENT_ERROR_CODES.CONTENT_ERASE_COUNT,
      );
    }

    const parType = new Map<AdminContentType, string[]>();
    for (const i of uniques) parType.set(i.type, [...(parType.get(i.type) ?? []), i.id]);

    const refused: AdminContentActionResult['refused'] = [];
    let done = 0;
    const now = new Date();

    const travail = async (tx: Prisma.TransactionClient) => {
      for (const [type, demandes] of parType) {
        const g = this.gestion(tx, type);
        const presents = new Set(await g.existants(demandes));
        for (const id of demandes) {
          if (!presents.has(id)) refused.push({ type, id, message: 'Ce contenu n’existe pas.' });
        }
        const ids = demandes.filter((id) => presents.has(id));
        if (ids.length === 0) continue;

        if (geste === 'retirer' && g.retirer === undefined) {
          for (const id of ids) {
            refused.push({ type, id, message: 'Ce type de contenu ne se retire pas : seule la suppression définitive est possible.' });
          }
          continue;
        }
        if (geste === 'retablir' && g.retablir === undefined) {
          for (const id of ids) refused.push({ type, id, message: 'Ce type de contenu ne se rétablit pas.' });
          continue;
        }
        // L'aperçu d'une suppression EXÉCUTE la suppression puis l'annule : seul moyen de dire, élément par élément,
        // lesquels seraient refusés (encore utilisés) — un simple décompte annoncerait des suppressions impossibles.
        if (!dryRun || geste === 'supprimer') {
          if (geste === 'retirer') await g.retirer?.(ids, now);
          else if (geste === 'retablir') await g.retablir?.(ids);
          else {
            await nettoyerLiens(tx, type, ids);
            const refuses = (await g.supprimer(ids)) ?? [];
            for (const r of refuses) refused.push({ type, id: r.id, message: r.message });
            done += ids.length - refuses.length;
            continue;
          }
        }
        done += ids.length;
      }
      if (!dryRun && done > 0) {
        await this.audit.record(tx, {
          actor: { type: 'STAFF', id: staff.staffId },
          action:
            geste === 'retirer' ? ACTIONS.contentRemoved : geste === 'retablir' ? ACTIONS.contentRestored : ACTIONS.contentErased,
          targetType: 'content',
          metadata: {
            reason: input.reason,
            count: done,
            types: Object.fromEntries([...parType].map(([t, ids]) => [t, ids.length])),
            ids: uniques.slice(0, 20).map((i) => `${i.type}:${i.id}`),
          },
          ...(staff.ip === null ? {} : { ip: staff.ip }),
        });
      }
    };

    // Un aperçu ne change rien : il lit seulement — sauf l'aperçu d'une suppression, exécuté puis annulé.
    if (dryRun && geste === 'supprimer') {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            await travail(tx);
            throw new ApercuSuppression();
          },
          { timeout: 60_000, maxWait: 10_000 },
        );
      } catch (erreur) {
        if (!(erreur instanceof ApercuSuppression)) throw erreur;
      }
    } else if (dryRun) {
      await this.prisma.$transaction(travail);
    } else {
      await this.prisma.$transaction(travail, { timeout: 60_000, maxWait: 10_000 });
    }
    return { dryRun, done, refused };
  }
}
