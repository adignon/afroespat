import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import type { Socket } from 'socket.io';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { RealtimeAdmissionService } from '../realtime.admission';
import { RealtimeGateway } from '../realtime.gateway';

/**
 * LA PASSERELLE WEBSOCKET NE DOIT PAS ÊTRE UN TROU — 08 §7.3, T4 §7.
 *
 * Une passerelle qui ne rejoue pas les gardes de l'API donne un canal de lecture
 * permanent à qui présente un jeton périmé, révoqué, ou aucun jeton. L'erreur est
 * classique parce qu'elle est INVISIBLE : la messagerie fonctionne, les messages
 * arrivent, et rien ne dit que le destinataire n'aurait plus dû les recevoir.
 *
 * Ce fichier éprouve les deux refus que le lot exige, et un troisième que le
 * précédent `level_refresh_required` impose de ne pas oublier :
 *
 *   1. une connexion NON AUTHENTIFIÉE est refusée ;
 *   2. une connexion d'un membre BANNI est refusée ;
 *   3. une connexion d'un membre RÉTROGRADÉ est refusée — y compris après un
 *      `/auth/refresh`, qui remet `level_refresh_required` à `false` et rendrait
 *      l'ancien jeton acceptable si la comparaison de niveau manquait.
 *
 * Et le quatrième, qui est la vraie différence entre HTTP et WebSocket : une
 * connexion DÉJÀ OUVERTE au moment du bannissement doit être FERMÉE. Sans cela,
 * les trois refus ci-dessus ne protègent que la poignée de main, et un membre
 * banni garde son canal aussi longtemps qu'il ne se déconnecte pas.
 */
describe('passerelle WebSocket : qui est admis, et qui est éjecté (08 §7.3)', () => {
  let prisma: PrismaService;
  let tokens: TokenService;
  let admission: RealtimeAdmissionService;
  const createdUsers: string[] = [];
  let countryId = '';

  async function makeUser(over: {
    status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
    level?: 'L0' | 'L1' | 'L2';
  } = {}): Promise<string> {
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `ws${id.slice(-10)}`,
        displayName: 'Membre WS',
        phase: 'PRE_DEPARTURE',
        verificationLevel: over.level ?? 'L1',
        originCountryId: countryId,
        plan: 'FREE',
        status: over.status ?? 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return id;
  }

  async function makeSession(userId: string, over: { revoked?: boolean; refreshRequired?: boolean } = {}): Promise<string> {
    const id = newId();
    await prisma.authSession.create({
      data: {
        id,
        userId,
        refreshTokenHash: `hash-${id}`,
        chainId: newId(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
        ...(over.revoked === true ? { revokedAt: new Date() } : {}),
        ...(over.refreshRequired === true ? { levelRefreshRequired: true } : {}),
      },
    });
    return id;
  }

  function tokenFor(userId: string, sessionId: string, level: 'L0' | 'L1' | 'L2' = 'L1', status = 'ACTIVE'): string {
    return tokens.sign({
      sub: userId,
      sid: sessionId,
      level,
      plan: 'FREE',
      status: status as 'ACTIVE',
      exp: Math.floor(Date.now() / 1000) + 900,
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tokens = new TokenService();
    admission = new RealtimeAdmissionService(tokens, prisma);
    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = country.id;
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await prisma.authSession.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  // ── 1. Connexion non authentifiée ─────────────────────────────────────────

  describe('une connexion non authentifiée est refusée', () => {
    it('sans jeton du tout', async () => {
      await expect(admission.admit(undefined)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      await expect(admission.admit(null)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      await expect(admission.admit('')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      await expect(admission.admit('   ')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('avec un jeton qui n’est pas un jeton', async () => {
      await expect(admission.admit('pas-un-jwt')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    /**
     * LE CAS QUI COMPTE : un jeton bien FORMÉ mais mal SIGNÉ.
     *
     * Une passerelle qui se contenterait de décoder la charge utile — ce que fait
     * n'importe quel `atob(token.split('.')[1])` — accepterait celui-ci, et
     * laisserait n'importe qui se déclarer n'importe quel membre.
     */
    it('avec un jeton dont la signature est fausse', async () => {
      const userId = await makeUser();
      const sessionId = await makeSession(userId);
      const valid = tokenFor(userId, sessionId);
      const [header, payload] = valid.split('.');
      const forged = `${header}.${payload}.signature-inventee`;

      await expect(admission.admit(forged)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      // …et le même jeton, correctement signé, passe : sans cette moitié, le test
      // resterait vert si `admit` refusait TOUT.
      await expect(admission.admit(valid)).resolves.toMatchObject({ userId });
    });

    it('avec un jeton expiré', async () => {
      const userId = await makeUser();
      const sessionId = await makeSession(userId);
      const expired = tokens.sign({
        sub: userId, sid: sessionId, level: 'L1', plan: 'FREE', status: 'ACTIVE',
        exp: Math.floor(Date.now() / 1000) - 10,
      });
      await expect(admission.admit(expired)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });
  });

  // ── 2. Membre banni ───────────────────────────────────────────────────────

  describe('une connexion d’un membre banni est refusée', () => {
    /**
     * Le chemin RÉEL d'un bannissement (13 §4.2, `moderation.service.ts`) :
     * `users.status = 'DEACTIVATED'` — la valeur `BANNED` n'existe pas dans
     * l'énumération — ET révocation de toutes les sessions.
     */
    it('par le chemin complet : statut DEACTIVATED et sessions révoquées', async () => {
      const userId = await makeUser();
      const sessionId = await makeSession(userId);
      const token = tokenFor(userId, sessionId);
      // Avant la sanction, il est admis.
      await expect(admission.admit(token)).resolves.toMatchObject({ userId });

      await prisma.user.update({ where: { id: userId }, data: { status: 'DEACTIVATED' } });
      await prisma.authSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });

      await expect(admission.admit(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    /**
     * ET PAR LE STATUT SEUL, session encore vivante.
     *
     * Ce second cas n'est pas un doublon : il éprouve que le refus ne tient pas
     * UNIQUEMENT à la révocation de session. Si un jour un chemin de bannissement
     * oubliait de révoquer — ou si le membre rouvrait une session entre les deux
     * écritures de la transaction — la passerelle doit refuser quand même. C'est
     * aussi ce qui justifie de lire le statut EN BASE et non dans le jeton : le
     * jeton ci-dessous dit `ACTIVE`, puisqu'il a été émis avant la sanction.
     */
    it('par le statut seul, avec une session toujours valide et un jeton disant ACTIVE', async () => {
      const userId = await makeUser();
      const sessionId = await makeSession(userId);
      const token = tokenFor(userId, sessionId, 'L1', 'ACTIVE');
      await expect(admission.admit(token)).resolves.toMatchObject({ userId });

      await prisma.user.update({ where: { id: userId }, data: { status: 'DEACTIVATED' } });

      await expect(admission.admit(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('un membre suspendu est refusé aussi, avec son propre code', async () => {
      const userId = await makeUser();
      const sessionId = await makeSession(userId);
      const token = tokenFor(userId, sessionId);
      await prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });

      await expect(admission.admit(token)).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
    });
  });

  // ── 3. Membre rétrogradé ──────────────────────────────────────────────────

  describe('une connexion d’un membre rétrogradé est refusée', () => {
    it('par le drapeau `level_refresh_required`', async () => {
      const userId = await makeUser({ level: 'L2' });
      const sessionId = await makeSession(userId);
      const token = tokenFor(userId, sessionId, 'L2');
      await expect(admission.admit(token)).resolves.toMatchObject({ userId });

      await prisma.authSession.update({ where: { id: sessionId }, data: { levelRefreshRequired: true } });

      await expect(admission.admit(token)).rejects.toMatchObject({ code: 'TOKEN_STALE' });
    });

    /**
     * LA FAILLE QUE LA CORRECTION PRÉCÉDENTE AVAIT OUVERTE, rejouée ici.
     *
     * `/auth/refresh` remet `level_refresh_required` à `false`. L'ANCIEN jeton
     * d'accès, cryptographiquement valide encore quinze minutes, redeviendrait
     * alors acceptable AVEC SON ANCIEN NIVEAU. Sur une rétrogradation L2 → L0,
     * c'est une élévation de privilège créée par le remède — et sur un socket,
     * elle ne durerait pas quinze minutes mais toute la connexion.
     *
     * Le drapeau est donc explicitement remis à `false` ci-dessous : seul le
     * SECOND critère (comparaison du niveau porté par le jeton avec celui de la
     * base) peut faire échouer ce test.
     */
    it('par la comparaison de niveau, drapeau remis à false comme après /auth/refresh', async () => {
      const userId = await makeUser({ level: 'L2' });
      const sessionId = await makeSession(userId);
      const token = tokenFor(userId, sessionId, 'L2');

      // La rétrogradation, puis le rafraîchissement qui efface le drapeau.
      await prisma.user.update({ where: { id: userId }, data: { verificationLevel: 'L0' } });
      await prisma.authSession.update({ where: { id: sessionId }, data: { levelRefreshRequired: false } });

      await expect(admission.admit(token)).rejects.toMatchObject({ code: 'TOKEN_STALE' });
    });
  });

  // ── 4. Le socket DÉJÀ OUVERT ──────────────────────────────────────────────

  /**
   * Ce que la poignée de main ne peut pas garantir.
   *
   * Les trois familles ci-dessus protègent l'ENTRÉE. Une connexion WebSocket vit
   * des heures : si rien ne la revérifie, un membre banni à 10 h garde son canal
   * jusqu'à ce qu'il ferme son onglet. `revalidateAll()` est la moitié qui rend
   * l'autre honnête, et ce test est le seul qui l'éprouve.
   */
  describe('un socket déjà ouvert est fermé quand le membre est banni', () => {
    it('revalidateAll ferme le socket du banni et laisse celui du membre actif', async () => {
      const bannedId = await makeUser();
      const bannedSession = await makeSession(bannedId);
      const bannedToken = tokenFor(bannedId, bannedSession);

      const okId = await makeUser();
      const okSession = await makeSession(okId);
      const okToken = tokenFor(okId, okSession);

      const banned = fakeSocket('s-banni', bannedToken, bannedId, bannedSession);
      const ok = fakeSocket('s-actif', okToken, okId, okSession);

      const gateway = new RealtimeGateway(admission);
      // La doublure de serveur : `revalidateAll` ne demande que `local.fetchSockets`.
      (gateway as unknown as { server: unknown }).server = {
        local: { fetchSockets: () => Promise.resolve([banned.socket, ok.socket]) },
      };

      // Le bannissement, après que les deux sockets sont ouverts.
      await prisma.user.update({ where: { id: bannedId }, data: { status: 'DEACTIVATED' } });

      const result = await gateway.revalidateAll();

      expect(result).toEqual({ examines: 2, fermes: 1 });
      expect(banned.disconnected).toBe(true);
      expect(banned.emitted).toContainEqual(['refused', { code: 'UNAUTHENTICATED' }]);
      // Le membre en règle n'est PAS éjecté : sans cette assertion, une
      // revérification qui fermerait tout passerait pour correcte.
      expect(ok.disconnected).toBe(false);
    });
  });
});

/** Un socket minimal : ce que `revalidateAll` lit, et rien de plus. */
function fakeSocket(id: string, token: string, userId: string, sessionId: string) {
  const state = {
    disconnected: false,
    emitted: [] as [string, unknown][],
    socket: null as unknown as Socket,
  };
  state.socket = {
    id,
    data: { auth: { userId, sessionId, claims: {} } },
    handshake: { auth: { token }, headers: {}, query: {} },
    emit: (event: string, payload: unknown) => {
      state.emitted.push([event, payload]);
      return true;
    },
    disconnect: () => {
      state.disconnected = true;
      return state.socket;
    },
  } as unknown as Socket;
  return state;
}
