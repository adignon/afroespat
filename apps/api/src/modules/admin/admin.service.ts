import { Injectable } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ADMIN_ERROR_CODES,
  ADMIN_ERROR_MESSAGES,
  type AdminErrorCode,
  AUDIT_ACTIONS,
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_SETTING_TARGET_TYPE,
  type AuditQuery,
  type MemberCity,
  type MemberPhase,
  type MemberReason,
  type MemberSearchQuery,
  type Page,
  type ProApprove,
  type ProReject,
  type ProReviewQuery,
  SETTINGS_REGISTRY,
  SETTING_KEYS,
  type SettingKey,
  type StaffCreate,
  type StaffListQuery,
  type StaffRoleValue,
  type StaffUpdate,
  isSettingKey,
  looksLikePhone,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { loadEnv } from '../../config/env';
import { hashStaffPassword } from './staff-password';
import { StaffAuthService } from './staff-auth.service';

/**
 * Administration — 15-administration.md §2.2, §2.3, §3, §4.4.
 *
 * RÈGLE DURE (§2.3) : « Toute écriture depuis l'application admin passe par
 * `AuditService.record()` AVANT validation de la transaction. » Chaque méthode
 * d'écriture de ce fichier est donc un `$transaction` qui contient l'écriture ET
 * sa trace. Il n'y a pas d'exception, et il ne doit pas y en avoir : une ligne
 * d'audit posée après le commit laisse une fenêtre où l'action existe sans sa
 * trace, ce qui est exactement ce qu'un journal d'audit doit rendre impossible.
 *
 * RÈGLE DURE (§3.1) : « L'application admin n'affiche jamais un numéro de
 * téléphone en clair. » Le seul endroit de ce fichier qui touche à un numéro est
 * `memberDetail`, et il n'en sort que le MASQUE de `CryptoService.maskPhone`. La
 * recherche par numéro (§3.1) ne fait jamais voyager le numéro : elle en calcule
 * l'empreinte HMAC et n'envoie que celle-ci en base.
 *
 * ── Ce que le schéma figé interdit, et ce qu'on fait à la place ──────────────
 *
 * `member_notes` et `metric_snapshots`, annoncées « table ajoutée » par §6,
 * N'EXISTENT PAS. Les notes internes du §3.2 et les tableaux de bord du §5 ne sont
 * donc pas livrés — signalés, pas simulés. Une note interne écrite dans
 * `audit_logs.metadata` serait consultable, mais la table est en ajout seul :
 * elle ne pourrait être ni corrigée ni supprimée, et §11 exige que les notes
 * d'un membre supprimé disparaissent. L'écrire là serait créer une obligation
 * RGPD qu'on ne peut pas tenir.
 */

function fail(code: AdminErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(code, ADMIN_ERROR_MESSAGES[code], ADMIN_ERROR_CODES[code], details);
}

/**
 * Ce qu'une fiche pro expose à l'équipe qui la valide.
 *
 * `proofAsset` y est, et c'est la seule vue de la plateforme qui le montre : 00
 * §8.1 dit « justificatif d'activité : stocké, accès équipe uniquement, jamais
 * affiché ». « Jamais affiché » vise le côté membre — sans accès équipe, la
 * validation humaine du §4.1 n'aurait rien à regarder et la règle se retournerait
 * contre elle-même.
 */
const PRO_REVIEW_SELECT = {
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  businessName: true,
  description: true,
  priceHint: true,
  contactMethod: true,
  siret: true,
  verificationStatus: true,
  status: true,
  tier: true,
  user: { select: { id: true, handle: true, displayName: true, verificationLevel: true, status: true } },
  profession: { select: { id: true, nameFr: true } },
  proofAsset: { select: { id: true, mime: true, sizeBytes: true, status: true, storageKey: true } },
  cities: { select: { city: { select: { id: true, name: true, slug: true } } } },
} as const satisfies Prisma.ProProfileSelect;

@Injectable()
export class AdminService {
  private readonly cursorSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly staffAuth: StaffAuthService,
  ) {
    this.cursorSecret = loadEnv().CURSOR_SECRET;
  }

  // ════════════════════════════════════════════════════════════════════════
  // §2.2 — Comptes équipe  (CRUD /staff, SUPER_ADMIN)
  // ════════════════════════════════════════════════════════════════════════

  async listStaff(query: StaffListQuery): Promise<Page<unknown>> {
    // UNE seule condition par clé, assemblée en un objet. Deux diffusions
    // conditionnelles portant la même clé s'écrasent silencieusement.
    const where: Prisma.StaffUserWhereInput = {
      ...(query.role === undefined ? {} : { role: query.role }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const scope = `admin:staff:${query.role ?? ''}:${String(query.isActive)}`;

    const rows = await this.prisma.staffUser.findMany({
      where: this.paginate(where, query.cursor, scope),
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        createdAt: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        totpSecretEncrypted: true,
      },
    });

    // `totpSecretEncrypted` est LU pour en déduire l'enrôlement, et JAMAIS rendu :
    // c'est un secret, même chiffré. Le booléen est ce que l'écran a besoin de
    // savoir (§8, « enrôlement TOTP forcé »).
    const items = rows.map(({ totpSecretEncrypted, ...rest }) => ({
      ...rest,
      totpEnrolled: totpSecretEncrypted.length > 0,
    }));
    return buildPage(items, query.limit, scope, this.cursorSecret);
  }

  async createStaff(staff: StaffUser, input: StaffCreate) {
    const existing = await this.prisma.staffUser.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing !== null) fail('STAFF_EMAIL_TAKEN');

    const id = newId();
    const passwordHash = await hashStaffPassword(input.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.create({
        data: {
          id,
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          // §2.1 : « enrôlement forcé à la première connexion ». `Bytes` est NON
          // NUL, donc « pas de secret » s'écrit « secret de longueur nulle » —
          // faute de la colonne `totp_enrolled_at` annoncée par §6.
          totpSecretEncrypted: new Uint8Array(0),
          role: input.role,
          isActive: true,
        },
      });
      // `created_by_staff_id` du §6 n'existe pas : `actor_id` de cette ligne le dit.
      await this.record(tx, staff, {
        action: AUDIT_ACTIONS.staffCreated,
        targetType: 'staff_user',
        targetId: id,
        metadata: { role: input.role, displayName: input.displayName },
      });
    });

    return { id, email: input.email, displayName: input.displayName, role: input.role, isActive: true };
  }

  /**
   * §2.2 : « Un `SUPER_ADMIN` ne peut pas retirer son propre rôle ni supprimer son
   * compte s'il est le dernier. »
   *
   * Lu comme DEUX interdits, parce que la phrase en porte deux et qu'un seul ne
   * suffirait pas :
   *   · on ne modifie jamais son PROPRE rôle. Se rétrograder soi-même est
   *     toujours une erreur, même s'il reste dix `SUPER_ADMIN` : le geste est
   *     irréversible pour son auteur, qui perd du même coup le droit de le
   *     défaire ;
   *   · on ne retire jamais le DERNIER `SUPER_ADMIN` actif, ni en changeant son
   *     rôle, ni en le désactivant. Sans ce second interdit, deux
   *     `SUPER_ADMIN` peuvent se rétrograder l'un l'autre et la plateforme se
   *     retrouve sans personne pour gérer les comptes — état dont aucune route ne
   *     permet de sortir.
   */
  async updateStaff(staff: StaffUser, targetId: string, input: StaffUpdate) {
    const target = await this.prisma.staffUser.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, displayName: true, role: true, isActive: true },
    });
    if (target === null) throw ApiError.notFound();

    if (input.role !== undefined && target.id === staff.staffId && input.role !== target.role) {
      fail('SELF_ROLE_CHANGE');
    }

    const losesSuperAdmin =
      target.role === 'SUPER_ADMIN' &&
      target.isActive &&
      ((input.role !== undefined && input.role !== 'SUPER_ADMIN') || input.isActive === false);
    if (losesSuperAdmin && (await this.activeSuperAdmins()) <= 1) fail('LAST_SUPER_ADMIN');

    const changes: Record<string, Prisma.InputJsonValue> = {};
    if (input.displayName !== undefined && input.displayName !== target.displayName) {
      changes['displayName'] = { from: target.displayName, to: input.displayName };
    }
    if (input.role !== undefined && input.role !== target.role) {
      changes['role'] = { from: target.role, to: input.role };
    }
    if (input.isActive !== undefined && input.isActive !== target.isActive) {
      changes['isActive'] = { from: target.isActive, to: input.isActive };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staffUser.update({
        where: { id: targetId },
        data: {
          ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
          ...(input.role === undefined ? {} : { role: input.role }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
      });
      // Une désactivation coupe les sessions dans la MÊME transaction : sinon le
      // compte reste utilisable jusqu'à la fin de sa session courante, ce qui n'est
      // pas ce que « désactiver » veut dire.
      if (input.isActive === false) await this.staffAuth.revokeAllSessions(tx, targetId);

      // §2.3 : « metadata avant/après (champs modifiés uniquement) ».
      await this.record(tx, staff, {
        action: AUDIT_ACTIONS.staffUpdated,
        targetType: 'staff_user',
        targetId,
        metadata: { changes },
      });
    });

    return {
      id: targetId,
      email: target.email,
      displayName: input.displayName ?? target.displayName,
      role: input.role ?? target.role,
      isActive: input.isActive ?? target.isActive,
    };
  }

  /**
   * La suppression d'un compte équipe — refusée, et c'est une DÉCISION PRODUIT à
   * prendre, pas un manque.
   *
   * `§7` annonce un CRUD complet sur `/staff`. Le `D` est impossible dès qu'un
   * compte a agi, et la base le dit mieux que n'importe quel commentaire :
   * `moderation_actions.staff_id` et `sanctions.issued_by_staff_id` sont en
   * `onDelete: SetNull`, donc une suppression tente un UPDATE sur ces tables — qui
   * sont en AJOUT SEUL, et dont le déclencheur refuse l'UPDATE. `announcements`
   * est en `Restrict` et bloque tout autant.
   *
   * Ce n'est pas un défaut : un journal de modération dont on peut effacer
   * l'auteur n'est plus un journal. Le départ d'un modérateur se traite par
   * `isActive = false`, ce qui coupe immédiatement ses sessions. Reste une vraie
   * question de produit — que faire de son email et de son nom après son départ,
   * puisque le RGPD lui donne des droits et que la traçabilité en donne d'autres.
   * Remontée dans le rapport.
   */
  deleteStaff(): never {
    fail('STAFF_DELETE_UNSUPPORTED');
  }

  private async activeSuperAdmins(): Promise<number> {
    return this.prisma.staffUser.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
  }

  // ════════════════════════════════════════════════════════════════════════
  // §2.3 — Journal d'audit
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `GET /audit?actor&action&target&from&to` (§7).
   *
   * ATTENTION au piège qui a coûté cher à trois modules : `from` et `to` portent
   * tous deux sur `createdAt`. Écrits en deux diffusions conditionnelles
   * (`...(from ? { createdAt: { gte: from } } : {})` puis `...(to ? { createdAt:
   * { lte: to } } : {})`), la seconde ÉCRASE la première et le filtre de début
   * disparaît sans un mot. L'intervalle est donc construit en une fois, et le test
   * « from ET to ensemble » existe pour cela.
   */
  async listAudit(query: AuditQuery): Promise<Page<unknown>> {
    const where = auditWhere(query);
    const scope = auditScope(query);

    const rows = await this.prisma.auditLog.findMany({
      where: this.paginate(where, query.cursor, scope),
      // Le plus récent d'abord : c'est l'ordre d'une page d'enquête. Les
      // identifiants sont des UUID v7, donc `id desc` vaut `created_at desc` sans
      // second critère de tri.
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        createdAt: true,
        actorType: true,
        actorId: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        ip: true,
      },
    });
    return buildPage(rows, query.limit, scope, this.cursorSecret);
  }

  /**
   * `GET /audit/export` (§7) : le même filtre, en CSV.
   *
   * Plafonné à `AUDIT_EXPORT_MAX_ROWS`. Un export non borné sur une table de cinq
   * ans de traces est un moyen sûr de faire tomber le processus — et la réponse
   * dit combien de lignes ont été rendues, pour qu'un export tronqué ne passe pas
   * pour un export complet.
   */
  async exportAudit(query: AuditQuery): Promise<{ csv: string; rows: number; truncated: boolean }> {
    const rows = await this.prisma.auditLog.findMany({
      where: auditWhere(query),
      orderBy: { id: 'desc' },
      take: AUDIT_EXPORT_MAX_ROWS + 1,
      select: {
        id: true,
        createdAt: true,
        actorType: true,
        actorId: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        ip: true,
      },
    });
    const truncated = rows.length > AUDIT_EXPORT_MAX_ROWS;
    const kept = truncated ? rows.slice(0, AUDIT_EXPORT_MAX_ROWS) : rows;

    const header = 'id,created_at,actor_type,actor_id,action,target_type,target_id,ip,metadata';
    const body = kept.map((row) =>
      [
        row.id,
        row.createdAt.toISOString(),
        row.actorType,
        row.actorId ?? '',
        row.action,
        row.targetType,
        row.targetId ?? '',
        row.ip ?? '',
        row.metadata === null ? '' : JSON.stringify(row.metadata),
      ]
        .map(csvCell)
        .join(','),
    );
    return { csv: [header, ...body].join('\n'), rows: kept.length, truncated };
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.4 — Paramètres système
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `GET /settings` : le registre ENTIER, valeur effective comprise.
   *
   * On rend aussi les clés jamais écrites, avec leur défaut et `isDefault: true`.
   * §4.4 exige « tous avec valeur par défaut dans le code » : une page de réglages
   * qui n'affiche que les lignes présentes en base laisse croire que les autres
   * seuils n'existent pas, et c'est ainsi qu'on finit par recréer en dur une valeur
   * qui était déjà réglable.
   */
  async listSettings() {
    const rows = await this.prisma.systemSetting.findMany({
      select: { key: true, value: true, updatedAt: true, updatedByStaffId: true },
    });
    const stored = new Map(rows.map((row) => [row.key, row]));

    return {
      items: SETTING_KEYS.map((key) => {
        const definition = SETTINGS_REGISTRY[key];
        const row = stored.get(key);
        return {
          key,
          value: row === undefined ? definition.defaultValue : row.value,
          defaultValue: definition.defaultValue,
          isDefault: row === undefined,
          description: definition.description,
          requiredRole: [...definition.role],
          updatedAt: row?.updatedAt ?? null,
          updatedByStaffId: row?.updatedByStaffId ?? null,
        };
      }),
      // Les clés présentes en base mais ABSENTES du registre. Elles existent — le
      // module 13 en écrit une — et les taire donnerait une page de réglages qui
      // ment sur l'état réel de la table.
      unregistered: rows.filter((row) => !isSettingKey(row.key)).map((row) => row.key),
    };
  }

  async getSetting(key: string) {
    if (!isSettingKey(key)) fail('UNKNOWN_SETTING', { key });
    const definition = SETTINGS_REGISTRY[key];
    const row = await this.prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true, updatedAt: true, updatedByStaffId: true },
    });
    return {
      key,
      value: row === null ? definition.defaultValue : row.value,
      defaultValue: definition.defaultValue,
      isDefault: row === null,
      description: definition.description,
      requiredRole: [...definition.role],
      updatedAt: row?.updatedAt ?? null,
      updatedByStaffId: row?.updatedByStaffId ?? null,
    };
  }

  /**
   * `PUT /settings/:key` (§7 : « SUPER_ADMIN (certaines clés CONTENT_ADMIN) »).
   *
   * Le rôle est vérifié ICI, par CLÉ, en plus du garde de route. Le garde ne peut
   * pas le faire : il ne lit pas le corps de la requête, et une route ouverte au
   * rôle le plus faible du registre laisserait un `CONTENT_ADMIN` écrire les poids
   * du score de risque. C'est le seul endroit du module où une autorisation vit
   * hors du garde, et c'est parce que la donnée décide du droit.
   */
  async putSetting(staff: StaffUser, key: string, rawValue: unknown, reason?: string) {
    if (!isSettingKey(key)) fail('UNKNOWN_SETTING', { key });
    const definition = SETTINGS_REGISTRY[key satisfies SettingKey];

    if (!(definition.role as readonly StaffRoleValue[]).includes(staff.role)) {
      fail('STAFF_ROLE_REQUIRED', { key, role: staff.role, allowed: [...definition.role] });
    }

    const parsed = definition.schema.safeParse(rawValue);
    if (!parsed.success) {
      throw ApiError.validation(
        parsed.error.issues.map((issue) => ({
          path: ['value', ...issue.path.map(String)].join('.'),
          code: issue.code.toUpperCase(),
          ...(issue.code === 'custom' ? { message: issue.message } : {}),
        })),
      );
    }
    const value = parsed.data as Prisma.InputJsonValue;

    const before = await this.prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedByStaffId: staff.staffId },
        update: { value, updatedByStaffId: staff.staffId },
      });
      /**
       * LIMITE CONNUE DU SCHÉMA : `audit_logs.target_id` est de type `Uuid`. La
       * clé d'un `system_settings` est une CHAÎNE, elle ne peut donc pas y entrer
       * — Postgres refuse l'écriture. Elle passe par les métadonnées, sous `key`,
       * et `target_id` reste nul. Toute requête d'audit sur un réglage filtre donc
       * par `targetType` + `metadata`, jamais par `targetId`.
       */
      await this.record(tx, staff, {
        action: AUDIT_ACTIONS.settingChanged,
        targetType: AUDIT_SETTING_TARGET_TYPE,
        metadata: {
          key,
          before: before === null ? null : before.value,
          after: value,
          ...(reason === undefined ? {} : { reason }),
        },
      });
    });

    return { key, value, isDefault: false };
  }

  // ════════════════════════════════════════════════════════════════════════
  // §2.2 — Validation des fiches professionnelles
  // ════════════════════════════════════════════════════════════════════════

  /**
   * La file des justificatifs en attente (§8, écran « Services »).
   *
   * C'est la route qui débloque le module 10 : `10` §4.1 fait de la validation une
   * décision HUMAINE, et sans elle aucune fiche ne passe jamais en `APPROVED` —
   * donc l'annuaire reste vide en production.
   *
   * `deletedAt: null` plutôt qu'un `notIn` sur les statuts : la colonne est
   * NULLABLE, et un `notIn` sur une colonne nullable élimine AUSSI les lignes à
   * `NULL` en SQL — c'est-à-dire, ici, toutes les fiches vivantes. Le piège est
   * assez sournois pour qu'on préfère la condition positive partout où elle
   * suffit ; là où elle ne suffit pas, il faut `OR: [{ col: null }, { col: { notIn } }]`.
   */
  async listProProfiles(query: ProReviewQuery): Promise<Page<unknown>> {
    const where: Prisma.ProProfileWhereInput = {
      verificationStatus: query.status,
      deletedAt: null,
    };
    const scope = `admin:pros:${query.status}`;

    const rows = await this.prisma.proProfile.findMany({
      where: this.paginate(where, query.cursor, scope),
      // Les plus ANCIENNES d'abord : une file d'attente se traite dans l'ordre
      // d'arrivée, et les UUID v7 donnent cet ordre sans colonne supplémentaire.
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: PRO_REVIEW_SELECT,
    });

    const items = rows.map((row) => shapeProReview(row));
    return buildPage(items, query.limit, scope, this.cursorSecret);
  }

  /**
   * Le détail d'une fiche, avec l'HISTORIQUE DES DÉCISIONS.
   *
   * ── Les trois colonnes manquantes, et le contournement ─────────────────────
   *
   * `10` §5 annonce `pro_profiles.approved_at`, `approved_by_staff_id` et
   * `rejection_reason` comme « ajoutées ». Elles ne sont PAS dans le schéma, qui
   * est figé, et il n'y a pas de migration.
   *
   * Le contournement n'est pas un pis-aller : les trois informations sont
   * EXACTEMENT ce qu'une ligne d'`audit_logs` porte déjà.
   *
   *     approved_at          → audit_logs.created_at
   *     approved_by_staff_id → audit_logs.actor_id
   *     rejection_reason     → audit_logs.metadata.reason
   *
   * Et `target_id` accepte l'identifiant d'une fiche, qui est un UUID — la limite
   * qui gêne les réglages ne gêne pas ici. Le résultat est même meilleur que les
   * trois colonnes : la table est en AJOUT SEUL, donc l'historique COMPLET des
   * décisions est conservé (une fiche refusée, corrigée, puis validée garde les
   * deux décisions), là où trois colonnes n'auraient gardé que la dernière. Et la
   * conservation est de cinq ans, garantie par la base.
   *
   * Ce que le contournement NE donne pas, et qu'il faut savoir : on ne peut pas
   * TRIER ni FILTRER les fiches sur leur date de validation sans jointure, et une
   * purge d'audit à cinq ans effacerait les décisions les plus anciennes. Aucun
   * écran de la spec n'en a besoin aujourd'hui.
   */
  async proProfileDetail(proProfileId: string) {
    const row = await this.prisma.proProfile.findFirst({
      where: { id: proProfileId, deletedAt: null },
      select: PRO_REVIEW_SELECT,
    });
    if (row === null) throw ApiError.notFound();

    return { ...shapeProReview(row), decisions: await this.proDecisions(proProfileId) };
  }

  /** §4.1 du module 10 : la validation humaine. Fait passer la fiche en `APPROVED`. */
  async approveProProfile(staff: StaffUser, proProfileId: string, input: ProApprove) {
    return this.decideProProfile(staff, proProfileId, {
      status: 'APPROVED',
      action: AUDIT_ACTIONS.proApproved,
      event: 'pro.approved',
      ...(input.note === undefined ? {} : { note: input.note }),
    });
  }

  /** Le refus. Motif OBLIGATOIRE et long : il est rendu au membre, qui doit corriger. */
  async rejectProProfile(staff: StaffUser, proProfileId: string, input: ProReject) {
    return this.decideProProfile(staff, proProfileId, {
      status: 'REJECTED',
      action: AUDIT_ACTIONS.proRejected,
      event: 'pro.rejected',
      reason: input.reason,
    });
  }

  private async decideProProfile(
    staff: StaffUser,
    proProfileId: string,
    decision: {
      status: 'APPROVED' | 'REJECTED';
      action: string;
      event: 'pro.approved' | 'pro.rejected';
      reason?: string;
      note?: string;
    },
  ) {
    const found = await this.prisma.proProfile.findFirst({
      where: { id: proProfileId, deletedAt: null },
      select: { id: true, userId: true, verificationStatus: true, proofAssetId: true },
    });
    if (found === null) throw ApiError.notFound();
    // Une fiche déjà tranchée ne se retranche pas : le membre doit d'abord la
    // resoumettre, ce que `ProsService.submitProof` fait en la remettant `PENDING`.
    // Sans ce refus, deux membres de l'équipe qui ouvrent la même file écriraient
    // deux décisions contradictoires, la dernière gagnant en silence.
    if (found.verificationStatus !== 'PENDING') {
      fail('PRO_NOT_PENDING', { verificationStatus: found.verificationStatus });
    }

    const decidedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.proProfile.update({
        where: { id: proProfileId },
        data: { verificationStatus: decision.status },
      });
      await this.record(tx, staff, {
        action: decision.action,
        targetType: 'pro_profile',
        targetId: proProfileId,
        metadata: {
          userId: found.userId,
          before: found.verificationStatus,
          after: decision.status,
          // Le justificatif regardé, par son identifiant seul — jamais son contenu.
          proofAssetId: found.proofAssetId,
          ...(decision.reason === undefined ? {} : { reason: decision.reason }),
          ...(decision.note === undefined ? {} : { note: decision.note }),
        },
      });
      // Dans la MÊME transaction que la décision (§9.1 du module 00) : une fiche
      // validée dont l'événement se perd n'est indexée nulle part, et le membre
      // n'apprend jamais que sa fiche est en ligne.
      await this.outbox.emit(tx, {
        type: decision.event,
        aggregateId: proProfileId,
        payload: {
          proProfileId,
          userId: found.userId,
          staffId: staff.staffId,
          ...(decision.reason === undefined ? {} : { reason: decision.reason }),
        },
      });
    });

    return {
      id: proProfileId,
      verificationStatus: decision.status,
      decidedAt,
      decidedByStaffId: staff.staffId,
      ...(decision.reason === undefined ? {} : { reason: decision.reason }),
    };
  }

  /** L'historique des décisions, reconstitué depuis `audit_logs` (voir `proProfileDetail`). */
  private async proDecisions(proProfileId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        targetType: 'pro_profile',
        targetId: proProfileId,
        action: { in: [AUDIT_ACTIONS.proApproved, AUDIT_ACTIONS.proRejected] },
      },
      orderBy: { id: 'desc' },
      select: { id: true, createdAt: true, action: true, actorId: true, metadata: true },
    });
    return rows.map((row) => ({
      id: row.id,
      at: row.createdAt,
      decision: row.action === AUDIT_ACTIONS.proApproved ? 'APPROVED' : 'REJECTED',
      byStaffId: row.actorId,
      reason: readMetadataString(row.metadata, 'reason'),
      note: readMetadataString(row.metadata, 'note'),
    }));
  }

  // ════════════════════════════════════════════════════════════════════════
  // §3 — Fiche membre
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `GET /users?q` (§3.1) : handle, nom d'affichage, ou NUMÉRO.
   *
   * RÈGLE DURE (§3.1) : « saisie du numéro → HMAC → recherche, le numéro n'est
   * jamais affiché ». Le numéro ne part donc jamais en base : seule son empreinte
   * le fait, et la réponse ne contient aucun numéro, pas même masqué — c'est la
   * fiche, et elle seule, qui montre un masque.
   *
   * La recherche par numéro est EXACTE, par construction : une empreinte HMAC n'a
   * pas de préfixe exploitable. Il faut le numéro complet au format E.164, ce qui
   * est aussi la bonne propriété du point de vue de la vie privée — on ne peut pas
   * parcourir la base par tâtonnement.
   */
  async searchMembers(query: MemberSearchQuery): Promise<Page<unknown>> {
    const q = query.q.trim();
    const byPhone = looksLikePhone(q);

    let userIds: string[] | null = null;
    if (byPhone) {
      const normalized = q.replace(/[\s.-]/g, '');
      const matches = await this.prisma.phoneNumber.findMany({
        where: { phoneHmac: this.crypto.phoneFingerprint(normalized) },
        select: { userId: true },
      });
      userIds = matches.map((m) => m.userId);
    }

    // UN seul objet `where`. Le filtre de texte et les filtres d'énumération
    // portent sur des clés différentes, mais la règle est la même partout dans ce
    // fichier : on assemble, on n'empile pas de diffusions.
    const where: Prisma.UserWhereInput = {
      ...(userIds === null
        ? {
            OR: [
              { handle: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : // Une liste vide donne `in: []`, donc zéro résultat — ce qui est juste :
          // « ce numéro n'est pas connu ». Pas de repli sur la recherche texte, qui
          // renverrait des membres sans rapport avec la saisie.
          { id: { in: userIds } }),
      ...(query.phase === undefined ? {} : { phase: query.phase }),
      ...(query.status === undefined ? {} : { status: query.status }),
    };
    const scope = `admin:users:${byPhone ? 'phone' : q}:${query.phase ?? ''}:${query.status ?? ''}`;

    const rows = await this.prisma.user.findMany({
      where: this.paginate(where, query.cursor, scope),
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        createdAt: true,
        handle: true,
        displayName: true,
        phase: true,
        verificationLevel: true,
        plan: true,
        status: true,
        lastSeenAt: true,
        deletedAt: true,
        city: { select: { id: true, name: true } },
        originCountry: { select: { id: true, iso2: true, nameFr: true } },
      },
    });
    return buildPage(rows, query.limit, scope, this.cursorSecret);
  }

  /**
   * `GET /users/:id` (§3.1) : la fiche.
   *
   * RÈGLE DURE (§3.1) : « jamais un numéro de téléphone en clair, ni la lecture
   * d'une conversation privée hors d'un dossier de modération qui la joint ».
   *
   * Le numéro sort MASQUÉ, par `CryptoService.maskPhone` — la même fonction que
   * le membre voit sur son propre profil. La conversation privée n'est pas ici du
   * tout : ce service ne touche ni `conversations` ni `messages`, et la seule
   * façon d'en voir une reste `ModerationService.caseDetail`, qui la joint à un
   * dossier. Une règle tenue en n'écrivant pas le code est une règle qu'aucune
   * modification future ne peut casser par distraction.
   */
  async memberDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        handle: true,
        displayName: true,
        phase: true,
        verificationLevel: true,
        plan: true,
        status: true,
        timezone: true,
        lastSeenAt: true,
        deactivatedAt: true,
        arrivalDate: true,
        onboardingStep: true,
        city: { select: { id: true, name: true, slug: true } },
        originCountry: { select: { id: true, iso2: true, nameFr: true } },
        phoneNumbers: {
          select: {
            id: true,
            phoneEncrypted: true,
            isPrimary: true,
            isDestination: true,
            verifiedAt: true,
            country: { select: { id: true, iso2: true, dialCode: true } },
          },
        },
        kycVerifications: {
          select: { id: true, status: true, decidedAt: true, isAdult: true, provider: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        stats: true,
        // `consents` n'a ni `kind` ni `grantedAt`/`revokedAt` : le schéma porte
        // `type`, `version`, `granted` et `created_at`. Un consentement retiré est
        // une NOUVELLE ligne à `granted: false`, pas une colonne de révocation.
        consents: {
          select: { id: true, type: true, version: true, granted: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        sanctions: {
          select: { id: true, type: true, reason: true, startsAt: true, endsAt: true, liftedAt: true },
          orderBy: { startsAt: 'desc' },
        },
        dataExports: { select: { id: true, status: true, createdAt: true, readyAt: true, expiresAt: true } },
        deletionRequests: {
          // `executeAfter` et non `effectiveAt` : c'est le nom du schéma (01 §2.8,
          // requested_at + 7 jours).
          select: { id: true, requestedAt: true, executeAfter: true, cancelledAt: true, executedAt: true },
        },
      },
    });
    if (user === null) throw ApiError.notFound();

    const { phoneNumbers, ...rest } = user;

    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, deviceLabel: true, ip: true, lastUsedAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...rest,
      phones: phoneNumbers.map((phone) => ({
        id: phone.id,
        // Le déchiffrement puis le masquage. Le clair n'existe que le temps d'un
        // appel local et ne sort jamais de cette expression.
        masked: this.crypto.maskPhone(
          this.crypto.decryptPhone(phone.phoneEncrypted),
          phone.country.dialCode,
        ),
        countryIso2: phone.country.iso2,
        isPrimary: phone.isPrimary,
        isDestination: phone.isDestination,
        verifiedAt: phone.verifiedAt,
      })),
      activeSessions: sessions,
      moderationCases: await this.prisma.moderationCase.findMany({
        where: { subjectAuthorUserId: userId },
        select: { id: true, createdAt: true, subjectType: true, priority: true, status: true, resolution: true },
        orderBy: { id: 'desc' },
        take: 20,
      }),
    };
  }

  /** §3.2 : « Révoquer les sessions » — SUPPORT. */
  async revokeMemberSessions(staff: StaffUser, userId: string, input: MemberReason) {
    await this.assertMemberExists(userId);
    let revoked = 0;
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      revoked = result.count;
      await this.record(tx, staff, {
        action: AUDIT_ACTIONS.userSessionsRevoked,
        targetType: 'user',
        targetId: userId,
        metadata: { reason: input.reason, revoked },
      });
    });
    return { userId, revoked };
  }

  /**
   * §3.2 : « Désactiver / réactiver » — MODERATOR.
   *
   * Une désactivation révoque les sessions, comme `01` §2.7 l'exige : laisser un
   * jeton d'accès valide quinze minutes après une désactivation, c'est ne pas
   * l'avoir faite. Le garde des membres refuse déjà les comptes `DEACTIVATED`,
   * mais couper les sessions de rafraîchissement est ce qui rend la mesure
   * durable.
   */
  async setMemberActive(staff: StaffUser, userId: string, active: boolean, input: MemberReason) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (user === null || user.deletedAt !== null) throw ApiError.notFound();
    /**
     * BOGUE ÉVITÉ ICI, et il valait la peine d'être cherché.
     *
     * `UserStatus` n'a PAS de valeur `BANNED` : 13 §4.2, ligne pour ligne, écrit
     * `status = 'DEACTIVATED'` sur un `BAN_USER`. Un membre banni définitivement
     * est donc, en base, indistinguable d'un membre simplement désactivé — et
     * `POST /users/:id/reactivate` l'aurait DÉBANNI, sans le moindre message, en
     * contournant une décision réservée au SUPER_ADMIN.
     *
     * La distinction se lit dans `sanctions` : un bannissement est une ligne
     * `type: 'BAN'` non levée. C'est la seule source qui la porte.
     */
    if (user.status === 'SUSPENDED') {
      throw ApiError.transverse('CONFLICT', { reason: 'compte sous sanction', status: user.status });
    }
    if (active) {
      const ban = await this.prisma.sanction.findFirst({
        where: { userId, type: 'BAN', liftedAt: null },
        select: { id: true },
      });
      if (ban !== null) {
        throw ApiError.transverse('CONFLICT', {
          reason: 'compte banni : lever la sanction depuis la modération',
          sanctionId: ban.id,
        });
      }
    }
    const target = active ? 'ACTIVE' : 'DEACTIVATED';
    if (user.status === target) throw ApiError.transverse('CONFLICT', { status: user.status });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: target, deactivatedAt: active ? null : new Date() },
      });
      if (!active) {
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.record(tx, staff, {
        action: active ? AUDIT_ACTIONS.userReactivated : AUDIT_ACTIONS.userDeactivated,
        targetType: 'user',
        targetId: userId,
        metadata: { reason: input.reason, before: user.status, after: target },
      });
      await this.outbox.emit(tx, {
        type: active ? 'user.reactivated' : 'user.deactivated',
        aggregateId: userId,
        payload: { userId, byStaffId: staff.staffId },
      });
    });
    return { userId, status: target };
  }

  /**
   * §3.2 : « Forcer une phase » — SUPPORT, « correction à la demande du membre,
   * tracée ».
   *
   * `phaseSetManuallyAt` est posé, sans quoi la progression automatique de `01` §3
   * annulerait la correction à la prochaine passe — le membre rappellerait, et
   * l'équipe recommencerait, sans comprendre.
   */
  async forceMemberPhase(staff: StaffUser, userId: string, input: MemberPhase) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phase: true, deletedAt: true },
    });
    if (user === null || user.deletedAt !== null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { phase: input.phase, phaseSetManuallyAt: new Date() },
      });
      await this.record(tx, staff, {
        action: AUDIT_ACTIONS.userPhaseForced,
        targetType: 'user',
        targetId: userId,
        metadata: { reason: input.reason, before: user.phase, after: input.phase },
      });
      await this.outbox.emit(tx, {
        type: 'user.phase_changed',
        aggregateId: userId,
        payload: { userId, from: user.phase, to: input.phase, byStaffId: staff.staffId },
      });
    });
    return { userId, phase: input.phase };
  }

  /** §3.2 : « Forcer … une ville » — SUPPORT. */
  async forceMemberCity(staff: StaffUser, userId: string, input: MemberCity) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, cityId: true, deletedAt: true },
    });
    if (user === null || user.deletedAt !== null) throw ApiError.notFound();

    if (input.cityId !== null) {
      const city = await this.prisma.city.findUnique({
        where: { id: input.cityId },
        select: { id: true, isActive: true },
      });
      // Une ville inactive n'est proposée nulle part côté membres (02 §2.1) : la
      // poser depuis l'admin mettrait le membre dans une ville qui n'existe pas
      // pour lui, sans réseau ni agenda.
      if (city === null || !city.isActive) {
        throw ApiError.validation([{ path: 'cityId', code: 'NOT_FOUND' }]);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { cityId: input.cityId } });
      await this.record(tx, staff, {
        action: AUDIT_ACTIONS.userCityForced,
        targetType: 'user',
        targetId: userId,
        metadata: { reason: input.reason, before: user.cityId, after: input.cityId },
      });
      // `user.onboarded_location` est l'événement auquel les réseaux automatiques
      // s'abonnent (07 §6) : un changement de ville doit réaffecter le membre, sinon
      // il reste dans le réseau de son ancienne ville.
      await this.outbox.emit(tx, {
        type: 'user.onboarded_location',
        aggregateId: userId,
        payload: { userId, cityId: input.cityId, byStaffId: staff.staffId },
      });
    });
    return { userId, cityId: input.cityId };
  }

  private async assertMemberExists(userId: string): Promise<void> {
    const found = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (found === null) throw ApiError.notFound();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Interne
  // ════════════════════════════════════════════════════════════════════════

  /**
   * La trace, avec l'acteur et l'IP déjà renseignés depuis le contexte du garde.
   *
   * Toutes les écritures passent par ici, et pas par `audit.record` directement :
   * sinon l'IP du §2.3 serait oubliée une fois sur trois, et l'acteur pourrait
   * être recopié à la main depuis la mauvaise variable.
   */
  private async record(
    tx: Prisma.TransactionClient,
    staff: StaffUser,
    entry: {
      action: string;
      targetType: string;
      targetId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await this.audit.record(tx, {
      actor: { type: 'STAFF', id: staff.staffId },
      action: entry.action,
      targetType: entry.targetType,
      ...(entry.targetId === undefined ? {} : { targetId: entry.targetId }),
      ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
      ...(staff.ip === null ? {} : { ip: staff.ip }),
    });
  }

  /**
   * Applique le curseur en gardant le `where` d'origine SOUS un `AND`.
   *
   * Fusionner les deux objets à plat écraserait la condition d'identifiant quand
   * le filtre en porte déjà une — ou l'inverse. Le `AND` explicite rend la
   * composition sûre quel que soit le filtre.
   */
  private paginate<W extends { AND?: unknown }>(
    where: W,
    cursor: string | undefined,
    scope: string,
    direction: 'asc' | 'desc' = 'desc',
  ): W {
    if (cursor === undefined) return where;
    const decoded = decodeCursor(cursor, this.cursorSecret, scope);
    const bound = direction === 'desc' ? { lt: decoded.id } : { gt: decoded.id };
    return { AND: [where, { id: bound }] } as unknown as W;
  }
}

// ── Fonctions pures ─────────────────────────────────────────────────────────

/**
 * Le `where` du journal d'audit, en UN objet.
 *
 * Écrit hors de la classe, et employé par la liste ET par l'export : deux
 * constructions du même filtre finiraient par diverger, et un export ne
 * correspondrait plus à la page qu'on regarde.
 *
 * `from` et `to` portent la même clé `createdAt`, et c'est tout l'enjeu de cette
 * fonction : l'intervalle est assemblé en un seul objet.
 */
function auditWhere(query: AuditQuery): Prisma.AuditLogWhereInput {
  const createdAt: Prisma.DateTimeFilter = {
    ...(query.from === undefined ? {} : { gte: query.from }),
    ...(query.to === undefined ? {} : { lte: query.to }),
  };

  return {
    ...(query.actor === undefined
      ? {}
      : query.actor === 'SYSTEM'
        ? { actorType: 'SYSTEM' }
        : { actorId: query.actor }),
    ...(query.action === undefined ? {} : { action: query.action }),
    ...(query.targetType === undefined ? {} : { targetType: query.targetType }),
    ...(query.target === undefined ? {} : { targetId: query.target }),
    ...(Object.keys(createdAt).length === 0 ? {} : { createdAt }),
  };
}

function auditScope(query: AuditQuery): string {
  return [
    'admin:audit',
    query.actor ?? '',
    query.action ?? '',
    query.targetType ?? '',
    query.target ?? '',
    query.from?.toISOString() ?? '',
    query.to?.toISOString() ?? '',
  ].join(':');
}

/** Échappement CSV : guillemets doublés, et la cellule citée dès qu'elle en a besoin. */
function csvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

type ProReviewRow = Prisma.ProProfileGetPayload<{ select: typeof PRO_REVIEW_SELECT }>;

function shapeProReview(row: ProReviewRow) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    userId: row.userId,
    member: row.user,
    profession: row.profession,
    businessName: row.businessName,
    description: row.description,
    priceHint: row.priceHint,
    contactMethod: row.contactMethod,
    siret: row.siret,
    verificationStatus: row.verificationStatus,
    status: row.status,
    tier: row.tier,
    cities: row.cities.map((c) => c.city),
    /**
     * Le justificatif, réservé à l'équipe (00 §8.1). `sizeBytes` est un `BigInt`
     * en base et JSON ne sait pas le sérialiser : `JSON.stringify` LÈVE, ce qui
     * transforme une fiche en erreur 500 sans rapport apparent. Converti ici.
     */
    proof:
      row.proofAsset === null
        ? null
        : {
            id: row.proofAsset.id,
            mime: row.proofAsset.mime,
            sizeBytes: Number(row.proofAsset.sizeBytes),
            status: row.proofAsset.status,
            storageKey: row.proofAsset.storageKey,
          },
  };
}

export { auditWhere as adminAuditWhere };
export type { StaffRoleValue };
