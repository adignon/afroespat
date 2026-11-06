import type { MetadataRoute } from 'next';
import { PWA_THEME_COLOR } from '@app/shared';
import { DESCRIPTION_PUBLIQUE, NOM_PUBLIC } from '@/lib/seo';

/**
 * LE MANIFESTE PWA — minimal : de quoi « ajouter à l'écran d'accueil ».
 *
 * L'icône est le SVG existant de `public/brand` (aucune image raster à fabriquer) ; le
 * lancement ouvre l'accueil membre, qui renvoie à la connexion sans session.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOM_PUBLIC,
    short_name: NOM_PUBLIC,
    description: DESCRIPTION_PUBLIQUE,
    lang: 'fr',
    start_url: '/accueil',
    scope: '/',
    display: 'standalone',
    background_color: '#F6F8F7',
    theme_color: PWA_THEME_COLOR,
    icons: [{ src: '/brand/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
