/**
 * Données de l'écran A05 — l'éditeur de guide.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUI SUIT A ÉTÉ ÉCRIT QUAND LE CADRE N'AVAIT QUE DEUX PRISES            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ⚠ L'EN-TÊTE CI-DESSOUS EST CONSERVÉ PARCE QU'IL DISAIT JUSTE, et qu'il disait
 * aussi quoi faire. Il n'est plus l'état des lieux : `A05_EDITEUR`, dans
 * `tools/generate-screens.mjs`, a fait le transcodage qu'il réclamait, et la
 * prise `editeur` déclarée au bas de ce fichier porte les champs. Lire les deux :
 * celui-ci dit POURQUOI c'était bloqué, celui-là dit ce qui a été fait.
 *
 * ── CE CADRE N'AVAIT QUE DEUX PRISES, ET IL FALLAIT DIRE POURQUOI ──────────
 *
 * L'éditeur de la maquette dessine son brouillon dans un `<pre>` dont le contenu
 * est ÉCRIT EN DUR. Le transcodeur l'a donc reproduit tel quel dans
 * `*.generated.tsx` : ni le titre, ni le corps, ni la catégorie, ni la portée ne
 * sont des prises. Les deux seules que le cadre lit sont la barre d'outils
 * Markdown et le rappel des règles — c'est-à-dire l'habillage, pas le texte.
 *
 * Brancher l'éditeur demande donc que la maquette pose des marqueurs de données
 * sur son `<pre>` et sur ses champs, puis une régénération. C'est du transcodage,
 * pas du branchement, et un fichier `*.generated.tsx` ne se modifie pas à la main :
 * la régénération l'effacerait. Remonté au rapport de lot.
 *
 * Ce qui EST fait ici : le module d'appel (`screens/guides/api.ts`) porte déjà
 * `createDraft`, `updateGuide` et `publishGuide`, validés par les schémas de
 * `@app/shared` — de sorte que le jour où le cadre expose ses champs, il ne reste
 * qu'à les relier.
 */

import type { ReactNode } from 'react';

// ─── LES PRISES DU CADRE, DÉCLARÉES ─────────────────────────────────────────

/**
 * La barre d'outils Markdown. Des CHAÎNES : le cadre écrit `{t}` directement.
 *
 * Elle correspond au Markdown RESTREINT de §2.1 — gras, italique, listes, liens,
 * et `H` pour les titres de niveau 2 et 3.
 *
 * ⚠ CE COMMENTAIRE DISAIT « Pas d'image : `restrictedMarkdownIssue` les refuse,
 * les guides n'ayant pas de table de médias ». IL EST PÉRIMÉ, et le corriger
 * valait mieux que le laisser : `guide_media` existe, `POST /media` accepte
 * `kind=GUIDE`, et `restrictedMarkdownIssue` ne refuse plus LES IMAGES mais les
 * images EXTERNES (`IMAGE_EXTERNAL`) — une image déposée par le pipeline, écrite
 * `![légende](/media/<clé>)`, est acceptée. Le BOUTON d'image n'est pas dans
 * cette liste pour autant, et c'est voulu : la maquette le dessine à part, en
 * icône, hors de la boucle des six marques (barre basse du cadre de 390 px).
 */
export const mdTools: readonly string[] = ['H', 'B', 'I', '•', '1.', 'Lien'];

/**
 * Les trois règles d'écriture, rappelées à l'endroit où l'on écrit.
 *
 * Ce ne sont pas des décorations. La première est une RÈGLE DURE (§2.1) que le
 * serveur applique avec un code d'erreur propre, `FORBIDDEN_WORD` : le mot
 * « certifié » est rejeté dans un titre, parce que la plateforme ne vérifie aucun
 * dossier administratif et qu'un guide « certifié » le laisserait croire.
 *
 * Elles restent des CHAÎNES de la maquette et non des libellés d'API : aucune
 * route ne les renvoie. Si le produit changeait une de ces règles, l'écran ne le
 * saurait pas — remonté.
 */
export const rules: readonly string[] = [
  'Pas de mot « certifié »',
  'Pas de numéro, email ou adresse personnelle',
  'Citez vos sources quand c’est possible',
];

/** Ce que les deux cadres générés de A05 consomment. */
export interface A05Data {
  mdTools: readonly string[];
  rules: readonly string[];
  /**
   * ⚠ PAS FACULTATIVE : les deux cadres DÉRÉFÉRENCENT (`editeur.titre`,
   * `editeur.onPublier`). Une prise facultative obligerait le JSX produit à
   * écrire `editeur?.titre` — un éditeur silencieusement inerte le jour où une
   * page oublie la prise.
   */
  editeur: EditeurGuideView;
}

// ─── CE QUE LE LOT SUIVANT A AJOUTÉ : L'ÉDITEUR EST DEVENU UN ÉDITEUR ───────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « LES PAGES ÉCRIRE UN GUIDE EST FINALISÉ ? » — ELLE L'EST MAINTENANT       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * L'EN-TÊTE DE CE FICHIER DISAIT VRAI, et il disait aussi quoi faire : « Brancher
 * l'éditeur demande que la maquette pose des marqueurs de données sur son `<pre>`
 * et sur ses champs, puis une régénération. C'est du transcodage, pas du
 * branchement. » C'est ce transcodage, et il est fait par `A05_EDITEUR` dans
 * `tools/generate-screens.mjs` — aucun `.generated.tsx` n'a été touché à la main.
 *
 * MESURÉ AVANT : les deux cadres portaient 0 `<input>`, 0 `<textarea>`,
 * 0 `onClick`. MESURÉ APRÈS : douze repères `data-a05-*` sur l'ordinateur, douze
 * sur le téléphone.
 */

/** Une option d'un des trois choix. Même forme que les filtres de A03. */
export interface OptionEditeur {
  readonly valeur: string;
  readonly libelle: string;
}

/**
 * Ce que l'éditeur lit et ce qu'il appelle.
 *
 * ── POURQUOI `…Libelle` EXISTE À CÔTÉ DE LA VALEUR ─────────────────────────
 *
 * La maquette écrit la valeur CHOISIE dans sa boîte — « Catégorie : Études »,
 * « Bénin », « Ville ▾ » — et le `<select>` qui la commande est transparent,
 * posé par-dessus (l'idiome que les filtres de A03 emploient déjà, « pour que le
 * dessin reste celui de la maquette »). Le texte visible est donc rendu par le
 * cadre, à part de la valeur qui part à l'API : deux prises pour un choix.
 *
 * ── POURQUOI LA PORTÉE ET LE PAYS NE FONT QU'UNE PRISE ─────────────────────
 *
 * `createGuideSchema` demande DEUX champs — `scope` (`UNIVERSAL` | `COUNTRY`) et
 * `originCountryId`, obligatoire quand la portée est nationale
 * (`countryScopeCoherent`, et la contrainte `guides_country_scope` en base). La
 * maquette, elle, dessine UNE boîte et y écrit « Portée : Bénin ».
 *
 * On suit la maquette : la prise porte `UNIVERSAL` ou L'IDENTIFIANT DU PAYS, et
 * le convertisseur en déduit les deux champs. C'est le même choix que
 * `scopeLabel` fait déjà en LECTURE — « La maquette met “Bénin” et non “Pays” […]
 * dire de quel pays il s'agit vaut mieux que dire qu'il y en a un » — et il tient
 * dans les deux sens.
 */
export interface EditeurGuideView {
  readonly titre: string;
  readonly onTitre: (e: { target: { value: string } }) => void;
  /** `GUIDE_TITLE_MAX`, du serveur — jamais un nombre écrit dans le front. */
  readonly titreMax: number;

  readonly categorie: string;
  readonly categorieLibelle: string;
  readonly categorieOptions: readonly OptionEditeur[];
  readonly onCategorie: (e: { target: { value: string } }) => void;

  /** `UNIVERSAL`, ou l'identifiant du pays. Voir l'en-tête. */
  readonly portee: string;
  readonly porteeLibelle: string;
  readonly porteeOptions: readonly OptionEditeur[];
  readonly onPortee: (e: { target: { value: string } }) => void;

  /** La ville est FACULTATIVE : la chaîne vide dit « aucune ». */
  readonly ville: string;
  readonly villeLibelle: string;
  /**
   * LA FORME COURTE, pour la pastille de 390 px : la planche y écrit « Ville »
   * là où celle d'ordinateur écrit « Ville (facultatif) ». Deux prises parce que
   * les deux planches écrivent deux textes — relevé sur les octets.
   */
  readonly villeLibelleCourt: string;
  readonly villeOptions: readonly OptionEditeur[];
  readonly onVille: (e: { target: { value: string } }) => void;

  readonly corps: string;
  readonly onCorps: (e: { target: { value: string } }) => void;
  /** `GUIDE_BODY_MAX`, du serveur. */
  readonly corpsMax: number;

  /**
   * L'APERÇU, RENDU — pas une chaîne.
   *
   * C'est `CorpsGuide` qui le compose, la MÊME grammaire que la page du guide
   * publié : un aperçu qui ne rendrait pas comme la page serait un aperçu qui
   * mentirait. Les deux planches en reçoivent chacune la leur, aux valeurs de
   * dessin de leur largeur.
   */
  readonly apercu: ReactNode;
  /**
   * LE SEGMENT « ÉCRIRE / APERÇU » N'EXISTE QUE SUR LE TÉLÉPHONE : la planche
   * d'ordinateur montre les deux côte à côte, dans deux colonnes. La prise est
   * donc lue par un seul des deux cadres, et c'est la maquette qui le décide.
   */
  readonly apercuOuvert: boolean;
  readonly onApercu: (ouvert: boolean) => void;

  /**
   * « Brouillon enregistré · il y a 4 s » — la phrase de la planche
   * d'ORDINATEUR, délai compris. VIDE quand il n'y a rien à dire : avant le
   * premier enregistrement, il n'y a pas de brouillon.
   */
  readonly brouillon: string;
  /**
   * La MÊME chose sur 390 px, où la maquette écrit « Brouillon enregistré » SANS
   * délai. Deux prises et non une : une prise unique aurait écrit un délai sur
   * une planche qui ne le dessine pas.
   */
  readonly brouillonCourt: string;

  readonly peutPublier: boolean;
  /** POURQUOI le bouton est éteint. Voir `A05_EDITEUR` pour l'exigence du porteur. */
  readonly motifPublier: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE MOT DU BOUTON D'ACTION — « Publier », OU « Enregistrer »               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * LA MAQUETTE N'ÉCRIT QUE « Publier », sur les deux planches, et elle a raison
   * pour l'écran qu'elle dessine : un brouillon qu'on publie. Elle ne dessine PAS
   * la reprise d'un guide déjà paru — c'est l'écart remonté par le lot qui a
   * ouvert `/guides/:slug/modifier`.
   *
   * CE MOT EST DONC UNE PRISE et non un texte transcodé, pour la raison mesurée
   * côté serveur : `POST /guides/:id/publish` refuse un guide `PUBLISHED` en
   * `409 ALREADY_PUBLISHED`. Un bouton « Publier » sur un guide en ligne n'aurait
   * eu qu'un seul effet possible — une erreur — alors que le geste utile existe
   * et est déjà complet : `PATCH /guides/:id` ajoute une version et la rend
   * courante (§2.7, historique en AJOUT SEUL), donc la nouvelle version paraît.
   *
   * ⚠ SUR `/guides/nouveau`, LA VALEUR EST « Publier » : le rendu est octet pour
   * octet celui d'avant la prise.
   */
  readonly publierLibelle: string;
  readonly onPublier: () => void;

  readonly onFermer: () => void;
  /** Une marque de la barre d'outils — « H », « B », « • », « Lien »… */
  readonly onOutil: (marque: string) => void;
  readonly onImage: (e: { target: { files: FileList | null; value: string } }) => void;
  readonly imageOccupe: boolean;

  /**
   * « Une section par étape de “Mes études à Lyon” a été pré-remplie » (carte
   * ambre sur l'ordinateur, bandeau orange sur le téléphone).
   *
   * ⚠ `null` AUJOURD'HUI, TOUJOURS, et c'est dit plutôt que masqué :
   * `POST /journeys/:id/to-guide` existe et `api.ts` l'appelle déjà
   * (`draftFromJourney`), mais la maquette n'offre AUCUN geste pour choisir le
   * parcours de départ — elle dessine le résultat, pas le sélecteur. La carte
   * disparaît donc, au lieu d'affirmer un pré-remplissage qui n'a pas eu lieu.
   * REMONTÉ : il manque une planche « choisir le parcours de départ ».
   */
  readonly parcours: string | null;

  // ── Les pages du guide (décision du porteur) ──────────────────────────────

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA CARTE DES PAGES — « LA POSSIBILITÉ D'AJOUTER LES PAGES OU D'EN RETIRER » ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « dans le processus de création "Créer un guide" il faut au
   * niveau de la side bar la possibilité d'ajouter les pages ou d'en retirer,
   * pour l'auteur bien sûr. »
   *
   * `pagesTitre` EST UNE PRISE ET NON UN LITTÉRAL DU CADRE, pour la raison que
   * `A05_PAGES` écrit : le titre de cette carte est du TEXTE DE PRODUIT, et le
   * transcodeur n'écrit pas d'interface. Il vit avec les autres phrases de
   * l'éditeur, dans `use-editeur-guide.ts`.
   */
  readonly pagesTitre: string;
  readonly pages: readonly PageEditeurView[];
  /** « Ajouter une page » — le libellé emprunté dit « une étape personnelle ». */
  readonly ajouterLibelle: string;
  readonly onAjouterPage: () => void;
  /** `GUIDE_PAGE_TITLE_MAX`, du serveur — jamais un nombre écrit dans le front. */
  readonly pageTitreMax: number;
}

/**
 * UNE LIGNE DE LA CARTE DES PAGES.
 *
 * ⚠ `titre` EST DANS UN CHAMP, ET LE CHAMP PORTE DEUX GESTES. La maquette ne
 * dessine qu'une prise par ligne, et une page en demande deux — être choisie,
 * être renommée. Le FOCUS choisit (`onChoisir`), la FRAPPE renomme (`onTitre`).
 * Le pourquoi complet est dans l'en-tête de `A05_PAGES`.
 *
 * `bord` porte l'une des DEUX bordures que la carte empruntée dessine :
 * `1px solid #E6EBE9` au repos, `1.5px solid #16785E` sur la page en cours
 * d'écriture. Aucune couleur n'est inventée — ce sont celles de la planche.
 */
export interface PageEditeurView {
  readonly id: string;
  readonly titre: string;
  readonly bord: string;
  readonly onTitre: (e: { target: { value: string } }) => void;
  readonly onChoisir: () => void;
  readonly onRetirer: () => void;
}
