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
import { CAPABILITY_KEY, PUBLIC_READ_KEY } from './capability.decorator';
import { type AccessClaims, TokenService } from './token.service';

/**
 * Garde d'authentification et de capacités — 00-fondations.md §7.3.
 *
 * Il est GLOBAL et refuse par défaut : une route qui ne déclare ni capacité ni
 * `@PublicRead()` est rejetée. L'inverse — ouvert par défaut — fait qu'un oubli
 * de décorateur devient une faille silencieuse, et un oubli finit toujours par
 * arriver.
 *
 * Trois contrôles, dans cet ordre, parce que chacun suppose le précédent :
 *   1. le jeton est-il valide (sinon 401) ;
 *   2. le compte est-il suspendu (sinon 403 — mais la LECTURE reste permise,
 *      §7.3 : « un compte suspendu peut toujours consulter ») ;
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

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    const capability = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isPublicRead = this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_READ_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

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

    // Suspendu : les écritures tombent, les lectures passent (§7.3).
    //
    // Le critère est la MÉTHODE HTTP, et non un champ « écriture » ajouté à la
    // matrice du §7.3 : celle-ci est la spec, et lui greffer une donnée dérivée
    // ferait deux sources là où il n'en faut qu'une.
    if (claims.status === 'SUSPENDED' && request.method !== 'GET' && request.method !== 'HEAD') {
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
