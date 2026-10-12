'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GUIDE_BODY_MAX,
  GUIDE_BODY_MIN,
  GUIDE_TITLE_MAX,
  GUIDE_TITLE_MIN,
  GuideCategory,
  guidePageTitleSchema,
  guidePublishableGuideBodySchema,
  guideTitleSchema,
  joinGuidePageBodies,
  mediaAssetSchema,
  restrictedMarkdownIssue,
  type CreateGuide,
  type GuideEditorResponse,
  type GuidePageRef,
  type GuideStatus,
  type UpdateGuide,
} from '@app/shared';
import { ApiError, memberApi } from '@/lib/api/index';
import { notifyError, notifySuccess } from '@/components/notifications';
import {
  createDraft,
  createGuidePage,
  fetchGuideEditeur,
  publishGuide,
  removeGuidePage,
  updateGuide,
  updateGuidePage,
} from '@/screens/guides/api';
/**
 * `CATEGORY_LABEL` VIENT DU MÊME CONVERTISSEUR QUE LA LECTURE, et c'est tout
 * l'intérêt : « Travail et études » s'écrit alors pareil dans l'éditeur, sur la
 * carte de A03 et dans l'en-tête du guide publié.
 *
 * ⚠ IL N'EST PAS DANS `@app/shared`, et ce n'est pas un oubli de ce fichier :
 * l'API rend l'énumération BRUTE (`WORK_STUDIES`), et le français des six
 * catégories est une décision d'écran. Le `CATEGORY_LABELS_FR` de `@app/shared`
 * est autre chose — ce sont les catégories de NOTIFICATION.
 */
import { CATEGORY_LABEL } from '@/screens/guides/from-api';
import { useReferentielsGuides } from '@/screens/guides/use-referentiels';
import type { OptionEditeur } from '@/screens/a05/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « LES PAGES ÉCRIRE UN GUIDE EST FINALISÉ ? » — LA PRISE DE L'ÉDITEUR       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ avant ce lot : `a05/{desktop,mobile}.generated.tsx` portaient 0
 * `<input>`, 0 `<textarea>`, 0 `onClick`. `A05Data` était `{ mdTools, rules }` —
 * la barre d'outils et le panneau de règles, deux listes de la maquette. La page
 * `/guides/nouveau` montait cela et un `GardeNiveau`. Rien d'autre.
 *
 * Le DESSIN a été transcodé par `A05_EDITEUR` (générateur). Ce fichier est l'autre
 * moitié : l'état, les appels, et les règles que le serveur impose.
 *
 * ── TROIS CHOSES QUE CE FICHIER NE FAIT PAS, ET POURQUOI ────────────────────
 *
 * 1. IL NE DÉCIDE PAS DU NIVEAU. `guide.write` est en N2, et le front PRÉVIENT
 *    sans AUTORISER : on tente, le serveur répond `403 LEVEL_REQUIRED`, et la
 *    fenêtre s'affiche. Le `GardeNiveau` posé sur la page explique PLUS TÔT,
 *    avant que le membre n'écrive pour rien — mais il ne garde rien : « Elle ne
 *    REMPLACE rien : le serveur refuse toujours, et c'est lui qui protège. »
 * 2. IL NE RECOPIE AUCUNE BORNE. `GUIDE_TITLE_MIN`, `GUIDE_BODY_MIN`,
 *    `GUIDE_BODY_MAX` et les deux schémas de corps viennent de `@app/shared`,
 *    c'est-à-dire du MÊME fichier que le serveur lit. Un nombre écrit ici aurait
 *    divergé, et le symptôme aurait été un bouton allumé sur un corps que l'API
 *    refuse.
 * 3. IL N'INVENTE PAS DE VALIDATION. Le seul contrôle local est celui des
 *    schémas, et il sert à DIRE POURQUOI — jamais à empêcher l'envoi : le bouton
 *    « Publier » reste atteignable (`aria-disabled`, pas `disabled`) et le clic
 *    affiche le motif.
 */

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE CHAQUE MARQUE DE LA BARRE D'OUTILS INSÈRE                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les six marques sont celles que la maquette dessine (`mdTools`), et chacune est
 * du Markdown que `restrictedMarkdownIssue` ACCEPTE — c'est le point :
 *
 *   · `H` → `## ` (titre de niveau 2). ⚠ PAS `# ` : `HEADING_OUT_OF_RANGE`
 *     refuse les niveaux 1, 4, 5 et 6, et le message du serveur le dit — « Seuls
 *     les titres de niveau 2 (##) et 3 (###) sont autorisés ». Une barre d'outils
 *     qui insérerait `# ` produirait un corps que l'API rejette, depuis un bouton
 *     que le produit propose ;
 *   · `B` → `**gras**`, `I` → `_italique_`, `•` → `- `, `1.` → `1. ` ;
 *   · `Lien` → `[texte](https://)`, dont l'adresse reste à compléter. Le Markdown
 *     restreint accepte les liens ; seules les IMAGES sont bornées au pipeline
 *     média.
 *
 * `enveloppe` dit si la marque ENTOURE la sélection (gras, italique, lien) ou si
 * elle se pose en TÊTE DE LIGNE (titre, listes). Les deux gestes ne sont pas les
 * mêmes : un `## ` inséré au milieu d'un mot ne fait pas un titre.
 */
const MARQUES: Readonly<
  Record<string, { readonly avant: string; readonly apres: string; readonly ligne: boolean }>
> = {
  H: { avant: '## ', apres: '', ligne: true },
  B: { avant: '**', apres: '**', ligne: false },
  I: { avant: '_', apres: '_', ligne: false },
  '•': { avant: '- ', apres: '', ligne: true },
  '1.': { avant: '1. ', apres: '', ligne: true },
  Lien: { avant: '[', apres: '](https://)', ligne: false },
};

/**
 * LE CHAMP DE CORPS VISIBLE, parmi les deux que `ScreenFrames` rend.
 *
 * Les DEUX cadres sont rendus et l'un est masqué par CSS — « Next rend côté
 * serveur : il ne connaît pas la largeur de la fenêtre ». Insérer une marque dans
 * le premier trouvé l'aurait donc écrite dans le champ INVISIBLE une fois sur
 * deux : le texte serait apparu (il est lu depuis l'état, partagé), mais le CARET
 * aurait sauté au début et la sélection aurait été perdue.
 *
 * `offsetParent === null` est le critère de visibilité d'un élément masqué par
 * `display: none` sur un ancêtre, ce qui est exactement ce que `lg:hidden` fait.
 */
function champVisible(): HTMLTextAreaElement | null {
  if (typeof document === 'undefined') return null;
  for (const n of document.querySelectorAll<HTMLTextAreaElement>('textarea[data-a05-corps]')) {
    if (n.offsetParent !== null) return n;
  }
  return null;
}

/** « il y a 4 s », « il y a 2 min » — la forme que la planche d'ordinateur écrit. */
function depuis(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `il y a ${String(s)} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `il y a ${String(min)} min`;
  return `il y a ${String(Math.round(min / 60))} h`;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX MODES DE L'ÉDITEUR — UN ÉCRAN, DEUX ENTRÉES                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Fais la fonctionnalité Écrire un guide. » La moitié qui manquait
 * n'était pas l'éditeur — il existe et il est mesuré — c'était la REPRISE : les
 * boutons « Modifier » de la vue auteur étaient morts, et aucune route web ne
 * menait à l'éditeur d'un guide existant.
 *
 * LE MODE EST EXPLICITE ET NON DEVINÉ. Il aurait été tentant de regarder si un
 * slug traîne dans l'adresse ; un mode nommé rend la différence LISIBLE là où
 * elle compte — dans les trois endroits de ce fichier qui s'en servent (le
 * chargement initial, le verrou du titre, le libellé du bouton d'action) — et il
 * garantit que `/guides/nouveau` ne prend AUCUN chemin nouveau : avec
 * `{ kind: 'nouveau' }`, les effets ajoutés par ce lot sortent à leur première
 * ligne.
 *
 * ⚠ CE N'EST PAS UNE AUTORISATION. Le mode dit d'où l'écran s'ouvre, pas ce que
 * le membre peut faire : `guide.write` est en N2 et `loadOwned` refuse à qui n'est
 * pas l'auteur. Un membre qui taperait `/guides/<le guide d'un autre>/modifier`
 * reçoit un `404` ou un `NOT_AUTHOR` du serveur, et l'écran le dit.
 */
export type ModeEditeur =
  | { readonly kind: 'nouveau' }
  | { readonly kind: 'modifier'; readonly slug: string };

/**
 * CE QUE LE SERVEUR ATTEND, DÉRIVÉ DES PRISES DE L'ÉCRAN — une FONCTION et non un
 * `useMemo` seul, parce que DEUX endroits la demandent maintenant.
 *
 * Le second est le chargement d'un guide existant : il doit poser l'empreinte du
 * dernier envoi pour que l'enregistrement automatique ne reparte PAS aussitôt avec
 * ce qu'il vient de lire — un `PATCH` inutile à l'ouverture de chaque guide, qui
 * aurait en plus réveillé la fraîcheur (`lastContentUpdateAt`) d'un guide que
 * personne n'a modifié. Recomposer l'objet à la main là-bas aurait été une seconde
 * source pour la MÊME forme, et les deux auraient divergé à la première clé
 * ajoutée : l'empreinte n'aurait alors plus jamais coïncidé, en silence.
 *
 * ⚠ LES CLÉS FACULTATIVES SONT OMISES, PAS POSÉES À `undefined` :
 * `createGuideSchema` est `.strict()`, le corps part en JSON où `undefined`
 * n'existe pas, et `exactOptionalPropertyTypes` est actif.
 */
function corpsPourApi(v: {
  readonly titre: string;
  readonly corps: string;
  readonly categorie: GuideCategory;
  readonly portee: string;
  readonly ville: string;
}): CreateGuide {
  return {
    title: v.titre.trim(),
    body: v.corps,
    category: v.categorie,
    scope: v.portee === 'UNIVERSAL' ? 'UNIVERSAL' : 'COUNTRY',
    ...(v.portee === 'UNIVERSAL' ? {} : { originCountryId: v.portee }),
    ...(v.ville === '' ? {} : { cityId: v.ville }),
  };
}

/** L'empreinte d'un envoi : le corps du `PATCH` PLUS la page qu'il vise. */
function empreinteDe(patch: CreateGuide, pageId: string | null): string {
  return JSON.stringify({ ...patch, pageId });
}

export interface EditeurGuide {
  readonly titre: string;
  readonly corps: string;
  // ── Les pages du guide (décision du porteur) ───────────────────────────────
  /** Le plan du brouillon, par position croissante. VIDE avant le premier `POST /guides`. */
  readonly pages: readonly GuidePageRef[];
  /** La page dans laquelle `corps` est écrit. `null` avant que le brouillon existe. */
  readonly pageCourante: string | null;
  readonly ajouterPage: () => void;
  readonly choisirPage: (pageId: string) => void;
  readonly renommerPage: (pageId: string, titre: string) => void;
  /**
   * LE RETRAIT PASSE PAR UNE DEMANDE, PAS PAR UN APPEL.
   *
   * Retirer une page EFFACE DU TEXTE ÉCRIT. `demanderRetraitPage` ne fait que
   * nommer la cible ; c'est la page qui monte `FenetreConfirmation` — la même
   * fenêtre que « L'information a changé » du guide, pour la même raison (« un clic
   * malheureux dans une colonne ne doit pas le déclencher »).
   */
  readonly pageARetirer: { readonly id: string; readonly titre: string } | null;
  readonly demanderRetraitPage: (pageId: string) => void;
  readonly confirmerRetraitPage: () => void;
  readonly annulerRetraitPage: () => void;
  readonly categorie: string;
  readonly portee: string;
  readonly ville: string;
  readonly apercuOuvert: boolean;
  readonly brouillon: string;
  readonly brouillonCourt: string;
  readonly peutPublier: boolean;
  readonly motifPublier: string;
  /**
   * LE LIBELLÉ DU BOUTON D'ACTION — « Publier », ou « Enregistrer » sur un guide
   * DÉJÀ PUBLIÉ.
   *
   * MESURÉ sur le serveur : `POST /guides/:id/publish` refuse en
   * `409 CONFLICT {reason: 'ALREADY_PUBLISHED'}` un guide publié, et en
   * `{reason: 'ARCHIVED'}` un guide archivé. Garder « Publier » sur ces deux-là
   * aurait donné un bouton dont le seul effet possible est une erreur.
   *
   * ET IL N'Y A RIEN D'AUTRE À PUBLIER : §2.7 fait paraître la nouvelle version
   * dès le `PATCH` — l'historique est en AJOUT SEUL, `appendVersion` écrit une
   * version de plus et `syncGuideCurrentVersion` la fait courante. Un guide
   * publié qu'on modifie reste publié, et sa nouvelle version paraît sans second
   * geste. Le bouton ENREGISTRE donc ce qui est à l'écran puis ramène au guide.
   *
   * ⚠ LA MAQUETTE N'ÉCRIT QUE « Publier » — elle ne dessine pas la reprise d'un
   * guide publié. Le mot est une décision de produit, prise ici et non dans le
   * transcodeur, exactement comme `pagesTitre` et `ajouterLibelle`. REMONTÉ : il
   * manque à la planche A05 un état « modification d'un guide publié ».
   */
  readonly publierLibelle: string;
  /**
   * LE TITRE NE SE CHANGE PLUS APRÈS LA PUBLICATION, et c'est le SERVEUR qui le
   * dit : `update()` refuse en `409 CONFLICT {reason: 'TITLE_LOCKED_AFTER_PUBLISH'}`
   * dès que le guide n'est plus un brouillon, parce que §2.1 fige le slug — « une
   * adresse qui ne dit plus ce qu'elle contient » — et que ce slug voyage dans les
   * liens déjà partagés.
   *
   * L'écran le DIT plutôt que de laisser le membre taper : sans ce verrou,
   * l'enregistrement automatique partait toutes les 1,5 s avec un titre que le
   * serveur refuse, et le membre voyait une erreur rouge par frappe sur un champ
   * que rien n'éteignait.
   */
  readonly titreVerrouille: boolean;
  /** Vrai pendant la lecture d'un guide existant (mode `modifier` seulement). */
  readonly chargement: boolean;
  readonly imageOccupe: boolean;
  readonly categorieOptions: readonly OptionEditeur[];
  readonly porteeOptions: readonly OptionEditeur[];
  readonly villeOptions: readonly OptionEditeur[];
  readonly categorieLibelle: string;
  readonly porteeLibelle: string;
  readonly villeLibelle: string;
  readonly villeLibelleCourt: string;
  readonly setTitre: (v: string) => void;
  readonly setCorps: (v: string) => void;
  readonly setCategorie: (v: GuideCategory) => void;
  readonly setPortee: (v: string) => void;
  readonly setVille: (v: string) => void;
  readonly setApercu: (v: boolean) => void;
  readonly outil: (marque: string) => void;
  readonly deposerImage: (fichier: File) => void;
  readonly publier: () => void;
  readonly fermer: () => void;
}

export function useEditeurGuide(mode: ModeEditeur = { kind: 'nouveau' }): EditeurGuide {
  const router = useRouter();
  const { pays, villes } = useReferentielsGuides();

  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  /**
   * LA CATÉGORIE PART AVEC UNE VALEUR, et c'est obligatoire : `createGuideSchema`
   * exige `category`, et il n'y a pas de « non renseigné » dans l'énumération. La
   * maquette dessine « Études » — `WORK_STUDIES` — mais elle dessine UN EXEMPLE.
   * On prend la PREMIÈRE de l'énumération du serveur (`PRE_DEPARTURE`, « Avant le
   * départ ») plutôt que l'exemple de la planche : un défaut tiré de l'exemple
   * ferait publier « Travail et études » à qui ne touche pas la boîte, ce qui est
   * un classement faux posé par l'écran.
   */
  const [categorie, setCategorie] = useState<GuideCategory>(GuideCategory[0]);
  /** `UNIVERSAL` par défaut : le seul qui n'exige pas de pays (`countryScopeCoherent`). */
  const [portee, setPortee] = useState('UNIVERSAL');
  const [ville, setVille] = useState('');
  const [apercuOuvert, setApercu] = useState(false);
  const [imageOccupe, setImageOccupe] = useState(false);

  /** L'identifiant du brouillon, dès que `POST /guides` a répondu. */
  const [guideId, setGuideId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES PAGES DU BROUILLON — ET POURQUOI LEURS CORPS VIVENT ICI              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Un guide peut avoir plusieurs pages. […] il faut au niveau de
   * la side bar la possibilité d'ajouter les pages ou d'en retirer. »
   *
   * `pages` est LE PLAN, tel que la dernière réponse d'écriture le rend
   * (`guideEditorResponseSchema.pages`) : c'est ce qui évite de relire le guide
   * après chaque geste, et le contrat existe pour cela.
   *
   * `corps` reste LE CORPS DE LA PAGE COURANTE — une seule chaîne, celle que les
   * deux `<textarea>` montrent. `corpsParPage` garde les AUTRES.
   *
   * ── D'OÙ VIENNENT LES CORPS — UNE CARTE, DEUX FAÇONS DE LA REMPLIR ───────
   *
   * ⚠ CET EN-TÊTE DISAIT LE CONTRAIRE, ET IL AVAIT RAISON À SON ÉPOQUE. Il
   * écrivait : « il n'y a AUCUNE route pour relire le corps d'une page de
   * brouillon sans écrire […] le jour où l'éditeur s'ouvrira sur un guide
   * EXISTANT (“Modifier” depuis la vue auteur), il faudra une route de lecture
   * d'auteur. Cette copie locale ne suffira pas, et elle ne le prétend pas. »
   *
   * CE JOUR EST VENU, et la route existe : `GET /guides/:slug/editor`, capacité
   * `guide.write` (N2), `loadOwned` pour l'accès, et elle rend le guide ET TOUTES
   * SES PAGES AVEC LEUR CORPS — brouillon comme guide publié. Les trois réponses
   * d'écriture continuent de ne porter qu'un corps, celui de la page visée : ce
   * n'est pas une lacune, c'est leur rôle.
   *
   * `corpsParPage` RESTE DONC LA SEULE RÉSERVE DES CORPS, et c'est le point : en
   * mode `nouveau` elle se remplit page par page, au fur et à mesure que l'éditeur
   * les crée ; en mode `modifier` elle est remplie d'un coup par la lecture. Après
   * le premier rendu, rien ne distingue les deux chemins — `choisirPage`,
   * `corpsTotal`, `adopterReponse` et le retrait d'une page lisent la MÊME carte et
   * ignorent d'où elle vient. Il n'y a pas deux sources de vérité ; il y a deux
   * façons de remplir la même.
   *
   * `corps` garde son rôle à part : le corps de LA page en cours de frappe, celui
   * que les deux `<textarea>` montrent. La carte peut en contenir une copie en
   * retard pour cette page-là, sans conséquence — `choisirPage` y range la valeur
   * fraîche avant d'en changer, et `corpsTotal` préfère `corps` pour la page
   * courante.
   *
   * ⚠ NE PAS CONFONDRE AVEC `auServeur` : celle-ci dit ce que le MEMBRE a à
   * l'écran, celle-là ce que le SERVEUR tient. C'est la comparaison des deux qui
   * décide d'un envoi.
   */
  const [pages, setPages] = useState<readonly GuidePageRef[]>([]);
  const [pageCourante, setPageCourante] = useState<string | null>(null);
  const [corpsParPage, setCorpsParPage] = useState<Readonly<Record<string, string>>>({});
  const [pageARetirer, setPageARetirer] = useState<{ id: string; titre: string } | null>(null);
  const [pageEnVol, setPageEnVol] = useState(false);
  /**
   * LES TITRES QUI ATTENDENT LEUR `PATCH`, par identifiant de page.
   *
   * Renommer est une frappe : envoyer à chaque caractère ferait une requête par
   * lettre sur une route limitée à 30 par minute. Le minuteur est le même procédé
   * que l'enregistrement du corps, avec un délai plus court (800 ms) parce qu'un
   * titre est court et qu'on veut le voir pris.
   */
  const [titresEnAttente, setTitresEnAttente] = useState<Readonly<Record<string, string>>>({});
  const [enregistreA, setEnregistreA] = useState<number | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [publication, setPublication] = useState(false);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'ÉTAT DU GUIDE REPRIS — ET LES DEUX CHOSES QU'IL DÉCIDE                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `null` en mode `nouveau` ET tant que la lecture n'a pas répondu : on ne sait
   * pas, et deviner « brouillon » laisserait le membre changer un titre que le
   * serveur refusera.
   *
   * CE QU'IL DÉCIDE, et il ne décide rien d'autre : le VERROU DU TITRE et le
   * LIBELLÉ DU BOUTON. Les deux viennent de la même frontière que le serveur
   * trace — `isDraft = status === 'DRAFT' || status === 'UNPUBLISHED'` dans
   * `update()`. Un `UNPUBLISHED` est donc traité comme un brouillon : son titre se
   * change encore, et « Publier » le republie (`publish()` ne refuse que
   * `PUBLISHED`, `FLAGGED` et `ARCHIVED`).
   */
  const [statut, setStatut] = useState<GuideStatus | null>(null);
  const [chargement, setChargement] = useState(mode.kind === 'modifier');
  /**
   * LE TITRE QUE LE SERVEUR TIENT, pour pouvoir le remettre à l'écran quand il est
   * verrouillé. Une RÉFÉRENCE et non un état : rien ne le dessine, et le faire
   * entrer dans les dépendances de l'enregistrement automatique aurait relancé un
   * minuteur pour une valeur qui ne bouge jamais.
   */
  const titreServeur = useRef('');
  /** Le dernier reproche fait au titre verrouillé, pour ne pas en empiler un par frappe. */
  const dernierRefusTitre = useRef(0);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'ENREGISTREMENT AUTOMATIQUE — UNE PRISE, PAS UN DÉCOR                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La maquette ANNONCE « Brouillon enregistré · il y a 4 s ». L'annoncer sans le
   * faire serait pire que de ne rien annoncer : le membre fermerait l'onglet en
   * croyant son texte à l'abri.
   *
   * ── CE QUI DÉCLENCHE, ET CE QUI RETIENT ──────────────────────────────────
   *
   * Un minuteur de 1,5 s après la dernière frappe. `PATCH /guides/:id` est limitée
   * à 60 appels par minute « et non 30 — l'éditeur enregistre tout seul »
   * (`api.ts`), donc une seconde et demie laisse une marge large. Enregistrer à
   * chaque caractère aurait épuisé la cadence en vingt secondes de frappe.
   *
   * ⚠ LE PREMIER ENREGISTREMENT ATTEND QUE LE TITRE SOIT VALIDE.
   * `createGuideSchema` exige `guideTitleSchema` — 10 caractères au moins — et
   * `guideDraftBodySchema` en exige 1. Lancer `POST /guides` plus tôt donnerait un
   * `400` à chaque frappe des neuf premières lettres, et le membre verrait une
   * erreur pour avoir commencé à écrire. Tant que le titre est trop court,
   * l'étiquette reste VIDE : on ne dit pas « enregistré », et on ne dit pas non
   * plus « pas enregistré », parce que la maquette ne dessine pas cet état.
   *
   * ⚠ ET IL N'Y A QU'UN SEUL `POST`. `creationEnVol` est une RÉFÉRENCE et non un
   * état : deux minuteurs qui se chevauchent auraient créé deux brouillons, et
   * `setGuideId` n'aurait pas encore été appliqué quand le second part. Mesuré en
   * raisonnement sur le cycle de React, et c'est la raison du `useRef`.
   */
  const creationEnVol = useRef(false);
  const dernierEnvoi = useRef('');
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA RÉVISION DONT CET ÉDITEUR PART — LE JETON DE CONCURRENCE              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Arbitrage du porteur : « le serveur refuse une écriture qui ne part pas de la
   * version courante ». `updateGuideSchema` exige donc `baseRevision` DÈS QU'UN
   * CORPS EST ENVOYÉ, et sans ce jeton chaque enregistrement serait refusé à la
   * validation.
   *
   * ⚠ IL SE REMET À JOUR À CHAQUE RÉPONSE, et c'est ce qui empêche la garde de se
   * retourner contre nous : toute écriture incrémente la révision côté serveur, donc
   * un éditeur qui garderait la valeur de son ouverture se ferait refuser par sa
   * PROPRE écriture au deuxième enregistrement. La protection deviendrait un
   * blocage.
   *
   * `useRef` et non `useState` : l'enregistrement automatique lit cette valeur dans
   * un minuteur, hors du cycle de rendu — exactement le raisonnement de
   * `dernierEnvoi` juste au-dessus.
   */
  const revision = useRef(0);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUE LE SERVEUR TIENT DÉJÀ — POUR NE PAS LUI RÉÉCRIRE CE QU'IL A       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `dernierEnvoi` est une empreinte UNIQUE : elle ne décrit que le DERNIER envoi,
   * et elle porte la page. Conséquence MESURÉE au navigateur sur un guide de trois
   * pages : chaque changement de page déclenchait un `PATCH`, parce que l'empreinte
   * de la page qu'on arrive sur n'est jamais celle de la page qu'on quitte. Deux
   * clics dans la barre latérale, deux écritures — sur un guide que personne n'a
   * modifié.
   *
   * ⚠ ET C'ÉTAIT ASSUMÉ TANT QUE L'ÉDITEUR CRÉAIT SES PAGES LUI-MÊME. L'en-tête
   * d'avant le disait : « Une requête de trop à chaque changement de page est
   * préférable à un corps perdu », parce que la seule chose connue était ce qu'on
   * venait d'envoyer. CE N'EST PLUS VRAI : `GET /guides/:slug/editor` rend le corps
   * que le serveur tient POUR CHAQUE PAGE. On peut donc comparer au lieu de
   * deviner, et c'est strictement mieux — un `PATCH` de politesse réécrivait
   * `category`, `scope` et `cityId`, et faisait bouger `guides.updated_at`, donc
   * l'ordre de `GET /me/guides`.
   *
   * ── LE SENS DE L'ERREUR EST CHOISI : EN CAS DE DOUTE, ON ENVOIE ───────────
   *
   * Le saut n'a lieu que si les DEUX comparaisons sont exactes — les champs du
   * guide ET le corps de la page courante. Toute incertitude (page inconnue de la
   * carte, champ modifié, premier rendu) retombe donc sur l'envoi. Un envoi de
   * trop coûte une requête que le serveur transforme en no-op ; un envoi manqué
   * coûte le texte du membre.
   */
  const auServeur = useRef<{ champs: string; corps: Readonly<Record<string, string>> }>({
    champs: '',
    corps: {},
  });

  /** Les champs du GUIDE, corps exclu : ce qui ne dépend pas de la page. */
  const champsDe = useCallback(
    (patch: CreateGuide): string => JSON.stringify({ ...patch, body: '' }),
    [],
  );

  /**
   * CE QU'ON VIENT D'APPRENDRE DE L'ÉTAT DU SERVEUR, après un envoi réussi.
   *
   * La carte des corps est CONSERVÉE et non remplacée : les champs du guide sont
   * globaux, les corps sont par page. Changer la catégorie n'oublie donc pas ce
   * que le serveur tient des quatre autres pages.
   */
  const noterServeur = useCallback(
    (patch: CreateGuide, pageId: string | null, body: string): void => {
      auServeur.current = {
        champs: champsDe(patch),
        corps:
          pageId === null
            ? auServeur.current.corps
            : { ...auServeur.current.corps, [pageId]: body },
      };
    },
    [champsDe],
  );

  /**
   * Ce que le serveur attend, dérivé des prises de l'écran. La forme est composée
   * par `corpsPourApi` — voir son en-tête : le chargement d'un guide existant la
   * demande aussi, et deux compositions voisines auraient divergé.
   *
   * LE TYPE EST `CreateGuide`, pas un objet libre : sans lui, `category` et
   * `scope` seraient des `string` et il aurait fallu un `as` pour les passer —
   * c'est-à-dire éteindre le compilateur à l'endroit précis où deux énumérations
   * du serveur sont en jeu.
   */
  const corpsDuPatch = useMemo<CreateGuide>(
    () => corpsPourApi({ titre, corps, categorie, portee, ville }),
    [titre, corps, categorie, portee, ville],
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ OUVRIR L'ÉDITEUR SUR UN GUIDE EXISTANT — UNE LECTURE, UNE SEULE FOIS     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `GET /guides/:slug/editor` rend le guide ET TOUTES SES PAGES AVEC LEUR CORPS.
   * C'est la route que le lot précédent avait remontée comme manquante, à l'endroit
   * même où son absence se payait : « cette copie locale ne suffira pas, et elle ne
   * le prétend pas ».
   *
   * ── OÙ LES DEUX CHEMINS SE REJOIGNENT, ET C'EST LE POINT ──────────────────
   *
   * `corpsParPage` RESTE LA SEULE RÉSERVE DES CORPS, dans les deux modes. En mode
   * `nouveau`, elle se remplit au fil des pages que l'éditeur crée lui-même ; en
   * mode `modifier`, elle est remplie D'UN COUP par cette lecture. Après ce
   * premier rendu, plus rien ne distingue les deux chemins : `choisirPage`,
   * `corpsTotal`, `adopterReponse` et le retrait d'une page lisent la MÊME carte,
   * et aucun ne sait d'où elle vient. Il n'y a donc pas deux sources de vérité —
   * il y a deux façons de remplir la même, et une seule de la lire.
   *
   * `corps` garde son rôle : le corps de LA page en cours de frappe. La carte en
   * contient une copie éventuellement en retard pour cette page-là, et c'est sans
   * conséquence — `choisirPage` y range la valeur fraîche avant d'en changer, et
   * `corpsTotal` préfère `corps` pour la page courante. C'était déjà l'invariant
   * de cet écran ; ce lot ne l'a pas touché, il l'a seulement alimenté autrement.
   *
   * ── L'EMPREINTE EST POSÉE, SINON L'OUVERTURE ÉCRIRAIT ─────────────────────
   *
   * Sans `dernierEnvoi.current`, l'enregistrement automatique partirait 1,5 s après
   * l'ouverture avec exactement ce qu'il vient de lire : un `PATCH` par guide
   * ouvert. Le serveur en ferait un no-op sur le corps (`bodyChanged` compare), mais
   * pas sur le reste — `category`, `scope`, `cityId` seraient réécrits, et c'est une
   * écriture que personne n'a demandée dans l'`audit_logs`.
   *
   * ── CE QUI N'EST PAS FAIT, ET POURQUOI ────────────────────────────────────
   *
   * ⚠ AUCUNE RELECTURE APRÈS COUP. La lecture est unique : ni intervalle, ni
   * relecture au retour d'onglet. Deux onglets ouverts sur le même guide
   * s'écrasent donc l'un l'autre, et ce n'est PAS corrigé dans ce lot : le module
   * n'a AUCUN jeton de concurrence — `updateGuideSchema` ne porte ni version
   * attendue ni `updatedAt`, et `update()` écrase sans comparer. L'inventer ici
   * aurait voulu dire inventer aussi un refus côté serveur, c'est-à-dire une règle
   * métier. REMONTÉ au porteur, mesuré dans le rapport du lot.
   */
  useEffect(() => {
    if (mode.kind !== 'modifier') return undefined;
    const arret = new AbortController();
    setChargement(true);
    void fetchGuideEditeur(mode.slug, arret.signal)
      .then((r) => {
        /** La page 1 — celle que `currentPage` désigne — est celle qu'on ouvre. */
        const premiere = r.pages.find((page) => page.id === r.currentPage.id) ?? r.pages[0];
        const corpsLu = premiere?.body ?? '';
        const porteeLue = r.scope === 'UNIVERSAL' ? 'UNIVERSAL' : (r.originCountryId ?? '');
        const villeLue = r.city?.id ?? '';
        setGuideId(r.id);
        setSlug(r.slug);
        setStatut(r.status);
        /** Le jeton de concurrence, dès l'ouverture : voir `revision`. */
        revision.current = r.revision;
        titreServeur.current = r.title;
        setTitre(r.title);
        setCategorie(r.category);
        setPortee(porteeLue);
        setVille(villeLue);
        setPages(r.pages);
        setPageCourante(premiere?.id ?? null);
        setCorps(corpsLu);
        setCorpsParPage(Object.fromEntries(r.pages.map((page) => [page.id, page.body])));
        const patchLu = corpsPourApi({
          titre: r.title,
          corps: corpsLu,
          categorie: r.category,
          portee: porteeLue,
          ville: villeLue,
        });
        dernierEnvoi.current = empreinteDe(patchLu, premiere?.id ?? null);
        /**
         * ET C'EST ICI QUE L'ÉDITEUR APPREND CE QUE LE SERVEUR TIENT — pour les
         * CINQ pages d'un coup, et non pour la seule qu'il vient d'ouvrir. C'est
         * ce qui rend les changements de page muets : voir `auServeur`.
         */
        auServeur.current = {
          champs: champsDe(patchLu),
          corps: Object.fromEntries(r.pages.map((page) => [page.id, page.body])),
        };
      })
      .catch((cause: unknown) => {
        if (arret.signal.aborted) return;
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'Ce guide n’a pas pu être ouvert pour modification.',
        );
      })
      .finally(() => {
        if (!arret.signal.aborted) setChargement(false);
      });
    return () => {
      arret.abort();
    };
    /**
     * LES DEUX SEULES DÉPENDANCES SONT CELLES DU MODE, et ce sont des CHAÎNES.
     *
     * `mode` est un objet littéral recomposé à chaque rendu par la page qui monte
     * l'écran (`<EditeurGuideEcran mode={{ kind: 'modifier', slug }} />`) : le
     * mettre en dépendance aurait relu le guide à CHAQUE rendu, c'est-à-dire à
     * chaque frappe. Ses deux champs, eux, ne changent pas.
     *
     * ⚠ `champsDe` ET `noterServeur` N'Y SONT PAS, ET C'EST VOULU : les deux sont
     * stables (`useCallback` sans dépendance mouvante), et les ajouter n'aurait
     * rien changé — mais les NOMMER ici laisserait croire qu'une relecture peut
     * être déclenchée par autre chose que le mode. Ce dépôt n'a pas la règle
     * `react-hooks/exhaustive-deps` : c'est donc ce commentaire qui tient la
     * promesse, et il faut le relire si la liste change.
     */
  }, [mode.kind, mode.kind === 'modifier' ? mode.slug : '']);

  useEffect(() => {
    const t = titre.trim();
    /**
     * LES DEUX BORNES DU BROUILLON, et ce sont celles du serveur : le titre doit
     * être valide (`guideTitleSchema`), le corps doit avoir au moins un caractère
     * (`guideDraftBodySchema`).
     */
    if (!guideTitleSchema.safeParse(t).success || corps.length === 0) return undefined;
    /**
     * ⚠ EN MODE `modifier`, PAS DE `POST`. Sans cette ligne, un guide qui ne
     * s'ouvre pas (404, `NOT_AUTHOR`, réseau coupé) laisserait `guideId` à `null`,
     * et la première frappe aurait CRÉÉ UN SECOND GUIDE depuis l'écran de
     * modification du premier. L'éditeur n'a le droit de créer que là où la page
     * le dit : `/guides/nouveau`.
     */
    if (mode.kind === 'modifier' && guideId === null) return undefined;
    /**
     * Rien n'a changé depuis le dernier envoi : pas d'appel.
     *
     * ⚠ L'EMPREINTE PORTE LA PAGE, et il le faut : le même corps dans une AUTRE
     * page est un autre enregistrement. Sans elle, passer de la page 2 à la page 3
     * alors que les deux portent le même texte n'aurait rien envoyé — et la page 3
     * serait restée vide côté serveur.
     *
     * ⚠ MAIS ELLE NE SUFFIT PLUS, ET C'EST UN DÉFAUT MESURÉ. L'en-tête d'avant
     * disait : « changer de page déclenche un `PATCH` même si rien n'a été tapé […]
     * une requête de trop est préférable à un corps perdu ». Vrai quand la seule
     * chose connue était le dernier envoi ; faux depuis que l'ouverture lit le
     * corps de CHAQUE page. Voir `auServeur` : le second contrôle compare ce qui est
     * à l'écran à ce que le serveur TIENT, page par page, et deux clics dans la
     * barre latérale n'écrivent plus rien.
     */
    const empreinte = empreinteDe(corpsDuPatch, pageCourante);
    if (empreinte === dernierEnvoi.current) return undefined;
    /**
     * LE SERVEUR TIENT DÉJÀ EXACTEMENT CELA — champs du guide ET corps de cette
     * page. Rien à écrire, et l'empreinte est posée pour que le contrôle ci-dessus
     * suffise aux rendus suivants.
     */
    if (
      pageCourante !== null &&
      auServeur.current.champs === champsDe(corpsDuPatch) &&
      auServeur.current.corps[pageCourante] === corps
    ) {
      dernierEnvoi.current = empreinte;
      return undefined;
    }
    /**
     * ⚠ UN CORPS QUE LE SERVEUR REFUSERA NE PART PAS. `guideDraftBodySchema`
     * porte `restrictedMarkdown` : du HTML, un titre de niveau 1 ou une image
     * externe donnent un `400 VALIDATION_FAILED`. Pendant que le membre tape
     * `<`, le corps est momentanément invalide — enregistrer alors afficherait
     * une erreur rouge sur une frappe en cours. On SAUTE l'enregistrement et on
     * le reprend dès que le corps redevient valide ; la publication, elle, le
     * dira (voir `motifPublier`).
     */
    if (restrictedMarkdownIssue(corps) !== null) return undefined;

    const minuteur = setTimeout(() => {
      if (creationEnVol.current) return;
      dernierEnvoi.current = empreinte;
      setEnregistrement(true);
      const fini = (): void => {
        setEnregistrement(false);
      };
      const rate = (cause: unknown): void => {
        /** Le prochain changement RÉESSAIERA : l'empreinte est effacée. */
        dernierEnvoi.current = '';
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'Le brouillon n’a pas pu être enregistré. Votre texte est toujours à l’écran.',
        );
      };
      if (guideId === null) {
        creationEnVol.current = true;
        void createDraft(corpsDuPatch)
          .then((cree) => {
            setGuideId(cree.id);
            setSlug(cree.slug);
            setEnregistreA(Date.now());
            /**
             * LE BROUILLON NAÎT AVEC UNE PAGE, et c'est le serveur qui la crée :
             * `POST /guides` rend `pages` (un élément) et `currentPage`. On
             * l'adopte au lieu de la deviner — son identifiant est la clé de tous
             * les enregistrements suivants.
             */
            setPages(cree.pages);
            setPageCourante(cree.currentPage.id);
            /** Ce que le serveur tient désormais : ces champs, et ce corps dans cette page. */
            noterServeur(corpsDuPatch, cree.currentPage.id, corps);
          })
          .catch(rate)
          .finally(() => {
            creationEnVol.current = false;
            fini();
          });
        return;
      }
      /**
       * ⚠ `pageId` DIT DANS QUELLE PAGE LE CORPS VA. Absent, le serveur écrirait
       * dans la PREMIÈRE — c'est sa règle de compatibilité, et c'est exactement le
       * défaut qu'il faut éviter ici : l'auteur taperait dans sa page 3 et le texte
       * atterrirait dans la page 1, sans aucune erreur.
       *
       * LA CLÉ EST OMISE quand il n'y a pas encore de page courante : `.strict()`
       * refuse un `undefined`, et le corps part en JSON où il n'existe pas.
       */
      void updateGuide(guideId, {
        ...corpsDuPatch,
        /** Le jeton de concurrence — exigé dès qu'un corps part. Voir `revision`. */
        baseRevision: revision.current,
        ...(pageCourante === null ? {} : { pageId: pageCourante }),
      })
        .then((r) => {
          revision.current = r.revision;
          setEnregistreA(Date.now());
          noterServeur(corpsDuPatch, pageCourante, corps);
        })
        .catch(rate)
        .finally(fini);
    }, 1500);

    return () => {
      clearTimeout(minuteur);
    };
  }, [titre, corps, corpsDuPatch, guideId, pageCourante, mode.kind, champsDe, noterServeur]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE TITRE D'UN GUIDE PUBLIÉ NE BOUGE PLUS — ET L'ÉCRAN LE DIT             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * LA FRONTIÈRE EST CELLE DU SERVEUR, mot pour mot : `update()` calcule
   * `isDraft = status === 'DRAFT' || status === 'UNPUBLISHED'` et refuse tout autre
   * titre en `409 CONFLICT {reason: 'TITLE_LOCKED_AFTER_PUBLISH'}`. On ne recopie
   * donc pas une liste de statuts « publiés » : on prend le complément des deux que
   * le serveur appelle brouillon.
   *
   * `statut === null` (mode `nouveau`, ou lecture en cours) laisse le titre LIBRE :
   * un champ éteint le temps d'une requête serait un champ qui refuse la frappe
   * sans raison visible.
   */
  const titreVerrouille = statut !== null && statut !== 'DRAFT' && statut !== 'UNPUBLISHED';

  /**
   * LE GUIDE A DÉJÀ PARU — donc le bouton d'action ENREGISTRE au lieu de publier.
   *
   * C'EST LA MÊME FRONTIÈRE QUE LE VERROU DU TITRE, et ce n'est pas une
   * coïncidence : les deux découlent du seul fait « ce guide est sorti ». Deux
   * booléens plutôt qu'un, parce qu'ils répondent à deux questions que rien
   * n'oblige à rester liées — le jour où §2.1 autorise un renommage, l'un bouge
   * sans l'autre, et le compilateur montrera les deux endroits.
   *
   * ⚠ `ARCHIVED` TOMBE ICI AUSSI, et c'est voulu : `publish()` le refuse en
   * `409 CONFLICT {reason: 'ARCHIVED'}`, alors que `update()` l'accepte. Un bouton
   * « Publier » sur un guide archivé n'aurait eu qu'un seul effet possible : une
   * erreur.
   */
  const dejaPublie = titreVerrouille;

  /**
   * UNE SEULE PHRASE PAR CINQ SECONDES, et c'est mesurable : le champ ne change
   * pas quand il est verrouillé, donc CHAQUE frappe est une nouvelle tentative.
   * Sans ce frein, taper trois lettres empilait trois notifications identiques.
   */
  const changerTitre = useCallback(
    (v: string): void => {
      if (!titreVerrouille) {
        setTitre(v);
        return;
      }
      if (v === titreServeur.current) return;
      const maintenant = Date.now();
      if (maintenant - dernierRefusTitre.current < 5000) return;
      dernierRefusTitre.current = maintenant;
      notifyError(
        'Le titre d’un guide publié ne change plus : son adresse voyage dans les liens déjà partagés. Le reste du guide, lui, se modifie librement.',
      );
    },
    [titreVerrouille],
  );

  /**
   * L'HORLOGE DE L'ÉTIQUETTE.
   *
   * « il y a 4 s » est un DÉLAI : sans tic, il resterait figé sur la valeur du
   * rendu où l'enregistrement a abouti, et dirait « il y a 0 s » une heure plus
   * tard. Le tic est de cinq secondes — assez fin pour que la phrase soit juste,
   * assez large pour ne pas redessiner la page vingt fois par minute.
   */
  const [tic, setTic] = useState(0);
  useEffect(() => {
    if (enregistreA === null) return undefined;
    const horloge = setInterval(() => {
      setTic((n) => n + 1);
    }, 5000);
    return () => {
      clearInterval(horloge);
    };
  }, [enregistreA]);

  const brouillon = useMemo(() => {
    void tic;
    if (enregistrement) return 'Enregistrement…';
    if (enregistreA === null) return '';
    return `Brouillon enregistré · ${depuis(Date.now() - enregistreA)}`;
  }, [enregistrement, enregistreA, tic]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « PUBLIER » DIT POURQUOI IL EST ÉTEINT                                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Exigence 2 du lot, mot pour mot : « Les deux bornes du corps sont différentes
   * (brouillon : 1 caractère ; publication : 300). Le bouton “Publier” doit dire
   * pourquoi il est éteint plutôt que de l'être en silence — le dépôt fait déjà ça
   * sur le panneau de correction (motif obligatoire). »
   *
   * Les motifs sont rangés DU PLUS EN AMONT AU PLUS EN AVAL : on ne reproche pas
   * un corps trop court à qui n'a pas encore de titre. Chacun est calculé par le
   * schéma QUE LE SERVEUR EMPLOIERA — `guideTitleSchema` et
   * `guidePublishableBodySchema` — et non par un nombre recopié.
   */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE TOTAL PUBLIABLE — LE MÊME ASSEMBLAGE QUE LE SERVEUR, PAS UN VOISIN    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `joinGuidePageBodies` VIENT DE `@app/shared`, et c'est la fonction MÊME que
   * `publish()` appelle : corps non vides, dans l'ordre de `position`, séparés par
   * une ligne vide. Le partager est écrit noir sur blanc à côté d'elle — « le
   * serveur mesure la longueur publiable et l'éditeur annonce “il vous reste N
   * caractères” ; deux assemblages différents donneraient deux nombres différents
   * pour la même règle, et c'est l'écran qui mentirait ».
   *
   * ⚠ C'EST LA CORRECTION D'UN DÉFAUT RÉEL, pas une symétrie de principe : le
   * motif de publication mesurait `corps.length`, c'est-à-dire LA PAGE COURANTE
   * SEULE. Un guide de trois pages de 150 caractères — 450 au total, publiable —
   * aurait affiché « Il faut au moins 300 caractères pour publier (le corps en a
   * 150) » sur un bouton que le serveur aurait accepté. Et dans l'autre sens, un
   * guide dont la page 1 fait 400 caractères et les deux autres rien aurait allumé
   * le bouton alors que… non : le serveur l'accepte aussi, le total faisant 400.
   * Le défaut était donc à sens unique, et il refusait des guides valides.
   */
  const corpsTotal = useMemo(
    () =>
      joinGuidePageBodies(
        pages.length === 0
          ? [corps]
          : pages.map((page) =>
              page.id === pageCourante ? corps : (corpsParPage[page.id] ?? ''),
            ),
      ),
    [pages, pageCourante, corps, corpsParPage],
  );

  const motifPublier = useMemo(() => {
    const t = titre.trim();
    if (t.length < GUIDE_TITLE_MIN) {
      return `Donnez un titre d’au moins ${String(GUIDE_TITLE_MIN)} caractères (il en a ${String(t.length)}).`;
    }
    if (t.length > GUIDE_TITLE_MAX) {
      return `Le titre dépasse ${String(GUIDE_TITLE_MAX)} caractères.`;
    }
    /**
     * ⚠ LA RÈGLE DURE DU MOT « CERTIFIÉ » N'EST PAS TESTÉE ICI, et c'est dit
     * plutôt que bricolé : §2.1 la fait tenir par le SERVEUR, avec un code propre
     * (`FORBIDDEN_WORD`), et `guideTitleSchema` ne la porte pas. La recopier dans
     * le front aurait fait une seconde source pour une règle de modération — et
     * le panneau « AVANT DE PUBLIER » de la maquette la rappelle déjà au membre.
     */
    /**
     * LA GRAMMAIRE EST RELUE SUR LE TOTAL, et le schéma du serveur le fait aussi
     * (`guidePublishableGuideBodySchema` est un `restrictedMarkdown`) : une page
     * écrite avant qu'une règle ne se durcisse serait passée à l'époque.
     * ⚠ LE MESSAGE NE DIT PAS DANS QUELLE PAGE est la faute, et c'est un ÉCART
     * REMONTÉ : il faudrait un repère par page dans la carte latérale, que la
     * planche empruntée ne dessine pas.
     */
    const issue = restrictedMarkdownIssue(corpsTotal);
    if (issue === 'HTML') return 'Le HTML n’est pas autorisé : employez le Markdown.';
    if (issue === 'HEADING_LEVEL') {
      return 'Seuls les titres de niveau 2 (##) et 3 (###) sont autorisés.';
    }
    if (issue === 'IMAGE_EXTERNAL') {
      return 'Une image doit être déposée par le bouton image de l’éditeur.';
    }
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LES 300 CARACTÈRES SONT UNE BORNE DE PUBLICATION, PAS D'ENREGISTREMENT ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * MESURÉ sur le serveur : `publish()` mesure le total publiable par
     * `guidePublishableGuideBodySchema`, tandis que `PATCH /guides/:id` passe par
     * `guideDraftBodySchema`, dont le minimum est 1. Sur un guide DÉJÀ PUBLIÉ, le
     * bouton n'appelle plus `publish` — il enregistre, et la nouvelle version
     * paraît (§2.7, historique en ajout seul). Exiger 300 caractères y aurait
     * éteint un bouton que le serveur accepte, et empêché un auteur de RACCOURCIR
     * son guide publié.
     *
     * Les contrôles AU-DESSUS, eux, restent : le titre, la grammaire Markdown et
     * le maximum par page valent pour le `PATCH` autant que pour la publication,
     * parce que c'est le même schéma de corps qui les porte.
     */
    if (!dejaPublie && corpsTotal.length < GUIDE_BODY_MIN) {
      return `Il faut au moins ${String(GUIDE_BODY_MIN)} caractères pour publier (le guide en a ${String(corpsTotal.length)}, toutes pages confondues).`;
    }
    /**
     * ⚠ LE MAXIMUM EST PAR PAGE, PAS AU TOTAL, et c'est le serveur qui le dit :
     * `guidePublishableGuideBodySchema` N'A PAS de maximum — « l'appliquer au total
     * ramènerait un guide de dix pages à la taille d'un guide d'une page ». C'est
     * donc `corps`, la page courante, qu'on mesure ici, et `guideDraftBodySchema`
     * l'a déjà refusée à chaque `PATCH` si elle débordait.
     */
    if (corps.length > GUIDE_BODY_MAX) {
      return `Cette page dépasse ${String(GUIDE_BODY_MAX)} caractères.`;
    }
    if (!dejaPublie && !guidePublishableGuideBodySchema.safeParse(corpsTotal).success) {
      return 'Le guide ne peut pas être publié en l’état.';
    }
    if (portee !== 'UNIVERSAL' && pays.every((p) => p.id !== portee)) {
      return 'Choisissez le pays de la portée.';
    }
    /**
     * ⚠ LE GUIDE DOIT EXISTER : `POST /guides/:id/publish` comme
     * `PATCH /guides/:id` ont besoin d'un identifiant. En mode `nouveau` c'est
     * l'enregistrement automatique qui le donne (le membre n'a rien à faire, il
     * suffit d'attendre une seconde et demie) ; en mode `modifier` c'est la
     * lecture du guide. Les deux attentes sont courtes, et le bouton les DIT
     * plutôt que de ne rien faire.
     */
    if (guideId === null) {
      return mode.kind === 'modifier'
        ? 'Lecture du guide en cours…'
        : 'Enregistrement du brouillon en cours…';
    }
    if (publication) return dejaPublie ? 'Enregistrement en cours…' : 'Publication en cours…';
    return '';
  }, [titre, corps, corpsTotal, portee, pays, guideId, publication, dejaPublie, mode.kind]);

  const publier = useCallback((): void => {
    if (motifPublier !== '') {
      /**
       * LE BOUTON RESTE ATTEIGNABLE (`aria-disabled`, pas `disabled`) et le clic
       * DIT POURQUOI. C'est l'autre moitié de l'exigence : un bouton éteint qui
       * n'explique rien au doigt — un `title` ne se survole pas sur un téléphone
       * — laisse le membre devant un contrôle muet.
       */
      notifyError(motifPublier);
      return;
    }
    if (guideId === null || publication) return;
    setPublication(true);
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ PUBLIER ENREGISTRE D'ABORD — ET CE N'EST PAS UNE PRÉCAUTION           ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * MESURÉ AU NAVIGATEUR, et le défaut était net : à 1 440 px, un corps porté
     * de 299 à 500 caractères allumait le bouton — le compte local est juste — et
     * `POST /guides/:id/publish` répondait
     * `400 VALIDATION_FAILED {"path":"body","code":"TOO_SMALL"}`.
     *
     * LA CAUSE : l'enregistrement automatique attend 1,5 s après la dernière
     * frappe, et le bouton, lui, s'allume AU CARACTÈRE. Entre les deux, le
     * serveur tient encore la version d'avant — 299 caractères — et c'est SUR
     * ELLE qu'il juge la publication, puisque `publish` ne reçoit aucun corps.
     *
     * Le symptôme n'accusait pas sa cause : on lit « le corps est trop court » sur
     * un écran qui en affiche 500. Et l'attendre en éteignant le bouton aurait été
     * pire — il faudrait deviner quand l'enregistrement a eu lieu, et le membre
     * verrait un bouton qui clignote.
     *
     * ON ENVOIE DONC CE QUI EST À L'ÉCRAN, puis on publie. C'est aussi ce qu'un
     * membre attend d'un bouton « Publier » : il publie ce qu'il voit, pas ce
     * qu'un minuteur a eu le temps d'envoyer.
     */
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ DÉFAUT MESURÉ ET CORRIGÉ : CE `PATCH` ÉCRIVAIT DANS LA PAGE 1         ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Il envoyait `corpsDuPatch` NU, c'est-à-dire SANS `pageId`. Or la règle de
     * compatibilité du serveur est écrite noir sur blanc dans `updateGuideSchema` :
     * « Absent → LA PREMIÈRE page ». Conséquence, sur un guide de trois pages :
     * l'auteur écrit sa page 3, clique « Publier », et le texte de la page 3
     * ÉCRASE celui de la page 1 — sans aucune erreur, et la page 3 reste telle
     * qu'elle était. Deux pages fausses d'un seul clic.
     *
     * L'enregistrement automatique, lui, nommait déjà sa page (voir son en-tête) ;
     * ce chemin-ci avait été oublié. C'est LA MÊME famille d'erreur que
     * `decideProposal` avait coûtée côté serveur — « écrivait dans la mauvaise
     * page » —, ce qui achève de dire que `pageId` n'est pas une précaution.
     *
     * LA CLÉ EST OMISE quand il n'y a pas encore de page courante : `.strict()`
     * refuse un `undefined`.
     */
    const patch: UpdateGuide = {
      ...corpsDuPatch,
      ...(pageCourante === null ? {} : { pageId: pageCourante }),
    };
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ UN GUIDE DÉJÀ PARU N'EST PAS REPUBLIÉ — IL EST ENREGISTRÉ             ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * `POST /guides/:id/publish` refuse un guide `PUBLISHED` en
     * `409 CONFLICT {reason: 'ALREADY_PUBLISHED'}` : l'appeler aurait fait d'un
     * enregistrement réussi une erreur affichée. Et il n'y a rien à republier —
     * §2.7 : `update()` AJOUTE une version et la rend courante, donc la nouvelle
     * version paraît dès le `PATCH`. Le guide reste publié, son slug ne bouge pas,
     * et son `lastContentUpdateAt` le fait remonter au classement (§2.3).
     */
    if (dejaPublie) {
      void updateGuide(guideId, { ...patch, baseRevision: revision.current })
        .then((r) => {
          revision.current = r.revision;
          dernierEnvoi.current = empreinteDe(corpsDuPatch, pageCourante);
          noterServeur(corpsDuPatch, pageCourante, corps);
          setEnregistreA(Date.now());
          notifySuccess('Guide mis à jour. La nouvelle version est en ligne.');
          router.push(`/guides/${encodeURIComponent(slug ?? '')}`);
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError
              ? cause.displayMessage
              : 'La mise à jour n’a pas abouti. Votre texte est toujours à l’écran.',
          );
        })
        .finally(() => {
          setPublication(false);
        });
      return;
    }
    void updateGuide(guideId, { ...patch, baseRevision: revision.current })
      .then((r) => {
        revision.current = r.revision;
        dernierEnvoi.current = empreinteDe(corpsDuPatch, pageCourante);
        noterServeur(corpsDuPatch, pageCourante, corps);
        setEnregistreA(Date.now());
        return publishGuide(guideId);
      })
      .then((publie) => {
        notifySuccess('Guide publié.');
        /**
         * ON OUVRE LE GUIDE PUBLIÉ, par son SLUG — que `POST /guides/:id/publish`
         * rend, et qui est figé à la publication (§2.1, « jamais modifié »). Le
         * slug du BROUILLON est celui qu'on garde en repli : les deux coïncident,
         * mais c'est la réponse de la publication qui fait foi.
         */
        router.push(`/guides/${encodeURIComponent(publie.slug ?? slug ?? '')}`);
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'La publication n’a pas abouti. Votre brouillon est enregistré.',
        );
      })
      .finally(() => {
        setPublication(false);
      });
  }, [
    motifPublier,
    guideId,
    publication,
    router,
    slug,
    corpsDuPatch,
    corps,
    pageCourante,
    dejaPublie,
    noterServeur,
  ]);

  // ── Les pages du guide ─────────────────────────────────────────────────────

  /**
   * CE QUE TOUTE RÉPONSE D'ÉCRITURE DE PAGE NOUS APPREND.
   *
   * Les trois routes de page rendent `guideEditorResponseSchema` — `pages`,
   * `currentPage` et la `currentVersion` DE CETTE PAGE —, et le contrat dit
   * pourquoi : « une réponse qui ne dit pas l'état des pages après avoir ajouté,
   * déplacé ou retiré une page obligerait l'éditeur à relire le guide juste après
   * chaque geste ». On l'adopte donc en entier, au lieu de recalculer.
   */
  const adopterReponse = useCallback(
    (r: GuideEditorResponse, viser: 'currentPage' | 'garder'): void => {
      setPages(r.pages);
      /**
       * LE JETON SUIT TOUTE RÉPONSE, y compris `'garder'` : un ajout ou un retrait
       * de page est une écriture, donc il fait bouger la révision. L'oublier ici
       * ferait refuser l'enregistrement suivant du corps.
       */
      revision.current = r.revision;
      if (viser === 'garder') return;
      /** Le corps de la page courante est rangé avant d'en changer : rien ne se perd. */
      setCorpsParPage((m) => ({
        ...m,
        ...(pageCourante === null ? {} : { [pageCourante]: corps }),
      }));
      setPageCourante(r.currentPage.id);
      setCorps(r.currentVersion?.body ?? corpsParPage[r.currentPage.id] ?? '');
      /**
       * CE QUE LE SERVEUR TIENT DE LA PAGE VISÉE, et il vient de le dire :
       * `currentVersion` est la version courante DE CETTE PAGE, et `null` sur une
       * page qui vient de naître sans corps (`POST /pages` rend `body`
       * facultatif). Sans cette ligne, le premier rendu après un ajout aurait
       * comparé le corps de l'écran à une entrée absente et envoyé un `PATCH`
       * pour rien. Voir `auServeur`.
       */
      noterServeur(corpsDuPatch, r.currentPage.id, r.currentVersion?.body ?? '');
    },
    [pageCourante, corps, corpsParPage, corpsDuPatch, noterServeur],
  );

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ AJOUTER UNE PAGE — ET LE TITRE QU'ELLE PORTE EN NAISSANT                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `createGuidePageSchema` EXIGE UN TITRE (`GUIDE_PAGE_TITLE_MIN` = 2) : une page
   * sans nom n'existe pas, parce que son titre est l'intertitre que le lecteur voit
   * dans le plan. La maquette, elle, ne dessine AUCUNE boîte de dialogue pour le
   * demander — ni ici, ni dans le « MODE MODIFIER LES ÉTAPES » du parcours dont la
   * carte est empruntée (son lien d'ajout ajoute une ligne, point).
   *
   * LA PAGE NAÎT DONC NOMMÉE, et son nom est RENOMMABLE SUR PLACE — le champ de la
   * ligne est là pour cela. C'est le geste que la maquette décrit : on ajoute un
   * cadre, puis on le remplit. Demander le titre AVANT aurait exigé une fenêtre que
   * personne n'a dessinée.
   *
   * « Page N » et non « Nouvelle page » : le numéro distingue deux pages ajoutées
   * de suite, ce qu'un libellé fixe ne fait pas — et c'est la position réelle,
   * puisque la page naît TOUJOURS en dernier (`POST /pages` n'accepte pas
   * `position`).
   *
   * ⚠ IL FAUT UN BROUILLON. `POST /guides/:id/pages` a besoin d'un identifiant, et
   * c'est l'enregistrement automatique qui le donne — après un titre valide et un
   * caractère de corps. Le bouton le DIT plutôt que de ne rien faire, exactement
   * comme « Publier ».
   */
  const ajouterPage = useCallback((): void => {
    if (guideId === null) {
      notifyError(
        'Écrivez d’abord le titre et les premières lignes de votre guide : la page se crée dès que le brouillon est enregistré.',
      );
      return;
    }
    if (pageEnVol) return;
    setPageEnVol(true);
    void createGuidePage(guideId, { title: `Page ${String(pages.length + 1)}` })
      .then((r) => {
        adopterReponse(r, 'currentPage');
        notifySuccess('Page ajoutée. Donnez-lui son titre, puis écrivez-la.');
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'La page n’a pas pu être ajoutée. Réessayez dans un instant.',
        );
      })
      .finally(() => {
        setPageEnVol(false);
      });
  }, [guideId, pageEnVol, pages.length, adopterReponse]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CHANGER DE PAGE — LE CORPS SUIT, ET IL NE SE PERD PAS                    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le corps de la page qu'on quitte est RANGÉ dans `corpsParPage` avant que
   * `corps` ne change de valeur. Sans cela, quitter une page avant que
   * l'enregistrement automatique n'ait tourné (1,5 s après la dernière frappe)
   * aurait effacé ce qui vient d'être tapé — le défaut le plus coûteux de cet
   * écran, parce qu'il ne se voit qu'en revenant.
   *
   * ⚠ ET L'ENREGISTREMENT PART QUAND MÊME : l'empreinte porte la page (voir plus
   * haut), donc le minuteur en cours est annulé par le changement de dépendances et
   * un nouveau part pour la NOUVELLE page. Le texte quitté n'est donc enregistré que
   * s'il l'avait déjà été — ce qui est le cas dès 1,5 s d'arrêt de frappe — ou au
   * retour sur cette page. REMONTÉ : un envoi immédiat au changement de page serait
   * plus sûr, et il demande une écriture hors minuteur que ce lot n'a pas faite.
   */
  const choisirPage = useCallback(
    (pageId: string): void => {
      if (pageId === pageCourante) return;
      if (!pages.some((page) => page.id === pageId)) return;
      setCorpsParPage((m) => ({
        ...m,
        ...(pageCourante === null ? {} : { [pageCourante]: corps }),
      }));
      setPageCourante(pageId);
      setCorps(corpsParPage[pageId] ?? '');
    },
    [pageCourante, pages, corps, corpsParPage],
  );

  /**
   * RENOMMER UNE PAGE — vu tout de suite, envoyé après 800 ms.
   *
   * L'affichage est LOCAL et immédiat : un champ qui attendrait la réponse du
   * serveur pour montrer la lettre qu'on vient de taper serait inutilisable.
   * L'envoi, lui, est différé — voir `titresEnAttente`.
   */
  const renommerPage = useCallback((pageId: string, titrePage: string): void => {
    setPages((liste) =>
      liste.map((page) => (page.id === pageId ? { ...page, title: titrePage } : page)),
    );
    setTitresEnAttente((m) => ({ ...m, [pageId]: titrePage }));
  }, []);

  /**
   * L'ENVOI DIFFÉRÉ DES TITRES.
   *
   * ⚠ UN TITRE INVALIDE NE PART PAS. `guidePageTitleSchema` exige 2 caractères :
   * pendant qu'on efface un titre pour le réécrire, il passe par une lettre puis
   * par rien. Envoyer alors afficherait une erreur rouge sur une frappe en cours —
   * c'est la même règle que l'enregistrement du corps applique déjà au Markdown
   * momentanément invalide. Le titre reste à l'écran et partira dès qu'il sera
   * valide ; s'il ne l'est jamais, c'est l'ancien qui reste côté serveur.
   */
  useEffect(() => {
    const enAttente = Object.entries(titresEnAttente);
    if (guideId === null || enAttente.length === 0) return undefined;
    const minuteur = setTimeout(() => {
      setTitresEnAttente({});
      for (const [pageId, titrePage] of enAttente) {
        if (!guidePageTitleSchema.safeParse(titrePage).success) continue;
        void updateGuidePage(guideId, pageId, { title: titrePage.trim() }).catch(
          (cause: unknown) => {
            notifyError(
              cause instanceof ApiError
                ? cause.displayMessage
                : 'Le titre de la page n’a pas pu être enregistré.',
            );
          },
        );
      }
    }, 800);
    return () => {
      clearTimeout(minuteur);
    };
  }, [titresEnAttente, guideId]);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ RETIRER UNE PAGE — ON DEMANDE, PARCE QUE DU TEXTE DISPARAÎT              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La corbeille ne retire pas : elle NOMME la cible, et la page monte
   * `FenetreConfirmation` — la même fenêtre que « L'information a changé » du
   * guide, et le même raisonnement : « un clic malheureux ne doit pas le
   * déclencher ». La maquette dessine cette fenêtre (c'est le composant
   * `components/fenetre-confirmation.tsx`), donc rien n'est inventé.
   */
  const demanderRetraitPage = useCallback(
    (pageId: string): void => {
      const cible = pages.find((page) => page.id === pageId);
      if (cible === undefined) return;
      setPageARetirer({ id: cible.id, titre: cible.title });
    },
    [pages],
  );

  const annulerRetraitPage = useCallback((): void => {
    setPageARetirer(null);
  }, []);

  /**
   * ⚠ `409 LAST_PAGE` EST UN REFUS MÉTIER, PAS UNE PANNE.
   *
   * ON DÉCIDE SUR LE CODE, jamais sur le message (00 §5.2) — et LE MESSAGE EST
   * CELUI DU PRODUIT : `GUIDE_ERROR_MESSAGES.LAST_PAGE` (dans `@app/shared`, donc
   * la même phrase que le serveur rend) dit « Un guide garde au moins une page.
   * Ajoutez-en une autre avant de retirer celle-ci, ou supprimez le guide. » Le
   * recopier ici en aurait fait une seconde source ; `displayMessage` rend celle du
   * serveur quand elle existe, et c'est le chemin que tout ce dépôt emploie.
   *
   * LA PAGE COURANTE EST GARDÉE quand ce n'est pas elle qu'on retire. `removePage`
   * rend `currentPage` = la PREMIÈRE page (il n'a pas de page à viser), donc
   * adopter sa réponse telle quelle aurait ramené l'auteur en page 1 chaque fois
   * qu'il retire une autre page — un saut qu'il n'a pas demandé.
   */
  const confirmerRetraitPage = useCallback((): void => {
    const cible = pageARetirer;
    setPageARetirer(null);
    if (cible === null || guideId === null || pageEnVol) return;
    setPageEnVol(true);
    void removeGuidePage(guideId, cible.id)
      .then((r) => {
        adopterReponse(r, cible.id === pageCourante ? 'currentPage' : 'garder');
        /** Le corps gardé en mémoire pour une page qui n'existe plus n'a plus de sens. */
        setCorpsParPage(({ [cible.id]: _retire, ...reste }) => reste);
        /** Ni celui qu'on croyait connaître du serveur pour cette page. */
        const { [cible.id]: _oublie, ...restants } = auServeur.current.corps;
        auServeur.current = { champs: auServeur.current.champs, corps: restants };
        notifySuccess('Page retirée.');
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'La page n’a pas pu être retirée. Réessayez dans un instant.',
        );
      })
      .finally(() => {
        setPageEnVol(false);
      });
  }, [pageARetirer, guideId, pageEnVol, pageCourante, adopterReponse]);

  /**
   * ── INSÉRER UNE MARQUE À L'ENDROIT DU CARET ──────────────────────────────
   *
   * Le champ est lu DANS LE DOM et non par une référence React, pour la même
   * raison que la délégation de clic du guide : il est enfoui dans du JSX
   * transcodé, et faire voyager une référence jusqu'à lui est précisément ce que
   * ce dépôt évite. Le repère `data-a05-corps` est posé par le générateur.
   *
   * SANS CHAMP VISIBLE (au premier rendu, ou en aperçu sur 390 px), la marque est
   * AJOUTÉE À LA FIN. Elle ne disparaît pas : un bouton qui ne fait rien parce
   * que le caret n'est nulle part serait un bouton mort de plus.
   */
  const outil = useCallback((marque: string): void => {
    const regle = MARQUES[marque];
    if (regle === undefined) return;
    const champ = champVisible();
    setCorps((actuel) => {
      if (champ === null) {
        const saut = actuel === '' || actuel.endsWith('\n') ? '' : '\n';
        return `${actuel}${regle.ligne ? saut : ''}${regle.avant}${regle.apres}`;
      }
      const debut = champ.selectionStart;
      const fin = champ.selectionEnd;
      /**
       * UNE MARQUE DE LIGNE SE POSE AU DÉBUT DE LA LIGNE COURANTE, jamais au
       * milieu d'un mot : `## ` collé après « Dossier » ne fait pas un titre, il
       * fait « Dossier## ». On remonte donc au dernier saut de ligne.
       */
      if (regle.ligne) {
        const ligne = actuel.lastIndexOf('\n', Math.max(0, debut - 1)) + 1;
        return actuel.slice(0, ligne) + regle.avant + actuel.slice(ligne);
      }
      const selection = actuel.slice(debut, fin);
      return actuel.slice(0, debut) + regle.avant + selection + regle.apres + actuel.slice(fin);
    });
  }, []);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DÉPOSER UNE IMAGE — `POST /media` AVEC `kind=GUIDE`                      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `kind: 'GUIDE'` N'EST PAS UN CHOIX PAR DÉFAUT, et il ne fallait pas le
   * deviner : `apps/api/src/common/media-attachment.ts` déclare
   * `ATTACHABLE_KINDS.guide = ['GUIDE']` — « `GUIDE` et rien d'autre ». Un média
   * d'un autre genre tomberait au rattachement sur le même refus qu'un
   * identifiant inconnu, et l'écran annoncerait « introuvable » pour une image
   * qu'il vient lui-même de déposer.
   *
   * CE QUI EST INSÉRÉ EST `![légende](/media/<clé>)`, et c'est LA SEULE FORME que
   * le corps accepte : `restrictedMarkdownIssue` rend `IMAGE_EXTERNAL` sur toute
   * autre adresse, et `guideBodyMediaKeys` — la fonction même qui valide — ne
   * reconnaît que le préfixe `/media/`. `POST /media` rend précisément
   * `url: "/media/<storageKey>"` (relevé sur `media.service.ts`), donc on écrit
   * CE QUE LE SERVEUR A DIT plutôt que de recomposer le chemin.
   *
   * ⚠ LA LÉGENDE EST LE NOM DU FICHIER, et c'est un pis-aller assumé : la
   * maquette écrit `![Capture](image-1.jpg)` — donc une légende — mais ne dessine
   * AUCUN champ pour la saisir. Le nom du fichier est la seule chose honnête qu'on
   * ait ; le membre peut la corriger, c'est du texte dans son corps. REMONTÉ : il
   * manque à la planche un champ de légende.
   */
  const deposerImage = useCallback(
    (fichier: File): void => {
      if (imageOccupe) return;
      setImageOccupe(true);
      const corpsForm = new FormData();
      corpsForm.append('file', fichier);
      corpsForm.append('kind', 'GUIDE');
      void memberApi
        .post('/media', mediaAssetSchema, { body: corpsForm })
        .then((media) => {
          const legende = fichier.name.replace(/\.[^.]+$/, '');
          setCorps((actuel) => {
            const saut = actuel === '' || actuel.endsWith('\n') ? '' : '\n\n';
            return `${actuel}${saut}![${legende}](${media.url})`;
          });
          notifySuccess('Image ajoutée au guide.');
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'L’image n’a pas pu être déposée.',
          );
        })
        .finally(() => {
          setImageOccupe(false);
        });
    },
    [imageOccupe],
  );

  /**
   * ── FERMER L'ÉDITEUR ─────────────────────────────────────────────────────
   *
   * Le même geste que le chevron du guide, et le même repli : `back()` ne fait
   * rien quand l'onglet s'est ouvert directement sur `/guides/nouveau`, et la
   * croix paraîtrait morte. On replie sur `/guides`, la page dont l'éditeur est
   * une annexe.
   *
   * ⚠ AUCUNE CONFIRMATION, et c'est défendable PARCE QUE le brouillon est
   * enregistré : fermer ne perd rien dès que l'enregistrement automatique a
   * tourné une fois. Avant qu'il n'ait tourné — titre de moins de dix caractères —
   * il n'y a presque rien à perdre. REMONTÉ tout de même : la maquette ne dessine
   * aucune demande de confirmation, et c'est au porteur de dire s'il en veut une.
   */
  const fermer = useCallback((): void => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    /**
     * LE REPLI SUIT LE MODE. En mode `modifier`, l'annexe est LE GUIDE : un onglet
     * ouvert directement sur `/guides/:slug/modifier` (un lien recopié, un
     * rechargement) ramènerait sinon à la liste des guides, c'est-à-dire plus loin
     * que d'où le membre venait.
     */
    router.push(mode.kind === 'modifier' ? `/guides/${encodeURIComponent(mode.slug)}` : '/guides');
    /** Les deux champs du mode, en CHAÎNES : voir la relecture initiale. */
  }, [router, mode.kind, mode.kind === 'modifier' ? mode.slug : '']);

  /**
   * ── LES TROIS LISTES DE CHOIX ────────────────────────────────────────────
   *
   * LA CATÉGORIE vient de l'ÉNUMÉRATION du serveur (`GuideCategory`) et ses
   * libellés de `CATEGORY_LABEL` — le MÊME convertisseur que la lecture emploie,
   * pour que « Travail et études » s'écrive pareil dans l'éditeur et sur la carte.
   * RÈGLE DURE rappelée par `from-api.ts` : aucune étiquette ne contient
   * « certifié ».
   *
   * LA PORTÉE mêle « Universel » et la liste des pays, et l'en-tête de
   * `EditeurGuideView` dit pourquoi.
   *
   * LA VILLE commence par une option VIDE dont le libellé est celui de la
   * maquette (« Ville (facultatif) ») : la ville est facultative, et une liste
   * sans sortie aurait rendu obligatoire un champ que la planche déclare
   * optionnel.
   */
  const categorieOptions = useMemo(
    () => GuideCategory.map((c) => ({ valeur: c, libelle: CATEGORY_LABEL[c] ?? c })),
    [],
  );
  const porteeOptions = useMemo(
    () => [
      { valeur: 'UNIVERSAL', libelle: 'Universel' },
      ...pays.map((p) => ({ valeur: p.id, libelle: p.nameFr })),
    ],
    [pays],
  );
  const villeOptions = useMemo(
    () => [
      { valeur: '', libelle: 'Ville (facultatif)' },
      ...villes.map((v) => ({ valeur: v.id, libelle: v.name })),
    ],
    [villes],
  );

  const libelle = (options: readonly OptionEditeur[], valeur: string, defaut: string): string =>
    options.find((o) => o.valeur === valeur)?.libelle ?? defaut;

  return {
    titre,
    corps,
    pages,
    pageCourante,
    ajouterPage,
    choisirPage,
    renommerPage,
    pageARetirer,
    demanderRetraitPage,
    confirmerRetraitPage,
    annulerRetraitPage,
    categorie,
    portee,
    ville,
    apercuOuvert,
    brouillon,
    /** La planche de 390 px n'écrit PAS le délai : la phrase s'arrête avant. */
    brouillonCourt: brouillon === '' ? '' : brouillon.split(' · ')[0] ?? brouillon,
    peutPublier: motifPublier === '',
    motifPublier,
    publierLibelle: dejaPublie ? 'Enregistrer' : 'Publier',
    titreVerrouille,
    chargement,
    imageOccupe,
    categorieOptions,
    porteeOptions,
    villeOptions,
    categorieLibelle: libelle(categorieOptions, categorie, 'Catégorie'),
    porteeLibelle: libelle(porteeOptions, portee, 'Portée'),
    /**
     * SANS VILLE, LE LIBELLÉ EST CELUI DE LA MAQUETTE — « Ville (facultatif) » sur
     * l'ordinateur, « Ville » sur la pastille de 390 px qui ajoute son chevron en
     * texte. Le cadre écrit `{editeur.villeLibelle} ▾`, donc le libellé ne porte
     * pas le chevron : le dupliquer aurait donné « Ville ▾ ▾ ».
     */
    villeLibelle: libelle(villeOptions, ville, 'Ville'),
    /**
     * LA PASTILLE DE 390 px ÉCRIT « Ville ▾ » ET NON « Ville (facultatif) ▾ ».
     *
     * Relevé sur les octets des deux planches, et ce n'est pas un détail : les
     * trois pastilles du téléphone tiennent sur une ligne de 390 px, et
     * « (facultatif) » les ferait déborder. L'option VIDE de la liste garde, elle,
     * le libellé long — c'est là qu'il dit quelque chose d'utile (« je peux ne pas
     * en mettre »), alors que sur la pastille il ne dit que l'encombrement.
     */
    villeLibelleCourt: ville === '' ? 'Ville' : libelle(villeOptions, ville, 'Ville'),
    /**
     * `changerTitre` ET NON `setTitre` : le verrou du titre d'un guide publié
     * passe par là, et le laisser contourner par la prise aurait rendu le verrou
     * décoratif. En mode `nouveau`, `changerTitre` appelle `setTitre` sans rien
     * d'autre — aucune différence de comportement.
     */
    setTitre: changerTitre,
    setCorps,
    setCategorie,
    setPortee,
    setVille,
    setApercu,
    outil,
    deposerImage,
    publier,
    fermer,
  };
}
