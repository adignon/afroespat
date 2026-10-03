/**
 * Le jeu de données complet que les écrans A02 à A14 reçoivent.
 *
 * POURQUOI UN SEUL OBJET pour quatorze pages : la maquette n'a qu'un `renderVals()`,
 * donc le générateur donne à tous ses cadres la même signature (`AccueilData`). Une
 * page qui rend A03 déclare ainsi les mêmes propriétés qu'une page qui rend A12 —
 * et TypeScript le vérifie, ce qui est précisément ce qu'on veut : un champ ajouté à
 * la maquette manque d'un coup à toutes les pages, et non à l'exécution de l'une
 * d'elles.
 *
 * Les états que la maquette calcule dans `this.state` deviennent ici des paramètres.
 * Ceux qu'une page n'anime pas gardent la valeur que la maquette dessine.
 */
import { FEED_LIMITS } from '@app/shared';
import {
  arrivals,
  attachSteps,
  attachTopics,
  audienceFor,
  brouillon,
  budgets,
  cityPillsFor,
  cityPlaceFilters,
  cityPlaces,
  cityStories,
  cityStoryFilters,
  cityTabsFor,
  cityTipFilters,
  cityTips,
  comments,
  contributors,
  countryBars,
  dirFilters,
  directory,
  discover,
  draftTypesFor,
  events,
  guideActions,
  guideFilters,
  guideTabs,
  guides,
  guidesSuggeres,
  guidesTrouves,
  invitees,
  mdTools,
  missing,
  modActions,
  msgsFor,
  myNets,
  netFilters,
  netTabsFor,
  ownerActions,
  paletteFor,
  panelFil,
  panelGuides,
  panelReseaux,
  panelVilles,
  photoTools,
  rail,
  relGuidesFor,
  rules,
  shortcuts,
  storyKindsFor,
  storyMain,
  storyViewFor,
  topics,
  versions,
  ville,
  visibility,
  webFrameFor,
  webKindFor,
  webKindsFor,
  webPaletteFor,
  webPillFor,
  writeBgFor,
  type AccueilData,
  type GuideVote,
} from './data';

/**
 * Ce qu'une page peut faire varier. Tout est optionnel : une page qui ne touche à
 * rien obtient exactement ce que la maquette dessine.
 */
export interface AccueilState {
  /** A13 : la story qu'on lit. La maquette en dessine trois, une par type. */
  readonly storyView?: number;
  /** A08 : l'onglet du réseau. La maquette montre « Sujets », le second. */
  readonly netTab?: number;
  /** A12 : l'onglet de la fiche ville. La maquette montre « Budgets réels ». */
  readonly cityTab?: number;

  /** A02 : les votes sur les guides rattachés. */
  readonly guideVotes?: Readonly<Record<number, GuideVote>>;
  readonly onGuideVote?: (index: number, vote: 'up' | 'down') => void;

  /** A14 : la couleur de fond, le type de story, l'audience, l'étape. */
  readonly pal?: number;
  readonly onPal?: (index: number) => void;
  readonly storyKind?: number;
  readonly onStoryKind?: (index: number) => void;
  readonly audience?: number;
  readonly onAudience?: (index: number) => void;
  readonly msgs?: boolean;
  readonly onToggleMsgs?: () => void;
  readonly step?: number;
  readonly photo?: boolean;
  readonly onPhoto?: () => void;
  /** A14 : le « Continuer » de l'étape 2, que le générateur a branché. */
  readonly onContinue?: () => void;
}

/** Une action qu'une page n'a pas branchée : elle ne fait rien, et ne ment pas. */
const noop = (): void => {};

export function accueilData(state: AccueilState = {}): AccueilData {
  const pal = state.pal ?? 0;
  const storyKind = state.storyKind ?? 0;
  const step = state.step ?? 0;
  const photo = state.photo ?? false;
  // La maquette dessine l'interrupteur ALLUMÉ : `this.state.msgs === false` est faux
  // au premier rendu, donc la piste est verte.
  const msgs = state.msgs ?? true;

  return {
    rail,
    shortcuts,
    panelFil,
    panelGuides,
    panelReseaux,
    panelVilles,

    guideTabs,
    guideFilters,
    guides,
    missing,

    contributors,
    guideActions,
    versions,

    mdTools,
    rules,

    myNets,
    netFilters,
    discover,

    netTabs: netTabsFor(state.netTab ?? 1),
    ownerActions,
    topics,

    comments,
    modActions,

    visibility,
    invitees,

    dirFilters,
    directory,

    countryBars,
    cityTabs: cityTabsFor(state.cityTab ?? 2),
    /**
     * La MÊME bascule, en pastilles : c'est la forme que la planche mobile
     * dessine. Un seul rang les décide toutes les deux, donc elles ne peuvent pas
     * se contredire.
     */
    cityPills: cityPillsFor(state.cityTab ?? 2),
    ville,
    cityTipFilters,
    cityPlaceFilters,
    cityStoryFilters,
    cityTips,
    cityPlaces,
    cityStories,
    /**
     * Le composeur mobile. La maquette le dessine sur « Discussion » — le QUATRIÈME
     * type — et le rang vient donc de son dessin, pas d'un défaut choisi ici.
     */
    draftTypes: draftTypesFor(3),
    brouillon,
    /**
     * RÈGLE DURE 04 §2.4 — « jusqu'à 4 images ». La borne est lue de `@app/shared`,
     * jamais recopiée : `createPostSchema` en fait la MÊME borne côté serveur, et
     * deux copies d'une limite finissent toujours par se contredire.
     */
    photosMax: FEED_LIMITS.postMediaMax,
    guidesSuggeres,
    guidesTrouves,
    budgets,
    arrivals,
    events,

    relGuides: relGuidesFor(state.guideVotes ?? {}, state.onGuideVote ?? noop),

    storyMain,
    // `?? storyViews[0]` plutôt qu'une assertion : `noUncheckedIndexedAccess` a
    // raison de dire qu'un index peut manquer, et retomber sur la première story
    // est ce que la maquette montre par défaut.
    st: storyViewFor(state.storyView ?? 0),

    writeBg: writeBgFor(pal),
    palette: paletteFor(pal, state.onPal ?? noop),
    storyKinds: storyKindsFor(storyKind, state.onStoryKind ?? noop),
    photoTools,
    attachSteps,
    attachTopics,
    audience: audienceFor(state.audience ?? 0, state.onAudience ?? noop),
    ...msgsFor(msgs),
    toggleMsgs: state.onToggleMsgs ?? noop,
    onContinue: state.onContinue ?? noop,
    webKind: webKindFor(storyKind),
    webPill: webPillFor(storyKind),
    webKinds: webKindsFor(storyKind, state.onStoryKind ?? noop),
    webPalette: webPaletteFor(pal, state.onPal ?? noop),
    w: webFrameFor(step, photo, state.onPhoto ?? noop),
  };
}
