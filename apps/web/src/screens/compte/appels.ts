'use client';

import {
  authSessionsResponseSchema,
  connectionRequestsResponseSchema,
  connectionSuggestionsResponseSchema,
  dataExportStatusResponseSchema,
  kycStatusResponseSchema,
  myBlocksResponseSchema,
  myConnectionsResponseSchema,
  myPaymentsResponseSchema,
  mySanctionsResponseSchema,
  mySubscriptionResponseSchema,
  bookmarksResponseSchema,
  MEMBER_CONTENT_LABELS_FR,
  MEMBER_CONTENT_TYPES,
  memberContentResponseSchema,
  notificationPreferencesResponseSchema,
  plansResponseSchema,
  publicProfileResponseSchema,
  type BookmarkState,
  type BookmarkSubjectType,
  type MemberContentType,
  type MeResponse,
  type MyPaymentsResponse,
  type OccupationStatus,
  type Phase,
  type PublicProfileResponse,
  type SanctionType,
  HELP_TYPE_LABELS,
} from '@app/shared';
import { ApiError, fetchMe, memberApi } from '@/lib/api/index';
import { fetchFeed } from '@/screens/accueil/api';
import { feedPostsFrom } from '@/screens/accueil/from-api';
import { fetchGuides } from '@/screens/guides/api';
import { guideCardsFrom } from '@/screens/guides/from-api';
import { construireCarte } from '@/screens/agenda/data';
import { eventsResponseSchema, housingListResponseSchema } from '@app/shared';
import type { HousingCardView } from '@app/shared';
import type { CarteAnnonce } from '@/screens/s01/data';
import { publicJourneysResponseSchema } from '@app/shared';
import type { PublicJourneysResponse } from '@app/shared';
import type { CarteParcours as CarteParcoursView } from '@/screens/parcours/data';

type PublicJourneyCardView = PublicJourneysResponse['items'][number];

/**
 * LA CARTE D'ANNONCE DU PROFIL — la même fabrique que `/services/logement`,
 * moins le `fondDeRang` qui appartient à la grille de cette page-là.
 */
function carteAnnoncePublique(a: HousingCardView, rang: number): CarteAnnonce {
  return {
    href: `/services/logement/${a.id}`,
    genre: a.kind,
    titre: a.title,
    prix: a.priceCents === null ? 'Gratuit' : `${String(Math.round(a.priceCents / 100))} €`,
    /**
     * LA VILLE ET LE GENRE, et rien de plus : `HousingCardView` ne porte pas de
     * nombre de pièces, et le composer à partir d'autre chose serait inventer.
     * La page d'origine y met « Meublé · 1er oct. · 12 mois » ; ici la carte est
     * posée sur un profil, où la ville dit le principal.
     */
    detail: a.city.name,
    fond: FONDS_ANNONCE[rang % FONDS_ANNONCE.length] ?? '#E3ECE8',
    initiales: initialesDe(a.author.displayName),
    auteur: a.author.displayName,
  };
}

/** Les quatre aplats que la grille des annonces dessine, dans son ordre. */
const FONDS_ANNONCE = ['#E3ECE8', '#EFE6DE', '#E6EBF2', '#EAE4EF'];

/**
 * LA CARTE DE PARCOURS DU PROFIL.
 *
 * `/journeys/public` ne rend PAS la même ligne que `/journeys` : pas de titre
 * personnel — c'est la règle dure de 04 §2, « jamais le titre que le membre lui
 * a donné » — pas de date de dernière activité, pas d'étape courante nommée. On
 * compose donc avec ce qu'elle rend, et pas un champ de plus : le NOM DU TYPE de
 * parcours, la ville de destination, et l'avancement.
 */
function carteParcoursPublic(j: PublicJourneyCardView): CarteParcoursView {
  const pct = Math.round(j.progressPct);
  const abouti = j.status === 'COMPLETED';
  return {
    href: `/parcours/${j.id}`,
    type: j.template.nameFr.toUpperCase(),
    actif: !abouti,
    enPause: false,
    titre: j.template.nameFr,
    sousTitre: abouti ? 'Abouti' : `${j.destinationCity.name} · ${String(pct)} %`,
    sousTitreCourt: abouti ? 'Abouti' : `${String(pct)} %`,
    pourcent: `${String(pct)} %`,
    barre: `${String(pct)}%`,
    teinte: abouti ? '#16785E' : '#E0733A',
  };
}

/** `/@fatou` dans l'URL, `fatou` dans la charge : `handleSchema` refuse le `@`. */
const sansArobase = (pseudo: string): string =>
  pseudo.startsWith('@') ? pseudo.slice(1) : pseudo;
import { fondAvatar } from '@/lib/avatar';
import { urlMedia } from '@/lib/api/base';
import { photoFondFor } from '@/screens/a14/data';
import type {
  Bandeau,
  K01Lecture,
  K02Data,
  K03Data,
  K04Data,
  K05Data,
  K06Data,
  K07Data,
  K08Data,
  K09Data,
  K10Data,
  OngletContenu,
  OngletEnregistres,
  PastilleNiveau,
} from './data';

/**
 * LES APPELS DES ÉCRANS K01 À K10 — un chargeur par écran, et rien d'autre.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────────────
 *
 * Il n'a AUCUN `fetch`, aucun en-tête, aucun jeton, aucun rejeu. Le socle
 * (`lib/api/`) porte tout cela, et sa consigne est à lire avant d'ajouter une
 * ligne ici. Quatre de ses règles se voient dans ce fichier :
 *
 *   1. `memberApi` seulement. `staffApi` n'est pas importé, et ne peut pas l'être
 *      utilement : il n'a aucun moyen d'exprimer `/me`.
 *   2. TOUT APPEL PORTE UN SCHÉMA. Il n'existe pas de variante sans, et les
 *      schémas viennent de `@app/shared` — onze ont été ÉCRITS LÀ pour ce lot,
 *      à côté des schémas de requête de leur module, parce qu'un schéma de réponse
 *      recopié dans le front est une deuxième source qui divergera.
 *   3. AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN : `z.infer` partout. `KycStatusResponse`
 *      ÉTAIT une `interface` écrite à la main — donc un type qui ne vérifiait rien
 *      à l'exécution. Elle est devenue `kycStatusResponseSchema` + `z.infer`.
 *   4. LE NIVEAU NE SERT JAMAIS À AUTORISER. Il est affiché, et c'est tout. Aucun
 *      `if (niveau >= 2)` n'existe ici, et il n'en faut pas : on tente l'action, le
 *      serveur répond `403 LEVEL_REQUIRED`, et l'invitation du §7.3 s'affiche.
 *
 * ── UNE ABSENCE N'EST PAS UNE PANNE ─────────────────────────────────────────
 *
 * Trois routes de ce module répondent `404` quand il n'y a rien à montrer : une
 * archive jamais demandée, un membre sans sanction, un profil privé. Les traiter
 * comme des échecs mettrait un bandeau d'erreur sur un écran parfaitement normal.
 * `absent()` distingue donc le `404` du reste — sur `error.code`, jamais sur le
 * message (§5.2) — et rend `null`.
 *
 * ── CE QUE LE DÉBIT LIMITÉ IMPOSE ───────────────────────────────────────────
 *
 * Aucun chargeur ici ne REJOUE. Le socle rejoue ce qui doit l'être (un `401` après
 * rafraîchissement) et ne rejoue jamais un `429` — dont l'attente se compte en
 * SECONDES et peut valoir 3600, `PATCH /me` étant chiffré à l'heure. Un chargeur
 * qui réessaierait de lui-même transformerait une attente d'une heure en boucle.
 */

// ─── Libellés ────────────────────────────────────────────────────────────────

/**
 * LES TROIS PHASES (01 §2.2), dans les mots des maquettes.
 *
 * `RECENT_ARRIVAL` est écrit par `08 Compte` elle-même (« Je viens d’arriver »,
 * K01). Les deux autres viennent de `01 Accès et Onboarding`, qui dessine les
 * trois cartes de choix — on ne traduit pas une énumération, on reprend les mots
 * que le produit a déjà écrits.
 *
 * ÉCART SIGNALÉ AU PORTEUR : K02 GENRE ses phases — « Installée » pour Fatou,
 * « Arrivé » pour Kofi — et aucun champ de l'API ne porte le genre. Les formes
 * inclusives de `01` sont donc employées aux deux endroits. Décider autrement
 * reviendrait à deviner le genre d'un membre à partir de son prénom.
 */
const PHASES_FR: Record<Phase, string> = {
  PRE_DEPARTURE: 'Je prépare mon départ',
  RECENT_ARRIVAL: 'Je viens d’arriver',
  SETTLED: 'Je suis installé·e',
};

/** Les cinq statuts, dans les mots de `08 Compte` (K01) et de `01` pour le dernier. */
const OCCUPATIONS_FR: Record<OccupationStatus, string> = {
  STUDENT: 'Étudiant·e',
  EMPLOYEE: 'Salarié·e',
  JOB_SEEKER: 'En recherche',
  ENTREPRENEUR: 'Indépendant·e',
  OTHER: 'Famille',
};

/**
 * Les libellés viennent de `@app/shared` : UNE seule table pour les huit
 * types, depuis que les deux énumérations n'en font plus qu'une. Deux tables
 * disant le même vocabulaire finiraient par se contredire.
 */
const AIDES_FR = HELP_TYPE_LABELS;


/** Les trois sanctions, dans les mots de `T2 §sanction.*` (13 §4.2). */
const SANCTIONS_FR: Record<SanctionType, string> = {
  WARNING: 'Avertissement',
  SUSPENSION: 'Compte suspendu',
  BAN: 'Compte banni',
};

/**
 * Les deux pastilles d'état de K03, avec LES COULEURS DE LA MAQUETTE.
 *
 * Relevées sur ses propres planches : `#E3F0EB` sur `#0F5C48` pour un niveau
 * acquis, `#FBE3D4` sur `#B4581F` pour un niveau à faire. Aucune n'est modifiée —
 * les assombrir pour gagner du contraste est précisément ce que le porteur a
 * refusé.
 *
 * ── LE RESTE-À-FAIRE A ÉTÉ CORRIGÉ, ET IL FAUT DIRE D'OÙ VENAIT L'ERREUR ────
 *
 * Ces deux lignes portaient `#F2F5F4` sur `#5D6B66` pour « À faire », et le
 * commentaire au-dessus l'affirmait « relevé sur ses propres planches ». C'ÉTAIT
 * FAUX, et c'est vérifiable en une commande : `08 Compte.dc.html` ne dessine
 * qu'UNE pastille « À faire », en `#FBE3D4` sur `#B4581F`, sur les deux planches
 * de K03. La paire grise est celle de la pastille d'ORIGINE d'un contact
 * (« Entraide », « Parrainage ») sur K05 — une autre pastille, un autre sens.
 *
 * La dérive était invisible par construction, et c'est ce qui la rend instructive :
 * une couleur qui devient une DONNÉE sort du champ des quatre contrôles du
 * générateur. Ceux-ci vérifient que `#FBE3D4` est toujours dessiné dans la
 * maquette — ils ne peuvent pas vérifier ce que ce fichier décide de mettre à sa
 * place à l'exécution. Le garde-fou s'arrête à la frontière de `donnees` ; au-delà,
 * c'est la lecture de la maquette qui répond, et elle doit être faite.
 */
const ACQUIS: PastilleNiveau = { etat: 'Acquis', fond: '#E3F0EB', texte: '#0F5C48' };
const A_FAIRE: PastilleNiveau = { etat: 'À faire', fond: '#FBE3D4', texte: '#B4581F' };

/** Les couleurs d'avatar de la maquette K05, dans son ordre. Cyclées par rang. */
const FONDS_AVATAR = ['#0F5C48', '#16785E', '#E0733A'] as const;

/** Les quatre origines de contact (08 §3.1), telles que K05 les écrit. */
const ORIGINES_FR: Record<string, string> = {
  HELP: 'Entraide',
  MENTORSHIP: 'Parrainage',
  EVENT: 'Rencontre',
  COMMUNITY: 'Réseau',
  MANUAL: 'Demande',
};

// ─── Mise en forme ───────────────────────────────────────────────────────────

/** `L2` → `2`. Affiché, jamais employé pour décider. */
const rangDeNiveau = (niveau: string): number => Number(niveau.replace(/^L/, '')) || 0;

/**
 * Les initiales d'un nom affiché : « Amina Diallo » → « AD ».
 *
 * Deux lettres au plus, et jamais une chaîne vide : un rond de couleur sans lettre
 * ressemble à un défaut de chargement. Un nom d'un seul mot rend sa seule
 * initiale, ce que la maquette dessine aussi (« FN » pour deux mots, un rond à une
 * lettre pour un pseudonyme court).
 */
function initialesDe(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  if (mots.length === 0) return '?';
  const lettres = mots.slice(0, 2).map((m) => [...m][0] ?? '');
  return lettres.join('').toUpperCase();
}

const prenomDe = (nom: string): string => nom.trim().split(/\s+/)[0] ?? nom;

const dateFr = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const dateLongueFr = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const moisFr = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/** « 3 mars ». Le mois en toutes lettres, comme la maquette l'écrit. */
const jourEtMois = (iso: string): string => dateFr.format(new Date(iso));

/** « 12 janvier 2026 » — K09 écrit l'année, parce qu'une sanction se date. */
const jourMoisAnnee = (iso: string): string => dateLongueFr.format(new Date(iso));

/** « Août 2026 », majuscule initiale comprise : `Intl` rend « août ». */
function moisEtAnnee(iso: string): string {
  const brut = moisFr.format(new Date(iso));
  return brut.charAt(0).toUpperCase() + brut.slice(1);
}

/**
 * Un montant en centimes, dans la devise que le serveur a jointe.
 *
 * `Intl` PLUTÔT QU'UNE DIVISION PAR CENT suivie d'une concaténation : le XOF n'a
 * aucune décimale, l'EUR en a deux, et `2600 / 100` donnerait « 26 F » là où le
 * serveur veut dire 2 600 francs. C'est exactement l'erreur comptable que
 * `moneyResponseSchema` existe pour rendre impossible côté contrat ; ici c'est
 * `Intl` qui la rend impossible côté affichage.
 */
function montant(m: { readonly amountCents: number; readonly currency: string }): string {
  const format = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: m.currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: m.currency === 'XOF' ? 0 : 2,
    minimumFractionDigits: 0,
  });
  return format.format(m.amountCents / (m.currency === 'XOF' ? 1 : 100));
}

/**
 * Une liste de noms, telle que la maquette les écrit : « Comptabilité, Excel ».
 *
 * Vide, elle rend un tiret cadratin plutôt qu'une chaîne nulle : une ligne de
 * formulaire qui se vide donne l'impression que la page n'a pas fini de charger.
 */
const enumeration = (valeurs: readonly string[]): string =>
  valeurs.length === 0 ? '—' : valeurs.join(', ');

/** « il y a 2 h », « maintenant », « il y a 3 semaines » — les mots de la maquette. */
function depuisQuand(iso: string, maintenant: number = Date.now()): string {
  const ecart = Math.max(0, maintenant - new Date(iso).getTime());
  const minutes = Math.floor(ecart / 60_000);
  if (minutes < 2) return 'maintenant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 7) return `il y a ${jours} j`;
  const semaines = Math.floor(jours / 7);
  if (semaines < 5) return `il y a ${semaines} semaine${semaines > 1 ? 's' : ''}`;
  return `le ${jourEtMois(iso)}`;
}

/**
 * `404` → `null`. Tout le reste remonte.
 *
 * On décide sur `error.code`, JAMAIS sur le message (§5.2), et l'`instanceof`
 * porte du sens : `ApiShapeError` n'hérite PAS d'`ApiError`, donc un contrat cassé
 * ne peut pas être avalé ici et pris pour « rien à montrer ». Il remonte comme
 * l'incident qu'il est.
 */
async function absent<T>(appel: Promise<T>): Promise<T | null> {
  try {
    return await appel;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

// ─── Le bandeau, commun aux dix écrans ───────────────────────────────────────

/**
 * LE BANDEAU DE COMPTE — deux appels, et le second se pardonne.
 *
 * `fetchMe()` sans `force` : la copie en mémoire suffit pour AFFICHER un nom. La
 * règle du socle ne dit pas « ne jamais réutiliser `/me` », elle dit `force: true`
 * « dès qu'une décision irréversible en dépend » — et afficher un nom n'en est pas
 * une. Les écrans qui décident n'existent pas dans ce lot : aucun bouton n'est
 * branché.
 *
 * Le compte de demandes reçues, lui, est décoratif : une pastille. S'il échoue, on
 * affiche zéro — donc rien — plutôt que de faire échouer la page entière. Un
 * bandeau de compte qui refuse de s'afficher parce qu'un compteur n'a pas répondu
 * serait une panne créée par un ornement.
 */
async function chargerBandeau(): Promise<Bandeau> {
  const [me, demandes] = await Promise.all([fetchMe(), compterDemandes()]);
  return bandeauDe(me, demandes);
}

function bandeauDe(me: MeResponse, demandes: number): Bandeau {
  return {
    nom: me.user.displayName,
    initiales: initialesDe(me.user.displayName),
    /**
     * `urlMedia` : `GET /me` rend `/media/…`, une adresse RELATIVE que le
     * navigateur résoudrait contre le serveur WEB et non contre l'API.
     */
    photo: me.user.avatarUrl === null ? null : photoFondFor(urlMedia(me.user.avatarUrl), false),
    pseudo: `@${me.user.handle}`,
    niveau: rangDeNiveau(me.user.verificationLevel),
    prenom: prenomDe(me.user.displayName),
    demandes,
  };
}

// ─── K01 · /compte/profil ────────────────────────────────────────────────────

/**
 * DEUX ROUTES POUR UN ÉCRAN, et c'est un écart de l'API, pas un choix de confort.
 *
 * `GET /me` rend `cityId` et `originCountryId` — DES UUID. La planche écrit
 * « Lyon » et « Bénin ». Les deux référentiels qui les résoudraient
 * (`/referentials/countries`, `/referentials/cities`) sont des routes d'ÉQUIPE,
 * `@RequiresStaffRole` : le client membre ne peut pas les appeler, et ce n'est pas
 * une limite du front — c'est le domaine. Le seul chemin honnête est donc
 * `GET /users/{mon pseudo}`, qui résout pays, ville, langues et compétences.
 *
 * SIGNALÉ AU PORTEUR : `/me` devrait porter les NOMS de sa ville et de son pays,
 * comme le fait déjà le profil public. En l'état, l'écran « Mon profil » fait un
 * aller-retour de plus pour une donnée que le serveur a déjà en main.
 */
export async function chargerK01(): Promise<K01Lecture> {
  const me = await fetchMe();
  const [profil, demandes] = await Promise.all([
    memberApi.get(`/users/${encodeURIComponent(me.user.handle)}`, publicProfileResponseSchema),
    compterDemandes(),
  ]);

  return {
    moi: bandeauDe(me, demandes),
    /**
     * LES IDENTIFIANTS À CÔTÉ DES LIBELLÉS. La boîte affiche une PHRASE
     * composée — « Relecture de CV, Démarches CAF » — et la fenêtre de choix a
     * besoin de savoir lesquels sont cochés. Les deux viennent du même profil
     * public, lu juste au-dessus.
     */
    competencesIds: profil.skills.map((x) => x.id),
    /**
     * LES LANGUES ARRIVENT SANS IDENTIFIANT, et c'est un écart de l'API.
     * `publicProfileResponseSchema` rend `{ code, nameFr }` pour les langues et
     * `{ id, nameFr }` pour les compétences. `PATCH /me/profile` attend pourtant
     * `languageIds` — des UUID.
     *
     * On rend donc les CODES ici, et l'écran les convertit contre le référentiel
     * qu'il charge de toute façon (`GET /places/languages` donne les deux). Le
     * faire ici demanderait à ce chargeur d'appeler une route de plus pour tout
     * le monde, y compris ceux qui n'ouvriront jamais la fenêtre.
     *
     * REMONTÉ : un `id` sur les langues du profil public fermerait l'écart.
     */
    languesIds: profil.languages.map((x) => x.code),
    profil: {
      statut:
        me.profile === null ? '—' : OCCUPATIONS_FR[me.profile.occupationStatus],
      ville: profil.city?.name ?? '—',
      pays: profil.country.nameFr,
      bio: me.profile?.bio ?? '—',
      phase: PHASES_FR[me.user.phase],
      competences: enumeration(profil.skills.map((s) => s.nameFr)),
      langues: enumeration(profil.languages.map((l) => l.nameFr)),
      aides: enumeration((me.profile?.helpTypes ?? []).map((h) => AIDES_FR[h])),
    },
  };
}

/** Le compteur de la pastille, isolé pour être partagé — et pardonné (voir plus haut). */
async function compterDemandes(): Promise<number> {
  try {
    const recues = await memberApi.get('/me/connection-requests', connectionRequestsResponseSchema);
    return recues.items.length;
  } catch {
    return 0;
  }
}

// ─── K02 · /@:handle ─────────────────────────────────────────────────────────

/**
 * Le profil public d'un autre membre.
 *
 * `404` n'est PAS traité ici comme une absence à afficher : 08 §4.4 et T4 §3
 * veulent qu'un membre bloqué, désactivé ou supprimé soit indiscernable d'un
 * membre qui n'existe pas. L'écran remonte donc l'échec, et `displayMessageFor`
 * dira « introuvable » — la même phrase dans les quatre cas, ce qui est le but.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SEPT ONGLETS DU PROFIL PUBLIC                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « des tabs (guides, fil d'actualités, stories, entraides,
 * services, évènements, parcours publics) qui montrent ce que l'utilisateur a
 * publié ». L'ordre est le sien, et `MEMBER_CONTENT_LABELS_FR` porte les
 * libellés — côté `@app/shared`, là où le serveur les lit aussi.
 *
 * LE COMPTE EST COLLÉ AU LIBELLÉ — « Guides · 3 » — comme les onglets de la
 * recherche le font déjà. Il vient de `meta.parType`, donc de la collection
 * entière, jamais de la page lue.
 */
function ongletsContenu(
  choisi: MemberContentType,
  parType: Readonly<Partial<Record<MemberContentType, number>>>,
  onChoisir: (cle: MemberContentType) => void,
): readonly OngletContenu[] {
  return MEMBER_CONTENT_TYPES.map((t) => {
    const actif = t === choisi;
    return {
      cle: t,
      libelle: `${MEMBER_CONTENT_LABELS_FR[t]} · ${String(parType[t] ?? 0)}`,
      fond: actif ? '#16785E' : '#fff',
      texte: actif ? '#fff' : '#16211D',
      bord: actif ? '#16785E' : '#E6EBE9',
      actif,
      onChoisir: () => {
        onChoisir(t);
      },
    };
  });
}

export async function chargerK02(
  pseudo: string,
  onglet: MemberContentType = 'GUIDE',
  onChoisir: (cle: MemberContentType) => void = () => undefined,
): Promise<K02Data> {
  const [
    me,
    membre,
    demandes,
    contenu,
    publications,
    guidesPublies,
    evenements,
    annonces,
    parcours,
  ] = await Promise.all([
    fetchMe(),
    memberApi.get(`/users/${encodeURIComponent(pseudo)}`, publicProfileResponseSchema),
    compterDemandes(),
    /**
     * UNE LISTE VIDE PLUTÔT QU'UNE PAGE EN PANNE : le profil doit s'afficher
     * même si cette route faiblit. C'est une carte de plus, pas la raison d'être
     * de l'écran.
     */
    memberApi
      .get(
        `/users/${encodeURIComponent(pseudo)}/content?type=${onglet}&limit=20`,
        memberContentResponseSchema,
      )
      .catch(() => ({ items: [], nextCursor: null, meta: { total: 0, parType: {} } })),
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ L'ONGLET « FIL » MONTRE LA VRAIE CARTE DU FIL                       ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur, capture à l'appui. Une carte se dessine à partir de
     * `postCardSchema` ENTIER — pastille de type, contexte, photos, sondage,
     * compteurs, réaction, signet — donc une route résumée ne peut pas la
     * nourrir. On interroge LE FIL filtré par auteur, et on le passe par
     * `feedPostsFrom`, exactement comme la page d'accueil.
     *
     * DEMANDÉ SEULEMENT SOUS CET ONGLET : six profils sur sept n'en ont pas
     * besoin, et un appel de plus à chaque ouverture de profil se paierait sur
     * la page la plus visitée après le fil.
     */
    onglet === 'POST'
      ? fetchFeed({ authorHandle: sansArobase(pseudo), limit: 20 })
          .then(feedPostsFrom)
          .catch(() => [])
      : Promise.resolve([]),
    /**
     * LES GUIDES, MÊME PRINCIPE : `GET /guides?authorHandle=…`, puis le
     * convertisseur du module Guides. La carte vient de sa page d'origine.
     */
    onglet === 'GUIDE'
      ? fetchGuides({ tab: 'recent', authorHandle: sansArobase(pseudo) })
          .then((page) => guideCardsFrom(page))
          .catch(() => [])
      : Promise.resolve([]),
    /**
     * LES ÉVÉNEMENTS ORGANISÉS et LES ANNONCES, mêmes principes : la liste
     * d'origine filtrée par auteur, puis le convertisseur du module. Chaque
     * onglet n'appelle QUE sa route — six profils sur sept n'en ont pas besoin,
     * et un appel de plus par ouverture se paierait sur une page très visitée.
     */
    onglet === 'EVENT'
      ? memberApi
          .get(
            `/events?authorHandle=${encodeURIComponent(sansArobase(pseudo))}&limit=20`,
            eventsResponseSchema,
          )
          /**
           * LA TABLE DES RÉSEAUX EST VIDE ICI, et c'est juste : elle sert à
           * nommer le réseau d'un événement réservé. Le profil public ne montre
           * que les événements SANS réseau — voir la règle de visibilité du
           * service — donc elle n'a rien à nommer.
           */
          .then((page) => page.items.map((e) => construireCarte(e, new Map())))
          .catch(() => [])
      : Promise.resolve([]),
    onglet === 'SERVICE'
      ? memberApi
          .get(
            `/housing?authorHandle=${encodeURIComponent(sansArobase(pseudo))}&limit=20`,
            housingListResponseSchema,
          )
          .then((page) => page.items.map(carteAnnoncePublique))
          .catch(() => [])
      : Promise.resolve([]),
    onglet === 'JOURNEY'
      ? memberApi
          .get(
            `/journeys/public?authorHandle=${encodeURIComponent(sansArobase(pseudo))}&limit=20`,
            publicJourneysResponseSchema,
          )
          .then((page) => page.items.map(carteParcoursPublic))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  return {
    moi: bandeauDe(me, demandes),
    membre: vueMembre(membre),
    contenuOnglets: ongletsContenu(onglet, contenu.meta.parType, onChoisir),
    contenus: contenu.items.map((c) => ({
      id: c.id,
      titre: c.title,
      sous: c.subtitle,
      href: c.href,
      /**
       * LE FOND EST UNE VALEUR CSS, pas une adresse. Le serveur rend
       * `/media/<clé>` pour une photo et un aplat sinon ; `photoFondFor` en fait
       * le `background` que `ApercuStory` attend — la même fabrique que le
       * composeur de story emploie, pour que les deux se ressemblent.
       */
      ...(c.apercu === undefined
        ? {}
        : {
            apercu: {
              ...c.apercu,
              fond: c.apercu.photo
                ? photoFondFor(urlMedia(c.apercu.fond), false)
                : c.apercu.fond,
            },
          }),
    })),
    contenuEspece: onglet,
    contenuPublications: publications,
    contenuGuides: guidesPublies,
    contenuEvenements: evenements,
    contenuAnnonces: annonces,
    contenuParcours: parcours,
    /**
     * LE TITRE DE LA CARTE EST CELUI DE L'ONGLET, EN CAPITALES — c'est la forme
     * que la maquette donne à ses intitulés de carte (« GUIDES PUBLIÉS »,
     * « MON COMPTE », « VOS RACCOURCIS »). On garde sa typographie, pas son mot.
     */
    contenuTitre: MEMBER_CONTENT_LABELS_FR[onglet].toLocaleUpperCase('fr-FR'),
    contenuVide: contenu.items.length === 0,
  };
}

function vueMembre(m: PublicProfileResponse): K02Data['membre'] {
  return {
    nom: m.displayName,
    /** Le titre de la fenêtre d'ajout aux contacts : « Ajouter Fatou aux contacts ». */
    prenom: prenomDe(m.displayName),
    initiales: initialesDe(m.displayName),
    photo: fondAvatar(m.avatarUrl),
    pseudo: `@${m.handle}`,
    niveau: rangDeNiveau(m.verificationLevel),
    phase: PHASES_FR[m.phase],
    ville: m.city?.name ?? '—',
    pays: m.country.nameFr,
    depuis: String(new Date(m.memberSince).getFullYear()),
    bio: m.bio ?? '—',
    aides: enumeration(m.helpTypes.map((h) => AIDES_FR[h])),
    entraides: m.stats?.helpValidatedCount ?? 0,
    /**
     * LES TROIS AUTRES COMPTEURS DE `stats`, que personne ne lisait. Le profil
     * affichait « 3 guides utiles · 2 parrainages · 9 événements » — les nombres
     * de la maquette — à un membre inscrit du jour.
     */
    guides: m.stats?.guideHelpfulVotes ?? 0,
    parrainages: m.stats?.mentorshipsCompleted ?? 0,
    evenements: m.stats?.eventsOrganized ?? 0,
  };
}

// ─── K03 · /compte/verification ──────────────────────────────────────────────

/**
 * Les trois pastilles de niveau.
 *
 * `GET /me/kyc` est appelée MÊME SI son résultat ne s'affiche nulle part sur cette
 * planche, et c'est délibéré : elle est la seule route qui dise si une session de
 * vérification est en cours, et sa réponse décide de l'état de N1 quand le niveau
 * seul ne suffit pas — un membre dont le KYC est `IN_REVIEW` n'est pas au même
 * point qu'un membre qui n'a rien entamé. La maquette n'ayant pas d'endroit pour
 * l'écrire (sa colonne « ÉTATS KYC » documente les quatre états côte à côte), on
 * ne lui en invente pas un ; on le dit au porteur.
 */
export async function chargerK03(): Promise<K03Data> {
  const [me, demandes] = await Promise.all([fetchMe(), compterDemandes()]);
  const rang = rangDeNiveau(me.user.verificationLevel);

  return {
    moi: bandeauDe(me, demandes),
    niveaux: {
      n0: ACQUIS,
      n1: rang >= 1 ? ACQUIS : A_FAIRE,
      n2: rang >= 2 ? ACQUIS : A_FAIRE,
    },
    /**
     * LE LIBELLÉ DU BOUTON PAR DÉFAUT. L'écran le remplace selon `me.kyc.status`
     * — voir `VerificationVivante` — mais le cadre doit pouvoir se rendre sans
     * lui, ne serait-ce que pour le squelette.
     */
    kycLibelle: 'Commencer',
  };
}

/** `me.kyc.status`, ou `null` quand aucune démarche n'a jamais été ouverte. */
export async function statutKyc(): Promise<string | null> {
  /**
   * `kyc` EST À LA RACINE DE `/me`, pas sous `user` : `meResponseSchema` le pose
   * à côté de `phones` et de `stats`. Relevé sur le schéma, pas supposé — la
   * première version lisait `me.user.kyc` et le compilateur l'a dit.
   */
  const me = await fetchMe();
  return me.kyc?.status ?? null;
}

/** L'état KYC brut, pour qui aura un endroit où l'afficher. Schéma validé à l'arrivée. */
export async function lireKyc() {
  return absent(memberApi.get('/me/kyc', kycStatusResponseSchema));
}

// ─── K04 · /compte/securite ──────────────────────────────────────────────────

/**
 * Téléphones et sessions.
 *
 * 01 §2.1, RÈGLE DURE : aucun numéro en clair. `phones[].masked` est le seul champ
 * de numéro que `meResponseSchema` décrive — il n'y a donc rien d'autre à ne pas
 * afficher, et c'est la forme la plus solide de la règle : elle ne dépend pas de
 * la vigilance de celui qui écrit cette ligne.
 *
 * ÉCART SIGNALÉ : la planche écrit « Bénin · principal » et « France ·
 * destination ». `/me` ne donne QUE `isDestination` — ni pays, ni indicatif. Le
 * sous-titre porte donc le seul rôle, et le nom du pays disparaît de l'écran. Le
 * déduire de l'indicatif du masque serait fabriquer une correspondance que
 * personne n'a envoyée.
 */
export async function chargerK04(): Promise<K04Data> {
  const [me, sessions, demandes] = await Promise.all([
    fetchMe(),
    memberApi.get('/auth/sessions', authSessionsResponseSchema),
    compterDemandes(),
  ]);

  return {
    moi: bandeauDe(me, demandes),
    telephones: me.phones.map((p) => ({
      id: p.id,
      masque: p.masked,
      role: p.isDestination ? 'destination' : 'principal',
      /**
       * LA MÊME CONDITION QUE LE SERVEUR, recopiée faute de champ — et c'est dit.
       *
       * `phones.service.ts` refuse `DELETE /me/phones/:id` avec `LAST_PHONE` quand
       * `phones.length <= 1` (01 §2.5). `meResponseSchema` n'envoie pas ce verdict,
       * donc l'écran le recalcule sur le même fait. Voir `LigneTelephone` : un
       * `canRemove` dans la réponse fermerait l'écart, et il est demandé.
       */
      retirable: me.phones.length > 1,
      dernier: me.phones.length <= 1,
    })),
    sessions: sessions.sessions.map((s) => ({
      id: s.id,
      appareil: s.deviceLabel,
      vu: depuisQuand(s.lastUsedAt),
      courante: s.isCurrent,
      /** La session courante ne se révoque pas depuis elle-même : ce serait se déconnecter. */
      revocable: !s.isCurrent,
    })),
  };
}

// ─── K05 · /compte/contacts ──────────────────────────────────────────────────

/**
 * Contacts, demandes et bloqués — quatre routes, parce que la planche montre
 * quatre cartes côte à côte et non quatre onglets.
 *
 * ÉCART SIGNALÉ : la maquette écrit « Installée · Lyon 3e » sous chaque nom — la
 * phase et la ville. `GET /me/connections` ne rend ni l'une ni l'autre : son
 * `MEMBER_SELECT` s'arrête à l'identifiant, au pseudo, au nom et à l'avatar. La
 * ligne porte donc la date de mise en relation, qui est une donnée réelle de la
 * MÊME route. Composer une phase et une ville qu'on n'a pas reçues serait pire
 * qu'un sous-titre différent.
 */
export async function chargerK05(): Promise<K05Data> {
  const [me, contacts, demandes, bloques, suggestions] = await Promise.all([
    fetchMe(),
    memberApi.get('/me/connections', myConnectionsResponseSchema),
    memberApi.get('/me/connection-requests', connectionRequestsResponseSchema),
    memberApi.get('/me/blocks', myBlocksResponseSchema),
    /**
     * LA CINQUIÈME ROUTE MANQUAIT. La planche dessine une section
     * « SUGGESTIONS » et personne ne la chargeait : elle montrait « Théo
     * Adjovi », l'exemple de la maquette, à tout le monde.
     */
    memberApi.get('/me/connection-suggestions', connectionSuggestionsResponseSchema),
  ]);

  const premierBloque = bloques.items[0];

  return {
    moi: bandeauDe(me, demandes.items.length),
    contacts: {
      total: contacts.meta.count,
      demandes: demandes.items.length,
      liste: contacts.items.map((c, rang) => ({
        fond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
        initiales: initialesDe(c.displayName),
        nom: c.displayName,
        depuis: `En contact depuis le ${jourEtMois(c.connectedAt)}`,
        origine: ORIGINES_FR[c.origin] ?? c.origin,
      })),
    },
    bloque:
      premierBloque === undefined
        ? { nom: 'Personne', date: '—' }
        : { nom: premierBloque.displayName, date: jourEtMois(premierBloque.blockedAt) },
    /**
     * LES TROIS LISTES, ENFIN COMPLÈTES. Les gestes ne sont PAS posés ici : ce
     * chargeur est une fonction pure, appelée depuis des épreuves qui n'ont ni
     * routeur ni annonces. C'est `ContactsVivants` qui les ajoute.
     */
    demandesRecues: demandes.items.map((d, rang) => ({
      fond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
      initiales: initialesDe(d.user.displayName),
      nom: d.user.displayName,
      /** La maquette écrit le message entre guillemets : on les garde. */
      message: d.message === null ? '' : `« ${d.message} »`,
      raison: '',
      date: '',
      cle: d.id,
      handle: d.user.handle,
    })),
    suggestions: suggestions.items.map((g, rang) => ({
      fond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
      initiales: initialesDe(g.user.displayName),
      nom: g.user.displayName,
      message: '',
      raison: g.reason,
      date: '',
      cle: g.refId,
      handle: g.user.handle,
      origine: g.origin,
    })),
    bloques: bloques.items.map((b, rang) => ({
      fond: FONDS_AVATAR[rang % FONDS_AVATAR.length] ?? FONDS_AVATAR[0],
      initiales: initialesDe(b.displayName),
      nom: b.displayName,
      message: '',
      raison: '',
      date: `Bloqué le ${jourEtMois(b.blockedAt)}`,
      cle: b.userId,
      handle: b.handle,
    })),
  };
}

// ─── K06 · /compte/abonnement ────────────────────────────────────────────────

/**
 * Abonnement, prix et factures.
 *
 * 14 §4.1, RÈGLE DURE : aucune donnée de carte. Les trois routes lues ici n'en
 * portent aucune, et `myPaymentsResponseSchema` en fait une preuve EXÉCUTABLE :
 * ni numéro, ni empreinte, ni quatre derniers chiffres, ni date d'expiration.
 * `method` est un KIND — le canal, pas l'instrument. Une API qui joindrait un
 * `last4` verrait sa réponse refusée à la frontière, avant l'écran.
 *
 * LES DEUX DEVISES ARRIVENT TOUJOURS ENSEMBLE, et le serveur n'en choisit pas une
 * — « le membre peut être béninois en France, ou français au Bénin ». L'écran
 * montre l'euro sur la carte Premium et le franc CFA sur la ligne Mobile Money,
 * ce que la maquette dessine.
 */
export async function chargerK06(): Promise<K06Data> {
  const [me, abonnement, plans, paiements, demandes] = await Promise.all([
    fetchMe(),
    memberApi.get('/me/subscription', mySubscriptionResponseSchema),
    memberApi.get('/plans', plansResponseSchema),
    memberApi.get('/me/payments', myPaymentsResponseSchema),
    compterDemandes(),
  ]);

  const courant = abonnement.items[0];
  const codeCourant = courant?.planCode ?? me.user.plan;
  const nomPlan = plans.items.find((p) => p.code === codeCourant)?.nameFr ?? codeCourant;
  const premium = plans.items.find((p) => p.code === 'PREMIUM');
  const contactsPro = abonnement.usage.items.find((u) => u.metric === 'PRO_CONTACTS');

  /**
   * Les jours d'essai restants, ARRONDIS AU SUPÉRIEUR. « 0 jour restant » sur un
   * essai encore actif ferait croire à un compte déjà retombé au plan gratuit.
   */
  const finEssai = abonnement.trial.active ? abonnement.trial.endsAt : null;
  const essai =
    finEssai === null
      ? 0
      : Math.max(0, Math.ceil((new Date(finEssai).getTime() - Date.now()) / 86_400_000));

  return {
    moi: bandeauDe(me, demandes),
    abonnement: {
      plan: nomPlan,
      essai,
      contactsPro:
        contactsPro === undefined
          ? '—'
          : `${contactsPro.used} / ${contactsPro.limit ?? '∞'}`,
    },
    premium: {
      prixMois: premium === undefined ? '—' : `${montant(premium.month.eur)}/mois`,
      prixXof: premium === undefined ? '—' : `${montant(premium.month.xof)}/mois`,
      /**
       * Le montant du bouton « Payer … » de la fenêtre Mobile Money, SANS période.
       *
       * Même source et même formatage que `prixXof` ; le suffixe est ce qui change,
       * et il change parce que les deux écrans ne disent pas la même chose — K06
       * annonce un tarif, le volet demande une somme.
       */
      montantXof: premium === undefined ? '—' : montant(premium.month.xof),
    },
    factures: {
      derniere: ligneFacture(paiements.items[0]),
      precedente: ligneFacture(paiements.items[1]),
    },
  };
}

/**
 * Le type d'une facture, DÉRIVÉ du schéma partagé.
 *
 * `MyPaymentsResponse['items'][number]` et non une interface écrite ici : le socle
 * l'interdit sans exception, et pour une raison qui se vérifie — une interface
 * recopiée aurait gardé `invoiceNumber: string` le jour où le schéma l'a rendu
 * nullable, et l'écran aurait affiché « null » sans que rien ne le signale.
 */
type Facture = MyPaymentsResponse['items'][number];

/** « Août 2026 · 4 € ». Absente, la ligne dit qu'il n'y a rien plutôt que « undefined ». */
function ligneFacture(facture: Facture | undefined): string {
  if (facture === undefined) return 'Aucune facture';
  const quand = facture.paidAt ?? facture.createdAt;
  return `${moisEtAnnee(quand)} · ${montant(facture.amount)}`;
}

// ─── K07 · /compte/notifications ─────────────────────────────────────────────

/**
 * Réglages de notification.
 *
 * `locked` est LU et non recalculé : la catégorie « Sécurité et compte » est
 * non désactivable par décision du serveur (`NON_DISABLEABLE_CATEGORIES`, 12 §2.1),
 * et la redécider ici ferait diverger la grille et ce que le membre reçoit
 * vraiment. Ce lot ne l'affiche pas encore — la maquette dessine ses interrupteurs
 * sans les distinguer, voir la déclaration d'écran — mais la donnée est là et
 * validée.
 */
export async function chargerK07(): Promise<K07Data> {
  const [me, prefs, demandes] = await Promise.all([
    fetchMe(),
    memberApi.get('/me/notification-preferences', notificationPreferencesResponseSchema),
    compterDemandes(),
  ]);

  /**
   * L'adresse email n'est PAS dans cette réponse : `emailAvailable` dit seulement
   * qu'une adresse vérifiée existe. Signalé au porteur — la planche l'écrit
   * (« Email · amina.d@mail.com »), et aucune route du domaine membre ne la rend.
   * Tant qu'elle manque, on écrit ce qui est vrai : il y a une adresse, ou non.
   */
  const email = prefs.emailAvailable ? 'adresse vérifiée' : 'aucune adresse';

  return {
    moi: bandeauDe(me, demandes),
    prefs: {
      email,
      calmeDebut: heureFr(prefs.quietHours?.start),
      calmeFin: heureFr(prefs.quietHours?.end),
      resume: prefs.weeklyDigest ? 'Chaque lundi par email' : 'Désactivé',
    },
    categories: prefs.categories.map((c) => ({
      titre: c.label,
      /**
       * LA SECONDE LIGNE DIT CE QUE LA PLANCHE Y MET : soit la raison du
       * verrouillage — « Non désactivable », sur « Sécurité et compte » — soit
       * rien. L'API ne rend pas de sous-titre, et en inventer un par catégorie
       * serait écrire du contenu à la place du produit. Signalé au porteur.
       */
      sous: c.push.locked && c.email.locked ? 'Non désactivable' : '',
      ...((a) => ({
        appliFond: a.fond,
        appliGauche: a.gauche,
        appliOpacite: a.opacite,
        appliActif: a.actif,
        appliVerrouille: a.verrouille,
        appliNom: a.nom,
      }))(
        /**
         * L'IN-APP EST TOUJOURS VERROUILLÉ, et c'est l'API qui le dit : « l'in-app
         * n'est pas une préférence : il est toujours là, ou jamais »
         * (`notificationPreferencesResponseSchema`). Un interrupteur qu'on
         * pourrait basculer sans que rien ne parte serait un mensonge.
         */
        dessinInterrupteur(c.label, 'dans l’application', c.inApp, true),
      ),
      ...((p) => ({
        pushFond: p.fond,
        pushGauche: p.gauche,
        pushOpacite: p.opacite,
        pushActif: p.actif,
        pushVerrouille: p.verrouille,
        pushNom: p.nom,
      }))(
        dessinInterrupteur(
          c.label,
          'par notification',
          c.push.enabled,
          c.push.locked || !c.push.available,
        ),
      ),
      ...((e) => ({
        emailFond: e.fond,
        emailGauche: e.gauche,
        emailOpacite: e.opacite,
        emailActif: e.actif,
        emailVerrouille: e.verrouille,
        emailNom: e.nom,
      }))(
        dessinInterrupteur(
          c.label,
          'par email',
          c.email.enabled,
          c.email.locked || !c.email.available,
        ),
      ),
      cle: c.category,
    })),
  };
}

/**
 * LES TROIS VALEURS DE DESSIN D'UN INTERRUPTEUR, et son nom accessible.
 *
 * La planche dessine trois états : allumé (`#16785E`, bouton à droite), éteint
 * (`#CBD5D1`, bouton à gauche) et verrouillé (allumé à `opacity: .5`, ce qu'elle
 * met sur « Non désactivable »). On ne les recalcule pas dans le cadre : il
 * dessine, il ne décide pas.
 *
 * ELLE REND UN OBJET AUX CLÉS FIXES, et non des clés calculées : une première
 * version préfixait les noms (`[`${prefixe}Fond`]`), et TypeScript en tirait un
 * index générique qui ne satisfaisait plus `CategorieNotification`. Les trois
 * canaux recomposent donc leurs noms à l'appel — c'est trois lignes de plus et
 * un type qui tient.
 */
function dessinInterrupteur(
  categorie: string,
  comment: string,
  actif: boolean,
  verrouille: boolean,
) {
  return {
    fond: actif ? '#16785E' : '#CBD5D1',
    gauche: actif ? '19px' : '3px',
    opacite: verrouille ? '.5' : '1',
    actif,
    verrouille,
    nom: `${categorie} ${comment}`,
  };
}

/** `22:00` → `22 h`, comme la maquette l'écrit. Absent → un tiret, pas « undefined h ». */
function heureFr(valeur: string | undefined): string {
  if (valeur === undefined) return '—';
  const [h, m] = valeur.split(':');
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

// ─── K08 · /compte/donnees ───────────────────────────────────────────────────

/**
 * Le bandeau seul : la planche ne dessine aucun état (voir la déclaration d'écran).
 *
 * `lireExport()` existe à côté, validée et prête : le jour où la maquette réserve
 * une ligne à l'état de l'archive, il n'y aura rien à écrire côté API.
 */
export async function chargerK08(): Promise<K08Data> {
  return { moi: await chargerBandeau() };
}

/** `GET /me/export/latest`. `404` = aucune archive jamais demandée, pas une panne. */
export async function lireExport() {
  return absent(memberApi.get('/me/export/latest', dataExportStatusResponseSchema));
}

// ─── K09 · /compte/sanctions ─────────────────────────────────────────────────

/**
 * Mes sanctions.
 *
 * `active` ET `appealable` VIENNENT DU SERVEUR. Comparer `endsAt` à l'horloge du
 * navigateur afficherait « suspendu » à un membre libre dès que sa machine est
 * décalée, et recalculer « contester une fois » (13 §4.3) demanderait de savoir si
 * une contestation a déjà été déposée — ce que seul le serveur sait.
 *
 * Aucune sanction est le cas NORMAL, et la carte de la maquette dit alors qu'il
 * n'y en a pas. Un écran vide serait plus inquiétant qu'informatif.
 */
export async function chargerK09(): Promise<K09Data> {
  const [me, sanctions, demandes] = await Promise.all([
    fetchMe(),
    memberApi.get('/me/sanctions', mySanctionsResponseSchema),
    compterDemandes(),
  ]);

  const derniere = sanctions.items[0];

  return {
    moi: bandeauDe(me, demandes),
    /**
     * L'IDENTIFIANT DE LA SANCTION, pour `POST /sanctions/:id/appeal`. `null`
     * quand il n'y en a aucune : la planche dessine la carte de contestation en
     * permanence, et l'écran doit pouvoir savoir qu'il n'y a rien à contester.
     */
    sanctionId: derniere?.id ?? null,
    sanction:
      derniere === undefined
        ? {
            type: 'Aucune sanction',
            regle: 'Aucune règle enfreinte',
            date: '—',
            etat: 'Rien à contester',
          }
        : {
            type: SANCTIONS_FR[derniere.type],
            regle: derniere.rule,
            date: jourMoisAnnee(derniere.startsAt),
            etat: derniere.appealable ? 'Contestable une fois' : 'Contestation close',
          },
  };
}

// ─── K10 · /compte/enregistres ───────────────────────────────────────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SIX TRACÉS D'ICÔNE, RELEVÉS SUR LES SIX LIGNES DE LA PLANCHE          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette ne dessine pas la même icône deux fois : elle en dessine SIX, une
 * par espèce de contenu. Le dictionnaire est donc transcrit de ses lignes, pas
 * inventé — et les six espèces qu'elle ne dessine pas (parrain, membre, réseau,
 * ville, sujet, fiche pro) reçoivent le tracé de la famille la plus proche parmi
 * celles qu'elle dessine, faute d'un septième dessin.
 */
const ICONE_LIVRE =
  'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z';
const ICONE_ETOILE = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';
const ICONE_COEUR = 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z';
const ICONE_CALENDRIER = 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4';
const ICONE_TOIT = 'M4 11 12 4l8 7v9H4z';
const ICONE_BULLE = 'M4 5h16v11H9l-5 4z';

const ICONE_PAR_TYPE: Readonly<Record<BookmarkSubjectType, string>> = {
  GUIDE: ICONE_LIVRE,
  STORY: ICONE_ETOILE,
  HELP_REQUEST: ICONE_COEUR,
  EVENT: ICONE_CALENDRIER,
  HOUSING: ICONE_TOIT,
  JOB: ICONE_TOIT,
  PRO: ICONE_TOIT,
  POST: ICONE_BULLE,
  TOPIC: ICONE_BULLE,
  MENTOR: ICONE_COEUR,
  USER: ICONE_COEUR,
  CITY: ICONE_TOIT,
};

/**
 * LES LIBELLÉS D'ÉTAT SONT CEUX DE T2 §`bookmark.state.*`, au mot près.
 *
 * `AVAILABLE` est absent de la table, et ce n'est pas un oubli : le schéma de
 * base le documente lui-même — « `AVAILABLE` n'a PAS de libellé : c'est l'absence
 * de pastille, le cas normal ». La chaîne vide éteint la pastille dans le cadre.
 */
const ETAT_ENREGISTRE: Readonly<Record<BookmarkState, string>> = {
  AVAILABLE: '',
  EXPIRED: 'Expiré, gardé pour vous',
  RESOLVED: 'Résolue',
  PAST: 'Passé',
  UNAVAILABLE: 'Plus disponible',
  UPDATED: 'Mis à jour',
  REMOVED: 'Contenu retiré',
};

/**
 * LES TROIS COUPLES DE COULEURS QUE LA PLANCHE DESSINE, et rien de plus.
 *
 *   · vert sur vert pâle — la mise à jour, la seule bonne nouvelle de la liste ;
 *   · gris foncé sur gris pâle — l'état neutre : expiré, résolu, passé, parti ;
 *   · gris clair sur gris pâle — le contenu retiré, qui s'efface aussi par
 *     `opacity: .55` sur toute la ligne.
 */
const TEINTE_ETAT: Readonly<Record<BookmarkState, { fond: string; texte: string; opacite: string }>> =
  {
    AVAILABLE: { fond: '#F2F5F4', texte: '#5D6B66', opacite: '1' },
    UPDATED: { fond: '#E3F0EB', texte: '#0F5C48', opacite: '1' },
    EXPIRED: { fond: '#F2F5F4', texte: '#5D6B66', opacite: '1' },
    RESOLVED: { fond: '#F2F5F4', texte: '#5D6B66', opacite: '1' },
    PAST: { fond: '#F2F5F4', texte: '#5D6B66', opacite: '1' },
    UNAVAILABLE: { fond: '#F2F5F4', texte: '#5D6B66', opacite: '1' },
    REMOVED: { fond: '#F2F5F4', texte: '#8A958F', opacite: '.55' },
  };

/**
 * LES ONGLETS SONT CEUX DE LA MAQUETTE, DANS SON ORDRE.
 *
 * Elle en dessine dix sur l'ordinateur — Tout, Stories, Guides, Entraide,
 * Événements, Annonces, Parrains, Membres, Réseaux, Villes — et quatre seulement
 * sur le téléphone, faute de place. La liste est UNE, et la rangée mobile
 * l'enroule (`flex-wrap`, dessiné) : couper les six derniers à 390 px laisserait
 * un membre incapable de retrouver une ville enregistrée depuis son téléphone,
 * et le porteur veut chaque correction sur les deux planches.
 *
 * « Annonces » rassemble les trois espèces de service — logement, emploi, fiche
 * pro — parce que c'est UN onglet que la maquette dessine, pas trois.
 */
const ONGLETS_ENREGISTRES: readonly {
  readonly cle: string;
  readonly libelle: string;
  readonly types: readonly BookmarkSubjectType[];
}[] = [
  { cle: '*', libelle: 'Tout', types: [] },
  { cle: 'STORY', libelle: 'Stories', types: ['STORY'] },
  { cle: 'GUIDE', libelle: 'Guides', types: ['GUIDE'] },
  { cle: 'HELP_REQUEST', libelle: 'Entraide', types: ['HELP_REQUEST'] },
  { cle: 'EVENT', libelle: 'Événements', types: ['EVENT'] },
  { cle: 'HOUSING', libelle: 'Annonces', types: ['HOUSING', 'JOB', 'PRO'] },
  { cle: 'MENTOR', libelle: 'Parrains', types: ['MENTOR'] },
  { cle: 'USER', libelle: 'Membres', types: ['USER'] },
  { cle: 'TOPIC', libelle: 'Réseaux', types: ['TOPIC'] },
  { cle: 'CITY', libelle: 'Villes', types: ['CITY'] },
];

/** Les types que porte un onglet — `'*'` les porte tous. */
export function typesDeLOnglet(cle: string): readonly BookmarkSubjectType[] {
  return ONGLETS_ENREGISTRES.find((o) => o.cle === cle)?.types ?? [];
}

/**
 * Les dix onglets, peints selon celui qui est choisi et comptés sur `meta.parType`.
 *
 * LE COMPTE VIENT DU SERVEUR, jamais de la page courante : `GET /me/bookmarks`
 * rend `meta.parType` pour toute la collection, et compter les lignes reçues
 * afficherait vingt là où le membre en a deux cents.
 */
function ongletsEnregistres(
  choisi: string,
  parType: Readonly<Record<string, number>>,
  onChoisir: (cle: string) => void,
): readonly OngletEnregistres[] {
  return ONGLETS_ENREGISTRES.map((o) => {
    const actif = o.cle === choisi;
    return {
      cle: o.cle,
      libelle: o.libelle,
      fond: actif ? '#16785E' : '#fff',
      texte: actif ? '#fff' : '#16211D',
      bord: actif ? '#16785E' : '#E6EBE9',
      actif,
      onChoisir: () => {
        onChoisir(o.cle);
      },
    };
  });
}

/**
 * K10 — « Enregistrés », et les quatre routes de §2.9 qui lui manquaient.
 *
 * Le porteur : « Finalise les routes bookmarks et branche-les. »
 *
 * ── LE FILTRE EST SERVEUR, PAS CLIENT ─────────────────────────────────────
 *
 * `bookmarksQuerySchema` porte `subjectType`, et la liste est paginée. Filtrer
 * sur les lignes déjà reçues donnerait un onglet « Villes » vide alors que la
 * ville est enregistrée, simplement parce qu'elle est page deux. Le choix part
 * donc dans la requête — et `meta.parType`, lui, porte TOUJOURS la collection
 * entière, ce qui garde les comptes d'onglets justes quel que soit le filtre.
 *
 * Un onglet qui couvre PLUSIEURS types (« Annonces » : logement, emploi, fiche
 * pro) ne peut pas tenir dans un `subjectType` unique. Il est alors demandé sans
 * filtre et trié ici — c'est le seul cas, et il est borné aux trois espèces de
 * service.
 */
export async function chargerK10(
  onglet: string = '*',
  onChoisir: (cle: string) => void = () => undefined,
): Promise<K10Data> {
  const types = typesDeLOnglet(onglet);
  const requete = types.length === 1 ? `?subjectType=${types[0] ?? ''}&limit=50` : '?limit=50';

  const [moi, enregistres] = await Promise.all([
    chargerBandeau(),
    memberApi.get(`/me/bookmarks${requete}`, bookmarksResponseSchema),
  ]);

  const retenues =
    types.length > 1 ? enregistres.items.filter((b) => types.includes(b.subjectType)) : enregistres.items;

  /**
   * LE COMPTE AFFICHÉ SUIT L'ONGLET. « 14 enregistrés » sous le titre d'un
   * onglet « Guides » qui en montre deux serait un chiffre qui ment : c'est le
   * total de l'onglet courant, pris sur `meta.parType` pour les mêmes raisons
   * que les pastilles.
   */
  const totalOnglet =
    types.length === 0
      ? enregistres.meta.total
      : types.reduce((somme, t) => somme + (enregistres.meta.parType[t] ?? 0), 0);

  return {
    moi,
    compte: `${totalOnglet} enregistré${totalOnglet > 1 ? 's' : ''}`,
    onglets: ongletsEnregistres(onglet, enregistres.meta.parType, onChoisir),
    vide: retenues.length === 0,
    lignes: retenues.map((b) => {
      const teinte = TEINTE_ETAT[b.state];
      return {
        cle: `${b.subjectType}:${b.subjectId}`,
        icone: ICONE_PAR_TYPE[b.subjectType],
        titre: b.title,
        etat: ETAT_ENREGISTRE[b.state],
        etatFond: teinte.fond,
        etatTexte: teinte.texte,
        opacite: teinte.opacite,
        depuis: `enregistré ${depuisQuand(b.createdAt)}`,
        /**
         * LE CONTENU RETIRÉ N'A PLUS D'ADRESSE. Le serveur compose `href` à
         * partir de la source, et la ligne reste dans la liste après sa
         * disparition — c'est tout le sens de l'état `REMOVED`. Un lien mort
         * vaudrait moins qu'un titre nu.
         */
        href: b.state === 'REMOVED' ? '' : (b.href ?? ''),
        /** Attaché par l'écran vivant, qui seul sait recharger après le retrait. */
        onRetirer: () => undefined,
      };
    }),
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DESSIN SANS LA DONNÉE — MON PROFIL ET L'ABONNEMENT                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré au HTML servi, détecteur du dépôt (`motsVisibles`) :
 *
 *     /compte/profil  200  5 mots  rail 0/5  « DisaporyPlus Chargement de votre compte… »
 *     /premium        200  5 mots  rail 0/5  « DisaporyPlus Chargement de votre compte… »
 *
 * ── CE QUE LA MESURE A DÉMENTI ──────────────────────────────────────────────
 *
 * `/premium` m'a été donné comme L'EXCEPTION, la route qui servirait cinq mots
 * SANS passer par la coquille partagée. C'est faux, et c'est vérifiable en trois
 * lignes : `app/(app)/premium/page.tsx` rend `AbonnementEcran`, qui appelle
 * `EcranDonnees` (`screens/compte/abonnement-ecran.tsx`, ligne 67). La cause est
 * donc EXACTEMENT la même que pour les neuf autres, et le remède aussi. Ce ne sont
 * pas neuf routes sur dix, ce sont les dix.
 *
 * `niveau: 0` et `demandes: 0` sont des nombres dans leur type : on ne peut pas y
 * mettre un tiret cadratin. Ils sont visibles le temps de l'appel, et c'est dit
 * plutôt que caché — rendre ces champs capables d'un tiret est un changement de
 * type, donc d'autres écrans. Remonté.
 */
const SOCLE_BANDEAU: Bandeau = {
  nom: '',
  initiales: '',
  /** Le squelette n'a pas de photo : le rond reprend l'aplat de la maquette. */
  photo: null,
  pseudo: '',
  niveau: 0,
  prenom: '',
  demandes: 0,
};

export const SQUELETTE_K01: K01Lecture = {
  moi: SOCLE_BANDEAU,
  competencesIds: [],
  languesIds: [],
  profil: {
    statut: '',
    ville: '',
    pays: '',
    bio: '',
    phase: '',
    competences: '',
    langues: '',
    aides: '',
  },
};

export const SQUELETTE_K06: K06Data = {
  moi: SOCLE_BANDEAU,
  abonnement: { plan: '', essai: 0, contactsPro: '' },
  premium: { prixMois: '', prixXof: '', montantXof: '' },
  factures: { derniere: '', precedente: '' },
};

/**
 * LES HUIT AUTRES ÉCRANS DU MODULE COMPTE, pour la même raison que K01 et K06.
 *
 * ── POURQUOI LES HUIT, ET PAS SEULEMENT CELLES QUI M'ÉTAIENT NOMMÉES ───────
 *
 * Parce que c'est ce qui permet de rendre `squelette` OBLIGATOIRE dans le type
 * de la coquille. Facultatif, il serait omis au prochain écran branché et la
 * coquille vide reviendrait EN SILENCE — la page répond 200, rien ne rougit, et
 * on ne s'en aperçoit qu'en ouvrant le produit. Obligatoire, `tsc` refuse
 * l'oubli. Huit écrans de plus coûtent huit objets vides ; le trou rouvert
 * coûterait un lot entier et une visite du porteur.
 *
 * LES PASTILLES DE NIVEAU gardent la forme de la maquette avec les teintes du
 * niveau NON ATTEINT (`#F2F5F4` sur `#5D6B66`) : annoncer un niveau acquis que
 * le serveur n'a pas confirmé serait pire que n'en annoncer aucun. Le libellé est
 * un tiret cadratin, pas « 0 » ni « À faire » — on ne décide pas d'un état.
 *
 * `revocable: false` et `retirable: false` : aucun contrôle destructeur n'est
 * offert sur une donnée qui n'est pas encore arrivée. C'est le seul endroit de ces
 * squelettes où un défaut mal choisi serait dangereux plutôt que faux.
 */
const NIVEAU_AU_REPOS: PastilleNiveau = { etat: '—', fond: '#F2F5F4', texte: '#5D6B66' };

export const SQUELETTE_K02: K02Data = {
  moi: SOCLE_BANDEAU,
  membre: {
    nom: '—',
    prenom: '',
    initiales: '',
    photo: null,
    pseudo: '',
    niveau: 0,
    phase: '',
    ville: '',
    pays: '',
    depuis: '',
    bio: '',
    aides: '',
    entraides: 0,
    guides: 0,
    parrainages: 0,
    evenements: 0,
  },
};

export const SQUELETTE_K03: K03Data = {
  moi: SOCLE_BANDEAU,
  niveaux: { n0: NIVEAU_AU_REPOS, n1: NIVEAU_AU_REPOS, n2: NIVEAU_AU_REPOS },
};

export const SQUELETTE_K04: K04Data = { moi: SOCLE_BANDEAU, telephones: [], sessions: [] };

export const SQUELETTE_K05: K05Data = {
  moi: SOCLE_BANDEAU,
  contacts: { total: 0, demandes: 0, liste: [] },
  demandesRecues: [],
  suggestions: [],
  bloques: [],
  bloque: { nom: '', date: '' },
};

export const SQUELETTE_K07: K07Data = {
  moi: SOCLE_BANDEAU,
  prefs: { email: '', calmeDebut: '', calmeFin: '', resume: '' },
  categories: [],
};

export const SQUELETTE_K08: K08Data = { moi: SOCLE_BANDEAU };

export const SQUELETTE_K09: K09Data = {
  moi: SOCLE_BANDEAU,
  sanction: { type: '', regle: '', date: '', etat: '' },
};

/**
 * LE SQUELETTE NE DIT PAS « RIEN D'ENREGISTRÉ ».
 *
 * `vide: false` pendant le chargement, exprès : le bloc vide affirme « Vous
 * n'avez rien enregistré », et l'afficher une demi-seconde avant la liste
 * annoncerait une absence qu'on n'a pas encore vérifiée. Les onglets, eux, sont
 * déjà là — ils ne dépendent d'aucune réponse.
 */
export const SQUELETTE_K10: K10Data = {
  moi: SOCLE_BANDEAU,
  compte: '',
  onglets: ongletsEnregistres('*', {}, () => undefined),
  lignes: [],
  vide: false,
};
