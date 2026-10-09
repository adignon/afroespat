/**
 * A14 — créer une story. LES PRISES DÉCLARÉES, ET LA CHARGE QUI PART.
 *
 * Cinq cadres, qui sont les ÉTATS d'un même écran : « 1 · Écrire », sa variante
 * photo, « 2 · Rattacher », « 3 · Publier », et la fenêtre sombre d'ordinateur qui
 * porte les trois étapes.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LE LOT PRÉCÉDENT AVAIT ÉCRIT ICI, ET POURQUOI C'ÉTAIT FAUX          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Cet en-tête disait : « CE CADRE N'A AUCUN CHAMP DE SAISIE. Compté sur les cinq
 * cadres — zéro `<textarea>`, zéro `<input>`, zéro `contentEditable` », et en
 * concluait que `POST /stories` ne pouvait pas être appelé. LE COMPTAGE ÉTAIT
 * JUSTE ET LA CONCLUSION FAUSSE : il comptait des BALISES là où il fallait lire
 * une INTENTION. La maquette dessine bien un champ, trois fois :
 *
 *   · le panneau d'ordinateur écrit « Texte » en étiquette, puis une boîte
 *     `border:1.5px solid #16785E` à `min-height:96px`, et SOUS elle « 118 / 280 ».
 *     Étiquette, hauteur minimale, compteur de caractères : c'est un champ, et il
 *     n'y a rien d'autre que cela puisse être ;
 *   · le compteur est dessiné TROIS fois, et son plafond — 280 — est EXACTEMENT
 *     `FEED_LIMITS.storyBodyMax`. On ne compte pas les caractères d'un texte qu'on
 *     ne peut pas taper. Mieux : il annonce « 118 » alors que le littéral qu'il
 *     accompagne fait 80 caractères, donc il ne compte RIEN — c'est une valeur
 *     d'exemple, ce qui achève de dire que la zone est un champ déjà rempli ;
 *   · un caret est dessiné à la fin du corps (un `<span>` de 3 × 32 px). Un caret
 *     ne se dessine que dans un champ.
 *
 * Le porteur a tranché dans ce sens : « Le template il faut surtout analyser et
 * remplacer les sections de saisie mal faites en saisi input », et « tu dois
 * t'inspirer de l'idée dans les maquettes pour bien les finaliser ». Les quatre
 * zones sont donc devenues des `<textarea>` — par le TRANSCODEUR, jamais à la main
 * dans un `*.generated.tsx` : voir le bloc « A14 — LE CORPS DE LA STORY DEVIENT
 * UNE VRAIE SAISIE » de `tools/generate-screens.mjs`, qui explique aussi pourquoi
 * un `<textarea>` et non un `contentEditable` (le caret dessiné y serait du
 * contenu effaçable ; remplacé, il laisse place à un VRAI caret).
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PALETTE DE LA MAQUETTE ET CELLE DU SERVEUR N'ONT AUCUNE COULEUR COMMUNE ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * C'EST L'ÉCART LE PLUS SÉRIEUX DE CE LOT, et il demande un arbitrage du porteur.
 * Mesuré, pas supposé — les deux listes ont sept entrées et leur intersection est
 * VIDE :
 *
 *   maquette (`PALETTE`, `screens/accueil/data.ts`, les sept pastilles dessinées) :
 *     #16785E · #0F5C48 · #E0733A · #1F2A44 · #6B4A34 · #16211D · #5B3F8C
 *   serveur (`STORY_BACKGROUND_COLORS`, `@app/shared`, liste FERMÉE) :
 *     #1B4332 · #2D6A4F · #B7791F · #9C2A2A · #1D3557 · #5B3A70 · #22333B
 *
 * `createStorySchema` applique `z.enum(STORY_BACKGROUND_COLORS)` : envoyer la
 * teinte dessinée ferait donc échouer CHAQUE publication, en `400`. Les trois
 * issues, et pourquoi celle-ci :
 *
 *   · ÉCLAIRCIR OU ASSOMBRIR une teinte pour la faire coïncider — INTERDIT par le
 *     porteur, et de toute façon aucune ne coïnciderait ;
 *   · ALIGNER `STORY_BACKGROUND_COLORS` sur la maquette — ce serait l'issue
 *     JUSTE : le commentaire de cette constante dans `@app/shared` justifie
 *     qu'elle soit FERMÉE (« sans liste fermée côté serveur n'importe quelle
 *     valeur y entrerait ») mais ne cite AUCUNE source pour ses sept valeurs,
 *     alors que la maquette, elle, dessine les siennes. C'est donc le serveur qui
 *     a deviné. Mais c'est une colonne de base et un schéma partagé : le changer
 *     est un arbitrage du porteur, pas d'un lot d'écran. REMONTÉ ;
 *   · APPARIER les deux listes, ce que fait `STORY_BACKGROUND_FOR_PALETTE`
 *     ci-dessous — la publication marche aujourd'hui, aucune couleur n'est
 *     inventée ni retouchée, et le jour où le porteur aligne les listes cette
 *     table disparaît d'un bloc.
 *
 * L'APPARIEMENT EST CALCULÉ, PAS CHOISI À L'ŒIL : affectation un-à-un qui minimise
 * la somme des écarts perceptuels (ΔE en CIELAB), par énumération des 5040
 * permutations. Somme optimale 114,0 contre 258,2 pour un appariement naïf par
 * indice — donc l'ordre des deux listes ne se correspond PAS, et s'y fier aurait
 * donné du violet pour du noir et du gris pour du violet.
 *
 * Écarts par pastille, dans l'ordre de la palette dessinée :
 *   8,6 · 12,8 · 22,5 · 7,3 · 36,9 · 12,1 · 14,0
 *
 * SIX DES SEPT RESTENT DANS LEUR FAMILLE (vert→vert, bleu→bleu, violet→violet).
 * LA SEPTIÈME NE L'EST PAS, et il faut le dire : le brun #6B4A34 n'a aucun
 * équivalent côté serveur et tombe sur le rouge #9C2A2A (ΔE 36,9) — c'est la
 * teinte qui reste quand les six autres sont placées. Un membre qui choisit le
 * brun verra sa story publiée en rouge sombre. DÉFAUT VISIBLE, ASSUMÉ, REMONTÉ :
 * il disparaît dès que les deux listes sont alignées.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUI NE PART PAS, ET QU'IL FAUT LIRE COMME UN MANQUE REMONTÉ             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La charge envoyée ne porte que SIX champs, et c'est une décision : on n'envoie
 * QUE ce qu'un contrôle réel de l'écran détermine. Les cinq autres champs que
 * `createStorySchema` accepte sont facultatifs et ne sont pas envoyés, chacun pour
 * une raison mesurée :
 *
 *   · `stepDefinitionId` — l'étape 2 dessine bien une liste « MON PARCOURS », mais
 *     ses trois entrées sont des `<div>` SANS gestionnaire et SANS identifiant :
 *     `attachSteps` est de la donnée d'exemple écrite en dur (« Étape 7 ·
 *     Logement »), pas une liste venue de l'API. Envoyer un identifiant inventé
 *     serait pire que ne rien envoyer ;
 *   · `category` — même chose pour les « SUJETS » (`attachTopics` : Visale,
 *     Garant, CAF…). Ce ne sont pas les valeurs de `STORY_SUBJECTS`
 *     (DEMARCHES, LOGEMENT…) : « Visale » est un dispositif, pas un sujet. Les
 *     faire correspondre demanderait de décider d'une table de traduction ;
 *   · `validUntil` — l'étape 3 écrit « 24 heures » en littéral et la maquette ne
 *     dessine AUCUN contrôle pour le changer. Rien à brancher ;
 *   · `placeLabel`, `backgroundAssetId` — aucun contrôle dessiné non plus (le
 *     bouton « Photo » bascule une variante d'aperçu, il ne téléverse rien) ;
 *   · `cityId` — volontairement OMIS, pour retomber sur la ville du membre, comme
 *     le schéma le prévoit. Un membre SANS ville reçoit `INVALID_ATTACHMENT`, et
 *     l'écran l'affiche au lieu d'échouer en silence.
 *
 * ET LA POSITION DU CALQUE NE PART PAS NON PLUS. `createStorySchema` est
 * `.strict()` et aucun de ses champs n'exprime une position : on déplace le texte
 * pendant la composition, la story publiée le rend là où A13 le dessine. Le champ
 * qui manquerait est une position relative du calque — deux nombres, en
 * pourcentage du cadre. REMONTÉ, pas masqué.
 */
import type { ReactNode } from 'react';
import {
  FEED_LIMITS,
  STORY_BACKGROUND_COLORS,
  STORY_SUBJECTS,
  STORY_SUBJECT_LABELS,
  StoryAudience,
  StoryTextStyle,
  StoryType,
  createStorySchema,
  type CreateStory,
  type JourneyTemplate,
  type JourneyTemplateStep,
  type StorySubject,
} from '@app/shared';

export {
  audienceFor,
  msgsFor,
  paletteFor,
  storyKindsFor,
  webFrameFor,
  webKindFor,
  webKindsFor,
  webPaletteFor,
  webPillFor,
  writeBgFor,
} from '../accueil/data';

import type {
  audienceFor,
  paletteFor,
  storyKindsFor,
  webFrameFor,
  webKindsFor,
  webPaletteFor,
} from '../accueil/data';

/** La borne du corps, LUE de `@app/shared` et jamais recopiée. */
export const STORY_BODY_MAX = FEED_LIMITS.storyBodyMax;

/**
 * L'appariement mesuré entre les sept pastilles DESSINÉES et les sept couleurs que
 * le serveur accepte. Voir l'en-tête : calculé par minimisation du ΔE total, et
 * destiné à disparaître le jour où les deux listes sont alignées.
 *
 * L'index est celui de `PALETTE` dans `screens/accueil/data.ts` — c'est-à-dire
 * l'ordre dans lequel la maquette dessine ses pastilles, de gauche à droite.
 */
export const STORY_BACKGROUND_FOR_PALETTE = [
  STORY_BACKGROUND_COLORS[1], // #16785E vert   → #2D6A4F  ΔE  8,6
  STORY_BACKGROUND_COLORS[0], // #0F5C48 vert   → #1B4332  ΔE 12,8
  STORY_BACKGROUND_COLORS[2], // #E0733A orange → #B7791F  ΔE 22,5
  STORY_BACKGROUND_COLORS[4], // #1F2A44 bleu   → #1D3557  ΔE  7,3
  STORY_BACKGROUND_COLORS[3], // #6B4A34 brun   → #9C2A2A  ΔE 36,9 ← le seul hors famille
  STORY_BACKGROUND_COLORS[6], // #16211D noir   → #22333B  ΔE 12,1
  STORY_BACKGROUND_COLORS[5], // #5B3F8C violet → #5B3A70  ΔE 14,0
] as const;

/**
 * Le type de story choisi, de l'index de l'onglet vers l'énumération du serveur.
 *
 * L'ORDRE EST CELUI DE LA MAQUETTE, et il coïncide avec celui de `StoryType` :
 * elle écrit « Conseil · Découverte · Information » (`STORY_KINDS`), le serveur
 * énumère `CONSEIL · DECOUVERTE · INFORMATION`. La coïncidence est VÉRIFIÉE par
 * `nouvelle-story.test.ts`, pour qu'un ajout de type d'un côté ne se traduise pas
 * en silence par le mauvais type de l'autre.
 */
export const storyTypeFor = (kind: number): (typeof StoryType)[number] =>
  StoryType[kind] ?? StoryType[0];

/**
 * L'audience, de l'index de l'onglet vers l'énumération du serveur.
 *
 * La maquette écrit « Tous les membres » puis « Lyon seulement » ; `StoryAudience`
 * énumère `ALL` puis `CITY`. Même ordre, même sens — « Lyon » étant la ville
 * pilote, « Lyon seulement » est bien la portée VILLE et non une ville nommée.
 */
export const storyAudienceFor = (aud: number): (typeof StoryAudience)[number] =>
  StoryAudience[aud] ?? StoryAudience[0];

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE STYLE DE TEXTE N'EST PLUS UNE CONSTANTE — ET C'ÉTAIT UN VRAI MANQUE     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * CE QUE CE FICHIER DISAIT, ET POURQUOI C'ÉTAIT INSUFFISANT. Il posait
 * `STORY_TEXT_STYLE = 'BOLD'` et l'expliquait ainsi : « elle ne dessine aucune
 * planche montrant le corps en SERIF ni en MONO. Il n'y a donc rien à brancher et
 * rien à choisir ». Le constat sur les planches est juste ; la conclusion ne suit
 * pas. La maquette dessine un bouton « Aa · Gras », `StoryTextStyle` énumère trois
 * valeurs et `createStorySchema.textStyle` les EXIGE : le champ existe de bout en
 * bout, et c'est le composeur qui ne s'en servait pas. Le porteur l'a mesuré
 * lui-même dans son navigateur — « Les actions sur la texte […] ne marche pas.
 * Centré, gras ».
 *
 * ── LES DEUX LIBELLÉS QUI NE VIENNENT PAS DE LA MAQUETTE, DÉCLARÉS ──────────
 *
 * « Gras » est le mot que la maquette ÉCRIT. « Serif » et « Mono » ne sont écrits
 * nulle part : ce sont les valeurs de `StoryTextStyle` en capitale initiale, donc
 * recopiées du SERVEUR et non choisies. C'est le moindre mal entre les trois
 * possibilités, et il faut dire pourquoi :
 *
 *   · laisser le bouton inerte — c'est ce qu'il y avait, et le porteur l'a trouvé
 *     mort ;
 *   · n'offrir que `BOLD` — un bouton à une seule valeur, donc toujours inerte ;
 *   · afficher la valeur du serveur — on ne décide d'aucun mot de produit, et le
 *     jour où `T2 textes-interface` les nomme, cette table change d'une ligne.
 *
 * REMONTÉ. Et `nouvelle-story.test.ts` ancre la correspondance, pour qu'une valeur
 * ajoutée au serveur n'affiche pas en silence le libellé d'une autre.
 */
/**
 * LES TROIS VALEURS, SOUS LE NOM QUE CET ÉCRAN EMPLOIE.
 *
 * Réexport délibéré : le cycle du bouton, la table de libellés et les cas de test
 * parlent tous des mêmes trois valeurs, et les nommer ici dit que ce sont celles du
 * SERVEUR — jamais une liste recopiée. Le jour où une quatrième arrive,
 * `STORY_TEXT_STYLE_LABELS` cesse de compiler, ce qui est exactement le moment où il
 * faut décider de son libellé.
 */
export const STORY_TEXT_STYLES = StoryTextStyle;

const STORY_TEXT_STYLE_LABELS: Readonly<Record<(typeof STORY_TEXT_STYLES)[number], string>> = {
  /** Le mot de la maquette : « Aa · Gras ». */
  BOLD: 'Gras',
  SERIF: 'Serif',
  MONO: 'Mono',
};

/** Le style par défaut : celui que la maquette DESSINE (`font-weight:800`). */
export const STORY_TEXT_STYLE: (typeof StoryTextStyle)[number] = 'BOLD';

/** « Aa · Gras » — la forme que la maquette écrit, dont seul le mot est variable. */
export const textStyleLabelFor = (style: (typeof StoryTextStyle)[number]): string =>
  `Aa · ${STORY_TEXT_STYLE_LABELS[style]}`;

/** Le style suivant dans le cycle du bouton. Trois valeurs, donc il tourne. */
export const nextTextStyle = (
  style: (typeof StoryTextStyle)[number],
): (typeof StoryTextStyle)[number] => {
  const i = StoryTextStyle.indexOf(style);
  return StoryTextStyle[(i + 1) % StoryTextStyle.length] ?? STORY_TEXT_STYLE;
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE STYLE DE COMPOSITION — CE QUI SE VOIT, ET CE QUI SURVIT À LA PUBLICATION ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les quatre `<textarea>` étalent `bodyStyle` EN FIN de style (voir `aireDeTexte`
 * dans le transcodeur) : c'est le seul chemin par lequel les contrôles de l'étape 1
 * touchent au rendu du texte.
 *
 * DEUX SORTS DIFFÉRENTS, et il faut les distinguer :
 *
 *   · `fontFamily` vient de `textStyle`, qui PART dans la charge et est écrit en
 *     base (`stories.text_style`). Ce que le membre voit est donc ce qui est
 *     conservé ;
 *   · `textAlign` vient de « Centré », qui N'A AUCUN CHAMP. Vérifié sur
 *     `createStorySchema` (douze champs, aucun n'exprime un alignement) et sur la
 *     table `Story`. Le schéma est `.strict()` : y glisser la clé serait refusé, et
 *     l'ajouter serait décider d'une colonne de base. L'alignement vit donc le temps
 *     de la composition, et la story publiée rend le texte là où A13 le dessine.
 *     DÉFAUT ASSUMÉ ET REMONTÉ, pas masqué : il faut une colonne d'alignement sur
 *     `stories`, ou retirer le bouton de la maquette.
 *
 * LES TROIS PILES DE POLICES ne sont pas du dessin inventé : `SERIF` et `MONO` ne
 * NOMMENT pas une police, ils nomment une FAMILLE, et une famille se rend par les
 * mots-clés génériques de CSS. `BOLD` ne touche à rien — la maquette déclare déjà
 * `font-weight:800`, et le `fontFamily: "inherit"` du reset reste en place.
 */
export interface StyleDeComposition {
  readonly fontFamily?: string;
  readonly textAlign?: 'center';
}

export function bodyStyleFor(
  style: (typeof StoryTextStyle)[number],
  centre: boolean,
): StyleDeComposition {
  return {
    ...(style === 'SERIF' ? { fontFamily: 'Georgia, "Times New Roman", serif' } : {}),
    ...(style === 'MONO' ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } : {}),
    ...(centre ? { textAlign: 'center' as const } : {}),
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE RATTACHEMENT OBLIGATOIRE — CE QUE LA SONDE A DÉMENTI                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le diagnostic reçu disait que `category` et `stepDefinitionId` étaient
 * FACULTATIFS, et le schéma le dit aussi — `.optional()` sur les deux. LA SONDE
 * AU SERVEUR L'A DÉMENTI : `POST /stories` avec les six champs « évidents » rend
 * `422 INVALID_ATTACHMENT`, détail `DECOUVERTE_NEEDS_CATEGORY`. Le schéma les rend
 * facultatifs, le SERVICE les exige — par type, et différemment pour chacun
 * (`feed.service.ts`, les trois branches de `INVALID_ATTACHMENT`) :
 *
 *   · CONSEIL     — une `stepDefinition` OU un sujet, et le sujet doit être un
 *                   `STORY_SUBJECTS` (une catégorie de découverte est refusée
 *                   par `CONSEIL_CATEGORY_MUST_BE_SUBJECT`) ;
 *   · DECOUVERTE  — une catégorie `STORY_DISCOVERY_CATEGORIES *et* un
 *                   `placeLabel`, et AUCUNE étape ;
 *   · INFORMATION — un sujet `STORY_SUBJECTS`, et aucune étape.
 *
 * Donc une story ne peut PAS être publiée sans rattachement, pour aucun des trois
 * types. C'est l'écart le plus utile que ce lot a mesuré, et il n'était pas
 * dans le diagnostic.
 *
 * ── LE SUJET EST RECOPIÉ DE LA MAQUETTE, PAS CHOISI ────────────────────────
 *
 * `LOGEMENT` n'est pas une valeur par défaut inventée : c'est le sujet que la
 * maquette ÉCRIT, à deux endroits et en clair —
 *
 *   · la pastille du cadre d'ordinateur : « CONSEIL · LOGEMENT »
 *     (`webPillFor`, qui concatène le type et ce mot) ;
 *   · le récapitulatif de l'étape 3 : « SUJET » → « Logement · Visale ».
 *
 * `PRODUIT` de même : la planche de découverte de cette maquette porte
 * « DÉCOUVERTE · PRODUIT », et le calque de la variante photo est étiqueté
 * « DÉCOUVERTE ».
 *
 * ── CE QUI RESTE CASSÉ, ET QU'IL FAUT LIRE COMME TEL ───────────────────────
 *
 * UNE DÉCOUVERTE NE PEUT PAS ÊTRE PUBLIÉE, parce qu'elle exige un `placeLabel` et
 * QUE LE COMPOSEUR N'EN DESSINE AUCUN CHAMP. Mesuré sur les cinq cadres : l'étape 2
 * est titrée « Ce conseil concerne… » et ne propose qu'une étape de parcours ou un
 * sujet ; il n'y a ni champ de lieu, ni adresse, ni sélecteur de catégorie de
 * découverte. Le nom du lieu n'existe que DANS le corps de l'exemple
 * (« Épicerie Wax et Saveurs : attiéké frais… »), et le découper au deux-points
 * serait inventer une règle d'analyse que personne n'a décidée.
 *
 * On n'envoie donc pas de `placeLabel`, le serveur refuse par
 * `DECOUVERTE_NEEDS_PLACE`, et l'écran AFFICHE ce refus. C'est volontaire : un
 * refus lisible vaut mieux qu'un champ inventé, et c'est le dessin qui manque.
 * REMONTÉ — il faut un champ de lieu à l'étape 2 quand le type est une découverte,
 * et un choix entre LIEU · PRODUIT · SORTIE.
 *
 * ── LES « SUJETS » DESSINÉS : L'ÉCART ANNONCÉ N'EXISTE PAS ─────────────────
 *
 * CE FICHIER AFFIRMAIT UN CONFLIT DE TAXONOMIE, et la mesure l'a DÉMENTI. Il
 * écrivait : « l'étape 2 dessine une rangée titrée SUJETS dont les cinq pastilles
 * sont Visale · Garant · CAF · Colocation · Banque. Ce sont des DISPOSITIFS, pas des
 * sujets […] les faire correspondre est un arbitrage du porteur. Les pastilles
 * restent inertes. »
 *
 * Les cinq mots ne sont pas du DESSIN. La maquette les écrit dans un tableau de
 * données de son `renderVals()` — `attachTopics: ['Visale','Garant','CAF',
 * 'Colocation','Banque']` — et les rend par `<sc-for>`, exactement comme le corps
 * « Pour Visale… » qui est une donnée d'exemple reconnue comme telle par ce même
 * fichier. Ce sont donc des EXEMPLES, tous du même thème parce que la story
 * d'exemple parle de Visale, donc de logement.
 *
 * Il n'y a pas deux listes concurrentes : il y a une liste réelle, `STORY_SUBJECTS`,
 * et `STORY_SUBJECT_LABELS` existe DÉJÀ dans `@app/shared` avec ses neuf libellés
 * français — quelqu'un les a écrits POUR être montrés. Les pastilles les affichent.
 * Rien n'est deviné : une donnée d'exemple est remplacée par la donnée réelle.
 *
 * NEUF PASTILLES OÙ LA MAQUETTE EN DESSINE CINQ, et aucune n'est coupée : la rangée
 * qu'elle dessine porte `flex-wrap:wrap`, donc les neuf s'y rangent sans qu'un pixel
 * bouge. Le `hint-placeholder-count="5"` de son `<sc-for>` est un indice de maquette
 * pour le rendu statique, pas une borne.
 *
 * L'ÉCART DE PALETTE, LUI, RESTE ENTIER : ses sept couleurs sont dans les ATTRIBUTS
 * DE STYLE de la maquette — du dessin, pas de la donnée — et n'en recoupent aucune
 * du serveur. Celui-là attend le porteur.
 */
const SUJET_DESSINE: StorySubject = 'LOGEMENT';
const CATEGORIE_DECOUVERTE_DESSINEE = 'PRODUIT';

/**
 * LA CATÉGORIE À ENVOYER, et les trois branches du service la décident — pas nous.
 *
 * `resolveStoryAttachment` (`feed.service.ts`) n'accepte pas la même famille pour
 * les trois types, et il le dit en refusant :
 *
 *   · `CONSEIL` — un `STORY_SUBJECTS`, OU une étape. Une catégorie de découverte
 *     est refusée par `CONSEIL_CATEGORY_MUST_BE_SUBJECT` ;
 *   · `DECOUVERTE` — un `STORY_DISCOVERY_CATEGORIES`, et AUCUNE étape ;
 *   · `INFORMATION` — un `STORY_SUBJECTS`, et aucune étape.
 *
 * Donc le sujet choisi par le membre ne vaut que pour un conseil ou une information.
 * Pour une découverte, c'est `PRODUIT` — le mot que la maquette écrit sur sa planche
 * de découverte — et le sujet choisi est IGNORÉ, parce que l'envoyer ferait refuser
 * la publication. C'est un défaut de DESSIN et il est REMONTÉ : l'étape 2 est titrée
 * « Ce conseil concerne… » et ne dessine ni champ de lieu ni choix entre
 * LIEU · PRODUIT · SORTIE, qui sont ce qu'une découverte demande.
 *
 * `sujet` à `null` veut dire « le membre n'a rien choisi » : on retombe alors sur
 * `LOGEMENT`, que la maquette écrit à deux endroits en clair (la pastille
 * « CONSEIL · LOGEMENT » et le récapitulatif « SUJET → Logement · Visale »).
 */
export const storyCategoryFor = (
  kind: number,
  sujet: StorySubject | null = null,
  /**
   * ── UNE ÉTAPE SUFFIT, ET C'EST LE SERVEUR QUI LE DIT ─────────────────────
   *
   * Le porteur : « par défaut quand on ne sélectionne pas un sujet ça met sur
   * logement ». C'était vrai, et c'était un repli silencieux : un conseil
   * rattaché à « Étape 6 · Obtenir le visa », sans sujet coché, partait classé
   * LOGEMENT — un sujet que personne n'avait choisi.
   *
   * `resolveStoryAttachment` refuse un conseil par `CONSEIL_NEEDS_STEP_OR_SUBJECT` :
   * il lui faut une étape OU un sujet, pas les deux. Quand une étape est retenue,
   * elle porte déjà le sens, et la catégorie n'a plus à être devinée.
   *
   * LE REPLI SUBSISTE quand il n'y a NI étape NI sujet : le serveur refuserait
   * la publication, et « Logement » est ce que la maquette écrit en clair à deux
   * endroits. Il n'est plus silencieux pour autant — le récapitulatif de l'étape 3
   * l'affiche, puisqu'il lit cette même fonction.
   */
  aUneEtape = false,
): string | null =>
  storyTypeFor(kind) === 'DECOUVERTE'
    ? CATEGORIE_DECOUVERTE_DESSINEE
    : (sujet ?? (aUneEtape ? null : SUJET_DESSINE));

/**
 * LES NEUF PASTILLES DE SUJET, telles que l'étape 2 les rend.
 *
 * `bg` et `bd` sont les DEUX valeurs que la maquette emploie pour dire « choisi »
 * dans ce panneau : son `renderVals()` écrit, pour la ligne d'étape juste au-dessus,
 * `bg: a.on?'#E3F0EB':'#fff'` et `bd: a.on?'1.5px solid #16785E':'1px solid #E6EBE9'`.
 * Rien n'est inventé, et la déclaration de données les porte en `motifs` — donc le
 * jour où la maquette cesse de les écrire, la génération s'arrête.
 *
 * `filtre` vient du champ de recherche de l'étape 2, dont le texte promet de
 * chercher « une étape OU un sujet » : il filtre donc les deux listes.
 */
export interface SujetVue {
  readonly label: string;
  readonly on: boolean;
  readonly bg: string;
  readonly bd: string;
  readonly onPick: () => void;
}

export function attachTopicsFor(
  choisi: StorySubject | null,
  filtre: string,
  onPick: (sujet: StorySubject) => void,
): readonly SujetVue[] {
  const net = normaliser(filtre);
  return STORY_SUBJECTS.filter(
    (sujet) => net === '' || normaliser(STORY_SUBJECT_LABELS[sujet]).includes(net),
  ).map((sujet) => {
    const on = choisi === sujet;
    return {
      label: STORY_SUBJECT_LABELS[sujet],
      on,
      bg: on ? '#E3F0EB' : '#fff',
      bd: on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
      /** Un second appui DÉSÉLECTIONNE : `aria-pressed` promet une bascule. */
      onPick: () => onPick(sujet),
    };
  });
}

/**
 * LA COMPARAISON DU FILTRE IGNORE LES ACCENTS ET LA CASSE.
 *
 * « Études » et « Démarches » portent des accents que personne ne tape dans une
 * barre de recherche. Sans `NFD` + retrait des diacritiques, taper « etudes » ne
 * trouverait rien et le champ passerait pour mort — c'est-à-dire le défaut qu'il
 * vient de corriger.
 */
const normaliser = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES ÉTAPES VIENNENT DU SERVEUR — ELLES ÉTAIENT ÉCRITES EN DUR              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « normalement les étapes viennent du backend notamment les étapes des
 * parcours ». Elles ne venaient de nulle part : `attachSteps` était trois objets
 * écrits dans `screens/accueil/data.ts` (« Étape 7 · Logement », « Étape 6 · Caution
 * bancaire et AVI », « Étape 8 · Assurance habitation »), SANS identifiant — or
 * `createStorySchema.stepDefinitionId` attend un UUID. Les choisir ne pouvait donc
 * rien envoyer, et c'est pourquoi le lot précédent ne les envoyait pas.
 *
 * Elles viennent maintenant de `GET /journey-templates/:id/steps`, dont chaque
 * entrée porte le `stepDefinitionId` qui part dans la charge.
 *
 * ── CE QUE LA MAQUETTE DESSINE ET QUE CETTE ROUTE NE SERT PAS ───────────────
 *
 * `s` est la seconde ligne de chaque ligne d'étape, et la maquette y écrit
 * « Vous venez de la franchir », « Franchie il y a 3 semaines », « À venir ». Ces
 * trois phrases décrivent L'AVANCEMENT DU PARCOURS DU MEMBRE, que cette route ne
 * sert pas — et elle a raison : elle décrit un TYPE de parcours, pas le parcours
 * ouvert d'un membre. On y met donc la `description` de l'étape quand il y en a une,
 * et rien sinon. Inventer une de ces trois phrases serait annoncer un avancement
 * qu'on ne connaît pas. REMONTÉ : pour les écrire, il faudrait croiser avec
 * `GET /journeys/:id`, ce qui suppose que le membre AIT ouvert ce parcours — et le
 * composeur doit marcher avant.
 *
 * `isOptional` est servi par la route et N'EST PAS AFFICHÉ : la maquette n'écrit
 * aucun mot pour « facultative », et en choisir un serait écrire du texte
 * d'interface. REMONTÉ aussi.
 */
export interface EtapeVue {
  readonly stepDefinitionId: string;
  readonly t: string;
  readonly s: string;
  readonly on: boolean;
  readonly bg: string;
  readonly bd: string;
  readonly cBg: string;
  readonly cBd: string;
  readonly onPick: () => void;
}

export function attachStepsFrom(
  etapes: readonly JourneyTemplateStep[],
  choisi: string | null,
  filtre: string,
  onPick: (stepDefinitionId: string) => void,
): readonly EtapeVue[] {
  const net = normaliser(filtre);
  return etapes
    .filter(
      (e) =>
        net === '' ||
        normaliser(e.nameFr).includes(net) ||
        normaliser(e.description ?? '').includes(net),
    )
    .map((e) => {
      const on = choisi === e.stepDefinitionId;
      return {
        stepDefinitionId: e.stepDefinitionId,
        /** « Étape 7 · Logement » — la forme EXACTE que la maquette écrit. */
        t: `Étape ${String(e.position)} · ${e.nameFr}`,
        s: e.description ?? '',
        on,
        // Les quatre valeurs de sélection de la maquette, reprises telles quelles.
        bg: on ? '#E3F0EB' : '#fff',
        bd: on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
        cBg: on ? '#16785E' : '#fff',
        cBd: on ? 'none' : '1.5px solid #CBD5D1',
        onPick: () => onPick(e.stepDefinitionId),
      };
    });
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS OUTILS PHOTO, ET CE QU'ILS FONT VRAIMENT                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `photoTools` était `['Changer', 'Recadrer', 'Assombrir le bas']` — trois chaînes,
 * donc trois pastilles qu'aucun gestionnaire ne pouvait atteindre. Les libellés ne
 * bougent pas : ce sont ceux de la maquette.
 *
 *   · `Changer` ROUVRE LE SÉLECTEUR DE FICHIER. C'est le seul des trois qui touche à
 *     ce qui part (`backgroundAssetId`), et il n'avait rien à changer avant ce lot
 *     puisqu'il n'existait aucun sélecteur ;
 *   · `Recadrer` bascule entre `cover` et `contain`. AUCUN CHAMP EN BASE : un
 *     recadrage se décrit par une boîte (quatre nombres) et `createStorySchema` est
 *     `.strict()` avec douze champs dont aucun ne l'exprime. Le serveur reçoit donc
 *     l'image ENTIÈRE, et le cadrage choisi ne vaut que pour la composition.
 *     DÉFAUT ASSUMÉ ET REMONTÉ ;
 *   · `Assombrir le bas` éteint et rallume le voile que la maquette dessine déjà
 *     (`linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72))` sur 60 % de la
 *     hauteur). Aucun champ non plus. REMONTÉ.
 *
 * `on` n'est posé que sur les DEUX bascules : `Changer` est une action, et annoncer
 * `aria-pressed` sur une action dirait au lecteur d'écran qu'elle a un état.
 */
export interface OutilPhotoVue {
  readonly label: string;
  readonly on: boolean | undefined;
  readonly onPick: () => void;
}

export function photoToolsFor(actions: {
  readonly onChanger: () => void;
  readonly onRecadrer: () => void;
  readonly onAssombrir: () => void;
  readonly recadre: boolean;
  readonly assombri: boolean;
}): readonly OutilPhotoVue[] {
  return [
    { label: 'Changer', on: undefined, onPick: actions.onChanger },
    { label: 'Recadrer', on: actions.recadre, onPick: actions.onRecadrer },
    { label: 'Assombrir le bas', on: actions.assombri, onPick: actions.onAssombrir },
  ];
}

/**
 * LE HACHURAGE DE LA MAQUETTE, OU LA PHOTO DU MEMBRE.
 *
 * `repeating-linear-gradient(135deg,#46564F 0 14px,#3E4D47 14px 28px)` est recopié
 * MOT POUR MOT de la maquette, qui l'emploie partout comme emplacement d'image (la
 * story de A13 le réemploie à l'identique). C'est la valeur servie tant qu'aucune
 * photo n'est choisie : l'écran ne dessine donc rien de neuf.
 *
 * `center/cover` et `center/contain` sont ce que « Recadrer » bascule. Ils ne
 * s'appliquent qu'à l'image choisie — le hachurage, lui, est rendu tel quel.
 */
export const HACHURAGE_PHOTO =
  'repeating-linear-gradient(135deg,#46564F 0 14px,#3E4D47 14px 28px)';

export const photoFondFor = (url: string | null, recadre: boolean): string =>
  url === null
    ? HACHURAGE_PHOTO
    : `url("${url}") center/${recadre ? 'contain' : 'cover'} no-repeat`;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE SÉLECTEUR DE PARCOURS — CE QUE `GET /journey-templates` SERT VRAIMENT    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur veut « un modal dans la page avec les parcours ET LEUR DESCRIPTION ».
 * La route sert bien un champ `description`, et il faut dire ce qu'on y a trouvé :
 *
 * ⚠ AUCUN DES QUATRE TYPES N'A DE DESCRIPTION, et ce n'est pas un trou de jeu de
 * données : `packages/db/src/seed/journeys.ts` ne pose AUCUN champ `description` sur
 * les quatre entrées de `JOURNEY_TEMPLATES` (seulement `code`, `nameFr`,
 * `targetPhase`, `sortOrder`, `steps`), et `docs/specs/` ne définit nulle part un
 * texte de présentation par type de parcours. La colonne existe au modèle ; personne
 * n'a jamais dit quoi y mettre.
 *
 * ── LE SOUS-TITRE EST CELUI QUE LA SPEC PRESCRIT, PAS UN REPLI ─────────────
 *
 * `docs/specs/T5-pages-et-prompts.md`, « O03 — Objectif », mot pour mot : « Quatre
 * cartes-boutons pour les types de parcours (Étudier, Travailler, Rejoindre ma
 * famille, Régulariser ma situation), CHACUNE AVEC LE NOMBRE D'ÉTAPES EN
 * SOUS-TITRE. » Ce qui est spécifié sous un type de parcours est donc le NOMBRE
 * D'ÉTAPES, pas une description — et c'est ce qu'on affiche. On n'écrit aucun texte
 * de remplacement : ce serait rédiger la présentation des parcours à la place du
 * porteur, et la spec ne le demande pas.
 *
 * Le nombre vient de `version.stepCount` et JAMAIS d'un littéral : l'en-tête de
 * `journeyTemplateVersionSchema` y insiste — « L'API répond 15 pour STUDIES, parce
 * que le modèle a été rechargé en version 3 », là où la maquette dessine « 12 ».
 *
 * La fenêtre tient donc AVEC et SANS description : si un texte est semé un jour, il
 * s'affiche ; sinon c'est le compte d'étapes. REMONTÉ au porteur comme une DÉCISION
 * et non comme un trou à combler — « les parcours et leur description » lui coûterait
 * quatre textes à écrire, qui n'existent dans aucune spec.
 *
 * ── ET CETTE FENÊTRE N'EST PAS L'ÉCRAN D'OBJECTIF ─────────────────────────
 *
 * La même page de spec ajoute à O03 deux cartes de même rang — « M'intégrer,
 * rencontrer du monde » et « Aider les autres » — sous la règle dure « Le parcours
 * n'est jamais imposé ». ELLES N'ONT RIEN À FAIRE ICI : O03 OUVRE un parcours, cette
 * fenêtre RATTACHE une story à une étape. Les y ajouter proposerait de rattacher un
 * conseil à un choix qui n'a aucune étape.
 */
export interface ParcoursVue {
  readonly id: string;
  readonly nom: string;
  /** La description servie, ou le compte d'étapes quand elle manque. Voir ci-dessus. */
  readonly detail: string;
  /** La description vient-elle vraiment du serveur ? Les tests s'en servent. */
  readonly aUneDescription: boolean;
  readonly on: boolean;
}

export function parcoursChoixFor(
  modeles: readonly JourneyTemplate[],
  choisi: string | null,
): readonly ParcoursVue[] {
  return modeles.map((m) => {
    const decrit = m.description !== null && m.description.trim() !== '';
    return {
      id: m.id,
      nom: m.nameFr,
      detail: decrit
        ? (m.description ?? '')
        : `${String(m.version.stepCount)} étapes`,
      aUneDescription: decrit,
      on: choisi === m.id,
    };
  });
}

/**
 * « MON PARCOURS · ÉTUDES » — le titre de la liste d'étapes.
 *
 * Il annonçait « ÉTUDES » en dur : choisir « Travailler » aurait rempli la liste des
 * étapes du travail sous un titre qui dit « études ». La forme « MON PARCOURS · X »
 * est celle de la maquette ; seul le mot de droite devient une donnée, et les
 * capitales sont celles qu'elle emploie.
 *
 * SANS PARCOURS CHOISI, le titre reste celui de la maquette, mot pour mot. On ne lui
 * substitue pas une invite — il n'y a pas d'invite dessinée, et le bouton juste
 * au-dessus dit déjà quoi faire.
 */
export const parcoursLabelFor = (nom: string | null): string =>
  nom === null ? 'MON PARCOURS · ÉTUDES' : `MON PARCOURS · ${nom.toUpperCase()}`;

/** L'état de composition, tel que l'écran le tient. */
export interface EtatComposition {
  readonly body: string;
  readonly pal: number;
  readonly storyKind: number;
  readonly audience: number;
  readonly msgs: boolean;
  readonly textStyle: (typeof StoryTextStyle)[number];
  /** L'étape choisie à l'étape 2, ou `null`. Un UUID de `step_definitions`. */
  readonly stepDefinitionId: string | null;
  /** Le sujet choisi à l'étape 2, ou `null` — on retombe alors sur celui dessiné. */
  readonly sujet: StorySubject | null;
  /**
   * Le sujet ÉCRIT À LA MAIN, qui n'a de sens qu'avec « Autre ».
   *
   * Vide tant que le membre n'a rien tapé ; il ne part alors pas du tout, parce
   * qu'une chaîne vide n'est pas un sujet et que `createStorySchema` la refuse
   * (`min(1)`).
   */
  readonly sujetLibre: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE LIEU D'UNE DÉCOUVERTE — CE SANS QUOI ELLE EST REFUSÉE                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * §2.6 demande à une découverte « Ville + catégorie + `place_label` », et le
   * serveur l'applique : sans lui, `POST /stories` rend `422 INVALID_ATTACHMENT`,
   * motif `DECOUVERTE_NEEDS_PLACE`. MESURÉ depuis le composeur, et c'est le
   * refus que le porteur a rencontré : « Ce type de story demande un rattachement
   * que vous n'avez pas indiqué. »
   *
   * LA PLANCHE NE DESSINE AUCUN CHAMP POUR LUI. Une découverte était donc
   * IMPOSSIBLE à publier depuis l'écran — pas « mal expliquée » : impossible. Le
   * champ reprend la forme du sujet libre, qui lui-même tient sa boîte de la barre
   * de recherche du même panneau : rien n'est inventé.
   *
   * Vide pour les deux autres types, où il ne part pas : §2.6 le dit facultatif
   * pour une information et absent d'un conseil.
   */
  readonly lieu: string;
  /** Le média téléversé pour le fond, ou `null` : la couleur part alors à sa place. */
  readonly backgroundAssetId: string | null;
  /**
   * La ville choisie à l'étape 3, ou `null` — le serveur retombe alors sur celle
   * du membre (`resolveStoryAttachment` : « la ville du membre est la valeur de
   * repli »). Ce repli est la raison pour laquelle le champ n'a jamais été envoyé
   * jusqu'ici ; il l'est depuis que le porteur a demandé à pouvoir en changer.
   */
  readonly cityId: string | null;
}

/**
 * LA CHARGE DE `POST /stories`, CONSTRUITE DEPUIS L'ÉTAT DE L'ÉCRAN.
 *
 * Elle passe par `createStorySchema.parse` — le schéma du SERVEUR, lu de
 * `@app/shared` — et c'est la seule autorité sur ce qui part. `parse` fait échouer
 * ICI, avec le nom du champ, ce qui échouerait sinon en `400` sans dire lequel.
 *
 * `cityId` est ABSENT de l'objet, et non à `undefined` : `exactOptionalPropertyTypes`
 * est actif, et le schéma est `.strict()` — une clé présente et vide n'est pas la
 * même chose qu'une clé absente.
 *
 * Chacun des six champs vient d'un contrôle que le membre VOIT et MANŒUVRE :
 * le texte qu'il tape, la pastille qu'il choisit, l'onglet de type, l'onglet
 * d'audience, l'interrupteur de messages. C'est ce que `nouvelle-story.test.ts`
 * éprouve champ par champ — un sélecteur qui bouge à l'écran sans changer ce qui
 * part est le défaut que ce dépôt a déjà payé.
 */
export function chargeStory(etat: EtatComposition): CreateStory {
  const type = storyTypeFor(etat.storyKind);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UNE PHOTO RETIRE LA COULEUR — LE SCHÉMA EXIGE L'UN *OU* L'AUTRE          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `createStorySchema` porte un `.refine()` qui est un OU EXCLUSIF, mot pour mot :
   * `(v.backgroundColor === undefined) !== (v.backgroundAssetId === undefined)`.
   * Envoyer les deux échoue, et n'envoyer aucun des deux échoue aussi. Une story a
   * donc un fond COULEUR ou un fond IMAGE, jamais les deux et jamais ni l'un ni
   * l'autre — ce qui est d'ailleurs ce que la maquette montre : le bouton « Photo »
   * remplace l'aplat de couleur, il ne se superpose pas.
   *
   * Les deux clés sont ABSENTES et non à `undefined` : `exactOptionalPropertyTypes`
   * est actif et le schéma est `.strict()`. Une clé présente et vide n'est pas la
   * même chose qu'une clé absente, et le `.refine()` ci-dessus compte des
   * `undefined` — donc la nuance décide du résultat.
   */
  const fond =
    etat.backgroundAssetId === null
      ? {
          backgroundColor:
            STORY_BACKGROUND_FOR_PALETTE[etat.pal] ?? STORY_BACKGROUND_FOR_PALETTE[0],
        }
      : { backgroundAssetId: etat.backgroundAssetId };

  /**
   * ── L'ÉTAPE NE PART QUE POUR UN CONSEIL, ET CE N'EST PAS UNE PRÉCAUTION ───
   *
   * `resolveStoryAttachment` REFUSE une étape sur les deux autres types, par deux
   * codes nommés : `DECOUVERTE_HAS_NO_STEP` et `INFORMATION_HAS_NO_STEP`. Envoyer
   * l'étape choisie quel que soit le type rendrait donc la publication IMPOSSIBLE
   * dès qu'un membre aurait touché à la liste avant de changer d'onglet — et le
   * refus accuserait le rattachement alors que la faute serait ici.
   *
   * C'est cohérent avec le dessin : l'étape 2 est titrée « Ce conseil concerne… ».
   * La maquette ne dessine PAS d'étape 2 pour une découverte ni pour une
   * information, et c'est un manque REMONTÉ — une découverte y demanderait un champ
   * de lieu et un choix LIEU · PRODUIT · SORTIE.
   */
  const etape =
    type === 'CONSEIL' && etat.stepDefinitionId !== null
      ? { stepDefinitionId: etat.stepDefinitionId }
      : {};

  /**
   * ── LE SUJET ÉCRIT À LA MAIN NE PART QU'AVEC « AUTRE » ────────────────────
   *
   * `createStorySchema` porte un `.refine()` qui le dit : « Un sujet écrit à la
   * main n'accompagne que le sujet "Autre". » La condition est donc LA MÊME des
   * deux côtés, et c'est voulu — le `parse` ci-dessous ferait échouer ici, avec
   * le nom du champ, ce qui échouerait sinon en `400` sans dire lequel.
   *
   * On relit `storyCategoryFor` plutôt que `etat.sujet` : c'est elle qui décide
   * de ce qui part, et elle écrase le sujet choisi pour une DÉCOUVERTE. Se fier
   * à `etat.sujet` enverrait un texte libre avec `category: 'PRODUIT'`, que le
   * serveur refuserait — un refus provoqué par l'écran, pas par le membre.
   *
   * La clé est ABSENTE et non à `undefined` : `exactOptionalPropertyTypes` est
   * actif et le schéma est `.strict()`.
   */
  /**
   * La catégorie est ABSENTE quand une étape la rend inutile — voir
   * `storyCategoryFor`. `exactOptionalPropertyTypes` est actif et le schéma est
   * `.strict()` : une clé à `undefined` n'est pas une clé absente, et le service
   * compte les absences.
   */
  const categorieChoisie = storyCategoryFor(
    etat.storyKind,
    etat.sujet,
    type === 'CONSEIL' && etat.stepDefinitionId !== null,
  );
  const categorie = categorieChoisie === null ? {} : { category: categorieChoisie };

  const texteLibre = etat.sujetLibre.trim();
  const sujetLibre =
    categorieChoisie === 'AUTRE' && texteLibre !== '' ? { categoryOther: texteLibre } : {};

  /**
   * ── LE LIEU, ET SEULEMENT POUR UNE DÉCOUVERTE ────────────────────────────
   *
   * §2.6 : « Ville + catégorie + `place_label` » pour une découverte ; facultatif
   * pour une information ; absent d'un conseil. On ne l'envoie donc que là où il
   * a un sens — et une chaîne vide ne part pas, le schéma la refuserait.
   */
  const texteLieu = etat.lieu.trim();
  const lieu = type === 'DECOUVERTE' && texteLieu !== '' ? { placeLabel: texteLieu } : {};

  /**
   * La ville n'est envoyée QUE si le membre en a choisi une. Absente, et non à
   * `undefined` : `exactOptionalPropertyTypes` est actif et le schéma est
   * `.strict()`. L'envoyer à vide ferait échouer `uuidSchema` sur un champ que le
   * membre n'a pas touché.
   */
  const ville = etat.cityId === null ? {} : { cityId: etat.cityId };

  return createStorySchema.parse({
    type,
    body: etat.body,
    ...ville,
    ...fond,
    textStyle: etat.textStyle,
    /**
     * LE RATTACHEMENT, sans lequel le serveur refuse les TROIS types. Voir le bloc
     * « LE RATTACHEMENT OBLIGATOIRE » : le schéma le dit facultatif, le service
     * l'exige, et la sonde l'a mesuré.
     */
    ...categorie,
    ...sujetLibre,
    ...lieu,
    ...etape,
    audience: storyAudienceFor(etat.audience),
    allowMessages: etat.msgs,
  });
}

/**
 * Le compteur de caractères, dans la forme que la maquette dessine : « 118 / 280 ».
 * Le plafond vient de `@app/shared`, jamais d'un littéral.
 */
export const bodyCountFor = (body: string) => `${body.length} / ${STORY_BODY_MAX}`;

/**
 * LE RAPPEL TRONQUÉ DE L'ÉTAPE 2.
 *
 * La maquette tronque elle-même son rappel — elle écrit « Pour Visale, déposez
 * votre VLS-TS dès sa validation… », points de suspension compris, là où le texte
 * complet continue. La zone est dessinée pour une ligne et demie en 22 px ; y
 * verser 280 caractères déborderait du cadre.
 *
 * La coupe se fait sur le dernier ESPACE avant la borne, pour ne pas couper un mot
 * en deux, et la borne est la LONGUEUR DESSINÉE : 52 caractères, qui est celle du
 * littéral tronqué de la maquette, points de suspension exclus. Ce n'est pas un
 * nombre choisi — c'est celui qu'elle montre.
 */
const RECAP_MAX = 52;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PREMIÈRE LIGNE DU RÉCAPITULATIF — LE SUJET QUI VA RÉELLEMENT PARTIR     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'étape 3 doit afficher le sujet sélectionné et autres. » La
 * planche écrivait « Logement · Visale » quoi qu'on choisisse.
 *
 * Elle est construite SUR `storyCategoryFor`, donc sur la fonction qui décide ce
 * que `chargeStory` emporte. C'est délibéré : un récapitulatif calculé à part
 * finirait par diverger de la charge, et c'est précisément le défaut qu'on
 * corrige — un écran qui annonce autre chose que ce qu'il envoie.
 *
 * Le séparateur « · » est celui de la maquette, qui écrit « Logement · Visale » :
 * un sujet, un point médian, une précision. Quand le sujet est « Autre », la
 * précision est celle que le membre a tapée.
 */
export function sujetRecapFor(
  kind: number,
  sujet: StorySubject | null,
  libre: string,
  aUneEtape = false,
): string {
  const categorie = storyCategoryFor(kind, sujet, aUneEtape);
  /**
   * SANS CATÉGORIE, c'est l'étape qui dit de quoi il s'agit — et la seconde ligne
   * du récapitulatif la nomme déjà. Écrire un sujet ici serait réintroduire le
   * repli qu'on vient de retirer.
   */
  if (categorie === null) return 'Rattaché à une étape';
  /**
   * `storyCategoryFor` peut rendre une catégorie de DÉCOUVERTE (`PRODUIT`), qui
   * n'est pas dans `STORY_SUBJECT_LABELS`. On retombe alors sur le code lui-même
   * plutôt que sur `undefined` : afficher « PRODUIT » est laid mais vrai, et
   * `noUncheckedIndexedAccess` impose de toute façon de traiter ce cas.
   */
  const label = STORY_SUBJECT_LABELS[categorie as StorySubject] ?? categorie;
  const net = libre.trim();
  return categorie === 'AUTRE' && net !== '' ? `${label} · ${net}` : label;
}

/**
 * LA SECONDE LIGNE — l'étape rattachée.
 *
 * La maquette écrit « Étape 7 de mon parcours » ; la forme est reprise mot pour
 * mot, seul le rang vient de l'étape retenue. Le rang est la `position` servie
 * par `GET /journey-templates/:id/steps`, la même que les lignes de l'étape 2
 * affichent (« Étape 7 · Logement ») : les deux écrans ne peuvent pas se
 * contredire.
 *
 * SANS ÉTAPE, la maquette n'écrit rien — elle n'a dessiné que le cas rattaché.
 * « Aucune étape rattachée » est donc un texte d'interface NON DESSINÉ, écrit
 * ici faute de mieux et REMONTÉ au porteur. Le laisser vide aurait été pire :
 * une ligne blanche sous « SUJET » ressemble à un écran cassé.
 */
export function etapeRecapFor(
  etapes: readonly JourneyTemplateStep[],
  stepDefinitionId: string | null,
): string {
  if (stepDefinitionId === null) return 'Aucune étape rattachée';
  const etape = etapes.find((e) => e.stepDefinitionId === stepDefinitionId);
  if (etape === undefined) return 'Aucune étape rattachée';
  return `Étape ${String(etape.position)} de mon parcours`;
}

/**
 * LE FILTRE DE LA LISTE DE VILLES — accents et casse ignorés.
 *
 * Même `normaliser` que les étapes et les sujets, et pour la même raison : « Dédougou »
 * et « Bénin » portent des signes que personne ne tape dans une barre de recherche.
 * Le filtre se fait ICI et non au serveur : la route rend les villes d'UN pays,
 * c'est-à-dire quelques dizaines de lignes déjà en main — un aller-retour par
 * frappe serait plus lent et moins sûr.
 */
export function filtrerVilles<T extends { readonly name: string }>(
  villes: readonly T[],
  filtre: string,
): readonly T[] {
  const net = normaliser(filtre);
  if (net === '') return villes;
  return villes.filter((v) => normaliser(v.name).includes(net));
}

export function bodyRecapFor(body: string): string {
  const net = body.trim();
  if (net.length <= RECAP_MAX) return net;
  const coupe = net.slice(0, RECAP_MAX);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > 0 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/**
 * Ce que les cinq cadres de A14 lisent.
 *
 * `writeBg` est la couleur de fond CHOISIE, et c'est une donnée qui peint le cadre
 * entier — pas un jeton de thème. Elle n'est jamais assombrie : la règle de
 * contraste se tient par le texte blanc que la maquette pose dessus, et les sept
 * couleurs de la palette sont celles du dessin, à l'identique.
 */
export interface A14Data {
  /** Étape 1, mobile. */
  writeBg: string;
  palette: ReturnType<typeof paletteFor>;
  storyKinds: ReturnType<typeof storyKindsFor>;

  /**
   * ── LES CONTRÔLES DE COMPOSITION, QUE LE PORTEUR A TROUVÉS MORTS ──────────
   *
   * Les trois outils photo, le bouton de style de texte, et la bascule
   * « Centré ». Voir leurs blocs respectifs plus haut pour ce qui est conservé en
   * base (`textStyle` et `backgroundAssetId`) et ce qui ne l'est pas (l'alignement,
   * le recadrage, le voile — tous REMONTÉS).
   */
  photoTools: readonly OutilPhotoVue[];
  /** Le fond de la variante photo : le hachurage de la maquette, ou la photo. */
  photoFond: string;
  /** Le voile du bas est-il allumé — c'est l'état que la maquette dessine. */
  assombri: boolean;
  /** « Aa · Gras », « Aa · Serif », « Aa · Mono ». */
  textStyleLabel: string;
  onTextStyle: () => void;
  alignCentre: boolean;
  onAlign: () => void;
  /** Ce que les quatre `<textarea>` étalent en fin de style. Voir `bodyStyleFor`. */
  bodyStyle: StyleDeComposition;

  /**
   * ── LE CORPS DE LA STORY ─────────────────────────────────────────────────
   *
   * Trois prises pour un seul texte, parce que la maquette le dessine dans trois
   * rôles différents et qu'il faut les distinguer :
   *
   *   · `storyBodyValue` + `onStoryBodyChange` — les QUATRE `<textarea>` ;
   *   · `storyBody` — les APERÇUS (la carte de l'étape 3, le téléphone sombre du
   *     cadre d'ordinateur), en lecture seule ;
   *   · `storyBodyRecap` — le rappel TRONQUÉ de l'étape 2, parce que la maquette
   *     le tronque.
   */
  storyBodyValue: string;
  onStoryBodyChange: (event: { readonly target: { readonly value: string } }) => void;
  storyBody: string;
  storyBodyRecap: string;
  /** La borne du serveur, posée en `maxLength` par le transcodeur. */
  bodyMax: number;
  /** « 0 / 280 » — le compteur que la maquette dessine trois fois. */
  bodyCount: string;

  /**
   * ── LE CALQUE DÉPLAÇABLE ─────────────────────────────────────────────────
   *
   * Le cadre à pointillé et quatre poignées que la maquette dessine sur la variante
   * photo, des deux largeurs. `layerStyle` porte sa translation courante,
   * `onLayerGrab` démarre la prise. Voir le bloc « LE CALQUE DE TEXTE SE DÉPLACE »
   * de `tools/generate-screens.mjs` : le texte reste modifiable, parce que la prise
   * ne part que du CADRE et jamais du `<textarea>`.
   */
  layerStyle: { readonly transform?: string; readonly touchAction?: string };
  onLayerGrab: (event: LayerPointerEvent) => void;

  /**
   * La bascule vers la variante photo. Le cadre d'ordinateur l'a dans `w.onPhoto` ;
   * le cadre MOBILE la dessine en `<span>`, que `markLinks` promeut en bouton sur
   * cette prise (voir la déclaration `liens` de A14). Sans elle, la variante photo
   * — le calque déplaçable — était inatteignable sur téléphone.
   */
  onPhoto: () => void;

  /**
   * ── ÉTAPE 2 : À QUOI RATTACHER LA STORY ──────────────────────────────────
   *
   * Tout y était mort avant ce lot, et le porteur l'a mesuré : « Sur l'écran 3, la
   * recherche, les étapes et sujet. » Les trois répondent maintenant, et les trois
   * atteignent la charge (`stepDefinitionId` et `category`).
   *
   * `parcoursSelecteur` est le bouton « Sélectionner un parcours » et sa fenêtre.
   * La maquette ne les dessine PAS : c'est donc un nœud fourni par l'écran, dont le
   * dessin vit dans `selecteur-parcours.tsx`, où chaque valeur porte la ligne de
   * maquette dont elle est recopiée. Le transcodeur ne fait que lui ménager sa
   * place, au-dessus de la liste d'étapes — là où le porteur l'a demandé.
   */
  attachQuery: string;
  onAttachQuery: (event: { readonly target: { readonly value: string } }) => void;
  /**
   * LA CROIX DE FERMETURE — « Sur grand écran le bouton fermer en haut ne marche
   * pas ». Elle était dessinée trois fois et branchée zéro fois.
   */
  onClose: () => void;
  /**
   * ── QUI COMPOSE ──────────────────────────────────────────────────────────
   *
   * Le porteur : « ça affiche "Amina Diallo" […] Le nom n'est pas dynamique. »
   * La planche écrit son exemple en clair ; l'aperçu signait donc la story du
   * membre au nom de quelqu'un d'autre.
   *
   * Vides tant que `GET /me` n'a pas répondu : un nom d'attente serait un second
   * mensonge, plus court.
   */
  moiNom: string;
  moiInitiales: string;

  parcoursSelecteur: ReactNode;
  /**
   * LE SÉLECTEUR D'ÉTAPE — « faire comme la section qui le précède et mettre un
   * chevron et afficher un modal de sélection d'une étape ».
   *
   * Il porte le BOUTON seul ; la fenêtre est montée une fois par la page, à côté
   * de `ScreenFrames`, pour la même raison que celle du parcours : les deux
   * cadres existent dans le document, et deux fenêtres porteraient deux fois
   * `a14e-titre`.
   */
  etapeSelecteur: ReactNode;
  /**
   * LE CHAMP DU SUJET « AUTRE » — `screens/a14/champ-sujet.tsx`, posé sous les
   * pastilles. Il ne se rend que lorsque « Autre » est la pastille retenue, et
   * c'est le composant lui-même qui en décide : la prise ne porte pas d'état.
   */
  sujetLibre: ReactNode;
  /** Étape 3 — la première ligne du récapitulatif : le sujet qui va partir. */
  sujetRecap: string;
  /** Étape 3 — la seconde : l'étape rattachée, ou son absence. */
  etapeRecap: string;
  /** « MON PARCOURS · ÉTUDES » devient « MON PARCOURS · <le parcours choisi> ». */
  parcoursLabel: string;
  attachSteps: readonly EtapeVue[];
  attachTopics: readonly SujetVue[];
  onContinue: () => void;

  /** Étape 3, mobile : qui voit, et qui peut écrire. */
  audience: ReturnType<typeof audienceFor>;
  msgsTrack: string;
  msgsKnob: string;
  /**
   * L'état de l'interrupteur, en booléen : c'est ce que `role="switch"` annonce par
   * `aria-checked`. `msgsTrack` et `msgsKnob` sont du dessin et ne disent rien à un
   * lecteur d'écran. Voir `msgsFor` dans `screens/accueil/data.ts`.
   */
  msgsOn: boolean;
  toggleMsgs: () => void;

  /** Étape 3 : publier pour de vrai, ou revenir écrire. */
  onPublish: () => void;
  onEdit: () => void;
  /** Un envoi est en cours : le bouton « Publier » est désactivé. */
  busy: boolean;

  /** Le cadre d'ordinateur, qui porte les trois étapes dans une fenêtre sombre. */
  webKind: string;
  webPill: string;
  webKinds: ReturnType<typeof webKindsFor>;
  webPalette: ReturnType<typeof webPaletteFor>;
  w: ReturnType<typeof webFrameFor>;
}

/**
 * Ce que le gestionnaire de prise lit de l'événement, et RIEN DE PLUS.
 *
 * Un `React.PointerEvent` complet obligerait les cadres générés à être typés sur
 * React ; ils ne le sont pas, et le transcodeur ne pose qu'un nom. Cette forme
 * minimale est ce que le DOM fournit et ce que l'écran emploie — elle rend le
 * gestionnaire éprouvable sans monter un navigateur.
 */
export interface LayerPointerEvent {
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerId: number;
  readonly target: EventTarget | null;
  readonly currentTarget: EventTarget | null;
  preventDefault: () => void;
}
