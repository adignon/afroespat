import { newId } from '@app/db';
import { SYSTEM_AUDIT_ACTIONS } from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { PrismaService } from '../../../common/prisma.service';
import {
  STAFF_BOOTSTRAP_ENV,
  StaffBootstrapRefusal,
  bootstrapStaffUser,
} from '../staff-bootstrap';
import { hashStaffPassword } from '../staff-password';

/**
 * L'amorçage du premier compte d'équipe, contre une VRAIE base — `staff-bootstrap.ts`.
 *
 * ── Ce que ce fichier prouve, et ce qu'il NE PEUT PAS prouver ──────────────
 *
 * Il prouve le REFUS sur une table peuplée, avec la vraie requête de comptage :
 * c'est la règle qui empêche le mécanisme de devenir une porte dérobée
 * permanente, et c'est celle qui se mesure ici, puisque la base de la suite
 * d'intégration contient toujours des comptes d'équipe — les autres fichiers en
 * créent.
 *
 * Il NE PEUT PAS prouver la création sur une table vide, et il ne fait pas
 * semblant : vider `staff_users` serait une opération DESTRUCTRICE sur une base
 * PARTAGÉE, et les cascades emporteraient les sessions des autres fichiers. Le
 * cas « table vide » est éprouvé deux fois ailleurs, et ces deux mesures sont
 * meilleures que ce qu'un test d'intégration pourrait dire :
 *
 *   · `staff-bootstrap.test.ts` l'éprouve sur la décision PURE et sur
 *     l'enveloppe avec un magasin factice — y compris le secret TOTP de longueur
 *     nulle, le rôle, et l'absence d'écriture en cas de refus ;
 *   · le parcours RÉEL a été exercé par HTTP sur une base NEUVE (migrations +
 *     seed + amorçage + vraie session d'équipe ouverte jusqu'à une page
 *     d'administration), et la matrice des codes de retour est au rapport.
 *
 * Le marqueur `bootstrap-int` est unique à ce fichier : aucune affirmation n'est
 * faite sur un total global de `staff_users`.
 */

const MARQUEUR = 'bootstrap-int';

const CONFIG_VALIDE: Record<string, string> = {
  [STAFF_BOOTSTRAP_ENV.email]: `amorcage-${MARQUEUR}@afroexpates.test`,
  [STAFF_BOOTSTRAP_ENV.displayName]: 'Amorçage (essai)',
  [STAFF_BOOTSTRAP_ENV.password]: 'correct-cheval-pile-agrafe-2026',
};

describe('amorçage du premier compte d’équipe, contre une vraie base', () => {
  let prisma: PrismaService;
  let audit: AuditService;
  /** Le compte témoin que ce fichier crée, et le seul qu'il supprime. */
  let temoinId: string;
  const temoinEmail = `temoin-${MARQUEUR}-${Date.now()}@afroexpates.test`;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    audit = new AuditService(prisma);

    // On GARANTIT qu'au moins un compte d'équipe existe, au lieu de le supposer :
    // la règle éprouvée ici est « refuse si un compte existe », et un fichier qui
    // tomberait sur une table vide verrait son test passer pour la mauvaise
    // raison. Secret TOTP de longueur nulle : même forme que les autres comptes.
    temoinId = newId();
    await prisma.staffUser.create({
      data: {
        id: temoinId,
        email: temoinEmail,
        displayName: `Témoin ${MARQUEUR}`,
        passwordHash: await hashStaffPassword('correct-cheval-pile-agrafe-2026'),
        totpSecretEncrypted: new Uint8Array(0),
        role: 'SUPPORT',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    // Seule la ligne de CE fichier, par son identifiant. `audit_logs` n'est pas
    // nettoyée : le déclencheur `audit_logs_append_only` refuse DELETE, et c'est
    // très bien ainsi.
    await prisma.staffUser.deleteMany({ where: { id: temoinId } });
    await prisma.$disconnect();
  });

  /**
   * RÈGLE DURE : un compte d'équipe existe → refus, et AUCUNE écriture.
   *
   * On ne se contente pas de l'exception : on compte les lignes avant et après,
   * et on vérifie qu'aucune ligne ne porte l'email d'amorçage. Une exception
   * levée APRÈS une création serait un second `SUPER_ADMIN` silencieux.
   */
  it('[RÈGLE DURE] refuse quand un compte d’équipe existe, et n’écrit rien', async () => {
    const avant = await prisma.staffUser.count();
    expect(avant, 'Le compte témoin de ce fichier doit être là.').toBeGreaterThan(0);

    let refus: StaffBootstrapRefusal | null = null;
    try {
      await bootstrapStaffUser(prisma, audit, CONFIG_VALIDE);
    } catch (error) {
      refus = error instanceof StaffBootstrapRefusal ? error : null;
      if (refus === null) throw error;
    }

    expect(refus, 'Un refus NOMMÉ était attendu.').not.toBeNull();
    expect(refus?.reason).toBe('STAFF_ALREADY_EXISTS');

    const apres = await prisma.staffUser.count();
    expect(apres, 'L’amorçage a écrit alors qu’il devait refuser.').toBe(avant);
    expect(
      await prisma.staffUser.findUnique({
        where: { email: CONFIG_VALIDE[STAFF_BOOTSTRAP_ENV.email] as string },
        select: { id: true },
      }),
      'Un compte d’amorçage a été créé malgré le refus : le mécanisme est une porte dérobée.',
    ).toBeNull();
  });

  /** L'IDEMPOTENCE : trois rejeux, trois refus, toujours aucune écriture. */
  it('[RÈGLE DURE] rejoué trois fois, refuse trois fois sans jamais créer', async () => {
    const avant = await prisma.staffUser.count();
    for (let essai = 0; essai < 3; essai += 1) {
      await expect(bootstrapStaffUser(prisma, audit, CONFIG_VALIDE)).rejects.toBeInstanceOf(
        StaffBootstrapRefusal,
      );
    }
    expect(await prisma.staffUser.count()).toBe(avant);
  });

  /**
   * Configuration absente : le refus est nommé, et il nomme ce qu'il attend.
   *
   * Sur une base peuplée, c'est `STAFF_ALREADY_EXISTS` qui sort d'abord — c'est
   * l'ordre voulu, et `staff-bootstrap.test.ts` l'éprouve. Ici on vérifie donc
   * seulement qu'une configuration vide ne crée JAMAIS rien, ce qui est la
   * propriété observable depuis une vraie base.
   */
  it('[RÈGLE DURE] configuration absente : refus, et aucune écriture', async () => {
    const avant = await prisma.staffUser.count();
    await expect(bootstrapStaffUser(prisma, audit, {})).rejects.toBeInstanceOf(
      StaffBootstrapRefusal,
    );
    expect(await prisma.staffUser.count()).toBe(avant);
  });

  /**
   * L'écriture d'audit de l'amorçage passe bien en base.
   *
   * Elle a une forme inhabituelle — acteur `SYSTEM`, donc `actor_id` NUL — et
   * elle est écrite hors transaction. Ce test existe parce qu'un amorçage qui
   * créerait le compte puis échouerait sur sa trace laisserait une plateforme
   * ouverte sans ligne de journal, et parce que le déclencheur
   * `audit_logs_append_only` est le genre de chose qu'on découvre en production.
   */
  it('la trace d’amorçage s’écrit : acteur SYSTEM, action distincte de staff.created', async () => {
    const cible = newId();
    await audit.recordSystem(SYSTEM_AUDIT_ACTIONS.staffBootstrapped, 'staff_user', cible, {
      role: 'SUPER_ADMIN',
      marqueur: MARQUEUR,
    });

    const ligne = await prisma.auditLog.findFirst({
      where: { action: SYSTEM_AUDIT_ACTIONS.staffBootstrapped, targetId: cible },
      select: { actorType: true, actorId: true, action: true, targetType: true },
    });
    expect(ligne).not.toBeNull();
    expect(ligne?.actorType).toBe('SYSTEM');
    expect(ligne?.actorId).toBeNull();
    expect(ligne?.action).not.toBe('staff.created');
    expect(ligne?.targetType).toBe('staff_user');
  });
});
