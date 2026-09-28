import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  ADMIN_ERROR_CODES,
  ADMIN_ERROR_MESSAGES,
  type AdminErrorCode,
  STAFF_IDLE_MINUTES,
  STAFF_SESSION_COOKIE,
  STAFF_SESSION_HOURS,
  type StaffRoleValue,
} from '@app/shared';
import { ApiError } from './api-error';
import { CAPABILITY_KEY, PUBLIC_READ_KEY } from './capability.decorator';
import { CryptoService } from './crypto.service';
import { PrismaService } from './prisma.service';
import { STAFF_ROLE_KEY } from './staff-role.decorator';
import { TokenService } from './token.service';

/**
 * Garde de rôle d'équipe — 15-administration.md §2.1, §2.2 et 00 §7.4.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RÈGLE DURE (15 §2.1, 00 §7.4) : les comptes équipe et les comptes        │
 * │ membres sont HERMÉTIQUES. Sessions distinctes, cookie distinct, aucune   │
 * │ passerelle. Un jeton membre n'ouvre jamais une route d'équipe, et        │
 * │ réciproquement.                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * L'hermétisme n'est pas une intention : c'est une propriété de la STRUCTURE,
 * tenue par quatre faits indépendants, chacun suffisant seul.
 *
 *   1. **Deux transports.** Un membre présente `Authorization: Bearer <JWT>`.
 *      Un compte équipe présente le cookie `dp_staff`, dont le chemin est
 *      `/v1/admin`. Ce garde ne lit QUE le cookie ; il n'appelle jamais
 *      `TokenService.verify()` pour autoriser quoi que ce soit.
 *   2. **Deux formats.** Le jeton d'équipe est un secret opaque de 32 octets :
 *      `TokenService.verify()` le rejette (ni trois parties, ni l'en-tête
 *      attendu). Le jeton membre est un JWT : aucune ligne de `staff_sessions`
 *      ne porte son hachage, donc il n'ouvre rien ici.
 *   3. **Deux déclarations de route.** `@RequiresCapability` et
 *      `@RequiresStaffRole` sont EXCLUSIFS : une route qui porterait les deux est
 *      refusée avant tout contrôle d'identité (voir `AuthGuard`). Il n'existe
 *      donc aucune route « mixte » à travers laquelle un domaine pourrait
 *      atteindre l'autre.
 *   4. **Refus EXPLICITE de la confusion.** Quand une route d'équipe reçoit un
 *      jeton membre VALIDE, on répond `CROSS_DOMAIN_TOKEN` au lieu de l'ignorer.
 *      Ignorer serait déjà sûr ; refuser rend la tentative visible dans les
 *      journaux, et surtout fait ÉCHOUER tout de suite le code qui croirait
 *      pouvoir « réutiliser le jeton d'admin de l'application membres ».
 *
 * Le garde est GLOBAL et ne fait rien sur une route qui ne déclare pas de rôle :
 * c'est `AuthGuard` qui refuse par défaut. Deux gardes globaux, un par domaine,
 * et une route appartient toujours à exactement un des deux.
 *
 * L'ordre des contrôles n'est pas arbitraire — chacun suppose le précédent :
 *   a. la route est-elle une route d'équipe (sinon, rien à faire) ;
 *   b. l'IP est-elle permise (§2.1, `admin_allowed_cidrs`) — avant même de lire
 *      un identifiant : une restriction réseau qui s'applique après
 *      l'authentification ne protège plus rien ;
 *   c. aucun jeton membre n'accompagne-t-il la requête (hermétisme) ;
 *   d. la session d'équipe est-elle valide (cookie, hachage, expiration,
 *      révocation, inactivité) ;
 *   e. le compte est-il actif ;
 *   f. le rôle couvre-t-il la route (§2.2).
 */

/** Ce que le garde attache à la requête. Le pendant de `AuthContext`. */
export interface StaffUser {
  readonly staffId: string;
  readonly role: StaffRoleValue;
  readonly sessionId: string;
  /** L'IP de la requête, telle qu'`audit_logs.ip` l'attend. `null` si indéterminée. */
  readonly ip: string | null;
}

interface StaffRequest extends Request {
  staff?: StaffUser;
}

/**
 * `cookies` n'est PAS redéclaré sur `StaffRequest`.
 *
 * Le type d'Express le déclare requis, et le redéclarer optionnel fait échouer
 * `tsc` sous `exactOptionalPropertyTypes` — la requête cesse alors d'être
 * assignable à `Request`, ce qui casse tous les appels qui la passent plus loin.
 * Or il est bien optionnel en FAIT : sans `cookie-parser`, il est indéfini. On le
 * lit donc par cette vue, qui dit la vérité sans mentir au reste du typage.
 */
type WithCookies = { cookies?: Record<string, string | undefined> };

function fail(code: AdminErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(code, ADMIN_ERROR_MESSAGES[code], ADMIN_ERROR_CODES[code], details);
}

/**
 * Le cache de la liste de CIDR.
 *
 * Une lecture de `system_settings` par requête d'équipe serait un aller-retour
 * en base sur le chemin du garde, avant toute autre chose. Une minute, comme le
 * cache des feature flags du §4.3 : assez court pour qu'une restriction posée en
 * urgence prenne effet, assez long pour que la charge soit nulle.
 */
const CIDR_CACHE_MS = 60_000;

@Injectable()
export class StaffGuard implements CanActivate {
  private cidrCache: { at: number; cidrs: readonly string[] } | null = null;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<readonly StaffRoleValue[] | undefined>(
      STAFF_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const ip = clientIp(request);

    /**
     * (a) Route de membre : ce garde n'a rien à y faire, et surtout il ne pose
     * AUCUN contexte d'équipe. `@Staff()` y lèvera donc.
     *
     * Exception : la restriction réseau du §2.1 porte sur « l'application admin »,
     * donc sur TOUTE la surface `/v1/admin` — connexion comprise. Appliquée
     * seulement aux routes à rôle, elle laisserait `/v1/admin/auth/login`
     * joignable depuis n'importe où, c'est-à-dire laisserait ouverte la seule
     * route qu'une restriction réseau a un intérêt à fermer.
     */
    if (allowed === undefined) {
      if (isAdminSurface(request)) await this.assertIpAllowed(ip);
      return true;
    }

    // (b) Restriction réseau facultative, AVANT l'identité.
    await this.assertIpAllowed(ip);

    // (c) Hermétisme, contrôle explicite.
    this.assertNoMemberToken(request);

    // (d) La session d'équipe.
    const token = this.readCookie(request);
    if (token === null) fail('STAFF_SESSION_REQUIRED');

    const session = await this.prisma.staffSession.findUnique({
      where: { tokenHash: this.crypto.hashToken(token) },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        staff: { select: { id: true, role: true, isActive: true } },
      },
    });
    const now = new Date();
    if (session === null) fail('STAFF_SESSION_REQUIRED');
    if (session.revokedAt !== null) fail('STAFF_SESSION_REQUIRED');
    // `expiresAt` porte DEUX échéances à la fois — voir `slideExpiry`.
    if (session.expiresAt.getTime() <= now.getTime()) fail('STAFF_SESSION_REQUIRED');

    // (e) Un compte désactivé perd ses sessions à l'instant, sans attendre la
    // tâche de nettoyage : `is_active` est la seule source qui compte.
    if (!session.staff.isActive) fail('STAFF_SESSION_REQUIRED');

    // (f) Le rôle (§2.2).
    if (!allowed.includes(session.staff.role)) {
      fail('STAFF_ROLE_REQUIRED', { role: session.staff.role, allowed: [...allowed] });
    }

    await this.slideExpiry(session.id, session.createdAt, session.expiresAt, now);

    request.staff = {
      staffId: session.staff.id,
      role: session.staff.role,
      sessionId: session.id,
      ip,
    };
    return true;
  }

  /**
   * Prolonge la session à l'activité — §2.1 : « renouvellement à l'activité,
   * déconnexion à 30 min d'inactivité », dans une session de 8 h.
   *
   * `staff_sessions` n'a PAS de colonne `last_seen_at`, et le schéma est figé.
   * D'où ce choix : `expires_at` porte l'échéance D'INACTIVITÉ, et la borne
   * absolue se calcule depuis `created_at + 8 h`, qui existe. Les deux échéances
   * tiennent donc dans une seule colonne sans rien perdre :
   *
   *     expires_at = min(maintenant + 30 min, created_at + 8 h)
   *
   * Conséquence à connaître : `expires_at` n'est jamais à 8 h d'échéance sauf
   * dans les 30 dernières minutes de la session. C'est voulu — et c'est ce qui
   * fait qu'un onglet oublié ne reste pas ouvert huit heures.
   *
   * L'écriture est ÉVITÉE quand elle ne déplacerait l'échéance que de quelques
   * secondes : sans ce seuil, chaque requête d'équipe ferait un UPDATE, ce qui
   * multiplie les versions de ligne pour rien.
   */
  private async slideExpiry(
    sessionId: string,
    createdAt: Date,
    currentExpiry: Date,
    now: Date,
  ): Promise<void> {
    const absolute = createdAt.getTime() + STAFF_SESSION_HOURS * 3_600_000;
    const next = Math.min(now.getTime() + STAFF_IDLE_MINUTES * 60_000, absolute);
    if (next - currentExpiry.getTime() < 30_000) return;
    await this.prisma.staffSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(next) },
    });
  }

  /**
   * RÈGLE DURE : aucun jeton membre sur une route d'équipe.
   *
   * On ne se contente pas de ne pas le lire — on REFUSE. Le cas visé n'est pas
   * l'attaquant (pour qui l'ignorer suffirait), c'est le code de bonne foi : un
   * script de l'équipe qui recopie l'en-tête `Authorization` d'un appel membre,
   * une page d'admin qui hérite d'un intercepteur du front membres. Ignorer
   * laisserait ce code « marcher » tant qu'un cookie d'équipe traîne, et lier
   * silencieusement les deux domaines. Refuser le casse tout de suite.
   *
   * La vérification porte sur un jeton VALIDE : un en-tête `Authorization`
   * quelconque — `Basic`, un jeton expiré, du bruit — n'est pas une confusion de
   * domaine, et le refuser rendrait le message trompeur.
   */
  private assertNoMemberToken(request: StaffRequest): void {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return;
    const claims = this.tokens.verify(header.slice('Bearer '.length).trim());
    if (claims !== null) fail('CROSS_DOMAIN_TOKEN', { reason: 'jeton membre sur une route équipe' });
  }

  /**
   * §2.1 : « Restriction IP facultative par `system_settings.admin_allowed_cidrs` ».
   *
   * FACULTATIVE : une liste vide ou absente n'interdit rien. C'est le défaut du
   * registre, et il ne faut surtout pas l'inverser — une liste mal remplie
   * enfermerait l'équipe dehors, sans aucune route pour rentrer.
   *
   * Une IP indéterminée passe quand la liste est vide, et est REFUSÉE quand la
   * liste existe : si l'on a choisi de restreindre, « je ne sais pas d'où vient
   * cette requête » est un refus, pas un laissez-passer.
   */
  private async assertIpAllowed(ip: string | null): Promise<void> {
    const cidrs = await this.allowedCidrs();
    if (cidrs.length === 0) return;
    if (ip === null) fail('STAFF_IP_NOT_ALLOWED');
    if (!cidrs.some((cidr) => ipInCidr(ip, cidr))) fail('STAFF_IP_NOT_ALLOWED');
  }

  private async allowedCidrs(): Promise<readonly string[]> {
    const cached = this.cidrCache;
    if (cached !== null && Date.now() - cached.at < CIDR_CACHE_MS) return cached.cidrs;

    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'admin_allowed_cidrs' },
      select: { value: true },
    });
    const value = row?.value;
    const cidrs = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    this.cidrCache = { at: Date.now(), cidrs };
    return cidrs;
  }

  /**
   * Lit le cookie de session.
   *
   * Le repli sur l'en-tête `Cookie` brut est là parce que `cookie-parser` est un
   * intergiciel d'application : une application de test construite sans lui
   * laisse `request.cookies` indéfini, et TOUTES les routes d'équipe répondent
   * alors 401 — un symptôme qui ressemble à une session expirée et n'a rien à
   * voir. Le même piège est documenté dans `refresh-cookie.ts`.
   */
  private readCookie(request: StaffRequest): string | null {
    const parsed = (request as WithCookies).cookies?.[STAFF_SESSION_COOKIE];
    if (typeof parsed === 'string' && parsed.length > 0) return parsed;

    const header = request.headers.cookie;
    if (typeof header !== 'string') return null;
    for (const part of header.split(';')) {
      const index = part.indexOf('=');
      if (index === -1) continue;
      if (part.slice(0, index).trim() !== STAFF_SESSION_COOKIE) continue;
      const value = decodeURIComponent(part.slice(index + 1).trim());
      return value.length > 0 ? value : null;
    }
    return null;
  }
}

/**
 * `@Staff()` sur un paramètre : le contexte posé par le garde.
 *
 * Il LÈVE si le contexte manque, comme `@Auth()`. Un contrôleur qui demande le
 * compte équipe courant sur une route sans `@RequiresStaffRole` est un bug, et
 * il doit se voir tout de suite — pas se traduire en `staffId` indéfini glissé
 * dans un `audit_logs.actor_id`, où il produirait une trace anonyme d'une action
 * qui ne l'est pas.
 */
export const Staff = createParamDecorator((_data: unknown, context: ExecutionContext): StaffUser => {
  const request = context.switchToHttp().getRequest<StaffRequest>();
  if (request.staff === undefined) fail('STAFF_SESSION_REQUIRED');
  return request.staff;
});

/**
 * Le `StaffContext` que les services des autres modules attendent en premier
 * argument (`ModerationService`, notamment). Volontairement RÉDUIT : un service
 * métier n'a besoin ni de l'identifiant de session ni de l'IP, et lui donner
 * l'objet complet l'inviterait à s'en servir.
 */
export function staffContext(staff: StaffUser): { staffId: string; role: StaffRoleValue } {
  return { staffId: staff.staffId, role: staff.role };
}

/**
 * La requête vise-t-elle l'application admin ?
 *
 * Sur le CHEMIN, et non sur l'origine : `Origin` est absent d'un appel serveur à
 * serveur et forgeable ailleurs, alors que le préfixe `/v1/admin` du §5.1 est ce
 * que le routeur a réellement résolu. `originalUrl` est lu en repli parce que
 * `path` est relatif au préfixe global dans certaines configurations d'Express.
 */
function isAdminSurface(request: Request): boolean {
  const path = request.path ?? request.originalUrl ?? '';
  return path.startsWith('/v1/admin') || path.startsWith('/admin');
}

// ── Adresses ────────────────────────────────────────────────────────────────

/**
 * L'IP du client.
 *
 * `x-forwarded-for` est lu parce qu'en production l'API est derrière un proxy ;
 * on prend la PREMIÈRE entrée, qui est le client d'origine. C'est une valeur
 * qu'un client peut forger, et c'est pourquoi elle ne sert qu'à deux choses
 * sans conséquence de sécurité seule : la trace d'audit, et une restriction
 * réseau qui n'est qu'une couche de défense supplémentaire — jamais l'unique.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers['x-forwarded-for'];
  const raw =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : Array.isArray(forwarded)
        ? forwarded[0]
        : request.ip;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // `::ffff:127.0.0.1` : Node rend les IPv4 sous forme mappée quand la socket
  // écoute en IPv6. `audit_logs.ip` est un `inet` et l'accepte, mais une
  // comparaison de CIDR IPv4 échouerait sur cette forme.
  return trimmed.startsWith('::ffff:') ? trimmed.slice('::ffff:'.length) : trimmed;
}

/**
 * L'IP appartient-elle au CIDR ?
 *
 * Écrit à la main, en une vingtaine de lignes, plutôt qu'avec une dépendance :
 * c'est de l'arithmétique sur des entiers, et la chaîne d'approvisionnement du
 * garde d'authentification est le dernier endroit où ajouter un paquet.
 *
 * Toute forme non comprise rend `false` — jamais `true`. Un CIDR mal écrit doit
 * fermer la porte, pas l'ouvrir.
 */
export function ipInCidr(ip: string, cidr: string): boolean {
  const slash = cidr.lastIndexOf('/');
  if (slash === -1) return false;
  const network = cidr.slice(0, slash);
  const bits = Number(cidr.slice(slash + 1));
  if (!Number.isInteger(bits) || bits < 0) return false;

  const a = toBigInt(ip);
  const b = toBigInt(network);
  if (a === null || b === null) return false;
  // Une IPv4 et une IPv6 ne se comparent pas : la famille doit correspondre.
  if (a.width !== b.width) return false;
  if (bits > a.width) return false;

  const shift = BigInt(a.width - bits);
  return a.value >> shift === b.value >> shift;
}

function toBigInt(address: string): { value: bigint; width: number } | null {
  if (address.includes(':')) return ipv6ToBigInt(address);
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const byte = Number(part);
    if (byte > 255) return null;
    value = (value << 8n) | BigInt(byte);
  }
  return { value, width: 32 };
}

function ipv6ToBigInt(address: string): { value: bigint; width: number } | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] === '' || halves[0] === undefined ? [] : halves[0].split(':');
  const tail = halves.length === 2 && halves[1] !== '' && halves[1] !== undefined
    ? halves[1].split(':')
    : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = halves.length === 1 ? head : [...head, ...Array<string>(missing).fill('0'), ...tail];

  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(Number.parseInt(group, 16));
  }
  return { value, width: 128 };
}

/**
 * Une route d'équipe et une route de membre sont EXCLUSIVES. Exporté pour que
 * `AuthGuard` le dise avec les mêmes mots, et pour qu'un test puisse l'affirmer
 * sur le document OpenAPI complet.
 */
export function routeDeclaresBothDomains(
  staffRoles: readonly string[] | undefined,
  capability: string | undefined,
  isPublicRead: boolean | undefined,
): boolean {
  return staffRoles !== undefined && (capability !== undefined || isPublicRead === true);
}

export { CAPABILITY_KEY, PUBLIC_READ_KEY };
