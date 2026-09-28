'use client';

import type { ReactNode } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A08Desktop } from '@/screens/a08/desktop.generated';
import { A08Mobile } from '@/screens/a08/mobile.generated';
import { A08TFil } from '@/screens/a08t/fil.generated';
import { A08TEvenements } from '@/screens/a08t/evenements.generated';
import { A08TMembres } from '@/screens/a08t/membres.generated';
import { A08TAlbum } from '@/screens/a08t/album.generated';
import { A08TAPropos } from '@/screens/a08t/apropos.generated';
import { A08TAdminFil } from '@/screens/a08t/adminfil.generated';
import { A08TAdminGerer } from '@/screens/a08t/admingerer.generated';
import { A08TAdminMembres } from '@/screens/a08t/adminmembres.generated';
import { A08TAdminEvenements } from '@/screens/a08t/adminevenements.generated';
import { A08TAdminAlbum } from '@/screens/a08t/adminalbum.generated';
import { A08TAdminAPropos } from '@/screens/a08t/adminapropos.generated';
import { A08TAdminAProposEdition } from '@/screens/a08t/adminaproposedition.generated';
import { A08TAdminAnnonce } from '@/screens/a08t/adminannonce.generated';
import { A08TFilMobile } from '@/screens/a08t/filmobile.generated';
import { A08TEvenementsMobile } from '@/screens/a08t/evenementsmobile.generated';
import { A08TMembresMobile } from '@/screens/a08t/membresmobile.generated';
import { A08TAlbumMobile } from '@/screens/a08t/albummobile.generated';
import { A08TAProposMobile } from '@/screens/a08t/aproposmobile.generated';
import { A08TAdminFilMobile } from '@/screens/a08t/adminfilmobile.generated';
import { A08TAdminGererMobile } from '@/screens/a08t/admingerermobile.generated';
import { A08TAdminMembresMobile } from '@/screens/a08t/adminmembresmobile.generated';
import { A08TAdminEvenementsMobile } from '@/screens/a08t/adminevenementsmobile.generated';
import { A08TAdminAlbumMobile } from '@/screens/a08t/adminalbummobile.generated';
import { A08TAdminAProposEditionMobile } from '@/screens/a08t/adminaproposeditionmobile.generated';
import { A08TAdminAnnonceMobile } from '@/screens/a08t/adminannoncemobile.generated';
import { accueilData, type AccueilState } from '@/screens/accueil/props';
import type { AccueilData } from '@/screens/accueil/data';

/**
 * A08 et ses treize onglets. `/reseaux/:slug`
 *
 * ── CE QUE A08T EST, ET POURQUOI IL EST ICI ─────────────────────────────────
 *
 * A08T n'est pas un écran : c'est la ZONE DE CONTENU de A08, dessinée une fois par
 * onglet, en 1036 px. La maquette l'écrit sous sa planche — « zone de contenu seule
 * · menu de gauche et barre haute identiques à A08 ». Ce sont donc des VARIANTES
 * D'ÉTAT de cet écran, et elles vivent sur cette route, pas sur treize routes
 * inventées.
 *
 * ── CE QUE ÇA COÛTE, ET IL FAUT LE DIRE ─────────────────────────────────────
 *
 * Sur ORDINATEUR, le cadre de A08 contient à la fois le rail, la barre haute et le
 * contenu de l'onglet « Sujets » — en un seul bloc. Rien dans la déclaration d'un
 * écran ne sait aujourd'hui découper un cadre en « chrome » et « contenu », donc on
 * ne peut pas glisser une planche A08T DANS le cadre de A08. Changer d'onglet
 * remplace donc tout le cadre, et le rail disparaît le temps de cet onglet — parce
 * que la maquette ne le dessine pas sur ces planches.
 *
 * Écrire le rail à la main pour combler le trou serait RÉÉCRIRE la maquette, ce
 * qu'on ne fait pas. Ce qu'il faudrait est un `slot` dans la déclaration de cadre :
 * « garde tout jusqu'à la barre de 64 px, remplace la suite par `{children}` ». Une
 * demi-journée d'outillage, et ce serait juste pour A08 comme pour A12.
 *
 * Sur MOBILE il n'y a AUCUN manque : les douze planches de MOB2 sont des téléphones
 * complets, barre basse comprise. La navigation par onglets y est entière.
 */

/** Les onglets, dans l'ordre de la maquette, et leur nom dans l'URL. */
const SLUGS = ['fil', 'sujets', 'evenements', 'membres', 'album', 'a-propos'] as const;

type Tab = {
  readonly desktop: (d: AccueilData) => ReactNode;
  readonly mobile: (d: AccueilData) => ReactNode;
};

/**
 * `sujets` n'a pas de planche A08T : c'est A08 lui-même que la maquette dessine sur
 * cet onglet (« /reseaux/:slug · onglet Sujets »). C'est pourquoi il est le seul à
 * garder le cadre complet, rail compris.
 */
const MEMBRE: Record<string, Tab> = {
  fil: { desktop: (d) => <A08TFil {...d} />, mobile: (d) => <A08TFilMobile {...d} /> },
  sujets: { desktop: (d) => <A08Desktop {...d} />, mobile: (d) => <A08Mobile {...d} /> },
  evenements: {
    desktop: (d) => <A08TEvenements {...d} />,
    mobile: (d) => <A08TEvenementsMobile {...d} />,
  },
  membres: { desktop: (d) => <A08TMembres {...d} />, mobile: (d) => <A08TMembresMobile {...d} /> },
  album: { desktop: (d) => <A08TAlbum {...d} />, mobile: (d) => <A08TAlbumMobile {...d} /> },
  'a-propos': {
    desktop: (d) => <A08TAPropos {...d} />,
    mobile: (d) => <A08TAProposMobile {...d} />,
  },
};

/**
 * La vue propriétaire. Trois onglets n'existent QUE pour elle — « Gérer », « Publier
 * une annonce », « À propos en mode édition » — et la maquette ne leur donne pas de
 * place dans la barre d'onglets : on y arrive par les actions du bandeau.
 *
 * `a-propos` en vue propriétaire N'A PAS de cadre mobile : la planche MOB2 passe
 * directement d'« Album — sélection » à « À propos — édition ». Ce n'est pas un
 * oubli de déclaration, c'est la maquette qui ne le dessine pas ; sur mobile cet
 * onglet retombe donc sur la vue membre, qui existe et dit la même chose.
 */
const PROPRIETAIRE: Record<string, Tab> = {
  fil: { desktop: (d) => <A08TAdminFil {...d} />, mobile: (d) => <A08TAdminFilMobile {...d} /> },
  membres: {
    desktop: (d) => <A08TAdminMembres {...d} />,
    mobile: (d) => <A08TAdminMembresMobile {...d} />,
  },
  evenements: {
    desktop: (d) => <A08TAdminEvenements {...d} />,
    mobile: (d) => <A08TAdminEvenementsMobile {...d} />,
  },
  album: {
    desktop: (d) => <A08TAdminAlbum {...d} />,
    mobile: (d) => <A08TAdminAlbumMobile {...d} />,
  },
  'a-propos': {
    desktop: (d) => <A08TAdminAPropos {...d} />,
    mobile: (d) => <A08TAProposMobile {...d} />,
  },
  gerer: {
    desktop: (d) => <A08TAdminGerer {...d} />,
    mobile: (d) => <A08TAdminGererMobile {...d} />,
  },
  annonce: {
    desktop: (d) => <A08TAdminAnnonce {...d} />,
    mobile: (d) => <A08TAdminAnnonceMobile {...d} />,
  },
  'a-propos-edition': {
    desktop: (d) => <A08TAdminAProposEdition {...d} />,
    mobile: (d) => <A08TAdminAProposEditionMobile {...d} />,
  },
};

/**
 * Les planches A08T de 1036 px portent leur mise en page dans le conteneur que le
 * générateur retire — `display: flex; flex-direction: column; gap: 14px`. C'est
 * l'espacement entre l'en-tête du réseau et les cartes de l'onglet, et il vient de
 * la maquette : recopié tel quel, plutôt que réinventé dans le JSX généré.
 *
 * `padding: 24px` et la bordure ne sont PAS repris : ils dessinent la planche de
 * documentation, pas l'écran.
 */
const BOARD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  width: '100%',
};

export function ReseauScreen({
  onglet,
  owner,
}: {
  readonly onglet: string;
  readonly owner: boolean;
}) {
  const slug = onglet;

  const table = owner ? PROPRIETAIRE : MEMBRE;
  // Un onglet inconnu — ou réservé au propriétaire quand on ne l'est pas — retombe
  // sur « Sujets », qui est ce que la maquette montre par défaut.
  const tab = table[slug] ?? MEMBRE[slug] ?? MEMBRE['sujets'];
  if (tab === undefined) return null;

  const state: AccueilState = {
    netTab: Math.max(0, SLUGS.indexOf(slug as (typeof SLUGS)[number])),
  };
  const data = accueilData(state);

  // L'onglet « Sujets » en vue membre EST le cadre complet de A08, rail compris :
  // il n'a pas de coque de planche à reconstituer.
  const plain = slug === 'sujets' && !owner;

  return (
    <ScreenFrames
      screen={plain ? 'A08' : `A08T-${slug}`}
      desktop={plain ? tab.desktop(data) : <div style={BOARD}>{tab.desktop(data)}</div>}
      mobile={tab.mobile(data)}
    />
  );
}
