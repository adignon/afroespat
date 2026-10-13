'use client';

import {
  calendarResponseSchema,
  communitiesResponseSchema,
  eventDetailResponseSchema,
  eventsResponseSchema,
  mySubscriptionResponseSchema,
  organizerAttendeesResponseSchema,
  publicAttendeesResponseSchema,
  publicProfileResponseSchema,
  type CalendarResponse,
  type EventDetailResponse,
} from '@app/shared';
import { fetchMe, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import {
  construireBande,
  construireCarte,
  construireChoix,
  construireFeuille,
  construireFiche,
  construireMoi,
  construirePanneau,
  construirePresence,
  construireWeekEnd,
  jourCivilDe,
  jourLongBas,
  jourLong,
  pluriel,
  type E01Data,
  type E02Data,
  type E03Data,
  type E04Data,
  type EtatBouton,
  type PanneauAgenda,
  formulaireVide,
} from './data';

/**
 * LES APPELS DES ÉCRANS E01 À E04 — un chargeur par écran, et rien d'autre.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ───────────────────────────────────────────
 *
 * Il n'a AUCUN `fetch`, aucun en-tête, aucun jeton, aucun rejeu. Le socle
 * (`lib/api/`) porte tout cela, et sa consigne est à lire avant d'ajouter une
 * ligne ici. Quatre de ses règles se voient dans ce fichier :
 *
 *   1. `memberApi` seulement — `staffApi` n'a aucun moyen d'exprimer `/me` ;
 *   2. TOUT APPEL PORTE UN SCHÉMA, et les schémas viennent de `@app/shared` : six
 *      ont été ÉCRITS LÀ pour ce lot, à côté des schémas de requête du module
 *      `events`, parce qu'un schéma de réponse recopié dans le front est une
 *      deuxième source qui divergera ;
 *   3. AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN : `z.infer` partout ;
 *   4. LE NIVEAU NE SERT JAMAIS À AUTORISER. Aucun `if (niveau >= 1)` ici, alors
 *      que `event.create` et `event.attend` exigent L1 : on tente l'action, et le
 *      serveur répond `403 LEVEL_REQUIRED` avec de quoi afficher l'invitation.
 *
 * ── AUCUN CHARGEUR NE REJOUE ────────────────────────────────────────────────
 *
 * Le socle rejoue ce qui doit l'être (un `401` après rafraîchissement) et ne
 * rejoue JAMAIS un `429`. Un chargeur qui réessaierait de lui-même transformerait
 * une attente d'une heure en boucle.
 *
 * ── L'ORDRE DES APPELS EST PARFOIS UNE GARDE, PAS UNE LENTEUR ───────────────
 *
 * E04 appelle `GET /events/:id` AVANT `GET /events/:id/attendees`, en série, et
 * c'est délibéré : le premier dit `isOrganizer`, et c'est lui qui choisit le
 * contrat de validation du second. §5 ne renvoie `userId` et `checkedIn` qu'à
 * l'organisateur, et `publicAttendeesResponseSchema` les REFUSE — le jour où la
 * route les joindrait à la vue publique, l'écran refuserait la réponse au lieu de
 * laisser transiter l'identifiant d'un participant. Paralléliser les deux
 * appellerait la vue publique avec le contrat de l'organisateur une fois sur deux,
 * et la garde ne garderait plus rien.
 */

/**
 * ─── LA SESSION SE REPREND AVANT TOUTE LECTURE PUBLIQUE ─────────────────────
 *
 * DÉFAUT MESURÉ AU NAVIGATEUR, et il n'était visible nulle part ailleurs.
 *
 * Les lectures de l'agenda sont `@PublicRead` : un visiteur doit voir ce qui se
 * passe dans sa ville. Conséquence pour un MEMBRE : au premier chargement de page,
 * le jeton d'accès n'est pas encore en mémoire — il vit dans la clôture de
 * `session.ts` et meurt avec l'onglet. Un appel parti à cet instant arrive SANS
 * jeton, et le serveur répond `200` avec la projection du VISITEUR : `myStatus`
 * nul, `isOrganizer` faux, aucun `checkedIn`. Le transport ne rejoue rien,
 * puisqu'il n'y a pas eu de `401` à rejouer.
 *
 * Ce que ça donnait à l'écran : E04 demandait la feuille de l'organisateur et
 * recevait la vue publique, donc `ApiShapeError` — « Unrecognized key(s)… » — et
 * un bandeau « Une erreur est survenue de notre côté ». Sur E02, c'était une
 * COURSE : la carte « VUE ORGANISATEUR » apparaissait ou non selon l'ordre
 * d'arrivée des réponses. Un écran qui change d'avis au rechargement.
 *
 * On reprend donc la session AVANT la première lecture, et seulement s'il n'y a
 * pas déjà de jeton en main : aucun aller-retour ajouté quand il y en a un.
 */
async function assurerSession(): Promise<void> {
  if (!hasAccessToken()) await resumeSession();
}

// ─── Le panneau, commun aux quatre écrans ────────────────────────────────────

/**
 * La fenêtre du calendrier : le MOIS COURANT, complété par ses semaines entières.
 *
 * Six semaines au plus, donc 42 jours — sous les 62 que `calendarQuerySchema`
 * autorise. Le mois entier est demandé pour que « 14 événements ce mois-ci » soit
 * exact : une fenêtre glissante de six semaines n'aurait couvert qu'une partie du
 * mois, et le compteur aurait menti d'autant.
 *
 * LA FENÊTRE EST CALCULÉE SUR L'HORLOGE DU NAVIGATEUR, et c'est la seule chose de
 * ce fichier qui le soit. Elle ne peut pas l'être autrement : le fuseau de
 * référence arrive DANS la réponse (`meta.timeZone`), donc après l'appel. La
 * conséquence est bornée — un jour de plus ou de moins aux deux bords de la
 * fenêtre, jamais une erreur d'affichage — parce que tout ce qui est AFFICHÉ est
 * ensuite formaté dans le fuseau que l'API a annoncé.
 */
function fenetreDuMois(maintenant: Date): { from: string; to: string } {
  const an = maintenant.getFullYear();
  const mois = maintenant.getMonth();
  const premier = new Date(an, mois, 1);
  const dernier = new Date(an, mois + 1, 0);
  // Lundi de la semaine du 1er, dimanche de la semaine du dernier jour (ISO).
  const debut = new Date(premier);
  debut.setDate(premier.getDate() - ((premier.getDay() + 6) % 7));
  const fin = new Date(dernier);
  fin.setDate(dernier.getDate() + (7 - ((dernier.getDay() + 6) % 7)) - 1);
  const civil = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: civil(debut), to: civil(fin) };
}

/** Mes réseaux, par identifiant : la seule façon de NOMMER un événement réservé. */
async function reseauxParId(): Promise<ReadonlyMap<string, string>> {
  const reseaux = await memberApi.get('/communities', communitiesResponseSchema);
  return new Map(reseaux.mine.map((r) => [r.id, r.name]));
}

interface Socle {
  readonly panneau: PanneauAgenda;
  readonly moi: { readonly initiales: string; readonly prenom: string };
  readonly calendrier: CalendarResponse;
  readonly zone: string;
  readonly aujourdhui: string;
  readonly handle: string;
}

/**
 * Le socle des quatre écrans : identité, calendrier, quota.
 *
 * `jourChoisi` met une ligne en évidence dans le calendrier. Sur E02, E03 et E04
 * il n'y a pas de jour sélectionné : on passe le jour courant, qui est ce que le
 * panneau met en avant quand la page ne parle pas d'un jour.
 */
async function chargerSocle(jourChoisi: string | null): Promise<Socle> {
  await assurerSession();
  const fenetre = fenetreDuMois(new Date());
  const [me, calendrier, abonnement] = await Promise.all([
    fetchMe(),
    memberApi.get(
      `/events/calendar?from=${fenetre.from}&to=${fenetre.to}`,
      calendarResponseSchema,
    ),
    memberApi.get('/me/subscription', mySubscriptionResponseSchema),
  ]);

  const zone = calendrier.meta.timeZone;
  const aujourdhui = jourCivilDe(new Date(), zone);
  const choisi = jourChoisi ?? jourDefaut(calendrier, aujourdhui);

  return {
    panneau: construirePanneau(calendrier, abonnement, choisi, aujourdhui),
    moi: construireMoi(me.user.displayName, me.user.avatarUrl),
    calendrier,
    zone,
    aujourdhui: choisi,
    handle: me.user.handle,
  };
}

/**
 * §3.5 : « Sans sélection : aujourd'hui, ou le prochain jour avec événement. »
 *
 * La règle est écrite dans la spec et elle est appliquée ici, sur la réponse du
 * serveur — pas sur une intuition. Si rien n'a d'événement dans la fenêtre, on
 * reste sur aujourd'hui : un agenda vide se montre vide, il ne saute pas.
 */
function jourDefaut(calendrier: CalendarResponse, aujourdhui: string): string {
  const aujourdhuiPlein = calendrier.items.find((j) => j.date === aujourdhui && j.total > 0);
  if (aujourdhuiPlein !== undefined) return aujourdhui;
  const prochain = calendrier.items.find((j) => j.date > aujourdhui && j.total > 0);
  return prochain?.date ?? aujourdhui;
}

/** Le nom de ma ville. `GET /me` ne rend que `cityId` : c'est l'écart de K01. */
async function maVille(handle: string): Promise<string> {
  const profil = await memberApi.get(`/users/${handle}`, publicProfileResponseSchema);
  return profil.city?.name ?? '—';
}

// ─── E01 · /agenda ───────────────────────────────────────────────────────────

/**
 * L'agenda du jour (§3.5).
 *
 * TROIS LISTES, et chacune pour ce qu'elle sait dire :
 *   · le calendrier du panneau (`/events/calendar`) — un objet par jour, sans
 *     heures ;
 *   · les cartes du jour (`/events?date=`) — « mes participations en tête » est un
 *     tri du SERVEUR, que le front ne refait pas ;
 *   · le prochain week-end (`/events?from&to`) — la carte « CE WEEK-END » a besoin
 *     des HEURES, que le calendrier ne porte pas.
 */
export async function chargerE01(jourDemande: string | null): Promise<E01Data> {
  const socle = await chargerSocle(jourDemande);
  // Le socle a repris la session : les lectures publiques qui suivent partent
  // donc AVEC le jeton, et rendent la vue du MEMBRE — « mes participations en
  // tête » et la pastille « Vous y allez » en dépendent.
  const jour = socle.aujourdhui;
  const weekEnd = prochainWeekEnd(jour);

  const [jourListe, weekEndListe, reseaux, ville] = await Promise.all([
    memberApi.get(`/events?date=${jour}`, eventsResponseSchema),
    memberApi.get(
      `/events?from=${weekEnd.from}&to=${weekEnd.to}&limit=5`,
      eventsResponseSchema,
    ),
    reseauxParId(),
    maVille(socle.handle),
  ]);

  return {
    moi: socle.moi,
    panneau: socle.panneau,
    jour: jourLong(jour),
    nombre: jourListe.items.length,
    pluriel: pluriel(jourListe.items.length),
    evenements: jourListe.items.map((e) => construireCarte(e, reseaux)),
    weekEnd: construireWeekEnd(weekEndListe),
    // La maquette écrit « LYON » en capitales : l'intitulé de sa carte de ville.
    ville: ville.toUpperCase(),
    bande: construireBande(socle.calendrier, jour),
  };
}

/** Le samedi et le dimanche à venir, à partir d'un jour civil. */
function prochainWeekEnd(jourCivil: string): { from: string; to: string } {
  const jour = new Date(`${jourCivil}T12:00:00Z`);
  const versSamedi = (6 - jour.getUTCDay() + 7) % 7;
  const samedi = new Date(jour.getTime() + versSamedi * 86_400_000);
  const dimanche = new Date(samedi.getTime() + 86_400_000);
  const civil = (d: Date): string => d.toISOString().slice(0, 10);
  return { from: civil(samedi), to: civil(dimanche) };
}

// ─── E02 · /agenda/:id ───────────────────────────────────────────────────────

/**
 * La fiche d'un événement (§3.2).
 *
 * Le réseau n'est nommé QUE s'il y en a un : `GET /communities` est un appel de
 * plus, et il ne sert qu'aux événements réservés. Il est honnête parce qu'un
 * événement réservé n'est visible que par les membres ACTIFS de son réseau (règle
 * dure §10) — si la fiche s'affiche, le réseau est dans ma liste.
 */
export async function chargerE02(id: string): Promise<E02Data> {
  await assurerSession();
  const [socle, detail] = await Promise.all([
    chargerSocle(null),
    memberApi.get(`/events/${id}`, eventDetailResponseSchema),
  ]);
  const reseaux =
    detail.communityId === null
      ? (new Map<string, string>() as ReadonlyMap<string, string>)
      : await reseauxParId();

  return {
    moi: socle.moi,
    panneau: socle.panneau,
    evenement: construireFiche(detail, reseaux),
    choix: construireChoix(detail.myStatus),
    presence: construirePresence(detail),
    attente: detail.myWaitlistPosition,
    // §3.2 : « Si `capacity` atteinte : WAITLIST ». Les deux nombres viennent du
    // serveur, et `capacity` peut être absente — un événement sans limite n'est
    // jamais complet.
    complet: detail.capacity !== null && detail.attendeeCount >= detail.capacity,
    organisateur: detail.isOrganizer,
  };
}

// ─── E03 · /agenda/nouveau ───────────────────────────────────────────────────

/**
 * L'écran de création (§3.1).
 *
 * IL NE LIT QUE CE QUI EST VRAIMENT UNE DONNÉE DU MEMBRE : son quota et sa ville.
 * Les champs du formulaire sont dessinés en `<div>` par la maquette — l'écran ne
 * peut donc rien envoyer, et `POST /events` attend des champs de saisie que la
 * maquette ne dessine pas. Remonté au porteur plutôt que comblé en silence.
 */
export async function chargerE03(): Promise<E03Data> {
  const socle = await chargerSocle(null);
  // Le formulaire est vide ici : son état vit dans `useFormulaireEvenement`, que
  // la page fusionne par-dessus — un chargeur ne tient pas d'état de saisie.
  return {
    moi: socle.moi,
    panneau: socle.panneau,
    ville: await maVille(socle.handle),
    formulaire: formulaireVide,
  };
}

// ─── E04 · /agenda/:id/presence ──────────────────────────────────────────────

/**
 * La feuille de présence (§3.3), et la garde qui va avec.
 *
 * `isOrganizer` vient du SERVEUR et choisit le contrat de validation. Ce n'est pas
 * le front qui s'autorise quelque chose : il valide la réponse avec la forme qui
 * correspond à ce que le serveur a dit de lui, et refuse tout le reste.
 */
export async function chargerE04(id: string): Promise<E04Data> {
  await assurerSession();
  const [socle, detail] = await Promise.all([
    chargerSocle(null),
    memberApi.get(`/events/${id}`, eventDetailResponseSchema),
  ]);

  const feuille = detail.isOrganizer
    ? await memberApi.get(`/events/${id}/attendees`, organizerAttendeesResponseSchema)
    : await memberApi.get(`/events/${id}/attendees`, publicAttendeesResponseSchema);

  const lue = construireFeuille(feuille);

  return {
    moi: socle.moi,
    panneau: socle.panneau,
    evenement: { titre: detail.title, quand: jourLongBas(detail.localDate) },
    compteur: lue.compteur,
    presents: lue.presents,
    plurielPresents: pluriel(lue.presents),
    inscrits: lue.inscrits,
    plurielInscrits: pluriel(lue.inscrits),
    participants: lue.participants,
  };
}

/** Réexporté pour les écrans : le détail sert aussi à nommer la page. */
export type { EventDetailResponse };

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DESSIN SANS LA DONNÉE — POUR QUE LE CADRE SOIT SERVI TOUT DE SUITE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré au HTML servi, sans exécuter le JavaScript : `/agenda` répondait 200
 * avec une coquille — aucun rail, aucune barre basse. La branche d'attente de
 * `EcranDonnees` remplaçait le cadre entier par sa phrase, donc les destinations
 * déclarées sur ce cadre n'atteignaient jamais le navigateur. Ce n'était pas un
 * lien mort — le `<a href="/parcours">` est bien dans `e01/desktop.generated.tsx` —
 * c'était un cadre non rendu.
 *
 * Le motif est celui de `/accueil` : le dessin tout de suite, la donnée ensuite.
 * Tout est à zéro ou vide, ce qui n'invente rien : un agenda qui n'a pas encore
 * ses événements n'en affiche aucun, et son calendrier n'a aucune semaine à
 * peindre.
 *
 * `pluriel` VAUT LA CHAÎNE VIDE, et c'est juste : la maquette écrit
 * « {nombre} événement{pluriel} », donc « 0 événement » au singulier. Mettre un
 * « s » aurait écrit « 0 événements », ce que `pluriel()` de ce module ne fait pas
 * non plus.
 *
 * `plafond` vient du plan : il est rendu par l'API dans le quota. Non chargé, il
 * reste vide — et la ligne « 0 sur  ce mois-ci » n'annonce aucun plafond faux.
 * C'est préférable à un plafond inventé, qui serait affiché comme vrai.
 */
export const SQUELETTE_E01: E01Data = {
  moi: { initiales: '', prenom: '' },
  panneau: {
    mois: '',
    aujourdhui: '',
    totalMois: 0,
    semaines: [],
    quota: { utilise: 0, plafond: '', reset: '' },
  },
  jour: '',
  nombre: 0,
  pluriel: '',
  evenements: [],
  weekEnd: [],
  ville: '',
  bande: [],
};

/**
 * LES TROIS AUTRES ÉCRANS DU MODULE — la fiche, la création, la présence.
 *
 * Même cause, même remède que `SQUELETTE_E01` : sans squelette, `/agenda/:id`,
 * `/agenda/nouveau` et `/agenda/:id/presence` répondent 200 en servant
 * « DisaporyPlus Chargement de l'agenda… » et rien d'autre — ni rail, ni barre
 * basse. Le cadre est désormais rendu tout de suite, et l'attente est une bande.
 *
 * LES COULEURS DES BOUTONS DE RSVP SONT CELLES DE LA MAQUETTE, au repos : un
 * bouton sans fond ni couleur de texte serait invisible, et en choisir d'autres
 * serait inventer un dessin. `#F2F5F4` et `#5D6B66` sont les deux jetons que
 * `07 Agenda` emploie pour un choix NON retenu — c'est donc l'état « je n'ai pas
 * encore répondu », qui est exactement vrai tant que le serveur n'a pas répondu.
 *
 * `complet: false` et `organisateur: false` sont les choix PRUDENTS : annoncer
 * « complet » à tort fermerait la porte, et se dire organisateur à tort
 * afficherait des contrôles de gestion que le membre n'a pas. `attente: null`
 * n'annonce aucune file d'attente.
 */
const CHOIX_AU_REPOS: EtatBouton = { fond: '#F2F5F4', texte: '#5D6B66' };

export const SQUELETTE_E02: E02Data = {
  moi: SQUELETTE_E01.moi,
  panneau: SQUELETTE_E01.panneau,
  evenement: {
    titre: '—',
    type: '',
    reseau: null,
    quand: '',
    quandCourt: '',
    lieu: '',
    lieuCourt: '',
    adresse: '',
    description: null,
    organisateur: { nom: '', initiales: '' },
    avatars: [],
    reste: null,
    inscrits: 0,
    places: null,
    plurielPlaces: '',
  },
  choix: { vient: CHOIX_AU_REPOS, peutEtre: CHOIX_AU_REPOS, refuse: CHOIX_AU_REPOS },
  presence: { debut: '', fin: '' },
  attente: null,
  complet: false,
  organisateur: false,
};

export const SQUELETTE_E03: E03Data = {
  moi: SQUELETTE_E01.moi,
  panneau: SQUELETTE_E01.panneau,
  ville: '',
  formulaire: formulaireVide,
};

export const SQUELETTE_E04: E04Data = {
  moi: SQUELETTE_E01.moi,
  panneau: SQUELETTE_E01.panneau,
  evenement: { titre: '—', quand: '' },
  compteur: false,
  presents: 0,
  plurielPresents: '',
  inscrits: 0,
  plurielInscrits: '',
  participants: [],
};
