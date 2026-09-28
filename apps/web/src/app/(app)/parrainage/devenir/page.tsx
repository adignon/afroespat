import { ScreenFrames } from '@/screens/frames';
import { H08Desktop } from '@/screens/h08/desktop.generated';
import { H08Mobile } from '@/screens/h08/mobile.generated';

/**
 * H08 — Devenir parrain (`/parrainage/devenir`, module 08).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`.
 *
 * Les conditions et le formulaire sont ceux que la maquette dessine ; les champs
 * restent dessinés, pour la raison exposée sur H03.
 */
export default function BecomeMentorPage() {
  return <ScreenFrames screen="H08" desktop={<H08Desktop />} mobile={<H08Mobile />} />;
}
