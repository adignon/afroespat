/**
 * Données de l'écran A06 — les propositions reçues, et « Proposer une correction ».
 *
 * ── QUATRE CADRES, ET CE QUE CHACUN LIT MAINTENANT ──────────────────────────
 *
 * ⚠ CE PARAGRAPHE DISAIT « Les deux cadres d'ORDINATEUR ne lisent que la
 * NAVIGATION : le rail, le panneau de section et les raccourcis », et c'était vrai
 * jusqu'à ce lot — avec une conséquence que personne n'avait écrite : la page
 * « Propositions reçues » de 1 440 px affichait DEUX PROPOSITIONS D'EXEMPLE
 * (« Fatou Ndiaye · 11 jours restants ») et le TITRE DE LA MAQUETTE, sur le guide
 * de n'importe quel auteur.
 *
 * Le cadre `Desktop` lit donc désormais les mêmes prises que `Mobile` : le titre
 * du guide, les deux en-têtes de proposition et les compteurs d'onglets. Les deux
 * cadres « Corriger » et les deux cadres « Signalements », eux, n'ont pas changé.
 *
 * ── CE QUI A CHANGÉ, ET CE QUE CE TEXTE DISAIT DE FAUX ─────────────────────
 *
 * Cet en-tête affirmait que les QUATRE cadres ne lisent que la navigation, et il
 * l'affirmait juste au-dessus d'une interface qui déclare `guide`,
 * `propositionDepliee`, `propositionRepliee` et `propositionsCompte`. Le code
 * disait une chose, sa documentation l'inverse — et c'est précisément ce qui a
 * laissé les deux pages de guides construire un objet incomplet sans que personne
 * ne le voie avant `tsc`.
 *
 * ── LES TROIS BOUTONS DE DÉCISION SONT VIVANTS DEPUIS CE LOT ───────────────
 *
 * Ce paragraphe disait : « Ce qui RESTE dessiné sur la planche mobile : le passage
 * visé, le remplacement proposé et LES TROIS BOUTONS DE DÉCISION. » Les boutons
 * ne sont plus du dessin — mesuré avant : `grep -o "onClick"` sur le cadre de
 * 1 440 px rendait ZÉRO. Voir `A06_DECISIONS` dans `tools/generate-screens.mjs`,
 * et `decidable` plus bas.
 *
 * Ce qui RESTE dessiné : le passage visé et le remplacement proposé, pour la
 * raison écrite plus bas (la maquette y dessine un DIFF, l'API rend deux chaînes
 * nues).
 *
 * ── LA LIMITE QUI SUBSISTE, ET ELLE EST STRUCTURELLE ──────────────────────
 *
 * La planche dessine EXACTEMENT DEUX cartes en balisage statique — une dépliée,
 * une repliée — sans `<sc-for>` ni `<sc-if>`. Cet écran ne peut donc représenter
 * ni 0, ni 1, ni 3 propositions : il a deux EMPLACEMENTS, pas une liste. Un
 * emplacement sans proposition reçoit un en-tête vide, jamais les valeurs de la
 * maquette. Remonté : il faut que la planche dise ce qui déplie une carte.
 *
 * Ce qui EST fait : `screens/guides/api.ts` porte les cinq appels de §2.4 —
 * `fetchProposals`, `createProposal`, `acceptProposal`, `amendProposal`,
 * `rejectProposal` — tous validés par les schémas de `@app/shared`, et
 * `from-api.ts` sait déjà composer l'avant/après et le délai restant avant
 * escalade. Le jour où le cadre expose ses prises, il ne reste qu'à les relier.
 */
import { panel, rail, shortcuts } from '../a01/data';

export { panel, rail, shortcuts };

export const panelGuides = panel('Guides & Démarches');

/** Ce que les quatre cadres générés de A06 consomment. */
/**
 * LES PRISES DES DEUX CADRES MOBILES DE A06, et la limite de ce qui peut l'être.
 *
 * `guide` sert à la feuille « Proposer une correction » : la PAGE derrière la
 * feuille est le guide, et son titre était écrit en dur — la feuille annonçait
 * donc « Obtenir la garantie Visale sans CDI » quelle que soit la correction
 * proposée.
 *
 * ── POURQUOI DEUX PROPOSITIONS NOMMÉES, ET PAS UNE LISTE ──────────────────
 *
 * La planche « Propositions reçues » dessine DEUX cartes STRUCTURELLEMENT
 * DIFFÉRENTES : la première est dépliée (AVANT / APRÈS / Motif / trois boutons),
 * la seconde est repliée (une ligne de résumé). Ce ne sont pas deux éléments d'une
 * liste, ce sont deux ÉTATS d'affichage, et une boucle devrait choisir l'un des
 * deux dessins — donc mentir sur l'autre. Les deux sont nommées, comme la maquette
 * les dessine, et c'est remonté : il faudrait que la planche dise ce qui déplie
 * une carte.
 *
 * ── CE QUI RESTE DESSINÉ DANS LA CARTE DÉPLIÉE ────────────────────────────
 *
 * Les blocs AVANT et APRÈS. La maquette y dessine un DIFF — le mot retiré barré
 * sur fond gris, les mots ajoutés surlignés en vert — alors que l'API rend deux
 * chaînes nues (`targetExcerpt`, `replacement`). Les lier mettrait le texte entier
 * dans un seul `<span>` et ferait disparaître le diff, c'est-à-dire la seule chose
 * que ces deux blocs servent à montrer. Il faut un composant de différence, pas une
 * prise : remonté.
 */
/**
 * CE QU'UN CONVERTISSEUR PEUT REMPLIR SEUL : les six valeurs d'affichage.
 *
 * ── POURQUOI CETTE FORME EST SÉPARÉE DE CELLE QUE LE CADRE LIT ─────────────
 *
 * Parce que `propositionEnTeteDe` (`guides/from-api.ts`) ne peut PAS fabriquer les
 * trois gestes : ils demandent l'état de la page — quelle décision est en vol,
 * quelle fenêtre de confirmation ouvrir — et un convertisseur de ce dépôt ne
 * connaît que la réponse de l'API. Déclarer les gestes sur la forme qu'il rend
 * l'aurait obligé à poser des fonctions vides, c'est-à-dire des boutons qui ont
 * l'air branchés et ne le sont pas.
 *
 * `PropositionEnTeteView` l'ÉTEND avec ce que la page seule sait. C'est le même
 * découpage que `GuidePlanView`, dont l'en-tête dit « IL NE PORTE PAS SES GESTES :
 * ils demandent le routeur et l'état d'ouverture de la feuille, qui vivent dans la
 * page ».
 */
export interface PropositionEnTeteDonnees {
  readonly i: string;
  readonly bg: string;
  readonly proposant: string;
  /** « 11 j » — le délai avant escalade (§2.4 : `created_at + 14 jours`). */
  readonly delai: string;
  /**
   * « 11 jours restants » — LE MÊME DÉLAI, DANS LE MOT QUE L'ORDINATEUR DESSINE.
   *
   * La planche de 1 440 px écrit la pastille AU LONG (« 11 jours restants ») là où
   * celle de 390 px l'abrège (« 11 j ») : deux dessins de la même donnée, relevés
   * sur chaque cadre et non supposés identiques — c'est le piège 1 du mémo
   * d'amorçage, payé cinq fois dans ce dépôt.
   *
   * LE NOMBRE DE JOURS N'EST CALCULÉ QU'UNE FOIS, par `joursAvantEscalade`
   * (`guides/from-api.ts`), que les deux formes appellent. Deux arrondis
   * indépendants finiraient par se contredire d'un jour.
   */
  readonly delaiLong: string;
  readonly motif: string;
}

export interface PropositionEnTeteView extends PropositionEnTeteDonnees {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS DÉCISIONS DE L'AUTEUR — ET `decidable` DÉCIDE DE TOUT          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ avant ce lot : `grep -o "onClick" a06/desktop.generated.tsx` → ZÉRO.
   * Les deux cadres chargeaient les vraies propositions (`fetchProposals`,
   * `propositions?.items`), les trois appels existaient depuis des lots
   * (`acceptProposal`, `amendProposal`, `rejectProposal`), les trois routes aussi
   * (`POST /proposals/:id/accept|amend|reject`) — et l'auteur ne pouvait ni
   * accepter, ni amender, ni refuser. Il regardait.
   *
   * `decidable` EST FAUX DANS TROIS CAS, et un seul bouton éteint les couvre
   * tous : l'emplacement est VIDE (le guide a reçu moins de deux propositions),
   * la proposition n'attend PLUS de décision (`ACCEPTED`, `AMENDED`, `REJECTED` —
   * seuls `PENDING` et `ESCALATED` attendent, §2.4), ou un appel est EN VOL. Le
   * troisième cas est celui qui compte : sans lui, un double clic sur
   * « Accepter » enverrait deux écritures dans le corps du guide.
   *
   * ⚠ CE N'EST PAS UNE AUTORISATION, et c'est la règle du dépôt : le front
   * PRÉVIENT, il n'autorise pas. Les trois routes exigent `guide.write` (N2) et
   * `loadOwned` ; un non-auteur reçoit `403`/`404` même si le bouton part. Ce
   * booléen éteint un bouton qui n'aurait rien à faire, il n'ouvre aucune porte.
   */
  readonly decidable: boolean;
  /** `POST /proposals/:id/accept` — ⚠ ÉCRIT DANS LE GUIDE, donc confirmé avant. */
  readonly onAccepter: () => void;
  /** `POST /proposals/:id/amend` — l'auteur retouche le remplacement, puis accepte. */
  readonly onAmender: () => void;
  /** `POST /proposals/:id/reject` — motif OBLIGATOIRE (`rejectProposalSchema`). */
  readonly onRefuser: () => void;
}

/**
 * LE DESSIN DE LA MAQUETTE, pour le rendu serveur et pour l'instant qui précède la
 * réponse. Les trois gestes n'y font RIEN et `decidable` est faux : une planche
 * n'a pas de proposition à décider, et un bouton qui part sur un identifiant
 * inventé écrirait dans un guide au hasard.
 */
export const propositionDepliee: PropositionEnTeteView = {
  i: 'FN',
  bg: '#2FA37D',
  proposant: 'Fatou Ndiaye',
  delai: '11 j',
  delaiLong: '11 jours restants',
  motif: 'La validation en ligne est obligatoire depuis 2025.',
  decidable: false,
  onAccepter: () => undefined,
  onAmender: () => undefined,
  onRefuser: () => undefined,
};

export const propositionRepliee: PropositionEnTeteView = {
  i: 'KB',
  bg: '#E0733A',
  proposant: 'Kofi Boateng',
  delai: '3 j',
  delaiLong: '3 jours restants',
  /**
   * ⚠ DEUX PLANCHES, DEUX PHRASES, ET C'EST RELEVÉ : à 390 px la carte repliée
   * écrit un résumé (« Section 1 · retrait “ou votre contrat de travail” »), à
   * 1 440 px la seconde carte écrit un vrai motif (« Le contrat de travail ne
   * suffit plus pour un étudiant. »). Les deux cadres lisent la MÊME prise, qui
   * porte `reason` ; la valeur de maquette retenue ici est celle de 390 px, parce
   * que c'est le cadre où la carte est vraiment repliée.
   */
  motif: 'Section 1 · retrait « ou votre contrat de travail »',
  decidable: false,
  onAccepter: () => undefined,
  onAmender: () => undefined,
  onRefuser: () => undefined,
};

/**
 * Les compteurs des trois onglets.
 *
 * Ils sont DÉRIVÉS de la liste par statut — `GET /guides/:id/proposals` ne porte
 * aucun `meta` de comptage, vérifié sur `guideProposalsResponseSchema`. « Refusées »
 * n'en porte pas dans la maquette : on ne lui en invente pas un.
 */
export interface PropositionsCompteView {
  readonly attente: number;
  readonly acceptees: number;
}

export const propositionsCompte: PropositionsCompteView = { attente: 2, acceptees: 7 };

/**
 * Le guide que la page vise : son titre, et son adresse.
 *
 * `href` EST ARRIVÉE AVEC LA PAGE DES SIGNALEMENTS, et elle ne sert pas qu'à elle :
 * les deux pages de A06 sont des pages FILLES du guide, et leurs trois retours —
 * fil d'Ariane, « Voir le guide », chevron de 390 px — étaient deux `href="#"` et
 * un `<span>` inerte. Voir `A06_RETOUR_GUIDE`, qui les pose sur les quatre cadres
 * où elle les trouve.
 *
 * ⚠ ELLE PORTE LE SLUG, PAS L'IDENTIFIANT : §2.1 fige le slug à la publication
 * (« jamais modifié ») précisément pour que l'adresse d'un guide reste bonne.
 */
export interface GuideCorrigeView {
  readonly title: string;
  readonly href: string;
}

export const guide: GuideCorrigeView = {
  title: 'Obtenir la garantie Visale sans CDI',
  /** Le slug dérivé du titre de la planche — la valeur de la maquette, comme lui. */
  href: '/guides/obtenir-la-garantie-visale-sans-cdi',
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES PRISES DE LA PAGE « SIGNALEMENTS “A CHANGÉ” »                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, revenant sur son arbitrage de la veille : « Il faut faire ceci,
 * l'auteur doit voir les signalements "a changé". » Ce qui RESTE du précédent,
 * c'est l'ANONYMAT : « Les signalants resteront anonymes. »
 *
 * CETTE PAGE N'EST DESSINÉE PAR AUCUNE PLANCHE. Elle emprunte les deux cadres de
 * « Propositions reçues » — même rôle, la page où l'AUTEUR relit ce que ses
 * lecteurs disent de son guide — et le grand en-tête de
 * `tools/screens/03-accueil.mjs` écrit ce qui a été remplacé et par quoi.
 *
 * ── CE QUE CHAQUE PRISE PORTE, ET D'OÙ ELLE VIENT ──────────────────────────
 *
 *   `titre`   → « Signalements « a changé » », le libellé que la carte d'auteur de
 *               A04 dessine à 1 440 px. EMPRUNTÉ, pas rédigé.
 *   `libelle` → le même, en petites capitales : c'est la convention de TOUS les
 *               titres de section de ce dossier (« HISTORIQUE DES VERSIONS »,
 *               « COMMUNAUTÉ », « VOS RACCOURCIS »), et le style de la rangée
 *               empruntée l'exige (10,5 px, `letterSpacing: 1px`).
 *   `compte`  → la pastille d'onglet, « 3 signalements ». L'ACCORD vient de
 *               `from-api.ts`, à côté du nombre qu'il accorde — jamais d'un
 *               ternaire écrit dans un cadre.
 *   `aide`    → la carte « COMMENT ÇA MARCHE » de la colonne de droite. Celle de
 *               la maquette explique le délai de 14 jours des PROPOSITIONS ; sur
 *               cette page elle doit expliquer le seuil de §2.6.
 *   `items`   → la liste, par date décroissante.
 *
 * ── CE QUE `items` NE PORTE PAS, ET C'EST LE POINT ─────────────────────────
 *
 * Ni nom, ni pseudo, ni initiales, ni couleur d'avatar, ni identifiant. La route
 * ne les rend pas (`guideOutdatedFlagsResponseSchema` est `.strict()` et ne
 * déclare que `createdAt` et `comment`), et le dessin ne les demande pas : la
 * rangée empruntée est « une pastille, une ligne, une sous-ligne ». `dot` est une
 * COULEUR DE DESSIN, pas une identité — la même pour toutes les lignes.
 */
export interface SignalementRowView {
  /** La pastille de la rangée empruntée. Une couleur, jamais une identité. */
  readonly dot: string;
  /** La date du signalement — la ligne en gras. */
  readonly quand: string;
  /**
   * CE QUI A ÉTÉ DIT — ou les mots du produit quand rien ne l'a été.
   *
   * Le commentaire est FACULTATIF à la saisie (1 à 500 caractères,
   * `guideOutdatedFlagSchema`), donc un signalement sans commentaire est un cas
   * NORMAL. Laisser la sous-ligne vide aurait dessiné une rangée à moitié rendue,
   * ce qui se lit comme un défaut d'affichage — le même défaut que le « — » seul
   * sous le titre d'un guide sans contributeur, que ce module a déjà corrigé.
   */
  readonly dit: string;
}

export interface SignalementsView {
  readonly titre: string;
  readonly libelle: string;
  readonly compte: string;
  readonly aide: string;
  readonly items: readonly SignalementRowView[];
}

/**
 * CE QUE LA PAGE MONTRE AVANT LA RÉPONSE DE L'API.
 *
 * ⚠ CE N'EST PAS « LE DESSIN DE LA MAQUETTE », contrairement à `propositionDepliee`
 * et à ses sœurs : la maquette ne dessine PAS cette page, donc il n'y a aucune
 * valeur de planche à servir. On montre donc l'attente, et rien qui ressemble à une
 * donnée — un « 0 signalement » affiché le temps d'un aller-retour serait un
 * chiffre faux sur la page d'un guide contesté.
 */
export const signalements: SignalementsView = {
  titre: 'Signalements « a changé »',
  libelle: 'SIGNALEMENTS « A CHANGÉ »',
  compte: '…',
  aide: '',
  items: [],
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES PRISES DU PANNEAU « PROPOSER UNE CORRECTION »                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Oui il faut le faire et le brancher au modal au niveau de
 * proposer une correction. Ça affiche une page mais c'est un modal qui s'affiche à
 * droite. »
 *
 * CE QUE CET EN-TÊTE DISAIT PLUS HAUT, ET QUI N'EST PLUS VRAI : « ENVOYER.
 * `createProposal` existe mais le formulaire de la maquette — passage visé,
 * remplacement, motif, source — est du balisage statique : aucun de ses champs n'a
 * de prise, donc rien à lire au clic. […] il faut que la planche pose ses
 * marqueurs, puis une régénération. » C'est fait : `A06_PANNEAU_CORRECTION`
 * (`tools/generate-screens.mjs`) transforme les quatre blocs dessinés en vrais
 * champs, et `regions:` sort le voile et le panneau dans leur propre fichier pour
 * qu'ils se montent par-dessus la page du guide.
 *
 * ── LES QUATRE CHAMPS, ET LEUR CONTRAT CÔTÉ SERVEUR ───────────────────────
 *
 *   `passage`       → `targetExcerpt` — EN LECTURE SEULE. §2.4 : « le passage visé
 *                     est COPIÉ TEL QUEL depuis la version courante : le proposant
 *                     ne le retouche pas, sinon le serveur ne pourrait plus le
 *                     retrouver. » Au moins trois caractères.
 *   `remplacement`  → `replacement` — jusqu'à `GUIDE_BODY_MAX`. Le VIDE est licite :
 *                     c'est un retrait de passage, et §2.4 le prévoit.
 *   `motif`         → `reason` — OBLIGATOIRE, au moins `GUIDE_PROPOSAL_REASON_MIN`
 *                     (20) caractères. C'est lui qui éteint le bouton.
 *   `source`        → `sourceUrl` — facultatif, et validé par `z.string().url()` :
 *                     une chaîne vide n'est PAS envoyée, elle est omise.
 *
 * ── `accuse` : LA COLONNE « APRÈS ENVOI » DE LA MAQUETTE ──────────────────
 *
 * `null` avant envoi. La maquette dessine la phrase hors du cadre, dans sa colonne
 * d'annotation : « Proposition envoyée à Marc K. Vous serez prévenu·e de sa
 * réponse. » Le nom est celui du VRAI auteur du guide ; faute d'auteur (un guide
 * anonymisé en garde le droit, §8), la phrase se réduit à l'essentiel plutôt que
 * de nommer personne.
 */
export interface CorrectionPanneauView {
  /** Le passage visé, copié tel quel depuis le corps. Lecture seule. */
  readonly passage: string;
  readonly remplacement: string;
  readonly onRemplacement: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  readonly motif: string;
  readonly onMotif: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  readonly source: string;
  readonly onSource: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Faux tant que le motif n'atteint pas son plancher, ou pendant l'envoi. */
  readonly peutEnvoyer: boolean;
  readonly onEnvoyer: () => void;
  readonly onFermer: () => void;
  /** `null` avant envoi : l'encart sombre de la colonne « APRÈS ENVOI ». */
  readonly accuse: string | null;
}

/**
 * LE DESSIN DE LA MAQUETTE, pour le rendu serveur et pour la page de A06 avant
 * qu'elle ait son guide. Les trois textes sont ceux de la planche.
 */
export const correction: CorrectionPanneauView = {
  passage: "quel que soit leur pays d'origine, dès l'obtention du VLS-TS",
  remplacement:
    "quel que soit leur pays d'origine, dès la validation du VLS-TS sur le site de l'ANEF",
  onRemplacement: () => undefined,
  motif: 'La validation en ligne est obligatoire depuis 2025.',
  onMotif: () => undefined,
  source: '',
  onSource: () => undefined,
  peutEnvoyer: false,
  onEnvoyer: () => undefined,
  onFermer: () => undefined,
  accuse: null,
};

export interface A06Data {
  rail: typeof rail;
  panelGuides: typeof panelGuides;
  shortcuts: typeof shortcuts;
  guide: GuideCorrigeView;
  propositionDepliee: PropositionEnTeteView;
  propositionRepliee: PropositionEnTeteView;
  propositionsCompte: PropositionsCompteView;
  /**
   * Lue par les deux cadres « Signalements » SEULS. Les quatre autres ne la lisent
   * pas — même marché que `correction` et `guide` : les six cadres de la section
   * partagent une signature.
   */
  signalements: SignalementsView;
  /**
   * Lue par les deux cadres « Corriger » SEULS. Les deux cadres « Propositions
   * reçues » ne la lisent pas — ils ne dessinent pas le panneau — mais les quatre
   * partagent une signature, comme `guide` déjà au-dessus.
   */
  correction: CorrectionPanneauView;
}
