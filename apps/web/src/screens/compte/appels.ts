'use client';

import {
  authSessionsResponseSchema,
  connectionRequestsResponseSchema,
  dataExportStatusResponseSchema,
  kycStatusResponseSchema,
  myBlocksResponseSchema,
  myConnectionsResponseSchema,
  myPaymentsResponseSchema,
  mySanctionsResponseSchema,
  mySubscriptionResponseSchema,
  notificationPreferencesResponseSchema,
  plansResponseSchema,
  publicProfileResponseSchema,
  type HelpType,
  type MeResponse,
  type MyPaymentsResponse,
  type OccupationStatus,
  type Phase,
  type PublicProfileResponse,
  type SanctionType,
} from '@app/shared';
import { ApiError, fetchMe, memberApi } from '@/lib/api/index';
import type {
  Bandeau,
  K01Data,
  K02Data,
  K03Data,
  K04Data,
  K05Data,
  K06Data,
  K07Data,
  K08Data,
  K09Data,
  K10Data,
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
 * Les cinq types d'aide de `HelpType` (01 §2.7).
 *
 * `PAPERWORK` est le libellé de `T2 §help.type.paperwork` (« Démarches ») et `JOB`
 * celui de `01` (« Relecture CV »). ÉCART SIGNALÉ : `HOUSING`, `WELCOME` et
 * `OTHER` n'ont de libellé NI dans les maquettes NI dans `T2` — la table
 * `help.type.*` de T2 nomme l'autre énumération, celle du module Entraide
 * (`HelpType2` : service, trajet, matériel). Les trois mots ci-dessous sont donc
 * à faire valider par le porteur ; ils n'ont pas de source.
 */
const AIDES_FR: Record<HelpType, string> = {
  PAPERWORK: 'Démarches',
  JOB: 'Relecture CV',
  HOUSING: 'Logement',
  WELCOME: 'Accueil',
  OTHER: 'Autre',
};

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
export async function chargerK01(): Promise<K01Data> {
  const me = await fetchMe();
  const [profil, demandes] = await Promise.all([
    memberApi.get(`/users/${encodeURIComponent(me.user.handle)}`, publicProfileResponseSchema),
    compterDemandes(),
  ]);

  return {
    moi: bandeauDe(me, demandes),
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
export async function chargerK02(pseudo: string): Promise<K02Data> {
  const [me, membre, demandes] = await Promise.all([
    fetchMe(),
    memberApi.get(`/users/${encodeURIComponent(pseudo)}`, publicProfileResponseSchema),
    compterDemandes(),
  ]);

  return { moi: bandeauDe(me, demandes), membre: vueMembre(membre) };
}

function vueMembre(m: PublicProfileResponse): K02Data['membre'] {
  return {
    nom: m.displayName,
    /** Le titre de la fenêtre d'ajout aux contacts : « Ajouter Fatou aux contacts ». */
    prenom: prenomDe(m.displayName),
    initiales: initialesDe(m.displayName),
    pseudo: `@${m.handle}`,
    niveau: rangDeNiveau(m.verificationLevel),
    phase: PHASES_FR[m.phase],
    ville: m.city?.name ?? '—',
    pays: m.country.nameFr,
    depuis: String(new Date(m.memberSince).getFullYear()),
    bio: m.bio ?? '—',
    aides: enumeration(m.helpTypes.map((h) => AIDES_FR[h])),
    entraides: m.stats?.helpValidatedCount ?? 0,
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
  };
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
  const [me, contacts, demandes, bloques] = await Promise.all([
    fetchMe(),
    memberApi.get('/me/connections', myConnectionsResponseSchema),
    memberApi.get('/me/connection-requests', connectionRequestsResponseSchema),
    memberApi.get('/me/blocks', myBlocksResponseSchema),
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
 * Le bandeau seul, et AUCUNE ROUTE N'EXISTE pour le reste.
 *
 * `apps/api/src/modules/bookmarks/` ne contient qu'un `bookmarks.service.ts` : ni
 * contrôleur, ni `GET /me/bookmarks`, et le mot n'apparaît dans aucun
 * `*.controller.ts` du dépôt. Les six lignes de la planche attendent une route qui
 * n'est pas écrite. Signalé au porteur ; on ne lui fabrique pas une source.
 */
export async function chargerK10(): Promise<K10Data> {
  return { moi: await chargerBandeau() };
}
