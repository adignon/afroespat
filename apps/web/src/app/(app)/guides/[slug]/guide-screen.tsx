'use client';

import { ScreenFrames } from '@/screens/frames';
import { A04Desktop } from '@/screens/a04/desktop.generated';
import { A04Mobile } from '@/screens/a04/mobile.generated';
import { A04AuteurDesktop } from '@/screens/a04/auteurdesktop.generated';
import { A04AuteurMobile } from '@/screens/a04/auteurmobile.generated';
import {
  guide as guideMaquette,
  guideActions,
  guideActionsAuteur,
  panelGuides,
  rail,
  shortcuts,
  versions as versionsMaquette,
  type A04Data,
  type GuideHeadView,
} from '@/screens/a04/data';
import { useGuide } from '@/screens/guides/use-guides';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifyError, notifySuccess } from '@/components/notifications';
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { useCapacites } from '@/lib/capacites';
import type { Capability } from '@app/shared';
import type { GuideActionView } from '@/screens/a04/data';
import { CorpsGuide } from '@/screens/guides/corps-guide';
import { FenetreCommentaires } from '@/components/fenetre-commentaires';
import { FenetrePartage } from '@/components/fenetre-partage';
import { ApiError } from '@/lib/api/index';
import {
  bookmarkGuide,
  fetchSignetGuide,
  OBSOLETE_COMMENTAIRE_MAX,
  unbookmarkGuide,
} from '@/screens/guides/api';
import { avatarColor, initials } from '@/screens/accueil/from-api';
import { phraseCommentaires } from '@/screens/guides/from-api';
import type { GuidePlanView } from '@/screens/a04/data';
import {
  PanneauCorrection,
  passageSelectionne,
  useCorrection,
} from '@/screens/guides/correction-vivante';

/**
 * A04 — la lecture d'un guide. `/guides/:slug`
 *
 * DEUX VUES, et ce sont deux états du même écran, pas deux pages : la maquette
 * les nomme « VUE LECTEUR » et « VUE AUTEUR — “Proposer une correction” laisse
 * place à Modifier et aux propositions reçues ». C'est le même guide, lu par deux
 * personnes différentes, donc la même URL.
 *
 * ── LA VUE AUTEUR NE SE DÉCIDE PAS DANS LE FRONT ────────────────────────────
 *
 * `?vue=auteur` ne fait que DEMANDER la vue. Ce qui la donne, c'est
 * `guide.isAuthor`, que le serveur recalcule à chaque requête — donc qui ne peut
 * pas périmer comme une copie gardée le ferait. Un membre qui ajoute `?vue=auteur`
 * à l'adresse d'un guide qui n'est pas le sien obtient la vue lecteur, et non une
 * vue auteur inerte qui échouerait au premier clic.
 *
 * Ce n'est PAS une autorisation pour autant : les gestes de l'auteur sont tentés
 * et c'est l'API qui refuse. `isAuthor` ne décide que du DESSIN.
 *
 * ── CE QUI VIENT DE L'API ───────────────────────────────────────────────────
 *
 * L'en-tête du guide (titre, catégorie, portée, date de mise à jour, bandeau
 * « Maintenu par la communauté » et les trois compteurs de la vue auteur), les
 * pastilles de contributeurs et l'historique des versions.
 *
 * Le CORPS du guide, rendu par `CorpsGuide` — texte, titres de section, listes,
 * liens, et désormais les IMAGES (`![légende](/media/<clé>)`), aux valeurs de
 * chacune des deux planches.
 *
 * SEUL ÉCRAN DE CETTE MAQUETTE à écrire son `<h1>` lui-même. Ses `<h2>` sont les
 * sections du guide, et le générateur ne les promeut pas.
 *
 * ── « PROPOSER UNE CORRECTION » EST UN PANNEAU, PAS UNE PAGE ────────────────
 *
 * Le porteur : « Ça affiche une page mais c'est un modal qui s'affiche à droite.
 * Il faut être intelligent et comprendre la page. »
 *
 * CE QUE LA MAQUETTE DESSINE, et qui tranche : dans le corps du guide, un passage
 * surligné porte l'infobulle « Proposer une correction sur ce passage ». Le geste
 * est donc une SÉLECTION DE TEXTE, et sa destination est la section A06, dont le
 * libellé le dit lui-même : « PANNEAU LATÉRAL SUR LA PAGE DU GUIDE (WEB) ·
 * FEUILLE DU BAS (MOBILE) ».
 *
 * Les deux morceaux sont ici : `CorpsGuide` écoute la sélection et rend
 * l'infobulle, `PanneauCorrection` monte le panneau transcodé par-dessus la page.
 * `/guides/:slug/corriger` EXISTE TOUJOURS — c'est une adresse partageable, et
 * elle dessine la même planche — mais elle n'est plus le chemin du geste : la
 * colonne d'actions ouvre maintenant le panneau EN PLACE, avec le passage déjà
 * rempli, ce qu'une page ne pouvait pas faire (elle n'a pas la sélection).
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QU'ON MONTRE AVANT LA RÉPONSE : LA FORME DE LA PLANCHE, SANS SES DIRES ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Cette page servait `guide` de `screens/a04/data.ts` tel quel pendant le
 * chargement, et le choix était écrit et défendable : « on garde celle de la
 * MAQUETTE plutôt qu'un titre vide », parce qu'un écran blanc qui se remplit
 * saute plus qu'un écran dessiné qui se précise.
 *
 * ── CE QUE LA MESURE A MONTRÉ, ET POURQUOI LE CHOIX NE TIENT PLUS ENTIER ──
 *
 * Relevé au navigateur : pendant quelques centaines de millisecondes, un guide
 * qui porte 23 commentaires affiche « 14 COMMENTAIRES ». Et depuis que le
 * bandeau est lié aux `banners` du serveur, le même repli rallume
 * « Maintenu par la communauté » sur TOUS les guides le temps du chargement —
 * c'est-à-dire exactement le défaut que le porteur venait de faire corriger,
 * revenu par la porte du repli.
 *
 * LA DISTINCTION EST ENTRE UN GABARIT ET UNE AFFIRMATION. « Obtenir la garantie
 * Visale sans CDI » est visiblement un titre d'exemple : il occupe la place, se
 * fait remplacer, et personne ne le prend pour une information sur le guide qu'il
 * a ouvert. « 14 COMMENTAIRES », « 84 membres ont trouvé utile » et le bandeau
 * vert, eux, ne se lisent pas comme du mobilier : ils se lisent comme des FAITS
 * sur ce guide-ci. Un nombre faux n'est pas un espace réservé, c'est une erreur
 * qui s'efface.
 *
 * On garde donc la MISE EN PAGE de la planche — c'est ce que le choix d'origine
 * protégeait — et on vide ses assertions :
 *
 *   · les compteurs tombent à zéro et leurs phrases au libellé nu
 *     (« COMMENTAIRES » sans nombre, plutôt que « 0 COMMENTAIRE » qui serait
 *     encore une affirmation, et fausse) ;
 *   · les deux bandeaux sont éteints : avant la réponse, on ne sait RIEN de la
 *     fraîcheur ni du maintien, et l'absence de bandeau est la seule chose vraie
 *     qu'on puisse dire ;
 *   · les contributeurs se taisent, pour ne pas créditer « Marc Koudou » sur le
 *     guide de quelqu'un d'autre.
 *
 * Le reste — titre, catégorie, portée, date — reste le gabarit de la planche.
 */
const EN_TETE_AVANT_REPONSE: GuideHeadView = {
  ...guideMaquette,
  /** Aucun bandeau : on ne sait pas encore, et le dire serait mentir. */
  community: false,
  avertissement: false,
  avertissementTexte: '',
  /** Les compteurs : zéro en nombre, et le libellé nu en phrase. */
  useful: 0,
  contributorCount: 0,
  proposals: 0,
  /**
   * LE COMPTE DES SIGNALEMENTS « A CHANGÉ » TOMBE À ZÉRO LUI AUSSI, et la
   * conséquence est voulue : à zéro le compteur mobile ne se dessine PAS (même
   * règle que la pastille des propositions), donc avant la réponse la barre basse
   * de l'auteur ne porte que ses deux compteurs d'origine. Un « 0 signalement »
   * affiché le temps d'un aller-retour aurait été une affirmation, et fausse.
   */
  signalements: 0,
  signalementsMot: 'signalements',
  utiles: '',
  contributeurs: '',
  contributeursCourt: '',
  /**
   * LA LIGNE DES CONTRIBUTEURS SE TAIT AVANT LA RÉPONSE, et c'est le choix déjà
   * écrit juste au-dessus : « les contributeurs se taisent, pour ne pas créditer
   * “Marc Koudou” sur le guide de quelqu'un d'autre ». Les trois prises disaient
   * déjà la même chose en vidant leurs phrases ; depuis que la ligne entière est
   * conditionnelle, c'est ce booléen qui la retire — rangée de pastilles comprise,
   * là où deux phrases vides laissaient l'écart de leur conteneur en flex.
   */
  aContributeurs: false,
  commentaires: 'COMMENTAIRES',
  auteurCourt: '',
};

export function GuideScreen({
  slug,
  pageSlug,
}: {
  readonly slug: string;
  /**
   * LA PAGE DEMANDÉE PAR L'ADRESSE — `undefined` sur `/guides/:slug`.
   *
   * ⚠ ET C'EST VOLONTAIREMENT `undefined` ET NON « la première » : c'est le
   * SERVEUR qui choisit la première page quand le paramètre est absent, et c'est
   * ce qui garde en état les liens partagés avant les pages (§2.1 fige le slug du
   * guide pour cette raison). Le front qui devinerait « page 1 » devrait en
   * connaître le slug, qu'il n'a pas encore puisque c'est la réponse qui le donne.
   */
  readonly pageSlug?: string;
  /**
   * `?vue=auteur` — ACCEPTÉ, PLUS LU. Voir `vueAuteur` plus bas : c'est le serveur
   * (`isAuthor`) qui décide seul de la vue depuis que ce paramètre s'est révélé
   * n'être posé par AUCUN lien du produit. Il reste dans le contrat pour que les
   * deux pages qui le passent, et les adresses qui le portent, continuent de
   * répondre sans rien changer.
   */
  readonly auteur: boolean;
}) {
  const {
    contributors,
    versionRows,
    enTete,
    isAuthor,
    echec,
    chargement,
    detail,
    plan: planDonnees,
    voter,
    signalerObsolete,
    aSignale,
    retirerSignalement,
    basculerCommunaute,
  } = useGuide(slug, pageSlug);
  const router = useRouter();
  const { peut } = useCapacites();
  const [niveauRefuse, setNiveauRefuse] = useState<Capability | null>(null);
  const [voteEnVol, setVoteEnVol] = useState(false);
  const [obsoleteDemande, setObsoleteDemande] = useState(false);
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUI A CHANGÉ — LE SEUL RENSEIGNEMENT UTILE DU SIGNALEMENT             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ avant ce lot : `flagOutdated(guideId, comment?)` prenait le paramètre,
   * `guideOutdatedFlagSchema` acceptait 1 à 500 caractères, la fenêtre ne
   * demandait rien — donc le commentaire partait TOUJOURS vide. L'auteur
   * apprenait qu'on lui reproche quelque chose, sans savoir quoi.
   *
   * L'ÉTAT VIT ICI ET NON DANS LA FENÊTRE, pour la raison qui vaut déjà pour
   * `obsoleteDemande` : `FenetreConfirmation` est la COQUE de huit fenêtres du
   * produit, et lui donner une mémoire la rendrait différente de ses sept
   * sœurs. Il est remis à vide à chaque ouverture ET à chaque fermeture — un
   * brouillon gardé d'un guide à l'autre serait un commentaire envoyé par
   * erreur sur le mauvais guide.
   */
  const [obsoleteCommentaire, setObsoleteCommentaire] = useState('');
  /** Vrai pendant l'appel : les deux boutons s'éteignent plutôt que de partir deux fois. */
  const [obsoleteEnVol, setObsoleteEnVol] = useState(false);
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « OUVRIR À LA COMMUNAUTÉ » PASSE PAR UNE CONFIRMATION, ET IL LE FAUT     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le bouton ouvrir à la communauté ne marche pas. » La route
   * existe maintenant — mais la brancher sèchement aurait été pire que le lien
   * mort.
   *
   * CE QUE LA SPÉCIFICATION DIT, ET QUI N'EST PAS UN RÉGLAGE D'AFFICHAGE : §2.4,
   * ligne 52 — « Si le guide est `maintained_by_community` : les propositions vont
   * directement en file de modération, sans passer par le créateur. » L'auteur qui
   * ouvre son guide RENONCE à valider les corrections qu'on lui propose. En un
   * clic, sans un mot, depuis une rangée de menu.
   *
   * C'est exactement la famille de gestes que `FenetreConfirmation` sert déjà dans
   * ce fichier pour le signalement d'obsolescence — « un clic malheureux dans une
   * colonne d'actions ne doit pas le déclencher ». On reprend ce patron, et la
   * fenêtre DIT CE QU'ON PERD.
   *
   * ⚠ UNE SEULE FENÊTRE POUR LES DEUX SENS, comme pour l'obsolescence : §2.5 veut
   * le geste « réversible », et les deux ne peuvent pas être demandés en même temps
   * puisque c'est la même rangée. Deux fenêtres auraient été deux voiles et deux
   * états d'ouverture à tenir d'accord.
   */
  const [communauteDemande, setCommunauteDemande] = useState(false);
  const [communauteEnVol, setCommunauteEnVol] = useState(false);
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA FEUILLE DE COMMENTAIRES DU GUIDE — « EMPRUNTER A01C AU GUIDE »        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Comment commenter un guide, c'est pas dans les design ? » —
   * puis son arbitrage : le point 1, emprunter A01C.
   *
   * `commentaires` dit si la feuille est ouverte. Elle ne porte PAS d'identifiant :
   * le sujet est TOUJOURS la PAGE LUE de ce guide-ci, et il vient de
   * `detail.currentPage.id` — pas du slug, et plus de `detail.guide.id`.
   *
   * ⚠ CET EN-TÊTE DISAIT `detail.guide.id`, ET IL AVAIT CESSÉ D'ÊTRE VRAI : depuis
   * que les commentaires s'attachent à une page, le sujet `GUIDE` répond `404`.
   * Voir la feuille, en bas de ce fichier, où le changement est écrit au complet.
   * Le slug est l'adresse, l'identifiant est la clé que `POST /comments` attend
   * (`subjectId` est un `uuid` dans `createCommentSchema`), et les confondre
   * donnerait un 422 à l'envoi.
   */
  const [commentaires, setCommentaires] = useState(false);
  /**
   * COMBIEN DE COMMENTAIRES LE MEMBRE VIENT D'ENVOYER DEPUIS CE CHARGEMENT.
   *
   * `useGuide` N'EXPOSE AUCUN RECHARGEMENT — son effet ne dépend que du slug —
   * donc `guide.commentCount` reste celui de la première réponse. Sans ce compteur,
   * l'en-tête affichait « 3 COMMENTAIRES » juste après un envoi accepté, au-dessus
   * d'un fil qui en montrait quatre.
   *
   * CE N'EST PAS DE L'OPTIMISME : on n'incrémente qu'après un `201`, c'est-à-dire
   * quand le serveur a enregistré. C'est la même règle que `commenter()` applique
   * en insérant le commentaire TEL QUE LE SERVEUR LE REND.
   *
   * ⚠ CE QU'IL NE SAIT PAS : les commentaires que D'AUTRES membres postent pendant
   * que la page est ouverte. Le compteur du serveur les connaîtrait ; celui-ci non.
   * Le corriger demande un rechargement du détail, donc une prise de plus sur
   * `useGuide`. REMONTÉ plutôt que deviné.
   */
  const [commentairesPostes, setCommentairesPostes] = useState(0);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA FEUILLE DES PAGES — LE SEUL ACCÈS À LA LISTE SUR 390 px               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, sur la planche de 390 px : la colonne de droite n'y existe pas, et
   * « au milieu le nom de la page, cliquable aussi ». Le nom ouvre donc la liste,
   * dans la feuille du bas que le générateur emprunte au « menu de rôle ».
   *
   * ELLE N'EST MONTÉE QUE DANS LES CADRES DE 390 px, et c'est ce qui décide du
   * geste à 1 440 px — voir `onNomPage`.
   */
  const [planOuvert, setPlanOuvert] = useState(false);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CHANGER DE PAGE REMET LE COMPTEUR LOCAL À ZÉRO                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `commentairesPostes` compte ce que le membre vient d'envoyer DEPUIS CE
   * CHARGEMENT, et il s'ajoute à `guide.commentCount`. Or ce compte est celui de
   * LA PAGE LUE (`guideDetailResponseSchema` le redit pour cette route) : garder
   * l'ancien report après un changement de page ferait afficher, sur la page 2, les
   * commentaires envoyés sur la page 1 — « 3 COMMENTAIRES » au-dessus d'un fil qui
   * en montre deux, c'est-à-dire le mensonge exact que ce compteur existe pour
   * éviter.
   *
   * LA DÉPENDANCE EST L'IDENTIFIANT DE LA PAGE LUE, pas le slug de l'adresse : le
   * serveur choisit la première page quand l'adresse n'en nomme aucune, donc
   * `pageSlug` reste `undefined` pour une page qui, elle, a bien changé.
   */
  const pageLue = detail?.currentPage.id ?? null;
  useEffect(() => {
    setCommentairesPostes(0);
    setPlanOuvert(false);
  }, [pageLue]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA BARRE HAUTE MOBILE — QUATRE RONDS, QUATRE GESTES                      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, capture à l'appui : « Le bouton back sur mobile et les icon du
   * header ne marchent pas. » MESURÉ dans les deux cadres de 390 px : quatre
   * `<span>` inertes sur la vue LECTEUR (chevron, signet, partage, « … »), trois
   * sur la vue AUTEUR, qui ne dessine pas le signet.
   *
   * DEUX DES QUATRE PASSENT PAR DÉLÉGATION (partage et « … »), parce qu'ils
   * OUVRENT une surface et portent `data-modal-open` — le même chemin que
   * « Commenter ». Les deux autres appellent les fonctions ci-dessous, portées par
   * la prise `entete`.
   */
  /** La feuille d'actions du « … ». */
  const [menuOuvert, setMenuOuvert] = useState(false);
  /** La feuille « Partager ». */
  const [partage, setPartage] = useState(false);
  /** Le signet de ce guide, tel que `GET /me/bookmarks/states` le dit. */
  const [signet, setSignet] = useState(false);
  const [signetEnVol, setSignetEnVol] = useState(false);

  const guideId = detail?.guide.id ?? null;

  /**
   * ── L'ÉTAT DU SIGNET SE DEMANDE, IL NE SE DEVINE PAS ────────────────────
   *
   * `GET /guides/:slug` NE REND PAS de champ `bookmarked` —
   * `guideDetailResponseSchema` est `.strict()`, et le vérifier au schéma coûte
   * moins qu'un signet qui mentirait. La seule route qui réponde est celle des
   * états en lot, à laquelle on ne donne qu'un identifiant.
   *
   * ⚠ UN ÉCHEC NE BLOQUE RIEN et n'affiche rien : le signet reste creux, et le
   * membre peut l'enfoncer — `PUT /me/bookmarks` est idempotent, donc enregistrer
   * un guide déjà enregistré n'est pas une erreur. Faire tomber la page du guide
   * parce qu'un état de signet n'a pas répondu serait disproportionné.
   */
  useEffect(() => {
    if (guideId === null) return undefined;
    let vivant = true;
    void fetchSignetGuide(guideId)
      .then((etat) => {
        if (vivant) setSignet(etat);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [guideId]);

  /**
   * ── LE RETOUR, ET LE CAS OÙ IL N'Y A PAS D'HISTORIQUE ───────────────────
   *
   * `router.back()` est le geste que ce dépôt emploie déjà pour revenir d'où l'on
   * vient (`components/garde-niveau.tsx`, la croix de la story) : poser une
   * adresse fixe ferait d'un retour une NAVIGATION, et le membre perdrait sa
   * place dans la liste des guides.
   *
   * ⚠ LE REPLI N'EST PAS DÉCORATIF, et c'est le piège de ce bouton-ci plus que
   * de tout autre : un guide s'ouvre très souvent PAR UN LIEN REÇU — §2.1 fige le
   * slug « jamais modifié » exactement pour cela — et l'onglet n'a alors AUCUNE
   * page précédente. `back()` ne fait rien, et le chevron paraît mort d'une autre
   * façon que celle qu'on corrige.
   *
   * LA DESTINATION DE REPLI EST `/guides`, et non `/accueil` : c'est la page dont
   * ce guide est un élément, celle où le membre voulait sans doute aller en
   * remontant. La story, elle, replie sur `/accueil` parce qu'une story n'a pas
   * de page de liste. Le raisonnement est le même ; la destination diffère parce
   * que le contenu diffère.
   */
  const onRetour = useCallback((): void => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/guides');
  }, [router]);

  /**
   * ── LE SIGNET ───────────────────────────────────────────────────────────
   *
   * `PUT /me/bookmarks` et `DELETE /me/bookmarks/GUIDE/:id` — les routes
   * GÉNÉRALES de §2.9, celles-là mêmes que l'écran K10 « Enregistrés » lit.
   * `BookmarkSubjectType` porte `GUIDE` depuis le début.
   *
   * ⚠ L'ÉTAT POSÉ EST CELUI QU'ON A DEMANDÉ, pas un état lu, et c'est la route
   * qui l'impose : `PUT` rend `{ id, state }` et `DELETE` un `204` — ni l'un ni
   * l'autre ne dit « c'est enregistré ». Les deux sont IDEMPOTENTS (`upsert` sur
   * la clé unique, `deleteMany`), donc « le serveur a répondu » vaut « l'état
   * voulu est atteint ». C'est la différence avec le signet d'une publication, où
   * `{ bookmarked }` est la valeur posée — et elle vient de la route, pas d'un
   * choix d'écran.
   *
   * CE N'EST DONC PAS DE L'OPTIMISME : rien n'est peint avant la réponse, et un
   * échec laisse le signet dans l'état où il était.
   *
   * `content.read` suffit (N0) : aucune fenêtre de niveau ne s'interpose, et il
   * ne faut pas qu'il y en ait — enregistrer est le geste le plus anodin du
   * produit.
   */
  const basculerSignet = useCallback((): void => {
    if (guideId === null || signetEnVol) return;
    const vise = !signet;
    setSignetEnVol(true);
    void (vise ? bookmarkGuide(guideId) : unbookmarkGuide(guideId))
      .then(() => {
        setSignet(vise);
        notifySuccess(vise ? 'Guide enregistré.' : 'Guide retiré des enregistrés.');
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'L’enregistrement n’a pas abouti. Réessayez dans un instant.',
        );
      })
      .finally(() => {
        setSignetEnVol(false);
      });
  }, [guideId, signet, signetEnVol]);

  /**
   * LE PANNEAU DE CORRECTION — son état, son appel et ses refus vivent dans
   * `correction-vivante.tsx`, et les DEUX pages qui le montent y puisent. Un second
   * état aurait divergé du premier.
   */
  const correction = useCorrection({
    guideId: detail?.guide.id ?? null,
    auteur: enTete?.auteurCourt ?? null,
    peut,
  });

  /**
   * `ouvrir` est passé aux DEUX `CorpsGuide` ; `useCallback` le rend stable pour
   * que l'écoute de sélection de chacun ne se réabonne pas à chaque rendu.
   */
  const ouvrirCorrection = useCallback(
    (passage: string) => {
      correction.ouvrir(passage);
    },
    [correction],
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS ACTIONS ET LES DEUX VOTES                                     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Les actions sur la page de détail des guides sont dessinées
   * aussi. » Elles l'étaient — trois `href="#"` et deux boutons sans geste — et
   * tout était branché derrière : `useGuide` rend `voter()` et
   * `signalerObsolete()`, et `/guides/:slug/corriger` existe.
   *
   * LES DEUX ÉCRITURES SONT EN N2 depuis la refonte des niveaux (`guide.vote`,
   * `report.create`). On le dit AVANT, plutôt que de laisser partir une requête
   * qui rendra 403.
   */
  const demanderVote = (valeur: 'HELPFUL' | 'NOT_HELPFUL'): void => {
    if (!peut('guide.vote')) {
      setNiveauRefuse('guide.vote');
      return;
    }
    if (voteEnVol) return;
    setVoteEnVol(true);
    void voter(valeur)
      .then((e) => {
        if (e !== null) notifyError(e.message);
      })
      .finally(() => {
        setVoteEnVol(false);
      });
  };

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CHANGER DE PAGE CHANGE L'ADRESSE — UNE PAGE SE PARTAGE                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `router.push` et non un état local, et c'est une décision de produit plus que
   * de code : une page d'un guide est un CONTENU, elle a son fil de commentaires
   * et son compteur, et un membre doit pouvoir en envoyer le lien. Un état local
   * aurait rendu la page 3 d'un guide inatteignable autrement qu'en cliquant deux
   * fois depuis la première.
   *
   * LES RANGÉES DU PANNEAU DE DROITE, ELLES, SONT DE VRAIS LIENS (`<Link>`, posé
   * par `A04_PLAN`) : rien ne passe par ici pour elles. Ce qui passe par ici, ce
   * sont les surfaces que la maquette dessine en `<span>` — les deux chevrons et
   * les rangées de la feuille de 390 px — et qui ne peuvent donc pas être des
   * liens sans redessiner la planche.
   */
  const allerPage = useCallback(
    (href: string | null): void => {
      if (href === null) return;
      setPlanOuvert(false);
      router.push(href);
    },
    [router],
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE NOM DE LA PAGE, AU MILIEU — DEUX GESTES POUR DEUX LARGEURS            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « au milieu le nom de la page, cliquable aussi. » Il ne dit pas
   * ce que le clic fait, et les deux planches n'offrent pas la même chose :
   *
   *   · à 390 px LA LISTE N'EST NULLE PART AILLEURS — la colonne de droite
   *     n'existe pas — donc le nom OUVRE la feuille des pages. C'est la lecture de
   *     l'instruction que le brief propose, et la mesure la confirme : sans elle,
   *     un guide de cinq pages ne se parcourt qu'en cliquant quatre fois sur un
   *     chevron ;
   *   · à 1 440 px la liste est DÉJÀ À L'ÉCRAN, dans la colonne de droite. Ouvrir
   *     une feuille du bas par-dessus un panneau qui montre la même chose serait
   *     une surface de plus pour rien. Le nom AMÈNE donc au panneau et met le
   *     focus sur la page lue — un geste réel, qui ne demande aucun dessin.
   *
   * ⚠ LA LARGEUR NE SE DEVINE PAS, ELLE SE MESURE DANS LE DOM. `ScreenFrames` rend
   * LES DEUX cadres et masque l'un par CSS, et Next rend d'abord côté serveur, où
   * la largeur de la fenêtre n'existe pas. On cherche donc le panneau VISIBLE —
   * `offsetParent === null` est le critère d'un élément masqué par un `display:
   * none` d'ancêtre, exactement ce que `lg:hidden` fait. C'est l'idiome que
   * `champVisible()` emploie déjà dans `use-editeur-guide.ts`.
   */
  const onNomPage = useCallback((): void => {
    if (typeof document !== 'undefined') {
      const rangees = [...document.querySelectorAll<HTMLElement>('a[data-guide-page]')].filter(
        (lien) => lien.offsetParent !== null,
      );
      /** La page LUE d'abord — c'est elle que l'œil cherche —, sinon la première. */
      const cible =
        rangees.find((lien) => lien.getAttribute('aria-current') === 'page') ?? rangees[0];
      if (cible !== undefined) {
        cible.scrollIntoView({ block: 'nearest' });
        cible.focus();
        return;
      }
    }
    setPlanOuvert(true);
  }, []);

  /**
   * LE PLAN, PRISES DE DESSIN ET GESTES RÉUNIS.
   *
   * `planDonnees` vient de `useGuide` — il ne porte que ce qui se dessine et les
   * deux booléens d'extrémité (voir `guidePlanFrom`). Les gestes sont accrochés
   * ici parce qu'ils demandent le routeur et l'état d'ouverture de la feuille,
   * c'est-à-dire des choses qui appartiennent à la page. Le même partage que
   * `guideHeadFrom` et les trois actions.
   *
   * LES CHAMPS SONT ÉNUMÉRÉS ET NON ÉTALÉS, exprès : `GuidePlanDonnees` porte
   * `hrefPrecedent` et `hrefSuivant`, que le cadre ne lit pas. Les étaler aurait
   * fait voyager dans la prise deux champs qui n'y ont rien à faire, et `tsc` ne
   * l'aurait pas dit (le contrôle des propriétés en trop ne s'applique pas à un
   * étalement).
   */
  const plan: GuidePlanView = {
    visible: planDonnees.visible,
    libelle: planDonnees.libelle,
    titre: planDonnees.titre,
    pages: planDonnees.pages.map((page) => ({
      ...page,
      onChoisir: () => {
        allerPage(page.href);
      },
    })),
    aPrecedent: planDonnees.aPrecedent,
    aSuivant: planDonnees.aSuivant,
    onPrecedent: () => {
      allerPage(planDonnees.hrefPrecedent);
    },
    onSuivant: () => {
      allerPage(planDonnees.hrefSuivant);
    },
    onNom: onNomPage,
    feuilleOuverte: planOuvert,
    onFermerFeuille: () => {
      setPlanOuvert(false);
    },
  };

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « LE BOUTON DE CONFIRMATION EST INATTEIGNABLE SUR 390 px » — MESURÉ      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Défaut relevé AU NAVIGATEUR pendant ce lot, à 390 px seulement, et Playwright
   * le nomme mot pour mot : « <button aria-label="Fermer"
   * data-guide-menu-voile=""> … intercepts pointer events », cinquante fois de
   * suite sur un clic qui n'arrivait jamais.
   *
   * LA CAUSE EST UNE PILE, ET ELLE EST CHIFFRÉE. La feuille du « … » de A04 est
   * dessinée par la maquette avec son voile et son panneau à `zIndex` 70 et 71 ;
   * `Modal`, qui porte les huit fenêtres du produit, rend à `zIndex` 60. Une
   * fenêtre ouverte DEPUIS la feuille sort donc SOUS elle : on voit la fenêtre à
   * travers le voile — il est translucide — et aucun de ses deux boutons ne
   * reçoit de clic.
   *
   * ⚠ LE DÉFAUT EST ANTÉRIEUR À CE LOT ET IL TOUCHE LES TROIS ACTIONS, pas
   * seulement celle d'obsolescence : la feuille ne se fermait sur AUCUNE d'elles.
   * « Proposer une correction » ouvre `PanneauCorrection`, « Signaler » pousse
   * `?feuille=signaler` — les deux arrivaient sous le même voile. C'est corrigé
   * pour les trois : laisser deux entrées mortes à côté d'une réparée aurait été
   * la moitié d'un branchement.
   *
   * ⚠ CE N'EST PAS UNE REMONTÉE DU `zIndex` DE `Modal`. Le toucher changerait la
   * pile des huit fenêtres transcodées d'un coup, sans mesure sur les sept
   * autres. Fermer la feuille avant d'ouvrir la fenêtre est le geste que
   * l'utilisateur attend de toute façon — la feuille a fait son travail, elle
   * part.
   *
   * À 1 440 px cette fonction ne change rien : `menuOuvert` y est toujours faux,
   * la colonne de droite n'ayant pas de feuille.
   */
  const fermerLaFeuilleDesActions = (): void => {
    setMenuOuvert(false);
  };

  const actions: readonly GuideActionView[] = [
    {
      ...(guideActions[0] ?? { label: 'Proposer une correction', icon: '' }),
      cle: 'corriger',
      /**
       * ── CE QUE CETTE ENTRÉE FAISAIT, ET POURQUOI ELLE NE LE FAIT PLUS ────
       *
       * Elle portait `vers: '/guides/:slug/corriger'` et le commentaire disait
       * « LA PAGE EXISTE […] C'est la seule des trois qui MÈNE quelque part ».
       * C'est exactement ce que le porteur a refusé : « Ça affiche une page mais
       * c'est un modal qui s'affiche à droite. »
       *
       * Elle OUVRE donc le panneau, en place, et elle ne mène plus nulle part —
       * ce qui la met au même rang que les deux autres : les trois agissent sur
       * la page, aucune ne la quitte. `A04_ACTIONS` le sait déjà faire : `vers`
       * est facultative, et sans elle l'entrée est rendue en `<button>` plutôt
       * qu'en `<a>` — « un `<a>` qui écrit serait un lien qui ment ».
       *
       * ⚠ ELLE EXIGE UN PASSAGE, ET ELLE LE DIT. Une correction est faite SUR UN
       * PASSAGE : `targetExcerpt` exige au moins trois caractères et le serveur
       * doit retrouver le passage dans la version courante — un panneau ouvert
       * sur le vide aurait un bouton d'envoi éteint quoi qu'on y écrive, ce qui
       * est le pire des deux mondes. L'entrée ouvre donc le panneau sur ce qui
       * est sélectionné, et demande une sélection sinon.
       *
       * ⚠ TEXTE QUI N'EST DANS AUCUNE MAQUETTE : « Surlignez d'abord le passage
       * à corriger dans le guide, puis touchez l'infobulle. » La planche ne
       * dessine pas l'état « aucun passage sélectionné » du panneau — elle ne
       * dessine que le panneau rempli. REMONTÉ au porteur.
       */
      onChoisir: () => {
        fermerLaFeuilleDesActions();
        const passage = passageSelectionne();
        if (passage === null) {
          notifyError(
            'Surlignez d’abord le passage à corriger dans le guide, puis touchez l’infobulle.',
          );
          return;
        }
        correction.ouvrir(passage);
      },
    },
    {
      ...(guideActions[1] ?? { label: "L'information a changé", icon: '' }),
      cle: 'obsolete',
      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ UNE BASCULE, PARCE QU'ON NE POUVAIT PAS SE DÉFAIRE                   ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * MESURÉ avant ce lot : `DELETE /guides/:id/outdated` était livré
       * (`guides.controller.ts`), `removeOutdatedFlag` était écrit dans
       * `screens/guides/api.ts`, `GET /guides/:slug` rendait `myOutdatedFlag`,
       * `useGuide` en dérivait `aSignale` — et `grep -rn aSignale apps/web/src`
       * ne trouvait QUE sa définition. Aucun cadre ne le lisait. Un membre qui
       * s'était trompé restait signalant pour toujours, alors que trois
       * signalements ouvrent une dépublication à trente jours.
       *
       * ── POURQUOI LA MÊME ENTRÉE, ET PAS UNE QUATRIÈME ──────────────────
       *
       * La maquette dessine TROIS actions, ni plus. Une entrée « Retirer mon
       * signalement » de plus serait un dessin que personne n'a dessiné, et
       * elle serait morte pour les 99 % de lecteurs qui n'ont rien signalé.
       * C'est donc la MÊME surface qui change de libellé et de geste, comme le
       * vote d'utilité change d'état sur le même bouton.
       *
       * ⚠ LE LIBELLÉ DE RETRAIT N'EST DANS AUCUNE MAQUETTE, et il n'est pas
       * rédigé ici non plus : « Retirer mon signalement » reprend le résumé que
       * la route porte elle-même dans l'API — « Retire son signalement
       * d'obsolescence » (`guides.controller.ts`), à la personne près. REMONTÉ
       * au porteur.
       *
       * ⚠ LE CADRE SE MET À JOUR SUR LES DEUX PLANCHES SANS RIEN DE PLUS, et ce
       * n'est pas une chance : la feuille « … » de 390 px reçoit `menu.actions`,
       * qui EST ce même tableau (voir `GuideMenuView`, qui écrit pourquoi il
       * n'en existe pas une seconde copie).
       */
      label: aSignale
        ? 'Retirer mon signalement'
        : (guideActions[1]?.label ?? "L'information a changé"),
      onChoisir: () => {
        fermerLaFeuilleDesActions();
        if (!peut('guide.propose_revision')) {
          setNiveauRefuse('guide.propose_revision');
          return;
        }
        if (obsoleteEnVol) return;
        setObsoleteCommentaire('');
        setObsoleteDemande(true);
      },
    },
    {
      ...(guideActions[2] ?? { label: 'Signaler', icon: '' }),
      cle: 'signaler',
      onChoisir: () => {
        /**
         * ⚠ SIGNALER EST EN N2 depuis la refonte. Un membre qui n'y est pas voit
         * l'invitation à monter plutôt qu'un formulaire qui finira en 403.
         */
        fermerLaFeuilleDesActions();
        if (!peut('report.create')) {
          setNiveauRefuse('report.create');
          return;
        }
        router.push(`/guides/${encodeURIComponent(slug)}?feuille=signaler`);
      },
    },
  ];

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES DEUX ACTIONS DE L'AUTEUR — LA FEUILLE DU « … » DE 390 px             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ sur les cadres produits : les deux gestes de la carte d'auteur de
   * 1 440 px n'existaient NULLE PART sur le téléphone. Zéro occurrence de
   * « Ouvrir à la communauté » dans la section `MOB` de la maquette, et le compte
   * des signalements y vit dans une rangée de statistiques qui ne mène à rien.
   *
   * CE SONT LES MÊMES LIBELLÉS ET LES MÊMES TRACÉS que la colonne d'ordinateur
   * (`guideActionsAuteur`, relevés sur la carte), et les MÊMES gestes : la rangée
   * de 1 440 px passe par `guide.hrefSignalements` et `guide.onCommunaute`, celle
   * de 390 px par ces deux entrées. Deux listes écrites séparément auraient
   * divergé au premier changement — c'est ce que `GuideMenuView` écrit déjà pour
   * les trois actions du lecteur.
   *
   * ⚠ LA PREMIÈRE MÈNE À UNE PAGE, ET ELLE EST POURTANT UN `onChoisir` : les
   * rangées de cette feuille empruntée sont des `<button>` (voir
   * `A04_FEUILLE_ACTIONS`, qui ne sait pas rendre de `<Link>`), et la planche
   * « menu de rôle » dont elle vient n'en dessine pas. La page est donc poussée au
   * routeur. Ce qu'on perd — le clic milieu, l'ouverture dans un onglet — est
   * assumé ICI et non à 1 440 px, où la rangée EST un `<Link>`. Remonté.
   */
  const actionsAuteur: readonly GuideActionView[] = [
    {
      ...(guideActionsAuteur[0] ?? { label: 'Signalements « a changé »', icon: '' }),
      cle: 'signalements',
      onChoisir: () => {
        fermerLaFeuilleDesActions();
        router.push(`/guides/${encodeURIComponent(slug)}/signalements`);
      },
    },
    {
      ...(guideActionsAuteur[1] ?? { label: 'Ouvrir à la communauté', icon: '' }),
      cle: 'communaute',
      /**
       * LE LIBELLÉ VIENT DE L'EN-TÊTE, donc du serveur : `communauteLabel` lit
       * `maintainedByCommunity` tel que `GET /guides/:slug` le rend. Tant que
       * l'en-tête n'est pas là, on garde celui de la maquette — le seul sens
       * qu'elle dessine.
       */
      label: enTete?.communauteLabel ?? guideActionsAuteur[1]?.label ?? 'Ouvrir à la communauté',
      onChoisir: () => {
        fermerLaFeuilleDesActions();
        if (communauteEnVol) return;
        setCommunauteDemande(true);
      },
    },
  ];

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE COMPTE DES COMMENTAIRES, UNE SEULE FOIS POUR DEUX ENDROITS            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il s'affiche à DEUX endroits — l'en-tête « N COMMENTAIRES » de l'article et le
   * titre « Commentaires · N » de la feuille — et c'est la même chose. Deux calculs
   * donneraient deux nombres, et le membre verrait lequel des deux a tort.
   *
   * `null` tant que `GET /guides/:slug` n'a pas répondu : on garde alors l'étiquette
   * de la maquette, comme le titre juste dessous, plutôt que d'écrire un zéro qui
   * ressemble à une donnée.
   */
  const compteCommentaires =
    detail === null ? null : detail.guide.commentCount + commentairesPostes;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA CARTE DU SUJET D'UN GUIDE N'EST PAS CELLE D'UNE PUBLICATION           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * A01C dessine en tête de sa feuille une carte qui dit SUR QUOI on commente :
   * un rond d'avatar, un nom, une étiquette de type, un extrait. Pour une
   * publication, les quatre sont de l'auteur et de son texte. Pour un guide,
   * l'équivalent honnête n'est pas identique, et chaque prise est remplie de ce que
   * le guide a RÉELLEMENT :
   *
   *   · `nom` → LE TITRE DU GUIDE, et non le nom d'une personne. Un guide est
   *     maintenu par plusieurs contributeurs (la rangée de pastilles de l'en-tête
   *     le dessine) ; y mettre le nom de l'auteur ferait croire que le fil commente
   *     quelqu'un, alors qu'il commente un document. Ce qui identifie un guide,
   *     c'est son titre — c'est aussi ce que son `<h1>` écrit, en 30 px.
   *   · `badge` → LA CATÉGORIE (`enTete.cat`, de `CATEGORY_LABEL`). C'est l'exact
   *     pendant de `typeLabel` sur une publication : la maquette dessine les deux
   *     en pastille, et A04 comme A03 mettent déjà la catégorie à cette place.
   *     RÈGLE DURE rappelée par `guides/from-api.ts` : aucune étiquette ne contient
   *     « certifié ».
   *   · `i` et `bg` → L'AUTEUR, par les DEUX MÊMES fabriques que la carte de A03
   *     (`initials` du nom, `avatarColor` du pseudo) et avec SON repli de §8 : un
   *     guide anonymisé n'a ni initiales ni teinte, et porte `·` sur `#8A958F`.
   *     Ce repli n'est pas inventé ici — il est recopié de `guideCardFrom`, pour
   *     que le même guide ne se peigne pas de deux façons selon l'écran.
   *     ⚠ PAS DE PHOTO, et ce n'est pas un oubli : `guideAuthorRefSchema` rend
   *     `{ handle, displayName, verificationLevel }`, SANS `avatarUrl`. La limite
   *     est en amont, dans les schémas du module Guides, et `guideCardFrom` la
   *     remonte déjà dans les mêmes termes.
   *   · `extrait` → ⚠ CETTE PRISE N'A PAS D'ÉQUIVALENT, et il faut le dire plutôt
   *     que d'y mettre un à-peu-près. Sur une publication, `extrait` est le DÉBUT
   *     DU CONTENU (`post.excerpt`). UN GUIDE N'EN A AUCUN :
   *
   *       — l'API ne rend pas d'accroche. `guideCardFrom` l'écrit déjà pour la
   *         carte de liste : « L'API ne renvoie PAS d'extrait sur une carte de
   *         liste […] Inventer un extrait en tronquant un corps qu'on n'a pas
   *         demanderait de charger tous les corps » ;
   *       — et `currentVersion.summary` N'EST PAS UN RÉSUMÉ DU GUIDE. MESURÉ sur
   *         les quatre seuls endroits qui l'écrivent, côté serveur : « Mise à jour
   *         par l'auteur » (`guides.service.ts` sur `PATCH`), « Retour à la
   *         version N » (retour arrière), `proposal.reason` (correction acceptée),
   *         et le résumé d'une conversion de parcours. C'est un JOURNAL DE
   *         VERSION, et ni `createGuideSchema` ni `updateGuideSchema` ne laissent
   *         un membre l'écrire — les deux sont `.strict()` et n'ont pas le champ,
   *         ce qu'un `400 UNRECOGNIZED_KEYS` a confirmé à la première mesure.
   *         L'afficher mettrait « Mise à jour par l'auteur » sous le titre du
   *         guide, en faisant passer une note de version pour une accroche.
   *
   *     CE QU'ON MET À LA PLACE, et pourquoi c'est vrai : la ligne « Mis à jour
   *     le … », qui est une RÈGLE DURE du produit (§9, T1 §6 : « aussi visible que
   *     le titre ») et vient de `lastContentUpdateAt`. Elle passe par
   *     `updatedLabel`, le même convertisseur que l'en-tête du guide et que les
   *     cartes de A03 — donc la même date, écrite de la même façon, partout.
   *     Ce n'est pas un extrait ; c'est le fait le plus utile que le produit
   *     connaisse sur un guide qu'on s'apprête à commenter. REMONTÉ : une vraie
   *     accroche se décide côté `guide_versions`, pas ici.
   *
   * `null` TANT QUE LE DÉTAIL N'EST PAS LÀ : la feuille se rend alors sans son
   * encart, ce que le ternaire du cadre prévoit — « mieux vaut pas de carte qu'une
   * carte d'exemple ».
   */
  const sujetCarte =
    detail === null || enTete === null
      ? null
      : {
          i: detail.guide.author === null ? '·' : initials(detail.guide.author.displayName),
          bg: detail.guide.author === null ? '#8A958F' : avatarColor(detail.guide.author.handle),
          nom: enTete.title,
          badge: enTete.cat,
          extrait: enTete.updated,
        };

  const data: A04Data = {
    rail,
    panelGuides,
    shortcuts,
    /**
     * L'EN-TÊTE DU GUIDE — titre, catégorie, portée, date, bandeau et compteurs.
     *
     * Elle vient de `GET /guides/:slug` dès qu'il a répondu, et c'est elle qui fait
     * que cette page cesse d'afficher « Obtenir la garantie Visale sans CDI » pour
     * tous les guides. Avant la réponse, on garde celle de la MAQUETTE plutôt qu'un
     * titre vide : c'est le même choix que pour l'historique juste dessous, et le
     * rendu serveur n'a alors rien d'autre à montrer.
     */
    /**
     * L'ÉTIQUETTE « N COMMENTAIRES » EST RECOMPOSÉE quand le membre vient d'en
     * envoyer un : voir `compteCommentaires`. Elle passe par `phraseCommentaires`,
     * la MÊME fabrique que `guideHeadFrom` emploie — deux façons d'accorder le
     * singulier finiraient par se contredire sur « 1 COMMENTAIRE ».
     */
    /**
     * ⚠ `onCommunaute` EST POSÉE ICI, ET PAS DANS `guideHeadFrom` : elle ouvre une
     * FENÊTRE, donc elle a besoin d'un état qui vit dans cette page. C'est le même
     * partage que pour le plan des pages — la fabrique compose ce qui se déduit de
     * la réponse, la page apporte ce qui se clique.
     */
    guide: {
      ...(enTete === null
        ? EN_TETE_AVANT_REPONSE
        : compteCommentaires === null
          ? enTete
          : { ...enTete, commentaires: phraseCommentaires(compteCommentaires) }),
      onCommunaute: () => {
        if (communauteEnVol) return;
        setCommunauteDemande(true);
      },
    },
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE CORPS DU GUIDE                                                   ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur, capture à l'appui : « tout ça est dessiné ». Les deux sections
     * de la planche — « Vérifier votre éligibilité », « Transmettre au
     * propriétaire » — et leur texte sur Visale s'affichaient sur TOUS les
     * guides. `currentVersion.body` était là depuis le début.
     *
     * TANT QUE L'API N'A PAS RÉPONDU, on ne rend rien : le squelette du corps
     * serait un faux guide, et c'est précisément le défaut qu'on corrige. Le
     * titre, lui, garde celui de la maquette — c'est le choix déjà fait au-dessus
     * et il tient, parce qu'un titre vide ferait sauter la page.
     */
    corpsGuide:
      detail === null || detail.currentVersion === null ? null : (
        <CorpsGuide
          body={detail.currentVersion.body}
          planche="desktop"
          auteurImage={enTete?.auteurCourt ?? null}
          onProposerCorrection={ouvrirCorrection}
        />
      ),
    /**
     * LE MÊME CORPS, DESSINÉ POUR 390 px. `ScreenFrames` rend les DEUX cadres et
     * masque l'un par CSS ; un seul nœud donnerait donc le dessin d'image
     * d'ordinateur sur le téléphone — 220 px de haut, rayon 18, légende sous le
     * bloc — là où la planche mobile dessine 170 px, rayon 14, légende DANS le
     * bloc. Voir `A04_CORPS` et l'en-tête de `CorpsGuide`.
     */
    corpsGuideMobile:
      detail === null || detail.currentVersion === null ? null : (
        <CorpsGuide
          body={detail.currentVersion.body}
          planche="mobile"
          auteurImage={enTete?.auteurCourt ?? null}
          onProposerCorrection={ouvrirCorrection}
        />
      ),
    contributors,
    guideActions: actions,
    voteUtile: detail?.myVote === 'HELPFUL',
    votePasUtile: detail?.myVote === 'NOT_HELPFUL',
    voteOccupe: voteEnVol,
    onVoteUtile: () => {
      demanderVote('HELPFUL');
    },
    onVotePasUtile: () => {
      demanderVote('NOT_HELPFUL');
    },
    /**
     * L'historique de l'API tant qu'il en donne un. Vide, on garde celui de la
     * maquette plutôt que d'afficher un encart « HISTORIQUE DES VERSIONS » sans
     * une ligne : la maquette n'en dessine pas la forme vide, et un cadre vide
     * n'est pas un dessin que le transcodage ait produit.
     */
    versions: versionRows.length > 0 ? versionRows : versionsMaquette,
    /**
     * LES DEUX GESTES DE LA BARRE HAUTE MOBILE QUI APPELLENT. Le partage et le
     * « … » n'y sont pas : ils ouvrent une surface, donc ils passent par
     * `data-modal-open` et la délégation, un peu plus bas.
     */
    entete: {
      onRetour,
      signet,
      onSignet: basculerSignet,
      signetOccupe: signetEnVol,
    },
    /**
     * LA FEUILLE DU « … » REND LES MÊMES ACTIONS QUE LA COLONNE D'ORDINATEUR.
     *
     * `actions` EST LA MÊME VALEUR que `guideActions` juste au-dessus — la même
     * référence, pas une copie : les trois libellés, les trois tracés et les trois
     * gestes sont déjà écrits une fois, et les recopier pour 390 px aurait fait
     * diverger les deux largeurs au premier changement. C'est précisément ce que
     * le porteur demande depuis le début (« veille toujours à ce que toutes les
     * corrections soient aussi faites sur mobile ») sans le payer en double.
     *
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ CE QUE CE BLOC DISAIT, ET QUI N'EST PLUS VRAI                        ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Il disait : « ⚠ SUR LA VUE AUTEUR, LA LISTE EST LA MÊME, et c'est un ÉCART
     * ASSUMÉ […] La feuille de son “…” offre donc les trois actions de lecture,
     * dont une (“Proposer une correction”) que l'API refusera à l'auteur de son
     * propre guide. REMONTÉ : il manque une planche “feuille d'actions, vue
     * auteur” pour trancher ce que ce “…” doit offrir. »
     *
     * L'ÉCART EST CORRIGÉ, ET SANS NOUVELLE PLANCHE. La feuille du « … » de la vue
     * AUTEUR ne porte plus d'actions du tout : elle porte « HISTORIQUE DES
     * VERSIONS », emprunté à la colonne de 1 440 px où il est dessiné sur les deux
     * planches et qu'AUCUN cadre mobile ne dessinait. Le pourquoi — les trois
     * actions étaient fausses sur son propre guide, et la consigne littérale de la
     * maquette aurait répété les deux boutons de sa barre basse — est écrit une
     * fois, à `FEUILLE_VERSIONS` dans `tools/screens/03-accueil.mjs`.
     *
     * ⚠ `menu.actions` RESTE PASSÉ, ET N'EST PLUS LU PAR CE CADRE : les quatre
     * cadres de A04 partagent une seule forme de données, et celui du LECTEUR à
     * 390 px rend toujours ces trois actions. La prise ne peut donc pas disparaître
     * ; c'est le cadre de l'auteur qui a cessé de s'en servir.
     */
    menu: {
      ouvert: menuOuvert,
      onFermer: () => {
        setMenuOuvert(false);
      },
      /**
       * ⚠ DEUX LISTES, ET C'EST LE SERVEUR QUI CHOISIT. `isAuthor` est recalculé à
       * chaque requête ; c'est lui qui décide quel CADRE est monté (voir
       * `vueAuteur` plus bas), donc c'est lui qui doit décider quelle liste la
       * feuille reçoit. Les trois actions du lecteur sur son propre guide seraient
       * trois refus — l'API répond `OWN_GUIDE` à « Proposer une correction ».
       */
      actions: isAuthor ? actionsAuteur : actions,
    },
    plan,
  };

  /**
   * LE LIEN PARTAGÉ — et la condition d'ouverture de la feuille, en une valeur.
   *
   * IL PORTE LE SLUG, PAS L'IDENTIFIANT : §2.1 fige le slug à la publication —
   * « jamais modifié » — précisément pour qu'un lien partagé dans une
   * conversation continue de fonctionner. Un lien d'UUID aurait marché aussi
   * (la route le refuserait : `GET /guides/:slug` est par slug), mais c'est le
   * slug qui est l'adresse.
   *
   * `window.location.origin` n'est lu qu'à l'ouverture : cette page est
   * `'use client'`, mais Next la rend d'abord sur le serveur, où `window`
   * n'existe pas.
   */
  /**
   * ⚠ IL PORTE LA PAGE LUE DEPUIS CE LOT, et c'est le même raisonnement que pour
   * `router.push` : une page est un contenu, avec son fil et son compteur. Partager
   * l'adresse du guide depuis sa page 4 aurait envoyé le lecteur sur la page 1, et
   * le commentaire dont on parlait ne serait nulle part. `planDonnees.pages` porte
   * déjà l'adresse canonique de chaque page — première page comprise, qui reste
   * `/guides/:slug` pour ne pas créer deux adresses du même contenu.
   */
  const lienPartage =
    partage && typeof window !== 'undefined'
      ? `${window.location.origin}${
          planDonnees.pages.find((page) => page.actif)?.href ??
          `/guides/${encodeURIComponent(slug)}`
        }`
      : null;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA VUE AUTEUR EST ACCORDÉE PAR LE SERVEUR — ELLE N'EST PLUS À DEMANDER    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ELLE LISAIT `auteur && isAuthor`, c'est-à-dire `?vue=auteur` ET l'accord du
   * serveur. DÉFAUT MESURÉ pendant le lot qui a branché « Modifier » :
   * `grep -rn 'vue=auteur' apps/web/src` ne trouve QUE des commentaires et la
   * lecture du paramètre — AUCUN lien, AUCUN `router.push` ne le pose. La vue
   * auteur n'était donc atteignable qu'en tapant la requête à la main, et les deux
   * boutons « Modifier » qu'on vient de rendre vivants seraient restés hors de
   * portée d'un auteur réel.
   *
   * PIRE : l'auteur recevait la vue LECTEUR sur son propre guide, dont la colonne
   * d'actions propose « Proposer une correction » — que l'API refuse sur son propre
   * guide (`OWN_GUIDE`, §2.4). L'écran offrait donc un geste impossible et cachait
   * les deux qui existent.
   *
   * ── CE QUE LA MAQUETTE DIT, ET QUI TRANCHE ────────────────────────────────
   *
   * Elle nomme ses planches « VUE LECTEUR » et « VUE AUTEUR — “Proposer une
   * correction” laisse place à Modifier et aux propositions reçues ». Ce sont deux
   * états du même écran décidés par QUI LIT, pas par ce que l'adresse demande.
   * C'est donc `isAuthor` — recalculé par le serveur à chaque requête, et jamais
   * une copie gardée — qui décide seul.
   *
   * ⚠ CE N'EST TOUJOURS PAS UNE AUTORISATION : les gestes de l'auteur sont TENTÉS
   * et c'est l'API qui refuse. `isAuthor` ne décide que du DESSIN.
   *
   * ⚠ `?vue=auteur` RESTE ACCEPTÉ et n'est plus une condition : les adresses qui le
   * portent déjà (dont deux suites d'épreuves) continuent de répondre, simplement
   * il ne change plus rien. Il n'est donc plus destructuré ci-dessus. REMONTÉ au
   * porteur : s'il veut qu'un auteur puisse relire son guide « comme un lecteur »,
   * c'est un paramètre INVERSE (`?vue=lecteur`) qu'il faut, et la maquette ne
   * dessine pas ce geste.
   */
  /**
   * L'ÉTAT « MAINTENU PAR LA COMMUNAUTÉ », LU UNE FOIS.
   *
   * ⚠ IL NE SE LIT PAS SUR `enTete.community`, et c'est mesuré : cette prise-là
   * veut dire « c'est le bandeau VERT qu'il faut dessiner », pas « le guide est
   * ouvert ». Un guide à la fois ouvert ET périmé affiche l'avertissement ambre,
   * donc `community` y est FAUX alors que le guide EST ouvert — et la fenêtre
   * aurait proposé d'ouvrir ce qui l'est déjà. C'est `maintainedByCommunity`, le
   * booléen que §2.5 nomme, qui tranche.
   */
  const guideOuvert = detail?.guide.maintainedByCommunity ?? false;

  const vueAuteur = isAuthor;

  return (
    <>
      {/**
       * ── « L'INFORMATION A CHANGÉ » PASSE PAR UNE CONFIRMATION ────────────
       *
       * C'est un signalement de modération : au-delà d'un seuil (§2.6), le guide
       * bascule en « à vérifier » pour tout le monde. Un clic malheureux dans une
       * colonne d'actions ne doit pas le déclencher — même règle que le blocage
       * et la suppression d'une publication.
       */}
      {/**
       * ── LA MÊME FENÊTRE POUR LES DEUX SENS DE LA BASCULE ─────────────────
       *
       * Deux fenêtres montées côte à côte auraient posé deux voiles et deux
       * panneaux, et il aurait fallu tenir d'accord leurs deux états
       * d'ouverture. Une seule suffit : les deux gestes ne peuvent pas être
       * demandés en même temps, puisque c'est la même entrée d'écran.
       *
       * ⚠ LE RETRAIT NE PORTE PAS DE CHAMP. Il n'a rien à dire — la route
       * `DELETE` n'accepte aucun corps — et un champ laissé à l'écran aurait
       * laissé croire qu'on peut motiver un retrait.
       */}
      <FenetreConfirmation
        ouverte={obsoleteDemande}
        titre={
          aSignale ? 'Retirer votre signalement ?' : 'Signaler que l’information a changé ?'
        }
        question={
          aSignale
            ? 'Votre signalement ne comptera plus. Si le guide repasse sous le seuil, il cesse d’être marqué « à vérifier » et son délai de dépublication est effacé.'
            : 'Les contributeurs du guide seront prévenus, et le guide passera en « à vérifier » si assez de membres le signalent.'
        }
        {...(aSignale
          ? {}
          : {
              champ: {
                /**
                 * ⚠ TEXTE HORS MAQUETTE, et la planche n'en dessine aucun :
                 * « Ce qui a changé (facultatif) » suit la forme du seul champ
                 * libre que le produit dessine, le « Détails (facultatif) » de
                 * X03 — le mot entre parenthèses PORTE le caractère facultatif,
                 * plutôt qu'un astérisque ou rien du tout. REMONTÉ au porteur.
                 */
                libelle: 'Ce qui a changé (facultatif)',
                valeur: obsoleteCommentaire,
                onChange: setObsoleteCommentaire,
                max: OBSOLETE_COMMENTAIRE_MAX,
              },
            })}
        libelleConfirmer={aSignale ? 'Retirer' : 'Signaler'}
        occupe={obsoleteEnVol}
        onConfirmer={() => {
          if (obsoleteEnVol) return;
          setObsoleteEnVol(true);
          /**
           * LE COMMENTAIRE EST OMIS PLUTÔT QUE VIDE, et c'est obligatoire :
           * `guideOutdatedFlagSchema` est `.strict()` avec `min(1)` sur la
           * chaîne, donc `{ comment: '' }` serait REFUSÉ à la frontière — et
           * refusé par le `parse` du front, avant même de partir.
           */
          const dit = obsoleteCommentaire.trim();
          const appel = aSignale
            ? retirerSignalement()
            : signalerObsolete(dit === '' ? undefined : dit);
          void appel
            .then((e) => {
              if (e !== null) {
                notifyError(e.message);
                return;
              }
              setObsoleteDemande(false);
              setObsoleteCommentaire('');
              notifySuccess(
                aSignale
                  ? 'Votre signalement a été retiré.'
                  : 'Merci — les contributeurs du guide sont prévenus.',
              );
            })
            .finally(() => {
              setObsoleteEnVol(false);
            });
        }}
        onAnnuler={() => {
          if (obsoleteEnVol) return;
          setObsoleteDemande(false);
          setObsoleteCommentaire('');
        }}
        nom="GUIDE_OBSOLETE"
      />
      {/**
       * ── « OUVRIR À LA COMMUNAUTÉ » DIT CE QU'ON PERD, AVANT ──────────────
       *
       * §2.4, ligne 52 : « Si le guide est `maintained_by_community` : les
       * propositions vont directement en file de modération, sans passer par le
       * créateur. » C'est ce que cette fenêtre doit annoncer, et c'est tout
       * l'intérêt de la poser : ouvrir sans prévenir ferait renoncer un auteur à
       * son droit de regard en un clic, depuis une rangée de menu.
       *
       * ⚠ LES DEUX SENS, UNE SEULE FENÊTRE — même raison que pour l'obsolescence
       * juste au-dessus : c'est la même rangée d'écran, donc les deux gestes ne
       * peuvent pas être demandés en même temps. §2.5 : « Réversible si l'auteur
       * revient et le demande. »
       *
       * ⚠ AUCUN CHAMP : la route ne reçoit qu'un booléen
       * (`guideCommunityMaintenanceSchema`), et un champ libre laissé à l'écran
       * aurait laissé croire qu'on peut motiver la bascule.
       *
       * ⚠ TEXTES HORS MAQUETTE — la planche ne dessine aucune fenêtre pour ce
       * geste, elle ne dessine que la rangée. Les quatre phrases ci-dessous
       * REPRENNENT la spécification (§2.4 ligne 52, §2.5) plutôt que de la
       * paraphraser, et elles sont REMONTÉES au porteur : c'est à lui de trancher
       * les mots d'une fenêtre qui fait renoncer à un droit.
       */}
      <FenetreConfirmation
        ouverte={communauteDemande}
        titre={
          guideOuvert ? 'Reprendre la main sur ce guide ?' : 'Ouvrir ce guide à la communauté ?'
        }
        question={
          guideOuvert
            ? 'Les propositions de correction vous seront de nouveau soumises avant d’être appliquées, et le bandeau « Maintenu par la communauté » disparaît.'
            : 'Les propositions de correction iront DIRECTEMENT en file de modération : elles ne passeront plus par vous. Le guide affichera « Maintenu par la communauté ».'
        }
        {...(guideOuvert
          ? {}
          : {
              precision:
                'Vous restez crédité comme auteur et vous pouvez toujours modifier le guide : c’est la VALIDATION des corrections que vous déléguez. Vous pouvez revenir en arrière à tout moment.',
            })}
        libelleConfirmer={guideOuvert ? 'Reprendre la main' : 'Ouvrir'}
        occupe={communauteEnVol}
        onConfirmer={() => {
          if (communauteEnVol) return;
          setCommunauteEnVol(true);
          void basculerCommunaute(!guideOuvert)
            .then((e) => {
              if (e !== null) {
                notifyError(e.message);
                return;
              }
              setCommunauteDemande(false);
              notifySuccess(
                guideOuvert
                  ? 'Vous avez repris la main : les propositions vous seront de nouveau soumises.'
                  : 'Ce guide est maintenant maintenu par la communauté.',
              );
            })
            .finally(() => {
              setCommunauteEnVol(false);
            });
        }}
        onAnnuler={() => {
          if (communauteEnVol) return;
          setCommunauteDemande(false);
        }}
        nom="GUIDE_COMMUNAUTE"
      />
      {/**
       * ── UNE SEULE FENÊTRE DE NIVEAU, DEUX SOURCES DE REFUS ──────────────
       *
       * `niveauRefuse` est celui de cette page (vote, obsolète, signalement) ;
       * `correction.niveauRefuse` celui du panneau, qui peut venir du front
       * (`peut()` avant d'ouvrir) OU du serveur (`403 LEVEL_REQUIRED` à l'envoi,
       * avec la capacité QU'IL nomme). Deux fenêtres montées en même temps
       * poseraient deux voiles et deux panneaux superposés ; une seule suffit,
       * puisque les deux refus ne peuvent pas être en cours à la fois.
       */}
      <FenetreNiveau
        capacite={niveauRefuse ?? correction.niveauRefuse}
        onFermer={() => {
          setNiveauRefuse(null);
          correction.fermerNiveau();
        }}
      />
      {correction.ouverte && <PanneauCorrection vue={correction.vue} />}
      {correction.echec !== null && (
        <p
          role="alert"
          style={{
            margin: '12px 24px 0',
            padding: '12px 16px',
            borderRadius: '14px',
            background: '#FDF0E7',
            color: '#B4581F',
            fontSize: '13px',
          }}
        >
          {correction.echec}
        </p>
      )}
      {echec !== null && (
        <p
          role="alert"
          style={{
            margin: '12px 24px 0',
            padding: '12px 16px',
            borderRadius: '14px',
            background: echec.incident ? '#FDF0E7' : '#F2F5F4',
            color: echec.incident ? '#B4581F' : '#5D6B66',
            fontSize: '13px',
          }}
        >
          {echec.message}
        </p>
      )}
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ L'EN-TÊTE « N COMMENTAIRES » OUVRE LA FEUILLE, PAR DÉLÉGATION        ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le bouton est ENFOUI dans un cadre transcodé — `A04_COMMENTAIRES` le pose
       * sur les QUATRE planches — et il porte `data-modal-open="A01C"`, le MÊME
       * attribut que « Commenter » sur le fil. On l'écoute donc comme le fil
       * l'écoute : un seul `onClick` qui remonte par `closest()`. Faire voyager une
       * fonction jusqu'à un bouton enfoui à six niveaux dans du JSX généré est
       * précisément ce que ce dépôt évite.
       *
       * `display: contents` : L'ENVELOPPE NE DOIT RIEN CHANGER AU DESSIN. Les
       * événements remontent l'arbre DOM, pas l'arbre de mise en page, donc la
       * délégation marche et `ScreenFrames` garde exactement sa boîte — son
       * `minHeight: 100vh` et son centrage à 1 440 px ne sont pas réinterprétés par
       * un parent de plus. C'est le même procédé que le `<main style={{ display:
       * "contents" }}>` que le générateur pose déjà dans les cadres mobiles.
       */}
      <div
        style={{ display: 'contents' }}
        onClick={(event) => {
          const cible = event.target;
          if (!(cible instanceof Element)) return;
          const ouvrir = cible.closest('[data-modal-open]');
          if (ouvrir === null) return;
          const quoi = ouvrir.getAttribute('data-modal-open');
          /**
           * ── TROIS SURFACES PASSENT PAR CET ÉCOUTEUR, PAS UNE ──────────────
           *
           * `A01C` (les commentaires) était la seule ; la barre haute mobile en
           * ajoute DEUX, et les deux sont enfouies dans un cadre transcodé —
           * `markTriggers` leur a posé `data-modal-open` exactement comme à
           * « Commenter » sur le fil.
           *
           * LA FEUILLE D'ACTIONS ET LE PARTAGE NE SONT PAS GARDÉS PAR
           * `correction.ouverte`, et la raison tient en une phrase : ils sont
           * DANS LA BARRE HAUTE, qui est derrière le voile du panneau de
           * correction (`fixed`, `inset: 0`). Un clic à leur endroit ferme le
           * panneau, il ne les atteint pas. Le garde reste donc sur `A01C`, dont
           * l'en-tête est, lui, dans la colonne de contenu — c'est la ceinture
           * déjà écrite plus bas, et elle n'a pas à s'élargir à des boutons
           * inatteignables.
           */
          if (quoi === 'A04MENU') {
            setMenuOuvert(true);
            return;
          }
          if (quoi === 'A01P') {
            setPartage(true);
            return;
          }
          if (quoi !== 'A01C') return;
          /**
           * ── DEUX SURCOUCHES SUR LA MÊME PAGE, ET UNE SEULE À LA FOIS ──────
           *
           * Cette page monte DÉJÀ le panneau « Proposer une correction » (A06),
           * et le porteur a tranché que ce panneau vit ici : « Ça affiche une page
           * mais c'est un modal qui s'affiche à droite. » Deux surcouches peuvent
           * donc se disputer l'écran.
           *
           * CE QUI L'EMPÊCHE DÉJÀ, mesuré dans la maquette et dans le générateur
           * plutôt que supposé : le panneau de correction pose un VOILE `fixed`
           * sur toute la page (`rgba(22,33,29,.45)` sur l'ordinateur, `.5` sur le
           * mobile), et `regions:` en fait une FERMETURE. L'en-tête des
           * commentaires est derrière ce voile : un clic à son endroit ferme le
           * panneau, il n'atteint pas le bouton. Dans l'autre sens, la feuille
           * A01C pose son propre voile à `.55`, donc ni l'en-tête ni l'infobulle
           * de sélection ne sont atteignables tant qu'elle est ouverte.
           *
           * CE GARDE EST DONC UNE CEINTURE, et il est écrit comme telle. Il dit
           * surtout LEQUEL DES DEUX A LA PRIORITÉ si un chemin inattendu s'ouvre
           * (clavier, lecteur d'écran, un z-index qui change) : LA CORRECTION, et
           * pour une raison vérifiable — elle tient un BROUILLON que le membre a
           * tapé (passage, remplacement, motif, source), là où la feuille de
           * commentaires n'a au plus qu'un commentaire non envoyé. On ne recouvre
           * pas un formulaire rempli par un lecteur.
           *
           * ⚠ ET ON NE FERME PAS LE PANNEAU D'OFFICE : `Correction` n'expose pas
           * de `fermer()` — seuls le voile et Échap ferment — et l'élargir pour
           * cela mettrait à la charge de cette page une décision qui appartient à
           * `correction-vivante.tsx`. REMONTÉ.
           */
          if (correction.ouverte) return;
          setCommentaires(true);
        }}
      >
        {vueAuteur ? (
          <ScreenFrames
            screen="A04-auteur"
            desktop={<A04AuteurDesktop {...data} />}
            mobile={<A04AuteurMobile {...data} />}
          />
        ) : (
          <ScreenFrames
            screen="A04"
            desktop={<A04Desktop {...data} />}
            mobile={<A04Mobile {...data} />}
          />
        )}
      </div>
      {/**
       * LA FEUILLE A01C, SUR LE GUIDE. `Modal` rend les DEUX planches — fenêtre
       * centrée de 720 px au-delà du seuil, feuille du bas à 88 % avec sa poignée
       * en dessous — exactement comme sur le fil, et c'est ce que la maquette
       * dessine : « fenêtre sur web, feuille sur mobile ».
       *
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LE SUJET EST `GUIDE_PAGE`, ET IL NE PEUT PLUS ÊTRE `GUIDE`            ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le porteur : « Les commentaires concernent donc une page du guide. »
       *
       * CE QUI ÉTAIT ÉCRIT ICI, et qui était devenu FAUX : `{ subjectType:
       * 'GUIDE', subjectId: detail.guide.id }`. MESURÉ côté API après le lot du
       * modèle : `GUIDE` répond `404` — en LECTURE comme en ÉCRITURE — et c'est
       * voulu, plus aucun commentaire ne s'attache à un guide. Commenter un guide
       * était donc cassé sur les quatre planches, sans aucune erreur de
       * compilation : l'union de `fetchComments` portait encore `'GUIDE'`, et un
       * `404` à l'ouverture de la feuille se lit comme un fil vide.
       *
       * `detail.currentPage.id` EST LE SUJET, et `currentPage` est renvoyée EN
       * ENTIER par le serveur pour cette raison même — « l'écran a besoin de son
       * `id` pour charger et poster les commentaires ». Ce n'est PAS
       * `detail.guide.id`, et ce n'est pas non plus un slug : `subjectId` est un
       * `uuid` dans `createCommentSchema`.
       *
       * `POST /comments` reste à `comment.create`, donc N0 : aucune fenêtre de
       * niveau ne s'interpose, et il ne faut pas qu'il y en ait (§9 : « un L0 peut
       * commenter ET RÉAGIR »).
       *
       * ⚠ CE QUI N'A PAS BOUGÉ : LE SIGNET. `putBookmarkSchema` prend un sujet
       * `GUIDE`, et c'est juste — on enregistre UN GUIDE, pas une de ses pages.
       * Même chose pour la recherche (`x01`), dont les résultats sont des guides.
       * Les deux ont été relus et laissés tels quels.
       */}
      <FenetreCommentaires
        sujet={
          commentaires && detail !== null
            ? { subjectType: 'GUIDE_PAGE', subjectId: detail.currentPage.id }
            : null
        }
        sujetCarte={sujetCarte}
        compte={compteCommentaires === null ? '' : `· ${String(compteCommentaires)}`}
        onCommente={() => {
          setCommentairesPostes((n) => n + 1);
        }}
        onFermer={() => {
          setCommentaires(false);
        }}
      />
      {/**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ « PARTAGER » SUR UN GUIDE — LA MÊME FEUILLE QUE SUR LE FIL            ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le rond de partage de la barre haute mobile était un `<span>` inerte, et
       * la page n'avait aucune feuille à monter.
       *
       * `FenetrePartage` VIVAIT DANS `screens/accueil/cartes-fil-vivantes.tsx`,
       * en fonction locale non exportée, et elle prenait un `postId` : elle
       * composait son lien, sa phrase et son objet de courriel autour de ce seul
       * identifiant. Rien d'autre ne la liait à une publication — c'est
       * exactement le marché que `FenetreCommentaires` a passé au lot précédent,
       * et il se tient ici dans les mêmes termes. Elle est donc DÉMÉNAGÉE dans
       * `@/components/fenetre-partage` et prend ses trois chaînes de l'appelant.
       *
       * ⚠ CE QUE LE PARTAGE EST RÉELLEMENT, et qui n'a pas changé : il n'existe
       * AUCUNE route de partage — ni pour une publication, ni pour un guide.
       * « ENVOYER À UN CONTACT » est un message privé, « DANS UN RÉSEAU » une
       * publication de réseau qui porte le lien. Les deux routes existantes
       * portent toutes les règles qu'un partage doit tenir.
       *
       * ⚠ ÉCART RESTANT : `/accueil` monte ENCORE sa propre copie de cette
       * feuille, en ligne dans la page (son `partage` et son `<Modal name="A01P">`
       * à la fin du fichier). Ce lot a réuni la carte de fil et le guide sur une
       * seule source ; la page du fil en reste à trois. REMONTÉ plutôt que
       * entrepris : son objet est plus large que l'en-tête d'un guide, et la
       * toucher ici aurait mêlé deux chantiers.
       */}
      <FenetrePartage
        lien={lienPartage}
        message={lienPartage === null ? '' : `Je partage ce guide avec vous : ${lienPartage}`}
        objetCourriel="Un guide de la diaspora"
        onFermer={() => {
          setPartage(false);
        }}
      />
      <span
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {chargement ? 'Chargement du guide' : 'Guide chargé'}
      </span>
    </>
  );
}
