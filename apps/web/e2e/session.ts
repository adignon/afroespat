import type { APIRequestContext, BrowserContext } from '@playwright/test';

/**
 * OUVRIR UNE VRAIE SESSION DE MEMBRE, pour éprouver un écran qui lit l'API.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * Les dix écrans du module Compte lisaient la maquette : ils s'ouvraient sans
 * session, et leur suite de tests n'avait pas besoin d'en ouvrir une. Depuis
 * qu'ils lisent l'API, un écran sans session n'affiche plus que « Chargement… »
 * puis une invitation à se reconnecter — et un test qui n'en ouvrirait pas
 * mesurerait l'écran d'erreur en croyant mesurer l'écran.
 *
 * C'est exactement le genre de succès qui ne prouve rien, et c'est pour l'éviter
 * que `connecter()` rend le membre créé : les tests affirment sur SES valeurs, et
 * non sur celles de la maquette. Un test qui cherche encore « Amina Diallo »
 * — le nom dessiné — passerait sans session et échouerait avec, ce qui est le bon
 * sens : le nom affiché doit venir du serveur.
 *
 * ── CE QUI SE PASSE EXACTEMENT ──────────────────────────────────────────────
 *
 * 1. `POST /auth/otp/request` sur un numéro neuf. Le code est `SMS_FAKE_FIXED_CODE`
 *    (`123456` par défaut), et c'est ce lot qui l'a rendu effectif : il était
 *    déclaré, documenté et lu par personne, donc le code partait au hasard et seul
 *    le journal du serveur le connaissait. Un navigateur piloté ne lit pas un
 *    journal ; c'est ce qui rendait ces écrans inéprouvables.
 * 2. `POST /auth/otp/verify` rend le jeton d'accès ET pose le cookie
 *    `dp_refresh`.
 * 3. Le cookie est INSTALLÉ DANS LE NAVIGATEUR, et c'est tout ce qu'il faut : le
 *    jeton d'accès vit en mémoire et meurt au rechargement, donc le front repart
 *    du cookie — premier appel `401`, le transport rafraîchit une fois puis
 *    rejoue. On ne pousse aucun jeton dans la page, ce qui serait d'ailleurs
 *    impossible : `session.ts` ne l'expose pas.
 *
 * Le cookie est `HttpOnly; SameSite=Strict; Path=/v1/auth`, et l'API vit sur un
 * AUTRE PORT du même hôte. Un cookie n'est pas cloisonné par port — il l'est par
 * domaine — donc le poser sur `localhost` suffit, et `SameSite=Strict` est
 * satisfait puisque `localhost:3151` et `localhost:3001` sont le même site.
 */

/** Le numéro doit être neuf à chaque test : un numéro connu bascule en LOGIN. */
let compteur = 0;

export interface Membre {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly phone: string;
  /** Le masque que le SERVEUR renvoie : « +229 •• •• •• 57 ». Jamais le numéro. */
  readonly masque: string;
  readonly accessToken: string;
}

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * Un numéro béninois neuf, à huit chiffres.
 *
 * L'horodatage ET un compteur : deux tests du même fichier partent dans la même
 * milliseconde, et deux membres sur le même numéro feraient basculer le second en
 * connexion sur le compte du premier — un test qui passe en mesurant le mauvais
 * membre.
 */
function numeroNeuf(): string {
  compteur += 1;
  const suffixe = String((Date.now() % 1_000_000) * 10 + (compteur % 10)).padStart(8, '0');
  return `+229${suffixe.slice(-8)}`;
}

/**
 * Crée un membre, remplit son profil, et installe sa session dans le navigateur.
 *
 * `profil` permet à un test d'exiger des valeurs PRÉCISES — c'est ce qui rend
 * vérifiable « l'écran affiche ce que le serveur envoie » plutôt que « l'écran
 * affiche quelque chose ».
 */
export async function connecter(
  context: BrowserContext,
  request: APIRequestContext,
  profil: {
    readonly displayName?: string;
    readonly handle?: string;
    readonly bio?: string;
    readonly phase?: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED';
  } = {},
): Promise<Membre> {
  const phone = numeroNeuf();

  const demande = await request.post(`${API}/auth/otp/request`, {
    data: { phone, countryIso2: 'BJ', captchaToken: 'fake', acceptTerms: true },
  });
  if (!demande.ok()) {
    throw new Error(`otp/request ${demande.status()} : ${await demande.text()}`);
  }
  const { challengeId } = (await demande.json()) as { challengeId: string };

  const verif = await request.post(`${API}/auth/otp/verify`, {
    data: { challengeId, code: process.env['SMS_FAKE_FIXED_CODE'] ?? '123456' },
  });
  if (!verif.ok()) throw new Error(`otp/verify ${verif.status()} : ${await verif.text()}`);
  const session = (await verif.json()) as {
    accessToken: string;
    user: { id: string; handle: string };
  };

  const auth = { authorization: `Bearer ${session.accessToken}` };

  /**
   * Le pays d'origine et la ville, pour que l'écran ait des NOMS à afficher.
   *
   * `/places/*` est ouvert en lecture — c'est l'onboarding qui le lit — alors que
   * `/referentials/*` est réservé à l'équipe. C'est aussi l'écart signalé au
   * porteur : `GET /me` ne rend que les identifiants de ville et de pays, jamais
   * leurs noms.
   */
  const pays = await request.get(`${API}/places/countries?limit=50`);
  const villes = await request.get(`${API}/places/cities?limit=50`);
  const benin = ((await pays.json()) as { items: { id: string; iso2: string }[] }).items.find(
    (c) => c.iso2 === 'BJ',
  );
  const premiereVille = ((await villes.json()) as { items: { id: string }[] }).items[0];

  const nom = profil.displayName ?? 'Membre Éprouvé';
  // Le pseudo dérive de l'identifiant : unique, et il respecte `handleSchema`
  // (minuscules, chiffres, tiret — PAS de point, contrairement à ce que la
  // maquette écrit : voir le rapport de lot).
  const pseudo = profil.handle ?? `m-${session.user.id.replace(/-/g, '').slice(0, 12)}`;

  const patchMe = await request.patch(`${API}/me`, {
    headers: auth,
    data: {
      displayName: nom,
      handle: pseudo,
      phase: profil.phase ?? 'RECENT_ARRIVAL',
      ...(benin === undefined ? {} : { originCountryId: benin.id }),
      ...(premiereVille === undefined ? {} : { cityId: premiereVille.id }),
    },
  });
  if (!patchMe.ok()) throw new Error(`PATCH /me ${patchMe.status()} : ${await patchMe.text()}`);

  const patchProfil = await request.patch(`${API}/me/profile`, {
    headers: auth,
    data: {
      bio: profil.bio ?? 'Profil créé par la suite de tests.',
      occupationStatus: 'STUDENT',
      availableToHelp: true,
      helpTypes: ['PAPERWORK', 'JOB'],
      isPublic: true,
    },
  });
  if (!patchProfil.ok()) {
    throw new Error(`PATCH /me/profile ${patchProfil.status()} : ${await patchProfil.text()}`);
  }

  const me = await request.get(`${API}/me`, { headers: auth });
  const moi = (await me.json()) as {
    user: { id: string; handle: string; displayName: string };
    phones: { masked: string }[];
  };

  /**
   * LE COOKIE EST REPRIS DU CONTEXTE D'API, jamais reconstruit.
   *
   * Le recomposer à la main — nom, valeur, chemin — voudrait dire recopier la
   * politique de `dp_refresh` dans un fichier de test, et elle changerait un jour
   * sans que ce fichier le sache. On prend celui que le serveur a posé.
   */
  const cookies = await request.storageState();
  const refresh = cookies.cookies.find((c) => c.name === 'dp_refresh');
  if (refresh === undefined) {
    throw new Error('le cookie dp_refresh n’a pas été posé : la session ne survivrait pas.');
  }
  await context.addCookies([refresh]);

  const masque = moi.phones[0]?.masked;
  if (masque === undefined) throw new Error('aucun téléphone : /me n’en renvoie pas.');

  return {
    id: moi.user.id,
    handle: moi.user.handle,
    displayName: moi.user.displayName,
    phone,
    masque,
    accessToken: session.accessToken,
  };
}
