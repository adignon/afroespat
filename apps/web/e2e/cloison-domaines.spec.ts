import { expect, test } from '@playwright/test';

/**
 * LA CLOISON ENTRE LES DEUX DOMAINES, VUE DU NAVIGATEUR.
 *
 * CE QUE CE FICHIER EXISTE POUR EMPÊCHER DE REVENIR.
 *
 * `<SessionBoot />` — la reprise de session MEMBRE — vivait dans le layout RACINE,
 * avec cette raison écrite noir sur blanc : « ici plutôt que dans chaque groupe de
 * routes : la session se reprend une fois par chargement, pas une fois par zone de
 * l'application ». Le raisonnement était juste quand il n'existait qu'une zone. Il
 * est devenu faux le jour où `(admin)` a existé — et personne ne l'a relu.
 *
 * Conséquence mesurée au navigateur : toute page d'administration émettait
 * `POST /v1/auth/refresh`. Un membre de l'équipe qui a aussi un compte membre dans
 * le même navigateur faisait donc ACQUÉRIR UN JETON D'ACCÈS MEMBRE EN MÉMOIRE À UNE
 * PAGE D'ADMINISTRATION, alors que 15 §2.1 déclare les deux domaines hermétiques et
 * que le serveur refuse toute route qui déclarerait les deux.
 *
 * Aucun test ne pouvait l'attraper : les tests du domaine membre ne visitent pas
 * les pages d'équipe, et ceux de l'équipe ne regardent pas le trafic du domaine
 * membre. Le défaut vivait exactement dans l'angle mort entre les deux suites.
 *
 * ── CE QU'ON MESURE, ET POURQUOI C'EST LE TRAFIC ───────────────────────────
 *
 * On n'affirme pas sur le code — un test qui lirait `layout.tsx` passerait encore
 * si quelqu'un remettait la reprise ailleurs. On observe ce que le NAVIGATEUR
 * ÉMET, qui est la seule chose qui compte pour la cloison.
 */

/** Les routes du domaine membre qu'une page d'équipe ne doit jamais appeler. */
const ROUTES_MEMBRE = ['/v1/auth/refresh', '/v1/me'] as const;

test('[RÈGLE DURE] une page d’équipe n’appelle aucune route du domaine membre', async ({
  page,
}) => {
  const vues: string[] = [];
  page.on('request', (requete) => {
    const chemin = new URL(requete.url()).pathname;
    if (ROUTES_MEMBRE.some((route) => chemin.startsWith(route))) vues.push(chemin);
  });

  await page.goto('/admin/connexion', { waitUntil: 'load' });

  /**
   * Une attente explicite, et elle est nécessaire : la reprise partait depuis un
   * effet, donc APRÈS le chargement. Conclure sur `load` seul laisserait passer
   * exactement le défaut qu'on traque — le test serait vert pour une raison de
   * minutage, pas de cloison.
   */
  await page.waitForTimeout(2_000);

  expect(
    vues,
    'une page d’équipe a appelé le domaine membre : la reprise de session membre s’exécute sur `(admin)`',
  ).toEqual([]);
});

/**
 * LA MOITIÉ SYMÉTRIQUE, sans laquelle la première ne prouve rien.
 *
 * Supprimer la reprise de session partout ferait passer le test ci-dessus. Celui-ci
 * exige qu'elle ait bien lieu LÀ OÙ ELLE DOIT — sur l'accès membre. Les deux
 * ensemble disent « au bon endroit », là où un seul dirait « nulle part ».
 */
test('[RÈGLE DURE] la page d’accès membre, elle, reprend bien la session', async ({ page }) => {
  const vues: string[] = [];
  page.on('request', (requete) => {
    if (new URL(requete.url()).pathname.startsWith('/v1/auth/refresh')) {
      vues.push(requete.url());
    }
  });

  await page.goto('/connexion', { waitUntil: 'load' });

  await expect
    .poll(() => vues.length, {
      message: 'la page d’accès membre ne reprend plus la session : la correction a trop retiré',
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
});
