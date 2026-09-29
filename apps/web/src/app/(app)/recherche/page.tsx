import { ScreenFrames } from '@/screens/frames';
import { X01Desktop } from '@/screens/x01/desktop.generated';
import { X01Mobile } from '@/screens/x01/mobile.generated';

/**
 * X01 — Recherche (`/recherche`, 11 §4, T5 §10).
 *
 * Transcodé de `docs/template/09 Messages et transverse.dc.html`.
 *
 * LA PLANCHE D'ORDINATEUR MONTRE LES SUGGESTIONS DÉPLIÉES — 11 §2.3, « suggestions
 * dès 3 caractères ». Ce n'est pas un état à part : la maquette les dessine DANS le
 * cadre, en carte positionnée par-dessus la page, et le transcodage les garde là.
 *
 * ⚠ LE CADRE MOBILE N'A AUCUN TITRE. La maquette n'y écrit que la requête, dans le
 * champ de recherche ; promouvoir un champ de saisie en `<h1>` serait un titre
 * inventé. Le générateur le signale à chaque exécution. Consigné au rapport.
 *
 * L'ÉTAT VIDE — « Aucun résultat. Posez la question à la communauté ? » (11 §2.4) —
 * est dessiné par la maquette en COMPOSANT, dans une carte « ÉTATS » posée à côté des
 * planches, sans écran autour. Il n'est donc pas monté ici : il n'y a pas de cadre à
 * extraire, et lui en fabriquer un reviendrait à dessiner l'écran manquant.
 *
 * AUCUNE SAISIE N'EST BRANCHÉE : la recherche appelle `GET /search` et
 * `GET /search/suggest`, que ce lot ne branche pas. Le champ reste ce que la maquette
 * en dessine — comme le composeur du fil et comme « Publier ».
 */
export default function SearchPage() {
  return <ScreenFrames screen="X01" desktop={<X01Desktop />} mobile={<X01Mobile />} />;
}
