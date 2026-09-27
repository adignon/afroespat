import { Injectable } from '@nestjs/common';
import { ApiError } from './api-error';
import { PrismaService } from './prisma.service';

/**
 * La visibilité entre deux membres — 08-parrainage-messagerie.md §4.
 *
 * Cette brique existe pour UNE raison : presque tous les modules de contenu
 * consomment `user.blocked` — fil, guides, entraide, réseaux, agenda, services.
 * Sans elle, chacun réinventerait sa règle de visibilité, et elles finiraient par
 * différer. Un membre bloqué disparaîtrait du fil mais resterait dans l'agenda,
 * et personne ne saurait lequel des deux a raison.
 *
 * DANS LES DEUX SENS, toujours. C'est la règle du §4 et de `01` §4.4 : celui qui
 * a bloqué ne doit pas non plus retrouver l'autre par hasard dans une liste. Un
 * blocage n'est pas un filtre à sens unique — c'est une séparation.
 *
 * `404` et jamais `403` (T4 §3) : révéler qu'un contenu existe mais est
 * inaccessible en dit déjà trop.
 */
@Injectable()
export class VisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Les membres séparés de celui-ci, dans un sens ou l'autre.
   *
   * À passer en `notIn` sur toute liste de contenus. Rendre un tableau plutôt
   * qu'un filtre Prisma est volontaire : les modules n'ont pas tous la même
   * colonne d'auteur, et un filtre toute-faite les obligerait à la renommer.
   */
  async separatedFrom(userId: string | null): Promise<string[]> {
    if (userId === null) return [];

    const blocks = await this.prisma.block.findMany({
      where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
      select: { blockerUserId: true, blockedUserId: true },
    });

    const ids = new Set<string>();
    for (const block of blocks) {
      ids.add(block.blockerUserId === userId ? block.blockedUserId : block.blockerUserId);
    }
    return [...ids];
  }

  /** Y a-t-il un blocage entre ces deux membres, dans un sens ou l'autre ? */
  async isSeparated(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const found = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerUserId: a, blockedUserId: b },
          { blockerUserId: b, blockedUserId: a },
        ],
      },
      select: { id: true },
    });
    return found !== null;
  }

  /**
   * Lève `NOT_FOUND` si les deux membres sont séparés.
   *
   * À appeler avant toute action qui met deux membres en relation — répondre à
   * une demande d'aide, s'inscrire à un événement, contacter une annonce.
   */
  async assertVisible(viewerId: string | null, subjectUserId: string): Promise<void> {
    if (viewerId === null) return;
    if (await this.isSeparated(viewerId, subjectUserId)) throw ApiError.notFound();
  }
}
