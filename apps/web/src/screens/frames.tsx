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
  pleineLargeur = false,
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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ DEUX ÉCRANS COUVRENT TOUT, LES AUTRES SE CENTRENT                       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le create story doit couvrir tout l'écran […] pareil pour le
   * display. »
   *
   * MESURÉ sur une fenêtre de 1700 px : le cadre fait 1440 px à x+130, donc deux
   * bandes de 130 px laissent voir la page derrière — ce que la capture du porteur
   * montre en vert.
   *
   * LA BORNE RESTE LA RÈGLE pour les 250 autres cadres, et la note d'en-tête dit
   * pourquoi : au-delà de 1440 px on centre plutôt que d'étirer un dessin. Mais
   * A13 et A14 ne sont pas des pages parmi d'autres : ce sont des SURFACES, posées
   * par-dessus le reste. Une surface qui laisse voir deux bandes du dessous n'est
   * pas une surface.
   */
  readonly pleineLargeur?: boolean;
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
          /**
           * ── 390 px SEULEMENT AU-DELÀ DU SEUIL D'ORDINATEUR ──────────────
           *
           * Le porteur, capture à l'appui : « la page a un padding gauche
           * droite à corriger ». Ce n'était pas un retrait : c'était la BORNE.
           * `max-w-[390px]` s'appliquait à toutes les largeurs, donc sur un
           * téléphone de 430 px le cadre se centrait en laissant vingt pixels
           * de gris de chaque côté — ce qu'aucune autre page ne fait, puisque
           * les cadres mobiles ordinaires remplissent l'écran.
           *
           * La borne garde sa raison d'être — ne pas étaler un dessin de
           * téléphone sur 1 440 px — mais elle ne vaut qu'À PARTIR du seuil de
           * §10.1, celui-là même où les autres écrans basculent sur leur cadre
           * d'ordinateur. En dessous, le cadre remplit, comme partout ailleurs.
           */
          className="mx-auto flex min-h-screen w-full flex-col lg:max-w-[390px]"
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
          [
            'mx-auto min-h-screen',
            pleineLargeur === true ? '' : 'max-w-[1440px]',
            mobile === undefined ? 'flex' : 'hidden lg:flex',
          ]
            .filter((c) => c !== '')
            .join(' ')
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
