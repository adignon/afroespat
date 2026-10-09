import { Injectable, Logger } from '@nestjs/common';
import { newId } from '@app/db';
import type { BookmarkState, BookmarkSubjectType } from '@app/db';
import { PrismaService } from '../../common/prisma.service';

/**
 * L'état des contenus enregistrés — 01-identite.md §2.9, et la tâche horaire
 * `bookmark.state_refresh` de 00-fondations.md §9.3.
 *
 * §2.9 : « pour chaque ligne **l'état actuel du contenu** — story “expirée, gardée
 * pour vous”, demande “résolue”, événement “passé”, annonce “plus disponible”,
 * guide “mis à jour le …”, contenu “retiré” si supprimé par l'auteur ou la
 * modération. » Les six libellés sont ceux de T2 (`bookmark.state.*`), et l'enum
 * `BookmarkState` les reprend un pour un, plus `AVAILABLE` qui est l'ABSENCE de
 * pastille.
 *
 * ── POURQUOI UNE TÂCHE, ALORS QUE L'ÉTAT SE CALCULE À LA LECTURE ─────────────
 *
 * Parce que §2.9 promet aussi `GET /me/bookmarks/states` — « états en LOT » — et
 * que la catégorie `BOOKMARK` du module 12 §2.1 notifie les CHANGEMENTS d'état
 * (« demande enregistrée résolue », « annonce enregistrée modifiée ou expirée »).
 * Un état calculé à la lecture ne peut rien notifier : il n'a pas d'avant. Et
 * recalculé à chaque ouverture pour cinq cents signets de douze types, il ferait
 * douze requêtes par affichage de l'écran.
 *
 * ── LA PROPRIÉTÉ QUI COMPTE : ON REMPLACE, ON N'AJOUTE PAS ───────────────────
 *
 * L'état est une FONCTION du sujet, de l'instant, et de la date d'enregistrement :
 * `état(sujet, now, enregistréLe)`. La tâche l'évalue et l'écrit là où il diffère.
 * Elle ne cumule rien, ne compte rien, n'incrémente rien — c'est exactement ce que
 * le test d'idempotence de l'ordonnanceur traque (« un balayage qui recalcule une
 * valeur dérivée du temps écoulé et l'AJOUTE au lieu de la remplacer »), et c'est
 * pourquoi il n'y a pas un seul `increment` dans ce fichier.
 *
 * UN SEUL PASSAGE DÉCIDE, et c'est la raison de la forme `StateResolver` plus bas.
 * Une première version calculait les états « simples », puis repassait sur les
 * guides pour appliquer « mis à jour » : les deux passes se contredisaient sur la
 * même ligne, la première remettant `AVAILABLE` ce que la seconde venait de mettre à
 * `UPDATED`. Chaque exécution écrivait donc deux fois et l'état oscillait d'un
 * créneau à l'autre — une tâche parfaitement idempotente en apparence, qui ne
 * converge jamais. Un état, une décision, une écriture.
 *
 * `now` VIENT DU CRÉNEAU, et il est indispensable : deux des sept états en
 * dépendent (`PAST` pour un événement déjà tenu, `EXPIRED` pour une story). Une
 * tâche qui lirait `new Date()` serait inéprouvable à un instant choisi — et c'est
 * une tâche HORAIRE, donc celle dont l'instant bouge le plus souvent.
 *
 * ── CE QUI MANQUE ENCORE, ET IL FAUT LE DIRE ─────────────────────────────────
 *
 * §2.9 annonce quatre routes — `GET /me/bookmarks`, `PUT /me/bookmarks`,
 * `DELETE /me/bookmarks/:type/:id`, `GET /me/bookmarks/states`. AUCUNE n'est
 * livrée, et il n'existe donc aujourd'hui aucun chemin pour CRÉER un signet :
 * `bookmarks` ne se remplit par personne, et personne ne lit `bookmarks.state`. Les
 * seules lectures actuelles de la table sont internes — `story.purge_history`
 * épargne une story enregistrée (04 §7) et l'export RGPD la recopie (01 §2.8).
 *
 * Cette tâche est donc PRÊTE et sans lecteur, ce qui est l'exact symétrique du
 * défaut `cities.member_count` (une colonne lue par trois écrans et écrite par
 * personne). C'est signalé dans le rapport du lot, et c'est au propriétaire de
 * trancher : livrer §2.9, ou retirer la tâche de §9.3.
 */

/**
 * Ce qu'on sait d'un sujet, ramené à une décision.
 *
 * Une FONCTION et non une valeur, parce qu'un seul des douze types a besoin de la
 * date d'enregistrement du signet : un guide est « mis à jour » relativement au
 * moment où le membre l'a gardé, pas dans l'absolu. Les onze autres ignorent leur
 * paramètre, et c'est plus lisible qu'une union de deux formes.
 */
type StateResolver = (bookmarkedAt: Date) => BookmarkState;

/** La forme des onze types dont l'état ne dépend que du sujet. */
function fixed(state: BookmarkState): StateResolver {
  return () => state;
}

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  /**
   * Signets examinés par passage.
   *
   * Un `take` est obligatoire (`queue/scheduled-tasks.ts` : « une tâche qui balaie
   * une table entière sans `take` tiendra son verrou pendant tout le balayage »). Le
   * tri est le plus ANCIENNEMENT vérifié d'abord, si bien qu'un lot tronqué ne
   * laisse jamais le même signet de côté deux fois : c'est le seul ordre qui rende
   * la borne équitable, là où un `orderBy: { createdAt }` condamnerait la queue de
   * la table à ne jamais être vue.
   */
  private static readonly BATCH = 2_000;

  constructor(private readonly prisma: PrismaService) {}


  // ─── §2.9 · LES QUATRE ROUTES, ENFIN LIVRÉES ──────────────────────────────

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « FINALISE LES ROUTES BOOKMARKS ET BRANCHE-LES »                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, après avoir demandé si « la page des choses enregistrées » était
   * faite. Elle ne pouvait pas l'être : l'en-tête de ce fichier le disait
   * lui-même — « §2.9 annonce quatre routes […] AUCUNE n'est livrée », et
   * `task-registrations.service.ts` ajoutait que « rien ne crée de signet ».
   * La tâche horaire rafraîchissait donc les états d'une table que personne ne
   * pouvait remplir.
   *
   * ── LE TITRE ET LE SOUS-TITRE SONT COMPOSÉS ICI ─────────────────────────
   *
   * Un signet ne porte qu'un type et un identifiant. Pour écrire « Obtenir la
   * garantie Visale sans CDI · Mis à jour le 12 mars », il faut lire la table du
   * sujet — et il y en a douze. Le faire à l'écran demanderait douze appels par
   * page ; le faire ici en demande UN PAR TYPE PRÉSENT, comme le balayage de la
   * tâche.
   *
   * ── `href` EST `null` QUAND IL N'Y A PLUS RIEN À OUVRIR ────────────────
   *
   * C'est tout le sens de cette page : on garde ce qui disparaît. Une story
   * expirée reste dans la liste — « expirée, gardée pour vous » — mais elle ne
   * s'ouvre plus. Un lien mort dirait le contraire de ce que l'état annonce.
   */
  async list(
    userId: string,
    /**
     * `| undefined` EXPLICITE sur les deux prises facultatives :
     * `exactOptionalPropertyTypes` est actif, et il interdit alors de PASSER
     * `undefined` — seulement de l'omettre. Or Zod rend bien la clé, à
     * `undefined`, quand le paramètre d'URL manque.
     */
    query: {
      readonly subjectType?: BookmarkSubjectType | undefined;
      readonly limit: number;
      readonly cursor?: string | undefined;
    },
  ) {
    const ou = {
      userId,
      ...(query.subjectType === undefined ? {} : { subjectType: query.subjectType }),
    };

    const [lignes, total, groupes] = await Promise.all([
      this.prisma.bookmark.findMany({
        where: ou,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        select: {
          id: true,
          subjectType: true,
          subjectId: true,
          state: true,
          createdAt: true,
        },
      }),
      this.prisma.bookmark.count({ where: { userId } }),
      this.prisma.bookmark.groupBy({
        by: ['subjectType'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    const apercus = await this.apercus(lignes);
    const parType: Record<string, number> = {};
    for (const g of groupes) parType[g.subjectType] = g._count._all;

    return {
      items: lignes.map((b) => {
        const vu = apercus.get(`${b.subjectType}:${b.subjectId}`);
        return {
          id: b.id,
          subjectType: b.subjectType,
          subjectId: b.subjectId,
          state: b.state,
          createdAt: b.createdAt.toISOString(),
          /**
           * LE REPLI DIT CE QUI EST, et n'invente pas de titre : un sujet
           * introuvable a été supprimé, et l'état `REMOVED` le dit déjà.
           */
          title: vu?.titre ?? 'Contenu retiré',
          subtitle: vu?.sous ?? '',
          href: vu?.lien ?? null,
        };
      }),
      nextCursor: null,
      meta: { total, parType },
    };
  }

  /**
   * `PUT /me/bookmarks` — idempotent, et la table le garantit
   * (`@@unique([userId, subjectType, subjectId])`). Enregistrer deux fois le
   * même contenu ne crée pas deux lignes et ne vaut pas une erreur : le membre
   * voulait qu'il soit enregistré, il l'est.
   *
   * L'ÉTAT N'EST PAS CALCULÉ ICI. `AVAILABLE` par défaut, puis la tâche horaire
   * le corrige. Le calculer à l'écriture demanderait de lire la table du sujet
   * pour un geste qui doit être instantané — et un contenu qu'on vient
   * d'enregistrer est, par construction, celui qu'on vient de voir.
   */
  async put(userId: string, input: { subjectType: BookmarkSubjectType; subjectId: string }) {
    const ligne = await this.prisma.bookmark.upsert({
      where: {
        userId_subjectType_subjectId: {
          userId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
        },
      },
      update: {},
      create: { id: newId(), userId, ...input },
      select: { id: true, state: true },
    });
    return { id: ligne.id, state: ligne.state };
  }

  /**
   * `DELETE /me/bookmarks/:type/:id` — `deleteMany` et non `delete`.
   *
   * Retirer un signet qu'on n'a pas vaut succès : c'est l'état voulu. `delete`
   * jetterait sur une ligne absente, et l'écran afficherait une erreur pour un
   * geste qui a abouti — typiquement, deux clics rapides sur le même signet.
   */
  async remove(userId: string, subjectType: BookmarkSubjectType, subjectId: string) {
    await this.prisma.bookmark.deleteMany({ where: { userId, subjectType, subjectId } });
  }

  /**
   * `GET /me/bookmarks/states` — « états en LOT » (§2.9).
   *
   * Elle répond à une question d'écran : « parmi ces vingt publications
   * affichées, lesquelles ai-je enregistrées ? ». Une requête par carte serait
   * vingt allers-retours pour dessiner vingt signets.
   *
   * LES ABSENTS NE SONT PAS RENDUS. Un identifiant sans ligne n'est pas
   * enregistré ; l'écran le déduit de son absence, et rendre un état « pas
   * enregistré » demanderait une huitième valeur à `BookmarkState` pour dire le
   * contraire de ce que la table dit déjà.
   */
  async states(userId: string, subjectType: BookmarkSubjectType, ids: readonly string[]) {
    if (ids.length === 0) return { items: [] };
    const lignes = await this.prisma.bookmark.findMany({
      where: { userId, subjectType, subjectId: { in: [...ids] } },
      select: { subjectId: true, state: true },
    });
    return { items: lignes };
  }

  /**
   * Le titre, le sous-titre et l'adresse de chaque sujet — UNE REQUÊTE PAR TYPE.
   *
   * Les douze branches lisent la même table que `resolversOf` juste au-dessous,
   * et c'est voulu : les deux répondent à des questions différentes sur le même
   * sujet — « dans quel état est-il ? » et « comment l'écrire ? » — et les
   * fusionner ferait une méthode qui fait deux choses.
   */
  private async apercus(
    lignes: readonly { subjectType: BookmarkSubjectType; subjectId: string }[],
  ): Promise<Map<string, { titre: string; sous: string; lien: string | null }>> {
    const out = new Map<string, { titre: string; sous: string; lien: string | null }>();
    const parType = new Map<BookmarkSubjectType, string[]>();
    for (const l of lignes) {
      const lot = parType.get(l.subjectType);
      if (lot === undefined) parType.set(l.subjectType, [l.subjectId]);
      else lot.push(l.subjectId);
    }

    for (const [type, ids] of parType) {
      const where = { id: { in: ids } };
      const poser = (id: string, titre: string, sous: string, lien: string | null): void => {
        out.set(`${type}:${id}`, { titre, sous, lien });
      };

      switch (type) {
        case 'STORY': {
          const rows = await this.prisma.story.findMany({
            where,
            select: { id: true, body: true },
          });
          for (const r of rows) poser(r.id, r.body.slice(0, 80), 'Story', `/stories/${r.id}`);
          break;
        }
        case 'GUIDE': {
          const rows = await this.prisma.guide.findMany({
            where,
            select: { id: true, title: true, slug: true },
          });
          for (const r of rows) poser(r.id, r.title, 'Guide', `/guides/${r.slug}`);
          break;
        }
        case 'POST': {
          const rows = await this.prisma.post.findMany({
            where,
            select: { id: true, body: true },
          });
          for (const r of rows) poser(r.id, r.body.slice(0, 80), 'Publication', `/publications/${r.id}`);
          break;
        }
        case 'HELP_REQUEST': {
          const rows = await this.prisma.helpRequest.findMany({
            where,
            select: { id: true, title: true },
          });
          for (const r of rows) poser(r.id, r.title, 'Entraide', `/entraide/${r.id}`);
          break;
        }
        case 'EVENT': {
          const rows = await this.prisma.event.findMany({
            where,
            select: { id: true, title: true },
          });
          for (const r of rows) poser(r.id, r.title, 'Événement', `/agenda/${r.id}`);
          break;
        }
        case 'HOUSING': {
          const rows = await this.prisma.housingListing.findMany({
            where,
            select: { id: true, title: true },
          });
          for (const r of rows) poser(r.id, r.title, 'Logement', `/services/logement/${r.id}`);
          break;
        }
        case 'JOB': {
          const rows = await this.prisma.jobListing.findMany({
            where,
            select: { id: true, title: true },
          });
          for (const r of rows) poser(r.id, r.title, 'Emploi', `/services/emploi/${r.id}`);
          break;
        }
        case 'PRO': {
          /**
           * `businessName` ET NON `displayName` : une fiche pro porte le nom de
           * l'ENTREPRISE, et il est NULLABLE — une fiche peut n'avoir que la
           * profession. On écrit alors « Fiche professionnelle » plutôt qu'une
           * chaîne vide, qui se lirait comme un chargement raté.
           */
          const rows = await this.prisma.proProfile.findMany({
            where,
            select: { id: true, businessName: true },
          });
          for (const r of rows) {
            poser(r.id, r.businessName ?? 'Fiche professionnelle', 'Professionnel', `/services/pros/${r.id}`);
          }
          break;
        }
        case 'MENTOR':
        case 'USER': {
          const rows = await this.prisma.user.findMany({
            where,
            select: { id: true, displayName: true, handle: true },
          });
          const sous = type === 'MENTOR' ? 'Parrain' : 'Membre';
          for (const r of rows) poser(r.id, r.displayName, sous, `/@${r.handle}`);
          break;
        }
        case 'TOPIC': {
          const rows = await this.prisma.topic.findMany({
            where,
            select: { id: true, title: true },
          });
          for (const r of rows) poser(r.id, r.title, 'Sujet', `/sujets/${r.id}`);
          break;
        }
        case 'CITY': {
          const rows = await this.prisma.city.findMany({
            where,
            select: { id: true, name: true, slug: true },
          });
          for (const r of rows) poser(r.id, r.name, 'Ville', `/villes/${r.slug}`);
          break;
        }
      }
    }

    return out;
  }

  /**
   * `bookmark.state_refresh` — horaire (§9.3).
   *
   * Un balayage PAR TYPE et non ligne par ligne : les signets sont regroupés par
   * `subject_type`, puis les sujets d'un type sont chargés en UNE requête. Douze
   * requêtes de lecture par passage, quelle que soit la taille du lot — là où une
   * boucle sur deux mille signets en ferait deux mille.
   *
   * N'ÉCRIT QUE LES CHANGEMENTS. Deux raisons, et la seconde est la vraie : réécrire
   * deux mille lignes identiques chaque heure gonfle les WAL pour rien, et surtout
   * un test ne pourrait plus distinguer « la tâche a tourné, rien n'a changé » de
   * « la tâche a réécrit ». `state_checked_at` suit le même sort — sinon la
   * distinction serait perdue par la colonne même qui devait l'établir, et savoir
   * QUAND un état a changé vaut mieux que savoir quand une tâche est passée : ça,
   * le journal du planificateur le dit déjà.
   */
  async refreshStates(now: Date = new Date()): Promise<{ examines: number; changes: number }> {
    const bookmarks = await this.prisma.bookmark.findMany({
      orderBy: [{ stateCheckedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      select: { id: true, createdAt: true, subjectType: true, subjectId: true, state: true },
      take: BookmarksService.BATCH,
    });
    if (bookmarks.length === 0) return { examines: 0, changes: 0 };

    // Regroupé par type, pour une requête par type et non une par signet.
    const parType = new Map<BookmarkSubjectType, typeof bookmarks>();
    for (const bookmark of bookmarks) {
      const bucket = parType.get(bookmark.subjectType);
      if (bucket === undefined) parType.set(bookmark.subjectType, [bookmark]);
      else bucket.push(bookmark);
    }

    let changes = 0;
    for (const [subjectType, lot] of parType) {
      const ids = [...new Set(lot.map((b) => b.subjectId))];
      const resolvers = await this.resolversOf(subjectType, ids, now);

      for (const bookmark of lot) {
        // Un sujet ABSENT de la carte est un sujet qui n'existe plus : « contenu
        // retiré » (§2.9). C'est le repli, et il est volontairement le dernier — un
        // type que ce service ne saurait pas lire serait annoncé « retiré » à tort,
        // d'où l'exhaustivité de `resolversOf` sur les douze types, tenue par le
        // compilateur.
        const resolve = resolvers.get(bookmark.subjectId);
        const wanted = resolve === undefined ? 'REMOVED' : resolve(bookmark.createdAt);
        if (wanted === bookmark.state) continue;

        await this.prisma.bookmark.update({
          where: { id: bookmark.id },
          data: { state: wanted, stateCheckedAt: now },
        });
        changes += 1;
      }
    }

    return { examines: bookmarks.length, changes };
  }

  /**
   * L'état de chaque sujet d'un type, par identifiant.
   *
   * Un sujet ABSENT de la carte rendue est un sujet supprimé — c'est ainsi que
   * `REMOVED` est décidé, et c'est pourquoi chaque branche filtre `deletedAt: null`
   * quand la table est en suppression douce : un contenu soft-supprimé est retiré du
   * point de vue du membre, et le laisser « disponible » ouvrirait un lien mort.
   *
   * LE `switch` EST EXHAUSTIF, et le compilateur le tient : `BookmarkSubjectType`
   * est un enum fermé, la fonction rend une valeur dans chaque branche et n'a AUCUNE
   * branche par défaut. Un treizième type signetable fera donc échouer `tsc` ici —
   * ce qui vaut infiniment mieux que le repli `REMOVED` de l'appelant, qui
   * annoncerait « contenu retiré » pour tout un type nouvellement signetable.
   */
  private async resolversOf(
    subjectType: BookmarkSubjectType,
    ids: readonly string[],
    now: Date,
  ): Promise<Map<string, StateResolver>> {
    const out = new Map<string, StateResolver>();
    const where = { id: { in: [...ids] } };

    switch (subjectType) {
      case 'STORY': {
        // §2.9 : « story “expirée, gardée pour vous” ». Le statut ET la date :
        // `story.expire` tourne toutes les cinq minutes, mais une story dont
        // l'échéance est passée est expirée avant que la tâche ne le dise.
        const rows = await this.prisma.story.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true, expiresAt: true },
        });
        for (const row of rows) {
          const state: BookmarkState =
            row.status === 'HIDDEN' || row.status === 'REMOVED'
              ? 'REMOVED'
              : row.status === 'EXPIRED' || row.expiresAt <= now
                ? 'EXPIRED'
                : 'AVAILABLE';
          out.set(row.id, fixed(state));
        }
        return out;
      }

      case 'GUIDE': {
        // LE SEUL TYPE QUI LIT LA DATE DU SIGNET. §2.9 : « guide “mis à jour le …” ».
        // Mis à jour PAR RAPPORT À QUOI — l'énoncé ne le dit pas, et la seule
        // référence qui ait un sens pour le membre est le moment où IL a enregistré :
        // « ce que vous avez gardé a changé depuis ». Comparer à l'heure courante
        // rendrait tout guide « mis à jour » pour toujours, ou pour personne.
        //
        // Les guides sont AUSSI les seuls que §2.9 annonce mis à jour, et ce n'est
        // pas un hasard : ce sont les seuls dont le contenu est versionné et révisé
        // par d'autres que leur auteur (05 §2.5).
        const rows = await this.prisma.guide.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true, lastContentUpdateAt: true },
        });
        for (const row of rows) {
          // Un guide dépublié n'est plus ouvrable : « plus disponible », et non
          // « retiré » — il existe encore, et §2.6 le rend parfois de nouveau.
          if (row.status === 'UNPUBLISHED') {
            out.set(row.id, fixed('UNAVAILABLE'));
            continue;
          }
          const maj = row.lastContentUpdateAt;
          out.set(row.id, (bookmarkedAt) => (maj > bookmarkedAt ? 'UPDATED' : 'AVAILABLE'));
        }
        return out;
      }

      case 'POST': {
        const rows = await this.prisma.post.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true },
        });
        for (const row of rows) out.set(row.id, fixed('AVAILABLE'));
        return out;
      }

      case 'HELP_REQUEST': {
        const rows = await this.prisma.helpRequest.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true },
        });
        for (const row of rows) {
          // §2.9 : « demande “résolue” ». Une demande ARCHIVÉE (45 jours sans
          // réponse, 06 §7) n'est ni résolue ni ouverte : « plus disponible ».
          const state: BookmarkState =
            row.status === 'RESOLVED'
              ? 'RESOLVED'
              : row.status === 'ARCHIVED'
                ? 'UNAVAILABLE'
                : 'AVAILABLE';
          out.set(row.id, fixed(state));
        }
        return out;
      }

      case 'EVENT': {
        const rows = await this.prisma.event.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true, startsAt: true },
        });
        for (const row of rows) {
          // §2.9 : « événement “passé” ». `DONE` vient d'`event.mark_done`
          // (horaire) ; la date le dit avant la tâche, et un signet ne doit pas
          // annoncer « à venir » un événement d'hier soir pendant une heure.
          const state: BookmarkState =
            row.status === 'CANCELLED'
              ? 'UNAVAILABLE'
              : row.status === 'DONE' || row.startsAt < now
                ? 'PAST'
                : 'AVAILABLE';
          out.set(row.id, fixed(state));
        }
        return out;
      }

      case 'HOUSING': {
        const rows = await this.prisma.housingListing.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true },
        });
        // §2.9 : « annonce “plus disponible” ». Prise, en pause, expirée ou
        // retirée : du point de vue de qui l'a enregistrée, c'est le même fait.
        for (const row of rows) {
          out.set(row.id, fixed(row.status === 'ACTIVE' ? 'AVAILABLE' : 'UNAVAILABLE'));
        }
        return out;
      }

      case 'JOB': {
        const rows = await this.prisma.jobListing.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true },
        });
        for (const row of rows) {
          out.set(row.id, fixed(row.status === 'ACTIVE' ? 'AVAILABLE' : 'UNAVAILABLE'));
        }
        return out;
      }

      case 'PRO': {
        const rows = await this.prisma.proProfile.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true, verificationStatus: true },
        });
        for (const row of rows) {
          // Une fiche non APPROUVÉE n'est pas publique (10 §4.1) : elle n'est donc
          // pas « disponible », même si sa ligne existe.
          const ouverte = row.status === 'ACTIVE' && row.verificationStatus === 'APPROVED';
          out.set(row.id, fixed(ouverte ? 'AVAILABLE' : 'UNAVAILABLE'));
        }
        return out;
      }

      case 'MENTOR': {
        // `mentor_profiles` A POUR CLÉ `user_id`, PAS `id` — un membre a au plus un
        // profil de parrain (08 §2). Le `subject_id` d'un signet MENTOR est donc
        // l'identifiant du MEMBRE, et confondre les deux aurait rendu « contenu
        // retiré » pour tous les parrains signetés, sans erreur ni trace.
        const rows = await this.prisma.mentorProfile.findMany({
          where: { userId: { in: [...ids] } },
          select: { userId: true, isAvailable: true },
        });
        // 12 §2.1 nomme « parrain enregistré redevenu disponible » parmi les
        // notifications `BOOKMARK` : c'est ce basculement-là que l'état porte.
        for (const row of rows) {
          out.set(row.userId, fixed(row.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'));
        }
        return out;
      }

      case 'USER': {
        const rows = await this.prisma.user.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true },
        });
        for (const row of rows) {
          // Un compte suspendu ou désactivé reste un compte : « plus disponible ».
          // `DELETED` est « retiré », et le filtre `deletedAt: null` ne suffit PAS à
          // l'écarter : §2.8 ANONYMISE la ligne `users` au lieu de la supprimer, et
          // `deleted_at` n'est pas toujours posé sur ce chemin. D'où le test
          // explicite sur le statut. (Il n'existe pas de statut `BANNED` sur
          // `users` : un bannissement se lit dans `sanctions`, module 13.)
          const state: BookmarkState =
            row.status === 'DELETED'
              ? 'REMOVED'
              : row.status === 'ACTIVE'
                ? 'AVAILABLE'
                : 'UNAVAILABLE';
          out.set(row.id, fixed(state));
        }
        return out;
      }

      case 'TOPIC': {
        const rows = await this.prisma.topic.findMany({
          where: { ...where, deletedAt: null },
          select: { id: true, status: true },
        });
        for (const row of rows) {
          const state: BookmarkState =
            row.status === 'RESOLVED'
              ? 'RESOLVED'
              : row.status === 'ARCHIVED'
                ? 'UNAVAILABLE'
                : 'AVAILABLE';
          out.set(row.id, fixed(state));
        }
        return out;
      }

      case 'CITY': {
        const rows = await this.prisma.city.findMany({
          where,
          select: { id: true, isActive: true, mergedIntoCityId: true },
        });
        for (const row of rows) {
          // Une ville FUSIONNÉE n'a plus de fiche (02 §2.2 : « rend l'ancienne
          // invisible »), et une ville inactive n'en a pas encore.
          const ouverte = row.isActive && row.mergedIntoCityId === null;
          out.set(row.id, fixed(ouverte ? 'AVAILABLE' : 'UNAVAILABLE'));
        }
        return out;
      }
    }
  }
}
