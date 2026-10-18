'use client';

/**
 * CE QUE LES VINGT-HUIT CADRES DE J01 ET J05 À J11 AFFICHENT, ET D'OÙ IL VIENT.
 *
 * ── LA RÉPARTITION, QUI EST LA MOITIÉ DU CONTRAT ────────────────────────────
 *
 * `api.ts` appelle et valide : ce qui en sort est ce que l'API a dit, passé par un
 * schéma de `@app/shared`. Ce fichier-ci CONVERTIT cette charge en les prises que
 * la clé `donnees` de `tools/screens/04-parcours.mjs` a déclarées. Il ne dessine
 * rien, il ne décide d'aucune autorisation, et il n'appelle rien d'autre que
 * `api.ts`.
 *
 * C'est la même séparation que `screens/compte/appels.ts`, et elle converge vers
 * elle plutôt que d'en inventer une seconde.
 *
 * ── CE QUI EST COMPOSÉ ICI, ET AVEC QUELS MOTS ──────────────────────────────
 *
 * Plusieurs prises attendent une PHRASE là où l'API donne des champs : « Étape 6 ·
 * Caution bancaire et AVI franchie », « vous et 3 invités », « dans 9 jours ». Les
 * mots de liaison sont ceux de la maquette, recopiés — « franchie », « invités »,
 * « dans ». Rien n'est inventé : quand la maquette n'écrit pas le mot qu'il
 * faudrait, c'est dit en commentaire, à l'endroit, et remonté dans le rapport de
 * lot.
 *
 * ── CE QUI N'EST PAS ICI ────────────────────────────────────────────────────
 *
 * AUCUN SCHÉMA : ils vivent dans `@app/shared` (00 §4). AUCUNE DÉCISION SUR LE
 * NIVEAU DE VÉRIFICATION : on tente, et le serveur répond `403 LEVEL_REQUIRED`
 * avec de quoi afficher l'invitation de §7.3. AUCUNE GESTION DE JETON : le socle
 * la porte, rafraîchit une fois et rejoue — et ne rejoue JAMAIS un `429`.
 */

import {
  CHECKLIST_NOTICE,
  JOURNEY_FREE_ACTIVE_LIMIT,
  type JourneyActivity,
  type JourneyFullResponse,
  type JourneyListItem,
  type JourneyStep,
  type JourneyTeamMember,
  type PublicJourney,
} from '@app/shared';
import { fetchMe } from '@/lib/api/index';
import {
  getPublicJourney,
  listJourneyActivities,
  listJourneyTemplates,
  listJourneys,
  listPublicJourneys,
  readJourney,
} from './api';
import type {
  CarteParcours,
  ChoixParcours,
  DocumentAffiche,
  EnteteParcours,
  EntreeJournal,
  EtapeAffichee,
  EtapeFrise,
  FichePublique,
  GroupeEtape,
  J01DData,
  J01Data,
  J01EAboutiData,
  J01EVideData,
  J02Data,
  J01MData,
  J01SData,
  J05Data,
  J06Data,
  J07Data,
  J08ArretData,
  J08Data,
  J09Data,
  J09FicheData,
  J10Data,
  J11Data,
  MembreAffiche,
  ModeleAffiche,
  PanneauParcours,
  ParcoursData,
  ParcoursPublicAffiche,
  SegmentPublic,
} from './data';

// ── Les teintes, toutes relevées sur la maquette ────────────────────────────
//
// Aucune n'est assombrie, et aucune n'est choisie ici : ce sont celles que
// `04 Parcours.dc.html` dessine. Le troisième contrôle du générateur refuserait un
// hexadécimal retouché — la règle « ne pas assombrir » est exécutable.

/** Les cinq fonds d'avatar que la maquette emploie, dans son ordre. */
const AVATARS = ['#B4581F', '#16785E', '#0F5C48', '#2FA37D', '#E0733A'] as const;

const TEINTE_AVANCE = '#E0733A';
const TEINTE_PAUSE = '#CBD5D1';
const TEINTE_ABOUTI = '#16785E';
const TEINTE_FUTUR = '#E6EBE9';

/**
 * Le fond d'avatar d'un membre, STABLE pour un même membre.
 *
 * L'API ne rend AUCUNE couleur d'avatar — `avatarAsset` est une image ou `null`.
 * La maquette, elle, en dessine cinq. Tirer au hasard ferait changer la couleur
 * d'Aïcha à chaque rendu ; prendre toujours la première les rendrait tous
 * identiques. On dérive donc de son handle, ce qui est reproductible et ne dépend
 * d'aucun état.
 */
function fondAvatar(cle: string): string {
  let somme = 0;
  for (let i = 0; i < cle.length; i += 1) somme = (somme * 31 + cle.charCodeAt(i)) % 100_000;
  return AVATARS[somme % AVATARS.length] as string;
}

/**
 * Les initiales de l'avatar de repli, dérivées du nom affiché.
 *
 * `displayName` peut valoir `""` sur un compte qui n'a pas rempli son profil — la
 * charge relevée en porte un. On retombe alors sur le handle, qui est toujours là.
 */
function initiales(nom: string, repli: string): string {
  const source = nom.trim() === '' ? repli : nom.trim();
  const mots = source.split(/[\s.·-]+/u).filter((m) => m !== '');
  const deux = mots.slice(0, 2).map((m) => m[0] ?? '');
  return deux.join('').toUpperCase();
}

/** Le prénom : le premier mot du nom affiché. Repli sur le handle. */
function prenom(nom: string, repli: string): string {
  const source = nom.trim() === '' ? repli : nom.trim();
  return source.split(/\s+/u)[0] ?? source;
}

const nomAffiche = (nom: string | null, handle: string): string =>
  nom === null || nom.trim() === '' ? handle : nom;

// ── Les types de parcours, nommés comme la maquette les nomme ───────────────

/**
 * Le libellé COURT d'un type de parcours, par son CODE.
 *
 * La maquette écrit « PARCOURS ÉTUDES », « PARCOURS FAMILLE », « Travail · Lyon »,
 * « Régulariser · depuis le 3 mars ». Ce sont ces mots-là, repris de ses propres
 * planches, et indexés par `journey_templates.code` — jamais par l'identifiant,
 * qui est propre à une base.
 *
 * Un code inconnu retombe sur `template.nameFr`, c'est-à-dire sur ce que l'API
 * dit. Un nouveau modèle s'affichera donc avec son nom complet plutôt que de ne
 * rien afficher.
 */
export const TYPE_COURT: Record<string, string> = {
  STUDIES: 'Études',
  WORK: 'Travail',
  FAMILY: 'Famille',
  SETTLEMENT: 'Régulariser',
};

export const typeCourt = (code: string, nameFr: string): string => TYPE_COURT[code] ?? nameFr;

// ── Dates et durées ────────────────────────────────────────────────────────
//
// `fr-FR` partout, et aucune heure : les planches de ce module n'écrivent que des
// jours (« 12 septembre 2026 », « 15 octobre », « dans 9 jours »).

const JOUR_MS = 86_400_000;

export const dateComplete = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const jourEtMois = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** Jours entiers entre maintenant et `iso`. Positif = à venir. */
export function joursJusqua(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / JOUR_MS);
}

/**
 * L'échéance telle que la maquette l'écrit : « dans 9 jours ».
 *
 * `null` arrive souvent — une étape sans échéance est le cas NORMAL sur un
 * parcours neuf, et la charge relevée le montre (`nextDueDate: null` sur un
 * parcours tout juste créé). « sans échéance » n'est pas un mot de la maquette :
 * elle ne dessine aucune planche sans échéance. C'est donc un TEXTE AJOUTÉ, et il
 * est signalé comme tel plutôt que glissé.
 */
export function echeance(iso: string | null): string {
  if (iso === null) return 'sans échéance';
  const jours = joursJusqua(iso);
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return 'demain';
  if (jours > 1) return `dans ${jours} jours`;
  if (jours === -1) return 'hier';
  return `il y a ${-jours} jours`;
}

/**
 * Une durée en jours, dans les unités de la maquette : « 3 mois », « 4 sem. ».
 *
 * Les seuils suivent ce qu'elle écrit : elle emploie les semaines jusqu'à deux
 * mois environ (« 5 sem. ») et les mois au-delà (« 3 mois »). `durationDays: 0` —
 * une étape franchie le jour même, ce que la charge relevée contient — devient
 * « le jour même » : « 0 j » se lirait comme une donnée manquante.
 */
export function duree(jours: number | null): string {
  if (jours === null) return '';
  if (jours === 0) return 'le jour même';
  if (jours < 14) return `${jours} j`;
  if (jours < 70) return `${Math.round(jours / 7)} sem.`;
  return `${Math.round(jours / 30)} mois`;
}

/** La durée totale d'un parcours, entre sa première étape et son aboutissement. */
export function dureeTotale(debut: string | null, fin: string | null): string {
  if (debut === null || fin === null) return '';
  const jours = Math.max(0, Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / JOUR_MS));
  return duree(jours === 0 ? 1 : jours);
}

/** « hier », « il y a 2 j », « il y a 3 sem. », « 14 février » — mots de la maquette. */
export function ilYA(iso: string): string {
  const jours = -joursJusqua(iso);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  if (jours < 7) return `il y a ${jours} j`;
  if (jours < 35) return `il y a ${Math.round(jours / 7)} sem.`;
  if (jours < 365) return `il y a ${Math.round(jours / 30)} mois`;
  return jourEtMois(iso);
}

// ── Les états, avec le vocabulaire du dossier ──────────────────────────────

/**
 * L'état d'une étape, EN CAPITALES comme la pastille de la maquette.
 *
 * §3.2, RÈGLE DURE : « aucun état d'échec ». Les quatre valeurs de
 * `JourneyStepStatus` n'en portent aucun, et le vocabulaire choisi ici ne l'ajoute
 * pas : une étape se met en PAUSE, elle n'échoue pas. « EN COURS » et
 * « FRANCHIE » sont les mots de la maquette ; « À FAIRE » et « EN PAUSE » sont
 * composés de ses propres mots (« En pause » sur J11, « À faire » sur K03).
 */
export const ETAT_ETAPE: Record<string, string> = {
  TODO: 'À FAIRE',
  IN_PROGRESS: 'EN COURS',
  DONE: 'FRANCHIE',
  PAUSED: 'EN PAUSE',
};

/** La visibilité, telle que l'en-tête de J01 l'écrit : « PRIVÉ ». */
export const VISIBILITE: Record<string, string> = {
  PRIVATE: 'PRIVÉ',
  SHARED: 'PARTAGÉ',
  PUBLIC: 'PUBLIC',
};

/**
 * Le titre du bloc « VISIBILITÉ » : « Projet privé ».
 *
 * La maquette n'écrit que la variante PRIVÉE. Les deux autres sont composées de
 * SES mots — « Projet » de J01, « Partagé » et « Public » des options de J08 — et
 * c'est le seul endroit de ce fichier où un libellé d'affichage est assemblé
 * plutôt que recopié. Signalé.
 */
export const VISIBILITE_TITRE: Record<string, string> = {
  PRIVATE: 'Projet privé',
  SHARED: 'Projet partagé',
  PUBLIC: 'Projet public',
};

// ── Le panneau de gauche, commun à dix planches ────────────────────────────

/** L'étape que le serveur déclare en cours, ou la première non franchie. */
function etapeCourante(parcours: JourneyFullResponse): JourneyStep | undefined {
  const parId = parcours.steps.find((s) => s.id === parcours.journey.currentStepId);
  if (parId !== undefined) return parId;
  return parcours.steps.find((s) => s.status !== 'DONE');
}

function panneauDe(parcours: JourneyFullResponse): PanneauParcours {
  const etape = etapeCourante(parcours);
  return {
    titre: parcours.journey.title,
    type: typeCourt(parcours.journey.template.code, parcours.journey.template.nameFr).toUpperCase(),
    typeNom: typeCourt(parcours.journey.template.code, parcours.journey.template.nameFr),
    avancement: Math.round(parcours.journey.progressPct),
    rang: etape?.position ?? parcours.journey.totalCount,
    etape: etape?.title ?? '',
    echeance: parcours.journey.nextDueDate === null ? 'non fixée' : echeance(parcours.journey.nextDueDate),
    /**
     * §3.4 — l'équipe COMPTE le propriétaire : la maquette écrit « Équipe 3 » à
     * côté d'une liste de quatre lignes dont la première est « Amina (vous) ».
     * `members` ne contient PAS le propriétaire (mesuré sur la charge relevée),
     * donc c'est bien `members.length` qui vaut le compteur de la maquette.
     */
    equipe: parcours.members.length,
  };
}

/**
 * LE PANNEAU QUAND IL N'Y A AUCUN PARCOURS À MONTRER.
 *
 * Dix planches d'ordinateur dessinent cette carte, et une page comme « Parcours
 * publics » s'ouvre très bien sans qu'on ait de parcours. La maquette ne dessine
 * pas cet état-là du panneau — elle suppose toujours un parcours en cours. On ne
 * lui invente pas une planche ; on remplit la prise avec du VIDE, ce qui laisse la
 * carte dessinée et ses valeurs absentes, et c'est préférable à un nom de parcours
 * emprunté à quelqu'un d'autre. Signalé.
 */
const PANNEAU_VIDE: PanneauParcours = {
  /**
   * ─── LE TIRET CADRATIN, ET CE QUE LA CHAÎNE VIDE COÛTAIT ──────────────────
   *
   * `titre: ''` a été mesuré FAUTIF par axe-core, en `serious` : sur J01S la
   * maquette dessine le fil d'Ariane en `<a href="#">{panneau.titre}</a>`, donc un
   * titre vide fait UN LIEN SANS AUCUN NOM ACCESSIBLE (`link-name` — « Links must
   * have discernible text »). Un lecteur d'écran l'annonce par son URL, ici « # ».
   *
   * Le défaut est ANCIEN, et il était INVISIBLE : `e2e/a11y.spec.ts` auditait
   * `/parcours/1/etapes/7` sans attendre le cadre, donc axe mesurait l'état
   * d'attente — « Chargement de votre parcours… » — et annonçait zéro violation en
   * ne regardant rien. Le verdict vert dépendait d'une course, pas de la page.
   * Rendre le cadre tout de suite a mis la violation sous les yeux.
   *
   * Le tiret cadratin donne un nom au lien sans inventer de titre de parcours — et
   * surtout sans en emprunter un à quelqu'un d'autre, ce que l'en-tête ci-dessus
   * refusait déjà. CE QU'IL NE RÉPARE PAS, et qui est remonté : ce fil d'Ariane
   * reste un `href="#"`, c'est-à-dire un lien mort. Sa destination est
   * `/parcours/:id`, elle dépend du segment de route, et `markLinks` refuse
   * explicitement une « action » sur une balise `<a>` déjà écrite par la maquette.
   */
  titre: '—',
  type: '',
  typeNom: '',
  avancement: 0,
  rang: 0,
  etape: '',
  echeance: 'sans échéance',
  equipe: 0,
};

function enteteDe(parcours: JourneyFullResponse): EnteteParcours {
  const j = parcours.journey;
  const premiere = parcours.steps.find((s) => s.startedAt !== null)?.startedAt ?? null;
  return {
    visibilite: VISIBILITE[j.visibility] ?? j.visibility,
    visibiliteTitre: VISIBILITE_TITRE[j.visibility] ?? j.visibility,
    /**
     * LA MAQUETTE ÉCRIT « Cotonou → Lyon », DONC UNE VILLE DE DÉPART.
     *
     * `GET /journeys/:id` rend `originCountry` — le PAYS — et aucune route du
     * parcours ne porte la ville d'origine. On affiche donc le pays, qui est ce
     * que le serveur sait. Écart remonté au porteur, pas contourné en devinant.
     */
    origine: j.originCountry.nameFr,
    destination: j.destinationCity.name,
    depart: j.targetArrivalDate === null ? 'non fixée' : dateComplete(j.targetArrivalDate),
    franchies: j.doneCount,
    total: j.totalCount,
    duree: dureeTotale(premiere, j.completedAt),
    aboutiLe: j.completedAt === null ? '' : dateComplete(j.completedAt),
    version: j.templateVersion,
    aides: j.helpReceivedCount ?? 0,
  };
}

function etapeAfficheeDe(parcours: JourneyFullResponse, etapeId?: string): EtapeAffichee {
  const choisie =
    (etapeId === undefined ? undefined : parcours.steps.find((s) => s.id === etapeId)) ??
    etapeCourante(parcours);
  const checklist = choisie?.checklist ?? [];
  return {
    rang: choisie?.position ?? 0,
    titre: choisie?.title ?? '',
    etat: choisie === undefined ? '' : (ETAT_ETAPE[choisie.status] ?? choisie.status),
    echeance: echeance(choisie?.dueDate ?? null),
    description: choisie?.description ?? '',
    cochees: checklist.filter((d) => d.isChecked).length,
    actions: checklist.length,
  };
}

// ── L'équipe (§3.4) ────────────────────────────────────────────────────────

/**
 * LES RÔLES, ET L'ÉCART QUE LA MAQUETTE CREUSE.
 *
 * Elle dessine QUATRE pastilles — Propriétaire, Parraine, Accompagnant,
 * Observatrice. `JourneyMemberRole` n'en connaît que DEUX, `SUPPORTER` et
 * `OBSERVER` ; le propriétaire n'est pas un membre (il n'est pas dans `members`,
 * mesuré) ; et « parrain » est un rôle du PARRAINAGE, que les routes de parcours
 * ne portent pas. La pastille orange « Parraine » n'a donc AUCUNE donnée qui la
 * déclenche — elle reste dessinée dans le `noeud` et n'est jamais choisie.
 * Signalé au porteur.
 *
 * Les six couleurs sont celles de la maquette, relevées sur ses planches.
 */
const ROLE_PROPRIETAIRE = { role: 'Propriétaire', badgeFond: '#0F5C48', badgeTexte: '#fff' };
const ROLE_ACCOMPAGNANT = { role: 'Accompagnant', badgeFond: '#E3F0EB', badgeTexte: '#0F5C48' };
const ROLE_OBSERVATEUR = { role: 'Observateur', badgeFond: '#F2F5F4', badgeTexte: '#5D6B66' };

function equipeDe(parcours: JourneyFullResponse): readonly MembreAffiche[] {
  const proprietaire = parcours.journey.owner;
  const nomProprietaire = nomAffiche(proprietaire.displayName, proprietaire.handle);

  const lignes: MembreAffiche[] = [
    {
      fond: fondAvatar(proprietaire.handle),
      initiales: initiales(nomProprietaire, proprietaire.handle),
      // « (vous) » est le mot de la maquette, et il est juste : cette route ne
      // rend l'équipe qu'à quelqu'un qui en fait partie, et `viewerRole` dit
      // lequel. On ne le pose donc que pour le propriétaire QUI REGARDE.
      nom:
        parcours.viewerRole === 'OWNER' ? `${nomProprietaire} (vous)` : nomProprietaire,
      depuis: '',
      ...ROLE_PROPRIETAIRE,
      menu: false,
      // On ne se retire pas de son propre parcours : la maquette ne dessine
      // d'ailleurs aucun contrôle à droite de cette ligne.
      retirable: false,
      premiere: true,
      suivante: false,
    },
  ];

  for (const membre of parcours.members) {
    const nom = nomAffiche(membre.user.displayName, membre.user.handle);
    const role = membre.role === 'SUPPORTER' ? ROLE_ACCOMPAGNANT : ROLE_OBSERVATEUR;
    lignes.push({
      fond: fondAvatar(membre.user.handle),
      initiales: initiales(nom, membre.user.handle),
      nom,
      depuis: depuisDe(membre),
      ...role,
      /**
       * Le menu « … » n'est dessiné qu'une fois dans la maquette, sur la ligne de
       * l'accompagnant déjà accepté. Le bouton « Retirer » l'est sur les deux
       * lignes suivantes. On garde cette répartition : un accompagnant ACTIF a un
       * menu, les autres un retrait direct.
       */
      menu: membre.status === 'ACTIVE' && membre.role === 'SUPPORTER',
      retirable: !(membre.status === 'ACTIVE' && membre.role === 'SUPPORTER'),
      premiere: false,
      suivante: true,
    });
  }

  return lignes;
}

/** « depuis le 14 février », ou « invité » tant que l'invitation n'est pas acceptée. */
function depuisDe(membre: JourneyTeamMember): string {
  if (membre.acceptedAt === null) return 'invitation en attente';
  return `depuis le ${jourEtMois(membre.acceptedAt)}`;
}

// ── La frise des étapes franchies ──────────────────────────────────────────

const friseDe = (parcours: JourneyFullResponse): readonly EtapeFrise[] =>
  parcours.steps
    .filter((s) => s.status === 'DONE')
    .map((s) => ({ titre: s.title, duree: duree(s.durationDays) }));

/* ══════════════════════════════════════════════════════════════════════════════
 * UN SEGMENT QUI N'EST PAS UN IDENTIFIANT LAISSE L'ÉCRAN INERTE.
 *
 * `/parcours/1/etapes/7` est une URL LÉGITIME de ce dépôt : c'est celle des
 * planches d'illustration, et des tests de forme s'en servent — la maquette ne
 * dessine qu'un parcours, et inventer des identifiants serait inventer de la
 * donnée.
 *
 * Prendre « 1 » pour un parcours ferait partir `GET /journeys/1`, que le serveur
 * refuse en `400 VALIDATION_FAILED` : le membre verrait une bannière d'erreur pour
 * avoir ouvert une planche de démonstration. On EXIGE donc la forme d'un
 * identifiant, et un segment qui n'en est pas un rend la VUE NEUTRE — l'écran
 * s'affiche, ses données sont vides, et AUCUN APPEL NE PART. C'est exactement ce
 * qu'on veut d'une illustration, et c'est le même garde que `useContexteParcours`
 * applique déjà aux gestes de J03 et J04.
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Un identifiant de la base : UUID, y compris les UUIDv7 que ce projet émet. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const estIdentifiant = (segment: string): boolean => UUID.test(segment);

const ENTETE_VIDE: EnteteParcours = {
  visibilite: '',
  visibiliteTitre: '',
  origine: '',
  destination: '',
  depart: '',
  franchies: 0,
  total: 0,
  duree: '',
  aboutiLe: '',
  aides: 0,
  version: 0,
};

const ETAPE_VIDE: EtapeAffichee = {
  rang: 0,
  titre: '',
  etat: '',
  echeance: 'sans échéance',
  description: '',
  cochees: 0,
  actions: 0,
};

const MEMBRE_VIDE: FichePublique = {
  prenom: '',
  nom: '',
  initiales: '',
  type: '',
  ville: '',
  pourcent: '0%',
  enCours: '',
};

/**
 * LA VUE NEUTRE — un sur-ensemble de toutes les prises du module.
 *
 * Un seul objet plutôt qu'un par écran, et c'est voulu : chaque chargeur en rend
 * la part que son type déclare, et TypeScript accepte le sur-ensemble parce que
 * c'est une VARIABLE et non un littéral frais. Un neutre par écran aurait dû être
 * tenu à jour quinze fois.
 *
 * `bandeau` vaut `CHECKLIST_NOTICE` de `@app/shared` — la MÊME phrase que le
 * serveur sert dans `meta.checklistNotice`. La règle dure de §3.3 reste donc
 * affichée même sur une planche d'illustration, ce qui est le cas où l'oublier
 * serait le plus facile.
 *
 * ─── ELLE EST EXPORTÉE, ET C'EST CE QUI RÈGLE LE RENDU SERVEUR ──────────────
 *
 * Mesuré au HTML servi, sans JavaScript : `/parcours` rendait « DisaporyPlus ·
 * Chargement de votre parcours… » et RIEN d'autre — pas de rail, pas de panneau,
 * pas de barre basse. Le cadre n'atteignait jamais le navigateur parce que la
 * branche d'attente le remplaçait.
 *
 * Cet objet est exactement ce qu'il fallait : le DESSIN sans la donnée. Il servait
 * déjà aux planches d'illustration (`/parcours/1`, où le segment n'est pas un
 * UUID) ; il sert maintenant de `squelette` à la coquille, qui rend donc le cadre
 * TOUT DE SUITE et ne pose qu'une bande pendant l'attente. Rien n'a été inventé
 * pour cela — c'est le même neutre, déjà écrit, déjà relu.
 */
export const VUE_NEUTRE = {
  panneau: PANNEAU_VIDE,
  parcours: ENTETE_VIDE,
  etape: ETAPE_VIDE,
  equipe: [] as readonly MembreAffiche[],
  frise: [] as readonly EtapeFrise[],
  modeles: [] as readonly ModeleAffiche[],
  mesParcours: [] as readonly ChoixParcours[],
  total: 0,
  bandeau: CHECKLIST_NOTICE,
  documents: [] as readonly DocumentAffiche[],
  autresEtapes: [] as readonly GroupeEtape[],
  journal: [] as readonly EntreeJournal[],
  publics: [] as readonly ParcoursPublicAffiche[],
  compte: 0,
  filtre: { type: '', ville: '' },
  membre: MEMBRE_VIDE,
  franchies: [] as readonly EtapeFrise[],
  actifs: [] as readonly CarteParcours[],
  aboutis: [] as readonly CarteParcours[],
  plan: { actifs: 0, limite: JOURNEY_FREE_ACTIVE_LIMIT, gratuit: true },
  gratuit: true,
};

// ══════════════════════════════════════════════════════════════════════════════
// LES CHARGEURS, UN PAR ÉCRAN
//
// Chacun est une fonction de MODULE, donc une référence STABLE : `useDonnees` a
// `charger` dans ses dépendances, et une fonction anonyme y bouclerait. Les
// chargeurs qui dépendent d'un paramètre de route sont mémoïsés par leur page.
// ══════════════════════════════════════════════════════════════════════════════

/** J01 · `/parcours/:id`. */
export async function chargerJ01(journeyId: string): Promise<Omit<J01Data, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const parcours = await readJourney(journeyId);
  return {
    panneau: panneauDe(parcours),
    parcours: enteteDe(parcours),
    etape: etapeAfficheeDe(parcours),
    equipe: equipeDe(parcours),
    frise: friseDe(parcours),
  };
}

/**
 * J01 ET SES CINQ ÉTATS — un seul chargeur, parce qu'un `dataType` vaut par ÉCRAN.
 *
 * Les cinq planches de `/parcours/:id` n'attendent pas la même prise : J01 veut
 * l'équipe et la frise, J01E « aucun parcours » veut les TYPES de parcours, J01M
 * veut la liste de MES parcours. Le générateur, lui, attache un `dataType` par
 * ÉCRAN et non par cadre — une seule forme doit donc satisfaire les cinq.
 *
 * ON N'APPELLE QUE CE QUE L'ÉTAT DEMANDE, et c'est tout l'intérêt de ne pas avoir
 * tout fusionné en un seul appel :
 *
 *   · `vide`     — `GET /journey-templates` SEULEMENT. Il n'y a pas de parcours à
 *                  lire, et en demander un sur un identifiant d'illustration
 *                  donnerait un `400` ;
 *   · `parcours` — le parcours ET `GET /journeys`, parce que le sélecteur montre
 *                  tous mes parcours ;
 *   · le reste   — le parcours seul.
 *
 * Un segment qui n'est pas un UUID rend la VUE NEUTRE sans aucun appel.
 */
export async function chargerEcranParcours(
  journeyId: string,
  etat: 'normal' | 'vide' | 'abouti' | 'parcours' | 'edition',
): Promise<Omit<J01Data & J01EVideData & J01EAboutiData & J01MData, keyof ParcoursData>> {
  if (etat === 'vide') return { ...VUE_NEUTRE, ...(await chargerJ01EVide()) };
  if (!UUID.test(journeyId)) return VUE_NEUTRE;

  const parcours = await readJourney(journeyId);
  const base = {
    ...VUE_NEUTRE,
    panneau: panneauDe(parcours),
    parcours: enteteDe(parcours),
    etape: etapeAfficheeDe(parcours),
    equipe: equipeDe(parcours),
    frise: friseDe(parcours),
  };
  if (etat !== 'parcours') return base;

  const liste = await listJourneys();
  return {
    ...base,
    total: liste.items.length,
    mesParcours: liste.items.map((item) => choixDe(item, journeyId)),
  };
}

/** J01S · `/parcours/:id/etapes/:etape`. L'étape de l'URL, ou celle du serveur. */
export async function chargerJ01S(
  journeyId: string,
  etapeId?: string,
): Promise<Omit<J01SData, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const parcours = await readJourney(journeyId);
  return {
    panneau: panneauDe(parcours),
    parcours: enteteDe(parcours),
    etape: etapeAfficheeDe(parcours, etapeId),
  };
}

/** J01D · `/parcours/:id/discussion` — le CADRE, pas les messages. */
export async function chargerJ01D(
  journeyId: string,
): Promise<Omit<J01DData, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  return { panneau: panneauDe(await readJourney(journeyId)) };
}

/** J01E, état « un parcours abouti ». */
export async function chargerJ01EAbouti(
  journeyId: string,
): Promise<Omit<J01EAboutiData, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const parcours = await readJourney(journeyId);
  return { panneau: panneauDe(parcours), parcours: enteteDe(parcours), frise: friseDe(parcours) };
}

/**
 * J01E, état « aucun parcours » — les types proposés (§2.1).
 *
 * `etapes` vient de `version.stepCount`, et de nulle part ailleurs : la maquette
 * écrit « Étudier · 12 étapes », l'API répond 15 pour `STUDIES` version 3.
 * Recopier le nombre de la maquette afficherait un engagement faux au moment
 * précis où le membre choisit son parcours.
 */
export async function chargerJ01EVide(): Promise<Omit<J01EVideData, keyof ParcoursData>> {
  const { items } = await listJourneyTemplates();
  const modeles: ModeleAffiche[] = items.map((m) => ({
    nom: m.nameFr,
    etapes: m.version.stepCount,
    phrase: m.description ?? '',
  }));
  return { modeles };
}

/**
 * J02 · `/parcours/nouveau` — les types proposés, et mon parcours actif.
 *
 * DEUX APPELS, et chacun sert un cadre différent : `GET /journey-templates` pour
 * les trois planches qui proposent les types, `GET /journeys` + `GET /journeys/:id`
 * pour le panneau du cadre d'ordinateur, qui a besoin du RANG de l'étape en cours
 * que la liste ne porte pas. C'est le même couple d'appels que `chargerJ09` et
 * `chargerJ11` font déjà, et pour la même raison.
 *
 * `etapes` vient de `version.stepCount`, jamais de la maquette — voir
 * `chargerJ01EVide` juste au-dessus, et le commentaire de
 * `journeyTemplateVersionSchema` dans `@app/shared`, qui mesure l'écart : 12 dans
 * la maquette, 15 dans l'API.
 *
 * ── `choisi` EST L'ÉTAT DE LA MAQUETTE, ET RIEN DE PLUS ────────────────────
 *
 * La planche de 390 px teinte sa PREMIÈRE carte, lui met une bordure de 2 px et
 * une coche. Ce n'est pas une donnée du serveur : c'est le choix en cours, et
 * aucune carte de J02 n'est cliquable — la maquette les dessine en `<div>`, donc
 * le générateur n'y pose aucun `onClick`, et ce lot n'ajoute pas l'interaction.
 *
 * On reproduit donc EXACTEMENT ce que la planche montre — la première proposition
 * présélectionnée — sans rien affirmer de plus. Ce que la liaison change, dit
 * franchement : c'est désormais le premier modèle QUE L'API ENVOIE qui est
 * présélectionné, et son ordre est celui que `GET /journey-templates` décide pour
 * le pays du membre (§2.1). Le jour où une carte devient cliquable, c'est ce champ
 * qui suivra le clic, et aucun pixel du cadre n'aura à bouger.
 */
export async function chargerJ02(): Promise<Omit<J02Data, keyof ParcoursData>> {
  const [{ items }, liste] = await Promise.all([listJourneyTemplates(), listJourneys()]);
  const mien = liste.items.find((i) => i.isOwner && i.status === 'ACTIVE') ?? liste.items[0];
  const parcours = mien === undefined ? null : await readJourney(mien.id);

  return {
    panneau: parcours === null ? PANNEAU_VIDE : panneauDe(parcours),
    modeles: items.map((m, rang) => ({
      nom: m.nameFr,
      etapes: m.version.stepCount,
      phrase: m.description ?? '',
      choisi: rang === 0,
      autre: rang !== 0,
    })),
  };
}

/**
 * J01M · le sélecteur de parcours.
 *
 * DEUX APPELS, et les deux sont nécessaires : `GET /journeys` donne la liste (dans
 * la forme de la LISTE — `currentStep { id, title }`, `stepCount`), et
 * `GET /journeys/:id` donne de quoi remplir le panneau de gauche, qui a besoin du
 * RANG de l'étape en cours. La liste ne le porte pas, et `doneCount + 1` ne serait
 * juste que si aucune étape n'était sautée. Écart remonté : la liste gagnerait à
 * rendre `currentStep.position`.
 */
export async function chargerJ01M(
  journeyId: string,
): Promise<Omit<J01MData, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const [parcours, liste] = await Promise.all([readJourney(journeyId), listJourneys()]);
  return {
    panneau: panneauDe(parcours),
    total: liste.items.length,
    mesParcours: liste.items.map((item) => choixDe(item, journeyId)),
  };
}

function choixDe(item: JourneyListItem, courantId: string): ChoixParcours {
  const enPause = item.status === 'PAUSED';
  const courant = item.id === courantId;
  return {
    // Le fond pâle désigne la ligne COURANTE ; les autres sont transparentes.
    fond: courant ? '#EFF7F3' : 'transparent',
    titre: item.title,
    pastilleFond: enPause ? '#F2F5F4' : '#E3F0EB',
    pastilleTexte: enPause ? '#5D6B66' : '#0F5C48',
    etat: enPause ? 'En pause' : 'Actif',
    sousTitre:
      item.currentStep === null
        ? typeCourt(item.template.code, item.template.nameFr)
        : `${typeCourt(item.template.code, item.template.nameFr)} · ${item.currentStep.title}`,
    barre: `${Math.round(item.progressPct)}%`,
    teinte: enPause ? TEINTE_PAUSE : TEINTE_AVANCE,
    pourcent: `${Math.round(item.progressPct)}%`,
    courant,
    autre: !courant,
  };
}

/** J05 · `/parcours/:id/equipe` (§3.4). */
export async function chargerJ05(journeyId: string): Promise<Omit<J05Data, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const parcours = await readJourney(journeyId);
  return { panneau: panneauDe(parcours), equipe: equipeDe(parcours) };
}

/**
 * J06 · `/parcours/:id/documents` (§3.3).
 *
 * `bandeau` vient de `meta.checklistNotice` : « Cochez ce que vous avez réuni. Les
 * documents restent chez vous. » est une phrase de l'API, écrite UNE fois côté
 * serveur pour toutes les routes de parcours. La recopier ici en ferait une
 * seconde source — et c'est la règle dure de §3.3 qu'elle porte.
 */
export async function chargerJ06(journeyId: string): Promise<Omit<J06Data, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const parcours = await readJourney(journeyId);
  const ouverte = etapeCourante(parcours);
  const documents: DocumentAffiche[] = (ouverte?.checklist ?? []).map((d) => ({
    libelle: d.label,
    coche: d.isChecked,
    aFaire: !d.isChecked,
  }));

  const autres: GroupeEtape[] = parcours.steps
    .filter((s) => s.id !== ouverte?.id && (s.checklist ?? []).length > 0)
    .map((s) => {
      const liste = s.checklist ?? [];
      const faits = liste.filter((d) => d.isChecked).length;
      const complet = faits === liste.length;
      return {
        titre: `Étape ${s.position} · ${s.title}`,
        compte: `${faits} / ${liste.length}`,
        compteCourt: `${faits}/${liste.length}`,
        // Les deux teintes de la maquette : vert pour une checklist complète,
        // orange pour une incomplète.
        teinteCompte: complet ? '#16785E' : '#B4581F',
        barre: `${Math.round((faits / liste.length) * 100)}%`,
        teinteBarre: complet ? TEINTE_ABOUTI : TEINTE_AVANCE,
      };
    });

  return {
    panneau: panneauDe(parcours),
    bandeau: parcours.meta.checklistNotice,
    etape: etapeAfficheeDe(parcours),
    documents,
    autresEtapes: autres,
  };
}

/**
 * J07 · `/parcours/:id/historique` (§3.8).
 *
 * DEUX APPELS : le journal, et le parcours pour le panneau de gauche.
 *
 * LES CINQ ICÔNES DESSINÉES CONTRE LES HUIT TYPES D'ACTIVITÉ. La maquette dessine
 * un drapeau (étape commencée), un cœur (entraide), une coche (étape franchie), un
 * trophée (jalon) et des silhouettes (équipe). `JourneyActivityType` compte huit
 * valeurs : `STEP_PAUSED` prend l'icône d'étape, `HELP_RECEIVED` celle de
 * l'entraide, `NOTE` celle de l'équipe faute d'autre chose. On range plutôt que
 * d'inventer un sixième tracé, et c'est signalé.
 */
export async function chargerJ07(journeyId: string): Promise<Omit<J07Data, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const [parcours, journal] = await Promise.all([
    readJourney(journeyId),
    listJourneyActivities(journeyId),
  ]);
  return {
    gratuit: !(await fetchMe()).monetisationActive,
    panneau: panneauDe(parcours),
    journal: journal.items.map(entreeDe),
  };
}

const FAMILLE: Record<string, 'etape' | 'entraide' | 'franchie' | 'jalon' | 'equipe'> = {
  STEP_STARTED: 'etape',
  STEP_PAUSED: 'etape',
  STEP_DONE: 'franchie',
  BLOCKER_PUBLISHED: 'entraide',
  HELP_RECEIVED: 'entraide',
  MILESTONE_SHARED: 'jalon',
  MEMBER_JOINED: 'equipe',
  NOTE: 'equipe',
};

/**
 * Le titre d'une entrée du journal, dans les mots de la maquette.
 *
 * Elle écrit « Étape 7 · Logement commencée », « Étape 6 · Caution bancaire et AVI
 * franchie », « Demande d'entraide publiée : … », « Jalon partagé : … », « Aïcha
 * Diop a rejoint votre équipe comme parraine ». Les verbes sont les siens ; ce
 * qu'on y substitue vient de `stepTitle` et de `actor`.
 *
 * « comme parraine » est RETIRÉ : l'API ne dit pas qu'un membre arrive comme
 * parrain — `JourneyMemberRole` ne connaît que `SUPPORTER` et `OBSERVER` — et le
 * garder aurait annoncé un parrainage qui n'a pas eu lieu.
 */
export function titreEntree(a: JourneyActivity): string {
  const etape = a.stepTitle === null ? '' : a.stepTitle;
  switch (a.type) {
    case 'STEP_STARTED':
      return `${etape} commencée`;
    case 'STEP_DONE':
      return `${etape} franchie`;
    case 'STEP_PAUSED':
      return `${etape} mise en pause`;
    case 'BLOCKER_PUBLISHED':
      return 'Demande d’entraide publiée';
    case 'HELP_RECEIVED':
      return 'Aide reçue sur cette étape';
    case 'MILESTONE_SHARED':
      return `Jalon partagé : ${etape}`;
    case 'MEMBER_JOINED':
      return a.actor === null
        ? 'Un membre a rejoint votre équipe'
        : `${nomAffiche(a.actor.displayName, a.actor.handle)} a rejoint votre équipe`;
    case 'TEMPLATE_MIGRATED':
      return 'Parcours mis à jour vers la nouvelle version de la procédure';
    default:
      return etape === '' ? 'Note' : `Note · ${etape}`;
  }
}

/** Le détail d'une entrée : la durée pour un franchissement, rien sinon. */
export function detailEntree(a: JourneyActivity): string {
  if (a.type !== 'STEP_DONE') return '';
  const charge = a.payload;
  if (typeof charge !== 'object' || charge === null) return '';
  const jours = (charge as { durationDays?: unknown }).durationDays;
  return typeof jours === 'number' ? `en ${duree(jours)}` : '';
}

function entreeDe(a: JourneyActivity): EntreeJournal {
  const famille = FAMILLE[a.type] ?? 'equipe';
  const quand = ilYA(a.createdAt);
  const detail = detailEntree(a);
  return {
    icEtape: famille === 'etape',
    icEntraide: famille === 'entraide',
    icFranchie: famille === 'franchie',
    icJalon: famille === 'jalon',
    icEquipe: famille === 'equipe',
    titre: titreEntree(a),
    detail,
    quand,
    // La maquette dessine « Voir » sur les entrées qui pointent un objet publié.
    lien: a.refId !== null,
    ligneMobile: detail === '' ? quand : `${quand} · ${detail}`,
  };
}

/** J08 · `/parcours/:id/reglages`. */
export async function chargerJ08(journeyId: string): Promise<Omit<J08Data, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const parcours = await readJourney(journeyId);
  return { panneau: panneauDe(parcours), parcours: enteteDe(parcours) };
}

/**
 * J08, la feuille de confirmation d'arrêt (§3.9) — LE MÊME CHARGEUR.
 *
 * `J08ArretData` et `J08Data` déclarent les deux mêmes prises, et c'est la
 * maquette qui le veut : la feuille mobile et la carte d'ordinateur disent la même
 * chose — le titre du parcours et le nombre d'étapes franchies que l'arrêt
 * conserve. Deux chargeurs auraient pu diverger ; l'alias ne peut pas.
 *
 * Aucune assertion de type : les deux formes sont structurellement identiques, et
 * en écrire une ferait mentir le compilateur le jour où l'une des deux change.
 */
export const chargerJ08Arret: (
  journeyId: string,
) => Promise<Omit<J08ArretData, keyof ParcoursData>> = chargerJ08;

/**
 * J09 · `/parcours/publics` (§3.7).
 *
 * TROIS APPELS, et chacun répond à une question différente : les parcours publics
 * à montrer, mes parcours pour savoir lequel est courant, et le parcours courant
 * pour le panneau de gauche.
 *
 * LA PHRASE « 14 membres suivent un parcours Études vers Lyon » décrit le TRI, pas
 * un filtre que l'écran aurait posé. §3.7 classe les parcours publics « même type
 * d'abord, puis même ville de destination » : le type et la ville de la phrase
 * sont donc ceux de MON parcours, ce qui est exactement ce que le serveur a
 * employé pour classer. Sans parcours, on reprend ceux du premier résultat — le
 * serveur ne classe alors que sur l'avancement.
 */
export async function chargerJ09(): Promise<Omit<J09Data, keyof ParcoursData>> {
  const [publics, liste] = await Promise.all([listPublicJourneys(), listJourneys()]);
  const mien = liste.items.find((i) => i.isOwner && i.status === 'ACTIVE') ?? liste.items[0];
  const parcours = mien === undefined ? null : await readJourney(mien.id);
  const premier = publics.items[0];

  return {
    panneau: parcours === null ? PANNEAU_VIDE : panneauDe(parcours),
    publics: publics.items.map(publicDe),
    compte: publics.items.length,
    filtre: {
      type:
        mien !== undefined
          ? typeCourt(mien.template.code, mien.template.nameFr)
          : premier === undefined
            ? ''
            : typeCourt(premier.template.code, premier.template.nameFr),
      ville:
        mien?.destinationCity.name ?? premier?.destinationCity.name ?? '',
    },
  };
}

/**
 * Un parcours public, prêt à poser (§3.7).
 *
 * LA FRISE DE SIX SEGMENTS de la maquette ne correspond pas aux étapes du
 * parcours : c'est une BARRE DE PROGRESSION découpée. `completedSteps` en donne
 * les étapes franchies ; le segment suivant est l'étape en cours (orange), et le
 * reste est à venir (gris). On la borne à six, le nombre que la maquette dessine,
 * parce qu'au-delà les libellés deviennent illisibles — elle les tronque déjà.
 */
function publicDe(p: PublicJourney): ParcoursPublicAffiche {
  const nom = nomAffiche(p.member.displayName, p.member.handle);
  const franchies: SegmentPublic[] = p.completedSteps
    .slice(0, 6)
    .map((s) => ({
      teinte: TEINTE_ABOUTI,
      teinteTitre: '#16211D',
      titre: s.title,
      duree: duree(s.durationDays),
    }));
  const segments: SegmentPublic[] = [...franchies];
  if (segments.length < 6 && p.status !== 'COMPLETED') {
    segments.push({ teinte: TEINTE_AVANCE, teinteTitre: '#16211D', titre: '', duree: '' });
  }
  while (segments.length < 6) {
    segments.push({ teinte: TEINTE_FUTUR, teinteTitre: '#8A958F', titre: '', duree: '' });
  }

  return {
    fond: fondAvatar(p.member.handle),
    initiales: initiales(nom, p.member.handle),
    nom,
    sousTitre: `${typeCourt(p.template.code, p.template.nameFr)} · ${p.destinationCity.name}`,
    pourcent: `${Math.round(p.progressPct)}%`,
    // La maquette écrit « En cours : Valider le VLS-TS ». La LISTE ne rend PAS
    // `currentStep` — seule la fiche le fait — donc la pastille nomme le TYPE et
    // la ville plutôt que d'inventer une étape. Écart remonté au porteur : la
    // liste gagnerait à porter `currentStep`, comme la fiche.
    enCours: `En cours : ${typeCourt(p.template.code, p.template.nameFr)}`,
    segments,
    /**
     * La maquette dessine « Proposer comme parrain » sur une carte et pas l'autre,
     * sans dire pourquoi. Le seul champ de la vue publique qui parle de la capacité
     * d'un membre à accompagner est `verificationLevel`, et c'est lui qu'on emploie.
     * CHOIX À CONFIRMER : il n'autorise rien — c'est le parrainage qui refusera.
     */
    parrainable: p.member.verificationLevel !== 'L0',
  };
}

/** J09 · `/parcours/publics/:id` — la FICHE, autre forme que la liste. */
export async function chargerJ09Fiche(
  journeyId: string,
): Promise<Omit<J09FicheData, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const { journey } = await getPublicJourney(journeyId);
  const nom = nomAffiche(journey.member.displayName, journey.member.handle);
  const membre: FichePublique = {
    prenom: prenom(nom, journey.member.handle),
    nom,
    initiales: initiales(nom, journey.member.handle),
    type: typeCourt(journey.template.code, journey.template.nameFr),
    ville: journey.destinationCity.name,
    pourcent: `${Math.round(journey.progressPct)}%`,
    // La FICHE porte `currentStep`, contrairement à la liste.
    enCours: journey.currentStep?.title ?? '',
  };
  return {
    membre,
    franchies: journey.completedSteps.map((s) => ({ titre: s.title, duree: duree(s.durationDays) })),
  };
}

/** J10 · `/parcours/:id/abouti`. */
export async function chargerJ10(journeyId: string): Promise<Omit<J10Data, keyof ParcoursData>> {
  if (!UUID.test(journeyId)) return VUE_NEUTRE;
  const parcours = await readJourney(journeyId);
  return { panneau: panneauDe(parcours), parcours: enteteDe(parcours) };
}

/**
 * J11 · `/parcours` — mes parcours (§5.1).
 *
 * DEUX APPELS : la liste pour les cartes, et le parcours courant pour le panneau
 * de gauche (qui a besoin du RANG de l'étape en cours, que la liste ne porte pas).
 *
 * LA LIMITE DU PLAN vient de `JOURNEY_FREE_ACTIVE_LIMIT`, la constante que le
 * SERVEUR applique avant de répondre `422 PLAN_LIMIT_REACHED`. Écrire « 1 » ici
 * aurait divergé le jour où le plan change — et une borne écrite à la main devient
 * fausse par accumulation.
 */
export async function chargerJ11(): Promise<Omit<J11Data, keyof ParcoursData>> {
  const liste = await listJourneys();
  const mien = liste.items.find((i) => i.isOwner && i.status === 'ACTIVE') ?? liste.items[0];
  const parcours = mien === undefined ? null : await readJourney(mien.id);

  const enCours = liste.items.filter((i) => i.status === 'ACTIVE' || i.status === 'PAUSED');
  const finis = liste.items.filter((i) => i.status === 'COMPLETED');

  return {
    panneau: parcours === null ? PANNEAU_VIDE : panneauDe(parcours),
    actifs: enCours.map(carteDe),
    aboutis: finis.map(carteDe),
    plan: {
      // §3.1 : la limite porte sur les parcours ACTIVE ou PAUSED, et sur les
      // MIENS — un parcours dont je suis accompagnant ne compte pas.
      actifs: liste.items.filter((i) => i.isOwner && (i.status === 'ACTIVE' || i.status === 'PAUSED'))
        .length,
      limite: JOURNEY_FREE_ACTIVE_LIMIT,
      gratuit: !(await fetchMe()).monetisationActive,
    },
  };
}

function carteDe(item: JourneyListItem): CarteParcours {
  const enPause = item.status === 'PAUSED';
  const abouti = item.status === 'COMPLETED';
  const pct = Math.round(item.progressPct);
  const sousTitre = abouti
    ? 'Abouti'
    : enPause
      ? 'En pause'
      : item.currentStep === null
        ? `Dernière activité ${ilYA(item.lastActivityAt)}`
        : `Dernière activité ${ilYA(item.lastActivityAt)} · ${item.currentStep.title}`;

  return {
    /** `/parcours/:id` — la route que `app/(app)/parcours/[id]/` sert. */
    href: `/parcours/${item.id}`,
    type: typeCourt(item.template.code, item.template.nameFr).toUpperCase(),
    actif: !enPause && !abouti,
    enPause,
    titre: item.title,
    sousTitre,
    // Le cadre mobile écrit « Hier · étape 7 Logement » : plus court, même donnée.
    sousTitreCourt:
      item.currentStep === null
        ? ilYA(item.lastActivityAt)
        : `${ilYA(item.lastActivityAt)} · ${item.currentStep.title}`,
    pourcent: `${pct}%`,
    barre: `${pct}%`,
    teinte: abouti ? TEINTE_ABOUTI : enPause ? TEINTE_PAUSE : TEINTE_AVANCE,
  };
}

/**
 * J11, état « aucun parcours » — la liste ET les types proposés.
 *
 * `/parcours?etat=vide` emprunte son cadre d'ordinateur à J01E : la maquette ne
 * dessine « aucun parcours » en 1440 px qu'UNE fois, sous J01E. Cette planche lit
 * `GET /journey-templates` ; le cadre mobile de J11, lui, ne lit rien — c'est le
 * propre d'un état vide. Les deux formes attendent donc la même prise, et ce
 * chargeur la remplit entière.
 *
 * LE SECOND APPEL N'EST FAIT QUE S'IL SERT, et c'est la PAGE qui le dit.
 *
 * Première version : on DÉDUISAIT l'état vide de la donnée — « si la liste est
 * vide, charge les modèles ». La visite au navigateur l'a prise en faute :
 * `/parcours?etat=vide` est un état d'URL, atteignable sur un membre qui A un
 * parcours (c'est ainsi que la planche se montre), et le chargeur ne demandait
 * alors aucun modèle. L'écran affichait ses cartes de type VIDES, et rien ne
 * rougissait — la planche « s'affichait », simplement sans donnée.
 *
 * La leçon est générale : un chargeur ne peut pas devancer l'état que l'URL
 * déclare. On passe donc `vide`, et charger quatre modèles pour rien ne coûte plus
 * un appel à chaque visite de « Mes parcours ».
 */
export async function chargerMesParcours(
  vide: boolean,
): Promise<Omit<J11Data & J01EVideData, keyof ParcoursData>> {
  const [base, modeles] = await Promise.all([
    chargerJ11(),
    vide ? chargerJ01EVide() : Promise.resolve({ modeles: VUE_NEUTRE.modeles }),
  ]);
  return { ...base, ...modeles };
}
