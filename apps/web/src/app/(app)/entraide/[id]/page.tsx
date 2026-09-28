import { ScreenFrames } from '@/screens/frames';
import { H02Desktop } from '@/screens/h02/desktop.generated';
import { H02Mobile } from '@/screens/h02/mobile.generated';

/**
 * H02 — Demande d'entraide, détail (`/entraide/:id`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le détail du procédé et la raison pour laquelle cette page n'a pas d'état.
 *
 * L'identifiant de route n'est pas lu : la maquette montre UNE demande, écrite en
 * clair. Le brancher sur `:id` sans API afficherait la même demande pour tous les
 * identifiants — une promesse que l'écran ne tient pas. Le segment existe pour que
 * la route soit celle de la spec ; il sera lu au branchement de `GET /help/:id`.
 */
export default function HelpRequestPage() {
  return <ScreenFrames screen="H02" desktop={<H02Desktop />} mobile={<H02Mobile />} />;
}
