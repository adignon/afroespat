import type { Prisma } from '@app/db';
import type { AdminContentType } from '@app/shared';

/**
 * LES TYPES D'ÉLÉMENTS QUE `AdminContentsService` AJOUTE AUX HUIT PREMIERS (publications, guides, événements…) :
 *
 *   · des contenus de membres — stories, conseils de ville, parcours, conversations, dossiers de modération ;
 *   · des éléments de L'ÉQUIPE — alertes arnaques, langues, compétences, métiers, pays, villes, étapes et modèles de
 *     parcours, partenaires et placements.
 *
 * Pour les éléments de l'équipe, la suppression est RÉELLE mais REFUSÉE tant qu'ils servent : le refus dit combien de
 * références restent (et lesquelles), et la désactivation ou la fusion de leur écran dédié reste la voie normale.
 */

export interface Brut {
  readonly id: string;
  readonly title: string;
  readonly authorUserId: string | null;
  readonly cityId: string | null;
  readonly createdAt: Date;
  readonly removed: boolean;
}

export interface Refus {
  readonly id: string;
  readonly message: string;
}

export interface Gestion {
  existants(ids: string[]): Promise<string[]>;
  retirer?(ids: string[], now: Date): Promise<void>;
  retablir?(ids: string[]): Promise<void>;
  /** Rend les éléments REFUSÉS (encore utilisés) ; ce qui n'est pas refusé est supprimé. */
  supprimer(ids: string[]): Promise<readonly Refus[] | undefined | void>;
}

export interface FiltreListe {
  readonly commun: Record<string, unknown>;
  readonly etat: Record<string, unknown>;
  readonly q: string | undefined;
  readonly origin: 'MEMBER' | 'SEED' | undefined;
  readonly take: number;
  readonly orderBy: { readonly id: 'desc' };
  readonly state: 'active' | 'removed' | 'all';
}

type Db = Prisma.TransactionClient;

const contient = (q: string) => ({ contains: q, mode: 'insensitive' as const });
const tronque = (t: string) => (t.length > 90 ? `${t.slice(0, 90)}…` : t);
const ceux = (l: readonly { id: string }[]) => l.map((x) => x.id);

// ── Les références ──────────────────────────────────────────────────────────

/** Les tables (SQL) des éléments de référence dont la suppression passe par le comptage de références. */
const TABLES: Partial<Record<AdminContentType, string>> = {
  LANGUAGE: 'languages',
  SKILL: 'skills',
  PROFESSION: 'professions',
  COUNTRY: 'countries',
  CITY: 'cities',
  STEP_DEFINITION: 'step_definitions',
};

/**
 * Combien de lignes, PARTOUT dans la base, pointent vers cet élément par une clé étrangère — lu dans le catalogue de
 * Postgres (`pg_constraint`), donc exact et jamais en retard sur une table ajoutée. Rend le détail par table.
 *
 * `table` vient d'une liste fixe de ce fichier, jamais d'une saisie.
 */
export async function compterReferences(db: Db, table: string, id: string): Promise<Record<string, number>> {
  const liens = await db.$queryRawUnsafe<{ tbl: string; col: string }[]>(
    `select c.conrelid::regclass::text as tbl, a.attname as col
       from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.confrelid = $1::regclass`,
    table,
  );
  const detail: Record<string, number> = {};
  for (const { tbl, col } of liens) {
    const r = await db.$queryRawUnsafe<{ n: number }[]>(`select count(*)::int as n from ${tbl} where "${col}" = $1::uuid`, id);
    const n = r[0]?.n ?? 0;
    if (n > 0) detail[tbl.replace(/"/g, '')] = (detail[tbl.replace(/"/g, '')] ?? 0) + n;
  }
  return detail;
}

function messageDeRefus(detail: Readonly<Record<string, number>>): string {
  const total = Object.values(detail).reduce((s, n) => s + n, 0);
  const principaux = Object.entries(detail)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${n} dans « ${t} »`)
    .join(', ');
  return `Encore utilisé : ${total} référence${total > 1 ? 's' : ''} (${principaux}). Désactivez-le ou fusionnez-le depuis son écran, ou retirez d’abord ce qui l’utilise.`;
}

/** Supprime ce qui n'est référencé nulle part ; rend les refus (avec leur décompte) pour le reste. */
async function supprimerSiLibre(db: Db, type: AdminContentType, ids: string[], supprimer: (libres: string[]) => Promise<void>): Promise<Refus[]> {
  const table = TABLES[type];
  if (table === undefined) throw new Error(`Pas de table de référence pour ${type}`);
  const refus: Refus[] = [];
  const libres: string[] = [];
  for (const id of ids) {
    const detail = await compterReferences(db, table, id);
    if (Object.keys(detail).length === 0) libres.push(id);
    else refus.push({ id, message: messageDeRefus(detail) });
  }
  if (libres.length > 0) await supprimer(libres);
  return refus;
}

// ── Les liens polymorphes ───────────────────────────────────────────────────

const COMMENTAIRES: Partial<Record<AdminContentType, 'POST' | 'GUIDE' | 'EVENT'>> = { POST: 'POST', GUIDE: 'GUIDE', EVENT: 'EVENT' };
const FAVORIS: Partial<Record<AdminContentType, 'STORY' | 'GUIDE' | 'POST' | 'HELP_REQUEST' | 'EVENT' | 'HOUSING' | 'JOB' | 'PRO'>> = {
  STORY: 'STORY', GUIDE: 'GUIDE', POST: 'POST', HELP_REQUEST: 'HELP_REQUEST', EVENT: 'EVENT', HOUSING: 'HOUSING', JOB: 'JOB', PRO: 'PRO',
};
const SIGNALEMENTS: Partial<Record<AdminContentType, 'POST' | 'GUIDE' | 'EVENT' | 'HELP_REQUEST' | 'HOUSING' | 'JOB' | 'PRO' | 'STORY' | 'CITY_TIP' | 'COMMUNITY'>> = {
  POST: 'POST', GUIDE: 'GUIDE', EVENT: 'EVENT', HELP_REQUEST: 'HELP_REQUEST', HOUSING: 'HOUSING', JOB: 'JOB', PRO: 'PRO', STORY: 'STORY', CITY_TIP: 'CITY_TIP', COMMUNITY: 'COMMUNITY',
};

/**
 * Ce que la cascade ne voit pas, faute de clé étrangère : commentaires, favoris, signalements et dossiers de modération
 * qui désignent le contenu supprimé. Appelé AVANT toute suppression définitive, pour tous les types qui en portent.
 */
export async function nettoyerLiens(db: Db, type: AdminContentType, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const liste = [...ids];
  const commentaire = COMMENTAIRES[type];
  if (commentaire !== undefined) await db.comment.deleteMany({ where: { subjectType: commentaire, subjectId: { in: liste } } });
  const favori = FAVORIS[type];
  if (favori !== undefined) await db.bookmark.deleteMany({ where: { subjectType: favori, subjectId: { in: liste } } });
  const signalement = SIGNALEMENTS[type];
  if (signalement !== undefined) {
    await db.report.deleteMany({ where: { subjectType: signalement, subjectId: { in: liste } } });
    await db.moderationCase.deleteMany({ where: { subjectType: signalement, subjectId: { in: liste } } });
  }
}

// ── La lecture ──────────────────────────────────────────────────────────────

export async function lireEtendu(db: Db, type: AdminContentType, f: FiltreListe): Promise<Brut[]> {
  const { commun, etat, q, origin, take, orderBy } = f;
  const texte = (champ: string) => (q === undefined ? {} : { [champ]: contient(q) });
  const deAuteur = (relation: string) => (origin === undefined ? {} : { [relation]: { is: { origin } } });
  // Les éléments de l'équipe n'ont ni auteur membre ni état « retiré » : un filtre d'origine ou « retirés » ne leur
  // correspond à rien.
  const aucun = origin !== undefined || f.state === 'removed';

  switch (type) {
    case 'STORY': {
      const r = await db.story.findMany({
        where: { ...commun, ...etat, ...texte('body'), ...deAuteur('author') },
        orderBy, take,
        select: { id: true, body: true, authorUserId: true, cityId: true, createdAt: true, deletedAt: true },
      });
      return r.map((x) => ({ id: x.id, title: tronque(x.body), authorUserId: x.authorUserId, cityId: x.cityId, createdAt: x.createdAt, removed: x.deletedAt !== null }));
    }
    case 'CITY_TIP': {
      const r = await db.cityTip.findMany({
        where: { ...commun, ...etat, ...texte('body'), ...deAuteur('author') },
        orderBy, take,
        select: { id: true, body: true, authorUserId: true, cityId: true, createdAt: true, deletedAt: true },
      });
      return r.map((x) => ({ id: x.id, title: tronque(x.body), authorUserId: x.authorUserId, cityId: x.cityId, createdAt: x.createdAt, removed: x.deletedAt !== null }));
    }
    case 'JOURNEY': {
      const r = await db.journey.findMany({
        where: { ...commun, ...etat, ...texte('title'), ...deAuteur('owner') },
        orderBy, take,
        select: { id: true, title: true, ownerUserId: true, destinationCityId: true, createdAt: true, deletedAt: true },
      });
      return r.map((x) => ({ id: x.id, title: x.title, authorUserId: x.ownerUserId, cityId: x.destinationCityId, createdAt: x.createdAt, removed: x.deletedAt !== null }));
    }
    case 'CONVERSATION': {
      if (f.state === 'removed') return [];
      const r = await db.conversation.findMany({
        where: {
          ...commun,
          ...(q === undefined ? {} : { members: { some: { user: { is: { handle: contient(q) } } } } }),
          ...(origin === undefined ? {} : { members: { some: { user: { is: { origin } } } } }),
        },
        orderBy, take,
        select: { id: true, kind: true, openedByUserId: true, createdAt: true, members: { select: { user: { select: { handle: true } } } } },
      });
      return r.map((x) => ({
        id: x.id,
        title: `${x.kind} · ${x.members.map((m) => `@${m.user.handle}`).join(', ') || 'sans participant'}`,
        authorUserId: x.openedByUserId,
        cityId: null,
        createdAt: x.createdAt,
        removed: false,
      }));
    }
    case 'MODERATION_CASE': {
      if (f.state === 'removed') return [];
      const r = await db.moderationCase.findMany({
        where: { ...commun, ...deAuteur('subjectAuthor') },
        orderBy, take,
        select: { id: true, subjectType: true, status: true, priority: true, subjectAuthorUserId: true, createdAt: true },
      });
      return r.map((x) => ({ id: x.id, title: `${x.subjectType} · ${x.status} · priorité ${x.priority}`, authorUserId: x.subjectAuthorUserId, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'SCAM_ALERT': {
      if (aucun) return [];
      const r = await db.scamAlert.findMany({ where: { ...commun, ...texte('title') }, orderBy, take, select: { id: true, title: true, cityId: true, createdAt: true } });
      return r.map((x) => ({ ...x, authorUserId: null, removed: false }));
    }
    case 'LANGUAGE': {
      if (aucun) return [];
      const r = await db.language.findMany({ where: { ...commun, ...texte('nameFr') }, orderBy, take, select: { id: true, nameFr: true, code: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: `${x.nameFr} (${x.code})`, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'SKILL': {
      if (aucun) return [];
      const r = await db.skill.findMany({ where: { ...commun, ...texte('nameFr') }, orderBy, take, select: { id: true, nameFr: true, category: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: x.category === null ? x.nameFr : `${x.nameFr} · ${x.category}`, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'PROFESSION': {
      if (aucun) return [];
      const r = await db.profession.findMany({ where: { ...commun, ...texte('nameFr') }, orderBy, take, select: { id: true, nameFr: true, category: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: x.category === null ? x.nameFr : `${x.nameFr} · ${x.category}`, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'COUNTRY': {
      if (aucun) return [];
      const r = await db.country.findMany({ where: { ...commun, ...texte('nameFr') }, orderBy, take, select: { id: true, nameFr: true, iso2: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: `${x.nameFr} (${x.iso2})`, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'CITY': {
      if (aucun) return [];
      const r = await db.city.findMany({ where: { ...commun, ...texte('name') }, orderBy, take, select: { id: true, name: true, region: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: x.region === null ? x.name : `${x.name} · ${x.region}`, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'STEP_DEFINITION': {
      if (aucun) return [];
      const r = await db.stepDefinition.findMany({ where: { ...commun, ...texte('nameFr') }, orderBy, take, select: { id: true, nameFr: true, code: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: `${x.nameFr} (${x.code})`, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'JOURNEY_TEMPLATE': {
      if (aucun) return [];
      const r = await db.journeyTemplate.findMany({ where: { ...commun, ...texte('nameFr') }, orderBy, take, select: { id: true, nameFr: true, code: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: `${x.nameFr} (${x.code})`, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'PARTNER': {
      if (aucun) return [];
      const r = await db.partner.findMany({ where: { ...commun, ...texte('name') }, orderBy, take, select: { id: true, name: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: x.name, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    case 'PLACEMENT': {
      if (aucun) return [];
      const r = await db.partnerPlacement.findMany({ where: { ...commun, ...texte('headline') }, orderBy, take, select: { id: true, headline: true, createdAt: true } });
      return r.map((x) => ({ id: x.id, title: x.headline, authorUserId: null, cityId: null, createdAt: x.createdAt, removed: false }));
    }
    default:
      throw new Error(`Type non géré ici : ${type}`);
  }
}

// ── Les gestes ──────────────────────────────────────────────────────────────

export function gestionEtendue(db: Db, type: AdminContentType): Gestion {
  switch (type) {
    case 'STORY':
      return {
        existants: async (ids) => ceux(await db.story.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        retirer: async (ids, now) => void (await db.story.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } })),
        retablir: async (ids) => void (await db.story.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } })),
        supprimer: async (ids) => {
          await db.story.deleteMany({ where: { id: { in: ids } } });
          return undefined;
        },
      };
    case 'CITY_TIP':
      return {
        existants: async (ids) => ceux(await db.cityTip.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        retirer: async (ids, now) => void (await db.cityTip.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } })),
        retablir: async (ids) => void (await db.cityTip.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } })),
        supprimer: async (ids) => {
          await db.cityTip.deleteMany({ where: { id: { in: ids } } });
          return undefined;
        },
      };
    case 'JOURNEY':
      return {
        existants: async (ids) => ceux(await db.journey.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        retirer: async (ids, now) => void (await db.journey.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: now } })),
        retablir: async (ids) => void (await db.journey.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null } })),
        supprimer: async (ids) => {
          // Le fil de groupe d'un parcours lui survivrait (lien SetNull) : il part avec lui.
          await db.conversation.deleteMany({ where: { journeyId: { in: ids } } });
          await db.journey.deleteMany({ where: { id: { in: ids } } });
          return undefined;
        },
      };
    case 'CONVERSATION':
      return {
        existants: async (ids) => ceux(await db.conversation.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: async (ids) => {
          await db.conversation.deleteMany({ where: { id: { in: ids } } });
          return undefined;
        },
      };
    case 'MODERATION_CASE':
      return {
        existants: async (ids) => ceux(await db.moderationCase.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: async (ids) => {
          await db.report.deleteMany({ where: { caseId: { in: ids } } });
          await db.moderationCase.deleteMany({ where: { id: { in: ids } } });
          return undefined;
        },
      };
    case 'SCAM_ALERT':
      return {
        existants: async (ids) => ceux(await db.scamAlert.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: async (ids) => {
          await db.scamAlert.deleteMany({ where: { id: { in: ids } } });
          return undefined;
        },
      };
    case 'LANGUAGE':
      return {
        existants: async (ids) => ceux(await db.language.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: (ids) => supprimerSiLibre(db, type, ids, async (l) => void (await db.language.deleteMany({ where: { id: { in: l } } }))),
      };
    case 'SKILL':
      return {
        existants: async (ids) => ceux(await db.skill.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: (ids) => supprimerSiLibre(db, type, ids, async (l) => void (await db.skill.deleteMany({ where: { id: { in: l } } }))),
      };
    case 'PROFESSION':
      return {
        existants: async (ids) => ceux(await db.profession.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: (ids) => supprimerSiLibre(db, type, ids, async (l) => void (await db.profession.deleteMany({ where: { id: { in: l } } }))),
      };
    case 'COUNTRY':
      return {
        existants: async (ids) => ceux(await db.country.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: (ids) => supprimerSiLibre(db, type, ids, async (l) => void (await db.country.deleteMany({ where: { id: { in: l } } }))),
      };
    case 'CITY':
      return {
        existants: async (ids) => ceux(await db.city.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: (ids) => supprimerSiLibre(db, type, ids, async (l) => void (await db.city.deleteMany({ where: { id: { in: l } } }))),
      };
    case 'STEP_DEFINITION':
      return {
        existants: async (ids) => ceux(await db.stepDefinition.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: (ids) => supprimerSiLibre(db, type, ids, async (l) => void (await db.stepDefinition.deleteMany({ where: { id: { in: l } } }))),
      };
    case 'JOURNEY_TEMPLATE':
      return {
        existants: async (ids) => ceux(await db.journeyTemplate.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: async (ids) => {
          const refus: Refus[] = [];
          const libres: string[] = [];
          for (const id of ids) {
            // Un parcours de membre fige sa version (lien RESTRICT) : tant qu'un parcours s'en sert, le modèle reste.
            const parcours = await db.journey.count({ where: { OR: [{ templateVersion: { is: { templateId: id } } }, { migratedFromVersion: { is: { templateId: id } } }] } });
            if (parcours > 0) {
              refus.push({
                id,
                message: `Encore utilisé : ${parcours} parcours de membres reposent sur ce modèle. Archivez sa version depuis l’écran des modèles, ou supprimez d’abord ces parcours.`,
              });
            } else libres.push(id);
          }
          // Ses versions et leurs étapes partent avec lui (cascade).
          if (libres.length > 0) await db.journeyTemplate.deleteMany({ where: { id: { in: libres } } });
          return refus;
        },
      };
    case 'PARTNER':
      return {
        existants: async (ids) => ceux(await db.partner.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: async (ids) => {
          const refus: Refus[] = [];
          const libres: string[] = [];
          for (const id of ids) {
            const clics = await db.affiliateClick.count({ where: { placement: { is: { partnerId: id } } } });
            if (clics > 0) {
              refus.push({ id, message: `Encore utilisé : ${clics} clic${clics > 1 ? 's' : ''} d’affiliation sont rattachés à ce partenaire (historique de revenus). Désactivez-le plutôt.` });
            } else libres.push(id);
          }
          // Ses placements partent avec lui (cascade).
          if (libres.length > 0) await db.partner.deleteMany({ where: { id: { in: libres } } });
          return refus;
        },
      };
    case 'PLACEMENT':
      return {
        existants: async (ids) => ceux(await db.partnerPlacement.findMany({ where: { id: { in: ids } }, select: { id: true } })),
        supprimer: async (ids) => {
          const refus: Refus[] = [];
          const libres: string[] = [];
          for (const id of ids) {
            const clics = await db.affiliateClick.count({ where: { placementId: id } });
            if (clics > 0) refus.push({ id, message: `Encore utilisé : ${clics} clic${clics > 1 ? 's' : ''} d’affiliation sont rattachés à ce placement. Désactivez-le plutôt.` });
            else libres.push(id);
          }
          if (libres.length > 0) await db.partnerPlacement.deleteMany({ where: { id: { in: libres } } });
          return refus;
        },
      };
    default:
      throw new Error(`Type non géré ici : ${type}`);
  }
}
