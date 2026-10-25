'use client';

import {
  FREE_PRO_CONTACTS_PER_MONTH,
  HOUSING_SAFETY_BANNER,
  housingDetailResponseSchema,
  housingListResponseSchema,
  jobDetailResponseSchema,
  jobSeekersListResponseSchema,
  jobsListResponseSchema,
  myAlertsResponseSchema,
  mySubscriptionResponseSchema,
  placesCitiesResponseSchema,
  servicesCountsResponseSchema,
  plansResponseSchema,
  prosListResponseSchema,
  prosProfessionsResponseSchema,
  proDetailResponseSchema,
  type AlertCriteria,
  type HousingCardView,
  type HousingKind,
  type JobCardView,
  type JobKind,
  type JobSeekerCardView,
  type MeResponse,
  type MySubscriptionResponse,
  type ProCardView,
  type ProTier,
  type SavedAlertView,
} from '@app/shared';
import { fetchMe, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import type { CarteAnnonce, S01Data } from '@/screens/s01/data';
import type { S02Charge } from '@/screens/s02/data';
import type { S03Charge } from '@/screens/s03/data';
import type { CarteOffre, CarteProfil, S04Charge } from '@/screens/s04/data';
import type { S05Charge } from '@/screens/s05/data';
import type { CarteFiche, S06Data } from '@/screens/s06/data';
import type { Recommandation, S07Charge } from '@/screens/s07/data';
import type { S08Charge } from '@/screens/s08/data';
import type { LigneAnnonce, S09Charge } from '@/screens/s09/data';
import type { LigneAlerte, S10Charge } from '@/screens/s10/data';
import { COMPTEURS_INCONNUS, type Compteurs, type Moi, type Quotas } from './data';
import { fondAvatar } from '@/lib/avatar';
import { urlMedia } from '@/lib/api/base';
import {
  filtresLogement,
  ongletsServices,
  sousTitreOffres,
  type FiltreLogement,
  type Onglet,
} from './navigation';

/**
 * LES APPELS DES ÉCRANS S01 À S10 — un chargeur par écran, et rien d'autre.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────────────
 *
 * Il n'a AUCUN `fetch`, aucun en-tête, aucun jeton, aucun rejeu. Le socle
 * (`lib/api/`) porte tout cela, et sa consigne est à lire avant d'ajouter une
 * ligne ici. Cinq de ses règles se voient dans ce fichier :
 *
 *   1. `memberApi` SEULEMENT. `staffApi` n'est pas importé, et ne peut pas l'être
 *      utilement : son type refuse tout chemin hors `/admin`.
 *   2. TOUT APPEL PORTE UN SCHÉMA. Il n'existe pas de variante sans, et les
 *      schémas viennent de `@app/shared` — neuf ont été ÉCRITS LÀ pour ce lot, à
 *      côté des schémas de requête de leur module, parce qu'un schéma de réponse
 *      recopié dans le front est une deuxième source qui divergera.
 *   3. AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN : `z.infer` partout, et les vues
 *      (`HousingCardView`, `ProCardView`…) sont dérivées de leur schéma. Une
 *      interface recopiée ici aurait gardé un champ que le schéma a rendu nullable,
 *      et l'écran aurait affiché « null » sans que rien ne le signale.
 *   4. ON DÉCIDE SUR `error.code`, jamais sur le message (§5.2), et AUCUN chargeur
 *      ne REJOUE. Le socle rejoue ce qui doit l'être (un `401` après
 *      rafraîchissement) et ne rejoue JAMAIS un `429` — dont l'attente se compte en
 *      secondes et peut valoir 3600. Un chargeur qui réessaierait de lui-même
 *      transformerait une attente d'une heure en boucle.
 *   5. LE NIVEAU NE SERT JAMAIS À AUTORISER. Aucun `if (niveau >= 2)` n'existe
 *      ici, et il n'en faut pas : on tente l'action, le serveur répond
 *      `403 LEVEL_REQUIRED`, et `error.levelRequired` porte de quoi afficher
 *      l'INVITATION du §7.3. Ce lot ne branche aucune écriture, donc il n'a même
 *      pas d'action à tenter — raison de plus pour ne pas lire le niveau.
 *
 * ── LES ROUTES, LUES DANS LES CONTRÔLEURS ───────────────────────────────────
 *
 * Et c'est une distinction qui a coûté une recherche : il n'existe PAS de module
 * `apps/api/src/modules/alerts`. `GET /me/alerts` vit dans `housing.controller.ts`,
 * parce que §2.4 définit l'alerte avec la recherche de logement et que la même
 * table sert les deux kinds. Le nom du dossier aurait fait chercher une route
 * absente ; le contrôleur dit la vérité.
 *
 * Autre leçon du même genre, celle-ci relevée sur la CHARGE et non sur le code :
 * `GET /jobs` et `GET /pros` rendent leur TÊTE (`sponsored`, `featured`) dans un
 * champ À PART de `items`, qui les exclut. Lire `items` seul aurait fait
 * disparaître la pastille « Sponsorisée » et la mention « Fiche mise en avant » —
 * deux règles dures — en silence.
 */

// ─── Libellés ────────────────────────────────────────────────────────────────

/**
 * LES SIX KINDS DE LOGEMENT, dans les mots de la maquette.
 *
 * « Location », « Colocation » et « Temporaire » sont écrits par `06 Services`
 * elle-même, sur ses pastilles de carte. Les trois autres ne sont dessinés NULLE
 * PART — la maquette ne montre ni sous-location ni recherche — et ces trois mots
 * sont donc à faire valider par le porteur ; ils n'ont pas de source. Les laisser
 * en `SEEKING_FLATMATE` aurait été pire : l'écran afficherait une énumération.
 */
const LOGEMENTS_FR: Record<HousingKind, string> = {
  RENT: 'Location',
  FLATSHARE: 'Colocation',
  TEMPORARY: 'Temporaire',
  SUBLET: 'Sous-location',
  SEEKING_HOUSING: 'Recherche',
  SEEKING_FLATMATE: 'Recherche coloc',
};

/**
 * LES QUATRE KINDS D'OFFRE.
 *
 * « Emploi », « Alternance » et « Bourse » viennent des pastilles de S04.
 * `GIG` n'est dessiné nulle part : « Mission » est à faire valider par le porteur.
 * ÉCART SIGNALÉ : la maquette dessine une pastille « Bourse » mais `JobKind` n'a
 * pas de valeur de bourse — `APPRENTICESHIP` est l'alternance, `INTERNSHIP` le
 * stage. Une bourse de mobilité n'a donc pas de kind, alors que la planche S04 en
 * montre une et que le titre de l'écran est « Bourses et emploi ».
 */
const OFFRES_FR: Record<JobKind, string> = {
  JOB: 'Emploi',
  APPRENTICESHIP: 'Alternance',
  INTERNSHIP: 'Stage',
  GIG: 'Mission',
};

/** Les trois paliers de fiche pro (§4.1), tels que la maquette les écrit. */
const PALIERS_FR: Record<ProTier, string> = {
  FREE: 'Gratuite',
  PRO: 'Pro',
  PRO_PLUS: 'Pro+',
};

/**
 * Les couleurs d'avatar de la maquette, dans son ordre. Cyclées par rang.
 *
 * Relevées sur ses propres planches — `#B4581F`, `#0F5C48`, `#2FA37D`, `#16785E`,
 * `#E0733A` sur la liste de logement. Aucune n'est assombrie : les assombrir pour
 * gagner du contraste est précisément ce que le porteur a refusé, et le garde-fou
 * du générateur tient la règle à 16/24.
 */
const FONDS_AVATAR = ['#B4581F', '#0F5C48', '#2FA37D', '#16785E', '#E0733A'] as const;

const fondDeRang = (rang: number): string =>
  FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0];

// ─── Mise en forme ───────────────────────────────────────────────────────────

/**
 * Les initiales d'un nom affiché : « Sarah Traoré » → « ST ».
 *
 * Deux lettres au plus, et jamais une chaîne vide : un rond de couleur sans lettre
 * ressemble à un défaut de chargement.
 */
function initialesDe(nom: string): string {
  const mots = nom
    .trim()
    .split(/\s+/)
    .filter((m) => m !== '');
  if (mots.length === 0) return '?';
  return mots
    .slice(0, 2)
    .map((m) => [...m][0] ?? '')
    .join('')
    .toUpperCase();
}

const prenomDe = (nom: string): string => nom.trim().split(/\s+/)[0] ?? nom;

/**
 * « Sarah Traoré » → « Sarah T. » — le nom abrégé que la feuille de contact écrit.
 *
 * La maquette abrège le nom de famille à sa première lettre dans son suréacrit,
 * et l'écrit en entier sur l'écran. C'est la MÊME donnée, mise en forme pour la
 * place disponible, exactement comme `initialesDe`.
 *
 * UN SEUL MOT RESTE ENTIER, sans point : « Sarah. » n'abrège rien et se lit comme
 * une faute. Un nom de famille de plusieurs mots garde la première lettre du
 * dernier, qui est celle que la maquette montre.
 */
function nomAbrege(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  if (mots.length < 2) return nom.trim();
  const famille = mots[mots.length - 1] ?? '';
  return `${mots.slice(0, -1).join(' ')} ${[...famille][0] ?? ''}.`;
}

/**
 * L'HÔTE d'une URL de candidature — « https://arvel.fr/emploi » → « arvel.fr ».
 *
 * `new URL` plutôt qu'une expression régulière : c'est l'analyseur du navigateur,
 * donc exactement celui qui décidera où le bouton « Continuer » envoie. Les faire
 * diverger est la seule façon pour cet interstitiel de mentir.
 *
 * Une URL qui ne s'analyse pas rend un tiret cadratin. `externalUrl` est nullable
 * côté API et `lien` vaut alors déjà « — » : on ne fabrique pas un domaine.
 */
function domaineDe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '—';
  }
}

/** « Sarah Traoré » → « Sarah T. », la forme courte des listes de la maquette. */
function nomCourt(nom: string): string {
  const mots = nom
    .trim()
    .split(/\s+/)
    .filter((m) => m !== '');
  const premier = mots[0] ?? nom;
  const second = mots[1];
  return second === undefined ? premier : `${premier} ${[...second][0] ?? ''}.`;
}

const jourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const jourMoisLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** « 1er oct. » — la forme abrégée que la maquette emploie sur ses tuiles. */
function jourAbrege(iso: string): string {
  const d = new Date(iso);
  const brut = jourMois.format(d);
  // `Intl` rend « 1 oct. » ; la maquette écrit « 1er oct. », et c'est du français.
  return d.getDate() === 1 ? brut.replace(/^1 /, '1er ') : brut;
}

/** « 2 septembre » — le mois en toutes lettres, comme S09 l'écrit. */
function jourMoisEcrit(iso: string): string {
  const d = new Date(iso);
  const brut = jourMoisLong.format(d);
  return d.getDate() === 1 ? brut.replace(/^1 /, '1er ') : brut;
}

/**
 * Un montant en centimes, dans la devise que le serveur a jointe.
 *
 * `Intl` PLUTÔT QU'UNE DIVISION PAR CENT suivie d'une concaténation : le XOF n'a
 * aucune décimale, l'EUR en a deux, et `62000 / 100` donnerait « 620 » là où le
 * serveur veut dire 620 €. C'est la même erreur comptable que `moneySchema` rend
 * impossible côté contrat ; ici c'est `Intl` qui la rend impossible à l'affichage.
 */
function montant(centimes: number, devise: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: devise === 'XOF' ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(centimes / (devise === 'XOF' ? 1 : 100));
}

/**
 * Le loyer d'une annonce, ou « Gratuit ».
 *
 * §2.1 : « `price_cents` obligatoire pour une offre, `null` accepté pour TEMPORARY
 * gratuit ». « 0 € » serait une information différente de « Gratuit » — et la
 * maquette écrit bien « Gratuit » sur sa carte d'hébergement temporaire.
 */
const loyer = (carte: HousingCardView): string =>
  carte.priceCents === null ? 'Gratuit' : montant(carte.priceCents, carte.currency);

/** « il y a 3 jours », « aujourd'hui » — les mots de la maquette pour une publication. */
function depuisQuand(iso: string, maintenant: number = Date.now()): string {
  const jours = Math.floor(Math.max(0, maintenant - new Date(iso).getTime()) / 86_400_000);
  if (jours === 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} jours`;
  const semaines = Math.floor(jours / 7);
  if (semaines < 5) return `il y a ${semaines} semaine${semaines > 1 ? 's' : ''}`;
  return `le ${jourMoisEcrit(iso)}`;
}

/** « dans 12 jours », pour l'expiration d'une annonce (§2.1, durée de vie 60 jours). */
function dansCombien(iso: string, maintenant: number = Date.now()): string {
  const jours = Math.ceil((new Date(iso).getTime() - maintenant) / 86_400_000);
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'demain';
  return `dans ${jours} jours`;
}

/**
 * Une liste de noms, telle que la maquette les écrit : « Lyon, Villeurbanne ».
 *
 * Vide, elle rend un tiret cadratin plutôt qu'une chaîne nulle : une ligne qui se
 * vide donne l'impression que la page n'a pas fini de charger.
 */
const enumeration = (valeurs: readonly string[]): string =>
  valeurs.length === 0 ? '—' : valeurs.join(', ');

// ─── Le bandeau et le quota, communs aux dix écrans ──────────────────────────

/**
 * LE BANDEAU D'ORDINATEUR — deux appels, et AUCUN des deux ne se pardonne.
 *
 * `fetchMe()` sans `force` : la copie en mémoire suffit pour AFFICHER un prénom.
 * La règle du socle ne dit pas « ne jamais réutiliser `/me` », elle dit
 * `force: true` « dès qu'une décision irréversible en dépend » — et afficher un
 * prénom n'en est pas une. Aucun écran de ce lot ne décide : aucun bouton n'est
 * branché.
 *
 * LE QUOTA, LUI, N'EST PAS UN ORNEMENT, et c'est la différence avec la pastille de
 * demandes du module Compte, qui se pardonne. « 2 contacts pro sur 3 » est la
 * règle dure du §4.4 affichée au membre : s'il échoue, afficher « 0 sur 3 » ou un
 * tiret ferait croire à un quota épuisé ou inexistant, et la décision d'écrire à
 * un pro en dépend. L'échec remonte donc, et `EcranDonnees` montre l'état d'échec
 * plutôt qu'un chiffre faux.
 */
async function moiEtQuotas(): Promise<{ moi: Moi; quotas: Quotas }> {
  const [me, abonnement, compteurs] = await Promise.all([
    fetchMe(),
    memberApi.get('/me/subscription', mySubscriptionResponseSchema),
    lireCompteurs(),
  ]);
  return { moi: moiDe(me), quotas: { ...quotasDe(abonnement, !me.monetisationActive), compteurs } };
}

/**
 * Les trois compteurs du panneau de gauche (`GET /services/counts`).
 *
 * CONTRAIREMENT AU QUOTA, ILS SE PARDONNENT : un compteur absent est un panneau sans
 * pastille, pas une décision faussée. L'échec ne fait donc pas échouer l'écran ; il
 * retire les nombres (`null`), jamais un zéro qui ferait croire à un marché vide.
 */
async function lireCompteurs(): Promise<Compteurs> {
  try {
    // La route est PUBLIQUE (les listes le sont) : sans jeton elle réussit et rend
    // `mine: null`. Mesuré — lancée en parallèle de `fetchMe()` à l'arrivée sur la
    // page, elle partait avant la reprise de session et « Mes annonces » restait
    // sans compteur. On attend donc la session, comme les écrans de publication.
    if (!hasAccessToken()) await resumeSession();
    const c = await memberApi.get('/services/counts', servicesCountsResponseSchema);
    return { logement: c.housing, emploi: c.jobs, mesAnnonces: c.mine };
  } catch {
    return COMPTEURS_INCONNUS;
  }
}

function moiDe(me: MeResponse): Moi {
  return {
    initiales: initialesDe(me.user.displayName),
    photo: fondAvatar(me.user.avatarUrl),
    prenom: prenomDe(me.user.displayName),
  };
}

/**
 * Le quota de contacts pro du mois.
 *
 * `limit === null` veut dire ILLIMITÉ (`mySubscriptionResponseSchema` le dit : «
 * l'écran affiche illimité, jamais 0 sur null »). La barre est alors vide plutôt
 * que pleine : un quota sans plafond n'a pas de progression, et une barre pleine
 * dirait l'inverse de ce que « illimité » signifie.
 *
 * La métrique est absente quand le membre n'a encore contacté personne ce mois-ci.
 * On affiche alors zéro sur le plafond GRATUIT du §4.4 — qui est la vérité pour un
 * membre sans compteur — plutôt qu'un tiret qui laisserait croire à une panne.
 */
function quotasDe(abonnement: MySubscriptionResponse, gratuit: boolean): Omit<Quotas, 'compteurs'> {
  const compteur = abonnement.usage.items.find((u) => u.metric === 'PRO_CONTACTS');
  const utilises = compteur?.used ?? 0;
  const plafond = compteur === undefined ? FREE_PRO_CONTACTS_PER_MONTH : compteur.limit;

  return {
    contactsPro: utilises,
    plafondPro: plafond === null ? 'illimité' : String(plafond),
    barre:
      plafond === null || plafond === 0
        ? '0%'
        : `${Math.min(100, Math.round((utilises / plafond) * 100))}%`,
    reinitialise: jourMoisEcrit(abonnement.usage.resetsAt),
    gratuit,
  };
}

// ─── S01 · /services/logement ────────────────────────────────────────────────

/**
 * La liste des annonces.
 *
 * `GET /housing` est `@PublicRead()` — §2.3 : « un L0 pré-départ peut LIRE les
 * annonces » — mais l'écran a besoin d'une session pour son bandeau de quotas, que
 * la maquette dessine sur les dix planches d'ordinateur.
 *
 * RÈGLE DURE §2.2 : le bandeau de non-paiement vient de `meta.safetyBanner`, et il
 * est REQUIS par le schéma. Une réponse sans bandeau est refusée à la frontière —
 * l'écran ne se peint pas sans son avertissement, ce qui est exactement ce que
 * « affiché en permanence » veut dire.
 *
 * LA VILLE n'est PAS devinée : `meta` n'en porte pas, et la requête ne filtre sur
 * aucune. On écrit donc la ville des annonces quand toutes partagent la même, et
 * « dans votre pays » sinon (`phraseAnnonces`) — jamais « à France », qui nomme un
 * pays là où la phrase attend une ville. Composer « Lyon » parce que la maquette
 * l'écrit aurait été le mensonge le plus facile de ce lot.
 */
export async function chargerS01(kind: FiltreLogement = null): Promise<S01Data> {
  const [commun, liste] = await Promise.all([
    moiEtQuotas(),
    memberApi.get(kind === null ? '/housing?limit=20' : `/housing?limit=20&kind=${kind}`, housingListResponseSchema),
  ]);

  const villes = new Set(liste.items.map((a) => a.city.name));
  const villeUnique = villes.size === 1 ? ([...villes][0] ?? null) : null;

  return {
    ...commun,
    onglets: ongletsServices('logement', { ...commun.quotas.compteurs, logement: liste.meta.total }),
    filtres: filtresLogement(kind),
    liste: {
      total: liste.meta.total,
      phrase: phraseAnnonces(liste.meta.total, villeUnique),
      ville: villeUnique ?? '',
      bandeau: liste.meta.safetyBanner,
      annonces: liste.items.map(carteAnnonce),
    },
  };
}

/**
 * « 3 annonces à Évry » · « 1 annonce dans votre pays » · « 0 annonce ».
 *
 * Lot W2A, phase 2.16. Sans annonce il n'y a pas de lieu à nommer, et une seule ville
 * commune à toutes les annonces est dite telle quelle ; sinon la liste couvre le
 * pays, et on le dit sans en écrire le nom à la place d'une ville.
 */
export function phraseAnnonces(total: number, villeUnique: string | null): string {
  const mot = total > 1 ? 'annonces' : 'annonce';
  if (total === 0) return `0 ${mot}`;
  return villeUnique === null
    ? `${String(total)} ${mot} dans votre pays`
    : `${String(total)} ${mot} à ${villeUnique}`;
}

function carteAnnonce(a: HousingCardView, rang: number): CarteAnnonce {
  return {
    id: a.id,
    /** `/services/logement/:id` — la route que `app/(app)/services/logement/[id]/` sert. */
    href: `/services/logement/${a.id}`,
    genre: LOGEMENTS_FR[a.kind],
    titre: a.title,
    prix: loyer(a),
    detail: detailAnnonce(a),
    fond: fondDeRang(rang),
    initiales: initialesDe(a.author.displayName),
    auteur: nomCourt(a.author.displayName),
    fondPhoto: fondDePhoto(a.photos[0]?.url),
    niveau: a.author.verificationLevel,
  };
}

/** Les rayures de la maquette, quand l'annonce n'a pas (encore) de photo. */
const RAYURES = 'repeating-linear-gradient(135deg,#E3ECE8 0 14px,#DCE6E1 14px 28px)';

/** Le `background` d'une tuile : la photo réelle, recadrée, ou les rayures. */
export function fondDePhoto(url: string | undefined): string {
  return url === undefined ? RAYURES : `center / cover no-repeat url(${JSON.stringify(urlMedia(url))})`;
}

/**
 * « Meublé · 1er oct. · 12 mois » — composé des champs RÉELS, et de rien d'autre.
 *
 * La maquette écrit trois formes différentes selon la carte (« Meublé · libre ·
 * 24 m² », « Canapé-lit · dès le 28 sept. »). On ne les reproduit pas une à une :
 * la surface et le type de couchage ne sont dans AUCUN champ de `HousingCard`.
 * Le détail porte donc ce que la réponse porte — l'ameublement, la disponibilité,
 * la durée — et saute ce qui manque, plutôt que d'écrire « undefined m² ».
 */
function detailAnnonce(a: HousingCardView): string {
  const morceaux: string[] = [];
  if (a.isFurnished === true) morceaux.push('Meublé');
  if (a.isFurnished === false) morceaux.push('Non meublé');
  morceaux.push(a.availableFrom === null ? 'libre' : jourAbrege(a.availableFrom));
  if (a.durationMonths !== null) morceaux.push(`${a.durationMonths} mois`);
  return morceaux.length === 0 ? '—' : morceaux.join(' · ');
}

// ─── S02 · /services/logement/:id ────────────────────────────────────────────

/**
 * Une annonce.
 *
 * RÈGLE DURE §7 : `prudenceRenforcee` dérive de `cautionLevel`, une énumération à
 * DEUX valeurs. Il n'existe aucun chemin par lequel un chiffre de risque pourrait
 * atteindre cet écran : `housingDetailResponseSchema` est `.strict()` et refuse une
 * réponse portant `riskScore` ou `riskFlags`, et le `<sc-if>` du cadre transcodé ne
 * lit qu'un booléen.
 *
 * `404` REMONTE TEL QUEL, et ce n'est pas un oubli : §6.1 veut qu'une annonce
 * retirée, non publiée, ou dont l'auteur est séparé du lecteur soit indiscernable
 * d'une annonce qui n'existe pas. `displayMessageFor` dira « introuvable » dans les
 * quatre cas, ce qui est le but.
 */
export async function chargerS02(id: string): Promise<S02Charge> {
  const [commun, annonce] = await Promise.all([
    moiEtQuotas(),
    memberApi.get(`/housing/${encodeURIComponent(id)}`, housingDetailResponseSchema),
  ]);

  return {
    ...commun,
    annonce: {
      id: annonce.id,
      fonds: [0, 1, 2].map((i) => fondDePhoto(annonce.photos[i]?.url)),
      nbPhotos: annonce.photos.length,
      meuble: annonce.isFurnished === true,
      auteurSous: `@${annonce.author.handle} · ${annonce.city.name}`,
      niveau: annonce.author.verificationLevel,
      estMienne: annonce.isMine,
      titre: annonce.title,
      prix: loyer(annonce),
      genre: LOGEMENTS_FR[annonce.kind],
      quartier:
        annonce.district === null ? annonce.city.name : `${annonce.city.name} · ${annonce.district}`,
      disponible: annonce.availableFrom === null ? 'libre' : jourAbrege(annonce.availableFrom),
      duree: annonce.durationMonths === null ? '—' : `${annonce.durationMonths} mois`,
      description: annonce.description,
      initiales: initialesDe(annonce.author.displayName),
      auteur: annonce.author.displayName,
      /** Le suréacrit de la feuille « Présentez-vous » : « Sarah T. ». */
      auteurCourt: nomAbrege(annonce.author.displayName),
      /** « Contacter Sarah », et la phrase de pied de la feuille. */
      prenomAuteur: prenomDe(annonce.author.displayName),
      /**
       * La maquette dessine DEUX emplacements de photo en grand et compte le reste
       * (« + 4 photos »). On soustrait donc deux, et jamais en dessous de zéro.
       */
      autresPhotos: Math.max(0, annonce.photos.length - 2),
      contactsCommuns: annonce.mutualConnectionCount,
      prudenceRenforcee: annonce.cautionLevel === 'REINFORCED',
    },
  };
}

// ─── S03 · /services/logement/nouveau ────────────────────────────────────────

/**
 * Le formulaire de publication.
 *
 * `GET /housing` est appelée pour SON `meta` seul — le bandeau de §2.2, qui doit
 * venir du serveur. `limit=1` : on ne charge pas vingt annonces pour lire une
 * phrase.
 *
 * `meta.canPublish` et `meta.publishRequirement` arrivent avec, et ne s'affichent
 * NULLE PART : la maquette n'a pas d'emplacement pour le formulaire grisé de §2.1.
 * La donnée est là, prête ; c'est l'écart remonté au porteur.
 */
export async function chargerS03(): Promise<S03Charge> {
  const [commun, liste] = await Promise.all([
    moiEtQuotas(),
    memberApi.get('/housing?limit=1', housingListResponseSchema),
  ]);
  return { ...commun, publication: { bandeau: liste.meta.safetyBanner } };
}

// ─── S04 · /services/emploi ──────────────────────────────────────────────────

/**
 * Les offres et les profils disponibles — DEUX routes, parce que la planche montre
 * deux cartes côte à côte et non deux onglets.
 *
 * RÈGLE DURE §3.1 et §11 : la tête sponsorisée arrive dans `sponsored`, À PART
 * d'`items` qui l'exclut, et chaque offre porte sa pastille et son libellé. On les
 * recolle dans l'ordre que §11 impose — la tête d'abord, au plus deux emplacements,
 * puis le classement naturel — et on ne les déduplique pas : le service a déjà
 * retiré d'`items` les identifiants de la tête.
 */
export async function chargerS04(): Promise<S04Charge> {
  const [commun, offres, profils] = await Promise.all([
    moiEtQuotas(),
    memberApi.get('/jobs?limit=20', jobsListResponseSchema),
    memberApi.get(`/job-seekers?limit=${PAGE_PROFILS}`, jobSeekersListResponseSchema),
  ]);

  return {
    ...commun,
    pret: true,
    onglets: ongletsServices('emploi', { ...commun.quotas.compteurs, emploi: offres.meta.total }),
    offres: {
      liste: [...offres.sponsored, ...offres.items].map(carteOffre),
      total: offres.meta.total,
      sousTitre: sousTitreOffres(offres.meta.total),
    },
    profils: { liste: profils.items.map(carteProfil), suite: profils.nextCursor },
  };
}

/** Les profils disponibles se lisent par pages de vingt. */
const PAGE_PROFILS = 20;

/** La page suivante des profils disponibles (`Voir plus`). */
export async function chargerProfilsSuivants(
  curseur: string,
  dejaAffiches: number,
): Promise<{ readonly liste: readonly CarteProfil[]; readonly suite: string | null }> {
  const page = await memberApi.get(
    `/job-seekers?limit=${PAGE_PROFILS}&cursor=${encodeURIComponent(curseur)}`,
    jobSeekersListResponseSchema,
  );
  return {
    liste: page.items.map((p, i) => carteProfil(p, dejaAffiches + i)),
    suite: page.nextCursor,
  };
}

function carteOffre(o: JobCardView): CarteOffre {
  return {
    id: o.id,
    href: `/services/emploi/${o.id}`,
    sponsorisee: o.isSponsored,
    /**
     * Le libellé vient du SERVEUR, et le repli n'est pas une chaîne inventée : si
     * `sponsoredLabel` manquait alors qu'`isSponsored` est vrai, la pastille
     * s'afficherait vide — un rond orange muet. Le mot est celui de la maquette.
     */
    pastille: o.sponsoredLabel ?? 'Sponsorisée',
    genre: OFFRES_FR[o.kind],
    titre: o.title,
    ou: lieuOffre(o),
    contrat: o.contractType ?? '—',
    secteur: o.sector ?? '—',
    partage: o.sharedBy,
  };
}

/** « Cabinet Arvel · Lyon 3e », ou « · Télétravail » quand `city` est `null` (§3.1). */
function lieuOffre(o: JobCardView): string {
  const ville = o.city === null ? 'Télétravail' : o.city.name;
  return o.companyName === null ? ville : `${o.companyName} · ${ville}`;
}

function carteProfil(p: JobSeekerCardView, rang: number): CarteProfil {
  return {
    handle: p.member.handle,
    prenom: prenomDe(p.member.displayName),
    profil: `/@${p.member.handle}`,
    fond: fondDeRang(rang),
    initiales: initialesDe(p.member.displayName),
    nom: nomCourt(p.member.displayName),
    titre: p.headline,
    secteurs: p.sectors,
    contrats: p.contractTypes,
    ville: p.member.city?.name ?? null,
  };
}

// ─── S05 · /services/emploi/:id ──────────────────────────────────────────────

/** Une offre. Le contrôleur la rend NUE — pas d'enveloppe, pas de `meta`. */
export async function chargerS05(id: string): Promise<S05Charge> {
  const [commun, offre] = await Promise.all([
    moiEtQuotas(),
    memberApi.get(`/jobs/${encodeURIComponent(id)}`, jobDetailResponseSchema),
  ]);

  return {
    ...commun,
    offre: {
      mode: 'detail',
      id: offre.id,
      lienExterne: offre.externalUrl ?? '',
      titre: offre.title,
      genre: OFFRES_FR[offre.kind],
      contrat: offre.contractType ?? '—',
      secteur: offre.sector ?? '—',
      entreprise: offre.companyName ?? '—',
      ville: offre.city === null ? 'Télétravail' : offre.city.name,
      quand: depuisQuand(offre.createdAt),
      description: offre.description,
      lien: offre.externalUrl ?? '—',
      /** Le domaine que l'interstitiel nomme, dérivé du lien lui-même. */
      domaine: offre.externalUrl === null ? '—' : domaineDe(offre.externalUrl),
    },
  };
}

/**
 * `/services/emploi/nouveau` — le formulaire de publication, SANS offre à lire.
 *
 * LA MAQUETTE DONNE DEUX ROUTES À UNE SEULE PLANCHE, et l'API les sépare : il n'y
 * a pas d'offre à charger pour `/nouveau`. Plutôt que d'en inventer une — la
 * dernière du membre, la première de la liste, n'importe quelle valeur plausible —
 * les champs de détail disent explicitement qu'il n'y en a pas.
 *
 * LE TITRE EST LE SEUL QUI NE SOIT PAS UN TIRET, et il vient de la maquette :
 * « PUBLIER UNE OFFRE » est le libellé que sa colonne de droite porte en toutes
 * lettres sur cette même planche. Ce n'est donc pas un titre inventé — c'est le
 * seul titre que la maquette écrive pour cette route. Écart remonté au porteur :
 * il faudrait une planche propre à `/nouveau`.
 */
export async function chargerS05Nouveau(): Promise<S05Charge> {
  const commun = await moiEtQuotas();
  return {
    ...commun,
    offre: {
      mode: 'nouveau',
      id: '',
      lienExterne: '',
      titre: 'Publier une offre',
      genre: '—',
      contrat: '—',
      secteur: '—',
      entreprise: '—',
      ville: '—',
      quand: '—',
      description: '—',
      lien: '—',
      domaine: '—',
    },
  };
}

// ─── S06 · /services/annuaire ────────────────────────────────────────────────

/**
 * L'annuaire.
 *
 * RÈGLE DURE §4.2 : la tête mise en avant arrive dans `featured`, à part
 * d'`items`, et chaque fiche porte `isFeatured` et `featuredLabel`. Les DEUX
 * variantes que la maquette dessine — cadre vert signalé, cadre blanc ordinaire —
 * sont pilotées par deux booléens exclusifs, parce que le dialecte de la maquette
 * n'a pas de `else`.
 *
 * RÈGLE DURE §4.1 : aucun numéro. Aucun champ lu ici n'en est un, et
 * `proCardSchema` est `.strict()` — une réponse qui en porterait un serait refusée
 * avant d'arriver jusqu'à cette fonction.
 */
export async function chargerS06(
  recherche = '',
  ville = '',
  metier = '',
  plus = false,
): Promise<S06Data> {
  const q = recherche.trim();
  const params = new URLSearchParams({ limit: '20' });
  if (q.length >= 2) params.set('q', q);
  if (ville !== '') params.set('cityId', ville);
  if (metier !== '') params.set('professionId', metier);
  const [commun, annuaire, villes, metiers] = await Promise.all([
    moiEtQuotas(),
    memberApi.get(`/pros?${params.toString()}`, prosListResponseSchema),
    // Le filtre de ville est un confort : sans la liste, la case dit « Toutes les villes ».
    memberApi
      .get('/places/cities?limit=100', placesCitiesResponseSchema)
      .then((l) => l.items.map((c) => ({ valeur: c.id, libelle: c.name })))
      .catch(() => []),
    // Les pastilles de métier sont un confort aussi : sans la liste, il n'y en a pas.
    memberApi
      .get('/pros/professions', prosProfessionsResponseSchema)
      .then((l) => l.items)
      .catch(() => []),
  ]);

  return {
    ...commun,
    onglets: ongletsServices('annuaire', commun.quotas.compteurs),
    annuaire: {
      recherche: q,
      ville,
      villes: [{ valeur: '', libelle: 'Toutes les villes' }, ...villes],
      metiers: pastillesMetiers(metiers, { actif: metier, plus, ville }),
      fiches: [...annuaire.featured, ...annuaire.items].map((p, rang) =>
        carteFiche(p, rang, annuaire.meta.featuredLabel),
      ),
    },
  };
}

/** Combien de pastilles avant « Plus » : une rangée, pas un mur. */
export const METIERS_PUCES_MAX = 6;

/**
 * LES PASTILLES DE MÉTIER DE L'ANNUAIRE (lot W2A, phase 2.14).
 *
 * Elles étaient six noms écrits ici — « Avocat, Comptable, Traducteur, Coiffure,
 * Plombier, Auto-école » — dont un n'existe pas dans le référentiel des métiers.
 * Elles viennent de `GET /pros/professions` : les métiers qui ont au moins une
 * fiche visible, du plus représenté au moins représenté. Chacune FILTRE par
 * `?metier=<id>` (le filtre `professionId` de la route, et non une recherche de
 * texte), et la pastille active se rappuie pour se retirer.
 *
 * Au-delà de `METIERS_PUCES_MAX`, la rangée se termine par « Plus » (`?plus=1`),
 * qui les montre tous, puis « Moins ». Sans aucun métier, pas de pastille.
 */
export function pastillesMetiers(
  metiers: readonly { readonly id: string; readonly nameFr: string }[],
  options: { readonly actif: string; readonly plus: boolean; readonly ville: string },
): Onglet[] {
  const { actif, plus, ville } = options;
  const lien = (extra: Record<string, string>): string => {
    const p = new URLSearchParams();
    if (ville !== '') p.set('ville', ville);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const texte = p.toString();
    return texte === '' ? '/services/annuaire' : `/services/annuaire?${texte}`;
  };
  // Le métier actif reste visible même s'il serait au-delà de la coupe.
  const visibles =
    plus || metiers.length <= METIERS_PUCES_MAX
      ? metiers
      : metiers.filter((m, rang) => rang < METIERS_PUCES_MAX || m.id === actif);
  const pastilles: Onglet[] = visibles.map((m) => ({
    libelle: m.nameFr,
    // Rappuyer sur le métier actif le retire.
    href: m.id === actif ? lien(plus ? { plus: '1' } : {}) : lien({ metier: m.id, ...(plus ? { plus: '1' } : {}) }),
    actif: m.id === actif,
  }));
  if (metiers.length > METIERS_PUCES_MAX) {
    pastilles.push(
      plus
        ? { libelle: 'Moins', href: lien(actif === '' ? {} : { metier: actif }), actif: false }
        : { libelle: 'Plus', href: lien({ ...(actif === '' ? {} : { metier: actif }), plus: '1' }), actif: false },
    );
  }
  return pastilles;
}

function carteFiche(p: ProCardView, rang: number, mentionDeLaListe: string): CarteFiche {
  return {
    href: `/services/annuaire/${p.id}`,
    enAvant: p.isFeatured,
    ordinaire: !p.isFeatured,
    mention: p.featuredLabel ?? mentionDeLaListe,
    fond: fondDeRang(rang),
    initiales: initialesDe(p.displayName),
    nom: p.displayName,
    /** Le nom commercial quand il existe, sinon le métier du référentiel. */
    metier: p.businessName ?? p.profession.nameFr,
    lieux: lieuxEtLangues(p),
    recos: p.recommendationCount,
  };
}

/** « Lyon, Villeurbanne · Français, Peul » — villes couvertes et langues. */
function lieuxEtLangues(p: ProCardView): string {
  const villes = enumeration(p.cities.map((c) => c.name));
  if (p.languages.length === 0) return villes;
  return `${villes} · ${enumeration(p.languages.map((l) => l.nameFr))}`;
}

// ─── S07 · /services/annuaire/:id ────────────────────────────────────────────

/**
 * Une fiche pro.
 *
 * RÈGLE DURE §4.1 : le téléphone n'est jamais affiché. Rien n'est filtré ici, et
 * c'est le point — il n'y a RIEN À FILTRER. `proDetailResponseSchema` ne décrit
 * aucun champ de numéro, et son `.strict()` refuse la réponse qui en porterait un.
 * La règle ne dépend donc pas de la vigilance de celui qui écrit cette fonction.
 *
 * `contactQuota` et `canRecommend` VIENNENT DU SERVEUR. Les recalculer ici
 * demanderait de relire le plan du membre et de savoir s'il est en contact avec le
 * pro — le premier est interdit par le socle, le second est hors de portée du front.
 */
export async function chargerS07(id: string): Promise<S07Charge> {
  const [commun, pro] = await Promise.all([
    moiEtQuotas(),
    memberApi.get(`/pros/${encodeURIComponent(id)}`, proDetailResponseSchema),
  ]);

  const plafond = pro.contactQuota?.max ?? null;
  const utilises = pro.contactQuota?.used ?? 0;

  return {
    ...commun,
    pro: {
      id: pro.id,
      estMienne: pro.isMine,
      peutRecommander: pro.canRecommend && pro.myRecommendation === null,
      initiales: initialesDe(pro.displayName),
      nom: pro.displayName,
      palier: PALIERS_FR[pro.tier],
      metier:
        pro.businessName === null
          ? pro.profession.nameFr
          : `${pro.profession.nameFr} · ${pro.businessName}`,
      villes: enumeration(pro.cities.map((c) => c.name)),
      description: pro.description ?? '—',
      tarif: pro.priceHint ?? '—',
      langues: enumeration(pro.languages.map((l) => l.nameFr)),
      recos: pro.recommendationCount,
      contactsCommuns: pro.mutualConnectionCount,
      /**
       * ÉCART SIGNALÉ AU PORTEUR : la maquette écrit « Utilise 1 de vos 3 contacts
       * du mois », une phrase qui suppose un plafond FINI. Pour un Premium,
       * `contactQuota.max` vaut `null` — « illimité » — et aucune tournure ne tient
       * dans ce moule : « de vos illimités contacts » n'est pas du français.
       *
       * On y met donc le signe `∞`, comme le module Compte le fait déjà pour un
       * quota sans plafond, plutôt que d'inventer une phrase que la maquette n'a
       * pas dessinée. Il faudrait une seconde formulation côté maquette.
       */
      // Vide quand tout est gratuit : la phrase « Utilise 1 de vos … contacts du mois » disparaît.
      contactsRestants: commun.quotas.gratuit ? '' : plafond === null ? '∞' : String(plafond),
      // Tout gratuit (`quotas.gratuit`) : AUCUN quota n'existe, donc rien à dire. Le
      // bouton mobile lit « Contacter » tout court au lieu de « Contacter · illimité »,
      // qui annonçait un plafond que personne n'a.
      quotaCourt: commun.quotas.gratuit ? '' : plafond === null ? 'illimité' : `${utilises + 1}/${plafond}`,
      recommandations: pro.recommendations.map(recommandation),
    },
  };
}

function recommandation(
  r: { readonly displayName: string; readonly comment: string | null },
  rang: number,
): Recommandation {
  return {
    fond: fondDeRang(rang),
    initiales: initialesDe(r.displayName),
    nom: nomCourt(r.displayName),
    /**
     * Les guillemets sont ceux de la maquette, et le commentaire est FACULTATIF
     * (§4.3) : une recommandation sans mot dit qu'elle existe, plutôt que
     * d'afficher deux guillemets vides.
     */
    mot: r.comment === null ? 'Recommande ce professionnel.' : `« ${r.comment} »`,
  };
}

// ─── S08 · /services/annuaire/ma-fiche ───────────────────────────────────────

/**
 * Le bandeau seul : la planche dessine un formulaire REMPLI et pas d'état vide.
 *
 * `GET /me/pro-profile` existe, son schéma est écrit et éprouvé — mais il rend
 * `null` tant que la fiche n'existe pas, et c'est le cas principal d'un écran qui
 * s'appelle « Créer ma fiche pro ». Lier ses champs viderait l'écran pour tous ceux
 * qui viennent le remplir. Signalé au porteur, avec l'écart de palier que la même
 * route porte (voir `screens/s08/data.ts`).
 */
export async function chargerS08(): Promise<S08Charge> {
  const [commun, plans] = await Promise.all([
    moiEtQuotas(),
    memberApi.get('/plans', plansResponseSchema),
  ]);

  /**
   * LE PLAN PRO, par son CODE et non par son rang dans la liste.
   *
   * `GET /plans` rend les quatre plans dans l'ordre de la table ; chercher
   * `items[2]` casserait au premier plan ajouté. `PlanCode` est l'énumération
   * partagée, donc `'PRO'` est vérifié par le compilateur et non épelé ici.
   */
  const pro = plans.items.find((p) => p.code === 'PRO');

  return {
    ...commun,
    /**
     * UN TIRET CADRATIN PLUTÔT QU'UN PRIX INVENTÉ si le plan manque.
     *
     * `find` peut rendre `undefined` — une table `plans` dont la ligne PRO serait
     * désactivée, ce que `PATCH /admin/plans/:code` autorise (`isActive`). Écrire
     * « 9 €/mois » en repli remettrait exactement le chiffre figé que cette
     * liaison retire, et il serait faux au pire moment : celui où le porteur vient
     * de changer l'offre.
     */
    offrePro: {
      nom: pro?.nameFr ?? 'Pro',
      prix: pro === undefined ? '—' : `${montant(pro.month.eur.amountCents, pro.month.eur.currency)}/mois`,
    },
  };
}

// ─── S09 · /services/mes-annonces ────────────────────────────────────────────

/**
 * Mes annonces et mes offres.
 *
 * `scope=mine` est exactement ce que `housingQuerySchema` prévoit pour cet écran :
 * « l'auteur y voit aussi ses annonces en pause », ce que la liste publique masque.
 *
 * RÈGLE DURE 00 §49 : aucun compteur de vues. Le service incrémente `viewCount` à
 * chaque lecture — compteur interne de modération — et aucune réponse ne le porte ;
 * `housingCardSchema` étant `.strict()`, il serait refusé s'il sortait un jour.
 *
 * ÉCART SIGNALÉ : « 6 contacts », que la règle AUTORISE, n'existe dans aucun champ.
 * Le sous-titre porte donc l'expiration seule, qui est une donnée réelle de la même
 * réponse.
 */
export async function chargerS09(): Promise<S09Charge> {
  const [commun, logement, emploi] = await Promise.all([
    moiEtQuotas(),
    memberApi.get('/housing?scope=mine&limit=20', housingListResponseSchema),
    memberApi.get('/jobs?scope=mine&limit=20', jobsListResponseSchema),
  ]);

  return {
    ...commun,
    mesAnnonces: {
      logement: logement.meta.total,
      /**
       * Compté sur `items`, faute de `total` — et c'est honnête à une borne près :
       * au-delà de vingt offres le compte serait celui de la page. Un membre n'en a
       * pas vingt ; la limite est dite ici plutôt que cachée, et l'écart est remonté.
       */
      emploi: emploi.items.length,
      liste: [...logement.items.map(ligneAnnonce), ...emploi.items.map(ligneOffre)],
    },
  };
}

/**
 * L'état d'une annonce, en cinq booléens EXCLUSIFS.
 *
 * `reviewState` passe AVANT `status`, et l'ordre porte du sens : une annonce en
 * vérification est `ACTIVE` en base (§2.2, tranche 0,4–0,7 : « publiée avec dossier
 * priorité 2 »), et l'afficher « Active » cacherait au membre qu'elle est relue.
 *
 * `reviewState` est RÉSERVÉ À L'AUTEUR — il vaut `null` pour les autres lecteurs —
 * et cet écran est le seul du module où il n'est jamais nul.
 */
function ligneAnnonce(a: HousingCardView): LigneAnnonce {
  const enRevue = a.reviewState === 'UNDER_REVIEW';
  return {
    id: a.id,
    genre: 'logement',
    href: `/services/logement/${a.id}`,
    hrefModifier: `/services/logement/nouveau?modifier=${a.id}`,
    enVerification: enRevue,
    active: !enRevue && a.status === 'ACTIVE',
    enPause: !enRevue && a.status === 'PAUSED',
    trouvee: !enRevue && a.status === 'TAKEN',
    expiree: !enRevue && (a.status === 'EXPIRED' || a.status === 'REMOVED'),
    titre: a.title,
    sousTitre: sousTitreAnnonce(a, enRevue),
  };
}

/** Une offre d'emploi de l'auteur : active, ou expirée (une offre ne se met pas en pause). */
function ligneOffre(o: JobCardView): LigneAnnonce {
  const active = o.status === 'ACTIVE';
  return {
    id: o.id,
    genre: 'emploi',
    href: `/services/emploi/${o.id}`,
    hrefModifier: '',
    enVerification: false,
    active,
    enPause: false,
    trouvee: false,
    expiree: !active,
    titre: o.title,
    sousTitre: active ? `expire ${dansCombien(o.expiresAt)}` : `Expirée le ${jourMoisEcrit(o.expiresAt)}`,
  };
}

function sousTitreAnnonce(a: HousingCardView, enRevue: boolean): string {
  if (enRevue) return `Envoyée ${depuisQuand(a.createdAt)}`;
  if (a.status === 'TAKEN') return `Clôturée le ${jourMoisEcrit(a.expiresAt)}`;
  if (a.status === 'EXPIRED' || a.status === 'REMOVED') {
    return `Expirée le ${jourMoisEcrit(a.expiresAt)}`;
  }
  if (a.status === 'PAUSED') return 'Reprendre quand vous voulez';
  return `expire ${dansCombien(a.expiresAt)}`;
}

// ─── S10 · /services/alertes ─────────────────────────────────────────────────

/**
 * Mes alertes.
 *
 * `GET /me/alerts` vit dans `housing.controller.ts` — il n'y a pas de module
 * `alerts`. Sa capacité est `content.read` et non une capacité d'alerte : §2.4 fait
 * de l'alerte une RECHERCHE MÉMORISÉE, qui ne publie rien et n'exige aucun niveau.
 * Sa barrière est le PLAN, que le service applique et que `meta.isPremium` dit.
 *
 * `sansPremium` vient donc du SERVEUR. Relire `users.plan` dans le front se
 * tromperait le jour où un essai, une grâce Mobile Money ou un plan Pro change la
 * réponse.
 */
export async function chargerS10(): Promise<S10Charge> {
  const [commun, alertes] = await Promise.all([
    moiEtQuotas(),
    memberApi.get('/me/alerts', myAlertsResponseSchema),
  ]);

  return {
    ...commun,
    alertes: {
      liste: alertes.items.map(ligneAlerte),
      sansPremium: !alertes.meta.isPremium,
    },
  };
}

function ligneAlerte(al: SavedAlertView): LigneAlerte {
  return {
    id: al.id,
    titre: titreAlerte(al),
    criteres: criteresAlerte(al.criteria),
    etat: al.isActive
      ? al.lastNotifiedAt === null
        ? 'Aucun envoi pour l’instant'
        : `Dernier envoi : ${depuisQuand(al.lastNotifiedAt)}`
      : 'En pause',
    active: al.isActive,
    enPause: !al.isActive,
  };
}

/** « Logement · Colocation » — le domaine de l'alerte et le kind qu'elle cherche. */
function titreAlerte(al: SavedAlertView): string {
  const domaine = al.kind === 'HOUSING' ? 'Logement' : 'Emploi';
  const precision =
    al.kind === 'HOUSING'
      ? al.criteria.kind === undefined
        ? null
        : LOGEMENTS_FR[al.criteria.kind]
      : (al.criteria.contractType ?? null);
  return precision === null ? domaine : `${domaine} · ${precision}`;
}

/**
 * Les critères, dans l'ordre où §2.4 les nomme.
 *
 * `criteria` est relu par `alertCriteriaSchema` — le MÊME schéma qui l'a écrit à la
 * création — donc chaque champ lu ici existe vraiment. Un `z.record(z.unknown())`
 * aurait laissé composer une phrase à partir de champs imaginaires.
 *
 * `cityId` est un UUID et PAS un nom : §2.4 enregistre la ville par identifiant, et
 * aucune route de ce module ne le résout. On n'écrit donc pas de ville plutôt que
 * d'écrire un UUID — écart remonté au porteur, c'est le même que celui de K01 sur
 * `GET /me`.
 */
function criteresAlerte(c: AlertCriteria): string {
  const morceaux: string[] = [];
  if (c.sector !== undefined) morceaux.push(c.sector);
  if (c.maxPriceCents !== undefined) {
    morceaux.push(`jusqu’à ${montant(c.maxPriceCents, 'EUR')}`);
  }
  if (c.radiusKm !== undefined) morceaux.push(`${c.radiusKm} km`);
  if (c.isFurnished === true) morceaux.push('meublé');
  if (c.isFurnished === false) morceaux.push('non meublé');
  return morceaux.length === 0 ? 'Tous les résultats' : morceaux.join(' · ');
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DESSIN SANS LA DONNÉE — POUR QUE LE CADRE SOIT SERVI TOUT DE SUITE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré au HTML servi, sans exécuter le JavaScript : `/services/logement`
 * répondait 200 avec une coquille — aucun rail, aucun panneau « SERVICES », aucune
 * barre basse. La branche d'attente de `EcranDonnees` remplaçait le cadre entier,
 * donc les quinze destinations déclarées sur ce cadre n'atteignaient jamais le
 * navigateur. Ce n'était pas un lien mort, c'était un cadre non rendu.
 *
 * Le motif est celui de `/accueil`, et celui de `VUE_NEUTRE` dans le module
 * Parcours : le dessin tout de suite, la donnée ensuite. Les nombres sont à zéro
 * et les chaînes vides — un écran qui n'a pas encore ses annonces n'en annonce
 * aucune.
 *
 * `bandeau` EST L'EXCEPTION, ET C'EST LA RÈGLE DURE 10 §2.2 : le bandeau de
 * non-paiement est « renvoyé par l'API sur chaque liste » et affiché en
 * permanence. `HOUSING_SAFETY_BANNER` est la MÊME constante que le serveur sert
 * dans `meta.safetyBanner` : la phrase reste donc à l'écran pendant le chargement,
 * au lieu d'y manquer précisément le temps que la page se remplisse.
 *
 * `plafondPro` et `barre` sont des CHAÎNES dans ce type (`plafondPro` est le
 * dénominateur affiché, `barre` une largeur CSS) : le plafond vient de
 * `FREE_PRO_CONTACTS_PER_MONTH`, la même constante que le serveur applique, et la
 * barre est à `0%` parce que rien n'est encore consommé à l'affichage.
 */
export const SQUELETTE_S01: S01Data = {
  moi: { initiales: '', prenom: '' },
  quotas: {
    compteurs: COMPTEURS_INCONNUS,
    contactsPro: 0,
    plafondPro: String(FREE_PRO_CONTACTS_PER_MONTH),
    barre: '0%',
    reinitialise: '',
    gratuit: true,
  },
  onglets: [],
  filtres: [],
  liste: { total: 0, phrase: '', ville: '', bandeau: HOUSING_SAFETY_BANNER, annonces: [] },
};

/**
 * LES CINQ AUTRES ÉCRANS DE LISTE DU MODULE, pour la même raison que S01.
 *
 * Ce sont les destinations que le panneau de section vient de gagner — « Bourses
 * et emploi », « Annuaire professionnel », « Mes annonces », « Mes alertes »,
 * « Ma fiche pro ». Mesuré au HTML servi avant correction : chacune répondait 200
 * avec CINQ MOTS et zéro entrée de rail. Un sous-lien qui atterrit sur une
 * coquille vide est, pour le porteur, un sous-lien qui ne marche pas.
 *
 * `plafondPro` vient de `FREE_PRO_CONTACTS_PER_MONTH`, la même constante que le
 * serveur applique ; `barre` est à `0%` parce que rien n'est encore consommé à
 * l'affichage. Les listes sont vides, et les compteurs à zéro : un écran qui n'a
 * pas encore ses annonces n'en annonce aucune.
 *
 * `sansPremium: false` sur S10, et c'est le choix PRUDENT : `true` afficherait le
 * verrou Premium à un membre qui l'a peut-être, le temps de l'appel — donc une
 * restriction annoncée à tort. `false` ne promet rien : c'est l'écran sans
 * encart, et l'encart apparaît quand le serveur le dit.
 */
const SOCLE_SERVICES = {
  moi: { initiales: '', prenom: '' },
  quotas: {
    compteurs: COMPTEURS_INCONNUS,
    contactsPro: 0,
    plafondPro: String(FREE_PRO_CONTACTS_PER_MONTH),
    barre: '0%',
    reinitialise: '',
    gratuit: true,
  },
} as const;

export const SQUELETTE_S04: S04Charge = {
  ...SOCLE_SERVICES,
  pret: false,
  onglets: [],
  offres: { liste: [], total: 0, sousTitre: '' },
  profils: { liste: [], suite: null },
};

export const SQUELETTE_S06: S06Data = {
  ...SOCLE_SERVICES,
  onglets: [],
  annuaire: { recherche: '', ville: '', villes: [], metiers: [], fiches: [] },
};

export const SQUELETTE_S08: S08Charge = { ...SOCLE_SERVICES, offrePro: { nom: '', prix: '' } };

export const SQUELETTE_S09: S09Charge = {
  ...SOCLE_SERVICES,
  mesAnnonces: { logement: 0, emploi: 0, liste: [] },
};

export const SQUELETTE_S10: S10Charge = {
  ...SOCLE_SERVICES,
  alertes: { liste: [], sansPremium: false },
};

/**
 * LES QUATRE ÉCRANS DE DÉTAIL ET DE PUBLICATION DU MODULE.
 *
 * Même cause, même remède : `/services/logement/:id`, `/services/logement/nouveau`,
 * `/services/emploi/:id` et `/services/annuaire/:id` répondaient 200 en servant
 * cinq mots.
 *
 * `titre`, `nom` et `entreprise` portent un TIRET CADRATIN plutôt que la chaîne
 * vide : ces trois-là sont promus en `<h1>` par le générateur, et un `<h1>` vide
 * est un en-tête sans contenu — axe-core l'a déjà relevé en `serious` ailleurs
 * dans ce lot (`link-name` sur un `<a>` dont le nom venait d'un titre vide).
 *
 * `bandeau` de S03 est la RÈGLE DURE 10 §2.2, et il vient du serveur sur chaque
 * liste. `HOUSING_SAFETY_BANNER` est la même constante : la phrase de sécurité
 * reste donc affichée pendant le chargement, au lieu d'y manquer précisément le
 * temps que la page se remplisse.
 *
 * `prudenceRenforcee: false` est le choix PRUDENT dans l'autre sens que son nom
 * ne le suggère : `true` afficherait un avertissement renforcé sur une annonce
 * dont le serveur n'a rien dit. On n'invente pas d'alerte.
 */
export const SQUELETTE_S02: S02Charge = {
  ...SOCLE_SERVICES,
  annonce: {
    id: '',
    fonds: [],
    nbPhotos: 0,
    meuble: false,
    auteurSous: '',
    niveau: '',
    estMienne: false,
    titre: '—',
    prix: '',
    genre: '',
    quartier: '',
    disponible: '',
    duree: '',
    description: '',
    initiales: '',
    auteur: '',
    auteurCourt: '',
    prenomAuteur: '',
    autresPhotos: 0,
    contactsCommuns: 0,
    prudenceRenforcee: false,
  },
};

export const SQUELETTE_S03: S03Charge = {
  ...SOCLE_SERVICES,
  publication: { bandeau: HOUSING_SAFETY_BANNER },
};

export const SQUELETTE_S05: S05Charge = {
  ...SOCLE_SERVICES,
  offre: {
    mode: 'detail',
    id: '',
    lienExterne: '',
    titre: '—',
    genre: '',
    contrat: '',
    secteur: '',
    entreprise: '—',
    ville: '',
    quand: '',
    description: '',
    lien: '',
    domaine: '',
  },
};

export const SQUELETTE_S07: S07Charge = {
  ...SOCLE_SERVICES,
  pro: {
    id: '',
    estMienne: false,
    peutRecommander: false,
    initiales: '',
    nom: '—',
    palier: '',
    metier: '',
    villes: '',
    description: '',
    tarif: '',
    langues: '',
    recos: 0,
    contactsCommuns: 0,
    contactsRestants: '',
    quotaCourt: '',
    recommandations: [],
  },
};
