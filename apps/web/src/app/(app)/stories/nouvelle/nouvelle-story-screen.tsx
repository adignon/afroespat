'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  JourneyTemplate,
  JourneyTemplateStep,
  PlacesCity,
  PlacesCountry,
  StorySubject,
} from '@app/shared';
import { ScreenFrames } from '@/screens/frames';
import { A14Desktop } from '@/screens/a14/desktop.generated';
import { A14Mobile } from '@/screens/a14/mobile.generated';
import { A14MobilePhoto } from '@/screens/a14/mobilephoto.generated';
import { A14MobileRattacher } from '@/screens/a14/mobilerattacher.generated';
import { A14MobilePublier } from '@/screens/a14/mobilepublier.generated';
import {
  BoutonEtape,
  BoutonParcours,
  FenetreEtape,
  FenetreParcours,
} from '@/screens/a14/selecteur-parcours';
import { ChampLieu, ChampSujetLibre } from '@/screens/a14/champ-sujet';
import { SelecteurVille } from '@/screens/a14/selecteur-ville';
import { listCitiesOfCountry, listPlacesCountries, readMe } from '@/screens/a14/api';
import { STORY_SUBJECT_LABELS, messageDeRattachement} from '@app/shared';
import { createStory, uploadStoryBackground } from '@/screens/accueil/api';
import { listJourneyTemplateSteps, listJourneyTemplates } from '@/screens/parcours/api';
import { ApiError } from '@/lib/api/errors';
import { notifyError } from '@/components/notifications';
import {
  attachStepsFrom,
  attachTopicsFor,
  audienceFor,
  bodyCountFor,
  bodyRecapFor,
  bodyStyleFor,
  chargeStory,
  etapeRecapFor,
  filtrerVilles,
  sujetRecapFor,
  storyCategoryFor,
  msgsFor,
  nextTextStyle,
  paletteFor,
  parcoursChoixFor,
  parcoursLabelFor,
  photoFondFor,
  photoToolsFor,
  storyKindsFor,
  textStyleLabelFor,
  webFrameFor,
  webKindFor,
  webKindsFor,
  webPaletteFor,
  webPillFor,
  writeBgFor,
  STORY_BODY_MAX,
  STORY_TEXT_STYLE,
  type A14Data,
  type LayerPointerEvent,
  storyTypeFor,} from '@/screens/a14/data';

/**
 * A14 — créer une story, en trois étapes. `/stories/nouvelle`
 *
 * Cinq cadres, qui sont les ÉTATS d'un même écran et non cinq écrans : « 1 ·
 * Écrire », sa variante photo, « 2 · Rattacher », « 3 · Publier », et la fenêtre
 * sombre d'ordinateur qui porte les trois étapes.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CET ÉCRAN PUBLIE MAINTENANT — ET CE QUI A CHANGÉ N'EST PAS UN REVIREMENT   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La version précédente de ce fichier expliquait qu'on ne pouvait PAS publier
 * depuis A14 : « AUCUN CHAMP DE SAISIE […] il n'existe donc aucun corps à envoyer
 * à `POST /stories` ». Le comptage de balises était juste ; la lecture du dessin
 * était fausse — la maquette dessine un champ étiqueté « Texte » avec son compteur
 * de caractères, et un caret à la fin du corps. Le détail de la mesure est dans
 * l'en-tête de `screens/a14/data.ts`.
 *
 * Le porteur a tranché : « Il faut que ce soit dynamique et permettre à
 * l'utilisateur de modifier les valeurs et de publier la story. Qui va s'afficher
 * dans sa liste de stories. »
 *
 * CE QUI N'A PAS CHANGÉ POUR AUTANT, et qui mérite d'être dit : la règle dure de
 * §3.5 — « l'objet cible n'est créé qu'à l'appel explicite de la route de
 * publication » — n'est pas levée, elle est APPLIQUÉE. `onPublish` appelle
 * `POST /stories`, c'est-à-dire exactement l'appel explicite qu'elle exige. Ce que
 * la règle interdit est un bouton qui refermerait la feuille en laissant croire
 * qu'on a publié ; c'est l'inverse d'ici.
 *
 * Et le JSX produit n'est toujours PAS retouché à la main : les quatre `<textarea>`,
 * les quatre boutons branchés et le calque déplaçable viennent tous du
 * transcodeur (`tools/generate-screens.mjs`) et des déclarations de
 * `tools/screens/03-accueil.mjs`. Une régénération les reproduit à l'identique.
 *
 * ── L'ÉTAT DE COMPOSITION ─────────────────────────────────────────────────
 *
 * Il vit dans la page, comme la maquette le calcule dans son `renderVals()`.
 * L'étape vient de l'URL au PREMIER rendu seulement, puis elle vit dans l'état :
 * la maquette ne dessine aucun contrôle de navigation entre les étapes 1 et 2 sur
 * mobile — elle montre ses états côte à côte — et l'exposer par l'URL ne dessine
 * rien tout en rendant les trois états atteignables.
 *
 * AUCUNE ANIMATION entre les étapes : `motion.js` réserve `panelAdvance` et
 * `onboardingStep` aux parcours de démarche. Une composition de story n'en est pas
 * un, et rien dans la table ne couvre ce cas.
 */
export function NouvelleStoryScreen({
  etape,
  enFenetre = false,
}: {
  readonly etape: number;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ OUVERT EN VOLET, OU EN PAGE ENTIÈRE — ET LA SORTIE N'EST PAS LA MÊME     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * A14 sert DEUX routes avec le même composant : `/stories/nouvelle` tapée
   * directement est une page, et `@fenetre/(.)stories/nouvelle` est un volet posé
   * sur la page d'où l'on vient (route interceptée).
   *
   * MESURÉ : publier depuis le volet laissait la fenêtre ouverte. `router.push`
   * change l'adresse mais ne DÉMONTE PAS un emplacement parallèle — pousser vers
   * `/accueil` une fenêtre posée sur `/accueil` ne la ferme pas. L'URL passait
   * bien à `/accueil`, et le composeur restait par-dessus.
   *
   * `FenetrePleine` le savait déjà : sa croix fait `router.back()`, « on revient
   * d'où l'on vient ». Le composant, lui, l'ignorait et devinait au `referrer` —
   * une heuristique qui vaut pour une page, pas pour un volet. La route le DIT
   * maintenant, au lieu de le faire deviner.
   */
  readonly enFenetre?: boolean;
}) {
  const router = useRouter();

  const [step, setStep] = useState(Math.min(2, Math.max(0, etape - 1)));
  const [pal, setPal] = useState(0);
  const [storyKind, setStoryKind] = useState(0);
  const [audience, setAudience] = useState(0);
  // La maquette dessine l'interrupteur ALLUMÉ : `this.state.msgs === false` est faux
  // au premier rendu, donc la piste est verte.
  const [msgs, setMsgs] = useState(true);
  const [photo, setPhoto] = useState(false);

  /**
   * LE CORPS PART VIDE, et le texte de la maquette est devenu le `placeholder`.
   *
   * C'est la règle que `FIELD_ADAPTATIONS` tient déjà pour les trois autres champs
   * du dépôt, et c'est ici une protection : en valeur initiale, un membre qui
   * appuie sur « Publier » sans rien écrire publierait le texte d'exemple sous son
   * nom — 80 caractères non vides, que `createStorySchema` accepterait sans
   * broncher. Vide, `body.min(1)` refuse et le membre voit pourquoi.
   */
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * ── LES CONTRÔLES DE COMPOSITION DE L'ÉTAPE 1 ─────────────────────────────
   *
   * Le porteur les a trouvés morts dans son navigateur : « Les actions sur la texte
   * et photo ne marche pas. Centré, gras, Changer, Recadrer, Assombrir le bas. »
   *
   * `textStyle` est le SEUL des cinq qui part dans la charge. `alignCentre`,
   * `recadre` et `assombri` n'ont aucun champ : ils agissent à la composition, et
   * c'est REMONTÉ — voir `bodyStyleFor` et `photoToolsFor` dans `a14/data.ts`.
   *
   * `assombri` part ALLUMÉ parce que c'est l'état que la maquette dessine : son
   * voile `linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72))` est présent sur la
   * planche de la variante photo.
   */
  const [textStyle, setTextStyle] = useState(STORY_TEXT_STYLE);
  const [alignCentre, setAlignCentre] = useState(false);
  const [recadre, setRecadre] = useState(false);
  const [assombri, setAssombri] = useState(true);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA PHOTO : DEUX CHOSES À TENIR, ET ELLES NE SONT PAS LA MÊME             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   *   · `photoUrl` est une adresse LOCALE (`URL.createObjectURL`) : c'est ce que le
   *     membre voit tout de suite, sans attendre le réseau ;
   *   · `photoAssetId` est ce que le SERVEUR a accepté. C'est lui, et lui seul, qui
   *     part dans `backgroundAssetId`.
   *
   * LES DEUX SONT NÉCESSAIRES, et les confondre créerait le pire des défauts de cet
   * écran : un aperçu qui montre une photo pendant qu'une couleur part dans la
   * charge. Tant que `photoAssetId` est `null`, `chargeStory` envoie la COULEUR —
   * c'est pourquoi `onPublish` refuse de publier pendant un téléversement, au lieu
   * de publier autre chose que ce qui est affiché.
   */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoAssetId, setPhotoAssetId] = useState<string | null>(null);
  const [televerse, setTeleverse] = useState(false);
  const fichier = useRef<HTMLInputElement | null>(null);

  /**
   * ── LE RATTACHEMENT DE L'ÉTAPE 2 ──────────────────────────────────────────
   *
   * `parcoursId` est le TYPE de parcours choisi dans la fenêtre ; `etapes` sont ses
   * étapes, servies par `GET /journey-templates/:id/steps` ; `stepDefinitionId` est
   * celle que le membre a choisie dans la liste, et c'est elle qui part.
   *
   * `modeles` est chargé PARESSEUSEMENT, à la première ouverture de la fenêtre : un
   * membre qui compose une story sans toucher au sélecteur ne doit pas payer un
   * appel réseau pour une liste qu'il ne verra pas.
   */
  const [attachQuery, setAttachQuery] = useState('');
  const [modeles, setModeles] = useState<readonly JourneyTemplate[]>([]);
  const [modelesCharges, setModelesCharges] = useState(false);
  const [modelesErreur, setModelesErreur] = useState<string | null>(null);
  const [parcoursOuvert, setParcoursOuvert] = useState(false);
  /** La fenêtre de choix d'étape — « mettre un chevron et afficher un modal ». */
  const [etapeOuverte, setEtapeOuverte] = useState(false);
  const [parcoursId, setParcoursId] = useState<string | null>(null);
  const [etapes, setEtapes] = useState<readonly JourneyTemplateStep[]>([]);
  const [etapesErreur, setEtapesErreur] = useState<string | null>(null);
  const [stepDefinitionId, setStepDefinitionId] = useState<string | null>(null);
  const [sujet, setSujet] = useState<StorySubject | null>(null);
  /**
   * Le sujet écrit à la main — « Au niveau du sujet, Autre doit permettre de
   * saisir dans un champ ». Il n'est PAS vidé quand on quitte « Autre » : un
   * membre qui touche une autre pastille par erreur ne perd pas ce qu'il a tapé,
   * et `chargeStory` ne l'enverra de toute façon pas sans « Autre ».
   */
  const [sujetLibre, setSujetLibre] = useState('');
  /** Le lieu d'une découverte — §2.6 l'exige, et aucune planche ne le dessine. */
  const [lieu, setLieu] = useState('');

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ QUI COMPOSE — L'APERÇU SIGNAIT « AMINA DIALLO »                         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le nom n'est pas dynamique. » C'était le nom de l'exemple de
   * la planche, affiché à tout membre sur l'aperçu de SA propre story.
   *
   * Les initiales sont dérivées du nom, pas demandées au serveur : il n'en rend
   * pas, et `avatar()` en calcule déjà pour le fil — on suit la même règle, deux
   * lettres au plus, en majuscules.
   */
  const [moi, setMoi] = useState<{ nom: string; initiales: string } | null>(null);

  useEffect(() => {
    const stop = new AbortController();
    readMe(stop.signal)
      .then((reponse) => {
        if (stop.signal.aborted) return;
        const nom = reponse.user.displayName;
        setMoi({
          nom,
          initiales: nom
            .split(/\s+/)
            .filter((mot) => mot.length > 0)
            .slice(0, 2)
            .map((mot) => mot.charAt(0).toLocaleUpperCase('fr-FR'))
            .join(''),
        });
      })
      .catch(() => {
        /**
         * Sans réponse, l'aperçu ne signe RIEN plutôt que de signer faux. C'est
         * le défaut qu'on corrige : un nom affiché qui n'est pas celui du membre.
         */
      });
    return () => stop.abort();
  }, []);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE CHOIX DE LA VILLE — ÉTAPE 3                                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « quand le tab est déjà sur la ville, les clics doivent afficher
   * le modal […] Par défaut c'est la première ville du pays d'origine qu'il faut
   * sélectionner. »
   *
   * `villeChoisie` porte l'OBJET et non son seul identifiant : l'onglet affiche
   * son NOM (« Cotonou seulement ») et la charge envoie son `id`. Garder les deux
   * séparément aurait créé deux vérités à tenir d'accord.
   */
  const [villeOuvert, setVilleOuvert] = useState(false);
  const [villeRecherche, setVilleRecherche] = useState('');
  const [villeChoisie, setVilleChoisie] = useState<PlacesCity | null>(null);
  const [paysListe, setPaysListe] = useState<readonly PlacesCountry[]>([]);
  const [paysVille, setPaysVille] = useState<PlacesCountry | null>(null);
  const [paysVilleOuvert, setPaysVilleOuvert] = useState(false);
  const [villes, setVilles] = useState<readonly PlacesCity[]>([]);
  const [villesCharge, setVillesCharge] = useState(false);
  const [villesErreur, setVillesErreur] = useState<string | null>(null);
  const [villePreparee, setVillePreparee] = useState(false);

  /** La translation du calque de texte, en pixels, depuis sa position dessinée. */
  const [layer, setLayer] = useState({ x: 0, y: 0 });

  const onToggleMsgs = useCallback((): void => setMsgs((on) => !on), []);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « PHOTO » OUVRE ENFIN UN SÉLECTEUR DE FICHIER                            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * CE QU'IL FAISAIT AVANT : `setPhoto((on) => !on)`. Il basculait une VARIANTE
   * D'AFFICHAGE qui montrait le hachurage d'exemple de la maquette — mesuré, il n'y
   * avait AUCUN `type="file"` dans tout le composeur, et `backgroundAssetId` ne
   * partait jamais. C'est la cause profonde des trois outils photo morts : « Changer »
   * n'avait rien à changer, et « Recadrer » recadrait l'image de la maquette.
   *
   * Il ouvre maintenant le sélecteur. La variante photo ne s'affiche qu'une fois un
   * fichier CHOISI (`onFichier`), ce qui est la vérité : avant cela il n'y a pas de
   * photo, et montrer un emplacement vide était l'illusion d'avant.
   */
  const onPhoto = useCallback((): void => {
    fichier.current?.click();
  }, []);

  /**
   * LE FICHIER CHOISI : on l'affiche d'abord, on le téléverse ensuite.
   *
   * L'ordre compte pour ce que le membre ressent — l'aperçu est instantané, le
   * réseau ne l'est pas — et le cas d'échec est traité et non avalé : si
   * `POST /media` refuse (format, taille, antivirus, EXIF), on REVIENT à la couleur
   * et le refus s'affiche. Laisser l'aperçu en place aurait montré une photo que la
   * publication n'aurait pas portée.
   *
   * `value = ''` à la fin : sans cela, rechoisir LE MÊME fichier ne déclenche aucun
   * `change` — le navigateur considère que la valeur n'a pas bougé. « Changer » puis
   * reprendre la même image serait resté sans effet, c'est-à-dire exactement le
   * symptôme qu'on vient de corriger.
   */
  const onFichier = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const choisi = event.target.files?.[0];
    event.target.value = '';
    if (choisi === undefined) return;

    const local = URL.createObjectURL(choisi);
    setPhotoUrl((avant) => {
      // L'adresse précédente est RÉVOQUÉE : sans cela, chaque « Changer » laisse un
      // objet dans la mémoire de l'onglet jusqu'à sa fermeture.
      if (avant !== null) URL.revokeObjectURL(avant);
      return local;
    });
    setPhoto(true);
    setPhotoAssetId(null);
    setTeleverse(true);

    uploadStoryBackground(choisi)
      .then((media) => {
        setPhotoAssetId(media.id);
        setTeleverse(false);
      })
      .catch((erreur: unknown) => {
        setTeleverse(false);
        setPhoto(false);
        setPhotoUrl((avant) => {
          if (avant !== null) URL.revokeObjectURL(avant);
          return null;
        });
        notifyError(
          erreur instanceof ApiError
            ? erreur.displayMessage
            : 'Cette photo n’a pas pu être envoyée. Réessayez dans un instant.',
        );
      });
  }, []);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CHOISIR UNE COULEUR RETIRE LA PHOTO — LE FOND EST UN OU EXCLUSIF         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `createStorySchema` porte un `.refine()` qui exige `backgroundColor` OU
   * `backgroundAssetId`, jamais les deux. Sans cette bascule, un membre qui ajoute
   * une photo PUIS touche une pastille de couleur verrait l'anneau blanc se déplacer
   * — la maquette le dessine — pendant que la story partirait en photo. Le contrôle
   * aurait l'air de répondre et ne déciderait de rien : exactement le défaut que ce
   * lot corrige partout ailleurs.
   *
   * C'est aussi ce que la maquette MONTRE : le bouton « Photo » REMPLACE l'aplat de
   * couleur sur sa planche, il ne se superpose pas. Il n'y a donc pas de troisième
   * état à inventer, et c'est pour cela que ce geste est le retour à la couleur —
   * aucun contrôle n'est dessiné pour « retirer la photo », et les sept pastilles
   * disent déjà « je veux une couleur ».
   */
  const onPal = useCallback((i: number): void => {
    setPal(i);
    setPhoto(false);
    setPhotoAssetId(null);
    setPhotoUrl((avant) => {
      if (avant !== null) URL.revokeObjectURL(avant);
      return null;
    });
  }, []);

  const onTextStyle = useCallback((): void => setTextStyle((s) => nextTextStyle(s)), []);
  const onAlign = useCallback((): void => setAlignCentre((on) => !on), []);
  const onRecadrer = useCallback((): void => setRecadre((on) => !on), []);
  const onAssombrir = useCallback((): void => setAssombri((on) => !on), []);

  const onContinue = useCallback((): void => setStep((s) => Math.min(2, s + 1)), []);
  /** « Modifier », à l'étape 3 : on retourne écrire. */
  const onEdit = useCallback((): void => setStep(0), []);

  const onAttachQuery = useCallback(
    (event: { readonly target: { readonly value: string } }): void => {
      setAttachQuery(event.target.value);
    },
    [],
  );

  /**
   * ── LE CHOIX D'UNE ÉTAPE ET D'UN SUJET SONT DES BASCULES ──────────────────
   *
   * Les deux portent `aria-pressed`, qui PROMET une bascule : un second appui doit
   * donc désélectionner. Sans cela, un membre qui choisit une étape par erreur ne
   * pourrait plus publier d'information ni de découverte — le serveur les refuse
   * avec une étape (`INFORMATION_HAS_NO_STEP`, `DECOUVERTE_HAS_NO_STEP`) — et rien
   * à l'écran ne lui dirait comment revenir en arrière.
   */
  const onStep = useCallback((id: string): void => {
    setStepDefinitionId((avant) => (avant === id ? null : id));
  }, []);

  const onSujet = useCallback((s: StorySubject): void => {
    setSujet((avant) => (avant === s ? null : s));
  }, []);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA FENÊTRE DES PARCOURS — CHARGÉE À LA PREMIÈRE OUVERTURE, PAS AVANT     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `GET /journey-templates` ne sert QUE cette fenêtre. L'appeler au montage ferait
   * payer un aller-retour à tout membre qui compose une story sans toucher au
   * sélecteur, et c'est la majorité des cas : la maquette ne dessine le rattachement
   * qu'à l'étape 2.
   *
   * L'effet garde `modelesCharges` et non la longueur de `modeles` : une réponse
   * LÉGITIMEMENT vide (aucun parcours pour le pays du membre) serait rechargée à
   * chaque ouverture si l'on se fiait au compte.
   *
   * ── CE QUI A CHANGÉ : L'ÉTAPE 2 LA DEMANDE AUSSI ──────────────────────────
   *
   * Le porteur : « Je propose de sélectionner par défaut le premier parcours dans
   * la liste. » Un parcours retenu d'office doit être retenu AVANT qu'on ouvre la
   * fenêtre — sinon l'étape 2 s'ouvre sur « Aucun pour l'instant » et zéro étape,
   * ce qui est exactement ce qu'on mesurait.
   *
   * La condition devient donc « la fenêtre est ouverte OU l'on est à l'étape 2 ».
   * Le raisonnement d'origine tient toujours pour l'étape 1 : un membre qui écrit
   * son texte et s'arrête ne paie aucun aller-retour.
   */
  useEffect(() => {
    if (!(parcoursOuvert || step >= 1) || modelesCharges) return undefined;
    const stop = new AbortController();
    let vivant = true;

    listJourneyTemplates()
      .then((reponse) => {
        if (!vivant) return;
        setModeles(reponse.items);
        setModelesCharges(true);
        setModelesErreur(null);
      })
      .catch((erreur: unknown) => {
        if (!vivant) return;
        setModelesErreur(
          erreur instanceof ApiError
            ? erreur.displayMessage
            : 'La liste des parcours n’a pas pu être chargée.',
        );
      });

    return () => {
      vivant = false;
      stop.abort();
    };
  }, [modelesCharges, parcoursOuvert, step]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA VILLE PAR DÉFAUT — LA PREMIÈRE DU PAYS D'ORIGINE                      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * « Par défaut c'est la première ville du pays d'origine qu'il faut
   * sélectionner. »
   *
   * TROIS appels, et ils sont enchaînés parce qu'ils dépendent l'un de l'autre :
   * le profil donne `originCountryId`, la liste des pays donne l'objet (son nom et
   * son code, pour le bouton et son drapeau), et les villes de ce pays donnent la
   * première. Aucun ne peut partir avant le précédent.
   *
   * ── POURQUOI À L'ÉTAPE 3 ET PAS AU MONTAGE ────────────────────────────────
   *
   * L'onglet « <Ville> seulement » n'existe qu'à l'étape 3. Trois allers-retours
   * au montage les feraient payer à tout membre qui écrit une story et s'arrête —
   * c'est le même raisonnement que pour la liste des parcours, et la même borne.
   *
   * ── `villePreparee` PLUTÔT QUE `villeChoisie !== null` ────────────────────
   *
   * Un pays d'origine SANS aucune ville au référentiel est un cas légitime, et il
   * laisserait `villeChoisie` à `null` : s'y fier relancerait les trois appels à
   * chaque rendu. Le drapeau dit « on a essayé », ce qui n'est pas « on a
   * trouvé ».
   *
   * ── CE QUI N'EST PAS UNE ERREUR D'ÉCRAN ───────────────────────────────────
   *
   * Un échec ici ne montre AUCUN refus au membre : la ville par défaut est un
   * confort, et le serveur retombe de lui-même sur la ville du membre quand la
   * charge n'en porte pas. Crier au sujet d'un confort qui n'a pas abouti ferait
   * passer pour cassé un écran qui marche. Le refus, lui, est montré quand le
   * membre OUVRE la fenêtre — là, il attend une liste.
   */
  useEffect(() => {
    if (step < 2 || villePreparee) return undefined;
    const stop = new AbortController();
    let vivant = true;

    void (async () => {
      try {
        const [me, pays] = await Promise.all([
          readMe(stop.signal),
          listPlacesCountries(stop.signal),
        ]);
        if (!vivant) return;
        setPaysListe(pays.items);
        const origine = pays.items.find((c) => c.id === me.user.originCountryId) ?? null;
        setPaysVille(origine);
        if (origine === null) return;
        const villesOrigine = await listCitiesOfCountry(origine.id, stop.signal);
        if (!vivant) return;
        setVilles(villesOrigine.items);
        setVilleChoisie(villesOrigine.items[0] ?? null);
      } catch {
        // Voir ci-dessus : un confort qui échoue ne parle pas.
      } finally {
        if (vivant) setVillePreparee(true);
      }
    })();

    return () => {
      vivant = false;
      stop.abort();
    };
  }, [step, villePreparee]);

  /**
   * LES VILLES DU PAYS CHOISI DANS LA FENÊTRE.
   *
   * « une fois un pays sélectionné les villes du pays s'affiche. »
   *
   * `signal` et non un simple drapeau : changer deux fois de pays de suite peut
   * faire revenir les réponses dans le désordre, et la liste afficherait les
   * villes d'un pays que le membre ne regarde plus. C'est la même précaution que
   * pour les étapes d'un parcours, et elle a la même cause.
   *
   * L'effet ne tourne QUE fenêtre ouverte : le premier chargement, lui, est fait
   * par l'effet ci-dessus, qui a déjà posé les villes du pays d'origine.
   */
  useEffect(() => {
    if (!villeOuvert || paysVille === null) return undefined;
    const stop = new AbortController();
    setVillesCharge(true);
    setVillesErreur(null);

    listCitiesOfCountry(paysVille.id, stop.signal)
      .then((reponse) => {
        if (stop.signal.aborted) return;
        setVilles(reponse.items);
      })
      .catch((erreur: unknown) => {
        if (stop.signal.aborted) return;
        setVillesErreur(
          erreur instanceof ApiError
            ? erreur.displayMessage
            : 'La liste des villes n’a pas pu être chargée.',
        );
      })
      .finally(() => {
        if (!stop.signal.aborted) setVillesCharge(false);
      });

    return () => stop.abort();
  }, [villeOuvert, paysVille]);

  /**
   * LE PREMIER PARCOURS DE LA LISTE EST RETENU D'OFFICE.
   *
   * « Je propose de sélectionner par défaut le premier parcours dans la liste. »
   *
   * Le PREMIER au sens du serveur : `GET /journey-templates` rend ses modèles
   * triés par `sortOrder`, et ce rang est une donnée de référentiel, pas un
   * hasard de réponse. On ne refait donc aucun tri ici — le faire serait une
   * seconde vérité, et c'est le genre d'écart qui ne se voit qu'en production.
   *
   * La garde `parcoursId !== null` est ce qui empêche l'effet de REVENIR sur un
   * choix du membre : il ne joue qu'une fois, à l'arrivée de la liste.
   */
  useEffect(() => {
    if (parcoursId !== null) return;
    const premier = modeles[0];
    if (premier !== undefined) setParcoursId(premier.id);
  }, [modeles, parcoursId]);

  /**
   * LES ÉTAPES DU PARCOURS CHOISI — `GET /journey-templates/:id/steps`.
   *
   * C'est ce que le porteur a demandé : « il sélectionne un, ainsi les étapes par
   * rapport à ce parcours s'affiche dans la liste des étapes ».
   *
   * `signal` et non un simple drapeau : changer de parcours deux fois de suite
   * laisserait deux requêtes en vol, et c'est la PREMIÈRE arrivée qui gagnerait au
   * hasard du réseau — la liste afficherait les étapes d'un parcours que le membre
   * n'a plus sélectionné. L'annulation rend l'ordre déterministe.
   *
   * L'étape déjà choisie est OUBLIÉE au changement de parcours : son
   * `stepDefinitionId` appartient à l'ancien, et l'envoyer rattacherait le conseil à
   * une étape que le membre ne voit plus.
   */
  useEffect(() => {
    if (parcoursId === null) {
      setEtapes([]);
      return undefined;
    }
    const stop = new AbortController();

    listJourneyTemplateSteps(parcoursId, stop.signal)
      .then((reponse) => {
        setEtapes(reponse.items);
        setEtapesErreur(null);
      })
      .catch((erreur: unknown) => {
        if (stop.signal.aborted) return;
        setEtapes([]);
        setEtapesErreur(
          erreur instanceof ApiError
            ? erreur.displayMessage
            : 'Les étapes de ce parcours n’ont pas pu être chargées.',
        );
      });

    return () => stop.abort();
  }, [parcoursId]);

  /**
   * LE REFUS DE CHARGEMENT DES ÉTAPES S'AFFICHE, et il passe par la notification —
   * le choix du porteur pour tous les refus survenus pendant un flux. Il ne peut pas
   * s'écrire dans la liste : la maquette n'y dessine aucune place, et lui en inventer
   * une serait du dessin.
   */
  useEffect(() => {
    if (etapesErreur === null) return;
    notifyError(etapesErreur);
  }, [etapesErreur]);

  const onChoisirParcours = useCallback((id: string): void => {
    setParcoursId(id);
    setStepDefinitionId(null);
    setParcoursOuvert(false);
  }, []);

  const onClose = useCallback((): void => {
    /**
     * `history.length > 1` NE SUFFIT PAS, et la sonde l'a montré : elle vaut vrai
     * même quand l'entrée précédente est `about:blank`, et la croix renvoyait sur
     * une page blanche. On regarde donc d'où l'on vient VRAIMENT : un `referrer`
     * de notre origine veut dire qu'il y a une page à nous derrière. Sinon —
     * onglet neuf, lien partagé — on va à l'accueil.
     */
    if (enFenetre) {
      /** Un volet se démonte en revenant en arrière — voir `enFenetre`. */
      router.back();
      return;
    }
    const dedans =
      typeof document !== 'undefined' &&
      document.referrer !== '' &&
      new URL(document.referrer).origin === window.location.origin;
    if (dedans) router.back();
    else router.push('/accueil');
  }, [enFenetre, router]);

  const onOuvrirParcours = useCallback((): void => setParcoursOuvert(true), []);
  const onFermerParcours = useCallback((): void => setParcoursOuvert(false), []);

  const parcoursChoisi = modeles.find((m) => m.id === parcoursId) ?? null;

  const onStoryBodyChange = useCallback(
    (event: { readonly target: { readonly value: string } }): void => {
      /**
       * LA BORNE EST APPLIQUÉE ICI AUSSI, et ce n'est pas redondant avec le
       * `maxLength` que le transcodeur pose sur les `<textarea>` : `maxLength`
       * borne la FRAPPE, il ne borne pas un collage programmatique ni un
       * remplissage automatique. Le compteur et la charge doivent dire la même
       * chose que le champ, toujours.
       */
      setBody(event.target.value.slice(0, STORY_BODY_MAX));
    },
    [],
  );

  /**
   * ── LA PRISE DU CALQUE ────────────────────────────────────────────────────
   *
   * Le porteur : « sur mobile le texte est écrit sur l'image ou la couleur et
   * déplaçable etc... comme avec whatsapp. sur Web aussi il faut permettre son
   * déplacement aussi comme dans la photo. »
   *
   * `onPointerDown` et non `onMouseDown` : les événements de pointeur couvrent la
   * souris ET le doigt d'un seul jeu de gestionnaires, ce qui est exactement ce que
   * « sur mobile […] sur Web aussi » demande. `setPointerCapture` fait que le
   * déplacement continue de nous être livré même quand le doigt sort du calque —
   * sans lui, un geste rapide décroche.
   *
   * LE TEXTE RESTE MODIFIABLE, et c'est la garde ci-dessous qui le tient : si
   * l'événement vient du `<textarea>`, on rend la main. La maquette sépare déjà les
   * deux gestes par sa géométrie — 16 px de remplissage AUTOUR du texte, quatre
   * poignées HORS du cadre — donc le texte est la zone de frappe et le cadre la
   * zone de prise. Un calque qu'on ne pourrait plus éditer parce qu'on l'a rendu
   * déplaçable serait un recul.
   */
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const onLayerGrab = useCallback((event: LayerPointerEvent): void => {
    const cible = event.target;
    // La frappe passe devant la prise : voir le bloc ci-dessus.
    if (cible instanceof HTMLTextAreaElement) return;

    event.preventDefault();
    const cadre = event.currentTarget;
    drag.current = { x: event.clientX, y: event.clientY, ox: layer.x, oy: layer.y };

    const bouger = (e: PointerEvent): void => {
      const d = drag.current;
      if (d === null) return;
      setLayer({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
    };
    const lacher = (): void => {
      drag.current = null;
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerup', lacher);
      window.removeEventListener('pointercancel', lacher);
    };

    if (cadre instanceof Element && 'setPointerCapture' in cadre) {
      try {
        cadre.setPointerCapture(event.pointerId);
      } catch {
        // Un pointeur déjà relâché refuse la capture : le déplacement marche
        // quand même par les écouteurs de fenêtre, qui sont la vraie mécanique.
      }
    }
    window.addEventListener('pointermove', bouger);
    window.addEventListener('pointerup', lacher);
    window.addEventListener('pointercancel', lacher);
  }, [layer.x, layer.y]);

  /**
   * ── PUBLIER ───────────────────────────────────────────────────────────────
   *
   * La charge est construite par `chargeStory` et validée par `createStorySchema`
   * — le schéma du SERVEUR — AVANT l'envoi. C'est la seule autorité sur ce qui
   * part, et `parse` fait échouer ici, en nommant le champ, ce qui échouerait
   * sinon en `400` sans dire lequel.
   *
   * LES TROIS ÉCHECS, ET AUCUN N'EST SILENCIEUX :
   *
   *   · LE CORPS VIDE — `body.min(1)` du schéma. C'est un `ZodError`, pas un
   *     `ApiError` : aucun appel réseau n'a lieu, et le message est écrit ici
   *     parce que le catalogue partagé n'en a pas pour ce cas (il ne couvre que
   *     les refus du serveur) ;
   *   · `INVALID_ATTACHMENT` — le cas du membre SANS VILLE. `cityId` est omis
   *     pour retomber sur la ville du membre ; un membre qui n'en a pas reçoit ce
   *     refus, et son message catalogué s'affiche. Voir la réserve ci-dessous ;
   *   · tout autre refus du serveur — `STORY_LIMIT` (trois stories par jour),
   *     `CONTENT_BLOCKED`, `LEVEL_REQUIRED`… Tous passent par `displayMessage`, qui
   *     décide sur le CODE et jamais sur le message, et qui a une phrase neutre en
   *     dernier recours.
   *
   * RÉSERVE SUR `INVALID_ATTACHMENT`, remontée : son message catalogué dit « Ce
   * type de story demande un rattachement que vous n'avez pas indiqué », ce qui ne
   * NOMME PAS la ville manquante — un membre sans ville lira qu'il a oublié de
   * remplir quelque chose qui n'est pas dessiné sur son écran. Le message juste
   * s'écrirait dans `FEED_ERROR_MESSAGES` (`@app/shared`), pas ici : le front
   * décide sur le code, il n'écrit pas les phrases du catalogue.
   *
   * L'AFFICHAGE PASSE PAR UNE NOTIFICATION, et c'est le choix du porteur pour tous
   * les refus survenus pendant un flux — voir `components/notifications.tsx`,
   * « le tooltip […] n'est pas présentable, il faut utiliser des librairies
   * dédiées ». Elle porte `role="alert"`, donc elle est annoncée sans qu'on la
   * cherche. L'alternative aurait été d'écrire le refus dans la bande orange que
   * la maquette dessine à l'étape 3 — mais cette bande porte le rappel du serveur
   * (« Pas de lien, de numéro ni de montant précis. ») et lui faire porter deux
   * sens différents effacerait l'un des deux.
   *
   * APRÈS SUCCÈS : on va à `/accueil`, où la bande « STORIES DU JOUR » est déjà
   * branchée sur `GET /stories` (`use-fil.ts`, `fetchStoryBand`). La story
   * publiée y apparaît donc d'elle-même, ce qui est la preuve que le porteur
   * attend. `refresh()` avant `push()` parce que la bande est servie par un
   * composant qui garde sa réponse : sans elle, on reviendrait sur la liste
   * d'avant la publication.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DIRE CE QUI MANQUE, ET PAS SEULEMENT QU'IL MANQUE QUELQUE CHOSE          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, devant le refus : « Ceci est lié à quoi "Ce type de story demande
   * un rattachement que vous n'avez pas indiqué" ? Qu'est-ce qui manque ? » La
   * question EST le défaut : la phrase nomme un problème sans nommer le champ.
   *
   * Le serveur le sait pourtant — il met le motif dans `details.reason` — et la
   * phrase correspondante vit dans le catalogue de `@app/shared`, pas ici : cet
   * écran décide sur le CODE, il n'écrit pas les messages. La réserve inscrite
   * plus haut dans ce fichier (« Le message juste s'écrirait dans
   * `FEED_ERROR_MESSAGES` ») est donc levée, au même endroit qu'elle désignait.
   */
  const messageDuRefus = (erreur: unknown): string => {
    if (!(erreur instanceof ApiError)) {
      return 'Votre story n’a pas pu être publiée. Réessayez dans un instant.';
    }
    if (erreur.code === 'INVALID_ATTACHMENT') {
      return messageDeRattachement((erreur.details as { reason?: unknown } | undefined)?.reason);
    }
    return erreur.displayMessage;
  };

  const onPublish = useCallback((): void => {
    if (busy) return;

    /**
     * ON NE PUBLIE PAS PENDANT UN TÉLÉVERSEMENT, et ce n'est pas de la prudence.
     *
     * Tant que `POST /media` n'a pas répondu, `photoAssetId` est `null` et
     * `chargeStory` envoie la COULEUR — le schéma exige l'un OU l'autre. La story
     * partirait donc sur un aplat de couleur pendant que l'écran montre la photo du
     * membre. Un refus lisible vaut mieux qu'une publication qui ne ressemble pas à
     * ce qu'on a composé.
     */
    if (televerse) {
      notifyError('Votre photo est encore en cours d’envoi. Réessayez dans un instant.');
      return;
    }

    let charge;
    try {
      charge = chargeStory({
        body,
        pal,
        storyKind,
        audience,
        msgs,
        textStyle,
        stepDefinitionId,
        sujet,
        sujetLibre,
        lieu,
        cityId: villeChoisie?.id ?? null,
        backgroundAssetId: photoAssetId,
      });
    } catch {
      notifyError('Écrivez le texte de votre story avant de la publier.');
      return;
    }

    setBusy(true);
    createStory(charge)
      .then(() => {
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ APRÈS LA PUBLICATION : ON REFERME, ET LE BOUTON SE RELÂCHE        ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * Le porteur : « La publication d'une story met le bouton en mode
         * "publication" sans jamais le désactiver ou fermer après publication. »
         *
         * DEUX DÉFAUTS, et le second explique le premier :
         *
         *   1. `router.push('/accueil')` NE REFERME PAS cette fenêtre. A14 est
         *      aussi une ROUTE INTERCEPTÉE (`@fenetre/(.)stories/nouvelle`) :
         *      ouverte depuis le fil, elle est un volet posé sur l'accueil. Un
         *      `push` empile une entrée de plus, et l'interception reste montée —
         *      on pousse vers l'accueil une fenêtre qui recouvre déjà l'accueil.
         *      `onClose` connaît déjà la bonne sortie et la mesure (`referrer` de
         *      notre origine → `back()`), donc on l'emploie plutôt que d'en écrire
         *      une seconde ;
         *   2. `busy` n'était jamais relâché au SUCCÈS — seulement à l'échec. Tant
         *      que le composant restait monté, et il restait monté, le bouton
         *      disait « Publication… » pour toujours.
         *
         * `router.refresh()` AVANT la fermeture : le bandeau de stories de
         * l'accueil doit porter la nouvelle story quand on y revient.
         */
        setBusy(false);
        router.refresh();
        onClose();
      })
      .catch((erreur: unknown) => {
        setBusy(false);
        notifyError(messageDuRefus(erreur));
      });
  }, [
    audience,
    /** `onClose` : la fermeture après succès en dépend — voir son commentaire. */
    onClose,
    body,
    busy,
    msgs,
    pal,
    photoAssetId,
    router,
    stepDefinitionId,
    storyKind,
    sujet,
    /**
     * `sujetLibre` ET `villeChoisie` SONT DANS CETTE LISTE, et leur absence était
     * un défaut silencieux : `onPublish` est un `useCallback`, donc il fige les
     * valeurs de son dernier rendu. Omis, le sujet écrit à la main serait parti
     * vide et la ville choisie ne serait jamais partie du tout — un écran qui
     * montre un choix et en envoie un autre, c'est-à-dire exactement ce que ce
     * fichier dit vouloir empêcher.
     */
    sujetLibre,
    villeChoisie,
    /**
     * ╔═════════════════════════════════════════════════════════════════════╗
     * ║ ET `lieu` AUSSI — le même défaut, une troisième fois                     ║
     * ╚═════════════════════════════════════════════════════════════════════╝
     *
     * Le champ de lieu est arrivé après cette liste, et n'y a pas été ajouté. Une
     * découverte partait donc SANS son `placeLabel` — refusée par le serveur
     * (`DECOUVERTE_NEEDS_PLACE`) alors que le membre avait bien rempli le champ et
     * le voyait rempli à l'écran.
     *
     * POURQUOI ÇA NE SE VOYAIT PRESQUE JAMAIS : `villeChoisie` est dans la liste,
     * et la ville par défaut est chargée à l'étape 2 — donc APRÈS la saisie du
     * lieu. Sa réponse recréait le rappel, qui recapturait le `lieu` à jour, et le
     * défaut se réparait tout seul. Il ne restait que là où cette réponse n'arrive
     * pas à temps : connexion lente, ou machine chargée.
     *
     * MESURÉ : le cas « avec le lieu, la découverte part » échouait par
     * intermittence, et la charge relevée au navigateur n'avait NI `placeLabel` NI
     * `cityId` — les deux ensemble, ce qui désignait la cause. Joué seul, il
     * passait : la ville arrivait à temps.
     */
    lieu,
    televerse,
    textStyle,
  ]);

  const data: A14Data = {
    writeBg: writeBgFor(pal),
    palette: paletteFor(pal, onPal),
    storyKinds: storyKindsFor(storyKind, setStoryKind),

    /**
     * LES CINQ CONTRÔLES DE COMPOSITION, VIVANTS. « Changer » rouvre le sélecteur —
     * donc le même geste que « Photo », et il n'y a qu'une façon de choisir un
     * fichier.
     */
    photoTools: photoToolsFor({
      onChanger: onPhoto,
      onRecadrer,
      onAssombrir,
      recadre,
      assombri,
    }),
    photoFond: photoFondFor(photoUrl, recadre),
    assombri,
    textStyleLabel: textStyleLabelFor(textStyle),
    onTextStyle,
    alignCentre,
    onAlign,
    bodyStyle: bodyStyleFor(textStyle, alignCentre),

    storyBodyValue: body,
    onStoryBodyChange,
    storyBody: body,
    storyBodyRecap: bodyRecapFor(body),
    bodyMax: STORY_BODY_MAX,
    bodyCount: bodyCountFor(body),

    /**
     * `touchAction: 'none'` est ce qui rend le déplacement AU DOIGT possible : sans
     * lui, le navigateur interprète le glissement comme un défilement de page et
     * n'envoie jamais `pointermove`. C'est un comportement, pas un dessin.
     */
    layerStyle: {
      transform: `translate(${String(layer.x)}px, ${String(layer.y)}px)`,
      touchAction: 'none',
    },
    onLayerGrab,

    onPhoto,

    /**
     * ── L'ÉTAPE 2, OÙ TOUT ÉTAIT MORT ────────────────────────────────────────
     *
     * La recherche filtre LES DEUX listes, parce que c'est ce que son texte promet :
     * « Rechercher une étape ou un sujet ».
     *
     * `parcoursSelecteur` ne porte QUE le bouton : la fenêtre est montée une fois par
     * cette page, hors des cadres. `ScreenFrames` rend les deux cadres, donc tout ce
     * qui voyage ici existe en double — et deux fenêtres ouvertes porteraient deux
     * fois le même `id` de titre, ce que `modal.tsx` décrit comme la perte du nom de
     * la boîte de dialogue.
     */
    attachQuery,
    onAttachQuery,
    parcoursSelecteur: (
      <BoutonParcours nom={parcoursChoisi?.nameFr ?? null} onOuvrir={onOuvrirParcours} />
    ),
    /**
     * FERMER LE COMPOSEUR. `router.back()` plutôt qu'une adresse fixe : on revient
     * d'où l'on vient — le fil, un profil, une ville. Y poser « /accueil » ferait
     * d'une fermeture une NAVIGATION, et le membre perdrait sa place.
     *
     * Le repli existe parce que `back()` ne fait rien quand l'onglet s'est ouvert
     * directement sur cette adresse : il n'y a alors aucune page précédente, et la
     * croix paraîtrait morte — ce que le porteur vient précisément de signaler.
     */
    onClose,
    parcoursLabel: parcoursLabelFor(parcoursChoisi?.nameFr ?? null),
    attachSteps: attachStepsFrom(etapes, stepDefinitionId, attachQuery, onStep),
    /**
     * LE BOUTON D'ÉTAPE, posé là où la liste était. La fenêtre est montée plus
     * bas, une seule fois — `ScreenFrames` rend les deux cadres.
     */
    etapeSelecteur: (
      <BoutonEtape
        nom={
          attachStepsFrom(etapes, stepDefinitionId, '', onStep).find((e) => e.on)?.t ?? null
        }
        onOuvrir={() => setEtapeOuverte(true)}
      />
    ),
    attachTopics: attachTopicsFor(sujet, attachQuery, onSujet),
    /**
     * LE CHAMP NE S'OUVRE QUE POUR « AUTRE », et la condition est lue sur ce qui
     * PART (`storyCategoryFor`) et non sur `sujet` : pour une DÉCOUVERTE, la
     * catégorie envoyée est `PRODUIT` quoi qu'on ait coché, et un champ ouvert
     * là donnerait un texte que le serveur refuserait.
     */
    /**
     * LE MÊME EMPLACEMENT PORTE DEUX CHAMPS, et ils ne se rencontrent jamais : le
     * sujet libre n'existe que pour « Autre », le lieu que pour une DÉCOUVERTE,
     * dont la catégorie est `LIEU`, `PRODUIT` ou `SORTIE`.
     *
     * Sans le second, une découverte était IMPOSSIBLE à publier : §2.6 lui demande
     * un `place_label`, le serveur refuse sans (`DECOUVERTE_NEEDS_PLACE`, mesuré)
     * et la planche ne dessine aucun champ pour le saisir.
     */
    sujetLibre: (
      <>
        <ChampSujetLibre
          visible={storyCategoryFor(storyKind, sujet, stepDefinitionId !== null) === 'AUTRE'}
          valeur={sujetLibre}
          onChange={setSujetLibre}
        />
        <ChampLieu
          visible={storyTypeFor(storyKind) === 'DECOUVERTE'}
          valeur={lieu}
          onChange={setLieu}
        />
      </>
    ),
    sujetRecap: sujetRecapFor(storyKind, sujet, sujetLibre, stepDefinitionId !== null),
    etapeRecap: etapeRecapFor(etapes, stepDefinitionId),
    onContinue,

    /**
     * L'ONGLET DE VILLE : un premier appui le RETIENT, le suivant OUVRE la
     * fenêtre. Mot pour mot : « Quand l'utilisateur clique sur ça une fois ça
     * active le tab, une deuxième fois ça affiche un modal […] quand le tab est
     * déjà sur la ville, les clics doivent afficher le modal. »
     *
     * L'onglet « Tous les membres » garde son comportement d'origine : il n'ouvre
     * rien, parce qu'il n'y a rien à choisir.
     *
     * Le libellé porte le NOM DE LA VILLE RETENUE. Sans ville — le pays d'origine
     * n'en a aucune au référentiel, ou les appels ont échoué — on retombe sur le
     * mot de la planche, « Lyon », plutôt que sur un onglet vide.
     */
    audience: audienceFor(
      audience,
      (i) => {
        if (i === 1 && audience === 1) {
          setVilleOuvert(true);
          return;
        }
        setAudience(i);
      },
      villeChoisie?.name ?? 'Lyon',
    ),
    ...msgsFor(msgs),
    toggleMsgs: onToggleMsgs,

    onPublish,
    onEdit,
    busy,

    webKind: webKindFor(storyKind),
    /**
     * LA PASTILLE NE DIT LE SUJET QUE S'IL EST CHOISI — « le "Logement" […] est
     * affiché même quand ce n'est pas encore sélectionné par l'utilisateur ».
     */
    webPill: webPillFor(storyKind, sujet === null ? null : STORY_SUBJECT_LABELS[sujet]),
    moiNom: moi?.nom ?? '',
    moiInitiales: moi?.initiales ?? '',
    webKinds: webKindsFor(storyKind, setStoryKind),
    webPalette: webPaletteFor(pal, onPal),
    /**
     * Le dernier bouton de la fenêtre sombre est « Publier » à l'étape 3 et
     * « Suivant »/« Continuer » avant : un seul gestionnaire, qui publie quand
     * c'est l'étape de publication et avance sinon. C'est `webFrameFor` qui décide
     * du libellé, donc les deux ne peuvent pas se contredire.
     */
    w: webFrameFor(step, photo, onPhoto, {
      onNext: step === 2 ? onPublish : onContinue,
      onPrev: step === 0 ? () => router.push('/accueil') : () => setStep((s) => Math.max(0, s - 1)),
      busy,
    }),
  };

  /**
   * La variante photo n'est pas une étape de plus : c'est l'étape 1 quand une photo
   * a été jointe, exactement comme la maquette l'annonce — « Écrire · variante photo
   * · Rattacher · Publier ».
   *
   * LE TEXTE EST CONSERVÉ d'une variante à l'autre, et c'est une décision : la
   * maquette porte deux littéraux différents (« Pour Visale… » sur la couleur,
   * « Épicerie Wax… » sur la photo), ce qui dit qu'elle montre deux EXEMPLES de
   * story et non deux états d'une même story. Les deux sont donc devenus des
   * `placeholder`, et la VALEUR est unique : un membre qui ajoute une photo garde
   * ce qu'il a écrit. Le lui effacer serait un défaut, et aucun dessin ne le demande.
   */
  const mobile =
    step === 0 && photo ? (
      <A14MobilePhoto {...data} />
    ) : step === 0 ? (
      <A14Mobile {...data} />
    ) : step === 1 ? (
      <A14MobileRattacher {...data} />
    ) : (
      <A14MobilePublier {...data} />
    );

  return (
    <>
      {/*
        ╔══════════════════════════════════════════════════════════════════════╗
        ║ LE SÉLECTEUR DE FICHIER — HORS DES CADRES, ET CE N'EST PAS DU DESSIN ║
        ╚══════════════════════════════════════════════════════════════════════╝

        La maquette ne dessine AUCUN choisisseur de fichier, et c'est la mesure qui
        l'a établi : zéro `type="file"` dans les cinq cadres. Elle dessine en revanche
        le bouton « Photo » et les trois outils qui en dépendent — donc l'intention est
        là, et il ne manquait que le mécanisme.

        Ce champ est INVISIBLE (`display: none`) : il n'ajoute aucun pixel, et son
        rôle est entièrement rempli par le bouton « Photo » que la maquette dessine,
        qui le déclenche. C'est la forme la moins inventive possible — un contrôle
        natif, au clavier comme au doigt, sans aucune liste ni fenêtre à dessiner.

        `aria-hidden` est VOLONTAIREMENT ABSENT : le champ est atteignable par le
        bouton « Photo », qui porte déjà le nom accessible du geste. Le masquer à
        l'arbre d'accessibilité tout en le laissant focalisable serait le pire des
        deux états.

        IL EST HORS DE `ScreenFrames` parce que celui-ci rend LES DEUX cadres : à
        l'intérieur, il existerait en double, et `fichier.current` ne désignerait que
        l'un des deux — une fois sur deux celui du cadre masqué, dont le `click()`
        n'ouvre rien sur certains navigateurs.
      */}
      <input
        ref={fichier}
        type="file"
        accept="image/*"
        onChange={onFichier}
        aria-label="Choisir une photo de fond"
        style={{ display: 'none' }}
      />

      <ScreenFrames
        screen={`A14-${step + 1}`}
        background={data.writeBg}
        /** Le composeur est une SURFACE : il couvre, il ne se centre pas — voir `ScreenFrames`. */
        pleineLargeur
        desktop={<A14Desktop {...data} />}
        mobile={mobile}
      />

      {/*
        LA FENÊTRE DES PARCOURS, MONTÉE UNE SEULE FOIS. Voir la note de
        `attachSteps` ci-dessus, et l'en-tête de `selecteur-parcours.tsx` : deux
        instances porteraient deux fois `a14p-titre`, et la boîte de dialogue
        perdrait son nom.
      */}
      {/*
        LA FENÊTRE DES ÉTAPES — montée UNE FOIS, à côté des cadres, pour la même
        raison que celle des parcours : deux instances porteraient deux fois
        `a14e-titre`, et la boîte de dialogue perdrait son nom.
      */}
      <FenetreEtape
        ouvert={etapeOuverte}
        onFermer={() => setEtapeOuverte(false)}
        onChoisir={(id) => {
          onStep(id);
          setEtapeOuverte(false);
        }}
        etapes={attachStepsFrom(etapes, stepDefinitionId, attachQuery, onStep)}
        recherche={attachQuery}
        onRecherche={(event) => setAttachQuery(event.target.value)}
      />

      <FenetreParcours
        ouvert={parcoursOuvert}
        onFermer={onFermerParcours}
        onChoisir={onChoisirParcours}
        parcours={parcoursChoixFor(modeles, parcoursId)}
        charge={!modelesCharges && modelesErreur === null}
        erreur={modelesErreur}
      />

      {/*
        LE CHOIX DE LA VILLE — montée UNE FOIS, à côté des cadres, pour la même
        raison que la fenêtre des parcours : `ScreenFrames` rend les deux cadres,
        et deux instances porteraient deux fois `a14v-titre`.

        La liste est FILTRÉE ici et non dans le composant : le filtre est une
        règle de données (`filtrerVilles`, qui ignore accents et casse comme le
        font déjà les étapes et les sujets), pas un dessin.
      */}
      <SelecteurVille
        ouvert={villeOuvert}
        onFermer={() => {
          setVilleOuvert(false);
          setPaysVilleOuvert(false);
        }}
        recherche={villeRecherche}
        onRecherche={setVilleRecherche}
        paysOptions={paysListe}
        pays={paysVille}
        paysOuvert={paysVilleOuvert}
        onOuvrirPays={() => setPaysVilleOuvert(true)}
        onFermerPays={() => setPaysVilleOuvert(false)}
        onChoisirPays={(iso2) => {
          const choisi = paysListe.find((c) => c.iso2 === iso2) ?? null;
          setPaysVilleOuvert(false);
          if (choisi === null || choisi.id === paysVille?.id) return;
          /**
           * La liste est VIDÉE au changement de pays : la garder afficherait les
           * villes du pays précédent pendant l'aller-retour, ce qui donne à
           * croire que le pays n'a pas changé.
           */
          setPaysVille(choisi);
          setVilles([]);
          setVilleRecherche('');
        }}
        villes={filtrerVilles(villes, villeRecherche)}
        villeId={villeChoisie?.id ?? null}
        onChoisirVille={(ville) => {
          setVilleChoisie(ville);
          /**
           * Choisir une ville RETIENT aussi l'onglet « <Ville> seulement » : on
           * n'arrive ici qu'en ayant appuyé dessus, et repartir sur « Tous les
           * membres » contredirait le geste.
           */
          setAudience(1);
          setVilleOuvert(false);
        }}
        charge={villesCharge}
        erreur={villesErreur}
      />
    </>
  );
}
