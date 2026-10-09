import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  bookmarkStatesQuerySchema,
  bookmarkSubjectTypeSchema,
  bookmarksQuerySchema,
  putBookmarkSchema,
  uuidSchema,
} from '@app/shared';
import { z } from 'zod';
import { Auth, type AuthContext } from '../../common/auth.guard';
import { RequiresCapability } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';
import { BookmarksService } from './bookmarks.service';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES ENREGISTRÉS — §2.9, QUATRE ROUTES ANNONCÉES ET JAMAIS LIVRÉES         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Finalise les routes bookmarks et branche-les. »
 *
 * CE QUI EXISTAIT : un service avec la tâche horaire `bookmark.state_refresh`,
 * et son propre en-tête qui constatait le trou — « §2.9 annonce quatre routes […]
 * AUCUNE n'est livrée ». `task-registrations.service.ts` ajoutait que « rien ne
 * crée de signet » : la tâche rafraîchissait les états d'une table que personne
 * ne pouvait remplir.
 *
 * ── `content.read`, ET PAS DAVANTAGE ──────────────────────────────────────
 *
 * Enregistrer est un geste de LECTURE : on garde pour soi ce qu'on a vu, rien
 * n'est publié et personne n'est prévenu. Exiger un niveau de vérification pour
 * mettre un signet serait le même mauvais arbitrage que de l'exiger pour bloquer
 * quelqu'un.
 *
 * ── LE TYPE EST DANS LE CHEMIN DU `DELETE`, ET C'EST §2.9 ─────────────────
 *
 * `DELETE /me/bookmarks/:type/:id`. Un identifiant ne suffit pas : la table est
 * polymorphe et deux sujets de types différents peuvent porter le même UUID. Le
 * chemin désigne donc la ligne entière, comme la clé unique le fait en base.
 */
@ApiTags('bookmarks')
@Controller()
export class BookmarksController {
  constructor(private readonly bookmarks: BookmarksService) {}

  @Get('me/bookmarks')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Mes contenus enregistrés, avec l’état actuel de chacun (§2.9)' })
  async list(
    @Auth() auth: AuthContext,
    @Query(zodPipe(bookmarksQuerySchema)) query: z.infer<typeof bookmarksQuerySchema>,
  ) {
    return this.bookmarks.list(auth.userId, query);
  }

  @Put('me/bookmarks')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Enregistrer un contenu — idempotent (§2.9)' })
  async put(
    @Auth() auth: AuthContext,
    @Body(zodPipe(putBookmarkSchema)) body: z.infer<typeof putBookmarkSchema>,
  ) {
    return this.bookmarks.put(auth.userId, body);
  }

  /**
   * `GET /me/bookmarks/states` EST DÉCLARÉE AVANT `:type/:id`, et l'ordre compte :
   * Nest apparie les routes dans l'ordre de déclaration, et `states` serait sinon
   * mangée par le segment dynamique du `DELETE`… qui est un autre verbe, donc pas
   * ici — mais la règle vaut d'être tenue, parce qu'une route `GET
   * /me/bookmarks/:type` ajoutée demain la mangerait pour de bon.
   */
  @Get('me/bookmarks/states')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'L’état d’enregistrement d’un lot de contenus (§2.9)' })
  async states(
    @Auth() auth: AuthContext,
    @Query(zodPipe(bookmarkStatesQuerySchema)) query: z.infer<typeof bookmarkStatesQuerySchema>,
  ) {
    /**
     * LES IDENTIFIANTS SONT VALIDÉS UN À UN, et les invalides ÉCARTÉS plutôt que
     * refusés : cette route sert à dessiner vingt signets d'un coup, et un seul
     * identifiant douteux ne doit pas faire disparaître les dix-neuf autres.
     */
    const ids = query.ids
      .split(',')
      .map((x) => x.trim())
      .filter((x) => uuidSchema.safeParse(x).success)
      .slice(0, 100);
    return this.bookmarks.states(auth.userId, query.subjectType, ids);
  }

  @Delete('me/bookmarks/:type/:id')
  @HttpCode(204)
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Retirer un contenu de ses enregistrés (§2.9)' })
  async remove(
    @Auth() auth: AuthContext,
    @Param('type', zodPipe(bookmarkSubjectTypeSchema)) type: z.infer<typeof bookmarkSubjectTypeSchema>,
    @Param('id', zodPipe(uuidSchema)) id: string,
  ): Promise<void> {
    await this.bookmarks.remove(auth.userId, type, id);
  }
}
