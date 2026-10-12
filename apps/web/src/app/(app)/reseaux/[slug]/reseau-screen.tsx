'use client';

import { Modal } from '@/components/modal';
import { A01SDesktop } from '@/screens/a01s/desktop.generated';
import { A01SMobile } from '@/screens/a01s/mobile.generated';
import { A01GDesktop } from '@/screens/a01g/desktop.generated';
import { A01GMobile } from '@/screens/a01g/mobile.generated';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ScreenFrames } from '@/screens/frames';
import { A08Desktop } from '@/screens/a08/desktop.generated';
import { A08ChromeGaucheDesktop } from '@/screens/a08/chromegauche-desktop.generated';
import { A08BarreHauteDesktop } from '@/screens/a08/barrehaute-desktop.generated';
import { A08Mobile } from '@/screens/a08/mobile.generated';
import { A08TFil } from '@/screens/a08t/fil.generated';
import { A08TEvenements } from '@/screens/a08t/evenements.generated';
import { A08TMembres } from '@/screens/a08t/membres.generated';
import { A08TAlbum } from '@/screens/a08t/album.generated';
import { A08TAPropos } from '@/screens/a08t/apropos.generated';
import { A08TAdminFil } from '@/screens/a08t/adminfil.generated';
import { A08TAdminGerer } from '@/screens/a08t/admingerer.generated';
import { A08TAdminMembres } from '@/screens/a08t/adminmembres.generated';
import { A08TAdminEvenements } from '@/screens/a08t/adminevenements.generated';
import { A08TAdminAlbum } from '@/screens/a08t/adminalbum.generated';
import { A08TAdminAPropos } from '@/screens/a08t/adminapropos.generated';
import { A08TAdminAProposEdition } from '@/screens/a08t/adminaproposedition.generated';
import { A08TAdminAnnonce } from '@/screens/a08t/adminannonce.generated';
import { A08TFilMobile } from '@/screens/a08t/filmobile.generated';
import { A08TEvenementsMobile } from '@/screens/a08t/evenementsmobile.generated';
import { A08TMembresMobile } from '@/screens/a08t/membresmobile.generated';
import { A08TAlbumMobile } from '@/screens/a08t/albummobile.generated';
import { A08TAProposMobile } from '@/screens/a08t/aproposmobile.generated';
import { A08TAdminFilMobile } from '@/screens/a08t/adminfilmobile.generated';
import { A08TAdminGererMobile } from '@/screens/a08t/admingerermobile.generated';
import { A08TAdminMembresMobile } from '@/screens/a08t/adminmembresmobile.generated';
import { A08TAdminEvenementsMobile } from '@/screens/a08t/adminevenementsmobile.generated';
import { A08TAdminAlbumMobile } from '@/screens/a08t/adminalbummobile.generated';
import { A08TAdminAProposEditionMobile } from '@/screens/a08t/adminaproposeditionmobile.generated';
import { A08TAdminAnnonceMobile } from '@/screens/a08t/adminannoncemobile.generated';
import { a08Fallback } from '@/screens/a08/data';
import type { A08TData } from '@/screens/a08t/data';
import { useReseau } from '@/screens/reseaux/use-reseau';
import { useAnnonce } from '@/screens/reseaux/use-annonce';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreEcrire } from '@/components/fenetre-ecrire';
/**
 * LA FENÊTRE « NOUVEL ALBUM », pour le « Ajouter un album » du menu de l'onglet
 * « Album ».
 *
 * `POST /communities/:id/albums` prend un `title` OBLIGATOIRE (3–80), et AUCUNE
 * des quatre planches de l'onglet ne dessine de champ pour le saisir — compté.
 * Voir l'en-tête du composant, qui dit aussi d'où vient son châssis.
 */
import { FenetreAlbum } from '@/components/fenetre-album';
/**
 * L'INVITATION À MONTER DE NIVEAU, pour le refus de « Je viens ».
 *
 * `event.attend` est en N2 et le front PRÉVIENT sans autoriser (mémo §5) : on
 * tente, le serveur refuse en `403 LEVEL_REQUIRED`, et cette fenêtre écrit le
 * niveau exigé, la fonctionnalité et les conditions — tous lus sur la table que
 * le serveur applique, aucun mot écrit ici.
 */
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { CartesFilVivantes } from '@/screens/accueil/cartes-fil-vivantes';
/**
 * LES FENÊTRES DU LOT « RÉSEAU VIVANT » — une instance de chaque, hors des deux
 * cadres (la leçon `ScreenFrames` + portail, mesurée sur `FenetreConfirmation`).
 */
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { FenetreEvenement } from '@/components/fenetre-evenement';
import {
  FenetreContenuSignale,
  FenetreEpingler,
  FenetreSujet,
} from '@/components/fenetres-reseau';
import { topicBodySchema, topicTitleSchema } from '@app/shared';
import type { SectionGestion } from '@/screens/a08t/vivant';

/**
 * A08 et ses treize onglets. `/reseaux/:slug`
 *
 * ── CE QUE A08T EST, ET POURQUOI IL EST ICI ─────────────────────────────────
 *
 * A08T n'est pas un écran : c'est la ZONE DE CONTENU de A08, dessinée une fois par
 * onglet, en 1036 px. La maquette l'écrit sous sa planche — « zone de contenu seule
 * · menu de gauche et barre haute identiques à A08 ». Ce sont donc des VARIANTES
 * D'ÉTAT de cet écran, et elles vivent sur cette route, pas sur treize routes
 * inventées.
 *
 * ── LE MENU DE GAUCHE MANQUAIT, ET IL EST MAINTENANT EMPRUNTÉ ───────────────
 *
 * Le porteur, capture à l'appui : « la page de fil d'actualité N'A PAS DE MENU DE
 * GAUCHE ». MESURÉ avant correction, fenêtre de 1 440 px : sur
 * `?onglet=sujets` le lien « Accueil » du rail est à x = 32, y = 88 ; sur
 * `?onglet=fil` il n'existe pas du tout, et le cadre n'a qu'UN enfant large de
 * 1 440 px — la planche d'onglet, collée au bord gauche.
 *
 * ── CE QUI ÉTAIT ÉCRIT ICI, ET POURQUOI CE N'EST PLUS VRAI ──────────────────
 *
 * Cet en-tête disait : « rien dans la déclaration d'un écran ne sait découper un
 * cadre en chrome et contenu […] ce qu'il faudrait est un `slot` […] une
 * demi-journée d'outillage ». La deuxième phrase était juste, la première ne
 * l'était plus : `regions:` existe — il extrait une région bornée d'un cadre vers
 * son propre fichier généré, et A06 s'en sert déjà pour son panneau de
 * correction. Il lui manquait seulement de savoir porter PLUSIEURS prises (le
 * menu de gauche en lit trois : `rail`, `panelReseaux`, `shortcuts`).
 *
 * A08 déclare donc deux régions — `ChromeGauche` et `BarreHaute` — et cette page
 * les monte AUTOUR de la planche d'onglet. Rien n'est redessiné : la source reste
 * le cadre de A08, au caractère près, et la maquette l'autorise en toutes
 * lettres — la section A08T porte la légende « zone de contenu seule · MENU DE
 * GAUCHE ET BARRE HAUTE IDENTIQUES À A08 ».
 *
 * Sur MOBILE il n'y a AUCUN manque, et c'est mesuré : les planches de MOB2 sont
 * des téléphones complets, barre basse comprise — à 390 px, sur l'onglet
 * « Fil », le lien « Accueil » de la barre basse est à y = 766. La navigation par
 * onglets y est entière, donc on n'y monte rien.
 */

/** Les onglets, dans l'ordre de la maquette, et leur nom dans l'URL. */
const SLUGS = ['fil', 'sujets', 'evenements', 'membres', 'album', 'a-propos'] as const;

type Tab = {
  readonly desktop: (d: A08TData) => ReactNode;
  readonly mobile: (d: A08TData) => ReactNode;
};

/**
 * `sujets` n'a pas de planche A08T : c'est A08 lui-même que la maquette dessine sur
 * cet onglet (« /reseaux/:slug · onglet Sujets »). C'est pourquoi il est le seul à
 * garder le cadre complet, rail compris.
 */
const MEMBRE: Record<string, Tab> = {
  fil: { desktop: (d) => <A08TFil {...d} />, mobile: (d) => <A08TFilMobile {...d} /> },
  evenements: {
    desktop: (d) => <A08TEvenements {...d} />,
    mobile: (d) => <A08TEvenementsMobile {...d} />,
  },
  membres: { desktop: (d) => <A08TMembres {...d} />, mobile: (d) => <A08TMembresMobile {...d} /> },
  album: { desktop: (d) => <A08TAlbum {...d} />, mobile: (d) => <A08TAlbumMobile {...d} /> },
  'a-propos': {
    desktop: (d) => <A08TAPropos {...d} />,
    mobile: (d) => <A08TAProposMobile {...d} />,
  },
};

/**
 * La vue propriétaire. Trois onglets n'existent QUE pour elle — « Gérer », « Publier
 * une annonce », « À propos en mode édition » — et la maquette ne leur donne pas de
 * place dans la barre d'onglets : on y arrive par les actions du bandeau.
 *
 * `a-propos` en vue propriétaire N'A PAS de cadre mobile : la planche MOB2 passe
 * directement d'« Album — sélection » à « À propos — édition ». Ce n'est pas un
 * oubli de déclaration, c'est la maquette qui ne le dessine pas ; sur mobile cet
 * onglet retombe donc sur la vue membre, qui existe et dit la même chose.
 */
const PROPRIETAIRE: Record<string, Tab> = {
  fil: { desktop: (d) => <A08TAdminFil {...d} />, mobile: (d) => <A08TAdminFilMobile {...d} /> },
  membres: {
    desktop: (d) => <A08TAdminMembres {...d} />,
    mobile: (d) => <A08TAdminMembresMobile {...d} />,
  },
  evenements: {
    desktop: (d) => <A08TAdminEvenements {...d} />,
    mobile: (d) => <A08TAdminEvenementsMobile {...d} />,
  },
  album: {
    desktop: (d) => <A08TAdminAlbum {...d} />,
    mobile: (d) => <A08TAdminAlbumMobile {...d} />,
  },
  'a-propos': {
    desktop: (d) => <A08TAdminAPropos {...d} />,
    mobile: (d) => <A08TAProposMobile {...d} />,
  },
  gerer: {
    desktop: (d) => <A08TAdminGerer {...d} />,
    mobile: (d) => <A08TAdminGererMobile {...d} />,
  },
  annonce: {
    desktop: (d) => <A08TAdminAnnonce {...d} />,
    mobile: (d) => <A08TAdminAnnonceMobile {...d} />,
  },
  'a-propos-edition': {
    desktop: (d) => <A08TAdminAProposEdition {...d} />,
    mobile: (d) => <A08TAdminAProposEditionMobile {...d} />,
  },
};

/**
 * Les planches A08T de 1036 px portent leur mise en page dans le conteneur que le
 * générateur retire — `display: flex; flex-direction: column; gap: 14px`. C'est
 * l'espacement entre l'en-tête du réseau et les cartes de l'onglet, et il vient de
 * la maquette : recopié tel quel, plutôt que réinventé dans le JSX généré.
 *
 * `padding: 24px` et la bordure ne sont PAS repris : ils dessinent la planche de
 * documentation, pas l'écran.
 */
const BOARD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  width: '100%',
};

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ LA COLONNE DE DROITE DE A08, RECOPIÉE DEPUIS SA PLANCHE — DEUX STYLES    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * `regions:` extrait des ÉLÉMENTS — le menu de gauche, la barre haute — jamais les
 * deux conteneurs qui les tiennent : ceux-là contiennent aussi le CONTENU de A08,
 * c'est-à-dire ses sujets, qu'on ne veut surtout pas emporter ici.
 *
 * Ces deux styles sont donc recopiés de `a08/desktop.generated.tsx`, au caractère
 * près, et c'est la MÊME nature de transcription que `BOARD` juste au-dessus — qui
 * porte depuis le début le conteneur que le générateur retire aux planches A08T.
 * Aucune valeur n'est inventée : ni le retrait de 24 px à droite, ni les 12 px de
 * haut, ni l'écart de 16, ni la borne de 1 036 px — qui est précisément la largeur
 * à laquelle la maquette dessine les vingt-cinq planches d'onglet. C'est ce qui
 * fait que la zone de contenu tombe exactement là où A08 la dessine.
 */
const COLONNE_DROITE: React.CSSProperties = {
  flex: '1',
  minWidth: '0',
  display: 'flex',
  flexDirection: 'column',
  paddingRight: '24px',
};

const ZONE_CONTENU: React.CSSProperties = {
  flex: '1',
  padding: '12px 0 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  maxWidth: '1036px',
};

/**
 * ── CE QUE LES VINGT-CINQ PLANCHES LISENT MAINTENANT ───────────────────────
 *
 * Leur EN-TÊTE — le nom du réseau, ses initiales, son nombre de membres, son
 * genre, sa visibilité, sa description, et pour un propriétaire ses modérateurs
 * et ses demandes d'adhésion. Vingt-et-une des vingt-cinq le portent ; les
 * quatre autres (le formulaire d'annonce et deux formulaires mobiles) n'en
 * dessinent aucun, et c'est la maquette qui en décide.
 *
 * Elles écrivaient tout cela EN DUR. Un membre de « Sénégalais à Paris » ouvrait
 * son onglet « Membres » et lisait « Béninois en France · 890 membres ». Le
 * défaut se voyait à l'œil et aucun test ne le voyait, puisque le JSX compile.
 *
 * ── CE QUI RESTE DESSINÉ, ET IL FAUT LE DIRE ──────────────────────────────
 *
 * ⚠ CE PARAGRAPHE NOMMAIT QUATRE ONGLETS DE CONTENU DESSINÉ — album,
 * événements, fil, membres — et IL N'EN RESTE AUCUN. Le FIL montre ses vraies
 * publications (`A08T_FIL_PUBLICATIONS`), l'onglet MEMBRES ses vrais membres
 * (`A08T_MEMBRES_VUE_MEMBRE`), l'onglet ÉVÉNEMENTS ses vrais événements
 * (`A08T_EVENEMENTS`), et l'onglet ALBUM ses vraies photos depuis ce lot
 * (`A08T_ALBUM`) — chacun sur ses quatre planches et aux deux largeurs.
 *
 * ⚠ CE QUI RESTE DESSINÉ SUR L'ONGLET « ALBUM », et il faut le dire : le voile
 * « Masquer · Couverture » de la planche propriétaire de 1 036 px et la bande
 * « 1 photo sélectionnée » de celle de 390 px. Les deux étaient déjà inertes, et
 * aucune route ne les porte — le modèle `Album` n'a pas de colonne de couverture,
 * et « Masquer » ne se distingue pas de la sélection. REMONTÉS : il manque une
 * planche « une tuile et ses gestes ».
 *
 * ── ET LA ROUTE QUI MANQUAIT AUX ÉVÉNEMENTS A ÉTÉ ÉCRITE ──────────────────
 *
 * Ce paragraphe disait, et il avait raison au jour où il a été écrit :
 * « `eventsQuerySchema` est `.strict()` et ne porte AUCUN filtre de réseau […]
 * il n'existe pas de `GET /communities/:id/events` ». Les deux constats étaient
 * mesurés, et c'est pour cela que le lot précédent s'est arrêté : brancher
 * « Je viens » sur les trois événements DESSINÉS aurait fait s'inscrire à des
 * événements qui n'existent dans aucune base.
 *
 * `communityId` a été ajouté à `eventsQuerySchema` et au `visibleWhere` du
 * service — il s'AJOUTE aux règles de visibilité, il n'en remplace aucune, et
 * son en-tête dit pourquoi c'est l'inverse de ce que fait le fil. L'onglet lit
 * donc `GET /events?communityId=…`, ses deux pastilles choisissent la fenêtre
 * (`?to=hier` pour les passés), « Je viens » appelle `PUT /events/:id/rsvp` et
 * « Voir » mène à `/agenda/:id`.
 *
 * ⚠ CE QUI RESTE DESSINÉ SUR CET ONGLET, et il faut le dire : le bouton
 * « Créer un événement du réseau » des deux planches propriétaire (il demande
 * le formulaire entier de `POST /events`, que la planche ne dessine pas), et
 * l'aside « CE MOIS-CI · 3 · événements du réseau · 132 inscrits » des deux
 * planches de 1 036 px (aucune route ne la porte : la liste filtrée ne compte
 * que la fenêtre demandée, pas le mois civil). REMONTÉS tous les deux.
 *
 * Les deux filtres de l'onglet « Membres » restent dessinés eux aussi — le champ
 * « Rechercher parmi N membres » est un `<div>`, les pastilles « Tous ·
 * Modérateurs · Lyon » des `<span>` —, alors que `memberListQuerySchema` porte
 * `q` et `role`. REMONTÉ.
 */
/** Les onglets que la maquette ne dessine QUE pour l'équipe. */
const ONGLETS_EQUIPE = new Set(['gerer', 'annonce', 'a-propos-edition']);

export function ReseauScreen({
  onglet,
  section,
  slug: reseauSlug,
}: {
  readonly onglet: string;
  readonly section: SectionGestion;
  readonly slug: string;
}) {
  const rangDemande = Math.max(0, SLUGS.indexOf(onglet as (typeof SLUGS)[number]));

  const {
    data,
    onglet: enteteOnglet,
    pret,
    echec,
    membre,
    contenuFerme,
    reseau,
    gerer,
    contactEchec,
    ecrire,
    evenements,
    album,
    confirmation,
    onConfirmer,
    onAnnulerConfirmation,
    fenetreSujet,
    fenetreEpingler,
    fenetreEvenement,
    contenuSignale,
    onFermerContenuSignale,
    champCouverture,
    onFichierCouverture,
    composeur,
  } = useReseau(reseauSlug, rangDemande, section);

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LA VUE DE L'ÉQUIPE VIENT DU RÔLE, PLUS DE L'ADRESSE                      ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Uniquement un modérateur. » `?vue=proprietaire` décidait seul
   * des planches de l'équipe : n'importe quel membre qui suivait un lien
   * « Gérer » — ou tapait l'adresse — recevait la bande « Propriétaire du
   * réseau », ses outils et la vue de gestion, et la page d'un réseau dont on
   * n'était même pas membre montrait les outils d'un propriétaire. Le serveur
   * refusait déjà chacun de ces gestes (`MODERATOR_REQUIRED`) : c'est
   * l'AFFICHAGE qui mentait. La vue suit maintenant `myRole` de la fiche.
   *
   * ⚠ CE N'EST PAS UNE AUTORISATION (mémo §5) : un membre qui forcerait la vue
   * verrait des boutons dont chaque geste reste refusé par le serveur.
   */
  const equipe = reseau?.myRole === 'OWNER' || reseau?.myRole === 'MODERATOR';

  /**
   * QUI N'EST PAS MEMBRE NE VOIT QUE « À PROPOS » — le porteur : « Quand on
   * n'est pas encore membre d'un réseau uniquement afficher l'onglet À
   * propos. » Les liens des autres onglets disparaissent des cadres
   * (`RV_ONGLETS_FERMES`), et une adresse qui en vise un retombe ici.
   */
  const slug = (() => {
    if (pret && enteteOnglet.actions.ongletsFermes) return 'a-propos';
    if (pret && !equipe && ONGLETS_EQUIPE.has(onglet)) return 'fil';
    return onglet;
  })();

  const router = useRouter();

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LE FORMULAIRE D'ANNONCE — SON ÉTAT VIT ICI, PAS DANS `useReseau`          ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « L'annonce : tous les champs doivent être branchés. » Les deux
   * cadres d'annonce étaient entièrement inertes, et le contrat lui-même était en
   * deçà du dessin — voir l'en-tête de `use-annonce.ts`.
   *
   * ── POURQUOI UN CROCHET À PART, ET APPELÉ SANS CONDITION ───────────────────
   *
   * `useReseau` porte la fiche, les sujets, les demandes et la modération : il est
   * déjà la chose la plus chargée du module, et l'état d'un FORMULAIRE n'a rien à
   * voir avec le chargement d'un réseau. `useAnnonce` ne fait aucun appel au
   * montage — il n'écrit que sur `onPublier` — donc le monter sur les vingt-cinq
   * onglets ne coûte rien, et un crochet appelé conditionnellement serait de
   * toute façon interdit.
   *
   * ── APRÈS PUBLICATION, ON REVIENT AU FIL ──────────────────────────────────
   *
   * C'est la page qui le décide, parce qu'elle a le routeur : la même publication
   * demandée depuis une feuille n'irait pas au même endroit. Le fil est l'onglet
   * d'où la rangée « Outils du propriétaire » mène ici, et c'est aussi là que
   * l'annonce épinglée apparaît — « Épingler en haut du fil ».
   *
   * `router.push` et non `router.back` : la publication a changé l'état du
   * réseau, et revenir en arrière rejouerait l'entrée d'historique du formulaire.
   * « Annuler », lui, ne change rien et revient donc par le même chemin que la
   * croix d'A10 — `router.back()`.
   */
  const versLeFil = useCallback(() => {
    router.push(`/reseaux/${encodeURIComponent(reseauSlug)}?onglet=fil`);
  }, [reseauSlug, router]);

  const surAnnulation = useCallback(() => {
    router.back();
  }, [router]);

  const { annonce } = useAnnonce(reseauSlug, versLeFil, surAnnulation);

  const table = equipe ? PROPRIETAIRE : MEMBRE;
  // Un onglet inconnu — ou réservé au propriétaire quand on ne l'est pas — retombe
  // sur « Sujets », qui est ce que la maquette montre par défaut.
  const tab = table[slug] ?? MEMBRE[slug];

  // L'onglet « Sujets » en vue membre EST le cadre complet de A08, rail compris :
  // il n'a pas de coque de planche à reconstituer.
  // ⚠ POUR TOUT LE MONDE, ÉQUIPE COMPRISE : A08 dessine lui-même la bande de
  // l'équipe (`RV_BANDE_EQUIPE`), et un propriétaire sur « Sujets » recevait
  // jusqu'ici un écran VIDE — `tab` y est indéfini et le `return null` plus bas
  // l'attendait.
  const plain = slug === 'sujets' || tab === undefined;

  const a08 = pret && echec === null ? data : a08Fallback;

  /**
   * LES PRISES D'ANNONCE SONT FUSIONNÉES DANS L'OBJET DES VINGT-CINQ PLANCHES.
   *
   * `reseau-screen` passe le MÊME `A08TData` à toutes — c'est la raison écrite
   * dans `a08t/data.ts` pour `gerer` — et les planches qui n'en lisent rien ne le
   * déstructurent pas : le générateur ne déclare que ce que le JSX emploie.
   *
   * ⚠ LA FUSION VIENT APRÈS `enteteOnglet` et l'écrase donc : `useReseau` rend
   * `a08tFallback` tant que l'appel n'est pas revenu, et son `annonce` est le
   * composeur VIDE, aux gestes inertes. Sans cette priorité, le formulaire serait
   * mort pendant tout le chargement de la fiche — alors qu'il n'a besoin d'aucune
   * donnée du réseau pour fonctionner.
   */
  const ongletAvecAnnonce: A08TData = useMemo(
    () => ({ ...enteteOnglet, annonce }),
    [annonce, enteteOnglet],
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LE CADRE EST PEINT TOUT DE SUITE, ET L'ATTENTE EST UN FRÈRE — ELLE        ║
   * ║ REMPLAÇAIT TOUT L'ÉCRAN                                                   ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Un `if (!pret) return <p>Chargement du réseau…</p>` vivait ici. Sa raison
   * était bonne et elle est conservée plus bas : `enteteVide` ne portait que des
   * chaînes vides, et la maquette écrit ses séparateurs EN DUR
   * (`{reseau.membres} · {reseau.genre} · {reseau.monAppartenance}`), donc un
   * en-tête de repli laissait deux points médians orphelins. Ne pas les montrer
   * était juste.
   *
   * MAIS LE REMÈDE COÛTAIT PLUS CHER QUE LE MAL, et le prix ne se voyait pas à
   * l'œil parce qu'il n'était pas dans le navigateur : le SERVEUR n'a jamais la
   * donnée du réseau — elle arrive par un appel CLIENT — donc cette branche était
   * la seule chose qu'il rendait. Mesuré au `curl` sur
   * `/reseaux/beninois-en-france?onglet=fil` : QUATRE MOTS SERVIS,
   * « DisaporyPlus Chargement du réseau… ». Rail absent, panneau absent, onglets
   * absents. C'est la COQUILLE VIDE que ce dépôt a déjà corrigée sur seize routes
   * membre et six routes d'équipe, et un test la tenait déjà
   * (`e2e/accueil-lot2.spec.ts`, « le serveur rend le contenu, pas une coquille »)
   * — il était rouge, et il avait raison.
   *
   * La cause est traitée là où elle est : `enteteVide` porte désormais la marque
   * d'attente (un tiret cadratin) sur les quatre champs que la maquette encadre
   * de points médians. La ligne lit « — · — · — », aucun nom n'est emprunté, et
   * le cadre peut donc être peint immédiatement.
   *
   * ET L'ATTENTE EST UN FRÈRE DANS UN FRAGMENT, JAMAIS UN PARENT. Un conteneur
   * interposé casse le `position: sticky` de la barre haute et du rail — c'est la
   * leçon déjà payée sur `screens/compte/ecran-donnees.tsx` et sa jumelle
   * d'administration, et c'est la raison pour laquelle le porteur a demandé que
   * le panneau de gauche, la colonne de droite et l'en-tête de recherche restent
   * à l'écran pendant que le fil défile.
   */
  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA CONFIRMATION DU RETRAIT — UNE SEULE INSTANCE, DANS L'ÉCRAN              ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Emploie `components/fenetre-confirmation.tsx`. » §2.4 donne
   * aux modérateurs le droit de « retirer un membre (`BANNED` : ne peut plus
   * rejoindre) », et c'est le SEUL geste du module qui ne se défait pas :
   * `invite()` refuse de réinviter un banni, `join()` répond
   * `403 BANNED_FROM_COMMUNITY`. Les autres se défont — nommer modérateur se
   * révoque, masquer se démasque (13 §2), mettre en sourdine se rallume d'un
   * second clic — et leur poser une question serait du bruit.
   *
   * ── ELLE DIT CE QUE LES LIBELLÉS DESSINÉS NE DISENT PAS ──────────────────
   *
   * La maquette dessine DEUX entrées dans le menu de rôle — « Retirer du
   * réseau » et « Bannir du réseau » — alors que §2.4 n'en définit qu'UNE. Les
   * deux mènent donc au même geste, et c'est `precision` qui porte la vérité :
   * définitif, et la personne ne pourra plus rejoindre. REMONTÉ : deux entrées
   * pour un geste invitent à croire qu'il y en a deux ; au porteur de retirer
   * l'une des deux rangées du dessin.
   *
   * ── POURQUOI ICI ET NON DANS LE CADRE GÉNÉRÉ ─────────────────────────────
   *
   * ⚠ ELLE Y A ÉTÉ, ET ÇA NE MARCHAIT PAS. Mesuré au navigateur :
   * `ScreenFrames` rend les DEUX cadres et n'en masque qu'un par
   * `display: none`, et `Modal` se PORTALISE vers `document.body`. Deux copies
   * dans les deux cadres s'ouvraient donc ENSEMBLE sur le même
   * `gerer.bannirOuverte`, et le voile de celle du cadre masqué interceptait les
   * clics de l'autre — « subtree intercepts pointer events », cinquante-sept
   * tentatives de clic. S'y ajoutait deux fois le même `id` de titre, ce que
   * l'en-tête de `Modal` nomme déjà comme un défaut d'`aria-labelledby`.
   *
   * UNE SEULE INSTANCE RÈGLE LES DEUX, et la correction prend bien sur les deux
   * planches : c'est `Modal` qui choisit entre son panneau d'ordinateur et sa
   * feuille de téléphone (`DESKTOP_QUERY`), pas deux copies qui se gênent.
   *
   * ⚠ ELLE EST RENDUE SUR LES DEUX BRANCHES de ce composant — l'écran A08
   * (`plain`) et les planches d'onglet — parce que le menu de rôle vit sur
   * l'onglet « Membres » de la vue propriétaire, qui est une planche d'onglet,
   * et qu'un lecteur peut basculer de l'un à l'autre sans remonter la page.
   */
  const confirmationRetrait = (
    <FenetreConfirmation
      ouverte={gerer.bannirOuverte}
      nom="BANNIR-MEMBRE"
      titre="Bannir du réseau"
      question={
        gerer.bannirNom === ''
          ? 'Bannir ce membre du réseau ?'
          : `Bannir ${gerer.bannirNom} du réseau ?`
      }
      precision="C’est définitif : la personne ne pourra plus rejoindre ce réseau, et elle ne sera pas prévenue du motif."
      libelleConfirmer="Bannir du réseau"
      onConfirmer={gerer.onConfirmerBannir}
      onAnnuler={gerer.onAnnulerBannir}
      occupe={gerer.occupe}
    />
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ « ÉCRIRE » AUX MEMBRES — UNE SEULE FENÊTRE, POUR LES SIX BOUTONS           ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « on ne peut pas écrire aux membres ». Les six « Écrire » de
   * l'onglet « Membres » — cinq boutons de ligne à 1 036 px, l'entrée du menu de
   * rôle, celle de la feuille mobile — ouvrent tous celle-ci.
   *
   * ⚠ UNE SEULE INSTANCE, ET POUR LA RAISON DÉJÀ MESURÉE SUR
   * `FenetreConfirmation` juste au-dessus : `ScreenFrames` rend les DEUX cadres
   * et n'en masque qu'un par `display: none`, et `Modal` se PORTALISE vers
   * `document.body`. Deux copies posées dans les cadres s'ouvriraient ENSEMBLE,
   * et le voile de celle du cadre masqué intercepterait les clics de l'autre.
   * C'est `Modal` qui choisit entre son panneau d'ordinateur et sa feuille de
   * téléphone (`DESKTOP_QUERY`) : la correction prend donc bien sur les deux
   * planches, sans deux copies qui se gênent.
   *
   * ⚠ ELLE EST RENDUE SUR LES DEUX BRANCHES de ce composant — l'écran A08
   * (`plain`) et les planches d'onglet — comme la confirmation de retrait, et
   * pour la même raison : un lecteur peut basculer de l'onglet « Sujets » à
   * l'onglet « Membres » sans remonter la page.
   *
   * `prenom` vient de `prenomDe` (`components/ecrire.ts`) : le titre de la
   * fenêtre écrit « Écrire à Aïcha », et jamais « Écrire à » — un nom accessible
   * tronqué est une violation de §10.6.
   */
  const fenetreEcrire = (
    <FenetreEcrire
      ouverte={ecrire.cible !== null}
      prenom={ecrire.prenom}
      occupe={ecrire.occupe}
      onEnvoyer={ecrire.onEnvoyer}
      onFermer={ecrire.onFermer}
    />
  );

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LES FENÊTRES DU LOT « RÉSEAU VIVANT » — UNE INSTANCE CHACUNE             ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Même raison que `confirmationRetrait` et `fenetreEcrire` juste au-dessus :
   * `ScreenFrames` rend les DEUX cadres et `Modal` se portalise ; une copie par
   * cadre en ouvrirait deux, dont le voile de la masquée volerait les clics.
   *
   * ⚠ `FenetreSignalement` ÉTAIT DANS LES CADRES « À PROPOS », c'est-à-dire
   * en double — et c'est exactement ce défaut : le porteur, « même le modal de
   * signalement ne marche pas ». `RV_APROPOS` l'en retire ; elle vit ici.
   *
   * ── LES DEUX CONFIRMATIONS DE L'EN-TÊTE ─────────────────────────────────
   *
   * Le porteur : « Le bouton mettre le groupe en sourdine ne demande pas
   * confirmation. » La sourdine et le départ passent par `FenetreConfirmation`,
   * comme le bannissement. Les phrases disent ce que §2.5 et §2.2 disent du
   * geste : la sourdine coupe les notifications et garde le réseau dans la
   * liste ; le départ ferme le contenu, et l'on peut redemander.
   *
   * ── « RETIRER » N'EST PLUS « BANNIR » ───────────────────────────────────
   *
   * Arbitrage du porteur, relevé sur `BANNED_FROM_COMMUNITY` : « Retirer, il
   * peut rejoindre à nouveau. Mais banni, il ne peut plus rejoindre. » Les deux
   * entrées du menu de rôle ont donc chacune leur confirmation, et la phrase dit
   * la différence.
   */
  const nomReseau = reseau?.name ?? 'ce réseau';
  const fenetresVivantes = (
    <>
      {/*
        « Créer un sondage » et « Lier un guide » du composeur du fil — les
        fenêtres de l'accueil (A01S, A01G), mêmes cadres générés, nourries par
        `useSondageGuides`. Une fois chacune, hors des deux cadres.
      */}
      <Modal
        open={composeur.fenetre === 'A01S'}
        onClose={composeur.onFermerFenetre}
        titleId="a01s-titre"
        name="A01S"
        desktop={<A01SDesktop {...composeur.sondageFenetre} />}
        mobile={<A01SMobile {...composeur.sondageFenetre} />}
      />
      <Modal
        open={composeur.fenetre === 'A01G'}
        onClose={composeur.onFermerFenetre}
        titleId="a01g-titre"
        name="A01G"
        desktop={<A01GDesktop {...composeur.guidesFenetre} />}
        mobile={<A01GMobile {...composeur.guidesFenetre} />}
      />
      {/*
        L'UNIQUE SÉLECTEUR DE COUVERTURE. Hors des deux cadres : un champ par
        cadre en aurait fait deux, et « Changer la couverture » (bandeau à
        1036 px, menu du rond à 390 px) n'en ouvre qu'un. Caché mais présent dans
        l'arbre, pour que `click()` l'ouvre ; `accept` borne aux images, le
        serveur restant juge du type réel.
      */}
      <input
        ref={champCouverture}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={onFichierCouverture}
        data-reseau-couverture-fichier=""
      />
      <FenetreSignalement sujet={gerer.signalement} onFermer={gerer.onFermerSignalement} />
      <FenetreConfirmation
        ouverte={gerer.retirerOuverte}
        nom="RETIRER-MEMBRE"
        titre="Retirer du réseau"
        question={
          gerer.retirerNom === ''
            ? 'Retirer ce membre du réseau ?'
            : `Retirer ${gerer.retirerNom} du réseau ?`
        }
        precision="La personne quitte le réseau. Elle pourra demander à le rejoindre de nouveau : pour l’en empêcher, choisissez « Bannir du réseau »."
        libelleConfirmer="Retirer du réseau"
        onConfirmer={gerer.onConfirmerRetirer}
        onAnnuler={gerer.onAnnulerRetirer}
        occupe={gerer.occupe}
      />
      <FenetreConfirmation
        ouverte={confirmation === 'sourdine'}
        nom="SOURDINE"
        titre={reseau?.myMuted === true ? 'Réactiver les notifications' : 'Mettre en sourdine'}
        question={
          reseau?.myMuted === true
            ? `Recevoir de nouveau les notifications de ${nomReseau} ?`
            : `Mettre ${nomReseau} en sourdine ?`
        }
        precision={
          reseau?.myMuted === true
            ? 'Les nouvelles publications, les annonces et les événements du réseau vous seront de nouveau signalés.'
            : 'Vous ne recevrez plus de notifications de ce réseau. Il reste dans votre liste, et vous pouvez réactiver les notifications à tout moment.'
        }
        libelleConfirmer={reseau?.myMuted === true ? 'Réactiver' : 'Mettre en sourdine'}
        onConfirmer={onConfirmer}
        onAnnuler={onAnnulerConfirmation}
      />
      <FenetreConfirmation
        ouverte={confirmation === 'quitter'}
        nom="QUITTER-RESEAU"
        titre="Quitter le réseau"
        question={`Quitter ${nomReseau} ?`}
        precision={
          reseau?.visibility === 'INVITE_ONLY'
            ? 'Vous ne verrez plus son fil ni ses sujets. Ce réseau est privé : il faudra une nouvelle invitation pour y revenir.'
            : 'Vous ne verrez plus son fil ni ses sujets. Vous pourrez le rejoindre de nouveau depuis sa page.'
        }
        libelleConfirmer="Quitter le réseau"
        onConfirmer={onConfirmer}
        onAnnuler={onAnnulerConfirmation}
      />
      <FenetreSujet
        ouverte={fenetreSujet.ouverte}
        titreMin={topicTitleSchema.minLength ?? 0}
        titreMax={topicTitleSchema.maxLength ?? 200}
        corpsMax={topicBodySchema.maxLength ?? 5000}
        occupe={fenetreSujet.occupe}
        onCreer={fenetreSujet.onCreer}
        onFermer={fenetreSujet.onFermer}
      />
      <FenetreEpingler
        ouverte={fenetreEpingler.ouverte}
        sujets={fenetreEpingler.sujets}
        max={fenetreEpingler.max}
        occupe={fenetreEpingler.occupe}
        onBasculer={fenetreEpingler.onBasculer}
        onFermer={fenetreEpingler.onFermer}
      />
      <FenetreContenuSignale
        contenu={contenuSignale}
        occupe={gerer.occupe}
        onMasquer={gerer.onMasquer}
        onConserver={gerer.onConserver}
        onFermer={onFermerContenuSignale}
      />
      {reseau === null ? null : (
        <FenetreEvenement
          ouverte={fenetreEvenement.ouverte}
          reseauId={reseau.id}
          onFermer={fenetreEvenement.onFermer}
          onCree={fenetreEvenement.onCree}
        />
      )}
    </>
  );

  const attente =
    !pret ? (
      <p role="status" style={{ padding: '0 24px 12px', color: '#5D6B66', fontSize: '13px' }}>
        Chargement du réseau…
      </p>
    ) : null;

  /**
   * ╔═════════════════════════════════════════════════════════════════════════╗
   * ║ L'INVITATION À REJOINDRE — ET C'EST ICI QUE LA RÈGLE LA PLUS GRAVE DU     ║
   * ║ MODULE SE TIENT CÔTÉ FRONT                                                ║
   * ╚═════════════════════════════════════════════════════════════════════════╝
   *
   * `contenuFerme` vient d'un `403 NOT_A_MEMBER` mesuré, pas d'une liste vide. La
   * distinction est tout : une liste vide veut dire « aucun sujet », un refus veut
   * dire « je ne vous le dirai pas ». Écrire « aucun sujet pour le moment » sur un
   * refus apprendrait au lecteur que le réseau est mort alors qu'il est seulement
   * fermé — et ferait passer pour une information ce que le serveur a justement
   * refusé de donner.
   *
   * On n'affiche donc NI les compteurs de l'en-tête (masqués à zéro pour un
   * passant) NI de liste de substitution : seulement le bouton que le serveur
   * autorise, d'après `canJoin` qu'il calcule lui-même.
   *
   * ⚠ ELLE VIT MAINTENANT SUR LES DEUX BRANCHES, et c'est l'onglet par défaut qui
   * l'exige. Elle n'était rendue que dans la branche « Sujets » — ce qui suffisait
   * tant que c'était là qu'on arrivait. Depuis l'arbitrage du porteur, une adresse
   * nue ouvre le FIL : un passant y serait tombé sur un onglet muet, composeur
   * compris, sans un mot pour dire pourquoi il est vide. Le texte ne change pas
   * d'un caractère — il nomme les sujets ET les membres, qui sont fermés tous les
   * deux.
   */
  /**
   * ⚠ ELLE N'EST PLUS MONTRÉE QUE SI L'EN-TÊTE NE DIT RIEN. Depuis le lot
   * « réseau vivant », un passant ne voit que l'onglet « À propos », et
   * l'en-tête lui porte « Rejoindre », « Demander à rejoindre », « Accepter
   * l'invitation » ou « Demande envoyée » : répéter la phrase en bas de page,
   * sous le rail, la plaçait loin de tout (mesuré : y = 1 023 à 1 440 px). Elle
   * reste pour le seul cas que l'en-tête ne nomme pas — un réseau fermé, ni
   * rejoignable ni membre (banni, archivé).
   */
  const invitation = contenuFerme && enteteOnglet.actions.etat === 'ferme' ? (
    <p role="status" style={{ padding: '12px 24px', color: '#16211D', fontSize: '14px' }}>
      {reseau?.canJoin === true
        ? 'Rejoignez ce réseau pour voir ses sujets et ses membres.'
        : reseau?.myStatus === 'PENDING'
          ? 'Votre demande est en attente : un modérateur doit l’accepter.'
          : reseau?.myStatus === 'INVITED'
            ? 'Vous êtes invité·e : acceptez pour accéder au contenu.'
            : 'Ce contenu est réservé aux membres du réseau.'}
    </p>
  ) : null;

  if (plain) {
    return (
      <>
        <ScreenFrames
          screen="A08"
          desktop={<A08Desktop {...a08} />}
          mobile={<A08Mobile {...a08} />}
        />
        {confirmationRetrait}
        {fenetreEcrire}
        {fenetresVivantes}
        {invitation}
        {echec !== null && !membre && (
          <p role="status" style={{ padding: '0 24px 12px', color: '#B4581F', fontSize: '13px' }}>
            {echec.message}
          </p>
        )}
        {attente}
      </>
    );
  }

  if (tab === undefined) return null;

  /**
   * ── ON NE PEINT PAS L'EN-TÊTE AVANT DE LE CONNAÎTRE ───────────────────────
   *
   * TROUVÉ EN REGARDANT, pas en lisant le code ni un journal de test. Sur un
   * chargement lent — un paquet `_next` qui n'arrive pas, et c'est arrivé une
   * fois sur dix ouvertures — l'onglet « À propos » s'affichait ainsi :
   *
   *     [pastille orange contenant « · »]   (aucun nom)   ·  ·
   *
   * c'est-à-dire l'en-tête de REPLI rendu tel quel. `enteteVide` ne porte que des
   * chaînes vides — à dessein : un repli qui écrirait « Béninois en France »
   * referait le défaut que ce lot corrige, de façon intermittente donc invisible
   * aux tests. Mais les SÉPARATEURS, eux, sont du DESSIN : la maquette écrit
   * « {membres} · {genre} · {monAppartenance} », et les deux « · » sont dans le
   * JSX transcodé, pas dans la donnée. Avec trois valeurs vides il reste donc
   * deux points médians orphelins et une pastille qui contient un point.
   *
   * On ne peut pas les faire disparaître depuis la donnée — ils ne lui
   * appartiennent pas — et les retirer du cadre voudrait dire REDESSINER la
   * maquette. La bonne réponse est donc de ne rien peindre : tant que l'appel
   * n'est pas revenu, l'écran dit qu'il charge, comme le font déjà les écrans de
   * Services (`EcranDonnees`) et de Guides.
   *
   * `pret` et non `reseau !== null` : `useReseau` pose `pret` dans son `finally`,
   * donc il couvre aussi l'échec — et un en-tête à moitié peint sur une erreur
   * est exactement le même défaut.
   */
  return (
    <>
      {/**
       * ╔═══════════════════════════════════════════════════════════════════════╗
       * ║ LA CARTE DU FIL GARDE SES GESTES SUR LE RÉSEAU                        ║
       * ╚═══════════════════════════════════════════════════════════════════════╝
       *
       * Même leçon que sur le profil public, et le même composant : le DESSIN de la
       * carte vit dans le cadre généré, les GESTES vivent dans la page. Extraire
       * l'un sans l'autre donne une carte qui ressemble à la bonne et ne fait rien
       * — réaction, commentaires, signet et partage seraient inertes.
       *
       * Il est monté SANS CONDITION, sur les vingt-cinq planches, et non seulement
       * sur l'onglet « Fil » : `publications` est vide partout ailleurs (le crochet
       * ne charge le fil que sur son rang), donc il ne rend qu'une liste vide et
       * deux fenêtres fermées. Le monter conditionnellement le démonterait à chaque
       * changement d'onglet et jetterait l'état local des cartes.
       */}
      <CartesFilVivantes cartes={ongletAvecAnnonce.publications}>
        {(cartes) => (
          <ScreenFrames
            screen={`A08T-${slug}`}
            /**
             * LE CADRE D'ORDINATEUR REÇOIT LA COQUE DE A08 AUTOUR DE LA PLANCHE.
             *
             * Trois morceaux, et aucun n'est dessiné ici : le menu de gauche et la
             * barre haute sont les deux régions extraites du cadre de A08, les deux
             * conteneurs qui les tiennent sont ses deux styles recopiés
             * (`COLONNE_DROITE`, `ZONE_CONTENU`). `ScreenFrames` pose déjà la
             * direction `row` : le menu et la colonne se rangent donc côte à côte
             * exactement comme sur A08.
             *
             * ⚠ LE CADRE MOBILE N'EN REÇOIT AUCUN, et c'est mesuré, pas supposé :
             * les planches de 390 px sont des téléphones complets, barre basse
             * comprise. Lui ajouter une coque en ferait deux.
             */
            desktop={
              <>
                <A08ChromeGaucheDesktop {...a08} />
                <div style={COLONNE_DROITE}>
                  <A08BarreHauteDesktop />
                  <div style={ZONE_CONTENU}>
                    <div style={BOARD}>
                      {tab.desktop({ ...ongletAvecAnnonce, publications: cartes })}
                    </div>
                  </div>
                </div>
              </>
            }
            mobile={tab.mobile({ ...ongletAvecAnnonce, publications: cartes })}
          />
        )}
      </CartesFilVivantes>
      {/**
       * ⚠ LES QUATRE BANDES D'ÉTAT VIDE QUI ÉTAIENT ICI — fil, membres,
       * événements, album — sont parties DANS les cadres (`EtatVide`, posé par
       * les adaptations du lot « réseau vivant »). MESURÉ à 1 440 px : la bande
       * du fil vide tombait à y = 1 009, sous le rail, loin de la carte vide
       * qu'elle commentait. Le porteur : « Si vide il faut aussi afficher un
       * message pour toutes les sections. »
       */}
      {/**
       * LE REFUS DU GESTE OU DE LA LISTE, ET LUI SEUL.
       *
       * Distinct de `echec` au-dessus, qui dit « cette page est cassée » : un
       * « Je viens » refusé — événement complet, déjà commencé, annulé — laisse
       * l'onglet parfaitement lisible. Le terre cuite `#B4581F` et les 13 px sont
       * ceux des deux autres bandes de refus de cette page.
       *
       * ⚠ UN REFUS DE NIVEAU N'ARRIVE PAS ICI : il pose `niveauRefuse`, et c'est
       * la fenêtre ci-dessous qui l'explique. Les deux chemins sont séparés dans
       * `use-reseau.ts`, sur `levelRequired`.
       */}
      {slug === 'evenements' && evenements.echec !== null && (
        <p role="status" style={{ padding: '0 24px 12px', color: '#B4581F', fontSize: '13px' }}>
          {evenements.echec}
        </p>
      )}
      {/**
       * L'INVITATION À MONTER DE NIVEAU — UNE SEULE INSTANCE, DANS L'ÉCRAN.
       *
       * Même raison que `FenetreConfirmation` et `FenetreEcrire`, déjà mesurée :
       * `ScreenFrames` rend les DEUX cadres et n'en masque qu'un par
       * `display: none`, et `Modal` se portalise vers `document.body`. Deux copies
       * posées dans les cadres s'ouvriraient ENSEMBLE sur le même état, et le
       * voile de celle du cadre masqué intercepterait les clics de l'autre.
       *
       * Elle n'est PAS rendue sur la branche `plain` : la seule capacité que cette
       * page tente est `event.attend`, et son bouton vit sur une planche d'onglet.
       */}
      {/**
       * LE REFUS DU GESTE OU DE LA LISTE, ET LUI SEUL.
       *
       * Distinct de `echec` au-dessus, qui dit « cette page est cassée » : un
       * dépôt refusé — image trop lourde, type rejeté, niveau insuffisant — laisse
       * l'onglet parfaitement lisible. Le terre cuite `#B4581F` et les 13 px sont
       * ceux des deux autres bandes de refus de cette page.
       *
       * ⚠ UN REFUS DE NIVEAU ARRIVE ICI, lui aussi, et il n'ouvre PAS
       * `FenetreNiveau` : cette fenêtre est l'état de l'onglet « Événements »
       * (`evenements.niveauRefuse`), et deux onglets qui se partageraient une
       * fenêtre ouvriraient celle de l'autre. Le message du serveur dit déjà quel
       * niveau manque. REMONTÉ.
       */}
      {slug === 'album' && album.echec !== null && (
        <p role="status" style={{ padding: '0 24px 12px', color: '#B4581F', fontSize: '13px' }}>
          {album.echec}
        </p>
      )}
      {/**
       * LA FENÊTRE « NOUVEL ALBUM » — UNE SEULE INSTANCE, DANS L'ÉCRAN.
       *
       * Même raison que `FenetreConfirmation`, `FenetreEcrire` et
       * `FenetreNiveau`, déjà mesurée : `ScreenFrames` rend les DEUX cadres et
       * n'en masque qu'un par `display: none`, et `Modal` se portalise vers
       * `document.body`. Deux copies posées dans les cadres s'ouvriraient ENSEMBLE
       * sur le même état, et le voile de celle du cadre masqué intercepterait les
       * clics de l'autre.
       *
       * Elle n'est PAS rendue sur la branche `plain` : le menu « Ajouter » vit sur
       * une planche d'onglet, et l'onglet « Sujets » n'en dessine aucun.
       */}
      <FenetreAlbum
        ouverte={album.albumOuvert}
        titreMin={album.titreMin}
        titreMax={album.titreMax}
        occupe={album.occupe}
        onCreer={album.onCreerAlbum}
        onFermer={album.onFermerAlbum}
      />
      <FenetreNiveau capacite={evenements.niveauRefuse} onFermer={evenements.onFermerNiveau} />
      {invitation}
      {confirmationRetrait}
      {fenetreEcrire}
      {fenetresVivantes}
      {/**
       * LE REFUS D'UN GESTE DU LOT « RÉSEAU VIVANT » — un paramètre, une
       * visibilité, des règles, un épinglage, un sujet. `useReseau` les range
       * dans `echec`, que seule la branche « Sujets » montrait : sur une planche
       * d'onglet, un refus du serveur aurait été silencieux. Le terre cuite et
       * les 13 px sont ceux des autres bandes de refus de cette page.
       */}
      {pret && echec !== null && (
        <p role="alert" style={{ padding: '0 24px 12px', color: '#B4581F', fontSize: '13px' }}>
          {echec.message}
        </p>
      )}
      {/**
       * LE REFUS DE « CONTACTER LES MODÉRATEURS », ET LUI SEUL.
       *
       * Distinct de `echec` au-dessus, qui dit « cette page est cassée » :
       * l'onglet « À propos » d'un réseau automatique sans bénévole s'affiche
       * parfaitement, et c'est seulement le GESTE qui n'a personne à joindre
       * (`NO_MODERATORS_TO_CONTACT`). Le message vient du serveur et propose
       * déjà « Signaler » comme autre chemin.
       *
       * FRÈRE DANS LE FRAGMENT, comme `attente` : un conteneur interposé casse
       * le `position: sticky` de la barre haute et du rail — leçon déjà payée
       * sur `screens/compte/ecran-donnees.tsx`. Et il est posé ICI, donc il
       * vaut pour les DEUX largeurs : `ScreenFrames` choisit le cadre, ce
       * paragraphe est en dehors du choix.
       */}
      {contactEchec !== null && (
        <p role="status" style={{ padding: '0 24px 12px', color: '#B4581F', fontSize: '13px' }}>
          {contactEchec.message}
        </p>
      )}
      {attente}
    </>
  );
}
