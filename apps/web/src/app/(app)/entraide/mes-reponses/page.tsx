import { ScreenFrames } from '@/screens/frames';
import { H10Desktop } from '@/screens/h10/desktop.generated';
import { H10Mobile } from '@/screens/h10/mobile.generated';

/**
 * H10 — Mes réponses (`/entraide/mes-reponses`).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Comme H09, cette planche n'est
 * pas dans T5 mais l'est dans 06 §5 et dans l'API (`GET /help/my-responses`).
 */
export default function MyHelpResponsesPage() {
  return <ScreenFrames screen="H10" desktop={<H10Desktop />} mobile={<H10Mobile />} />;
}
