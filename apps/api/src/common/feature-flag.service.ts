import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Audience } from '@app/shared';
import { PrismaService } from './prisma.service';

/**
 * Feature flags — 15-administration.md §4.3 : « `FlagService.isEnabled(key, user)`
 * avec cache 1 min ».
 *
 * LU PAR L'API ET PAR LE WEB, avec la même règle : l'API appelle `isEnabled`
 * directement ; le web reçoit le résultat par `GET /me/flags` (jamais la règle :
 * « le front prévient, le serveur décide »).
 *
 * ── LA RÈGLE D'ÉVALUATION, ÉCRITE UNE FOIS ─────────────────────────────────────
 *
 *   1. le drapeau est inconnu            → la valeur par défaut du CODE (fermé) ;
 *   2. `isEnabled` est faux              → faux, quels que soient les autres champs ;
 *   3. `conditions` (villes, pays, phases, plans) : chaque dimension NON VIDE doit
 *      contenir la valeur du membre — un tableau vide ou absent veut dire « tous » ;
 *   4. `rolloutPct` : un hachage STABLE de (clé, membre) sur 0..99 doit être
 *      inférieur au pourcentage. Stable, donc un membre ne bascule pas d'une
 *      requête à l'autre, et élargir de 10 % à 20 % ne retire personne.
 *
 * SANS MEMBRE (lecture publique, tâche), les conditions et le pourcentage ne
 * peuvent pas être évalués : le drapeau n'est vrai que s'il est activé à 100 %
 * SANS condition. Un drapeau ciblé ne s'ouvre jamais à un visiteur anonyme.
 *
 * ── CACHE ──────────────────────────────────────────────────────────────────────
 *
 * Une minute, en mémoire du processus. Une écriture invalide le cache du
 * processus qui l'a faite ; les autres (le worker) se rattrapent à l'échéance —
 * c'est le « cache 1 min » du §4.3, et le délai maximal avant qu'un drapeau
 * coupé en incident le soit partout.
 */
export const FLAG_CACHE_MS = 60_000;

export interface FlagRow {
  readonly key: string;
  readonly isEnabled: boolean;
  readonly rolloutPct: number;
  readonly conditions: Audience | null;
}

export interface FlagSubject {
  readonly userId: string;
  readonly cityId?: string | null;
  readonly countryId?: string | null;
  readonly phase?: string | null;
  readonly plan?: string | null;
}

/** 0..99, stable pour un couple (clé, membre). */
export function rolloutBucket(key: string, userId: string): number {
  const digest = createHash('sha256').update(`${key}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

function dimensionAllows(allowed: readonly string[] | undefined, value: string | null | undefined): boolean {
  if (allowed === undefined || allowed.length === 0) return true;
  return value !== undefined && value !== null && allowed.includes(value);
}

/** La règle, PURE — éprouvable sans base. */
export function evaluateFlag(flag: FlagRow, subject: FlagSubject | null): boolean {
  if (!flag.isEnabled) return false;
  const c = flag.conditions;
  const hasConditions =
    c !== null &&
    ((c.cityIds?.length ?? 0) > 0 ||
      (c.countryIds?.length ?? 0) > 0 ||
      (c.phases?.length ?? 0) > 0 ||
      (c.plans?.length ?? 0) > 0);

  if (subject === null) return flag.rolloutPct >= 100 && !hasConditions;

  if (c !== null) {
    if (!dimensionAllows(c.cityIds, subject.cityId)) return false;
    if (!dimensionAllows(c.countryIds, subject.countryId)) return false;
    if (!dimensionAllows(c.phases, subject.phase)) return false;
    if (!dimensionAllows(c.plans, subject.plan)) return false;
  }
  if (flag.rolloutPct >= 100) return true;
  return rolloutBucket(flag.key, subject.userId) < flag.rolloutPct;
}

@Injectable()
export class FeatureFlagService {
  private cache: { at: number; flags: Map<string, FlagRow> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** À appeler après toute écriture sur `feature_flags`. */
  invalidate(): void {
    this.cache = null;
  }

  private async all(): Promise<Map<string, FlagRow>> {
    const now = Date.now();
    if (this.cache !== null && now - this.cache.at < FLAG_CACHE_MS) return this.cache.flags;
    const rows = await this.prisma.featureFlag.findMany({
      select: { key: true, isEnabled: true, rolloutPct: true, conditions: true },
    });
    const flags = new Map<string, FlagRow>(
      rows.map((r) => [
        r.key,
        {
          key: r.key,
          isEnabled: r.isEnabled,
          rolloutPct: r.rolloutPct,
          conditions: (r.conditions as Audience | null) ?? null,
        },
      ]),
    );
    this.cache = { at: now, flags };
    return flags;
  }

  /** Un drapeau inconnu rend `fallback` (faux par défaut) : le code décide de son défaut. */
  async isEnabled(key: string, subject: FlagSubject | null, fallback = false): Promise<boolean> {
    const flag = (await this.all()).get(key);
    if (flag === undefined) return fallback;
    return evaluateFlag(flag, subject);
  }

  /** Tous les drapeaux connus, évalués pour ce membre — ce que lit le web. */
  async evaluateAll(subject: FlagSubject | null): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const [key, flag] of await this.all()) out[key] = evaluateFlag(flag, subject);
    return out;
  }
}
