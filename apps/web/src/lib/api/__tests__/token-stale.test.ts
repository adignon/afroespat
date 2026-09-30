import { z } from 'zod';
import { meResponseSchema } from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import { fetchMe, memberApi, resumeSession } from '../member';
import { clearSession, hasAccessToken, knownMe, setAccessToken } from '../session';
import { errorBody, fakeServer, fakeToken, meBody, type FakeServer } from './harness';

/**
 * `TOKEN_STALE`, LE RAFRAÎCHISSEMENT, ET CE QUE LA CORRECTION OUVRE.
 *
 * T4 §2 : « `level_refresh_required` → `401` `code: TOKEN_STALE` → le client
 * rafraîchit et rejoue. » C'est la consigne. Ces tests gardent ce que le client doit
 * faire EN PLUS, et qui n'est pas dans la consigne.
 *
 * L'HISTOIRE, parce qu'elle explique la forme des tests :
 *
 *   1. `level_refresh_required` était posé et lu par personne — un membre rétrogradé
 *      gardait ses droits quinze minutes ;
 *   2. la correction a lu le drapeau, mais `/auth/refresh` le remet à `false` : le
 *      VIEUX jeton, encore cryptographiquement valide, redevenait acceptable AVEC SON
 *      ANCIEN NIVEAU. Une élévation de privilège ouverte par le remède ;
 *   3. la correction de la correction compare aussi `claims.level` au niveau en base.
 *      Vérifié à l'appel sur l'API qui tourne — voir le rapport.
 *
 * CE QUE LE FRONT PEUT OUVRIR À SON TOUR. Rafraîchir et rejouer ne peut pas élargir
 * de droits : le serveur re-décide entièrement sur le nouveau jeton. Mais s'il GARDE
 * une copie du niveau et s'en sert, il rejoue l'étape 1 dans sa propre monnaie — un
 * membre rétrogradé garde une interface de niveau supérieur aussi longtemps que vit
 * la copie. D'où la règle du socle : `TOKEN_STALE` ne veut pas dire « ton jeton est
 * vieux », il veut dire « tout ce que tu crois savoir des droits est périmé ».
 */
describe('TOKEN_STALE : rafraîchir, rejouer, et OUBLIER les droits', () => {
  let server: FakeServer;
  const ok = z.object({ ok: z.boolean() });

  afterEach(() => {
    server?.restore();
    clearSession();
  });

  it('[RÈGLE DURE] un TOKEN_STALE est rafraîchi puis rejoué', async () => {
    setAccessToken(fakeToken('perime'));

    server = fakeServer((call) => {
      if (call.url.includes('/auth/refresh')) {
        return { json: { accessToken: fakeToken('frais') } };
      }
      // Le premier appel est refusé, le rejeu passe.
      const before = call.headers['authorization'] === 'Bearer entete.perime.signature';
      return before
        ? {
            status: 401,
            json: errorBody('TOKEN_STALE', 'Votre session doit être actualisée.', {
              reason: 'niveau de vérification modifié',
            }),
          }
        : { json: { ok: true } };
    });

    await expect(memberApi.get('/me', ok)).resolves.toEqual({ ok: true });

    expect(server.matching('/auth/refresh')).toHaveLength(1);
    // Le rejeu porte le jeton NEUF, pas l'ancien.
    const replay = server.calls[2];
    expect(replay?.headers['authorization']).toBe('Bearer entete.frais.signature');
  });

  it('[RÈGLE DURE] un TOKEN_STALE JETTE la copie des droits', async () => {
    /**
     * LE TEST LE PLUS IMPORTANT DE CE FICHIER.
     *
     * On charge `/me` à L1 et le socle s'en souvient. Puis un appel prend
     * `TOKEN_STALE` : le serveur vient de dire que les droits ont changé. La copie à
     * L1 doit être JETÉE — sinon le front continue d'afficher une interface L1 à un
     * membre redescendu à L0, ce qui est la faille de quinze minutes rejouée côté
     * client.
     */
    setAccessToken(fakeToken('perime'));

    server = fakeServer((call) => {
      if (call.url.includes('/auth/refresh')) return { json: { accessToken: fakeToken('frais') } };
      if (call.url.endsWith('/me')) return { json: meBody({ level: 'L1' }) };
      if (call.headers['authorization'] === 'Bearer entete.perime.signature') {
        return { status: 401, json: errorBody('TOKEN_STALE') };
      }
      return { json: { ok: true } };
    });

    const me = await fetchMe();
    expect(me.user.verificationLevel).toBe('L1');
    expect(knownMe()).not.toBeNull();

    await memberApi.post('/posts', ok, { body: {} });

    expect(
      knownMe(),
      'Après un TOKEN_STALE, le niveau connu doit être OUBLIÉ : le serveur vient de ' +
        'dire qu’il a changé.',
    ).toBeNull();
    // Et la session est toujours là : ce n'est pas une déconnexion.
    expect(hasAccessToken()).toBe(true);
  });

  it('[RÈGLE DURE] la lecture suivante de /me repart du SERVEUR', async () => {
    // Le corollaire du test précédent : oublier ne sert à rien si `fetchMe` ne
    // redemande pas. On vérifie le niveau REDESCENDU, comme dans une rétrogradation.
    setAccessToken(fakeToken('perime'));
    let level = 'L1';

    server = fakeServer((call) => {
      if (call.url.includes('/auth/refresh')) return { json: { accessToken: fakeToken('frais') } };
      if (call.url.endsWith('/me')) return { json: meBody({ level }) };
      if (call.headers['authorization'] === 'Bearer entete.perime.signature') {
        return { status: 401, json: errorBody('TOKEN_STALE') };
      }
      return { json: { ok: true } };
    });

    expect((await fetchMe()).user.verificationLevel).toBe('L1');

    // Rétrogradation côté serveur, puis un appel qui prend TOKEN_STALE.
    level = 'L0';
    await memberApi.post('/posts', ok, { body: {} });

    expect((await fetchMe()).user.verificationLevel).toBe('L0');
  });

  it('[RÈGLE DURE] un LEVEL_REQUIRED jette aussi la copie', async () => {
    /**
     * `LEVEL_REQUIRED` est un `403`, pas un `401` : il ne déclenche aucun
     * rafraîchissement. Mais il PROUVE que le niveau connu du front est faux — le
     * serveur vient de refuser une action que ce niveau aurait permise. Garder la
     * copie laisserait l'interface promettre ce que l'API refuse.
     */
    setAccessToken(fakeToken());

    server = fakeServer((call) =>
      call.url.endsWith('/me')
        ? { json: meBody({ level: 'L1' }) }
        : {
            status: 403,
            json: errorBody('LEVEL_REQUIRED', 'Cette action demande de vérifier votre compte.', {
              capability: 'post.create',
              requiredLevel: 'L1',
              currentLevel: 'L0',
            }),
          },
    );

    await fetchMe();
    expect(knownMe()).not.toBeNull();

    const error = (await memberApi
      .post('/posts', ok, { body: {} })
      .catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('LEVEL_REQUIRED');
    expect(
      knownMe(),
      'Un LEVEL_REQUIRED démentit le niveau que le front croyait connaître.',
    ).toBeNull();
  });

  it('[RÈGLE DURE] un seul rejeu : un TOKEN_STALE persistant ne boucle pas', async () => {
    // Un serveur qui répond toujours `TOKEN_STALE` ne doit pas faire tourner le client
    // en rond sur `/auth/refresh` — laquelle porte `@RateLimit(30)` et finirait par
    // répondre 429, c'est-à-dire un message trompeur à la place du bon.
    setAccessToken(fakeToken());

    server = fakeServer((call) =>
      call.url.includes('/auth/refresh')
        ? { json: { accessToken: fakeToken('frais') } }
        : { status: 401, json: errorBody('TOKEN_STALE') },
    );

    const error = (await memberApi.get('/me', ok).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('TOKEN_STALE');
    expect(server.matching('/auth/refresh')).toHaveLength(1);
    // Appel initial + refresh + rejeu = 3. Pas davantage.
    expect(server.calls).toHaveLength(3);
  });

  it('[RÈGLE DURE] si le rejeu échoue pour une AUTRE raison, c’est CETTE raison qui remonte', async () => {
    /**
     * Le cas : premier appel `TOKEN_STALE`, rafraîchissement réussi, et entre-temps la
     * session est révoquée — le rejeu répond `SESSION_REVOKED`.
     *
     * Ma première version rapportait `TOKEN_STALE`, parce qu'elle réutilisait le corps
     * du PREMIER refus avec le statut de la SECONDE réponse. L'appelant aurait cru
     * devoir réessayer là où il fallait renvoyer à la connexion. Deux réponses, deux
     * corps.
     */
    setAccessToken(fakeToken('perime'));

    server = fakeServer((call, index) => {
      if (call.url.includes('/auth/refresh')) return { json: { accessToken: fakeToken('frais') } };
      return index === 1
        ? { status: 401, json: errorBody('TOKEN_STALE') }
        : { status: 401, json: errorBody('SESSION_REVOKED', 'Votre session a expiré.') };
    });

    const error = (await memberApi.get('/me', ok).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('SESSION_REVOKED');
    expect(error.displayMessage).toContain('session');
  });

  it('[RÈGLE DURE] cinq appels simultanés ne déclenchent qu’UN rafraîchissement', async () => {
    /**
     * LA ROTATION EST À GÉNÉRATION (décision D : `chain_id` + `token_generation`).
     *
     * Cinq rafraîchissements concurrents présentent la même génération ; le second
     * paraît DÉPASSÉ au serveur, qui y voit un rejeu — ce pour quoi la détection est
     * faite — et RÉVOQUE LA CHAÎNE ENTIÈRE. Le membre est déconnecté au hasard, au
     * chargement d'une page, et le journal du serveur accuse un rejeu qui n'a pas eu
     * lieu. Un défaut qu'on ne voit jamais en développement, où les appels partent un
     * par un.
     */
    setAccessToken(fakeToken('perime'));

    server = fakeServer((call) => {
      if (call.url.includes('/auth/refresh')) return { json: { accessToken: fakeToken('frais') } };
      return call.headers['authorization'] === 'Bearer entete.perime.signature'
        ? { status: 401, json: errorBody('TOKEN_STALE') }
        : { json: { ok: true } };
    });

    await Promise.all([
      memberApi.get('/me', ok),
      memberApi.get('/feed', ok),
      memberApi.get('/notifications', ok),
      memberApi.get('/auth/sessions', ok),
      memberApi.get('/places/countries', ok),
    ]);

    expect(
      server.matching('/auth/refresh'),
      'Plusieurs rotations concurrentes font révoquer la chaîne entière (décision D).',
    ).toHaveLength(1);
  });

  it('un UNAUTHENTICATED est rafraîchi une fois — le jeton expiré est le cas COURANT', async () => {
    /**
     * Le serveur emploie `UNAUTHENTICATED` pour DEUX situations qu'il ne distingue
     * pas (vérifié dans `auth.guard.ts`) : un jeton d'accès EXPIRÉ au-delà de quinze
     * minutes, et une session RÉVOQUÉE. Le premier se répare par un
     * rafraîchissement, le second non — et c'est le premier qui est courant.
     *
     * On rafraîchit donc une fois et on laisse `/auth/refresh` trancher : il a la
     * vérité, et il répond `SESSION_REVOKED` sur une chaîne coupée.
     */
    setAccessToken(fakeToken('expire'));

    server = fakeServer((call) => {
      if (call.url.includes('/auth/refresh')) return { json: { accessToken: fakeToken('frais') } };
      return call.headers['authorization'] === 'Bearer entete.expire.signature'
        ? { status: 401, json: errorBody('UNAUTHENTICATED') }
        : { json: meBody() };
    });

    await expect(memberApi.get('/me', meResponseSchema)).resolves.toMatchObject({
      user: { verificationLevel: 'L0' },
    });
    expect(server.matching('/auth/refresh')).toHaveLength(1);
  });

  it('[RÈGLE DURE] un refus définitif du rafraîchissement TUE la session, sans marteler', async () => {
    /**
     * Session révoquée : `/auth/refresh` répond `401 SESSION_REVOKED`. Sans le drapeau
     * de session morte, chacun des appels suivants relancerait un rafraîchissement —
     * dix composants au chargement d'une page font dix appels sur une route à 30/min,
     * qui finit par répondre 429. On passerait d'un « reconnectez-vous » clair à un
     * « trop de tentatives » trompeur.
     */
    setAccessToken(fakeToken());

    server = fakeServer((call) =>
      call.url.includes('/auth/refresh')
        ? { status: 401, json: errorBody('SESSION_REVOKED', 'Votre session a expiré.') }
        : { status: 401, json: errorBody('UNAUTHENTICATED') },
    );

    for (let i = 0; i < 4; i++) {
      await memberApi.get('/me', ok).catch(() => undefined);
    }

    expect(
      server.matching('/auth/refresh'),
      'Un verdict définitif se retient : on ne redemande pas.',
    ).toHaveLength(1);
    expect(hasAccessToken()).toBe(false);
  });

  it('un SESSION_REVOKED sur l’appel lui-même ne déclenche aucun rafraîchissement', async () => {
    // La décision est déjà prise : rafraîchir ne ferait que brûler une génération.
    setAccessToken(fakeToken());
    server = fakeServer(() => ({ status: 401, json: errorBody('SESSION_REVOKED') }));

    await memberApi.get('/me', ok).catch(() => undefined);

    expect(server.matching('/auth/refresh')).toHaveLength(0);
  });

  it('un CROSS_DOMAIN_TOKEN n’est JAMAIS rejoué', async () => {
    /**
     * C'est un DÉFAUT DE CODE, pas un problème de session : un jeton de membre est
     * parti sur une route d'équipe. Le rejouer masquerait le bogue au lieu de le
     * montrer — et le client de ce socle ne peut de toute façon pas le produire (voir
     * `domain-seal.test.ts`). Si jamais il arrive, il doit remonter tel quel.
     */
    setAccessToken(fakeToken());
    server = fakeServer(() => ({ status: 401, json: errorBody('CROSS_DOMAIN_TOKEN') }));

    const error = (await memberApi.get('/me', ok).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('CROSS_DOMAIN_TOKEN');
    expect(server.matching('/auth/refresh')).toHaveLength(0);
  });

  it('une panne réseau pendant le rafraîchissement ne tue PAS la session', async () => {
    // Un refus du serveur est un verdict ; une absence de réponse n'en est pas un.
    // Déconnecter sur une coupure de wifi obligerait à refaire l'OTP — SMS compris —
    // pour rien.
    setAccessToken(fakeToken());

    server = fakeServer((call) => {
      if (call.url.includes('/auth/refresh')) throw new TypeError('Failed to fetch');
      return { status: 401, json: errorBody('UNAUTHENTICATED') };
    });

    await memberApi.get('/me', ok).catch(() => undefined);
    // La session n'est pas morte : un second appel retente le rafraîchissement.
    await memberApi.get('/me', ok).catch(() => undefined);

    expect(server.matching('/auth/refresh')).toHaveLength(2);
  });

  it('[RÈGLE DURE] un rafraîchissement de forme inattendue n’installe pas « undefined » comme jeton', async () => {
    /**
     * La frontière tient même ici. Un `200` dont le corps n'a pas la bonne forme ne
     * doit pas poser un jeton indéfini : tous les appels partiraient alors avec
     * `Authorization: Bearer undefined`, que le serveur refuse — un symptôme de
     * « session expirée » dont la vraie cause est un contrat cassé.
     */
    setAccessToken(fakeToken());

    server = fakeServer((call) =>
      call.url.includes('/auth/refresh')
        ? { json: { token: 'mauvaise-clef' } }
        : { status: 401, json: errorBody('UNAUTHENTICATED') },
    );

    await memberApi.get('/me', ok).catch(() => undefined);

    // Le rejeu n'a pas eu lieu : le rafraîchissement a échoué proprement.
    expect(server.calls.filter((c) => c.url.endsWith('/me'))).toHaveLength(1);
    for (const call of server.calls) {
      expect(call.headers['authorization'] ?? '').not.toContain('undefined');
    }
  });

  it('resumeSession récupère une session après un rechargement de page', async () => {
    // Le jeton vit en mémoire et meurt avec l'onglet ; le cookie dure trente jours.
    clearSession();
    expect(hasAccessToken()).toBe(false);

    server = fakeServer(() => ({ json: { accessToken: fakeToken('repris') } }));

    await expect(resumeSession()).resolves.toBe(true);
    expect(hasAccessToken()).toBe(true);
  });
});
