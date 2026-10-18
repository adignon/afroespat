import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/api-error';
import { PrismaService } from '../../common/prisma.service';
import { TokenService, type AccessClaims } from '../../common/token.service';

/**
 * L'admission d'une connexion WebSocket — T4 §7 : « WebSocket authentifié par le
 * jeton d'accès à la connexion ; reconnexion avec rafraîchissement. »
 *
 * POURQUOI CE FICHIER EXISTE PLUTÔT QUE `@UseGuards(AuthGuard)`.
 *
 * `AuthGuard` est inutilisable tel quel sur une passerelle, et pas pour une
 * raison de style :
 *
 *   · il lit `context.switchToHttp().getRequest()`. Sur un contexte `ws`, cet
 *     appel ne rend pas une requête HTTP, et le garde lirait `headers` sur un
 *     objet qui n'en a pas ;
 *   · il décide à partir d'une CAPACITÉ posée par `@RequiresCapability` sur une
 *     route. Une connexion n'est pas une route : elle n'a pas de verbe, et le
 *     refus par défaut du garde (« route sans capacité déclarée ») refuserait
 *     tout ;
 *   · `RateLimitGuard` s'arrête de lui-même sur un contexte non-HTTP
 *     (`if (context.getType() !== 'http') return true`), donc même branché il ne
 *     protégerait rien.
 *
 * Brancher les gardes tels quels aurait donc produit une passerelle qui REFUSE
 * tout, ou — en corrigeant au plus court — une passerelle qui accepte tout. Les
 * MÊMES CONTRÔLES sont donc rejoués ici, explicitement, dans le même ordre, avec
 * les mêmes codes d'erreur. Le fichier est volontairement petit et sans
 * dépendance à Nest au-delà de l'injection : c'est le seul endroit où une
 * connexion temps réel est autorisée, et il doit tenir sous les yeux.
 *
 * CE QUE CETTE CORRECTION OUVRE — la question que le précédent
 * `level_refresh_required` oblige à poser.
 *
 * Une requête HTTP est vérifiée à chaque appel. Une connexion WebSocket est
 * vérifiée UNE FOIS, puis vit des heures. Authentifier seulement à la poignée de
 * main rejouerait donc, en pire, la faille qu'on a déjà payée : là où un membre
 * rétrogradé gardait ses droits quinze minutes (le temps de son jeton d'accès),
 * il les garderait ici JUSQU'À CE QU'IL SE DÉCONNECTE — c'est-à-dire sans borne.
 * Un membre banni continuerait de recevoir les messages de ses conversations.
 *
 * `admit()` est donc appelée à la poignée de main ET rejouée périodiquement par
 * la passerelle sur chaque socket ouvert (voir `realtime.gateway.ts`). C'est
 * cette seconde moitié qui rend la première honnête.
 */

/** Ce qu'une connexion admise porte. Le miroir d'`AuthContext` côté HTTP. */
export interface RealtimeContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly claims: AccessClaims;
}

@Injectable()
export class RealtimeAdmissionService {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Autorise — ou refuse — une connexion.
   *
   * L'ORDRE est celui d'`AuthGuard.canActivate`, et il n'est pas indifférent :
   * on ne lit la base qu'après avoir établi que le jeton est signé et non
   * expiré, sinon une connexion anonyme répétée deviendrait un moyen de faire
   * travailler la base sans coût pour l'attaquant.
   */
  async admit(token: string | undefined | null): Promise<RealtimeContext> {
    // 1. Pas de jeton du tout — le cas « connexion non authentifiée ».
    if (typeof token !== 'string' || token.trim() === '') {
      throw ApiError.transverse('UNAUTHENTICATED');
    }

    // 2. Signature et expiration. `verify` ne lève jamais : il rend `null`.
    const claims = this.tokens.verify(token.trim());
    if (claims === null) throw ApiError.transverse('UNAUTHENTICATED');

    // 3. La session et le membre, en une lecture.
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      select: {
        userId: true,
        revokedAt: true,
        levelRefreshRequired: true,
        user: { select: { verificationLevel: true, status: true, deletedAt: true } },
      },
    });

    /**
     * SESSION INTROUVABLE : on REFUSE, là où `AuthGuard` laisse passer.
     *
     * L'écart est délibéré et va dans le sens de la sûreté. Le garde HTTP tolère
     * l'absence parce qu'une session purgée (§8.4) ne prouve pas une révocation,
     * et qu'un jeton signé de quinze minutes vaut alors preuve suffisante pour
     * UNE requête. Ici, la même tolérance ouvrirait une connexion DURABLE sur la
     * foi d'une ligne qui n'existe plus — et sans ligne, la revérification
     * périodique n'a plus rien à lire : elle ne pourrait plus jamais refuser ce
     * socket. Refuser coûte au membre une reconnexion après rafraîchissement,
     * ce que T4 §7 prévoit explicitement (« reconnexion avec rafraîchissement »).
     */
    if (session === null) throw ApiError.transverse('UNAUTHENTICATED');
    if (session.userId !== claims.sub) throw ApiError.transverse('UNAUTHENTICATED');

    // 4. Session révoquée : c'est par là qu'arrivent la suspension et le
    //    bannissement de 13 §4.2, qui révoquent toutes les sessions du membre.
    if (session.revokedAt !== null) throw ApiError.transverse('UNAUTHENTICATED');

    /**
     * 5. RÉTROGRADATION. Les deux critères d'`AuthGuard.assertTokenFresh`, et le
     *    second n'est pas un doublon : `/auth/refresh` remet le drapeau à `false`,
     *    et l'ANCIEN jeton d'accès redeviendrait acceptable avec son ancien
     *    niveau. Sur une rétrogradation L2 → L0, c'est une élévation de privilège
     *    créée par le remède. La comparaison la ferme.
     */
    if (session.levelRefreshRequired || claims.level !== session.user.verificationLevel) {
      throw ApiError.transverse('TOKEN_STALE', { reason: 'niveau de vérification modifié' });
    }

    /**
     * 6. ÉTAT DU COMPTE, LU EN BASE et non dans le jeton.
     *
     * `AuthGuard` se fie à `claims.status`, ce qui lui suffit : son verdict ne
     * vaut que pour la requête en cours, et un changement d'état révoque les
     * sessions. Ici, le verdict engage une connexion durable, et le jeton porte
     * l'état qu'avait le compte À SON ÉMISSION. Un bannissement prononcé après
     * coup laisserait donc un jeton affirmant `ACTIVE`.
     *
     * Un BANNISSEMENT écrit `DEACTIVATED` — la valeur `BANNED` n'existe pas dans
     * l'énumération, voir `moderation.service.ts` — d'où le refus des deux, et de
     * la suppression. `SUSPENDED` est refusé aussi : §13 laisse un suspendu
     * CONSULTER en HTTP (lectures `GET`), mais un socket temps réel n'est pas une
     * consultation, c'est une réception continue de contenu d'autrui.
     */
    if (session.user.deletedAt !== null) throw ApiError.transverse('UNAUTHENTICATED');
    if (session.user.status === 'DELETED' || session.user.status === 'DELETION_PENDING' || session.user.status === 'DEACTIVATED') {
      throw ApiError.transverse('UNAUTHENTICATED');
    }
    if (session.user.status === 'SUSPENDED') throw ApiError.transverse('ACCOUNT_SUSPENDED');

    return { userId: claims.sub, sessionId: claims.sid, claims };
  }

  /**
   * À QUI la frappe de `userId` dans `conversationId` doit-elle être montrée ?
   *
   * Les AUTRES membres encore présents, et rien si `userId` n'est pas membre actif
   * de cette conversation : un socket authentifié ne doit pas pouvoir « taper »
   * dans le fil d'un inconnu, ni sonder l'existence d'une conversation (le refus
   * est un tableau vide, jamais une erreur — T4 §3, 404 plutôt que 403).
   */
  async typingAudience(userId: string, conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true, leftAt: true },
    });
    const me = members.find((m) => m.userId === userId);
    if (me === undefined || me.leftAt !== null) return [];
    return members.filter((m) => m.userId !== userId && m.leftAt === null).map((m) => m.userId);
  }
}
