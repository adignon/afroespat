'use client';

import { ScreenFrames } from '@/screens/frames';
import { A04Desktop } from '@/screens/a04/desktop.generated';
import { A04Mobile } from '@/screens/a04/mobile.generated';
import { A04AuteurDesktop } from '@/screens/a04/auteurdesktop.generated';
import { A04AuteurMobile } from '@/screens/a04/auteurmobile.generated';
import {
  guideActions,
  panelGuides,
  rail,
  shortcuts,
  versions as versionsMaquette,
  type A04Data,
} from '@/screens/a04/data';
import { useGuide } from '@/screens/guides/use-guides';

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
 * Les pastilles de contributeurs et l'historique des versions. Le CORPS du guide,
 * son titre et sa ligne « Mis à jour le … » sont du balisage statique dans la
 * maquette : le transcodeur les a écrits en dur, et un `*.generated.tsx` ne se
 * modifie pas à la main. Remonté au rapport de lot — c'est la limite de cet écran.
 *
 * SEUL ÉCRAN DE CETTE MAQUETTE à écrire son `<h1>` lui-même. Ses `<h2>` sont les
 * sections du guide, et le générateur ne les promeut pas.
 */
export function GuideScreen({
  slug,
  auteur,
}: {
  readonly slug: string;
  readonly auteur: boolean;
}) {
  const { contributors, versionRows, isAuthor, echec, chargement } = useGuide(slug);

  const data: A04Data = {
    rail,
    panelGuides,
    shortcuts,
    contributors,
    guideActions,
    /**
     * L'historique de l'API tant qu'il en donne un. Vide, on garde celui de la
     * maquette plutôt que d'afficher un encart « HISTORIQUE DES VERSIONS » sans
     * une ligne : la maquette n'en dessine pas la forme vide, et un cadre vide
     * n'est pas un dessin que le transcodage ait produit.
     */
    versions: versionRows.length > 0 ? versionRows : versionsMaquette,
  };

  /** La vue auteur est DEMANDÉE par l'URL et ACCORDÉE par le serveur. */
  const vueAuteur = auteur && isAuthor;

  return (
    <>
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
