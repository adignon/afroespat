'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CAPABILITIES, GUIDE_PROPOSAL_REASON_MIN, type Capability } from '@app/shared';
import { ApiError } from '@/lib/api/index';
import { createProposal } from '@/screens/guides/api';
import { A06PanneauCorrectionCorrigerDesktop } from '@/screens/a06/panneaucorrection-corrigerdesktop.generated';
import { A06PanneauCorrectionCorrigerMobile } from '@/screens/a06/panneaucorrection-corrigermobile.generated';
import type { CorrectionPanneauView } from '@/screens/a06/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « C'EST UN MODAL QUI S'AFFICHE À DROITE » — L'ÉTAT DU PANNEAU             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Oui il faut le faire et le brancher au modal au niveau de
 * proposer une correction. Ça affiche une page mais c'est un modal qui s'affiche à
 * droite. Il faut être intelligent et comprendre la page. »
 *
 * Le DESSIN est transcodé — `A06PanneauCorrectionCorriger{Desktop,Mobile}`, sortis
 * du cadre d'A06 par `regions:` (`tools/screens/03-accueil.mjs`). Ce fichier ne
 * dessine donc RIEN : il porte l'état, l'appel et les refus, c'est-à-dire tout ce
 * qu'une planche ne peut pas dire.
 *
 * ── DEUX MONTAGES, UNE SEULE SOURCE D'ÉTAT ────────────────────────────────
 *
 *   · la PAGE du guide (A04) l'ouvre sur une sélection de texte, et c'est le
 *     chemin normal du geste : la maquette dessine l'infobulle dans le corps ;
 *   · la PAGE `/guides/:slug/corriger` (A06) le dessine déjà ouvert, et reste une
 *     adresse partageable.
 *
 * Les deux appellent `useCorrection`. Un second état aurait fini par diverger —
 * c'est exactement ce qui est arrivé aux compteurs de A06 avant ce lot.
 *
 * ── LE FRONT PRÉVIENT, LE SERVEUR REFUSE, ET LES DEUX SONT ICI ────────────
 *
 * `guide.propose_revision` est en N2. `lib/capacites.ts` le dit d'avance quand il
 * connaît le niveau — le panneau ne s'ouvre pas, l'invitation de §7.3 s'affiche —
 * et si la copie du niveau est périmée (un membre rétrogradé entre deux lectures),
 * l'envoi part et le `403 LEVEL_REQUIRED` tranche. La fenêtre s'affiche alors avec
 * la capacité QUE LE SERVEUR NOMME, et non celle qu'on aurait supposée.
 */

/** Ce que la page doit monter et câbler. */
export interface Correction {
  /** `true` quand le panneau est ouvert : la page le monte alors. */
  readonly ouverte: boolean;
  /** Les prises du panneau transcodé. */
  readonly vue: CorrectionPanneauView;
  /**
   * Ouvre le panneau sur un passage. Rend `false` quand le niveau manque — la
   * page affiche alors la fenêtre, et rien ne s'ouvre.
   */
  readonly ouvrir: (passage: string) => boolean;
  /** La capacité refusée, `null` quand rien n'est refusé. Pour `FenetreNiveau`. */
  readonly niveauRefuse: Capability | null;
  readonly fermerNiveau: () => void;
  /** Le message d'un refus qui n'est PAS un manque de niveau. `null` sinon. */
  readonly echec: string | null;
}

/**
 * LA CAPACITÉ QUE LE SERVEUR NOMME, VÉRIFIÉE AVANT D'ÊTRE CRUE.
 *
 * `details.capability` est un `string` dans le catalogue d'erreurs — il traverse le
 * réseau, donc il n'est pas typé par construction. Le passer tel quel à
 * `FenetreNiveau` ferait lire `CAPABILITIES[inconnu].labelFr`, c'est-à-dire une
 * lecture de `undefined` et une fenêtre blanche sur un refus légitime. On vérifie
 * donc qu'il est dans la table, et on retombe sur celle qu'on tentait sinon.
 */
function capaciteDeLErreur(nom: string | undefined, repli: Capability): Capability {
  if (nom !== undefined && Object.hasOwn(CAPABILITIES, nom)) return nom as Capability;
  return repli;
}

export function useCorrection({
  guideId,
  auteur,
  peut,
  onEnvoye,
}: {
  /** `null` tant que `GET /guides/:slug` n'a pas répondu : rien ne peut partir. */
  readonly guideId: string | null;
  /**
   * Le nom de l'auteur du guide, abrégé — « Marc K. ». `null` sur un guide
   * anonymisé (§8) : l'accusé se réduit alors, il ne nomme pas une absence.
   */
  readonly auteur: string | null;
  readonly peut: (capacite: Capability) => boolean;
  /** Appelé après un envoi accepté : la page peut relire ses propositions. */
  readonly onEnvoye?: () => void;
}): Correction {
  const [ouverte, setOuverte] = useState(false);
  const [passage, setPassage] = useState('');
  const [remplacement, setRemplacement] = useState('');
  const [motif, setMotif] = useState('');
  const [source, setSource] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [accuse, setAccuse] = useState<string | null>(null);
  const [niveauRefuse, setNiveauRefuse] = useState<Capability | null>(null);
  const [echec, setEchec] = useState<string | null>(null);

  const fermer = useCallback((): void => {
    setOuverte(false);
    setAccuse(null);
    setEchec(null);
  }, []);

  /**
   * ÉCHAP FERME, et ce n'est pas une politesse : le panneau couvre la page entière
   * derrière son voile. La planche mobile ne dessine AUCUNE croix — elle a sa
   * poignée, qui est un dessin — donc sans ce raccourci et sans le voile-bouton
   * (posé par `regions:`), un membre au clavier n'a aucune sortie.
   */
  useEffect(() => {
    if (!ouverte) return undefined;
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouverte, fermer]);

  const ouvrir = useCallback(
    (vise: string): boolean => {
      /**
       * ⚠ `guide.propose_revision` EST EN N2. On le dit AVANT plutôt que de laisser
       * un membre remplir quatre champs pour recevoir un 403. Si le niveau n'est
       * pas encore connu, `peut` rend `true` et on ouvre : on n'éteint rien sur une
       * supposition (voir l'en-tête de `lib/capacites.ts`).
       */
      if (!peut('guide.propose_revision')) {
        setNiveauRefuse('guide.propose_revision');
        return false;
      }
      setPassage(vise);
      /**
       * LE REMPLACEMENT PART DU PASSAGE, et c'est ce que la maquette dessine : son
       * bloc « Remplacer par » EST le passage, avec une phrase changée. §2.4 dit la
       * même chose autrement — le passage visé n'est pas retouché, le remplacement
       * est écrit À CÔTÉ. Partir d'un champ vide obligerait à retaper la phrase pour
       * y corriger trois mots.
       */
      setRemplacement(vise);
      setMotif('');
      setSource('');
      setAccuse(null);
      setEchec(null);
      setOuverte(true);
      return true;
    },
    [peut],
  );

  const envoyer = useCallback((): void => {
    if (guideId === null || enVol) return;
    const raison = motif.trim();
    if (raison.length < GUIDE_PROPOSAL_REASON_MIN) return;
    setEnVol(true);
    setEchec(null);
    /**
     * LA SOURCE VIDE EST OMISE, PAS ENVOYÉE VIDE : `sourceUrl` est validé par
     * `z.string().url()`, et une chaîne vide n'est pas une URL — le serveur
     * répondrait `400 VALIDATION_FAILED` sur un champ que la maquette déclare
     * facultatif.
     */
    const url = source.trim();
    void createProposal(guideId, {
      targetExcerpt: passage,
      replacement: remplacement,
      reason: raison,
      ...(url === '' ? {} : { sourceUrl: url }),
    })
      .then(() => {
        /**
         * L'ACCUSÉ EST CELUI DE LA MAQUETTE, colonne « APRÈS ENVOI » : « Proposition
         * envoyée à Marc K. Vous serez prévenu·e de sa réponse. » Le nom est celui
         * du VRAI auteur. Sans auteur (guide anonymisé, §8), la phrase garde sa
         * seconde moitié plutôt que de nommer personne.
         *
         * ── LE POINT NE SE DOUBLE PAS, ET C'EST MESURÉ AU NAVIGATEUR ────────
         *
         * Le nom abrégé FINIT PAR UN POINT — « Marc K. », c'est l'abréviation
         * elle-même — et la phrase en ajoutait un second : relevé à 390 px,
         * « Proposition envoyée à Marc K.. Vous serez prévenu·e de sa réponse. »
         * La maquette, qui écrit le même nom, n'en met qu'un.
         *
         * C'est l'écueil classique d'une phrase composée autour d'une donnée, et
         * il ne se voit QUE sur un nom à deux mots : un auteur d'un seul mot
         * (« Awa ») n'a pas de point, donc le défaut disparaît du jeu d'essai le
         * plus simple.
         */
        setAccuse(
          auteur === null
            ? 'Proposition envoyée. Vous serez prévenu·e de la réponse.'
            : `Proposition envoyée à ${auteur.endsWith('.') ? auteur : `${auteur}.`} ` +
              'Vous serez prévenu·e de sa réponse.',
        );
        onEnvoye?.();
      })
      .catch((erreur: unknown) => {
        if (erreur instanceof ApiError && erreur.levelRequired !== null) {
          setNiveauRefuse(
            capaciteDeLErreur(erreur.levelRequired.capability, 'guide.propose_revision'),
          );
          setOuverte(false);
          return;
        }
        setEchec(
          erreur instanceof ApiError
            ? erreur.displayMessage
            : 'La proposition n’a pas pu être envoyée. Réessayez dans un instant.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [guideId, enVol, motif, source, passage, remplacement, auteur, onEnvoye]);

  const vue = useMemo<CorrectionPanneauView>(
    () => ({
      passage,
      remplacement,
      onRemplacement: (e) => {
        setRemplacement(e.target.value);
      },
      motif,
      onMotif: (e) => {
        setMotif(e.target.value);
      },
      source,
      onSource: (e) => {
        setSource(e.target.value);
      },
      /**
       * LE MOTIF EST OBLIGATOIRE, et c'est lui seul qui allume le bouton :
       * `GUIDE_PROPOSAL_REASON_MIN` vaut 20, et c'est le serveur qui le dit. Le
       * remplacement VIDE est licite — c'est un retrait de passage, §2.4 le
       * prévoit — donc on ne l'exige pas.
       *
       * Le bouton s'éteint aussi pendant l'envoi et tant que le guide n'a pas son
       * identifiant : sans `guideId`, l'appel n'a pas d'adresse.
       *
       * ET APRÈS L'ACCUSÉ, il reste éteint : la proposition est partie, et un
       * second clic en créerait une deuxième, identique.
       */
      peutEnvoyer:
        guideId !== null &&
        !enVol &&
        accuse === null &&
        motif.trim().length >= GUIDE_PROPOSAL_REASON_MIN,
      onEnvoyer: envoyer,
      onFermer: fermer,
      accuse,
    }),
    [passage, remplacement, motif, source, guideId, enVol, accuse, envoyer, fermer],
  );

  return {
    ouverte,
    vue,
    ouvrir,
    niveauRefuse,
    fermerNiveau: () => {
      setNiveauRefuse(null);
    },
    echec,
  };
}

/**
 * LE PASSAGE ACTUELLEMENT SÉLECTIONNÉ DANS UN CORPS DE GUIDE, ou `null`.
 *
 * `CorpsGuide` écoute déjà la sélection pour poser son infobulle, et c'est le
 * chemin normal du geste. Cette fonction sert à l'AUTRE chemin : l'entrée
 * « Proposer une correction » de la colonne d'actions, qui ne sait rien de ce qui
 * est sélectionné.
 *
 * ELLE N'A PAS SON PROPRE CRITÈRE : la boîte est reconnue par le repère que
 * `CorpsGuide` pose (`data-guide-corps`), et le plancher de trois caractères est
 * celui de `targetExcerpt` (`createProposalSchema`). Deux critères voisins
 * auraient fini par diverger — l'infobulle apparaissant là où l'entrée refuse, ou
 * l'inverse.
 */
export function passageSelectionne(): string | null {
  if (typeof window === 'undefined') return null;
  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed || selection.rangeCount === 0) return null;
  const { anchorNode, focusNode } = selection;
  if (anchorNode === null || focusNode === null) return null;
  /**
   * LES DEUX EXTRÉMITÉS DANS LE MÊME CORPS, et pas seulement l'ancre : une
   * sélection qui commence dans le corps et finit dans la colonne de droite n'est
   * pas un passage du guide, et le serveur ne la retrouverait pas.
   */
  for (const boite of document.querySelectorAll('[data-guide-corps]')) {
    if (!boite.contains(anchorNode) || !boite.contains(focusNode)) continue;
    const passage = selection.toString().trim();
    return passage.length < 3 ? null : passage;
  }
  return null;
}

/**
 * LE PANNEAU, SUR LES DEUX PLANCHES.
 *
 * `ScreenFrames` bascule au seuil de 1024 px de §10.1 et rend les DEUX cadres, l'un
 * masqué par CSS — « Next rend côté serveur : il ne connaît pas la largeur de la
 * fenêtre, et choisir en JavaScript provoquerait un saut visible à l'hydratation ».
 * Le panneau est monté HORS de `ScreenFrames` (il est posé par-dessus la page,
 * `position: fixed`), donc il porte le même seuil, écrit de la même façon.
 */
export function PanneauCorrection({ vue }: { readonly vue: CorrectionPanneauView }) {
  return (
    <>
      <div className="hidden lg:block" data-correction-planche="desktop">
        <A06PanneauCorrectionCorrigerDesktop correction={vue} />
      </div>
      <div className="block lg:hidden" data-correction-planche="mobile">
        <A06PanneauCorrectionCorrigerMobile correction={vue} />
      </div>
    </>
  );
}
