import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import { PrismaService } from './prisma.service';

/**
 * Journal d'audit — 00-fondations.md §8.5 et §7.4.
 *
 * RÈGLE DURE (§7.4) : « Toute action admin écrit une ligne dans audit_logs. »
 * RÈGLE DURE (15 §…) : « Toute écriture depuis l'application admin passe par
 * AuditService.record() AVANT validation de la transaction. »
 *
 * D'où la signature : `record()` prend le client de transaction. Journaliser
 * après le commit laisserait une fenêtre où l'action existe sans sa trace ;
 * journaliser dans la transaction rend les deux indissociables.
 *
 * La table est en AJOUT SEUL, et la base le fait respecter : un déclencheur
 * refuse UPDATE, DELETE et TRUNCATE (migration 20260927050000 et 20260927051000).
 * La garantie ne dépend donc pas de ce service.
 *
 * Conservation : 5 ans (§8.4).
 */

export type AuditActor =
  | { type: 'STAFF'; id: string }
  | { type: 'MEMBER'; id: string }
  /** Suspension automatique, dépublication, tâche planifiée. */
  | { type: 'SYSTEM'; id?: undefined };

export interface AuditEntry {
  readonly actor: AuditActor;
  /** Ex. `user.suspend`, `template.publish`, `city.activate`. */
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string;
  /**
   * Avant / après, motif. JAMAIS de donnée sensible en clair (§8.5) : pas de
   * numéro, pas de contenu de message, pas de secret.
   */
  readonly metadata?: Prisma.InputJsonValue;
  readonly ip?: string;
}

type Writer = PrismaService | Prisma.TransactionClient;

/** Champs dont la valeur ne doit jamais atterrir dans le journal. */
const FORBIDDEN_METADATA_KEYS = [
  'phone', 'phoneNumber', 'phone_encrypted', 'phoneEncrypted',
  'password', 'passwordHash', 'password_hash',
  'totpSecret', 'totp_secret_encrypted', 'totpSecretEncrypted',
  'token', 'refreshToken', 'accessToken', 'codeHash', 'code_hash',
  'bodyEncrypted', 'body_encrypted', 'notesEncrypted', 'notes_encrypted',
  'email',
];

/**
 * Remplace la valeur des champs sensibles par `[masqué]`, récursivement.
 *
 * Un journal d'audit conservé cinq ans est une cible de choix : il ne doit pas
 * devenir l'endroit où les numéros de téléphone finissent en clair parce qu'un
 * service a passé son objet `before` complet.
 */
function scrub(value: Prisma.InputJsonValue, depth = 0): Prisma.InputJsonValue {
  if (depth > 8 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((v) => scrub(v as Prisma.InputJsonValue, depth + 1));
  }

  const out: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = FORBIDDEN_METADATA_KEYS.includes(key)
      ? '[masqué]'
      : scrub(v as Prisma.InputJsonValue, depth + 1);
  }
  return out;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Écrit la trace. À appeler avec le client de TRANSACTION, avant le commit :
   * l'action et sa trace vivent ou meurent ensemble.
   */
  async record(writer: Writer, entry: AuditEntry): Promise<void> {
    await writer.auditLog.create({
      data: {
        id: newId(),
        actorType: entry.actor.type,
        actorId: entry.actor.id ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        // Champ omis plutôt que passé à `undefined` : avec
        // exactOptionalPropertyTypes, Prisma distingue « absent » de « null ».
        ...(entry.metadata === undefined ? {} : { metadata: scrub(entry.metadata) }),
        ip: entry.ip ?? null,
      },
    });
  }

  /**
   * Trace d'une action système hors transaction — suspension automatique,
   * tâche planifiée. Ne jamais employer depuis l'application admin : là, la
   * trace doit être transactionnelle.
   */
  async recordSystem(action: string, targetType: string, targetId?: string, metadata?: Prisma.InputJsonValue): Promise<void> {
    await this.record(this.prisma, {
      actor: { type: 'SYSTEM' },
      action,
      targetType,
      ...(targetId === undefined ? {} : { targetId }),
      ...(metadata === undefined ? {} : { metadata }),
    });
  }
}

export { scrub as scrubAuditMetadata };
