import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Capability, levelSatisfies } from '@app/shared';
import { ApiError } from './api-error';
import { ALLOW_SUSPENDED_KEY, CAPABILITY_KEY, PUBLIC_READ_KEY } from './capability.decorator';
import { PrismaService } from './prisma.service';
import { STAFF_ROLE_KEY } from './staff-role.decorator';
import { type AccessClaims, TokenService } from './token.service';

/**
 * Garde d'authentification et de capacités — 00-fondations.md §7.3.
 *
 * Il est GLOBAL et refuse par défaut : une route qui ne déclare ni capacité ni
 * `@PublicRead()` est rejetée. L'inverse — ouvert par défaut — fait qu'un oubli
 * de décorateur devient une faille silencieuse, et un oubli finit toujours par
 * arriver.
 *
 * Quatre contrôles, dans cet ordre, parce que chacun suppose le précédent :
 *   1. le jeton est-il valide (sinon 401) ;
 *   1bis. le jeton est-il À JOUR (sinon 401 TOKEN_STALE — T4 §2) ;
 *   2. le compte est-il suspendu (sinon 403 — mais la LECTURE reste permise,
 *      §7.3 : « un compte suspendu peut toujours consulter », et `@AllowSuspended()`
 *      ouvre les rares écritures qu'un DROIT du membre exige, comme contester une
 *      sanction) ;
 *   3. le niveau de vérification atteint-il celui que la capacité demande
 *      (sinon 403 LEVEL_REQUIRED, avec de quoi proposer la montée de niveau).
 */

/** Ce que le garde attache à la requête. */
export interface AuthContext {
  readonly userId: string;
  readonly sessionId: string;
  readonly claims: AccessClaims;
}

interface AuthedRequest extends Request {
  auth?: AuthContext;
}

/**
 * Le pas d'écriture de `users.last_seen_at` — voir `assertTokenFresh`.
 *
 * Quinze minutes : la règle la plus fine qui lit cette colonne raisonne en JOURS
 * (six mois d'inactivité d'auteur, fenêtres de 7 et 30 jours des mesures). Un pas
 * plus court n'apprendrait rien de plus et multiplierait les écritures.
 */
const DERNIERE_VUE_FRAICHEUR_MS = 15 * 60 * 1_000;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    const capability = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isPublicRead = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_READ_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    /**
     * ROUTE D'ÉQUIPE — règle dure 15 §2.1 et 00 §7.4 : « les comptes équipe et
     * les comptes membres sont hermétiques ».
     *
     * Ce bloc est AVANT toute lecture de jeton, et c'est le point entier : sur
     * une route d'équipe, le domaine membre n'est pas « insuffisant », il
     * n'existe pas. Aucun `request.auth` n'est posé, donc `@Auth()` y lève, donc
     * aucun contrôleur d'équipe ne peut par accident agir au nom d'un membre.
     * C'est `StaffGuard` — l'autre garde global — qui décide de l'accès.
     *
     * Une route qui déclare LES DEUX est refusée. Ce n'est pas un refus d'accès
     * mais un défaut de code : la passerelle que la règle dure interdit ne peut
     * naître que d'une route mixte, et on préfère qu'elle échoue à chaque appel
     * plutôt qu'elle décide laquelle des deux autorisations l'emporte.
     */
    const staffRoles = this.reflector.getAllAndOverride<readonly string[] | undefined>(
      STAFF_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (staffRoles !== undefined) {
      if (capability !== undefined || isPublicRead === true) {
        throw ApiError.transverse('FORBIDDEN', {
          reason: 'route déclarée à la fois membre et équipe',
        });
      }
      return true;
    }

    // Un jeton présent est toujours lu, même sur une route publique : une
    // lecture ouverte se personnalise (réactions déjà posées, éléments
    // enregistrés) sans pour autant exiger la connexion.
    const claims = this.readToken(request);
    if (claims !== null) {
      request.auth = { userId: claims.sub, sessionId: claims.sid, claims };
    }

    if (isPublicRead === true) return true;

    if (capability === undefined) {
      // Ni capacité ni `@PublicRead()`. C'est un défaut de code, pas un refus
      // d'accès : on le dit au journal et on refuse, plutôt que d'ouvrir.
      throw ApiError.transverse('FORBIDDEN', { reason: 'route sans capacité déclarée' });
    }

    if (claims === null) throw ApiError.transverse('UNAUTHENTICATED');

    await this.assertTokenFresh(claims);

    // Suspendu : les écritures tombent, les lectures passent (§7.3).
    //
    // Le critère est la MÉTHODE HTTP, et non un champ « écriture » ajouté à la
    // matrice du §7.3 : celle-ci est la spec, et lui greffer une donnée dérivée
    // ferait deux sources là où il n'en faut qu'une.
    const allowSuspended = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_SUSPENDED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      claims.status === 'SUSPENDED' &&
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      allowSuspended !== true
    ) {
      throw ApiError.transverse('ACCOUNT_SUSPENDED');
    }
    if (claims.status === 'DELETED' || claims.status === 'DEACTIVATED') {
      throw ApiError.transverse('UNAUTHENTICATED');
    }

    if (!levelSatisfies(claims.level, capability)) {
      throw ApiError.levelRequired(capability, claims.level);
    }

    return true;
  }

  /**
   * `level_refresh_required` → `401 TOKEN_STALE` (T4 §2).
   *
   * LE PROBLÈME. Le jeton d'accès porte le NIVEAU (T4 §2) et vit quinze minutes.
   * Quand le niveau change — KYC approuvé, KYC rétrogradé, numéro de destination
   * retiré — les jetons déjà émis mentent. §2.4 marque donc toutes les sessions
   * actives `level_refresh_required`, et T4 §2 dit quoi en faire : « `401`
   * `code: TOKEN_STALE` → le client rafraîchit et rejoue ».
   *
   * Sans ce contrôle, le drapeau était ÉCRIT et lu par personne : un membre passé
   * L1 restait quinze minutes sans pouvoir publier, et — bien plus grave — un
   * membre rétrogradé à L0 gardait quinze minutes ses droits L1.
   *
   * DEUX CRITÈRES, et le second n'est pas un doublon du premier :
   *
   *   · le DRAPEAU, que §2.4 pose. C'est la règle de la spec, appliquée à la
   *     lettre.
   *   · la COMPARAISON du niveau porté par le jeton avec celui de la base. Le
   *     drapeau seul laisse une fenêtre réelle : `/auth/refresh` le remet à
   *     `false` pour la session, et l'ANCIEN jeton d'accès — cryptographiquement
   *     valide jusqu'à quinze minutes — redevient alors acceptable avec son
   *     ancien niveau. Sur une rétrogradation L1 → L0, c'est une élévation de
   *     privilège de quinze minutes ouverte par le remède lui-même. La
   *     comparaison la ferme, et elle est gratuite : la session est déjà lue.
   *
   * SESSION INTROUVABLE : on laisse passer. Une absence n'est pas une preuve de
   * révocation — §8.4 purge les sessions expirées, et la présence d'un jeton
   * signé valide suffit à établir qu'une session a existé. Seul `revoked_at` est
   * une preuve positive, et son exploitation relève de la révocation de session,
   * pas de la fraîcheur du niveau (voir le rapport : `POST /auth/logout` ne tue
   * aujourd'hui que le jeton de rafraîchissement).
   *
   * COÛT : une requête par appel authentifié, sur clé primaire. Assumé — l'autre
   * option est un cache, c'est-à-dire une seconde source de vérité sur une
   * décision d'autorisation.
   */
  private async assertTokenFresh(claims: AccessClaims): Promise<void> {
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      select: {
        userId: true,
        revokedAt: true,
        levelRefreshRequired: true,
        user: { select: { verificationLevel: true, lastSeenAt: true } },
      },
    });
    if (session === null) return;

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ `users.last_seen_at` N'ÉTAIT ÉCRIT PAR PERSONNE — ET CE SILENCE COÛTAIT  ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * MESURÉ : toutes les occurrences de `lastSeenAt` en code de production étaient
     * des LECTURES, sauf une — l'anonymisation, qui la met à `null`. Les seules
     * écritures du dépôt vivaient dans des TESTS, qui posaient la valeur eux-mêmes :
     * c'est pourquoi les règles qui en dépendent étaient vertes en test et fausses
     * en vrai. En base : 29 855 comptes sur 29 953 sans aucune dernière vue.
     *
     * CE QUE ÇA CASSAIT, et ce n'est pas théorique :
     *
     *   · `guide.author_inactivity` (hebdomadaire) bascule un guide à la communauté
     *     quand son auteur n'a pas eu de session depuis six mois, et son critère
     *     retient `lastSeenAt: null`. Tout guide publié devenait donc « maintenu par
     *     la communauté » au premier passage de la tâche — son auteur perdait
     *     l'attribution de son guide sans rien avoir fait. C'est le défaut que le
     *     porteur voyait sans le nommer : le bandeau vert sur tous les guides ;
     *   · `members.active_7d` et `active_30d` valaient zéro en permanence ;
     *   · le fil s'en sert pour trier des membres par activité récente.
     *
     * ── POURQUOI ICI, ET POURQUOI BRIDÉ ───────────────────────────────────────
     *
     * ICI parce que c'est le seul point par lequel passe CHAQUE appel authentifié,
     * et parce que la ligne est déjà lue : la valeur ne coûte pas une requête de
     * plus, seulement une colonne de plus dans un `select` sur clé primaire.
     *
     * BRIDÉ parce que sans cela on paierait un `UPDATE` par requête de chaque page —
     * une page du fil en fait une dizaine. Une écriture au plus toutes les quinze
     * minutes par membre suffit à toutes les règles ci-dessus, dont la plus fine
     * raisonne en JOURS.
     *
     * ── ET SURTOUT : ELLE NE PEUT PAS FAIRE ÉCHOUER LA REQUÊTE ────────────────
     *
     * `void` et `.catch()` : c'est une statistique d'usage, pas une décision
     * d'autorisation. Une base momentanément indisponible en écriture doit ralentir
     * les mesures, jamais déconnecter un membre. Le garde ne l'attend pas non plus —
     * l'attendre ajouterait un aller-retour à chaque appel pour une valeur que
     * personne ne lit dans la même seconde.
     */
    const vueLe = session.user.lastSeenAt;
    if (vueLe === null || vueLe.getTime() < Date.now() - DERNIERE_VUE_FRAICHEUR_MS) {
      void this.prisma.user
        .update({ where: { id: session.userId }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }

    // Un `sid` qui désigne la session d'un AUTRE membre ne peut venir que d'un
    // jeton forgé — la signature l'exclut — mais le contrôle ne coûte rien et
    // évite qu'une future erreur de signature devienne une usurpation.
    if (session.userId !== claims.sub) throw ApiError.transverse('UNAUTHENTICATED');

    /**
     * SESSION RÉVOQUÉE : le jeton d'accès meurt avec elle.
     *
     * §2.8 écrit « sessions révoquées IMMÉDIATEMENT » pour la désactivation et la
     * suppression, et 13 §4.2 l'exige aussi d'une suspension. Sans ce contrôle,
     * « immédiatement » voulait dire « dans quinze minutes » : un compte désactivé —
     * y compris celui d'un MINEUR, que §2.3 ferme — gardait tous ses droits d'écriture
     * le temps que son jeton expire, et `POST /auth/logout` ne coupait en réalité que
     * le rafraîchissement.
     *
     * La révocation est une preuve POSITIVE, contrairement à l'absence de ligne : la
     * distinction est ce qui permet de refuser ici sans refuser là.
     */
    if (session.revokedAt !== null) throw ApiError.transverse('UNAUTHENTICATED');

    if (session.levelRefreshRequired || claims.level !== session.user.verificationLevel) {
      throw ApiError.transverse('TOKEN_STALE', {
        reason: 'niveau de vérification modifié',
      });
    }
  }

  private readToken(request: AuthedRequest): AccessClaims | null {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
    return this.tokens.verify(header.slice('Bearer '.length).trim());
  }
}

/**
 * `@Auth()` sur un paramètre : le contexte posé par le garde.
 *
 * Il lève si le contexte manque, au lieu de rendre `undefined` : un contrôleur
 * qui demande le membre courant sur une route publique est un bug, et il doit se
 * voir tout de suite, pas se traduire en `userId` indéfini glissé dans une
 * requête SQL.
 */
export const Auth = createParamDecorator((_data: unknown, context: ExecutionContext): AuthContext => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  if (request.auth === undefined) throw ApiError.transverse('UNAUTHENTICATED');
  return request.auth;
});

/** `@MaybeAuth()` : le contexte s'il existe, pour une lecture publique personnalisée. */
export const MaybeAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | null =>
    context.switchToHttp().getRequest<AuthedRequest>().auth ?? null,
);
