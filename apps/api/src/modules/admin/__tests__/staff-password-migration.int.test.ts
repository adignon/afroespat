import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AppModule } from '../../../app.module';
import { CryptoService } from '../../../common/crypto.service';
import { ApiErrorFilter } from '../../../common/error.filter';
import { PrismaService } from '../../../common/prisma.service';
import { hashStaffPassword, hashWithLegacyScryptForTests, verifyStaffPassword } from '../staff-password';
import { generateTotpSecret } from '../totp';

/**
 * Migration scrypt → argon2id, éprouvée EN BASE — 00 §8.3, 15 §2.1.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ La règle dure que ce fichier existe pour prouver :                       │
 * │                                                                          │
 * │   « Aucun membre de l'équipe n'est déconnecté ni forcé de réinitialiser  │
 * │     son secret. À la PROCHAINE AUTHENTIFICATION RÉUSSIE, le secret encore │
 * │     en scrypt est réhaché en argon2id et REMPLACÉ en base. »              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Il passe par HTTP et relit la COLONNE, et les deux comptent :
 *
 *   · par HTTP, parce que le réhachage est une propriété de la chaîne — le
 *     contrôleur, le service, la vérification, l'écriture Prisma. Un test qui
 *     appellerait `verifyStaffPassword` prouverait que la fonction sait vérifier,
 *     pas que la connexion réécrit la ligne ;
 *   · en relisant `password_hash`, parce que « le stockage contient de l'argon2id
 *     et PLUS de scrypt » est une affirmation sur la base, pas sur une réponse
 *     HTTP. Rien dans la réponse ne dit ce qui a été écrit.
 *
 * Le second facteur n'est pas joué : `/admin/auth/login` est le PREMIER facteur,
 * et c'est le seul endroit du produit où le mot de passe en clair existe — donc
 * le seul endroit où le réhachage est possible. Le parcours TOTP complet est
 * éprouvé par `staff-guard.int.test.ts`.
 */

function httpServer(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

const PASSWORD = 'un-mot-de-passe-equipe-suffisamment-long';
/** N réduit : le chemin de code scrypt est le même, la facture non. */
const CHEAP_SCRYPT_N = 16_384;

describe('migration transparente du hachage des mots de passe d’équipe', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let crypto: CryptoService;

  const createdStaff: string[] = [];
  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;

  /** Un compte équipe dont le condensé est posé TEL QUEL, format compris. */
  async function staffWithStoredHash(passwordHash: string): Promise<{ id: string; email: string }> {
    counter += 1;
    const id = newId();
    const email = `migration-${run}-${counter}@equipe.test`;
    await prisma.staffUser.create({
      data: {
        id,
        email,
        displayName: `Équipe migration ${counter}`,
        passwordHash,
        totpSecretEncrypted: crypto.encryptContent(generateTotpSecret()),
        role: 'MODERATOR',
        isActive: true,
      },
    });
    createdStaff.push(id);
    return { id, email };
  }

  async function storedHashOf(id: string): Promise<string> {
    const row = await prisma.staffUser.findUniqueOrThrow({
      where: { id },
      select: { passwordHash: true },
    });
    return row.passwordHash;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new ApiErrorFilter());
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    crypto = app.get(CryptoService);
  });

  afterAll(async () => {
    for (const id of createdStaff) {
      try {
        await prisma.staffUser.delete({ where: { id } });
      } catch {
        await prisma.staffUser.update({ where: { id }, data: { isActive: false } });
      }
    }
    await app.close();
  });

  it('laisse se connecter un compte dont le secret est encore en scrypt', async () => {
    const legacy = await hashWithLegacyScryptForTests(PASSWORD, CHEAP_SCRYPT_N);
    const staff = await staffWithStoredHash(legacy);

    const response = await request(httpServer(app))
      .post('/v1/admin/auth/login')
      .send({ email: staff.email, password: PASSWORD })
      .expect(201);

    // Un défi est rendu : la personne n'est ni déconnectée ni renvoyée vers une
    // réinitialisation. C'est exactement le parcours d'avant la migration.
    expect(typeof (response.body as { challenge: unknown }).challenge).toBe('string');
  });

  it('remplace le condensé scrypt par de l’argon2id à la connexion réussie', async () => {
    const legacy = await hashWithLegacyScryptForTests(PASSWORD, CHEAP_SCRYPT_N);
    const staff = await staffWithStoredHash(legacy);
    expect(await storedHashOf(staff.id)).toBe(legacy);

    await request(httpServer(app))
      .post('/v1/admin/auth/login')
      .send({ email: staff.email, password: PASSWORD })
      .expect(201);

    const after = await storedHashOf(staff.id);
    expect(after.startsWith('$argon2id$v=19$')).toBe(true);
    // « ET PLUS le scrypt » : la ligne d'avant a disparu, elle n'est pas doublée.
    expect(after).not.toBe(legacy);
    expect(after.includes('scrypt')).toBe(false);
    // Et le nouveau condensé vérifie bien le MÊME mot de passe : le réhachage
    // n'a pas enfermé la personne dehors.
    expect(await verifyStaffPassword(PASSWORD, after)).toBe(true);
    expect(await verifyStaffPassword('un-autre-mot-de-passe-completement', after)).toBe(false);
  });

  it('ne réécrit plus rien à la connexion suivante', async () => {
    const staff = await staffWithStoredHash(
      await hashWithLegacyScryptForTests(PASSWORD, CHEAP_SCRYPT_N),
    );

    await request(httpServer(app))
      .post('/v1/admin/auth/login')
      .send({ email: staff.email, password: PASSWORD })
      .expect(201);
    const first = await storedHashOf(staff.id);

    await request(httpServer(app))
      .post('/v1/admin/auth/login')
      .send({ email: staff.email, password: PASSWORD })
      .expect(201);
    expect(await storedHashOf(staff.id)).toBe(first);
  });

  /**
   * Le pendant indispensable : un mauvais mot de passe sur un condensé scrypt
   * doit être REFUSÉ, et surtout ne rien réécrire. Une implémentation qui
   * réhacherait avant de vérifier remplacerait le secret par celui de l'attaquant.
   */
  it('refuse un mauvais secret sur du scrypt, et ne touche PAS au condensé', async () => {
    const legacy = await hashWithLegacyScryptForTests(PASSWORD, CHEAP_SCRYPT_N);
    const staff = await staffWithStoredHash(legacy);

    await request(httpServer(app))
      .post('/v1/admin/auth/login')
      .send({ email: staff.email, password: 'un-mot-de-passe-totalement-different' })
      .expect(401);

    expect(await storedHashOf(staff.id)).toBe(legacy);
  });

  it('refuse un mauvais secret sur de l’argon2id, et ne touche PAS au condensé', async () => {
    const fresh = await hashStaffPassword(PASSWORD);
    const staff = await staffWithStoredHash(fresh);

    await request(httpServer(app))
      .post('/v1/admin/auth/login')
      .send({ email: staff.email, password: 'un-mot-de-passe-totalement-different' })
      .expect(401);

    expect(await storedHashOf(staff.id)).toBe(fresh);
  });
});
