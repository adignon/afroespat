import { expect, test } from '@playwright/test';

/**
 * LA GARDE DE SESSION — un visiteur non identifié ne reste pas dans l'application.
 *
 * CE QUE CE FICHIER EXISTE POUR EMPÊCHER DE REVENIR.
 *
 * Il n'y avait AUCUNE garde. Pas « mal branchée » : aucun middleware, aucune
 * redirection, et pas même de `layout.tsx` pour le groupe `(app)` où elle aurait
 * pu vivre — donc personne ne s'est aperçu qu'elle n'y était pas. Un visiteur sans
 * session voyait la coquille de l'application, rail et colonnes comprises, avec
 * des écrans vides derrière. C'est le propriétaire qui l'a vu en ouvrant le
 * produit, après quinze rapports d'agents tous verts.
 *
 * Aucun test ne pouvait l'attraper, parce que tous les tests du produit visitent
 * leurs écrans AVEC une session, ou mesurent le dessin sans se demander qui a le
 * droit de le voir.
 */

/** Les écrans du groupe `(app)`, pris dans trois modules différents. */
const PROTEGES = ['/accueil', '/entraide', '/compte/profil'] as const;

for (const chemin of PROTEGES) {
  test(`[RÈGLE DURE] ${chemin} renvoie un visiteur sans session vers la connexion`, async ({
    page,
  }) => {
    /**
     * Contexte neuf, donc aucun cookie de rafraîchissement : la reprise de session
     * échouera, et c'est exactement le cas qu'on éprouve.
     *
     * `waitUntil: 'load'` et non `networkidle` : Next précharge les liens visibles,
     * et `networkidle` n'arrive pas toujours sur ces écrans — l'attente expirerait
     * sur un message qui ne nomme pas la cause.
     */
    await page.goto(chemin, { waitUntil: 'load' });

    await expect
      .poll(() => new URL(page.url()).pathname, {
        message: `${chemin} a laissé un visiteur sans session dans l’application`,
        timeout: 15_000,
      })
      .toBe('/connexion');

    /**
     * La destination voulue est conservée, pour que la connexion puisse y ramener.
     * Sans cette moitié, la garde renverrait tout le monde sur l'accueil et le
     * membre perdrait l'écran qu'il cherchait.
     */
    expect(new URL(page.url()).searchParams.get('suite')).toBe(chemin);
  });
}

/**
 * LA MOITIÉ QUI EMPÊCHE LA CORRECTION D'ÊTRE PIRE QUE LE DÉFAUT.
 *
 * Une garde cliente qui rendrait `null` en attendant la réponse de la reprise
 * viderait le HTML SERVI — ce composant est client, donc il rendrait `null` au
 * rendu serveur aussi. Cinq pages de ce produit ont déjà été servies vides, dont
 * une qui faisait 8 Ko de script et zéro mot.
 *
 * Ce test lit la réponse SANS exécuter de JavaScript. Il prouve que la garde n'a
 * pas acheté la redirection au prix du rendu serveur.
 */
test('[RÈGLE DURE] la garde n’a pas vidé le HTML servi', async ({ request }) => {
  const reponse = await request.get('/accueil');
  expect(reponse.status()).toBe(200);

  const html = await reponse.text();
  const sansScript = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const mots = sansScript.split(/\s+/).filter((mot) => /[A-Za-zÀ-ÿ]{2,}/.test(mot));

  /**
   * La borne est basse et c'est voulu : elle ne mesure pas la richesse de la page,
   * elle distingue « des mots » de « rien ». Une borne serrée deviendrait fausse à
   * la première page qui change de contenu — et trois bornes de ce dépôt sont déjà
   * devenues fausses par accumulation.
   */
  expect(mots.length, `le HTML servi ne contient que ${mots.length} mot(s)`).toBeGreaterThan(20);
});
