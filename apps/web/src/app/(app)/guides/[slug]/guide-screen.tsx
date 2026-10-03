'use client';

import { ScreenFrames } from '@/screens/frames';
import { A04Desktop } from '@/screens/a04/desktop.generated';
import { A04Mobile } from '@/screens/a04/mobile.generated';
import { A04AuteurDesktop } from '@/screens/a04/auteurdesktop.generated';
import { A04AuteurMobile } from '@/screens/a04/auteurmobile.generated';
import {
  guide as guideMaquette,
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
 * L'en-tête du guide (titre, catégorie, portée, date de mise à jour, bandeau
 * « Maintenu par la communauté » et les trois compteurs de la vue auteur), les
 * pastilles de contributeurs et l'historique des versions.
 *
 * Le CORPS du guide reste dessiné, et c'est la limite de cet écran : la maquette
 * l'écrit en HTML riche — sections, listes, passage surligné, légende d'image — là
 * où l'API rend un seul `body` en Markdown restreint. Le lier demanderait d'écrire
 * un composant de rendu, pas de déclarer une prise. Remonté au rapport de lot.
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
  const { contributors, versionRows, enTete, isAuthor, echec, chargement } = useGuide(slug);

  const data: A04Data = {
    rail,
    panelGuides,
    shortcuts,
    /**
     * L'EN-TÊTE DU GUIDE — titre, catégorie, portée, date, bandeau et compteurs.
     *
     * Elle vient de `GET /guides/:slug` dès qu'il a répondu, et c'est elle qui fait
     * que cette page cesse d'afficher « Obtenir la garantie Visale sans CDI » pour
     * tous les guides. Avant la réponse, on garde celle de la MAQUETTE plutôt qu'un
     * titre vide : c'est le même choix que pour l'historique juste dessous, et le
     * rendu serveur n'a alors rien d'autre à montrer.
     */
    guide: enTete ?? guideMaquette,
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
