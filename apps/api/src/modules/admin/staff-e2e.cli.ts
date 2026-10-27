import { newId } from '@app/db';
import { PrismaService } from '../../common/prisma.service';
import { loadEnv } from '../../config/env';
import { hashStaffPassword } from './staff-password';

/**
 * AJOUT (vague 5, suite e2e) — crée un compte d'équipe JETABLE pour la batterie
 * Playwright, et imprime `{ email, password }` en JSON sur la sortie standard.
 *
 *     node -r @swc-node/register src/modules/admin/staff-e2e.cli.ts [ROLE]
 *
 * POURQUOI CE FICHIER EXISTE. `staff:bootstrap` refuse de se rejouer dès qu'un
 * compte d'équipe existe (c'est sa raison d'être : ne pas devenir une porte
 * dérobée). Une base d'essai en contient toujours un — l'intégration en crée —,
 * et la batterie a pourtant besoin d'un compte dont elle connaît le mot de passe
 * pour ouvrir une VRAIE session d'équipe (connexion, enrôlement TOTP, confirmation).
 * Le compte est créé comme le fait l'amorçage : mot de passe haché en argon2id,
 * secret TOTP de longueur nulle — donc l'enrôlement forcé du §2.1 reste à faire
 * par les routes du produit, et c'est la batterie qui le fait.
 *
 * REFUS EN PRODUCTION, sans condition : un outil qui fabrique des comptes sans
 * rien demander n'a aucune place sur un serveur réel.
 */
async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('refusé : ce CLI de test ne tourne jamais en production.');
  }
  loadEnv();
  const role = (process.argv[2] ?? 'SUPER_ADMIN') as 'SUPER_ADMIN';
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const id = newId();
    const email = `e2e-${id.slice(-12)}@equipe.test`;
    const password = `e2e-${newId()}-Aa1!`;
    await prisma.staffUser.create({
      data: {
        id,
        email,
        displayName: 'Équipe de test',
        passwordHash: await hashStaffPassword(password),
        totpSecretEncrypted: new Uint8Array(0),
        role,
        isActive: true,
      },
    });
    process.stdout.write(`${JSON.stringify({ email, password })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
