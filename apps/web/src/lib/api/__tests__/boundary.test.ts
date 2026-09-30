import { z } from 'zod';
import { meResponseSchema, pageSchema } from '@app/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, ApiNetworkError, ApiShapeError } from '../errors';
import { memberApi } from '../member';
import { clearSession, setAccessToken } from '../session';
import { voidResponse } from '../void-response';
import { errorBody, fakeServer, fakeToken, meBody, type FakeServer } from './harness';

/**
 * LA FRONTIÈRE : une réponse de forme inattendue LÈVE, elle ne se propage pas.
 *
 * C'est la raison d'être du socle. Sans validation, une API qui change de forme ne
 * produit aucune erreur à l'appel : `items` devient `undefined`, et le `.map` qui
 * suit lève « cannot read properties of undefined » dans un composant qui n'a rien
 * fait de mal, plusieurs appels plus loin, sans jamais nommer la route.
 */
describe('frontière : la réponse est validée', () => {
  let server: FakeServer;

  afterEach(() => {
    server?.restore();
    clearSession();
  });

  const citySchema = z.object({ id: z.string().uuid(), name: z.string() });

  it('[RÈGLE DURE] un champ manquant lève ApiShapeError', () => {
    // `nextCursor` absent : §5.3 le promet « null en fin de liste », donc son
    // absence est une réponse cassée. L'accepter ferait prendre une pagination muette
    // pour une fin de liste — le fil s'arrêterait sans raison visible.
    server = fakeServer(() => ({
      json: { items: [{ id: '01a0e1b0-03a1-7000-8244-5a2df8ef5762', name: 'Paris' }] },
    }));

    return expect(
      memberApi.get('/places/cities', pageSchema(citySchema)),
    ).rejects.toBeInstanceOf(ApiShapeError);
  });

  it('[RÈGLE DURE] le message nomme la route ET le champ fautif', async () => {
    server = fakeServer(() => ({ json: { items: 'pas-un-tableau', nextCursor: null } }));

    // `.rejects.toThrow` sur une sous-chaîne, et non une égalité : ce qui compte est
    // qu'on puisse RETROUVER la cause, pas la formulation exacte.
    const failure = await memberApi
      .get('/places/cities', pageSchema(citySchema))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiShapeError);
    expect((failure as ApiShapeError).message).toContain('/places/cities');
    expect((failure as ApiShapeError).message).toContain('items');
  });

  it('[RÈGLE DURE] un type erroné dans un champ imbriqué lève aussi', () => {
    // `verificationLevel: 'L9'` — un niveau qui n'existe pas. Avant que `MeResponse`
    // ne soit un schéma, ce champ était `string` : « L9 » passait, et le front
    // pouvait décider sur une valeur qu'aucune règle ne connaît.
    const broken = meBody() as { user: Record<string, unknown> };
    broken.user['verificationLevel'] = 'L9';
    server = fakeServer(() => ({ json: broken }));
    setAccessToken(fakeToken());

    return expect(memberApi.get('/me', meResponseSchema)).rejects.toBeInstanceOf(ApiShapeError);
  });

  it('une réponse conforme passe, et ressort typée', async () => {
    // Le pendant obligatoire : sans lui, les assertions ci-dessus passeraient pour la
    // pire des raisons — un client qui refuse TOUT.
    server = fakeServer(() => ({ json: meBody() }));
    setAccessToken(fakeToken());

    const me = await memberApi.get('/me', meResponseSchema);
    expect(me.user.verificationLevel).toBe('L0');
    expect(me.phones[0]?.masked).toBe('+229 •• •• •• 99');
    expect(me.onboarding.step).toBe(1);
  });

  it('[RÈGLE DURE] un 200 qui n’est pas du JSON lève une erreur de FORME, pas une erreur métier', async () => {
    // Le cas réel : page d'erreur HTML d'un proxy, portail captif, 502 déguisé en
    // 200. Le serveur a dit oui, donc ce n'est pas un refus ; c'est un contrat cassé.
    server = fakeServer(() => ({ text: '<html><body>502 Bad Gateway</body></html>' }));

    const failure = await memberApi
      .get('/places/countries', pageSchema(citySchema))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiShapeError);
    expect(failure).not.toBeInstanceOf(ApiError);
  });

  it('[RÈGLE DURE] ApiShapeError n’est PAS un ApiError', async () => {
    /**
     * L'assertion la plus importante de ce fichier.
     *
     * Le réflexe est `catch (e) { if (e instanceof ApiError) afficher(e.displayMessage) }`.
     * Si `ApiShapeError` en héritait, un CHANGEMENT DE CONTRAT s'afficherait comme
     * un refus métier : le membre lit « une erreur est survenue », et personne
     * n'apprend jamais que l'API a changé de forme. La hiérarchie est donc une règle,
     * pas un détail d'implémentation.
     */
    server = fakeServer(() => ({ json: { items: [] } }));

    const failure = await memberApi
      .get('/places/cities', pageSchema(citySchema))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiShapeError);
    expect(failure).not.toBeInstanceOf(ApiError);
    expect(failure).not.toBeInstanceOf(ApiNetworkError);
  });

  it('un 204 satisfait voidResponse', async () => {
    server = fakeServer(() => ({ status: 204 }));
    setAccessToken(fakeToken());

    await expect(memberApi.del('/auth/sessions/x', voidResponse)).resolves.toBeUndefined();
  });

  it('[RÈGLE DURE] un 204 sur une route déclarée avec un corps lève', () => {
    // Un désaccord entre le client et l'API. Le taire rendrait `undefined` à un
    // appelant qui attend un objet — le défaut même qu'on rend impossible.
    server = fakeServer(() => ({ status: 204 }));
    setAccessToken(fakeToken());

    return expect(memberApi.get('/me', meResponseSchema)).rejects.toBeInstanceOf(ApiShapeError);
  });

  it('une panne réseau donne ApiNetworkError, pas une erreur de forme', async () => {
    // La distinction compte : « le réseau est coupé » se répare en réessayant,
    // « le contrat est cassé » non. Les confondre ferait réessayer en boucle.
    server = fakeServer(() => {
      throw new TypeError('Failed to fetch');
    });

    const failure = await memberApi
      .get('/places/countries', pageSchema(citySchema))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiNetworkError);
    expect((failure as ApiNetworkError).displayMessage).toContain('Connexion impossible');
  });

  it('un refus du serveur reste un ApiError, avec son code', async () => {
    server = fakeServer(() => ({
      status: 403,
      json: errorBody('LEVEL_REQUIRED', 'Cette action demande de vérifier votre compte.', {
        capability: 'post.create',
        requiredLevel: 'L1',
        currentLevel: 'L0',
        labelFr: 'publier dans le fil',
      }),
    }));
    setAccessToken(fakeToken());

    const failure = await memberApi
      .post('/posts', z.object({ id: z.string() }), { body: { type: 'TEXT' } })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    const error = failure as ApiError;
    expect(error.code).toBe('LEVEL_REQUIRED');
    expect(error.status).toBe(403);
    // §7.3 : le front affiche une INVITATION à monter de niveau, pas une erreur.
    // Il lui faut donc ces trois champs, typés.
    expect(error.levelRequired).toMatchObject({
      requiredLevel: 'L1',
      currentLevel: 'L0',
      labelFr: 'publier dans le fil',
    });
  });

  it('une erreur hors format §5.2 n’invente pas de code métier', async () => {
    // Un `500` d'un intermédiaire, en HTML. `UNPARSEABLE_ERROR` n'est dans aucune des
    // vingt tables, donc `isKnown` est faux et personne ne le prendra pour une règle.
    server = fakeServer(() => ({ status: 502, text: '<html>oups</html>' }));

    const failure = await memberApi
      .get('/places/countries', pageSchema(citySchema))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('UNPARSEABLE_ERROR');
    expect((failure as ApiError).isKnown).toBe(false);
  });

  it('le format par défaut de Nest n’est pas pris pour le format §5.2', async () => {
    // `{ message, error: 'Not Found', statusCode }` — `error` y est une CHAÎNE. Un
    // simple `'error' in body` le laissait passer, et le `code` sortait indéfini.
    // C'est le même piège que `error.filter.ts` documente côté serveur.
    server = fakeServer(() => ({
      status: 404,
      json: { message: 'Not Found', error: 'Not Found', statusCode: 404 },
    }));

    const failure = await memberApi
      .get('/introuvable', pageSchema(citySchema))
      .catch((error: unknown) => error);

    expect((failure as ApiError).code).toBe('UNPARSEABLE_ERROR');
  });
});
