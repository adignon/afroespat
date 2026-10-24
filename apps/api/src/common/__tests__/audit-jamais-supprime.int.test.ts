import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { ScheduledTaskRegistry } from '../../queue/scheduled-tasks';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';

/**
 * LE JOURNAL D'AUDIT NE SE SUPPRIME JAMAIS — décision du porteur : « on ne supprime
 * jamais ». La rétention est ILLIMITÉE (15 §2.3, §10, §11 mis à jour). Ce fichier ÉCHOUE
 * dès qu'une suppression apparaît, par quatre côtés indépendants :
 *
 *   1. la BASE refuse : UPDATE, DELETE et TRUNCATE lèvent (déclencheurs
 *      `audit_logs_append_only` et `audit_logs_no_truncate`), et AUCUNE clé étrangère
 *      ne relie `audit_logs` à une autre table — donc aucune cascade ne peut l'atteindre ;
 *   2. le CODE : aucune ligne de `apps/api/src` ni de `packages/db/src` ne supprime,
 *      ne met à jour, ne vide ni ne purge `audit_logs` ;
 *   3. les MIGRATIONS : aucune ne retire un déclencheur de la table, ne la désactive,
 *      ni n'y pose une clé étrangère en cascade ;
 *   4. le PLANIFICATEUR : aucune tâche planifiée ne porte un nom de purge ou de
 *      rétention du journal (`audit.retention` a été retirée de la spec).
 *
 * Les suppressions de comptes (membre, équipe) laissent les lignes du journal : leur
 * `actor_id` / `target_id` restent, c'est la piste de traçabilité.
 */

const RACINE = join(__dirname, '..', '..', '..', '..', '..');

function fichiers(dir: string, ext: RegExp, ignorer: RegExp): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (ignorer.test(chemin)) continue;
    const st = statSync(chemin);
    if (st.isDirectory()) out.push(...fichiers(chemin, ext, ignorer));
    else if (ext.test(nom)) out.push(chemin);
  }
  return out;
}

/** Le code qui ne fait pas partie des tests : ce sont eux qui contiennent, volontairement, ces motifs. */
const SANS_TESTS = /(__tests__|node_modules|\/dist\/|\.test\.ts$|\.int\.test\.ts$|\/generated\/)/;

const MOTIFS_INTERDITS: readonly { motif: RegExp; pourquoi: string }[] = [
  { motif: /auditLog\s*\.\s*(delete|deleteMany|update|updateMany|upsert)\s*\(/, pourquoi: 'écriture destructive via Prisma' },
  { motif: /(DELETE\s+FROM|TRUNCATE(\s+TABLE)?|UPDATE|DROP\s+TABLE)\s+(ONLY\s+)?"?audit_logs"?/i, pourquoi: 'SQL destructif sur audit_logs' },
  { motif: /ALTER\s+TABLE\s+"?audit_logs"?\s+(DISABLE|DROP)/i, pourquoi: 'désactivation ou retrait d’une protection' },
  { motif: /DROP\s+TRIGGER[^;]*audit_logs/i, pourquoi: 'retrait d’un déclencheur de protection' },
  { motif: /name:\s*'audit\.[a-z_.]*(retention|purge|cleanup|prune)[a-z_.]*'/i, pourquoi: 'tâche planifiée de purge du journal' },
];

describe('le journal d’audit ne se supprime jamais', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let audit: AuditService;
  const created: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    audit = app.get(AuditService);
  });

  afterAll(async () => {
    // Pas de nettoyage des lignes d'audit posées ici : on ne supprime jamais, même en test.
    void created;
    await app?.close();
  });

  // ══ 1. La base ═══════════════════════════════════════════════════════════

  describe('la base refuse', () => {
    it('DELETE, UPDATE et TRUNCATE sur audit_logs lèvent une erreur, et la ligne reste', async () => {
      const targetId = newId();
      await audit.recordSystem('test.audit_immuable', 'test', targetId, { marque: 'immuable' });
      const ligne = await prisma.auditLog.findFirstOrThrow({ where: { targetId, action: 'test.audit_immuable' } });
      created.push(ligne.id);

      await expect(prisma.$executeRaw`DELETE FROM audit_logs WHERE id = ${ligne.id}::uuid`).rejects.toThrow(/audit|append|ajout/i);
      await expect(prisma.$executeRaw`UPDATE audit_logs SET action = 'x' WHERE id = ${ligne.id}::uuid`).rejects.toThrow(/audit|append|ajout/i);
      await expect(prisma.$executeRawUnsafe('TRUNCATE audit_logs')).rejects.toThrow(/audit|truncate|ajout/i);
      await expect(prisma.auditLog.delete({ where: { id: ligne.id } })).rejects.toThrow();
      await expect(prisma.auditLog.deleteMany({ where: { id: ligne.id } })).rejects.toThrow();

      expect(await prisma.auditLog.count({ where: { id: ligne.id } })).toBe(1);
    });

    it('aucune clé étrangère ne touche audit_logs : aucune cascade ne peut l’atteindre', async () => {
      const rows = await prisma.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint
         WHERE contype = 'f'
           AND (conrelid = 'audit_logs'::regclass OR confrelid = 'audit_logs'::regclass)`;
      expect(rows.map((r) => r.conname)).toEqual([]);
    });

    it('les deux déclencheurs de protection sont actifs', async () => {
      const rows = await prisma.$queryRaw<{ tgname: string; tgenabled: string }[]>`
        SELECT tgname, tgenabled FROM pg_trigger
         WHERE tgrelid = 'audit_logs'::regclass AND NOT tgisinternal`;
      const noms = rows.map((r) => r.tgname);
      expect(noms).toEqual(expect.arrayContaining(['audit_logs_append_only', 'audit_logs_no_truncate']));
      // 'O' = activé (origine) ; 'D' = désactivé.
      for (const r of rows) expect(r.tgenabled, `le déclencheur ${r.tgname} est désactivé`).not.toBe('D');
    });

    it('supprimer un MEMBRE ou un compte ÉQUIPE laisse les lignes du journal qui le désignent', async () => {
      const userId = newId();
      const country = await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } } });
      await prisma.user.create({
        data: {
          id: userId, handle: `aud${userId.slice(-10)}`, displayName: 'Audit', phase: 'SETTLED', verificationLevel: 'L1',
          originCountryId: country.id, plan: 'FREE', status: 'ACTIVE',
        },
      });
      await audit.recordSystem('test.audit_membre', 'user', userId, { marque: 'membre' });
      await prisma.user.delete({ where: { id: userId } });
      expect(await prisma.auditLog.count({ where: { targetId: userId, action: 'test.audit_membre' } })).toBe(1);

      const staffId = newId();
      await prisma.staffUser.create({
        data: { id: staffId, email: `audit-${staffId}@equipe.test`, displayName: 'Audit', passwordHash: 'x', totpSecretEncrypted: new Uint8Array(0), role: 'SUPPORT', isActive: true },
      });
      await audit.record(prisma, { actor: { type: 'STAFF', id: staffId }, action: 'test.audit_equipe', targetType: 'test' });
      await prisma.staffUser.delete({ where: { id: staffId } });
      expect(await prisma.auditLog.count({ where: { actorId: staffId, action: 'test.audit_equipe' } })).toBe(1);
    });
  });

  // ══ 2 et 3. Le code et les migrations ════════════════════════════════════

  describe('le code et les migrations', () => {
    it('aucune source de apps/api ni de packages/db ne supprime, ne vide, ne met à jour ni ne purge audit_logs', () => {
      const sources = [
        ...fichiers(join(RACINE, 'apps', 'api', 'src'), /\.ts$/, SANS_TESTS),
        ...fichiers(join(RACINE, 'apps', 'worker', 'src'), /\.ts$/, SANS_TESTS),
        ...fichiers(join(RACINE, 'packages', 'db', 'src'), /\.ts$/, SANS_TESTS),
      ];
      expect(sources.length).toBeGreaterThan(50);
      const fautes: string[] = [];
      for (const f of sources) {
        const texte = readFileSync(f, 'utf8');
        for (const { motif, pourquoi } of MOTIFS_INTERDITS) {
          const m = motif.exec(texte);
          if (m !== null) fautes.push(`${relative(RACINE, f)} : ${pourquoi} (« ${m[0]} »)`);
        }
      }
      expect(fautes, `Le journal d’audit ne se supprime jamais :\n  ${fautes.join('\n  ')}`).toEqual([]);
    });

    it('aucune migration ne retire ni ne désactive la protection du journal, ni ne le relie en cascade', () => {
      const migrations = fichiers(join(RACINE, 'packages', 'db', 'prisma', 'migrations'), /\.sql$/, /node_modules/);
      expect(migrations.length).toBeGreaterThan(30);
      const fautes: string[] = [];
      for (const f of migrations) {
        // Les commentaires SQL peuvent EXPLIQUER ce qui est interdit : on ne lit que le code.
        const code = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
        for (const { motif, pourquoi } of MOTIFS_INTERDITS.slice(1, 4)) {
          const m = motif.exec(code);
          if (m !== null) fautes.push(`${relative(RACINE, f)} : ${pourquoi} (« ${m[0]} »)`);
        }
        if (/REFERENCES\s+"?audit_logs"?/i.test(code)) fautes.push(`${relative(RACINE, f)} : une clé étrangère vise audit_logs`);
        if (/ALTER\s+TABLE\s+"?audit_logs"?\s+ADD\s+CONSTRAINT[^;]*FOREIGN\s+KEY/i.test(code)) {
          fautes.push(`${relative(RACINE, f)} : une clé étrangère part de audit_logs`);
        }
      }
      expect(fautes, `Le journal d’audit ne se supprime jamais :\n  ${fautes.join('\n  ')}`).toEqual([]);
    });

    it('le modèle Prisma du journal ne porte aucune relation (donc aucune cascade possible)', () => {
      const schema = readFileSync(join(RACINE, 'packages', 'db', 'prisma', 'schema', '15-administration.prisma'), 'utf8');
      const bloc = /model AuditLog \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? '';
      expect(bloc).not.toBe('');
      expect(bloc).not.toMatch(/@relation|onDelete/);
      // Et aucun autre modèle ne pointe vers lui.
      const tous = fichiers(join(RACINE, 'packages', 'db', 'prisma', 'schema'), /\.prisma$/, /node_modules/)
        .map((f) => readFileSync(f, 'utf8'))
        .join('\n');
      expect(tous).not.toMatch(/\bAuditLog(\[\])?\??\s+@relation/);
    });
  });

  // ══ 4. Le planificateur ══════════════════════════════════════════════════

  it('aucune tâche planifiée ne purge, ne vieillit ni ne nettoie le journal d’audit', () => {
    const registry = app.get(ScheduledTaskRegistry);
    const suspectes = registry.all().filter((t) => /audit/i.test(t.name));
    expect(suspectes.map((t) => t.name)).toEqual([]);
  });
});
