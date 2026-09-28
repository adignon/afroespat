import { ScreenFrames } from '@/screens/frames';
import { H05Desktop } from '@/screens/h05/desktop.generated';
import { H05Mobile } from '@/screens/h05/mobile.generated';

/**
 * H05 — Parrains, liste (`/parrainage`, module 08).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`.
 *
 * La maquette écrit en sous-titre « Gratuit, sans argent ni garantie ». Ce n'est pas
 * une mention de plan mais l'inverse : la promesse que le parrainage n'implique
 * aucun versement, qui double la règle dure affichée en permanence dans la section.
 */
export default function MentorsPage() {
  return <ScreenFrames screen="H05" desktop={<H05Desktop />} mobile={<H05Mobile />} />;
}
