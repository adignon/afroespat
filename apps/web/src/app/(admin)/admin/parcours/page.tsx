import { ScreenFrames } from '@/screens/frames';
import { D06Desktop } from '@/screens/d06/desktop.generated';

/**
 * D06 — les modèles de parcours et leurs versions. `/admin/parcours` (T5 D06).
 *
 * La maquette dessine la liste des versions (brouillon / publiée / archivée) et
 * l'éditeur de la version ouverte dans le MÊME cadre. T5 annonce
 * `admin/parcours · /versions/:id` ; il n'y a qu'une planche, donc une route.
 *
 * Le récapitulatif de publication est écrit à l'écran — « 142 parcours en cours
 * seront notifiés à la publication » — exactement comme T5 le demande. C'est la
 * seule chose que cet écran promet, et il la promet en la montrant.
 *
 * Le glisser-déposer des étapes que T5 décrit n'est PAS transcodable : une image
 * ne dessine pas un geste. Les sept étapes sont rendues telles que la maquette les
 * pose, dans l'ordre, avec leurs jalons (J-240 … J+45).
 */
export default function Page() {
  return <ScreenFrames screen="D06" desktop={<D06Desktop />} />;
}
