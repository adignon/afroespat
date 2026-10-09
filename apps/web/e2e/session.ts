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
 * UNE MARQUE DE PROCESSUS, tirée une seule fois.
 *
 * Le compteur ci-dessous est PAR PROCESSUS, et Playwright lance un processus par
 * ouvrier. Deux ouvriers qui démarrent ensemble ont donc le même compteur à 1 et,
 * dans la même milliseconde, le même numéro. Mesuré : `POST /auth/otp/verify` a
 * rendu `500` sur `Unique constraint failed on the fields: (phone_hmac)` en
 * lançant les projets « ordinateur » et « mobile » côte à côte.
 *
 * Le symptôme n'accuse pas sa cause — on lit une erreur serveur, et on cherche
 * un défaut d'API qui n'existe pas.
 */
const MARQUE_PROCESSUS = Math.floor(Math.random() * 100);

/**
 * Un numéro béninois neuf, à huit chiffres.
 *
 * L'horodatage, un compteur ET une marque de processus : deux tests du même
 * fichier partent dans la même milliseconde, et deux membres sur le même numéro
 * feraient basculer le second en connexion sur le compte du premier — un test qui
 * passe en mesurant le mauvais membre.
 *
 * Le découpage des huit chiffres : SIX pour l'horodatage (la milliseconde modulo
 * un million) et DEUX pour la marque. Il y avait un seul chiffre de marque
 * auparavant, soit dix places par milliseconde et une collision entre deux
 * ouvriers une fois sur dix ; il y en a cent. Le facteur 7 est premier avec 100,
 * donc le compteur parcourt les cent places avant de repasser sur l'une d'elles.
 */
function numeroNeuf(): string {
  /**
   * UN NUMÉRO BÉNINOIS VALIDE SELON `libphonenumber` : `019` suivi de sept
   * chiffres, soit dix en tout. Le Bénin a renuméroté en 2023 — ses mobiles
   * s'écrivent `01` + huit chiffres — et c'est la bibliothèque de Google qui le
   * dit, pas une table écrite ici. Son propre exemple officiel est `0195123456`.
   *
   * Les planches, elles, dessinent encore « 97 12 34 42 », l'ancien format. Le
   * harnais suit le MONDE RÉEL, pas la planche : un test qui créerait des membres
   * sur des numéros que le serveur refuse ne mesurerait plus rien.
   */
  return `+229${numeroNational()}`;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE MÊME NUMÉRO, SANS INDICATIF — POUR LE CHAMP DE L'ÉCRAN                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `numeroNeuf` sert l'API, qui veut la forme internationale. Les tests qui
 * passent par L'ÉCRAN remplissent `input[name="phone"]`, où l'indicatif vient du
 * sélecteur de pays : ils ont besoin de la forme NATIONALE.
 *
 * Trois fichiers l'écrivaient à la main, et deux portaient encore `97…` —
 * l'ancien format, celui que la planche dessine. Depuis la validation par pays,
 * « Recevoir le code » reste GRISÉ sur un tel numéro, et le test expire sur un
 * clic qui ne pouvait pas aboutir. Il a été corrigé une fois dans
 * `code-otp.spec.ts` ; les deux autres sont tombés plus tard, pour la même
 * raison. D'où ce point unique.
 *
 * ── LA MARQUE VIENT DU PROCESSUS, PAS D'UN TIRAGE ──────────────────────────
 *
 * La première version de cette fonction tirait ses deux derniers chiffres au
 * hasard à chaque appel. MESURÉ : `codesSentTo(numéro)` a rendu TROIS codes pour
 * un numéro censé être neuf, en lançant « ordinateur » et « mobile » côte à côte
 * — deux appels étaient tombés sur le même tirage dans la même milliseconde, et
 * le test lisait les SMS d'un autre membre.
 *
 * Elle reprend donc le mécanisme que `numeroNeuf` avait déjà : une marque tirée
 * UNE FOIS par processus, et un compteur qui avance de 7 — premier avec 100,
 * donc les cent places sont parcourues avant d'en réemployer une.
 */
export function numeroNational(): string {
  compteur += 1;
  const marque = String((MARQUE_PROCESSUS + compteur * 7) % 100).padStart(2, '0');
  const horodatage = String(Date.now() % 100_000).padStart(5, '0');
  return `019${horodatage}${marque}`;
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
  /**
   * Le pseudo dérive de l'identifiant, et il respecte `handleSchema` (minuscules,
   * chiffres, tiret — PAS de point, contrairement à ce que la maquette écrit :
   * voir le rapport de lot).
   *
   * ON PREND LA FIN DE L'IDENTIFIANT, PAS SON DÉBUT. Il est en UUIDv7 : ses
   * premiers octets sont l'HORODATAGE, et douze caractères de tête sont donc
   * identiques pour deux comptes créés dans la même seconde. MESURÉ : deux
   * ouvriers Playwright se marchaient dessus, `PATCH /me` répondait 500, et des
   * cas tombaient au hasard pour une raison qui n'avait rien à voir avec eux.
   * C'est la même famille de collision que les numéros de téléphone du banc.
   */
  const brut = session.user.id.replace(/-/g, '');
  const pseudo = profil.handle ?? `m-${brut.slice(-12)}`;

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

/**
 * ─── UNE SEULE SESSION POUR TOUT UN FICHIER ─────────────────────────────────
 *
 * POURQUOI CECI EXISTE, et c'est un coût mesuré, pas une élégance.
 *
 * `connecter()` crée un membre NEUF, donc appelle `POST /auth/otp/request` à chaque
 * fois. Cette route est limitée à DIX PAR HEURE ET PAR IP (01 §2), et chaque appel
 * coûte un SMS en production. Un fichier de quarante tests qui s'inscrirait à chaque
 * test est donc STRUCTURELLEMENT IMPOSSIBLE dès que la limite est active : le
 * onzième test prend un `429`, et les trente suivants avec lui.
 *
 * `entraide-agenda.spec.ts` compte une quarantaine de tests. Il n'avait besoin
 * d'aucune session tant que ses écrans lisaient la maquette ; depuis que H01 à H10
 * lisent l'API, ils n'affichent plus que « Chargement… » puis une invitation à se
 * reconnecter — c'est-à-dire que ce fichier mesurait l'écran d'erreur en croyant
 * mesurer l'écran. Il a donc besoin d'une session, et il ne peut pas en payer
 * quarante.
 *
 * ── CE QUE CELA PARTAGE, ET CE QUE CELA NE PARTAGE PAS ──────────────────────
 *
 * Le membre et son cookie sont créés UNE FOIS par processus de travail (la promesse
 * est mémoïsée au niveau du module). Chaque test garde son propre `BrowserContext`
 * — Playwright l'exige, et c'est bien : les tests ne se passent pas d'état de page
 * entre eux. Seule l'IDENTITÉ est commune.
 *
 * À N'EMPLOYER QUE POUR LIRE. Un fichier dont les tests MODIFIENT le membre — qui
 * publient, bloquent, révoquent — doit garder `connecter()` par test : sinon le
 * second test hérite de ce que le premier a changé, et son échec désignera la
 * mauvaise cause. `entraide-api.spec.ts` fait exactement cela, et c'est pourquoi il
 * n'emploie pas cette fonction.
 */
let partagee: Promise<Membre> | null = null;

export async function connecterPartage(
  context: BrowserContext,
  request: APIRequestContext,
  profil: Parameters<typeof connecter>[2] = {},
): Promise<Membre> {
  /**
   * LE PREMIER APPELANT PAIE L'INSCRIPTION ET POSE LE COOKIE ; les suivants
   * réemploient le membre, mais doivent quand même installer le cookie dans LEUR
   * contexte — un `BrowserContext` neuf n'hérite de rien.
   */
  if (partagee === null) {
    partagee = connecter(context, request, profil);
    return partagee;
  }

  const membre = await partagee;
  const cookies = await request.storageState();
  const refresh = cookies.cookies.find((c) => c.name === 'dp_refresh');
  if (refresh === undefined) {
    /**
     * Le contexte de requêtes a perdu le cookie : plutôt que de servir une session
     * muette qui ferait mesurer l'écran d'erreur, on repart d'une inscription. C'est
     * un SMS de plus, et c'est moins cher qu'un test vert qui ne prouve rien.
     */
    partagee = connecter(context, request, profil);
    return partagee;
  }
  await context.addCookies([refresh]);
  return membre;
}
