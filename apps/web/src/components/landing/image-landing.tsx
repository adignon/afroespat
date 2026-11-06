import type { CSSProperties } from 'react';

/**
 * L'IMAGE D'UN EMPLACEMENT DE LA PAGE D'ACCUEIL (la balise `<image-slot>` de la maquette).
 *
 * Les photos sont hébergées avec le site (`public/landing/`, voir `tools/fetch-landing-images.mjs`) : la politique de
 * sécurité du site interdit les images d'un autre domaine. Sans `src` (un événement sans photo, une ville inconnue),
 * l'emplacement montre un fond dégradé neutre — jamais une photo empruntée au hasard.
 */
export function ImageLanding({
  src,
  credit,
  shape,
  radius,
  placeholder,
  style,
}: {
  readonly id?: string;
  readonly src?: string;
  readonly credit?: string;
  readonly creditHref?: string;
  readonly shape?: 'rect' | 'rounded';
  readonly radius?: string;
  readonly placeholder?: string;
  readonly style?: CSSProperties;
}) {
  const arrondi = shape === 'rounded' ? `${radius ?? '24'}px` : undefined;
  const aUnePhoto = src !== undefined && src !== '';
  // Sans photo, l'emplacement n'est qu'un fond : il n'a rien à annoncer. Avec une photo, il porte son texte alternatif.
  return (
    <div
      {...(aUnePhoto ? { role: 'img', 'aria-label': placeholder ?? credit ?? '' } : { 'aria-hidden': true })}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg,#16785E,#16211D)',
        borderRadius: arrondi,
        ...style,
      }}
    >
      {src !== undefined && src !== '' ? (
        <img src={src} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : null}
    </div>
  );
}
