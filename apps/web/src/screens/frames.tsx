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
}: {
  readonly screen: string;
  readonly desktop: ReactNode;
  /** Absent quand la maquette ne donne pas de cadre mobile — O05 par exemple. */
  readonly mobile?: ReactNode;
  readonly background?: string;
}) {
  return (
    <div data-screen={screen} style={{ background, minHeight: '100vh' }}>
      <div
        data-frame="desktop"
        className={
          mobile === undefined
            ? 'mx-auto flex min-h-screen max-w-[1440px]'
            : 'mx-auto hidden min-h-screen max-w-[1440px] lg:flex'
        }
        style={{ position: 'relative' }}
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
