'use client';

import { useCallback, useMemo, useState } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { Modal } from '@/components/modal';
import { A01Desktop } from '@/screens/a01/desktop.generated';
import { A01Mobile } from '@/screens/a01/mobile.generated';
import { A01CDesktop } from '@/screens/a01c/desktop.generated';
import { A01CMobile } from '@/screens/a01c/mobile.generated';
import { A01PDesktop } from '@/screens/a01p/desktop.generated';
import { A01PMobile } from '@/screens/a01p/mobile.generated';
import { A01GDesktop } from '@/screens/a01g/desktop.generated';
import { A01GMobile } from '@/screens/a01g/mobile.generated';
import { A01SDesktop } from '@/screens/a01s/desktop.generated';
import { A01SMobile } from '@/screens/a01s/mobile.generated';
import {
  mBottom,
  mTabs,
  panelFil,
  postTypesFor,
  shortcuts,
  storyFiltersFor,
  rail,
} from '@/screens/a01/data';
import { shareContactsDe, shareButtonFor } from '@/screens/a01p/data';
import { shareOut as SORTIES } from '@/screens/a01/data';
import { useMesReseaux } from '@/screens/accueil/use-mes-reseaux';
import { useGuides } from '@/screens/guides/use-guides';
import { useRechercheGuides } from '@/screens/guides/use-recherche-guides';
import { guidesLiablesDe } from '@/screens/guides/from-api';
import { FEED_LIMITS, POLL_OPTIONS_MAX, PostType as POST_TYPES } from '@app/shared';
import { ApiError } from '@/lib/api/index';
import { notifyError, notifySuccess } from '@/components/notifications';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { fetchPost, publierDansReseau, uploadPostImage } from '@/screens/accueil/api';
import { ecrireAAuteur } from '@/screens/accueil/api';
import { urlMedia } from '@/lib/api/base';
import { photoFondFor } from '@/screens/a14/data';
import { useFil } from '@/screens/accueil/use-fil';
import { FenetreEditionPublication } from '@/components/edition-publication';
import { avatarDe, contactsFiltres, initialesDeReseau, threadFrom } from '@/screens/accueil/from-api';
import type { Capability, CommentSort } from '@app/shared';
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { useCapacites } from '@/lib/capacites';
import { usePublication } from '@/screens/publication/use-publication';

/**
 * A01 — Fil d'actualité, et les deux fenêtres qu'il ouvre. BRANCHÉ SUR L'API.
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/03 Accueil v2.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit — et c'est
 * ce lot qui le vérifie plutôt que de le promettre : `node tools/generate-screens.mjs`
 * laisse les 250 cadres sans une ligne de dérive.
 *
 * ── CE QUI A CHANGÉ AU LOT 3 ────────────────────────────────────────────────
 *
 * `feedPosts`, `stories`, `events`, `arrivals`, `online` ne viennent plus de
 * `screens/a01/data.ts` : ils viennent de l'API, par `useFil`. Ce qui reste importé
 * de `data.ts` est le DESSIN que la maquette calcule — le rail, le panneau, les
 * raccourcis, les filtres, les onglets mobiles — et il n'a aucune raison de venir
 * du serveur.
 *
 * Ce qui a DISPARU de l'écran est aussi important que ce qui est arrivé : les cinq
 * publications d'exemple (« Aïcha Diop », « On organise un repas partagé… ») étaient
 * servies dans le HTML comme si elles étaient réelles. Elles ne le sont plus.
 *
 * ── RESPONSIVE ──────────────────────────────────────────────────────────────
 *
 * Inchangé : deux cadres, bascule au seuil de 1024 px de §10.1. Le panneau de
 * gauche, la colonne de contexte et l'en-tête de recherche restent à l'écran
 * pendant que le fil défile — c'est la CSS transcodée (`position: sticky`) qui le
 * tient, pas du code d'ici, et `e2e/shell.spec.ts` le garde. Rien dans ce
 * branchement n'ajoute de conteneur entre eux : un `overflow` ou un `transform`
 * intercalé suffirait à casser `sticky` sans qu'aucun type ne s'en plaigne.
 */

/**
 * Les fenêtres que ce fil sait ouvrir. Les déclencheurs sont marqués par le
 * transcodeur (`triggers` dans `tools/screens/03-accueil.mjs`).
 *
 * A01S — « Créer un sondage » — EST MONTÉE, et il faut dire ce que ça veut dire :
 * la fenêtre s'ouvre, se ferme, piège la tabulation et rend le focus comme les
 * trois autres. Ce qu'elle NE FAIT PAS, parce qu'aucune route ne l'accepte :
 * ENVOYER. `createPostSchema` est `.strict()` et ne porte aucun champ de sondage —
 * le seul sondage du produit vit sur les réseaux (`createPollSchema`) — donc
 * « Créer le sondage » n'a rien à appeler. Son formulaire reste le DESSIN de la
 * maquette, et c'est déjà écrit dans sa déclaration d'écran. REMONTÉ.
 */
type OpenModal = 'A01C' | 'A01P' | 'A01G' | 'A01S' | null;

/**
 * Les quatre noms que l'écouteur délégué accepte.
 *
 * La liste est RELUE plutôt que convertie : `getAttribute` rend `string | null`,
 * et un `as OpenModal` compilerait sur n'importe quelle chaîne — il suffirait
 * qu'un autre module pose un `data-modal-open` que cette page ne connaît pas pour
 * qu'elle tente d'ouvrir une fenêtre inexistante. `find` ne rend que ce qui est
 * dans la liste, donc le type dit la vérité.
 */
const FENETRES = ['A01C', 'A01P', 'A01G', 'A01S'] as const satisfies readonly NonNullable<OpenModal>[];

export default function FeedPage() {
  const [storyFilter, setStoryFilter] = useState(-1);
  const [postType, setPostType] = useState(0);
  const [open, setOpen] = useState<OpenModal>(null);
  /** La publication dont la fenêtre parle. `null` = aucune, donc aucun fil servi. */
  const [sujet, setSujet] = useState<string | null>(null);
  /**
   * AUCUN CONTACT PRÉ-COCHÉ.
   *
   * La maquette en coche deux (`SHARE_SELECTION_DEFAULT`, les rangs 0 et 2) parce
   * qu'une planche doit montrer l'état sélectionné. Avec de VRAIS contacts, deux
   * cases cochées d'avance désigneraient deux personnes que le membre n'a pas
   * choisies. On part donc de rien — et le bouton dit alors « Choisissez un
   * contact », qui est exactement l'état que la maquette dessine pour zéro.
   */
  const [shareSel, setShareSel] = useState<readonly number[]>([]);

  const fil = useFil(storyFilter, postType);

  /**
   * L'APPARENCE D'UN DES TROIS CONTRÔLES DU BAS.
   *
   * Les deux sont DESSINÉES : rond gris de 36 px à icône `#0F5C48` quand il ne
   * porte rien, pastille verte `#16785E` à libellé blanc quand il porte quelque
   * chose. On ne choisit pas une couleur, on bascule entre deux dessins.
   */
  const pastilleDe = (compte: number, libelle: string, titre: string) => ({
    garni: compte > 0,
    libelle: compte > 0 ? libelle : '',
    titre: compte > 0 ? libelle : titre,
    encre: compte > 0 ? '#fff' : '#0F5C48',
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE COMPOSEUR DU FIL — TEXTE, IMAGES, ENVOI                              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « la création de la publication dans le fil d'actualité ne marche
   * pas ». MESURÉ : aucun champ, et « Publier » sans geste.
   *
   * LE TYPE VIENT DES PASTILLES DÉJÀ BRANCHÉES. `postTypesFor(postType, setPostType)`
   * existait et fonctionnait — c'était la seule partie vivante du composeur. L'ordre
   * des quatre pastilles dessinées (« Victoire », « Question », « Info »,
   * « Discussion ») est EXACTEMENT celui de l'énumération `PostType` du serveur,
   * vérifié et non supposé ; `POST_TYPES[postType]` les associe donc par rang, sans
   * seconde table à tenir à jour.
   */
  /**
   * ── L'ORDRE DES DÉCLARATIONS N'EST PAS DÉCORATIF ──────────────────────────
   *
   * `onPublier` lit le sondage et les guides liés : ils se déclarent donc AVANT
   * lui. `tsc` l'a dit — « Block-scoped variable used before its declaration » —
   * et c'est exactement ce qu'on attend d'un type : le composeur, son sondage et
   * ses guides sont UN état, et il doit se lire d'un seul tenant.
   */
  const [sondage, setSondage] = useState<{
    question: string;
    options: readonly string[];
    jours: number;
    multiple: boolean;
    apresVote: boolean;
    anonyme: boolean;
  } | null>(null);
  /**
   * DÉCLARÉ ICI, ET NON PLUS BAS. `onValiderSondage` et « Lier un guide » lisent
   * `edition` pour savoir dans QUEL brouillon écrire, et les deux sont déclarés
   * au-dessus. Une `const` lue avant sa ligne n'est pas `undefined` : c'est une
   * erreur d'exécution — le même piège que `guidesParId` avait déjà coûté une
   * page blanche sur cet écran.
   */
  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LE BROUILLON DE MODIFICATION — SÉPARÉ DE LA CARTE, ET IL LE FAUT          ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * Modifier écrit dans un BROUILLON, et « Enregistrer » seul l'envoie. Travailler
   * directement sur la carte du fil montrerait les retraits AVANT que le serveur
   * les accepte — et laisserait l'écran faux si l'appel échoue.
   *
   * `photo` et `guides` ne portent QUE ce que la carte sait : la carte du fil rend
   * les adresses des médias mais PAS leurs identifiants, et `PATCH /posts/:id`
   * attend des identifiants. Le brouillon est donc rempli depuis
   * `GET /posts/:id` — un appel, à l'ouverture de la fenêtre, qui rend aussi le
   * corps ENTIER là où la carte n'a qu'un extrait de 400 caractères.
   */
  const [edition, setEdition] = useState<{
    postId: string;
    texte: string;
    images: readonly { id: string; url: string }[];
    guides: readonly { id: string; titre: string }[];
    sondage: { question: string; options: readonly string[]; retirable: boolean } | null;
    sondageRetire: boolean;
    /**
     * CE QUI PART quand le sondage a été refait dans la fenêtre — `null` tant
     * qu'on n'y a pas touché, et c'est la différence qui compte : `PATCH
     * /posts/:id` lit « absent » comme « ne touche pas ». Sans cet état, un
     * sondage AJOUTÉ depuis la fenêtre n'était jamais envoyé : mesuré au
     * navigateur, la pastille disait « Sondage » et la carte n'en portait aucun.
     */
    sondageNeuf: {
      question: string;
      options: readonly string[];
      isMultiple: boolean;
      resultsAfterVote: boolean;
      isAnonymous: boolean;
    } | null;
  } | null>(null);
  const [editionEnCours, setEditionEnCours] = useState(false);
  /**
   * LA PUBLICATION DONT ON DEMANDE LA SUPPRESSION, ou `null`.
   *
   * L'identifiant PLUTÔT QU'UN BOOLÉEN : la fenêtre s'ouvre depuis le menu d'une
   * carte précise, et le fil en porte vingt. Un drapeau obligerait à retenir
   * laquelle ailleurs, donc à tenir deux états qui doivent rester d'accord.
   */
  const [suppression, setSuppression] = useState<string | null>(null);
  /**
   * LE SUJET DU SIGNALEMENT, ou `null` quand la fenêtre est fermée.
   *
   * Le GENRE voyage avec l'identifiant : `ReportSubjectType` en nomme douze, et
   * la fenêtre X03 sert à tous. Aujourd'hui `COMMENT` ; la publication elle-même
   * n'a pas de déclencheur dessiné sur sa carte, et on ne lui en invente pas.
   */
  const [signalement, setSignalement] = useState<{ type: string; id: string } | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const [sondageBrouillon, setSondageBrouillon] = useState<{
    question: string;
    options: readonly string[];
    jours: number;
  }>({ question: '', options: ['', ''], jours: 3 });
  const [sondageMultiple, setSondageMultiple] = useState(false);
  /** Les deux défauts sont l'ancien comportement : masqué avant vote, anonyme. */
  const [sondageApresVote, setSondageApresVote] = useState(true);
  const [sondageAnonyme, setSondageAnonyme] = useState(true);
  const [guidesChoisis, setGuidesChoisis] = useState<readonly string[]>([]);
  const [guidesLies, setGuidesLies] = useState<readonly string[]>([]);

  const [composeurTexte, setComposeurTexte] = useState('');
  const { peut } = useCapacites();
  /** La capacité refusée au dernier geste — elle ouvre l'invitation à monter. */
  const [niveauRefuse, setNiveauRefuse] = useState<Capability | null>(null);
  const [imagesJointes, setImagesJointes] = useState<
    readonly { readonly id: string; readonly url: string }[]
  >([]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const onComposeurTexte = useCallback(
    (event: { target: { value: string } }): void => setComposeurTexte(event.target.value),
    [],
  );

  /**
   * ── LE SÉLECTEUR DE FICHIERS EST CRÉÉ À LA VOLÉE ──────────────────────────
   *
   * Pas d'`<input type="file">` dans le JSX : la maquette n'en dessine aucun, et en
   * ajouter un — même masqué — serait ajouter du balisage qu'elle n'écrit pas, sur
   * un écran dont c'est tout l'enjeu. Un élément créé en JavaScript, cliqué puis
   * oublié, fait exactement la même chose sans laisser de trace dans le dessin.
   *
   * QUATRE AU PLUS (§2.4, `FEED_LIMITS.postMediaMax`), et la borne est PARTAGÉE :
   * `createPostSchema` la porte aussi, donc une cinquième image serait refusée au
   * schéma avant même de partir. On la respecte ici pour ne pas déposer un média
   * que la publication refusera.
   */
  const onAjouterImage = useCallback((): void => {
    const choix = document.createElement('input');
    choix.type = 'file';
    choix.accept = 'image/*';
    choix.multiple = true;
    choix.addEventListener('change', () => {
      const fichiers = [...(choix.files ?? [])].slice(0, FEED_LIMITS.postMediaMax);
      void (async () => {
        for (const fichier of fichiers) {
          try {
            const media = await uploadPostImage(fichier);
            setImagesJointes((courant) =>
              courant.length >= FEED_LIMITS.postMediaMax
                ? courant
                : [...courant, { id: media.id, url: media.url }],
            );
            notifySuccess('Image ajoutée à votre publication.');
          } catch (cause) {
            notifyError(
              cause instanceof ApiError ? cause.displayMessage : 'L’image n’a pas pu être déposée.',
            );
          }
        }
      })();
    });
    choix.click();
  }, []);

  /**
   * ── PUBLIER ───────────────────────────────────────────────────────────────
   *
   * Le bouton est ÉTEINT tant qu'il n'y a rien à publier et pendant l'envoi : c'est
   * ce qui empêche le double clic que le porteur avait signalé sur le composeur de
   * story, et c'est plus honnête qu'un bouton actif qui répond « écrivez quelque
   * chose ».
   */
  const onPublier = useCallback((): void => {
    /**
     * ── LE NIVEAU EXPLIQUE AVANT QUE LE SERVEUR REFUSE ────────────────────
     *
     * Le porteur : « quand il clique un pop-up doit apparaître pour lui dire que
     * pour accéder à cette fonctionnalité il faut être de tel niveau ».
     * `post.create` est passée en N1 ; un N0 voit encore ce composeur — la
     * maquette le dessine sur le fil — et devait jusqu'ici écrire son texte pour
     * découvrir le refus à l'envoi.
     *
     * CE N'EST PAS UNE AUTORISATION : le serveur refuse toujours, et si cette
     * copie du niveau est périmée l'action part et le `403 LEVEL_REQUIRED`
     * tranche. L'erreur possible va donc dans le sens sûr.
     */
    if (!peut('post.create')) {
      setNiveauRefuse('post.create');
      return;
    }
    const corps = composeurTexte.trim();
    if (corps === '' || envoiEnCours) return;
    setEnvoiEnCours(true);
    void fil
      .publier({
        type: POST_TYPES[postType] ?? 'DISCUSSION',
        body: corps,
        ...(imagesJointes.length === 0 ? {} : { mediaIds: imagesJointes.map((im) => im.id) }),
        /**
         * LE SONDAGE PART AVEC LA PUBLICATION. `closesAt` est calculé à l'ENVOI,
         * pas au moment où l'on choisit la durée : « 3 jours » veut dire trois
         * jours à partir de la publication, et un composeur peut rester ouvert.
         */
        ...(sondage === null
          ? {}
          : {
              poll: {
                question: sondage.question,
                options: [...sondage.options],
                isMultiple: sondage.multiple,
                resultsAfterVote: sondage.apresVote,
                isAnonymous: sondage.anonyme,
                closesAt: new Date(Date.now() + sondage.jours * 86_400_000),
              },
            }),
        ...(guidesLies.length === 0 ? {} : { guideIds: [...guidesLies] }),
      })
      .then((echec) => {
        if (echec !== null) {
          notifyError(echec.message);
          return;
        }
        setComposeurTexte('');
        setImagesJointes([]);
        setSondage(null);
        setSondageBrouillon({ question: '', options: ['', ''], jours: 3 });
        setSondageMultiple(false);
        setSondageApresVote(true);
        setSondageAnonyme(true);
        setGuidesLies([]);
        notifySuccess('Publication envoyée.');
      })
      .finally(() => setEnvoiEnCours(false));
  }, [composeurTexte, envoiEnCours, fil, guidesLies, imagesJointes, peut, postType, sondage]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE SONDAGE QU'ON COMPOSE — IL VIT SUR LE COMPOSEUR, PAS SUR LE SERVEUR  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La fenêtre le COMPOSE ; « Publier » l'envoie, dans la même transaction que la
   * publication. Deux appels laisseraient une publication dont la maquette promet
   * un sondage et qui n'en a pas — et `PATCH /posts/:id` ne porte que le corps,
   * donc rien ne rattraperait cet état.
   *
   * LES BORNES SONT CELLES DU MODULE 07 : question de 5 à 200 caractères, 2 à 8
   * réponses. Elles sont lues dans `createPollSchema`, pas recopiées — la planche
   * écrit « 2 à 5 » sous le titre « Options », ce qui est un écart avec le schéma
   * du serveur ; on suit le SERVEUR, qui est ce qui refuse, et c'est REMONTÉ.
   */

  const majBrouillon = useCallback(
    (patch: Partial<{ question: string; options: readonly string[]; jours: number }>): void =>
      setSondageBrouillon((courant) => ({ ...courant, ...patch })),
    [],
  );

  const sondageOptions = sondageBrouillon.options.map((texte, i) => ({
    texte,
    onTexte: (event: { target: { value: string } }): void =>
      majBrouillon({
        options: sondageBrouillon.options.map((o, j) => (j === i ? event.target.value : o)),
      }),
    onRetirer: (): void =>
      majBrouillon({ options: sondageBrouillon.options.filter((_, j) => j !== i) }),
    /** En dessous de deux réponses, ce n'est plus un sondage : la croix disparaît. */
    retirable: sondageBrouillon.options.length > 2,
  }));

  /** Les quatre durées dessinées. L'allumée reprend le vert plein de la planche. */
  const sondageDurees = [1, 3, 7, 14].map((jours) => ({
    label: jours === 1 ? '1 jour' : `${String(jours)} jours`,
    on: sondageBrouillon.jours === jours,
    bg: sondageBrouillon.jours === jours ? '#fff' : 'transparent',
    fg: sondageBrouillon.jours === jours ? '#0F5C48' : '#5D6B66',
    onPick: (): void => majBrouillon({ jours }),
  }));

  const reponsesUtiles = sondageBrouillon.options.map((o) => o.trim()).filter((o) => o !== '');

  const onValiderSondage = useCallback((): void => {
    const question = sondageBrouillon.question.trim();
    const reponses = sondageBrouillon.options.map((o) => o.trim()).filter((o) => o !== '');
    if (question === '' || reponses.length < 2) return;
    /**
     * LA FENÊTRE DE MODIFICATION EST SERVIE EN PREMIER, quand elle est ouverte.
     * La même fenêtre de sondage sert les deux composeurs ; sans ce branchement,
     * modifier une publication aurait rempli le composeur du fil — un sondage posé
     * sur la publication SUIVANTE, et rien sur celle qu'on modifiait.
     */
    if (edition !== null) {
      setEdition((e) =>
        e === null
          ? null
          : {
              ...e,
              sondage: { question, options: reponses, retirable: true },
              sondageRetire: false,
              sondageNeuf: {
                question,
                options: reponses,
                isMultiple: sondageMultiple,
                resultsAfterVote: sondageApresVote,
                isAnonymous: sondageAnonyme,
              },
            },
      );
      setOpen(null);
      notifySuccess('Sondage ajouté à votre publication.');
      return;
    }
    setSondage({
      question,
      options: reponses,
      jours: sondageBrouillon.jours,
      multiple: sondageMultiple,
      apresVote: sondageApresVote,
      anonyme: sondageAnonyme,
    });
    setOpen(null);
    notifySuccess('Sondage ajouté à votre publication.');
  }, [edition, sondageAnonyme, sondageApresVote, sondageBrouillon, sondageMultiple]);

  const onAnnulerSondage = useCallback((): void => setOpen(null), []);

  /**
   * ── LE COMMENTAIRE DE LA FENÊTRE A01C ─────────────────────────────────────
   *
   * Le porteur : « finalise […] les commentaires […] au niveau des posts ». La
   * fenêtre lisait le fil et ne pouvait rien y ajouter.
   */
  const [commentaireTexte, setCommentaireTexte] = useState('');
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);

  const onCommentaireTexte = useCallback(
    (event: { target: { value: string } }): void => setCommentaireTexte(event.target.value),
    [],
  );

  const toggleContact = useCallback((index: number): void => {
    setShareSel((current) =>
      current.includes(index) ? current.filter((x) => x !== index) : [...current, index],
    );
  }, []);

  /**
   * L'ouverture est DÉLÉGUÉE, comme la fermeture.
   *
   * Le bouton « Commenter » est enfoui dans une boucle sur les publications, et
   * « Partager » à côté. Leur passer un `onClick` demanderait de faire voyager deux
   * fonctions à travers le JSX transcodé — donc de le modifier, donc de renoncer à
   * ce qui fait la valeur du transcodage. Le transcodeur pose `data-modal-open` sur
   * les deux, et un seul écouteur ici suffit.
   *
   * ── LA FENÊTRE SAIT MAINTENANT DE QUELLE PUBLICATION ELLE PARLE ──────────
   *
   * Ce n'était pas le cas, et c'était un vrai défaut : le nom de la fenêtre était
   * le seul renseignement porté par le déclencheur, donc les cinq publications du
   * fil ouvraient LE MÊME fil de commentaires — celui d'aucune d'entre elles.
   *
   * La correction est dans le GÉNÉRATEUR (`markTriggers`, et la déclaration
   * `subject: 'p.postId'` dans `tools/screens/03-accueil.mjs`), qui pose désormais
   * `data-modal-subject={p.postId}` À CÔTÉ du nom de la fenêtre. L'expression est
   * évaluée DANS la boucle, donc une valeur par carte, et `closest()` la relit ici.
   *
   * Elle n'est surtout PAS dans le JSX généré : la régénération l'effacerait.
   */
  const onOpen = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    /**
     * UNE SEULE FAÇON D'ÊTRE UN DÉCLENCHEUR, et c'est le changement de ce lot.
     *
     * Il y en avait DEUX : `data-modal-open`, posé par le générateur, et — pour
     * l'icône livre du composeur — l'attribut `title="Lier un guide"` que la
     * maquette écrit, auquel le lot précédent s'était accroché pour ne pas toucher
     * aux cadres de A01 pendant qu'un autre lot y travaillait. Il avait dit ce que
     * ça coûtait : « un `<span>` n'est pas atteignable au clavier. Ce déclencheur
     * est à la souris et au doigt seulement, jusqu'à ce que le lot de navigation le
     * promeuve en `<button>` ».
     *
     * C'est fait : les deux icônes du composeur sont DÉCLARÉES comme déclencheurs
     * (`tools/screens/03-accueil.mjs`), donc promues en `<button type="button">`
     * avec leur nom accessible. Elles sont tabulables, et cette page n'a plus
     * qu'un seul crochet à regarder.
     */
    /**
     * ── LA RÉACTION PASSE PAR LE MÊME ÉCOUTEUR ──────────────────────────────
     *
     * Le porteur : « finalise les réactions […] au niveau des posts ». MESURÉ : on
     * cliquait « Bravo », rien ne partait. `useFil` portait pourtant
     * `basculerReaction` avec sa mise à jour optimiste depuis le branchement du fil.
     *
     * Le bouton est dans la boucle des publications, comme « Commenter » et
     * « Partager » : il reçoit donc un ATTRIBUT (`data-post-reagir`) et non une
     * fonction, pour la raison écrite plus bas — faire voyager une fonction par
     * carte à travers le JSX transcodé, c'est renoncer au transcodage.
     *
     * L'ÉTAT COURANT EST RELU DANS LA DONNÉE, pas dans le DOM : `mine` dit si j'ai
     * déjà réagi, et c'est le serveur qui l'a dit. Le déduire de la couleur du
     * bouton serait lire un dessin pour en tirer une décision.
     */
    const reagir = target.closest('[data-post-reagir]');
    if (reagir !== null) {
      const postId = reagir.getAttribute('data-post-reagir');
      const carte = fil.feedPosts.find((c) => c.postId === postId);
      if (postId !== null && carte !== undefined) {
        void fil.basculerReaction(postId, carte.mine !== null).then((echec) => {
          if (echec !== null) notifyError(echec.message);
        });
      }
      return;
    }

    /**
     * ── LE VOTE SUR UN SONDAGE, MÊME MÉCANIQUE ────────────────────────────
     *
     * L'option est dans une boucle IMBRIQUÉE — les options dans les publications —
     * et y faire voyager une fonction serait renoncer au transcodage deux fois
     * plutôt qu'une. Elle porte donc son identifiant et celui de son sondage.
     *
     * UN SEUL CHOIX ENVOYÉ : les sondages du composeur sont à choix unique
     * (`isMultiple: false`), et le serveur refuse une seconde option sur un
     * sondage qui n'en accepte qu'une. Le choix multiple demanderait une case à
     * cocher et un bouton « valider » que la maquette ne dessine pas — REMONTÉ.
     */
    const option = target.closest('[data-poll-vote]');
    if (option !== null) {
      const optionId = option.getAttribute('data-poll-vote');
      const pollId = option.getAttribute('data-poll-id');
      if (optionId !== null && pollId !== null && optionId !== '' && pollId !== '') {
        void fil.voterSondage(pollId, [optionId]).then((echec) => {
          if (echec !== null) notifyError(echec.message);
        });
      }
      return;
    }

    const trigger = target.closest('[data-modal-open]');
    if (trigger === null) return;
    const nom = trigger.getAttribute('data-modal-open');
    const which = FENETRES.find((f) => f === nom);
    if (which === undefined) return;
    /**
     * `getAttribute` rend `null` quand l'attribut manque — ce qui arrive pour un
     * déclencheur hors boucle, ou pour une carte sans identifiant. On ouvre alors
     * la fenêtre SANS sujet plutôt que sur le sujet précédent : une fenêtre vide se
     * voit, un fil de commentaires qui n'est pas le bon ne se voit pas.
     */
    setSujet(trigger.getAttribute('data-modal-subject'));
    setOpen(which);
  }, [fil]);

  const close = useCallback((): void => setOpen(null), []);

  /**
   * CES DEUX-CI SONT DÉCLARÉS ICI, et non dans la section « LIER UN GUIDE » plus
   * bas, parce que `data` les lit : `composeurGuides` a besoin du titre de chaque
   * guide lié. Une `const` lue avant sa ligne de déclaration n'est pas `undefined`
   * mais une erreur d'exécution — mesurée dans le navigateur :
   * « ReferenceError: Cannot access 'eD' before initialization », page blanche.
   * `tsc` ne l'avait pas vue : la lecture se fait dans un objet littéral, pas dans
   * une fonction, et le contrôle de zone morte temporelle de TypeScript ne va pas
   * jusque-là.
   */
  const guides = useGuides(0, open === 'A01G');
  const [guideRecherche, setGuideRecherche] = useState('');
  const rechercheGuides = useRechercheGuides(guideRecherche);

  /**
   * LE TITRE D'UN GUIDE LIÉ, pour son étiquette dans le composeur.
   *
   * La sélection ne porte que des identifiants ; le titre vient de la liste que la
   * fenêtre a chargée. Si elle n'a pas été rouverte depuis, le titre manque — on
   * écrit alors « Guide lié » plutôt que l'identifiant, qui ne dirait rien. Le
   * serveur, lui, rend bien le titre sur la publication une fois publiée.
   */
  const guidesParId = useMemo(() => {
    const table = new Map<string, string>();
    for (const g of guides.page?.items ?? []) table.set(g.id, g.title);
    return table;
  }, [guides.page]);

  const data = {
    // ── Dessin : la maquette, inchangée ──
    rail,
    panelFil,
    shortcuts,
    storyFilters: storyFiltersFor(storyFilter, setStoryFilter),
    postTypes: postTypesFor(postType, setPostType),
    // ── Le composeur : son texte, son envoi, ses images ──
    composeurTexte,
    onComposeurTexte,
    onPublier,
    publierBloque: composeurTexte.trim() === '' || envoiEnCours,
    onAjouterImage,
    // ── La fenêtre de sondage ──
    sondageQuestion: sondageBrouillon.question,
    onSondageQuestion: (event: { target: { value: string } }) =>
      majBrouillon({ question: event.target.value }),
    sondageOptions,
    /**
     * ── LE NOMBRE DE RÉPONSES EST BORNÉ, ET IL NE L'ÉTAIT PAS ──────────────
     *
     * Rien n'empêchait d'en ajouter dix : le serveur en refuse plus de huit
     * (`createPollSchema`), donc le onzième clic préparait un refus que le membre
     * n'aurait découvert qu'en publiant. Le bouton ne fait plus rien au plafond,
     * ce qui est visible — la liste cesse de grandir.
     */
    onAjouterOption: () =>
      majBrouillon({
        options:
          sondageBrouillon.options.length >= POLL_OPTIONS_MAX
            ? sondageBrouillon.options
            : [...sondageBrouillon.options, ''],
      }),
    sondageDurees,
    sondageMultiple,
    onSondageMultiple: () => setSondageMultiple((v) => !v),
    sondageApresVote,
    onSondageApresVote: () => setSondageApresVote((v) => !v),
    sondageAnonyme,
    onSondageAnonyme: () => setSondageAnonyme((v) => !v),
    // ── Le composeur GARNI, tel que la planche A01·S le dessine ──
    composeurGarni: imagesJointes.length > 0 || sondage !== null || guidesLies.length > 0,
    composeurImages: imagesJointes.map((im, rang) => ({
      /**
       * L'IMAGE DÉPOSÉE, ET NON LE HACHURAGE. La planche dessine un rectangle rayé
       * portant « Photo 1 » — son motif « ici il y a une image ». On y met
       * l'image, comme sur la carte de publication : `photoFondFor` compose
       * `url("…") center/cover no-repeat`, sans quoi le navigateur la poserait à
       * sa taille naturelle et la répéterait.
       */
      fond: photoFondFor(urlMedia(im.url), false),
      /** Le libellé dessiné reste, sous l'image : il nomme ce qu'on retire. */
      nom: '',
      retirer: `Retirer l’image ${String(rang + 1)}`,
      onRetirer: () => setImagesJointes((c) => c.filter((x) => x.id !== im.id)),
    })),
    composeurImagesCompte: `${String(imagesJointes.length)} / ${String(FEED_LIMITS.postMediaMax)}`,
    composeurAjoutBloque: imagesJointes.length >= FEED_LIMITS.postMediaMax,
    composeurSondage:
      sondage === null
        ? null
        : {
            question: sondage.question,
            options: sondage.options,
            /**
             * LA LIGNE GRISE EST COMPOSÉE DES RÉGLAGES RÉELS, pas du texte de la
             * planche : « 3 jours · résultats après le vote · anonyme » y est un
             * exemple. Elle dit ce que le sondage FERA.
             */
            meta: [
              sondage.jours === 1 ? '1 jour' : `${String(sondage.jours)} jours`,
              sondage.apresVote ? 'résultats après le vote' : 'résultats visibles tout de suite',
              sondage.anonyme ? 'anonyme' : 'votants nommés',
              ...(sondage.multiple ? ['plusieurs réponses'] : []),
            ].join(' · '),
            onModifier: () => setOpen('A01S'),
            onRetirer: () => setSondage(null),
          },
    composeurGuides: guidesLies.map((id) => ({
      titre: guidesParId.get(id) ?? 'Guide lié',
      retirer: `Retirer ${guidesParId.get(id) ?? 'ce guide'}`,
      onRetirer: () => {
        setGuidesLies((c) => c.filter((x) => x !== id));
        setGuidesChoisis((c) => c.filter((x) => x !== id));
      },
    })),
    composeurPastilles: {
      sondage: pastilleDe(sondage === null ? 0 : 1, 'Sondage', 'Créer un sondage'),
      guides: pastilleDe(
        guidesLies.length,
        guidesLies.length === 1 ? '1 guide lié' : `${String(guidesLies.length)} guides liés`,
        'Lier un guide',
      ),
      images: pastilleDe(
        imagesJointes.length,
        imagesJointes.length === 1 ? '1 image' : `${String(imagesJointes.length)} images`,
        'Ajouter une image',
      ),
    },
    onValiderSondage,
    onAnnulerSondage,
    sondageBloque: sondageBrouillon.question.trim() === '' || reponsesUtiles.length < 2,
    mTabs,
    mBottom,
    // ── Donnée : l'API ──
    /**
     * LES TROIS GESTES DE LA CARTE SONT ATTACHÉS ICI, et non dans `use-fil` : la
     * fenêtre de modification vit dans cette page, et `onModifier` doit l'ouvrir.
     * Les attacher dans le crochet obligerait à y remonter l'état de la fenêtre.
     */
    feedPosts: fil.feedPosts.map((carte) => ({
      ...carte,
      onEnregistrer: (): void => {
        if (carte.postId === undefined) return;
        void fil.basculerSignet(carte.postId, carte.enregistre === true).then((echec) => {
          if (echec !== null) notifyError(echec.message);
        });
      },
      onModifier: (): void => {
        if (carte.postId !== undefined) onModifierPublication(carte.postId);
      },
      onSupprimer: (): void => {
        if (carte.postId !== undefined) onSupprimerPublication(carte.postId);
      },
    })),
    stories: fil.stories,
    events: fil.events,
    arrivals: fil.arrivals,
    online: fil.online,
  };

  /**
   * LE FIL DE COMMENTAIRES DE LA FENÊTRE, POUR LA PUBLICATION CLIQUÉE.
   *
   * `avecPublication: false` : la carte est déjà à l'écran derrière la fenêtre, et
   * recharger `GET /posts/:id` pour l'afficher une seconde fois serait un appel de
   * plus pour rien. On ne demande que `GET /comments?subjectType=POST&subjectId=…`.
   *
   * Le crochet part dès que `sujet` change, y compris quand il repasse à `null` —
   * il rend alors une liste vide, ce qui est exactement ce qu'on veut : la fenêtre
   * ne garde pas le fil de la publication précédente.
   */
  const commentaires = usePublication(sujet, false);

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ À QUI L'ON RÉPOND — L'IDENTIFIANT ET LE NOM, ENSEMBLE                   ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * `POST /comments` a besoin de l'identifiant ; la bande « En réponse à » a besoin
   * du nom. Les garder ENSEMBLE évite de rechercher la racine à chaque rendu, et
   * surtout rend impossible l'état où l'un serait posé et l'autre non — la bande
   * annoncerait alors une réponse qui partirait à la racine.
   */
  const [reponse, setReponse] = useState<{ id: string; nom: string } | null>(null);

  const thread =
    commentaires.fil === null
      ? []
      : threadFrom(
          commentaires.fil.items,
          (id, nom) => {
            setReponse({ id, nom });
          },
          (id) => {
            setSignalement({ type: 'COMMENT', id });
          },
        );

  /**
   * L'ENVOI DU COMMENTAIRE. Posé ici parce qu'il se sert de `commentaires`, qui est
   * déclaré juste au-dessus — et `commenter` recale la liste sur ce que le serveur
   * rend, jamais sur ce qu'on a envoyé.
   *
   * LA RÉPONSE EST OUBLIÉE APRÈS L'ENVOI, et seulement en cas de succès : si le
   * serveur refuse, la bande reste et le membre peut réessayer sans redésigner
   * à qui il répondait.
   */
  const onEnvoyerCommentaire = (): void => {
    const corps = commentaireTexte.trim();
    if (corps === '' || envoiCommentaire) return;
    setEnvoiCommentaire(true);
    void commentaires
      .commenter(corps, reponse?.id)
      .then((echec) => {
        if (echec !== null) {
          notifyError(echec.message);
          return;
        }
        setCommentaireTexte('');
        setReponse(null);
        if (sujet !== null) fil.marquerCommentaire(sujet);
      })
      .finally(() => setEnvoiCommentaire(false));
  };

  /**
   * LA CARTE DU HAUT EST LA PUBLICATION COMMENTÉE, et le fil la connaît déjà : la
   * fenêtre s'ouvre DEPUIS une carte. On la relit donc dans la page chargée plutôt
   * que de redemander `GET /posts/:id` pour un extrait que l'écran affiche déjà
   * derrière le voile.
   */
  const publicationCommentee = fil.feed?.items.find((p) => p.id === sujet) ?? null;

  const fenetreCommentaires = {
    thread,
    commentaireTexte,
    onCommentaireTexte,
    onEnvoyerCommentaire,
    envoiBloque: commentaireTexte.trim() === '' || envoiCommentaire,
    sujetCarte:
      publicationCommentee === null
        ? null
        : {
            ...avatarDe(publicationCommentee.author),
            nom: publicationCommentee.author.displayName,
            badge: publicationCommentee.typeLabel,
            extrait: publicationCommentee.excerpt,
          },
    /**
     * LE COMPTE VIENT DU FIL CHARGÉ, pas de la longueur de `thread` : `thread`
     * aplatit racines et réponses et ne porte que la page lue. Le compteur de la
     * carte, lui, est celui du serveur — c'est le même nombre que « N commentaires »
     * sous la publication, et deux nombres différents pour une seule chose se
     * verraient.
     */
    commentairesCompte:
      publicationCommentee === null ? '' : `· ${String(publicationCommentee.commentCount)}`,
    triCommentaires: commentaires.tri,
    triLibelle: commentaires.tri === 'RELEVANT' ? 'Pertinents' : 'Récents',
    onTriCommentaires: (valeur?: CommentSort): void => {
      commentaires.setTri(
        valeur ?? (commentaires.tri === 'RELEVANT' ? 'RECENT' : 'RELEVANT'),
      );
    },
    suiteVisible: commentaires.fil !== null && commentaires.fil.nextCursor !== null,
    suiteLibelle: commentaires.suiteEnCours ? 'Chargement…' : 'Voir les autres commentaires',
    onVoirSuite: (): void => {
      void commentaires.chargerSuite().then((echec) => {
        if (echec !== null) notifyError(echec.message);
      });
    },
    reponseA: reponse?.nom ?? null,
    onAnnulerReponse: (): void => {
      setReponse(null);
    },
  };

  /**
   * LA FENÊTRE « PARTAGER ».
   *
   * Les contacts proposés sont RÉELS : ce sont les contacts en ligne que
   * `GET /feed/sidebar` calcule (`last_seen_at` < 10 min, §2.7), et non cinq
   * initiales d'exemple.
   *
   * Ce qui n'est PAS branché, et qui ne peut pas l'être : L'ENVOI. Il n'existe
   * aucune route de partage — ni `POST /posts/:id/share`, ni compteur de partages
   * sur `postCardSchema`. Le bouton « Envoyer à N contacts » n'a donc rien à
   * appeler. C'est remonté au rapport de lot, pas comblé ici.
   *
   * `shareNets` reste du dessin : la seule source possible est le module
   * `communities`, qui n'a pas de schéma de réponse dans `packages/shared`.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ PARTAGER, C'EST ÉCRIRE — ET C'EST CE QUE LA FENÊTRE DESSINE             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « l'envoi d'un partage — aucune route n'existe ». C'était exact,
   * et ce l'est resté : il n'y a ni `POST /posts/:id/share`, ni compteur de
   * partages. Mais la fenêtre promet « ENVOYER À UN CONTACT », et cela existe
   * déjà sous un autre nom.
   *
   * `POST /conversations/direct` PORTE TOUTES LES RÈGLES qu'un partage doit
   * respecter — niveau L1, blocage, séparation, quota de nouvelles conversations,
   * et la règle du §5.2 : un seul message tant que la demande n'est pas acceptée.
   * Une route de partage les aurait toutes redites, et la copie aurait divergé.
   *
   * ── UN ENVOI PAR CONTACT, ET CE QUI ÉCHOUE EST NOMMÉ ─────────────────────
   *
   * `allSettled` et non `all` : un contact qui vous a bloqué ne doit pas empêcher
   * les quatre autres de recevoir le lien. Le compte des réussites est annoncé,
   * et les refus aussi — dire « envoyé » alors que deux sur cinq ont échoué serait
   * exactement le genre de silence que ce lot corrige ailleurs.
   */

  /**
   * OUVRIR LA FENÊTRE DE MODIFICATION — EN RELISANT LA PUBLICATION.
   *
   * `GET /posts/:id` et non la carte du fil, pour deux raisons mesurables :
   * la carte ne porte qu'un EXTRAIT de 400 caractères (`excerpt`), et modifier
   * depuis lui tronquerait le texte à l'enregistrement ; et le sondage de la carte
   * masque ses comptes tant qu'on n'a pas voté, donc elle ne sait pas dire s'il
   * est déjà voté — ce dont la fenêtre a besoin pour montrer, ou non, la croix.
   */
  const onModifierPublication = (postId: string): void => {
    void fetchPost(postId)
      .then((detail) => {
        const sondage = detail.post.poll;
        setEdition({
          postId,
          texte: detail.post.body,
          images: detail.post.media.map((m) => ({ id: m.id, url: urlMedia(m.url) })),
          guides: detail.post.guides.map((g) => ({ id: g.id, titre: g.title })),
          sondage:
            sondage === null
              ? null
              : {
                  question: sondage.question,
                  options: sondage.options.map((o) => o.label),
                  /**
                   * RETIRABLE TANT QUE PERSONNE N'A VOTÉ. `totalVotes` vaut `null`
                   * quand les résultats sont masqués — mais l'AUTEUR lit ici sa
                   * propre publication, et `resultsVisible` lui est accordé dès que
                   * le sondage est clos ou qu'il a voté. On s'appuie donc sur ce que
                   * le serveur accepte, pas sur ce qu'il affiche : il refusera
                   * `POLL_HAS_VOTES` si on se trompe, et le message le dira.
                   */
                  retirable: (sondage.totalVotes ?? 0) === 0,
                },
          sondageRetire: false,
          sondageNeuf: null,
        });
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'Cette publication n’a pas pu être ouverte.',
        );
      });
  };

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ SUPPRIMER — AVEC UNE FENÊTRE DESSINÉE, ET PLUS `window.confirm`         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « pour les confirmations inspire-toi du design pour créer un
   * modal bien fait. »
   *
   * CE QUI PRÉCÉDAIT, et la raison qui était donnée : « `window.confirm` et non
   * une fenêtre dessinée : la maquette n'en dessine aucune pour ce geste ». La
   * prémisse était FAUSSE — `08 Compte` en dessine une, K08 · suppression de
   * compte, cadre de 440 px. Son châssis sert maintenant aux deux confirmations
   * du dépôt, celle-ci et le blocage d'un membre. Voir `FenetreConfirmation`.
   */
  const onSupprimerPublication = (postId: string): void => {
    setSuppression(postId);
  };

  const confirmerSuppression = (): void => {
    const postId = suppression;
    if (postId === null || suppressionEnCours) return;
    setSuppressionEnCours(true);
    void fil.supprimer(postId).then((echec) => {
      setSuppressionEnCours(false);
      setSuppression(null);
      if (echec !== null) {
        notifyError(echec.message);
        return;
      }
      notifySuccess('Publication supprimée.');
    });
  };

  const onEnregistrerEdition = (): void => {
    if (edition === null || editionEnCours) return;
    const corps = edition.texte.trim();
    if (corps === '') return;
    setEditionEnCours(true);
    void fil
      .modifier(edition.postId, {
        body: corps,
        mediaIds: edition.images.map((im) => im.id),
        guideIds: edition.guides.map((g) => g.id),
        /**
         * TROIS CAS, ET L'ABSENCE EN EST UN. `null` retire ; un objet remplace ;
         * ABSENT ne touche à rien. Envoyer `poll` à chaque enregistrement
         * reconstruirait le sondage — et le serveur refuserait dès le premier vote
         * (`POLL_HAS_VOTES`) une publication dont on n'aurait changé que le texte.
         */
        ...(edition.sondageRetire
          ? { poll: null }
          : edition.sondageNeuf === null
            ? {}
            : {
                /** `[...]` : le schéma attend un tableau mutable, l'état est en lecture seule. */
                poll: { ...edition.sondageNeuf, options: [...edition.sondageNeuf.options] },
              }),
      })
      .then((echec) => {
        if (echec !== null) {
          notifyError(echec.message);
          return;
        }
        notifySuccess('Publication modifiée.');
        setEdition(null);
      })
      .finally(() => {
        setEditionEnCours(false);
      });
  };

  /**
   * LES PRISES DE LA FENÊTRE DE MODIFICATION. Construites même quand `edition` est
   * `null` — `Modal` ne rend rien dans ce cas, mais le composant doit être
   * TYPABLE : un objet construit sous condition ferait deux formes pour une seule
   * fenêtre, et le jour où l'une gagne un champ l'autre ne l'aurait pas.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES DEUX FENÊTRES DE PIÈCES JOINTES SERVENT LES DEUX COMPOSEURS          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * A01S (« Créer un sondage ») et A01G (« Lier un guide ») écrivaient dans le
   * brouillon du composeur du FIL. Elles doivent maintenant pouvoir écrire dans
   * celui de la fenêtre de MODIFICATION — c'est la même fenêtre, et en dessiner
   * deux copies ferait deux formulaires de sondage à tenir d'accord.
   *
   * `edition !== null` TRANCHE, et c'est le seul discriminant : quand la fenêtre de
   * modification est ouverte, c'est elle qu'on garnit. Les deux fenêtres se posent
   * PAR-DESSUS — elles sont montées après dans le document — et `Modal` piège la
   * tabulation par cadre, donc celle du dessus reçoit bien le clavier.
   */
  const onAjouterImageEdition = (): void => {
    if (edition === null) return;
    const choix = document.createElement('input');
    choix.type = 'file';
    choix.accept = 'image/*';
    choix.multiple = true;
    choix.addEventListener('change', () => {
      const fichiers = [...(choix.files ?? [])].slice(0, FEED_LIMITS.postMediaMax);
      void (async () => {
        for (const fichier of fichiers) {
          try {
            const media = await uploadPostImage(fichier);
            setEdition((e) =>
              e === null || e.images.length >= FEED_LIMITS.postMediaMax
                ? e
                : { ...e, images: [...e.images, { id: media.id, url: urlMedia(media.url) }] },
            );
          } catch (cause) {
            notifyError(
              cause instanceof ApiError ? cause.displayMessage : 'L’image n’a pas pu être déposée.',
            );
          }
        }
      })();
    });
    choix.click();
  };

  /**
   * ON SÈME LE BROUILLON AVANT D'OUVRIR, dans les deux cas : la fenêtre doit
   * s'ouvrir sur ce que la publication porte DÉJÀ, pas sur un formulaire vierge.
   * Sans cela, « Modifier » sur un sondage existant en proposerait un neuf, et
   * valider écraserait l'ancien sans que rien ne l'ait montré.
   */
  const onSondageEdition = (): void => {
    if (edition === null) return;
    const actuel = edition.sondageRetire ? null : edition.sondage;
    majBrouillon({
      question: actuel?.question ?? '',
      options: actuel === null ? ['', ''] : [...actuel.options],
    });
    setOpen('A01S');
  };

  const onGuidesEdition = (): void => {
    if (edition === null) return;
    setGuidesChoisis(edition.guides.map((g) => g.id));
    setOpen('A01G');
  };

  const editionPrises = {
    texte: edition?.texte ?? '',
    onTexte: (event: { target: { value: string } }): void => {
      const valeur = event.target.value;
      setEdition((e) => (e === null ? null : { ...e, texte: valeur }));
    },
    images: edition?.images ?? [],
    onRetirerImage: (id: string): void => {
      setEdition((e) => (e === null ? null : { ...e, images: e.images.filter((i) => i.id !== id) }));
    },
    guides: edition?.guides ?? [],
    onRetirerGuide: (id: string): void => {
      setEdition((e) => (e === null ? null : { ...e, guides: e.guides.filter((g) => g.id !== id) }));
    },
    sondage: edition === null || edition.sondageRetire ? null : edition.sondage,
    onRetirerSondage:
      edition === null || edition.sondage === null || !edition.sondage.retirable
        ? null
        : (): void => {
            setEdition((e) => (e === null ? null : { ...e, sondageRetire: true }));
          },
    onEnregistrer: (): void => {
      onEnregistrerEdition();
    },
    bloque: editionEnCours || (edition?.texte ?? '').trim() === '',
    libelle: editionEnCours ? 'Enregistrement…' : 'Enregistrer',
    pastilles: {
      sondage: pastilleDe(
        edition !== null && !edition.sondageRetire && edition.sondage !== null ? 1 : 0,
        'Sondage',
        'Créer un sondage',
      ),
      guides: pastilleDe(
        (edition?.guides.length ?? 0),
        `${String((edition?.guides.length ?? 0))} guide${(edition?.guides.length ?? 0) > 1 ? 's' : ''} lié${(edition?.guides.length ?? 0) > 1 ? 's' : ''}`,
        'Lier un guide',
      ),
      images: pastilleDe(
        (edition?.images.length ?? 0),
        `${String((edition?.images.length ?? 0))} image${(edition?.images.length ?? 0) > 1 ? 's' : ''}`,
        'Ajouter une image',
      ),
    },
    onAjouterImage: onAjouterImageEdition,
    onSondage: onSondageEdition,
    onGuides: onGuidesEdition,
    ajoutImageBloque: (edition?.images.length ?? 0) >= FEED_LIMITS.postMediaMax,
    /**
     * UN SONDAGE DÉJÀ VOTÉ NE SE REFAIT PAS. Le serveur refuse (`POLL_HAS_VOTES`) ;
     * laisser la pastille active offrirait un geste dont la seule issue serait un
     * message d'erreur.
     */
    sondageFige: edition !== null && edition.sondage !== null && !edition.sondage.retirable,
    imagesCompte: `${String((edition?.images.length ?? 0))} / ${String(FEED_LIMITS.postMediaMax)}`,
  };

  const [partageEnCours, setPartageEnCours] = useState(false);
  const [partageRecherche, setPartageRecherche] = useState('');
  /**
   * CE QUI A DÉJÀ ÉTÉ PARTAGÉ, ET CE QUI PART — deux états, pas un.
   *
   * Un seul drapeau « en cours » éteindrait les boutons pendant l'envoi puis les
   * rallumerait tous : rien ne dirait lequel est déjà parti, et un second clic
   * créerait une seconde publication dans le même réseau. `reseauxPartages` garde
   * la trace, `reseauEnCours` dit lequel travaille.
   */
  const [reseauxPartages, setReseauxPartages] = useState<readonly string[]>([]);
  const [reseauEnCours, setReseauEnCours] = useState<string | null>(null);

  /** La publication partagée — celle que le fil porte déjà, pas un second appel. */
  const publicationPartagee = fil.feed?.items.find((p) => p.id === sujet) ?? null;

  /** Le lien public de la publication, écrit UNE fois pour les quatre chemins. */
  const lienPublication = (): string =>
    sujet === null ? '' : `${window.location.origin}/publications/${sujet}`;

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ PARTAGER DANS UN RÉSEAU, C'EST Y PUBLIER — et la route existe déjà        ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * Comme pour les contacts, il n'existe aucune route de partage. Mais
   * `createPostSchema` porte `communityId` — §2.3 : « renseigné = fil du réseau,
   * visible de ses membres seuls » — et c'est exactement ce que « DANS UN RÉSEAU »
   * promet. La publication créée porte le lien, et toutes les règles du réseau
   * (appartenance, niveau, quota) sont tenues par la route qui les tient déjà.
   *
   * `DISCUSSION` et non `INFO` : on relaie, on n'annonce pas. Le type est choisi
   * avant la rédaction et n'est plus modifiable (§2.1), donc il vaut mieux le plus
   * neutre des quatre.
   */
  const onPartagerDansReseau = (communityId: string, nom: string): void => {
    if (sujet === null || reseauEnCours !== null || reseauxPartages.includes(communityId)) return;
    setReseauEnCours(communityId);
    void publierDansReseau(communityId, lienPublication())
      .then(() => {
        setReseauxPartages((courant) => [...courant, communityId]);
        notifySuccess(`Publication partagée dans ${nom}.`);
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : `Le partage dans ${nom} n’a pas abouti.`,
        );
      })
      .finally(() => {
        setReseauEnCours(null);
      });
  };

  /**
   * LES TROIS TUILES DU BAS. La planche écrit sous elles : « Hors de la plateforme,
   * seuls les membres connectés pourront ouvrir la publication. » C'est donc bien
   * un lien qui sort, et les trois le font chacune à sa manière.
   *
   * `navigator.clipboard` PEUT ÉCHOUER — contexte non sécurisé, permission refusée.
   * On le dit plutôt que de laisser croire à une copie qui n'a pas eu lieu.
   */
  const onSortie = (label: string): void => {
    const lien = lienPublication();
    if (lien === '') return;
    if (label === 'Copier le lien') {
      void navigator.clipboard
        .writeText(lien)
        .then(() => {
          notifySuccess('Lien copié.');
        })
        .catch(() => {
          notifyError('Le lien n’a pas pu être copié.');
        });
      return;
    }
    const texte = `Je partage cette publication avec vous : ${lien}`;
    const destination =
      label === 'WhatsApp'
        ? `https://wa.me/?text=${encodeURIComponent(texte)}`
        : `mailto:?subject=${encodeURIComponent('Une publication de la diaspora')}&body=${encodeURIComponent(texte)}`;
    window.open(destination, '_blank', 'noopener,noreferrer');
  };

  const onPartager = useCallback((): void => {
    if (shareSel.length === 0 || partageEnCours || sujet === null) return;
    const destinataires = shareSel
      .map((i) => fil.online[i]?.handle)
      .filter((h): h is string => h !== undefined && h !== '');
    if (destinataires.length === 0) return;

    setPartageEnCours(true);
    const lien = `${window.location.origin}/publications/${sujet}`;
    void Promise.allSettled(
      destinataires.map((handle) =>
        ecrireAAuteur(handle, `Je partage cette publication avec vous : ${lien}`),
      ),
    )
      .then((issues) => {
        const envoyes = issues.filter((i) => i.status === 'fulfilled').length;
        if (envoyes === 0) {
          notifyError('Le partage n’a pu être envoyé à personne.');
          return;
        }
        notifySuccess(
          envoyes === destinataires.length
            ? `Publication partagée à ${String(envoyes)} contact${envoyes > 1 ? 's' : ''}.`
            : `Partagée à ${String(envoyes)} contact${envoyes > 1 ? 's' : ''} sur ${String(destinataires.length)}.`,
        );
        setShareSel([]);
        setOpen(null);
      })
      .finally(() => setPartageEnCours(false));
  }, [fil.online, partageEnCours, shareSel, sujet]);

  /**
   * ╔═══════════════════════════════════════════════════════════════════════╗
   * ║ LE FILTRE GARDE LES RANGS D'ORIGINE — et c'est la seule façon juste      ║
   * ╚═══════════════════════════════════════════════════════════════════════╝
   *
   * La sélection est une liste de RANGS dans `fil.online`, et l'envoi relit
   * `fil.online[rang]`. Filtrer la liste PUIS la remapper changerait les rangs : on
   * cocherait Awa et le lien partirait à Bintou. On filtre donc en gardant le rang
   * d'origine de chacun.
   *
   * SANS ACCENT NI CASSE : chercher « amina » doit trouver « Amina », et « Ndiaye »
   * trouver « Ndiayé ». `normalize('NFD')` plus retrait des diacritiques, la même
   * recette que le serveur applique à la recherche.
   */
  /**
   * Les contacts que la barre laisse passer, AVEC leur rang d'origine : la
   * sélection est une liste de rangs dans `fil.online`, et l'envoi les y relit.
   * Le pourquoi en entier est sur `contactsFiltres`.
   */
  const contactsVisibles = contactsFiltres(fil.online, partageRecherche);

  const mesReseaux = useMesReseaux(open === 'A01P');

  const partage = {
    /**
     * On remappe les rangs APRÈS le filtre : la fabrique travaille sur la liste
     * qu'elle reçoit, et son `onPick(i)` doit désigner le rang D'ORIGINE.
     */
    /**
     * « IL DOIT DIRE QU'IL N'A PAS TROUVÉ » — et seulement quand on a cherché.
     *
     * `partageRecherche.trim() !== ''` est la garde : sans elle, un membre dont
     * aucun contact n'est en ligne lirait « Aucun contact à ce nom » alors qu'il
     * n'a rien tapé.
     */
    partageAucun: partageRecherche.trim() !== '' && contactsVisibles.length === 0,
    shareContacts: contactsVisibles.map(({ contact, rang }) => ({
      ...shareContactsDe([contact], shareSel.includes(rang) ? [0] : [], () => {
        toggleContact(rang);
      })[0]!,
    })),
    shareNets: mesReseaux.reseaux.map((reseau) => ({
      ...initialesDeReseau(reseau.name, reseau.id),
      name: reseau.name,
      sub: `${String(reseau.memberCount)} membre${reseau.memberCount > 1 ? 's' : ''}`,
      action: reseauxPartages.includes(reseau.id)
        ? 'Partagé'
        : reseauEnCours === reseau.id
          ? 'Envoi…'
          : 'Partager',
      bloque: reseauxPartages.includes(reseau.id) || reseauEnCours !== null,
      onPartager: (): void => {
        onPartagerDansReseau(reseau.id, reseau.name);
      },
    })),
    shareOut: SORTIES.map((sortie) => ({
      label: sortie.label,
      icon: sortie.icon,
      onChoisir: (): void => {
        onSortie(sortie.label);
      },
    })),
    partageSujet:
      publicationPartagee === null
        ? null
        : {
            ...avatarDe(publicationPartagee.author),
            titre: `${publicationPartagee.author.displayName} · ${publicationPartagee.typeLabel}`,
            extrait: publicationPartagee.excerpt,
          },
    partageRecherche,
    onPartageRecherche: (event: { target: { value: string } }): void => {
      setPartageRecherche(event.target.value);
    },
    onPartager,
    partageBloque: shareSel.length === 0 || partageEnCours,
    ...shareButtonFor(shareSel.length),
  };

  /**
   * LA FENÊTRE « LIER UN GUIDE ».
   *
   * Les RÉSULTATS sont de vrais guides — `GET /guides`, par `useGuides` — et la
   * requête ne part QUE lorsque la fenêtre s'ouvre (`actif`), parce qu'un panneau
   * que le membre n'ouvre pas n'a aucune raison de coûter un appel à chaque
   * affichage du fil.
   *
   * Les SUGGÉRÉS arrivent VIDES, et c'est mesuré, pas oublié : aucune route ne rend
   * des guides « suggérés pour cette publication ». Les remplir des mêmes cartes
   * que les résultats afficherait chaque guide deux fois, dont une sous une pastille
   * « Suggéré » que rien ne justifie. Une section vide sous son titre se voit ; une
   * fausse suggestion, non. REMONTÉ au rapport de lot.
   *
   * Ce qui n'est PAS branché non plus, et ne peut pas l'être : L'ENVOI. La sélection
   * ne va nulle part — `createPostSchema` est `.strict()` et n'a pas de `guideIds`,
   * donc `POST /posts` refuserait un guide lié. Les cases à cocher et « Lier 2
   * guides » restent du dessin.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES GUIDES LIÉS — LA SÉLECTION N'ALLAIT NULLE PART                      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La fenêtre cherchait DÉJÀ dans de vrais guides. Ce qui manquait était en
   * dessous : `createPostSchema` n'avait pas de `guideIds` et `posts` aucune
   * relation vers un guide. Les deux existent depuis la migration
   * `20261007040000_sondage_et_guides_sur_publication`.
   *
   * COMME LE SONDAGE, la sélection vit sur le COMPOSEUR : c'est « Publier » qui
   * l'envoie, dans la même transaction que la publication.
   *
   * `guidesChoisis` est le brouillon de la fenêtre ; `guidesLies` est ce qui est
   * validé. Les séparer permet d'annuler sans perdre ce qui était déjà lié.
   */

  const basculerGuide = useCallback((id: string): void => {
    setGuidesChoisis((courant) =>
      courant.includes(id)
        ? courant.filter((x) => x !== id)
        : // « Jusqu'à 3 » : la borne de la maquette, tenue ici AUSSI pour que le
          // quatrième clic ne fasse rien plutôt que d'être écarté en silence
          // par le serveur.
          courant.length >= FEED_LIMITS.postGuidesMax
          ? courant
          : [...courant, id],
    );
  }, []);

  const lierGuide = {
    guidesSuggeres: [],
    guideRecherche,
    onGuideRecherche: (event: { target: { value: string } }): void => {
      setGuideRecherche(event.target.value);
    },
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LA RECHERCHE REMPLACE LA LISTE, ELLE NE S'Y AJOUTE PAS                  ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * `resultats === null` veut dire « on ne cherche pas » — moins de deux
     * caractères, la borne du serveur. La liste du moment reste alors affichée,
     * ce qui est l'état de départ de la fenêtre.
     *
     * Dès qu'on cherche, c'est le RÉSULTAT qui s'affiche, même vide : mêler les
     * deux montrerait des guides qui ne correspondent pas à ce qu'on vient de
     * taper, et on ne saurait plus lesquels sont la réponse.
     *
     * LA SÉLECTION SURVIT à la recherche : `guidesChoisis` ne porte que des
     * identifiants, et un guide coché reste coché qu'il figure ou non dans le
     * résultat courant.
     */
    guidesTrouves:
      rechercheGuides.resultats !== null
        ? rechercheGuides.resultats.map((g) => ({
            titre: g.titre,
            meta: g.meta,
            guideId: g.id,
            choisi: guidesChoisis.includes(g.id),
            onPick: (): void => {
              basculerGuide(g.id);
            },
          }))
        : guides.page === null
          ? []
          : guidesLiablesDe(guides.page, guidesChoisis, basculerGuide),
    onLierGuides: (): void => {
      /** Même raison que pour le sondage : la fenêtre sert les deux composeurs. */
      if (edition !== null) {
        setEdition((e) =>
          e === null
            ? null
            : {
                ...e,
                guides: guidesChoisis.map((id) => ({
                  id,
                  titre: guidesParId.get(id) ?? e.guides.find((g) => g.id === id)?.titre ?? 'Guide lié',
                })),
              },
        );
        setOpen(null);
        notifySuccess(
          `${String(guidesChoisis.length)} guide${guidesChoisis.length > 1 ? 's' : ''} lié${guidesChoisis.length > 1 ? 's' : ''} à votre publication.`,
        );
        return;
      }
      setGuidesLies(guidesChoisis);
      setOpen(null);
      notifySuccess(
        `${String(guidesChoisis.length)} guide${guidesChoisis.length > 1 ? 's' : ''} lié${guidesChoisis.length > 1 ? 's' : ''} à votre publication.`,
      );
    },
    onAnnulerGuides: (): void => {
      setGuidesChoisis(guidesLies);
      setOpen(null);
    },
    lierBloque: guidesChoisis.length === 0,
  };

  return (
    <div onClick={onOpen}>
      <FenetreSignalement
        sujet={signalement}
        onFermer={() => {
          setSignalement(null);
        }}
      />
      <FenetreConfirmation
        ouverte={suppression !== null}
        nom="SUPPRESSION"
        titre="Supprimer cette publication ?"
        question="Elle disparaîtra du fil, avec ses commentaires, ses réactions et ses images."
        /**
         * CE QU'ON NE POURRA PAS DÉFAIRE, et rien d'autre. `DELETE /posts/:id`
         * supprime pour de bon — il n'y a ni corbeille ni délai de grâce sur une
         * publication, contrairement au compte qui en a sept jours.
         */
        precision="Ce geste est définitif : la publication ne pourra pas être restaurée."
        libelleConfirmer="Supprimer"
        occupe={suppressionEnCours}
        onConfirmer={confirmerSuppression}
        onAnnuler={() => {
          setSuppression(null);
        }}
      />
      <ScreenFrames
        screen="A01"
        desktop={<A01Desktop {...data} />}
        mobile={<A01Mobile {...data} />}
      />
      {/**
        * LA FENÊTRE DE MODIFICATION — montée par `Modal` comme les quatre autres,
        * donc avec son voile, son piège de tabulation, Échap et le retour du focus
        * au contrôle qui l'a ouverte. Un panneau posé à la main aurait perdu les
        * quatre.
        *
        * `desktop` ET `mobile` REÇOIVENT LE MÊME COMPOSANT : le panneau est borné à
        * `calc(100vw - 24px)`, donc il tient à 390 px comme à 1440. Deux planches
        * séparées n'auraient rien dit de plus, et auraient divergé.
        */}
      <Modal
        open={edition !== null}
        onClose={() => {
          setEdition(null);
        }}
        titleId="edition-publication-titre"
        name="EDITION"
        desktop={<FenetreEditionPublication {...editionPrises} />}
        mobile={<FenetreEditionPublication {...editionPrises} />}
      />
      <Modal
        open={open === 'A01C'}
        onClose={close}
        titleId="a01c-titre"
        name="A01C"
        desktop={<A01CDesktop {...fenetreCommentaires} />}
        mobile={<A01CMobile {...fenetreCommentaires} />}
      />
      <Modal
        open={open === 'A01P'}
        onClose={close}
        titleId="a01p-titre"
        name="A01P"
        desktop={<A01PDesktop {...partage} />}
        mobile={<A01PMobile {...partage} />}
      />
      <Modal
        open={open === 'A01G'}
        onClose={close}
        titleId="a01g-titre"
        name="A01G"
        desktop={<A01GDesktop {...lierGuide} />}
        mobile={<A01GMobile {...lierGuide} />}
      />
      {/**
       * A01S — « Créer un sondage ». Ses deux cadres ne consomment AUCUNE donnée :
       * le transcodeur les génère avec `_props`, parce que la maquette écrit tout
       * son formulaire en dur, faute de route où l'envoyer. Ils ne LISENT donc
       * rien, et ce n'est pas un oubli — c'est le manque, déjà remonté, de
       * `createPostSchema`, qui n'a pas de champ de sondage.
       *
       * `{...data}` est passé quand même, et il faut dire pourquoi plutôt que de
       * laisser croire à une étourderie : le transcodeur donne à ces deux cadres la
       * signature `(_props: A01Data)` — le contrat de leur écran, même quand ils
       * n'en consomment aucune prise. Le respecter coûte un étalement et ne fait
       * rien voyager ; l'éviter demanderait de changer le TYPE déclaré de A01S,
       * c'est-à-dire de mentir sur ce que la fenêtre consommera le jour où une
       * route acceptera son sondage.
       */}
      <Modal
        open={open === 'A01S'}
        onClose={close}
        titleId="a01s-titre"
        name="A01S"
        desktop={<A01SDesktop {...data} />}
        mobile={<A01SMobile {...data} />}
      />
      <FenetreNiveau
        capacite={niveauRefuse}
        onFermer={() => {
          setNiveauRefuse(null);
        }}
      />
    </div>
  );
}
