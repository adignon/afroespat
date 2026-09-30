import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { assertMemberPath, assertSafePath, assertStaffPath } from '../domains';
import { memberApi } from '../member';
import { clearSession, setAccessToken } from '../session';
import { staffApi } from '../staff';
import { expectNoBearer, fakeServer, fakeToken, type FakeServer } from './harness';

/**
 * L'ÉTANCHÉITÉ DES DEUX DOMAINES — règle dure 15 §2.1, 00 §7.4.
 *
 * « Un jeton de membre est refusé sur une route d'équipe. » Le serveur le refuse par
 * `CROSS_DOMAIN_TOKEN` — vérifié à l'appel sur l'API qui tourne. Ces tests gardent
 * la propriété CÔTÉ CLIENT, qui est plus forte : le client ne peut pas commettre la
 * faute, donc `CROSS_DOMAIN_TOKEN` ne doit jamais arriver.
 */
describe('étanchéité des domaines', () => {
  let server: FakeServer;
  const ok = z.object({ ok: z.boolean() });

  afterEach(() => {
    server?.restore();
    clearSession();
  });

  it('[RÈGLE DURE] staffApi n’envoie AUCUN Authorization, même avec un jeton de membre en main', async () => {
    /**
     * LE TEST CENTRAL DE CE FICHIER.
     *
     * Le jeton est posé — un membre est connecté dans le même onglet, ce qui est la
     * situation réelle d'un membre de l'équipe qui a aussi un compte. Puis on appelle
     * une route d'équipe. Rien ne doit partir.
     *
     * Et ce n'est pas obtenu par une condition dans `staff.ts` : ce module n'importe
     * pas `session.ts`, et son descripteur `{ kind: 'cookie' }` ne contient aucune
     * fonction capable de produire l'en-tête. Le test constate la propriété ; le test
     * suivant garde la construction qui la rend vraie.
     */
    setAccessToken(fakeToken());
    server = fakeServer(() => ({ json: { ok: true } }));

    await staffApi.get('/moderation/cases', ok);

    expect(server.calls).toHaveLength(1);
    expectNoBearer(server.calls);
  });

  it('[RÈGLE DURE] staff.ts n’importe pas le magasin du jeton', () => {
    /**
     * La construction, gardée directement.
     *
     * Le test précédent constate un COMPORTEMENT : il resterait vert si quelqu'un
     * ajoutait l'en-tête sous une condition que le test ne déclenche pas. Celui-ci
     * garde la STRUCTURE — `staff.ts` n'a aucun accès au jeton — qui est ce qui rend
     * la faute inexprimable plutôt que seulement absente.
     *
     * Un test qui lit du source est grossier, et assumé ici : la propriété à garder
     * EST une propriété du source. L'alternative — vérifier chaque chemin de code —
     * est précisément ce qu'on ne peut pas faire de façon exhaustive.
     */
    const raw = readFileSync(resolve(__dirname, '..', 'staff.ts'), 'utf8');

    /**
     * LES COMMENTAIRES SONT RETIRÉS, et il le faut.
     *
     * La première version de ce test lisait le fichier tel quel, et il a rougi : les
     * commentaires de `staff.ts` EXPLIQUENT pourquoi il n'y a pas de `bearerHeader`
     * ni d'`Authorization`, donc ils contiennent ces mots. Un test qui interdit de
     * documenter la règle qu'il garde est un test qui pousse à effacer l'explication
     * — exactement l'inverse de ce qu'on veut.
     */
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    // Le test se garde lui-même : si le dépouillement mangeait tout, les assertions
    // ci-dessous passeraient sur une chaîne vide.
    expect(code).toContain('staffApi');
    expect(code).toContain("kind: 'cookie'");

    expect(
      code,
      `staff.ts ne doit pas pouvoir lire le jeton du membre : c’est le troisième fait ` +
        `de l’étanchéité (règle dure 15 §2.1).`,
    ).not.toMatch(/from\s+'\.\/session'/);
    expect(code).not.toMatch(/bearerHeader/);
    expect(code).not.toMatch(/authorization/i);
  });

  it('[RÈGLE DURE] tout appel de staffApi atterrit sous /admin', async () => {
    server = fakeServer(() => ({ json: { ok: true } }));

    await staffApi.get('/moderation/cases', ok);
    await staffApi.post('/auth/login', ok, { body: {} });
    await staffApi.patch('/settings/x', ok, { body: {} });

    for (const call of server.calls) {
      expect(call.url, `${call.url} sort du domaine de l’équipe`).toMatch(/\/v1\/admin\//);
    }
    // Et notamment : `/auth/login` du client d'équipe ne vise PAS `/v1/auth/login`.
    expect(server.calls[1]?.url).toContain('/v1/admin/auth/login');
    expect(server.calls[1]?.url).not.toMatch(/\/v1\/auth\/login/);
  });

  it('[RÈGLE DURE] memberApi refuse un chemin /admin calculé', () => {
    // Les types refusent le littéral (voir `type-seal.ts`). Ici c'est le chemin
    // CALCULÉ — celui qui vient d'une variable — que le contrôle d'exécution arrête.
    const computed = `/${'admin'}/moderation/cases`;
    expect(() => assertMemberPath(computed)).toThrow(/domaine/i);
  });

  it('[RÈGLE DURE] un segment « .. » est refusé dans les deux domaines', () => {
    /**
     * L'ÉVASION QU'UNE SIMPLE CONCATÉNATION LAISSERAIT PASSER.
     *
     * `staffApi.get('/../me')` construit `/v1/admin/../me`, que le NAVIGATEUR
     * normalise en `/v1/me` AVANT d'émettre. Le préfixe ne protège donc rien à lui
     * seul : un client d'équipe atteindrait une route de membre. C'est le trou d'une
     * séparation qui ne reposerait que sur le préfixe, et c'est pour cela que le
     * contrôle existe en plus des deux autres faits.
     */
    expect(() => assertStaffPath('/../me')).toThrow(/\.\./);
    expect(() => assertStaffPath('/cases/../../me')).toThrow(/\.\./);
    expect(() => assertMemberPath('/../admin/moderation')).toThrow(/\.\./);

    // Deux points DANS un segment ne sont pas une remontée : « a..b » est un
    // identifiant biscornu, pas une évasion. Refuser sur la chaîne entière aurait
    // rejeté des chemins légitimes.
    expect(() => assertSafePath('/guides/a..b')).not.toThrow();
  });

  it('[RÈGLE DURE] une URL protocol-relative est refusée', () => {
    // `fetch('//exemple.test/x')` part sur un AUTRE HÔTE. Le chemin appelé n'est plus
    // celui qu'on croit, et les cookies de ce domaine partent avec.
    expect(() => assertSafePath('//exemple.test/vol')).toThrow(/autre hôte/);
    expect(() => assertMemberPath('//exemple.test/vol')).toThrow();
    expect(() => assertStaffPath('//exemple.test/vol')).toThrow();
  });

  it('un chemin qui ne commence pas par « / » est refusé', () => {
    // Sinon il se collerait à la base sans séparateur : `http://…/v1me`.
    expect(() => assertSafePath('me')).toThrow(/commencer par/);
  });

  it('staffApi refuse un chemin qui redouble son préfixe', () => {
    // `staffApi.get('/admin/x')` viserait `/v1/admin/admin/x` — un 404 sans cause
    // lisible. Autant refuser tout de suite.
    expect(() => assertStaffPath('/admin/moderation')).toThrow(/préfixe/);
  });

  it('memberApi accepte les chemins de membre, y compris ceux qui contiennent « admin »', () => {
    /**
     * Le pendant obligatoire : le refus doit être PRÉCIS.
     *
     * Un contrôle qui rejetterait toute occurrence du mot « admin » casserait des
     * routes légitimes — un guide dont le slug parle d'administration, une recherche
     * sur ce mot. La règle porte sur le PREMIER SEGMENT, pas sur la sous-chaîne.
     */
    expect(() => assertMemberPath('/guides/demarches-administratives')).not.toThrow();
    expect(() => assertMemberPath('/search?q=admin')).not.toThrow();
    expect(() => assertMemberPath('/administration')).not.toThrow();
    expect(() => assertMemberPath('/me')).not.toThrow();
  });

  it('memberApi porte bien le jeton quand il y en a un', async () => {
    // Sans cette assertion, « staffApi n'envoie pas de jeton » passerait pour la pire
    // des raisons : un socle qui n'en enverrait jamais.
    setAccessToken(fakeToken('abc'));
    server = fakeServer(() => ({ json: { ok: true } }));

    await memberApi.get('/me', ok);

    expect(server.calls[0]?.headers['authorization']).toBe('Bearer entete.abc.signature');
  });

  it('les deux domaines envoient les cookies (CORS credentials)', async () => {
    /**
     * `credentials: 'include'` sur les DEUX.
     *
     * Le front et l'API sont sur des origines différentes. Sans ce drapeau, ni
     * `dp_refresh` ni `dp_staff` ne partent, et les deux sessions échouent — avec le
     * symptôme trompeur d'une session expirée.
     */
    setAccessToken(fakeToken());
    server = fakeServer(() => ({ json: { ok: true } }));

    await memberApi.get('/me', ok);
    await staffApi.get('/moderation/cases', ok);

    for (const call of server.calls) {
      expect(call.credentials, `${call.url} n’envoie pas les cookies`).toBe('include');
    }
  });
});
