import type { ReactNode } from 'react';

/**
 * Les deux cadres d'un écran, ordinateur et mobile.
 *
 * La maquette fournit DEUX designs par écran — un cadre de 1440 px et un cadre
 * de 390 px. On bascule de l'un à l'autre au seuil de 1024 px que fixe §10.1,
 * plutôt que d'inventer un comportement intermédiaire que le design n'a pas
 * défini.
 *
 * Les DEUX sont rendus, l'un masqué par CSS. Next rend côté serveur : il ne
 * connaît pas la largeur de la fenêtre, et choisir en JavaScript provoquerait un
 * saut visible à l'hydratation.
 *
 * Au-delà de 1440 px on CENTRE au lieu d'étirer : les contenus de la maquette
 * sont déjà bornés, et l'étirement ne ferait qu'éloigner les colonnes.
 *
 * Ce conteneur ne porte AUCUN repère : le `<main>` vit dans le cadre transcodé,
 * posé par le générateur quand la maquette n'en fournit pas. La maquette du fil,
 * elle, écrit déjà son propre `<main>` autour de la colonne centrale — un repère
 * ajouté ici l'aurait enveloppé, et deux `main` imbriqués sont invalides. C'est
 * exactement ce qui est arrivé, et les tests de largeur du fil l'ont montré :
 * ils mesuraient soudain le conteneur au lieu de la colonne.
 */
export function ScreenFrames({
  screen,
  desktop,
  mobile,
  background = '#F6F8F7',
  direction = 'row',
}: {
  readonly screen: string;
  /**
   * Absent quand la maquette ne dessine QUE le cadre mobile — A01N, « Nouvelle
   * publication », est le premier. C'est le miroir exact du cas O05 ci-dessous, et
   * il se traite pareil : un seul cadre, sans bascule au seuil de 1024 px.
   *
   * Ce n'est PAS « le cadre mobile élargi ». Le cadre unique garde la largeur que la
   * maquette lui donne — 390 px — et se centre, exactement comme le cadre
   * d'ordinateur se centre à 1440 px au-delà de sa borne. L'étirer sur toute la
   * largeur d'un écran de bureau étalerait un dessin de téléphone sur 1440 px, ce
   * que la maquette ne demande nulle part ; la borne, elle, est un nombre qu'elle
   * écrit.
   */
  readonly desktop?: ReactNode;
  /** Absent quand la maquette ne donne pas de cadre mobile — O05 par exemple. */
  readonly mobile?: ReactNode;
  readonly background?: string;
  /**
   * La direction du cadre d'ordinateur, telle que la maquette l'écrit dans son
   * conteneur — celui que le générateur retire parce qu'il portait la taille fixe.
   *
   * Presque tous les cadres sont en RANGÉE : rail à gauche, contenu à droite. A05,
   * l'éditeur de guide, est le seul en colonne (barre d'outils au-dessus du corps),
   * et sans cette bascule sa barre se retrouvait à côté du texte au lieu d'être
   * dessus. Le cadre mobile, lui, est en colonne partout — la maquette ne dessine
   * pas de téléphone en rangée.
   */
  readonly direction?: 'row' | 'column';
}) {
  /**
   * ÉCRAN MOBILE SEUL : un cadre, toujours visible, borné à sa largeur de maquette.
   *
   * Le repère reste `data-frame="mobile"` parce que c'est bien le cadre mobile qui
   * est rendu — le renommer « desktop » parce qu'il s'affiche sur un grand écran
   * mentirait aux tests, qui s'en servent pour désigner le dessin qu'ils mesurent.
   */
  if (desktop === undefined) {
    return (
      <div data-screen={screen} style={{ background, minHeight: '100vh' }}>
        <div
          data-frame="mobile"
          className="mx-auto flex min-h-screen max-w-[390px] flex-col"
          style={{ position: 'relative' }}
        >
          {mobile}
        </div>
      </div>
    );
  }

  return (
    <div data-screen={screen} style={{ background, minHeight: '100vh' }}>
      <div
        data-frame="desktop"
        className={
          mobile === undefined
            ? 'mx-auto flex min-h-screen max-w-[1440px]'
            : 'mx-auto hidden min-h-screen max-w-[1440px] lg:flex'
        }
        style={{ position: 'relative', flexDirection: direction }}
      >
        {desktop}
      </div>
      {mobile !== undefined && (
        <div
          data-frame="mobile"
          className="flex min-h-screen flex-col lg:hidden"
          style={{ position: 'relative' }}
        >
          {mobile}
        </div>
      )}
    </div>
  );
}
