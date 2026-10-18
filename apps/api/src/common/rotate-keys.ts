import type { CryptoService } from './crypto.service';
import type { PrismaService } from './prisma.service';

/**
 * Rotation des clés de chiffrement — réécriture des blobs scellés.
 *
 * ── PROCÉDURE (infra/README.md, « Rotation des clés ») ──────────────────────
 *   1. générer une clé neuve, lui donner un identifiant neuf (`*_KEY_ID`) ;
 *   2. déplacer l'ancienne dans `*_KEYS_PREVIOUS` (`id:base64`) — l'ancien format
 *      sans identifiant se lit avec n'importe quelle clé connue ;
 *   3. redémarrer API et worker : les NOUVELLES écritures emploient la clé neuve,
 *      les anciennes restent lisibles ;
 *   4. lancer `pnpm --filter @app/api rotate-keys` (`--dry-run` d'abord) : chaque
 *      blob qui n'est pas à la clé courante est relu puis réécrit ;
 *   5. quand le rapport dit « 0 à réécrire », retirer l'ancienne clé de
 *      `*_KEYS_PREVIOUS`.
 *
 * IDEMPOTENT et REPRENABLE : un blob déjà à la clé courante est ignoré, et la mise
 * à jour est conditionnelle à l'ancien contenu (`WHERE col = ancien`) — si un
 * membre modifie sa note pendant le script, sa version neuve n'est pas écrasée.
 * Pas de verrou de table, lots de 200.
 */
export interface SealedColumn {
  readonly table: string;
  readonly column: string;
  readonly ring: 'phone' | 'content';
}

export const SEALED_COLUMNS: readonly SealedColumn[] = [
  { table: 'phone_numbers', column: 'phone_encrypted', ring: 'phone' },
  { table: 'otp_challenges', column: 'phone_encrypted', ring: 'phone' },
  { table: 'users', column: 'email_encrypted', ring: 'phone' },
  { table: 'email_verifications', column: 'email_encrypted', ring: 'phone' },
  { table: 'journey_steps', column: 'notes_encrypted', ring: 'content' },
  { table: 'messages', column: 'body_encrypted', ring: 'content' },
  { table: 'staff_users', column: 'totp_secret_encrypted', ring: 'content' },
];

export interface RotationReport {
  readonly column: string;
  readonly scanned: number;
  readonly rewritten: number;
  readonly alreadyCurrent: number;
  readonly failed: number;
}

export async function rotateKeys(
  prisma: PrismaService,
  crypto: CryptoService,
  options: { dryRun?: boolean; batch?: number; columns?: readonly SealedColumn[] } = {},
): Promise<RotationReport[]> {
  const batch = options.batch ?? 200;
  const reports: RotationReport[] = [];

  for (const col of options.columns ?? SEALED_COLUMNS) {
    const currentId = col.ring === 'phone' ? crypto.currentPhoneKeyId : crypto.currentContentKeyId;
    const idOf = (b: Uint8Array): number => (col.ring === 'phone' ? crypto.phoneKeyId(b) : crypto.contentKeyId(b));
    const rewrap = (b: Uint8Array): Uint8Array => (col.ring === 'phone' ? crypto.rewrapPhone(b) : crypto.rewrapContent(b));
    let scanned = 0;
    let rewritten = 0;
    let already = 0;
    let failed = 0;
    let last = '00000000-0000-0000-0000-000000000000';

    for (;;) {
      // Identifiants et noms viennent de la liste fermée ci-dessus, jamais d'une saisie.
      const rows = await prisma.$queryRawUnsafe<{ id: string; blob: Buffer }[]>(
        `SELECT id::text AS id, "${col.column}" AS blob FROM "${col.table}"
         WHERE "${col.column}" IS NOT NULL AND length("${col.column}") > 0 AND id > $1::uuid
         ORDER BY id LIMIT ${batch}`,
        last,
      );
      if (rows.length === 0) break;
      for (const row of rows) {
        last = row.id;
        scanned += 1;
        const blob = new Uint8Array(row.blob);
        if (idOf(blob) === currentId) {
          already += 1;
          continue;
        }
        try {
          const next = rewrap(blob);
          if (options.dryRun !== true) {
            await prisma.$executeRawUnsafe(
              `UPDATE "${col.table}" SET "${col.column}" = $1 WHERE id = $2::uuid AND "${col.column}" = $3`,
              Buffer.from(next),
              row.id,
              Buffer.from(blob),
            );
          }
          rewritten += 1;
        } catch {
          // Illisible avec toutes les clés connues : on le DIT, on ne l'écrase pas.
          failed += 1;
        }
      }
    }
    reports.push({ column: `${col.table}.${col.column}`, scanned, rewritten, alreadyCurrent: already, failed });
  }
  return reports;
}
