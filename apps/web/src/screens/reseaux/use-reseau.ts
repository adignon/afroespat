'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Album,
  Announcement,
  Capability,
  CommunityDetailResponse,
  CommunityMember,
  CommunityReport,
  TopicsResponse,
} from '@app/shared';
import { fetchMe, hasAccessToken, resumeSession } from '@/lib/api/index';
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_MAX_PINNED_TOPICS,
  COMMUNITY_MAX_RULES,
  albumTitleSchema,
  communityDescriptionSchema,
  type CommunityCategory,
  type PendingPost,
} from '@app/shared';
import {
  addAlbumPhoto,
  createAlbum,
  createAnnouncement,
  createTopic,
  decideCommunityReport,
  decidePendingPost,
  decideRequest,
  fetchAlbums,
  fetchAnnouncements,
  fetchCommunity,
  fetchCommunityEvents,
  fetchCommunityReports,
  fetchMembers,
  fetchPendingMembers,
  fetchPendingPosts,
  fetchTopics,
  joinCommunity,
  leaveCommunity,
  openModeratorsConversation,
  reactivateCommunity,
  removeMember,
  rsvpEvent,
  setAnnouncementPinned,
  setCommunityMuted,
  transferCommunity,
  updateCommunity,
  updateMember,
  updateTopic,
  uploadAlbumImage,
  uploadCommunityCover,
} from './api';
import {
  albumPastillesFrom,
  albumPhotosFrom,
  albumVignettesFrom,
  ALBUM_EVENEMENTS,
  ALBUM_PARTAGES,
  ALBUM_TOUT,
  communityIsOpen,
  demandeRowFrom,
  enteteReseauFrom,
  evenementsReseauFrom,
  membreAdminRowFrom,
  photosPartageesFrom,
  pinnedRowsFrom,
  signalementRowFrom,
  topicRowsFrom,
  withoutPinned,
} from './from-api';
import { echecDe, type ReseauEchec } from './echec';
/**
 * LE GESTE « ÉCRIRE » DES SIX BOUTONS DE L'ONGLET « MEMBRES ».
 *
 * Il est monté ICI et non dans `reseau-screen.tsx` parce que ses deux prises
 * vivent dans `gerer` — le menu de rôle les lit, et le menu est déjà de ce
 * crochet. Le mettre dans l'écran aurait demandé d'écraser `gerer` après coup,
 * comme la page le fait pour `annonce` ; c'était possible, mais `annonce` est un
 * FORMULAIRE qui n'a besoin d'aucune donnée du réseau, alors que celui-ci lit la
 * liste des membres et l'état du menu, qui sont tous deux ici.
 */
import { useEcrireMembre, type EcrireMembreEtat } from './use-ecrire-membre';
import {
  netTabsFor,
  panelReseaux,
  initials,
  rail,
  RANG_ONGLET_ALBUM,
  RANG_ONGLET_EVENEMENTS,
  RANG_ONGLET_FIL,
  RANG_ONGLET_MEMBRES,
  tint,
} from './chrome';
import { useComposeurReseau } from './use-composeur-reseau';
import type { ContenuSignale, SujetEpinglable } from '@/components/fenetres-reseau';
import {
  actionsVides,
  sujetsVides,
  type AProposReseauView,
  type ActionsReseauView,
  type ColonneReseauView,
  type ComposeurReseauView,
  type FiltreMembresView,
  type OutilsReseauView,
  type PilotageReseauView,
  type SectionGestion,
  type SujetsReseauView,
  type VidesReseauView,
} from '../a08t/vivant';
/**
 * LA ROUTE DU FIL ET SON CONVERTISSEUR VIENNENT DU MODULE DU FIL, jamais d’une
 * copie : la carte montée par les planches « Fil » EST celle de A01, donc sa
 * donnée doit être composée par le même convertisseur. C’est aussi ce que fait le
 * profil public (`screens/compte/appels.ts`).
 */
import { fetchFeed } from '../accueil/api';
import { feedPostsFrom } from '../accueil/from-api';
import type { FeedPostView } from '../a01/data';
import type { A08Data, TopicRowView } from '../a08/data';
import { hrefGerer, ownerActions, shortcuts } from '../a08/data';
import {
  a08tFallback,
  annonceVide,
  gestionVide,
  sourdineVide,
  NOTIFIER_SOURDINE,
  type A08TData,
  type AlbumPastilleView,
  type AlbumReseauView,
  type AlbumVignetteView,
  type EvenementReseauView,
  type EvenementsReseauView,
  type GestionReseauView,
  type PhotoAlbumView,
  type SignalementRowView,
  type SourdineView,
} from '../a08t/data';

/**
 * L'ÉTAT DE A08 — un réseau et son onglet Sujets.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEUX APPELS, ET LE SECOND A LE DROIT D'ÊTRE REFUSÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `GET /communities/:slug` passe pour tout le monde — un réseau public se
 * découvre. `GET /communities/:id/topics` ne passe que pour un MEMBRE ACTIF, et
 * répond `403 NOT_A_MEMBER` sinon. Ce n'est pas un cas d'erreur à rattraper :
 * c'est le fonctionnement normal de la moitié des visites.
 *
 * D'où les trois règles de ce fichier :
 *
 *   1. LES DEUX APPELS PARTENT QUAND MÊME. On ne consulte pas `myStatus` pour
 *      décider d'appeler ou non : ce serait remplacer la garde du serveur par
 *      une garde du front, et le jour où les deux diverge­raient, c'est celle du
 *      front qui déciderait. Le serveur reste seul juge ; on lit sa réponse.
 *
 *   2. UN 403 `NOT_A_MEMBER` SUR LES SUJETS N'EST PAS UN ÉCHEC DE PAGE. Il pose
 *      `contenuFerme`, la page reste, et l'écran montre l'invitation à
 *      rejoindre. Le reste des échecs, lui, remonte normalement.
 *
 *   3. ON NE COMBLE RIEN. `topics` reste VIDE sur un refus, et `contenuFerme`
 *      dit pourquoi. La tentation serait d'afficher « aucun sujet pour le
 *      moment » — ce serait apprendre au lecteur que le réseau est mort alors
 *      qu'il est seulement fermé, et ce serait contourner par l'affichage la
 *      règle que le serveur tient.
 *
 * ── LES COMPTEURS DE L'EN-TÊTE SONT MASQUÉS, PAS NULS ──────────────────────
 *
 * Mesuré sur le même réseau PUBLIC à la même seconde : `counters.topics` vaut 1
 * pour un membre et 0 pour un passant, et `pinned` porte un sujet AVEC SON TITRE
 * pour le premier, `[]` pour le second. `compteursFiables` existe pour que
 * l'écran écrive « Rejoignez pour voir » plutôt que « 0 sujet ».
 */
export interface ReseauEtat {
  readonly pret: boolean;
  readonly chargement: boolean;
  /** Les échecs qui font une page cassée. Un refus d'adhésion n'en est pas un. */
  readonly echec: ReseauEchec | null;
  readonly reseau: CommunityDetailResponse | null;
  readonly sujets: TopicsResponse | null;
  readonly data: A08Data;
  /**
   * L'EN-TÊTE QUE LES VINGT-CINQ PLANCHES D'ONGLET LISENT.
   *
   * Distinct de `data` parce que les planches A08T ne sont pas A08 : elles ne
   * lisent ni le rail, ni le panneau, ni les sujets — seulement l'en-tête du
   * réseau. Leur passer `A08Data` les obligerait à déclarer six prises qu'elles
   * ne touchent pas, ce qui est exactement le piège que `A08TData` évite.
   *
   * Tant que l'appel n'est pas revenu, c'est l'en-tête VIDE — jamais un nom de
   * réseau emprunté à la maquette.
   */
  readonly onglet: A08TData;
  /** Le lecteur est membre ACTIF : `INVITED` et `PENDING` ne comptent pas. */
  readonly membre: boolean;
  /**
   * Le contenu a été REFUSÉ — 403 `NOT_A_MEMBER`. Distinct de « vide ».
   *
   * C'est la prise qui empêche l'écran de mentir : `sujets` est vide dans les
   * deux cas, et seul ce booléen dit lequel des deux on regarde.
   */
  readonly contenuFerme: boolean;
  /** Les compteurs de l'en-tête sont-ils dignes de foi ? Même condition que `membre`. */
  readonly compteursFiables: boolean;
  /**
   * « Contacter les modérateurs » — ouvre ou rouvre le fil de groupe, puis
   * navigue vers `/messages/:id`. Voir le bloc de son implémentation.
   */
  readonly contacterModerateurs: () => void;
  /** Un appel de contact est en cours : le bouton s'éteint. */
  readonly contactEnCours: boolean;
  /**
   * Le refus de ce geste SEUL — distinct de `echec`, qui dit « cette page est
   * cassée ». Un réseau automatique sans bénévole refuse par
   * `NO_MODERATORS_TO_CONTACT` et son onglet « À propos » reste parfaitement
   * lisible.
   */
  readonly contactEchec: ReseauEchec | null;
  readonly rejoindre: () => Promise<void>;
  readonly quitter: () => Promise<void>;
  /**
   * LA GESTION ET LA MODÉRATION — les deux listes et les sept gestes.
   *
   * Exposée en plus d'être posée dans `onglet.gerer` : les cadres générés la
   * lisent par là, et un écran qui voudrait la même chose hors cadre — une
   * fenêtre de confirmation, par exemple — n'a pas à traverser `onglet`.
   */
  readonly gerer: GestionReseauView;
  /**
   * LA SOURDINE — §2.5. Exposée en plus d'être posée dans `onglet.sourdine` et
   * `data.sourdine`, pour la même raison que `gerer` : un écran qui voudrait la
   * même chose hors cadre n'a pas à traverser `onglet`.
   */
  readonly sourdine: SourdineView;
  /** `POST /communities/:id/transfer`. Aucune planche ne l'ouvre — voir son en-tête. */
  readonly transferer: (toUserId: string) => Promise<void>;
  /** `POST /communities/:id/reactivate`. Aucune planche ne l'ouvre non plus. */
  readonly reactiver: () => Promise<void>;
  /**
   * L'ÉTAT DE « ÉCRIRE À UN MEMBRE », pour que l'ÉCRAN pose `FenetreEcrire` —
   * une seule fois, hors des deux cadres. Voir `use-ecrire-membre.ts`.
   */
  readonly ecrire: EcrireMembreEtat;
  /**
   * L'ONGLET « ÉVÉNEMENTS » — exposé en plus d'être posé dans
   * `onglet.evenements`, pour la même raison que `gerer` et `sourdine` : l'écran
   * pose `FenetreNiveau` et la bande d'état vide HORS des deux cadres, et il n'a
   * pas à traverser `onglet` pour les lire.
   */
  readonly evenements: EvenementsReseauView;
  /**
   * La liste d'événements est-elle REVENUE ? Distinct de `pret`, qui parle de la
   * FICHE du réseau : la bande « aucun événement » ne doit pas s'afficher pendant
   * que la liste charge, et elle ne doit pas non plus attendre la fiche, qui est
   * déjà là quand cet onglet s'ouvre.
   */
  readonly evenementsPrets: boolean;
  /**
   * L'ONGLET « ALBUM » — exposé en plus d'être posé dans `onglet.album`, pour la
   * même raison que `evenements` : l'écran pose la fenêtre « Nouvel album » et
   * les bandes d'état vide HORS des deux cadres.
   */
  readonly album: AlbumReseauView;
  // ── Le lot « réseau vivant » : l'état des fenêtres posées par l'écran ──────
  /** La confirmation ouverte par l'en-tête : la sourdine ou le départ. */
  readonly confirmation: 'sourdine' | 'quitter' | null;
  readonly onConfirmer: () => void;
  readonly onAnnulerConfirmation: () => void;
  readonly fenetreSujet: {
    readonly ouverte: boolean;
    readonly occupe: boolean;
    readonly onCreer: (titre: string, corps: string) => void;
    readonly onFermer: () => void;
  };
  readonly fenetreEpingler: {
    readonly ouverte: boolean;
    readonly sujets: readonly SujetEpinglable[];
    readonly max: number;
    readonly occupe: boolean;
    readonly onBasculer: (id: string, epingler: boolean) => void;
    readonly onFermer: () => void;
  };
  readonly fenetreEvenement: {
    readonly ouverte: boolean;
    readonly onFermer: () => void;
    readonly onCree: () => void;
  };
  readonly contenuSignale: ContenuSignale | null;
  readonly onFermerContenuSignale: () => void;
  /** L'unique sélecteur de couverture, posé par l'écran hors des cadres. */
  readonly champCouverture: RefObject<HTMLInputElement | null>;
  /** Le composeur du fil, pour ses deux fenêtres (sondage, guides) montées par l'écran. */
  readonly composeur: ComposeurReseauView;
  readonly onFichierCouverture: (e: {
    target: { files: FileList | null; value: string };
  }) => void;
}

export function useReseau(
  slug: string,
  ongletActif = 1,
  /** L'entrée du rail de « Gérer » (`?section=`) — voir `PilotageReseauView`. */
  section: SectionGestion = 'ensemble',
): ReseauEtat {
  const [reseau, setReseau] = useState<CommunityDetailResponse | null>(null);
  const [sujets, setSujets] = useState<TopicsResponse | null>(null);
  const [contenuFerme, setContenuFerme] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [pret, setPret] = useState(false);
  const [echec, setEchec] = useState<ReseauEchec | null>(null);
  const [tick, setTick] = useState(0);

  const reprise = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (slug === '') return;
    const ac = new AbortController();
    let vivant = true;
    setChargement(true);

    void (async () => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }

        /**
         * Les deux EN PARALLÈLE, et `allSettled` plutôt qu'`all`.
         *
         * `all` rejetterait dès que les sujets sont refusés — c'est-à-dire pour
         * tout passant — et la page entière disparaîtrait alors qu'on a
         * parfaitement de quoi afficher l'en-tête et le bouton « Rejoindre ».
         */
        const [fiche, liste] = await Promise.allSettled([
          fetchCommunity(slug, ac.signal),
          fetchTopics(slug, {}, ac.signal),
        ]);
        if (!vivant) return;

        if (fiche.status === 'fulfilled') {
          setReseau(fiche.value);
          setEchec(null);
        } else {
          setEchec(echecDe(fiche.reason));
        }

        if (liste.status === 'fulfilled') {
          setSujets(liste.value);
          setContenuFerme(false);
        } else {
          const e = echecDe(liste.reason);
          setSujets(null);
          /**
           * UN REFUS N'EST PAS UNE ABSENCE. On note qu'il est fermé, et on ne
           * remplace surtout pas la liste par un tableau vide présenté comme
           * une liste réelle.
           */
          setContenuFerme(e.notMember);
          // Tout autre échec sur les sujets est un vrai échec — sauf si la fiche
          // a elle-même échoué, auquel cas son message est le plus utile.
          if (!e.notMember && fiche.status === 'fulfilled') setEchec(e);
        }
      } catch (e) {
        if (ac.signal.aborted || !vivant) return;
        setEchec(echecDe(e));
      } finally {
        if (vivant) {
          setChargement(false);
          setPret(true);
        }
      }
    })();

    return () => {
      vivant = false;
      ac.abort();
    };
  }, [slug, tick]);

  const membre = reseau !== null && communityIsOpen(reseau);

  /**
   * LES DEUX COMPTEURS DE LA VUE PROPRIÉTAIRE, et pourquoi ils sont à part.
   *
   * La maquette écrit « vous gérez ce réseau avec 2 modérateurs » et pose une
   * pastille de demandes d'adhésion sur l'onglet « Membres ». Aucun des deux
   * nombres n'est dans `GET /communities/:slug` : il faut
   * `GET /communities/:id/members?role=MODERATOR` et `?pending=true`.
   *
   * TROIS GARDES, et chacune a une raison mesurée :
   *
   *   1. ON N'APPELLE QUE SI ON EST MODÉRATEUR OU PROPRIÉTAIRE. Ce n'est pas
   *      remplacer la garde du serveur par celle du front — `?pending=true`
   *      répond `403 MODERATOR_REQUIRED` de toute façon — c'est éviter deux
   *      appels refusés sur CHAQUE visite de membre ordinaire.
   *
   *   2. LE NOMBRE N'EST RETENU QUE SI LA PAGE EST ENTIÈRE. La route est un
   *      `pageSchema` SANS `meta` : il n'y a aucun total, et `items.length` sur
   *      une page tronquée serait un compte FAUX affiché comme un compte. Quand
   *      `nextCursor` n'est pas nul, on garde zéro — la pastille disparaît, ce
   *      qui est moins grave qu'un chiffre inventé. REMONTÉ : il faudrait un
   *      `meta.count` sur cette route.
   *
   *   3. UN ÉCHEC NE CASSE PAS LA PAGE. Ces deux nombres sont une décoration de
   *      l'en-tête ; les perdre ne justifie pas de faire disparaître l'onglet.
   */
  const [compteurs, setCompteurs] = useState({ moderateurs: 0, demandes: 0 });

  /**
   * ── LES DEUX LISTES QUE LA GESTION DESSINE, EN PLUS DES DEUX NOMBRES ──────
   *
   * Cet effet ne rendait que des COMPTES, et il jetait les listes qui les
   * avaient produits. Les planches de gestion en ont besoin ligne par ligne :
   * « Gérer » dessine deux demandes d'adhésion avec leurs boutons
   * « Accepter » / « Refuser », et « Membres — propriétaire » cinq membres avec
   * leur menu. Sans l'identifiant de chaque ligne, les onze boutons dessinés ne
   * peuvent viser personne : c'est pour cela qu'ils étaient inertes.
   *
   * UN TROISIÈME APPEL, et pas une réutilisation du premier : `?role=MODERATOR`
   * ne rend QUE les modérateurs, et la planche « Membres » dessine tout le
   * monde — propriétaire, modérateurs, membres. Les deux listes ne se déduisent
   * pas l'une de l'autre.
   */
  const [demandes, setDemandes] = useState<readonly CommunityMember[]>([]);
  /** Les publications qui attendent la validation de l'équipe. */
  const [enAttente, setEnAttente] = useState<readonly PendingPost[]>([]);
  /**
   * ⚠ LA LISTE DES MEMBRES A SON PROPRE EFFET, HORS DE LA GARDE DE RÔLE.
   *
   * Elle était chargée dans l'effet ci-dessous, qui ne tourne QUE pour un
   * propriétaire ou un modérateur — et les deux planches de la vue MEMBRE
   * peignaient donc leurs cinq et quatre lignes en dur, sur tous les réseaux du
   * produit. Le porteur : « L'onglet des membres aussi n'est pas dynamique. »
   *
   * MESURÉ DANS LE SERVICE, pas supposé : `GET /communities/:id/members` n'exige
   * qu'`assertMember` ; `assertModerator` n'y est posé que par `?pending=true`.
   * Rien ne justifiait de réserver la liste à l'équipe.
   *
   * C'est la même correction que le FIL a reçue juste en dessous, et pour la
   * même raison écrite dans sa note : « le fil et son annonce sont ce que TOUT
   * MEMBRE voit en arrivant sur le réseau ».
   */
  const [membres, setMembres] = useState<readonly CommunityMember[]>([]);
  /**
   * ── LA FILE DE SIGNALEMENTS ET L'ANNONCE ÉPINGLÉE ───────────────────────
   *
   * Deux appels de plus dans le MÊME effet, et sous la MÊME garde de rôle :
   * `GET /communities/:id/reports` répond `403 MODERATOR_REQUIRED` à un membre
   * ordinaire, et `GET /communities/:id/announcements` lui répond `403
   * NOT_A_MEMBER` s'il n'est pas membre actif.
   *
   * ⚠ L'ANNONCE ÉPINGLÉE EST SOUS LA GARDE DE RÔLE ALORS QUE LA ROUTE NE LA
   * DEMANDE PAS, et c'est délibéré : la carte verte du haut du fil est dessinée
   * sur les DEUX vues, mais seule celle du propriétaire porte « Désépingler ».
   * ⚠ CONSÉQUENCE REMONTÉE : sur la vue MEMBRE, la carte garde donc le texte de
   * la maquette. Brancher son texte pour tout le monde demandait un troisième
   * appel sur chaque visite de membre ordinaire, pour une carte dont la vue
   * membre ne fait rien — c'est un lot à part, et il faudrait plutôt que
   * `GET /communities/:slug` porte l'annonce épinglée comme il porte `pinned`
   * pour les sujets.
   *
   * `ouverts` est gardé À PART de la liste, et c'est `meta.open` : la réponse est
   * bornée à cinquante rangées, et `signalements.length` serait un compte faux
   * affiché comme un compte sur un réseau qui en aurait davantage.
   */
  const [signalements, setSignalements] = useState<readonly CommunityReport[]>([]);
  const [ouverts, setOuverts] = useState(0);
  const [epinglee, setEpinglee] = useState<Announcement | null>(null);
  /**
   * LES PUBLICATIONS DU FIL DU RÉSEAU. Vides tant qu'on n'est pas sur l'onglet
   * « Fil », et vides pour un passant : voir l'effet qui les charge.
   */
  const [publications, setPublications] = useState<readonly FeedPostView[]>([]);

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ L'ONGLET « ÉVÉNEMENTS » — SA PASTILLE, SA LISTE, SON RSVP              ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * `pastille` est l'état des DEUX `<span>` que la maquette dessine au-dessus de
   * la liste, et qui étaient inertes. Elle vit ici et non dans l'écran parce
   * qu'elle décide de la REQUÊTE : c'est elle qui ajoute `?to=hier`.
   *
   * `aVenir` est l'état de départ, et c'est la maquette qui le dit — c'est la
   * pastille qu'elle dessine ACTIVE sur les quatre cadres.
   */
  const [pastille, setPastille] = useState<'avenir' | 'passes'>('avenir');
  const [evenements, setEvenements] = useState<readonly EvenementReseauView[]>([]);
  const [evenementsPrets, setEvenementsPrets] = useState(false);
  const [rsvpEnVol, setRsvpEnVol] = useState(false);
  const [niveauRefuse, setNiveauRefuse] = useState<Capability | null>(null);
  const [evenementsEchec, setEvenementsEchec] = useState<string | null>(null);

  useEffect(() => {
    const role = reseau?.myRole;
    if (reseau === null || (role !== 'OWNER' && role !== 'MODERATOR')) {
      setCompteurs({ moderateurs: 0, demandes: 0 });
      setEnAttente([]);
      setDemandes([]);
      setSignalements([]);
      setOuverts(0);
      return;
    }
    const ac = new AbortController();
    let vivant = true;
    void (async () => {
      const [mods, attente, files, publicationsEnAttente] = await Promise.allSettled([
        fetchMembers(slug, { role: 'MODERATOR' }, ac.signal),
        fetchPendingMembers(slug, undefined, ac.signal),
        fetchCommunityReports(slug, ac.signal),
        // La file de validation (« Validation des nouvelles publications »).
        fetchPendingPosts(slug, ac.signal),
      ]);
      if (!vivant) return;
      setEnAttente(
        publicationsEnAttente.status === 'fulfilled' ? publicationsEnAttente.value.items : [],
      );

      /**
       * UN ÉCHEC SUR L'UN DES QUATRE NE CASSE PAS LA PAGE — `allSettled`, comme
       * les trois d'origine. La file de signalements est une carte de la vue de
       * gestion ; la perdre ne justifie pas de faire disparaître l'onglet.
       *
       * ⚠ ILS ÉTAIENT CINQ, PUIS QUATRE, ET ILS SONT TROIS : les ANNONCES sont
       * parties dans leur propre effet, puis LA LISTE DES MEMBRES dans le sien.
       * Ni l'une ni l'autre n'avait sa place ici — cet effet-ci ne tourne que
       * pour un propriétaire ou un modérateur, alors que l'annonce épinglée est
       * dessinée en haut du fil de TOUT MEMBRE et que l'onglet « Membres » est
       * dessiné pour les DEUX vues.
       */
      setSignalements(files.status === 'fulfilled' ? files.value.items : []);
      setOuverts(files.status === 'fulfilled' ? files.value.meta.open : 0);
      const exact = (r: PromiseSettledResult<{ items: readonly unknown[]; nextCursor: string | null }>) =>
        r.status === 'fulfilled' && r.value.nextCursor === null ? r.value.items.length : 0;
      setCompteurs({ moderateurs: exact(mods), demandes: exact(attente) });
      /**
       * LES LISTES, ELLES, SONT GARDÉES MÊME TRONQUÉES — et c'est l'inverse de
       * la règle des compteurs, pour une raison qui n'est pas une exception.
       *
       * Un COMPTE tronqué est faux : « 4 demandes » quand il y en a douze est
       * une affirmation erronée. Une LISTE tronquée est juste mais incomplète :
       * les quatre lignes affichées existent vraiment, et leurs boutons visent
       * les bonnes personnes. La maquette n'en dessine d'ailleurs que deux.
       * REMONTÉ, comme le `meta.count` : il faudrait un « voir la suite » que la
       * planche ne dessine pas.
       */
      setDemandes(attente.status === 'fulfilled' ? attente.value.items : []);
    })();
    return () => {
      vivant = false;
      ac.abort();
    };
  }, [slug, reseau, tick]);

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LA LISTE DES MEMBRES — POUR LES QUATRE PLANCHES DE L'ONGLET            ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * UN EFFET À PART, et non un appel de plus dans celui d'au-dessus : voir la
   * note de `membres`. Celui-là ne tourne que pour l'équipe ; l'onglet
   * « Membres » est dessiné pour les DEUX vues, et sa route n'exige qu'une
   * adhésion active.
   *
   * ── IL NE TOURNE QUE SUR L'ONGLET « MEMBRES », ET LA CONSTANTE EXISTAIT ──
   *
   * `RANG_ONGLET_MEMBRES` était DÉCLARÉE et n'était employée NULLE PART —
   * compté : une seule occurrence dans tout le dépôt, sa déclaration. Son
   * commentaire affirmait pourtant « `useReseau` ne charge la liste des membres
   * que sur cet onglet-là », ce qui était faux : l'effet de rôle la chargeait
   * sur les six. L'en-tête avait survécu à la décision qu'il décrivait (mémo
   * §2) ; il redevient vrai ici.
   *
   * Le rang est DÉRIVÉ de la table des onglets, jamais écrit à la main : un `3`
   * en dur se mettrait à suivre « Album » dès qu'on insérerait un onglet.
   *
   * ── ET SEULEMENT POUR UN MEMBRE ACTIF ───────────────────────────────────
   *
   * `membre` exige `ACTIVE` : la route répond `403 NOT_A_MEMBER` à un passant,
   * et `contenuFerme` dit déjà au lecteur ce qu'il faut savoir. L'appeler pour
   * lui ferait un refus à chaque ouverture.
   *
   * ── LA LISTE EST GARDÉE MÊME TRONQUÉE ───────────────────────────────────
   *
   * Même arbitrage que les demandes, et sa note le détaille : une LISTE
   * tronquée est juste mais incomplète — les lignes affichées existent
   * vraiment — là où un COMPTE tronqué est faux. REMONTÉ : la planche ne
   * dessine aucun « voir la suite », et `GET /communities/:id/members` pagine
   * par curseur. Au-delà de la première page, l'onglet ne montre pas tout.
   */
  /**
   * ── LA RECHERCHE ET LE FILTRE DE L'ONGLET « MEMBRES » ────────────────────
   *
   * Le porteur : « la recherche ne marche pas […] Aussi les filtres. »
   * `memberListQuerySchema` porte `q` (pseudo OU nom affiché, voir le service)
   * et `role`. La saisie est DIFFÉRÉE de 300 ms : une requête par frappe
   * enverrait sept appels pour « Aïcha D », et les réponses pourraient
   * revenir dans le désordre — l'`AbortController` de l'effet annule la
   * précédente, mais seulement si elle n'est pas déjà arrivée.
   */
  const [rechercheMembres, setRechercheMembres] = useState('');
  const [rechercheDifferee, setRechercheDifferee] = useState('');
  const [seulsModerateurs, setSeulsModerateurs] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setRechercheDifferee(rechercheMembres.trim());
    }, 300);
    return () => {
      window.clearTimeout(t);
    };
  }, [rechercheMembres]);

  useEffect(() => {
    const actif = reseau !== null && reseau.myStatus === 'ACTIVE';
    if (!actif || ongletActif !== RANG_ONGLET_MEMBRES) {
      setMembres([]);
      return;
    }
    const ac = new AbortController();
    let vivant = true;
    void (async () => {
      try {
        const tous = await fetchMembers(
          slug,
          {
            ...(rechercheDifferee === '' ? {} : { q: rechercheDifferee.slice(0, 40) }),
            ...(seulsModerateurs ? { role: 'MODERATOR' as const } : {}),
          },
          ac.signal,
        );
        if (vivant) setMembres(tous.items);
      } catch {
        /**
         * UN ÉCHEC NE CASSE PAS L'ONGLET, et il ne remonte pas dans `echec` :
         * `echec` fait une PAGE cassée, et l'en-tête du réseau, sa barre
         * d'onglets et son contexte restent parfaitement lisibles. L'écran dit
         * qu'il n'a aucun membre à montrer — voir la bande de `reseau-screen`.
         */
        if (vivant) setMembres([]);
      }
    })();
    return () => {
      vivant = false;
      ac.abort();
    };
  }, [slug, reseau, ongletActif, tick, rechercheDifferee, seulsModerateurs]);

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LE FIL DU RÉSEAU — SES PUBLICATIONS ET SON ANNONCE ÉPINGLÉE             ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * UN EFFET À PART, et non deux appels de plus dans celui d'au-dessus — qui ne
   * tourne QUE pour un propriétaire ou un modérateur. Le fil et son annonce sont
   * ce que TOUT MEMBRE voit en arrivant sur le réseau : les charger là-haut les
   * aurait réservés à l'équipe, ce qui est précisément le défaut que ce lot
   * corrige.
   *
   * ── IL NE TOURNE QUE SUR L'ONGLET « FIL » ───────────────────────────
   *
   * Même arbitrage que `RANG_ONGLET_MEMBRES` et sa note : deux appels de plus sur
   * chacun des cinq autres onglets seraient du gaspillage pur. Le rang est DÉRIVÉ
   * de la table des onglets, jamais écrit à la main — un `0` en dur se mettrait à
   * suivre un autre onglet dès qu'on en insérerait un.
   *
   * ── ET SEULEMENT POUR UN MEMBRE ─────────────────────────────────
   *
   * Mesuré : les deux routes répondent `403 FORBIDDEN` avec
   * `details.reason = "NOT_A_MEMBER"` à un passant — relevé tel quel sur
   * `GET /communities/:id/announcements` et sur le fil filtré. Les appeler pour
   * lui ferait deux refus à chaque ouverture, et `contenuFerme` dit déjà au
   * lecteur ce qu'il faut savoir.
   *
   * ── LA ROUTE DU FIL EST `GET /feed?communityId=…` ───────────────────
   *
   * ⚠ ET NON `GET /communities/:id/feed`, qui paraît faite pour cela. Mesuré sur
   * le même réseau, à la même seconde : la seconde rend sept champs bruts
   * (`id`, `type`, `body`, `createdAt`, deux compteurs, `author`), la première
   * rend la carte entière — `typeLabel`, `context`, `counter.word`,
   * `reaction.actionLabel`, `media`, `poll`, `bookmarked`, `isAuthor`. La carte
   * du fil ne peut être nourrie que par la seconde, et `communityFeedPostSchema`
   * l'écrit lui-même : le front ne recompose PAS le vocabulaire.
   *
   * C'est le même chemin que l'onglet « Fil » du profil public (`?authorHandle=`),
   * et `feedQuerySchema` dit pourquoi : « une route résumée ne peut pas nourrir la
   * carte ; on filtre donc LE FIL LUI-MÊME ».
   *
   * ── UN ÉCHEC NE CASSE PAS L'ONGLET ──────────────────────────────
   *
   * `allSettled`, comme l'effet d'au-dessus : l'annonce épinglée est une carte,
   * la perdre ne justifie pas de faire disparaître le fil — ni l'inverse.
   */
  useEffect(() => {
    /**
     * ⚠ `myStatus === 'ACTIVE'` ET NON `myRole !== null` — c'était la garde des
     * trois effets de contenu (fil, événements, album), et elle laissait passer
     * une demande en ATTENTE : `myRole` y vaut déjà `MEMBER`. MESURÉ au
     * navigateur après « Demander à rejoindre » : `GET /feed?communityId=` en
     * 404 et `GET /communities/:id/announcements` en 403, deux fois chacun.
     */
    const membreDuReseau = reseau !== null && reseau.myStatus === 'ACTIVE';
    if (!membreDuReseau || ongletActif !== RANG_ONGLET_FIL) {
      setPublications([]);
      setEpinglee(null);
      return;
    }
    const ac = new AbortController();
    let vivant = true;
    void (async () => {
      const [fil, annonces] = await Promise.allSettled([
        fetchFeed({ communityId: reseau.id, limit: 20 }, ac.signal),
        fetchAnnouncements(slug, undefined, ac.signal),
      ]);
      if (!vivant) return;
      setPublications(fil.status === 'fulfilled' ? feedPostsFrom(fil.value) : []);
      /**
       * L'ANNONCE ÉPINGLÉE EST CELLE DONT `pinnedAt` N'EST PAS NUL, et il n'y en
       * a qu'une : le service tient l'exclusivité (il déépingle les autres dans
       * la même transaction). On prend donc la première trouvée, et `find`
       * plutôt que `filter[0]` dit qu'on n'en attend qu'une.
       */
      setEpinglee(
        annonces.status === 'fulfilled'
          ? (annonces.value.items.find((a) => a.pinnedAt !== null) ?? null)
          : null,
      );
    })();
    return () => {
      vivant = false;
      ac.abort();
    };
  }, [slug, reseau, ongletActif, tick]);

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LES ÉVÉNEMENTS DU RÉSEAU — POUR LES QUATRE PLANCHES DE L'ONGLET        ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * UN EFFET À PART, comme celui du fil et celui des membres, et pour une raison
   * de plus que les leurs : il se relance à chaque bascule de PASTILLE
   * (« À venir » / « Passés »), ce que ni le fil ni la liste des membres ne font.
   * Le ranger avec eux aurait rechargé le fil à chaque clic sur une pastille.
   *
   * ── IL NE TOURNE QUE SUR L'ONGLET « ÉVÉNEMENTS » ────────────────────────
   *
   * Même arbitrage que `RANG_ONGLET_FIL` et `RANG_ONGLET_MEMBRES`, et le rang est
   * DÉRIVÉ de la table des onglets : un `2` écrit à la main se mettrait à suivre
   * « Membres » dès qu'on insérerait un onglet.
   *
   * ── ET SEULEMENT POUR UN MEMBRE ─────────────────────────────────────────
   *
   * ⚠ ET CE N'EST PAS LA MÊME RAISON QUE POUR LE FIL. La route ne REFUSE pas un
   * passant : `GET /events?communityId=` répond `200` avec une liste VIDE, parce
   * que le filtre s'ajoute à la règle dure §10 au lieu de la remplacer (c'est
   * écrit sur `eventsQuerySchema`). Un appel pour un passant ne serait donc pas
   * un refus, il serait un appel INUTILE dont le résultat ne peut rien dire — et
   * une liste vide affichée à un passant lui apprendrait que le réseau n'a aucun
   * événement, alors que le serveur a justement refusé de le dire. `contenuFerme`
   * et l'invitation à rejoindre disent déjà ce qu'il faut savoir.
   *
   * ── LE JOUR « HIER » EST CALCULÉ DANS LE FUSEAU DU NAVIGATEUR ───────────
   *
   * ⚠ ÉCART CONSIGNÉ : le serveur, lui, construit sa fenêtre dans le fuseau de
   * RÉFÉRENCE du lecteur (sa ville, puis son fuseau déclaré). Les deux ne
   * coïncident pas pour un membre qui voyage, et l'écart vaut au plus un jour sur
   * la frontière entre les deux listes. On ne peut pas faire mieux d'ici : ce
   * fuseau n'est porté par aucune réponse de cette route — `GET /events` n'a pas
   * de `meta`, et c'est relevé dans `eventsResponseSchema`. REMONTÉ :
   * `/events/calendar` rend `meta.timeZone`, cette route pourrait le faire aussi.
   */
  useEffect(() => {
    const membreDuReseau = reseau !== null && reseau.myStatus === 'ACTIVE';
    if (!membreDuReseau || ongletActif !== RANG_ONGLET_EVENEMENTS) {
      setEvenements([]);
      setEvenementsPrets(false);
      return;
    }
    const ac = new AbortController();
    let vivant = true;
    setEvenementsPrets(false);
    void (async () => {
      try {
        const page = await fetchCommunityEvents(
          reseau.id,
          /**
           * « Passés » borne au jour d'HIER, « À venir » n'envoie aucune borne :
           * la frontière est donc le début d'aujourd'hui, et les deux listes ne
           * se recouvrent pas. Voir l'en-tête de `fetchCommunityEvents`.
           *
           * `limit: 50` : la maquette ne dessine aucun « voir la suite », et
           * cinquante est la borne que les autres listes de ce fichier emploient
           * déjà. REMONTÉ, comme pour les membres et les demandes : au-delà,
           * l'onglet ne montre pas tout.
           */
          pastille === 'passes' ? { to: jourHier(), limit: 50 } : { limit: 50 },
          ac.signal,
        );
        if (!vivant) return;
        setEvenements(evenementsReseauFrom(page.items));
        setEvenementsEchec(null);
      } catch (e) {
        /**
         * UN ÉCHEC NE CASSE PAS L'ONGLET, et il ne remonte pas dans `echec` :
         * `echec` fait une PAGE cassée, et l'en-tête du réseau, sa barre
         * d'onglets et son contexte restent parfaitement lisibles. Même
         * arbitrage que la liste des membres, à une différence près : ici le
         * message est MONTRÉ, parce qu'une liste vide et une liste perdue se
         * ressemblent, et que l'écran a déjà une bande pour le dire.
         */
        if (vivant) {
          setEvenements([]);
          setEvenementsEchec(echecDe(e).message);
        }
      } finally {
        if (vivant) setEvenementsPrets(true);
      }
    })();
    return () => {
      vivant = false;
      ac.abort();
    };
  }, [reseau, ongletActif, pastille, tick]);

  /**
   * « JE VIENS » — on TENTE, et le serveur tranche.
   *
   * ⚠ AUCUN `if (niveau >= 2)` : `event.attend` est en N2, et le front PRÉVIENT
   * sans autoriser (00 §5). Un refus `403 LEVEL_REQUIRED` pose `niveauRefuse`,
   * et c'est `components/fenetre-niveau.tsx` — posé une seule fois par l'écran —
   * qui écrit le niveau exigé, la fonctionnalité et les conditions, tous lus sur
   * la table que le SERVEUR applique.
   *
   * La capacité posée est écrite en clair et non lue dans `details.capability` :
   * c'est la capacité de CETTE route, le contrôleur la déclare
   * (`@RequiresCapability('event.attend')`), et `Capability` est un type fermé —
   * une chaîne venue du réseau ne s'y rangerait pas sans une assertion.
   *
   * ── LA LISTE SE RECHARGE, ELLE N'EST PAS RAPIÉCÉE ─────────────────────────
   *
   * `tick` relance l'effet ci-dessus. La réponse du RSVP ne porte pas `myStatus`
   * — voir l'en-tête de `rsvpEvent` — et trois choses du dessin en dépendent : la
   * pastille « Vous y allez », la couleur de la pastille de date et le libellé du
   * bouton. Rapiécer deux d'entre elles et pas la troisième est exactement le
   * genre de demi-branchement que ce dépôt refuse.
   */
  const jeViens = useCallback(
    (eventId: string) => {
      if (rsvpEnVol) return;
      setRsvpEnVol(true);
      setEvenementsEchec(null);
      void (async () => {
        try {
          await rsvpEvent(eventId);
          setTick((n) => n + 1);
        } catch (e) {
          const refus = echecDe(e);
          if (refus.levelRequired !== null) setNiveauRefuse('event.attend');
          else setEvenementsEchec(refus.message);
        } finally {
          setRsvpEnVol(false);
        }
      })();
    },
    [rsvpEnVol],
  );

  const vueEvenements: EvenementsReseauView = useMemo(
    () => ({
      onglet: pastille,
      onAVenir: () => {
        setPastille('avenir');
      },
      onPasses: () => {
        setPastille('passes');
      },
      liste: evenements,
      /**
       * ÉTEINT TANT QUE LA LISTE N'EST PAS LÀ, et pendant un RSVP.
       *
       * Même arbitrage que `gerer.occupe` : la planche dessine un bouton par
       * carte, et s'inscrire à deux événements se fait l'un après l'autre.
       */
      occupe: rsvpEnVol || !evenementsPrets,
      onJeViens: jeViens,
      niveauRefuse,
      onFermerNiveau: () => {
        setNiveauRefuse(null);
      },
      echec: evenementsEchec,
    }),
    [pastille, evenements, evenementsPrets, rsvpEnVol, jeViens, niveauRefuse, evenementsEchec],
  );


  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ L'ONGLET « ALBUM » — SES PASTILLES, SA GRILLE, SON BOUTON « AJOUTER »  ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * UN EFFET À PART, comme ceux du fil, des membres et des événements, et pour
   * la même raison que celui des événements : il se relance à chaque création
   * d'album et à chaque photo déposée (`albumTick`), ce que ni le fil ni la
   * liste des membres ne font. Le ranger avec eux aurait rechargé le fil à
   * chaque image ajoutée.
   *
   * ── DEUX APPELS, ET LE SECOND N'EST PAS UN ALBUM ────────────────────────
   *
   * `GET /communities/:id/albums` rend les albums et LEURS PHOTOS — relevé sur
   * `albumSchema` : `photos[]` avec `url`, plus `photoCount` et `eventId`. Il
   * n'y manque rien pour les trois onglets, et c'est pour cela que ce lot
   * n'ajoute AUCUNE route et AUCUNE colonne.
   *
   * `GET /feed?communityId=` rend les PUBLICATIONS, dont `media` : c'est la
   * source de l'onglet « Partagés », qui n'est pas une ligne de la table
   * `albums`. ⚠ ET NON `GET /communities/:id/feed`, pour la raison déjà écrite
   * sur `A08TData.publications` : `communityFeedPostSchema` ne porte que sept
   * champs bruts, SANS `media`. Le front n'a pas le droit de recomposer ce que
   * le serveur ne dit pas.
   *
   * `allSettled` : perdre les publications ne justifie pas de faire disparaître
   * les albums, ni l'inverse — même arbitrage que l'effet du fil.
   *
   * ── ET SEULEMENT POUR UN MEMBRE ─────────────────────────────────────────
   *
   * `GET /communities/:id/albums` REFUSE un passant en `403 NOT_A_MEMBER`
   * (`assertMember` dans le service, et un cas d'intégration le tient). Appeler
   * pour un passant ne donnerait qu'un refus, et `contenuFerme` dit déjà ce
   * qu'il faut savoir.
   */
  const [albums, setAlbums] = useState<readonly Album[]>([]);
  const [partagees, setPartagees] = useState<readonly PhotoAlbumView[]>([]);
  const [albumPret, setAlbumPret] = useState(false);
  const [albumOnglet, setAlbumOnglet] = useState<string>(ALBUM_TOUT);
  const [albumMenu, setAlbumMenu] = useState(false);
  const [albumFenetre, setAlbumFenetre] = useState(false);
  const [albumEnVol, setAlbumEnVol] = useState(false);
  const [albumEchec, setAlbumEchec] = useState<string | null>(null);
  const [albumTick, setAlbumTick] = useState(0);

  useEffect(() => {
    const membreDuReseau = reseau !== null && reseau.myStatus === 'ACTIVE';
    if (!membreDuReseau || ongletActif !== RANG_ONGLET_ALBUM) {
      setAlbums([]);
      setPartagees([]);
      setAlbumPret(false);
      return;
    }
    const ac = new AbortController();
    let vivant = true;
    setAlbumPret(false);
    void (async () => {
      const [lesAlbums, leFil] = await Promise.allSettled([
        fetchAlbums(reseau.id, ac.signal),
        /**
         * `limit: 50` — la MÊME borne que les autres listes de ce fichier, et
         * elle borne ici des PUBLICATIONS, non des images : chacune peut en
         * porter quatre (§2.4), donc jusqu'à deux cents tuiles. REMONTÉ : la
         * maquette ne dessine aucun « voir la suite », et au-delà l'onglet
         * « Partagés » ne montre pas tout.
         */
        fetchFeed({ communityId: reseau.id, limit: 50 }, ac.signal),
      ]);
      if (!vivant) return;
      setAlbums(lesAlbums.status === 'fulfilled' ? lesAlbums.value.items : []);
      setPartagees(
        leFil.status === 'fulfilled' ? photosPartageesFrom(leFil.value.items) : [],
      );
      /**
       * UN ÉCHEC D'ALBUMS SE DIT, celui du fil NON, et la différence est dans ce
       * que le lecteur peut en conclure : sans les albums, la grille est vide et
       * « aucune photo » serait un mensonge ; sans le fil, seule la pastille
       * « Partagés » est vide, et sa phrase d'état vide dit déjà la vérité du
       * point de vue du lecteur. Même arbitrage que l'onglet « Événements », où
       * le message est montré parce qu'une liste vide et une liste perdue se
       * ressemblent.
       */
      setAlbumEchec(
        lesAlbums.status === 'rejected' ? echecDe(lesAlbums.reason).message : null,
      );
      setAlbumPret(true);
    })();
    return () => {
      vivant = false;
      ac.abort();
    };
  }, [reseau, ongletActif, albumTick]);

  /**
   * L'IDENTIFIANT D'UN ALBUM QU'ON VIENT DE CRÉER, et qui n'est PAS encore dans
   * `albums`.
   *
   * ⚠ MESURÉ AU NAVIGATEUR, et c'est la raison d'être de cette référence : après
   * « Créer l'album », la pastille choisie était immédiatement RAMENÉE à « Tout »
   * par l'effet ci-dessous — la liste n'avait pas encore été rechargée, donc
   * l'album venait d'être créé ET passait pour disparu. Le symptôme ne désignait
   * pas la cause : « Ajouter une image » restait ÉTEINTE sur l'album qu'on venait
   * de créer, ce qui se lit comme un défaut de droits.
   *
   * Un `useRef` et non un état : sa valeur ne doit déclencher AUCUN rendu — elle
   * ne décrit rien à l'écran, seulement le fait qu'un rechargement est attendu.
   */
  const albumAttendu = useRef<string | null>(null);

  /**
   * LA PASTILLE CHOISIE RETOMBE SUR « Tout » QUAND SON ALBUM DISPARAÎT.
   *
   * Un album supprimé par un autre modérateur, ou un réseau dont on change sans
   * remonter la page, laisserait `albumOnglet` sur un identifiant que
   * `albumPhotosFrom` ne trouve plus — c'est-à-dire une grille vide sous une
   * pastille qui n'existe plus dans la rangée. Le rang ne sert à rien ici : les
   * trois onglets par défaut sont des CLÉS, pas des positions.
   *
   * ⚠ SAUF POUR UN ALBUM QU'ON VIENT DE CRÉER : voir `albumAttendu` juste
   * au-dessus. On attend que la liste rechargée le porte, et c'est CETTE arrivée
   * qui lève l'exemption — pas un délai.
   */
  useEffect(() => {
    if (albumOnglet === ALBUM_TOUT) return;
    if (albumOnglet === ALBUM_PARTAGES || albumOnglet === ALBUM_EVENEMENTS) return;
    if (albums.some((a) => a.id === albumOnglet)) {
      albumAttendu.current = null;
      return;
    }
    if (albumAttendu.current === albumOnglet) return;
    setAlbumOnglet(ALBUM_TOUT);
  }, [albums, albumOnglet]);

  const pastilles: readonly AlbumPastilleView[] = useMemo(
    () => albumPastillesFrom(albums),
    [albums],
  );

  const vignettes: readonly AlbumVignetteView[] = useMemo(
    () => albumVignettesFrom(albums),
    [albums],
  );

  const photosAlbum = useMemo(
    () => albumPhotosFrom(albums, partagees, albumOnglet),
    [albums, partagees, albumOnglet],
  );

  /**
   * « AJOUTER UNE IMAGE » — DEUX APPELS, ET DANS CET ORDRE.
   *
   * `POST /media` avec `kind=ALBUM` d'abord, `POST /albums/:id/photos` ensuite
   * avec l'identifiant rendu. C'est le chemin que `use-editeur-guide.ts` a déjà
   * établi pour les images d'un guide — imité, pas réinventé — et le service
   * l'exige : `addPhoto` ne retient qu'un média `kind: 'ALBUM'`, `status:
   * 'READY'` et dont `ownerUserId` est l'appelant.
   *
   * ⚠ AUCUN CONTRÔLE DE NIVEAU : `post.create` est en N1 et le front PRÉVIENT
   * sans autoriser (00 §5). On tente, le serveur refuse, et le refus s'écrit
   * dans la bande d'échec de l'onglet. ⚠ ET IL N'OUVRE PAS `FenetreNiveau` :
   * `niveauRefuse` est l'état de l'onglet « Événements », et deux onglets qui
   * partagent une fenêtre ouvriraient celle de l'autre. REMONTÉ.
   */
  const onImageAlbum = useCallback(
    (e: { target: { files: FileList | null; value: string } }) => {
      const fichier = e.target.files?.[0];
      // La valeur est remise à vide pour que RECHOISIR LE MÊME FICHIER relance
      // un `change` : sans cela, un dépôt échoué ne pourrait pas être retenté.
      e.target.value = '';
      if (fichier === undefined || albumEnVol) return;
      // Les trois clés dérivées ne désignent aucun album : rien à accrocher.
      if (
        albumOnglet === ALBUM_TOUT ||
        albumOnglet === ALBUM_PARTAGES ||
        albumOnglet === ALBUM_EVENEMENTS
      ) {
        return;
      }
      setAlbumEnVol(true);
      setAlbumEchec(null);
      setAlbumMenu(false);
      void (async () => {
        try {
          const media = await uploadAlbumImage(fichier);
          await addAlbumPhoto(albumOnglet, media.id);
          setAlbumTick((n) => n + 1);
        } catch (cause) {
          setAlbumEchec(echecDe(cause).message);
        } finally {
          setAlbumEnVol(false);
        }
      })();
    },
    [albumOnglet, albumEnVol],
  );

  /**
   * « AJOUTER UN ALBUM » — `POST /communities/:id/albums`.
   *
   * LA NOUVELLE PASTILLE DEVIENT L'ONGLET COURANT, et c'est ce qui rend
   * « Ajouter une image » atteignable : elle est ÉTEINTE dans les trois vues
   * dérivées, donc un modérateur qui crée un album et resterait sur « Tout »
   * devrait deviner qu'il faut d'abord cliquer sa pastille.
   */
  const onCreerAlbum = useCallback(
    (titre: string) => {
      if (albumEnVol) return;
      setAlbumEnVol(true);
      setAlbumEchec(null);
      void (async () => {
        try {
          const cree = await createAlbum(slug, titre);
          setAlbumFenetre(false);
          // La marque AVANT la sélection : l'effet de repli lit la référence, et
          // elle doit déjà porter l'identifiant quand il s'exécute.
          albumAttendu.current = cree.id;
          setAlbumOnglet(cree.id);
          setAlbumTick((n) => n + 1);
        } catch (cause) {
          setAlbumEchec(echecDe(cause).message);
        } finally {
          setAlbumEnVol(false);
        }
      })();
    },
    [slug, albumEnVol],
  );

  const moderateur = reseau?.myRole === 'OWNER' || reseau?.myRole === 'MODERATOR';
  /**
   * LE BOUTON « AJOUTER » DE L'ALBUM : l'équipe, ou tout membre actif quand le
   * réseau a allumé « Album ouvert aux membres » (Gérer · Paramètres). Le
   * serveur tient la même règle (`ALBUM_RESTRICTED`) : ceci ne fait qu'éviter
   * de proposer un geste certain d'être refusé.
   */
  const ajoutPhotosOuvert =
    moderateur ||
    (reseau?.myStatus === 'ACTIVE' && reseau.settings.albumOpenToMembers);

  const vueAlbum: AlbumReseauView = useMemo(
    () => ({
      pastilles,
      vignettes,
      onglet: albumOnglet,
      onPastille: (clef: string) => {
        setAlbumOnglet(clef);
        setAlbumMenu(false);
      },
      photos: photosAlbum,
      prete: albumPret,
      moderateur: ajoutPhotosOuvert,
      peutCreerAlbum: moderateur,
      menuOuvert: albumMenu,
      /**
       * OUVRE, SANS BASCULER — voir sa note dans `a08t/data.ts` : une bascule sur
       * le clic d'ordinateur ouvrait puis refermait le menu dans le même geste,
       * parce que le pointeur entre sur le bouton avant de cliquer.
       */
      onOuvrirMenu: () => {
        setAlbumMenu(true);
      },
      onBasculer: () => {
        setAlbumMenu((ouvert) => !ouvert);
      },
      onFermerMenu: () => {
        setAlbumMenu(false);
      },
      onTouche: (e: { readonly key: string }) => {
        if (e.key === 'Escape') setAlbumMenu(false);
      },
      /**
       * ÉTEINTE DANS LES TROIS VUES DÉRIVÉES, et c'est le porteur qui le dit :
       * « désactivé dans les albums partagés et événements, qui sont des albums
       * automatiques remplis par les publications et les images ajoutées lors
       * de la publication des événements ». « Tout » s'y ajoute parce qu'elle
       * ne désigne aucun album où poser l'image.
       */
      imageDisponible:
        albumOnglet !== ALBUM_TOUT &&
        albumOnglet !== ALBUM_PARTAGES &&
        albumOnglet !== ALBUM_EVENEMENTS &&
        !albumEnVol,
      onImage: onImageAlbum,
      onAjouterAlbum: () => {
        setAlbumMenu(false);
        setAlbumFenetre(true);
      },
      occupe: albumEnVol || !albumPret,
      echec: albumEchec,
      albumOuvert: albumFenetre,
      onCreerAlbum,
      onFermerAlbum: () => {
        setAlbumFenetre(false);
      },
      /**
       * LES BORNES VIENNENT DU SCHÉMA QUE LE SERVEUR APPLIQUE, jamais recopiées :
       * `albumTitleSchema` est `z.string().trim().min(3).max(80)` et porte donc
       * `minLength` / `maxLength`. C'est ce que `use-annonce.ts` fait déjà avec
       * `announcementTitleSchema`.
       */
      titreMin: albumTitleSchema.minLength ?? 0,
      titreMax: albumTitleSchema.maxLength ?? 0,
    }),
    [
      pastilles,
      vignettes,
      albumOnglet,
      photosAlbum,
      albumPret,
      moderateur,
      ajoutPhotosOuvert,
      albumMenu,
      albumEnVol,
      albumEchec,
      albumFenetre,
      onImageAlbum,
      onCreerAlbum,
    ],
  );

  /**
   * ── L'ÉTAT DES GESTES DE GESTION ──────────────────────────────────────────
   *
   * `occupe` est un booléen et non un compteur d'appels : les planches
   * dessinent un bouton par ligne, et un propriétaire qui accepte quatre
   * demandes le fait l'une après l'autre. Éteindre TOUS les boutons pendant un
   * appel est plus sûr qu'éteindre celui qu'on vient de presser — refuser la
   * même demande deux fois donne un `409`, et l'accepter pendant qu'on la
   * refuse laisse l'écran incapable de dire ce qui a gagné.
   *
   * `menu` porte l'identifiant du membre, et non un rang : un rang se
   * désynchronise dès que la liste se recharge — ce qu'elle fait après chaque
   * geste — et le menu se retrouverait ouvert sur quelqu'un d'autre.
   */
  const [occupe, setOccupe] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  /**
   * L'identifiant du membre dont le RETRAIT est en cours de confirmation.
   *
   * Un identifiant et non un booléen, pour la même raison que `menu` : la liste
   * se recharge après chaque geste, et un rang se désynchroniserait. La fenêtre
   * se retrouverait ouverte sur quelqu'un d'autre — et celle-ci pose une
   * question définitive.
   */
  const [aBannir, setABannir] = useState<string | null>(null);
  /** Le membre dont le RETRAIT (et non le bannissement) attend confirmation. */
  const [aRetirer, setARetirer] = useState<string | null>(null);
  const [signalement, setSignalement] = useState<{
    readonly type: string;
    readonly id: string;
  } | null>(null);

  /**
   * UN SEUL CHEMIN POUR LES SEPT GESTES, et il tient les trois mêmes promesses :
   * ne pas partir deux fois, recharger ce que le serveur vient de changer, et
   * remonter l'échec tel qu'il arrive.
   *
   * `setTick` plutôt qu'une mise à jour locale de la liste : la décision d'une
   * demande change AUSSI `memberCount`, la pastille de l'onglet « Membres » et
   * le résumé « vous gérez ce réseau avec N modérateurs ». Recoudre tout cela à
   * la main créerait une seconde vérité à côté de celle du serveur ; on relit.
   */
  const geste = useCallback(
    async (faire: () => Promise<unknown>) => {
      if (occupe) return;
      setOccupe(true);
      try {
        await faire();
        setMenu(null);
        setTick((t) => t + 1);
      } catch (e) {
        setEchec(echecDe(e));
      } finally {
        setOccupe(false);
      }
    },
    [occupe],
  );

  const membresVues = useMemo(() => membres.map(membreAdminRowFrom), [membres]);

  /**
   * ── « ÉCRIRE À UN MEMBRE » ────────────────────────────────────────────────
   *
   * Aucun appel au montage : il n'écrit que sur un clic. Le monter sur les
   * vingt-cinq onglets ne coûte donc rien, et un crochet appelé
   * conditionnellement serait de toute façon interdit.
   */
  const ecrire = useEcrireMembre(membresVues, menu);

  /**
   * LES RANGÉES DE SIGNALEMENT, ET L'ADRESSE QUE LE CONVERTISSEUR NE PEUT PAS
   * COMPOSER.
   *
   * `signalementRowFrom` rend `href: ''` : il ne connaît pas le `slug` du
   * réseau, puisqu'il reçoit une rangée de la FILE et non la fiche. Seul un
   * SUJET a une page (`/reseaux/:slug/sujets/:id`) — vérifié sur l'arborescence
   * de `app/(app)`, il n'existe aucune page de publication ni de commentaire —
   * donc « Voir » ne s'allume que pour ce genre-là, et il s'éteint pour les deux
   * autres au lieu de mener à un 404. REMONTÉ.
   */
  const signalementsVues: readonly SignalementRowView[] = useMemo(
    () =>
      signalements.map((r) => {
        const ligne = signalementRowFrom(r);
        return r.subjectType === 'TOPIC'
          ? { ...ligne, href: `/reseaux/${encodeURIComponent(slug)}/sujets/${r.subjectId}` }
          : ligne;
      }),
    [signalements, slug],
  );

  const gerer: GestionReseauView = useMemo(() => {
    if (reseau === null) return gestionVide;
    return {
      hrefGerer: gestionVide.hrefGerer,
      hrefRetour: gestionVide.hrefRetour,
      demandes: demandes.map(demandeRowFrom),
      membres: membresVues,
      occupe,
      menu,
      membreMenu: membresVues.find((m) => m.userId === menu) ?? null,
      signalement,
      onMenu: (userId) => {
        setMenu((ouvert) => (ouvert === userId ? null : userId));
      },
      onFermerMenu: () => {
        setMenu(null);
      },
      onAccepter: (userId) => {
        void geste(() => decideRequest(slug, userId, 'accept'));
      },
      onRefuser: (userId) => {
        void geste(() => decideRequest(slug, userId, 'reject'));
      },
      /**
       * « TOUT ACCEPTER » EST UNE SUITE D'ACCEPTATIONS, PAS UNE ROUTE.
       *
       * Le contrôleur n'en a aucune : vérifié dans `communities.controller.ts`,
       * il n'y a que `requests/:userId/accept`. On les enchaîne donc en SÉRIE —
       * `for await` et non `Promise.all` — parce que chacune écrit dans la même
       * ligne de réseau et incrémente `memberCount` : les lancer ensemble
       * donnerait des écritures concurrentes sur une donnée que le service lit
       * avant d'écrire.
       *
       * ⚠ ET LA LISTE PEUT ÊTRE TRONQUÉE : « Tout » veut dire « toutes celles
       * que la première page porte ». REMONTÉ avec le `meta.count`.
       */
      onToutAccepter: () => {
        void geste(async () => {
          for (const d of demandes) await decideRequest(slug, d.userId, 'accept');
        });
      },
      /**
       * LES DEUX GESTES DU MENU LISENT `menu`, parce que le menu dessiné est
       * UNIQUE et vit hors de la boucle des membres — voir `GestionReseauView`.
       *
       * `menu === null` ne peut pas arriver depuis l'écran (le menu est caché),
       * mais la garde reste : un geste qui part sans cible enverrait un `PATCH`
       * sur `/members/undefined`, c'est-à-dire un `400` au lieu de rien.
       */
      onNommerModerateur: () => {
        if (menu === null) return;
        void geste(() => updateMember(slug, menu, { role: 'MODERATOR' }));
      },
      onRevoquerModerateur: () => {
        if (menu === null) return;
        void geste(() => updateMember(slug, menu, { role: 'MEMBER' }));
      },
      /**
       * LES DEUX PRISES DE « ÉCRIRE » VIENNENT DU CROCHET VOISIN, telles
       * quelles : la fenêtre, la recherche du fil existant et la navigation
       * vivent dans `use-ecrire-membre.ts`, qui porte aussi la raison pour
       * laquelle il y en a DEUX et non une.
       *
       * ⚠ ELLES NE SONT PAS DANS `geste()`. Celui-ci éteint TOUS les boutons de
       * gestion, ferme le menu et RELIT le réseau — ce qui est juste pour un
       * `PATCH` et faux ici : écrire à quelqu'un ne change rien au réseau, et
       * fermer le menu avant d'avoir ouvert la fenêtre ferait disparaître le nom
       * que la feuille mobile affiche. Le crochet porte son propre `occupe`.
       */
      onEcrire: ecrire.onEcrire,
      onEcrireMenu: ecrire.onEcrireMenu,
      /**
       * ╔════════════════════════════════════════════════════════════════════╗
       * ║ « RETIRER DU RÉSEAU » ET « BANNIR DU RÉSEAU » — UN SEUL GESTE      ║
       * ╚════════════════════════════════════════════════════════════════════╝
       *
       * §2.4 : « retirer un membre (`BANNED` : ne peut plus rejoindre) ». La
       * spécification nomme UN pouvoir ; la maquette dessine DEUX entrées. Les
       * deux appellent donc ce geste, et un lot précédent avait raison de s'en
       * inquiéter — mais la spécification tranche, et c'est elle qui décide.
       *
       * ⚠ IL N'ENVOIE PLUS RIEN DIRECTEMENT : il OUVRE la confirmation. Le
       * `PATCH` part depuis `onConfirmerBannir`. C'est le seul geste du menu qui
       * ne se défait pas, et c'est pour celui-là que
       * `components/fenetre-confirmation.tsx` existe.
       */
      onBannir: () => {
        if (menu === null) return;
        setABannir(menu);
      },
      /**
       * « RETIRER DU RÉSEAU » — `DELETE /communities/:id/members/:userId`. La
       * personne peut redemander à rejoindre, ce qui la distingue du
       * bannissement (arbitrage du porteur, voir `GestionReseauView.onRetirer`).
       */
      onRetirer: () => {
        if (menu === null) return;
        setARetirer(menu);
      },
      retirerOuverte: aRetirer !== null,
      retirerNom: membresVues.find((m) => m.userId === aRetirer)?.name ?? '',
      onConfirmerRetirer: () => {
        if (aRetirer === null) return;
        const cible = aRetirer;
        setARetirer(null);
        void geste(() => removeMember(slug, cible));
      },
      onAnnulerRetirer: () => {
        setARetirer(null);
      },
      bannirOuverte: aBannir !== null,
      /**
       * LE NOM EST CHERCHÉ DANS LA LISTE, pas dans `membreMenu` : `onBannir`
       * laisse le menu OUVERT le temps de la question — le fermer ferait
       * disparaître la rangée sous la fenêtre — mais `onConfirmerBannir` le
       * referme par `geste()`, et la fenêtre survit un instant à cette
       * fermeture. Un nom lu sur `membreMenu` disparaîtrait alors au pire
       * moment : au milieu de la phrase qu'on vient de confirmer.
       */
      bannirNom: membresVues.find((m) => m.userId === aBannir)?.name ?? '',
      onConfirmerBannir: () => {
        if (aBannir === null) return;
        const cible = aBannir;
        setABannir(null);
        void geste(() => updateMember(slug, cible, { status: 'BANNED' }));
      },
      onAnnulerBannir: () => {
        setABannir(null);
      },
      onSignaler: () => {
        /**
         * LE GENRE DU SUJET EST CELUI QUE `ReportSubjectType` NOMME, et il
         * voyage en chaîne : `FenetreSignalement` prend `{ type, id }` sans
         * contraindre le genre, parce que les six écrans qui l'ouvrent ne
         * signalent pas la même chose. C'est le serveur qui valide l'enum.
         */
        setSignalement({ type: 'COMMUNITY', id: reseau.id });
      },
      onFermerSignalement: () => {
        setSignalement(null);
      },

      // ── §2.4 — LES DEUX DÉCISIONS SUR UN CONTENU SIGNALÉ ─────────────────
      signalements: signalementsVues,
      signalementsOuverts: ouverts,
      /**
       * « MASQUER » PART SANS CONFIRMATION, « RETIRER UN MEMBRE » N'EN PART
       * JAMAIS — et la différence n'est pas une inconséquence.
       *
       * Masquer un contenu est RÉVERSIBLE : 13 §2 — « le pipeline masque, il ne
       * supprime jamais », et l'équipe peut démasquer (`ModerationActionType`
       * porte `UNHIDE`). Bannir ne l'est pas : §2.4 dit « ne peut plus
       * rejoindre ». La confirmation est réservée à ce qui ne se défait pas.
       *
       * ⚠ RESTE UN ÉCART REMONTÉ : il n'existe aucune route pour DÉMASQUER un
       * contenu depuis un réseau. Le modérateur bénévole peut masquer et pas
       * revenir en arrière ; seule l'équipe peut, par son dossier. §2.4 ne lui
       * donne pas ce geste et la maquette ne le dessine pas, donc on ne
       * l'invente pas — mais c'est le prochain lot évident.
       */
      onMasquer: (subjectType, subjectId) => {
        void geste(() =>
          decideCommunityReport(slug, {
            subjectType: subjectType as 'POST' | 'COMMENT' | 'TOPIC',
            subjectId,
            decision: 'HIDE',
          }),
        );
      },
      onConserver: (subjectType, subjectId) => {
        void geste(() =>
          decideCommunityReport(slug, {
            subjectType: subjectType as 'POST' | 'COMMENT' | 'TOPIC',
            subjectId,
            decision: 'KEEP',
          }),
        );
      },

      // ── Désépingler l'annonce du haut du fil — arbitrage du 2026-10-11 ───
      annonce:
        epinglee === null
          ? null
          : {
              id: epinglee.id,
              /**
               * LE TITRE PEUT ÊTRE NUL — `community_announcements.title` est
               * nullable, parce que les annonces publiées avant que la colonne
               * existe n'en ont pas. La carte retombe alors sur le CORPS, qui
               * est obligatoire : une carte sans titre vaut mieux qu'une carte
               * sans rien, et la planche dessine les deux lignes.
               */
              titre: epinglee.title ?? epinglee.body,
              corps: epinglee.title === null ? '' : epinglee.body,
              auteur: `${epinglee.author.displayName === '' ? `@${epinglee.author.handle}` : epinglee.author.displayName} · épinglée`,
            },
      onDesepingler: () => {
        if (epinglee === null) return;
        void geste(() => setAnnouncementPinned(slug, epinglee.id, false));
      },
    };
  }, [
    reseau,
    demandes,
    membresVues,
    signalementsVues,
    ouverts,
    epinglee,
    occupe,
    menu,
    signalement,
    aBannir,
    aRetirer,
    geste,
    slug,
    ecrire.onEcrire,
    ecrire.onEcrireMenu,
  ]);

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA SOURDINE — §2.5, ET LES SEPT BOUTONS QU'ELLE ALLUME                     ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * `myMuted` vient de `GET /communities/:slug` : c'est LUI qu'on lit, jamais un
   * booléen tenu ici. Un état local divergerait du serveur dès qu'un autre onglet
   * bascule la sourdine, et le bouton dirait alors le contraire de la base.
   *
   * ── `disponible` : CE QU'IL ÉTEINT, ET CE QU'IL N'ARBITRE PAS ─────────────
   *
   * La route a besoin d'une LIGNE dans `community_members` pour y écrire, et elle
   * répond `404` sans. `myStatus === null` dit exactement cela — « je n'ai aucune
   * adhésion ici » — et ce n'est pas un droit qu'on arbitrerait à la place du
   * serveur (mémo §5) : c'est un fait que la fiche porte. Le bouton s'éteint
   * plutôt que de provoquer un refus certain.
   *
   * ⚠ `INVITED` ET `PENDING` COMPTENT. Un invité reçoit déjà les notifications du
   * réseau — c'est même ce qu'est une invitation — et doit pouvoir les couper.
   * C'est pour cela qu'on ne réemploie pas `membre`, qui exige `ACTIVE`.
   *
   * ── LE PATCH PART SUR `reseau.id`, PAS SUR `slug` ───────────────────────────
   *
   * `setCommunityMuted` prend l'identifiant du LECTEUR comme cible, parce que §4
   * dit « soi-même » et que le serveur refuse tout autre rang
   * (`403 MUTE_SELF_ONLY`). Cet identifiant n'est PAS dans la fiche du réseau :
   * `CommunityDetailResponse` porte `myRole` et `myStatus`, pas mon `userId`.
   * ⚠ C'EST POUR CELA QU'ON PASSE PAR `me()` — `lib/api/moi.ts` — et non par un
   * champ de la fiche qui n'existe pas. Mesuré : `communityDetailResponseSchema`
   * est `.strict()` et ne porte aucun `myUserId`.
   */
  const [sourdineOccupee, setSourdineOccupee] = useState(false);
  const [moiId, setMoiId] = useState<string | null>(null);

  /**
   * MON IDENTIFIANT, une fois, et `fetchMe()` SANS `force`.
   *
   * La réponse de `/me` est MISE EN CACHE par `lib/api/member.ts` : l'appel ne
   * part donc qu'une fois par session, et pas une fois par visite de réseau.
   * `force: true` serait le contraire du bon réflexe ici — mon identifiant ne
   * change jamais, contrairement à mon niveau de vérification, pour lequel les
   * écrans de compte emploient `force`.
   *
   * Un échec est AVALÉ : perdre mon identifiant éteint le bouton « Sourdine »
   * (`disponible: false`), ce qui est dégradé mais vrai. Casser la page du
   * réseau pour cela serait disproportionné.
   */
  useEffect(() => {
    let vivant = true;
    void (async () => {
      try {
        const moi = await fetchMe();
        if (vivant) setMoiId(moi.user.id);
      } catch {
        if (vivant) setMoiId(null);
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const basculerSourdine = useCallback(
    async (voulu: boolean) => {
      if (moiId === null) return;
      setSourdineOccupee(true);
      try {
        await setCommunityMuted(slug, moiId, voulu);
        // On RELIT la fiche : `myMuted` est la seule vérité, et un état local
        // posé ici serait une seconde vérité à tenir d'accord avec elle.
        setTick((t) => t + 1);
      } catch (e) {
        setEchec(echecDe(e));
      } finally {
        setSourdineOccupee(false);
      }
    },
    [slug, moiId],
  );

  const sourdine: SourdineView = useMemo(() => {
    if (reseau === null) return sourdineVide;
    return {
      active: reseau.myMuted,
      disponible: reseau.myStatus !== null && moiId !== null,
      occupe: sourdineOccupee,
      onBasculer: () => {
        void basculerSourdine(!reseau.myMuted);
      },
    };
  }, [reseau, moiId, sourdineOccupee, basculerSourdine]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « CONTACTER LES MODÉRATEURS » — LE BOUTON N'AVAIT AUCUNE ROUTE           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `POST /communities/:id/moderators-conversation` ouvre — ou ROUVRE — le fil de
   * groupe avec le propriétaire et les modérateurs actifs, puis on y va.
   *
   * ── POURQUOI ON NAVIGUE, ET POURQUOI PAR `router.push` ──────────────────
   *
   * La réponse ne porte qu'un identifiant de conversation : il n'y a rien à
   * afficher sur la planche « À propos », et le fil vit sur `/messages/:id`,
   * route qui existe et qui sait tout faire — lire, écrire, joindre une image.
   * Un `<a href>` était impossible : l'adresse n'est connue QU'APRÈS l'appel.
   *
   * ── L'IDEMPOTENCE N'EST PAS GARDÉE ICI ────────────────────────────────────
   *
   * Aucun `if (dejaOuvert)` : le serveur tient l'unicité par un index sur
   * (réseau, demandeur) et rend le même identifiant avec `created: false`. Une
   * garde côté écran serait une seconde règle, qui divergerait — et elle ne
   * couvrirait de toute façon pas le second onglet du même membre.
   *
   * `contact` éteint le bouton pendant l'appel : deux appuis ne créeraient pas
   * deux fils, mais ils lanceraient deux navigations.
   *
   * ⚠ UN ÉCHEC NE CASSE PAS LA PAGE, et il a sa propre prise plutôt que
   * `setEchec` : un refus `NO_MODERATORS_TO_CONTACT` — un réseau automatique
   * sans bénévole, ou un propriétaire seul — n'est pas un échec de l'onglet
   * « À propos », qui s'affiche parfaitement. Le mettre dans `echec` l'aurait
   * confondu avec une fiche illisible.
   */
  const [contact, setContact] = useState<{ busy: boolean; echec: ReseauEchec | null }>({
    busy: false,
    echec: null,
  });
  const router = useRouter();

  const contacterModerateurs = useCallback(() => {
    if (slug === '') return;
    setContact({ busy: true, echec: null });
    void (async () => {
      try {
        const { conversationId } = await openModeratorsConversation(slug);
        router.push(`/messages/${conversationId}`);
        /**
         * `busy` RESTE VRAI jusqu'au changement de page, délibérément : la
         * navigation est asynchrone, et rallumer le bouton juste avant qu'elle
         * n'aboutisse invite à un second clic qui partirait pour rien.
         */
      } catch (e) {
        setContact({ busy: false, echec: echecDe(e) });
      }
    })();
  }, [slug, router]);

  const onglet: A08TData = useMemo(
    () =>
      reseau === null
        ? a08tFallback
        : {
            /**
             * Les prises du lot « réseau vivant » partent du repli, et
             * `ongletVivant` (plus bas) les remplace par les vraies : elles
             * dépendent de `rejoindre` et `quitter`, déclarés après ce memo.
             */
            ...a08tFallback,
            reseau: enteteReseauFrom(reseau, compteurs),
            sourdine,
            notifierSourdine: NOTIFIER_SOURDINE,
            /**
             * LE COMPOSEUR D'ANNONCE EST VIDE ICI, et c'est voulu : son état est
             * celui d'un FORMULAIRE, il n'a besoin d'aucune donnée du réseau, et
             * c'est `reseau-screen.tsx` qui le fusionne depuis `useAnnonce`.
             * Mettre `annonceVide` plutôt que de l'omettre garde le type complet
             * — donc les vingt-cinq planches rendables même si la page oubliait
             * la fusion : le bouton serait éteint, pas absent.
             */
            annonce: annonceVide,
            gerer,

            onContacterModerateurs: contacterModerateurs,
            contactEnCours: contact.busy,
            publications,
            evenements: vueEvenements,
            album: vueAlbum,
          },
    [
      reseau,
      compteurs,
      gerer,
      sourdine,
      contacterModerateurs,
      contact.busy,
      publications,
      vueEvenements,
      vueAlbum,
    ],
  );

  /**
   * Les lignes de sujets : les ÉPINGLÉS en tête, puis les autres.
   *
   * `withoutPinned` est indispensable — mesuré, un sujet épinglé figure DANS
   * `items` ET dans `meta.pinned`. Dessiner les deux listes à la suite
   * l'afficherait deux fois, et le défaut ne se verrait que sur un réseau qui
   * épingle, c'est-à-dire tard.
   */
  const topics: readonly TopicRowView[] = useMemo(() => {
    if (sujets === null) return [];
    const epingles = sujets.meta.pinned;
    return [...pinnedRowsFrom(epingles), ...withoutPinned(topicRowsFrom(sujets.items), epingles)];
  }, [sujets]);

  const data: A08Data = useMemo(
    () => ({
      reseau: onglet.reseau,
      sourdine,
      rail,
      shortcuts,
      panelReseaux,
      netTabs: netTabsFor(ongletActif),
      ownerActions,
      hrefGerer,
      topics,
      // Remplacés par `dataVivante`, plus bas — voir la note de `onglet`.
      actions: actionsVides,
      outils: a08tFallback.outils,
      sujets: sujetsVides,
    }),
    [topics, ongletActif, onglet, sourdine],
  );

  const rejoindre = useCallback(async () => {
    try {
      const apres = await joinCommunity(slug);
      setReseau(apres);
      // On RECHARGE les sujets : ils viennent peut-être de s'ouvrir. Et si
      // l'adhésion n'était qu'une DEMANDE (`PENDING`), ils resteront fermés —
      // c'est le serveur qui le dira, pas nous.
      setTick((t) => t + 1);
    } catch (e) {
      setEchec(echecDe(e));
    }
  }, [slug]);

  const quitter = useCallback(async () => {
    try {
      await leaveCommunity(slug);
      setTick((t) => t + 1);
    } catch (e) {
      setEchec(echecDe(e));
    }
  }, [slug]);


  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LE LOT « RÉSEAU VIVANT » — CE QUE LES PLANCHES LISENT EN PLUS              ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Voir `screens/a08t/vivant.ts` pour chaque contrat. Ce bloc vient APRÈS
   * `rejoindre` et `quitter` parce que les actions de l'en-tête les appellent :
   * un `useMemo` placé plus haut les lirait avant leur déclaration (zone morte
   * temporelle — une `ReferenceError` au premier rendu, pas à la compilation).
   */
  const routeur = router;
  const equipe = reseau?.myRole === 'OWNER' || reseau?.myRole === 'MODERATOR';
  const proprietaire = reseau?.myRole === 'OWNER';
  const membreActif = reseau?.myStatus === 'ACTIVE';
  const base = `/reseaux/${encodeURIComponent(slug)}`;

  // ── Les confirmations de l'en-tête : la sourdine et le départ ──────────────
  const [confirmation, setConfirmation] = useState<'sourdine' | 'quitter' | null>(null);
  const [actionEnVol, setActionEnVol] = useState(false);

  /**
   * ── « CHANGER LA COUVERTURE » ────────────────────────────────────────────
   *
   * Le porteur : « Ajouter une couverture ne marche pas ? Aussi l'ajout ou
   * l'édition après la création ? » Deux temps, comme à la création :
   * `POST /media` (genre `EVENT_COVER`), puis `PATCH /communities/:id` avec
   * `coverAssetId`. La fiche rendue par le PATCH remplace `reseau` : le bandeau
   * (`reseau.couverture`) change sans recharger.
   *
   * L'`<input type="file">` est UNIQUE et vit dans `reseau-screen.tsx`, hors des
   * deux cadres (un champ par cadre aurait ouvert deux sélecteurs) ; ce crochet
   * n'en garde que la RÉFÉRENCE, que le bouton du bandeau et l'entrée du menu
   * mobile « cliquent » tous deux.
   */
  const champCouverture = useRef<HTMLInputElement | null>(null);
  const [couvertureOccupee, setCouvertureOccupee] = useState(false);
  const onFichierCouverture = useCallback(
    (e: { target: { files: FileList | null; value: string } }): void => {
      const fichier = e.target.files?.[0];
      // Vidé AVANT l'envoi : choisir deux fois le même fichier doit relancer.
      e.target.value = '';
      if (fichier === undefined || slug === '') return;
      setCouvertureOccupee(true);
      void uploadCommunityCover(fichier)
        .then((media) => updateCommunity(slug, { coverAssetId: media.id }))
        .then((apres) => {
          setReseau(apres);
        })
        .catch((cause: unknown) => {
          setEchec(echecDe(cause));
        })
        .finally(() => {
          setCouvertureOccupee(false);
        });
    },
    [slug],
  );

  const actions: ActionsReseauView = useMemo(() => {
    if (reseau === null) return actionsVides;
    const etat: ActionsReseauView['etat'] =
      reseau.myStatus === 'ACTIVE'
        ? 'membre'
        : reseau.myStatus === 'PENDING'
          ? 'attente'
          : reseau.myStatus === 'INVITED'
            ? 'invite'
            : reseau.canJoin
              ? reseau.visibility === 'ON_REQUEST'
                ? 'demande'
                : 'passant'
              : 'ferme';
    return {
      etat,
      equipe,
      hrefGerer: `?onglet=gerer`,
      occupe: actionEnVol || sourdine.occupe,
      ongletsFermes: etat !== 'membre',
      badge:
        reseau.myRole === 'OWNER' ? 'Propriétaire' : reseau.myRole === 'MODERATOR' ? 'Modérateur' : '',
      onRejoindre: () => {
        setActionEnVol(true);
        void rejoindre().finally(() => {
          setActionEnVol(false);
        });
      },
      sourdineActive: reseau.myMuted,
      onSourdine: () => {
        setConfirmation('sourdine');
      },
      peutQuitter: reseau.canLeave && reseau.myRole !== 'OWNER',
      onQuitter: () => {
        setConfirmation('quitter');
      },
      peutChangerCouverture: reseau.myRole === 'OWNER' && reseau.myStatus === 'ACTIVE',
      couvertureOccupee,
      onChangerCouverture: () => {
        champCouverture.current?.click();
      },
    };
  }, [reseau, equipe, actionEnVol, sourdine.occupe, rejoindre, couvertureOccupee]);

  const confirmer = useCallback(() => {
    const quoi = confirmation;
    setConfirmation(null);
    if (quoi === 'sourdine') {
      sourdine.onBasculer();
      return;
    }
    if (quoi === 'quitter') {
      setActionEnVol(true);
      void quitter().finally(() => {
        setActionEnVol(false);
        // On a quitté : la vue retombe sur « À propos », le seul onglet ouvert
        // à qui n'est plus membre.
        routeur.push(`${base}?onglet=a-propos`);
      });
    }
  }, [base, confirmation, quitter, routeur, sourdine]);

  // ── La fenêtre « Nouveau sujet » ────────────────────────────────────────────
  const [sujetOuvert, setSujetOuvert] = useState(false);
  const [sujetEnVol, setSujetEnVol] = useState(false);
  const creerSujet = useCallback(
    (titre: string, corps: string) => {
      setSujetEnVol(true);
      void createTopic(slug, { title: titre, body: corps })
        .then((cree) => {
          setSujetOuvert(false);
          routeur.push(`${base}/sujets/${cree.id}`);
        })
        .catch((e: unknown) => {
          setEchec(echecDe(e));
        })
        .finally(() => {
          setSujetEnVol(false);
        });
    },
    [base, routeur, slug],
  );

  const vueSujets: SujetsReseauView = useMemo(
    () => ({
      vide: contenuFerme
        ? 'Rejoignez ce réseau pour lire et ouvrir ses sujets.'
        : 'Aucun sujet dans ce réseau pour le moment : ouvrez le premier.',
      nouveauVisible: membreActif,
      onNouveau: () => {
        setSujetOuvert(true);
      },
    }),
    [contenuFerme, membreActif],
  );

  // ── « Épingler » : la fenêtre des sujets à épingler en tête ────────────────
  const [epinglerOuvert, setEpinglerOuvert] = useState(false);
  const [epinglerEnVol, setEpinglerEnVol] = useState(false);
  const sujetsEpinglables: readonly SujetEpinglable[] = useMemo(
    () =>
      (sujets?.items ?? []).map((t) => ({ id: t.id, titre: t.title, epingle: t.pinKind !== 'NONE' })),
    [sujets],
  );
  const basculerEpingle = useCallback((id: string, epingler: boolean) => {
    setEpinglerEnVol(true);
    void updateTopic(id, { pinKind: epingler ? 'RESOURCE' : 'NONE' })
      .then(() => {
        setTick((t) => t + 1);
      })
      .catch((e: unknown) => {
        setEchec(echecDe(e));
      })
      .finally(() => {
        setEpinglerEnVol(false);
      });
  }, []);

  // ── « Créer un événement du réseau » : la fenêtre E03 ──────────────────────
  const [evenementOuvert, setEvenementOuvert] = useState(false);

  const outils: OutilsReseauView = useMemo(
    () => ({
      visibles: equipe,
      libelle: proprietaire ? 'Propriétaire du réseau' : 'Modération du réseau',
      titre: proprietaire ? 'Outils du propriétaire' : 'Outils de modération',
      hrefAnnonce: '?onglet=annonce',
      onEpingler: () => {
        setEpinglerOuvert(true);
      },
      onEvenement: () => {
        setEvenementOuvert(true);
      },
    }),
    [equipe, proprietaire],
  );

  // ── Le composeur du fil ─────────────────────────────────────────────────────
  const composeur = useComposeurReseau(
    membreActif ? (reseau?.id ?? null) : null,
    () => {
      setTick((t) => t + 1);
    },
    // « Sondages ouverts aux membres » (Gérer), ou l'équipe : la même règle que le serveur.
    equipe || (reseau?.settings.pollsOpenToMembers ?? true),
  );

  // ── Les colonnes de droite : le prochain événement et le mois ──────────────
  const [prochain, setProchain] = useState<ColonneReseauView['prochain']>(null);
  const [mois, setMois] = useState<{ nombre: number; inscrits: number } | null>(null);
  useEffect(() => {
    const surColonne = ongletActif === RANG_ONGLET_FIL || ongletActif === RANG_ONGLET_EVENEMENTS;
    if (reseau === null || reseau.myStatus !== 'ACTIVE' || !surColonne) {
      setProchain(null);
      setMois(null);
      return;
    }
    const ac = new AbortController();
    const maintenant = new Date();
    const premier = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const dernier = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0);
    void (async () => {
      const [aVenir, duMois] = await Promise.allSettled([
        fetchCommunityEvents(reseau.id, { limit: 1 }, ac.signal),
        fetchCommunityEvents(
          reseau.id,
          {
            from: premier.toLocaleDateString('sv-SE'),
            to: dernier.toLocaleDateString('sv-SE'),
            limit: 50,
          },
          ac.signal,
        ),
      ]);
      if (ac.signal.aborted) return;
      const premierEvenement =
        aVenir.status === 'fulfilled' ? evenementsReseauFrom(aVenir.value.items)[0] : undefined;
      setProchain(
        premierEvenement === undefined
          ? null
          : {
              numero: premierEvenement.numero,
              mois: premierEvenement.mois,
              titre: premierEvenement.titre,
              sous: `${premierEvenement.lieuCourt} · ${String(premierEvenement.participants)} participant${premierEvenement.pluriel}`,
              href: premierEvenement.href,
            },
      );
      if (duMois.status === 'fulfilled') {
        const liste = evenementsReseauFrom(duMois.value.items);
        setMois({
          nombre: liste.length,
          inscrits: liste.reduce((somme, e) => somme + e.participants, 0),
        });
      } else {
        setMois(null);
      }
    })();
    return () => {
      ac.abort();
    };
  }, [reseau, ongletActif, tick]);

  const colonne: ColonneReseauView = useMemo(
    () => ({
      prochain,
      epingles: (reseau?.pinned ?? []).map((p) => ({ titre: p.title, href: `${base}/sujets/${p.id}` })),
      moisNombre: mois === null ? '—' : String(mois.nombre),
      moisSous:
        mois === null
          ? ''
          : `événement${mois.nombre > 1 ? 's' : ''} du réseau · ${String(mois.inscrits)} inscrit${mois.inscrits > 1 ? 's' : ''}`,
    }),
    [base, mois, prochain, reseau],
  );

  // ── Les états vides ─────────────────────────────────────────────────────────
  const vides: VidesReseauView = useMemo(
    () => ({
      fil: 'Aucune publication dans ce réseau pour le moment : lancez la conversation.',
      evenements:
        vueEvenements.onglet === 'passes'
          ? 'Aucun événement passé dans ce réseau.'
          : 'Aucun événement à venir dans ce réseau.',
      membres:
        rechercheDifferee === '' && !seulsModerateurs
          ? 'Aucun membre à afficher pour le moment.'
          : 'Aucun membre ne correspond à cette recherche.',
      album:
        vueAlbum.onglet === ALBUM_PARTAGES
          ? 'Aucune image partagée dans les publications de ce réseau.'
          : vueAlbum.onglet === ALBUM_EVENEMENTS
            ? 'Aucune photo d’événement dans ce réseau.'
            : vueAlbum.onglet === ALBUM_TOUT
              ? 'Aucune photo dans ce réseau pour le moment.'
              : 'Cet album n’a encore aucune photo.',
    }),
    [vueEvenements.onglet, vueAlbum.onglet, rechercheDifferee, seulsModerateurs],
  );

  // ── La recherche et les filtres des membres ─────────────────────────────────
  const filtreMembres: FiltreMembresView = useMemo(
    () => ({
      q: rechercheMembres,
      onQ: (event) => {
        setRechercheMembres(event.target.value);
      },
      moderateurs: seulsModerateurs,
      onTous: () => {
        setSeulsModerateurs(false);
      },
      onModerateurs: () => {
        setSeulsModerateurs(true);
      },
      // Les deux états d'une pastille, tels que la maquette les dessine sur la
      // rangée « Tous · Modérateurs » : vert plein actif, blanc liseré inactif.
      tousBg: seulsModerateurs ? '#fff' : '#16785E',
      tousFg: seulsModerateurs ? '#16211D' : '#fff',
      tousBd: seulsModerateurs ? '#E6EBE9' : '#16785E',
      modBg: seulsModerateurs ? '#16785E' : '#fff',
      modFg: seulsModerateurs ? '#fff' : '#16211D',
      modBd: seulsModerateurs ? '#16785E' : '#E6EBE9',
    }),
    [rechercheMembres, seulsModerateurs],
  );

  // ── « À propos » : règles, équipe, et l'édition ─────────────────────────────
  const [brouillonDescription, setBrouillonDescription] = useState<string | null>(null);
  const [brouillonRegles, setBrouillonRegles] = useState<readonly string[] | null>(null);
  const [prevenir, setPrevenir] = useState(true);
  const [editionEnVol, setEditionEnVol] = useState(false);
  const descriptionCourante = brouillonDescription ?? reseau?.description ?? '';
  const reglesCourantes = brouillonRegles ?? reseau?.rules ?? [];
  const reglesModifiees =
    brouillonRegles !== null &&
    JSON.stringify(brouillonRegles.map((r) => r.trim()).filter((r) => r !== '')) !==
      JSON.stringify(reseau?.rules ?? []);
  const descriptionModifiee =
    brouillonDescription !== null && brouillonDescription.trim() !== (reseau?.description ?? '');

  const enregistrerAPropos = useCallback(() => {
    if (reseau === null) return;
    const regles = (brouillonRegles ?? reseau.rules).map((r) => r.trim()).filter((r) => r !== '');
    const description = (brouillonDescription ?? reseau.description ?? '').trim();
    setEditionEnVol(true);
    void (async () => {
      try {
        const apres = await updateCommunity(slug, {
          ...(descriptionModifiee ? { description: description === '' ? null : description } : {}),
          ...(reglesModifiees ? { rules: regles } : {}),
        });
        setReseau(apres);
        if (reglesModifiees && prevenir && regles.length > 0) {
          try {
            await createAnnouncement(slug, {
              title: 'Les règles du réseau ont changé',
              body: regles.map((r, i) => `${String(i + 1)}. ${r}`).join('\n'),
              pinned: false,
              notify: true,
            });
          } catch (e) {
            // Les règles SONT enregistrées : seul l'avis a échoué (souvent la
            // limite de deux annonces par semaine). On le dit sans défaire.
            setEchec(echecDe(e));
          }
        }
        setBrouillonDescription(null);
        setBrouillonRegles(null);
        routeur.push(`${base}?onglet=a-propos`);
      } catch (e) {
        setEchec(echecDe(e));
      } finally {
        setEditionEnVol(false);
      }
    })();
  }, [
    base,
    brouillonDescription,
    brouillonRegles,
    descriptionModifiee,
    prevenir,
    reglesModifiees,
    reseau,
    routeur,
    slug,
  ]);

  const apropos: AProposReseauView = useMemo(() => {
    const automatique = reseau !== null && reseau.kind !== 'INTEREST';
    return {
      regles: (reseau?.rules ?? []).map((texte, i) => ({ n: String(i + 1), texte })),
      equipe: (reseau?.team ?? []).map((q) => {
        const nom = q.displayName === '' ? `@${q.handle}` : q.displayName;
        return {
          i: initials(nom),
          bg: tint(q.handle),
          nom,
          role: q.role === 'OWNER' ? 'Propriétaire' : 'Modérateur',
        };
      }),
      hrefModifier: '?onglet=a-propos-edition',
      modifiable: equipe,
      /**
       * « CONTACTER LES MODÉRATEURS » N'EST MONTRÉ QUE LÀ OÙ IL PEUT ABOUTIR.
       *
       * Le porteur : « Masque. » `POST /communities/:id/moderators-conversation`
       * refuse dans quatre cas, et la fiche en porte trois — on ne propose donc
       * pas un geste dont le refus est certain :
       *
       *   · `403 NOT_A_MEMBER` — un passant, un invité, un candidat `PENDING` :
       *     la route exige l'adhésion ACTIVE (`assertMember`), d'où `myStatus` ;
       *   · `409 NO_MODERATORS_TO_CONTACT`, raison `NO_TEAM` — un réseau
       *     automatique sans bénévole nommé : `team` est vide ;
       *   · même code, raison `ONLY_ME` — le propriétaire seul de son équipe :
       *     `team` ne compte personne d'autre que moi.
       *
       * Le quatrième, `SEPARATED` (je suis séparé de toute l'équipe par un
       * blocage), NE SE LIT PAS dans la fiche, et c'est voulu : §4 ne notifie
       * jamais un blocage. Le bouton reste alors, et le refus s'affiche sous la
       * carte (`contactEchec`).
       *
       * Ce n'est qu'un AVERTISSEMENT, pas une autorisation (mémo §5) : le serveur
       * tranche toujours. `moiId` encore inconnu compte comme « quelqu'un
       * d'autre » — au pire, le propriétaire seul voit le bouton le temps que
       * `/me` réponde, ce qui vaut mieux que de le cacher à tous les membres si
       * `/me` échoue.
       */
      contacterVisible:
        reseau !== null &&
        reseau.myStatus === 'ACTIVE' &&
        reseau.team.some((q) => q.userId !== moiId),
      edition: {
        description: descriptionCourante,
        onDescription: (event) => {
          setBrouillonDescription(event.target.value);
        },
        longueur: descriptionCourante.length,
        descriptionMax: communityDescriptionSchema.maxLength ?? 500,
        regles: reglesCourantes.map((texte, i) => ({
          n: String(i + 1),
          texte,
          onTexte: (event) => {
            const neuves = [...reglesCourantes];
            neuves[i] = event.target.value;
            setBrouillonRegles(neuves);
          },
          onRetirer: () => {
            setBrouillonRegles(reglesCourantes.filter((_, j) => j !== i));
          },
        })),
        reglesMax: COMMUNITY_MAX_RULES,
        reglesCompte: `${String(reglesCourantes.length)} SUR ${String(COMMUNITY_MAX_RULES)}`,
        onAjouterRegle: () => {
          if (reglesCourantes.length >= COMMUNITY_MAX_RULES) return;
          setBrouillonRegles([...reglesCourantes, '']);
        },
        peutAjouter: reglesCourantes.length < COMMUNITY_MAX_RULES,
        modifie: descriptionModifiee || reglesModifiees,
        prevenir,
        onPrevenir: () => {
          setPrevenir((p) => !p);
        },
        occupe: editionEnVol,
        onEnregistrer: enregistrerAPropos,
        onAnnuler: () => {
          setBrouillonDescription(null);
          setBrouillonRegles(null);
          routeur.push(`${base}?onglet=a-propos`);
        },
        automatique,
        categorie:
          reseau === null
            ? ''
            : reseau.kind === 'INTEREST' && reseau.category !== null
              ? (COMMUNITY_CATEGORY_LABELS[reseau.category as CommunityCategory] ?? reseau.category)
              : onglet.reseau.genreCourt,
        visibilite: onglet.reseau.visibilite,
      },
    };
  }, [
    base,
    descriptionCourante,
    descriptionModifiee,
    editionEnVol,
    enregistrerAPropos,
    equipe,
    moiId,
    onglet.reseau,
    prevenir,
    reglesCourantes,
    reglesModifiees,
    reseau,
    routeur,
  ]);

  // ── « Gérer » : sections, file de validation, paramètres ───────────────────
  const [contenuSignale, setContenuSignale] = useState<ContenuSignale | null>(null);
  const [parametresEnVol, setParametresEnVol] = useState(false);
  const changerParametres = useCallback(
    (patch: Parameters<typeof updateCommunity>[1]) => {
      setParametresEnVol(true);
      void updateCommunity(slug, patch)
        .then((apres) => {
          setReseau(apres);
        })
        .catch((e: unknown) => {
          setEchec(echecDe(e));
        })
        .finally(() => {
          setParametresEnVol(false);
        });
    },
    [slug],
  );

  const pilotage: PilotageReseauView = useMemo(() => {
    const ensemble = section === 'ensemble';
    const automatique = reseau !== null && reseau.kind !== 'INTEREST';
    const visibilite = reseau?.visibility ?? 'PUBLIC';
    const SOUS: Record<string, string> = {
      PUBLIC: 'Tout membre peut voir et rejoindre.',
      ON_REQUEST: 'Les membres demandent à rejoindre, vous acceptez.',
      INVITE_ONLY: 'Invisible dans Découvrir et dans la recherche. Accès par invitation seulement.',
    };
    return {
      section,
      hrefSection: (s) => `?onglet=gerer&section=${s}`,
      // Les deux états d'une entrée du rail, relevés sur la planche : l'active
      // en `#E3F0EB` / `#0F5C48` graisse 700, les autres transparentes en 500.
      railBg: (s) => (s === section ? '#E3F0EB' : 'transparent'),
      railFg: (s) => (s === section ? '#0F5C48' : '#16211D'),
      railPoids: (s) => (s === section ? '700' : '500'),
      voirPlusDemandes: ensemble && demandes.length > 3,
      voirPlusSignalements: ensemble && signalements.length > 3,
      bornerDemandes: ensemble ? 3 : demandes.length,
      bornerSignalements: ensemble ? 3 : signalements.length,
      montrer: (carte) =>
        carte === 'tuiles'
          ? ensemble
          : carte === 'attente'
            ? (ensemble || section === 'demandes') &&
              (enAttente.length > 0 || reseau?.settings.postsRequireApproval === true)
            : ensemble || section === carte,
      tuiles: {
        nouveaux:
          reseau?.stats === null || reseau?.stats === undefined
            ? ''
            : `+${String(reseau.stats.joinedThisMonth)} ce mois`,
        actifs:
          reseau?.stats === null || reseau?.stats === undefined || reseau.memberCount === 0
            ? '—'
            : `${String(Math.round((reseau.stats.activeLast30Days / reseau.memberCount) * 100))} %`,
      },
      onVoirSignalement: (subjectType, subjectId) => {
        const brut = signalements.find(
          (r) => r.subjectType === subjectType && r.subjectId === subjectId,
        );
        const vue = gerer.signalements.find(
          (r) => r.subjectType === subjectType && r.subjectId === subjectId,
        );
        if (brut === undefined || vue === undefined) return;
        setContenuSignale({
          subjectType,
          subjectId,
          titre: vue.titre,
          sous: vue.sous,
          extrait: brut.extrait,
          href: vue.href,
          masque: vue.masque,
        });
      },
      enAttente: enAttente.map((p) => {
        const nom = p.author.displayName === '' ? `@${p.author.handle}` : p.author.displayName;
        return {
          postId: p.postId,
          i: initials(nom),
          bg: tint(p.author.handle),
          nom,
          sous: `${p.type} · ${new Date(p.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`,
          extrait: p.body.length > 280 ? `${p.body.slice(0, 280)}…` : p.body,
        };
      }),
      onValider: (postId) => {
        void geste(() => decidePendingPost(slug, postId, 'APPROVE'));
      },
      onRefuserPublication: (postId) => {
        void geste(() => decidePendingPost(slug, postId, 'REJECT'));
      },
      parametres: {
        validation: reseau?.settings.postsRequireApproval ?? false,
        sondages: reseau?.settings.pollsOpenToMembers ?? true,
        album: reseau?.settings.albumOpenToMembers ?? true,
        onValidation: () => {
          changerParametres({ postsRequireApproval: !(reseau?.settings.postsRequireApproval ?? false) });
        },
        onSondages: () => {
          changerParametres({ pollsOpenToMembers: !(reseau?.settings.pollsOpenToMembers ?? true) });
        },
        onAlbum: () => {
          changerParametres({ albumOpenToMembers: !(reseau?.settings.albumOpenToMembers ?? true) });
        },
        visibilite: onglet.reseau.visibilite,
        visibiliteSous: automatique
          ? 'Réseau automatique : toujours public.'
          : (SOUS[visibilite] ?? ''),
        visibiliteFixe: automatique || !proprietaire,
        visibiliteValeur: visibilite,
        visibilites: [
          { valeur: 'PUBLIC', libelle: 'Public' },
          { valeur: 'ON_REQUEST', libelle: 'Sur demande' },
          { valeur: 'INVITE_ONLY', libelle: 'Privé' },
        ],
        onVisibilite: (event) => {
          const v = event.target.value;
          if (v !== 'PUBLIC' && v !== 'ON_REQUEST' && v !== 'INVITE_ONLY') return;
          if (v === visibilite) return;
          changerParametres({ visibility: v });
        },
        occupe: parametresEnVol,
      },
    };
  }, [
    section,
    reseau,
    demandes.length,
    signalements,
    enAttente,
    gerer.signalements,
    geste,
    slug,
    changerParametres,
    onglet.reseau.visibilite,
    proprietaire,
    parametresEnVol,
  ]);

  const ongletVivant: A08TData = useMemo(
    () => ({
      ...onglet,
      actions,
      outils,
      composeur,
      colonne,
      filtreMembres,
      apropos,
      pilotage,
      vides,
    }),
    [onglet, actions, outils, composeur, colonne, filtreMembres, apropos, pilotage, vides],
  );

  const dataVivante: A08Data = useMemo(
    () => ({
      ...data,
      netTabs: actions.ongletsFermes
        ? data.netTabs.filter((t) => t.href.includes('a-propos'))
        : data.netTabs,
      topics: data.topics.map((t) => ({ ...t, href: `${base}/sujets/${t.topicId}` })),
      actions,
      outils,
      sujets: vueSujets,
    }),
    [data, actions, outils, vueSujets, base],
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ TRANSFÉRER ET RÉACTIVER — ÉCRITS, APPELABLES, ET AUCUN CADRE NE LES OUVRE ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * ⚠ ÉCART DE MAQUETTE, remonté. Les deux routes existent et sont gardées
   * (`assertOwner`), mais la maquette `03 Accueil v2` ne dessine NULLE PART de
   * quoi les déclencher : compté sur ses octets, « Transférer » apparaît 0 fois,
   * « Réactiver » 0 fois, « Archiver » 0 fois. La carte « PARAMÈTRES » de la
   * planche « Gérer » ne porte que trois interrupteurs — validation des
   * publications, sondages ouverts, album ouvert — et une pastille de visibilité
   * en lecture seule. Aucun des trois n'a de champ dans
   * `updateCommunitySchema` ; aucun des deux gestes lourds n'a de bouton.
   *
   * Les emprunter à une autre planche demanderait d'en inventer la PLACE sur les
   * deux largeurs, et la planche mobile de « Gérer » n'a même pas de carte de
   * paramètres où les poser — elle s'arrête à la vue d'ensemble. Inventer deux
   * boutons là serait réécrire la maquette, ce qui est interdit ; on écrit donc
   * le geste, avec sa garde, et on remonte le dessin manquant.
   *
   * ILS NE PARTENT JAMAIS SANS CONFIRMATION. C'est `components/fenetre-confirmation.tsx`
   * qui la pose, comme pour l'ouverture d'un guide à la communauté : le geste
   * reçoit ici la décision, il ne la demande pas. Le jour où la planche existe,
   * l'écran appelle `transferer()` depuis le `onConfirmer` de cette fenêtre.
   */
  const transferer = useCallback(
    async (toUserId: string) => {
      try {
        setReseau(await transferCommunity(slug, toUserId));
        setTick((t) => t + 1);
      } catch (e) {
        setEchec(echecDe(e));
      }
    },
    [slug],
  );

  const reactiver = useCallback(async () => {
    try {
      setReseau(await reactivateCommunity(slug));
      setTick((t) => t + 1);
    } catch (e) {
      setEchec(echecDe(e));
    }
  }, [slug]);

  return {
    pret,
    chargement,
    echec,
    reseau,
    sujets,
    data: dataVivante,
    onglet: ongletVivant,
    /**
     * LES FENÊTRES DU LOT « RÉSEAU VIVANT », pour que l'écran en pose UNE
     * SEULE de chaque, hors des deux cadres — la leçon `ScreenFrames` + portail.
     */
    confirmation,
    onConfirmer: confirmer,
    onAnnulerConfirmation: () => {
      setConfirmation(null);
    },
    fenetreSujet: {
      ouverte: sujetOuvert,
      occupe: sujetEnVol,
      onCreer: creerSujet,
      onFermer: () => {
        setSujetOuvert(false);
      },
    },
    fenetreEpingler: {
      ouverte: epinglerOuvert,
      sujets: sujetsEpinglables,
      max: COMMUNITY_MAX_PINNED_TOPICS,
      occupe: epinglerEnVol,
      onBasculer: basculerEpingle,
      onFermer: () => {
        setEpinglerOuvert(false);
      },
    },
    fenetreEvenement: {
      ouverte: evenementOuvert,
      onFermer: () => {
        setEvenementOuvert(false);
      },
      onCree: () => {
        setEvenementOuvert(false);
        setTick((t) => t + 1);
      },
    },
    contenuSignale,
    onFermerContenuSignale: () => {
      setContenuSignale(null);
    },
    champCouverture,
    onFichierCouverture,
    composeur,
    membre,
    contenuFerme,
    compteursFiables: membre,
    contacterModerateurs,
    contactEnCours: contact.busy,
    contactEchec: contact.echec,
    rejoindre,
    quitter,
    gerer,
    sourdine,
    transferer,
    reactiver,
    /**
     * L'ÉTAT DE `FenetreEcrire`, pour que l'écran en pose UNE SEULE.
     *
     * ⚠ PAS LA FENÊTRE : posée dans un cadre généré, elle s'ouvrirait en DEUX
     * exemplaires — `ScreenFrames` rend les deux cadres et n'en masque qu'un par
     * `display: none`, et `Modal` se portalise vers `document.body`. C'est la
     * leçon déjà payée par `FenetreConfirmation`, mesurée au navigateur.
     */
    ecrire,
    /**
     * L'ÉTAT DE L'ONGLET « ÉVÉNEMENTS », pour que l'écran pose `FenetreNiveau`
     * et la bande d'état vide — une seule fois, hors des deux cadres, pour la
     * raison écrite juste au-dessus.
     */
    evenements: vueEvenements,
    evenementsPrets,
    /**
     * L'ÉTAT DE L'ONGLET « ALBUM », pour que l'écran pose la fenêtre « Nouvel
     * album » et les bandes d'état vide — une seule fois, hors des deux cadres,
     * pour la raison écrite juste au-dessus.
     */
    album: vueAlbum,
  };
}

/**
 * LE JOUR D'HIER, EN `YYYY-MM-DD`, DANS LE FUSEAU DU NAVIGATEUR.
 *
 * C'est la borne `to` de la pastille « Passés ». `sv-SE` rend exactement
 * `AAAA-MM-JJ` — c'est le format ISO que `localDateSchema` exige — là où
 * `fr-FR` rendrait `11/10/2026` et `toISOString()` basculerait d'un jour pour
 * tout lecteur à l'ouest de Greenwich en fin de journée.
 *
 * ⚠ L'ÉCART AVEC LE FUSEAU DE RÉFÉRENCE DU SERVEUR EST CONSIGNÉ sur l'effet qui
 * l'appelle. Il vaut au plus un jour, sur la frontière entre les deux listes.
 */
function jourHier(): string {
  return new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE');
}
