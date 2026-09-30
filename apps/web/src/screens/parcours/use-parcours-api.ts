'use client';

import { useCallback, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { LevelRequiredDetailsParsed } from '@app/shared';
import { ApiError, displayMessageFor } from '@/lib/api/index';
import {
  cancelBlocker,
  createBlockerDraft,
  createJourney,
  dismissShare,
  getJourney,
  listJourneyTemplates,
} from './api';

/**
 * LES APPELS DES TROIS CADRES DE PARCOURS QUI ONT DES PRISES — J02, J03, J04.
 *
 * ── CE QU'EST UNE « PRISE », ICI ────────────────────────────────────────────
 *
 * `04 Parcours.dc.html` n'a ni interpolation ni boucle : son contenu est écrit en
 * clair, et les cadres transcodés n'ont donc rien à consommer. Ce qu'ils ont, en
 * revanche, ce sont les `onClick` que le générateur pose sur les libellés qu'il
 * reconnaît. Trois cadres en portent, et ces boutons sont exactement ceux-là :
 *
 *   · J02 « Continuer » (variante Régulariser) → `onContinue`
 *   · J03 « Suivant » / « Retour » / « Annuler » → `onNext` / `onBack` / `onCancel`
 *   · J04 « Plus tard » → `onCancel`
 *
 * ── CE QUI N'EST PAS BRANCHÉ, ET POURQUOI ON NE LE FORCE PAS ────────────────
 *
 * « Publier » (J03, troisième volet) et « Partager » (J04) NE PORTENT AUCUN
 * `onClick` : le générateur ne reconnaît pas ces libellés. Les brancher
 * demanderait de modifier `BUTTON_ACTIONS` dans `tools/generate-screens.mjs`, donc
 * de régénérer des cadres — hors de ce lot, et un autre chantier y travaille.
 *
 * Il se trouve que cette limite TIENT la règle dure de §3.5 : « le brouillon n'est
 * jamais promu sans cet appel ». Aucune suite de clics ne publie quoi que ce soit
 * ici. Ce n'est pas une garantie sur laquelle se reposer — c'est un état de fait à
 * connaître, et à remonter tel quel.
 *
 * ── LES IDENTIFIANTS VIENNENT DE L'URL, PAS DE LA MAQUETTE ──────────────────
 *
 * La maquette dessine « Mes études à Lyon », « Étape 7 : Logement ». Ce sont des
 * illustrations. Le parcours réel est celui de `/parcours/:id`, et l'étape celle
 * que le serveur déclare en cours (`journey.currentStepId`) — jamais un rang lu
 * dans une image.
 *
 * Sans contexte — `/parcours/nouveau`, `/parcours/publics` — les gestes restent
 * INERTES. Le bouton « Je suis bloqué·e » y est dessiné dans le panneau de gauche,
 * qui représente un parcours d'illustration : deviner lequel serait écrire dans le
 * parcours de quelqu'un.
 */

/** Le modèle à créer depuis J02 « Régulariser » (§3.1, T5). */
const CODE_REGULARISER = 'SETTLEMENT';

export interface ContexteParcours {
  /** Le parcours de l'URL (`/parcours/:id`), ou absent. */
  readonly journeyId?: string;
  /**
   * L'étape de l'URL, quand c'en est une.
   *
   * `/parcours/:id/etapes/:etape` porte un segment libre. S'il n'est pas un
   * identifiant, on demande au serveur l'étape EN COURS plutôt que de lire un rang
   * — la maquette écrit « Étape 7 », et rien ne dit que la septième ligne de la
   * base est celle que le membre regarde.
   */
  readonly stepId?: string;
  /**
   * J02 : « Continuer » crée un parcours de ce type.
   *
   * Un CODE de modèle, pas un identifiant : les identifiants sont propres à une
   * base, et en coder un en dur aurait marché en développement et échoué en
   * production. Le code, lui, est le contrat (`journey_templates.code`).
   */
  readonly creerCode?: string;
}

/** Un identifiant de la base : UUID, y compris les UUIDv7 que ce projet émet. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useParcoursApi(contexte: ContexteParcours) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [niveauRequis, setNiveauRequis] = useState<LevelRequiredDetailsParsed | null>(null);

  /**
   * Le brouillon de blocage en cours, s'il en existe un.
   *
   * Une RÉFÉRENCE, et non un état : « Annuler » le lit dans un gestionnaire
   * mémoïsé, qui garderait sinon la valeur du rendu où il a été créé — donc
   * toujours `null`, donc un « Annuler » qui n'annule rien. C'est le même piège
   * que `latest` dans le parcours d'inscription.
   */
  const brouillon = useRef<string | null>(null);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setErreur(null);
    setNiveauRequis(null);
    try {
      await work();
    } catch (cause) {
      /**
       * `displayMessageFor` et non `cause.message`.
       *
       * `ApiShapeError` n'hérite PAS d'`ApiError` — c'est voulu dans le socle — et
       * un `instanceof ApiError` seul l'aurait laissé tomber dans le repli
       * « connexion impossible ». Le membre aurait vérifié son wifi pendant qu'un
       * contrat cassait.
       *
       * Et jamais de nouvelle tentative : un `429` rejoué n'est qu'un second
       * `429`, avec un compteur qui repart.
       */
      const invitation = cause instanceof ApiError ? cause.levelRequired : null;
      if (invitation !== null) setNiveauRequis(invitation);
      else setErreur(displayMessageFor(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * L'étape sur laquelle porte le geste.
   *
   * L'URL d'abord si elle porte un identifiant, l'ÉTAPE EN COURS du serveur
   * sinon. `GET /journeys/:id` la donne (`journey.currentStepId`), et elle peut
   * valoir `null` sur un parcours dont tout est franchi — auquel cas il n'y a rien
   * à débloquer ni à partager, et le geste ne part pas.
   */
  const resoudreEtape = useCallback(
    async (journeyId: string): Promise<string | null> => {
      const fromUrl = contexte.stepId;
      if (fromUrl !== undefined && UUID.test(fromUrl)) return fromUrl;
      const { journey } = await getJourney(journeyId);
      return journey.currentStepId;
    },
    [contexte.stepId],
  );

  /** §3.5, premier temps — le brouillon, à l'ouverture de la feuille. */
  const ouvrirBlocage = useCallback((): void => {
    const journeyId = contexte.journeyId;
    if (journeyId === undefined) return;
    void run(async () => {
      const stepId = await resoudreEtape(journeyId);
      if (stepId === null) return;
      const { blocker } = await createBlockerDraft(journeyId, stepId);
      brouillon.current = blocker.id;
    });
  }, [contexte.journeyId, resoudreEtape, run]);

  /** §3.5 — « Annuler » : le brouillon passe en `CANCELLED`. */
  const annulerBlocage = useCallback((): void => {
    const id = brouillon.current;
    if (id === null) return;
    // Oublié TOUT DE SUITE, avant l'appel : sans cela, un second « Annuler » — la
    // feuille rouverte puis refermée — rejouerait l'annulation sur un brouillon
    // déjà `CANCELLED`, et le serveur répondrait un conflit que le membre lirait
    // comme un échec de son geste.
    brouillon.current = null;
    void run(async () => {
      await cancelBlocker(id);
    });
  }, [run]);

  /** §3.6 — « Plus tard » : plus jamais reproposé pour cette étape. */
  const declinerPartage = useCallback((): void => {
    const journeyId = contexte.journeyId;
    if (journeyId === undefined) return;
    void run(async () => {
      const stepId = await resoudreEtape(journeyId);
      if (stepId === null) return;
      await dismissShare(journeyId, stepId);
    });
  }, [contexte.journeyId, resoudreEtape, run]);

  /**
   * J02 « Continuer » — §3.1 : créer le parcours, puis y aller.
   *
   * Le modèle est trouvé par son CODE dans `GET /journey-templates`. La liste est
   * demandée AU CLIC plutôt qu'au montage : c'est un geste rare, sur un écran que
   * la plupart des membres traversent sans créer, et charger la liste pour rien à
   * chaque affichage de J02 coûterait un appel par visite.
   *
   * `PLAN_LIMIT_REACHED` n'est PAS avalé ici, contrairement à l'écran O03 de
   * l'inscription : le membre vient de demander explicitement un parcours, et la
   * maquette de J02 dessine une planche pour ce cas précis (« Vous avez déjà un
   * parcours actif », `?etape=plan`). Le refus doit donc se voir.
   */
  const creer = useCallback((): void => {
    const code = contexte.creerCode;
    if (code === undefined) return;
    void run(async () => {
      const { items } = await listJourneyTemplates();
      const modele = items.find((t) => t.code === code);
      if (modele === undefined) {
        // Le modèle manque côté serveur : on le DIT, au lieu de créer le premier
        // venu. Créer « Étudier en France » à qui demande « Régulariser » serait
        // pire qu'un refus.
        setErreur('Ce type de parcours n’est pas disponible pour le moment.');
        return;
      }
      const { journey } = await createJourney({ templateId: modele.id });
      router.push(`/parcours/${journey.id}`);
    });
  }, [contexte.creerCode, router, run]);

  const oublierNiveauRequis = useCallback(() => setNiveauRequis(null), []);

  return {
    busy,
    erreur,
    niveauRequis,
    oublierNiveauRequis,
    ouvrirBlocage,
    annulerBlocage,
    declinerPartage,
    creer,
  };
}

/**
 * Le contexte lu dans l'URL, pour les écrans du PROPRE parcours du membre.
 *
 * `useParams()` et non `useSearchParams()` : le second force un rendu client et
 * fait échouer `next build` sans frontière `Suspense`, ce qui a déjà servi cinq
 * pages blanches dans ce dépôt. `useParams()` lit des segments de route, pas la
 * chaîne de requête, et n'a pas cet effet.
 *
 * À N'EMPLOYER QUE SOUS `/parcours/:id`. `/parcours/publics/:id` porte aussi un
 * `id`, mais c'est le parcours de QUELQU'UN D'AUTRE : y créer un brouillon de
 * blocage appellerait `POST /journeys/:id/steps/:stepId/blocker` sur un parcours
 * qu'on ne possède pas, donc un refus du serveur — et le membre verrait une
 * bannière d'erreur pour avoir simplement ouvert une feuille. C'est pourquoi le
 * contexte est passé EXPLICITEMENT par chaque page, au lieu d'être deviné dans
 * `useParcours` : la différence entre « mon parcours » et « celui d'un autre » ne
 * se lit pas dans la forme de l'URL.
 *
 * ── LE SEGMENT DOIT ÊTRE UN IDENTIFIANT, SINON IL N'Y A PAS DE PARCOURS ─────
 *
 * `/parcours/1/etapes/7` est une URL légitime de ce dépôt : c'est celle que les
 * tests de planche emploient, parce que la maquette ne dessine qu'un parcours et
 * qu'inventer des identifiants serait inventer de la donnée. Prendre « 1 » pour un
 * parcours ferait partir `GET /journeys/1`, que le serveur refuse en
 * `400 VALIDATION_FAILED` — et le membre verrait une bannière d'erreur pour avoir
 * ouvert une feuille sur une planche de démonstration.
 *
 * On EXIGE donc la forme d'un identifiant. Un segment qui n'en est pas un veut
 * dire « planche d'illustration » : les gestes restent inertes, ce qui est
 * exactement ce qu'on veut d'une illustration.
 */
export function useContexteParcours(creerCode?: string): ContexteParcours {
  const params = useParams<{ id?: string; etape?: string }>();
  const journeyId = typeof params.id === 'string' && UUID.test(params.id) ? params.id : undefined;
  const stepId = typeof params.etape === 'string' ? params.etape : undefined;
  return {
    ...(journeyId === undefined ? {} : { journeyId }),
    ...(stepId === undefined ? {} : { stepId }),
    ...(creerCode === undefined ? {} : { creerCode }),
  };
}

/** Le code du modèle « Régulariser ma situation », pour J02 (§3.1, T5). */
export { CODE_REGULARISER };
