import { ScreenFrames } from '@/screens/frames';
import { H06Desktop } from '@/screens/h06/desktop.generated';

/**
 * H06 — Fiche d'un parrain (`/parrainage/:handle`, module 08).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`.
 *
 * PAS DE CADRE MOBILE, et ce n'est pas un oubli : la maquette n'en dessine pas. Sa
 * planche « MOBILE » ne montre pas la fiche sur téléphone mais la FEUILLE DE DEMANDE
 * posée sur un voile — c'est-à-dire la modale, pas l'écran. `ScreenFrames` sert donc
 * le cadre d'ordinateur à toutes les largeurs, exactement comme il le fait pour O05,
 * plutôt que d'inventer une mise en page mobile que le design n'a pas décidée.
 *
 * LA FEUILLE DE DEMANDE N'EST PAS MONTÉE DANS CE LOT. Son cadre d'ordinateur est
 * dessiné en carte nue de 540 px — sans voile, sans panneau positionné — là où les
 * quatre modales du fil (`03 Accueil v2`) dessinent les deux. Il n'y a donc rien à
 * marquer pour `Modal`, et lui ajouter un voile serait dessiner à la place du
 * porteur. Le bouton « Demander comme parraine » reste donc inerte, comme tous les
 * boutons de ces écrans statiques. Détail et correctif proposé dans le rapport.
 */
export default function MentorProfilePage() {
  return <ScreenFrames screen="H06" desktop={<H06Desktop />} />;
}
